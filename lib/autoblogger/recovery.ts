import { createHash } from 'node:crypto';

import { CandidateSchema, candidateFingerprints, type Candidate } from './domain';
import {
  compactPersistentWorkerState,
  type CandidateDecision,
  type PersistentWorkerState,
  type GitHubStateStore,
} from './github-runtime';
import { RUN_LIMITS, type RunMode } from './policies';

export const MAX_CANDIDATE_ATTEMPTS = 3;
export const DEFAULT_LEASE_MS = 30 * 60_000;

export type RecoveryInventoryEntry = Partial<Pick<Candidate, 'articleId' | 'primaryKeyword' | 'title' | 'slug'>> & {
  intentFingerprint?: string;
};

function hashIdentity(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function candidateIdentityList(candidate: Candidate): string[] {
  return Object.values(candidateFingerprints(candidate));
}

function assertDate(value: string): number {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Recovery timestamp must be an ISO date-time.');
  return time;
}

function decisionFor(
  state: PersistentWorkerState,
  candidate: Candidate,
  patch: Pick<CandidateDecision, 'status' | 'reason' | 'attempts' | 'runId' | 'updatedAt' | 'leaseExpiresAt'>,
): PersistentWorkerState {
  const fingerprints = candidateFingerprints(candidate);
  return {
    ...state,
    decisions: {
      ...state.decisions,
      [fingerprints.candidate]: {
        articleId: candidate.articleId,
        intentFingerprint: fingerprints.intent,
        identities: candidateIdentityList(candidate) as CandidateDecision['identities'],
        ...patch,
      },
    },
  };
}

export function markCandidateScanned(
  state: PersistentWorkerState,
  candidateInput: Candidate,
  runId: string,
  updatedAt: string,
): PersistentWorkerState {
  assertDate(updatedAt);
  const candidate = CandidateSchema.parse(candidateInput);
  const identities = candidateIdentityList(candidate);
  const existing = state.decisions[candidateFingerprints(candidate).candidate];
  const next = decisionFor(state, candidate, {
    status: 'scanned',
    reason: 'shallow_serp_validated',
    attempts: existing?.attempts ?? 0,
    runId,
    updatedAt,
    leaseExpiresAt: null,
  });
  return {
    ...next,
    candidateFingerprints: [...new Set([...next.candidateFingerprints, ...identities])],
    dedupeHashes: [...new Set([...next.dedupeHashes, ...identities.map(hashIdentity)])],
  };
}

export function reserveCandidate(
  state: PersistentWorkerState,
  candidateInput: Candidate,
  runId: string,
  _mode: RunMode,
  updatedAt: string,
  leaseMs = DEFAULT_LEASE_MS,
): PersistentWorkerState {
  const now = assertDate(updatedAt);
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new Error('Candidate lease must be positive and bounded.');
  const candidate = CandidateSchema.parse(candidateInput);
  const fingerprint = candidateFingerprints(candidate).candidate;
  const existing = state.decisions[fingerprint];
  if (existing?.status === 'leased' && existing.runId === runId && assertDate(existing.leaseExpiresAt as string) > now) return state;
  if (existing?.status === 'leased' && existing.leaseExpiresAt && assertDate(existing.leaseExpiresAt) > now) {
    throw new Error('Candidate already has an active reservation in another run.');
  }
  if (existing && ['completed', 'terminal', 'manual_attention'].includes(existing.status)) {
    throw new Error('Candidate is terminal and cannot be retried.');
  }
  const attempts = (existing?.attempts ?? 0) + 1;
  if (attempts > MAX_CANDIDATE_ATTEMPTS) throw new Error('Candidate retry limit is exhausted.');
  return decisionFor(state, candidate, {
    status: 'leased',
    reason: 'draft_reservation',
    attempts,
    runId,
    updatedAt,
    leaseExpiresAt: new Date(now + leaseMs).toISOString(),
  });
}

export function markCandidateFailure(
  state: PersistentWorkerState,
  candidateInput: Candidate,
  runId: string,
  reason: string,
  retryable: boolean,
  updatedAt: string,
): PersistentWorkerState {
  assertDate(updatedAt);
  const candidate = CandidateSchema.parse(candidateInput);
  const existing = state.decisions[candidateFingerprints(candidate).candidate];
  const attempts = existing?.attempts ?? 0;
  const reconciliation = reason === 'reconciliation_required';
  const status: CandidateDecision['status'] = reconciliation
    ? 'manual_attention'
    : retryable && attempts < MAX_CANDIDATE_ATTEMPTS ? 'retryable' : 'terminal';
  return decisionFor(state, candidate, {
    status,
    reason,
    attempts,
    runId,
    updatedAt,
    leaseExpiresAt: null,
  });
}

export function markCandidateCompleted(
  state: PersistentWorkerState,
  candidateInput: Candidate,
  runId: string,
  reason: string,
  updatedAt: string,
): PersistentWorkerState {
  const candidate = CandidateSchema.parse(candidateInput);
  const existing = state.decisions[candidateFingerprints(candidate).candidate];
  return decisionFor(state, candidate, {
    status: 'completed',
    reason,
    attempts: existing?.attempts ?? 0,
    runId,
    updatedAt,
    leaseExpiresAt: null,
  });
}

/** Deferring a viable topic is queue management, not a failed paid attempt. */
export function deferCandidate(
  state: PersistentWorkerState,
  candidate: Candidate,
  runId: string,
  reason: string,
  updatedAt: string,
): PersistentWorkerState {
  const existing = state.decisions[candidateFingerprints(candidate).candidate];
  return decisionFor(state, candidate, {
    status: 'retryable', reason, runId, updatedAt, leaseExpiresAt: null,
    attempts: Math.max(0, (existing?.attempts ?? 0) - 1),
  });
}

export function recoverExpiredReservations(state: PersistentWorkerState, nowIso: string): PersistentWorkerState {
  const now = assertDate(nowIso);
  const decisions = Object.fromEntries(Object.entries(state.decisions).map(([fingerprint, decision]) => {
    if (decision.status !== 'leased' || !decision.leaseExpiresAt || assertDate(decision.leaseExpiresAt) > now) {
      return [fingerprint, decision];
    }
    return [fingerprint, {
      ...decision,
      status: decision.attempts >= MAX_CANDIDATE_ATTEMPTS ? 'terminal' : 'retryable',
      reason: decision.attempts >= MAX_CANDIDATE_ATTEMPTS ? 'lease_expired_retry_limit' : 'lease_expired',
      updatedAt: nowIso,
      leaseExpiresAt: null,
    } satisfies CandidateDecision];
  }));
  const manualPilot = state.manualPilot?.status === 'leased'
    && state.manualPilot.leaseExpiresAt
    && assertDate(state.manualPilot.leaseExpiresAt) <= now
    ? null
    : state.manualPilot;
  return { ...state, decisions, manualPilot };
}

export function reserveManualPilot(
  stateInput: PersistentWorkerState,
  runId: string,
  nowIso: string,
  leaseMs = DEFAULT_LEASE_MS,
): PersistentWorkerState {
  const now = assertDate(nowIso);
  const state = recoverExpiredReservations(stateInput, nowIso);
  if (state.manualPilot) {
    if (state.manualPilot.runId === runId && state.manualPilot.status === 'leased') return state;
    throw new Error('The one manual pending-metrics pilot was already reserved, prepared, or consumed.');
  }
  return {
    ...state,
    manualPilot: {
      runId,
      status: 'leased',
      reservedAt: nowIso,
      leaseExpiresAt: new Date(now + leaseMs).toISOString(),
      artifactHash: null,
      consumedAt: null,
    },
  };
}

export function markManualPilotPrepared(
  state: PersistentWorkerState,
  runId: string,
  artifactHash: string,
  nowIso: string,
): PersistentWorkerState {
  assertDate(nowIso);
  if (!/^[0-9a-f]{64}$/u.test(artifactHash)) throw new Error('Manual pilot artifact hash is invalid.');
  if (!state.manualPilot || state.manualPilot.runId !== runId || state.manualPilot.status !== 'leased') {
    throw new Error('Manual pilot has no active reservation.');
  }
  return {
    ...state,
    manualPilot: {
      ...state.manualPilot,
      status: 'prepared',
      leaseExpiresAt: null,
      artifactHash,
      consumedAt: null,
    },
  };
}

export async function consumePreparedManualPilot(
  store: GitHubStateStore,
  runId: string,
  artifactHash: string,
  nowIso: string,
): Promise<void> {
  assertDate(nowIso);
  const loaded = await store.load();
  const pilot = loaded.state.manualPilot;
  if (pilot?.runId === runId && pilot.status === 'consumed' && pilot.artifactHash === artifactHash) return;
  if (!pilot || pilot.runId !== runId || pilot.status !== 'prepared' || pilot.artifactHash !== artifactHash) {
    throw new Error('Manual pilot artifact acknowledgement does not match durable prepared state.');
  }
  await store.save({
    ...loaded.state,
    manualPilot: { ...pilot, status: 'consumed', consumedAt: nowIso },
  }, loaded.version);
}

function inventoryIdentities(entry: RecoveryInventoryEntry): string[] {
  return [
    entry.articleId ? `article:${entry.articleId.toLocaleLowerCase('en-US')}` : undefined,
    entry.primaryKeyword ? `keyword:${entry.primaryKeyword.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, ' ').trim().replace(/\s+/gu, ' ')}` : undefined,
    entry.title ? `title:${entry.title.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, ' ').trim().replace(/\s+/gu, ' ')}` : undefined,
    entry.slug ? `slug:${entry.slug.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')}` : undefined,
    entry.intentFingerprint,
  ].filter((value): value is string => Boolean(value));
}

export function buildIncrementalQueue(input: {
  state: PersistentWorkerState;
  backlog: Candidate[];
  discoveries?: Candidate[];
  inventory?: RecoveryInventoryEntry[];
  now: string;
}): { state: PersistentWorkerState; all: Candidate[]; scan: Candidate[]; tail: Candidate[] } {
  let state = recoverExpiredReservations(input.state, input.now);
  const inventory = new Set((input.inventory ?? []).flatMap(inventoryIdentities));
  const seenByIdentity = new Map<string, string>();
  const all: Candidate[] = [];
  for (const raw of [...state.queuedCandidates, ...input.backlog, ...(input.discoveries ?? [])]) {
    const candidate = CandidateSchema.parse(raw);
    const fingerprint = candidateFingerprints(candidate).candidate;
    const identities = candidateIdentityList(candidate);
    const previousCandidate = identities.map((identity) => seenByIdentity.get(identity)).find(Boolean);
    if (previousCandidate) {
      if (previousCandidate === fingerprint) continue;
      throw new Error(`Candidate identity collision detected for ${candidate.articleId}.`);
    }
    identities.forEach((identity) => seenByIdentity.set(identity, fingerprint));
    const decision = state.decisions[fingerprint];
    if (identities.some((identity) => inventory.has(identity))) {
      if (decision?.status === 'completed') continue;
      state = decisionFor(state, candidate, {
        status: 'manual_attention',
        reason: 'target_inventory_match',
        attempts: decision?.attempts ?? 0,
        runId: decision?.runId ?? 'startup-reconciliation',
        updatedAt: input.now,
        leaseExpiresAt: null,
      });
      continue;
    }
    if (decision && !['retryable'].includes(decision.status)) continue;
    if (!decision && identities.some((identity) => (
      state.candidateFingerprints.includes(identity) || state.dedupeHashes.includes(hashIdentity(identity))
    ))) continue;
    all.push(candidate);
  }

  // Balance eligible campaigns in first-seen order, preserving each campaign's queue order.
  const candidatesByCampaign = new Map<Candidate['campaignId'], Candidate[]>();
  for (const candidate of all) {
    const campaign = candidatesByCampaign.get(candidate.campaignId);
    if (campaign) campaign.push(candidate);
    else candidatesByCampaign.set(candidate.campaignId, [candidate]);
  }
  const fairQueue: Candidate[] = [];
  for (let round = 0; fairQueue.length < all.length; round += 1) {
    for (const campaign of candidatesByCampaign.values()) {
      const candidate = campaign[round];
      if (candidate) fairQueue.push(candidate);
    }
  }

  return {
    state: compactPersistentWorkerState(state),
    all: fairQueue,
    scan: fairQueue.slice(0, RUN_LIMITS.maxCandidatesScanned),
    tail: fairQueue.slice(RUN_LIMITS.maxCandidatesScanned),
  };
}
