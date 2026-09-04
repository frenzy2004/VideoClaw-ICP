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
  select(urls: string[]): Promise<Array<{ url: string; authoritative: boolean }>>;
};

export type SafeSourceCheckerOptions = {
  transport: SourceHttpTransport;
  resolveHostname: DnsResolver;
  authoritativeDomains?: ReadonlySet<string>;
  primarySourceUrls?: string[];
  limits?: Partial<SourceCheckLimits>;
};

const DEFAULT_LIMITS: SourceCheckLimits = {
  maxRedirects: 3,
  maxBodyBytes: 1_000_000,
  timeoutMs: 5_000,
};
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function normalizedHostname(hostname: string): string {
  return hostname.toLocaleLowerCase('en-US').replace(/^\[|\]$/g, '').replace(/^www\./, '');
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

function parseSourceUrl(value: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Source URL must use HTTP or HTTPS.');
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
  body: AsyncIterable<Uint8Array>,
  maxBodyBytes: number,
  remainingMs: () => number,
): Promise<void> {
  const iterator = body[Symbol.asyncIterator]();
  let bytes = 0;
  try {
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
  } finally {
    await iterator.return?.();
  }
}

async function closeBody(body: AsyncIterable<Uint8Array>): Promise<void> {
  await body[Symbol.asyncIterator]().return?.();
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

function domainMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function createSafeSourceChecker(options: SafeSourceCheckerOptions): SafeSourceChecker {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  if (limits.maxRedirects < 0 || limits.maxBodyBytes < 0 || limits.timeoutMs <= 0) {
    throw new Error('Source-check limits must be non-negative and timeout must be positive.');
  }
  const authoritativeDomains = new Set(
    [...(options.authoritativeDomains ?? [])].map(normalizedHostname),
  );
  const primaryDomains = new Set(
    (options.primarySourceUrls ?? []).map((url) => normalizedHostname(parseSourceUrl(url).hostname)),
  );

  function isAuthoritative(url: URL): boolean {
    const hostname = normalizedHostname(url.hostname);
    return [...authoritativeDomains, ...primaryDomains]
      .some((domain) => domainMatches(hostname, domain));
  }

  async function check(value: string): Promise<CheckedSource> {
    const initialUrl = parseSourceUrl(value);
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
      assertTransportResponse(response, currentUrl, allowedPeerAddresses);

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = header(response, 'location');
        if (!location) throw new Error('Source redirect is missing a location.');
        if (redirectCount >= limits.maxRedirects) throw new Error('Source redirect limit exceeded.');
        await closeBody(response.body);
        currentUrl = parseSourceUrl(new URL(location, currentUrl).toString());
        redirectCount += 1;
        continue;
      }

      const contentLength = Number(header(response, 'content-length'));
      if (
        Number.isFinite(contentLength) && contentLength > limits.maxBodyBytes
      ) {
        throw new Error('Source response body exceeds the byte limit.');
      }
      await consumeBodyWithinLimits(response.body, limits.maxBodyBytes, remainingMs);
      return {
        url: initialUrl.toString(),
        finalUrl: currentUrl.toString(),
        status: response.status,
        reachable: response.status >= 200 && response.status < 300,
        authoritative: isAuthoritative(currentUrl),
      };
    }
  }

  async function select(urls: string[]): Promise<Array<{ url: string; authoritative: boolean }>> {
    const selected: Array<{ url: string; authoritative: boolean }> = [];
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
      selected.push({ url: result.finalUrl, authoritative: result.authoritative });
    }
    if (selected.length < 2 || !selected.some(({ authoritative }) => authoritative)) {
      throw new Error('Research requires two reachable sources including one authoritative source.');
    }
    return selected;
  }

  return { check, select };
}
