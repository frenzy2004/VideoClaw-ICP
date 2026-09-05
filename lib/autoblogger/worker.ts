import { createHash } from 'node:crypto';

import {
  CAMPAIGN_IDS,
  CandidateSchema,
  candidateFingerprints,
  normalizeKeyword,
  normalizeSlug,
  normalizeTitle,
  type Candidate,
  type DraftBundle,
  type KeywordMetrics,
  type RunRecord,
} from './domain';
import type { DraftingContext } from './content-bundle';
import type { DraftingOutcome } from './drafting';
import type { KeywordEnrichment, KeywordProvider, KeywordProvenance } from './keyword-providers';
import {
  compactPersistentWorkerState,
  createPersistentWorkerState,
  type GitHubStateStore,
  type PersistentWorkerState,
} from './github-runtime';
import { RUN_LIMITS, evaluateEligibility, evaluateProductRelevance, type RunMode } from './policies';
import type {
  ApprovedPublicationMedia,
  GitHubAppInstallationAuth,
  OpenDraftPullRequestResult,
  Publisher,
  PublisherOrigin,
} from './publisher';
import type { ResearchBatch, ResearchResult, ShallowResearchBatch, ShallowResearchResult } from './research';
import {
  buildIncrementalQueue,
  candidateIdentityList,
  deferCandidate,
  markCandidateCompleted,
  markCandidateFailure,
  markCandidateScanned,
  markManualPilotPrepared,
  reserveCandidate,
  reserveManualPilot,
  type RecoveryInventoryEntry,
} from './recovery';
import { recordRun } from './state';
import { redactSensitive } from './secrets';

type Researcher = {
  scan(candidates: Candidate[]): Promise<ShallowResearchBatch>;
  inspect(candidates: ShallowResearchResult[]): Promise<ResearchBatch>;
};

type Drafter = { draft(context: DraftingContext): Promise<DraftingOutcome> };
type InventoryEntry = RecoveryInventoryEntry & { number?: number; url?: string; headRef?: string };

export type AutobloggerCommand = 'research' | 'pilot' | 'run';

export type AutobloggerArtifact = {
  candidateFingerprint: string;
  intentFingerprint: string;
  articleId: string;
  slug: string;
  icp: string;
  publication: 'artifact_only' | 'opened' | 'already_exists' | 'reconciliation_required';
  bundle: DraftBundle;
  metrics: KeywordMetrics;
  keywordProvenance: KeywordProvenance;
  serpProvenance: ResearchResult['provenance']['serp'];
  publicationOrigin: PublisherOrigin;
  validation: Awaited<ReturnType<Publisher['validateBundle']>>;
  pullRequest?: { number: number; url: string; headRef: string };
};

export type AutobloggerRunReport = {
  schemaVersion: 1;
  command: AutobloggerCommand;
  runId: string;
  mode: RunMode;
  status: 'researched' | 'validated' | 'pr_opened' | 'failed' | 'already_recorded';
  startedAt: string;
  completedAt: string;
  limits: typeof RUN_LIMITS;
  counts: {
    queued: number;
    scanned: number;
    shallowValidated: number;
    metricsEnriched: number;
    deepInspected: number;
    eligible: number;
    drafted: number;
    validated: number;
    pullRequestsOpened: number;
  };
  artifacts: AutobloggerArtifact[];
  failures: Array<{ candidateFingerprint?: string; code: string; detail: string; retryable?: boolean; attempt?: number }>;
};

export type AutobloggerWorkerOptions = {
  backlog: Candidate[];
  stateStore: GitHubStateStore;
  researcher: Researcher;
  keywordProvider: KeywordProvider;
  drafter: Drafter;
  buildDraftContext(input: { result: ResearchResult; shallow: ShallowResearchResult; metrics: KeywordMetrics }): DraftingContext;
  publisher: Publisher;
  landerRef: string;
  approvedMedia: ApprovedPublicationMedia;
  landerInventory?: InventoryEntry[];
  openPullRequestInventory?: InventoryEntry[];
  branchInventory?: string[];
  githubAuth?: GitHubAppInstallationAuth;
  publicationEnabled?: boolean;
  maxDrafts?: 1 | 2 | 3;
  persistArtifact?: (artifact: AutobloggerArtifact, report: AutobloggerRunReport) => Promise<void>;
  now?: () => Date;
};

function safeDetail(error: unknown): string {
  return redactSensitive(error).replace(/[\r\n]+/gu, ' ').slice(0, 500);
}

function recordPersistent(state: PersistentWorkerState, run: RunRecord): PersistentWorkerState {
  const core = recordRun({ schemaVersion: 1, candidates: state.candidates, runs: state.runs }, run);
  return { ...state, runs: core.runs };
}

function identityKey(candidate: Candidate): string[] {
  return candidateIdentityList(candidate);
}

function normalizedInventoryIdentities(entry: InventoryEntry): string[] {
  return [
    entry.articleId ? `article:${entry.articleId.toLocaleLowerCase('en-US')}` : undefined,
    entry.intentFingerprint,
    entry.primaryKeyword ? `keyword:${normalizeKeyword(entry.primaryKeyword)}` : undefined,
    entry.title ? `title:${normalizeTitle(entry.title)}` : undefined,
    entry.slug ? `slug:${normalizeSlug(entry.slug)}` : undefined,
  ].filter((value): value is string => Boolean(value));
}

function matchingCandidate(entry: InventoryEntry, candidates: Candidate[]): Candidate | undefined {
  const identities = new Set(normalizedInventoryIdentities(entry));
  const matches = candidates.filter((candidate) => identityKey(candidate).some((identity) => identities.has(identity)));
  if (matches.length > 1) throw new Error('Target inventory identity collision matched multiple candidates.');
  return matches[0];
}

function reconcileTargetInventory(
  stateInput: PersistentWorkerState,
  candidates: Candidate[],
  options: AutobloggerWorkerOptions,
  at: string,
): PersistentWorkerState {
  let state = stateInput;
  for (const entry of options.landerInventory ?? []) {
    const candidate = matchingCandidate(entry, candidates);
    if (candidate) state = markCandidateCompleted(state, candidate, 'startup-reconciliation', 'existing_lander_article', at);
  }
  for (const entry of options.openPullRequestInventory ?? []) {
    const candidate = matchingCandidate(entry, candidates);
    if (!candidate) continue;
    state = markCandidateCompleted(state, candidate, 'startup-reconciliation', 'existing_open_pull_request', at);
    if (entry.number && entry.url) {
      state = {
        ...state,
        pullRequests: {
          ...state.pullRequests,
          [candidateFingerprints(candidate).candidate]: { number: entry.number, url: entry.url, status: 'already_exists' },
        },
      };
    }
  }
  for (const ref of options.branchInventory ?? []) {
    const slug = ref.match(/^autoblog\/\d{4}-\d{2}-\d{2}-(.+)$/u)?.[1];
    if (!slug) continue;
    const candidate = matchingCandidate({ slug }, candidates);
    if (candidate && state.decisions[candidateFingerprints(candidate).candidate]?.status !== 'completed') {
      state = markCandidateFailure(state, candidate, 'startup-reconciliation', 'reconciliation_required', false, at);
    }
  }
  return state;
}

function titleCase(value: string): string {
  return normalizeKeyword(value).split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function discoveredArticleId(candidate: Candidate, keyword: string): string {
  const campaignIndex = CAMPAIGN_IDS.indexOf(candidate.campaignId) + 1;
  const digest = createHash('sha256').update(`${candidate.campaignId}\n${keyword}`).digest('hex').slice(0, 16);
  return `vc-c${campaignIndex}-d-${digest}`;
}

export function discoverCandidatesFromResearch(research: ShallowResearchResult[], existing: Candidate[]): Candidate[] {
  const used = new Map<string, string>();
  for (const candidate of existing) {
    for (const identity of identityKey(candidate)) {
      const prior = used.get(identity);
      if (prior && prior !== candidateFingerprints(candidate).candidate) throw new Error('Existing candidate identity collision.');
      used.set(identity, candidateFingerprints(candidate).candidate);
    }
  }
  const discovered: Candidate[] = [];
  for (const observation of research) {
    const exactTitle = observation.organicResults.some(({ title }) => normalizeTitle(title) === normalizeKeyword(observation.candidate.primaryKeyword));
    const signals = [
      ...observation.suggestions,
      ...observation.peopleAlsoAsk,
      ...observation.relatedQueries,
      ...(!exactTitle ? [`${observation.candidate.primaryKeyword} examples`] : []),
    ];
    for (const signal of signals) {
      const keyword = normalizeKeyword(signal).slice(0, 180);
      const slug = normalizeSlug(keyword).slice(0, 160).replace(/-+$/u, '');
      if (!keyword || !slug) continue;
      const parsed = CandidateSchema.safeParse({
        schemaVersion: 1,
        articleId: discoveredArticleId(observation.candidate, keyword),
        campaignId: observation.candidate.campaignId,
        icp: observation.candidate.icp,
        primaryKeyword: keyword,
        secondaryKeywords: [observation.candidate.primaryKeyword],
        title: titleCase(keyword),
        slug,
        intent: observation.candidate.intent,
        funnelStage: observation.candidate.funnelStage,
      });
      if (!parsed.success) continue;
      if (identityKey(parsed.data).some((identity) => used.has(identity))) continue;
      const fingerprint = candidateFingerprints(parsed.data).candidate;
      identityKey(parsed.data).forEach((identity) => used.set(identity, fingerprint));
      discovered.push(parsed.data);
      if (discovered.length === 250) return discovered;
    }
  }
  return discovered;
}

function preliminaryScore(observation: ShallowResearchResult, metrics: KeywordMetrics): number {
  const demand = metrics.volume ?? 0;
  const difficulty = metrics.difficulty ?? 50;
  const normalized = normalizeKeyword(observation.candidate.primaryKeyword);
  const exactTitles = observation.organicResults.filter(({ title }) => normalizeTitle(title) === normalized).length;
  const gap = Math.max(0, 10 - exactTitles * 3);
  const funnel = observation.candidate.funnelStage === 'bottom' ? 10 : observation.candidate.funnelStage === 'middle' ? 6 : 3;
  return demand - difficulty
    + observation.suggestions.length * 3
    + observation.peopleAlsoAsk.length * 2
    + observation.relatedQueries.length * 2
    + gap
    + (evaluateProductRelevance(observation.candidate) ? 20 : -100)
    + funnel;
}

function deepEvidenceScore(result: ResearchResult): number {
  const authoritativeSources = result.evidence.sources.filter(({ authoritative }) => authoritative).length;
  return Math.min(result.evidence.sources.length, 5) * 2
    + Math.min(authoritativeSources, 3) * 4
    + Math.min(result.evidence.faqQuestions.length, 3);
}

type DeepOpportunity = {
  result: ResearchResult;
  shallow: ShallowResearchResult;
  enrichment: KeywordEnrichment;
  score: number;
};

function selectWithIcpCap(items: DeepOpportunity[], mode: RunMode, maxDrafts = RUN_LIMITS.maxDrafts as number): DeepOpportunity[] {
  const maximum = mode === 'manual_pilot' ? 1 : Math.min(maxDrafts, RUN_LIMITS.maxDrafts);
  const perIcp = new Map<string, number>();
  const selected: DeepOpportunity[] = [];
  for (const item of [...items].sort((left, right) => (
    right.score - left.score
    || candidateFingerprints(left.result.candidate).candidate.localeCompare(candidateFingerprints(right.result.candidate).candidate)
  ))) {
    const count = perIcp.get(item.result.candidate.icp) ?? 0;
    if (count >= RUN_LIMITS.maxDraftsPerIcp) continue;
    selected.push(item);
    perIcp.set(item.result.candidate.icp, count + 1);
    if (selected.length === maximum) break;
  }
  return selected;
}

function emptyReport(command: AutobloggerCommand, runId: string, mode: RunMode, at: string): AutobloggerRunReport {
  return {
    schemaVersion: 1,
    command,
    runId,
    mode,
    status: 'failed',
    startedAt: at,
    completedAt: at,
    limits: RUN_LIMITS,
    counts: { queued: 0, scanned: 0, shallowValidated: 0, metricsEnriched: 0, deepInspected: 0, eligible: 0, drafted: 0, validated: 0, pullRequestsOpened: 0 },
    artifacts: [],
    failures: [],
  };
}

function artifactHash(bundle: DraftBundle): string {
  return createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
}

function isRetryableError(error: unknown): boolean {
  return /timeout|timed out|temporary|rate limit|429|5\d\d|network|socket|source/i.test(String(error));
}

function mergeCandidateQueue(...groups: Candidate[][]): Candidate[] {
  const seen = new Set<string>();
  const merged: Candidate[] = [];
  for (const candidate of groups.flat()) {
    const fingerprint = candidateFingerprints(candidate).candidate;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    merged.push(candidate);
    if (merged.length === 500) break;
  }
  return merged;
}

export function createAutobloggerWorker(options: AutobloggerWorkerOptions) {
  if (options.maxDrafts !== undefined && (![1, 2, 3].includes(options.maxDrafts))) throw new Error('maxDrafts must be 1, 2, or 3.');
  const now = options.now ?? (() => new Date());
  return {
    async execute(input: { command: AutobloggerCommand; runId: string }): Promise<AutobloggerRunReport> {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(input.runId)) throw new Error('runId is invalid.');
      const mode: RunMode = input.command === 'pilot' ? 'manual_pilot' : 'scheduled';
      const startedAt = now().toISOString();
      const report = emptyReport(input.command, input.runId, mode, startedAt);
      let { state, version } = await options.stateStore.load();
      state = state ?? createPersistentWorkerState();
      if (state.runs[input.runId]) {
        report.status = 'already_recorded';
        return report;
      }

      const allKnownCandidates = [...state.queuedCandidates, ...options.backlog];
      state = reconcileTargetInventory(state, allKnownCandidates, options, startedAt);
      if (mode === 'manual_pilot') state = reserveManualPilot(state, input.runId, startedAt);
      const inventory = [...(options.landerInventory ?? []), ...(options.openPullRequestInventory ?? [])];
      const queue = buildIncrementalQueue({ state, backlog: options.backlog, inventory, now: startedAt });
      state = queue.state;
      // A live lease is excluded from this scan, not from durable queue storage.
      const heldCandidates = state.queuedCandidates.filter((candidate) => ['leased', 'manual_attention'].includes(
        state.decisions[candidateFingerprints(candidate).candidate]?.status,
      ));
      report.counts.queued = queue.all.length;
      // Persist the full scanned candidates before paid work so an interrupted
      // run can recover a discovered candidate as well as a backlog entry.
      state = { ...state, queuedCandidates: mergeCandidateQueue(heldCandidates, queue.scan, queue.tail) };
      for (const candidate of queue.scan) {
        state = reserveCandidate(state, candidate, input.runId, mode, startedAt);
      }
      const reserved = await options.stateStore.save(compactPersistentWorkerState(state), version);
      version = reserved.version;

      let shallowBatch: ShallowResearchBatch;
      try {
        shallowBatch = await options.researcher.scan(queue.scan);
      } catch (error) {
        for (const candidate of queue.scan) {
          state = markCandidateFailure(state, candidate, input.runId, 'shallow_research_failed', true, now().toISOString());
        }
        if (mode === 'manual_pilot' && state.manualPilot?.runId === input.runId) state = { ...state, manualPilot: null };
        await options.stateStore.save(compactPersistentWorkerState(state), version);
        throw error;
      }
      if (shallowBatch.scannedCount !== queue.scan.length || shallowBatch.results.length !== queue.scan.length) {
        throw new Error('Researcher must return one shallow US/en SERP result for every queued candidate.');
      }
      report.counts.scanned = shallowBatch.scannedCount;
      report.counts.shallowValidated = shallowBatch.results.length;
      for (const observation of shallowBatch.results) {
        state = markCandidateScanned(state, observation.candidate, input.runId, now().toISOString());
      }

      const enrichmentByFingerprint = new Map<string, KeywordEnrichment>();
      const enrichmentMode: RunMode = input.command === 'research' ? 'manual_pilot' : mode;
      for (const observation of shallowBatch.results) {
        const fingerprint = candidateFingerprints(observation.candidate).candidate;
        try {
          const enriched = await options.keywordProvider.enrich({
            keyword: observation.candidate.primaryKeyword,
            intent: observation.candidate.intent,
            mode: enrichmentMode,
          });
          enrichmentByFingerprint.set(fingerprint, enriched);
          state = { ...state, provenance: { ...state.provenance, [fingerprint]: {
            serp: { runId: observation.provenance.serp.runId, datasetId: observation.provenance.serp.datasetId, observedAt: observation.provenance.serp.observedAt },
            keyword: enriched.provenance,
          } } };
          report.counts.metricsEnriched += 1;
        } catch (error) {
          state = markCandidateFailure(state, observation.candidate, input.runId, 'keyword_enrichment_failed', true, now().toISOString());
          report.failures.push({ candidateFingerprint: fingerprint, code: 'keyword_enrichment_failed', detail: safeDetail(error), retryable: true, attempt: state.decisions[fingerprint].attempts });
        }
      }

      const rankedShallow = shallowBatch.results
        .filter(({ candidate }) => enrichmentByFingerprint.has(candidateFingerprints(candidate).candidate))
        .map((observation) => ({
          observation,
          score: preliminaryScore(observation, (enrichmentByFingerprint.get(candidateFingerprints(observation.candidate).candidate) as KeywordEnrichment).metrics),
        }))
        .sort((left, right) => right.score - left.score || candidateFingerprints(left.observation.candidate).candidate.localeCompare(candidateFingerprints(right.observation.candidate).candidate))
        .slice(0, RUN_LIMITS.maxDeepInspections);
      const deepFingerprints = new Set(rankedShallow.map(({ observation }) => candidateFingerprints(observation.candidate).candidate));
      for (const observation of shallowBatch.results) {
        const fingerprint = candidateFingerprints(observation.candidate).candidate;
        if (!deepFingerprints.has(fingerprint) && state.decisions[fingerprint]?.status === 'scanned') {
          state = markCandidateCompleted(state, observation.candidate, input.runId, 'not_selected_for_deep_inspection', now().toISOString());
        }
      }

      const deep: DeepOpportunity[] = [];
      for (const ranked of rankedShallow) {
        const fingerprint = candidateFingerprints(ranked.observation.candidate).candidate;
        try {
          const inspected = await options.researcher.inspect([ranked.observation]);
          const result = inspected.results[0];
          if (!result || inspected.deepInspectionCount !== 1) throw new Error('Deep inspection returned no evidence bundle.');
          const enrichment = enrichmentByFingerprint.get(fingerprint) as KeywordEnrichment;
          deep.push({ result, shallow: ranked.observation, enrichment, score: ranked.score + deepEvidenceScore(result) });
          report.counts.deepInspected += 1;
        } catch (error) {
          state = markCandidateFailure(state, ranked.observation.candidate, input.runId, 'deep_inspection_failed', true, now().toISOString());
          report.failures.push({ candidateFingerprint: fingerprint, code: 'deep_inspection_failed', detail: safeDetail(error), retryable: true, attempt: state.decisions[fingerprint].attempts });
        }
      }

      const discoveries = discoverCandidatesFromResearch(shallowBatch.results, [...options.backlog, ...state.queuedCandidates]);
      const retryable = queue.scan.filter((candidate) => state.decisions[candidateFingerprints(candidate).candidate]?.status === 'retryable');
      state = { ...state, queuedCandidates: mergeCandidateQueue(heldCandidates, queue.tail, retryable, discoveries) };

      if (input.command === 'research') {
        for (const observation of shallowBatch.results) {
          const fingerprint = candidateFingerprints(observation.candidate).candidate;
          if (!['retryable', 'terminal'].includes(state.decisions[fingerprint]?.status)) {
            state = deferCandidate(state, observation.candidate, input.runId, 'research_ready_for_drafting', now().toISOString());
          }
        }
        state = { ...state, queuedCandidates: mergeCandidateQueue(
          queue.scan.filter((candidate) => state.decisions[candidateFingerprints(candidate).candidate]?.status === 'retryable'),
          state.queuedCandidates,
        ) };
        state = recordPersistent(state, { schemaVersion: 1, runId: input.runId, mode, startedAt, selectedCandidateFingerprints: [], status: 'researched' });
        await options.stateStore.save(compactPersistentWorkerState(state), version);
        report.status = 'researched';
        report.completedAt = now().toISOString();
        return report;
      }

      const eligible = deep.filter(({ result, enrichment }) => evaluateEligibility(result.candidate, result.evidence, enrichment.metrics, mode).eligible);
      report.counts.eligible = eligible.length;
      const selected = selectWithIcpCap(eligible, mode, options.maxDrafts);
      const selectedFingerprints = new Set(selected.map(({ result }) => candidateFingerprints(result.candidate).candidate));
      for (const item of deep) {
        const fingerprint = candidateFingerprints(item.result.candidate).candidate;
        if (selectedFingerprints.has(fingerprint)) continue;
        const eligibility = evaluateEligibility(item.result.candidate, item.result.evidence, item.enrichment.metrics, mode);
        state = eligibility.eligible
          ? deferCandidate(state, item.result.candidate, input.runId, 'eligible_deferred_by_run_cap', now().toISOString())
          : markCandidateCompleted(state, item.result.candidate, input.runId, `ineligible:${eligibility.reasons.join(',')}`, now().toISOString());
      }
      if (selected.length === 0) report.failures.push({ code: 'no_eligible_opportunities', detail: 'No opportunity passed every fail-closed eligibility gate.', retryable: false });

      // Attempts cover the entire scan/enrich/draft sequence, not just drafting.
      // Keep selected/deferred discoveries available for lease recovery.
      state = { ...state, queuedCandidates: mergeCandidateQueue(
        selected.map(({ result }) => result.candidate),
        queue.scan.filter((candidate) => state.decisions[candidateFingerprints(candidate).candidate]?.status === 'retryable'),
        state.queuedCandidates,
      ) };
      for (const item of selected) {
        const fingerprint = candidateFingerprints(item.result.candidate).candidate;
        state = { ...state, decisions: { ...state.decisions, [fingerprint]: {
          ...state.decisions[fingerprint], status: 'leased', reason: 'draft_reservation',
          leaseExpiresAt: new Date(now().getTime() + 30 * 60_000).toISOString(),
        } } };
      }
      if (selected.length > 0) {
        const saved = await options.stateStore.save(compactPersistentWorkerState(state), version);
        version = saved.version;
      }

      let reconciliationRequired = false;
      for (const item of selected) {
        const candidate = item.result.candidate;
        const fingerprints = candidateFingerprints(candidate);
        try {
          const context = options.buildDraftContext({ result: item.result, shallow: item.shallow, metrics: item.enrichment.metrics });
          const drafting = await options.drafter.draft(context);
          if (drafting.status !== 'ready') {
            const findingCodes = drafting.reason === 'content_safety_failed'
              ? drafting.findings.map(({ code, message }) => `${code}: ${message}`).join(', ')
              : drafting.mediaBrief.code;
            throw new Error(`Draft blocked: ${drafting.reason} (${findingCodes}).`);
          }
          report.counts.drafted += 1;
          const validation = await options.publisher.validateBundle(drafting.bundle);
          if (validation.status !== 'passed') throw new Error(`Lander validation failed: ${validation.failure ?? 'unknown failure'}`);
          report.counts.validated += 1;
          let publication: AutobloggerArtifact['publication'] = 'artifact_only';
          let publicationResult: OpenDraftPullRequestResult | undefined;
          const publicationOrigin: PublisherOrigin = {
            candidate,
            evidence: item.result.evidence,
            provenance: context.provenance,
            keywordProvenance: item.enrichment.provenance,
            approvedMedia: {
              product: options.approvedMedia.product,
              editorialGraphics: [...new Set([...options.approvedMedia.editorialGraphics, `/media/blog/${candidate.slug}.svg`])],
            },
          };
          if (options.publicationEnabled !== false && mode === 'scheduled' && options.landerRef === 'main') {
            publicationResult = await options.publisher.openDraftPullRequest({
              bundle: drafting.bundle,
              validation,
              mode,
              keywordMetrics: item.enrichment.metrics,
              origin: publicationOrigin,
              auth: options.githubAuth,
            });
            if (publicationResult.status === 'reconciliation_required') publication = 'reconciliation_required';
            else if (publicationResult.status === 'opened') publication = 'opened';
            else if (publicationResult.status === 'already_exists') publication = 'already_exists';
            else if (publicationResult.status === 'blocked') throw new Error(`Publication blocked: ${publicationResult.reason}.`);
          }
          const pullRequest = publicationResult && ['opened', 'already_exists'].includes(publicationResult.status)
            ? publicationResult as Extract<OpenDraftPullRequestResult, { status: 'opened' | 'already_exists' }> : undefined;
          if (pullRequest?.status === 'opened') report.counts.pullRequestsOpened += 1;
          report.artifacts.push({
            candidateFingerprint: fingerprints.candidate,
            intentFingerprint: fingerprints.intent,
            articleId: candidate.articleId,
            slug: typeof (drafting.bundle.article as Record<string, unknown>).slug === 'string'
              ? (drafting.bundle.article as Record<string, string>).slug : candidate.slug,
            icp: candidate.icp,
            publication,
            bundle: drafting.bundle,
            metrics: item.enrichment.metrics,
            keywordProvenance: item.enrichment.provenance,
            serpProvenance: item.result.provenance.serp,
            publicationOrigin,
            validation,
            ...(pullRequest ? { pullRequest: { number: pullRequest.number, url: pullRequest.url, headRef: pullRequest.headRef } } : {}),
          });
          if (mode === 'manual_pilot') {
            // Record a non-expiring one-pilot reservation before the first output
            // write. A partial write or lost final state acknowledgement requires
            // reconciliation; lease expiry must never authorize a second artifact.
            state = markManualPilotPrepared(state, input.runId, artifactHash(drafting.bundle), now().toISOString());
            const prepared = await options.stateStore.save(compactPersistentWorkerState(state), version);
            version = prepared.version;
          }
          await options.persistArtifact?.(report.artifacts[report.artifacts.length - 1], report);
          state = {
            ...state,
            contentHashes: { ...state.contentHashes, [fingerprints.candidate]: artifactHash(drafting.bundle) },
            provenance: {
              ...state.provenance,
              [fingerprints.candidate]: {
                serp: { runId: item.result.provenance.serp.runId, datasetId: item.result.provenance.serp.datasetId, observedAt: item.result.provenance.serp.observedAt },
                keyword: item.enrichment.provenance,
              },
            },
            ...(pullRequest ? {
              pullRequests: { ...state.pullRequests, [fingerprints.candidate]: { number: pullRequest.number, url: pullRequest.url, status: pullRequest.status } },
            } : {}),
          };
          if (publication === 'reconciliation_required') {
            state = markCandidateFailure(state, candidate, input.runId, 'reconciliation_required', false, now().toISOString());
            report.failures.push({ candidateFingerprint: fingerprints.candidate, code: 'reconciliation_required', detail: 'Remote PR state is uncertain; manual reconciliation is required and automatic retry is disabled.', retryable: false, attempt: state.decisions[fingerprints.candidate].attempts });
            reconciliationRequired = true;
            break;
          }
          state = markCandidateCompleted(state, candidate, input.runId, pullRequest ? `pull_request_${pullRequest.status}` : 'artifact_prepared', now().toISOString());
        } catch (error) {
          // A bundle whose durable write failed is not a completed artifact.
          const artifactIndex = report.artifacts.findIndex((artifact) => artifact.candidateFingerprint === fingerprints.candidate);
          if (artifactIndex >= 0 && report.artifacts[artifactIndex].publication === 'artifact_only') report.artifacts.splice(artifactIndex, 1);
          const retryableFailure = isRetryableError(error);
          state = markCandidateFailure(state, candidate, input.runId, 'candidate_failed', retryableFailure, now().toISOString());
          report.failures.push({ candidateFingerprint: fingerprints.candidate, code: 'candidate_failed', detail: safeDetail(error), retryable: retryableFailure, attempt: state.decisions[fingerprints.candidate].attempts });
        }
      }

      if (mode === 'manual_pilot') {
        if (report.artifacts.length === 0 && state.manualPilot?.runId === input.runId && state.manualPilot.status === 'leased') state = { ...state, manualPilot: null };
      }
      const runStatus: RunRecord['status'] = reconciliationRequired
        ? 'failed'
        : report.counts.pullRequestsOpened > 0 ? 'pr_opened'
          : report.artifacts.length > 0 ? 'validated' : 'failed';
      state = recordPersistent(state, {
        schemaVersion: 1,
        runId: input.runId,
        mode,
        startedAt,
        selectedCandidateFingerprints: selected.map(({ result }) => candidateFingerprints(result.candidate).candidate),
        status: runStatus,
      });
      state = {
        ...state,
        queuedCandidates: mergeCandidateQueue(
          state.queuedCandidates.filter((candidate) => {
            const decision = state.decisions[candidateFingerprints(candidate).candidate];
            return !decision || ['leased', 'retryable', 'manual_attention'].includes(decision.status);
          }),
          queue.scan.filter((candidate) => state.decisions[candidateFingerprints(candidate).candidate]?.status === 'retryable'),
        ),
        failures: [...state.failures, ...report.failures.map((failure) => ({
          runId: input.runId,
          code: failure.code,
          attempt: Math.max(1, Math.min(3, failure.attempt ?? 1)),
          observedAt: now().toISOString(),
          detail: failure.detail,
        }))].slice(-100),
      };
      await options.stateStore.save(compactPersistentWorkerState(state), version);
      report.status = runStatus;
      report.completedAt = now().toISOString();
      return report;
    },
  };
}
