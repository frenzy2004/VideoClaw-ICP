import type { ArticleRecord } from '../content/articles';

export const ARTICLE_AUDIT_THRESHOLDS = {
  titleLength: { min: 30, max: 65 },
  descriptionLength: { min: 120, max: 170 },
  minimumH2Headings: 2,
  minimumWordCount: 600,
} as const;

export const ARTICLE_AUDIT_BLOCKING_CODES = {
  technical: {
    titleLength: 'technical.title_length',
    descriptionLength: 'technical.description_length',
    slugFormat: 'technical.slug_format',
    canonicalPath: 'technical.canonical_path',
    indexingState: 'technical.indexing_state',
    bodyH1: 'technical.body_h1',
    h2Count: 'technical.h2_count',
    wordCount: 'technical.word_count',
    cta: 'technical.cta',
  },
  attribution: {
    icp: 'attribution.icp',
    customerTrigger: 'attribution.customer_trigger',
    funnelStage: 'attribution.funnel_stage',
    searchIntent: 'attribution.search_intent',
    primaryKeyword: 'attribution.primary_keyword',
    competitorGap: 'attribution.competitor_gap',
    serpProvenance: 'attribution.serp_provenance',
  },
  evidence: {
    sources: 'evidence.sources',
    sourceDates: 'evidence.source_dates',
    externalCitation: 'evidence.external_citation',
    sourceCitation: 'evidence.source_citation',
    unsupportedMarker: 'evidence.unsupported_marker',
  },
  media: {
    collection: 'media.collection',
    localPath: 'media.local_path',
    assetMissing: 'media.asset_missing',
    alt: 'media.alt',
    caption: 'media.caption',
    credit: 'media.credit',
    rights: 'media.rights',
  },
  keyword: {
    providerPending: 'keyword.provider_pending',
    statusPending: 'keyword.status_pending',
    observationMissing: 'keyword.observation_missing',
    metricsPending: 'keyword.metrics_pending',
    country: 'keyword.country',
    metricRange: 'keyword.metric_range',
  },
} as const;

export type AuditCategoryName = 'technical' | 'attribution' | 'evidence' | 'media' | 'keyword';

export type ArticleAuditFinding = {
  code: string;
  category: AuditCategoryName;
  message: string;
};

export type ArticleAuditCategory = {
  score: number;
  passedChecks: number;
  totalChecks: number;
};

export type ArticleAudit = {
  label: 'VideoClaw editorial QA';
  categories: Record<AuditCategoryName, ArticleAuditCategory>;
  blockingFindings: ArticleAuditFinding[];
  advisoryFindings: ArticleAuditFinding[];
};

export type AssetExists = (src: string) => boolean;

type AuditCheck = {
  passed: boolean;
  code: string;
  message: string;
  blocking?: boolean;
};

const nonEmpty = (value: string): boolean => value.trim().length > 0;
const dateOnly = (value: string | null): boolean => value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const externalMarkdownLinkPattern = /\[[^\]]+\]\(https?:\/\/[^)\s]+\)/i;
const unsupportedMarkerPattern = /\b(?:TBD|TODO|lorem ipsum)\b|\[citation needed\]/i;

function wordCount(markdown: string): number {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?(?:\[[^\]]*\])\([^)]*\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function scoreChecks(checks: AuditCheck[]): ArticleAuditCategory {
  const passedChecks = checks.filter((check) => check.passed).length;
  return {
    score: Math.round((passedChecks / checks.length) * 100),
    passedChecks,
    totalChecks: checks.length,
  };
}

function finding(category: AuditCategoryName, check: AuditCheck): ArticleAuditFinding {
  return { code: check.code, category, message: check.message };
}

function technicalChecks(article: ArticleRecord): AuditCheck[] {
  const { frontmatter, body } = article;
  const { titleLength, descriptionLength, minimumH2Headings, minimumWordCount } = ARTICLE_AUDIT_THRESHOLDS;
  const h2Count = body.match(/^##\s+\S.*$/gm)?.length ?? 0;
  const hasBodyH1 = /^#\s+\S.*$/m.test(body);

  return [
    {
      passed: frontmatter.title.length >= titleLength.min && frontmatter.title.length <= titleLength.max,
      code: ARTICLE_AUDIT_BLOCKING_CODES.technical.titleLength,
      message: `Title must contain ${titleLength.min}–${titleLength.max} characters.`,
    },
    {
      passed: frontmatter.description.length >= descriptionLength.min && frontmatter.description.length <= descriptionLength.max,
      code: ARTICLE_AUDIT_BLOCKING_CODES.technical.descriptionLength,
      message: `Description must contain ${descriptionLength.min}–${descriptionLength.max} characters.`,
    },
    {
      passed: slugPattern.test(frontmatter.slug),
      code: ARTICLE_AUDIT_BLOCKING_CODES.technical.slugFormat,
      message: 'Slug must be lowercase ASCII words separated by single hyphens.',
    },
    {
      passed: frontmatter.canonical_path === `/blog/${frontmatter.slug}`,
      code: ARTICLE_AUDIT_BLOCKING_CODES.technical.canonicalPath,
      message: 'Canonical path must equal /blog/<slug>.',
    },
    {
      passed: frontmatter.status === 'publishable'
        ? frontmatter.indexing === 'index'
        : frontmatter.indexing === 'noindex',
      code: ARTICLE_AUDIT_BLOCKING_CODES.technical.indexingState,
      message: 'Draft and review records must be noindex; publishable records must be index.',
    },
    {
      passed: !hasBodyH1,
      code: ARTICLE_AUDIT_BLOCKING_CODES.technical.bodyH1,
      message: 'Markdown body must not contain an H1 because the renderer supplies it.',
    },
    {
      passed: h2Count >= minimumH2Headings,
      code: ARTICLE_AUDIT_BLOCKING_CODES.technical.h2Count,
      message: `Article body must contain at least ${minimumH2Headings} H2 headings.`,
    },
    {
      passed: wordCount(body) >= minimumWordCount,
      code: ARTICLE_AUDIT_BLOCKING_CODES.technical.wordCount,
      message: `Article body must contain at least ${minimumWordCount} words.`,
    },
    {
      passed: nonEmpty(frontmatter.cta.label) && nonEmpty(frontmatter.cta.href),
      code: ARTICLE_AUDIT_BLOCKING_CODES.technical.cta,
      message: 'CTA label and destination must be present.',
    },
  ];
}

function attributionChecks(article: ArticleRecord): AuditCheck[] {
  const { frontmatter } = article;
  const { serp_evidence: serp } = frontmatter;
  const validSerpProvenance = serp.provider === 'apify'
    && serp.actor === 'apify/google-search-scraper'
    && serp.query === frontmatter.primary_keyword
    && serp.country === 'US'
    && serp.language === 'en'
    && dateOnly(serp.observed_at)
    && nonEmpty(serp.run_id)
    && nonEmpty(serp.dataset_id)
    && serp.top_competitors.length > 0
    && serp.validation_status === 'observed';

  return [
    { passed: nonEmpty(frontmatter.icp), code: ARTICLE_AUDIT_BLOCKING_CODES.attribution.icp, message: 'ICP attribution is required.' },
    { passed: nonEmpty(frontmatter.customer_trigger), code: ARTICLE_AUDIT_BLOCKING_CODES.attribution.customerTrigger, message: 'Customer trigger attribution is required.' },
    { passed: ['top', 'middle', 'bottom'].includes(frontmatter.funnel_stage), code: ARTICLE_AUDIT_BLOCKING_CODES.attribution.funnelStage, message: 'Funnel stage attribution is required.' },
    { passed: ['informational', 'commercial', 'transactional', 'navigational'].includes(frontmatter.search_intent), code: ARTICLE_AUDIT_BLOCKING_CODES.attribution.searchIntent, message: 'Search intent attribution is required.' },
    { passed: nonEmpty(frontmatter.primary_keyword), code: ARTICLE_AUDIT_BLOCKING_CODES.attribution.primaryKeyword, message: 'Primary keyword attribution is required.' },
    { passed: nonEmpty(frontmatter.competitor_gap), code: ARTICLE_AUDIT_BLOCKING_CODES.attribution.competitorGap, message: 'Competitor-gap attribution is required.' },
    { passed: validSerpProvenance, code: ARTICLE_AUDIT_BLOCKING_CODES.attribution.serpProvenance, message: 'Observed US Apify SERP provenance is required.' },
  ];
}

function evidenceChecks(article: ArticleRecord): AuditCheck[] {
  const { frontmatter, body } = article;
  const sourceUrls = frontmatter.sources.map((source) => source.url);

  return [
    {
      passed: frontmatter.sources.length > 0 && sourceUrls.every((url) => {
        try {
          return ['http:', 'https:'].includes(new URL(url).protocol);
        } catch {
          return false;
        }
      }),
      code: ARTICLE_AUDIT_BLOCKING_CODES.evidence.sources,
      message: 'At least one valid HTTP(S) source is required.',
    },
    {
      passed: frontmatter.sources.length > 0 && frontmatter.sources.every((source) => dateOnly(source.checked_at)),
      code: ARTICLE_AUDIT_BLOCKING_CODES.evidence.sourceDates,
      message: 'Every source must include a checked date.',
    },
    {
      passed: externalMarkdownLinkPattern.test(body),
      code: ARTICLE_AUDIT_BLOCKING_CODES.evidence.externalCitation,
      message: 'Article body must contain an external Markdown citation link.',
    },
    {
      passed: sourceUrls.some((url) => body.includes(`](${url})`)),
      code: ARTICLE_AUDIT_BLOCKING_CODES.evidence.sourceCitation,
      message: 'At least one declared source must be cited in the article body.',
    },
    {
      passed: !unsupportedMarkerPattern.test(body),
      code: ARTICLE_AUDIT_BLOCKING_CODES.evidence.unsupportedMarker,
      message: 'Article body must not contain placeholder or unsupported-claim markers.',
    },
  ];
}

function mediaChecks(article: ArticleRecord, assetExists: AssetExists): AuditCheck[] {
  const { media, campaign_id: campaignId } = article.frontmatter;
  const localPrefix = `/media/articles/${campaignId}/`;
  const validLocalPath = (src: string): boolean => src.startsWith(localPrefix)
    && !src.includes('..')
    && !src.includes('?')
    && !src.includes('#')
    && src.length > localPrefix.length;

  return [
    { passed: media.length > 0, code: ARTICLE_AUDIT_BLOCKING_CODES.media.collection, message: 'At least one editorial media asset is required.' },
    { passed: media.length > 0 && media.every((asset) => validLocalPath(asset.src)), code: ARTICLE_AUDIT_BLOCKING_CODES.media.localPath, message: `Media must use a traversal-free ${localPrefix} path.` },
    { passed: media.length > 0 && media.every((asset) => validLocalPath(asset.src) && assetExists(asset.src)), code: ARTICLE_AUDIT_BLOCKING_CODES.media.assetMissing, message: 'Every declared media asset must exist.' },
    { passed: media.length > 0 && media.every((asset) => nonEmpty(asset.alt)), code: ARTICLE_AUDIT_BLOCKING_CODES.media.alt, message: 'Every media asset requires non-empty alternative text.' },
    { passed: media.length > 0 && media.every((asset) => nonEmpty(asset.caption)), code: ARTICLE_AUDIT_BLOCKING_CODES.media.caption, message: 'Every media asset requires a non-empty caption.' },
    { passed: media.length > 0 && media.every((asset) => nonEmpty(asset.credit)), code: ARTICLE_AUDIT_BLOCKING_CODES.media.credit, message: 'Every media asset requires a non-empty credit.' },
    { passed: media.length > 0 && media.every((asset) => asset.rights === 'owned'), code: ARTICLE_AUDIT_BLOCKING_CODES.media.rights, message: 'Every media asset must have owned rights.' },
  ];
}

function keywordChecks(article: ArticleRecord): AuditCheck[] {
  const evidence = article.frontmatter.keyword_evidence;
  const metrics = [evidence.volume, evidence.difficulty, evidence.cpc];
  const rangesValid = (evidence.volume === null || evidence.volume >= 0)
    && (evidence.difficulty === null || (evidence.difficulty >= 0 && evidence.difficulty <= 100))
    && (evidence.cpc === null || evidence.cpc >= 0);

  return [
    { passed: evidence.provider !== 'pending', code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.providerPending, message: 'An authenticated keyword provider is required.' },
    { passed: evidence.validation_status === 'validated', code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.statusPending, message: 'Keyword evidence must be validated.' },
    { passed: dateOnly(evidence.observed_at), code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.observationMissing, message: 'Keyword evidence requires an authenticated observation date.' },
    { passed: metrics.some((metric) => metric !== null), code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.metricsPending, message: 'At least one authenticated numeric keyword metric is required.' },
    { passed: evidence.country === 'US', code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.country, message: 'Keyword evidence must describe the US market.' },
    { passed: rangesValid, code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.metricRange, message: 'Keyword metrics must use valid nonnegative ranges and difficulty 0–100.' },
  ];
}

export function auditArticle(article: ArticleRecord, assetExists: AssetExists): ArticleAudit {
  const checks: Record<AuditCategoryName, AuditCheck[]> = {
    technical: technicalChecks(article),
    attribution: attributionChecks(article),
    evidence: evidenceChecks(article),
    media: mediaChecks(article, assetExists),
    keyword: keywordChecks(article),
  };
  const blockingFindings: ArticleAuditFinding[] = [];
  const advisoryFindings: ArticleAuditFinding[] = [];

  for (const [category, categoryChecks] of Object.entries(checks) as [AuditCategoryName, AuditCheck[]][]) {
    for (const check of categoryChecks) {
      if (check.passed) continue;
      (check.blocking === false ? advisoryFindings : blockingFindings).push(finding(category, check));
    }
  }

  return {
    label: 'VideoClaw editorial QA',
    categories: {
      technical: scoreChecks(checks.technical),
      attribution: scoreChecks(checks.attribution),
      evidence: scoreChecks(checks.evidence),
      media: scoreChecks(checks.media),
      keyword: scoreChecks(checks.keyword),
    },
    blockingFindings,
    advisoryFindings,
  };
}

export function isArticlePublishable(
  article: ArticleRecord,
  audit: ArticleAudit,
  globalIndexing: boolean,
): boolean {
  const { frontmatter } = article;
  return globalIndexing === true
    && audit.blockingFindings.length === 0
    && frontmatter.status === 'publishable'
    && frontmatter.indexing === 'index'
    && frontmatter.review.seo_checked
    && frontmatter.review.evidence_checked
    && frontmatter.review.editorial_checked
    && frontmatter.review.media_checked
    && dateOnly(frontmatter.review.checked_at);
}
