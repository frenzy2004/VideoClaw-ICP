export type HttpRequest = {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: string;
  signal: AbortSignal;
};

export type HttpResponse = {
  status: number;
  headers: Record<string, string | undefined>;
  body: unknown;
};

export type HttpTransport = (request: HttpRequest) => Promise<HttpResponse>;

/**
 * Security contract for source retrieval transports. Implementations must:
 * disable automatic redirects, connect only to one of `allowedPeerAddresses`,
 * report the actual connected peer, expose body bytes incrementally, stop at
 * `maxResponseBytes`, and cancel I/O when the signal aborts or iteration ends.
 */
export type SourceHttpRequest = HttpRequest & {
  redirect: 'manual';
  allowedPeerAddresses: readonly string[];
  maxResponseBytes: number;
};

export type SourceHttpResponse = Omit<HttpResponse, 'body'> & {
  body: AsyncIterable<Uint8Array>;
  redirected: boolean;
  url: string;
  peerAddress: string;
};

export type SourceHttpTransport = (
  request: SourceHttpRequest,
) => Promise<SourceHttpResponse>;

export { redactSensitive } from './secrets';

export async function requestWithTimeout<
  TRequest extends HttpRequest,
  TResponse extends HttpResponse,
>(
  transport: (request: TRequest) => Promise<TResponse>,
  request: Omit<TRequest, 'signal'>,
  timeoutMs: number,
): Promise<TResponse> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`HTTP request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      transport({ ...request, signal: controller.signal } as TRequest),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeout!);
  }
}
