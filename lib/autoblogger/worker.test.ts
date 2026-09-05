import { describe, expect, it } from 'vitest';

import {
  CandidateSchema,
  EvidenceBundleSchema,
  KeywordMetricsSchema,
  candidateFingerprints,
  type Candidate,
  type DraftBundle,
} from './domain';
import { createPersistentWorkerState, type PersistentWorkerState } from './github-runtime';
import { createPendingKeywordProvider, type KeywordProvider } from './keyword-providers';
import type { ShallowResearchResult } from './research';
import { createAutobloggerWorker } from './worker';

function candidate(index: number): Candidate {
  const campaignNumber = index % 3 === 0 ? 2 : index % 3 === 1 ? 1 : 3;
  const campaignId = campaignNumber === 1
    ? 'newly-funded-founder'
    : campaignNumber === 2
      ? 'accelerator-demo-day-founder'
      : 'video-production-comparison';
  return CandidateSchema.parse({
    schemaVersion: 1,
    articleId: `vc-c${campaignNumber}-${String(index + 100).padStart(3, '0')}`,
    campaignId,
    icp: campaignId,
    primaryKeyword: `founder video evidence topic ${index}`,
    secondaryKeywords: [],
    title: `Founder Video Evidence Topic ${index}`,
    slug: `founder-video-evidence-topic-${index}`,
    intent: 'informational',
    funnelStage: index % 2 === 0 ? 'middle' : 'top',
  });
}

function shallow(item: Candidate): ShallowResearchResult {
  const observedAt = '2026-09-05T00:00:00.000Z';
  return {
    candidate: item,
    suggestions: [`${item.primaryKeyword} guide`],
    organicResults: [
      { url: `https://primary.example/${item.slug}`, title: item.title, snippet: `${item.title} is a source-backed workflow.`, resultType: 'article' },
      { url: `https://secondary.example/${item.slug}`, title: `${item.title} checklist`, snippet: `${item.title} includes a checklist.`, resultType: 'article' },
    ],
    peopleAlsoAsk: [
      `What is ${item.primaryKeyword}?`,
      `How do you plan ${item.primaryKeyword}?`,
      `Why does ${item.primaryKeyword} matter?`,
    ],
    relatedQueries: [`${item.primaryKeyword} template`],
    provenance: {
      discovery: { actorId: 'autocomplete', runId: 'discovery-run', datasetId: 'discovery-data', observedAt },
      serp: { actorId: 'serp', runId: 'serp-run', datasetId: 'serp-data', observedAt },
    },
  };
}

function bundle(item: Candidate): DraftBundle {
  return {
    schemaVersion: 1,
    candidateFingerprint: candidateFingerprints(item).candidate,
    article: { id: item.articleId, slug: item.slug },
    markdown: `---\nid: ${item.articleId}\nslug: ${item.slug}\n---\nDraft`,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"/>',
  };
}

function fixture(input: {
  landerRef?: string;
  openDraftPullRequest?: NonNullable<Parameters<typeof createAutobloggerWorker>[0]['publisher']['openDraftPullRequest']>;
  keywordProvider?: KeywordProvider;
} = {}) {
  let state = createPersistentWorkerState();
  let version: string | null = 'state-v1';
  const counters = { scanned: 0, enriched: 0, inspected: [] as number[], drafted: 0, validated: 0, opened: 0, saved: 0 };
  const backlog = Array.from({ length: 50 }, (_unused, index) => candidate(index));
  const worker = createAutobloggerWorker({
    backlog,
    stateStore: {
      load: async () => ({ state, version }),
      save: async (next: PersistentWorkerState, expected: string | null) => {
        expect(expected).toBe(version);
        state = next;
        version = `state-v${counters.saved + 2}`;
        counters.saved += 1;
        return { version };
      },
    },
    researcher: {
      scan: async (items) => {
        counters.scanned = items.length;
        return { scannedCount: items.length, results: items.map(shallow) };
      },
      inspect: async (items) => {
        const item = items[0];
        const index = Number(item.candidate.slug.split('-').at(-1));
        counters.inspected.push(index);
        return {
          scannedCount: 1,
          deepInspectionCount: 1,
          results: [{
            candidate: item.candidate,
            provenance: item.provenance,
            evidence: EvidenceBundleSchema.parse({
              schemaVersion: 1,
              candidateFingerprint: candidateFingerprints(item.candidate).candidate,
              suggestions: [...item.suggestions, ...item.relatedQueries],
              serp: { organicResultCount: 2, peopleAlsoAsk: item.peopleAlsoAsk },
              sources: [
                { url: item.organicResults[0].url, authoritative: true },
                { url: item.organicResults[1].url, authoritative: false },
              ],
              faqQuestions: item.peopleAlsoAsk,
            }),
          }],
        };
      },
    },
    keywordProvider: input.keywordProvider ?? {
      enrich: async ({ keyword, intent, mode }) => {
        counters.enriched += 1;
        const index = Number(keyword.split(' ').at(-1));
        const provider = mode === 'scheduled' ? 'semrush' : 'pending';
        return {
          metrics: KeywordMetricsSchema.parse({
            schemaVersion: 1,
            provider,
            observedAt: provider === 'pending' ? null : '2026-09-05T00:00:00.000Z',
            volume: provider === 'pending' ? null : index + 1,
            difficulty: provider === 'pending' ? null : 10,
            cpc: null,
            intent,
          }),
          provenance: { provider, endpoint: null, observedAt: null, providerRequestId: null, sourceObservedAt: null },
        };
      },
    },
    drafter: {
      draft: async (context) => {
        counters.drafted += 1;
        return { status: 'ready' as const, repaired: true, bundle: bundle(context.candidate) };
      },
    },
    buildDraftContext: ({ result, metrics }) => ({
      candidate: result.candidate,
      evidence: result.evidence,
      keywordMetrics: metrics,
      checkedSources: result.evidence.sources.map((source) => ({
        url: source.url, finalUrl: source.url, status: 200, reachable: true, authoritative: source.authoritative,
      })),
      provenance: {
        apifyRunId: result.provenance.serp.runId,
        apifyDatasetId: result.provenance.serp.datasetId,
        query: result.candidate.primaryKeyword,
        locale: 'en-US',
        capturedAt: '2026-09-05',
      },
      sourceFacts: result.evidence.sources.map((source, index) => ({
        id: `source-${index}`, label: `Source ${index}`, url: source.url, checkedAt: '2026-09-05T00:00:00.000Z',
        facts: [{ id: `fact-${index}`, text: `Source-backed fact ${index}.` }],
      })),
      productClaims: [],
      generatedAt: '2026-09-05T00:00:00.000Z',
    }),
    publisher: {
      validateBundle: async (draft) => {
        counters.validated += 1;
        return {
          status: 'passed' as const, cleanup: 'completed' as const, bundleHash: 'a'.repeat(64),
          landerRef: 'seo/founder-video-blog-launch', checkedOutHeadSha: 'b'.repeat(40),
          articlePath: `content/articles/${String(draft.article.slug)}.md`, svgPath: `public/media/blog/${String(draft.article.slug)}.svg`, commands: [],
        };
      },
      openDraftPullRequest: input.openDraftPullRequest ?? (async () => {
        counters.opened += 1;
        return { status: 'artifact_only' as const, reason: 'lander_base_not_ready' as const };
      }),
    },
    landerRef: input.landerRef ?? 'seo/founder-video-blog-launch',
    approvedMedia: { product: [], editorialGraphics: [] },
    now: () => new Date('2026-09-05T00:00:00.000Z'),
  });
  return { worker, counters, getState: () => state };
}

describe('persistent autoblogger worker', () => {
  it('validates all 50 shallow candidates, deep-checks the best 10, and drafts max three/max two per ICP', async () => {
    const { worker, counters } = fixture();
    const report = await worker.execute({ command: 'run', runId: 'fixture-run-1' });

    expect(counters.scanned).toBe(50);
    expect(counters.enriched).toBe(50);
    expect(counters.inspected).toHaveLength(10);
    expect(counters.inspected).toEqual([48, 46, 49, 44, 47, 42, 45, 40, 43, 38]);
    expect(counters.drafted).toBe(3);
    expect(counters.validated).toBe(3);
    expect(counters.opened).toBe(0);
    expect(report.counts).toMatchObject({ scanned: 50, shallowValidated: 50, deepInspected: 10, drafted: 3, validated: 3, pullRequestsOpened: 0 });
    expect(Math.max(...Object.values(Object.groupBy(report.artifacts, (item) => item.icp)).map((items) => items?.length ?? 0))).toBeLessThanOrEqual(2);
    expect(report.artifacts.every(({ publication }) => publication === 'artifact_only')).toBe(true);
  });

  it('allows one artifact-only pending-metrics pilot ever and makes reruns idempotent', async () => {
    const { worker, counters, getState } = fixture();
    const first = await worker.execute({ command: 'pilot', runId: 'fixture-pilot-1' });
    expect(first.artifacts).toHaveLength(1);
    expect(counters.opened).toBe(0);
    expect(getState().manualPilot?.runId).toBe('fixture-pilot-1');

    const repeated = await worker.execute({ command: 'pilot', runId: 'fixture-pilot-1' });
    expect(repeated.status).toBe('already_recorded');
    expect(counters.scanned).toBe(50);

    await expect(worker.execute({ command: 'pilot', runId: 'fixture-pilot-2' })).rejects.toThrow(/pilot.*already/i);
    expect(counters.opened).toBe(0);
  });

  it('lets research use pending metrics while still completing all 50 shallow and 10 deep checks', async () => {
    const { worker, counters } = fixture({ keywordProvider: createPendingKeywordProvider() });
    const report = await worker.execute({ command: 'research', runId: 'fixture-research-pending-1' });

    expect(report.status).toBe('researched');
    expect(report.counts).toMatchObject({
      scanned: 50,
      shallowValidated: 50,
      metricsEnriched: 50,
      deepInspected: 10,
      drafted: 0,
    });
    expect(counters.drafted).toBe(0);
    expect(counters.opened).toBe(0);
  });

  it('authorizes each generated editorial SVG only on the controlled main publication path', async () => {
    const approvedEditorial: string[][] = [];
    const { worker } = fixture({
      landerRef: 'main',
      openDraftPullRequest: async ({ bundle: draft, origin }) => {
        const slug = String(draft.article.slug);
        approvedEditorial.push([...origin.approvedMedia.editorialGraphics]);
        expect(origin.approvedMedia.editorialGraphics).toContain(`/media/blog/${slug}.svg`);
        return { status: 'already_exists', number: 42, url: 'https://github.example/pull/42', headRef: `autoblog/2026-09-05-${slug}` };
      },
    });

    const report = await worker.execute({ command: 'run', runId: 'fixture-main-1' });
    expect(report.failures).toEqual([]);
    expect(report.artifacts).toHaveLength(3);
    expect(approvedEditorial).toHaveLength(3);
  });

  it('stops the run for manual attention and never attempts another PR after reconciliation is required', async () => {
    let publicationAttempts = 0;
    const { worker, getState } = fixture({
      landerRef: 'main',
      openDraftPullRequest: async ({ bundle: draft }) => {
        publicationAttempts += 1;
        return {
          status: 'reconciliation_required',
          reason: 'pull_request_state_uncertain',
          headRef: `autoblog/2026-09-05-${String(draft.article.slug)}`,
        };
      },
    });

    const report = await worker.execute({ command: 'run', runId: 'fixture-reconciliation-1' });
    expect(publicationAttempts).toBe(1);
    expect(report.status).toBe('failed');
    expect(report.artifacts).toHaveLength(1);
    expect(report.artifacts[0].publication).toBe('reconciliation_required');
    expect(report.failures).toContainEqual(expect.objectContaining({ code: 'reconciliation_required' }));
    expect(getState().candidateFingerprints).toContain(report.artifacts[0].candidateFingerprint);
  });
});
