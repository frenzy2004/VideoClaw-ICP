import { isIP } from 'node:net';
import { createHash } from 'node:crypto';

import { extractSourceBody, type SourceReadOptions, type SourcePassage } from './source-extraction';
import { matchSourceTitleTasks, scoreSourceTopic, sourcePageIdentity } from './source-relevance';
import { faqBodyMatches } from './faq-evidence';
export type { SourceReadOptions, SourcePassage } from './source-extraction';

import {
  requestWithTimeout,
  type SourceHttpResponse,
  type SourceHttpTransport,
} from './http';

export type DnsResolver = (hostname: string) => Promise<string[]>;

export type SourceCheckLimits = {
  maxRedirects: number;
  maxBodyBytes: number;
  timeoutMs: number;
};

export type CheckedSource = {
  url: string;
  finalUrl: string;
  status: number;
  reachable: boolean;
  authoritative: boolean;
};

export type SafeSourceChecker = {
  check(url: string): Promise<CheckedSource>;
  select(urls: string[]): Promise<Array<{
    originalUrl: string;
    finalUrl: string;
    authoritative: boolean;
  }>>;
  read?(url: string, options?: SourceReadOptions): Promise<SourceDocument>;
  selectWithContent?(urls: string[], options?: SourceReadOptions): Promise<SourceSelectionWithContent>;
};

export type SourceDocument = CheckedSource & {
  checkedAt: string;
  contentType: string;
  bodySha256: string;
  text: string;
  passages: SourcePassage[];
};

export type SourceSelectionWithContent = {
  sources: Array<{ originalUrl: string; finalUrl: string; authoritative: boolean }>;
  sourceDocuments: SourceDocument[];
};

type ContentSourceChecker = SafeSourceChecker & Required<Pick<SafeSourceChecker, 'read' | 'selectWithContent'>>;

export type AuthorityPolicy = {
  hostname: string;
  pathPrefix?: string;
};

export type SafeSourceCheckerOptions = {
  transport: SourceHttpTransport;
  resolveHostname: DnsResolver;
  authorityPolicies?: readonly AuthorityPolicy[];
  limits?: Partial<SourceCheckLimits>;
};

const DEFAULT_LIMITS: SourceCheckLimits = {
  maxRedirects: 3,
  maxBodyBytes: 1_000_000,
  timeoutMs: 5_000,
};
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function normalizedHostname(hostname: string): string {
  return hostname.toLocaleLowerCase('en-US').replace(/^\[|\]$/g, '');
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true;
  }
  const [a, b] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function isPrivateAddress(address: string): boolean {
  const normalized = normalizedHostname(address);
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpv4(normalized.slice('::ffff:'.length));
  }
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith('ff');
}

function parseSourceUrl(value: string, allowHttpForTests = false): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(allowHttpForTests && url.protocol === 'http:')) {
    throw new Error('Source URL must use HTTPS.');
  }
  if (url.username || url.password) throw new Error('Source URL credentials are not allowed.');
  url.hash = '';
  return url;
}

async function resolveWithTimeout(
  resolveHostname: DnsResolver,
  hostname: string,
  timeoutMs: number,
): Promise<string[]> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error('Source check timed out.')), timeoutMs);
  });
  try {
    return await Promise.race([resolveHostname(hostname), timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

async function assertPublicTarget(
  url: URL,
  resolveHostname: DnsResolver,
  timeoutMs: number,
): Promise<string[]> {
  const hostname = normalizedHostname(url.hostname);
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Private or local source targets are not allowed.');
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('Private or local source targets are not allowed.');
    return [hostname];
  }
  const addresses = await resolveWithTimeout(resolveHostname, hostname, timeoutMs);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error('Private or local source targets are not allowed.');
  }
  return addresses.map(normalizedHostname);
}

function header(response: SourceHttpResponse, name: string): string | undefined {
  const entry = Object.entries(response.headers).find(
    ([key]) => key.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US'),
  );
  return entry?.[1];
}

async function nextChunkWithTimeout(
  iterator: AsyncIterator<Uint8Array>,
  timeoutMs: number,
): Promise<IteratorResult<Uint8Array>> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error('Source check timed out.')), timeoutMs);
  });
  try {
    return await Promise.race([iterator.next(), timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

async function consumeBodyWithinLimits(
  iterator: AsyncIterator<Uint8Array>,
  maxBodyBytes: number,
  remainingMs: () => number,
  retain: boolean,
): Promise<Buffer> {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for (;;) {
    const timeLeft = remainingMs();
    if (timeLeft <= 0) throw new Error('Source check timed out.');
    const next = await nextChunkWithTimeout(iterator, timeLeft);
    if (next.done) return Buffer.concat(chunks);
    if (!ArrayBuffer.isView(next.value) || next.value.BYTES_PER_ELEMENT !== 1) {
      throw new Error('Source transport body must stream Uint8Array chunks.');
    }
    bytes += next.value.byteLength;
    if (bytes > maxBodyBytes) {
      throw new Error('Source response body exceeds the byte limit.');
    }
    if (retain) chunks.push(Buffer.from(next.value));
  }
}

async function cleanupIteratorBestEffort(
  iterator: AsyncIterator<Uint8Array>,
  remainingMs: () => number,
): Promise<void> {
  let cleanup: Promise<void>;
  try {
    cleanup = Promise.resolve(iterator.return?.()).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return;
  }

  const timeLeft = remainingMs();
  if (timeLeft <= 0) return;
  let timeout: ReturnType<typeof setTimeout>;
  try {
    await Promise.race([
      cleanup,
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, timeLeft);
      }),
    ]);
  } finally {
    clearTimeout(timeout!);
  }
}

async function withBodyCleanup<T>(
  body: AsyncIterable<Uint8Array>,
  remainingMs: () => number,
  handleBody: (iterator: AsyncIterator<Uint8Array>) => Promise<T>,
): Promise<T> {
  const iterator = body[Symbol.asyncIterator]();
  try {
    return await handleBody(iterator);
  } finally {
    await cleanupIteratorBestEffort(iterator, remainingMs);
  }
}

function assertTransportResponse(
  response: SourceHttpResponse,
  requestedUrl: URL,
  allowedPeerAddresses: readonly string[],
): void {
  if (response.redirected || parseSourceUrl(response.url).toString() !== requestedUrl.toString()) {
    throw new Error('Source transport must use manual redirects and must not automatically follow.');
  }
  const peerAddress = normalizedHostname(response.peerAddress);
  if (isPrivateAddress(peerAddress) || !allowedPeerAddresses.includes(peerAddress)) {
    throw new Error('Source transport peer address does not match a validated address.');
  }
}

function createSourceChecker(options: SafeSourceCheckerOptions, allowHttpForTests: boolean): ContentSourceChecker {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  if (limits.maxRedirects < 0 || limits.maxBodyBytes < 0 || limits.timeoutMs <= 0) {
    throw new Error('Source-check limits must be non-negative and timeout must be positive.');
  }
  const authorityPolicies = (options.authorityPolicies ?? []).map((policy) => {
    const hostname = normalizedHostname(policy.hostname);
    if (!hostname || isIP(hostname) || hostname.includes('/')) throw new Error('Authority policy hostname is invalid.');
    const pathPrefix = policy.pathPrefix ?? '/';
    if (!pathPrefix.startsWith('/') || pathPrefix.includes('..') || pathPrefix.includes('?') || pathPrefix.includes('#')) {
      throw new Error('Authority policy path prefix is invalid.');
    }
    return { hostname, pathPrefix };
  });

  function isAuthoritative(url: URL): boolean {
    const hostname = normalizedHostname(url.hostname);
    return authorityPolicies.some((policy) => (
      hostname === policy.hostname && url.pathname.startsWith(policy.pathPrefix)
    ));
  }

  async function retrieve(value: string, retain: boolean): Promise<{
    source: CheckedSource; body: Buffer; contentType: string; checkedAt: string;
  }> {
    const initialUrl = parseSourceUrl(value, allowHttpForTests);
    let currentUrl = initialUrl;
    let redirectCount = 0;
    const startedAt = Date.now();
    const remainingMs = () => limits.timeoutMs - (Date.now() - startedAt);

    for (;;) {
      let timeLeft = remainingMs();
      if (timeLeft <= 0) throw new Error('Source check timed out.');
      const allowedPeerAddresses = await assertPublicTarget(
        currentUrl,
        options.resolveHostname,
        timeLeft,
      );
      timeLeft = remainingMs();
      if (timeLeft <= 0) throw new Error('Source check timed out.');
      let response: SourceHttpResponse;
      try {
        response = await requestWithTimeout(options.transport, {
          method: 'GET',
          url: currentUrl.toString(),
          headers: { Accept: 'text/html,application/xhtml+xml' },
          redirect: 'manual',
          allowedPeerAddresses,
          maxResponseBytes: limits.maxBodyBytes,
        }, timeLeft);
      } catch (error) {
        if (/abort/i.test(String(error)) || Date.now() - startedAt >= limits.timeoutMs) {
          throw new Error('Source check timed out.');
        }
        throw error;
      }
      const outcome = await withBodyCleanup(response.body, remainingMs, async (iterator) => {
        assertTransportResponse(response, currentUrl, allowedPeerAddresses);

        if (REDIRECT_STATUSES.has(response.status)) {
          const location = header(response, 'location');
          if (!location) throw new Error('Source redirect is missing a location.');
          if (redirectCount >= limits.maxRedirects) {
            throw new Error('Source redirect limit exceeded.');
          }
          return {
            kind: 'redirect' as const,
            url: parseSourceUrl(new URL(location, currentUrl).toString(), allowHttpForTests),
          };
        }

        const contentLength = Number(header(response, 'content-length'));
        if (
          Number.isFinite(contentLength) && contentLength > limits.maxBodyBytes
        ) {
          throw new Error('Source response body exceeds the byte limit.');
        }
        const body = await consumeBodyWithinLimits(iterator, limits.maxBodyBytes, remainingMs, retain);
        return {
          kind: 'checked' as const,
          body,
          contentType: header(response, 'content-type') ?? '',
          checkedAt: new Date().toISOString(),
          source: {
            url: initialUrl.toString(),
            finalUrl: currentUrl.toString(),
            status: response.status,
            reachable: response.status >= 200 && response.status < 300,
            authoritative: isAuthoritative(currentUrl),
          },
        };
      });

      if (outcome.kind === 'checked') return outcome;
      currentUrl = outcome.url;
      redirectCount += 1;
    }
  }

  async function check(value: string): Promise<CheckedSource> {
    return (await retrieve(value, false)).source;
  }

  async function read(value: string, readOptions: SourceReadOptions = {}): Promise<SourceDocument> {
    const { source, body, contentType, checkedAt } = await retrieve(value, true);
    if (!source.reachable) throw new Error('Source body evidence requires a successful response.');
    const mime = contentType.split(';')[0].trim().toLowerCase();
    if (mime !== 'text/html' && mime !== 'application/xhtml+xml') {
      throw new Error('Source body evidence requires an HTML content type.');
    }
    const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1] ?? 'utf-8';
    const html = new TextDecoder(charset, { fatal: true }).decode(body);
    return {
      ...source, checkedAt, contentType: mime,
      bodySha256: createHash('sha256').update(body).digest('hex'),
      ...extractSourceBody(html, readOptions),
    };
  }

  async function selectWithContent(urls: string[], readOptions: SourceReadOptions = {}): Promise<SourceSelectionWithContent> {
    if (urls.length > 24) throw new Error('Body selection exceeds the existing 24-URL research budget.');
    const relevant = new Map<string, { document: SourceDocument; score: number; titleTasks: Set<string>; faqQuestions: Set<string> }>();
    const requested = new Set<string>();
    for (const url of urls) {
      let document: SourceDocument;
      try {
        const normalized = parseSourceUrl(url, allowHttpForTests).toString();
        if (requested.has(normalized)) continue;
        requested.add(normalized);
        document = await read(normalized, readOptions);
      } catch { continue; }
      // Score only prose, never a retained H2–H6 heading joined to unrelated
      // prose. Keep the original document/passages unchanged for evidence use.
      const bodyText = document.passages.map(passage => passage.text.slice(passage.bodyStart ?? 0)).join('\n\n');
      const score = scoreSourceTopic(readOptions.query ?? '', bodyText);
      if (!score) continue;
      const key = sourcePageIdentity(document.finalUrl);
      const prior = relevant.get(key);
      if (!prior || Number(document.authoritative) > Number(prior.document.authoritative)
        || (document.authoritative === prior.document.authoritative && score > prior.score)) {
        relevant.set(key, { document, score, titleTasks: matchSourceTitleTasks(readOptions.query ?? '', readOptions.articleTitle ?? '', bodyText),
          faqQuestions: new Set((readOptions.questions ?? []).filter(question => document.passages.some(p => faqBodyMatches(question, p.text, p.bodyStart)))),
        });
      }
    }
    // Rank the whole supplied candidate set; early reachable pages must not
    // crowd out later topical bodies. Keep complete excerpts/qualifiers intact.
    const ranked = [...relevant.values()].sort((a, b) => b.score - a.score);
    let sourceDocuments = ranked.slice(0, 4).map(item => item.document);
    if (ranked.some(item => item.faqQuestions.size > 0)) {
      // Evaluate the bounded four-page sets, not greedy individual novelty: a
      // FAQ-only page can otherwise evict a workflow page even when a complete
      // combined cover exists. At most C(24,4)=10,626 sets; no extra fetches.
      let best: typeof ranked = [];
      let bestScore = [-1, -1, -1];
      const choose = (start: number, chosen: typeof ranked) => {
        if (chosen.length === Math.min(4, ranked.length)) {
          if (!chosen.some(item => item.document.authoritative)) return;
          // Only three FAQs are emitted. Once those can be answered, extra
          // unused answers must not evict the article's main-workflow sources.
          const score = [Math.min(3, new Set(chosen.flatMap(item => [...item.faqQuestions])).size),
            new Set(chosen.flatMap(item => [...item.titleTasks])).size,
            chosen.reduce((sum, item) => sum + item.score, 0)];
          const firstDifference = score.findIndex((value, index) => value !== bestScore[index]);
          if (firstDifference >= 0 && score[firstDifference] > bestScore[firstDifference]) {
            best = chosen.slice(); bestScore = score;
          }
          return;
        }
        for (let index = start; index <= ranked.length - (Math.min(4, ranked.length) - chosen.length); index++) {
          chosen.push(ranked[index]); choose(index + 1, chosen); chosen.pop();
        }
      };
      choose(0, []);
      if (best.length) sourceDocuments = best.map(item => item.document);
    } else if (ranked.some(item => item.titleTasks.size > 0)) {
      // Reserve an authority first, then greedily cover new title terms among
      // already topic-qualified bodies. Repeated keyword prose must not evict
      // complementary practical evidence. Remaining slots use topic ranking.
      const chosen: typeof ranked = [];
      const covered = new Set<string>();
      const novelty = (item: typeof ranked[number]) => [...item.titleTasks].filter(term => !covered.has(term)).length;
      const compare = (a: typeof ranked[number], b: typeof ranked[number]) => novelty(b) - novelty(a) || b.score - a.score;
      const add = (item: typeof ranked[number]) => { chosen.push(item); item.titleTasks.forEach(term => covered.add(term)); };
      const authorities = ranked.filter(item => item.document.authoritative).sort(compare);
      if (authorities[0]) add(authorities[0]);
      while (chosen.length < Math.min(4, ranked.length)) {
        const next = ranked.filter(item => !chosen.includes(item)).sort(compare)[0];
        add(next);
      }
      sourceDocuments = chosen.map(item => item.document);
    }
    const authority = ranked.find(item => item.document.authoritative)?.document;
    if (authority && sourceDocuments.length === 4 && !sourceDocuments.some(source => source.authoritative)) {
      sourceDocuments[sourceDocuments.length - 1] = authority;
    }
    if (sourceDocuments.length < 2 || !sourceDocuments.some((source) => source.authoritative)) {
      throw new Error('Research requires two directly relevant usable body evidence sources including one authoritative source.');
    }
    return {
      sources: sourceDocuments.map(({ url, finalUrl, authoritative }) => ({ originalUrl: url, finalUrl, authoritative })),
      sourceDocuments,
    };
  }

  async function select(urls: string[]): Promise<Array<{
    originalUrl: string;
    finalUrl: string;
    authoritative: boolean;
  }>> {
    const selected: Array<{ originalUrl: string; finalUrl: string; authoritative: boolean }> = [];
    const seen = new Set<string>();
    for (const url of urls) {
      let result: CheckedSource;
      try {
        result = await check(url);
      } catch {
        continue;
      }
      if (!result.reachable || seen.has(result.finalUrl)) continue;
      seen.add(result.finalUrl);
      selected.push({
        originalUrl: result.url,
        finalUrl: result.finalUrl,
        authoritative: result.authoritative,
      });
    }
    if (selected.length < 2 || !selected.some(({ authoritative }) => authoritative)) {
      throw new Error('Research requires two reachable sources including one authoritative source.');
    }
    return selected;
  }

  return { check, select, read, selectWithContent };
}

export function createSafeSourceChecker(options: SafeSourceCheckerOptions): ContentSourceChecker {
  return createSourceChecker(options, false);
}

/** Explicitly test-only cleartext constructor. Production runtime never imports this. */
export function createTestOnlySafeSourceChecker(options: SafeSourceCheckerOptions): ContentSourceChecker {
  return createSourceChecker(options, true);
}
