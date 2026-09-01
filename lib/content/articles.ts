import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import matter from 'gray-matter';
import {
  ArticleFrontmatterSchema,
  CAMPAIGN_IDS,
  type ArticleFrontmatter,
  type CampaignId,
} from './article-schema';

export type { ArticleFrontmatter, CampaignId } from './article-schema';

export type ArticleRecord = {
  frontmatter: ArticleFrontmatter;
  body: string;
  filePath: string;
};

export type LibraryFinding = {
  code: string;
  message: string;
  filePath?: string;
};

export type LibraryValidationResult = {
  valid: boolean;
  findings: LibraryFinding[];
  totals: {
    all: number;
    byCampaign: Record<CampaignId, number>;
  };
};

export class ArticleSourceValidationError extends Error {
  constructor(readonly findings: LibraryFinding[]) {
    super(findings.map((finding) => `${finding.filePath ?? 'article'}: ${finding.message}`).join('\n'));
    this.name = 'ArticleSourceValidationError';
  }
}

function finding(code: string, message: string, filePath?: string): LibraryFinding {
  return { code, message, filePath };
}

function duplicateKey(field: string, value: string): string {
  return field === 'article_id' || field === 'title' || field === 'primary_keyword'
    ? value.trim().replace(/\s+/g, ' ').toLowerCase()
    : value;
}

function unsafeHtmlFinding(body: string, filePath: string): LibraryFinding | undefined {
  if (/<(?:\/?[a-z][a-z0-9-]*(?=[\t\n\f\r />])|!--|\?|![a-z]|!\[CDATA\[)/i.test(body)) {
    return finding('body.raw_html', 'Raw HTML is not allowed in article Markdown.', filePath);
  }
}

export function parseArticleSource(source: string, filePath: string): ArticleRecord {
  let parsed: ReturnType<typeof matter>;

  try {
    parsed = matter(source);
  } catch (error) {
    throw new ArticleSourceValidationError([
      finding('frontmatter.parse', error instanceof Error ? error.message : 'Could not parse frontmatter.', filePath),
    ]);
  }

  const schemaResult = ArticleFrontmatterSchema.safeParse(parsed.data);
  if (!schemaResult.success) {
    throw new ArticleSourceValidationError(schemaResult.error.issues.map((issue) => (
      finding(
        `frontmatter.${issue.path.join('.') || 'root'}`,
        `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`,
        filePath,
      )
    )));
  }

  const frontmatter = schemaResult.data;
  const findings: LibraryFinding[] = [];
  const expectedCanonicalPath = `/blog/${frontmatter.slug}`;
  const filenameSlug = basename(filePath, '.md');
  const normalizedFilePath = filePath.replaceAll('\\', '/').replace(/^\.\//, '');
  const expectedSourcePath = `content/articles/${frontmatter.campaign_id}/${frontmatter.slug}.md`;
  const sourcePathFromRoot = normalizedFilePath.match(/(?:^|\/)(content\/articles\/.*)$/)?.[1]
    ?? normalizedFilePath;

  if (frontmatter.canonical_path !== expectedCanonicalPath) {
    findings.push(finding('frontmatter.canonical_path', `canonical_path must equal ${expectedCanonicalPath}.`, filePath));
  }

  if (filenameSlug !== frontmatter.slug) {
    findings.push(finding('frontmatter.slug_path_mismatch', `Filename slug ${filenameSlug} must equal frontmatter.slug ${frontmatter.slug}.`, filePath));
  }

  if (sourcePathFromRoot !== expectedSourcePath) {
    findings.push(finding(
      'frontmatter.source_path_mismatch',
      `Path must match content/articles/<campaign_id>/<slug>.md; expected ${expectedSourcePath}.`,
      filePath,
    ));
  }

  const rawHtml = unsafeHtmlFinding(parsed.content, filePath);
  if (rawHtml) findings.push(rawHtml);

  if (findings.length > 0) throw new ArticleSourceValidationError(findings);

  return { frontmatter, body: parsed.content, filePath };
}

function articleFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return articleFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : [];
  });
}

export function validateArticleLibrary(records: ArticleRecord[]): LibraryValidationResult {
  const byCampaign = Object.fromEntries(CAMPAIGN_IDS.map((campaignId) => [campaignId, 0])) as Record<CampaignId, number>;
  const findings: LibraryFinding[] = [];
  const values = new Map<string, Map<string, ArticleRecord>>([
    ['article_id', new Map()],
    ['slug', new Map()],
    ['title', new Map()],
    ['primary_keyword', new Map()],
  ]);

  for (const record of records) {
    byCampaign[record.frontmatter.campaign_id] += 1;

    for (const [field, seen] of values) {
      const value = record.frontmatter[field as keyof Pick<ArticleFrontmatter, 'article_id' | 'slug' | 'title' | 'primary_keyword'>];
      const key = duplicateKey(field, value);
      const previous = seen.get(key);
      if (previous) {
        findings.push(finding(
          `duplicate.${field}`,
          `Duplicate ${field} ${value}; first declared in ${previous.filePath}.`,
          record.filePath,
        ));
      } else {
        seen.set(key, record);
      }
    }
  }

  if (records.length !== 250) {
    findings.push(finding('library.total_count', `Article library must contain exactly 250 records; received ${records.length}.`));
  }

  for (const campaignId of CAMPAIGN_IDS) {
    if (byCampaign[campaignId] !== 50) {
      findings.push(finding(
        'library.campaign_count',
        `Campaign ${campaignId} must contain exactly 50 records; received ${byCampaign[campaignId]}.`,
      ));
    }
  }

  return {
    valid: findings.length === 0,
    findings,
    totals: { all: records.length, byCampaign },
  };
}

function libraryRoot(): string {
  return join(process.cwd(), 'content', 'articles');
}

function aggregateLibraryError(findings: LibraryFinding[]): Error {
  return new Error(`Article library validation failed:\n${findings.map((item) => `${item.filePath ?? 'library'}: ${item.message}`).join('\n')}`);
}

export function getAllArticles(root = libraryRoot()): ArticleRecord[] {
  const records: ArticleRecord[] = [];
  const findings: LibraryFinding[] = [];

  for (const filePath of articleFiles(root)) {
    try {
      records.push(parseArticleSource(readFileSync(filePath, 'utf8'), filePath));
    } catch (error) {
      if (error instanceof ArticleSourceValidationError) {
        findings.push(...error.findings);
      } else {
        findings.push(finding('article.read', error instanceof Error ? error.message : 'Could not read article.', filePath));
      }
    }
  }

  const validation = validateArticleLibrary(records);
  findings.push(...validation.findings);
  if (findings.length > 0) throw aggregateLibraryError(findings);

  return records.sort((left, right) => left.frontmatter.article_id.localeCompare(right.frontmatter.article_id));
}

export function getArticleBySlug(slug: string, root = libraryRoot()): ArticleRecord | undefined {
  return getAllArticles(root).find((article) => article.frontmatter.slug === slug);
}

function passesPublicationGate(article: ArticleRecord): boolean {
  const { frontmatter } = article;
  return (
    frontmatter.status === 'publishable'
    && frontmatter.indexing === 'index'
    && frontmatter.keyword_evidence.provider !== 'pending'
    && frontmatter.keyword_evidence.observed_at !== null
    && frontmatter.keyword_evidence.validation_status === 'validated'
    && [
      frontmatter.keyword_evidence.volume,
      frontmatter.keyword_evidence.difficulty,
      frontmatter.keyword_evidence.cpc,
    ].some((value) => value !== null)
    && frontmatter.serp_evidence.provider === 'apify'
    && frontmatter.serp_evidence.actor === 'apify/google-search-scraper'
    && frontmatter.serp_evidence.country === 'US'
    && frontmatter.serp_evidence.language === 'en'
    && frontmatter.serp_evidence.validation_status === 'observed'
    && frontmatter.serp_evidence.run_id.length > 0
    && frontmatter.serp_evidence.dataset_id.length > 0
    && frontmatter.review.seo_checked
    && frontmatter.review.evidence_checked
    && frontmatter.review.editorial_checked
    && frontmatter.review.media_checked
  );
}

export function getPublishableArticles(root = libraryRoot()): ArticleRecord[] {
  const articles = getAllArticles(root);
  if (process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING !== 'true') return [];
  return articles.filter(passesPublicationGate);
}
