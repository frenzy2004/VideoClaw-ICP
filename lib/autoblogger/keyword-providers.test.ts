import { describe, expect, it } from 'vitest';

import ahrefsFixture from './fixtures/ahrefs-keyword-overview.json';
import semrushFixture from './fixtures/semrush-keyword-metrics.json';
import { KeywordMetricsSchema } from './domain';
import {
  createAhrefsKeywordProvider,
  createPendingKeywordProvider,
  createSemrushKeywordProvider,
  type HttpRequest,
  type HttpTransport,
} from './keyword-providers';

const observedAt = '2026-09-04T08:00:00.000Z';
const request = {
  keyword: 'demo day video checklist',
  intent: 'informational' as const,
  mode: 'manual_pilot' as const,
};

function fixtureTransport(body: unknown, status = 200) {
  const requests: HttpRequest[] = [];
  const transport: HttpTransport = async (input) => {
    requests.push(input);
    return { status, headers: { 'content-type': 'application/json' }, body };
  };
  return { requests, transport };
}

describe('KeywordProvider.enrich', () => {
  it('keeps pending explicit for a manual pilot and rejects it for scheduled mode', async () => {
    const provider = createPendingKeywordProvider();

    await expect(provider.enrich(request)).resolves.toEqual({
      metrics: {
        schemaVersion: 1,
        provider: 'pending',
        observedAt: null,
        volume: null,
        difficulty: null,
        cpc: null,
        intent: 'informational',
      },
      provenance: {
        provider: 'pending',
        endpoint: null,
        observedAt: null,
        providerRequestId: null,
        sourceObservedAt: null,
      },
    });
    await expect(provider.enrich({ ...request, mode: 'scheduled' })).rejects.toThrow(
      /scheduled.*volume.*difficulty/i,
    );
  });

  it('calls the Semrush Keyword Reports API v4 boundary and normalizes its fixture', async () => {
    const { requests, transport } = fixtureTransport(semrushFixture);
    const provider = createSemrushKeywordProvider({
      apiKey: 'semrush-secret',
      transport,
      now: () => observedAt,
    });

    const enrichment = await provider.enrich(request);

    expect(requests).toEqual([{
      method: 'GET',
      url: 'https://api.semrush.com/apis/v4/keywords/v1/metrics?keyword=demo+day+video+checklist&country=US&format=json',
      headers: {
        Accept: 'application/json',
        Authorization: 'Apikey semrush-secret',
      },
      signal: expect.any(AbortSignal),
    }]);
    expect(enrichment).toEqual({
      metrics: {
        schemaVersion: 1,
        provider: 'semrush',
        observedAt,
        volume: 90,
        difficulty: 31,
        cpc: 4.2,
        intent: 'informational',
      },
      provenance: {
        provider: 'semrush',
        endpoint: 'https://api.semrush.com/apis/v4/keywords/v1/metrics',
        observedAt,
        providerRequestId: 'semrush-request-123',
        sourceObservedAt: '2026-08',
      },
    });
    expect(KeywordMetricsSchema.safeParse(enrichment.metrics).success).toBe(true);
  });

  it('calls the Ahrefs Keywords Explorer API v3 overview boundary and normalizes its fixture', async () => {
    const { requests, transport } = fixtureTransport(ahrefsFixture);
    const provider = createAhrefsKeywordProvider({
      apiKey: 'ahrefs-secret',
      transport,
      now: () => observedAt,
    });

    const enrichment = await provider.enrich(request);

    expect(requests).toEqual([{
      method: 'GET',
      url: 'https://api.ahrefs.com/v3/keywords-explorer/overview?country=us&keywords=demo+day+video+checklist&select=keyword%2Cvolume%2Cdifficulty%2Ccpc%2Cintents%2Cserp_last_update&limit=1&output=json',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ahrefs-secret',
      },
      signal: expect.any(AbortSignal),
    }]);
    expect(enrichment).toEqual({
      metrics: {
        schemaVersion: 1,
        provider: 'ahrefs',
        observedAt,
        volume: 90,
        difficulty: 31,
        cpc: 4.2,
        intent: 'informational',
      },
      provenance: {
        provider: 'ahrefs',
        endpoint: 'https://api.ahrefs.com/v3/keywords-explorer/overview',
        observedAt,
        providerRequestId: null,
        sourceObservedAt: '2026-08-30T12:30:00Z',
      },
    });
    expect(KeywordMetricsSchema.safeParse(enrichment.metrics).success).toBe(true);
  });

  it('rejects incomplete scheduled paid metrics and redacts provider secrets from failures', async () => {
    const incomplete = structuredClone(semrushFixture);
    incomplete.data.keyword_difficulty = null as unknown as number;
    const incompleteProvider = createSemrushKeywordProvider({
      apiKey: 'semrush-secret',
      transport: fixtureTransport(incomplete).transport,
      now: () => observedAt,
    });
    const failedProvider = createAhrefsKeywordProvider({
      apiKey: 'ahrefs-secret',
      transport: fixtureTransport({ error: 'Bearer ahrefs-secret was rejected' }, 401).transport,
      now: () => observedAt,
    });

    await expect(incompleteProvider.enrich({ ...request, mode: 'scheduled' })).rejects.toThrow(
      /scheduled.*volume.*difficulty/i,
    );
    await expect(failedProvider.enrich(request)).rejects.toThrow(/\[REDACTED\]/);
    await expect(failedProvider.enrich(request)).rejects.not.toThrow(/ahrefs-secret/);
  });
});
