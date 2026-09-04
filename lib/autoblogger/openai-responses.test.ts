import { describe, expect, it } from 'vitest';

import type { HttpRequest, HttpResponse, HttpTransport } from './http';
import { createOpenAIResponsesClient } from './openai-responses';

function completedResponse(outputText: string): HttpResponse {
  return {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'req_fixture_001',
    },
    body: {
      id: 'resp_fixture_001',
      object: 'response',
      created_at: 1_788_480_000,
      status: 'completed',
      background: false,
      billing: { payer: 'developer' },
      error: null,
      incomplete_details: null,
      instructions: null,
      max_output_tokens: 2_000,
      max_tool_calls: null,
      model: 'gpt-5.5-2026-08-01',
      output: [{
        id: 'msg_fixture_001',
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [{
          type: 'output_text',
          annotations: [],
          logprobs: [],
          text: outputText,
        }],
      }],
      parallel_tool_calls: true,
      previous_response_id: null,
      prompt_cache_key: null,
      prompt_cache_retention: null,
      reasoning: { effort: null, summary: null },
      safety_identifier: null,
      service_tier: 'default',
      store: false,
      temperature: 1,
      text: { format: { type: 'json_schema' }, verbosity: 'medium' },
      tool_choice: 'auto',
      tools: [],
      top_logprobs: 0,
      top_p: 1,
      truncation: 'disabled',
      usage: {
        input_tokens: 100,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 20,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 120,
      },
      user: null,
      metadata: {},
    },
  };
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    value: { type: 'string' },
  },
  required: ['schemaVersion', 'value'],
} as const;

describe('OpenAI Responses structured-output client', () => {
  it('posts strict JSON schema output to /v1/responses with gpt-5.5 by default', async () => {
    const requests: HttpRequest[] = [];
    const transport: HttpTransport = async (request) => {
      requests.push(request);
      return completedResponse(JSON.stringify({ schemaVersion: 1, value: 'drafted' }));
    };
    const client = createOpenAIResponsesClient({
      apiKey: 'sk-fixture-secret-value',
      env: {},
      transport,
    });

    await expect(client.generate({
      name: 'worker_fixture_v1',
      schema,
      system: 'Return the requested fixture.',
      input: { topic: 'founder video' },
    })).resolves.toEqual({ schemaVersion: 1, value: 'drafted' });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.openai.com/v1/responses',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer sk-fixture-secret-value',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(requests[0].body as string)).toMatchObject({
      model: 'gpt-5.5',
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'worker_fixture_v1',
          strict: true,
          schema,
        },
      },
    });
  });

  it('uses the explicit OPENAI_MODEL override and never retries a failed model with a fallback', async () => {
    const requests: HttpRequest[] = [];
    const transport: HttpTransport = async (request) => {
      requests.push(request);
      return {
        status: 503,
        headers: { 'x-request-id': 'req_failed_fixture' },
        body: {
          error: {
            message: 'Requested model unavailable for sk-fixture-secret-value',
            type: 'server_error',
            param: null,
            code: 'model_unavailable',
          },
        },
      };
    };
    const client = createOpenAIResponsesClient({
      apiKey: 'sk-fixture-secret-value',
      env: { OPENAI_MODEL: 'gpt-5.5-pinned' },
      transport,
    });

    await expect(client.generate({
      name: 'worker_fixture_v1',
      schema,
      system: 'Return the requested fixture.',
      input: { topic: 'founder video' },
    })).rejects.not.toThrow(/sk-fixture-secret-value/);

    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0].body as string).model).toBe('gpt-5.5-pinned');
  });

  it.each([
    'apify_api_synthetic_fixture_123456',
    'github_pat_synthetic_fixture_123456',
  ])('redacts a synthetic raw credential from provider failures', async (syntheticSecret) => {
    const transport: HttpTransport = async () => ({
      status: 500,
      headers: {},
      body: { error: { message: `Provider echoed ${syntheticSecret}` } },
    });
    const client = createOpenAIResponsesClient({ apiKey: 'sk-fixture-secret-value', transport });

    await expect(client.generate({
      name: 'worker_fixture_v1',
      schema,
      system: 'Return the requested fixture.',
      input: {},
    })).rejects.not.toThrow(syntheticSecret);
  });

  it('rejects malformed or incomplete API-shaped responses', async () => {
    const transport: HttpTransport = async () => ({
      ...completedResponse('{"schemaVersion":1,"value":"drafted"}'),
      body: {
        ...(completedResponse('{}').body as Record<string, unknown>),
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
      },
    });
    const client = createOpenAIResponsesClient({ apiKey: 'sk-fixture-secret-value', transport });

    await expect(client.generate({
      name: 'worker_fixture_v1',
      schema,
      system: 'Return the requested fixture.',
      input: {},
    })).rejects.toThrow(/incomplete/i);
  });
});
