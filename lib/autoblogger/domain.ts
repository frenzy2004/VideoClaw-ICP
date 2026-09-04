import { z } from 'zod';

export type AutobloggerIntent = 'informational' | 'commercial' | 'transactional' | 'navigational';

export const CAMPAIGN_IDS = [
  'newly-funded-founder',
  'accelerator-demo-day-founder',
  'video-production-comparison',
  'gtm-content-repurposing-buyer',
  'portfolio-media-platform',
] as const;

export const CampaignIdSchema = z.enum(CAMPAIGN_IDS);
export const IntentSchema = z.enum(['informational', 'commercial', 'transactional', 'navigational']);
export const FunnelStageSchema = z.enum(['top', 'middle', 'bottom']);

export const CandidateSchema = z.object({
  schemaVersion: z.literal(1),
  articleId: z.string().regex(/^vc-c[1-5]-\d{3}$/),
  campaignId: CampaignIdSchema,
  icp: z.string().trim().min(1),
  primaryKeyword: z.string().trim().min(1),
  secondaryKeywords: z.array(z.string().trim().min(1)),
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  intent: IntentSchema,
  funnelStage: FunnelStageSchema,
}).strict();

export const EvidenceBundleSchema = z.object({
  schemaVersion: z.literal(1),
  candidateFingerprint: z.string().min(1),
  suggestions: z.array(z.string().trim().min(1)),
  serp: z.object({
    organicResultCount: z.number().int().nonnegative(),
    peopleAlsoAsk: z.array(z.string().trim().min(1)),
  }).strict(),
  sources: z.array(z.object({
    url: z.string().url(),
    authoritative: z.boolean(),
  }).strict()),
  faqQuestions: z.array(z.string().trim().min(1)),
}).strict();

export const KeywordMetricsSchema = z.object({
  schemaVersion: z.literal(1),
  provider: z.enum(['pending', 'semrush', 'ahrefs', 'similarweb']),
  observedAt: z.string().datetime().nullable(),
  volume: z.number().finite().nonnegative().nullable(),
  difficulty: z.number().finite().min(0).max(100).nullable(),
  cpc: z.number().finite().nonnegative().nullable(),
  intent: IntentSchema,
}).strict();

/**
 * This validates the worker envelope only. `article` is intentionally opaque:
 * the lander checkout is the sole publication-contract authority.
 */
export const DraftBundleSchema = z.object({
  schemaVersion: z.literal(1),
  candidateFingerprint: z.string().min(1),
  article: z.record(z.string(), z.unknown()),
  markdown: z.string(),
  svg: z.string().nullable(),
}).strict();

export const RunRecordSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().trim().min(1),
  mode: z.enum(['manual_pilot', 'scheduled']),
  startedAt: z.string().datetime(),
  selectedCandidateFingerprints: z.array(z.string().min(1)),
  status: z.enum(['selected', 'researched', 'drafted', 'validated', 'pr_opened', 'failed']),
}).strict();

export type Candidate = z.infer<typeof CandidateSchema>;
export type CampaignId = z.infer<typeof CampaignIdSchema>;
export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
export type KeywordMetrics = z.infer<typeof KeywordMetricsSchema>;
export type DraftBundle = z.infer<typeof DraftBundleSchema>;
export type RunRecord = z.infer<typeof RunRecordSchema>;

function normalizeComparableText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeKeyword(value: string): string {
  return normalizeComparableText(value);
}

export function normalizeTitle(value: string): string {
  return normalizeComparableText(value);
}

export function normalizeSlug(value: string): string {
  return normalizeComparableText(value).replace(/ /g, '-');
}

export function normalizeIntent(value: string): AutobloggerIntent {
  const normalized = normalizeComparableText(value);
  for (const intent of ['informational', 'commercial', 'transactional', 'navigational'] as const) {
    if (normalized.startsWith(intent)) return intent;
  }

  throw new Error(`Unsupported search intent: ${value}`);
}

export function candidateFingerprints(candidate: {
  campaignId: string;
  primaryKeyword: string;
  title: string;
  slug: string;
  intent: string;
}) {
  const keyword = normalizeKeyword(candidate.primaryKeyword);
  const title = normalizeTitle(candidate.title);
  const slug = normalizeSlug(candidate.slug);
  normalizeIntent(candidate.intent);

  return {
    keyword: `keyword:${keyword}`,
    title: `title:${title}`,
    slug: `slug:${slug}`,
    candidate: `candidate:${candidate.campaignId}:${keyword}`,
  };
}
