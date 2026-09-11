import {createServer, type ServerResponse} from 'node:http';
import {once} from 'node:events';
import {describe, expect, it} from 'vitest';
import {requestWithTimeout} from './http';
import {createTestOnlyNodeJsonHttpTransport} from './runtime-http';
import {createOpenAIResponsesClient} from './openai-responses';

const responseId = 'resp_stream_fixture';
const complete = {id: responseId, object: 'response', status: 'completed', error: null,
  incomplete_details: null, model: 'gpt-5.5', store: false,
  output: [{type: 'message', id: 'msg_fixture', role: 'assistant', status: 'completed',
    content: [{type: 'output_text', text: '{"value":"café"}', annotations: [], logprobs: []}]}]};
const frame = (type: string, data: Record<string, unknown>) => `event: ${type}\r\ndata: ${JSON.stringify({type, ...data})}\r\n\r\n`;
const created = frame('response.created', {response: {...complete, status: 'in_progress', output: []}});
const finished = frame('response.completed', {response: complete});
const fixtureSchema = {type: 'object', additionalProperties: false, properties: {value: {type: 'string'}}, required: ['value']};

async function serverFor(handler: (response: ServerResponse) => void) {
  const server = createServer((_request, response) => {response.setHeader('Content-Type', 'text/event-stream'); handler(response);});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if(!address || typeof address === 'string') throw new Error('Fixture unavailable.');
  return {url: `http://127.0.0.1:${address.port}/responses`, async close() {server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));}};
}

describe('Responses streaming through the real HTTP boundary', () => {
  it('returns completed structured output without waiting for HTTP EOF, preserving split UTF-8 and reporting only progress metadata', async () => {
    const progress: unknown[] = [];
    let finish!: () => void;
    const fixture = await serverFor(response => {
      response.write(created);
      finish = () => {
        const payload = Buffer.from(frame('response.output_text.delta', {delta: 'private draft café'}) + finished);
        const split = payload.indexOf(Buffer.from('é')) + 1;
        response.write(payload.subarray(0, split));
        setImmediate(() => response.write(payload.subarray(split))); // Deliberately never end the response.
      };
    });
    try {
      const transport = createTestOnlyNodeJsonHttpTransport({onResponseProgress: item => {progress.push(item); if(progress.length === 1) finish();}});
      const client = createOpenAIResponsesClient({apiKey: 'fixture', env: {}, transport, endpoint: fixture.url, timeoutMs: 1500});
      await expect(client.generate({name: 'fixture', schema: fixtureSchema, input: {}, system: 'Fixture'})).resolves.toEqual({value: 'café'});
      expect(progress).toContainEqual(expect.objectContaining({event: 'response.created', responseId, outputCharacters: 0}));
      expect(progress).toContainEqual(expect.objectContaining({event: 'response.completed', responseId, outputCharacters: 18}));
      expect(JSON.stringify(progress)).not.toContain('private draft');
    } finally {await fixture.close();}
  });

  it.each([
    ['truncated', created + frame('response.output_text.delta', {delta: '{"value":"not approved"}'})],
    ['malformed', created + 'data: {invalid}\n\n'],
    ['wrong identity', created + frame('response.completed', {response: {...complete, id: 'resp_other'}})],
    ['wrong status', created + frame('response.completed', {response: {...complete, status: 'in_progress'}})],
    ['error', created + frame('error', {message: 'untrusted secret provider text'})],
  ])('rejects %s streams instead of accepting partial output or restarting', async (_label, body) => {
    let calls = 0;
    const fixture = await serverFor(response => {calls++; response.end(body);});
    try {
      const client = createOpenAIResponsesClient({apiKey: 'fixture', env: {}, transport: createTestOnlyNodeJsonHttpTransport(), endpoint: fixture.url, timeoutMs: 1500});
      const result = await client.generate({name: 'fixture', schema: fixtureSchema, input: {}, system: 'Fixture'}).catch(String);
      expect(result).toMatch(/stream/i);
      expect(result).not.toContain('untrusted secret');
      expect(calls).toBe(1);
    } finally {await fixture.close();}
  });

  it('retains incomplete provider status for the existing client rejection', async () => {
    const fixture = await serverFor(response => response.end(created + frame('response.incomplete', {response: {...complete, status: 'incomplete', incomplete_details: {reason: 'max_output_tokens'}}})));
    try {
      const client = createOpenAIResponsesClient({apiKey: 'fixture', env: {}, transport: createTestOnlyNodeJsonHttpTransport(), endpoint: fixture.url});
      await expect(client.generate({name: 'fixture', schema: fixtureSchema, input: {}, system: 'Fixture'})).rejects.toThrow(/incomplete.*max_output_tokens/);
    } finally {await fixture.close();}
  });

  it('bounds stream bytes and aborts a stream that never reaches a terminal event', async () => {
    let requests = 0;
    const fixture = await serverFor(response => {requests++; response.write(created);});
    try {
      await expect(requestWithTimeout(createTestOnlyNodeJsonHttpTransport({maxResponseBytes: 32}), {method: 'POST', url: fixture.url, headers: {Accept: 'text/event-stream'}}, 500)).rejects.toThrow(/byte limit/);
      await expect(requestWithTimeout(createTestOnlyNodeJsonHttpTransport(), {method: 'POST', url: fixture.url, headers: {Accept: 'text/event-stream'}}, 30)).rejects.toThrow(/timed out/);
      expect(requests).toBe(2);
    } finally {await fixture.close();}
  });
});
