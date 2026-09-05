import { promises as dns } from 'node:dns';
import http, { type IncomingHttpHeaders, type IncomingMessage, type RequestOptions } from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';

import type {
  HttpRequest,
  HttpResponse,
  HttpTransport,
  SourceHttpRequest,
  SourceHttpResponse,
  SourceHttpTransport,
} from './http';
import type { DnsResolver } from './sources';

const DEFAULT_JSON_BODY_LIMIT = 2_000_000;
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

type RuntimeHttpOptions = {
  maxResponseBytes?: number;
};

type LookupResult = { address: string; family: number };

function parseUrl(raw: string, allowHttpForTests: boolean): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('HTTP request URL is invalid.');
  }
  if (url.username || url.password) throw new Error('HTTP request URL credentials are not allowed.');
  if (url.protocol !== 'https:' && !(allowHttpForTests && url.protocol === 'http:')) {
    throw new Error('Runtime API requests require HTTPS.');
  }
  return url;
}

function headersRecord(headers: IncomingHttpHeaders): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [
    name.toLocaleLowerCase('en-US'),
    Array.isArray(value) ? value.join(', ') : value,
  ]));
}

function numericLimit(value: number | undefined, fallback: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) throw new Error('HTTP response byte limit must be positive.');
  return resolved;
}

function requester(url: URL): typeof http.request {
  return url.protocol === 'https:' ? https.request : http.request;
}

function safeRequestOptions(url: URL, request: HttpRequest): RequestOptions {
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || undefined,
    path: `${url.pathname}${url.search}`,
    method: request.method,
    headers: request.headers,
    agent: false,
  };
}

function destroyOnAbort(
  signal: AbortSignal,
  destroy: (error: Error) => void,
): () => void {
  const abort = () => destroy(new Error('HTTP request aborted.'));
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  return () => signal.removeEventListener('abort', abort);
}

function createJsonHttpTransport(options: RuntimeHttpOptions, allowHttpForTests: boolean): HttpTransport {
  const maximum = numericLimit(options.maxResponseBytes, DEFAULT_JSON_BODY_LIMIT);
  return async (input: HttpRequest): Promise<HttpResponse> => {
    const url = parseUrl(input.url, allowHttpForTests);
    return await new Promise<HttpResponse>((resolve, reject) => {
      const request = requester(url)(safeRequestOptions(url, input), (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.byteLength;
          if (bytes > maximum) {
            response.destroy(new Error('HTTP response body exceeds the byte limit.'));
            return;
          }
          chunks.push(chunk);
        });
        response.once('error', reject);
        response.once('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let body: unknown = text;
          if (text) {
            try {
              body = JSON.parse(text);
            } catch {
              body = text;
            }
          }
          resolve({ status: response.statusCode ?? 0, headers: headersRecord(response.headers), body });
        });
      });
      const removeAbort = destroyOnAbort(input.signal, (error) => request.destroy(error));
      request.once('error', reject);
      request.once('close', removeAbort);
      if (input.body !== undefined) request.write(input.body);
      request.end();
    });
  };
}

export function createNodeJsonHttpTransport(options: RuntimeHttpOptions = {}): HttpTransport {
  return createJsonHttpTransport(options, false);
}

/** Explicitly test-only. Production runtime has no cleartext configuration switch. */
export function createTestOnlyNodeJsonHttpTransport(options: RuntimeHttpOptions = {}): HttpTransport {
  return createJsonHttpTransport(options, true);
}

export function createNodeDnsResolver(options: {
  lookup?: (hostname: string) => Promise<LookupResult[]>;
} = {}): DnsResolver {
  const lookup = options.lookup ?? (async (hostname: string) => (
    await dns.lookup(hostname, { all: true, verbatim: true })
  ));
  return async (hostname: string) => {
    const entries = await lookup(hostname.toLocaleLowerCase('en-US'));
    const addresses = entries.map(({ address }) => address).filter((address) => isIP(address) !== 0);
    if (addresses.length !== entries.length) throw new Error('DNS returned a non-IP address.');
    return [...new Set(addresses)];
  };
}

function pinnedRequestOptions(url: URL, input: SourceHttpRequest): RequestOptions {
  const candidates = [...new Set(input.allowedPeerAddresses)];
  if (candidates.length === 0 || candidates.some((address) => isIP(address) === 0)) {
    throw new Error('Source request requires validated peer IP addresses.');
  }
  const requestOptions: RequestOptions = {
    ...safeRequestOptions(url, input),
    lookup: ((_hostname: string, lookupOptions: { family?: number; all?: boolean } | number, callback: (...args: unknown[]) => void) => {
      const requestedFamily = typeof lookupOptions === 'number' ? lookupOptions : lookupOptions?.family;
      const eligible = candidates.filter((address) => !requestedFamily || isIP(address) === requestedFamily);
      if (eligible.length === 0) {
        callback(Object.assign(new Error('No validated peer matches the requested address family.'), { code: 'ENOTFOUND' }));
        return;
      }
      if (typeof lookupOptions !== 'number' && lookupOptions?.all) {
        callback(null, eligible.map((address) => ({ address, family: isIP(address) })));
        return;
      }
      const selected = eligible[0];
      callback(null, selected, isIP(selected));
    }) as RequestOptions['lookup'],
  };
  if (url.protocol === 'https:') {
    (requestOptions as RequestOptions & { servername?: string }).servername = url.hostname;
  }
  return requestOptions;
}

function streamingBody(
  response: IncomingMessage,
  request: ReturnType<typeof http.request>,
  maximum: number,
): AsyncIterable<Uint8Array> {
  const iterator = response[Symbol.asyncIterator]();
  let bytes = 0;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (!response.destroyed) response.destroy();
    if (!request.destroyed) request.destroy();
    if (!response.socket.destroyed) response.socket.destroy();
  };
  const bodyIterator: AsyncIterator<Uint8Array> & AsyncIterable<Uint8Array> = {
    async next() {
      if (closed) return { done: true, value: undefined };
      try {
        const next = await iterator.next();
        if (next.done) {
          closed = true;
          return { done: true, value: undefined };
        }
        const value = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
        bytes += value.byteLength;
        if (bytes > maximum) {
          close();
          throw new Error('Source response body exceeds the byte limit.');
        }
        return {
          done: false,
          value: new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
        };
      } catch (error) {
        close();
        throw error;
      }
    },
    async return() {
      close();
      try {
        await iterator.return?.();
      } catch {
        // Destruction above is authoritative cleanup.
      }
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator]() { return this; },
  };
  return {
    [Symbol.asyncIterator]() { return bodyIterator; },
  };
}

function createSourceHttpTransport(allowHttpForTests: boolean): SourceHttpTransport {
  return async (input: SourceHttpRequest): Promise<SourceHttpResponse> => {
    if (input.redirect !== 'manual') throw new Error('Source redirects must be manual.');
    const maximum = numericLimit(input.maxResponseBytes, 1);
    const url = parseUrl(input.url, allowHttpForTests);
    return await new Promise<SourceHttpResponse>((resolve, reject) => {
      let settled = false;
      const request = requester(url)(pinnedRequestOptions(url, input), (response) => {
        const peerAddress = response.socket.remoteAddress;
        if (!peerAddress || !input.allowedPeerAddresses.includes(peerAddress)) {
          response.destroy();
          request.destroy();
          reject(new Error('Connected source peer does not match a validated address.'));
          return;
        }
        settled = true;
        const removeResponseAbort = destroyOnAbort(input.signal, (error) => {
          response.destroy(error);
          request.destroy(error);
          response.socket.destroy(error);
        });
        response.once('close', removeResponseAbort);
        resolve({
          status: response.statusCode ?? 0,
          headers: headersRecord(response.headers),
          body: streamingBody(response, request, maximum),
          redirected: false,
          url: url.toString(),
          peerAddress,
        });
      });
      const removeAbort = destroyOnAbort(input.signal, (error) => request.destroy(error));
      request.once('error', (error) => {
        if (!settled) reject(error);
      });
      request.once('close', removeAbort);
      request.end(input.body);
    });
  };
}

export function createNodeSourceHttpTransport(): SourceHttpTransport {
  return createSourceHttpTransport(false);
}

/** Explicitly test-only. Production runtime has no cleartext configuration switch. */
export function createTestOnlyNodeSourceHttpTransport(): SourceHttpTransport {
  return createSourceHttpTransport(true);
}

export function isRedirectStatus(status: number): boolean {
  return REDIRECT_STATUS.has(status);
}
