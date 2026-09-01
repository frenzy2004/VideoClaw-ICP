import { describe, expect, it } from 'vitest';
import type { ArticleRecord } from '../content/articles';
import { auditArticle, isArticlePublishable, type ArticleAudit } from './article-audit';

const longCopy = Array.from({ length: 610 }, (_, index) => `word${index + 1}`).join(' ');

const validDraft: ArticleRecord = {
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
        title: 'Demo Day guidance',
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
  body: `The checklist starts with approved facts and a playback fallback, following [official accelerator guidance](https://www.ycombinator.com/library/6q-how-to-pitch-your-startup).\n\n## Prepare the evidence\n\n${longCopy}\n\n## Test the playback path\n\nUse a second device and a locally available file.`,
};

function articleWith(
  changes: Omit<Partial<ArticleRecord>, 'frontmatter'> & {
    frontmatter?: Partial<ArticleRecord['frontmatter']>;
  } = {},
): ArticleRecord {
  const base = structuredClone(validDraft);
  return {
    ...base,
    ...changes,
    frontmatter: {
      ...base.frontmatter,
      ...changes.frontmatter,
    },
  };
}

const existingImage = () => ({ exists: true, width: 1200, height: 675 });

function approvedArticle(): ArticleRecord {
  return articleWith({
    frontmatter: {
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
  });
}

function findingCodes(
  article: ArticleRecord,
  assetMetadata: (src: string) => boolean | { exists: boolean; width: number | null; height: number | null } = existingImage,
): string[] {
  return auditArticle(article, assetMetadata).blockingFindings.map((finding) => finding.code);
}

describe('VideoClaw editorial QA audit', () => {
  it('gives complete attribution metadata a transparent 100 score', () => {
    expect(auditArticle(validDraft, existingImage).categories.attribution).toMatchObject({
      score: 100,
      passedChecks: 8,
      totalChecks: 8,
    });
  });

  it('blocks a referenced editorial asset that does not exist', () => {
    expect(auditArticle(validDraft, () => false).blockingFindings).toContainEqual(
      expect.objectContaining({ code: 'media.asset_missing' }),
    );
  });

  it('never publishes a draft even when its deterministic audit passes', () => {
    expect(isArticlePublishable(validDraft, auditArticle(validDraft, existingImage), true)).toBe(false);
  });

  it.each([
    ['shorter than 30 characters', 'A'.repeat(29)],
    ['longer than 65 characters', 'A'.repeat(66)],
  ])('blocks a title %s', (_label, title) => {
    expect(findingCodes(articleWith({ frontmatter: { title } }))).toContain('technical.title_length');
  });

  it.each([30, 65])('accepts a title at the inclusive %i-character boundary', (length) => {
    expect(findingCodes(articleWith({ frontmatter: { title: 'A'.repeat(length) } }))).not.toContain('technical.title_length');
  });

  it.each([
    ['shorter than 120 characters', 'A'.repeat(119)],
    ['longer than 170 characters', 'A'.repeat(171)],
  ])('blocks a description %s', (_label, description) => {
    expect(findingCodes(articleWith({ frontmatter: { description } }))).toContain('technical.description_length');
  });

  it.each([120, 170])('accepts a description at the inclusive %i-character boundary', (length) => {
    expect(findingCodes(articleWith({ frontmatter: { description: 'A'.repeat(length) } }))).not.toContain('technical.description_length');
  });

  it('blocks a slug that is not lowercase and hyphenated', () => {
    expect(findingCodes(articleWith({ frontmatter: { slug: 'Demo_Day Video' as never } }))).toContain('technical.slug_format');
  });

  it('blocks an article body with fewer than two H2 headings', () => {
    const body = validDraft.body.replace('## Test the playback path', '### Test the playback path');

    expect(findingCodes(articleWith({ body }))).toContain('technical.h2_count');
  });

  it('blocks an article body with fewer than 600 words', () => {
    const body = 'Opening answer with [a citation](https://example.com).\n\n## First\n\nShort copy.\n\n## Second\n\nMore short copy.';

    expect(findingCodes(articleWith({ body }))).toContain('technical.word_count');
  });

  it('blocks an article body without an external citation link', () => {
    const body = validDraft.body.replace(
      '[official accelerator guidance](https://www.ycombinator.com/library/6q-how-to-pitch-your-startup)',
      'official accelerator guidance',
    );

    expect(findingCodes(articleWith({ body }))).toContain('evidence.external_citation');
  });

  it('does not count H2 headings or external citations inside fenced code', () => {
    const body = `Opening answer without a citation.\n\n${longCopy}\n\n\`\`\`md\n## Fake heading one\n\n## Fake heading two\n\n[Fake citation](https://www.ycombinator.com/library/6q-how-to-pitch-your-startup)\n\`\`\``;

    expect(findingCodes(articleWith({ body }))).toEqual(expect.arrayContaining([
      'technical.h2_count',
      'evidence.external_citation',
      'evidence.source_citation',
    ]));
  });

  it('does not count fenced-code words toward the 600-word requirement', () => {
    const body = `Opening answer with [official guidance](https://www.ycombinator.com/library/6q-how-to-pitch-your-startup).\n\n## First real heading\n\nShort copy.\n\n## Second real heading\n\n\`\`\`text\n${longCopy}\n\`\`\``;

    expect(findingCodes(articleWith({ body }))).toContain('technical.word_count');
  });

  it('does not count an external Markdown image as a citation link', () => {
    const body = `${longCopy}\n\n## First heading\n\nUseful copy.\n\n## Second heading\n\n![Source image](https://www.ycombinator.com/library/6q-how-to-pitch-your-startup)`;

    expect(findingCodes(articleWith({ body }))).toEqual(expect.arrayContaining([
      'evidence.external_citation',
      'evidence.source_citation',
    ]));
  });

  it('blocks media outside the campaign editorial-media directory', () => {
    const media = [{ ...validDraft.frontmatter.media[0], src: '/robots.txt' }];

    expect(findingCodes(articleWith({ frontmatter: { media } }))).toContain('media.local_path');
  });

  it.each(['alt', 'caption', 'credit'] as const)('blocks media with an empty %s', (field) => {
    const media = [{ ...validDraft.frontmatter.media[0], [field]: '   ' }];

    expect(findingCodes(articleWith({ frontmatter: { media } }))).toContain(`media.${field}`);
  });

  it('blocks media without owned rights', () => {
    const media = [{ ...validDraft.frontmatter.media[0], rights: 'licensed' as never }];

    expect(findingCodes(articleWith({ frontmatter: { media } }))).toContain('media.rights');
  });

  it.each([
    ['missing width', { exists: true, width: null, height: 675 }],
    ['missing height', { exists: true, width: 1200, height: null }],
    ['zero width', { exists: true, width: 0, height: 675 }],
  ])('blocks media with %s', (_label, metadata) => {
    expect(findingCodes(validDraft, () => metadata)).toContain('media.dimensions');
  });

  it('reports missing SERP discovery context as a real advisory without blocking publication', () => {
    const serp_evidence = {
      ...validDraft.frontmatter.serp_evidence,
      people_also_ask: [],
      related_queries: [],
      autocomplete_suggestions: [],
    };
    const audit = auditArticle(articleWith({ frontmatter: { serp_evidence } }), existingImage);

    expect(audit.advisoryFindings).toContainEqual(expect.objectContaining({
      code: 'attribution.discovery_context',
    }));
    expect(audit.blockingFindings).not.toContainEqual(expect.objectContaining({
      code: 'attribution.discovery_context',
    }));
  });

  it('blocks pending authenticated keyword metrics', () => {
    expect(findingCodes(validDraft)).toEqual(expect.arrayContaining([
      'keyword.provider_pending',
      'keyword.metrics_pending',
    ]));
  });

  it('publishes a fully approved article with observed Semrush metrics only when global indexing is true', () => {
    const approved = approvedArticle();
    const audit = auditArticle(approved, existingImage);

    expect(audit.blockingFindings).toEqual([]);
    expect(isArticlePublishable(approved, audit, false)).toBe(false);
    expect(isArticlePublishable(approved, audit, true)).toBe(true);
  });

  it('rejects a fabricated empty-blocker audit for an article with pending keyword evidence', () => {
    const pending = articleWith({
      frontmatter: {
        status: 'publishable',
        indexing: 'index',
        review: {
          seo_checked: true,
          evidence_checked: true,
          editorial_checked: true,
          media_checked: true,
          checked_at: '2026-09-01',
        },
      },
    });
    const fabricated = {
      ...auditArticle(pending, existingImage),
      blockingFindings: [],
    } as ArticleAudit;

    expect(isArticlePublishable(pending, fabricated, true)).toBe(false);
  });

  it('rejects an audit produced for another article record', () => {
    const first = approvedArticle();
    const second = approvedArticle();

    expect(isArticlePublishable(second, auditArticle(first, existingImage), true)).toBe(false);
  });

  it('rechecks the current body and Apify evidence instead of trusting a stale audit', () => {
    const approved = approvedArticle();
    const audit = auditArticle(approved, existingImage);
    approved.body = 'Too short and uncited.';
    approved.frontmatter.serp_evidence.run_id = '';

    expect(isArticlePublishable(approved, audit, true)).toBe(false);
  });

  it('rechecks current asset metadata instead of trusting prior availability', () => {
    const approved = approvedArticle();
    let available = true;
    const resolveAsset = () => available
      ? { exists: true, width: 1200, height: 675 }
      : { exists: false, width: null, height: null };
    const audit = auditArticle(approved, resolveAsset);
    available = false;

    expect(isArticlePublishable(approved, audit, true)).toBe(false);
  });
});
