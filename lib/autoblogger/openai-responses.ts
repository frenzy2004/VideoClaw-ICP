import { redactSensitive, requestWithTimeout, type HttpTransport } from './http';

export const DEFAULT_OPENAI_MODEL = 'gpt-5.5';
export const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
export const DEFAULT_OPENAI_MAX_OUTPUT_TOKENS = 24_000;
export const DEFAULT_OPENAI_TIMEOUT_MS = 240_000;
export type OpenAIReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

export type JsonSchema = Readonly<Record<string, unknown>>;

export type StructuredOutputRequest = {
  name: string;
  schema: JsonSchema;
  system: string;
  input: unknown;
};

export type StructuredOutputClient = {
  generate(request: StructuredOutputRequest): Promise<unknown>;
};

export type OpenAIResponsesClientOptions = {
  apiKey: string;
  transport: HttpTransport;
  env?: Record<string, string | undefined>;
  endpoint?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  reasoningEffort?: OpenAIReasoningEffort;
};

type OpenAIResponseBody = {
  status?: unknown;
  error?: unknown;
  incomplete_details?: unknown;
  output?: unknown;
};

function parseBody(body: unknown): OpenAIResponseBody {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as OpenAIResponseBody;
    } catch {
      throw new Error('OpenAI Responses API returned malformed JSON.');
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('OpenAI Responses API returned a malformed response.');
  }
  return body as OpenAIResponseBody;
}

function outputText(body: OpenAIResponseBody): string {
  if (body.status !== 'completed') {
    const detail = body.status === 'incomplete' ? `: ${JSON.stringify(body.incomplete_details)}` : '';
    throw new Error(`OpenAI response was ${String(body.status)}${detail}.`);
  }
  if (!Array.isArray(body.output)) {
    throw new Error('OpenAI response did not contain message output.');
  }
  const texts = body.output.flatMap((item) => {
    if (!item || typeof item !== 'object' || (item as { type?: unknown }).type !== 'message') return [];
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) return [];
    return content.flatMap((part) => (
      part
      && typeof part === 'object'
      && (part as { type?: unknown }).type === 'output_text'
      && typeof (part as { text?: unknown }).text === 'string'
        ? [(part as { text: string }).text]
        : []
    ));
  });
  if (texts.length !== 1) {
    throw new Error('OpenAI response must contain exactly one structured output text.');
  }
  return texts[0];
}

function configuredModel(env: Record<string, string | undefined>): string {
  if (!Object.hasOwn(env, 'OPENAI_MODEL')) return DEFAULT_OPENAI_MODEL;
  const model = env.OPENAI_MODEL?.trim();
  if (!model) throw new Error('OPENAI_MODEL must not be empty when provided.');
  return model;
}

function boundedInteger(name: string, value: number, maximum: number): number {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}.`);
  }
  return value;
}

function configuredInteger(env: Record<string, string | undefined>, name: string, fallback: number): number {
  if (!Object.hasOwn(env, name)) return fallback;
  const value = env[name]?.trim();
  if (!value || !/^[0-9]+$/.test(value)) throw new Error(`${name} must be a positive integer.`);
  return Number(value);
}

export function resolveOpenAIRequestLimits(
  options: Pick<OpenAIResponsesClientOptions, 'env' | 'timeoutMs' | 'maxOutputTokens' | 'reasoningEffort'>,
) {
  const env = options.env ?? process.env;
  // Application limits are explicit and finite; provider rejection never triggers
  // a retry, a different model, or a silent change to reasoning/output settings.
  const timeoutMs = boundedInteger('timeoutMs', options.timeoutMs
    ?? configuredInteger(env, 'OPENAI_TIMEOUT_MS', DEFAULT_OPENAI_TIMEOUT_MS), 600_000);
  const maxOutputTokens = boundedInteger('maxOutputTokens', options.maxOutputTokens
    ?? configuredInteger(env, 'OPENAI_MAX_OUTPUT_TOKENS', DEFAULT_OPENAI_MAX_OUTPUT_TOKENS), 128_000);
  const reasoningEffort = options.reasoningEffort
    ?? (Object.hasOwn(env, 'OPENAI_REASONING_EFFORT') ? env.OPENAI_REASONING_EFFORT?.trim() ?? '' : 'low');
  if (!['none', 'low', 'medium', 'high', 'xhigh'].includes(reasoningEffort)) {
    throw new Error('reasoningEffort must be none, low, medium, high, or xhigh.');
  }
  return { timeoutMs, maxOutputTokens, reasoningEffort: reasoningEffort as OpenAIReasoningEffort };
}

export function createOpenAIResponsesClient(
  options: OpenAIResponsesClientOptions,
): StructuredOutputClient {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error('OpenAI API key is required.');
  const model = configuredModel(options.env ?? process.env);
  const endpoint = options.endpoint ?? OPENAI_RESPONSES_URL;
  const { timeoutMs, maxOutputTokens, reasoningEffort } = resolveOpenAIRequestLimits(options);

  return {
    async generate(request): Promise<unknown> {
      try {
        const response = await requestWithTimeout(options.transport, {
          method: 'POST',
          url: endpoint,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            store: false,
            max_output_tokens: maxOutputTokens,
            reasoning: { effort: reasoningEffort },
            input: [
              {
                role: 'system',
                content: [{ type: 'input_text', text: request.system }],
              },
              {
                role: 'user',
                content: [{ type: 'input_text', text: JSON.stringify(request.input) }],
              },
            ],
            text: {
              format: {
                type: 'json_schema',
                name: request.name,
                strict: true,
                schema: request.schema,
              },
            },
          }),
        }, timeoutMs);
        const body = parseBody(response.body);
        if (response.status < 200 || response.status >= 300 || body.error) {
          throw new Error(`OpenAI Responses API failed with HTTP ${response.status}: ${JSON.stringify(body.error)}`);
        }
        try {
          return JSON.parse(outputText(body));
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new Error('OpenAI structured output was not valid JSON.');
          }
          throw error;
        }
      } catch (error) {
        throw new Error(`OpenAI structured generation failed: ${redactSensitive(error, [apiKey])}`);
      }
    },
  };
}
