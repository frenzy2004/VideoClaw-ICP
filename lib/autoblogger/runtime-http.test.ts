import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';

import { requestWithTimeout } from './http';
import {
  createNodeDnsResolver,
  createNodeJsonHttpTransport,
  createNodeSourceHttpTransport,
} from './runtime-http';

async function listen(server: Server): Promise<number> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not bind.');
  return address.port;
}

async function close(server: Server): Promise<void> {
  server.close();
  await once(server, 'close');
}

describe('production JSON transport', () => {
  it('does not follow redirects and bounds decoded JSON responses', async () => {
    let followed = false;
    const server = createServer((request, response) => {
      if (request.url === '/redirect') {
        response.writeHead(302, { location: '/followed' }).end();
        return;
      }
      if (request.url === '/followed') followed = true;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, payload: 'x'.repeat(64) }));
    });
    const port = await listen(server);
    const transport = createNodeJsonHttpTransport({ allowHttpForTests: true, maxResponseBytes: 32 });
    const controller = new AbortController();

    const redirect = await transport({
      method: 'GET',
      url: `http://127.0.0.1:${port}/redirect`,
      headers: {},
      signal: controller.signal,
    });
    expect(redirect.status).toBe(302);
    expect(followed).toBe(false);

    await expect(transport({
      method: 'GET',
      url: `http://127.0.0.1:${port}/followed`,
      headers: {},
      signal: controller.signal,
    })).rejects.toThrow(/byte limit/i);
    await close(server);
  });

  it('aborts a hanging request within the caller deadline', async () => {
    const server = createServer(() => undefined);
    const port = await listen(server);
    const transport = createNodeJsonHttpTransport({ allowHttpForTests: true });

    await expect(requestWithTimeout(transport, {
      method: 'GET',
      url: `http://127.0.0.1:${port}/hang`,
      headers: {},
    }, 20)).rejects.toThrow(/timed out/i);
    await close(server);
  });
});

describe('pinned streaming source transport', () => {
  it('pins the validated peer, reports the socket peer, and never auto-follows', async () => {
    let finalHits = 0;
    let observedHost = '';
    const server = createServer((request, response) => {
      observedHost = request.headers.host ?? '';
      if (request.url === '/start') {
        response.writeHead(302, { location: '/final' }).end();
        return;
      }
      finalHits += 1;
      response.end('followed');
    });
    const port = await listen(server);
    const transport = createNodeSourceHttpTransport({ allowHttpForTests: true });
    const controller = new AbortController();
    const response = await transport({
      method: 'GET',
      url: `http://source.invalid:${port}/start`,
      headers: { accept: 'text/plain' },
      signal: controller.signal,
      redirect: 'manual',
      allowedPeerAddresses: ['127.0.0.1'],
      maxResponseBytes: 1_024,
    });

    expect(response.status).toBe(302);
    expect(response.redirected).toBe(false);
    expect(response.url).toBe(`http://source.invalid:${port}/start`);
    expect(response.peerAddress).toBe('127.0.0.1');
    expect(observedHost).toBe(`source.invalid:${port}`);
    expect(finalHits).toBe(0);
    let drainedBytes = 0;
    for await (const chunk of response.body) drainedBytes += chunk.byteLength;
    expect(drainedBytes).toBe(0);
    await close(server);
  });

  it('streams chunks, enforces the byte cap, and cancels on iterator return', async () => {
    let responseClosed = false;
    const server = createServer((_request, response) => {
      response.on('close', () => { responseClosed = true; });
      response.write('1234');
      setTimeout(() => response.write('5678'), 10);
      setTimeout(() => response.end('90'), 30);
    });
    const port = await listen(server);
    const transport = createNodeSourceHttpTransport({ allowHttpForTests: true });
    const request = (maxResponseBytes: number) => transport({
      method: 'GET' as const,
      url: `http://stream.invalid:${port}/stream`,
      headers: {},
      signal: new AbortController().signal,
      redirect: 'manual' as const,
      allowedPeerAddresses: ['127.0.0.1'],
      maxResponseBytes,
    });

    const capped = await request(6);
    const cappedIterator = capped.body[Symbol.asyncIterator]();
    expect(Buffer.from((await cappedIterator.next()).value as Uint8Array).toString()).toBe('1234');
    await expect(cappedIterator.next()).rejects.toThrow(/byte limit/i);

    responseClosed = false;
    const cancellable = await request(100);
    const iterator = cancellable.body[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.return?.();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(responseClosed).toBe(true);
    await close(server);
  });

  it('destroys an in-flight response when the caller aborts after headers', async () => {
    let responseClosed = false;
    const server = createServer((_request, response) => {
      response.on('close', () => { responseClosed = true; });
      response.write('first');
      setTimeout(() => response.end('second'), 200);
    });
    const port = await listen(server);
    const controller = new AbortController();
    const transport = createNodeSourceHttpTransport({ allowHttpForTests: true });
    const response = await transport({
      method: 'GET',
      url: `http://abort.invalid:${port}/stream`,
      headers: {},
      signal: controller.signal,
      redirect: 'manual',
      allowedPeerAddresses: ['127.0.0.1'],
      maxResponseBytes: 100,
    });
    const iterator = response.body[Symbol.asyncIterator]();
    await iterator.next();
    controller.abort();
    await expect(iterator.next()).rejects.toThrow(/abort/i);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(responseClosed).toBe(true);
    await close(server);
  });

  it('rejects an invalid peer allowlist and returns deduplicated DNS addresses', async () => {
    const server = createServer((_request, response) => response.end('ok'));
    const port = await listen(server);
    const transport = createNodeSourceHttpTransport({ allowHttpForTests: true });
    await expect(transport({
      method: 'GET',
      url: `http://source.invalid:${port}/`,
      headers: {},
      signal: new AbortController().signal,
      redirect: 'manual',
      allowedPeerAddresses: ['not-an-ip'],
      maxResponseBytes: 100,
    })).rejects.toThrow();

    const resolver = createNodeDnsResolver({
      lookup: async () => [
        { address: '203.0.113.8', family: 4 },
        { address: '203.0.113.8', family: 4 },
        { address: '2001:db8::8', family: 6 },
      ],
    });
    await expect(resolver('Example.COM')).resolves.toEqual(['203.0.113.8', '2001:db8::8']);
    await close(server);
  });
});
