import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
canonical_path: /articles/startup-funding-announcement-video
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
const testContentDirectory = join(process.cwd(), 'content', 'articles', '__article-loader-test__');

function validRecord(): ArticleRecord {
  return parseArticleSource(validSource, validPath);
}

function distinctRecord(): ArticleRecord {
  const record = validRecord();
  record.frontmatter = {
    ...record.frontmatter,
    article_id: 'vc-c1-002',
    slug: 'second-funding-announcement-video',
    canonical_path: '/articles/second-funding-announcement-video',
    title: 'Second Startup Funding Announcement Video Guide',
    primary_keyword: 'second startup funding announcement video',
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

afterEach(() => {
  rmSync(testContentDirectory, { recursive: true, force: true });
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

  it('rejects a path whose Markdown filename does not match frontmatter.slug', () => {
    expect(() => parseArticleSource(validSource, 'content/articles/newly-funded-founder/wrong-slug.md')).toThrow(
      /wrong-slug\.md[\s\S]*slug/i,
    );
  });

  it('rejects a canonical path that does not match frontmatter.slug', () => {
    expect(() => parseArticleSource(
      sourceWith({
        '/articles/startup-funding-announcement-video': '/articles/different-slug',
      }),
      validPath,
    )).toThrow(/canonical_path/i);
  });

  it('rejects non-local media sources', () => {
    expect(() => parseArticleSource(
      sourceWith({
        '/media/articles/newly-funded-founder/funding-announcement.svg': 'https://example.com/funding-announcement.svg',
      }),
      validPath,
    )).toThrow(/media.*src/i);
  });

  it.each([
    ['script tags', '<script>alert(1)</script>'],
    ['iframes', '<iframe src="https://example.com"></iframe>'],
    ['event-handler HTML', '<img src="/media/articles/example.svg" onerror="alert(1)">'],
  ])('rejects raw %s in the Markdown body', (_label, unsafeHtml) => {
    expect(() => parseArticleSource(`${validSource}\n${unsafeHtml}`, validPath)).toThrow(/raw HTML/i);
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

  it('keeps review drafts out of the publishable loader result', () => {
    mkdirSync(testContentDirectory, { recursive: true });
    writeFileSync(join(testContentDirectory, 'startup-funding-announcement-video.md'), validSource);
    const priorPublicIndexing = process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
    process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = 'true';

    try {
      expect(getAllArticles()).toHaveLength(1);
      expect(getPublishableArticles()).toEqual([]);
    } finally {
      if (priorPublicIndexing === undefined) {
        delete process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
      } else {
        process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = priorPublicIndexing;
      }
    }
  });

  it('validates the complete library before applying the global indexing gate', () => {
    mkdirSync(testContentDirectory, { recursive: true });
    writeFileSync(
      join(testContentDirectory, 'startup-funding-announcement-video.md'),
      validSource.replace('title: Startup Funding Announcement Video Guide\n', ''),
    );
    const priorPublicIndexing = process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
    process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = 'false';

    try {
      expect(() => getPublishableArticles()).toThrow(/title/i);
    } finally {
      if (priorPublicIndexing === undefined) {
        delete process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
      } else {
        process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = priorPublicIndexing;
      }
    }
  });

  it('reports every campaign total for a valid synthetic 250-record library', () => {
    const records = CAMPAIGN_IDS.flatMap((campaignId, campaignIndex) => (
      Array.from({ length: 50 }, (_, articleIndex) => {
        const record = validRecord();
        const sequence = String(articleIndex + 1).padStart(2, '0');
        const slug = `${campaignId}-article-${sequence}`;

        record.frontmatter = {
          ...record.frontmatter,
          article_id: `vc-c${campaignIndex + 1}-${String(articleIndex + 1).padStart(3, '0')}`,
          campaign_id: campaignId,
          slug,
          canonical_path: `/articles/${slug}`,
          title: `Campaign ${campaignIndex + 1} Article ${sequence} Video Guide`,
          primary_keyword: `${campaignId} video strategy ${sequence}`,
        };
        record.filePath = `content/articles/${campaignId}/${slug}.md`;
        return record;
      })
    ));

    expect(validateArticleLibrary(records)).toEqual({
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
