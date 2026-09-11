/** Only terminal response objects enter the existing structured-output checks. */
export type ResponseStreamProgress = {
  event: string;
  responseId: string;
  outputCharacters: number;
};

export function createResponseStreamDecoder(onProgress?: (progress: ResponseStreamProgress) => void) {
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let buffer = '', responseId = '', outputCharacters = 0, lastProgressAt = 0;
  let terminal: Record<string, unknown> | undefined;
  const report = (event: string) => {
    lastProgressAt = Date.now();
    onProgress?.({event, responseId, outputCharacters});
  };
  function frame(text: string) {
    const lines = text.split(/\r?\n/u);
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /u, '')).join('\n');
    if (!data || data === '[DONE]') return;
    let event: Record<string, unknown>;
    try { event = JSON.parse(data); } catch { throw new Error('Malformed Responses stream event.'); }
    if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.type !== 'string') throw new Error('Malformed Responses stream event.');
    const named = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    if (named && named !== event.type) throw new Error('Responses stream event type mismatch.');
    if (event.type === 'error') throw new Error('Responses stream reported a provider error.');
    if (event.type === 'response.created') {
      const response = event.response as {id?: unknown} | undefined;
      if (responseId || typeof response?.id !== 'string' || !/^resp_[A-Za-z0-9_-]{1,180}$/u.test(response.id)) throw new Error('Responses stream identity is invalid.');
      responseId = response.id;
      report(event.type);
    } else if (event.type === 'response.output_text.delta') {
      if (!responseId || typeof event.delta !== 'string') throw new Error('Responses stream delta is invalid.');
      const first = outputCharacters === 0;
      outputCharacters += event.delta.length;
      if (first || Date.now() - lastProgressAt >= 30_000) report(event.type);
    } else if (['response.completed', 'response.failed', 'response.incomplete'].includes(event.type)) {
      const response = event.response as Record<string, unknown> | undefined;
      if (!responseId || !response || Array.isArray(response) || response.id !== responseId || response.status !== event.type.slice(9)) throw new Error('Responses stream terminal identity or status is invalid.');
      terminal = response;
      report(event.type);
    }
  }
  return {
    push(chunk: Uint8Array) {
      if (terminal) return terminal;
      try { buffer += decoder.decode(chunk, {stream: true}); } catch { throw new Error('Responses stream contains invalid UTF-8.'); }
      let boundary: RegExpExecArray | null;
      while (!terminal && (boundary = /\r?\n\r?\n/u.exec(buffer))) {
        const content = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        frame(content);
      }
      return terminal;
    },
    finish() {
      if (!terminal) throw new Error('Responses stream ended without a terminal response.');
      return terminal;
    },
  };
}
