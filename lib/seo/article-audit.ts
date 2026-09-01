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
    dimensions: 'media.dimensions',
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

export const ARTICLE_AUDIT_ADVISORY_CODES = {
  attribution: {
    discoveryContext: 'attribution.discovery_context',
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

export type AssetMetadata = {
  exists: boolean;
  width: number | null;
  height: number | null;
};

export type AssetMetadataResolver = (
  src: string,
  type: ArticleRecord['frontmatter']['media'][number]['type'],
) => boolean | AssetMetadata;

export type AssetExists = AssetMetadataResolver;

type AuditCheck = {
  passed: boolean;
  code: string;
  message: string;
  severity?: 'blocking' | 'advisory';
};

type AuditBinding = {
  article: ArticleRecord;
  assetMetadata: AssetMetadataResolver;
};

const auditBindings = new WeakMap<ArticleAudit, AuditBinding>();

const nonEmpty = (value: string): boolean => value.trim().length > 0;
const dateOnly = (value: string | null): boolean => value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const unsupportedMarkerPattern = /\b(?:TBD|TODO|lorem ipsum)\b|\[citation needed\]/i;

function markdownOutsideCode(markdown: string): string {
  const output: string[] = [];
  let fence: { marker: '`' | '~'; length: number } | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    if (fence) {
      const closingFence = new RegExp(`^\\s{0,3}${fence.marker}{${fence.length},}\\s*$`);
      if (closingFence.test(line)) fence = undefined;
      output.push('');
      continue;
    }

    const openingFence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (openingFence) {
      fence = {
        marker: openingFence[1][0] as '`' | '~',
        length: openingFence[1].length,
      };
      output.push('');
      continue;
    }

    if (/^(?: {4}|\t)/.test(line)) {
      output.push('');
      continue;
    }

    output.push(line.replace(/`+[^`]*`+/g, ''));
  }

  return output.join('\n');
}

function externalMarkdownLinks(markdown: string): string[] {
  const links: string[] = [];
  const linkPattern = /(^|[^!])\[[^\]\n]+\]\((https?:\/\/[^)\s]+)\)/gim;

  for (const match of markdownOutsideCode(markdown).matchAll(linkPattern)) {
    links.push(match[2]);
  }

  return links;
}

function wordCount(markdown: string): number {
  return markdownOutsideCode(markdown)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
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
  const semanticBody = markdownOutsideCode(body);
  const h2Count = semanticBody.match(/^##\s+\S.*$/gm)?.length ?? 0;
  const hasBodyH1 = /^#\s+\S.*$/m.test(semanticBody);

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
    {
      passed: serp.people_also_ask.length > 0
        || serp.related_queries.length > 0
        || serp.autocomplete_suggestions.length > 0,
      code: ARTICLE_AUDIT_ADVISORY_CODES.attribution.discoveryContext,
      message: 'No PAA, related-query, or autocomplete discovery context was observed.',
      severity: 'advisory',
    },
  ];
}

function evidenceChecks(article: ArticleRecord): AuditCheck[] {
  const { frontmatter, body } = article;
  const sourceUrls = frontmatter.sources.map((source) => source.url);
  const citedUrls = externalMarkdownLinks(body);

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
      passed: citedUrls.length > 0,
      code: ARTICLE_AUDIT_BLOCKING_CODES.evidence.externalCitation,
      message: 'Article body must contain an external Markdown citation link.',
    },
    {
      passed: sourceUrls.some((url) => citedUrls.includes(url)),
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

function mediaChecks(article: ArticleRecord, assetMetadata: AssetMetadataResolver): AuditCheck[] {
  const { media, campaign_id: campaignId } = article.frontmatter;
  const localPrefix = `/media/articles/${campaignId}/`;
  const validLocalPath = (src: string): boolean => src.startsWith(localPrefix)
    && !src.includes('..')
    && !src.includes('?')
    && !src.includes('#')
    && src.length > localPrefix.length;
  const resolved = media.map((asset): AssetMetadata => {
    if (!validLocalPath(asset.src)) return { exists: false, width: null, height: null };
    const observation = assetMetadata(asset.src, asset.type);
    if (typeof observation !== 'boolean') return observation;
    if (!observation) return { exists: false, width: null, height: null };

    // The controlled image renderer declares 1200 × 675. Video assets must
    // provide measured metadata because their dimensions are not fixed there.
    return asset.type === 'image'
      ? { exists: true, width: 1200, height: 675 }
      : { exists: true, width: null, height: null };
  });
  const hasDimensions = (metadata: AssetMetadata): boolean => metadata.exists
    && metadata.width !== null
    && Number.isFinite(metadata.width)
    && metadata.width > 0
    && metadata.height !== null
    && Number.isFinite(metadata.height)
    && metadata.height > 0;

  return [
    { passed: media.length > 0, code: ARTICLE_AUDIT_BLOCKING_CODES.media.collection, message: 'At least one editorial media asset is required.' },
    { passed: media.length > 0 && media.every((asset) => validLocalPath(asset.src)), code: ARTICLE_AUDIT_BLOCKING_CODES.media.localPath, message: `Media must use a traversal-free ${localPrefix} path.` },
    { passed: media.length > 0 && resolved.every((metadata) => metadata.exists), code: ARTICLE_AUDIT_BLOCKING_CODES.media.assetMissing, message: 'Every declared media asset must exist.' },
    { passed: media.length > 0 && resolved.every(hasDimensions), code: ARTICLE_AUDIT_BLOCKING_CODES.media.dimensions, message: 'Every media asset requires positive intrinsic or controlled-render dimensions.' },
    { passed: media.length > 0 && media.every((asset) => nonEmpty(asset.alt)), code: ARTICLE_AUDIT_BLOCKING_CODES.media.alt, message: 'Every media asset requires non-empty alternative text.' },
    { passed: media.length > 0 && media.every((asset) => nonEmpty(asset.caption)), code: ARTICLE_AUDIT_BLOCKING_CODES.media.caption, message: 'Every media asset requires a non-empty caption.' },
    { passed: media.length > 0 && media.every((asset) => nonEmpty(asset.credit)), code: ARTICLE_AUDIT_BLOCKING_CODES.media.credit, message: 'Every media asset requires a non-empty credit.' },
    { passed: media.length > 0 && media.every((asset) => asset.rights === 'owned'), code: ARTICLE_AUDIT_BLOCKING_CODES.media.rights, message: 'Every media asset must have owned rights.' },
  ];
}

function keywordChecks(article: ArticleRecord): AuditCheck[] {
  const evidence = article.frontmatter.keyword_evidence;
  const metrics = [evidence.volume, evidence.difficulty, evidence.cpc];
  const prePublicationProvider = ['semrush', 'ahrefs', 'similarweb'].includes(evidence.provider);
  const rangesValid = (evidence.volume === null || evidence.volume >= 0)
    && (evidence.difficulty === null || (evidence.difficulty >= 0 && evidence.difficulty <= 100))
    && (evidence.cpc === null || evidence.cpc >= 0);

  return [
    { passed: prePublicationProvider, code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.providerPending, message: 'An authenticated keyword provider is required.' },
    { passed: evidence.validation_status === 'validated', code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.statusPending, message: 'Keyword evidence must be validated.' },
    { passed: dateOnly(evidence.observed_at), code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.observationMissing, message: 'Keyword evidence requires an authenticated observation date.' },
    { passed: metrics.some((metric) => metric !== null), code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.metricsPending, message: 'At least one authenticated numeric keyword metric is required.' },
    { passed: evidence.country === 'US', code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.country, message: 'Keyword evidence must describe the US market.' },
    { passed: rangesValid, code: ARTICLE_AUDIT_BLOCKING_CODES.keyword.metricRange, message: 'Keyword metrics must use valid nonnegative ranges and difficulty 0–100.' },
  ];
}

export function auditArticle(article: ArticleRecord, assetMetadata: AssetMetadataResolver): ArticleAudit {
  const checks: Record<AuditCategoryName, AuditCheck[]> = {
    technical: technicalChecks(article),
    attribution: attributionChecks(article),
    evidence: evidenceChecks(article),
    media: mediaChecks(article, assetMetadata),
    keyword: keywordChecks(article),
  };
  const blockingFindings: ArticleAuditFinding[] = [];
  const advisoryFindings: ArticleAuditFinding[] = [];

  for (const [category, categoryChecks] of Object.entries(checks) as [AuditCategoryName, AuditCheck[]][]) {
    for (const check of categoryChecks) {
      if (check.passed) continue;
      (check.severity === 'advisory' ? advisoryFindings : blockingFindings).push(finding(category, check));
    }
  }

  const audit: ArticleAudit = {
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
  auditBindings.set(audit, { article, assetMetadata });
  return audit;
}

export function isArticlePublishable(
  article: ArticleRecord,
  audit: ArticleAudit,
  globalIndexing: boolean,
): boolean {
  const binding = auditBindings.get(audit);
  if (!binding || binding.article !== article) return false;

  const currentAudit = auditArticle(article, binding.assetMetadata);
  const { frontmatter } = article;
  return globalIndexing === true
    && currentAudit.blockingFindings.length === 0
    && frontmatter.status === 'publishable'
    && frontmatter.indexing === 'index'
    && frontmatter.review.seo_checked
    && frontmatter.review.evidence_checked
    && frontmatter.review.editorial_checked
    && frontmatter.review.media_checked
    && dateOnly(frontmatter.review.checked_at);
}
