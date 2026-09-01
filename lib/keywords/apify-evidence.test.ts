import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

import {
  normalizeAutocompleteItem,
  normalizeSerpItem,
  rankObservedOpportunity,
  selectBestSerpEvidence,
  selectObservedArticleQuery,
} from './apify-evidence.mjs';
import {
  parseResearchMatrix,
  uniqueResearchQueries,
} from '../../scripts/research/collect-apify-evidence.mjs';
import * as evidenceCollector from '../../scripts/research/collect-apify-evidence.mjs';

describe('normalizeAutocompleteItem', () => {
  it('preserves observable discovery provenance', () => {
    expect(
      normalizeAutocompleteItem({
        keyword: 'demo day video checklist',
        suggestion: 'demo day video checklist template',
        depth: 0,
        parentKeyword: null,
        language: 'en',
        country: 'us',
        scrapedAt: '2026-09-01T04:49:48.610Z',
      }),
    ).toEqual({
      keyword: 'demo day video checklist',
      suggestion: 'demo day video checklist template',
      parentKeyword: null,
      depth: 0,
      country: 'US',
      language: 'en',
      scrapedAt: '2026-09-01T04:49:48.610Z',
    });
  });

  it('rejects incomplete or non-US observations', () => {
    expect(() =>
      normalizeAutocompleteItem({
        keyword: 'demo day video',
        suggestion: '',
        country: 'us',
        language: 'en',
        scrapedAt: '2026-09-01T00:00:00.000Z',
      }),
    ).toThrow(/suggestion/i);

    expect(() =>
      normalizeAutocompleteItem({
        keyword: 'demo day video',
        suggestion: 'demo day video checklist',
        country: 'gb',
        language: 'en',
        scrapedAt: '2026-09-01T00:00:00.000Z',
      }),
    ).toThrow(/US/i);
  });

  it('rejects observations outside the exact English locale', () => {
    expect(() =>
      normalizeAutocompleteItem({
        keyword: 'demo day video',
        suggestion: 'vidéo du demo day',
        country: 'us',
        language: 'fr',
        scrapedAt: '2026-09-01T00:00:00.000Z',
      }),
    ).toThrow(/English/i);
  });
});

describe('normalizeSerpItem', () => {
  const provenance = {
    actorId: 'apify/google-search-scraper',
    runId: 'run-123',
    datasetId: 'dataset-456',
    observedAt: '2026-09-01T05:00:00.000Z',
  };

  it('preserves first-page competitors, questions, related queries and run provenance', () => {
    const result = normalizeSerpItem(
      {
        searchQuery: {
          term: 'backup product demo video',
          device: 'DESKTOP',
          page: 1,
          countryCode: 'US',
          languageCode: 'en',
        },
        organicResults: [
          {
            position: 1,
            title: 'How to Make a Backup Product Demo Video',
            url: 'https://example.com/guides/backup-demo',
            description: 'A practical guide.',
            type: 'organic',
          },
          {
            position: 2,
            title: 'Founder demo recording',
            url: 'https://www.youtube.com/watch?v=123',
            description: 'A recording.',
            type: 'organic',
          },
        ],
        peopleAlsoAsk: [
          { question: 'How long should a product demo be?' },
          { question: 'How do you record a product demo?' },
        ],
        relatedQueries: [
          { title: 'demo day product video' },
          { title: 'demo day product video' },
          { title: 'startup demo video' },
        ],
      },
      provenance,
    );

    expect(result).toEqual({
      query: 'backup product demo video',
      country: 'US',
      language: 'en',
      device: 'DESKTOP',
      page: 1,
      observedAt: '2026-09-01T05:00:00.000Z',
      actorId: 'apify/google-search-scraper',
      runId: 'run-123',
      datasetId: 'dataset-456',
      organicResults: [
        {
          position: 1,
          title: 'How to Make a Backup Product Demo Video',
          url: 'https://example.com/guides/backup-demo',
          domain: 'example.com',
          snippet: 'A practical guide.',
          resultType: 'article',
        },
        {
          position: 2,
          title: 'Founder demo recording',
          url: 'https://www.youtube.com/watch?v=123',
          domain: 'youtube.com',
          snippet: 'A recording.',
          resultType: 'video_or_social',
        },
      ],
      peopleAlsoAsk: [
        'How long should a product demo be?',
        'How do you record a product demo?',
      ],
      relatedQueries: ['demo day product video', 'startup demo video'],
    });
  });

  it('rejects wrong locale, later pages and missing provenance', () => {
    const base = {
      searchQuery: {
        term: 'demo day video',
        device: 'DESKTOP',
        page: 1,
        countryCode: 'US',
        languageCode: 'en',
      },
      organicResults: [],
      peopleAlsoAsk: [],
      relatedQueries: [],
    };

    expect(() =>
      normalizeSerpItem(
        { ...base, searchQuery: { ...base.searchQuery, countryCode: 'GB' } },
        provenance,
      ),
    ).toThrow(/US/i);
    expect(() =>
      normalizeSerpItem(
        { ...base, searchQuery: { ...base.searchQuery, page: 2 } },
        provenance,
      ),
    ).toThrow(/first page/i);
    expect(() => normalizeSerpItem(base, { ...provenance, runId: '' })).toThrow(/runId/i);
  });

  it('rejects first-page US observations outside the exact English locale', () => {
    expect(() =>
      normalizeSerpItem(
        {
          searchQuery: {
            term: 'vidéo du demo day',
            device: 'DESKTOP',
            page: 1,
            countryCode: 'US',
            languageCode: 'fr',
          },
          organicResults: [],
          peopleAlsoAsk: [],
          relatedQueries: [],
        },
        provenance,
      ),
    ).toThrow(/English/i);
  });
});

describe('rankObservedOpportunity', () => {
  it('keeps editorial relevance pending and scores only observed evidence', () => {
    const result = rankObservedOpportunity({
      query: 'backup product demo video',
      relevance: 3,
      organicResults: [
        ...Array.from({ length: 4 }, (_, index) => ({
          position: index + 1,
          title: `Practical product guide ${index + 1}`,
          url: `https://example${index + 1}.com/guides/product-demo`,
          domain: `example${index + 1}.com`,
          snippet: 'Guide',
          resultType: 'article',
        })),
        ...Array.from({ length: 3 }, (_, index) => ({
          position: index + 5,
          title: `Product demo recording ${index + 1}`,
          url: `https://youtube.com/watch?v=${index + 1}`,
          domain: 'youtube.com',
          snippet: 'Video',
          resultType: 'video_or_social',
        })),
      ],
      peopleAlsoAsk: ['q1', 'q2', 'q3', 'q4'],
      relatedQueries: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'],
    });

    expect(result).toEqual({
      query: 'backup product demo video',
      relevance: null,
      relevanceStatus: 'pending_editorial_intent_review',
      exactTitleMatches: 0,
      articleResults: 4,
      videoOrSocialResults: 3,
      peopleAlsoAskCount: 4,
      relatedQueryCount: 8,
      evidenceScore: 12,
      scoreExplanation: [
        'Editorial ICP relevance: pending review and excluded from evidence score',
        'Exact-title saturation: 0/10',
        'People Also Ask questions: 4',
        'Related queries: 8',
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/volume|difficulty|cpc|traffic|probability/i);
  });

  it('records an explicit MVP intent approval without adding it to evidence score', () => {
    const result = rankObservedOpportunity({
      query: 'startup pitch video',
      intentReview: {
        status: 'approved_for_mvp_draft',
        rationale: 'The retained primary SERP contains startup investor-pitch video results.',
      },
      organicResults: [],
      peopleAlsoAsk: ['How do you make a startup pitch video?'],
      relatedQueries: ['startup pitch examples'],
    });

    expect(result.relevance).toBeNull();
    expect(result.relevanceStatus).toBe('approved_for_mvp_draft');
    expect(result.evidenceScore).toBe(2);
    expect(result.scoreExplanation[0]).toBe(
      'Editorial ICP relevance: approved for MVP draft and excluded from evidence score',
    );
  });

  it('penalizes exact-title saturation and caps observable components', () => {
    const result = rankObservedOpportunity({
      query: 'demo day checklist',
      relevance: 5,
      organicResults: Array.from({ length: 12 }, (_, index) => ({
        position: index + 1,
        title: index < 2 ? 'Demo Day Checklist' : `Result ${index + 1}`,
        url: `https://example.com/${index + 1}`,
        domain: 'example.com',
        snippet: '',
        resultType: 'article',
      })),
      peopleAlsoAsk: Array.from({ length: 10 }, (_, index) => `q${index}`),
      relatedQueries: Array.from({ length: 20 }, (_, index) => `r${index}`),
    });

    expect(result.relevance).toBeNull();
    expect(result.relevanceStatus).toBe('pending_editorial_intent_review');
    expect(result.exactTitleMatches).toBe(2);
    expect(result.evidenceScore).toBe(10);
  });
});

describe('custom Apify run and dataset provenance', () => {
  it('exports the run/dataset verifier used by resumed collections', () => {
    expect(evidenceCollector.resolveVerifiedDatasetIds).toBeTypeOf('function');
  });

  it('accepts only dataset IDs that match each fetched run default', () => {
    const runs = [
      { id: 'run-a', defaultDatasetId: 'dataset-a' },
      { id: 'run-b', defaultDatasetId: 'dataset-b' },
    ];

    expect(
      evidenceCollector.resolveVerifiedDatasetIds(
        runs,
        ['dataset-a', 'dataset-b'],
        'SERP',
      ),
    ).toEqual(['dataset-a', 'dataset-b']);
    expect(() =>
      evidenceCollector.resolveVerifiedDatasetIds(
        runs,
        ['dataset-b', 'dataset-a'],
        'SERP',
      ),
    ).toThrow(/run-a.*dataset-a.*dataset-b/i);
  });
});

describe('manual MVP intent review bindings', () => {
  const reviewedSelection = {
    selectedKeyword: 'startup pitch video',
    selectionDecision: 'retained_observed_primary',
    evidence: {
      runId: 'QdXE07LmRf56skYbB',
      datasetId: 'rkFwIATnDdNq1XmUe',
      organicResults: [{ title: 'Startup pitch video examples' }],
    },
  };

  it('approves only the exact reviewed article, keyword, run and dataset tuple', () => {
    expect(
      evidenceCollector.intentReviewForSelection('vc-c2-006', reviewedSelection),
    ).toEqual({
      status: 'approved_for_mvp_draft',
      rationale:
        'The retained primary SERP contains startup investor-pitch video examples and founder discussions, matching the startup pitch-video intent.',
      binding: {
        articleId: 'vc-c2-006',
        selectedKeyword: 'startup pitch video',
        runId: 'QdXE07LmRf56skYbB',
        datasetId: 'rkFwIATnDdNq1XmUe',
      },
    });
  });

  it('returns to pending when the selected keyword is stale', () => {
    expect(
      evidenceCollector.intentReviewForSelection('vc-c2-006', {
        ...reviewedSelection,
        selectedKeyword: 'startup founder pitch video',
      }).status,
    ).toBe('pending_editorial_intent_review');
  });

  it('returns to pending when the reviewed run is stale', () => {
    expect(
      evidenceCollector.intentReviewForSelection('vc-c2-006', {
        ...reviewedSelection,
        evidence: { ...reviewedSelection.evidence, runId: 'new-serp-run' },
      }).status,
    ).toBe('pending_editorial_intent_review');
  });

  it('returns to pending when the reviewed dataset is stale', () => {
    expect(
      evidenceCollector.intentReviewForSelection('vc-c2-006', {
        ...reviewedSelection,
        evidence: { ...reviewedSelection.evidence, datasetId: 'new-serp-dataset' },
      }).status,
    ).toBe('pending_editorial_intent_review');
  });
});

describe('research matrix extraction', () => {
  it.each([
    'newly-funded-founder-article-matrix.md',
    'accelerator-demo-day-founder-article-matrix.md',
    'video-production-comparison-article-matrix.md',
    'gtm-content-repurposing-buyer-article-matrix.md',
    'portfolio-media-platform-article-matrix.md',
  ])('extracts 50 articles and a 100–200 query pool from %s', async (filename) => {
    const markdown = await readFile(`docs/research/campaigns/${filename}`, 'utf8');
    const articles = parseResearchMatrix(markdown);
    const queries = uniqueResearchQueries(articles);

    expect(articles).toHaveLength(50);
    expect(new Set(articles.map(({ articleId }) => articleId))).toHaveLength(50);
    expect(articles.every(({ primary }) => !primary.includes('`'))).toBe(true);
    expect(queries.length).toBeGreaterThanOrEqual(100);
    expect(queries.length).toBeLessThanOrEqual(200);
    expect(new Set(queries.map((query) => query.toLocaleLowerCase('en-US'))).size).toBe(
      queries.length,
    );
  });
});

describe('selectBestSerpEvidence', () => {
  it('prefers a successful retry over an empty observation', () => {
    const empty = {
      query: 'demo day video checklist',
      observedAt: '2026-09-01T05:00:00.000Z',
      runId: 'first-run',
      organicResults: [],
    };
    const retry = {
      query: 'Demo Day Video Checklist',
      observedAt: '2026-09-01T05:05:00.000Z',
      runId: 'retry-run',
      organicResults: [{ title: 'Observed result' }],
    };

    expect(selectBestSerpEvidence([empty, retry], 'demo day video checklist')).toBe(retry);
    expect(selectBestSerpEvidence([empty], 'unobserved query')).toBeUndefined();
  });
});

describe('selectObservedArticleQuery', () => {
  it('replaces an empty primary with the strongest observed secondary', () => {
    const records = [
      {
        query: 'broad primary',
        observedAt: '2026-09-01T05:00:00.000Z',
        organicResults: [],
        peopleAlsoAsk: [],
        relatedQueries: [],
      },
      {
        query: 'specific secondary',
        observedAt: '2026-09-01T05:01:00.000Z',
        organicResults: [{ title: 'Useful result', resultType: 'article' }],
        peopleAlsoAsk: ['question'],
        relatedQueries: ['related'],
      },
    ];

    expect(
      selectObservedArticleQuery(['broad primary', 'specific secondary'], records),
    ).toEqual({
      matrixPrimaryKeyword: 'broad primary',
      selectedKeyword: 'specific secondary',
      selectionDecision:
        'replaced_empty_primary_with_serp_observed_secondary_pending_intent_review',
      evidence: records[1],
    });
  });

  it('keeps an observed primary and fails when no candidate has organic evidence', () => {
    const observed = {
      query: 'observed primary',
      observedAt: '2026-09-01T05:00:00.000Z',
      organicResults: [{ title: 'Result', resultType: 'article' }],
      peopleAlsoAsk: [],
      relatedQueries: [],
    };

    expect(selectObservedArticleQuery(['observed primary', 'secondary'], [observed])).toEqual(
      expect.objectContaining({
        selectedKeyword: 'observed primary',
        selectionDecision: 'retained_observed_primary',
      }),
    );
    expect(
      selectObservedArticleQuery(
        ['empty primary', 'empty secondary'],
        [
          {
            query: 'empty primary',
            organicResults: [],
            peopleAlsoAsk: [],
            relatedQueries: [],
          },
        ],
      ),
    ).toBeUndefined();
  });
});

describe('committed SERP-observed research shortlist', () => {
  it('keeps demand metrics pending and limits editorial approval to ten reviewed MVP drafts', async () => {
    const campaignFiles = [
      'newly-funded-founder.json',
      'accelerator-demo-day-founder.json',
      'video-production-comparison.json',
      'gtm-content-repurposing-buyer.json',
      'portfolio-media-platform.json',
    ];
    const datasets = await Promise.all(
      campaignFiles.map(async (filename) =>
        JSON.parse(await readFile(`data/research/apify/${filename}`, 'utf8')),
      ),
    );
    const selected = datasets.flatMap((dataset) => dataset.selection.selected);
    const approvedIds = selected
      .filter(({ intentReview }) => intentReview.status === 'approved_for_mvp_draft')
      .map(({ articleId }) => articleId)
      .sort();
    const approved = selected.filter(
      ({ intentReview }) => intentReview.status === 'approved_for_mvp_draft',
    );

    expect(datasets.every(({ state }) => state === 'serp_observed_research_shortlist')).toBe(true);
    expect(selected).toHaveLength(250);
    expect(approvedIds).toEqual([
      'vc-c2-001',
      'vc-c2-003',
      'vc-c2-006',
      'vc-c2-007',
      'vc-c2-008',
      'vc-c2-009',
      'vc-c2-013',
      'vc-c2-021',
      'vc-c2-026',
      'vc-c2-027',
    ]);
    expect(
      approved.every(({ articleId, primaryKeyword, evidence, intentReview }) =>
        intentReview.binding.articleId === articleId
        && intentReview.binding.selectedKeyword === primaryKeyword
        && intentReview.binding.runId === evidence.runId
        && intentReview.binding.datasetId === evidence.datasetId,
      ),
    ).toBe(true);
    expect(
      selected.filter(
        ({ intentReview }) => intentReview.status === 'pending_editorial_intent_review',
      ),
    ).toHaveLength(240);
    expect(
      selected.every(
        ({ metricValidation, score, intentReview }) =>
          metricValidation.provider === 'pending'
          && metricValidation.volume === null
          && metricValidation.difficulty === null
          && metricValidation.cpc === null
          && score.relevance === null
          && !score.scoreExplanation.some((line: string) => /\d\/3/.test(line))
          && typeof intentReview.rationale === 'string'
          && intentReview.rationale.length > 20,
      ),
    ).toBe(true);
  });
});
