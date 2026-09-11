import { cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateAutobloggerEnvironment } from './cli';
import type { HttpRequest, HttpTransport } from './http';
import { createProductionAutobloggerRuntime } from './runtime';
import * as workerModule from './worker';

const credentials = { login: 'offline-login', password: 'offline-pass' };
const basic = Buffer.from('offline-login:offline-pass').toString('base64');
const environment = {
  APIFY_TOKEN: 'fixture-apify', KEYWORD_PROVIDER: 'dataforseo',
  DATAFORSEO_LOGIN: credentials.login, DATAFORSEO_PASSWORD: credentials.password,
  GITHUB_TOKEN: 'fixture-state', GITHUB_REPOSITORY: 'owner/icp', LANDER_REPOSITORY: '/unused-lander',
  LANDER_OWNER: 'owner', LANDER_NAME: 'lander', LANDER_BASE_REF: 'feature',
  LANDER_READ_TOKEN: 'github_pat_read_inventory_fixture_123456',
};
const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'autoblogger-dataforseo-wiring-'));
  roots.push(root);
  await mkdir(join(root, '.git'));
  await cp(join(process.cwd(), 'docs/research/campaigns'), join(root, 'docs/research/campaigns'), { recursive: true });
  const config = validateAutobloggerEnvironment('research', { ...environment, LANDER_REPOSITORY: root }, { artifactDir: 'receipts' });
  const requests: HttpRequest[] = [];
  const transport: HttpTransport = async request => {
    requests.push(request);
    const url = new URL(request.url);
    if (url.hostname === 'api.dataforseo.com') {
      return { status: 503, headers: {}, body: { error: `Offline failure ${credentials.login} ${credentials.password} Basic ${basic}` } };
    }
    expect(url.hostname).toBe('api.github.com');
    expect(request.method).toBe('GET');
    let body: unknown;
    if (url.pathname.endsWith('/git/ref/heads/feature')) body = { object: { sha: 'a'.repeat(40) } };
    else if (url.pathname.endsWith('/pulls/55')) body = { state: 'open', merged: false, base: { ref: 'main' } };
    else if (url.pathname.includes('/git/trees/')) body = { tree: [], truncated: false };
    else if (url.pathname.endsWith('/pulls') || url.pathname.endsWith('/git/matching-refs/heads/')) body = [];
    else throw new Error(`Unexpected fixture endpoint: ${url.pathname}`);
    return { status: 200, headers: {}, body };
  };
  return { root, config, requests, transport };
}

describe('DataForSEO production runtime wiring', () => {
  it('dispatches enrich through the real provider selected by the runtime, without pending fallback', async () => {
    const f = await fixture();
    // Observe the real factory without replacing the worker or the provider.
    const workerFactory = vi.spyOn(workerModule, 'createAutobloggerWorker');
    await createProductionAutobloggerRuntime(f.config, f.root, { transport: f.transport });
    const provider = workerFactory.mock.calls[0][0].keywordProvider;
    const failure = await provider.enrich({ keyword: 'founder launch video', intent: 'informational', mode: 'manual_pilot' })
      .then(() => null, error => error);
    const requests = f.requests.filter(request => new URL(request.url).hostname === 'api.dataforseo.com');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST', url: 'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live',
      headers: expect.objectContaining({ Authorization: `Basic ${basic}` }),
    });
    expect(JSON.parse(requests[0].body!)).toEqual([{
      keywords: ['founder launch video'], location_code: 2840, language_code: 'en',
      include_serp_info: false, include_clickstream_data: false,
    }]);
    expect(failure).toBeInstanceOf(Error);
    for (const secret of [credentials.login, credentials.password, basic]) expect(String(failure)).not.toContain(secret);
  });

  it.each([
    { value: undefined, field: 'DATAFORSEO_LOGIN' },
    { value: { ...credentials, login: '' }, field: 'DATAFORSEO_LOGIN' },
    { value: { ...credentials, login: '  ' }, field: 'DATAFORSEO_LOGIN' },
    { value: { ...credentials, login: 'bad:login' }, field: 'DATAFORSEO_LOGIN' },
    { value: { ...credentials, login: 'bad\nlogin' }, field: 'DATAFORSEO_LOGIN' },
    { value: { ...credentials, password: '' }, field: 'DATAFORSEO_PASSWORD' },
    { value: { ...credentials, password: '  ' }, field: 'DATAFORSEO_PASSWORD' },
    { value: { ...credentials, password: 'bad\rpassword' }, field: 'DATAFORSEO_PASSWORD' },
  ])('rejects invalid selected runtime credentials before filesystem or transport work ($field, $#)', async ({ value, field }) => {
    const config = { ...validateAutobloggerEnvironment('research', environment), dataForSeoCredentials: value };
    const requests: HttpRequest[] = [];
    await expect(createProductionAutobloggerRuntime(config, process.cwd(), { transport: async request => {
      requests.push(request); throw new Error('Unexpected transport call');
    } })).rejects.toThrow(field);
    expect(requests).toHaveLength(0);
  });

  it.each([
    { label: 'login', secret: credentials.login },
    { label: 'password', secret: credentials.password },
    { label: 'Basic encoding', secret: basic },
  ])('enforces the configured exact-secret audit guard for $label', async ({ secret }) => {
    const f = await fixture();
    const runtime = await createProductionAutobloggerRuntime(f.config, f.root, { transport: f.transport });
    const initializationRequests = f.requests.length;
    // An execution identifier is a real audit field, before any worker activity.
    await expect(runtime.execute({ command: 'research', runId: secret })).rejects.toThrow(/runtime audit evidence/i);
    expect(f.requests).toHaveLength(initializationRequests);
    const files = await readdir(join(f.root, 'receipts'), { recursive: true }).catch(() => [] as string[]);
    const records = await Promise.all(files.filter(name => name.endsWith('.json'))
      .map(name => readFile(join(f.root, 'receipts', name), 'utf8')));
    for (const value of [credentials.login, credentials.password, basic]) expect(records.join('\n')).not.toContain(value);
  });
});
