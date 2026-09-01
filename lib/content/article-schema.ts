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

const dateString = z.preprocess(
  (value) => value instanceof Date ? value.toISOString().slice(0, 10) : value,
  z.string().date(),
);

const nonEmptyString = z.string().trim().min(1);
const localMediaPath = z.string().startsWith('/', { message: 'Media src must be a local path beginning with /.' });

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
  canonical_path: z.string().startsWith('/articles/'),
  competitor_gap: nonEmptyString,
  keyword_evidence: z.object({
    provider: KeywordProviderSchema,
    country: z.literal('US'),
    observed_at: dateString.nullable(),
    volume: z.number().nonnegative().nullable(),
    difficulty: z.number().nonnegative().nullable(),
    cpc: z.number().nonnegative().nullable(),
    intent: SearchIntentSchema,
    validation_status: KeywordValidationStatusSchema,
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
    rights: nonEmptyString,
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
}).strict();

export type ArticleFrontmatter = z.infer<typeof ArticleFrontmatterSchema>;
