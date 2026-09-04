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

export function redactSensitive(value: unknown, secrets: string[] = []): string {
  let redacted = value instanceof Error
    ? `${value.name}: ${value.message}`
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);
  for (const secret of secrets) {
    if (secret) redacted = redacted.replaceAll(secret, '[REDACTED]');
  }
  return redacted
    .replace(/\b(?:apify_api_|sk-(?:proj-)?|gh[opsu]_)[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(/\b(?:Bearer|Apikey)\s+[^\s"']+/gi, '[REDACTED]');
}

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
