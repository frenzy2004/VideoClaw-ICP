import { z } from 'zod';

export const CAMPAIGN_IDS = [
  'newly-funded-founder',
  'accelerator-demo-day-founder',
  'video-production-comparison',
  'gtm-content-repurposing-buyer',
  'portfolio-media-platform',
] as const;

export const CampaignIdSchema = z.enum(CAMPAIGN_IDS);
export type CampaignId = z.infer<typeof CampaignIdSchema>;

export const FunnelStageSchema = z.enum(['top', 'middle', 'bottom']);
export const SearchIntentSchema = z.enum(['informational', 'commercial', 'transactional', 'navigational']);
export const ArticleStatusSchema = z.enum(['draft', 'review', 'publishable']);
export const IndexingSchema = z.enum(['noindex', 'index']);
export const KeywordProviderSchema = z.enum(['pending', 'semrush', 'ahrefs', 'similarweb', 'gsc']);
export const KeywordValidationStatusSchema = z.enum(['pending_paid_provider', 'validated']);
export const SerpProviderSchema = z.enum(['apify']);
export const SerpValidationStatusSchema = z.enum(['observed']);

const dateString = z.preprocess(
  (value) => value instanceof Date ? value.toISOString().slice(0, 10) : value,
  z.string().date(),
);

const nonEmptyString = z.string().trim().min(1);
const localMediaPath = z.string().regex(/^\/(?!\/)/, 'Media src must be a local path beginning with one /.');

const KeywordEvidenceSchema = z.object({
  provider: KeywordProviderSchema,
  country: z.literal('US'),
  observed_at: dateString.nullable(),
  volume: z.number().nonnegative().nullable(),
  difficulty: z.number().nonnegative().nullable(),
  cpc: z.number().nonnegative().nullable(),
  intent: SearchIntentSchema,
  validation_status: KeywordValidationStatusSchema,
}).superRefine((evidence, context) => {
  if (evidence.provider === 'pending') {
    if (evidence.observed_at !== null) {
      context.addIssue({ code: 'custom', path: ['observed_at'], message: 'Pending evidence must not have an observation date.' });
    }

    for (const field of ['volume', 'difficulty', 'cpc'] as const) {
      if (evidence[field] !== null) {
        context.addIssue({ code: 'custom', path: [field], message: `Pending evidence must have a null ${field}.` });
      }
    }

    if (evidence.validation_status !== 'pending_paid_provider') {
      context.addIssue({ code: 'custom', path: ['validation_status'], message: 'Pending evidence must use pending_paid_provider.' });
    }
    return;
  }

  const hasMetric = [evidence.volume, evidence.difficulty, evidence.cpc].some((value) => value !== null);
  if ((evidence.validation_status === 'validated' || hasMetric) && evidence.observed_at === null) {
    context.addIssue({ code: 'custom', path: ['observed_at'], message: 'Authenticated validated evidence requires an observation date.' });
  }

  if (hasMetric && evidence.validation_status !== 'validated') {
    context.addIssue({ code: 'custom', path: ['validation_status'], message: 'Observed numeric metrics must be validated.' });
  }
});

export const ArticleFrontmatterSchema = z.object({
  schema_version: z.literal(1),
  article_id: nonEmptyString,
  campaign_id: CampaignIdSchema,
  icp: nonEmptyString,
  customer_trigger: nonEmptyString,
  funnel_stage: FunnelStageSchema,
  search_intent: SearchIntentSchema,
  primary_keyword: nonEmptyString,
  secondary_keywords: z.array(nonEmptyString),
  title: nonEmptyString,
  description: nonEmptyString,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase ASCII and hyphen-delimited.').min(3).max(80),
  status: ArticleStatusSchema,
  indexing: IndexingSchema,
  canonical_path: z.string().startsWith('/blog/'),
  competitor_gap: nonEmptyString,
  keyword_evidence: KeywordEvidenceSchema,
  serp_evidence: z.object({
    provider: SerpProviderSchema,
    actor: z.literal('apify/google-search-scraper'),
    query: nonEmptyString,
    country: z.literal('US'),
    language: z.literal('en'),
    observed_at: dateString,
    run_id: nonEmptyString,
    dataset_id: nonEmptyString,
    organic_result_count: z.number().int().nonnegative(),
    top_competitors: z.array(z.object({
      position: z.number().int().positive(),
      title: nonEmptyString,
      url: z.string().url(),
      domain: nonEmptyString,
    })).min(1),
    people_also_ask: z.array(nonEmptyString),
    related_queries: z.array(nonEmptyString),
    autocomplete_suggestions: z.array(nonEmptyString),
    validation_status: SerpValidationStatusSchema,
  }),
  sources: z.array(z.object({
    title: nonEmptyString,
    url: z.string().url(),
    publisher: nonEmptyString,
    checked_at: dateString,
  })).min(1),
  media: z.array(z.object({
    type: z.enum(['image', 'video']),
    src: localMediaPath,
    alt: nonEmptyString,
    caption: nonEmptyString,
    credit: nonEmptyString,
    rights: z.literal('owned'),
  })).min(1),
  cta: z.object({
    label: nonEmptyString,
    href: nonEmptyString,
  }),
  review: z.object({
    seo_checked: z.boolean(),
    evidence_checked: z.boolean(),
    editorial_checked: z.boolean(),
    media_checked: z.boolean(),
    checked_at: dateString.nullable(),
  }),
  related_articles: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
}).strict().superRefine((frontmatter, context) => {
  if (frontmatter.serp_evidence.query !== frontmatter.primary_keyword) {
    context.addIssue({
      code: 'custom',
      path: ['serp_evidence', 'query'],
      message: 'serp_evidence.query must exactly match primary_keyword.',
    });
  }

  if ((frontmatter.status === 'draft' || frontmatter.status === 'review') && frontmatter.indexing !== 'noindex') {
    context.addIssue({
      code: 'custom',
      path: ['indexing'],
      message: `${frontmatter.status} records must use noindex.`,
    });
  }
});

export type ArticleFrontmatter = z.infer<typeof ArticleFrontmatterSchema>;
