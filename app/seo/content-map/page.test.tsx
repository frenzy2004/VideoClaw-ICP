import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ArticleRecord, CampaignId } from '../../../lib/content/articles';
import { ContentMap } from './content-map';
import { metadata } from './page';

type CampaignFixture = {
  articleId: `vc-c${number}-${number}`;
  campaignId: CampaignId;
  campaignLabel: string;
  funnel: 'top' | 'middle' | 'bottom';
  keyword: string;
  slug: string;
  status: 'draft' | 'review' | 'publishable';
  title: string;
};

const campaignFixtures: CampaignFixture[] = [
  {
    articleId: 'vc-c1-001',
    campaignId: 'newly-funded-founder',
    campaignLabel: 'Newly funded founder',
    funnel: 'top',
    keyword: 'post funding video strategy',
    slug: 'post-funding-video-strategy',
    status: 'draft',
    title: 'Newly Funded Founder Video Content Planning Guide',
  },
  {
    articleId: 'vc-c2-001',
    campaignId: 'accelerator-demo-day-founder',
    campaignLabel: 'Accelerator / Demo Day founder',
    funnel: 'middle',
    keyword: 'demo day video checklist',
    slug: 'demo-day-video-checklist',
    status: 'review',
    title: 'Demo Day Founder Video Content Planning Guide',
  },
  {
    articleId: 'vc-c3-001',
    campaignId: 'video-production-comparison',
    campaignLabel: 'Video production comparison',
    funnel: 'bottom',
    keyword: 'video agency vs ai video',
    slug: 'video-agency-vs-ai-video',
    status: 'publishable',
    title: 'Startup Video Production Comparison Planning Guide',
  },
  {
    articleId: 'vc-c4-001',
    campaignId: 'gtm-content-repurposing-buyer',
    campaignLabel: 'GTM content repurposing buyer',
    funnel: 'top',
    keyword: 'video repurposing workflow',
    slug: 'video-repurposing-workflow',
    status: 'draft',
    title: 'GTM Content Repurposing Buyer Planning Guide',
  },
  {
    articleId: 'vc-c5-001',
    campaignId: 'portfolio-media-platform',
    campaignLabel: 'Portfolio media platform',
    funnel: 'middle',
    keyword: 'portfolio company media system',
    slug: 'portfolio-company-media-system',
    status: 'review',
    title: 'Portfolio Media Platform Operations Planning Guide',
  },
];

const sourceUrl = 'https://www.sba.gov/business-guide/plan-your-business/market-research-competitive-analysis';

function articleFixture(fixture: CampaignFixture): ArticleRecord {
  const indexing = fixture.status === 'publishable' ? 'index' : 'noindex';
  const mediaSrc = `/media/articles/${fixture.campaignId}/${fixture.slug}.svg`;

  return {
    filePath: `content/articles/${fixture.campaignId}/${fixture.slug}.md`,
    frontmatter: {
      schema_version: 1,
      article_id: fixture.articleId,
      campaign_id: fixture.campaignId,
      icp: `${fixture.campaignLabel} in the United States`,
      customer_trigger: 'The team needs a traceable video content decision before its next growth milestone.',
      funnel_stage: fixture.funnel,
      search_intent: fixture.status === 'publishable' ? 'commercial' : 'informational',
      primary_keyword: fixture.keyword,
      secondary_keywords: [`${fixture.keyword} guide`],
      title: fixture.title,
      description: 'Use this evidence-backed operational guide to connect US startup search intent, approved source material, editorial review, and measurable video content decisions.',
      slug: fixture.slug,
      status: fixture.status,
      indexing,
      canonical_path: `/blog/${fixture.slug}`,
      competitor_gap: 'Observed pages do not connect the search job to a source-controlled startup video workflow.',
      keyword_evidence: {
        provider: 'pending',
        country: 'US',
        observed_at: null,
        volume: null,
        difficulty: null,
        cpc: null,
        intent: fixture.status === 'publishable' ? 'commercial' : 'informational',
        validation_status: 'pending_paid_provider',
      },
      serp_evidence: {
        provider: 'apify',
        actor: 'apify/google-search-scraper',
        query: fixture.keyword,
        country: 'US',
        language: 'en',
        observed_at: '2026-09-01',
        run_id: `run-${fixture.articleId}`,
        dataset_id: `dataset-${fixture.articleId}`,
        organic_result_count: 10,
        top_competitors: [{
          position: 1,
          title: 'Market research and competitive analysis',
          url: sourceUrl,
          domain: 'sba.gov',
        }],
        people_also_ask: ['How should a startup plan video content?'],
        related_queries: [`${fixture.keyword} template`],
        autocomplete_suggestions: [fixture.keyword],
        validation_status: 'observed',
      },
      sources: [{
        title: 'Market research and competitive analysis',
        url: sourceUrl,
        publisher: 'U.S. Small Business Administration',
        checked_at: '2026-09-01',
      }],
      media: [{
        type: 'image',
        src: mediaSrc,
        alt: `${fixture.campaignLabel} editorial workflow`,
        caption: 'A source-controlled editorial workflow for the campaign.',
        credit: 'VideoClaw editorial illustration',
        rights: 'owned',
      }],
      cta: {
        label: 'Review the VideoClaw alpha',
        href: '/alpha/download',
      },
      review: {
        seo_checked: fixture.status === 'publishable',
        evidence_checked: fixture.status === 'publishable',
        editorial_checked: fixture.status === 'publishable',
        media_checked: fixture.status === 'publishable',
        checked_at: fixture.status === 'publishable' ? '2026-09-01' : null,
      },
      related_articles: [],
    },
    body: `This operational guide connects the search job to [declared primary evidence](${sourceUrl}) without making an unsupported performance claim.

## Research the decision

Record the customer trigger, evidence, and current alternatives before choosing the article angle.

## Review the source pack

Confirm the claim owner, approved media, editorial decision, and next action before publication.`,
  };
}

const articles = campaignFixtures.map(articleFixture);
const existingAssetPaths = articles.flatMap((article) => article.frontmatter.media.map((media) => media.src));

afterEach(cleanup);

describe('SEO content map', () => {
  it('is always excluded from indexing and following', () => {
    expect(metadata).toMatchObject({
      robots: { index: false, follow: false },
    });
  });

  it('derives inventory totals and QA evidence from the supplied records', () => {
    render(<ContentMap existingAssetPaths={existingAssetPaths} records={articles} />);

    expect(within(screen.getByTestId('content-map-total')).getByText('5')).toBeVisible();
    expect(within(screen.getByTestId('content-map-publishable')).getByText('0')).toBeVisible();
    expect(within(screen.getByTestId('content-map-pending-keywords')).getByText('5')).toBeVisible();
    expect(within(screen.getByTestId('content-map-blockers')).getByText('25')).toBeVisible();

    for (const fixture of campaignFixtures) {
      expect(within(screen.getByTestId(`campaign-total-${fixture.campaignId}`)).getByText('1')).toBeVisible();
      expect(screen.getAllByText(fixture.campaignLabel).length).toBeGreaterThan(0);
    }

    const table = screen.getByRole('table', { name: 'SEO article inventory' });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(screen.getAllByText('Pending paid provider')).toHaveLength(5);

    const firstRow = within(table).getAllByRole('row')[1];
    expect(within(firstRow).getByText('Technical')).toBeVisible();
    expect(within(firstRow).getByText('89%')).toBeVisible();
    expect(within(firstRow).getByText('Attribution')).toBeVisible();
    expect(within(firstRow).getAllByText('100%')).toHaveLength(3);
    expect(within(firstRow).getByText('Evidence')).toBeVisible();
    expect(within(firstRow).getByText('Media')).toBeVisible();
    expect(within(firstRow).getByText('Keyword')).toBeVisible();
    expect(within(firstRow).getByText('33%')).toBeVisible();
    expect(within(firstRow).getByText('Article body must contain at least 600 words.')).toBeVisible();
    expect(within(firstRow).getByText('An authenticated keyword provider is required.')).toBeVisible();
    expect(within(firstRow).getByRole('link', { name: 'Rendered page' })).toHaveAttribute(
      'href',
      '/blog/post-funding-video-strategy',
    );
    expect(within(firstRow).getByRole('link', { name: 'Markdown source' })).toHaveAttribute(
      'href',
      expect.stringContaining('content/articles/newly-funded-founder/post-funding-video-strategy.md'),
    );
    expect(within(firstRow).getByText('content/articles/newly-funded-founder/post-funding-video-strategy.md')).toBeVisible();
  });

  it('filters the real inventory table by campaign, funnel, and status', () => {
    render(<ContentMap existingAssetPaths={existingAssetPaths} records={articles} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Campaign' }), {
      target: { value: 'accelerator-demo-day-founder' },
    });
    expect(within(screen.getByRole('table', { name: 'SEO article inventory' })).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Demo Day Founder Video Content Planning Guide')).toBeVisible();

    fireEvent.change(screen.getByRole('combobox', { name: 'Campaign' }), { target: { value: 'all' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Funnel stage' }), { target: { value: 'top' } });
    expect(within(screen.getByRole('table', { name: 'SEO article inventory' })).getAllByRole('row')).toHaveLength(3);

    fireEvent.change(screen.getByRole('combobox', { name: 'Funnel stage' }), { target: { value: 'all' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), { target: { value: 'publishable' } });
    expect(within(screen.getByRole('table', { name: 'SEO article inventory' })).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Startup Video Production Comparison Planning Guide')).toBeVisible();
  });

  it('shows the complete semantic publication workflow', () => {
    render(<ContentMap existingAssetPaths={existingAssetPaths} records={articles} />);

    const workflow = screen.getByRole('list', { name: 'Content publication workflow' });
    for (const label of [
      'Research signals',
      'Keyword validation',
      'Markdown source',
      'Editorial QA',
      'Rendered page',
      'Sitemap gate',
    ]) {
      expect(within(workflow).getByText(label)).toBeVisible();
    }
  });
});
