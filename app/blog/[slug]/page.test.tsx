import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArticleRecord } from '../../../lib/content/articles';
import ArticlePage, { generateMetadata, generateStaticParams } from './page';

vi.mock('../../../lib/content/articles', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/content/articles')>('../../../lib/content/articles');

  return {
    ...actual,
    getAllArticles: vi.fn(),
    getArticleBySlug: vi.fn(),
  };
});

import { getAllArticles, getArticleBySlug } from '../../../lib/content/articles';

const draftArticle: ArticleRecord = {
  filePath: 'content/articles/accelerator-demo-day-founder/demo-day-video-checklist.md',
  frontmatter: {
    schema_version: 1,
    article_id: 'vc-c2-001',
    campaign_id: 'accelerator-demo-day-founder',
    icp: 'US accelerator founder preparing for Demo Day',
    customer_trigger: 'Demo Day is approaching and the product demo needs a backup',
    funnel_stage: 'top',
    search_intent: 'informational',
    primary_keyword: 'demo day video checklist',
    secondary_keywords: ['startup demo video', 'demo day product demo'],
    title: 'Demo Day Video Checklist for Startup Founders',
    description: 'Use this practical Demo Day video checklist to prepare approved product proof, playback backups, captions, and follow-up clips before presenting.',
    slug: 'demo-day-video-checklist',
    status: 'draft',
    indexing: 'noindex',
    canonical_path: '/blog/demo-day-video-checklist',
    competitor_gap: 'Observed results discuss pitch preparation but do not combine source control, playback fallback, and reuse planning.',
    keyword_evidence: {
      provider: 'pending',
      country: 'US',
      observed_at: null,
      volume: null,
      difficulty: null,
      cpc: null,
      intent: 'informational',
      validation_status: 'pending_paid_provider',
    },
    serp_evidence: {
      provider: 'apify',
      actor: 'apify/google-search-scraper',
      query: 'demo day video checklist',
      country: 'US',
      language: 'en',
      observed_at: '2026-09-01',
      run_id: 'test-run-id',
      dataset_id: 'test-dataset-id',
      organic_result_count: 10,
      top_competitors: [{
        position: 1,
        title: 'How to pitch your startup',
        url: 'https://www.ycombinator.com/library/6q-how-to-pitch-your-startup',
        domain: 'ycombinator.com',
      }],
      people_also_ask: ['How do you prepare for Demo Day?'],
      related_queries: ['startup demo day checklist'],
      autocomplete_suggestions: ['demo day video'],
      validation_status: 'observed',
    },
    sources: [{
      title: 'How to pitch your startup',
      url: 'https://www.ycombinator.com/library/6q-how-to-pitch-your-startup',
      publisher: 'Y Combinator',
      checked_at: '2026-09-01',
    }],
    media: [{
      type: 'image',
      src: '/media/articles/accelerator-demo-day-founder/demo-day-video-checklist.svg',
      alt: 'Demo Day video preparation sequence',
      caption: 'A source-controlled sequence for preparing Demo Day video assets.',
      credit: 'VideoClaw editorial illustration',
      rights: 'owned',
    }],
    cta: {
      label: 'Prepare your source pack',
      href: '/alpha/download',
    },
    review: {
      seo_checked: false,
      evidence_checked: false,
      editorial_checked: false,
      media_checked: false,
      checked_at: null,
    },
    related_articles: [],
  },
  body: `A source-controlled checklist keeps claims, product proof, and playback fallbacks aligned with [official accelerator guidance](https://www.ycombinator.com/library/6q-how-to-pitch-your-startup).

## Prepare the evidence

- Confirm every visible claim.
- Keep one local playback fallback.

## Review the handoff

| Control | Owner |
| --- | --- |
| Claim approval | Founder |
| Playback check | Operator |

Use \`approved-source-pack\` as the final handoff state.

![Demo Day video preparation sequence](/media/articles/accelerator-demo-day-founder/demo-day-video-checklist.svg)`,
};

const publishableArticle: ArticleRecord = {
  ...draftArticle,
  frontmatter: {
    ...draftArticle.frontmatter,
    status: 'publishable',
    indexing: 'index',
    keyword_evidence: {
      provider: 'semrush',
      country: 'US',
      observed_at: '2026-09-01',
      volume: 90,
      difficulty: 31,
      cpc: 4.2,
      intent: 'informational',
      validation_status: 'validated',
    },
    review: {
      seo_checked: true,
      evidence_checked: true,
      editorial_checked: true,
      media_checked: true,
      checked_at: '2026-09-01',
    },
  },
  body: `A source-controlled checklist follows [official accelerator guidance](https://www.ycombinator.com/library/6q-how-to-pitch-your-startup).

## Prepare the evidence

${Array.from({ length: 610 }, (_, index) => `evidence${index + 1}`).join(' ')}

## Test the playback path

Use approved source material and a local playback fallback.`,
};

describe('Markdown article route', () => {
  let fixtureRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'videoclaw-task3-'));
    const fixtureAsset = join(fixtureRoot, 'public', draftArticle.frontmatter.media[0].src.slice(1));
    mkdirSync(dirname(fixtureAsset), { recursive: true });
    writeFileSync(fixtureAsset, 'owned test fixture');
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(fixtureRoot);
    vi.mocked(getAllArticles).mockReturnValue([draftArticle]);
    vi.mocked(getArticleBySlug).mockImplementation((slug) => (
      slug === draftArticle.frontmatter.slug ? draftArticle : undefined
    ));
    delete process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
  });

  afterEach(() => {
    cleanup();
    cwdSpy.mockRestore();
    rmSync(fixtureRoot, { recursive: true, force: true });
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING;
  });

  it('renders canonical Markdown as an editorial article with readable attribution', async () => {
    const page = await ArticlePage({ params: Promise.resolve({ slug: draftArticle.frontmatter.slug }) });
    const { container } = render(page);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: draftArticle.frontmatter.title })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Prepare the evidence' })).toBeVisible();
    expect(screen.getByText('Confirm every visible claim.')).toBeVisible();

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Control' })).toBeVisible();
    expect(within(table).getByRole('cell', { name: 'Founder' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'official accelerator guidance' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(screen.getByText('approved-source-pack')).toBeVisible();

    const attribution = screen.getByRole('complementary', { name: 'Article provenance and editorial QA' });
    expect(within(attribution).getByText('accelerator-demo-day-founder')).toBeVisible();
    expect(within(attribution).getByText(draftArticle.frontmatter.icp)).toBeVisible();
    expect(within(attribution).getByText(draftArticle.frontmatter.customer_trigger)).toBeVisible();
    expect(within(attribution).getByText('Top of funnel')).toBeVisible();
    expect(within(attribution).getByText(draftArticle.frontmatter.primary_keyword)).toBeVisible();
    expect(within(attribution).getByText(draftArticle.frontmatter.competitor_gap)).toBeVisible();
    expect(within(attribution).getByText(/Observed 2026-09-01/i)).toBeVisible();
    expect(within(attribution).getByText(/VideoClaw editorial QA/i)).toBeVisible();
    expect(within(attribution).getByText(/Pending paid provider/i)).toBeVisible();

    for (const sourceLink of screen.getAllByRole('link', { name: 'How to pitch your startup' })) {
      expect(sourceLink).toHaveAttribute(
        'href',
        'https://www.ycombinator.com/library/6q-how-to-pitch-your-startup',
      );
    }
    expect(screen.getByText(draftArticle.frontmatter.media[0].caption)).toBeVisible();
    expect(screen.getByText(/Owned · VideoClaw editorial illustration/i)).toBeVisible();
    expect(screen.getByRole('link', { name: draftArticle.frontmatter.cta.label })).toHaveAttribute(
      'href',
      draftArticle.frontmatter.cta.href,
    );
    expect(container.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
  });

  it('generates one static slug per literal article record', async () => {
    await expect(generateStaticParams()).resolves.toEqual([{ slug: 'demo-day-video-checklist' }]);
  });

  it('keeps pending drafts noindex without emitting a canonical', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: draftArticle.frontmatter.slug }),
    });

    expect(metadata).toMatchObject({
      title: draftArticle.frontmatter.title,
      description: draftArticle.frontmatter.description,
      robots: { index: false, follow: false },
    });
    expect(metadata.alternates).toBeUndefined();
  });

  it('emits absolute metadata and Article JSON-LD for a fully publishable article', async () => {
    vi.mocked(getArticleBySlug).mockReturnValue(publishableArticle);
    process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING = 'true';

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: publishableArticle.frontmatter.slug }),
    });
    expect(metadata).toMatchObject({
      robots: { index: true, follow: true },
      alternates: { canonical: 'https://videoclaw.com/blog/demo-day-video-checklist' },
      openGraph: { url: 'https://videoclaw.com/blog/demo-day-video-checklist' },
    });

    const page = await ArticlePage({ params: Promise.resolve({ slug: publishableArticle.frontmatter.slug }) });
    const { container } = render(page);
    const jsonLdElement = container.querySelector('script[type="application/ld+json"]');
    expect(jsonLdElement).not.toBeNull();

    const jsonLd = JSON.parse(jsonLdElement?.textContent ?? '{}');
    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: publishableArticle.frontmatter.title,
      description: publishableArticle.frontmatter.description,
      mainEntityOfPage: 'https://videoclaw.com/blog/demo-day-video-checklist',
      author: { '@type': 'Organization', name: 'VideoClaw' },
      publisher: { '@type': 'Organization', name: 'VideoClaw', url: 'https://videoclaw.com/' },
    });
    expect(jsonLd).not.toHaveProperty('image');
    expect(jsonLd).not.toHaveProperty('datePublished');
    expect(jsonLd).not.toHaveProperty('dateModified');
    expect(jsonLd.author).not.toHaveProperty('url');
  });

  it('keeps a publishable record fail-closed when the global indexing flag is off', async () => {
    vi.mocked(getArticleBySlug).mockReturnValue(publishableArticle);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: publishableArticle.frontmatter.slug }),
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).not.toHaveProperty('url');

    const page = await ArticlePage({ params: Promise.resolve({ slug: publishableArticle.frontmatter.slug }) });
    const { container } = render(page);
    expect(container.querySelector('script[type="application/ld+json"]')).not.toBeInTheDocument();
    expect(screen.getByText('EDITORIAL REVIEW · NOINDEX')).toBeVisible();
  });

  it('uses only the article-specific frontmatter CTA copy', async () => {
    const page = await ArticlePage({ params: Promise.resolve({ slug: draftArticle.frontmatter.slug }) });
    render(page);

    expect(screen.getByRole('link', { name: draftArticle.frontmatter.cta.label })).toBeVisible();
    expect(screen.queryByRole('heading', {
      name: 'Turn approved source material into a repeatable video workflow.',
    })).not.toBeInTheDocument();
  });

  it('uses the Next not-found boundary for an unknown slug', async () => {
    await expect(ArticlePage({ params: Promise.resolve({ slug: 'missing-article' }) })).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
  });

  it('does not render unsafe Markdown image protocols as media', async () => {
    vi.mocked(getArticleBySlug).mockReturnValue({
      ...draftArticle,
      body: '## Evidence\n\n![Unsafe](https://example.com/tracker.png)',
    });

    const page = await ArticlePage({ params: Promise.resolve({ slug: draftArticle.frontmatter.slug }) });
    const { container } = render(page);

    expect(container.querySelector('img[src="https://example.com/tracker.png"]')).not.toBeInTheDocument();
    expect(screen.getByText('Unsafe media path omitted.')).toBeVisible();
  });

  it('keeps raw HTML inert and rejects unsafe Markdown link protocols', async () => {
    vi.mocked(getArticleBySlug).mockReturnValue({
      ...draftArticle,
      body: '## Evidence\n\n<script>window.pwned = true</script>\n\n[Unsafe action](javascript:alert(1))',
    });

    const page = await ArticlePage({ params: Promise.resolve({ slug: draftArticle.frontmatter.slug }) });
    const { container } = render(page);

    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="javascript:"]')).not.toBeInTheDocument();
    expect(screen.getByText('Unsafe action')).toHaveClass('article-unsafe-link');
  });
});
