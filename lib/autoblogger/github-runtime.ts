import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { z } from 'zod';

import { AutobloggerStateSchema, createAutobloggerState } from './state';
import { CandidateSchema, candidateFingerprints } from './domain';
import { containsSecretLikeValue, redactSensitive } from './secrets';
import { requestWithTimeout, type HttpRequest, type HttpResponse, type HttpTransport } from './http';
import type {
  GitHubAppInstallationAuth,
  GitHubPublisherBoundary,
  GitHubReadOnlyAuth,
  GitHubTargetSnapshot,
  PreparedCommit,
} from './publisher';

const DEFAULT_GITHUB_API = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const DEFAULT_TIMEOUT_MS = 20_000;
const STATE_PATH = 'state.json';
const STATE_BRANCH = 'autoblogger-state';
const SAFE_IDENTITY = /^[A-Za-z0-9_.-]+$/;

export function createGitHubReadOnlyAuth(token: string, stateToken?: string): GitHubReadOnlyAuth {
  if (!/^github_pat_[A-Za-z0-9_]{16,}$/u.test(token) || token === stateToken || token === process.env.GITHUB_TOKEN) {
    throw new Error('LANDER_READ_TOKEN must be a separate fine-grained read-only PAT with contents:read and pull_requests:read; state and publication tokens are forbidden.');
  }
  return { kind: 'github_read_only', token };
}

function assertMutationAuth(auth: GitHubAppInstallationAuth): void {
  if (!auth || auth.kind !== 'github_app_installation' || !/^ghs_[A-Za-z0-9_]{16,}$/u.test(auth.token) || auth.token === process.env.GITHUB_TOKEN) {
    throw new Error('GitHub mutations require an explicit lander App installation token.');
  }
}

const CompactFailureSchema = z.object({
  runId: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(120),
  // Above three is accepted only by the enclosing state's consumed-grant checks.
  attempt: z.number().int().min(1).max(8),
  candidateFingerprint: z.string().trim().min(1).max(500).optional(),
  observedAt: z.string().datetime(),
  detail: z.string().trim().min(1).max(500),
}).strict();

export const ApifyCollectionProvenanceSchema = z.object({
  actorId: z.string().trim().min(1).max(240),
  runId: z.string().trim().min(1).max(160),
  datasetId: z.string().trim().min(1).max(160),
  observedAt: z.string().datetime(),
}).strict();

export const ResearchProvenanceSchema = z.object({
  discovery: ApifyCollectionProvenanceSchema,
  serp: ApifyCollectionProvenanceSchema,
  serpAttempts: z.array(ApifyCollectionProvenanceSchema).max(2).optional(),
  paa: ApifyCollectionProvenanceSchema.optional(),
  paaAttempts: z.array(ApifyCollectionProvenanceSchema).max(2).optional(),
  supportSearches: z.array(ApifyCollectionProvenanceSchema).max(10).optional(),
}).strict();

// Project only question/collection metadata. Provider answer text is not evidence
// and must never be copied into the worker's persisted artifact report.
export const PaaObservationsSchema = z.array(ApifyCollectionProvenanceSchema.extend({
  query: z.string().trim().min(1).max(500),
  question: z.string().trim().min(1).max(500),
  parentQuestion: z.string().trim().min(1).max(500).nullable(),
  country: z.literal('US'),
  language: z.literal('en'),
  position: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strip()).max(30);

export type ResearchProvenance = z.infer<typeof ResearchProvenanceSchema>;
export type PaaObservations = z.infer<typeof PaaObservationsSchema>;

const CompactProvenanceSchema = z.object({
  serp: z.object({
    runId: z.string().trim().min(1).max(160),
    datasetId: z.string().trim().min(1).max(160),
    observedAt: z.string().datetime(),
  }).strict(),
  serpAttempts: z.array(ApifyCollectionProvenanceSchema).max(2).optional(),
  keyword: z.object({
    provider: z.enum(['pending', 'semrush', 'ahrefs', 'similarweb']),
    endpoint: z.string().url().max(1_000).nullable(),
    observedAt: z.string().datetime().nullable(),
    providerRequestId: z.string().trim().min(1).max(500).nullable(),
    sourceObservedAt: z.string().trim().min(1).max(100).nullable(),
  }).strict(),
  paa: ApifyCollectionProvenanceSchema.optional(),
  paaAttempts: z.array(ApifyCollectionProvenanceSchema).max(2).optional(),
  supportSearches: z.array(ApifyCollectionProvenanceSchema).max(10).optional(),
}).strict();

export const CandidateDecisionSchema = z.object({
  articleId: z.string().trim().min(1).max(128),
  intentFingerprint: z.string().regex(/^intent:[0-9a-f]{64}$/u),
  identities: z.array(z.string().trim().min(1).max(500)).min(6).max(6),
  status: z.enum(['scanned', 'retryable', 'leased', 'completed', 'terminal', 'manual_attention']),
  reason: z.string().trim().min(1).max(240),
  attempts: z.number().int().min(0).max(3),
  runId: z.string().trim().min(1).max(160),
  updatedAt: z.string().datetime(),
  leaseExpiresAt: z.string().datetime().nullable(),
}).strict();

const ManualPilotSchema = z.object({
  runId: z.string().trim().min(1).max(160),
  status: z.enum(['leased', 'prepared', 'consumed']),
  reservedAt: z.string().datetime(),
  leaseExpiresAt: z.string().datetime().nullable(),
  artifactHash: z.string().regex(/^[0-9a-f]{64}$/u).nullable(),
  consumedAt: z.string().datetime().nullable(),
}).strict();

const ManualRetryApprovalSchema = z.object({
  mode: z.literal('manual_pilot'),
  articleId: z.literal('vc-c2-001'),
  candidateFingerprint: z.string().startsWith('candidate:').max(500),
  identities: z.array(z.string().trim().min(1).max(500)).length(6),
  priorRunId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  runId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  reason: z.string().trim().min(1).max(240),
  approvedAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
}).strict();

export const EngineeringResumeEvidenceSchema = z.object({
  priorRunId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  candidateFingerprint: z.string().startsWith('candidate:').max(500),
  articleId: z.string().min(1).max(128),
  reportStartedAt: z.string().datetime(),
  reportCompletedAt: z.string().datetime(),
  auditCompletedAt: z.string().datetime(),
  reportHash: z.string().regex(/^[0-9a-f]{64}$/u),
  auditHash: z.string().regex(/^[0-9a-f]{64}$/u),
  implementationHash: z.string().regex(/^[0-9a-f]{64}$/u),
}).strict();
export type EngineeringResumeEvidence = z.infer<typeof EngineeringResumeEvidenceSchema>;

const ManualTargetRetrySchema = z.object({
  reason: z.enum(['user_authorized_after_collector_fix', 'user_authorized_after_attribution_fix', 'user_authorized_after_editorial_fix', 'user_authorized_after_source_planning_fix', 'user_authorized_after_review_repair_fix', 'user_authorized_after_scope_alignment_fix', 'manual_engineering_resume']),
  priorRunId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  runId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  priorDecision: CandidateDecisionSchema.extend({ attempts: z.number().int().min(0).max(7) }),
  maxAttempt: z.literal(8).optional(),
  evidence: EngineeringResumeEvidenceSchema.optional(),
  approvedAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
}).strict();

const ManualTargetSwitchSchema = z.object({
  mode: z.literal('manual_pilot'),
  reason: z.literal('user_authorized_alternative_topic'),
  parkedRetryRunId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  parkedRetryApprovalHash: z.string().regex(/^[0-9a-f]{64}$/u),
  candidate: CandidateSchema,
  candidateFingerprint: z.string().startsWith('candidate:').max(500),
  runId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  startingAttempts: z.number().int().min(0).max(2),
  approvedAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
  retry: ManualTargetRetrySchema.optional(),
  retryHistory: z.array(ManualTargetRetrySchema).max(6).optional(),
}).strict();

export const PersistentWorkerStateSchema = AutobloggerStateSchema.extend({
  manualPilot: ManualPilotSchema.nullable(),
  manualRetryApproval: ManualRetryApprovalSchema.optional(),
  manualTargetSwitch: ManualTargetSwitchSchema.optional(),
  queuedCandidates: z.array(CandidateSchema).max(500),
  candidateFingerprints: z.array(z.string().trim().min(1).max(500)).max(20_000),
  dedupeHashes: z.array(z.string().regex(/^[0-9a-f]{64}$/u)).max(30_000),
  decisions: z.record(z.string(), CandidateDecisionSchema.extend({ attempts: z.number().int().min(0).max(8) })),
  provenance: z.record(z.string(), CompactProvenanceSchema),
  contentHashes: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
  pullRequests: z.record(z.string(), z.object({
    number: z.number().int().positive(),
    url: z.string().url(),
    status: z.enum(['opened', 'already_exists', 'reconciliation_required']),
  }).strict()),
  failures: z.array(CompactFailureSchema).max(100),
}).strict().superRefine((state, ctx) => {
  const approval = state.manualRetryApproval;
  const targetSwitch = state.manualTargetSwitch;
  const invalid = (message: string) => ctx.addIssue({ code: 'custom', path: ['manualRetryApproval'], message });
  if (targetSwitch) {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', path: ['manualTargetSwitch'], message });
    const identities = Object.values(candidateFingerprints(targetSwitch.candidate));
    const fingerprint = candidateFingerprints(targetSwitch.candidate).candidate;
    const decision = state.decisions[fingerprint];
    const approvedAt = Date.parse(targetSwitch.approvedAt);
    const retry = targetSwitch.retry;
    const history = targetSwitch.retryHistory ?? [];
    if (history.length && (!retry || history.some(item => !item.consumedAt))) fail('Retry history requires consumed approvals and a current retry.');
    const retries = [...history, ...(retry ? [retry] : [])];
    const consumed = retries.filter(item => item.consumedAt);
    const active = consumed.at(-1) ?? targetSwitch;
    const activeRunId = active.runId;
    const activeAt = Date.parse(active.consumedAt ?? active.approvedAt);
    const runIds = new Set([targetSwitch.runId, approval?.runId, approval?.priorRunId]);
    for (const [index, item] of retries.entries()) {
      const previous = retries[index - 1] ?? targetSwitch;
      const prior = state.runs[item.priorRunId];
      const saved = item.priorDecision;
      const extraAttempt = item.reason === 'user_authorized_after_editorial_fix';
      const sourcePlanRetry = item.reason === 'user_authorized_after_source_planning_fix';
      const reviewRepairRetry = item.reason === 'user_authorized_after_review_repair_fix';
      const scopeAlignmentRetry = item.reason === 'user_authorized_after_scope_alignment_fix';
      const engineeringResume = item.reason === 'manual_engineering_resume';
      const evidence = item.evidence;
      if (engineeringResume ? item.maxAttempt !== 8 || !evidence
        || evidence.priorRunId !== item.priorRunId || evidence.candidateFingerprint !== fingerprint || evidence.articleId !== targetSwitch.candidate.articleId
        || evidence.reportStartedAt !== prior?.startedAt || Date.parse(evidence.reportCompletedAt) < Date.parse(saved.updatedAt)
        || Date.parse(evidence.auditCompletedAt) < Date.parse(evidence.reportCompletedAt) || Date.parse(item.approvedAt) < Date.parse(evidence.auditCompletedAt)
        || saved.reason !== 'deep_inspection_failed'
        || !state.failures.some(f => f.runId === item.priorRunId && f.candidateFingerprint === fingerprint && f.attempt === 7 && f.code === 'deep_inspection_failed')
        : item.maxAttempt !== undefined || evidence !== undefined) fail('Engineering resume requires exact closed source-failure evidence and a fixed eighth-attempt cap.');
      const allowedAttempt = engineeringResume
        ? saved.attempts === 7 && retries[index - 1]?.reason === 'user_authorized_after_scope_alignment_fix' && index === retries.length - 1
          // Deep inspection can fail before the worker selects an eligible candidate.
          // Exact source-failure identity and the one-candidate audit supply that proof.
          && !!prior && prior.selectedCandidateFingerprints.length <= 1
        : scopeAlignmentRetry
        ? saved.attempts === 6 && retries[index - 1]?.reason === 'user_authorized_after_review_repair_fix'
          && (index === retries.length - 1 || retries[index + 1]?.reason === 'manual_engineering_resume')
          && prior?.selectedCandidateFingerprints.length === 1
        : reviewRepairRetry
        ? saved.attempts === 5 && retries[index - 1]?.reason === 'user_authorized_after_source_planning_fix'
          && (index === retries.length - 1 || retries[index + 1]?.reason === 'user_authorized_after_scope_alignment_fix')
          && prior?.selectedCandidateFingerprints.length === 1
        : sourcePlanRetry
        ? saved.attempts === 4 && retries[index - 1]?.reason === 'user_authorized_after_editorial_fix'
          && (index === retries.length - 1 || retries[index + 1]?.reason === 'user_authorized_after_review_repair_fix')
        : extraAttempt ? saved.attempts === 3 : saved.attempts < 3;
      if (!previous.consumedAt || item.priorRunId !== previous.runId || runIds.has(item.runId)
        || saved.status !== 'terminal' || saved.leaseExpiresAt !== null || saved.runId !== item.priorRunId
        || saved.attempts !== targetSwitch.startingAttempts + 1 + index
        || !allowedAttempt
        || saved.articleId !== targetSwitch.candidate.articleId || saved.intentFingerprint !== candidateFingerprints(targetSwitch.candidate).intent
        || JSON.stringify([...saved.identities].sort()) !== JSON.stringify([...identities].sort())
        || Date.parse(saved.updatedAt) < Date.parse(previous.consumedAt!) || Date.parse(item.approvedAt) < Date.parse(saved.updatedAt)
        || !prior || prior.runId !== item.priorRunId || prior.mode !== 'manual_pilot' || prior.status !== 'failed'
        || Date.parse(prior.startedAt) > Date.parse(saved.updatedAt)
        || prior.selectedCandidateFingerprints.some(fp => fp !== fingerprint)
        || !state.failures.some(f => f.runId === item.priorRunId && f.candidateFingerprint === fingerprint
          && f.attempt === saved.attempts && Date.parse(f.observedAt) <= Date.parse(item.approvedAt))) fail('Target retry requires the retained failed attempt, exact identities and explicit later approval.');
      if (!item.consumedAt && (JSON.stringify(decision) !== JSON.stringify(saved)
        || state.runs[item.runId] || state.contentHashes[fingerprint] || state.candidates[fingerprint]?.status === 'validated'
        || ((reviewRepairRetry || scopeAlignmentRetry || engineeringResume) && ['drafted', 'pr_opened'].includes(state.candidates[fingerprint]?.status ?? ''))
        || Object.values(state.decisions).some(d => d.runId === item.runId))) fail('Unused target retry must preserve its prior decision and cannot reuse a run or artifact.');
      if (item.consumedAt && Date.parse(item.consumedAt) < Date.parse(item.approvedAt)) fail('Target retry cannot precede approval.');
      runIds.add(item.runId);
    }
    if (!approval || approval.consumedAt || targetSwitch.parkedRetryRunId !== approval.runId
      || targetSwitch.parkedRetryApprovalHash !== createHash('sha256').update(JSON.stringify(approval)).digest('hex')
      || approvedAt < Date.parse(approval.approvedAt) || targetSwitch.runId === approval.runId || targetSwitch.runId === approval.priorRunId
      || targetSwitch.candidateFingerprint !== fingerprint || identities.some((identity) => approval.identities.includes(identity))) {
      fail('Target switch requires an unchanged unused parked grant and a distinct candidate and fresh run.');
    }
    if (decision && (decision.articleId !== targetSwitch.candidate.articleId
      || JSON.stringify([...decision.identities].sort()) !== JSON.stringify([...identities].sort()))) fail('Target switch candidate identities must remain exact.');
    if (state.pullRequests[fingerprint]) fail('Target switch is artifact-only; publication state is forbidden.');
    if (!targetSwitch.consumedAt) {
      if (state.runs[targetSwitch.runId] || Object.values(state.decisions).some(({ runId }) => runId === targetSwitch.runId)
        || state.contentHashes[fingerprint] || state.candidates[fingerprint]
        || (decision ? decision.status !== 'retryable' || decision.attempts !== targetSwitch.startingAttempts
          || Date.parse(decision.updatedAt) > approvedAt : targetSwitch.startingAttempts !== 0)) fail('Unused target switch requires a fresh normal-cap candidate reservation with no artifact.');
    } else {
      const consumedAt = Date.parse(targetSwitch.consumedAt);
      const run = state.runs[activeRunId];
      if (consumedAt < approvedAt || !decision || decision.runId !== activeRunId
        || decision.attempts !== targetSwitch.startingAttempts + 1 + consumed.length || Date.parse(decision.updatedAt) < activeAt
        || (run && (run.runId !== activeRunId || run.mode !== 'manual_pilot' || run.status === 'pr_opened'
          || Date.parse(run.startedAt) < Date.parse(active.approvedAt)
          || run.selectedCandidateFingerprints.some((fp) => fp !== fingerprint)))) fail('Consumed target switch must retain its bounded attempt and exact artifact-only run.');
    }
    if (state.manualPilot && (state.manualPilot.runId !== (retry?.runId ?? targetSwitch.runId)
      || Date.parse(state.manualPilot.reservedAt) < (retry ? Date.parse(retry.approvedAt) : approvedAt)
      || (!(retry ? retry.consumedAt : targetSwitch.consumedAt) && state.manualPilot.status !== 'leased'))) fail('The global pilot lifecycle belongs only to the approved target-switch run.');
  }
  // Retain all consumed grants when another explicit approval is appended.
  // Each extra decision/failure must still match its own grant exactly.
  const targetExtras = [...(targetSwitch?.retryHistory ?? []), ...(targetSwitch?.retry ? [targetSwitch.retry] : [])]
    .filter(item => item.consumedAt && ['user_authorized_after_editorial_fix', 'user_authorized_after_source_planning_fix', 'user_authorized_after_review_repair_fix', 'user_authorized_after_scope_alignment_fix', 'manual_engineering_resume'].includes(item.reason));
  for (const [fingerprint, decision] of Object.entries(state.decisions)) {
    const exactTargetExtra = targetExtras.some(item => targetSwitch?.candidateFingerprint === fingerprint
      && item.runId === decision.runId && decision.attempts === item.priorDecision.attempts + 1 && decision.status !== 'retryable');
    if (decision.attempts > 3 && (!approval?.consumedAt || approval.candidateFingerprint !== fingerprint
      || decision.attempts !== 4 || approval.runId !== decision.runId || decision.status === 'retryable') && !exactTargetExtra) invalid('Extra attempts require their exact consumed manual retry approval.');
  }
  for (const failure of state.failures) {
    const exactTargetExtra = targetExtras.some(item => failure.runId === item.runId
      && failure.candidateFingerprint === targetSwitch?.candidateFingerprint
      && failure.attempt === item.priorDecision.attempts + 1
      && Date.parse(failure.observedAt) >= Date.parse(item.consumedAt!));
    if (failure.attempt > 3 && (!approval?.consumedAt || failure.runId !== approval.runId
      || failure.attempt !== 4 || failure.candidateFingerprint !== approval.candidateFingerprint
      || Date.parse(failure.observedAt) < Date.parse(approval.consumedAt)) && !exactTargetExtra) invalid('Extra failures require their exact consumed manual retry approval.');
  }
  if (!approval) return;
  const decision = state.decisions[approval.candidateFingerprint];
  const prior = state.runs[approval.priorRunId];
  const approvedAt = Date.parse(approval.approvedAt);
  const priorFailure = state.failures.some((failure) => failure.runId === approval.priorRunId
    && failure.attempt === 3 && failure.code === 'candidate_failed'
    && (!failure.candidateFingerprint || failure.candidateFingerprint === approval.candidateFingerprint)
    && Date.parse(failure.observedAt) <= approvedAt);
  if (approval.priorRunId === approval.runId || !prior || prior.runId !== approval.priorRunId
    || prior.mode !== 'manual_pilot' || prior.status !== 'failed' || !priorFailure
    || prior.selectedCandidateFingerprints.length !== 1 || prior.selectedCandidateFingerprints[0] !== approval.candidateFingerprint
    || Date.parse(prior.startedAt) > approvedAt) invalid('Manual retry approval requires the retained failed third manual pilot.');
  if (!decision || decision.articleId !== approval.articleId
    || !approval.identities.includes(approval.candidateFingerprint) || !approval.identities.includes(`article:${approval.articleId}`)
    || !approval.identities.includes(decision.intentFingerprint) || new Set(approval.identities).size !== 6
    || JSON.stringify([...decision.identities].sort()) !== JSON.stringify([...approval.identities].sort())) {
    invalid('Manual retry approval must retain the exact candidate identities.');
    return;
  }
  if (!approval.consumedAt) {
    const projection = state.candidates[approval.candidateFingerprint];
    const projectionRun = projection && state.runs[projection.runId];
    // The legacy projection is not advanced by persistent worker run records.
    // Accept only pre-draft progress proven stale by an older failed manual run.
    const stalePreDraft = projection && ['selected', 'researched'].includes(projection.status)
      && projection.mode === 'manual_pilot' && projectionRun?.runId === projection.runId
      && projectionRun.mode === 'manual_pilot' && projectionRun.status === 'failed'
      && projectionRun.selectedCandidateFingerprints.length === 1
      && projectionRun.selectedCandidateFingerprints[0] === approval.candidateFingerprint
      && prior && Date.parse(projectionRun.startedAt) < Date.parse(prior.startedAt)
      && Date.parse(projectionRun.startedAt) <= Date.parse(projection.updatedAt)
      && Date.parse(projection.updatedAt) <= Date.parse(decision.updatedAt);
    if (decision.status !== 'terminal' || decision.reason !== 'candidate_failed' || decision.attempts !== 3
      || decision.runId !== approval.priorRunId || decision.leaseExpiresAt !== null || Date.parse(decision.updatedAt) > approvedAt
      || state.runs[approval.runId] || state.contentHashes[approval.candidateFingerprint] || state.pullRequests[approval.candidateFingerprint]
      || (projection && (projection.mode !== 'manual_pilot'
        || Date.parse(projection.updatedAt) > Date.parse(decision.updatedAt)
        || (projection.status !== 'failed' && !stalePreDraft)))
      || (state.manualPilot && !targetSwitch && (state.manualPilot.status !== 'leased' || state.manualPilot.runId !== approval.runId))) {
      invalid('Unused manual retry approval requires a fresh run and an exhausted failed candidate with no artifact or pilot success.');
    }
  } else {
    const consumedAt = Date.parse(approval.consumedAt);
    const run = state.runs[approval.runId];
    if (consumedAt < approvedAt || Date.parse(decision.updatedAt) < consumedAt
      || decision.attempts !== 4 || decision.runId !== approval.runId
      || (run && (run.mode !== 'manual_pilot' || run.status === 'pr_opened' || Date.parse(run.startedAt) < approvedAt
        || run.selectedCandidateFingerprints.some((fingerprint) => fingerprint !== approval.candidateFingerprint)))) {
      invalid('Consumed manual retry approval cannot be reset, moved to another run, or used for publication.');
    }
  }
});

export type PersistentWorkerState = z.infer<typeof PersistentWorkerStateSchema>;

export function createPersistentWorkerState(): PersistentWorkerState {
  return PersistentWorkerStateSchema.parse({
    ...createAutobloggerState(),
    manualPilot: null,
    queuedCandidates: [],
    candidateFingerprints: [],
    dedupeHashes: [],
    decisions: {},
    provenance: {},
    contentHashes: {},
    pullRequests: {},
    failures: [],
  });
}

export type CandidateDecision = z.infer<typeof CandidateDecisionSchema>;

export const MAX_PERSISTENT_STATE_BYTES = 1_500_000;
const MAX_DECISIONS = 5_000;
const MAX_RUNS = 500;

function identityHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function retainFailureHistory(input: PersistentWorkerState): PersistentWorkerState['failures'] {
  const failures = z.array(CompactFailureSchema).parse(input.failures);
  if (failures.length <= 100) return failures;
  const pinned = new Set<number>();
  const ordinary: number[] = [];
  failures.forEach((failure, index) => {
    // Keep every extra-attempt record for contextual validation below, even if
    // malformed authorization would otherwise hide it among discarded history.
    if (failure.attempt > 3 || (input.manualRetryApproval && failure.runId === input.manualRetryApproval.priorRunId
      && failure.attempt === 3 && failure.code === 'candidate_failed')
      || failure.runId === input.manualTargetSwitch?.runId || failure.runId === input.manualTargetSwitch?.retry?.runId
      || input.manualTargetSwitch?.retryHistory?.some(item => item.runId === failure.runId)) pinned.add(index);
    else ordinary.push(index);
  });
  if (pinned.size > 100) throw new Error('Required manual retry failure audit exceeds the 100-record bound.');
  const keep = new Set([...pinned, ...ordinary.slice(Math.max(0, ordinary.length - (100 - pinned.size)))]);
  return failures.filter((_failure, index) => keep.has(index));
}

export function compactPersistentWorkerState(input: PersistentWorkerState): PersistentWorkerState {
  const parsed = PersistentWorkerStateSchema.parse({ ...input, failures: retainFailureHistory(input) });
  const orderedDecisions = Object.entries(parsed.decisions).sort((left, right) => (
    right[1].updatedAt.localeCompare(left[1].updatedAt) || left[0].localeCompare(right[0])
  ));
  const retainedForRecovery = ([fingerprint, decision]: (typeof orderedDecisions)[number]) => (
    fingerprint === parsed.manualRetryApproval?.candidateFingerprint || fingerprint === parsed.manualTargetSwitch?.candidateFingerprint
      || ['leased', 'retryable', 'manual_attention'].includes(decision.status)
  );
  const active = orderedDecisions.filter(retainedForRecovery);
  if (active.length > MAX_DECISIONS) throw new Error('Persistent state contains too many active or retryable decisions to compact safely.');
  const retainedDecisionEntries = [
    ...active,
    ...orderedDecisions.filter((entry) => !retainedForRecovery(entry)),
  ].slice(0, MAX_DECISIONS);
  const retainedDecisionKeys = new Set(retainedDecisionEntries.map(([key]) => key));
  const droppedIdentityHashes = orderedDecisions
    .filter(([key]) => !retainedDecisionKeys.has(key))
    .flatMap(([, decision]) => decision.identities.map(identityHash));
  const allIdentityHashes = parsed.candidateFingerprints.map(identityHash);
  const candidateFingerprints = [...new Set(parsed.candidateFingerprints)].sort().slice(-20_000);
  const dedupeHashes = [...new Set([
    ...parsed.dedupeHashes,
    ...allIdentityHashes,
    ...droppedIdentityHashes,
  ])].sort();
  if (dedupeHashes.length > 30_000) throw new Error('Durable deduplication capacity reached; archive state before continuing. No identities were discarded.');
  const approvalRuns = new Set(parsed.manualRetryApproval ? [parsed.manualRetryApproval.priorRunId, parsed.manualRetryApproval.runId] : []);
  const projectionRunId = parsed.manualRetryApproval && parsed.candidates[parsed.manualRetryApproval.candidateFingerprint]?.runId;
  if (projectionRunId) approvalRuns.add(projectionRunId);
  if (parsed.manualTargetSwitch) approvalRuns.add(parsed.manualTargetSwitch.runId);
  if (parsed.manualTargetSwitch?.retry) approvalRuns.add(parsed.manualTargetSwitch.retry.runId);
  for (const item of parsed.manualTargetSwitch?.retryHistory ?? []) approvalRuns.add(item.runId);
  const retainedRuns = Object.entries(parsed.runs)
    .sort((left, right) => Number(approvalRuns.has(right[0])) - Number(approvalRuns.has(left[0]))
      || right[1].startedAt.localeCompare(left[1].startedAt) || left[0].localeCompare(right[0]))
    .slice(0, MAX_RUNS);
  const compacted = PersistentWorkerStateSchema.parse({
    ...parsed,
    runs: Object.fromEntries(retainedRuns),
    decisions: Object.fromEntries(retainedDecisionEntries.sort(([a], [b]) => a.localeCompare(b))),
    candidateFingerprints,
    dedupeHashes,
    provenance: Object.fromEntries(Object.entries(parsed.provenance).filter(([key]) => retainedDecisionKeys.has(key)).sort(([a], [b]) => a.localeCompare(b))),
    contentHashes: Object.fromEntries(Object.entries(parsed.contentHashes).filter(([key]) => retainedDecisionKeys.has(key)).sort(([a], [b]) => a.localeCompare(b))),
    pullRequests: Object.fromEntries(Object.entries(parsed.pullRequests).filter(([key]) => retainedDecisionKeys.has(key)).sort(([a], [b]) => a.localeCompare(b))),
    failures: parsed.failures,
  });
  if (Buffer.byteLength(JSON.stringify(compacted), 'utf8') > MAX_PERSISTENT_STATE_BYTES) {
    throw new Error('Persistent state exceeds the 1.5MB fail-closed size limit after deterministic compaction.');
  }
  return compacted;
}

type GitHubRuntimeOptions = {
  transport: HttpTransport;
  apiBase?: string;
  timeoutMs?: number;
};

function assertIdentity(value: string, label: string): void {
  if (!SAFE_IDENTITY.test(value) || value === '.' || value === '..') throw new Error(`Unsafe GitHub ${label}.`);
}

function apiBase(value: string | undefined): string {
  const parsed = new URL(value ?? DEFAULT_GITHUB_API);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('GitHub API base must be credential-free HTTPS.');
  }
  return parsed.toString().replace(/\/$/u, '');
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a string.`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function authHeaders(token: string): Record<string, string> {
  if (!token.trim()) throw new Error('An explicit GitHub token is required.');
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
  };
}

async function requestGitHub(
  options: Required<Pick<GitHubRuntimeOptions, 'transport' | 'timeoutMs'>> & { apiBase: string },
  token: string,
  method: HttpRequest['method'],
  path: string,
  body?: unknown,
  accepted: number[] = [200],
): Promise<HttpResponse> {
  try {
    const response = await requestWithTimeout(options.transport, {
      method,
      url: `${options.apiBase}${path}`,
      headers: {
        ...authHeaders(token),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }, options.timeoutMs);
    if (!accepted.includes(response.status)) {
      throw new Error(`GitHub API returned HTTP ${response.status}.`);
    }
    const link = Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'link')?.[1] ?? '';
    if (/rel="next"/iu.test(link)) {
      throw new Error('GitHub inventory pagination exceeded the bounded first page.');
    }
    return response;
  } catch (error) {
    throw new Error(`GitHub API request failed: ${redactSensitive(error, [token])}`);
  }
}

function repoPath(owner: string, repository: string): string {
  assertIdentity(owner, 'owner');
  assertIdentity(repository, 'repository');
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
}

function parseArticle(content: string): { id?: string; articleId?: string; intentFingerprint?: string; slug?: string; title?: string; primaryKeyword?: string } {
  const data = matter(content).data as Record<string, unknown>;
  const result: { id?: string; articleId?: string; intentFingerprint?: string; slug?: string; title?: string; primaryKeyword?: string } = {};
  for (const key of ['id', 'slug', 'title', 'primaryKeyword'] as const) {
    if (typeof data[key] === 'string' && data[key].trim()) result[key] = data[key].trim();
  }
  if (result.id) result.articleId = result.id;
  if (typeof data.intentFingerprint === 'string' && /^intent:[0-9a-f]{64}$/u.test(data.intentFingerprint)) {
    result.intentFingerprint = data.intentFingerprint;
  } else {
    const candidate = CandidateSchema.safeParse({
      schemaVersion: 1,
      articleId: result.id,
      campaignId: data.campaign,
      icp: data.icp,
      primaryKeyword: result.primaryKeyword,
      secondaryKeywords: Array.isArray(data.secondaryKeywords) ? data.secondaryKeywords : [],
      title: result.title,
      slug: result.slug,
      intent: data.searchIntent,
      funnelStage: data.funnelStage,
    });
    if (candidate.success) result.intentFingerprint = candidateFingerprints(candidate.data).intent;
  }
  if (!result.id && !result.slug && !result.title && !result.primaryKeyword) {
    throw new Error('Lander article inventory record has no identity.');
  }
  return result;
}

function decodeBlob(value: unknown): string {
  const blob = record(value, 'GitHub blob');
  if (blob.encoding !== 'base64') throw new Error('GitHub blob must use base64 encoding.');
  return Buffer.from(string(blob.content, 'GitHub blob content').replace(/\s/gu, ''), 'base64').toString('utf8');
}

function bundleMarker(body: unknown): string | undefined {
  if (typeof body !== 'string') return undefined;
  return body.match(/<!--\s*autoblogger-bundle-sha256:\s*([0-9a-f]{64})\s*-->/iu)?.[1];
}

function bodyIdentity(body: unknown, pattern: RegExp): string | undefined {
  if (typeof body !== 'string') return undefined;
  return body.match(pattern)?.[1]?.trim() || undefined;
}

function slugFromHead(head: string): string | undefined {
  return head.match(/^autoblog\/\d{4}-\d{2}-\d{2}-(.+)$/u)?.[1];
}

function parsePullRequest(value: unknown) {
  const pr = record(value, 'GitHub pull request');
  const head = record(pr.head, 'GitHub pull request head');
  const headRef = string(head.ref, 'GitHub pull request head ref');
  const title = typeof pr.title === 'string' ? pr.title.replace(/^Review:\s*/u, '').trim() : undefined;
  const slug = slugFromHead(headRef);
  return {
    number: integer(pr.number, 'GitHub pull request number'),
    url: string(pr.html_url, 'GitHub pull request URL'),
    headRef,
    ...(bundleMarker(pr.body) ? { bundleHash: bundleMarker(pr.body) } : {}),
    ...(slug ? { slug } : {}),
    ...(title ? { title } : {}),
    ...(bodyIdentity(pr.body, /^\s*-\s*Article ID:\s*(\S+)\s*$/imu)
      ? { articleId: bodyIdentity(pr.body, /^\s*-\s*Article ID:\s*(\S+)\s*$/imu) }
      : {}),
    ...(bodyIdentity(pr.body, /^\s*-\s*Primary keyword:[ \t]*([^\r\n]+)$/imu)
      ? { primaryKeyword: bodyIdentity(pr.body, /^\s*-\s*Primary keyword:[ \t]*([^\r\n]+)$/imu) }
      : {}),
    ...(bodyIdentity(pr.body, /^\s*-\s*Intent fingerprint:\s*(intent:[0-9a-f]{64})\s*$/imu)
      ? { intentFingerprint: bodyIdentity(pr.body, /^\s*-\s*Intent fingerprint:\s*(intent:[0-9a-f]{64})\s*$/imu) }
      : {}),
  };
}

export function createGitHubPublisherBoundary(input: GitHubRuntimeOptions): GitHubPublisherBoundary {
  const options = {
    transport: input.transport,
    apiBase: apiBase(input.apiBase),
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
  return {
    async inspectTarget({ owner, repository, baseRef, blogLaunchPullRequest, auth }): Promise<GitHubTargetSnapshot> {
      if (auth.kind === 'github_read_only') createGitHubReadOnlyAuth(auth.token);
      else assertMutationAuth(auth);
      const root = repoPath(owner, repository);
      const baseResponse = await requestGitHub(
        options,
        auth.token,
        'GET',
        `${root}/git/ref/heads/${encodeURIComponent(baseRef)}`,
      );
      const baseObject = record(record(baseResponse.body, 'GitHub base ref').object, 'GitHub base object');
      const baseSha = string(baseObject.sha, 'GitHub base SHA');
      const [launchResponse, branchResponse, treeResponse, pullsResponse] = await Promise.all([
        requestGitHub(options, auth.token, 'GET', `${root}/pulls/${blogLaunchPullRequest}`),
        requestGitHub(options, auth.token, 'GET', `${root}/git/matching-refs/heads/`),
        requestGitHub(options, auth.token, 'GET', `${root}/git/trees/${encodeURIComponent(baseSha)}?recursive=1`),
        requestGitHub(options, auth.token, 'GET', `${root}/pulls?state=open&per_page=100`),
      ]);
      const launch = record(launchResponse.body, 'GitHub blog-launch pull request');
      const merged = launch.merged === true || launch.merged_at !== null && launch.merged_at !== undefined;
      const mergeCommit = typeof launch.merge_commit_sha === 'string' ? launch.merge_commit_sha : null;
      let mergeCommitIncludedInBase = false;
      if (merged && mergeCommit) {
        const compare = await requestGitHub(options, auth.token, 'GET', `${root}/compare/${encodeURIComponent(mergeCommit)}...${encodeURIComponent(baseSha)}`);
        const status = record(compare.body, 'GitHub compare result').status;
        mergeCommitIncludedInBase = status === 'ahead' || status === 'identical';
      }
      if (!Array.isArray(branchResponse.body)) throw new Error('GitHub branch inventory is incomplete.');
      const branches = branchResponse.body;
      const branchRefs = branches.map((entry) => string(record(entry, 'GitHub ref').ref, 'GitHub ref name').replace(/^refs\/heads\//u, ''));
      const tree = record(treeResponse.body, 'GitHub repository tree');
      if (tree.truncated === true || !Array.isArray(tree.tree)) throw new Error('GitHub article inventory tree is incomplete.');
      const articleEntries = tree.tree.filter((entry) => {
        const item = record(entry, 'GitHub tree entry');
        return item.type === 'blob' && typeof item.path === 'string' && /^content\/articles\/[^/]+\.md$/u.test(item.path);
      });
      const existingArticles = await Promise.all(articleEntries.map(async (entry) => {
        const item = record(entry, 'GitHub article tree entry');
        const blob = await requestGitHub(options, auth.token, 'GET', `${root}/git/blobs/${encodeURIComponent(string(item.sha, 'GitHub blob SHA'))}`);
        return parseArticle(decodeBlob(blob.body));
      }));
      if (!Array.isArray(pullsResponse.body)) throw new Error('GitHub open pull-request inventory is malformed.');
      const openPullRequests: GitHubTargetSnapshot['openPullRequests'] = [];
      for (const entry of pullsResponse.body) {
        const pull = parsePullRequest(entry);
        const files = await requestGitHub(options, auth.token, 'GET', `${root}/pulls/${pull.number}/files?per_page=100`);
        if (!Array.isArray(files.body)) throw new Error('GitHub pull-request file inventory is incomplete.');
        const articleFiles = files.body.filter((value) => {
          const file = record(value, 'GitHub pull-request file');
          return file.status !== 'removed' && /^content\/articles\/[^/]+\.md$/u.test(string(file.filename, 'GitHub changed file name'));
        });
        const articles = await Promise.all(articleFiles.map(async (value) => {
          const file = record(value, 'GitHub changed article');
          const sha = string(file.sha, 'GitHub changed article SHA');
          if (!/^[0-9a-f]{40,64}$/iu.test(sha)) throw new Error('GitHub changed article SHA is invalid.');
          // Read immutable blob content through the authenticated repository API;
          // never follow raw_url or download_url supplied by a PR or fork.
          const blob = await requestGitHub(options, auth.token, 'GET', `${root}/git/blobs/${sha}`);
          const article = parseArticle(decodeBlob(blob.body));
          if (!article.articleId || !article.slug || !article.title || !article.primaryKeyword) {
            throw new Error('Changed PR article is missing a required ID, slug, title, or primary keyword.');
          }
          return article;
        }));
        // A manual PR may contain multiple articles and no traceability bullets.
        // Give each article its own inventory entry rather than its PR title.
        if (articles.length > 0) {
          for (const article of articles) {
            openPullRequests.push({ number: pull.number, url: pull.url, headRef: pull.headRef, ...article,
              ...(pull.bundleHash ? { bundleHash: pull.bundleHash } : {}) });
          }
        } else {
          openPullRequests.push(pull);
        }
      }
      const launchBase = record(launch.base, 'GitHub blog-launch base');
      return {
        baseRef,
        baseSha,
        blogLaunch: {
          pullRequestNumber: blogLaunchPullRequest,
          state: merged ? 'merged' : launch.state === 'open' ? 'open' : 'closed',
          baseRef: string(launchBase.ref, 'GitHub blog-launch base ref'),
          mergeCommitIncludedInBase,
        },
        branchRefs,
        existingArticles,
        openPullRequests,
      };
    },
    async prepareCommit(input: PreparedCommit) {
      assertMutationAuth(input.auth);
      const root = repoPath(input.owner, input.repository);
      const blobs = await Promise.all(input.files.map(async (file) => {
        const response = await requestGitHub(options, input.auth.token, 'POST', `${root}/git/blobs`, {
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        }, [201]);
        return { path: file.path, sha: string(record(response.body, 'GitHub blob result').sha, 'GitHub blob SHA') };
      }));
      const treeResponse = await requestGitHub(options, input.auth.token, 'POST', `${root}/git/trees`, {
        base_tree: input.baseSha,
        tree: blobs.map(({ path, sha }) => ({ path, mode: '100644', type: 'blob', sha })),
      }, [201]);
      const treeSha = string(record(treeResponse.body, 'GitHub tree result').sha, 'GitHub tree SHA');
      const commitResponse = await requestGitHub(options, input.auth.token, 'POST', `${root}/git/commits`, {
        message: input.message,
        tree: treeSha,
        parents: [input.baseSha],
      }, [201]);
      return { commitSha: string(record(commitResponse.body, 'GitHub commit result').sha, 'GitHub commit SHA') };
    },
    async createBranch({ owner, repository, headRef, commitSha, auth }) {
      assertMutationAuth(auth);
      await requestGitHub(options, auth.token, 'POST', `${repoPath(owner, repository)}/git/refs`, {
        ref: `refs/heads/${headRef}`,
        sha: commitSha,
      }, [201]);
    },
    async createDraftPullRequest({ owner, repository, baseRef, headRef, title, body, draft, bundleHash, auth }) {
      assertMutationAuth(auth);
      const marker = `<!-- autoblogger-bundle-sha256: ${bundleHash} -->`;
      const response = await requestGitHub(options, auth.token, 'POST', `${repoPath(owner, repository)}/pulls`, {
        title,
        body: `${body}\n\n${marker}`,
        head: headRef,
        base: baseRef,
        draft,
      }, [201]);
      const result = record(response.body, 'GitHub draft pull request');
      return {
        number: integer(result.number, 'GitHub pull request number'),
        url: string(result.html_url, 'GitHub pull request URL'),
      };
    },
    async findOpenPullRequestByHead({ owner, repository, headRef, auth }) {
      const query = new URLSearchParams({ state: 'open', head: `${owner}:${headRef}`, per_page: '2' });
      const response = await requestGitHub(options, auth.token, 'GET', `${repoPath(owner, repository)}/pulls?${query}`);
      if (!Array.isArray(response.body)) throw new Error('GitHub pull-request lookup is malformed.');
      const matches = response.body.map((entry) => parsePullRequest(entry));
      if (matches.length > 1) throw new Error('GitHub returned multiple pull requests for one autoblogger branch.');
      if (matches.length === 0) return null;
      return matches[0];
    },
    async deleteBranch({ owner, repository, headRef, auth }) {
      assertMutationAuth(auth);
      await requestGitHub(
        options,
        auth.token,
        'DELETE',
        `${repoPath(owner, repository)}/git/ref/heads/${headRef.split('/').map(encodeURIComponent).join('/')}`,
        undefined,
        [204],
      );
    },
  };
}

export interface GitHubStateStore {
  load(): Promise<{ state: PersistentWorkerState; version: string | null }>;
  save(state: PersistentWorkerState, expectedVersion: string | null): Promise<{ version: string }>;
}

type GitHubStateStoreOptions = GitHubRuntimeOptions & {
  owner: string;
  repository: string;
  token: string;
  githubRepository?: string;
  branch?: string;
  path?: string;
  baseRef?: string;
};

export function createGitHubStateStore(input: GitHubStateStoreOptions): GitHubStateStore {
  assertIdentity(input.owner, 'owner');
  assertIdentity(input.repository, 'repository');
  if (!input.token.trim()) throw new Error('Same-repository GITHUB_TOKEN is required for state.');
  const expectedRepository = `${input.owner}/${input.repository}`;
  if (input.githubRepository && input.githubRepository !== expectedRepository) {
    throw new Error('State GITHUB_TOKEN may only be used with the same repository.');
  }
  const options = {
    transport: input.transport,
    apiBase: apiBase(input.apiBase),
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
  const root = repoPath(input.owner, input.repository);
  const branch = input.branch ?? STATE_BRANCH;
  const path = input.path ?? STATE_PATH;
  const baseRef = input.baseRef ?? 'seo-campaign';
  const contentsPath = `${root}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;
  return {
    async load() {
      const response = await requestWithTimeout(options.transport, {
        method: 'GET',
        url: `${options.apiBase}${contentsPath}`,
        headers: authHeaders(input.token),
      }, options.timeoutMs);
      if (response.status === 404) return { state: createPersistentWorkerState(), version: null };
      if (response.status !== 200) throw new Error(`State load failed with HTTP ${response.status}.`);
      const body = record(response.body, 'GitHub state file');
      const content = decodeBlob(body);
      if (containsSecretLikeValue(content)) throw new Error('Persistent state contains a secret-like value.');
      return {
        state: PersistentWorkerStateSchema.parse(JSON.parse(content)),
        version: string(body.sha, 'GitHub state file SHA'),
      };
    },
    async save(stateInput, expectedVersion) {
      const state = compactPersistentWorkerState(PersistentWorkerStateSchema.parse(stateInput));
      if (containsSecretLikeValue(state)) throw new Error('Persistent state contains a secret-like value.');
      const content = Buffer.from(`${JSON.stringify(state)}\n`).toString('base64');
      if (expectedVersion === null) {
        const baseResponse = await requestGitHub(options, input.token, 'GET', `${root}/git/ref/heads/${encodeURIComponent(baseRef)}`);
        const object = record(record(baseResponse.body, 'GitHub state base ref').object, 'GitHub state base object');
        const baseSha = string(object.sha, 'GitHub state base SHA');
        const createResponse = await requestWithTimeout(options.transport, {
          method: 'POST',
          url: `${options.apiBase}${root}/git/refs`,
          headers: { ...authHeaders(input.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
        }, options.timeoutMs);
        if (![201, 422].includes(createResponse.status)) throw new Error('State branch initialization failed.');
      }
      const response = await requestWithTimeout(options.transport, {
        method: 'PUT',
        url: `${options.apiBase}${root}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,
        headers: { ...authHeaders(input.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'chore(autoblogger): update compact worker state',
          content,
          branch,
          ...(expectedVersion === null ? {} : { sha: expectedVersion }),
        }),
      }, options.timeoutMs);
      if ([409, 422].includes(response.status)) throw new Error('Persistent state update conflict; rerun after reloading state.');
      if (![200, 201].includes(response.status)) throw new Error(`Persistent state update failed with HTTP ${response.status}.`);
      const result = record(response.body, 'GitHub state update');
      const updated = record(result.content, 'GitHub state content result');
      return { version: string(updated.sha, 'GitHub state content SHA') };
    },
  };
}
