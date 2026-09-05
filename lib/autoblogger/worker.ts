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
import type { KeywordProvider } from './keyword-providers';
import {
  createPersistentWorkerState,
  type GitHubStateStore,
  type PersistentWorkerState,
} from './github-runtime';
import {
  RUN_LIMITS,
  evaluateEligibility,
  type RunMode,
} from './policies';
import type {
  ApprovedPublicationMedia,
  GitHubAppInstallationAuth,
  OpenDraftPullRequestResult,
  Publisher,
} from './publisher';
import type { ResearchBatch, ResearchResult, ShallowResearchBatch, ShallowResearchResult } from './research';
import { recordRun, transitionCandidateState } from './state';
import { redactSensitive } from './secrets';

type Researcher = {
  scan(candidates: Candidate[]): Promise<ShallowResearchBatch>;
  inspect(candidates: ShallowResearchResult[]): Promise<ResearchBatch>;
};

type Drafter = {
  draft(context: DraftingContext): Promise<DraftingOutcome>;
};

type InventoryEntry = Partial<Pick<Candidate, 'primaryKeyword' | 'title' | 'slug'>>;

export type AutobloggerCommand = 'research' | 'pilot' | 'run';

export type AutobloggerArtifact = {
  candidateFingerprint: string;
  articleId: string;
  slug: string;
  icp: string;
  publication: 'artifact_only' | 'opened' | 'already_exists' | 'reconciliation_required';
  bundle: DraftBundle;
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
  failures: Array<{ candidateFingerprint?: string; code: string; detail: string }>;
};

export type AutobloggerWorkerOptions = {
  backlog: Candidate[];
  stateStore: GitHubStateStore;
  researcher: Researcher;
  keywordProvider: KeywordProvider;
  drafter: Drafter;
  buildDraftContext(input: {
    result: ResearchResult;
    shallow: ShallowResearchResult;
    metrics: KeywordMetrics;
  }): DraftingContext;
  publisher: Publisher;
  landerRef: string;
  approvedMedia: ApprovedPublicationMedia;
  landerInventory?: InventoryEntry[];
  openPullRequestInventory?: InventoryEntry[];
  githubAuth?: GitHubAppInstallationAuth;
  now?: () => Date;
};

function safeDetail(error: unknown): string {
  return redactSensitive(error).replace(/[\r\n]+/gu, ' ').slice(0, 500);
}

function transitionPersistent(
  state: PersistentWorkerState,
  next: Parameters<typeof transitionCandidateState>[1],
): PersistentWorkerState {
  const core = transitionCandidateState({
    schemaVersion: 1,
    candidates: state.candidates,
    runs: state.runs,
  }, next);
  return { ...state, candidates: core.candidates, runs: core.runs };
}

function recordPersistent(state: PersistentWorkerState, run: RunRecord): PersistentWorkerState {
  const core = recordRun({
    schemaVersion: 1,
    candidates: state.candidates,
    runs: state.runs,
  }, run);
  return { ...state, candidates: core.candidates, runs: core.runs };
}

function identityKey(candidate: Candidate): string[] {
  const fingerprints = candidateFingerprints(candidate);
  return [fingerprints.candidate, fingerprints.keyword, fingerprints.title, fingerprints.slug];
}

function hasInventoryMatch(candidate: Candidate, entries: InventoryEntry[]): boolean {
  const identity = new Set(identityKey(candidate));
  return entries.some((entry) => (
    (entry.primaryKeyword && identity.has(`keyword:${normalizeKeyword(entry.primaryKeyword)}`))
    || (entry.title && identity.has(`title:${normalizeTitle(entry.title)}`))
    || (entry.slug && identity.has(`slug:${normalizeSlug(entry.slug)}`))
  ));
}

function buildQueue(options: AutobloggerWorkerOptions, state: PersistentWorkerState): Candidate[] {
  const seen = new Set<string>();
  const blockedFingerprints = new Set([
    ...state.candidateFingerprints,
    ...Object.keys(state.candidates),
  ]);
  const queue: Candidate[] = [];
  for (const raw of [...state.queuedCandidates, ...options.backlog]) {
    const candidate = CandidateSchema.parse(raw);
    const identities = identityKey(candidate);
    if (
      identities.some((identity) => seen.has(identity))
      || identities.some((identity) => blockedFingerprints.has(identity))
      || hasInventoryMatch(candidate, options.landerInventory ?? [])
      || hasInventoryMatch(candidate, options.openPullRequestInventory ?? [])
    ) continue;
    identities.forEach((identity) => seen.add(identity));
    queue.push(candidate);
    if (queue.length === RUN_LIMITS.maxCandidatesScanned) break;
  }
  return queue;
}

function titleCase(value: string): string {
  return normalizeKeyword(value).split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function hashNumber(value: string): number {
  return 100 + (Number.parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16) % 900);
}

export function discoverCandidatesFromResearch(
  research: ShallowResearchResult[],
  existing: Candidate[],
): Candidate[] {
  const used = new Set(existing.flatMap((candidate) => [...identityKey(candidate), `article:${candidate.articleId}`]));
  const discovered: Candidate[] = [];
  for (const observation of research) {
    const exactTitle = observation.organicResults.some(({ title }) => (
      normalizeTitle(title) === normalizeKeyword(observation.candidate.primaryKeyword)
    ));
    const signals = [
      ...observation.suggestions,
      ...observation.relatedQueries,
      ...observation.peopleAlsoAsk,
      ...(!exactTitle ? [`${observation.candidate.primaryKeyword} examples`] : []),
    ];
    for (const signal of signals) {
      const keyword = normalizeKeyword(signal).slice(0, 180);
      const slug = normalizeSlug(keyword).slice(0, 160).replace(/-+$/u, '');
      if (!keyword || !slug) continue;
      const campaignIndex = CAMPAIGN_IDS.indexOf(observation.candidate.campaignId) + 1;
      const parsed = CandidateSchema.safeParse({
        schemaVersion: 1,
        articleId: `vc-c${campaignIndex}-${String(hashNumber(`${observation.candidate.campaignId}:${keyword}`)).padStart(3, '0')}`,
        campaignId: observation.candidate.campaignId,
        icp: observation.candidate.icp,
        primaryKeyword: keyword,
        secondaryKeywords: [],
        title: titleCase(keyword),
        slug,
        intent: observation.candidate.intent,
        funnelStage: observation.candidate.funnelStage,
      });
      if (!parsed.success || [...identityKey(parsed.data), `article:${parsed.data.articleId}`].some((identity) => used.has(identity))) continue;
      [...identityKey(parsed.data), `article:${parsed.data.articleId}`].forEach((identity) => used.add(identity));
      discovered.push(parsed.data);
      if (discovered.length === 250) return discovered;
    }
  }
  return discovered;
}

function productFit(candidate: Candidate): number {
  const tokens = new Set(normalizeKeyword(`${candidate.primaryKeyword} ${candidate.title}`).split(' '));
  return ['video', 'content', 'demo', 'media', 'founder', 'startup', 'repurposing']
    .filter((token) => tokens.has(token)).length * 5;
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
    + productFit(observation.candidate)
    + funnel;
}

function deepEvidenceScore(result: ResearchResult): number {
  const authoritativeSources = result.evidence.sources.filter(({ authoritative }) => authoritative).length;
  return Math.min(result.evidence.sources.length, 5) * 2
    + Math.min(authoritativeSources, 3) * 4
    + Math.min(result.evidence.faqQuestions.length, 3);
}

function selectWithIcpCap<T extends { result: ResearchResult; score: number }>(items: T[], mode: RunMode): T[] {
  const maximum = mode === 'manual_pilot' ? 1 : RUN_LIMITS.maxDrafts;
  const perIcp = new Map<string, number>();
  const selected: T[] = [];
  for (const item of items.sort((left, right) => (
    right.score - left.score
    || candidateFingerprints(left.result.candidate).candidate.localeCompare(
      candidateFingerprints(right.result.candidate).candidate,
    )
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

export function createAutobloggerWorker(options: AutobloggerWorkerOptions) {
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
      if (mode === 'manual_pilot' && state.manualPilot) throw new Error('The one manual pending-metrics pilot was already consumed.');

      const queue = buildQueue(options, state);
      report.counts.queued = queue.length;
      const shallowBatch = await options.researcher.scan(queue);
      if (shallowBatch.scannedCount !== queue.length || shallowBatch.results.length !== queue.length) {
        throw new Error('Researcher must return one shallow US/en SERP result for every queued candidate.');
      }
      report.counts.scanned = shallowBatch.scannedCount;
      report.counts.shallowValidated = shallowBatch.results.length;
      const metricsByFingerprint = new Map<string, KeywordMetrics>();
      const enrichmentMode: RunMode = input.command === 'research' ? 'manual_pilot' : mode;
      for (const observation of shallowBatch.results) {
        try {
          const enriched = await options.keywordProvider.enrich({
            keyword: observation.candidate.primaryKeyword,
            intent: observation.candidate.intent,
            mode: enrichmentMode,
          });
          metricsByFingerprint.set(candidateFingerprints(observation.candidate).candidate, enriched.metrics);
          report.counts.metricsEnriched += 1;
        } catch (error) {
          report.failures.push({
            candidateFingerprint: candidateFingerprints(observation.candidate).candidate,
            code: 'keyword_enrichment_failed',
            detail: safeDetail(error),
          });
        }
      }
      const rankedShallow = shallowBatch.results
        .filter(({ candidate }) => metricsByFingerprint.has(candidateFingerprints(candidate).candidate))
        .map((observation) => ({
          observation,
          score: preliminaryScore(
            observation,
            metricsByFingerprint.get(candidateFingerprints(observation.candidate).candidate) as KeywordMetrics,
          ),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, RUN_LIMITS.maxDeepInspections);

      const deep: Array<{ result: ResearchResult; shallow: ShallowResearchResult; metrics: KeywordMetrics; score: number }> = [];
      for (const ranked of rankedShallow) {
        try {
          const inspected = await options.researcher.inspect([ranked.observation]);
          const result = inspected.results[0];
          if (!result || inspected.deepInspectionCount !== 1) throw new Error('Deep inspection returned no eligible evidence bundle.');
          const metrics = metricsByFingerprint.get(candidateFingerprints(result.candidate).candidate) as KeywordMetrics;
          deep.push({
            result,
            shallow: ranked.observation,
            metrics,
            score: ranked.score + deepEvidenceScore(result),
          });
          report.counts.deepInspected += 1;
        } catch (error) {
          report.failures.push({
            candidateFingerprint: candidateFingerprints(ranked.observation.candidate).candidate,
            code: 'deep_inspection_failed',
            detail: safeDetail(error),
          });
        }
      }
      state = {
        ...state,
        queuedCandidates: discoverCandidatesFromResearch(shallowBatch.results, [...options.backlog, ...state.queuedCandidates]),
      };
      if (input.command === 'research') {
        const run: RunRecord = {
          schemaVersion: 1, runId: input.runId, mode, startedAt,
          selectedCandidateFingerprints: [], status: 'researched',
        };
        state = recordPersistent(state, run);
        await options.stateStore.save(state, version);
        report.status = 'researched';
        report.completedAt = now().toISOString();
        return report;
      }

      const eligible = deep.filter(({ result, metrics }) => (
        evaluateEligibility(result.candidate, result.evidence, metrics, mode).eligible
        && productFit(result.candidate) > 0
      ));
      report.counts.eligible = eligible.length;
      const selected = selectWithIcpCap(eligible, mode);
      if (selected.length === 0) {
        report.failures.push({ code: 'no_eligible_opportunities', detail: 'No opportunity passed every fail-closed eligibility gate.' });
      }

      let reconciliationRequired = false;
      for (const item of selected) {
        const fingerprint = candidateFingerprints(item.result.candidate).candidate;
        state = transitionPersistent(state, {
          candidateFingerprint: fingerprint, mode, status: 'selected', runId: input.runId, updatedAt: startedAt,
        });
      }
      if (mode === 'manual_pilot') state = { ...state, manualPilot: { runId: input.runId, consumedAt: startedAt } };
      if (selected.length > 0) {
        const saved = await options.stateStore.save(state, version);
        version = saved.version;
      }

      for (const item of selected) {
        const fingerprint = candidateFingerprints(item.result.candidate).candidate;
        try {
          state = transitionPersistent(state, { candidateFingerprint: fingerprint, mode, status: 'researched', runId: input.runId, updatedAt: now().toISOString() });
          const context = options.buildDraftContext({ result: item.result, shallow: item.shallow, metrics: item.metrics });
          const drafting = await options.drafter.draft(context);
          if (drafting.status !== 'ready') {
            const findingCodes = drafting.reason === 'content_safety_failed'
              ? drafting.findings.map(({ code, message }) => `${code}: ${message}`).join(', ')
              : drafting.mediaBrief.code;
            throw new Error(`Draft blocked: ${drafting.reason} (${findingCodes}).`);
          }
          report.counts.drafted += 1;
          state = transitionPersistent(state, { candidateFingerprint: fingerprint, mode, status: 'drafted', runId: input.runId, updatedAt: now().toISOString() });
          const validation = await options.publisher.validateBundle(drafting.bundle);
          if (validation.status !== 'passed') throw new Error(`Lander validation failed: ${validation.failure ?? 'unknown failure'}`);
          report.counts.validated += 1;
          state = transitionPersistent(state, { candidateFingerprint: fingerprint, mode, status: 'validated', runId: input.runId, updatedAt: now().toISOString() });
          let publication: AutobloggerArtifact['publication'] = 'artifact_only';
          let publicationResult: OpenDraftPullRequestResult | undefined;
          if (mode === 'scheduled' && options.landerRef === 'main') {
            publicationResult = await options.publisher.openDraftPullRequest({
              bundle: drafting.bundle,
              validation,
              mode,
              keywordMetrics: item.metrics,
              origin: {
                candidate: item.result.candidate,
                evidence: item.result.evidence,
                provenance: context.provenance,
                approvedMedia: {
                  product: options.approvedMedia.product,
                  editorialGraphics: [
                    ...new Set([
                      ...options.approvedMedia.editorialGraphics,
                      `/media/blog/${item.result.candidate.slug}.svg`,
                    ]),
                  ],
                },
              },
              auth: options.githubAuth,
            });
            if (publicationResult.status === 'reconciliation_required') publication = 'reconciliation_required';
            else if (publicationResult.status === 'opened') publication = 'opened';
            else if (publicationResult.status === 'already_exists') publication = 'already_exists';
            else if (publicationResult.status === 'blocked') throw new Error(`Publication blocked: ${publicationResult.reason}.`);
          }
          if (publication === 'opened' || publication === 'already_exists') {
            report.counts.pullRequestsOpened += publication === 'opened' ? 1 : 0;
            state = transitionPersistent(state, { candidateFingerprint: fingerprint, mode, status: 'pr_opened', runId: input.runId, updatedAt: now().toISOString() });
          } else if (publication === 'reconciliation_required') {
            state = transitionPersistent(state, { candidateFingerprint: fingerprint, mode, status: 'failed', runId: input.runId, updatedAt: now().toISOString() });
            report.failures.push({ candidateFingerprint: fingerprint, code: 'reconciliation_required', detail: 'Remote PR state is uncertain; manual reconciliation is required and automatic retry is disabled.' });
          }
          const article = drafting.bundle.article as Record<string, unknown>;
          const pullRequest = publicationResult && ['opened', 'already_exists'].includes(publicationResult.status)
            ? publicationResult as Extract<OpenDraftPullRequestResult, { status: 'opened' | 'already_exists' }>
            : undefined;
          const pullRequestStatus = pullRequest?.status;
          report.artifacts.push({
            candidateFingerprint: fingerprint,
            articleId: item.result.candidate.articleId,
            slug: typeof article.slug === 'string' ? article.slug : item.result.candidate.slug,
            icp: item.result.candidate.icp,
            publication,
            bundle: drafting.bundle,
            validation,
            ...(pullRequest ? { pullRequest: { number: pullRequest.number, url: pullRequest.url, headRef: pullRequest.headRef } } : {}),
          });
          state = {
            ...state,
            candidateFingerprints: [...new Set([...state.candidateFingerprints, ...identityKey(item.result.candidate)])],
            contentHashes: {
              ...state.contentHashes,
              [fingerprint]: createHash('sha256').update(drafting.bundle.markdown).update(drafting.bundle.svg ?? '').digest('hex'),
            },
            provenance: {
              ...state.provenance,
              [fingerprint]: {
                runId: item.result.provenance.serp.runId,
                datasetId: item.result.provenance.serp.datasetId,
                provider: item.metrics.provider === 'similarweb' ? 'pending' : item.metrics.provider,
                observedAt: item.result.provenance.serp.observedAt,
              },
            },
            ...(pullRequest ? {
              pullRequests: {
                ...state.pullRequests,
                [fingerprint]: { number: pullRequest.number, url: pullRequest.url, status: pullRequestStatus as 'opened' | 'already_exists' },
              },
            } : {}),
          };
          if (publication === 'reconciliation_required') {
            reconciliationRequired = true;
            break;
          }
        } catch (error) {
          const current = state.candidates[fingerprint];
          if (current && current.status !== 'failed' && current.status !== 'pr_opened') {
            state = transitionPersistent(state, { candidateFingerprint: fingerprint, mode, status: 'failed', runId: input.runId, updatedAt: now().toISOString() });
          }
          report.failures.push({ candidateFingerprint: fingerprint, code: 'candidate_failed', detail: safeDetail(error) });
        }
      }
      const runStatus: RunRecord['status'] = reconciliationRequired
        ? 'failed'
        : report.counts.pullRequestsOpened > 0
        ? 'pr_opened'
        : report.counts.validated > 0 ? 'validated' : 'failed';
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
        failures: [...state.failures, ...report.failures.map((failure) => ({
          runId: input.runId,
          code: failure.code,
          attempt: 1,
          observedAt: now().toISOString(),
          detail: failure.detail,
        }))].slice(-100),
      };
      await options.stateStore.save(state, version);
      report.status = runStatus;
      report.completedAt = now().toISOString();
      return report;
    },
  };
}
