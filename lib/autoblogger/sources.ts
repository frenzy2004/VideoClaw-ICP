import { isIP } from 'node:net';

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
};

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
): Promise<void> {
  let bytes = 0;
  for (;;) {
    const timeLeft = remainingMs();
    if (timeLeft <= 0) throw new Error('Source check timed out.');
    const next = await nextChunkWithTimeout(iterator, timeLeft);
    if (next.done) return;
    if (!ArrayBuffer.isView(next.value) || next.value.BYTES_PER_ELEMENT !== 1) {
      throw new Error('Source transport body must stream Uint8Array chunks.');
    }
    bytes += next.value.byteLength;
    if (bytes > maxBodyBytes) {
      throw new Error('Source response body exceeds the byte limit.');
    }
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

function createSourceChecker(options: SafeSourceCheckerOptions, allowHttpForTests: boolean): SafeSourceChecker {
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

  async function check(value: string): Promise<CheckedSource> {
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
        await consumeBodyWithinLimits(iterator, limits.maxBodyBytes, remainingMs);
        return {
          kind: 'checked' as const,
          source: {
            url: initialUrl.toString(),
            finalUrl: currentUrl.toString(),
            status: response.status,
            reachable: response.status >= 200 && response.status < 300,
            authoritative: isAuthoritative(currentUrl),
          },
        };
      });

      if (outcome.kind === 'checked') return outcome.source;
      currentUrl = outcome.url;
      redirectCount += 1;
    }
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

  return { check, select };
}

export function createSafeSourceChecker(options: SafeSourceCheckerOptions): SafeSourceChecker {
  return createSourceChecker(options, false);
}

/** Explicitly test-only cleartext constructor. Production runtime never imports this. */
export function createTestOnlySafeSourceChecker(options: SafeSourceCheckerOptions): SafeSourceChecker {
  return createSourceChecker(options, true);
}
