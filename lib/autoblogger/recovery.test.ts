import { describe, expect, it } from 'vitest';

import { CAMPAIGN_IDS, CandidateSchema, candidateFingerprints, type Candidate } from './domain';
import { compactPersistentWorkerState, createPersistentWorkerState, PersistentWorkerStateSchema } from './github-runtime';
import {
  buildIncrementalQueue,
  consumePreparedManualPilot,
  markManualPilotPrepared,
  markCandidateFailure,
  markCandidateScanned,
  recoverExpiredReservations,
  reserveCandidate,
  reserveManualPilot,
  grantManualRetryApproval,
  grantManualTargetSwitch,
  grantManualTargetRetry,
  hasManualRetryApproval,
  grantManualFreshCandidate,
  hasManualFreshCandidate,
  markCandidateCompleted,
  deferCandidate,
} from './recovery';
import { createFileStateStore } from './local-state';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

function candidate(index: number, campaignNumber = 1): Candidate {
  const campaignId = CAMPAIGN_IDS[campaignNumber - 1];
  return CandidateSchema.parse({
    schemaVersion: 1,
    articleId: `vc-c${campaignNumber}-${String(index).padStart(3, '0')}`,
    campaignId,
    icp: campaignId,
    primaryKeyword: `${campaignId} video plan ${index}`,
    secondaryKeywords: [],
    title: `${campaignId} Video Plan ${index}`,
    slug: `${campaignId}-video-plan-${index}`,
    intent: 'informational',
    funnelStage: 'top',
  });
}

describe('bounded candidate recovery', () => {
  const retryAt = '2026-09-06T21:00:00.000Z';
  const grantInput = { priorRunId: 'run-3', runId: 'approved-attempt-4', reason: 'user_authorized_after_input_fix', approvedAt: retryAt };
  function exhausted() {
    const item = candidate(1, 2);
    let state = createPersistentWorkerState();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const at = `2026-09-06T20:0${attempt}:00.000Z`;
      const runId = `run-${attempt}`;
      state = reserveCandidate(state, item, runId, 'manual_pilot', at);
      state = markCandidateScanned(state, item, runId, at);
      state = markCandidateFailure(state, item, runId, 'candidate_failed', true, at);
      state.runs[runId] = { schemaVersion: 1, runId, mode: 'manual_pilot', startedAt: at, selectedCandidateFingerprints: [candidateFingerprints(item).candidate], status: 'failed' };
      state.failures.push({ runId, code: 'candidate_failed', attempt, observedAt: at, detail: 'Retained failure.' });
    }
    return { item, state, fp: candidateFingerprints(item).candidate };
  }

  const switchInput = { parkedRetryRunId: grantInput.runId, runId: 'alternative-pilot', approvedAt: retryAt };
  function switched() {
    const old = exhausted();
    const parked = grantManualRetryApproval(old.state, old.item, grantInput);
    const target = candidate(2, 1);
    return { ...old, parked, target, state: grantManualTargetSwitch(parked, target, switchInput) };
  }

  function exhaustedSwitchedTarget() {
    const input = switched();
    let state = input.state;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const runId = attempt === 1 ? switchInput.runId : `target-attempt-${attempt}`;
      const at = `2026-09-06T21:0${attempt}:00.000Z`;
      if (attempt > 1) state = grantManualTargetRetry(state, input.target, {
        priorRunId: attempt === 2 ? switchInput.runId : 'target-attempt-2', runId, approvedAt: at,
      });
      state = reserveCandidate(state, input.target, runId, 'manual_pilot', at);
      state = markCandidateFailure(state, input.target, runId, 'candidate_failed', true, at);
      const fp = candidateFingerprints(input.target).candidate;
      state.runs[runId] = { schemaVersion: 1, runId, mode: 'manual_pilot', startedAt: at, selectedCandidateFingerprints: [fp], status: 'failed' };
      state.failures.push({ runId, candidateFingerprint: fp, code: 'candidate_failed', attempt, observedAt: at, detail: 'Retained automatic failure.' });
    }
    return { ...input, state, targetFp: candidateFingerprints(input.target).candidate };
  }

  const extraInput = { priorRunId: 'target-attempt-3', runId: 'target-extra-attempt-4', approvedAt: '2026-09-06T22:00:00.000Z', extraAttempt: true };

  const freshInput = { runId: 'fresh-topic-proof', approvedAt: '2026-09-08T00:00:00.000Z' };
  it.each(['success', 'failure', 'deferred', 'expired'])('uses exactly one fresh attempt with immutable history: %s', async (outcome) => {
    const { state } = exhaustedSwitchedTarget();
    const item = candidate(90);
    state.queuedCandidates = [item];
    const before = structuredClone(state);
    const fp = candidateFingerprints(item).candidate;
    const approved = grantManualFreshCandidate(state, item, freshInput);
    expect(approved.manualFreshCandidateApproval).toMatchObject({ schemaVersion: 1, ...freshInput,
      reason: 'user_authorized_new_topic_proof', candidate: item, consumedAt: null,
      priorHistoryHash: createHash('sha256').update(JSON.stringify({ manualRetryApproval: before.manualRetryApproval, manualTargetSwitch: before.manualTargetSwitch })).digest('hex') });
    expect(approved.queuedCandidates).toEqual([item]);
    expect(hasManualFreshCandidate(approved, item, freshInput.runId, 'manual_pilot', freshInput.approvedAt)).toBe(true);
    let reserved = reserveCandidate(reserveManualPilot(approved, freshInput.runId, freshInput.approvedAt), item, freshInput.runId, 'manual_pilot', freshInput.approvedAt);
    expect(reserved.decisions[fp]).toMatchObject({ attempts: 1, status: 'leased' });
    expect(reserved.manualFreshCandidateApproval?.consumedAt).toBe(freshInput.approvedAt);
    expect(() => reserveCandidate(reserved, item, freshInput.runId, 'manual_pilot', freshInput.approvedAt)).toThrow();
    reserved = markCandidateScanned(reserved, item, freshInput.runId, freshInput.approvedAt);
    if (outcome === 'success') {
      reserved = markCandidateCompleted(reserved, item, freshInput.runId, 'artifact_prepared', freshInput.approvedAt);
      reserved.runs[freshInput.runId] = { schemaVersion: 1, runId: freshInput.runId, mode: 'manual_pilot', startedAt: freshInput.approvedAt, selectedCandidateFingerprints: [fp], status: 'validated' };
      reserved.contentHashes[fp] = 'b'.repeat(64);
      reserved = markManualPilotPrepared(reserved, freshInput.runId, 'b'.repeat(64), freshInput.approvedAt);
      await consumePreparedManualPilot({ load: async () => ({ state: reserved, version: 'v1' }), save: async (next) => {
        reserved = PersistentWorkerStateSchema.parse(next); return { version: 'v2' };
      } }, freshInput.runId, 'b'.repeat(64), freshInput.approvedAt);
      expect(reserved.manualPilot?.status).toBe('consumed');
    } else if (outcome === 'deferred') reserved = deferCandidate(reserved, item, freshInput.runId, 'budget_deferred', freshInput.approvedAt);
    else if (outcome === 'expired') {
      const leased = reserveCandidate(approved, item, freshInput.runId, 'manual_pilot', freshInput.approvedAt);
      reserved = recoverExpiredReservations(leased, '2026-09-09T00:00:00.000Z');
    } else reserved = markCandidateFailure(reserved, item, freshInput.runId, 'candidate_failed', true, freshInput.approvedAt);
    expect(reserved.decisions[fp]).toMatchObject({ attempts: 1, status: outcome === 'success' ? 'completed' : 'terminal' });
    const compacted = compactPersistentWorkerState(reserved);
    expect(compacted.manualRetryApproval).toEqual(before.manualRetryApproval);
    expect(compacted.manualTargetSwitch).toEqual(before.manualTargetSwitch);
    expect(compacted.decisions).toMatchObject(before.decisions);
    expect(compacted.runs).toMatchObject(before.runs);
    expect(compacted.failures).toEqual(before.failures);
    expect(() => grantManualFreshCandidate({ ...compacted, manualPilot: null }, candidate(91), { ...freshInput, runId: 'another' })).toThrow();
    expect(state).toEqual(before);
  });

  it.each(['seen', 'dedupe', 'projection', 'hash', 'pr', 'decision', 'queue-collision', 'old-target', 'same-intent-new-slug', 'lease', 'attention', 'pilot', 'unconsumed-retry', 'reused-run', 'early'])('rejects unsafe fresh grants: %s', problem => {
    const { state, target } = exhaustedSwitchedTarget();
    let item = candidate(90);
    const fp = candidateFingerprints(item).candidate;
    const id = candidateFingerprints(item).intent;
    if (problem === 'seen') state.candidateFingerprints.push(id);
    if (problem === 'dedupe') state.dedupeHashes.push(createHash('sha256').update(id).digest('hex'));
    if (problem === 'projection') state.candidates[fp] = { mode: 'manual_pilot', status: 'failed', runId: 'old', updatedAt: retryAt };
    if (problem === 'hash') state.contentHashes[fp] = 'a'.repeat(64);
    if (problem === 'pr') state.pullRequests[fp] = { number: 1, url: 'https://example.com/pr/1', status: 'opened' };
    if (problem === 'decision') state.decisions[fp] = { ...state.decisions[candidateFingerprints(target).candidate], identities: Object.values(candidateFingerprints(item)), articleId: item.articleId, intentFingerprint: id, attempts: 0 };
    if (problem === 'queue-collision') state.queuedCandidates.push({ ...item, secondaryKeywords: ['changed row'] });
    if (problem === 'old-target') item = target;
    if (problem === 'same-intent-new-slug') item = { ...target, articleId: item.articleId, title: item.title, slug: item.slug };
    if (problem === 'lease' || problem === 'attention') state.decisions['unrelated'] = { ...state.decisions[candidateFingerprints(target).candidate], attempts: 1,
      status: problem === 'lease' ? 'leased' : 'manual_attention', leaseExpiresAt: problem === 'lease' ? '2026-09-09T00:00:00.000Z' : null };
    if (problem === 'pilot') state.manualPilot = reserveManualPilot(state, 'unrelated', freshInput.approvedAt).manualPilot;
    if (problem === 'unconsumed-retry') state.manualTargetSwitch!.retry!.consumedAt = null;
    expect(() => grantManualFreshCandidate(state, item, { ...freshInput,
      runId: problem === 'reused-run' ? 'target-attempt-3' : freshInput.runId,
      approvedAt: problem === 'early' ? '2026-09-05T00:00:00.000Z' : freshInput.approvedAt })).toThrow();
  });

  it.each(['scheduled', 'other-target', 'other-run', 'changed-row', 'early', 'history-tamper'])('rejects fresh reservation with %s', problem => {
    const { state } = exhaustedSwitchedTarget();
    const item = candidate(90);
    const approved = grantManualFreshCandidate(state, item, freshInput);
    if (problem === 'history-tamper') approved.manualRetryApproval!.reason = 'altered history';
    const target = problem === 'other-target' ? candidate(91) : problem === 'changed-row' ? { ...item, secondaryKeywords: ['changed'] } : item;
    const runId = problem === 'other-run' ? 'unapproved' : freshInput.runId;
    const mode = problem === 'scheduled' ? 'scheduled' : 'manual_pilot';
    const at = problem === 'early' ? retryAt : freshInput.approvedAt;
    expect(hasManualFreshCandidate(approved, target, runId, mode, at)).toBe(false);
    expect(() => reserveCandidate(approved, target, runId, mode, at)).toThrow();
  });

  it.each(['attempt-two', 'other-decision', 'published', 'wrong-run-mode', 'reset-consumption', 'wrong-pilot'])('validates the consumed fresh lifecycle: %s', problem => {
    const { state } = exhaustedSwitchedTarget();
    const item = candidate(90);
    const fp = candidateFingerprints(item).candidate;
    const next = reserveCandidate(grantManualFreshCandidate(state, item, freshInput), item, freshInput.runId, 'manual_pilot', freshInput.approvedAt);
    if (problem === 'attempt-two') next.decisions[fp].attempts = 2;
    if (problem === 'other-decision') next.decisions.other = { ...next.decisions[fp] };
    if (problem === 'published') next.pullRequests[fp] = { number: 1, url: 'https://example.com/pr/1', status: 'opened' };
    if (problem === 'wrong-run-mode') next.runs[freshInput.runId] = { schemaVersion: 1, runId: freshInput.runId, mode: 'scheduled', startedAt: freshInput.approvedAt, selectedCandidateFingerprints: [fp], status: 'validated' };
    if (problem === 'reset-consumption') next.manualFreshCandidateApproval!.consumedAt = null;
    if (problem === 'wrong-pilot') next.manualPilot = reserveManualPilot(next, 'wrong', freshInput.approvedAt).manualPilot;
    expect(PersistentWorkerStateSchema.safeParse(next).success).toBe(false);
  });

  it('reserves one explicitly approved fourth target attempt with all prior decisions and grants retained', () => {
    const { state, target, targetFp } = exhaustedSwitchedTarget();
    const before = structuredClone(state);
    const approved = grantManualTargetRetry(state, target, extraInput);
    expect(approved.manualTargetSwitch?.retryHistory).toEqual([...before.manualTargetSwitch!.retryHistory!, before.manualTargetSwitch!.retry]);
    expect(approved.manualTargetSwitch?.retry).toMatchObject({ reason: 'user_authorized_after_editorial_fix', priorDecision: before.decisions[targetFp], consumedAt: null });
    for (const key of ['runs', 'failures', 'decisions', 'manualRetryApproval', 'contentHashes', 'pullRequests'] as const) expect(approved[key]).toEqual(before[key]);
    const queue = buildIncrementalQueue({ state: reserveManualPilot(approved, extraInput.runId, extraInput.approvedAt), backlog: [target], runId: extraInput.runId, mode: 'manual_pilot', now: extraInput.approvedAt });
    expect(queue.scan).toEqual([target]);
    const reserved = reserveCandidate(queue.state, target, extraInput.runId, 'manual_pilot', extraInput.approvedAt);
    expect(reserved.decisions[targetFp]).toMatchObject({ attempts: 4, status: 'leased', runId: extraInput.runId });
    expect(reserved.manualTargetSwitch?.retry?.consumedAt).toBe(extraInput.approvedAt);
    const compacted = compactPersistentWorkerState(reserved);
    expect(compacted.manualTargetSwitch).toEqual(reserved.manualTargetSwitch);
    expect(compacted.runs).toEqual(before.runs);
    const prepared = markManualPilotPrepared(reserved, extraInput.runId, 'b'.repeat(64), extraInput.approvedAt);
    expect(PersistentWorkerStateSchema.safeParse(prepared).success).toBe(true);
    expect(() => reserveCandidate(recoverExpiredReservations(reserved, '2026-09-07T01:00:00.000Z'), target, 'fifth', 'manual_pilot', '2026-09-07T01:00:00.000Z')).toThrow();
    expect(() => reserveCandidate(reserved, target, extraInput.runId, 'manual_pilot', extraInput.approvedAt)).toThrow();
    const failed = markCandidateFailure(reserved, target, extraInput.runId, 'candidate_failed', true, extraInput.approvedAt);
    failed.runs[extraInput.runId] = { schemaVersion: 1, runId: extraInput.runId, mode: 'manual_pilot', startedAt: extraInput.approvedAt, selectedCandidateFingerprints: [targetFp], status: 'failed' };
    failed.failures.push({ runId: extraInput.runId, candidateFingerprint: targetFp, code: 'candidate_failed', attempt: 4, observedAt: extraInput.approvedAt, detail: 'Retained fourth failure.' });
    expect(PersistentWorkerStateSchema.safeParse(failed).success).toBe(true);
    expect(failed.decisions[targetFp]).toMatchObject({ attempts: 4, status: 'terminal' });
    expect(() => grantManualTargetRetry({ ...failed, manualPilot: null }, target, { ...extraInput, priorRunId: extraInput.runId, runId: 'fifth' })).toThrow();
    expect(state).toEqual(before);
  });

  it('never treats an ordinary retry request as fourth-attempt authorization', () => {
    const { state, target } = exhaustedSwitchedTarget();
    expect(() => grantManualTargetRetry(state, target, { ...extraInput, extraAttempt: false })).toThrow();
    expect(() => grantManualTargetRetry(state, target, { priorRunId: extraInput.priorRunId, runId: extraInput.runId, approvedAt: extraInput.approvedAt })).toThrow();
  });

  it.each(['scheduled', 'other-run', 'changed-title', 'missing-history', 'wrong-reason', 'missing-third-failure', 'reused-run', 'old-approval'])(
    'rejects an exceptional fourth target attempt with %s', (problem) => {
      const { state, target } = exhaustedSwitchedTarget();
      const approved = grantManualTargetRetry(state, target, extraInput);
      if (problem === 'scheduled' || problem === 'other-run' || problem === 'changed-title') {
        expect(() => reserveCandidate(approved, problem === 'changed-title' ? { ...target, title: 'Another title' } : target,
          problem === 'other-run' ? 'unapproved-run' : extraInput.runId, problem === 'scheduled' ? 'scheduled' : 'manual_pilot', extraInput.approvedAt)).toThrow();
        return;
      }
      if (problem === 'missing-history') approved.manualTargetSwitch!.retryHistory!.pop();
      if (problem === 'wrong-reason') approved.manualTargetSwitch!.retry!.reason = 'user_authorized_after_attribution_fix';
      if (problem === 'missing-third-failure') approved.failures = approved.failures.filter(f => f.runId !== extraInput.priorRunId);
      if (problem === 'reused-run') approved.manualTargetSwitch!.retry!.runId = 'target-attempt-2';
      if (problem === 'old-approval') approved.manualTargetSwitch!.retry!.approvedAt = retryAt;
      expect(PersistentWorkerStateSchema.safeParse(approved).success).toBe(false);
    });

  it('marks a failed consumed one-use target switch terminal even below the normal retry cap', () => {
    const { state, target, parked } = switched();
    const reserved = reserveCandidate(state, target, switchInput.runId, 'manual_pilot', retryAt);
    const failed = markCandidateFailure(reserved, target, switchInput.runId, 'insufficient_data:missing_serp', true, retryAt);
    expect(failed.decisions[candidateFingerprints(target).candidate]).toMatchObject({ status: 'terminal', attempts: 1 });
    expect(failed.manualRetryApproval).toEqual(parked.manualRetryApproval);
    expect(failed.manualTargetSwitch).toEqual(reserved.manualTargetSwitch);
  });

  it('parks the unchanged old grant and reserves a distinct target once at its normal first attempt', () => {
    const { state, parked, item, target, fp } = switched();
    expect(state.manualRetryApproval).toEqual(parked.manualRetryApproval);
    for (const field of ['runs', 'failures', 'decisions', 'candidates', 'contentHashes', 'pullRequests', 'candidateFingerprints', 'dedupeHashes'] as const) expect(state[field]).toEqual(parked[field]);
    expect(state.manualTargetSwitch).toMatchObject({ ...switchInput, candidate: target, startingAttempts: 0, consumedAt: null });
    expect(hasManualRetryApproval(state, item, grantInput.runId, 'manual_pilot', retryAt)).toBe(false);
    const leased = reserveManualPilot(state, switchInput.runId, retryAt);
    expect(PersistentWorkerStateSchema.safeParse(leased).success).toBe(true);
    const reserved = reserveCandidate(leased, target, switchInput.runId, 'manual_pilot', retryAt);
    expect(reserved.decisions[candidateFingerprints(target).candidate]).toMatchObject({ attempts: 1, runId: switchInput.runId });
    expect(reserved.decisions[fp]).toEqual(parked.decisions[fp]);
    expect(reserved.manualRetryApproval).toEqual(parked.manualRetryApproval);
    expect(reserved.manualTargetSwitch?.consumedAt).toBe(retryAt);
    expect(() => reserveCandidate(reserved, target, switchInput.runId, 'manual_pilot', retryAt)).toThrow();
    const prepared = markManualPilotPrepared(reserved, switchInput.runId, 'a'.repeat(64), retryAt);
    expect(PersistentWorkerStateSchema.safeParse(prepared).success).toBe(true);
    const consumed = { ...prepared, manualPilot: { ...prepared.manualPilot!, status: 'consumed', consumedAt: retryAt } };
    expect(PersistentWorkerStateSchema.safeParse(consumed).success).toBe(true);
    expect(PersistentWorkerStateSchema.safeParse({ ...consumed, manualPilot: { ...consumed.manualPilot, runId: 'other' } }).success).toBe(false);
    expect(() => grantManualTargetSwitch(reserved, candidate(3), { ...switchInput, runId: 'second-switch' })).toThrow();
  });

  it.each(['old-target', 'old-keyword', 'old-title', 'old-run', 'wrong-parked-run', 'scheduled', 'other-run', 'other-target', 'changed-title', 'changed-old-grant', 'premature-success'])('fails closed for target switch %s', (problem) => {
    const { state, parked, target, item } = switched();
    if (problem === 'old-target') expect(() => grantManualTargetSwitch(parked, item, switchInput)).toThrow();
    if (problem === 'old-keyword' || problem === 'old-title') expect(() => grantManualTargetSwitch(parked, { ...target, [problem === 'old-keyword' ? 'primaryKeyword' : 'title']: problem === 'old-keyword' ? item.primaryKeyword : item.title }, switchInput)).toThrow();
    if (problem === 'old-run') expect(() => grantManualTargetSwitch(parked, target, { ...switchInput, runId: grantInput.runId })).toThrow();
    if (problem === 'wrong-parked-run') expect(() => grantManualTargetSwitch(parked, target, { ...switchInput, parkedRetryRunId: 'wrong' })).toThrow();
    if (problem === 'changed-old-grant') expect(PersistentWorkerStateSchema.safeParse({ ...state, manualRetryApproval: { ...state.manualRetryApproval, reason: 'changed' } }).success).toBe(false);
    if (problem === 'premature-success') expect(PersistentWorkerStateSchema.safeParse({ ...state, manualPilot: { runId: switchInput.runId, status: 'prepared', reservedAt: retryAt, leaseExpiresAt: null, artifactHash: 'a'.repeat(64), consumedAt: null } }).success).toBe(false);
    if (['scheduled', 'other-run', 'other-target', 'changed-title'].includes(problem)) expect(() => reserveCandidate(state,
      problem === 'other-target' ? item : problem === 'changed-title' ? { ...target, title: 'Changed' } : target,
      problem === 'other-run' ? 'other' : switchInput.runId, problem === 'scheduled' ? 'scheduled' : 'manual_pilot', retryAt)).toThrow();
  });

  it('keeps existing new-target attempts, never decrements a switch, and does not permit attempt four', () => {
    const { parked, target } = switched();
    const fp = candidateFingerprints(target).candidate;
    for (const attempts of [2, 3]) {
      const prior = { ...parked, decisions: { ...parked.decisions, [fp]: { articleId: target.articleId, intentFingerprint: candidateFingerprints(target).intent,
        identities: Object.values(candidateFingerprints(target)), status: 'retryable' as const, reason: 'temporary', attempts, runId: 'earlier-target-run', updatedAt: retryAt, leaseExpiresAt: null } } };
      if (attempts === 3) { expect(() => grantManualTargetSwitch(prior, target, switchInput)).toThrow(); continue; }
      const approved = grantManualTargetSwitch(prior, target, switchInput);
      const reserved = reserveCandidate(approved, target, switchInput.runId, 'manual_pilot', retryAt);
      expect(reserved.decisions[fp].attempts).toBe(3);
      expect(deferCandidate(reserved, target, switchInput.runId, 'not_selected', retryAt).decisions[fp]).toMatchObject({ attempts: 3, status: 'terminal' });
      expect(() => reserveCandidate(recoverExpiredReservations(reserved, '2026-09-06T22:00:00.000Z'), target, switchInput.runId, 'manual_pilot', '2026-09-06T22:00:00.000Z')).toThrow();
    }
  });

  it('grants and consumes one exact fourth reservation without resetting history or identities', () => {
    const { item, state, fp } = exhausted();
    const before = structuredClone(state);
    const approved = grantManualRetryApproval(state, item, grantInput);
    expect(approved.decisions).toEqual(before.decisions);
    expect(approved.runs).toEqual(before.runs);
    expect(approved.failures).toEqual(before.failures);
    expect(approved.candidateFingerprints).toEqual(before.candidateFingerprints);
    expect(approved.dedupeHashes).toEqual(before.dedupeHashes);
    expect(approved.manualRetryApproval).toMatchObject({ ...grantInput, candidateFingerprint: fp, articleId: item.articleId, mode: 'manual_pilot', consumedAt: null });
    const queue = buildIncrementalQueue({ state: approved, backlog: [item], now: retryAt, runId: grantInput.runId, mode: 'manual_pilot' });
    expect(queue.scan).toEqual([item]);
    const reserved = reserveCandidate(queue.state, item, grantInput.runId, 'manual_pilot', retryAt);
    expect(reserved.decisions[fp]).toMatchObject({ attempts: 4, status: 'leased', runId: grantInput.runId });
    expect(reserved.manualRetryApproval?.consumedAt).toBe(retryAt);
    expect(PersistentWorkerStateSchema.safeParse(reserved).success).toBe(true);
    expect(() => reserveCandidate(reserved, item, grantInput.runId, 'manual_pilot', retryAt)).toThrow(/retry|exhausted/i);
    const failed = markCandidateFailure(reserved, item, grantInput.runId, 'candidate_failed', true, retryAt);
    expect(failed.decisions[fp]).toMatchObject({ attempts: 4, status: 'terminal' });
    expect(() => grantManualRetryApproval(failed, item, { ...grantInput, runId: 'run-5' })).toThrow();
    expect(state).toEqual(before);
  });

  it.each(['completed', 'manual_attention', 'wrong-reason', 'second-attempt', 'artifact', 'pr', 'pilot-prepared', 'changed-title', 'other-candidate', 'prior-run', 'wrong-prior', 'empty-reason', 'invalid-date'])(
    'refuses a manual grant for %s', (problem) => {
      const { state, item, fp } = exhausted();
      const input = { ...grantInput };
      let target = item;
      if (problem === 'completed' || problem === 'manual_attention') state.decisions[fp].status = problem;
      if (problem === 'wrong-reason') state.decisions[fp].reason = 'ineligible:product_irrelevance';
      if (problem === 'second-attempt') state.decisions[fp].attempts = 2;
      if (problem === 'artifact') state.contentHashes[fp] = 'a'.repeat(64);
      if (problem === 'pr') state.pullRequests[fp] = { number: 1, url: 'https://github.com/owner/repo/pull/1', status: 'already_exists' };
      if (problem === 'pilot-prepared') state.manualPilot = { runId: 'prior', status: 'prepared', reservedAt: retryAt, leaseExpiresAt: null, artifactHash: 'a'.repeat(64), consumedAt: null };
      if (problem === 'changed-title') target = { ...item, title: 'Changed title' };
      if (problem === 'other-candidate') target = candidate(2, 2);
      if (problem === 'prior-run') input.runId = 'run-3';
      if (problem === 'wrong-prior') input.priorRunId = 'run-2';
      if (problem === 'empty-reason') input.reason = '';
      if (problem === 'invalid-date') input.approvedAt = 'invalid';
      const before = structuredClone(state);
      expect(() => grantManualRetryApproval(state, target, input)).toThrow();
      expect(state).toEqual(before);
    },
  );

  it.each(['scheduled', 'other-run', 'other-candidate', 'inventory', 'no-run-context'])(
    'does not use the terminal retry exception for %s', (problem) => {
      const { item, state } = exhausted();
      const approved = grantManualRetryApproval(state, item, grantInput);
      const mode = problem === 'scheduled' ? 'scheduled' as const : 'manual_pilot' as const;
      const runId = problem === 'other-run' ? 'other-run' : grantInput.runId;
      const target = problem === 'other-candidate' ? { ...item, title: 'Changed title' } : item;
      if (problem === 'inventory') {
        expect(() => buildIncrementalQueue({ state: approved, backlog: [target], now: retryAt, runId, mode, inventory: [{ slug: item.slug }] })).toThrow();
        return;
      }
      const queue = buildIncrementalQueue({ state: approved, backlog: [target], now: retryAt,
        ...(problem === 'no-run-context' ? {} : { runId, mode }),
      });
      expect(queue.scan).toEqual([]);
      if (problem !== 'no-run-context') expect(() => reserveCandidate(approved, target, runId, mode, retryAt)).toThrow();
    },
  );

  it('never decrements a consumed manual exception when deferring or expiring its lease', () => {
    const { item, state, fp } = exhausted();
    const reserved = reserveCandidate(grantManualRetryApproval(state, item, grantInput), item, grantInput.runId, 'manual_pilot', retryAt, 1_000);
    expect(deferCandidate(reserved, item, grantInput.runId, 'not_selected', retryAt).decisions[fp]).toMatchObject({ attempts: 4, status: 'terminal' });
    expect(recoverExpiredReservations(reserved, '2026-09-06T21:00:02.000Z').decisions[fp]).toMatchObject({ attempts: 4, status: 'terminal' });
  });

  it('round-robins five full campaigns into ten candidates each in the bounded scan', () => {
    const backlog = CAMPAIGN_IDS.flatMap((_campaignId, campaignIndex) => (
      Array.from({ length: 50 }, (_unused, index) => candidate(index + 1, campaignIndex + 1))
    ));
    const queue = buildIncrementalQueue({
      state: createPersistentWorkerState(), backlog, now: '2026-09-05T00:00:00.000Z',
    });

    expect(queue.scan).toHaveLength(50);
    for (let round = 0; round < 10; round += 1) {
      expect(queue.scan.slice(round * 5, (round + 1) * 5).map(({ campaignId }) => campaignId)).toEqual(CAMPAIGN_IDS);
    }
    for (const campaignId of CAMPAIGN_IDS) {
      expect(queue.scan.filter((item) => item.campaignId === campaignId)).toHaveLength(10);
    }
    expect(queue.all).toEqual([...queue.scan, ...queue.tail]);
    expect(queue.tail).toHaveLength(200);
    expect(queue.tail.slice(0, 5).map(({ articleId }) => articleId)).toEqual([
      'vc-c1-011', 'vc-c2-011', 'vc-c3-011', 'vc-c4-011', 'vc-c5-011',
    ]);
    expect(queue.all.map(({ articleId }) => articleId).sort()).toEqual(backlog.map(({ articleId }) => articleId).sort());
    expect(new Set(queue.all.map(({ articleId }) => articleId)).size).toBe(250);
  });

  it('refills the scan from remaining campaigns when a campaign exhausts its candidates', () => {
    const backlog = CAMPAIGN_IDS.flatMap((_campaignId, campaignIndex) => (
      Array.from({ length: campaignIndex === 0 ? 1 : 50 }, (_unused, index) => candidate(index + 1, campaignIndex + 1))
    ));
    const queue = buildIncrementalQueue({
      state: createPersistentWorkerState(), backlog, now: '2026-09-05T00:00:00.000Z',
    });

    expect(queue.scan).toHaveLength(50);
    expect(CAMPAIGN_IDS.map((campaignId) => queue.scan.filter((item) => item.campaignId === campaignId).length)).toEqual([1, 13, 12, 12, 12]);
    expect(queue.scan.slice(0, 10).map(({ articleId }) => articleId)).toEqual([
      'vc-c1-001', 'vc-c2-001', 'vc-c3-001', 'vc-c4-001', 'vc-c5-001',
      'vc-c2-002', 'vc-c3-002', 'vc-c4-002', 'vc-c5-002', 'vc-c2-003',
    ]);
    expect(queue.scan.at(-1)?.articleId).toBe('vc-c2-013');
    expect(queue.tail.slice(0, 4).map(({ articleId }) => articleId)).toEqual([
      'vc-c3-013', 'vc-c4-013', 'vc-c5-013', 'vc-c2-014',
    ]);
    expect(queue.all).toEqual([...queue.scan, ...queue.tail]);
    expect(queue.tail).toHaveLength(151);
    expect(queue.all.map(({ articleId }) => articleId).sort()).toEqual(backlog.map(({ articleId }) => articleId).sort());
  });

  it('keeps within-campaign queue order across queued, backlog and discovery duplicates', () => {
    const queued = [candidate(9, 3), candidate(7), { ...candidate(2, 3), icp: 'another buyer in the same campaign' }, candidate(4)];
    const backlog = [queued[3], candidate(1), queued[2], candidate(5, 3)];
    const discoveries = [queued[0], candidate(8), candidate(6, 3), backlog[1]];
    const state = { ...createPersistentWorkerState(), queuedCandidates: queued };
    const queue = buildIncrementalQueue({ state, backlog, discoveries, now: '2026-09-05T00:00:00.000Z' });

    expect(queue.all.map(({ articleId }) => articleId)).toEqual([
      'vc-c3-009', 'vc-c1-007', 'vc-c3-002', 'vc-c1-004',
      'vc-c3-005', 'vc-c1-001', 'vc-c3-006', 'vc-c1-008',
    ]);
    expect(queue.scan).toEqual(queue.all);
    expect(queue.tail).toEqual([]);
  });

  it('balances only eligible work after durable identities, lifecycle decisions and lease recovery', () => {
    const now = '2026-09-05T00:02:00.000Z';
    const excluded = Array.from({ length: 8 }, (_unused, index) => candidate(index + 90));
    const recovered = candidate(1, 2);
    let state = reserveManualPilot(createPersistentWorkerState(), 'pilot-1', '2026-09-05T00:00:00.000Z');
    const statuses = ['scanned', 'leased', 'completed', 'terminal', 'manual_attention', 'leased'] as const;
    statuses.forEach((status, index) => {
      const item = excluded[index];
      state = markCandidateScanned(state, item, 'prior-run', '2026-09-05T00:00:00.000Z');
      const fingerprint = candidateFingerprints(item).candidate;
      state.decisions[fingerprint] = {
        ...state.decisions[fingerprint], status,
        attempts: index === 5 ? 3 : 1,
        leaseExpiresAt: status === 'leased'
          ? index === 5 ? '2026-09-05T00:01:00.000Z' : '2026-09-05T00:30:00.000Z'
          : null,
      };
    });
    state.candidateFingerprints.push(candidateFingerprints(excluded[6]).keyword);
    state.dedupeHashes.push(createHash('sha256').update(candidateFingerprints(excluded[7]).title).digest('hex'));
    state = markCandidateScanned(state, recovered, 'prior-run', '2026-09-05T00:00:00.000Z');
    state = reserveCandidate(state, recovered, 'prior-run', 'scheduled', '2026-09-05T00:00:00.000Z', 60_000);
    const eligible = [candidate(1, 3), candidate(2, 3), recovered, candidate(2, 2)];

    const queue = buildIncrementalQueue({ state, backlog: [...excluded, ...eligible], now });

    expect(queue.all.map(({ articleId }) => articleId)).toEqual(['vc-c3-001', 'vc-c2-001', 'vc-c3-002', 'vc-c2-002']);
    expect(queue.scan).toEqual(queue.all);
    expect(queue.tail).toEqual([]);
    expect(queue.state.decisions[candidateFingerprints(recovered).candidate]).toMatchObject({
      status: 'retryable', reason: 'lease_expired', attempts: 1, leaseExpiresAt: null,
    });
    expect(queue.state.decisions[candidateFingerprints(excluded[5]).candidate]).toMatchObject({
      status: 'terminal', reason: 'lease_expired_retry_limit', attempts: 3, leaseExpiresAt: null,
    });
    expect(queue.state.decisions[candidateFingerprints(excluded[1]).candidate]).toEqual(state.decisions[candidateFingerprints(excluded[1]).candidate]);
    expect(queue.state.manualPilot).toEqual(state.manualPilot);
  });

  it.each(['articleId', 'primaryKeyword', 'title', 'slug', 'intentFingerprint'] as const)(
    'excludes inventory matches by %s before allocating campaign scan capacity',
    (field) => {
      const blocked = candidate(1);
      const value = field === 'intentFingerprint' ? candidateFingerprints(blocked).intent : blocked[field].toUpperCase();
      const eligible = [2, 3, 4, 5].flatMap((campaignNumber) => (
        Array.from({ length: 50 }, (_unused, index) => candidate(index + 1, campaignNumber))
      ));
      const queue = buildIncrementalQueue({
        state: createPersistentWorkerState(), backlog: [blocked, ...eligible],
        inventory: [{ [field]: value }], now: '2026-09-05T00:00:00.000Z',
      });

      expect(queue.scan).toHaveLength(50);
      expect(CAMPAIGN_IDS.map((campaignId) => queue.scan.filter((item) => item.campaignId === campaignId).length)).toEqual([0, 13, 13, 12, 12]);
      expect(queue.all).not.toContainEqual(blocked);
      expect(queue.all).toEqual([...queue.scan, ...queue.tail]);
      expect(queue.all.map(({ articleId }) => articleId).sort()).toEqual(eligible.map(({ articleId }) => articleId).sort());
      expect(queue.state.decisions[candidateFingerprints(blocked).candidate]).toMatchObject({
        status: 'manual_attention', reason: 'target_inventory_match', attempts: 0,
      });
    },
  );

  it('still rejects cross-campaign identity collisions beyond the bounded scan', () => {
    const backlog = Array.from({ length: 50 }, (_unused, index) => candidate(index + 1));
    const collision = { ...candidate(1, 2), slug: backlog[0].slug };

    expect(() => buildIncrementalQueue({
      state: createPersistentWorkerState(), backlog, discoveries: [collision], now: '2026-09-05T00:00:00.000Z',
    })).toThrow(/identity collision/i);
  });

  it('preserves the unscanned queue tail and includes retryable candidates', () => {
    let state = createPersistentWorkerState();
    const backlog = Array.from({ length: 75 }, (_unused, index) => candidate(index + 1));
    const scanned = backlog.slice(0, 50);
    for (const item of scanned) {
      state = markCandidateScanned(state, item, 'research-1', '2026-09-05T00:00:00.000Z');
    }
    state = markCandidateFailure(
      reserveCandidate(state, scanned[0], 'research-1', 'scheduled', '2026-09-05T00:01:00.000Z', 60_000),
      scanned[0],
      'research-1',
      'temporary_source_failure',
      true,
      '2026-09-05T00:02:00.000Z',
    );
    state = { ...state, queuedCandidates: [...scanned, ...backlog.slice(50)] };

    const queue = buildIncrementalQueue({ state, backlog, now: '2026-09-05T00:03:00.000Z' });
    expect(queue.scan[0].articleId).toBe(scanned[0].articleId);
    expect(queue.all.some(({ articleId }) => articleId === backlog[74].articleId)).toBe(true);
    expect(queue.tail).toHaveLength(0);
    expect(queue.all).toHaveLength(26);
  });

  it('records all six durable identities and skips unchanged scanned work', () => {
    const item = candidate(1);
    const state = markCandidateScanned(createPersistentWorkerState(), item, 'research-1', '2026-09-05T00:00:00.000Z');
    const fingerprint = candidateFingerprints(item).candidate;
    expect(state.decisions[fingerprint].identities).toEqual(Object.values(candidateFingerprints(item)));
    expect(buildIncrementalQueue({ state, backlog: [item], now: '2026-09-05T00:01:00.000Z' }).scan).toEqual([]);
  });

  it('reclaims expired leases and enforces a real three-attempt retry limit', () => {
    const item = candidate(1);
    let state = markCandidateScanned(createPersistentWorkerState(), item, 'run-1', '2026-09-05T00:00:00.000Z');
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      state = reserveCandidate(state, item, `run-${attempt}`, 'scheduled', `2026-09-05T00:0${attempt}:00.000Z`, 1_000);
      state = markCandidateFailure(state, item, `run-${attempt}`, 'temporary', true, `2026-09-05T00:0${attempt}:01.000Z`);
    }
    const fingerprint = candidateFingerprints(item).candidate;
    expect(state.decisions[fingerprint]).toMatchObject({ attempts: 3, status: 'terminal' });
    expect(() => reserveCandidate(state, item, 'run-4', 'scheduled', '2026-09-05T00:05:00.000Z', 1_000)).toThrow(/retry|terminal/i);

    let leased = markCandidateScanned(createPersistentWorkerState(), candidate(2), 'run-a', '2026-09-05T00:00:00.000Z');
    leased = reserveCandidate(leased, candidate(2), 'run-a', 'scheduled', '2026-09-05T00:00:00.000Z', 1_000);
    const recovered = recoverExpiredReservations(leased, '2026-09-05T00:00:02.000Z');
    expect(recovered.decisions[candidateFingerprints(candidate(2)).candidate].status).toBe('retryable');
  });

  it('marks reconciliation_required as terminal manual attention', () => {
    const item = candidate(1);
    let state = markCandidateScanned(createPersistentWorkerState(), item, 'run-1', '2026-09-05T00:00:00.000Z');
    state = reserveCandidate(state, item, 'run-1', 'scheduled', '2026-09-05T00:00:00.000Z', 60_000);
    state = markCandidateFailure(state, item, 'run-1', 'reconciliation_required', false, '2026-09-05T00:01:00.000Z');
    expect(state.decisions[candidateFingerprints(item).candidate].status).toBe('manual_attention');
    expect(buildIncrementalQueue({ state, backlog: [item], now: '2026-09-05T00:02:00.000Z' }).scan).toEqual([]);
  });

  it('consumes the one pilot only after prepared state is durable and acknowledged', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoblogger-local-state-'));
    const store = createFileStateStore(join(root, 'state.json'));
    const initial = await store.load();
    const artifactHash = 'a'.repeat(64);
    let state = reserveManualPilot(initial.state, 'pilot-1', '2026-09-05T00:00:00.000Z');
    state = markManualPilotPrepared(state, 'pilot-1', artifactHash, '2026-09-05T00:01:00.000Z');
    await store.save(state, initial.version);
    expect((await store.load()).state.manualPilot?.status).toBe('prepared');

    await consumePreparedManualPilot(store, 'pilot-1', artifactHash, '2026-09-05T00:02:00.000Z');
    const consumed = (await store.load()).state;
    expect(consumed.manualPilot).toMatchObject({ status: 'consumed', consumedAt: '2026-09-05T00:02:00.000Z' });
    expect(() => reserveManualPilot(consumed, 'pilot-2', '2026-09-05T00:03:00.000Z')).toThrow(/reserved|consumed/i);
  });
});
