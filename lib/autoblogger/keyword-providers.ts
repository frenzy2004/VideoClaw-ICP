import { z } from 'zod';

import {
  KeywordMetricsSchema,
  type AutobloggerIntent,
  type KeywordMetrics,
} from './domain';
import {
  redactSensitive,
  requestWithTimeout,
  type HttpTransport,
} from './http';
import type { RunMode } from './policies';

export type { HttpRequest, HttpTransport } from './http';

const SEMRUSH_ENDPOINT = 'https://api.semrush.com/apis/v4/keywords/v1/metrics';
const AHREFS_ENDPOINT = 'https://api.ahrefs.com/v3/keywords-explorer/overview';
const DEFAULT_TIMEOUT_MS = 10_000;

export type KeywordEnrichmentRequest = {
  keyword: string;
  intent: AutobloggerIntent;
  mode: RunMode;
};

export type KeywordProvenance = {
  provider: KeywordMetrics['provider'];
  endpoint: string | null;
  observedAt: string | null;
  providerRequestId: string | null;
  sourceObservedAt: string | null;
};

export type KeywordEnrichment = {
  metrics: KeywordMetrics;
  provenance: KeywordProvenance;
};

export interface KeywordProvider {
  enrich(request: KeywordEnrichmentRequest): Promise<KeywordEnrichment>;
}

export type KeywordProviderOptions = {
  apiKey: string;
  transport: HttpTransport;
  now?: () => string;
  timeoutMs?: number;
};

const nullableNumeric = z.union([z.number(), z.string()]).nullable();
const SemrushResponseSchema = z.object({
  meta: z.object({
    country: z.literal('US'),
    keyword: z.string(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    request_id: z.string(),
    success: z.literal(true),
  }).passthrough(),
  data: z.object({
    cpc: nullableNumeric,
    intents: z.array(z.string()),
    keyword_difficulty: nullableNumeric,
    search_volume: nullableNumeric,
  }).passthrough(),
}).passthrough();

const AhrefsResponseSchema = z.object({
  keywords: z.array(z.object({
    keyword: z.string(),
    volume: z.number().nullable(),
    difficulty: z.number().nullable(),
    cpc: z.number().nullable(),
    intents: z.record(z.string(), z.boolean()).nullable(),
    serp_last_update: z.string().nullable(),
  }).passthrough()),
}).passthrough();

function numberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error('Provider returned an invalid numeric metric.');
  return numeric;
}

function centsToUsd(value: number | string | null): number | null {
  const cents = numberOrNull(value);
  return cents === null ? null : cents / 100;
}

function semrushIntent(values: string[], fallback: AutobloggerIntent): AutobloggerIntent {
  const recognized = values
    .map((value) => value.toLocaleLowerCase('en-US'))
    .find((value): value is AutobloggerIntent =>
      ['informational', 'commercial', 'transactional', 'navigational'].includes(value));
  return recognized ?? fallback;
}

function ahrefsIntent(
  values: Record<string, boolean> | null,
  fallback: AutobloggerIntent,
): AutobloggerIntent {
  if (values?.[fallback]) return fallback;
  return (['informational', 'commercial', 'transactional', 'navigational'] as const)
    .find((intent) => values?.[intent]) ?? fallback;
}

function assertMetricsAllowed(metrics: KeywordMetrics, mode: RunMode): void {
  if (
    mode === 'scheduled'
    && (metrics.provider === 'pending' || metrics.volume === null || metrics.difficulty === null)
  ) {
    throw new Error('Scheduled mode requires observed volume and difficulty from a named provider.');
  }
}

async function getProviderJson(
  options: KeywordProviderOptions,
  url: string,
  authorization: string,
): Promise<unknown> {
  let response;
  try {
    response = await requestWithTimeout(options.transport, {
      method: 'GET',
      url,
      headers: { Accept: 'application/json', Authorization: authorization },
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  } catch (error) {
    throw new Error(`Keyword provider request failed: ${redactSensitive(error, [options.apiKey])}`);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Keyword provider request failed (${response.status}): ${redactSensitive(response.body, [options.apiKey]).slice(0, 1_000)}`,
    );
  }
  return response.body;
}

export function createPendingKeywordProvider(): KeywordProvider {
  return {
    async enrich(request) {
      const metrics = KeywordMetricsSchema.parse({
        schemaVersion: 1,
        provider: 'pending',
        observedAt: null,
        volume: null,
        difficulty: null,
        cpc: null,
        intent: request.intent,
      });
      assertMetricsAllowed(metrics, request.mode);
      return {
        metrics,
        provenance: {
          provider: 'pending',
          endpoint: null,
          observedAt: null,
          providerRequestId: null,
          sourceObservedAt: null,
        },
      };
    },
  };
}

export function createSemrushKeywordProvider(options: KeywordProviderOptions): KeywordProvider {
  return {
    async enrich(request) {
      const url = new URL(SEMRUSH_ENDPOINT);
      url.searchParams.set('keyword', request.keyword);
      url.searchParams.set('country', 'US');
      url.searchParams.set('format', 'json');
      const response = SemrushResponseSchema.parse(
        await getProviderJson(options, url.toString(), `Apikey ${options.apiKey}`),
      );
      if (response.meta.keyword !== request.keyword) throw new Error('Semrush returned metrics for a different keyword.');
      const observedAt = (options.now ?? (() => new Date().toISOString()))();
      const metrics = KeywordMetricsSchema.parse({
        schemaVersion: 1,
        provider: 'semrush',
        observedAt,
        volume: numberOrNull(response.data.search_volume),
        difficulty: numberOrNull(response.data.keyword_difficulty),
        cpc: centsToUsd(response.data.cpc),
        intent: semrushIntent(response.data.intents, request.intent),
      });
      assertMetricsAllowed(metrics, request.mode);
      return {
        metrics,
        provenance: {
          provider: 'semrush',
          endpoint: SEMRUSH_ENDPOINT,
          observedAt,
          providerRequestId: response.meta.request_id,
          sourceObservedAt: response.meta.month,
        },
      };
    },
  };
}

export function createAhrefsKeywordProvider(options: KeywordProviderOptions): KeywordProvider {
  return {
    async enrich(request) {
      const url = new URL(AHREFS_ENDPOINT);
      url.searchParams.set('country', 'us');
      url.searchParams.set('keywords', request.keyword);
      url.searchParams.set('select', 'keyword,volume,difficulty,cpc,intents,serp_last_update');
      url.searchParams.set('limit', '1');
      url.searchParams.set('output', 'json');
      const response = AhrefsResponseSchema.parse(
        await getProviderJson(options, url.toString(), `Bearer ${options.apiKey}`),
      );
      const row = response.keywords.find(({ keyword }) => keyword === request.keyword);
      if (!row) throw new Error('Ahrefs returned no metrics for the requested keyword.');
      const observedAt = (options.now ?? (() => new Date().toISOString()))();
      const metrics = KeywordMetricsSchema.parse({
        schemaVersion: 1,
        provider: 'ahrefs',
        observedAt,
        volume: row.volume,
        difficulty: row.difficulty,
        cpc: centsToUsd(row.cpc),
        intent: ahrefsIntent(row.intents, request.intent),
      });
      assertMetricsAllowed(metrics, request.mode);
      return {
        metrics,
        provenance: {
          provider: 'ahrefs',
          endpoint: AHREFS_ENDPOINT,
          observedAt,
          providerRequestId: null,
          sourceObservedAt: row.serp_last_update,
        },
      };
    },
  };
}
