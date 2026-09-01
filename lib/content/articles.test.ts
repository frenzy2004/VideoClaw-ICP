import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getAllArticles,
  getPublishableArticles,
  parseArticleSource,
  validateArticleLibrary,
  type ArticleRecord,
} from './articles';
import { CAMPAIGN_IDS } from './article-schema';

const validSource = `---
schema_version: 1
article_id: vc-c1-001
campaign_id: newly-funded-founder
icp: Newly funded US startup founder
customer_trigger: Closed a funding round
funnel_stage: top
search_intent: informational
primary_keyword: startup funding announcement video
secondary_keywords:
  - funding announcement content
title: Startup Funding Announcement Video Guide
description: Build a credible funding announcement video and reuse its approved evidence across investor, customer, and recruiting follow-up.
slug: startup-funding-announcement-video
status: draft
indexing: noindex
canonical_path: /blog/startup-funding-announcement-video
competitor_gap: Existing pages focus on press releases rather than reusable approved video evidence.
keyword_evidence:
  provider: pending
  country: US
  observed_at: null
  volume: null
  difficulty: null
  cpc: null
  intent: informational
  validation_status: pending_paid_provider
serp_evidence:
  provider: apify
  actor: apify/google-search-scraper
  query: startup funding announcement video
  country: US
  language: en
  observed_at: 2026-09-01
  run_id: test-run-id
  dataset_id: test-dataset-id
  organic_result_count: 10
  top_competitors:
    - position: 1
      title: Search Essentials
      url: https://developers.google.com/search/docs/essentials
      domain: developers.google.com
  people_also_ask: []
  related_queries: []
  autocomplete_suggestions: []
  validation_status: observed
sources:
  - title: Search Essentials
    url: https://developers.google.com/search/docs/essentials
    publisher: Google Search Central
    checked_at: 2026-09-01
media:
  - type: image
    src: /media/articles/newly-funded-founder/funding-announcement.svg
    alt: Funding announcement evidence workflow
    caption: A source-controlled announcement workflow.
    credit: VideoClaw editorial illustration
    rights: owned
cta:
  label: Check your source pack
  href: /#source-pack
review:
  seo_checked: false
  evidence_checked: false
  editorial_checked: false
  media_checked: false
  checked_at: null
related_articles: []
---
The useful answer appears here.

## Build the source pack

Use approved facts before creating audience variants.
`;

const validPath = 'content/articles/newly-funded-founder/startup-funding-announcement-video.md';
const temporaryWorkspaces: string[] = [];

function validRecord(): ArticleRecord {
  return parseArticleSource(validSource, validPath);
}

function distinctRecord(): ArticleRecord {
  const record = validRecord();
  record.frontmatter = {
    ...record.frontmatter,
    article_id: 'vc-c1-002',
    slug: 'second-funding-announcement-video',
    canonical_path: '/blog/second-funding-announcement-video',
    title: 'Second Startup Funding Announcement Video Guide',
    primary_keyword: 'second startup funding announcement video',
    serp_evidence: {
      ...record.frontmatter.serp_evidence,
      query: 'second startup funding announcement video',
    },
  };
  record.filePath = 'content/articles/newly-funded-founder/second-funding-announcement-video.md';
  return record;
}

function sourceWith(changes: Record<string, string>): string {
  return Object.entries(changes).reduce(
    (source, [from, to]) => source.replace(from, to),
    validSource,
  );
}

function syntheticLibrary(): ArticleRecord[] {
  return CAMPAIGN_IDS.flatMap((campaignId, campaignIndex) => (
    Array.from({ length: 50 }, (_, articleIndex) => {
      const record = validRecord();
      const sequence = String(articleIndex + 1).padStart(2, '0');
      const slug = `${campaignId}-article-${sequence}`;

      record.frontmatter = {
        ...record.frontmatter,
        article_id: `vc-c${campaignIndex + 1}-${String(articleIndex + 1).padStart(3, '0')}`,
        campaign_id: campaignId,
        slug,
        canonical_path: `/blog/${slug}`,
        title: `Campaign ${campaignIndex + 1} Article ${sequence} Video Guide`,
        primary_keyword: `${campaignId} video strategy ${sequence}`,
        serp_evidence: {
          ...record.frontmatter.serp_evidence,
          query: `${campaignId} video strategy ${sequence}`,
        },
      };
      record.filePath = `content/articles/${campaignId}/${slug}.md`;
      return record;
    })
  ));
}

function createTestArticlesRoot(): string {
  const workspace = mkdtempSync(join(tmpdir(), 'videoclaw-article-loader-'));
  const articlesRoot = join(workspace, 'content', 'articles');
  temporaryWorkspaces.push(workspace);
  mkdirSync(articlesRoot, { recursive: true });
  return articlesRoot;
}

function syntheticSource(campaignId: typeof CAMPAIGN_IDS[number], campaignIndex: number, articleIndex: number): string {
  const sequence = String(articleIndex + 1).padStart(2, '0');
  const slug = `${campaignId}-article-${sequence}`;
  const keyword = `${campaignId} video strategy ${sequence}`;

  return sourceWith({
    'article_id: vc-c1-001': `article_id: vc-c${campaignIndex + 1}-${String(articleIndex + 1).padStart(3, '0')}`,
    'campaign_id: newly-funded-founder': `campaign_id: ${campaignId}`,
    'primary_keyword: startup funding announcement video': `primary_keyword: ${keyword}`,
    'title: Startup Funding Announcement Video Guide': `title: Campaign ${campaignIndex + 1} Article ${sequence} Video Guide`,
    'slug: startup-funding-announcement-video': `slug: ${slug}`,
    'canonical_path: /blog/startup-funding-announcement-video': `canonical_path: /blog/${slug}`,
    'query: startup funding announcement video': `query: ${keyword}`,
    '/media/articles/newly-funded-founder/funding-announcement.svg': `/media/articles/${campaignId}/${slug}.svg`,
  });
}

function sourceWithPublishableEvidence(source: string): string {
  return source
    .replace('status: draft', 'status: publishable')
    .replace('indexing: noindex', 'indexing: index')
    .replace('provider: pending', 'provider: semrush')
    .replace('observed_at: null', 'observed_at: 2026-09-01')
    .replace('volume: null', 'volume: 100')
    .replace('validation_status: pending_paid_provider', 'validation_status: validated')
    .replace(/(seo_checked|evidence_checked|editorial_checked|media_checked): false/g, '$1: true')
    .replace('checked_at: null', 'checked_at: 2026-09-01');
}

function writeSyntheticLibrary(
  articlesRoot: string,
  count = 250,
  transform?: (source: string, recordIndex: number) => string,
): void {
  let recordIndex = 0;

  for (const [campaignIndex, campaignId] of CAMPAIGN_IDS.entries()) {
    for (let articleIndex = 0; articleIndex < 50 && recordIndex < count; articleIndex += 1) {
      const campaignDirectory = join(articlesRoot, campaignId);
      const slug = `${campaignId}-article-${String(articleIndex + 1).padStart(2, '0')}`;
      mkdirSync(campaignDirectory, { recursive: true });
      const source = syntheticSource(campaignId, campaignIndex, articleIndex);
      writeFileSync(join(campaignDirectory, `${slug}.md`), transform?.(source, recordIndex) ?? source);
      recordIndex += 1;
    }
  }
}

afterEach(() => {
  for (const workspace of temporaryWorkspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe('article source parsing', () => {
  it('returns typed frontmatter, body, and source path from a valid Markdown article', () => {
    expect(parseArticleSource(validSource, validPath)).toMatchObject({
      filePath: validPath,
      frontmatter: {
        article_id: 'vc-c1-001',
        campaign_id: 'newly-funded-founder',
        indexing: 'noindex',
        keyword_evidence: { validation_status: 'pending_paid_provider' },
        serp_evidence: {
          provider: 'apify',
          actor: 'apify/google-search-scraper',
          query: 'startup funding announcement video',
          country: 'US',
          language: 'en',
          observed_at: '2026-09-01',
          run_id: 'test-run-id',
          dataset_id: 'test-dataset-id',
          organic_result_count: 10,
          top_competitors: [{
            position: 1,
            title: 'Search Essentials',
            url: 'https://developers.google.com/search/docs/essentials',
            domain: 'developers.google.com',
          }],
          people_also_ask: [],
          related_queries: [],
          autocomplete_suggestions: [],
          validation_status: 'observed',
        },
      },
      body: 'The useful answer appears here.\n\n## Build the source pack\n\nUse approved facts before creating audience variants.\n',
    });
  });

  it('reports the source path and missing frontmatter field', () => {
    const missingTitle = validSource.replace('title: Startup Funding Announcement Video Guide\n', '');

    expect(() => parseArticleSource(missingTitle, 'content/articles/newly-funded-founder/missing-title.md')).toThrow(
      /missing-title\.md[\s\S]*title/i,
    );
  });

  it('requires observed Apify SERP provenance', () => {
    const withoutSerpEvidence = validSource.replace(/serp_evidence:\n[\s\S]*?(?=sources:\n)/, '');

    expect(() => parseArticleSource(withoutSerpEvidence, validPath)).toThrow(/serp_evidence/i);
  });

  it('requires the SERP query to equal the primary keyword exactly', () => {
    expect(() => parseArticleSource(
      sourceWith({
        'query: startup funding announcement video': 'query: different query',
      }),
      validPath,
    )).toThrow(/serp_evidence.*query/i);
  });

  it.each([
    ['a non-null pending volume', 'volume: null', 'volume: 100'],
    ['a pending observation date', 'observed_at: null', 'observed_at: 2026-09-01'],
    ['a validated pending provider', 'validation_status: pending_paid_provider', 'validation_status: validated'],
  ])('rejects pending keyword evidence with %s', (_label, from, to) => {
    expect(() => parseArticleSource(sourceWith({ [from]: to }), validPath)).toThrow(/keyword_evidence/i);
  });

  it('rejects validated keyword evidence without an authenticated observation', () => {
    expect(() => parseArticleSource(
      sourceWith({
        'provider: pending': 'provider: semrush',
        'validation_status: pending_paid_provider': 'validation_status: validated',
      }),
      validPath,
    )).toThrow(/keyword_evidence.*observed_at/i);
  });

  it('rejects a named keyword provider that remains pending', () => {
    expect(() => parseArticleSource(
      sourceWith({ 'provider: pending': 'provider: semrush' }),
      validPath,
    )).toThrow(/keyword_evidence.*validation_status/i);
  });

  it('rejects validated named-provider evidence when all proprietary metrics are null', () => {
    expect(() => parseArticleSource(
      sourceWith({
        'provider: pending': 'provider: ahrefs',
        'observed_at: null': 'observed_at: 2026-09-01',
        'validation_status: pending_paid_provider': 'validation_status: validated',
      }),
      validPath,
    )).toThrow(/keyword_evidence.*metric/i);
  });

  it.each(['draft', 'review'])('rejects an indexable %s record', (status) => {
    expect(() => parseArticleSource(
      sourceWith({
        'status: draft': `status: ${status}`,
        'indexing: noindex': 'indexing: index',
      }),
      validPath,
    )).toThrow(/indexing/i);
  });

  it('rejects a path whose Markdown filename does not match frontmatter.slug', () => {
    expect(() => parseArticleSource(validSource, 'content/articles/newly-funded-founder/wrong-slug.md')).toThrow(
      /wrong-slug\.md[\s\S]*slug/i,
    );
  });

  it('rejects a path whose campaign directory does not match frontmatter.campaign_id', () => {
    expect(() => parseArticleSource(
      validSource,
      'content/articles/video-production-comparison/startup-funding-announcement-video.md',
    )).toThrow(/campaign_id/i);
  });

  it('rejects nested directories below the canonical campaign directory', () => {
    expect(() => parseArticleSource(
      validSource,
      'content/articles/newly-funded-founder/nested/startup-funding-announcement-video.md',
    )).toThrow(/content\/articles.*campaign_id.*slug/i);
  });

  it('rejects a nested path that repeats the canonical content root', () => {
    expect(() => parseArticleSource(
      validSource,
      'content/articles/newly-funded-founder/nested/content/articles/newly-funded-founder/startup-funding-announcement-video.md',
    )).toThrow(/content\/articles.*campaign_id.*slug/i);
  });

  it('rejects a similarly named non-canonical content root', () => {
    expect(() => parseArticleSource(
      validSource,
      'mycontent/articles/newly-funded-founder/startup-funding-announcement-video.md',
    )).toThrow(/content\/articles.*campaign_id.*slug/i);
  });

  it('rejects a canonical path that does not match frontmatter.slug', () => {
    expect(() => parseArticleSource(
      sourceWith({
        '/blog/startup-funding-announcement-video': '/blog/different-slug',
      }),
      validPath,
    )).toThrow(/canonical_path/i);
  });

  it.each([
    ['uppercase characters', 'VC-C1-001'],
    ['a two-digit sequence', 'vc-c1-01'],
    ['an out-of-range campaign number', 'vc-c6-001'],
  ])('requires the exact lowercase article_id pattern when it contains %s', (_label, articleId) => {
    expect(() => parseArticleSource(
      sourceWith({ 'article_id: vc-c1-001': `article_id: ${articleId}` }),
      validPath,
    )).toThrow(/article_id/i);
  });

  it('requires the article_id campaign number to match campaign_id', () => {
    expect(() => parseArticleSource(
      sourceWith({ 'article_id: vc-c1-001': 'article_id: vc-c2-001' }),
      validPath,
    )).toThrow(/article_id.*campaign/i);
  });

  it('rejects non-local media sources', () => {
    expect(() => parseArticleSource(
      sourceWith({
        '/media/articles/newly-funded-founder/funding-announcement.svg': 'https://example.com/funding-announcement.svg',
      }),
      validPath,
    )).toThrow(/media.*src/i);
  });

  it('rejects protocol-relative media sources', () => {
    expect(() => parseArticleSource(
      sourceWith({
        '/media/articles/newly-funded-founder/funding-announcement.svg': '//cdn.example.com/funding-announcement.svg',
      }),
      validPath,
    )).toThrow(/media.*src/i);
  });

  it.each([
    ['a non-article root file', '/robots.txt'],
    ['path traversal', '/media/articles/newly-funded-founder/../secrets.svg'],
    ['duplicate slashes', '/media/articles/newly-funded-founder//funding-announcement.svg'],
    ['a query string', '/media/articles/newly-funded-founder/funding-announcement.svg?size=large'],
    ['a fragment', '/media/articles/newly-funded-founder/funding-announcement.svg#detail'],
    ['the wrong campaign directory', '/media/articles/video-production-comparison/funding-announcement.svg'],
  ])('rejects media src with %s', (_label, src) => {
    expect(() => parseArticleSource(
      sourceWith({
        '/media/articles/newly-funded-founder/funding-announcement.svg': src,
      }),
      validPath,
    )).toThrow(/media.*src/i);
  });

  it('requires owned media rights for the review release', () => {
    expect(() => parseArticleSource(sourceWith({ 'rights: owned': 'rights: licensed' }), validPath)).toThrow(
      /media.*rights/i,
    );
  });

  it('requires non-empty media provenance fields', () => {
    expect(() => parseArticleSource(sourceWith({ 'credit: VideoClaw editorial illustration': 'credit: ""' }), validPath)).toThrow(
      /media.*credit/i,
    );
  });

  it.each([
    ['script tags', '<script>alert(1)</script>'],
    ['iframes', '<iframe src="https://example.com"></iframe>'],
    ['event-handler HTML', '<img src="/media/articles/example.svg" onerror="alert(1)">'],
    ['slash-separated event-handler HTML', '<svg/onload=alert(1)>'],
    ['otherwise inert raw HTML', '<div>Visible text</div>'],
    ['CDATA declarations', '<![CDATA[raw content]]>'],
    ['ENTITY declarations', '<!ENTITY example "value">'],
  ])('rejects raw %s in the Markdown body', (_label, unsafeHtml) => {
    expect(() => parseArticleSource(`${validSource}\n${unsafeHtml}`, validPath)).toThrow(/raw HTML/i);
  });

  it('preserves Markdown autolinks while rejecting raw HTML', () => {
    expect(parseArticleSource(`${validSource}\n<https://example.com>`, validPath).body).toContain('<https://example.com>');
  });
});

describe('article library validation', () => {
  it.each([
    ['article_id', 'vc-c1-001', 'duplicate.article_id'],
    ['slug', 'startup-funding-announcement-video', 'duplicate.slug'],
    ['title', 'Startup Funding Announcement Video Guide', 'duplicate.title'],
    ['primary_keyword', 'startup funding announcement video', 'duplicate.primary_keyword'],
  ])('reports duplicate %s values', (field, value, code) => {
    const first = validRecord();
    const second = distinctRecord();
    second.frontmatter = { ...second.frontmatter, [field]: value } as ArticleRecord['frontmatter'];

    expect(validateArticleLibrary([first, second]).findings).toContainEqual(
      expect.objectContaining({ code }),
    );
  });

  it('normalizes case when comparing duplicate article_id values', () => {
    const first = validRecord();
    const second = distinctRecord();
    second.frontmatter = { ...second.frontmatter, article_id: 'VC-C1-001' };

    expect(validateArticleLibrary([first, second]).findings).toContainEqual(
      expect.objectContaining({ code: 'duplicate.article_id' }),
    );
  });

  it.each([
    ['title', '  startup   funding ANNOUNCEMENT video guide  ', 'duplicate.title'],
    ['primary_keyword', '  STARTUP   funding announcement VIDEO  ', 'duplicate.primary_keyword'],
  ])('normalizes case and whitespace when comparing duplicate %s values', (field, value, code) => {
    const first = validRecord();
    const second = distinctRecord();
    second.frontmatter = { ...second.frontmatter, [field]: value } as ArticleRecord['frontmatter'];

    expect(validateArticleLibrary([first, second]).findings).toContainEqual(
      expect.objectContaining({ code }),
    );
  });

  it('rejects an empty library', () => {
    expect(validateArticleLibrary([])).toMatchObject({
      valid: false,
      totals: { all: 0 },
      findings: expect.arrayContaining([
        expect.objectContaining({ code: 'library.total_count' }),
        expect.objectContaining({ code: 'library.campaign_count' }),
      ]),
    });
  });

  it('rejects a 249-record library', () => {
    const result = validateArticleLibrary(syntheticLibrary().slice(0, 249));

    expect(result.valid).toBe(false);
    expect(result.totals.all).toBe(249);
    expect(result.findings).toContainEqual(expect.objectContaining({ code: 'library.total_count' }));
  });

  it('rejects a 250-record library with skewed campaign totals', () => {
    const records = syntheticLibrary();
    records[249].frontmatter.campaign_id = 'newly-funded-founder';

    expect(validateArticleLibrary(records)).toMatchObject({
      valid: false,
      totals: {
        all: 250,
        byCampaign: {
          'newly-funded-founder': 51,
          'portfolio-media-platform': 49,
        },
      },
      findings: expect.arrayContaining([
        expect.objectContaining({ code: 'library.campaign_count' }),
      ]),
    });
  });

  it('keeps review drafts out of the publishable loader result', () => {
    const articlesRoot = createTestArticlesRoot();
    writeSyntheticLibrary(articlesRoot);
    const priorPublicIndexing = process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
    process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = 'true';

    try {
      expect(getAllArticles(articlesRoot)).toHaveLength(250);
      expect(getPublishableArticles(articlesRoot)).toEqual([]);
    } finally {
      if (priorPublicIndexing === undefined) {
        delete process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
      } else {
        process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = priorPublicIndexing;
      }
    }
  });

  it('validates the complete library before applying the global indexing gate', () => {
    const articlesRoot = createTestArticlesRoot();
    writeSyntheticLibrary(
      articlesRoot,
      250,
      (source, recordIndex) => recordIndex === 0
        ? source.replace('title: Campaign 1 Article 01 Video Guide\n', '')
        : source,
    );
    const priorPublicIndexing = process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
    process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = 'false';

    try {
      expect(() => getPublishableArticles(articlesRoot)).toThrow(/title/i);
    } finally {
      if (priorPublicIndexing === undefined) {
        delete process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
      } else {
        process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = priorPublicIndexing;
      }
    }
  });

  it('fails closed when the filesystem library contains only 249 records', () => {
    const articlesRoot = createTestArticlesRoot();
    writeSyntheticLibrary(articlesRoot, 249);

    expect(() => getAllArticles(articlesRoot)).toThrow(/exactly 250 records; received 249/i);
  });

  it('publishes only an approved record with authenticated keyword and observed Apify evidence', () => {
    const articlesRoot = createTestArticlesRoot();
    writeSyntheticLibrary(articlesRoot, 250, (source, recordIndex) => {
      if (recordIndex !== 0) return source;
      return sourceWithPublishableEvidence(source);
    });
    const priorPublicIndexing = process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
    process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = 'true';

    try {
      expect(getPublishableArticles(articlesRoot).map((record) => record.frontmatter.article_id)).toEqual(['vc-c1-001']);
    } finally {
      if (priorPublicIndexing === undefined) {
        delete process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
      } else {
        process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = priorPublicIndexing;
      }
    }
  });

  it('reports every campaign total for a valid synthetic 250-record library', () => {
    expect(validateArticleLibrary(syntheticLibrary())).toEqual({
      valid: true,
      findings: [],
      totals: {
        all: 250,
        byCampaign: {
          'newly-funded-founder': 50,
          'accelerator-demo-day-founder': 50,
          'video-production-comparison': 50,
          'gtm-content-repurposing-buyer': 50,
          'portfolio-media-platform': 50,
        },
      },
    });
  });
});
