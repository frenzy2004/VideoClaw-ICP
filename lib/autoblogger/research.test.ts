import { describe, expect, it } from 'vitest';

import { CandidateSchema, EvidenceBundleSchema, type Candidate } from './domain';
import {
  AUTOCOMPLETE_ACTOR_ID,
  SERP_ACTOR_ID,
  createResearcher,
  runApifyActor,
  selectRelevantPaaQuestions,
} from './research';
import type { ApifyClient, ApifyRun } from './apify-client';

function candidates(count: number): Candidate[] {
  return Array.from({ length: count }, (_, index) => CandidateSchema.parse({
    schemaVersion: 1,
    articleId: `vc-c1-${String(index + 1).padStart(3, '0')}`,
    campaignId: 'newly-funded-founder',
    icp: 'newly-funded-founder',
    primaryKeyword: `founder video topic ${index + 1}`,
    secondaryKeywords: [],
    title: `Founder video topic ${index + 1}`,
    slug: `founder-video-topic-${index + 1}`,
    intent: 'informational',
    funnelStage: 'top',
  }));
}

function successfulRun(id: string, datasetId: string): ApifyRun {
  return {
    id,
    status: 'SUCCEEDED',
    defaultDatasetId: datasetId,
    finishedAt: '2026-09-04T08:01:00.000Z',
  };
}

function delayed<T>(milliseconds: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), milliseconds));
}

describe('bounded Apify execution', () => {
  it('times out a hanging startActor dependency', async () => {
    const client: ApifyClient = {
      startActor: async () => delayed(25, successfulRun('run-123', 'dataset-456')),
      getRun: async () => { throw new Error('not used'); },
      getDatasetItems: async () => [],
    };

    await expect(runApifyActor(client, SERP_ACTOR_ID, {}, {
      timeoutMs: 5,
      maxAttempts: 1,
    })).rejects.toThrow(/timed out.*start/i);
  });

  it('times out a hanging getRun poll dependency', async () => {
    const client: ApifyClient = {
      startActor: async () => ({ id: 'run-123', status: 'RUNNING' }),
      getRun: async () => delayed(25, successfulRun('run-123', 'dataset-456')),
      getDatasetItems: async () => [],
    };

    await expect(runApifyActor(client, SERP_ACTOR_ID, {}, {
      timeoutMs: 5,
      maxAttempts: 1,
      pollIntervalMs: 0,
      sleep: async () => undefined,
    })).rejects.toThrow(/timed out.*poll/i);
  });

  it('times out a hanging polling sleep dependency', async () => {
    const client: ApifyClient = {
      startActor: async () => ({ id: 'run-123', status: 'RUNNING' }),
      getRun: async () => successfulRun('run-123', 'dataset-456'),
      getDatasetItems: async () => [],
    };

    await expect(runApifyActor(client, SERP_ACTOR_ID, {}, {
      timeoutMs: 5,
      maxAttempts: 1,
      pollIntervalMs: 1,
      sleep: async () => delayed(25, undefined),
    })).rejects.toThrow(/timed out.*sleep/i);
  });

  it('times out a hanging dataset dependency', async () => {
    const client: ApifyClient = {
      startActor: async () => successfulRun('run-123', 'dataset-456'),
      getRun: async () => { throw new Error('not used'); },
      getDatasetItems: async () => delayed(25, []),
    };

    await expect(runApifyActor(client, SERP_ACTOR_ID, {}, {
      timeoutMs: 5,
      maxAttempts: 1,
    })).rejects.toThrow(/timed out.*dataset/i);
  });

  it('bounds polling, retries transient reads, and preserves exact run/dataset provenance', async () => {
    let pollAttempts = 0;
    let elapsed = 0;
    const client: ApifyClient = {
      startActor: async () => ({ id: 'run-123', status: 'RUNNING' }),
      getRun: async () => {
        pollAttempts += 1;
        if (pollAttempts === 1) throw new Error('temporary read failure');
        if (pollAttempts === 2) return { id: 'run-123', status: 'RUNNING' };
        return successfulRun('run-123', 'dataset-456');
      },
      getDatasetItems: async () => [{ observed: true }],
    };

    const result = await runApifyActor(client, SERP_ACTOR_ID, { queries: 'topic\n' }, {
      maxPolls: 3,
      maxAttempts: 2,
      pollIntervalMs: 10,
      timeoutMs: 100,
      nowMs: () => elapsed,
      sleep: async (milliseconds) => { elapsed += milliseconds; },
    });

    expect(pollAttempts).toBe(3);
    expect(result).toEqual({
      items: [{ observed: true }],
      provenance: {
        actorId: SERP_ACTOR_ID,
        runId: 'run-123',
        datasetId: 'dataset-456',
        observedAt: '2026-09-04T08:01:00.000Z',
      },
    });
  });

  it('stops at the polling bound and redacts recognizable tokens', async () => {
    let elapsed = 0;
    const client: ApifyClient = {
      startActor: async () => ({ id: 'run-secret', status: 'RUNNING' }),
      getRun: async () => ({ id: 'run-secret', status: 'RUNNING' }),
      getDatasetItems: async () => [],
    };

    await expect(runApifyActor(client, AUTOCOMPLETE_ACTOR_ID, {}, {
      maxPolls: 2,
      maxAttempts: 1,
      pollIntervalMs: 10,
      timeoutMs: 100,
      nowMs: () => elapsed,
      sleep: async (milliseconds) => { elapsed += milliseconds; },
    })).rejects.toThrow(/polling limit/i);

    const failingClient: ApifyClient = {
      ...client,
      startActor: async () => {
        throw new Error(`failed with ${['apify', 'api', 'fake', 'private'].join('_')}`);
      },
    };
    await expect(runApifyActor(failingClient, AUTOCOMPLETE_ACTOR_ID, {}))
      .rejects.toThrow(/\[REDACTED\]/);
  });
});

describe('staged researcher', () => {
  it('scans at most 50 and directly stages at most 10 US/en desktop first-page inspections', async () => {
    const starts: Array<{ actorId: string; input: Record<string, unknown> }> = [];
    const autocompleteItems = candidates(50).map((candidate) => ({
      keyword: candidate.primaryKeyword,
      suggestion: `${candidate.primaryKeyword} guide`,
      parentKeyword: null,
      depth: 0,
      country: 'us',
      language: 'en',
      scrapedAt: '2026-09-04T08:00:00.000Z',
    }));
    const serpItems = candidates(10).map((candidate, index) => ({
      searchQuery: {
        term: candidate.primaryKeyword,
        device: 'DESKTOP',
        page: 1,
        countryCode: 'US',
        languageCode: 'en',
      },
      organicResults: [
        {
          position: 1,
          title: `${candidate.title} primary source`,
          url: `https://authority.example/topic-${index + 1}`,
          description: 'Primary source.',
        },
        {
          position: 2,
          title: `${candidate.title} guide`,
          url: `https://publisher.example/topic-${index + 1}`,
          description: 'Independent guide.',
        },
      ],
      peopleAlsoAsk: [
        `What is founder video topic ${index + 1}?`,
        `How do you plan founder video topic ${index + 1}?`,
        `Why does founder video topic ${index + 1} matter?`,
        'What is an unrelated accounting rule?',
      ],
      relatedQueries: [],
    }));
    const client: ApifyClient = {
      startActor: async (actorId, input) => {
        starts.push({ actorId, input });
        return actorId === AUTOCOMPLETE_ACTOR_ID
          ? successfulRun('autocomplete-run', 'autocomplete-dataset')
          : successfulRun('serp-run', 'serp-dataset');
      },
      getRun: async () => { throw new Error('Already complete'); },
      getDatasetItems: async (datasetId) =>
        datasetId === 'autocomplete-dataset' ? autocompleteItems : serpItems,
    };
    const researcher = createResearcher({
      apify: client,
      sourceChecker: {
        select: async (urls) => urls.map((url, index) => ({
          url,
          authoritative: index === 0,
        })),
      },
    });

    const result = await researcher.research(candidates(55));

    expect(result.scannedCount).toBe(50);
    expect(result.deepInspectionCount).toBe(10);
    expect(result.results).toHaveLength(10);
    expect(starts[0]).toMatchObject({
      actorId: AUTOCOMPLETE_ACTOR_ID,
      input: { country: 'us', language: 'en', maxRequestRetries: 3 },
    });
    expect((starts[0].input.keywords as string[])).toHaveLength(50);
    expect(starts[1]).toMatchObject({
      actorId: SERP_ACTOR_ID,
      input: {
        maxPagesPerQuery: 1,
        countryCode: 'us',
        languageCode: 'en',
        mobileResults: false,
        saveHtml: false,
        saveHtmlToKeyValueStore: false,
      },
    });
    expect((starts[1].input.queries as string).trim().split('\n')).toHaveLength(10);
    expect(result.results.every(({ evidence }) => EvidenceBundleSchema.safeParse(evidence).success))
      .toBe(true);
    expect(result.results[0].provenance).toEqual({
      discovery: {
        actorId: AUTOCOMPLETE_ACTOR_ID,
        runId: 'autocomplete-run',
        datasetId: 'autocomplete-dataset',
        observedAt: '2026-09-04T08:01:00.000Z',
      },
      serp: {
        actorId: SERP_ACTOR_ID,
        runId: 'serp-run',
        datasetId: 'serp-dataset',
        observedAt: '2026-09-04T08:01:00.000Z',
      },
    });
  });

  it('requires three deduplicated questions relevant to the candidate keyword', () => {
    expect(selectRelevantPaaQuestions('demo day video checklist', [
      'What belongs in a demo day checklist?',
      'How long should a demo day video be?',
      'How do founders plan a demo day video?',
      'HOW DO FOUNDERS PLAN A DEMO DAY VIDEO?',
      'What are payroll tax deadlines?',
    ])).toEqual([
      'What belongs in a demo day checklist?',
      'How long should a demo day video be?',
      'How do founders plan a demo day video?',
    ]);
    expect(() => selectRelevantPaaQuestions('demo day video checklist', [
      'What belongs in a demo day checklist?',
      'What are payroll tax deadlines?',
      'How is a corporation registered?',
    ])).toThrow(/three relevant/i);
  });

  it('rejects questions whose only overlap is a generic video or startup token', () => {
    expect(() => selectRelevantPaaQuestions('startup product demo video', [
      'Which video codec is best for archival footage?',
      'How does a startup register for payroll tax?',
      'Why is video compression useful for television?',
      'What product demo evidence should a buyer review?',
    ])).toThrow(/three relevant/i);
  });
});
