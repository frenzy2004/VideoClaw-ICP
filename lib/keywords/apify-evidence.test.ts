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
});

describe('rankObservedOpportunity', () => {
  it('returns an explainable score made only from observed evidence', () => {
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
      relevance: 3,
      exactTitleMatches: 0,
      articleResults: 4,
      videoOrSocialResults: 3,
      peopleAlsoAskCount: 4,
      relatedQueryCount: 8,
      evidenceScore: 18,
      scoreExplanation: [
        'ICP relevance: 3/3',
        'Exact-title saturation: 0/10',
        'People Also Ask questions: 4',
        'Related queries: 8',
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/volume|difficulty|cpc|traffic|probability/i);
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

    expect(result.relevance).toBe(3);
    expect(result.exactTitleMatches).toBe(2);
    expect(result.evidenceScore).toBe(16);
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
      selectionDecision: 'replaced_empty_primary_with_observed_secondary',
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
