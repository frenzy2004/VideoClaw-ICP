import { describe, expect, it } from 'vitest';
import { createDataForSeoKeywordProvider } from './dataforseo';
import { KeywordMetricsSchema } from './domain';
import { createPersistentWorkerState, PersistentWorkerStateSchema } from './github-runtime';
import type { HttpRequest, HttpTransport } from './http';

const endpoint = 'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live';
const observedAt = '2026-09-12T08:00:00.000Z';
const taskId = '03112200-1535-0607-0000-8ccb9470ba14';
const credentials = { login: 'fixture@example.test', password: 'fixture-password-only' };
const request = { keyword: 'demo day video checklist', intent: 'informational' as const, mode: 'scheduled' as const };

// Synthetic values following the official keyword_overview response contract;
// these are test data, never evidence of actual search demand.
function fixture() {
  return {
    status_code: 20000, tasks_count: 1, tasks_error: 0,
    tasks: [{ id: taskId, status_code: 20000, result_count: 1, result: [{
      se_type: 'google', location_code: 2840, language_code: 'en', items_count: 1,
      items: [{
        se_type: 'google', keyword: request.keyword, location_code: 2840, language_code: 'en',
        keyword_info: { search_volume: 90 as number | null, cpc: 4.2 as number | null, competition: 0.95,
          last_updated_time: '2026-09-01 03:08:24 +00:00' as string | null },
        keyword_properties: { keyword_difficulty: 31 as number | null },
        search_intent_info: { main_intent: 'informational' },
      }],
    }] }],
  };
}

function setup(body: unknown = fixture(), status = 200) {
  const requests: HttpRequest[] = [];
  const transport: HttpTransport = async input => {
    requests.push(input);
    return { status, headers: {}, body };
  };
  return { requests, provider: createDataForSeoKeywordProvider({ ...credentials, transport, now: () => observedAt }) };
}

describe('DataForSEO keyword metrics', () => {
  it('requests one exact US/en keyword without paid clickstream or SERP add-ons', async () => {
    const { requests, provider } = setup();
    const result = await provider.enrich({ ...request, keyword: '  Demo  Day Video Checklist ' });
    expect(requests).toEqual([{
      method: 'POST', url: endpoint, signal: expect.any(AbortSignal),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64')}` },
      body: JSON.stringify([{ keywords: [request.keyword], location_code: 2840, language_code: 'en',
        include_serp_info: false, include_clickstream_data: false }]),
    }]);
    expect(result).toEqual({
      metrics: { schemaVersion: 1, provider: 'dataforseo', observedAt, volume: 90, difficulty: 31, cpc: 4.2, intent: 'informational' },
      provenance: { provider: 'dataforseo', endpoint, observedAt, providerRequestId: taskId, sourceObservedAt: '2026-09-01T03:08:24.000Z' },
    });
    expect(KeywordMetricsSchema.safeParse(result.metrics).success).toBe(true);
  });

  it('retains observed zeroes and never converts USD CPC to cents', async () => {
    const body = fixture();
    const row = body.tasks[0].result[0].items[0];
    row.keyword_info.search_volume = 0;
    row.keyword_info.cpc = 0;
    row.keyword_properties.keyword_difficulty = 0;
    expect((await setup(body).provider.enrich(request)).metrics).toMatchObject({ volume: 0, cpc: 0, difficulty: 0 });
  });

  it('round-trips provider task provenance through the persistent state contract', async () => {
    const result = await setup().provider.enrich(request);
    const state = createPersistentWorkerState();
    state.provenance['candidate:fixture'] = {
      serp: { runId: 'fixture-run', datasetId: 'fixture-dataset', observedAt },
      keyword: result.provenance,
    };
    const restored = PersistentWorkerStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(restored.provenance['candidate:fixture'].keyword).toEqual(result.provenance);
  });

  it('does not substitute ad competition for missing organic difficulty', async () => {
    const body = fixture();
    body.tasks[0].result[0].items[0].keyword_properties.keyword_difficulty = null;
    await expect(setup(body).provider.enrich(request)).rejects.toThrow(/scheduled.*volume.*difficulty/i);
    expect((await setup(body).provider.enrich({ ...request, mode: 'manual_pilot' })).metrics.difficulty).toBeNull();
  });

  it('preserves unknown metrics as null and refuses them for scheduled selection', async () => {
    const body = fixture();
    const row = body.tasks[0].result[0].items[0];
    row.keyword_info.search_volume = null;
    row.keyword_info.cpc = null;
    row.keyword_info.last_updated_time = null;
    await expect(setup(body).provider.enrich(request)).rejects.toThrow(/scheduled.*volume.*difficulty/i);
    expect(await setup(body).provider.enrich({ ...request, mode: 'manual_pilot' })).toMatchObject({
      metrics: { volume: null, cpc: null }, provenance: { sourceObservedAt: null },
    });
  });

  it.each([
    ['top-level failure', (b: ReturnType<typeof fixture>) => { b.status_code = 40000; }],
    ['task failure', (b: ReturnType<typeof fixture>) => { b.tasks[0].status_code = 40501; }],
    ['task error count', (b: ReturnType<typeof fixture>) => { b.tasks_error = 1; }],
    ['no results', (b: ReturnType<typeof fixture>) => { b.tasks[0].result = []; }],
    ['no keyword', (b: ReturnType<typeof fixture>) => { b.tasks[0].result[0].items = []; }],
    ['duplicate keyword', (b: ReturnType<typeof fixture>) => { b.tasks[0].result[0].items.push(b.tasks[0].result[0].items[0]); }],
    ['wrong keyword', (b: ReturnType<typeof fixture>) => { b.tasks[0].result[0].items[0].keyword = 'different intent'; }],
    ['punctuation mismatch', (b: ReturnType<typeof fixture>) => { b.tasks[0].result[0].items[0].keyword += '+'; }],
    ['wrong result location', (b: ReturnType<typeof fixture>) => { b.tasks[0].result[0].location_code = 2826; }],
    ['wrong item location', (b: ReturnType<typeof fixture>) => { b.tasks[0].result[0].items[0].location_code = 2826; }],
    ['wrong language', (b: ReturnType<typeof fixture>) => { b.tasks[0].result[0].items[0].language_code = 'fr'; }],
    ['negative volume', (b: ReturnType<typeof fixture>) => { b.tasks[0].result[0].items[0].keyword_info.search_volume = -1; }],
    ['invalid difficulty', (b: ReturnType<typeof fixture>) => { b.tasks[0].result[0].items[0].keyword_properties.keyword_difficulty = 101; }],
    ['invalid date', (b: ReturnType<typeof fixture>) => { b.tasks[0].result[0].items[0].keyword_info.last_updated_time = 'not-a-date'; }],
    ['untrusted task ID', (b: ReturnType<typeof fixture>) => { b.tasks[0].id = credentials.password; }],
  ])('rejects %s without returning invented or mismatched metrics', async (_name, mutate) => {
    const body = fixture();
    mutate(body);
    const { provider, requests } = setup(body);
    await expect(provider.enrich(request)).rejects.toThrow(/DataForSEO/);
    expect(requests).toHaveLength(1);
  });

  it.each(['', 'x'.repeat(81), 'a b c d e f g h i j k'])('rejects invalid keyword before billing', async keyword => {
    const { provider, requests } = setup();
    await expect(provider.enrich({ ...request, keyword })).rejects.toThrow(/keyword/i);
    expect(requests).toHaveLength(0);
  });

  it.each([
    { login: '', password: 'password' }, { login: 'login:bad', password: 'password' },
    { login: 'login\n', password: 'password' }, { login: 'login', password: '' },
    { login: 'login', password: 'password\r' },
  ])('rejects invalid credentials before billing', credentials => {
    expect(() => createDataForSeoKeywordProvider({ ...credentials, transport: async () => { throw new Error('must not call'); } })).toThrow(/credentials/i);
  });

  it('does not expose raw provider errors or authentication material', async () => {
    const auth = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');
    const { provider, requests } = setup({ error: `${credentials.login} ${credentials.password} ${auth} raw-body` }, 401);
    await expect(provider.enrich(request)).rejects.toThrow('DataForSEO request failed (HTTP 401).');
    expect(requests).toHaveLength(1);
    let calls = 0;
    const failing = createDataForSeoKeywordProvider({ ...credentials, transport: async () => { calls++; throw new Error(auth); } });
    await expect(failing.enrich(request)).rejects.toThrow('DataForSEO request failed or timed out.');
    expect(calls).toBe(1);
  });

  it('aborts a stalled request without retrying a potentially billed task', async () => {
    let signal: AbortSignal | undefined;
    let calls = 0;
    const provider = createDataForSeoKeywordProvider({ ...credentials, timeoutMs: 5,
      transport: async input => { calls++; signal = input.signal; return new Promise(() => {}); } });
    await expect(provider.enrich(request)).rejects.toThrow(/timed out/i);
    expect(signal?.aborted).toBe(true);
    expect(calls).toBe(1);
  });
});
