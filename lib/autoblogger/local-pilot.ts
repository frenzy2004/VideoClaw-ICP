import { CandidateSchema, candidateFingerprints, type Candidate } from './domain';
import { PersistentWorkerStateSchema, EngineeringResumeEvidenceSchema, type EngineeringResumeEvidence, type PersistentWorkerState } from './github-runtime';
import type { HttpTransport } from './http';
import { MAX_CANDIDATE_ATTEMPTS, grantManualRetryApproval, hasManualRetryApproval, grantManualTargetSwitch, hasManualTargetSwitch, grantManualTargetRetry } from './recovery';
import type { ArticleInventoryEntry } from './publisher';
import { z } from 'zod';
import matter from 'gray-matter';
import { screenDuplicate } from './policies';
import { containsSecretLikeValue } from './secrets';
import { redactSensitive } from './secrets';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, unlink } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { createFileStateStore } from './local-state';
import { createApifyClient } from './apify-client';
import { createResearcher } from './research';
import { createPendingKeywordProvider } from './keyword-providers';
import { createStructuredDrafter } from './drafting';
import { createOpenAIResponsesClient } from './openai-responses';
import { createNodeJsonHttpTransport } from './runtime-http';
import { createPublisher, createProcessCommandBoundary } from './publisher';
import { createAutobloggerWorker, type AutobloggerRunReport } from './worker';
import { consumePreparedManualPilot } from './recovery';
import { PaaObservationsSchema, ResearchProvenanceSchema } from './github-runtime';
import { MEDIA_ALLOWLIST, createProductionSourceChecker, loadBacklogCandidates, buildDraftingContextFromResearch, writeAutobloggerArtifacts } from './runtime';
import { createLocalReplayRecorder, createReplayAuditedClient, createReplayAuditedDrafter } from './local-replay-audit';

export const LOCAL_PILOT_LANDER_REF = 'seo/founder-video-blog-launch';
const LANDER_API = 'repos/INFR-Organisation/videoclaw-lander';
const STATE_API = 'repos/frenzy2004/VideoClaw-ICP';
type LocalPilotArguments = { runId: string; approveRetryFrom?: string; candidateFile?: string; switchTargetFrom?: string; retryTargetFrom?: string; approveTargetExtraAttempt?: boolean; approveSourcePlanRetry?: boolean; approveReviewRepairRetry?: boolean; approveScopeAlignmentRetry?: boolean; approveEngineeringResume?: boolean };
export function parseLocalPilotArguments(argv: string[]): LocalPilotArguments {
  const safeRunId = (value: string) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(value);
  const ordinary = argv.length === 3 && argv[2] === '--execute';
  const approved = argv.length === 5 && argv[2] === '--approve-retry-from' && safeRunId(argv[3]) && argv[3] !== argv[1] && argv[4] === '--execute';
  const extraAttempt = argv.length === 8 && argv[4] === '--retry-target-from' && argv[6] === '--approve-target-extra-attempt' && argv[7] === '--execute';
  const sourcePlanRetry = argv.length === 8 && argv[4] === '--retry-target-from' && argv[6] === '--approve-source-plan-retry' && argv[7] === '--execute';
  const reviewRepairRetry = argv.length === 8 && argv[4] === '--retry-target-from' && argv[6] === '--approve-review-repair-retry' && argv[7] === '--execute';
  const scopeAlignmentRetry = argv.length === 8 && argv[4] === '--retry-target-from' && argv[6] === '--approve-scope-alignment-retry' && argv[7] === '--execute';
  const engineeringResume = argv.length === 8 && argv[4] === '--retry-target-from' && argv[6] === '--approve-engineering-resume' && argv[7] === '--execute';
  const switched = ((argv.length === 7 && argv[6] === '--execute') || extraAttempt || sourcePlanRetry || reviewRepairRetry || scopeAlignmentRetry || engineeringResume) && argv[2] === '--candidate-file' && !!argv[3]?.trim() && !argv[3].startsWith('--') && !argv[3].includes('\0')
    && ['--switch-target-from', '--retry-target-from'].includes(argv[4]) && safeRunId(argv[5]) && argv[5] !== argv[1];
  if ((!ordinary && !approved && !switched) || argv[0] !== '--run-id' || !safeRunId(argv[1])) {
    throw new Error('Usage: tsx lib/autoblogger/local-pilot-entry.ts --run-id NEW_RUN_ID [--approve-retry-from FAILED_THIRD_RUN_ID | --candidate-file PRIVATE_CANDIDATE_JSON (--switch-target-from PARKED_APPROVED_RUN_ID | --retry-target-from FAILED_TARGET_RUN_ID [--approve-target-extra-attempt | --approve-source-plan-retry | --approve-review-repair-retry | --approve-scope-alignment-retry | --approve-engineering-resume])] --execute (local artifact-only; paid research/model work).');
  }
  return { runId: argv[1], ...(approved ? { approveRetryFrom: argv[3] } : {}), ...(switched ? { candidateFile: argv[3], ...(argv[4] === '--retry-target-from' ? { retryTargetFrom: argv[5] } : { switchTargetFrom: argv[5] }) } : {}), ...(extraAttempt ? { approveTargetExtraAttempt: true } : {}), ...(sourcePlanRetry ? { approveSourcePlanRetry: true } : {}), ...(reviewRepairRetry ? { approveReviewRepairRetry: true } : {}), ...(scopeAlignmentRetry ? { approveScopeAlignmentRetry: true } : {}), ...(engineeringResume ? { approveEngineeringResume: true } : {}) };
}
const shaSchema = z.string().regex(/^[a-f0-9]{40,64}$/u);
const refSchema = z.object({ ref: z.string().min(1) });
const articleSchema = z.object({ id: z.string().min(1), slug: z.string().min(1), title: z.string().min(1), primaryKeyword: z.string().min(1), intentFingerprint: z.string().optional() });

function articleIdentity(markdown: string): ArticleInventoryEntry {
  if (containsSecretLikeValue(markdown)) throw new Error('Unsafe article inventory.');
  const data = articleSchema.parse(matter(markdown).data);
  return { articleId: data.id, slug: data.slug, title: data.title, primaryKeyword: data.primaryKeyword, ...(data.intentFingerprint ? { intentFingerprint: data.intentFingerprint } : {}) };
}

type LocalInventoryInput = { head: string; branch: string; clean: boolean; localArticles: ArticleInventoryEntry[]; candidate: Candidate };
type GitHubGet = (path: string, paginate?: boolean) => Promise<unknown>;
export async function inspectLocalPilotInventory(input: LocalInventoryInput, get: GitHubGet) {
  if (!input.clean || input.branch !== LOCAL_PILOT_LANDER_REF) throw new Error('The original lander checkout must be clean and on the configured review branch.');
  const { object: { sha: baseSha } } = z.object({ object: z.object({ sha: shaSchema }) }).parse(await get(`${LANDER_API}/git/ref/heads/${encodeURIComponent(LOCAL_PILOT_LANDER_REF)}`));
  if (input.head !== baseSha) throw new Error('The local lander HEAD must match the fresh remote review SHA.');
  const pr55 = z.object({ state: z.enum(['open', 'closed']), merged: z.boolean() }).parse(await get(`${LANDER_API}/pulls/55`));
  const tree = z.object({ truncated: z.boolean(), tree: z.array(z.object({ type: z.string(), path: z.string(), sha: shaSchema })).max(100_000) }).parse(await get(`${LANDER_API}/git/trees/${baseSha}?recursive=1`));
  if (tree.truncated) throw new Error('Truncated target inventory.');
  const readBlob = async (sha: string) => {
    const blob = z.object({ encoding: z.literal('base64'), content: z.string().max(8_000_000) }).parse(await get(`${LANDER_API}/git/blobs/${shaSchema.parse(sha)}`));
    return articleIdentity(Buffer.from(blob.content, 'base64').toString('utf8'));
  };
  const existingArticles: ArticleInventoryEntry[] = [...input.localArticles];
  for (const entry of tree.tree.filter(({ type, path }) => type === 'blob' && /^content\/articles\/[^/]+\.md$/u.test(path))) existingArticles.push(await readBlob(entry.sha));
  const pulls = z.array(z.object({ number: z.number().int().positive(), html_url: z.string().url(), body: z.string().nullable().optional(), head: z.object({ ref: z.string().min(1) }) })).max(1_000).parse(await get(`${LANDER_API}/pulls?state=open&per_page=100`, true));
  const openPullRequests: Array<ArticleInventoryEntry & { number: number; url: string; headRef: string }> = [];
  for (const pull of pulls) {
    const coordinates = { number: pull.number, url: pull.html_url, headRef: pull.head.ref };
    const files = z.array(z.object({ filename: z.string(), status: z.string(), sha: shaSchema })).max(2_999).parse(await get(`${LANDER_API}/pulls/${pull.number}/files?per_page=100`, true));
    for (const file of files.filter(({ filename, status }) => status !== 'removed' && /^content\/articles\/[^/]+\.md$/u.test(filename))) openPullRequests.push({ ...await readBlob(file.sha), ...coordinates });
    const slug = pull.head.ref.match(/^autoblog\/\d{4}-\d{2}-\d{2}-(.+)$/u)?.[1];
    const body = pull.body ?? '';
    if (containsSecretLikeValue(body)) throw new Error('Unsafe PR inventory.');
    const articleId = body.match(/^- Article ID:\s*(.+)$/mu)?.[1]?.trim();
    const primaryKeyword = body.match(/^- Primary keyword:\s*(.+)$/mu)?.[1]?.trim();
    const intentFingerprint = body.match(/^- Intent fingerprint:\s*(intent:[a-f0-9]{64})/mu)?.[1];
    if (slug || articleId || primaryKeyword || intentFingerprint) openPullRequests.push({ ...coordinates, ...(slug ? { slug } : {}), ...(articleId ? { articleId } : {}), ...(primaryKeyword ? { primaryKeyword } : {}), ...(intentFingerprint ? { intentFingerprint } : {}) });
  }
  const branchRefs = z.array(refSchema).max(10_000).parse(await get(`${LANDER_API}/git/matching-refs/heads/`, true)).map(({ ref }) => ref.replace(/^refs\/heads\//u, ''));
  const remoteState = z.array(refSchema).max(100).parse(await get(`${STATE_API}/git/matching-refs/heads/autoblogger-state`, true));
  if (remoteState.some(({ ref }) => ref === 'refs/heads/autoblogger-state')) throw new Error('Remote worker state exists; reconcile it with retained local history before local execution.');
  if (!screenDuplicate(input.candidate, { landerInventory: existingArticles, openPullRequestInventory: openPullRequests }).accepted
    || branchRefs.some((ref) => ref.match(/^autoblog\/\d{4}-\d{2}-\d{2}-(.+)$/u)?.[1] === input.candidate.slug)) throw new Error('The target candidate is already present or reserved in the fresh lander inventory.');
  return { baseSha, existingArticles, openPullRequests, branchRefs, audit: { observedAt: new Date().toISOString(), localMatchesRemote: true, baseSha, pr55, existingArticleIdentities: existingArticles.length, openPullRequests: pulls.length, openArticleIdentities: openPullRequests.length, branches: branchRefs.length, remoteStatePresent: false, authentication: 'interactive_gh_GET_only' } };
}

type LocalPilotCandidateInput = { state: PersistentWorkerState; backlog: Candidate[]; candidate: unknown; runId: string; approveRetryFrom?: string; switchTargetFrom?: string; retryTargetFrom?: string; approveTargetExtraAttempt?: boolean; approveSourcePlanRetry?: boolean; approveReviewRepairRetry?: boolean; approveScopeAlignmentRetry?: boolean; approveEngineeringResume?: boolean; engineeringResumeEvidence?: EngineeringResumeEvidence; approvedAt?: string };
export function reconcileLocalPilotCandidate(input: LocalPilotCandidateInput) {
  let state = PersistentWorkerStateSchema.parse(input.state);
  const candidate = CandidateSchema.parse(input.candidate);
  const extraApprovals = [input.approveTargetExtraAttempt, input.approveSourcePlanRetry, input.approveReviewRepairRetry, input.approveScopeAlignmentRetry, input.approveEngineeringResume].filter(flag => flag === true).length;
  if ((input.approveEngineeringResume === true) !== (input.engineeringResumeEvidence !== undefined)) throw new Error('Engineering resume requires explicit authority and validated local evidence together.');
  if ((extraApprovals > 0 && input.retryTargetFrom === undefined) || extraApprovals > 1) throw new Error('Extra-attempt approval requires one distinct explicit target retry.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(input.runId) || state.runs[input.runId]) throw new Error('A fresh run ID is required; prior run records cannot be reused.');
  if (input.switchTargetFrom !== undefined || input.retryTargetFrom !== undefined) {
    if (input.approveRetryFrom !== undefined || (input.switchTargetFrom !== undefined && input.retryTargetFrom !== undefined) || state.manualPilot !== null) throw new Error('A target switch cannot combine retry authority or an existing global pilot reservation.');
    const approval = state.manualTargetSwitch;
    if (input.retryTargetFrom !== undefined) {
      if (approval?.retry && !approval.retry.consumedAt) {
        if (approval.retry.priorRunId !== input.retryTargetFrom
          || (approval.retry.reason === 'user_authorized_after_editorial_fix') !== (input.approveTargetExtraAttempt === true)
          || (approval.retry.reason === 'user_authorized_after_source_planning_fix') !== (input.approveSourcePlanRetry === true)
          || (approval.retry.reason === 'user_authorized_after_review_repair_fix') !== (input.approveReviewRepairRetry === true)
          || (approval.retry.reason === 'user_authorized_after_scope_alignment_fix') !== (input.approveScopeAlignmentRetry === true)
          || (approval.retry.reason === 'manual_engineering_resume') !== (input.approveEngineeringResume === true)
          || (input.approveEngineeringResume && JSON.stringify(approval.retry.evidence) !== JSON.stringify(EngineeringResumeEvidenceSchema.parse(input.engineeringResumeEvidence)))
          || !hasManualTargetSwitch(state, candidate, input.runId, 'manual_pilot', input.approvedAt ?? '')) throw new Error('Existing target retry does not match this explicit unused approval.');
      } else state = grantManualTargetRetry(state, candidate, { priorRunId: input.retryTargetFrom, runId: input.runId, approvedAt: input.approvedAt ?? '',
        ...(input.approveTargetExtraAttempt === true ? { extraAttempt: true } : {}), ...(input.approveSourcePlanRetry === true ? { sourcePlanRetry: true } : {}),
        ...(input.approveReviewRepairRetry === true ? { reviewRepairRetry: true } : {}),
        ...(input.approveScopeAlignmentRetry === true ? { scopeAlignmentRetry: true } : {}),
        ...(input.approveEngineeringResume === true ? { engineeringResume: true, engineeringResumeEvidence: input.engineeringResumeEvidence } : {}) });
    } else if (approval) {
      if (approval.retry || approval.parkedRetryRunId !== input.switchTargetFrom
        || !hasManualTargetSwitch(state, candidate, input.runId, 'manual_pilot', input.approvedAt ?? approval.approvedAt)) throw new Error('Existing target switch does not match this explicit unused approval.');
    } else {
      state = grantManualTargetSwitch(state, candidate, { parkedRetryRunId: input.switchTargetFrom!, runId: input.runId, approvedAt: input.approvedAt ?? '' });
    }
    const identities = Object.values(candidateFingerprints(candidate));
    const addExact = (items: Candidate[]) => {
      const overlaps = items.filter((item) => Object.values(candidateFingerprints(item)).some((id) => identities.includes(id)));
      if (overlaps.length > 1 || overlaps.some((item) => JSON.stringify(CandidateSchema.parse(item)) !== JSON.stringify(candidate))) throw new Error('Selected candidate overlaps a different retained queue or backlog identity.');
      return overlaps.length ? items : [...items, candidate];
    };
    // The matrix can still contain the old pre-review wording. Reconcile only
    // that transient row against the parked grant, never the persisted history.
    const parked = state.manualRetryApproval!;
    const matchesParked = (item: Candidate) => JSON.stringify(Object.values(candidateFingerprints(item)).sort()) === JSON.stringify([...parked.identities].sort());
    const retained = state.queuedCandidates.filter(matchesParked);
    if (input.backlog.filter(({ articleId }) => articleId === parked.articleId).length > 1) throw new Error('Ambiguous parked candidate rows in the transient backlog.');
    // Terminal queue cleanup may remove the parked old target. Its validated
    // grant already proves exhaustion; do not resurrect its stale matrix row.
    const backlog = input.backlog.filter(item => !(input.retryTargetFrom !== undefined
      && retained.length === 0 && item.articleId === parked.articleId)).map((item) => {
      if (item.articleId !== parked.articleId || matchesParked(item)) return item;
      const fingerprint = candidateFingerprints(item).candidate;
      if (retained.length !== 1 || item.campaignId !== retained[0].campaignId || item.slug !== retained[0].slug
        || (fingerprint !== parked.candidateFingerprint && state.decisions[fingerprint])) throw new Error('Cannot reconcile the old matrix row without an exact retained parked candidate and unattempted representation.');
      return retained[0];
    });
    return { state: PersistentWorkerStateSchema.parse({ ...state, queuedCandidates: addExact(state.queuedCandidates) }),
      backlog: addExact(backlog), candidate, nextAttempt: (state.manualTargetSwitch!.retry?.priorDecision.attempts ?? state.manualTargetSwitch!.startingAttempts) + 1 };
  }
  if (state.manualTargetSwitch) throw new Error('The pending target switch requires its explicit candidate and switch flag; the old retry grant is parked.');
  if (candidate.articleId !== 'vc-c2-001') throw new Error('The local retry must retain article vc-c2-001.');
  if (input.approveRetryFrom !== undefined) {
    const approval = state.manualRetryApproval;
    if (approval) {
      if (approval.priorRunId !== input.approveRetryFrom || approval.runId !== input.runId
        || approval.reason !== 'user_authorized_after_input_fix'
        || !hasManualRetryApproval(state, candidate, input.runId, 'manual_pilot', input.approvedAt ?? approval.approvedAt)) {
        throw new Error('Existing manual retry approval does not match this explicit unused grant.');
      }
    } else {
      state = grantManualRetryApproval(state, candidate, { priorRunId: input.approveRetryFrom, runId: input.runId,
        reason: 'user_authorized_after_input_fix', approvedAt: input.approvedAt ?? '' });
    }
  }
  const fingerprints = candidateFingerprints(candidate);
  const decision = state.decisions[fingerprints.candidate];
  const manualRetry = input.approveRetryFrom !== undefined
    && hasManualRetryApproval(state, candidate, input.runId, 'manual_pilot', input.approvedAt ?? state.manualRetryApproval?.approvedAt ?? '');
  if (!decision || (!manualRetry && (decision.status !== 'retryable' || decision.attempts < 1 || decision.attempts >= MAX_CANDIDATE_ATTEMPTS))
    || decision.articleId !== candidate.articleId || decision.intentFingerprint !== fingerprints.intent
    || JSON.stringify([...decision.identities].sort()) !== JSON.stringify(Object.values(fingerprints).sort())) {
    throw new Error('The retained candidate must exactly match an existing bounded retryable decision.');
  }
  if (state.manualPilot !== null || state.contentHashes[fingerprints.candidate] || state.pullRequests[fingerprints.candidate]) {
    throw new Error('Pilot or artifact state already exists; manual reconciliation is required.');
  }
  const reconcile = (items: Candidate[]) => {
    if (items.filter(({ articleId }) => articleId === candidate.articleId).length !== 1) throw new Error('Exactly one original candidate row must be retained.');
    return items.map((item) => {
      const identities = candidateFingerprints(item);
      if (item.articleId !== candidate.articleId) {
        if (Object.values(identities).some((identity) => Object.values(fingerprints).includes(identity))) throw new Error('Another candidate overlaps the retained retry identity.');
        return item;
      }
      if (identities.candidate !== fingerprints.candidate && state.decisions[identities.candidate]) throw new Error('The original queue representation already has a decision; cannot replace it.');
      if (item.campaignId !== candidate.campaignId || item.slug !== candidate.slug) throw new Error('Cannot change the retained campaign or slug.');
      return candidate;
    });
  };
  const queued = manualRetry && !state.queuedCandidates.some(({ articleId }) => articleId === candidate.articleId)
    ? [...state.queuedCandidates, candidate] : state.queuedCandidates;
  return { state: PersistentWorkerStateSchema.parse({ ...state, queuedCandidates: reconcile(queued) }), backlog: reconcile(input.backlog), candidate, nextAttempt: decision.attempts + 1 };
}

export type ModelAuditRecord = { call: number; phase: string; httpStatus: number; response: unknown };
export type ModelRequestAuditRecord = { call: number; phase: string; requestBody: string };
export function createModelAuditTransport(transport: HttpTransport, record: (value: ModelAuditRecord) => Promise<void>, recordRequest?: (value: ModelRequestAuditRecord) => Promise<void>): HttpTransport {
  let calls = 0;
  return async (request) => {
    const isModel = request.method === 'POST' && request.url === 'https://api.openai.com/v1/responses';
    if (isModel && calls >= 4) throw new Error('Local pilot Responses POST limit of 4 reached.');
    const call = isModel ? ++calls : 0;
    const name = isModel ? JSON.parse(request.body ?? '{}').text?.format?.name : undefined;
    const phase = typeof name === 'string' && /^[A-Za-z0-9_-]{1,120}$/u.test(name) ? name : 'unknown';
    if (isModel && recordRequest) await recordRequest({ call, phase, requestBody: request.body ?? '' });
    const response = await transport(request);
    if (isModel) {
      await record({ call, phase, httpStatus: response.status, response: response.body });
    }
    return response;
  };
}

function localReadEnvironment(): NodeJS.ProcessEnv {
  // Use the existing interactive login without extracting a token or borrowing
  // provider/publication credentials from the runner's environment.
  const environment: Record<string, string | undefined> = { ...Object.fromEntries(['HOME', 'PATH', 'TMPDIR', 'GH_HOST', 'GH_CONFIG_DIR'].flatMap((key) => process.env[key] ? [[key, process.env[key]]] : [])), GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
  return environment as NodeJS.ProcessEnv;
}

function gitRead(root: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: localReadEnvironment(), timeout: 30_000, maxBuffer: 8_000_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch { throw new Error('Local Git preflight failed.'); }
}

const interactiveGitHubGet: GitHubGet = async (path, paginate = false) => {
  if (!path.startsWith(`${LANDER_API}/`) && !path.startsWith(`${STATE_API}/`)) throw new Error('Out-of-scope GitHub inventory request.');
  try {
    const value = JSON.parse(execFileSync('gh', ['api', '--hostname', 'github.com', '--method', 'GET', ...(paginate ? ['--paginate', '--slurp'] : []), path], { encoding: 'utf8', env: localReadEnvironment(), timeout: 30_000, maxBuffer: 8_000_000, stdio: ['ignore', 'pipe', 'pipe'] }));
    return paginate ? z.array(z.array(z.unknown())).parse(value).flat() : value;
  } catch { throw new Error('Fresh GET-only GitHub inventory failed; no paid fallback is permitted.'); }
};

async function assertRealPath(root: string, path: string): Promise<void> {
  const suffix = relative(root, path);
  if (!suffix || suffix.startsWith(`..${sep}`) || suffix === '..') throw new Error('Local pilot path escapes its configured root.');
  let current = root;
  for (const component of suffix.split(sep)) {
    current = resolve(current, component);
    if ((await lstat(current)).isSymbolicLink()) throw new Error('Local pilot paths must not contain symlinks.');
  }
}

/** Identity only: selection evidence must be freshly collected by the normal worker. */
export async function readLocalPilotCandidateFile(root: string, candidateFile: string): Promise<Candidate> {
  const path = resolve(root, candidateFile);
  const suffix = relative(resolve(root, 'artifacts'), path);
  if (!suffix || suffix === '..' || suffix.startsWith(`..${sep}`)) throw new Error('Selected candidate must be a private file within artifacts.');
  await assertRealPath(root, path);
  const metadata = await lstat(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0 || metadata.size > 16_384) throw new Error('Selected candidate must be a private regular file of at most 16 KiB.');
  const text = await readFile(path, 'utf8');
  if (Buffer.byteLength(text, 'utf8') > 16_384 || containsSecretLikeValue(text)) throw new Error('Unsafe or oversized selected candidate.');
  return CandidateSchema.parse(JSON.parse(text));
}

/** Positive, closed receipts are required; missing model files prove nothing. */
export function validateEngineeringResumeEvidence(input: {
  reportText: string; auditText: string; priorRunId: string; candidate: Candidate; implementationHash: string;
}): EngineeringResumeEvidence {
  if ([input.reportText, input.auditText].some(text => Buffer.byteLength(text, 'utf8') > 2_000_000)) throw new Error('Engineering resume receipt exceeds the bounded input size.');
  const candidate = CandidateSchema.parse(input.candidate);
  const count = z.number().int().nonnegative();
  const counts = z.object({ queued: count, scanned: z.literal(1), shallowValidated: z.literal(1), metricsEnriched: z.literal(1),
    deepInspected: z.literal(0), eligible: z.literal(0), drafted: z.literal(0), validated: z.literal(0), pullRequestsOpened: z.literal(0) }).strict();
  const failures = z.tuple([
    z.object({ candidateFingerprint: z.literal(candidateFingerprints(candidate).candidate), code: z.literal('deep_inspection_failed'),
      detail: z.string().min(1), retryable: z.literal(false), attempt: z.literal(7) }).strict(),
    z.object({ code: z.literal('no_eligible_opportunities'), detail: z.string().min(1), retryable: z.literal(false) }).strict(),
  ]);
  const report = z.object({ schemaVersion: z.literal(1), command: z.literal('pilot'), runId: z.literal(input.priorRunId), mode: z.literal('manual_pilot'),
    status: z.literal('failed'), startedAt: z.string().datetime(), completedAt: z.string().datetime(), limits: z.record(z.string(), count),
    counts, artifacts: z.array(z.unknown()).length(0), failures }).strict().parse(JSON.parse(input.reportText));
  const audit = z.object({ runId: z.literal(input.priorRunId), execution: z.literal('local_production_worker_artifact_only'),
    publicationEnabled: z.literal(false), scheduledRuntimeConfigured: z.literal(false),
    events: z.array(z.object({ at: z.string().datetime(), stage: z.string() }).passthrough()).length(5),
  }).strict().parse(JSON.parse(input.auditText));
  const stages = ['preflight_passed', 'research_started', 'research_completed', 'source_inspection_started', 'pilot_completed'];
  if (audit.events.some((event, index) => event.stage !== stages[index]
    || (index > 0 && Date.parse(event.at) < Date.parse(audit.events[index - 1].at)))) throw new Error('Engineering resume requires a complete source-only execution audit without model or native stages.');
  z.object({ articleId: z.literal(candidate.articleId), nextAttempt: z.literal(7), publicationEnabled: z.literal(false) }).parse(audit.events[0]);
  z.object({ candidates: z.literal(1) }).parse(audit.events[1]);
  z.object({ observations: z.array(z.object({ articleId: z.literal(candidate.articleId), query: z.literal(candidate.primaryKeyword) })).length(1) }).parse(audit.events[2]);
  const completed = z.object({ status: z.literal('failed'), counts, failures }).parse(audit.events[4]);
  if (JSON.stringify(completed.counts) !== JSON.stringify(report.counts) || JSON.stringify(completed.failures) !== JSON.stringify(report.failures)
    || Date.parse(report.completedAt) < Date.parse(report.startedAt) || Date.parse(audit.events[0].at) > Date.parse(report.startedAt)
    || Date.parse(audit.events[1].at) < Date.parse(report.startedAt) || Date.parse(audit.events[3].at) > Date.parse(report.completedAt)
    || Date.parse(audit.events[4].at) < Date.parse(report.completedAt)) throw new Error('Engineering resume report and closed execution audit must agree.');
  return EngineeringResumeEvidenceSchema.parse({ priorRunId: input.priorRunId, candidateFingerprint: candidateFingerprints(candidate).candidate,
    articleId: candidate.articleId, reportStartedAt: report.startedAt, reportCompletedAt: report.completedAt, auditCompletedAt: audit.events[4].at,
    reportHash: createHash('sha256').update(input.reportText).digest('hex'), auditHash: createHash('sha256').update(input.auditText).digest('hex'),
    implementationHash: input.implementationHash });
}

/** Hash the local implementation under review, including staged and unstaged code. */
function localImplementationHash(root: string): string {
  const paths = ['.', ':(exclude)docs', ':(exclude)artifacts', ':(exclude)*.md', ':(exclude).env*'];
  if (gitRead(root, ['ls-files', '--others', '--exclude-standard', '--', ...paths])) throw new Error('Untracked implementation files cannot be omitted from the engineering review hash.');
  const head = gitRead(root, ['rev-parse', 'HEAD']);
  const diff = gitRead(root, ['diff', '--no-ext-diff', '--no-textconv', '--binary', 'HEAD', '--', ...paths]);
  return createHash('sha256').update(JSON.stringify({ head, diff })).digest('hex');
}

/** Read only the exact ignored receipts; never create state or accept caller-supplied hashes. */
export async function readLocalEngineeringResumeEvidence(root: string, priorRunId: string, candidate: Candidate): Promise<EngineeringResumeEvidence> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(priorRunId)) throw new Error('Engineering resume requires a safe exact prior run ID.');
  const directory = resolve(root, 'artifacts/autoblogger', priorRunId);
  const readReceipt = async (suffix: string) => {
    const path = resolve(directory, suffix);
    await assertRealPath(root, path);
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.size > 2_000_000) throw new Error('Engineering resume requires bounded regular receipt files.');
    gitRead(root, ['check-ignore', '--quiet', '--no-index', '--', path]);
    return readFile(path, 'utf8');
  };
  const [reportText, auditText] = await Promise.all([readReceipt('run-report.json'), readReceipt('execution-audit/validation-report.json')]);
  return validateEngineeringResumeEvidence({ reportText, auditText, priorRunId, candidate, implementationHash: localImplementationHash(root) });
}

/** Explicit local execution, never a credential fallback for Actions. No work occurs on import. */
export async function runLocalArtifactPilot(options: LocalPilotArguments & { root: string }): Promise<AutobloggerRunReport> {
  parseLocalPilotArguments(['--run-id', options.runId, ...(options.approveRetryFrom !== undefined ? ['--approve-retry-from', options.approveRetryFrom] : []),
    ...(options.candidateFile !== undefined ? ['--candidate-file', options.candidateFile] : []), ...(options.switchTargetFrom !== undefined ? ['--switch-target-from', options.switchTargetFrom] : []),
    ...(options.retryTargetFrom !== undefined ? ['--retry-target-from', options.retryTargetFrom] : []),
    ...(options.approveTargetExtraAttempt === true ? ['--approve-target-extra-attempt'] : []),
    ...(options.approveSourcePlanRetry === true ? ['--approve-source-plan-retry'] : []),
    ...(options.approveReviewRepairRetry === true ? ['--approve-review-repair-retry'] : []),
    ...(options.approveScopeAlignmentRetry === true ? ['--approve-scope-alignment-retry'] : []),
    ...(options.approveEngineeringResume === true ? ['--approve-engineering-resume'] : []), '--execute']);
  if (process.env.GITHUB_EVENT_NAME === 'schedule' || process.env.AUTOBLOG_SCHEDULE_ENABLED === 'true' || process.env.LANDER_GITHUB_TOKEN?.trim()) throw new Error('Local pilot must not receive publication or scheduled execution authority.');
  const root = await realpath(resolve(options.root));
  const lander = await realpath(resolve(root, '../videoclaw-lander-blog-launch'));
  const statePath = resolve(root, 'artifacts/autoblogger/local-pilot-2026-09-06/state.json');
  const candidateInputPath = resolve(root, options.candidateFile ?? 'artifacts/autoblogger/pilot-completion-2026-09-06/context/validation-report.json');
  const artifactRoot = resolve(root, 'artifacts/autoblogger');
  const outputDirectory = resolve(artifactRoot, options.runId);
  for (const path of [statePath, candidateInputPath, artifactRoot]) await assertRealPath(root, path);
  if (!(await lstat(statePath)).isFile()) throw new Error('Retained pilot state is required; this runner never creates a fresh state history.');
  for (const path of [statePath, candidateInputPath, outputDirectory]) gitRead(root, ['check-ignore', '--quiet', '--no-index', '--', path]);
  const lockPath = `${statePath}.execution.lock`;
  const lock = await open(lockPath, 'wx', 0o600);
  const events: Record<string, unknown>[] = [];
  let outputCreated = false;
  const event = (stage: string, detail: Record<string, unknown> = {}) => {
    const value = { at: new Date().toISOString(), stage, ...detail };
    if (containsSecretLikeValue(value) || events.length >= 500) throw new Error('Unsafe or excessive local diagnostic output.');
    events.push(value);
    process.stdout.write(`${JSON.stringify(value)}\n`);
  };
  const audit = (value: unknown, directory: string) => writeAutobloggerArtifacts(value, resolve(outputDirectory, directory), root);
  try {
    const stateStore = createFileStateStore(statePath);
    const initial = await stateStore.load();
    if (!initial.version) throw new Error('Existing local pilot state is mandatory.');
    // Extract only identity from the historical artifact. Never import its
    // assisted facts, FAQs, source documents, provenance, or rewritten draft.
    const selectedCandidate = options.candidateFile ? await readLocalPilotCandidateFile(root, options.candidateFile)
      : JSON.parse(await readFile(candidateInputPath, 'utf8')).context?.candidate;
    const engineeringResumeEvidence = options.approveEngineeringResume
      ? await readLocalEngineeringResumeEvidence(root, options.retryTargetFrom!, selectedCandidate) : undefined;
    const prepared = reconcileLocalPilotCandidate({ state: initial.state, backlog: await loadBacklogCandidates(root), candidate: selectedCandidate, runId: options.runId,
      ...(options.approveRetryFrom !== undefined ? { approveRetryFrom: options.approveRetryFrom, approvedAt: new Date().toISOString() } : {}),
      ...(options.switchTargetFrom !== undefined ? { switchTargetFrom: options.switchTargetFrom, approvedAt: new Date().toISOString() } : {}),
      ...(options.retryTargetFrom !== undefined ? { retryTargetFrom: options.retryTargetFrom, approvedAt: new Date().toISOString() } : {}),
      ...(options.approveTargetExtraAttempt === true ? { approveTargetExtraAttempt: true } : {}),
      ...(options.approveSourcePlanRetry === true ? { approveSourcePlanRetry: true } : {}),
      ...(options.approveReviewRepairRetry === true ? { approveReviewRepairRetry: true } : {}),
      ...(options.approveScopeAlignmentRetry === true ? { approveScopeAlignmentRetry: true } : {}),
      ...(options.approveEngineeringResume === true ? { approveEngineeringResume: true, engineeringResumeEvidence } : {}) });
    const localArticles = await Promise.all((await readdir(resolve(lander, 'content/articles'))).filter((name) => name.endsWith('.md')).map(async (name) => articleIdentity(await readFile(resolve(lander, 'content/articles', name), 'utf8'))));
    const snapshot = await inspectLocalPilotInventory({
      head: gitRead(lander, ['rev-parse', 'HEAD']), branch: gitRead(lander, ['branch', '--show-current']), clean: gitRead(lander, ['status', '--porcelain']) === '', localArticles, candidate: prepared.candidate,
    }, interactiveGitHubGet);
    for (const checkout of [root, lander]) {
      const envPath = resolve(checkout, '.env.local');
      let metadata;
      try { metadata = await lstat(envPath); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
      if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0) throw new Error('Local credential files must be private regular files.');
      gitRead(checkout, ['check-ignore', '--quiet', '--no-index', '--', '.env.local']);
      process.loadEnvFile(envPath);
    }
    if (!process.env.APIFY_TOKEN?.trim() || !process.env.OPENAI_API_KEY?.trim()) throw new Error('Local production provider credentials are unavailable.');
    if (process.env.LANDER_GITHUB_TOKEN?.trim() || process.env.AUTOBLOG_SCHEDULE_ENABLED === 'true') throw new Error('Publication/scheduling authority is forbidden in the local pilot.');
    await mkdir(outputDirectory, { mode: 0o700 }); // Exclusive fresh receipt; never overwrite a prior run.
    outputCreated = true;
    const replay = createLocalReplayRecorder({ root, directory: resolve(outputDirectory, 'replay'), secrets: [process.env.APIFY_TOKEN, process.env.OPENAI_API_KEY] });
    await audit({ ...snapshot.audit, runId: options.runId, candidate: prepared.candidate, nextAttempt: prepared.nextAttempt, priorStateHash: initial.version, priorRunIds: Object.keys(initial.state.runs), priorFailureCount: initial.state.failures.length, manualPilot: initial.state.manualPilot,
      ...(prepared.state.manualRetryApproval ? { manualRetryApproval: prepared.state.manualRetryApproval } : {}),
      ...(prepared.state.manualTargetSwitch ? { manualTargetSwitch: prepared.state.manualTargetSwitch } : {}) }, 'preflight');
    event('preflight_passed', { articleId: prepared.candidate.articleId, nextAttempt: prepared.nextAttempt, baseSha: snapshot.baseSha, publicationEnabled: false });
    if (engineeringResumeEvidence && JSON.stringify(await readLocalEngineeringResumeEvidence(root, options.retryTargetFrom!, prepared.candidate)) !== JSON.stringify(engineeringResumeEvidence)) {
      throw new Error('Engineering resume receipts or implementation changed during preflight.');
    }
    await stateStore.save(prepared.state, initial.version);
    const transport = createModelAuditTransport(createNodeJsonHttpTransport(), async (record) => {
      await replay(`response-${record.call}-${record.phase}`, record);
      await audit(record, `model-${record.call}-${record.phase}`);
      event('model_response_retained', { call: record.call, phase: record.phase, httpStatus: record.httpStatus });
    }, (record) => replay(`wire-request-${record.call}-${record.phase}`, record));
    const researcher = createResearcher({ apify: createApifyClient({ token: process.env.APIFY_TOKEN, transport }), sourceChecker: createProductionSourceChecker() });
    const client = createOpenAIResponsesClient({ apiKey: process.env.OPENAI_API_KEY, transport });
    let replayResearch: Parameters<typeof buildDraftingContextFromResearch>[0] | undefined;
    const drafter = createReplayAuditedDrafter(createStructuredDrafter({ client: createReplayAuditedClient({ async generate(request) { event('model_stage_started', { phase: request.name }); return client.generate(request); } }, replay), mediaAllowlist: MEDIA_ALLOWLIST }), replay, MEDIA_ALLOWLIST, () => replayResearch);
    const native = createPublisher({ lander: { repository: lander, ref: LOCAL_PILOT_LANDER_REF, owner: 'INFR-Organisation', name: 'videoclaw-lander' }, command: createProcessCommandBoundary() });
    const worker = createAutobloggerWorker({
      backlog: prepared.backlog, stateStore, targetCandidateFingerprint: candidateFingerprints(prepared.candidate).candidate,
      keywordProvider: createPendingKeywordProvider(), drafter,
      researcher: {
        async scan(candidates) {
          event('research_started', { candidates: candidates.length });
          const batch = await researcher.scan(candidates);
          const observations = batch.results.map((result) => ({
            articleId: result.candidate.articleId, query: result.candidate.primaryKeyword, organicResultCount: result.organicResults.length, paaCount: result.peopleAlsoAsk.length,
            researchProvenance: ResearchProvenanceSchema.parse(result.provenance),
            ...(result.paaObservations ? { paaObservations: PaaObservationsSchema.parse(result.paaObservations) } : {}),
            ...('paaCacheReused' in result ? { paaCacheReused: result.paaCacheReused } : {}),
            ...('paaCollectionError' in result ? { paaCollectionError: redactSensitive(result.paaCollectionError).slice(0, 500) } : {}),
          }));
          await audit({ observations }, 'shallow-research');
          event('research_completed', { observations });
          return batch;
        },
        async inspect(candidates) {
          event('source_inspection_started');
          const batch = await researcher.inspect(candidates);
          await audit({ results: batch.results.map((result) => ({
            articleId: result.candidate.articleId, researchProvenance: ResearchProvenanceSchema.parse(result.provenance),
            sourceDocuments: result.sourceDocuments?.map(({ url, finalUrl, checkedAt, status, authoritative, contentType, bodySha256, text, passages }) => ({ url, finalUrl, checkedAt, status, authoritative, contentType, bodySha256, textCharacters: text.length, passageCount: passages.length })),
          })) }, 'source-inspection');
          event('source_inspection_completed', { results: batch.results.length });
          return batch;
        },
      },
      buildDraftContext: (input) => {
        replayResearch = { ...input, generatedAt: new Date().toISOString() };
        return buildDraftingContextFromResearch(replayResearch);
      },
      publisher: {
        async validateBundle(bundle) {
          event('native_validation_started');
          const validation = await native.validateBundle(bundle);
          if (validation.status === 'passed' && validation.checkedOutHeadSha !== snapshot.baseSha) { validation.status = 'failed'; validation.failure = 'Native validation used a different lander SHA than the fresh inventory.'; }
          await audit(validation, 'native-validation');
          event('native_validation_completed', { status: validation.status, failure: validation.failure, commands: validation.commands.map(({ label, exitCode }) => ({ label, exitCode })) });
          return validation;
        },
        async openDraftPullRequest() { throw new Error('Publication capability is absent from the local pilot.'); },
      },
      landerRef: LOCAL_PILOT_LANDER_REF, approvedMedia: { product: MEDIA_ALLOWLIST.map(({ src, poster }) => ({ src, poster })), editorialGraphics: [] },
      landerInventory: snapshot.existingArticles, openPullRequestInventory: snapshot.openPullRequests, branchInventory: snapshot.branchRefs,
      publicationEnabled: false, maxDrafts: 1,
      persistArtifact: (artifact, report) => writeAutobloggerArtifacts({ ...report, artifacts: [artifact] }, outputDirectory, root),
    });
    const report = await worker.execute({ command: 'pilot', runId: options.runId });
    await writeAutobloggerArtifacts(report, outputDirectory, root);
    if (report.status === 'validated' && report.artifacts.length === 1) {
      const hash = createHash('sha256').update(JSON.stringify(report.artifacts[0].bundle)).digest('hex');
      await consumePreparedManualPilot(stateStore, options.runId, hash, new Date().toISOString());
    }
    event('pilot_completed', { status: report.status, counts: report.counts, failures: report.failures, artifactDirectory: outputDirectory });
    return report;
  } catch (error) {
    const detail = redactSensitive(error, [process.env.APIFY_TOKEN ?? '', process.env.OPENAI_API_KEY ?? '']).slice(0, 1_500);
    if (outputCreated) await audit({ status: 'failed', error: detail, runId: options.runId }, 'failure');
    throw new Error(detail);
  } finally {
    try { if (outputCreated) await audit({ runId: options.runId, events, execution: 'local_production_worker_artifact_only', publicationEnabled: false, scheduledRuntimeConfigured: false }, 'execution-audit'); }
    finally { await lock.close(); await unlink(lockPath); }
  }
}
