import { describe, expect, it } from 'vitest';

import { createApifyClient } from './apify-client';
import type { HttpRequest, HttpTransport } from './http';

function fixtureTransport(bodies: unknown[], status = 200) {
  const requests: HttpRequest[] = [];
  const transport: HttpTransport = async (request) => ({
    status,
    headers: { 'content-type': 'application/json' },
    body: bodies[requests.push(request) - 1],
  });
  return { requests, transport };
}

describe('Apify HTTP client', () => {
  it('uses actor, run, and dataset API v2 boundaries with injected transport', async () => {
    const fixture = fixtureTransport([
      { data: { id: 'run-123', status: 'RUNNING' } },
      {
        data: {
          id: 'run-123',
          status: 'SUCCEEDED',
          defaultDatasetId: 'dataset-456',
          finishedAt: '2026-09-04T08:01:00.000Z',
        },
      },
      [{ suggestion: 'demo day video checklist template' }],
      { data: { id: 'run-123', status: 'ABORTING' } },
    ]);
    const client = createApifyClient({ token: 'apify-secret', transport: fixture.transport });

    await expect(client.startActor('apify/google-search-scraper', { queries: 'demo day video\n' }))
      .resolves.toMatchObject({ id: 'run-123', status: 'RUNNING' });
    await expect(client.getRun('run-123')).resolves.toMatchObject({
      id: 'run-123',
      status: 'SUCCEEDED',
      defaultDatasetId: 'dataset-456',
    });
    await expect(client.getDatasetItems('dataset-456')).resolves.toEqual([
      { suggestion: 'demo day video checklist template' },
    ]);
    await expect(client.abortRun('run-123')).resolves.toMatchObject({ id: 'run-123', status: 'ABORTING' });

    expect(fixture.requests).toEqual([
      {
        method: 'POST',
        url: 'https://api.apify.com/v2/acts/apify~google-search-scraper/runs?timeout=120&maxTotalChargeUsd=2',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer apify-secret',
          'Content-Type': 'application/json',
        },
        body: '{"queries":"demo day video\\n"}',
        signal: expect.any(AbortSignal),
      },
      {
        method: 'GET',
        url: 'https://api.apify.com/v2/actor-runs/run-123',
        headers: { Accept: 'application/json', Authorization: 'Bearer apify-secret' },
        signal: expect.any(AbortSignal),
      },
      {
        method: 'GET',
        url: 'https://api.apify.com/v2/datasets/dataset-456/items?clean=true&format=json&limit=1000',
        headers: { Accept: 'application/json', Authorization: 'Bearer apify-secret' },
        signal: expect.any(AbortSignal),
      },
      {
        method: 'POST',
        url: 'https://api.apify.com/v2/actor-runs/run-123/abort?gracefully=true',
        headers: { Accept: 'application/json', Authorization: 'Bearer apify-secret' },
        signal: expect.any(AbortSignal),
      },
    ]);
  });

  it('applies bounded server-side run limits even if the start response is lost', async () => {
    const fixture = fixtureTransport([{ data: { id: 'bounded-run', status: 'RUNNING' } }]);
    await createApifyClient({ token: 'test-token', transport: fixture.transport, runTimeoutSeconds: 90, maxTotalChargeUsd: 1 })
      .startActor('apify/google-search-scraper', {});
    expect(fixture.requests[0].url).toContain('timeout=90&maxTotalChargeUsd=1');
    expect(() => createApifyClient({ token: 'test-token', transport: fixture.transport, runTimeoutSeconds: 0 })).toThrow(/limits/);
    expect(() => createApifyClient({ token: 'test-token', transport: fixture.transport, maxTotalChargeUsd: Infinity })).toThrow(/limits/);
  });

  it('redacts token values and recognizable credential patterns from HTTP errors', async () => {
    const recognizableFakeToken = ['apify', 'api', 'fake', 'test', 'only'].join('_');
    const client = createApifyClient({
      token: 'apify-secret',
      transport: fixtureTransport([
        { error: `Bearer apify-secret and ${recognizableFakeToken} must not leak` },
      ], 401).transport,
    });

    let message = '';
    try {
      await client.getRun('run-123');
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain('[REDACTED]');
    expect(message).not.toContain('apify-secret');
    expect(message).not.toContain(recognizableFakeToken);
  });
});
