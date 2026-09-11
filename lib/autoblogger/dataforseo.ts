import { z } from 'zod';
import { KeywordMetricsSchema } from './domain';
import { requestWithTimeout, type HttpTransport } from './http';
import type { KeywordProvider } from './keyword-providers';

const ENDPOINT = 'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live';
const locale = { se_type: z.literal('google'), location_code: z.literal(2840), language_code: z.literal('en') };
const ResponseSchema = z.object({
  status_code: z.literal(20000), tasks_count: z.literal(1), tasks_error: z.literal(0),
  tasks: z.array(z.object({
    id: z.string().regex(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i),
    status_code: z.literal(20000), result_count: z.literal(1),
    result: z.array(z.object({
      ...locale, items_count: z.literal(1),
      items: z.array(z.object({
        ...locale, keyword: z.string(),
        keyword_info: z.object({
          search_volume: z.number().int().nonnegative().nullish(),
          cpc: z.number().finite().nonnegative().nullish(),
          last_updated_time: z.string().nullish(),
        }).nullish(),
        keyword_properties: z.object({
          keyword_difficulty: z.number().int().min(0).max(100).nullish(),
        }).nullish(),
        search_intent_info: z.object({
          main_intent: z.enum(['informational', 'commercial', 'transactional', 'navigational']).nullish(),
        }).nullish(),
      })).length(1),
    })).length(1),
  })).length(1),
});

// Do not use the deduplication normalizer: removing punctuation can join distinct queries.
function providerKeyword(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function sourceDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}:\d{2})$/.exec(value);
  const iso = match ? `${match[1]}T${match[2]}${match[3]}` : value;
  if (!z.iso.datetime({ offset: true }).safeParse(iso).success) {
    throw new Error('DataForSEO returned an invalid observation date.');
  }
  return new Date(iso).toISOString();
}

export function createDataForSeoKeywordProvider(options: {
  login: string;
  password: string;
  transport: HttpTransport;
  now?: () => string;
  timeoutMs?: number;
}): KeywordProvider {
  if (!options.login.trim() || !options.password.trim() || /[:\r\n]/.test(options.login) || /[\r\n]/.test(options.password)) {
    throw new Error('DataForSEO credentials require a login and password without invalid separators.');
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('DataForSEO timeout must be positive.');
  const authorization = `Basic ${Buffer.from(`${options.login}:${options.password}`, 'utf8').toString('base64')}`;
  return {
    async enrich(request) {
      const keyword = providerKeyword(request.keyword);
      if (!keyword || keyword.length > 80 || keyword.split(' ').length > 10) {
        throw new Error('DataForSEO keyword must contain 1–80 characters and at most 10 words.');
      }
      let response;
      try {
        // One request per enrichment. Cross-run retries use the worker's existing cap.
        response = await requestWithTimeout(options.transport, {
          method: 'POST', url: ENDPOINT,
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: authorization },
          body: JSON.stringify([{ keywords: [keyword], location_code: 2840, language_code: 'en',
            include_serp_info: false, include_clickstream_data: false }]),
        }, timeoutMs);
      } catch {
        // Provider/transport failures can echo Basic credentials or the full request.
        throw new Error('DataForSEO request failed or timed out.');
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`DataForSEO request failed (HTTP ${response.status}).`);
      }
      const parsed = ResponseSchema.safeParse(response.body);
      if (!parsed.success) throw new Error('DataForSEO returned failed, missing, or invalid US/en keyword data.');
      const task = parsed.data.tasks[0];
      const row = task.result[0].items[0];
      if (providerKeyword(row.keyword) !== keyword) throw new Error('DataForSEO returned a different keyword.');
      const observedAt = (options.now ?? (() => new Date().toISOString()))();
      const metrics = KeywordMetricsSchema.parse({
        schemaVersion: 1, provider: 'dataforseo', observedAt,
        volume: row.keyword_info?.search_volume ?? null,
        // keyword_info.competition is advertising competition, not organic difficulty.
        difficulty: row.keyword_properties?.keyword_difficulty ?? null,
        cpc: row.keyword_info?.cpc ?? null, // DataForSEO CPC is already in USD.
        intent: row.search_intent_info?.main_intent ?? request.intent,
      });
      if (request.mode === 'scheduled' && (metrics.volume === null || metrics.difficulty === null)) {
        throw new Error('Scheduled mode requires observed volume and difficulty from DataForSEO.');
      }
      return {
        metrics,
        provenance: { provider: 'dataforseo', endpoint: ENDPOINT, observedAt,
          providerRequestId: task.id, sourceObservedAt: sourceDate(row.keyword_info?.last_updated_time) },
      };
    },
  };
}
