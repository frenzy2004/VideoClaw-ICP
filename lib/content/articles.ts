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

function unsafeHtmlFinding(body: string, filePath: string): LibraryFinding | undefined {
  if (/<\s*(script|iframe)\b/i.test(body) || /<[^>]+\son[a-z]+\s*=/i.test(body)) {
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
  const expectedCanonicalPath = `/articles/${frontmatter.slug}`;
  const filenameSlug = basename(filePath, '.md');

  if (frontmatter.canonical_path !== expectedCanonicalPath) {
    findings.push(finding('frontmatter.canonical_path', `canonical_path must equal ${expectedCanonicalPath}.`, filePath));
  }

  if (filenameSlug !== frontmatter.slug) {
    findings.push(finding('frontmatter.slug_path_mismatch', `Filename slug ${filenameSlug} must equal frontmatter.slug ${frontmatter.slug}.`, filePath));
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
      const previous = seen.get(value);
      if (previous) {
        findings.push(finding(
          `duplicate.${field}`,
          `Duplicate ${field} ${value}; first declared in ${previous.filePath}.`,
          record.filePath,
        ));
      } else {
        seen.set(value, record);
      }
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

export function getAllArticles(): ArticleRecord[] {
  const root = libraryRoot();
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

export function getArticleBySlug(slug: string): ArticleRecord | undefined {
  return getAllArticles().find((article) => article.frontmatter.slug === slug);
}

function passesPublicationGate(article: ArticleRecord): boolean {
  const { frontmatter } = article;
  return (
    frontmatter.status === 'publishable'
    && frontmatter.indexing === 'index'
    && frontmatter.keyword_evidence.validation_status === 'validated'
    && frontmatter.review.seo_checked
    && frontmatter.review.evidence_checked
    && frontmatter.review.editorial_checked
    && frontmatter.review.media_checked
  );
}

export function getPublishableArticles(): ArticleRecord[] {
  const articles = getAllArticles();
  if (process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING !== 'true') return [];
  return articles.filter(passesPublicationGate);
}
