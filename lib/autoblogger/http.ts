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

export async function requestWithTimeout(
  transport: HttpTransport,
  request: Omit<HttpRequest, 'signal'>,
  timeoutMs: number,
): Promise<HttpResponse> {
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
      transport({ ...request, signal: controller.signal }),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeout!);
  }
}
