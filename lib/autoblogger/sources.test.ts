import { describe, expect, it } from 'vitest';

import {
  createSafeSourceChecker,
  type DnsResolver,
} from './sources';
import type { HttpRequest, HttpTransport } from './http';

const publicResolver: DnsResolver = async () => ['93.184.216.34'];

function responseTransport(responses: Array<{
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}>) {
  const requests: HttpRequest[] = [];
  const transport: HttpTransport = async (request) => {
    requests.push(request);
    const response = responses.shift();
    if (!response) throw new Error('Unexpected source request');
    return { headers: {}, body: '', ...response };
  };
  return { requests, transport };
}

describe('safe source checks', () => {
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
    const transport: HttpTransport = (request) => new Promise((_resolve, reject) => {
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
    const transport: HttpTransport = async () => new Promise((resolve) => {
      setTimeout(() => resolve({ status: 200, headers: {}, body: 'late' }), 25);
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
});

describe('source authority and evidence selection', () => {
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
