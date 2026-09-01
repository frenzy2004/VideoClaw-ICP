import { z } from 'zod';

export const KEYWORD_PROVIDERS = {
  pending: { authenticated: false, phase: 'pre_publication' },
  semrush: { authenticated: true, phase: 'pre_publication' },
  ahrefs: { authenticated: true, phase: 'pre_publication' },
  similarweb: { authenticated: true, phase: 'pre_publication' },
  gsc: { authenticated: true, phase: 'post_publication' },
} as const;

export type KeywordProvider = keyof typeof KEYWORD_PROVIDERS;
export type PrePublicationKeywordProvider = 'pending' | 'semrush' | 'ahrefs' | 'similarweb';
export type KeywordIntent = 'informational' | 'commercial' | 'transactional' | 'navigational';
export type KeywordValidationStatus = 'pending_paid_provider' | 'validated';

export type KeywordObservation = {
  provider: PrePublicationKeywordProvider;
  keyword: string;
  country: 'US';
  observedAt: string | null;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: KeywordIntent;
  validationStatus: KeywordValidationStatus;
};

export type KeywordImportRow = {
  provider: unknown;
  keyword: unknown;
  country: unknown;
  observed_at?: unknown;
  volume?: unknown;
  difficulty?: unknown;
  cpc?: unknown;
  intent: unknown;
};

export type SearchConsoleObservation = {
  provider: 'gsc';
  keyword: string;
  country: 'US';
  observedAt: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  validationStatus: 'observed_post_publication';
};

export type SearchConsoleImportRow = {
  provider: unknown;
  keyword: unknown;
  country: unknown;
  observed_at: unknown;
  clicks: unknown;
  impressions: unknown;
  ctr: unknown;
  position: unknown;
};

const nullableMetric = z.number().finite().nonnegative().nullable().optional().transform((value) => value ?? null);

const KeywordImportSchema = z.object({
  provider: z.enum(['pending', 'semrush', 'ahrefs', 'similarweb']),
  keyword: z.string().trim().min(1),
  country: z.string(),
  observed_at: z.string().date().nullable().optional().transform((value) => value ?? null),
  volume: nullableMetric,
  difficulty: z.number().finite().min(0).max(100).nullable().optional().transform((value) => value ?? null),
  cpc: nullableMetric,
  intent: z.enum(['informational', 'commercial', 'transactional', 'navigational']),
}).strict();

const SearchConsoleImportSchema = z.object({
  provider: z.literal('gsc'),
  keyword: z.string().trim().min(1),
  country: z.string(),
  observed_at: z.string().date(),
  clicks: z.number().finite().nonnegative(),
  impressions: z.number().finite().nonnegative(),
  ctr: z.number().finite().min(0, 'CTR must be between 0 and 1.').max(1, 'CTR must be between 0 and 1.'),
  position: z.number().finite().nonnegative(),
}).strict();

export function normalizeKeywordImport(row: KeywordImportRow): KeywordObservation {
  if (row.provider === 'gsc') {
    throw new Error('Google Search Console is post-publication evidence; use normalizeSearchConsoleImport.');
  }

  const parsed = KeywordImportSchema.parse(row);
  const { provider, keyword, observed_at: observedAt, volume, difficulty, cpc, intent } = parsed;
  const metrics = [volume, difficulty, cpc];

  if (parsed.country !== 'US') {
    throw new Error(`Keyword observations for this campaign must use country US; received ${parsed.country}.`);
  }

  if (provider === 'pending') {
    if (observedAt !== null || metrics.some((metric) => metric !== null)) {
      throw new Error('Pending keyword evidence must not contain an observation date or numeric metrics.');
    }

    return {
      provider,
      keyword,
      country: 'US',
      observedAt: null,
      volume: null,
      difficulty: null,
      cpc: null,
      intent,
      validationStatus: 'pending_paid_provider',
    };
  }

  if (observedAt === null) {
    throw new Error(`Named provider ${provider} requires an authenticated observation date.`);
  }

  if (metrics.every((metric) => metric === null)) {
    throw new Error(`Named provider ${provider} requires at least one observed metric.`);
  }

  return {
    provider,
    keyword,
    country: 'US',
    observedAt,
    volume,
    difficulty,
    cpc,
    intent,
    validationStatus: 'validated',
  };
}

export function normalizeSearchConsoleImport(row: SearchConsoleImportRow): SearchConsoleObservation {
  const parsed = SearchConsoleImportSchema.parse(row);
  if (parsed.country !== 'US') {
    throw new Error(`Search Console observations for this campaign must use country US; received ${parsed.country}.`);
  }

  return {
    provider: 'gsc',
    keyword: parsed.keyword,
    country: 'US',
    observedAt: parsed.observed_at,
    clicks: parsed.clicks,
    impressions: parsed.impressions,
    ctr: parsed.ctr,
    position: parsed.position,
    validationStatus: 'observed_post_publication',
  };
}
