import { describe, expect, it } from 'vitest';

import {
  createSafeSourceChecker,
  type DnsResolver,
} from './sources';
import type {
  SourceHttpRequest,
  SourceHttpTransport,
} from './http';

const publicResolver: DnsResolver = async () => ['93.184.216.34'];

async function* byteStream(...chunks: string[]) {
  for (const chunk of chunks) yield new TextEncoder().encode(chunk);
}

function bodyWithCleanup(
  cleanup: () => Promise<IteratorResult<Uint8Array>>,
): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => ({ done: true, value: undefined }),
        return: cleanup,
      };
    },
  };
}

function responseTransport(responses: Array<{
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  redirected?: boolean;
  url?: string;
  peerAddress?: string;
}>) {
  const requests: SourceHttpRequest[] = [];
  const transport: SourceHttpTransport = async (request) => {
    requests.push(request);
    const response = responses.shift();
    if (!response) throw new Error('Unexpected source request');
    const body = response.body != null && Symbol.asyncIterator in Object(response.body)
      ? response.body as AsyncIterable<Uint8Array>
      : byteStream(String(response.body ?? ''));
    return {
      headers: {},
      redirected: false,
      url: request.url,
      peerAddress: request.allowedPeerAddresses[0],
      ...response,
      body,
    };
  };
  return { requests, transport };
}

describe('safe source checks', () => {
  it('transport contract rejects an automatically followed redirect', async () => {
    const transport: SourceHttpTransport = async () => ({
      status: 200,
      headers: {},
      body: byteStream('private response'),
      redirected: true,
      url: 'http://169.254.169.254/latest/meta-data',
      peerAddress: '169.254.169.254',
    });
    const checker = createSafeSourceChecker({ transport, resolveHostname: publicResolver });

    await expect(checker.check('https://safe.example/source')).rejects.toThrow(
      /automatic redirect|manual redirect/i,
    );
  });

  it('transport contract rejects a peer outside the validated DNS addresses', async () => {
    const transport: SourceHttpTransport = async (request) => ({
      status: 200,
      headers: {},
      body: byteStream('rebound response'),
      redirected: false,
      url: request.url,
      peerAddress: '10.0.0.8',
    });
    const checker = createSafeSourceChecker({ transport, resolveHostname: publicResolver });

    await expect(checker.check('https://rebind.example/source')).rejects.toThrow(
      /peer.*validated|address.*mismatch/i,
    );
  });

  it('transport contract streams and rejects a response crossing the byte cap', async () => {
    const requests: SourceHttpRequest[] = [];
    const transport: SourceHttpTransport = async (request) => {
      requests.push(request);
      return {
        status: 200,
        headers: {},
        body: byteStream('123', '456'),
        redirected: false,
        url: request.url,
        peerAddress: '93.184.216.34',
      };
    };
    const checker = createSafeSourceChecker({
      transport,
      resolveHostname: publicResolver,
      limits: { maxBodyBytes: 5 },
    });

    await expect(checker.check('https://stream.example/source')).rejects.toThrow(
      /body|bytes|large/i,
    );
    expect(requests[0]).toMatchObject({
      redirect: 'manual',
      allowedPeerAddresses: ['93.184.216.34'],
      maxResponseBytes: 5,
    });
  });

  it('rejects localhost and private literal or DNS-resolved targets before HTTP', async () => {
    const direct = responseTransport([]);
    const directChecker = createSafeSourceChecker({
      transport: direct.transport,
      resolveHostname: publicResolver,
    });
    const resolved = responseTransport([]);
    const resolvedChecker = createSafeSourceChecker({
      transport: resolved.transport,
      resolveHostname: async () => ['10.2.3.4'],
    });

    await expect(directChecker.check('http://127.0.0.1/admin')).rejects.toThrow(/private|local/i);
    await expect(directChecker.check('http://localhost/admin')).rejects.toThrow(/private|local/i);
    await expect(resolvedChecker.check('https://public-looking.example/data')).rejects.toThrow(
      /private|local/i,
    );
    expect(direct.requests).toHaveLength(0);
    expect(resolved.requests).toHaveLength(0);
  });

  it('revalidates every redirect target and blocks link-local destinations', async () => {
    const fixture = responseTransport([{
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data' },
    }]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
    });

    await expect(checker.check('https://safe.example/source')).rejects.toThrow(/private|local/i);
    expect(fixture.requests).toHaveLength(1);
  });

  it('caps redirects and response bytes without retaining body text', async () => {
    const fixture = responseTransport([
      { status: 301, headers: { location: '/canonical' } },
      { status: 200, headers: { 'content-length': '12' }, body: 'hello source' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      limits: { maxRedirects: 1, maxBodyBytes: 12, timeoutMs: 50 },
    });

    const result = await checker.check('https://example.com/original');

    expect(result).toEqual({
      url: 'https://example.com/original',
      finalUrl: 'https://example.com/canonical',
      status: 200,
      reachable: true,
      authoritative: false,
    });
    expect(JSON.stringify(result)).not.toContain('hello source');

    const tooLarge = createSafeSourceChecker({
      transport: responseTransport([{ status: 200, body: '123456' }]).transport,
      resolveHostname: publicResolver,
      limits: { maxRedirects: 0, maxBodyBytes: 5, timeoutMs: 50 },
    });
    await expect(tooLarge.check('https://example.com/large')).rejects.toThrow(/body|bytes|large/i);
  });

  it('times out a slow source request', async () => {
    const transport: SourceHttpTransport = (request) => new Promise((_resolve, reject) => {
      request.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
    const checker = createSafeSourceChecker({
      transport,
      resolveHostname: publicResolver,
      limits: { maxRedirects: 0, maxBodyBytes: 100, timeoutMs: 5 },
    });

    await expect(checker.check('https://slow.example/source')).rejects.toThrow(/timed out/i);
  });

  it('enforces the timeout even when an injected transport ignores abort signals', async () => {
    const transport: SourceHttpTransport = async (request) => new Promise((resolve) => {
      setTimeout(() => resolve({
        status: 200,
        headers: {},
        body: byteStream('late'),
        redirected: false,
        url: request.url,
        peerAddress: request.allowedPeerAddresses[0],
      }), 25);
    });
    const checker = createSafeSourceChecker({
      transport,
      resolveHostname: publicResolver,
      limits: { maxRedirects: 0, maxBodyBytes: 100, timeoutMs: 5 },
    });

    await expect(checker.check('https://ignores-abort.example/source')).rejects.toThrow(/timed out/i);
  });

  it('enforces the timeout while DNS resolution is still pending', async () => {
    const checker = createSafeSourceChecker({
      transport: responseTransport([]).transport,
      resolveHostname: async () => new Promise(() => undefined),
      limits: { maxRedirects: 0, maxBodyBytes: 100, timeoutMs: 5 },
    });

    const outcome = await Promise.race([
      checker.check('https://pending-dns.example/source').then(
        () => 'resolved',
        (error) => String(error),
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve('still pending'), 20)),
    ]);
    expect(outcome).toMatch(/timed out/i);
  });

  it('deadline-bounds cleanup when iterator.return never settles', async () => {
    const fixture = responseTransport([{
      status: 200,
      body: bodyWithCleanup(() => new Promise(() => undefined)),
    }]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      limits: { maxRedirects: 0, maxBodyBytes: 100, timeoutMs: 5 },
    });

    const outcome = await Promise.race([
      checker.check('https://hanging-cleanup.example/source').then(
        () => 'resolved',
        (error) => String(error),
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve('still pending'), 20)),
    ]);

    expect(outcome).toBe('resolved');
  });

  it('ignores redirect cleanup rejection and continues to the validated target', async () => {
    const fixture = responseTransport([
      {
        status: 302,
        headers: { location: '/canonical' },
        body: bodyWithCleanup(async () => {
          throw new Error('cleanup failed');
        }),
      },
      { status: 200, body: 'canonical source' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
    });

    await expect(checker.check('https://example.com/original')).resolves.toMatchObject({
      finalUrl: 'https://example.com/canonical',
      reachable: true,
    });
  });

  it('cleans up an oversized response without replacing the byte-limit failure', async () => {
    let cleanupCalls = 0;
    const fixture = responseTransport([{
      status: 200,
      headers: { 'content-length': '101' },
      body: bodyWithCleanup(async () => {
        cleanupCalls += 1;
        throw new Error('cleanup failed');
      }),
    }]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      limits: { maxBodyBytes: 100 },
    });

    await expect(checker.check('https://example.com/oversized')).rejects.toThrow(/byte limit/i);
    expect(cleanupCalls).toBe(1);
  });
});

describe('source authority and evidence selection', () => {
  it('canonicalizes fragments before deciding whether final resources are distinct', async () => {
    const fixture = responseTransport([
      { status: 200, body: 'same page' },
      { status: 200, body: 'same page' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      authoritativeDomains: new Set(['authority.example']),
    });

    await expect(checker.select([
      'https://authority.example/reference#introduction',
      'https://authority.example/reference#details',
    ])).rejects.toThrow(/two reachable.*authoritative/i);
    expect(fixture.requests.every(({ url }) => !url.includes('#'))).toBe(true);
  });

  it('continues after an unsafe candidate and uses later reachable sources', async () => {
    const fixture = responseTransport([
      { status: 200, body: 'authority' },
      { status: 200, body: 'publisher' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      authoritativeDomains: new Set(['authority.example']),
    });

    await expect(checker.select([
      'http://127.0.0.1/private',
      'https://authority.example/reference',
      'https://publisher.example/guide',
    ])).resolves.toEqual([
      { url: 'https://authority.example/reference', authoritative: true },
      { url: 'https://publisher.example/guide', authoritative: false },
    ]);
  });

  it('uses only caller-supplied authority domains and same-domain primary sources', async () => {
    const fixture = responseTransport([
      { status: 200, body: 'standard' },
      { status: 200, body: 'primary documentation' },
      { status: 200, body: 'encyclopedia' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      authoritativeDomains: new Set(['standards.example']),
      primarySourceUrls: ['https://product.example/docs/canonical'],
    });

    await expect(checker.check('https://standards.example/spec')).resolves.toMatchObject({
      authoritative: true,
    });
    await expect(checker.check('https://product.example/press/facts')).resolves.toMatchObject({
      authoritative: true,
    });
    await expect(checker.check('https://wikipedia.org/wiki/Video')).resolves.toMatchObject({
      authoritative: false,
    });
  });

  it('requires two distinct reachable sources including one authoritative source', async () => {
    const passing = createSafeSourceChecker({
      transport: responseTransport([
        { status: 200, body: 'first' },
        { status: 200, body: 'second' },
      ]).transport,
      resolveHostname: publicResolver,
      authoritativeDomains: new Set(['authority.example']),
    });
    const selected = await passing.select([
      'https://authority.example/reference',
      'https://publisher.example/guide',
    ]);
    expect(selected).toEqual([
      { url: 'https://authority.example/reference', authoritative: true },
      { url: 'https://publisher.example/guide', authoritative: false },
    ]);

    const failing = createSafeSourceChecker({
      transport: responseTransport([
        { status: 200, body: 'first' },
        { status: 404, body: 'missing' },
      ]).transport,
      resolveHostname: publicResolver,
    });
    await expect(failing.select([
      'https://one.example/reference',
      'https://two.example/missing',
    ])).rejects.toThrow(/two reachable.*authoritative/i);
  });
});
