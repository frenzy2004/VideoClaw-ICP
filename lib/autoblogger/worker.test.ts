import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CandidateSchema,
  EvidenceBundleSchema,
  KeywordMetricsSchema,
  candidateFingerprints,
  type Candidate,
  type DraftBundle,
  type EvidenceBundle,
  type KeywordMetrics,
} from './domain';
import { createPersistentWorkerState, PersistentWorkerStateSchema, type PersistentWorkerState } from './github-runtime';
import { createPendingKeywordProvider, type KeywordProvider } from './keyword-providers';
import { createResearcher, SERP_ACTOR_ID, type ShallowResearchResult } from './research';
import { createAutobloggerWorker, discoverCandidatesFromResearch } from './worker';
import { reserveCandidate, grantManualRetryApproval, grantManualTargetSwitch, grantManualTargetRetry, grantManualFreshCandidate, markCandidateScanned, markCandidateFailure } from './recovery';
import { writeAutobloggerArtifacts } from './runtime';
import { reconcileLocalPilotCandidate } from './local-pilot';
import type { DraftSafetyFinding, DraftingContext } from './content-bundle';

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
  backlog?: Candidate[];
  backlogCount?: number;
  observe?: (item: Candidate) => ShallowResearchResult;
  inspect?: Parameters<typeof createAutobloggerWorker>[0]['researcher']['inspect'];
  inspectProvenance?: (item: ShallowResearchResult) => ShallowResearchResult['provenance'];
  inspectObservations?: ShallowResearchResult['paaObservations'];
  metricsOverrides?: (index: number) => Partial<KeywordMetrics>;
  evidenceOverrides?: Partial<EvidenceBundle>;
  failScan?: boolean;
  failDraft?: boolean;
  prepareEvidence?: (context: DraftingContext) => Promise<DraftingContext>;
  blockedFindings?: DraftSafetyFinding[];
  maxDrafts?: 1 | 2 | 3;
  targetCandidateFingerprint?: string;
  publicationEnabled?: boolean;
  landerInventory?: Parameters<typeof createAutobloggerWorker>[0]['landerInventory'];
  onReservation?: (state: PersistentWorkerState) => void;
  beforeSave?: (state: PersistentWorkerState) => void;
  initialState?: PersistentWorkerState;
  now?: () => Date;
  persistArtifact?: Parameters<typeof createAutobloggerWorker>[0]['persistArtifact'];
} = {}) {
  let state = input.initialState ?? createPersistentWorkerState();
  let version: string | null = 'state-v1';
  const counters = { scanned: 0, enriched: 0, inspected: [] as number[], drafted: 0, validated: 0, opened: 0, saved: 0 };
  const backlog = input.backlog ?? Array.from({ length: input.backlogCount ?? 50 }, (_unused, index) => candidate(index));
  const worker = createAutobloggerWorker({
    backlog,
    stateStore: {
      load: async () => ({ state, version }),
      save: async (next: PersistentWorkerState, expected: string | null) => {
        expect(expected).toBe(version);
        input.beforeSave?.(next);
        state = next;
        version = `state-v${counters.saved + 2}`;
        counters.saved += 1;
        input.onReservation?.(state);
        return { version };
      },
    },
    researcher: {
      scan: async (items) => {
        if (input.failScan) throw new Error('temporary network failure');
        counters.scanned = items.length;
        return { scannedCount: items.length, results: items.map(input.observe ?? shallow) };
      },
      inspect: async (items) => {
        const item = items[0];
        const index = Number(item.candidate.slug.split('-').at(-1));
        counters.inspected.push(index);
        if (input.inspect) return input.inspect(items);
        return {
          scannedCount: 1,
          deepInspectionCount: 1,
          results: [{
            candidate: item.candidate,
            provenance: input.inspectProvenance?.(item) ?? item.provenance,
            ...(input.inspectObservations ? {paaObservations: input.inspectObservations} : {}),
            evidence: EvidenceBundleSchema.parse({
              schemaVersion: 2,
              candidateFingerprint: candidateFingerprints(item.candidate).candidate,
              signals: { autocomplete: item.suggestions, peopleAlsoAsk: item.peopleAlsoAsk, relatedSearches: item.relatedQueries },
              serp: { organicResultCount: 2, peopleAlsoAsk: item.peopleAlsoAsk },
              sources: [
                { originalUrl: item.organicResults[0].url, finalUrl: item.organicResults[0].url, authoritative: true },
                { originalUrl: item.organicResults[1].url, finalUrl: item.organicResults[1].url, authoritative: false },
              ],
              faqQuestions: item.peopleAlsoAsk,
              ...input.evidenceOverrides,
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
        const metrics = KeywordMetricsSchema.parse({
          schemaVersion: 1,
          provider,
          observedAt: provider === 'pending' ? null : '2026-09-05T00:00:00.000Z',
          volume: provider === 'pending' ? null : index + 1,
          difficulty: provider === 'pending' ? null : 10,
          cpc: null,
          intent,
          ...input.metricsOverrides?.(index),
        });
        return {
          metrics,
          provenance: { provider: metrics.provider, endpoint: null, observedAt: null, providerRequestId: null, sourceObservedAt: null },
        };
      },
    },
    drafter: {
      ...(input.prepareEvidence ? {prepareEvidence: input.prepareEvidence} : {}),
      draft: async (context) => {
        if (input.failDraft) throw new Error('temporary model timeout');
        if (input.blockedFindings) return { status: 'blocked' as const, reason: 'content_safety_failed' as const, findings: input.blockedFindings };
        counters.drafted += 1;
        return { status: 'ready' as const, repaired: true, bundle: bundle(context.candidate) };
      },
    },
    buildDraftContext: ({ result, metrics }) => ({
      candidate: result.candidate,
      evidence: result.evidence,
      keywordMetrics: metrics,
      checkedSources: result.evidence.sources.map((source) => ({
        url: source.originalUrl, finalUrl: source.finalUrl, status: 200, reachable: true, authoritative: source.authoritative,
      })),
      provenance: {
        apifyRunId: result.provenance.serp.runId,
        apifyDatasetId: result.provenance.serp.datasetId,
        query: result.candidate.primaryKeyword,
        locale: 'en-US',
        capturedAt: '2026-09-05',
      },
      sourceFacts: result.evidence.sources.map((source, index) => ({
        id: `source-${index}`, label: `Source ${index}`, url: source.finalUrl, checkedAt: '2026-09-05T00:00:00.000Z',
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
    now: input.now ?? (() => new Date('2026-09-05T00:00:00.000Z')),
    maxDrafts: input.maxDrafts,
    targetCandidateFingerprint: input.targetCandidateFingerprint,
    publicationEnabled: input.publicationEnabled,
    landerInventory: input.landerInventory,
    persistArtifact: input.persistArtifact,
  });
  return { worker, counters, getState: () => state };
}

describe('persistent autoblogger worker', () => {
  it('retains prepared FAQ selection in artifact attribution instead of the preliminary choices', async () => {
    let preparation: DraftingContext['faqEvidencePlan'];
    const f = fixture({backlogCount: 1, publicationEnabled: false, prepareEvidence: async context => {
      const questions = [context.evidence.faqQuestions[2], context.evidence.faqQuestions[0], context.evidence.faqQuestions[1]];
      preparation = {schemaVersion: 1, contextHash: 'a'.repeat(64), candidateQuestions: questions,
        selections: questions.map((question, index) => ({question, intent: `intent ${index}`,
          anchors: [{sourceFactId: 'fact-1', excerpt: 'Private source anchor retained only in the review artifact.'}]}))};
      return {...context, faqEvidencePlan: preparation, evidence: {...context.evidence, faqQuestions: questions,
        serp: {...context.evidence.serp, peopleAlsoAsk: questions}}};
    }});
    const report = await f.worker.execute({command: 'pilot', runId: 'prepared-faqs'});
    expect(report.status).toBe('validated');
    expect(report.artifacts[0]).toHaveProperty('faqEvidencePlan', preparation);
    expect(JSON.stringify(f.getState())).not.toContain('Private source anchor');
    expect(report.artifacts[0].publicationOrigin.evidence.faqQuestions).toEqual([
      'Why does founder video evidence topic 0 matter?', 'What is founder video evidence topic 0?',
      'How do you plan founder video evidence topic 0?',
    ]);
  });

  it('never drafts or invokes native validation when evidence preparation refuses the candidate', async () => {
    const f = fixture({backlogCount: 1, publicationEnabled: false,
      prepareEvidence: async () => {throw new Error('insufficient FAQ evidence');}});
    const report = await f.worker.execute({command: 'pilot', runId: 'unprepared-faqs'});
    expect(report.status).toBe('failed');
    expect(report.artifacts).toEqual([]);
    expect(f.counters.drafted).toBe(0);
    expect(f.counters.validated).toBe(0);
  });

  function approvedRetry() {
    const item = { ...candidate(0), articleId: 'vc-c2-001' };
    const fp = candidateFingerprints(item).candidate;
    let state = createPersistentWorkerState();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const at = `2026-09-04T20:0${attempt}:00.000Z`;
      const runId = `prior-${attempt}`;
      state = reserveCandidate(state, item, runId, 'manual_pilot', at);
      state = markCandidateScanned(state, item, runId, at);
      state = markCandidateFailure(state, item, runId, 'candidate_failed', true, at);
      state.runs[runId] = { schemaVersion: 1, runId, mode: 'manual_pilot', startedAt: at, selectedCandidateFingerprints: [fp], status: 'failed' };
      state.failures.push({ runId, code: 'candidate_failed', attempt, observedAt: at, detail: 'Prior failure retained.' });
    }
    state = grantManualRetryApproval(state, item, { priorRunId: 'prior-3', runId: 'approved-attempt-4', reason: 'user_authorized_after_input_fix', approvedAt: '2026-09-05T00:00:00.000Z' });
    return { item, state, fp };
  }

  function alternativePilot() {
    const old = approvedRetry();
    const target = candidate(1);
    return { old, target, fp: candidateFingerprints(target).candidate, state: grantManualTargetSwitch(old.state, target, {
      parkedRetryRunId: 'approved-attempt-4', runId: 'alternative-pilot', approvedAt: '2026-09-05T00:00:00.000Z',
    }) };
  }

  async function freshPilot() {
    const { target, state, fp } = alternativePilot();
    const first = fixture({ backlog: [target], initialState: state, targetCandidateFingerprint: fp, publicationEnabled: false, failDraft: true });
    await first.worker.execute({ command: 'pilot', runId: 'alternative-pilot' });
    const approved = grantManualTargetRetry(first.getState(), target, { priorRunId: 'alternative-pilot', runId: 'closed-target-retry', approvedAt: '2026-09-05T01:00:00.000Z' });
    const second = fixture({ backlog: [target], initialState: approved, targetCandidateFingerprint: fp, publicationEnabled: false, failDraft: true, now: () => new Date('2026-09-05T01:00:00.000Z') });
    await second.worker.execute({ command: 'pilot', runId: 'closed-target-retry' });
    const before = structuredClone(second.getState());
    const fresh = candidate(99);
    const at = '2026-09-05T02:00:00.000Z';
    return { before, fresh, at, state: grantManualFreshCandidate(before, fresh, { runId: 'fresh-pilot', approvedAt: at }) };
  }

  it.each(['success', 'draft-failure', 'scan-throw'])('runs only the fresh approved topic with immutable old history: %s', async outcome => {
    const { before, fresh, at, state } = await freshPilot();
    const fp = candidateFingerprints(fresh).candidate;
    const f = fixture({ initialState: state, backlog: [fresh, candidate(98)], targetCandidateFingerprint: fp,
      publicationEnabled: false, failDraft: outcome === 'draft-failure', failScan: outcome === 'scan-throw', now: () => new Date(at),
      beforeSave: next => { expect(PersistentWorkerStateSchema.safeParse(next).success).toBe(true); },
      persistArtifact: async () => { expect(f.getState().manualPilot?.status).toBe('prepared'); },
    });
    if (outcome === 'scan-throw') await expect(f.worker.execute({ command: 'pilot', runId: 'fresh-pilot' })).rejects.toThrow('temporary network failure');
    else {
      const report = await f.worker.execute({ command: 'pilot', runId: 'fresh-pilot' });
      expect(report.status).toBe(outcome === 'success' ? 'validated' : 'failed');
      expect(report.artifacts).toHaveLength(outcome === 'success' ? 1 : 0);
      expect(f.counters.scanned).toBe(1);
    }
    const saved = f.getState();
    expect(saved.decisions[fp]).toMatchObject({ attempts: 1, status: outcome === 'success' ? 'completed' : 'terminal' });
    expect(saved.manualRetryApproval).toEqual(before.manualRetryApproval);
    expect(saved.manualTargetSwitch).toEqual(before.manualTargetSwitch);
    expect(saved.runs).toMatchObject(before.runs);
    expect(saved.decisions).toMatchObject(before.decisions);
    expect(saved.failures.slice(0, before.failures.length)).toEqual(before.failures);
    expect(saved.runs['fresh-pilot'].status).toBe(outcome === 'success' ? 'validated' : 'failed');
    expect(saved.manualFreshCandidateApproval?.consumedAt).toBe(at);
    expect(f.counters.opened).toBe(0);
    await expect(f.worker.execute({ command: 'pilot', runId: 'unapproved-next' })).rejects.toThrow();
  });

  it.each(['scheduled', 'other-target', 'publication', 'missing-publication-flag', 'other-run', 'lease'])('blocks fresh worker startup before any work: %s', async problem => {
    const { fresh, at, state } = await freshPilot();
    if (problem === 'lease') state.decisions.other = { ...Object.values(state.decisions)[0], attempts: 1, status: 'leased', leaseExpiresAt: '2026-09-06T00:00:00.000Z' };
    const f = fixture({ initialState: state, backlog: [fresh], now: () => new Date(at),
      targetCandidateFingerprint: candidateFingerprints(problem === 'other-target' ? candidate(98) : fresh).candidate,
      publicationEnabled: problem === 'publication' ? true : problem === 'missing-publication-flag' ? undefined : false });
    await expect(f.worker.execute({ command: problem === 'scheduled' ? 'run' : 'pilot', runId: problem === 'other-run' ? 'wrong' : 'fresh-pilot' })).rejects.toThrow();
    expect(f.counters).toMatchObject({ scanned: 0, drafted: 0, saved: 0, opened: 0 });
  });

  it.each(['enrichment-failed', 'missing-faqs'])('durably records a fresh run with zero eligible opportunities: %s', async reason => {
    const { before, fresh, at, state } = await freshPilot();
    const fp = candidateFingerprints(fresh).candidate;
    const f = fixture({ initialState: state, backlog: [fresh], targetCandidateFingerprint: fp,
      publicationEnabled: false, now: () => new Date(at),
      ...(reason === 'enrichment-failed' ? { keywordProvider: { enrich: async () => { throw new Error('Provider unavailable'); } } }
        : { evidenceOverrides: { faqQuestions: [] } }),
    });
    const report = await f.worker.execute({ command: 'pilot', runId: 'fresh-pilot' });
    expect(report.status).toBe('failed');
    expect(report.artifacts).toEqual([]);
    const saved = f.getState();
    expect(PersistentWorkerStateSchema.safeParse(saved).success).toBe(true);
    expect(saved.runs['fresh-pilot'].status).toBe('failed');
    expect(saved.failures).toContainEqual(expect.objectContaining({ runId: 'fresh-pilot',
      candidateFingerprint: fp, attempt: 1, code: 'no_eligible_opportunities' }));
    expect(saved.decisions[fp].leaseExpiresAt).toBeNull();
    expect(saved.manualPilot).toBeNull();
    expect(saved.manualTargetSwitch).toEqual(before.manualTargetSwitch);
    expect(saved.runs).toMatchObject(before.runs);
    expect(f.counters).toMatchObject({ drafted: 0, validated: 0, opened: 0 });
    await expect(f.worker.execute({ command: 'pilot', runId: 'unapproved-next' })).rejects.toThrow();
  });

  it.each([2, 3].flatMap(attempt => ['success', 'draft-failure', 'scan-throw'].map(outcome => ({ attempt, outcome }))))('executes only the explicitly authorized same-target attempt $attempt: $outcome', async ({ attempt, outcome }) => {
    const { old, target, state, fp } = alternativePilot();
    const first = fixture({ backlog: [target], initialState: state, targetCandidateFingerprint: fp, publicationEnabled: false, failDraft: true });
    await first.worker.execute({ command: 'pilot', runId: 'alternative-pilot' });
    let before = structuredClone(first.getState());
    let priorRunId = 'alternative-pilot';
    if (attempt === 3) {
      const approved = grantManualTargetRetry(before, target, { priorRunId, runId: 'first-target-retry', approvedAt: '2026-09-05T01:00:00.000Z' });
      const failed = fixture({ backlog: [target], initialState: approved, targetCandidateFingerprint: fp, publicationEnabled: false,
        now: () => new Date('2026-09-05T01:00:00.000Z'), failDraft: true });
      await failed.worker.execute({ command: 'pilot', runId: 'first-target-retry' });
      before = structuredClone(failed.getState());
      priorRunId = 'first-target-retry';
    }
    const nextTime = '2026-09-05T02:00:00.000Z';
    const approved = grantManualTargetRetry(before, target, { priorRunId, runId: 'collector-retry', approvedAt: nextTime });
    const second = fixture({ backlog: [old.item, target], initialState: approved, targetCandidateFingerprint: fp, publicationEnabled: false,
      now: () => new Date(nextTime), failDraft: outcome === 'draft-failure', failScan: outcome === 'scan-throw' });
    if (outcome === 'scan-throw') await expect(second.worker.execute({ command: 'pilot', runId: 'collector-retry' })).rejects.toThrow('temporary network failure');
    else {
      const result = await second.worker.execute({ command: 'pilot', runId: 'collector-retry' });
      expect(result.status).toBe(outcome === 'success' ? 'validated' : 'failed');
      expect(result.artifacts).toHaveLength(outcome === 'success' ? 1 : 0);
    }
    const saved = second.getState();
    expect(saved.decisions[fp]).toMatchObject({ attempts: attempt, status: outcome === 'success' ? 'completed' : 'terminal' });
    expect(saved.runs).toMatchObject(before.runs);
    expect(saved.failures.slice(0, before.failures.length)).toEqual(before.failures);
    expect(saved.manualTargetSwitch?.retry?.priorDecision).toEqual(before.decisions[fp]);
    expect(saved.manualRetryApproval).toEqual(before.manualRetryApproval);
    if (attempt === 3) expect(saved.manualTargetSwitch?.retryHistory).toEqual([before.manualTargetSwitch!.retry]);
    expect(second.counters.opened).toBe(0);
    expect(saved.runs['collector-retry'].status).toBe(outcome === 'success' ? 'validated' : 'failed');
    if (outcome !== 'success') expect(saved.failures.at(-1)).toMatchObject({ runId: 'collector-retry', attempt });
    else expect(PersistentWorkerStateSchema.safeParse({ ...saved,
      manualPilot: { ...saved.manualPilot!, status: 'consumed', consumedAt: nextTime } }).success).toBe(true);
    await expect(second.worker.execute({ command: 'pilot', runId: 'another-retry' })).rejects.toThrow();
    if (attempt === 3) expect(() => grantManualTargetRetry(saved, target, { priorRunId: 'collector-retry', runId: 'forbidden-fourth', approvedAt: '2026-09-05T03:00:00.000Z' })).toThrow();
  });

  it('takes a switched target through research, drafting and prepared artifact output with a stale old matrix row', async () => {
    const old = approvedRetry();
    const target = candidate(1);
    const untouched = candidate(2);
    const staleMatrixRow = { ...old.item, primaryKeyword: 'old matrix video planning keyword', title: 'Original Matrix Planning Title' };
    old.state.queuedCandidates = [old.item, untouched];
    const backlog = [staleMatrixRow, untouched];
    const before = structuredClone(old.state);
    const prepared = reconcileLocalPilotCandidate({ state: old.state, backlog, candidate: target, runId: 'alternative-pilot',
      switchTargetFrom: 'approved-attempt-4', approvedAt: '2026-09-05T00:00:00.000Z' });
    const f = fixture({ backlog: prepared.backlog, initialState: prepared.state, targetCandidateFingerprint: candidateFingerprints(target).candidate,
      publicationEnabled: false });
    const report = await f.worker.execute({ command: 'pilot', runId: 'alternative-pilot' });
    expect(report.status).toBe('validated');
    expect(report.counts).toMatchObject({ scanned: 1, drafted: 1, validated: 1, pullRequestsOpened: 0 });
    expect(report.artifacts).toHaveLength(1);
    expect(report.artifacts[0]).toMatchObject({ articleId: target.articleId, publication: 'artifact_only' });
    expect(f.getState().manualPilot).toMatchObject({ runId: 'alternative-pilot', status: 'prepared' });
    expect(f.getState().decisions[old.fp]).toEqual(before.decisions[old.fp]);
    expect(f.getState().runs).toMatchObject(before.runs);
    expect(f.getState().failures).toEqual(before.failures);
    expect(JSON.stringify(f.getState().manualRetryApproval)).toBe(JSON.stringify(before.manualRetryApproval));
    expect(old.state).toEqual(before);
    expect(backlog).toEqual([staleMatrixRow, untouched]);
  });

  it.each([false, true])('runs only the switched candidate at normal attempt one, leaving the old grant/history parked (draft fails: %s)', async (failDraft) => {
    const { old, target, state, fp } = alternativePilot();
    const f = fixture({ backlog: [old.item, target, candidate(2)], initialState: state, targetCandidateFingerprint: fp, publicationEnabled: false, failDraft,
      onReservation(saved) {
        expect(saved.manualRetryApproval).toEqual(old.state.manualRetryApproval);
        expect(saved.manualTargetSwitch?.consumedAt).toBe('2026-09-05T00:00:00.000Z');
        expect(saved.decisions[fp].attempts).toBe(1);
        expect(saved.decisions[old.fp]).toEqual(old.state.decisions[old.fp]);
        expect(PersistentWorkerStateSchema.safeParse(saved).success).toBe(true);
      },
    });
    const result = await f.worker.execute({ command: 'pilot', runId: 'alternative-pilot' });
    expect(result.status).toBe(failDraft ? 'failed' : 'validated');
    expect(f.counters).toMatchObject({ scanned: 1, drafted: failDraft ? 0 : 1, opened: 0 });
    expect(f.getState().runs).toMatchObject(old.state.runs);
    expect(f.getState().failures.slice(0, 3)).toEqual(old.state.failures);
    expect(f.getState().manualRetryApproval).toEqual(old.state.manualRetryApproval);
    expect(f.getState().decisions[fp].attempts).toBe(1);
    if (!failDraft) {
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].publication).toBe('artifact_only');
      expect(f.getState().manualPilot?.status).toBe('prepared');
    }
    await expect(f.worker.execute({ command: 'pilot', runId: 'another-alternative' })).rejects.toThrow();
    await expect(f.worker.execute({ command: 'pilot', runId: 'approved-attempt-4' })).rejects.toThrow();
    expect(f.counters.scanned).toBe(1);
  });

  it.each(['empty-serp', 'metrics-failure', 'deep-failure', 'draft-failure'])('reports a consumed target-switch %s as terminal without suggesting an unavailable retry', async (failure) => {
    const { old, target, state, fp } = alternativePilot();
    const f = fixture({ backlog: [target], initialState: state, targetCandidateFingerprint: fp, publicationEnabled: false,
      ...(failure === 'empty-serp' ? { observe: (item: Candidate) => ({ ...shallow(item), organicResults: [], peopleAlsoAsk: [] }) } : {}),
      ...(failure === 'metrics-failure' ? { keywordProvider: { enrich: async () => { throw new Error('metrics unavailable'); } } } : {}),
      ...(failure === 'deep-failure' ? { inspectProvenance: () => { throw new Error('source unavailable'); } } : {}),
      failDraft: failure === 'draft-failure',
    });
    const report = await f.worker.execute({ command: 'pilot', runId: 'alternative-pilot' });
    expect(report.status).toBe('failed');
    expect(f.getState().decisions[fp]).toMatchObject({ status: 'terminal', attempts: 1 });
    expect(report.failures.find((row) => row.candidateFingerprint === fp)).toMatchObject({ retryable: false, attempt: 1 });
    expect(f.getState().manualRetryApproval).toEqual(old.state.manualRetryApproval);
    expect(f.counters.opened).toBe(0);
  });

  it.each(['scheduled', 'research', 'wrong-run', 'no-target', 'wrong-target', 'publishing', 'implicit-publication', 'inventory', 'save-conflict'])('blocks target-switch %s before any paid work', async (problem) => {
    const { old, target, state, fp } = alternativePilot();
    const f = fixture({ backlog: [old.item, target], initialState: state,
      targetCandidateFingerprint: problem === 'no-target' ? undefined : problem === 'wrong-target' ? old.fp : fp,
      publicationEnabled: problem === 'publishing' ? true : problem === 'implicit-publication' ? undefined : false,
      landerInventory: problem === 'inventory' ? [{ slug: target.slug }] : [],
      beforeSave: problem === 'save-conflict' ? () => { throw new Error('State conflict'); } : undefined,
    });
    await expect(f.worker.execute({ command: problem === 'scheduled' ? 'run' : problem === 'research' ? 'research' : 'pilot', runId: problem === 'wrong-run' ? 'other-run' : 'alternative-pilot' })).rejects.toThrow();
    expect(f.counters).toMatchObject({ scanned: 0, enriched: 0, drafted: 0, opened: 0, saved: 0 });
    expect(f.getState().manualTargetSwitch?.consumedAt).toBeNull();
    expect(f.getState().manualRetryApproval).toEqual(old.state.manualRetryApproval);
  });

  it('retains the consumed switch and normal first failure when collection throws', async () => {
    const { old, target, state, fp } = alternativePilot();
    const f = fixture({ backlog: [target], initialState: state, targetCandidateFingerprint: fp, publicationEnabled: false, failScan: true });
    await expect(f.worker.execute({ command: 'pilot', runId: 'alternative-pilot' })).rejects.toThrow('temporary network failure');
    expect(f.getState().manualTargetSwitch?.consumedAt).not.toBeNull();
    expect(f.getState().manualRetryApproval).toEqual(old.state.manualRetryApproval);
    expect(f.getState().failures.at(-1)).toMatchObject({ runId: 'alternative-pilot', candidateFingerprint: fp, attempt: 1, code: 'shallow_research_failed' });
    expect(f.getState().runs['alternative-pilot'].status).toBe('failed');
    expect(f.getState().decisions[fp].attempts).toBe(1);
    await expect(f.worker.execute({ command: 'pilot', runId: 'another' })).rejects.toThrow();
  });

  it.each([false, true])('persists and consumes the exact retry before research, retaining real attempt four (draft fails: %s)', async (failDraft) => {
    const { item, state, fp } = approvedRetry();
    const before = structuredClone(state);
    const f = fixture({ backlog: [item, candidate(1)], initialState: state, targetCandidateFingerprint: fp, publicationEnabled: false, failDraft,
      onReservation: (saved) => {
        expect(saved.manualRetryApproval?.consumedAt).toBe('2026-09-05T00:00:00.000Z');
        expect(saved.decisions[fp].attempts).toBe(4);
        expect(PersistentWorkerStateSchema.safeParse(saved).success).toBe(true);
        if (!f.counters.scanned) expect(saved.decisions[fp].status).toBe('leased');
      },
    });
    const report = await f.worker.execute({ command: 'pilot', runId: 'approved-attempt-4' });
    expect(report.status).toBe(failDraft ? 'failed' : 'validated');
    expect(f.counters.scanned).toBe(1);
    expect(f.counters.opened).toBe(0);
    expect(f.getState().runs).toMatchObject(before.runs);
    expect(f.getState().failures.slice(0, 3)).toEqual(before.failures);
    expect(f.getState().decisions[fp]).toMatchObject({ attempts: 4, status: failDraft ? 'terminal' : 'completed' });
    expect(f.getState().queuedCandidates).toContainEqual(candidate(1));
    if (failDraft) {
      expect(report.failures).toContainEqual(expect.objectContaining({ candidateFingerprint: fp, attempt: 4, retryable: false }));
      expect(f.getState().failures.at(-1)).toMatchObject({ candidateFingerprint: fp, runId: 'approved-attempt-4', attempt: 4 });
    } else {
      expect(report.artifacts).toHaveLength(1);
      expect(report.artifacts[0].publication).toBe('artifact_only');
      expect(f.getState().manualPilot?.status).toBe('prepared');
    }
    const savedCount = f.counters.saved;
    expect((await f.worker.execute({ command: 'pilot', runId: 'approved-attempt-4' })).status).toBe('already_recorded');
    expect(f.counters.saved).toBe(savedCount);
    await expect(f.worker.execute({ command: 'pilot', runId: 'attempt-5' })).rejects.toThrow();
  });

  it.each(['scheduled', 'research', 'wrong-run', 'no-target', 'wrong-target', 'publishing', 'implicit-publication', 'inventory', 'save-conflict'])(
    'refuses %s before any paid stage of the manual retry', async (problem) => {
      const { item, state, fp } = approvedRetry();
      const f = fixture({ backlog: [item, candidate(1)], initialState: state,
        targetCandidateFingerprint: problem === 'no-target' ? undefined : problem === 'wrong-target' ? candidateFingerprints(candidate(1)).candidate : fp,
        publicationEnabled: problem === 'publishing' ? true : problem === 'implicit-publication' ? undefined : false,
        landerInventory: problem === 'inventory' ? [{ articleId: item.articleId }] : [],
        beforeSave: problem === 'save-conflict' ? () => { throw new Error('State conflict'); } : undefined,
      });
      await expect(f.worker.execute({ command: problem === 'scheduled' ? 'run' : problem === 'research' ? 'research' : 'pilot', runId: problem === 'wrong-run' ? 'other-run' : 'approved-attempt-4' })).rejects.toThrow();
      expect(f.counters).toMatchObject({ scanned: 0, enriched: 0, drafted: 0, opened: 0, saved: 0 });
      expect(f.getState().manualRetryApproval?.consumedAt).toBeNull();
    },
  );

  it('retains consumed approval and the fourth failure if the first research call fails', async () => {
    const { item, state, fp } = approvedRetry();
    const f = fixture({ backlog: [item], initialState: state, targetCandidateFingerprint: fp, publicationEnabled: false, failScan: true });
    await expect(f.worker.execute({ command: 'pilot', runId: 'approved-attempt-4' })).rejects.toThrow('temporary network failure');
    expect(f.getState().decisions[fp]).toMatchObject({ attempts: 4, status: 'terminal' });
    expect(f.getState().manualRetryApproval?.consumedAt).not.toBeNull();
    expect(f.getState().failures.at(-1)).toMatchObject({ runId: 'approved-attempt-4', candidateFingerprint: fp, attempt: 4, code: 'shallow_research_failed' });
    expect(f.getState().runs['approved-attempt-4'].status).toBe('failed');
  });

  it.each([false, true])('pins the prior third failure when appending to a full history (scan fails: %s)', async (failScan) => {
    const { item, state, fp } = approvedRetry();
    const priorFailure = state.failures[2];
    state.failures = [priorFailure, ...Array.from({ length: 99 }, (_, index) => ({
      runId: `unrelated-${index}`, code: 'candidate_failed', attempt: 1, observedAt: '2026-09-04T21:00:00.000Z', detail: 'Unrelated failure.',
    }))];
    const f = fixture({ backlog: [item], initialState: state, targetCandidateFingerprint: fp, publicationEnabled: false, failScan, failDraft: true });
    if (failScan) await expect(f.worker.execute({ command: 'pilot', runId: 'approved-attempt-4' })).rejects.toThrow('temporary network failure');
    else expect((await f.worker.execute({ command: 'pilot', runId: 'approved-attempt-4' })).status).toBe('failed');
    expect(f.getState().failures).toHaveLength(100);
    expect(f.getState().failures).toContainEqual(priorFailure);
    expect(f.getState().failures.at(-1)).toMatchObject({ runId: 'approved-attempt-4', candidateFingerprint: fp, attempt: 4 });
    expect(PersistentWorkerStateSchema.safeParse(f.getState()).success).toBe(true);
  });

  it('targets one eligible retained identity without scanning or losing the rest of the queue', async () => {
    const backlog = Array.from({ length: 6 }, (_value, index) => candidate(index));
    const { worker, counters, getState } = fixture({ backlog, targetCandidateFingerprint: candidateFingerprints(backlog[1]).candidate });
    const report = await worker.execute({ command: 'pilot', runId: 'targeted-pilot' });
    expect(report.status).toBe('validated');
    expect(report.artifacts.map(({ articleId }) => articleId)).toEqual(['vc-c1-101']);
    expect(counters.scanned).toBe(1);
    for (const item of backlog.filter((_item, index) => index !== 1)) {
      expect(getState().queuedCandidates).toContainEqual(item);
      expect(getState().decisions[candidateFingerprints(item).candidate]).toBeUndefined();
    }
  });

  it('does not substitute another candidate when the explicit target is excluded by an active lease', async () => {
    const backlog = [candidate(1), candidate(4)];
    const state = reserveCandidate(createPersistentWorkerState(), backlog[0], 'other-run', 'manual_pilot', '2026-09-05T00:00:00.000Z');
    const { worker, counters } = fixture({ backlog, initialState: state, targetCandidateFingerprint: candidateFingerprints(backlog[0]).candidate });
    await expect(worker.execute({ command: 'pilot', runId: 'unavailable-target' })).rejects.toThrow(/target.*eligible/i);
    expect(counters.scanned).toBe(0);
    expect(counters.saved).toBe(0);
  });

  const paaCollector = { actorId: 'paa-collector', runId: 'paa-run', datasetId: 'paa-data', observedAt: '2026-09-05T00:01:00.000Z' };
  const supportCollector = { actorId: 'support-search', runId: 'support-run', datasetId: 'support-data', observedAt: '2026-09-05T00:02:00.000Z' };
  const withPaa = (item: Candidate): ShallowResearchResult => ({
    ...shallow(item),
    provenance: { ...shallow(item).provenance, paa: paaCollector, paaAttempts: [{ ...paaCollector, runId: 'paa-first-empty' }, paaCollector] },
    paaObservations: [{
      ...paaCollector, query: item.primaryKeyword, question: `What is ${item.primaryKeyword}?`,
      parentQuestion: null, country: 'US', language: 'en', position: 1,
    }],
  });
  const withSupport = (item: ShallowResearchResult) => ({ ...item.provenance, supportSearches: [supportCollector] });

  it('persists both bounded SERP attempts from collector output instead of losing the failed-first provenance', async () => {
    const target = candidate(1);
    const attempts = [{ ...shallow(target).provenance.serp, runId: 'first-empty' }, shallow(target).provenance.serp];
    const f = fixture({ backlog: [target], observe: (item) => ({ ...shallow(item), provenance: { ...shallow(item).provenance, serpAttempts: attempts } }) });
    await f.worker.execute({ command: 'pilot', runId: 'serp-retry' });
    expect(f.getState().provenance[candidateFingerprints(target).candidate].serpAttempts).toEqual(attempts);
  });

  it('retains separate PAA collection provenance in research-only state', async () => {
    const { worker, getState } = fixture({ backlog: [candidate(1)], observe: withPaa });
    const report = await worker.execute({ command: 'research', runId: 'paa-research' });
    expect(report.status).toBe('researched');
    expect(getState().provenance[candidateFingerprints(candidate(1)).candidate]).toMatchObject({
      serp: { runId: 'serp-run', datasetId: 'serp-data' },
      paa: { actorId: 'paa-collector', runId: 'paa-run', datasetId: 'paa-data', observedAt: '2026-09-05T00:01:00.000Z' },
      paaAttempts: [{ ...paaCollector, runId: 'paa-first-empty' }, paaCollector],
    });
  });

  it('retains support-search provenance added by deep inspection even when drafting fails', async () => {
    const { worker, getState } = fixture({ backlog: [candidate(1)], observe: withPaa, inspectProvenance: withSupport, failDraft: true });
    const report = await worker.execute({ command: 'pilot', runId: 'support-draft-failure' });
    expect(report.status).toBe('failed');
    expect(getState().provenance[candidateFingerprints(candidate(1)).candidate]).toMatchObject({
      serp: { runId: 'serp-run' }, paa: { runId: 'paa-run' },
      supportSearches: [{ actorId: 'support-search', runId: 'support-run', datasetId: 'support-data', observedAt: '2026-09-05T00:02:00.000Z' }],
    });
  });

  it('counts a failed real deep inspection and retains its completed support receipt when PAA remains incomplete', async () => {
    const target = candidate(1);
    const complete = shallow(target);
    const partial = { ...complete, peopleAlsoAsk: complete.peopleAlsoAsk.slice(0, 1) };
    const original = structuredClone(partial);
    let supportStarts = 0;
    let supportQuery = '';
    let sourceReads = 0;
    const rejectSourceRead = async () => {
      sourceReads += 1;
      throw new Error('Incomplete PAA must block before source body reads.');
    };
    const researcher = createResearcher({
      execution: { nowMs: () => Date.parse('2026-09-05T00:03:00.000Z') },
      apify: {
        startActor: async (actorId, input) => {
          supportStarts += 1;
          expect(actorId).toBe(SERP_ACTOR_ID);
          expect(input).toMatchObject({ countryCode: 'us', languageCode: 'en', maxPagesPerQuery: 1, mobileResults: false });
          const queries = String(input.queries).trim().split('\n');
          expect(queries.length).toBeLessThanOrEqual(7);
          supportQuery = queries[0];
          return { id: 'incomplete-support-run', status: 'SUCCEEDED', defaultDatasetId: 'incomplete-support-data', finishedAt: '2026-09-05T00:02:00.000Z' };
        },
        getRun: async () => { throw new Error('The support run is already complete.'); },
        getDatasetItems: async (datasetId) => {
          expect(datasetId).toBe('incomplete-support-data');
          return [{
            searchQuery: { term: supportQuery, device: 'DESKTOP', page: 1, countryCode: 'US', languageCode: 'en' },
            organicResults: [],
            peopleAlsoAsk: [{ question: complete.peopleAlsoAsk[1], answer: 'RAW_INCOMPLETE_PAA_ANSWER_MUST_NOT_BE_RETAINED' }],
            relatedQueries: [],
          }];
        },
        abortRun: async (id) => ({ id, status: 'ABORTED' }),
      },
      sourceChecker: { select: rejectSourceRead, selectWithContent: rejectSourceRead },
    });
    const f = fixture({ backlog: [target], observe: () => partial, inspect: researcher.inspect });

    const report = await f.worker.execute({ command: 'pilot', runId: 'incomplete-support-receipt' });

    expect(supportStarts).toBe(1);
    expect(sourceReads).toBe(0);
    expect(f.counters.inspected).toEqual([1]);
    expect(report.status).toBe('failed');
    expect(report.counts).toMatchObject({ drafted: 0, validated: 0, pullRequestsOpened: 0 });
    expect(f.counters).toMatchObject({ drafted: 0, validated: 0, opened: 0 });
    expect(report.artifacts).toEqual([]);
    expect(report.failures).toContainEqual(expect.objectContaining({ code: 'deep_inspection_failed' }));
    expect(partial).toEqual(original);
    expect(JSON.stringify({ report, state: f.getState() })).not.toContain('RAW_INCOMPLETE_PAA_ANSWER_MUST_NOT_BE_RETAINED');
    expect.soft(report.counts.deepInspected).toBe(1);
    expect.soft(f.getState().provenance[candidateFingerprints(target).candidate]).toMatchObject({
      serp: { runId: 'serp-run', datasetId: 'serp-data' },
      supportSearches: [{ actorId: SERP_ACTOR_ID, runId: 'incomplete-support-run', datasetId: 'incomplete-support-data', observedAt: '2026-09-05T00:02:00.000Z' }],
    });
  });

  it.each([
    { label: 'date-only timestamp', supportRunId: 'malformed-support-run', datasetId: 'malformed-support-data', finishedAt: '2026-09-05' },
    { label: 'secret-like run ID', supportRunId: 'apify_api_SYNTHETIC_REVIEW_RUN_ONLY', datasetId: 'synthetic-support-data', finishedAt: '2026-09-05T00:02:00.000Z' },
    { label: 'secret-like dataset ID', supportRunId: 'synthetic-support-run', datasetId: 'apify_api_SYNTHETIC_REVIEW_DATASET_ONLY', finishedAt: '2026-09-05T00:02:00.000Z' },
  ])('saves a failed real deep attempt without an unsafe receipt or stranded lease: $label', async ({ supportRunId, datasetId, finishedAt }) => {
    const target = candidate(1);
    const fingerprint = candidateFingerprints(target).candidate;
    const complete = withPaa(target);
    const partial = { ...complete, peopleAlsoAsk: complete.peopleAlsoAsk.slice(0, 1) };
    const original = structuredClone(partial);
    let supportStarts = 0;
    let datasetReads = 0;
    let sourceReads = 0;
    const rejectSourceRead = async () => {
      sourceReads += 1;
      throw new Error('Incomplete PAA must block before source body reads.');
    };
    const researcher = createResearcher({
      execution: { nowMs: () => Date.parse('2026-09-05T00:03:00.000Z') },
      apify: {
        startActor: async (actorId) => {
          supportStarts += 1;
          expect(actorId).toBe(SERP_ACTOR_ID);
          // These synthetic receipts pass collection's checks, but are not
          // safe persisted provenance. Exercise the real inspection error path.
          return { id: supportRunId, status: 'SUCCEEDED', defaultDatasetId: datasetId, finishedAt };
        },
        getRun: async () => { throw new Error('The support run is already complete.'); },
        getDatasetItems: async (requestedDatasetId) => {
          datasetReads += 1;
          expect(requestedDatasetId).toBe(datasetId);
          return [];
        },
        abortRun: async (id) => ({ id, status: 'ABORTED' }),
      },
      sourceChecker: { select: rejectSourceRead, selectWithContent: rejectSourceRead },
    });
    const f = fixture({
      backlog: [target], observe: () => partial, inspect: researcher.inspect,
      beforeSave: (state) => {
        expect(JSON.stringify(state.provenance)).not.toContain(supportRunId);
        expect(JSON.stringify(state.provenance)).not.toContain(datasetId);
      },
    });
    const runId = 'malformed-support-receipt';
    const execution = f.worker.execute({ command: 'pilot', runId });

    await expect(execution).resolves.toMatchObject({
      status: 'failed', artifacts: [],
      counts: { deepInspected: 1, drafted: 0, validated: 0, pullRequestsOpened: 0 },
      failures: expect.arrayContaining([expect.objectContaining({ code: 'deep_inspection_failed', candidateFingerprint: fingerprint })]),
    });
    const report = await execution;
    expect(supportStarts).toBe(1);
    expect(datasetReads).toBe(1);
    expect(sourceReads).toBe(0);
    expect(f.counters).toMatchObject({ inspected: [1], drafted: 0, validated: 0, opened: 0 });
    expect(f.counters.saved).toBeGreaterThan(1);
    const saved = f.getState();
    expect(saved.runs[runId]).toMatchObject({ status: 'failed' });
    expect(saved.decisions[fingerprint]).toMatchObject({
      status: 'retryable', reason: 'deep_inspection_failed', attempts: 1, leaseExpiresAt: null,
    });
    expect(saved.provenance[fingerprint]).toMatchObject({
      serp: { runId: 'serp-run', datasetId: 'serp-data', observedAt: '2026-09-05T00:00:00.000Z' },
      paa: { runId: 'paa-run', datasetId: 'paa-data' },
    });
    expect(saved.provenance[fingerprint]).not.toHaveProperty('supportSearches');
    expect(JSON.stringify({ report, saved })).not.toContain(supportRunId);
    expect(JSON.stringify({ report, saved })).not.toContain(datasetId);
    expect(saved.manualPilot).toBeNull();
    expect(partial).toEqual(original);
  });

  it('retains a returned deep support receipt before rejecting its invalid FAQ set', async () => {
    const target = candidate(1);
    const f = fixture({
      backlog: [target],
      observe: withPaa,
      inspectProvenance: withSupport,
      evidenceOverrides: { faqQuestions: [] },
    });

    const report = await f.worker.execute({ command: 'pilot', runId: 'invalid-faq-support-receipt' });

    expect(f.counters.inspected).toEqual([1]);
    expect(report.status).toBe('failed');
    expect(report.counts).toMatchObject({ deepInspected: 1, drafted: 0, validated: 0, pullRequestsOpened: 0 });
    expect(f.counters).toMatchObject({ drafted: 0, validated: 0, opened: 0 });
    expect(report.artifacts).toEqual([]);
    expect(report.failures).toContainEqual(expect.objectContaining({ code: 'deep_inspection_failed' }));
    expect(f.getState().provenance[candidateFingerprints(target).candidate]).toMatchObject({
      serp: { runId: 'serp-run', datasetId: 'serp-data' },
      paa: { runId: 'paa-run', datasetId: 'paa-data' },
      supportSearches: [{ actorId: 'support-search', runId: 'support-run', datasetId: 'support-data', observedAt: '2026-09-05T00:02:00.000Z' }],
    });
  });

  it('writes full collector provenance and question-only PAA observations to artifact reports', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoblogger-provenance-'));
    const { worker, getState } = fixture({
      backlog: [candidate(1)], inspectProvenance: withSupport,
      observe: (item) => {
        const observed = withPaa(item);
        return { ...observed, paaObservations: observed.paaObservations?.map((row) => ({ ...row, answer: 'RAW_ANSWER_MUST_NOT_BE_RETAINED' })) };
      },
    });
    const report = await worker.execute({ command: 'pilot', runId: 'separate-provenance' });
    expect(report.status).toBe('validated');
    await writeAutobloggerArtifacts(report, root, root);
    const written = await readFile(join(root, 'run-report.json'), 'utf8');
    const artifact = JSON.parse(written).artifacts[0];
    expect(artifact.researchProvenance).toEqual({
      discovery: { actorId: 'autocomplete', runId: 'discovery-run', datasetId: 'discovery-data', observedAt: '2026-09-05T00:00:00.000Z' },
      serp: { actorId: 'serp', runId: 'serp-run', datasetId: 'serp-data', observedAt: '2026-09-05T00:00:00.000Z' },
      paa: paaCollector,
      paaAttempts: [{ ...paaCollector, runId: 'paa-first-empty' }, paaCollector],
      supportSearches: [supportCollector],
    });
    expect(artifact.paaObservations).toEqual([{
      ...paaCollector, query: 'founder video evidence topic 1', question: 'What is founder video evidence topic 1?',
      parentQuestion: null, country: 'US', language: 'en', position: 1,
    }]);
    expect(artifact.serpProvenance.runId).toBe('serp-run');
    expect(written).not.toContain('RAW_ANSWER_MUST_NOT_BE_RETAINED');
    expect(getState().provenance[candidateFingerprints(candidate(1)).candidate]).toMatchObject({ paa: paaCollector, supportSearches: [supportCollector] });
  });

  it('retains deep support-query PAA metadata instead of reverting to shallow-only observations', async () => {
    const question = 'How do you plan founder video evidence topic 1?';
    const observations = [{...supportCollector, query: 'What is founder video evidence topic 1?',
      question, parentQuestion: null, country: 'US' as const,
      language: 'en' as const, position: 2, answer: 'RAW_DEEP_ANSWER_MUST_NOT_BE_RETAINED'}];
    const f = fixture({backlog: [candidate(1)], observe: withPaa, inspectProvenance: withSupport,
      inspectObservations: observations});
    const report = await f.worker.execute({command: 'pilot', runId: 'deep-paa-provenance'});
    expect(report.status).toBe('validated');
    expect(report.artifacts[0].paaObservations).toEqual([{
      ...supportCollector, query: 'What is founder video evidence topic 1?', question,
      parentQuestion: null, country: 'US', language: 'en', position: 2,
    }]);
    expect(report.artifacts[0].serpProvenance.runId).toBe('serp-run');
    expect(JSON.stringify(report)).not.toContain('RAW_DEEP_ANSWER_MUST_NOT_BE_RETAINED');
  });

  it('allows bounded deep discovery to complete a partial PAA set before drafting', async () => {
    const item=candidate(1), complete=shallow(item);
    const f=fixture({backlog:[item],observe:()=>({...complete,peopleAlsoAsk:complete.peopleAlsoAsk.slice(0,1)}),
      evidenceOverrides:{signals:{autocomplete:complete.suggestions,peopleAlsoAsk:complete.peopleAlsoAsk,relatedSearches:complete.relatedQueries},
        serp:{organicResultCount:2,peopleAlsoAsk:complete.peopleAlsoAsk},faqQuestions:complete.peopleAlsoAsk}});
    const report=await f.worker.execute({command:'pilot',runId:'deep-completes-paa'});
    expect(f.counters.inspected).toEqual([1]);
    expect(report.counts).toMatchObject({deepInspected:1,drafted:1,validated:1});
    expect(report.status).toBe('validated');
  });

  describe.each(['run', 'pilot', 'research'] as const)('%s shallow selection', (command) => {
    it.each([
      { label: 'zero organic results', reasons: 'missing_serp', patch: { organicResults: [] } },
      { label: 'no discovery signals', reasons: 'missing_suggestion_signal', patch: { suggestions: [], peopleAlsoAsk: [], relatedQueries: [] } },
      { label: 'no product relevance', reasons: 'missing_product_relevance', patch: {} },
      { label: 'no product relevance and empty organic results', reasons: 'missing_serp,missing_product_relevance', patch: { organicResults: [] } },
    ])('excludes high-scoring candidates with $label before spending the ten deep slots', async ({ reasons, patch }) => {
      const retryable = !reasons.includes('missing_product_relevance');
      const backlog = Array.from({ length: 21 }, (_unused, index) => (
        index < 10 && !retryable
          ? { ...candidate(index), primaryKeyword: `payroll tax setup ${index}`, title: `Payroll Tax Setup ${index}`, icp: 'payroll operators' }
          : candidate(index)
      ));
      const { worker, counters, getState } = fixture({
        backlog,
        observe: (item) => Number(item.slug.split('-').at(-1)) < 10 ? { ...shallow(item), ...patch } : shallow(item),
        metricsOverrides: (index) => ({
          provider: 'semrush', observedAt: '2026-09-05T00:00:00.000Z', volume: index < 10 ? 10_000 : index + 1,
        }),
      });

      const report = await worker.execute({ command, runId: `shallow-${command}` });

      expect(counters.inspected).toHaveLength(10);
      expect(counters.inspected.every((index) => index >= 10)).toBe(true);
      expect(counters.inspected).toContain(20);
      expect(counters.enriched).toBe(retryable ? 21 : 11);
      expect(report.counts).toMatchObject({
        scanned: 21, metricsEnriched: retryable ? 21 : 11,
        deepInspected: 10, eligible: command === 'research' ? 0 : 10,
        drafted: command === 'research' ? 0 : command === 'pilot' ? 1 : 3,
      });
      for (const item of backlog.slice(0, 10)) {
        const fingerprint = candidateFingerprints(item).candidate;
        expect(getState().decisions[fingerprint]).toMatchObject({
          status: retryable ? 'retryable' : 'terminal',
          reason: `${retryable ? 'insufficient_data' : 'ineligible'}:${reasons}`, attempts: 1, leaseExpiresAt: null,
        });
        if (retryable) expect(getState().queuedCandidates).toContainEqual(item);
        else expect(getState().queuedCandidates).not.toContainEqual(item);
        expect(report.failures).toContainEqual({
          candidateFingerprint: fingerprint, code: 'not_selected_for_deep_inspection', detail: reasons, retryable, attempt: 1,
        });
      }
      expect(report.failures).toHaveLength(10);
      if (command === 'pilot') expect(getState().manualPilot?.status).toBe('prepared');
    });

    it.each(['generic', 'duplicate'])('still blocks %s deep PAA before drafting, within ten slots', async kind => {
      const f=fixture({backlogCount:21, observe:item=>({...shallow(item),peopleAlsoAsk:kind==='generic'
        ? ['Which video codec is best?', 'What are payroll taxes?', 'How does video compression work?']
        : Array(3).fill(`What is ${item.primaryKeyword}?`)})});
      const report=await f.worker.execute({command,runId:`deep-paa-${command}-${kind}`});
      expect(f.counters.inspected).toHaveLength(10);
      expect(report.counts).toMatchObject({deepInspected:10,eligible:0,drafted:0,validated:0,pullRequestsOpened:0});
      expect(report.artifacts).toEqual([]);
      expect(report.failures.filter(failure=>failure.code==='deep_inspection_failed')).toHaveLength(10);
      expect(f.getState().manualPilot).toBeNull();
    });
  });

  it.each(['run', 'pilot', 'research'] as const)('rejects product irrelevance before a failing metrics provider in %s while retaining relevant retries', async (command) => {
    const irrelevant = { ...candidate(0), primaryKeyword: 'payroll tax setup', title: 'Payroll Tax Setup', icp: 'payroll operators' };
    const relevant = candidate(1);
    const requestedKeywords: string[] = [];
    const { worker, counters, getState } = fixture({
      backlog: [irrelevant, relevant],
      keywordProvider: {
        enrich: async ({ keyword }) => {
          requestedKeywords.push(keyword);
          throw new Error('temporary metrics provider outage');
        },
      },
    });

    const report = await worker.execute({ command, runId: `irrelevant-provider-failure-${command}` });
    const irrelevantFingerprint = candidateFingerprints(irrelevant).candidate;
    const relevantFingerprint = candidateFingerprints(relevant).candidate;

    expect(getState().decisions[irrelevantFingerprint]).toMatchObject({
      status: 'terminal', reason: 'ineligible:missing_product_relevance', attempts: 1, leaseExpiresAt: null,
    });
    expect(requestedKeywords).toEqual([relevant.primaryKeyword]);
    expect(getState().queuedCandidates).not.toContainEqual(irrelevant);
    expect(getState().decisions[relevantFingerprint]).toMatchObject({
      status: 'retryable', reason: 'keyword_enrichment_failed', attempts: 1, leaseExpiresAt: null,
    });
    expect(getState().queuedCandidates).toContainEqual(relevant);
    expect(report.failures.filter(({ candidateFingerprint }) => candidateFingerprint === irrelevantFingerprint)).toEqual([{
      candidateFingerprint: irrelevantFingerprint, code: 'not_selected_for_deep_inspection',
      detail: 'missing_product_relevance', retryable: false, attempt: 1,
    }]);
    expect(report.failures).toContainEqual(expect.objectContaining({
      candidateFingerprint: relevantFingerprint, code: 'keyword_enrichment_failed', retryable: true, attempt: 1,
    }));
    expect(report.counts).toMatchObject({ scanned: 2, metricsEnriched: 0, deepInspected: 0, eligible: 0, drafted: 0 });
    expect(counters.inspected).toEqual([]);
    expect(getState().manualPilot).toBeNull();
  });

  it.each([
    { label: 'pending provider', metrics: { provider: 'pending' as const, volume: 10_000, difficulty: 0 } },
    { label: 'missing volume', metrics: { volume: null, difficulty: 0 } },
    { label: 'missing difficulty', metrics: { volume: 10_000, difficulty: null } },
  ])('excludes scheduled candidates with $label before ranking', async ({ metrics }) => {
    const { worker, counters, getState } = fixture({
      backlogCount: 11,
      observe: (item) => {
        const observation = shallow(item);
        return Number(item.slug.split('-').at(-1)) < 10
          ? { ...observation, suggestions: Array.from({ length: 100 }, (_unused, index) => `${item.primaryKeyword} guide ${index}`) }
          : observation;
      },
      metricsOverrides: (index) => index < 10 ? metrics : { volume: 0, difficulty: 0 },
    });

    const report = await worker.execute({ command: 'run', runId: 'scheduled-metrics-shortlist' });

    expect(counters.inspected).toEqual([10]);
    expect(report.counts).toMatchObject({ deepInspected: 1, eligible: 1, drafted: 1 });
    for (let index = 0; index < 10; index += 1) {
      const fingerprint = candidateFingerprints(candidate(index)).candidate;
      expect(getState().decisions[fingerprint]).toMatchObject({
        status: 'retryable', reason: 'insufficient_data:scheduled_requires_observed_volume_and_difficulty', attempts: 1,
      });
      expect(getState().queuedCandidates).toContainEqual(candidate(index));
      expect(report.failures).toContainEqual(expect.objectContaining({
        candidateFingerprint: fingerprint, code: 'not_selected_for_deep_inspection',
        detail: 'scheduled_requires_observed_volume_and_difficulty', retryable: true,
      }));
    }
  });

  it.each(['run', 'pilot', 'research'] as const)('bounds insufficient-data retries at three attempts in %s without deferring or resetting them', async (command) => {
    const item = candidate(0);
    const fingerprint = candidateFingerprints(item).candidate;
    const reasons = 'missing_suggestion_signal';
    const { worker, counters, getState } = fixture({
      backlog: [item],
      observe: (candidate) => ({ ...shallow(candidate), suggestions: [], peopleAlsoAsk: [], relatedQueries: [] }),
    });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const report = await worker.execute({ command, runId: `insufficient-${command}-${attempt}` });

      expect(report.counts).toMatchObject({ scanned: 1, deepInspected: 0, eligible: 0, drafted: 0 });
      expect(getState().decisions[fingerprint]).toMatchObject({
        status: attempt < 3 ? 'retryable' : 'terminal',
        reason: `insufficient_data:${reasons}`, attempts: attempt, leaseExpiresAt: null,
      });
      expect(report.failures).toContainEqual({
        candidateFingerprint: fingerprint, code: 'not_selected_for_deep_inspection', detail: reasons,
        retryable: attempt < 3, attempt,
      });
      expect(getState().queuedCandidates).toEqual(attempt < 3 ? [item] : []);
      expect(getState().manualPilot).toBeNull();
    }

    const terminal = getState().decisions[fingerprint];
    const fourth = await worker.execute({ command, runId: `insufficient-${command}-4` });
    expect(fourth.counts.scanned).toBe(0);
    expect(getState().decisions[fingerprint]).toEqual(terminal);
    expect(counters.inspected).toEqual([]);
  });

  it.each([
    { label: 'missing sources', evidence: { sources: [] }, reason: 'missing_sources' },
    { label: 'a different candidate', evidence: { candidateFingerprint: candidateFingerprints(candidate(99)).candidate }, reason: 'evidence_candidate_mismatch' },
    { label: 'missing FAQs', evidence: { faqQuestions: [] }, reason: 'deep_inspection_failed' },
  ])('still rejects deep evidence with $label after passing shallow checks', async ({ evidence, reason }) => {
    const { worker, counters, getState } = fixture({ backlogCount: 1, evidenceOverrides: evidence });

    const report = await worker.execute({ command: 'pilot', runId: 'deep-evidence-gates' });

    expect(counters.inspected).toEqual([0]);
    expect(report.counts).toMatchObject({ deepInspected: 1, eligible: 0, drafted: 0 });
    expect(report.artifacts).toEqual([]);
    expect(getState().decisions[candidateFingerprints(candidate(0)).candidate].reason).toContain(reason);
    expect(getState().manualPilot).toBeNull();
  });

  it('retains a discovered candidate during a live lease and recovers it after expiry', async () => {
    const discovered = candidate(99);
    const initialState = reserveCandidate({ ...createPersistentWorkerState(), queuedCandidates: [discovered] }, discovered, 'prior-run', 'scheduled', '2026-09-05T00:00:00.000Z');
    let clock = new Date('2026-09-05T00:05:00.000Z');
    const { worker, getState } = fixture({ backlogCount: 0, initialState, now: () => clock });
    const immediate = await worker.execute({ command: 'run', runId: 'immediate-retry' });
    expect(immediate.counts.scanned).toBe(0);
    expect(getState().queuedCandidates).toContainEqual(discovered);
    clock = new Date('2026-09-05T00:35:00.000Z');
    const recovered = await worker.execute({ command: 'run', runId: 'after-lease-expiry' });
    expect(recovered.counts.scanned).toBe(1);
    expect(recovered.counts.drafted).toBe(1);
  });

  it('cannot produce a second pilot after artifact output succeeds but final state saving fails', async () => {
    let artifactWritten = false;
    let clock = new Date('2026-09-05T00:00:00.000Z');
    const { worker, getState } = fixture({ backlogCount: 2, now: () => clock,
      persistArtifact: async () => { artifactWritten = true; },
      beforeSave: () => { if (artifactWritten) throw new Error('temporary state outage'); },
    });
    await expect(worker.execute({ command: 'pilot', runId: 'pilot-state-outage' })).rejects.toThrow(/state outage/);
    expect(artifactWritten).toBe(true);
    expect(getState().manualPilot).toMatchObject({ status: 'prepared', leaseExpiresAt: null });
    clock = new Date('2026-09-05T01:00:00.000Z');
    await expect(worker.execute({ command: 'pilot', runId: 'later-pilot' })).rejects.toThrow(/already reserved, prepared, or consumed/);
  });

  it('retains the observed seed as a secondary term for newly discovered opportunities', () => {
    const seed = candidate(0);
    const discovered = discoverCandidatesFromResearch([shallow(seed)], [seed]);
    expect(discovered.length).toBeGreaterThan(0);
    for (const item of discovered) {
      expect(item.secondaryKeywords).toEqual([seed.primaryKeyword]);
      expect(item.primaryKeyword).not.toBe(seed.primaryKeyword);
    }
  });

  it('retains research-only candidates for drafting and stores provenance for all scanned keywords', async () => {
    const { worker, getState } = fixture({ backlogCount: 5 });
    const report = await worker.execute({ command: 'research', runId: 'research-before-drafting' });
    expect(report.status).toBe('researched');
    expect(Object.keys(getState().provenance)).toHaveLength(5);
    for (const item of Array.from({ length: 5 }, (_, index) => candidate(index))) {
      expect(getState().queuedCandidates).toContainEqual(item);
      expect(getState().decisions[candidateFingerprints(item).candidate]).toMatchObject({ status: 'retryable', reason: 'research_ready_for_drafting', attempts: 0 });
    }
    const next = await worker.execute({ command: 'run', runId: 'draft-after-research' });
    expect(next.counts.drafted).toBeGreaterThan(0);
  });

  it('saves all scanned candidates before paid research and bounds scan retries', async () => {
    let savedBeforeScan = false;
    const { worker, getState } = fixture({ backlogCount: 2, failScan: true, onReservation: (state) => {
      if (Object.values(state.decisions).some(({ status }) => status === 'leased')) {
        savedBeforeScan = state.queuedCandidates.length === 2;
      }
    } });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await expect(worker.execute({ command: 'run', runId: `scan-failure-${attempt}` })).rejects.toThrow(/network/);
    }
    expect(savedBeforeScan).toBe(true);
    expect(Object.values(getState().decisions).every((decision) => decision.status === 'terminal' && decision.attempts === 3)).toBe(true);
  });

  it('retains deferred and retryable discovered candidates and enforces one draft when requested', async () => {
    const { worker, getState } = fixture({ maxDrafts: 1 });
    const result = await worker.execute({ command: 'run', runId: 'one-article-run' });
    expect(result.artifacts).toHaveLength(1);
    const retryable = Object.entries(getState().decisions).filter(([, value]) => value.status === 'retryable');
    expect(retryable.length).toBe(9);
    expect(retryable.every(([key]) => getState().queuedCandidates.some((candidate) => candidateFingerprints(candidate).candidate === key))).toBe(true);
  });

  it('retains distinct rejection categories instead of truncating later editorial failures behind quoted prose', async () => {
    const { worker, counters, getState } = fixture({ backlogCount: 1, blockedFindings: [
      { code: 'content.claim_binding', message: `A quoted span ${'long text '.repeat(100)}` },
      { code: 'content.claim_binding', message: 'Another rejected reference.' },
      { code: 'TITLE_SCOPE_MISMATCH', message: 'Missing recording instructions.' },
      { code: 'critique.support_rejected', message: 'Unsupported checklist detail.' },
    ] });
    const result = await worker.execute({ command: 'pilot', runId: 'compact-rejection' });
    const detail = result.failures[0].detail;
    expect(detail).toContain('content.claim_binding=2');
    expect(detail).toContain('TITLE_SCOPE_MISMATCH=1');
    expect(detail).toContain('critique.support_rejected=1');
    expect(detail).not.toContain('quoted span');
    expect(detail.length).toBeLessThanOrEqual(500);
    expect(result.status).toBe('failed');
    expect(counters.validated).toBe(0);
    expect(counters.opened).toBe(0);
    expect(getState().failures.at(-1)?.detail).toBe(detail);
  });
  it('bounds and sanitizes unexpected finding codes without logging their messages', async () => {
    const { worker } = fixture({ backlogCount: 1, blockedFindings: [
      { code: 'not a code: private prose', message: 'private prose' },
      ...Array.from({ length: 40 }, (_, index) => ({ code: `code_${index}_${'x'.repeat(50)}`, message: 'private prose' })),
    ] });
    const result = await worker.execute({ command: 'pilot', runId: 'bounded-rejection' });
    expect(result.failures[0].detail).toContain('unrecognized_finding=1');
    expect(result.failures[0].detail).toMatch(/additional finding types/);
    expect(result.failures[0].detail).not.toContain('private prose');
    expect(result.failures[0].detail.length).toBeLessThanOrEqual(500);
  });
  it('does not consume a failed pilot and preserves real retry attempts', async () => {
    const { worker, getState } = fixture({ backlogCount: 1, failDraft: true });
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await worker.execute({ command: 'pilot', runId: `failed-pilot-${attempt}` });
      expect(result.artifacts).toHaveLength(0);
      expect(getState().manualPilot).toBeNull();
      expect(Object.values(getState().decisions)[0].attempts).toBe(attempt);
    }
    expect(Object.values(getState().decisions)[0].status).toBe('terminal');
  });
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
    expect(getState().manualPilot?.status).toBe('prepared');

    const repeated = await worker.execute({ command: 'pilot', runId: 'fixture-pilot-1' });
    expect(repeated.status).toBe('already_recorded');
    expect(counters.scanned).toBe(50);

    await expect(worker.execute({ command: 'pilot', runId: 'fixture-pilot-2' })).rejects.toThrow(/pilot.*already/i);
    expect(counters.opened).toBe(0);
  });

  it('preserves the unscanned backlog tail and records a decision for every shallow scan', async () => {
    const { worker, getState } = fixture({ backlogCount: 75 });
    const report = await worker.execute({ command: 'research', runId: 'fixture-tail-1' });
    expect(report.counts.scanned).toBe(50);
    expect(Object.keys(getState().decisions)).toHaveLength(50);
    expect(getState().queuedCandidates.some(({ articleId }) => articleId === candidate(74).articleId)).toBe(true);

    const rerun = await worker.execute({ command: 'research', runId: 'fixture-tail-2' });
    expect(rerun.counts.scanned).toBeGreaterThanOrEqual(25);
    expect(rerun.counts.scanned).toBeLessThanOrEqual(50);
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
