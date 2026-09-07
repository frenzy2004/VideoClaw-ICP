import { describe, expect, it } from 'vitest';
import { CandidateSchema, candidateFingerprints } from './domain';
import { createPersistentWorkerState, PersistentWorkerStateSchema, compactPersistentWorkerState } from './github-runtime';
import { grantManualRetryApproval, markCandidateFailure, markCandidateCompleted, markCandidateScanned, reserveCandidate, reserveManualPilot, buildIncrementalQueue } from './recovery';
import { reconcileLocalPilotCandidate, createModelAuditTransport, inspectLocalPilotInventory, parseLocalPilotArguments, readLocalPilotCandidateFile, validateEngineeringResumeEvidence, readLocalEngineeringResumeEvidence, validateQualityRevalidationEvidence, readLocalQualityRevalidationEvidence } from './local-pilot';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const original = CandidateSchema.parse({
  schemaVersion: 1, articleId: 'vc-c2-001', campaignId: 'accelerator-demo-day-founder', icp: 'accelerator-demo-day-founder',
  primaryKeyword: 'Demo Day video planning checklist', secondaryKeywords: [], title: 'The Evergreen Demo Day Video Planning Checklist',
  slug: 'demo-day-video-checklist', intent: 'informational', funnelStage: 'top',
});
const refined = { ...original, primaryKeyword: 'demo day video checklist', title: 'Demo Day Video Checklist: Plan, Record and Rehearse' };
const other = { ...original, articleId: 'vc-c2-002', primaryKeyword: 'founder video preparation', title: 'Founder Video Preparation', slug: 'founder-video-preparation' };
const fingerprint = candidateFingerprints(refined).candidate;
const at = '2026-09-05T18:00:00.000Z';

function fixture() {
  let state = markCandidateScanned(createPersistentWorkerState(), refined, 'assisted-failure', at);
  state = reserveCandidate(state, refined, 'assisted-failure', 'manual_pilot', at);
  state = markCandidateFailure(state, refined, 'assisted-failure', 'assisted_pilot_failed', true, at);
  state.queuedCandidates = [original, other];
  state.runs['assisted-failure'] = { schemaVersion: 1, runId: 'assisted-failure', mode: 'manual_pilot', startedAt: at, selectedCandidateFingerprints: [fingerprint], status: 'failed' };
  state.failures.push({ runId: 'assisted-failure', code: 'candidate_failed', attempt: 1, observedAt: at, detail: 'Retained failure.' });
  return { state, backlog: [original, other], candidate: refined, runId: 'automated-attempt-2' };
}

describe('local artifact-only pilot preflight', () => {
  it('accepts one explicit fresh-candidate run without combining retry permissions', () => {
    const args = ['--run-id', 'fresh-webinar-proof', '--candidate-file', 'artifacts/fresh.json', '--approve-fresh-candidate', '--execute'];
    expect(parseLocalPilotArguments(args)).toEqual({ runId: 'fresh-webinar-proof', candidateFile: 'artifacts/fresh.json', approveFreshCandidate: true });
    for (const bad of [args.slice(0, -1), [...args, '--reset'], [...args.slice(0, -1), '--retry-target-from', 'old', '--execute'],
      ['--run-id', 'fresh', '--approve-fresh-candidate', '--execute']]) expect(() => parseLocalPilotArguments(bad)).toThrow();
  });

  it('adds a never-attempted topic without editing the historical grants or backlog', () => {
    const prior = failedThirdTargetFixture();
    const candidate = { ...other, articleId: 'vc-c4-051', campaignId: 'gtm-content-repurposing-buyer' as const,
      primaryKeyword: 'webinar repurposing', title: 'Webinar Repurposing for a Marketing Team', slug: 'webinar-repurposing' };
    const input = { state: prior.state, backlog: prior.backlog, candidate, runId: 'fresh-topic-proof', approveFreshCandidate: true, approvedAt: '2026-09-08T00:00:00.000Z' };
    const originalInput = structuredClone(input);
    const prepared = reconcileLocalPilotCandidate(input);
    expect(input).toEqual(originalInput);
    expect(prepared.nextAttempt).toBe(1);
    expect(prepared.state.decisions).toEqual(prior.state.decisions);
    expect(prepared.state.runs).toEqual(prior.state.runs);
    expect(prepared.state.failures).toEqual(prior.state.failures);
    expect(prepared.state.manualTargetSwitch).toEqual(prior.state.manualTargetSwitch);
    expect(prepared.state.manualRetryApproval).toEqual(prior.state.manualRetryApproval);
    expect(prepared.backlog).toContainEqual(candidate);
    expect(prepared.state.queuedCandidates).toContainEqual(candidate);
    for (const extra of [{ retryTargetFrom: 'old' }, { switchTargetFrom: 'old' }, { approveRetryFrom: 'old' }, { approveTargetExtraAttempt: true }]) {
      expect(() => reconcileLocalPilotCandidate({ ...input, ...extra })).toThrow();
    }
    const overlap = { ...candidate, primaryKeyword: other.primaryKeyword };
    expect(() => reconcileLocalPilotCandidate({ ...input, candidate: overlap })).toThrow();
  });
  function terminalFixture() {
    const input = fixture();
    for (let attempt = 2; attempt <= 3; attempt += 1) {
      const runId = `automated-attempt-${attempt}`;
      input.state = reserveCandidate(input.state, refined, runId, 'manual_pilot', at);
      input.state = markCandidateFailure(input.state, refined, runId, 'candidate_failed', true, at);
      input.state.runs[runId] = { schemaVersion: 1, runId, mode: 'manual_pilot', startedAt: at, selectedCandidateFingerprints: [fingerprint], status: 'failed' };
      input.state.failures.push({ runId, code: 'candidate_failed', attempt, observedAt: at, detail: 'Retained failure.' });
    }
    input.state.queuedCandidates = [other]; // Terminal cleanup removed only the exhausted candidate.
    return { ...input, runId: 'approved-attempt-4', approveRetryFrom: 'automated-attempt-3', approvedAt: '2026-09-06T21:00:00.000Z' };
  }

  it('requires paired explicit candidate-file and target-switch flags and never combines retry grants', () => {
    const args = ['--run-id', 'alternative-pilot', '--candidate-file', 'artifacts/selected-candidate.json', '--switch-target-from', 'approved-attempt-4', '--execute'];
    expect(parseLocalPilotArguments(args)).toEqual({ runId: 'alternative-pilot', candidateFile: args[3], switchTargetFrom: args[5] });
    for (const bad of [args.slice(0, -1), [...args, '--reset'], ['--run-id', 'new', '--candidate-file', args[3], '--execute'],
      ['--run-id', 'new', '--switch-target-from', 'old', '--execute'], [...args.slice(0, -1), '--approve-retry-from', 'old', '--execute'],
      ['--run-id', 'approved-attempt-4', ...args.slice(2)]]) expect(() => parseLocalPilotArguments(bad)).toThrow();
  });

  function switchFixture() {
    const input = terminalFixture();
    const old = reconcileLocalPilotCandidate(input);
    return { state: old.state, backlog: old.backlog, candidate: other, runId: 'alternative-pilot', switchTargetFrom: input.runId, approvedAt: input.approvedAt };
  }

  function failedSwitchFixture() {
    const input = switchFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    let state = reserveCandidate(prepared.state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'missing_serp,missing_relevant_paa', true, input.approvedAt);
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [candidateFingerprints(other).candidate], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: candidateFingerprints(other).candidate, code: 'insufficient_data', attempt: 1, observedAt: input.approvedAt, detail: 'Missing SERP.' });
    return { state, backlog: prepared.backlog, candidate: other, runId: 'collector-fixed-retry', retryTargetFrom: input.runId, approvedAt: '2026-09-06T22:00:00.000Z' };
  }

  it('records one explicit same-target retry and preserves the failed decision and old grant through reservation', () => {
    const input = failedSwitchFixture();
    const before = structuredClone(input.state);
    const fp = candidateFingerprints(other).candidate;
    const prepared = reconcileLocalPilotCandidate(input);
    expect(prepared.nextAttempt).toBe(2);
    expect(prepared.state.decisions).toEqual(before.decisions);
    expect(prepared.state.runs).toEqual(before.runs);
    expect(prepared.state.failures).toEqual(before.failures);
    expect(prepared.state.manualRetryApproval).toEqual(before.manualRetryApproval);
    expect(prepared.state.manualTargetSwitch).toMatchObject(before.manualTargetSwitch!);
    expect(prepared.state.manualTargetSwitch?.retry).toMatchObject({ priorRunId: 'alternative-pilot', runId: input.runId, priorDecision: before.decisions[fp], consumedAt: null });
    const reloaded = reconcileLocalPilotCandidate({ ...input, state: JSON.parse(JSON.stringify(prepared.state)) });
    expect(reloaded.state).toEqual(prepared.state);
    const queue = buildIncrementalQueue({ state: reserveManualPilot(reloaded.state, input.runId, input.approvedAt), backlog: reloaded.backlog, runId: input.runId, mode: 'manual_pilot', now: input.approvedAt });
    expect(queue.scan).toEqual([other]);
    const reserved = reserveCandidate(queue.state, other, input.runId, 'manual_pilot', input.approvedAt);
    expect(reserved.decisions[fp]).toMatchObject({ attempts: 2, status: 'leased', runId: input.runId });
    expect(reserved.manualTargetSwitch?.retry?.priorDecision).toEqual(before.decisions[fp]);
    expect(reserved.manualTargetSwitch?.consumedAt).toBe(before.manualTargetSwitch!.consumedAt);
    expect(reserved.manualRetryApproval).toEqual(before.manualRetryApproval);
    expect(() => reserveCandidate(reserved, other, input.runId, 'manual_pilot', input.approvedAt)).toThrow();
    const failed = markCandidateFailure(reserved, other, input.runId, 'candidate_failed', true, input.approvedAt);
    expect(failed.decisions[fp]).toMatchObject({ attempts: 2, status: 'terminal' });
    expect(() => reconcileLocalPilotCandidate({ ...input, state: failed, runId: 'third' })).toThrow();
  });

  function failedTargetRetryFixture() {
    const input = failedSwitchFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    let state = reserveCandidate(prepared.state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'candidate_failed', false, input.approvedAt);
    const fp = candidateFingerprints(other).candidate;
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 2, observedAt: input.approvedAt, detail: 'Independent review rejected the repaired draft.' });
    return { ...input, state, runId: 'attribution-retry', retryTargetFrom: input.runId, approvedAt: '2026-09-06T23:00:00.000Z' };
  }

  it('appends explicit third-attempt approval without replacing the consumed retry history', () => {
    const input = failedTargetRetryFixture();
    const before = structuredClone(input.state);
    const fp = candidateFingerprints(other).candidate;
    const prepared = reconcileLocalPilotCandidate(input);
    expect(prepared.nextAttempt).toBe(3);
    expect(prepared.state.manualTargetSwitch?.retryHistory).toEqual([before.manualTargetSwitch!.retry]);
    expect(prepared.state.manualTargetSwitch?.retry).toMatchObject({ priorRunId: 'collector-fixed-retry', runId: 'attribution-retry', priorDecision: before.decisions[fp], consumedAt: null });
    expect(prepared.state.decisions).toEqual(before.decisions);
    expect(prepared.state.runs).toEqual(before.runs);
    expect(prepared.state.failures).toEqual(before.failures);
    expect(prepared.state.manualRetryApproval).toEqual(before.manualRetryApproval);
    const reloaded = reconcileLocalPilotCandidate({ ...input, state: JSON.parse(JSON.stringify(prepared.state)) });
    expect(reloaded.state).toEqual(prepared.state);
    const queue = buildIncrementalQueue({ state: reserveManualPilot(reloaded.state, input.runId, input.approvedAt), backlog: reloaded.backlog, runId: input.runId, mode: 'manual_pilot', now: input.approvedAt });
    expect(queue.scan).toEqual([other]);
    const reserved = reserveCandidate(queue.state, other, input.runId, 'manual_pilot', input.approvedAt);
    expect(reserved.decisions[fp]).toMatchObject({ attempts: 3, runId: input.runId });
    expect(reserved.manualTargetSwitch?.retryHistory).toEqual([before.manualTargetSwitch!.retry]);
    expect(compactPersistentWorkerState(reserved).manualTargetSwitch).toEqual(reserved.manualTargetSwitch);
    expect(() => reserveCandidate(reserved, other, 'fourth', 'manual_pilot', input.approvedAt)).toThrow();
  });

  function failedThirdTargetFixture() {
    const input = failedTargetRetryFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    let state = reserveCandidate(prepared.state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'candidate_failed', false, input.approvedAt);
    const fp = candidateFingerprints(other).candidate;
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 3, observedAt: input.approvedAt, detail: 'Editorial review rejected the third attempt.' });
    return { ...input, state, runId: 'editorial-fixed-retry', retryTargetFrom: input.runId, approvedAt: '2026-09-07T00:00:00.000Z', approveTargetExtraAttempt: true };
  }

  it('grants the explicitly approved fourth target attempt while preserving failed history', () => {
    const input = failedThirdTargetFixture();
    const before = structuredClone(input);
    const prepared = reconcileLocalPilotCandidate(input);
    expect(prepared.nextAttempt).toBe(4);
    expect(prepared.state.manualTargetSwitch?.retry).toMatchObject({
      priorRunId: 'attribution-retry', runId: 'editorial-fixed-retry', reason: 'user_authorized_after_editorial_fix',
      priorDecision: before.state.decisions[candidateFingerprints(other).candidate], consumedAt: null,
    });
    expect(prepared.state.manualTargetSwitch?.retryHistory).toEqual([
      ...before.state.manualTargetSwitch!.retryHistory!, before.state.manualTargetSwitch!.retry,
    ]);
    for (const key of ['decisions', 'runs', 'failures', 'manualRetryApproval'] as const) expect(prepared.state[key]).toEqual(before.state[key]);
    expect(input).toEqual(before);
    const queue = buildIncrementalQueue({ state: reserveManualPilot(prepared.state, input.runId, input.approvedAt), backlog: prepared.backlog, runId: input.runId, mode: 'manual_pilot', now: input.approvedAt });
    expect(queue.scan).toEqual([other]);
    const reserved = reserveCandidate(queue.state, other, input.runId, 'manual_pilot', input.approvedAt);
    expect(reserved.decisions[candidateFingerprints(other).candidate]).toMatchObject({ attempts: 4, runId: input.runId });
    expect(() => reserveCandidate(reserved, other, 'fifth', 'manual_pilot', input.approvedAt)).toThrow();
  });

  function failedFourthTargetFixture() {
    const input = failedThirdTargetFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    let state = reserveCandidate(prepared.state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'candidate_failed', false, input.approvedAt);
    const fp = candidateFingerprints(other).candidate;
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 4, observedAt: input.approvedAt, detail: 'Source-budget review rejected attempt four.' });
    return { ...input, state, runId: 'source-planned-retry', retryTargetFrom: input.runId,
      approvedAt: '2026-09-07T02:00:00.000Z', approveTargetExtraAttempt: false, approveSourcePlanRetry: true };
  }

  it('grants one source-planning retry after the retained fourth failure, preserving the full audit chain', () => {
    const input = failedFourthTargetFixture();
    const before = structuredClone(input.state);
    const prepared = reconcileLocalPilotCandidate(input);
    expect(prepared.nextAttempt).toBe(5);
    expect(prepared.state.manualTargetSwitch?.retry).toMatchObject({ reason: 'user_authorized_after_source_planning_fix', priorRunId: input.retryTargetFrom,
      runId: input.runId, priorDecision: before.decisions[candidateFingerprints(other).candidate], consumedAt: null });
    expect(prepared.state.manualTargetSwitch?.retryHistory).toEqual([...before.manualTargetSwitch!.retryHistory!, before.manualTargetSwitch!.retry]);
    for (const key of ['decisions', 'runs', 'failures', 'manualRetryApproval'] as const) expect(prepared.state[key]).toEqual(before[key]);
    const queue = buildIncrementalQueue({ state: reserveManualPilot(prepared.state, input.runId, input.approvedAt), backlog: prepared.backlog,
      runId: input.runId, mode: 'manual_pilot', now: input.approvedAt });
    expect(queue.scan).toEqual([other]);
    const reserved = reserveCandidate(queue.state, other, input.runId, 'manual_pilot', input.approvedAt);
    expect(reserved.decisions[candidateFingerprints(other).candidate]).toMatchObject({ attempts: 5, status: 'leased', runId: input.runId });
    expect(compactPersistentWorkerState(reserved).manualTargetSwitch).toEqual(reserved.manualTargetSwitch);
    expect(() => reserveCandidate(reserved, other, 'sixth', 'manual_pilot', input.approvedAt)).toThrow();
    expect(() => reserveCandidate(prepared.state, other, input.runId, 'scheduled', input.approvedAt)).toThrow();
    expect(input.state).toEqual(before);
  });

  it('reloads the unused fifth grant only with its separate explicit source-planning flag', () => {
    const input = failedFourthTargetFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    const reload = { ...input, state: JSON.parse(JSON.stringify(prepared.state)), approvedAt: '2026-09-07T03:00:00.000Z' };
    expect(reconcileLocalPilotCandidate(reload).state).toEqual(prepared.state);
    expect(() => reconcileLocalPilotCandidate({ ...reload, approveSourcePlanRetry: false })).toThrow();
    expect(() => reconcileLocalPilotCandidate({ ...reload, approveSourcePlanRetry: false, approveTargetExtraAttempt: true })).toThrow();
    expect(() => reconcileLocalPilotCandidate({ ...reload, approveTargetExtraAttempt: true })).toThrow();
  });

  it.each(['missing-history', 'wrong-fourth-reason', 'missing-fourth-failure', 'wrong-prior', 'old-approval', 'wrong-target', 'artifact', 'wrong-mode', 'no-flag', 'both-flags'])(
    'rejects a fifth grant with %s', (problem) => {
      const input = failedFourthTargetFixture();
      if (problem === 'wrong-prior') input.retryTargetFrom = 'attribution-retry';
      if (problem === 'old-approval') input.approvedAt = '2026-09-06T00:00:00.000Z';
      if (problem === 'wrong-target') input.candidate = refined;
      if (problem === 'artifact') input.state.contentHashes[candidateFingerprints(other).candidate] = 'a'.repeat(64);
      if (problem === 'wrong-mode') input.state.runs[input.retryTargetFrom].mode = 'scheduled';
      if (problem === 'no-flag') input.approveSourcePlanRetry = false;
      if (problem === 'both-flags') input.approveTargetExtraAttempt = true;
      if (problem === 'missing-fourth-failure') input.state.failures = input.state.failures.filter(f => f.runId !== input.retryTargetFrom);
      if (problem === 'missing-history') input.state.manualTargetSwitch!.retryHistory = [];
      if (problem === 'wrong-fourth-reason') input.state.manualTargetSwitch!.retry!.reason = 'user_authorized_after_attribution_fix';
      expect(() => reconcileLocalPilotCandidate(input)).toThrow();
    });

  it.each([1, 2, 3])('rejects source-planning approval before attempt four has failed (prior attempt %s)', (attempt) => {
    const input = attempt === 1 ? failedSwitchFixture() : attempt === 2 ? failedTargetRetryFixture() : failedThirdTargetFixture();
    expect(() => reconcileLocalPilotCandidate({ ...input, approveTargetExtraAttempt: false, approveSourcePlanRetry: true })).toThrow();
  });

  it('retains fifth failure history and refuses a sixth attempt even with the source-planning flag', () => {
    const input = failedFourthTargetFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    let state = reserveCandidate(prepared.state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'candidate_failed', true, input.approvedAt);
    const fp = candidateFingerprints(other).candidate;
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 5, observedAt: input.approvedAt, detail: 'Fifth attempt failed.' });
    expect(PersistentWorkerStateSchema.safeParse(state).success).toBe(true);
    expect(compactPersistentWorkerState(state).failures).toEqual(state.failures);
    expect(state.decisions[fp].status).toBe('terminal');
    expect(() => reconcileLocalPilotCandidate({ ...input, state, runId: 'sixth', retryTargetFrom: input.runId, approvedAt: '2026-09-07T03:00:00.000Z' })).toThrow();
    const unrelated = structuredClone(state);
    unrelated.failures.push({ runId: 'unapproved', code: 'candidate_failed', attempt: 5, observedAt: input.approvedAt, detail: 'Unapproved fifth attempt.' });
    expect(PersistentWorkerStateSchema.safeParse(unrelated).success).toBe(false);
  });

  it('parses the source-planning flag only with an exact candidate-file target retry', () => {
    const args = ['--run-id', 'source-planned-retry', '--candidate-file', 'artifacts/selected.json', '--retry-target-from', 'editorial-fixed-retry', '--approve-source-plan-retry', '--execute'];
    expect(parseLocalPilotArguments(args)).toEqual({ runId: args[1], candidateFile: args[3], retryTargetFrom: args[5], approveSourcePlanRetry: true });
    for (const bad of [args.slice(0, -1), [...args.slice(0, -1), '--approve-target-extra-attempt', '--execute'],
      [...args.slice(0, 4), '--switch-target-from', ...args.slice(5)], ['--run-id', 'new', '--approve-source-plan-retry', '--execute'],
      [...args.slice(0, -1), '--approve-source-plan-retry', '--execute']]) expect(() => parseLocalPilotArguments(bad)).toThrow();
  });

  function failedFifthTargetFixture() {
    const input = failedFourthTargetFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    let state = reserveCandidate(prepared.state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'candidate_failed', true, input.approvedAt);
    const fp = candidateFingerprints(other).candidate;
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 5, observedAt: input.approvedAt, detail: 'Review/repair rejected attempt five.' });
    return { ...input, state, runId: 'review-repair-retry', retryTargetFrom: input.runId,
      approvedAt: '2026-09-07T04:00:00.000Z', approveSourcePlanRetry: false, approveReviewRepairRetry: true };
  }

  it('records and consumes one review/repair retry at attempt six while retaining the complete audit chain', () => {
    const input = failedFifthTargetFixture();
    const before = structuredClone(input);
    const prepared = reconcileLocalPilotCandidate(input);
    const fp = candidateFingerprints(other).candidate;
    expect(prepared.nextAttempt).toBe(6);
    expect(prepared.state.manualTargetSwitch?.retry).toMatchObject({ reason: 'user_authorized_after_review_repair_fix',
      priorRunId: input.retryTargetFrom, runId: input.runId, priorDecision: before.state.decisions[fp], consumedAt: null });
    expect(prepared.state.manualTargetSwitch?.retryHistory).toEqual([...before.state.manualTargetSwitch!.retryHistory!, before.state.manualTargetSwitch!.retry]);
    for (const key of ['decisions', 'runs', 'failures', 'manualRetryApproval', 'candidateFingerprints', 'dedupeHashes'] as const) expect(prepared.state[key]).toEqual(before.state[key]);
    const reloaded = reconcileLocalPilotCandidate({ ...input, state: JSON.parse(JSON.stringify(prepared.state)), approvedAt: '2026-09-07T05:00:00.000Z' });
    expect(reloaded.state).toEqual(prepared.state);
    const queue = buildIncrementalQueue({ state: reserveManualPilot(reloaded.state, input.runId, input.approvedAt), backlog: reloaded.backlog,
      runId: input.runId, mode: 'manual_pilot', now: input.approvedAt });
    expect(queue.scan).toEqual([other]);
    const reserved = reserveCandidate(queue.state, other, input.runId, 'manual_pilot', input.approvedAt);
    expect(reserved.decisions[fp]).toMatchObject({ attempts: 6, status: 'leased', runId: input.runId });
    expect(reserved.manualTargetSwitch?.retry?.consumedAt).toBe(input.approvedAt);
    const compacted = compactPersistentWorkerState(reserved);
    for (const key of ['manualTargetSwitch', 'manualRetryApproval', 'runs', 'failures'] as const) expect(compacted[key]).toEqual(reserved[key]);
    expect(() => reserveCandidate(reserved, other, input.runId, 'manual_pilot', input.approvedAt)).toThrow();
    expect(() => reserveCandidate(prepared.state, other, input.runId, 'scheduled', input.approvedAt)).toThrow();
    expect(() => reserveCandidate(prepared.state, refined, input.runId, 'manual_pilot', input.approvedAt)).toThrow();
    expect(() => reserveCandidate(prepared.state, other, 'another-run', 'manual_pilot', input.approvedAt)).toThrow();
    expect(buildIncrementalQueue({ state: prepared.state, backlog: prepared.backlog, runId: input.runId, mode: 'scheduled', now: input.approvedAt }).scan).toEqual([]);
    expect(input).toEqual(before);
  });

  it.each(['no-flag', 'source-flag', 'editorial-flag', 'both-flags', 'switch-flag', 'wrong-run'])(
    'does not reload an unused sixth grant with %s', (problem) => {
      const input = failedFifthTargetFixture();
      const reload = { ...input, state: reconcileLocalPilotCandidate(input).state };
      if (['no-flag', 'source-flag', 'editorial-flag'].includes(problem)) reload.approveReviewRepairRetry = false;
      if (problem === 'source-flag' || problem === 'both-flags') reload.approveSourcePlanRetry = true;
      if (problem === 'editorial-flag') reload.approveTargetExtraAttempt = true;
      if (problem === 'wrong-run') reload.runId = 'different';
      if (problem === 'switch-flag') {
        expect(() => reconcileLocalPilotCandidate({ ...reload, retryTargetFrom: undefined, switchTargetFrom: input.retryTargetFrom })).toThrow();
      } else expect(() => reconcileLocalPilotCandidate(reload)).toThrow();
    });

  it.each(['missing-history', 'unconsumed-source-grant', 'wrong-source-reason', 'missing-fifth-failure', 'wrong-prior', 'old-approval', 'wrong-target',
    'artifact', 'drafted', 'validated', 'pr_opened', 'success', 'pilot', 'scheduled', 'missing-selection', 'reused-run', 'no-flag', 'source-flag', 'editorial-flag'])(
    'rejects a sixth grant with %s without changing history', (problem) => {
      const input = failedFifthTargetFixture();
      const fp = candidateFingerprints(other).candidate;
      if (problem === 'missing-history') input.state.manualTargetSwitch!.retryHistory = [];
      if (problem === 'unconsumed-source-grant') input.state.manualTargetSwitch!.retry!.consumedAt = null;
      if (problem === 'wrong-source-reason') input.state.manualTargetSwitch!.retry!.reason = 'user_authorized_after_editorial_fix';
      if (problem === 'missing-fifth-failure') input.state.failures = input.state.failures.filter(f => f.runId !== input.retryTargetFrom);
      if (problem === 'wrong-prior') input.retryTargetFrom = 'editorial-fixed-retry';
      if (problem === 'old-approval') input.approvedAt = at;
      if (problem === 'wrong-target') input.candidate = refined;
      if (problem === 'artifact') input.state.contentHashes[fp] = 'a'.repeat(64);
      if (problem === 'drafted' || problem === 'validated' || problem === 'pr_opened') input.state.candidates[fp] = {
        status: problem, mode: 'manual_pilot', runId: input.retryTargetFrom, updatedAt: input.approvedAt };
      if (problem === 'success') input.state.runs[input.retryTargetFrom].status = 'validated';
      if (problem === 'pilot') input.state = reserveManualPilot(input.state, input.retryTargetFrom, input.approvedAt);
      if (problem === 'scheduled') input.state.runs[input.retryTargetFrom].mode = 'scheduled';
      if (problem === 'missing-selection') input.state.runs[input.retryTargetFrom].selectedCandidateFingerprints = [];
      if (problem === 'reused-run') input.runId = 'alternative-pilot';
      if (problem === 'no-flag' || problem === 'source-flag' || problem === 'editorial-flag') input.approveReviewRepairRetry = false;
      if (problem === 'source-flag') input.approveSourcePlanRetry = true;
      if (problem === 'editorial-flag') input.approveTargetExtraAttempt = true;
      const before = structuredClone(input);
      expect(() => reconcileLocalPilotCandidate(input)).toThrow();
      expect(input).toEqual(before);
    });

  it.each([1, 2, 3, 4])('rejects review/repair approval before attempt five has failed (prior attempt %s)', (attempt) => {
    const input = [failedSwitchFixture, failedTargetRetryFixture, failedThirdTargetFixture, failedFourthTargetFixture][attempt - 1]();
    expect(() => reconcileLocalPilotCandidate({ ...input, approveTargetExtraAttempt: false, approveSourcePlanRetry: false, approveReviewRepairRetry: true })).toThrow();
  });

  it('retains the sixth failure and rejects a seventh attempt or any unmatched sixth-attempt record', () => {
    const input = failedFifthTargetFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    const fp = candidateFingerprints(other).candidate;
    let state = reserveCandidate(prepared.state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'candidate_failed', true, input.approvedAt);
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 6, observedAt: input.approvedAt, detail: 'Sixth attempt failed.' });
    expect(PersistentWorkerStateSchema.safeParse(state).success).toBe(true);
    expect(compactPersistentWorkerState(state).failures).toEqual(state.failures);
    expect(state.decisions[fp]).toMatchObject({ status: 'terminal', attempts: 6 });
    for (const flags of [{}, { approveReviewRepairRetry: false }, { approveReviewRepairRetry: false, approveSourcePlanRetry: true },
      { approveReviewRepairRetry: false, approveTargetExtraAttempt: true }]) {
      expect(() => reconcileLocalPilotCandidate({ ...input, state, runId: 'seventh', retryTargetFrom: input.runId, ...flags })).toThrow();
    }
    for (const problem of ['unconsumed', 'missing-history', 'wrong-reason', 'scheduled', 'publication', 'seventh', 'foreign-failure', 'foreign-decision']) {
      const invalid = structuredClone(state);
      if (problem === 'unconsumed') invalid.manualTargetSwitch!.retry!.consumedAt = null;
      if (problem === 'missing-history') invalid.manualTargetSwitch!.retryHistory!.pop();
      if (problem === 'wrong-reason') invalid.manualTargetSwitch!.retry!.reason = 'user_authorized_after_source_planning_fix';
      if (problem === 'scheduled') invalid.runs[input.runId].mode = 'scheduled';
      if (problem === 'publication') invalid.runs[input.runId].status = 'pr_opened';
      if (problem === 'seventh') invalid.decisions[fp].attempts = 7;
      if (problem === 'foreign-failure') invalid.failures.push({ ...invalid.failures.at(-1)!, runId: 'unapproved' });
      if (problem === 'foreign-decision') invalid.decisions[fingerprint] = { ...invalid.decisions[fingerprint], attempts: 6 };
      expect(PersistentWorkerStateSchema.safeParse(invalid).success, problem).toBe(false);
    }
  });

  it('parses review/repair authority only with the exact candidate-file target retry and execute flags', () => {
    const args = ['--run-id', 'review-repair-retry', '--candidate-file', 'artifacts/selected.json', '--retry-target-from', 'source-planned-retry', '--approve-review-repair-retry', '--execute'];
    expect(parseLocalPilotArguments(args)).toEqual({ runId: args[1], candidateFile: args[3], retryTargetFrom: args[5], approveReviewRepairRetry: true });
    for (const bad of [args.slice(0, -1), [...args.slice(0, 4), '--switch-target-from', ...args.slice(5)],
      ['--run-id', 'new', '--approve-review-repair-retry', '--execute'], ['--run-id', args[5], ...args.slice(2)],
      ...['--approve-source-plan-retry', '--approve-target-extra-attempt', '--approve-review-repair-retry'].map(flag => [...args.slice(0, -1), flag, '--execute']),
      ['--run-id', 'new', '--approve-retry-from', 'old', '--approve-review-repair-retry', '--execute']]) expect(() => parseLocalPilotArguments(bad)).toThrow();
  });

  function failedSixthTargetFixture() {
    const input = failedFifthTargetFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    let state = reserveCandidate(prepared.state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'candidate_failed', true, input.approvedAt);
    const fp = candidateFingerprints(other).candidate;
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 6, observedAt: input.approvedAt, detail: 'Title/evidence alignment rejected attempt six.' });
    return { ...input, state, runId: 'scope-alignment-retry', retryTargetFrom: input.runId,
      approvedAt: '2026-09-07T06:00:00.000Z', approveReviewRepairRetry: false, approveScopeAlignmentRetry: true };
  }

  it('records, reloads and consumes one scope-alignment seventh grant with the entire audit chain intact', () => {
    const input = failedSixthTargetFixture();
    const before = structuredClone(input);
    const fp = candidateFingerprints(other).candidate;
    const prepared = reconcileLocalPilotCandidate(input);
    expect(prepared.nextAttempt).toBe(7);
    expect(prepared.state.manualTargetSwitch?.candidate).toEqual(other);
    expect(prepared.state.manualTargetSwitch?.retry).toMatchObject({ reason: 'user_authorized_after_scope_alignment_fix',
      priorRunId: 'review-repair-retry', runId: 'scope-alignment-retry', priorDecision: before.state.decisions[fp], consumedAt: null });
    expect(prepared.state.manualTargetSwitch?.retryHistory).toEqual([...before.state.manualTargetSwitch!.retryHistory!, before.state.manualTargetSwitch!.retry]);
    expect(prepared.state.manualTargetSwitch?.retryHistory).toHaveLength(5);
    for (const key of ['decisions', 'runs', 'failures', 'manualRetryApproval', 'candidateFingerprints', 'dedupeHashes'] as const) expect(prepared.state[key]).toEqual(before.state[key]);
    expect(prepared.state.failures.filter(f => f.candidateFingerprint === fp).map(f => f.attempt)).toEqual([1, 2, 3, 4, 5, 6]);
    const reloaded = reconcileLocalPilotCandidate({ ...input, state: JSON.parse(JSON.stringify(prepared.state)) });
    expect(reloaded.state).toEqual(prepared.state);
    const queue = buildIncrementalQueue({ state: reserveManualPilot(reloaded.state, input.runId, input.approvedAt), backlog: reloaded.backlog,
      runId: input.runId, mode: 'manual_pilot', now: input.approvedAt });
    expect(queue.scan).toEqual([other]);
    const reserved = reserveCandidate(queue.state, other, input.runId, 'manual_pilot', input.approvedAt);
    expect(reserved.decisions[fp]).toMatchObject({ attempts: 7, status: 'leased', runId: input.runId });
    expect(reserved.manualTargetSwitch?.retry?.consumedAt).toBe(input.approvedAt);
    const compacted = compactPersistentWorkerState(reserved);
    for (const key of ['manualTargetSwitch', 'manualRetryApproval', 'runs', 'failures'] as const) expect(compacted[key]).toEqual(reserved[key]);
    expect(() => reserveCandidate(reserved, other, input.runId, 'manual_pilot', input.approvedAt)).toThrow();
    expect(() => reserveCandidate(prepared.state, other, input.runId, 'scheduled', input.approvedAt)).toThrow();
    expect(() => reserveCandidate(prepared.state, { ...other, title: 'Changed title' }, input.runId, 'manual_pilot', input.approvedAt)).toThrow();
    expect(() => reserveCandidate(prepared.state, other, 'another-run', 'manual_pilot', input.approvedAt)).toThrow();
    expect(buildIncrementalQueue({ state: prepared.state, backlog: prepared.backlog, runId: input.runId, mode: 'scheduled', now: input.approvedAt }).scan).toEqual([]);
    expect(input).toEqual(before);
  });

  it.each(['no-flag', 'review-flag', 'source-flag', 'editorial-flag', 'both-flags', 'switch-flag', 'wrong-run'])(
    'does not reload an unused seventh grant with %s', (problem) => {
      const input = failedSixthTargetFixture();
      const reload = { ...input, state: reconcileLocalPilotCandidate(input).state };
      if (['no-flag', 'review-flag', 'source-flag', 'editorial-flag'].includes(problem)) reload.approveScopeAlignmentRetry = false;
      if (problem === 'review-flag' || problem === 'both-flags') reload.approveReviewRepairRetry = true;
      if (problem === 'source-flag') reload.approveSourcePlanRetry = true;
      if (problem === 'editorial-flag') reload.approveTargetExtraAttempt = true;
      if (problem === 'wrong-run') reload.runId = 'different';
      if (problem === 'switch-flag') {
        expect(() => reconcileLocalPilotCandidate({ ...reload, retryTargetFrom: undefined, switchTargetFrom: input.retryTargetFrom })).toThrow();
      } else expect(() => reconcileLocalPilotCandidate(reload)).toThrow();
    });

  it.each(['missing-history', 'unconsumed-sixth-grant', 'wrong-sixth-reason', 'missing-sixth-failure', 'wrong-prior', 'old-approval', 'changed-title',
    'artifact', 'drafted', 'validated', 'pr_opened', 'success', 'pilot', 'scheduled', 'missing-selection', 'reused-run', 'no-flag', 'review-flag', 'source-flag', 'editorial-flag'])(
    'rejects a seventh grant with %s without changing history', (problem) => {
      const input = failedSixthTargetFixture();
      const fp = candidateFingerprints(other).candidate;
      if (problem === 'missing-history') input.state.manualTargetSwitch!.retryHistory = [];
      if (problem === 'unconsumed-sixth-grant') input.state.manualTargetSwitch!.retry!.consumedAt = null;
      if (problem === 'wrong-sixth-reason') input.state.manualTargetSwitch!.retry!.reason = 'user_authorized_after_source_planning_fix';
      if (problem === 'missing-sixth-failure') input.state.failures = input.state.failures.filter(f => f.runId !== input.retryTargetFrom);
      if (problem === 'wrong-prior') input.retryTargetFrom = 'source-planned-retry';
      if (problem === 'old-approval') input.approvedAt = at;
      if (problem === 'changed-title') input.candidate = { ...other, title: 'Changed title' };
      if (problem === 'artifact') input.state.contentHashes[fp] = 'a'.repeat(64);
      if (problem === 'drafted' || problem === 'validated' || problem === 'pr_opened') input.state.candidates[fp] = {
        status: problem, mode: 'manual_pilot', runId: input.retryTargetFrom, updatedAt: input.approvedAt };
      if (problem === 'success') input.state.runs[input.retryTargetFrom].status = 'validated';
      if (problem === 'pilot') input.state = reserveManualPilot(input.state, input.retryTargetFrom, input.approvedAt);
      if (problem === 'scheduled') input.state.runs[input.retryTargetFrom].mode = 'scheduled';
      if (problem === 'missing-selection') input.state.runs[input.retryTargetFrom].selectedCandidateFingerprints = [];
      if (problem === 'reused-run') input.runId = 'alternative-pilot';
      if (['no-flag', 'review-flag', 'source-flag', 'editorial-flag'].includes(problem)) input.approveScopeAlignmentRetry = false;
      if (problem === 'review-flag') input.approveReviewRepairRetry = true;
      if (problem === 'source-flag') input.approveSourcePlanRetry = true;
      if (problem === 'editorial-flag') input.approveTargetExtraAttempt = true;
      const before = structuredClone(input);
      expect(() => reconcileLocalPilotCandidate(input)).toThrow();
      expect(input).toEqual(before);
    });

  it.each([1, 2, 3, 4, 5])('rejects scope-alignment approval before attempt six has failed (prior attempt %s)', (attempt) => {
    const input = [failedSwitchFixture, failedTargetRetryFixture, failedThirdTargetFixture, failedFourthTargetFixture, failedFifthTargetFixture][attempt - 1]();
    expect(() => reconcileLocalPilotCandidate({ ...input, approveTargetExtraAttempt: false, approveSourcePlanRetry: false,
      approveReviewRepairRetry: false, approveScopeAlignmentRetry: true })).toThrow();
  });

  it('retains the seventh terminal failure and rejects every eighth attempt and unaudited seventh record', () => {
    const input = failedSixthTargetFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    const fp = candidateFingerprints(other).candidate;
    let state = reserveCandidate(prepared.state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'candidate_failed', true, input.approvedAt);
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 7, observedAt: input.approvedAt, detail: 'Seventh attempt failed.' });
    expect(PersistentWorkerStateSchema.safeParse(state).success).toBe(true);
    expect(compactPersistentWorkerState(state).failures).toEqual(state.failures);
    expect(state.decisions[fp]).toMatchObject({ status: 'terminal', attempts: 7 });
    for (const flags of [{ approveScopeAlignmentRetry: true }, {}, { approveReviewRepairRetry: true }, { approveSourcePlanRetry: true }, { approveTargetExtraAttempt: true }]) {
      expect(() => reconcileLocalPilotCandidate({ ...input, state, approveScopeAlignmentRetry: false, runId: 'eighth', retryTargetFrom: input.runId, ...flags })).toThrow();
    }
    expect(() => reserveCandidate(state, other, 'eighth', 'manual_pilot', input.approvedAt)).toThrow();
    for (const problem of ['unconsumed', 'missing-history', 'wrong-reason', 'scheduled', 'publication', 'eighth', 'foreign-failure', 'foreign-decision']) {
      const invalid = structuredClone(state);
      if (problem === 'unconsumed') invalid.manualTargetSwitch!.retry!.consumedAt = null;
      if (problem === 'missing-history') invalid.manualTargetSwitch!.retryHistory!.pop();
      if (problem === 'wrong-reason') invalid.manualTargetSwitch!.retry!.reason = 'user_authorized_after_review_repair_fix';
      if (problem === 'scheduled') invalid.runs[input.runId].mode = 'scheduled';
      if (problem === 'publication') invalid.runs[input.runId].status = 'pr_opened';
      if (problem === 'eighth') invalid.decisions[fp].attempts = 8;
      if (problem === 'foreign-failure') invalid.failures.push({ ...invalid.failures.at(-1)!, runId: 'unapproved' });
      if (problem === 'foreign-decision') invalid.decisions[fingerprint] = { ...invalid.decisions[fingerprint], attempts: 7 };
      expect(PersistentWorkerStateSchema.safeParse(invalid).success, problem).toBe(false);
    }
  });

  it('parses scope-alignment authority only with the exact candidate-file target retry and execute flags', () => {
    const args = ['--run-id', 'scope-alignment-retry', '--candidate-file', 'artifacts/selected.json', '--retry-target-from', 'review-repair-retry', '--approve-scope-alignment-retry', '--execute'];
    expect(parseLocalPilotArguments(args)).toEqual({ runId: args[1], candidateFile: args[3], retryTargetFrom: args[5], approveScopeAlignmentRetry: true });
    for (const bad of [args.slice(0, -1), [...args.slice(0, 4), '--switch-target-from', ...args.slice(5)],
      ['--run-id', 'new', '--approve-scope-alignment-retry', '--execute'], ['--run-id', args[5], ...args.slice(2)],
      ...['--approve-source-plan-retry', '--approve-target-extra-attempt', '--approve-review-repair-retry', '--approve-scope-alignment-retry'].map(flag => [...args.slice(0, -1), flag, '--execute']),
      ['--run-id', 'new', '--approve-retry-from', 'old', '--approve-scope-alignment-retry', '--execute']]) expect(() => parseLocalPilotArguments(bad)).toThrow();
  });

  function sourceFailureProof() {
    const priorRunId = 'scope-alignment-retry';
    const fp = candidateFingerprints(other).candidate;
    const counts = { queued: 2, scanned: 1, shallowValidated: 1, metricsEnriched: 1, deepInspected: 0, eligible: 0, drafted: 0, validated: 0, pullRequestsOpened: 0 };
    const failures = [{ candidateFingerprint: fp, code: 'deep_inspection_failed', detail: 'No usable sources.', retryable: false, attempt: 7 },
      { code: 'no_eligible_opportunities', detail: 'No opportunity passed.', retryable: false }];
    const report = { schemaVersion: 1, command: 'pilot', runId: priorRunId, mode: 'manual_pilot', status: 'failed',
      startedAt: '2026-09-07T06:00:00.000Z', completedAt: '2026-09-07T06:01:00.000Z', limits: {}, counts, artifacts: [], failures };
    const audit = { runId: priorRunId, execution: 'local_production_worker_artifact_only', publicationEnabled: false, scheduledRuntimeConfigured: false,
      events: [
        { at: report.startedAt, stage: 'preflight_passed', articleId: other.articleId, nextAttempt: 7, publicationEnabled: false },
        { at: report.startedAt, stage: 'research_started', candidates: 1 },
        { at: report.startedAt, stage: 'research_completed', observations: [{ articleId: other.articleId, query: other.primaryKeyword }] },
        { at: report.startedAt, stage: 'source_inspection_started' },
        { at: report.completedAt, stage: 'pilot_completed', status: 'failed', counts, failures },
      ] };
    return { report, audit, priorRunId, candidate: other, implementationHash: 'c'.repeat(64) };
  }

  function resumeEvidence(proof = sourceFailureProof()) {
    return validateEngineeringResumeEvidence({ ...proof, reportText: JSON.stringify(proof.report), auditText: JSON.stringify(proof.audit) });
  }

  function failedSeventhTargetFixture() {
    const input = failedSixthTargetFixture();
    let state = reserveCandidate(reconcileLocalPilotCandidate(input).state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'deep_inspection_failed', false, '2026-09-07T06:01:00.000Z');
    const fp = candidateFingerprints(other).candidate;
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'deep_inspection_failed', attempt: 7, observedAt: '2026-09-07T06:01:00.000Z', detail: 'No usable sources.' });
    return { ...input, state, runId: 'engineering-resume', retryTargetFrom: input.runId, approvedAt: '2026-09-07T07:00:00.000Z',
      approveScopeAlignmentRetry: false, approveEngineeringResume: true, engineeringResumeEvidence: resumeEvidence() };
  }

  function qualityFailureProof() {
    const priorRunId = 'engineering-resume-product-demo-pilot-2026-09-07';
    const counts = { queued: 2, scanned: 1, shallowValidated: 1, metricsEnriched: 1, deepInspected: 1, eligible: 1, drafted: 0, validated: 0, pullRequestsOpened: 0 };
    const failures = [{ candidateFingerprint: candidateFingerprints(other).candidate, code: 'candidate_failed',
      detail: 'Error: Draft blocked: content_safety_failed (content.claim_binding=1).', retryable: false, attempt: 8 }];
    const report = { schemaVersion: 1, command: 'pilot', runId: priorRunId, mode: 'manual_pilot', status: 'failed',
      startedAt: '2026-09-07T07:00:00.000Z', completedAt: '2026-09-07T07:01:00.000Z', limits: {}, counts, artifacts: [], failures };
    const events: Record<string, unknown>[] = [
      { at: report.startedAt, stage: 'preflight_passed', articleId: other.articleId, nextAttempt: 8, publicationEnabled: false },
      { at: report.startedAt, stage: 'research_started', candidates: 1 },
      { at: report.startedAt, stage: 'research_completed', observations: [{ articleId: other.articleId, query: other.primaryKeyword }] },
      { at: report.startedAt, stage: 'source_inspection_started' },
      { at: report.startedAt, stage: 'source_inspection_completed', results: 1 },
    ];
    ['videoclaw_article_draft_v2', 'videoclaw_article_critique_v1', 'videoclaw_article_repair_v2', 'videoclaw_article_repair_verification_v1'].forEach((phase, index) => {
      events.push({ at: report.startedAt, stage: 'model_stage_started', phase },
        { at: report.startedAt, stage: 'model_response_retained', phase, call: index + 1, httpStatus: 200 });
    });
    events.push({ at: report.completedAt, stage: 'pilot_completed', status: 'failed', counts, failures });
    return { priorRunId, candidate: other, implementationHash: 'd'.repeat(64), report,
      audit: { runId: priorRunId, execution: 'local_production_worker_artifact_only', publicationEnabled: false, scheduledRuntimeConfigured: false, events } };
  }

  function qualityEvidence(proof = qualityFailureProof()) {
    return validateQualityRevalidationEvidence({ ...proof, reportText: JSON.stringify(proof.report), auditText: JSON.stringify(proof.audit) });
  }

  function failedEighthTargetFixture() {
    const proof = qualityFailureProof();
    const input = { ...failedSeventhTargetFixture(), runId: proof.priorRunId };
    let state = reserveCandidate(reconcileLocalPilotCandidate(input).state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'candidate_failed', false, proof.report.completedAt);
    const fp = candidateFingerprints(other).candidate;
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 8,
      observedAt: proof.report.completedAt, detail: proof.report.failures[0].detail });
    return { ...input, state, runId: 'quality-revalidation', retryTargetFrom: input.runId, approvedAt: '2026-09-07T08:00:00.000Z',
      approveEngineeringResume: false, engineeringResumeEvidence: undefined, approveQualityRevalidation: true, qualityRevalidationEvidence: qualityEvidence(proof) };
  }

  it('accepts quality revalidation only with its explicit exact eighth-run CLI', () => {
    const args = ['--run-id', 'quality-revalidation', '--candidate-file', 'artifacts/selected.json', '--retry-target-from',
      'engineering-resume-product-demo-pilot-2026-09-07', '--approve-quality-revalidation', '--execute'];
    expect(parseLocalPilotArguments(args)).toEqual({ runId: args[1], candidateFile: args[3], retryTargetFrom: args[5], approveQualityRevalidation: true });
    for (const bad of [args.slice(0, -1), [...args.slice(0, 5), 'other-eighth', ...args.slice(6)],
      [...args.slice(0, 4), '--switch-target-from', ...args.slice(5)], [...args.slice(0, -1), '--approve-engineering-resume', '--execute'],
      ['--run-id', args[5], ...args.slice(2)], ['--run-id', 'ninth', '--approve-quality-revalidation', '--execute']]) expect(() => parseLocalPilotArguments(bad)).toThrow();
  });

  function interruptionFixture() {
    const input = { ...failedEighthTargetFixture(), runId: 'quality-revalidation-product-demo-pilot-2026-09-07' };
    const fp = candidateFingerprints(other).candidate;
    const completedAt = '2026-09-07T08:10:00.000Z';
    const detail = 'Error: OpenAI structured generation failed: Error: HTTP request timed out after 240000ms.';
    let state = reserveCandidate(reconcileLocalPilotCandidate(input).state, other, input.runId, 'manual_pilot', input.approvedAt);
    state = markCandidateFailure(state, other, input.runId, 'candidate_failed', false, completedAt);
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    state.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 9, observedAt: completedAt, detail });
    const prior = qualityFailureProof();
    const failures = [{ ...prior.report.failures[0], attempt: 9, detail }];
    const report = { ...prior.report, runId: input.runId, startedAt: input.approvedAt, completedAt, failures };
    const events: Array<Record<string, unknown> & { at: string }> = prior.audit.events.slice(0, 6).map(e => ({ ...e, at: input.approvedAt }));
    Object.assign(events[0], { nextAttempt: 9 });
    events.push({ at: completedAt, stage: 'pilot_completed', status: 'failed', counts: report.counts, failures } as typeof events[number]);
    const audit = { ...prior.audit, runId: input.runId, events };
    const proof = { priorRunId: input.runId, candidate: other, implementationHash: 'e'.repeat(64), reportText: JSON.stringify(report), auditText: JSON.stringify(audit) };
    return { input: { ...input, state, runId: 'awake-proof', retryTargetFrom: input.runId, approvedAt: '2026-09-08T01:00:00.000Z' }, proof, report, audit };
  }

  it('requires the distinct interruption CLI, not the old quality flag, for the exact ninth run', () => {
    const args = ['--run-id', 'awake-proof', '--candidate-file', 'artifacts/selected.json', '--retry-target-from',
      'quality-revalidation-product-demo-pilot-2026-09-07', '--approve-interruption-resume', '--execute'];
    expect(parseLocalPilotArguments(args)).toEqual({ runId: args[1], candidateFile: args[3], retryTargetFrom: args[5], approveQualityRevalidation: true });
    for (const bad of [[...args.slice(0, 6), '--approve-quality-revalidation', '--execute'], [...args.slice(0, 5), 'other-timeout', ...args.slice(6)],
      args.slice(0, -1), [...args.slice(0, 4), '--switch-target-from', ...args.slice(5)]]) expect(() => parseLocalPilotArguments(bad)).toThrow();
  });

  it('allows the newly authorized tenth proof once and retains all history on success', () => {
    const { input, proof } = interruptionFixture();
    // The proof parser must accept only the closed first-request timeout, not a model/copy failure.
    const evidence = validateQualityRevalidationEvidence(proof);
    const before = structuredClone(input.state);
    const prepared = reconcileLocalPilotCandidate({ ...input, qualityRevalidationEvidence: evidence });
    expect(prepared.nextAttempt).toBe(10);
    expect(prepared.state.manualTargetSwitch?.retry?.maxAttempt).toBe(10);
    expect(prepared.state.failures).toEqual(before.failures);
    expect(prepared.state.manualTargetSwitch?.retryHistory?.at(-1)).toEqual(before.manualTargetSwitch?.retry);
    expect(() => reserveCandidate(prepared.state, other, input.runId, 'scheduled', input.approvedAt)).toThrow();
    let state = reserveCandidate(prepared.state, other, input.runId, 'manual_pilot', input.approvedAt);
    expect(() => reserveCandidate(state, other, input.runId, 'manual_pilot', input.approvedAt)).toThrow();
    state = markCandidateCompleted(state, other, input.runId, 'prepared', input.approvedAt);
    state.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [candidateFingerprints(other).candidate], status: 'validated' };
    expect(PersistentWorkerStateSchema.safeParse(state).success).toBe(true);
    expect(() => reconcileLocalPilotCandidate({ ...input, state, runId: 'eleventh', retryTargetFrom: input.runId, qualityRevalidationEvidence: evidence })).toThrow();
    expect(input.state).toEqual(before);
  });

  it.each(['model-response', 'extra-stage', 'wrong-phase', 'wrong-timeout', 'wrong-attempt', 'wrong-run', 'native', 'artifact', 'counts', 'publication'])(
    'rejects interruption proof with %s', problem => {
      const { proof, report, audit } = interruptionFixture();
      if (problem === 'model-response') audit.events[5].stage = 'model_response_retained';
      if (problem === 'extra-stage') audit.events.push({ ...audit.events[5] });
      if (problem === 'wrong-phase') audit.events[5].phase = 'videoclaw_article_repair_v2';
      if (problem === 'wrong-timeout') report.failures[0].detail = 'Draft failed quality review.';
      if (problem === 'wrong-attempt') report.failures[0].attempt = 8;
      if (problem === 'wrong-run') proof.priorRunId = 'different-timeout';
      if (problem === 'native') audit.events[5].stage = 'native_validation_started';
      if (problem === 'artifact') report.artifacts.push({} as never);
      if (problem === 'counts') report.counts.drafted = 1;
      if (problem === 'publication') audit.publicationEnabled = true;
      expect(() => validateQualityRevalidationEvidence({ ...proof, reportText: JSON.stringify(report), auditText: JSON.stringify(audit) })).toThrow();
    });

  it('accepts quality attempt nine once, preserves all history, and blocks replay, schedules and attempt ten', () => {
    const input = failedEighthTargetFixture();
    const before = structuredClone(input.state);
    const fp = candidateFingerprints(other).candidate;
    const prepared = reconcileLocalPilotCandidate(input);
    expect(prepared.nextAttempt).toBe(9);
    expect(prepared.state.manualTargetSwitch?.retry).toMatchObject({ reason: 'manual_quality_revalidation', maxAttempt: 9,
      evidence: input.qualityRevalidationEvidence, priorDecision: before.decisions[fp], consumedAt: null });
    expect(prepared.state.manualTargetSwitch?.retryHistory).toEqual([...before.manualTargetSwitch!.retryHistory!, before.manualTargetSwitch!.retry]);
    for (const key of ['decisions', 'runs', 'failures', 'manualRetryApproval'] as const) expect(prepared.state[key]).toEqual(before[key]);
    expect(reconcileLocalPilotCandidate({ ...input, state: structuredClone(prepared.state) }).state).toEqual(prepared.state);
    const queue = buildIncrementalQueue({ state: reserveManualPilot(prepared.state, input.runId, input.approvedAt), backlog: prepared.backlog,
      runId: input.runId, mode: 'manual_pilot', now: input.approvedAt });
    expect(queue.scan).toEqual([other]);
    expect(() => reserveCandidate(prepared.state, other, input.runId, 'scheduled', input.approvedAt)).toThrow();
    expect(() => reserveCandidate(prepared.state, { ...other, secondaryKeywords: ['changed'] }, input.runId, 'manual_pilot', input.approvedAt)).toThrow();
    const reserved = reserveCandidate(queue.state, other, input.runId, 'manual_pilot', input.approvedAt);
    expect(reserved.decisions[fp]).toMatchObject({ attempts: 9, status: 'leased' });
    expect(reserved.manualTargetSwitch?.retry?.consumedAt).toBe(input.approvedAt);
    expect(() => reserveCandidate(reserved, other, input.runId, 'manual_pilot', input.approvedAt)).toThrow();
    let failed = markCandidateFailure(reserved, other, input.runId, 'candidate_failed', true, input.approvedAt);
    failed.manualPilot = null;
    failed.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    failed.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 9, observedAt: input.approvedAt, detail: 'Ninth failed.' });
    failed = compactPersistentWorkerState(failed);
    expect(failed.failures).toEqual([...before.failures, failed.failures.at(-1)]);
    expect(failed.decisions[fp]).toMatchObject({ attempts: 9, status: 'terminal' });
    for (const flag of ['approveQualityRevalidation', 'approveEngineeringResume', 'approveScopeAlignmentRetry', 'approveReviewRepairRetry', 'approveSourcePlanRetry', 'approveTargetExtraAttempt']) {
      expect(() => reconcileLocalPilotCandidate({ ...input, state: failed, runId: 'tenth', retryTargetFrom: input.runId, approveQualityRevalidation: false, [flag]: true })).toThrow();
    }
    expect(() => reserveCandidate(failed, other, 'tenth', 'manual_pilot', input.approvedAt)).toThrow();
    expect(input.state).toEqual(before);
  });

  it.each(['missing-completion', 'missing-source', 'missing-model', 'extra-model', 'wrong-phase', 'wrong-call', 'http-error', 'native', 'source-only',
    'wrong-run', 'wrong-candidate', 'wrong-attempt', 'other-failure', 'counts-mismatch', 'failure-mismatch', 'artifact', 'publication', 'scheduled', 'late-model'])(
    'rejects quality receipts with %s', (problem) => {
      const proof = qualityFailureProof();
      const events = proof.audit.events;
      if (problem === 'missing-completion') events.pop();
      if (problem === 'missing-source') events.splice(4, 1);
      if (problem === 'missing-model') events.splice(12, 1);
      if (problem === 'extra-model') events.splice(13, 0, { ...events[12] });
      if (problem === 'wrong-phase') events[11].phase = 'videoclaw_article_draft_v2';
      if (problem === 'wrong-call') events[12].call = 3;
      if (problem === 'http-error') events[12].httpStatus = 500;
      if (problem === 'native') events[12].stage = 'native_validation_started';
      if (problem === 'source-only') proof.report.counts.deepInspected = 0;
      if (problem === 'wrong-run') proof.priorRunId = 'another-eighth';
      if (problem === 'wrong-candidate') proof.candidate = { ...other, articleId: 'other' };
      if (problem === 'wrong-attempt') proof.report.failures[0].attempt = 7;
      if (problem === 'other-failure') proof.report.failures[0].detail = 'Provider timed out.';
      if (problem === 'counts-mismatch') events.at(-1)!.counts = { ...proof.report.counts, drafted: 1 };
      if (problem === 'failure-mismatch') events.at(-1)!.failures = [];
      if (problem === 'artifact') proof.report.artifacts = [{}] as never[];
      if (problem === 'publication') proof.audit.publicationEnabled = true;
      if (problem === 'scheduled') proof.audit.scheduledRuntimeConfigured = true;
      if (problem === 'late-model') events[12].at = '2026-09-07T09:00:00.000Z';
      expect(() => qualityEvidence(proof)).toThrow();
    });

  it.each(['no-proof', 'no-flag', 'old-flag', 'changed-candidate', 'missing-history', 'unused-eight', 'wrong-prior', 'reused-run',
    'artifact', 'prior-success', 'missing-selection', 'wrong-detail', 'missing-failure', 'report-start', 'future-proof'])(
    'rejects quality approval with %s without mutating history', (problem) => {
      const input = failedEighthTargetFixture();
      const fp = candidateFingerprints(other).candidate;
      if (problem === 'no-proof') input.qualityRevalidationEvidence = undefined as never;
      if (problem === 'no-flag') input.approveQualityRevalidation = false;
      if (problem === 'old-flag') input.approveEngineeringResume = true;
      if (problem === 'changed-candidate') input.candidate = { ...other, secondaryKeywords: ['changed'] };
      if (problem === 'missing-history') input.state.manualTargetSwitch!.retryHistory!.shift();
      if (problem === 'unused-eight') input.state.manualTargetSwitch!.retry!.consumedAt = null;
      if (problem === 'wrong-prior') input.retryTargetFrom = 'engineering-resume';
      if (problem === 'reused-run') input.runId = 'alternative-pilot';
      if (problem === 'artifact') input.state.contentHashes[fp] = 'a'.repeat(64);
      if (problem === 'prior-success') input.state.runs['old-success'] = { ...input.state.runs[input.retryTargetFrom], runId: 'old-success', status: 'validated' };
      if (problem === 'missing-selection') input.state.runs[input.retryTargetFrom].selectedCandidateFingerprints = [];
      if (problem === 'wrong-detail') input.state.failures.at(-1)!.detail = 'Unrelated failure.';
      if (problem === 'missing-failure') input.state.failures.pop();
      if (problem === 'report-start') input.qualityRevalidationEvidence.reportStartedAt = at;
      if (problem === 'future-proof') input.qualityRevalidationEvidence.auditCompletedAt = '2027-01-01T00:00:00.000Z';
      const before = structuredClone(input);
      expect(() => reconcileLocalPilotCandidate(input)).toThrow();
      expect(input).toEqual(before);
    });

  it.each(['reportHash', 'auditHash', 'implementationHash'])('rejects reloaded quality authority after %s changes', (field) => {
    const input = failedEighthTargetFixture();
    const state = reconcileLocalPilotCandidate(input).state;
    expect(() => reconcileLocalPilotCandidate({ ...input, state, qualityRevalidationEvidence: { ...input.qualityRevalidationEvidence, [field]: 'f'.repeat(64) } })).toThrow();
  });

  it('rejects even schema-valid edits to the consumed eighth grant after quality approval', () => {
    const input = failedEighthTargetFixture();
    const state = reconcileLocalPilotCandidate(input).state;
    state.manualTargetSwitch!.retryHistory!.at(-1)!.evidence!.implementationHash = 'e'.repeat(64);
    expect(PersistentWorkerStateSchema.safeParse(state).success).toBe(false);
  });

  it('fails closed when local quality receipts are absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'quality-revalidation-'));
    await expect(readLocalQualityRevalidationEvidence(root, qualityFailureProof().priorRunId, other)).rejects.toThrow();
  });

  it('binds a closed zero-model source failure to literal report, audit and implementation hashes', () => {
    const proof = sourceFailureProof();
    const reportText = `${JSON.stringify(proof.report, null, 2)}\n`;
    const auditText = `${JSON.stringify(proof.audit, null, 2)}\n`;
    expect(validateEngineeringResumeEvidence({ ...proof, reportText, auditText })).toEqual({ priorRunId: proof.priorRunId,
      candidateFingerprint: candidateFingerprints(other).candidate, articleId: other.articleId, reportStartedAt: proof.report.startedAt,
      reportCompletedAt: proof.report.completedAt, auditCompletedAt: proof.report.completedAt,
      reportHash: createHash('sha256').update(reportText).digest('hex'), auditHash: createHash('sha256').update(auditText).digest('hex'), implementationHash: 'c'.repeat(64) });
  });

  it.each(['missing-completion', 'missing-start', 'missing-preflight', 'model_stage_started', 'model_response_retained', 'native_validation_started', 'native_validation_completed',
    'unknown-stage', 'extra-event', 'reordered', 'wrong-run', 'wrong-candidate', 'wrong-attempt', 'wrong-failure', 'success', 'scheduled', 'publication', 'configured-schedule',
    'artifact', 'deepInspected', 'drafted', 'validated', 'pullRequestsOpened', 'counts-mismatch', 'failure-mismatch', 'open-report', 'bad-hash'])(
    'rejects engineering resume evidence with %s', (problem) => {
      const proof = sourceFailureProof();
      if (problem === 'missing-completion') proof.audit.events.pop();
      if (problem === 'missing-start') proof.audit.events.splice(3, 1);
      if (problem === 'missing-preflight') proof.audit.events.shift();
      if (/^(model_|native_)/u.test(problem) || problem === 'unknown-stage') proof.audit.events.splice(4, 0, { at: proof.report.completedAt, stage: problem });
      if (problem === 'extra-event') proof.audit.events.push(proof.audit.events[0]);
      if (problem === 'reordered') proof.audit.events.reverse();
      if (problem === 'wrong-run') proof.audit.runId = 'other-run';
      if (problem === 'wrong-candidate') proof.report.failures[0].candidateFingerprint = 'candidate:other';
      if (problem === 'wrong-attempt') proof.report.failures[0].attempt = 6;
      if (problem === 'wrong-failure') proof.report.failures[0].code = 'drafting_failed';
      if (problem === 'success') proof.report.status = 'validated';
      if (problem === 'scheduled') proof.report.mode = 'scheduled';
      if (problem === 'publication') proof.audit.publicationEnabled = true;
      if (problem === 'configured-schedule') proof.audit.scheduledRuntimeConfigured = true;
      if (problem === 'artifact') proof.report.artifacts = [{}] as never[];
      if (['deepInspected', 'drafted', 'validated', 'pullRequestsOpened'].includes(problem)) proof.report.counts[problem as 'drafted'] = 1;
      if (problem === 'counts-mismatch') proof.audit.events.at(-1)!.counts = { ...proof.report.counts, scanned: 2 };
      if (problem === 'failure-mismatch') proof.audit.events.at(-1)!.failures = [];
      if (problem === 'open-report') proof.report.completedAt = '';
      if (problem === 'bad-hash') proof.implementationHash = 'reviewed';
      expect(() => resumeEvidence(proof)).toThrow();
    });

  it('grants and atomically consumes only attempt eight, preserving proof and all seven failures through compaction', () => {
    const input = failedSeventhTargetFixture();
    const before = structuredClone(input.state);
    const fp = candidateFingerprints(other).candidate;
    const prepared = reconcileLocalPilotCandidate(input);
    expect(prepared.nextAttempt).toBe(8);
    expect(prepared.state.manualTargetSwitch?.retry).toMatchObject({ reason: 'manual_engineering_resume', maxAttempt: 8,
      evidence: input.engineeringResumeEvidence, priorRunId: input.retryTargetFrom, priorDecision: before.decisions[fp], consumedAt: null });
    expect(prepared.state.manualTargetSwitch?.retryHistory).toEqual([...before.manualTargetSwitch!.retryHistory!, before.manualTargetSwitch!.retry]);
    for (const key of ['decisions', 'runs', 'failures', 'manualRetryApproval'] as const) expect(prepared.state[key]).toEqual(before[key]);
    expect(reconcileLocalPilotCandidate({ ...input, state: JSON.parse(JSON.stringify(prepared.state)) }).state).toEqual(prepared.state);
    const queued = buildIncrementalQueue({ state: reserveManualPilot(prepared.state, input.runId, input.approvedAt), backlog: prepared.backlog,
      runId: input.runId, mode: 'manual_pilot', now: input.approvedAt });
    expect(queued.scan).toEqual([other]);
    const reserved = reserveCandidate(queued.state, other, input.runId, 'manual_pilot', input.approvedAt);
    expect(reserved.decisions[fp]).toMatchObject({ attempts: 8, status: 'leased', runId: input.runId });
    expect(reserved.manualTargetSwitch?.retry?.consumedAt).toBe(input.approvedAt);
    let failed = markCandidateFailure(reserved, other, input.runId, 'candidate_failed', true, input.approvedAt);
    failed.manualPilot = null;
    failed.runs[input.runId] = { schemaVersion: 1, runId: input.runId, mode: 'manual_pilot', startedAt: input.approvedAt, selectedCandidateFingerprints: [fp], status: 'failed' };
    failed.failures.push({ runId: input.runId, candidateFingerprint: fp, code: 'candidate_failed', attempt: 8, observedAt: input.approvedAt, detail: 'Attempt eight failed.' });
    failed = compactPersistentWorkerState(failed);
    expect(failed.manualTargetSwitch).toEqual(reserved.manualTargetSwitch);
    expect(failed.failures.filter(f => f.candidateFingerprint === fp).map(f => f.attempt)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(failed.decisions[fp]).toMatchObject({ attempts: 8, status: 'terminal' });
    for (const flag of ['approveEngineeringResume', 'approveScopeAlignmentRetry', 'approveReviewRepairRetry', 'approveSourcePlanRetry', 'approveTargetExtraAttempt']) {
      expect(() => reconcileLocalPilotCandidate({ ...input, state: failed, runId: 'ninth', retryTargetFrom: input.runId, approveEngineeringResume: false, [flag]: true })).toThrow();
    }
    for (const [state, runId, mode] of [[reserved, input.runId, 'manual_pilot'], [prepared.state, input.runId, 'scheduled'], [failed, 'ninth', 'manual_pilot']] as const) {
      expect(() => reserveCandidate(state, other, runId, mode, input.approvedAt)).toThrow();
    }
    expect(input.state).toEqual(before);
  });

  it.each(['no-proof', 'no-flag', 'old-flag', 'two-flags', 'fresh-state', 'missing-history', 'unused-seven', 'wrong-seven-reason', 'non-source-failure',
    'wrong-candidate', 'wrong-prior', 'reused-run', 'artifact', 'success', 'pilot', 'publication', 'scheduled', 'report-start', 'future-proof', 'missing-hash', 'bad-cap'])(
    'rejects an eighth grant with %s', (problem) => {
      const input = failedSeventhTargetFixture();
      const fp = candidateFingerprints(other).candidate;
      if (problem === 'no-proof') input.engineeringResumeEvidence = undefined as never;
      if (problem === 'no-flag' || problem === 'old-flag') input.approveEngineeringResume = false;
      if (problem === 'old-flag' || problem === 'two-flags') input.approveScopeAlignmentRetry = true;
      if (problem === 'fresh-state') input.state = createPersistentWorkerState();
      if (problem === 'missing-history') input.state.manualTargetSwitch!.retryHistory = [];
      if (problem === 'unused-seven') input.state.manualTargetSwitch!.retry!.consumedAt = null;
      if (problem === 'wrong-seven-reason') input.state.manualTargetSwitch!.retry!.reason = 'user_authorized_after_review_repair_fix';
      if (problem === 'non-source-failure') input.state.failures.at(-1)!.code = 'candidate_failed';
      if (problem === 'wrong-candidate') input.candidate = { ...other, title: 'Changed title' };
      if (problem === 'wrong-prior') input.retryTargetFrom = 'review-repair-retry';
      if (problem === 'reused-run') input.runId = input.retryTargetFrom;
      if (problem === 'artifact') input.state.contentHashes[fp] = 'a'.repeat(64);
      if (problem === 'success') input.state.runs[input.retryTargetFrom].status = 'validated';
      if (problem === 'pilot') input.state = reserveManualPilot(input.state, input.retryTargetFrom, input.approvedAt);
      if (problem === 'publication') input.state.pullRequests[fp] = { number: 1, url: 'https://example.com/pr/1', status: 'opened' };
      if (problem === 'scheduled') input.state.runs[input.retryTargetFrom].mode = 'scheduled';
      if (problem === 'report-start') input.engineeringResumeEvidence.reportStartedAt = at;
      if (problem === 'future-proof') input.engineeringResumeEvidence.auditCompletedAt = '2027-01-01T00:00:00.000Z';
      if (problem === 'missing-hash') input.engineeringResumeEvidence.auditHash = '';
      if (problem === 'bad-cap') {
        const state = reconcileLocalPilotCandidate(input).state;
        state.manualTargetSwitch!.retry!.maxAttempt = 9 as never;
        expect(PersistentWorkerStateSchema.safeParse(state).success).toBe(false);
      } else expect(() => reconcileLocalPilotCandidate(input)).toThrow();
    });

  it.each(['reportHash', 'auditHash', 'implementationHash'])('cannot reload a grant after %s changes', (field) => {
    const input = failedSeventhTargetFixture();
    const state = reconcileLocalPilotCandidate(input).state;
    expect(() => reconcileLocalPilotCandidate({ ...input, state, engineeringResumeEvidence: { ...input.engineeringResumeEvidence, [field]: 'f'.repeat(64) } })).toThrow();
  });

  it.each(['no-proof', 'no-cap', 'reportHash', 'auditHash', 'implementationHash', 'wrong-run', 'wrong-candidate', 'wrong-article', 'foreign-selection', 'duplicate-selection', 'ordinary-reason', 'ninth'])(
    'rejects compact engineering resume state with %s', (problem) => {
      const input = failedSeventhTargetFixture();
      const state = reconcileLocalPilotCandidate(input).state;
      const grant = state.manualTargetSwitch!.retry!;
      if (problem === 'no-proof') delete grant.evidence;
      if (problem === 'no-cap') delete grant.maxAttempt;
      if (['reportHash', 'auditHash', 'implementationHash'].includes(problem)) Reflect.deleteProperty(grant.evidence!, problem);
      if (problem === 'wrong-run') grant.evidence!.priorRunId = 'different';
      if (problem === 'wrong-candidate') grant.evidence!.candidateFingerprint = 'candidate:other';
      if (problem === 'wrong-article') grant.evidence!.articleId = 'other';
      if (problem === 'foreign-selection') state.runs[input.retryTargetFrom].selectedCandidateFingerprints = ['candidate:other'];
      if (problem === 'duplicate-selection') state.runs[input.retryTargetFrom].selectedCandidateFingerprints = [candidateFingerprints(other).candidate, candidateFingerprints(other).candidate];
      if (problem === 'ordinary-reason') grant.reason = 'user_authorized_after_scope_alignment_fix';
      if (problem === 'ninth') state.decisions[candidateFingerprints(other).candidate].attempts = 9;
      expect(PersistentWorkerStateSchema.safeParse(state).success).toBe(false);
    });

  it('accepts engineering resume only with the exact candidate-file target retry command', () => {
    const args = ['--run-id', 'engineering-resume', '--candidate-file', 'artifacts/selected.json', '--retry-target-from', 'scope-alignment-retry', '--approve-engineering-resume', '--execute'];
    expect(parseLocalPilotArguments(args)).toEqual({ runId: args[1], candidateFile: args[3], retryTargetFrom: args[5], approveEngineeringResume: true });
    for (const bad of [args.slice(0, -1), [...args.slice(0, 4), '--switch-target-from', ...args.slice(5)], ['--run-id', args[5], ...args.slice(2)],
      ['--run-id', 'resume', '--approve-engineering-resume', '--execute'], ...['--approve-scope-alignment-retry', '--approve-engineering-resume'].map(flag => [...args.slice(0, -1), flag, '--execute'])]) {
      expect(() => parseLocalPilotArguments(bad)).toThrow();
    }
  });

  it('fails the local evidence reader on absent receipts or a path-like prior run ID', async () => {
    const root = await mkdtemp(join(tmpdir(), 'engineering-resume-'));
    await expect(readLocalEngineeringResumeEvidence(root, 'missing', other)).rejects.toThrow();
    await expect(readLocalEngineeringResumeEvidence(root, '../escape', other)).rejects.toThrow();
  });

  it('reloads an unused fourth target approval only with the matching explicit extra-attempt flag', () => {
    const input = failedThirdTargetFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    const reloaded = { ...input, state: JSON.parse(JSON.stringify(prepared.state)), approvedAt: '2026-09-07T01:00:00.000Z' };
    expect(reconcileLocalPilotCandidate(reloaded).state).toEqual(prepared.state);
    expect(() => reconcileLocalPilotCandidate({ ...reloaded, approveTargetExtraAttempt: undefined })).toThrow();
    expect(() => reconcileLocalPilotCandidate({ ...reloaded, approveTargetExtraAttempt: false })).toThrow();
  });

  it.each([2, 3, 4])('does not reload target attempt %s through the old switch flag', (attempt) => {
    const input = attempt === 2 ? failedSwitchFixture() : attempt === 3 ? failedTargetRetryFixture() : failedThirdTargetFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    expect(() => reconcileLocalPilotCandidate({ state: prepared.state, backlog: prepared.backlog, candidate: input.candidate,
      runId: input.runId, approvedAt: input.approvedAt, switchTargetFrom: prepared.state.manualTargetSwitch!.parkedRetryRunId })).toThrow();
  });

  it.each([2, 3])('rejects an extra-attempt flag on an unused normal target attempt %s approval', (attempt) => {
    const input = attempt === 2 ? failedSwitchFixture() : failedTargetRetryFixture();
    const prepared = reconcileLocalPilotCandidate(input);
    expect(() => reconcileLocalPilotCandidate({ ...input, state: prepared.state, approveTargetExtraAttempt: true })).toThrow();
  });

  it('keeps the normal target cap at three without explicit extra-attempt approval', () => {
    const input = failedThirdTargetFixture();
    expect(() => reconcileLocalPilotCandidate({ ...input, approveTargetExtraAttempt: undefined })).toThrow();
  });

  it.each(['ordinary', 'old-retry', 'switch'])('rejects extra-attempt reconciliation in %s mode', (mode) => {
    const input = mode === 'ordinary' ? fixture() : mode === 'old-retry' ? terminalFixture() : switchFixture();
    expect(() => reconcileLocalPilotCandidate({ ...input, approveTargetExtraAttempt: true })).toThrow();
  });

  it('parses extra-attempt approval only alongside candidate-file and target-retry before execute', () => {
    const args = ['--run-id', 'editorial-fixed-retry', '--candidate-file', 'artifacts/selected.json', '--retry-target-from', 'attribution-retry', '--approve-target-extra-attempt', '--execute'];
    expect(parseLocalPilotArguments(args)).toEqual({ runId: 'editorial-fixed-retry', candidateFile: 'artifacts/selected.json', retryTargetFrom: 'attribution-retry', approveTargetExtraAttempt: true });
    for (const bad of [
      ['--run-id', 'new', '--approve-target-extra-attempt', '--execute'],
      ['--run-id', 'new', '--approve-retry-from', 'old', '--approve-target-extra-attempt', '--execute'],
      [...args.slice(0, 4), '--switch-target-from', ...args.slice(5)],
      [...args.slice(0, 6), '--execute', '--approve-target-extra-attempt'],
      [...args.slice(0, -1), '--approve-target-extra-attempt', '--execute'],
      args.slice(0, -1),
      ['--run-id', 'new', '--retry-target-from', 'old', '--approve-target-extra-attempt', '--execute'],
    ]) expect(() => parseLocalPilotArguments(bad)).toThrow();
  });

  it.each(['missing-history', 'unconsumed-history', 'wrong-chain', 'reused-run', 'changed-attempt', 'missing-prior-failure'])('rejects a third-attempt grant with %s', (problem) => {
    const input = failedTargetRetryFixture();
    const value = reconcileLocalPilotCandidate(input).state;
    const target = value.manualTargetSwitch!;
    if (problem === 'missing-history') target.retryHistory = [];
    if (problem === 'unconsumed-history') target.retryHistory![0].consumedAt = null;
    if (problem === 'wrong-chain') target.retry!.priorRunId = target.runId;
    if (problem === 'reused-run') target.retry!.runId = target.runId;
    if (problem === 'changed-attempt') target.retry!.priorDecision.attempts = 1;
    if (problem === 'missing-prior-failure') value.failures = value.failures.filter(f => f.runId !== 'alternative-pilot');
    expect(PersistentWorkerStateSchema.safeParse(value).success).toBe(false);
  });

  it.each(['wrong-target', 'wrong-prior', 'old-run', 'artifact', 'success', 'missing-failure', 'active-pilot', 'older-approval'])(
    'refuses same-target reconciliation with %s', (problem) => {
      const input = failedSwitchFixture();
      if (problem === 'wrong-target') input.candidate = refined;
      if (problem === 'wrong-prior') input.retryTargetFrom = 'unrelated';
      if (problem === 'old-run') input.runId = input.retryTargetFrom;
      if (problem === 'artifact') input.state.contentHashes[candidateFingerprints(other).candidate] = 'a'.repeat(64);
      if (problem === 'success') input.state.runs[input.retryTargetFrom].status = 'validated';
      if (problem === 'missing-failure') input.state.failures = input.state.failures.filter(f => f.runId !== input.retryTargetFrom);
      if (problem === 'active-pilot') input.state = reserveManualPilot(input.state, input.retryTargetFrom, input.approvedAt);
      if (problem === 'older-approval') input.approvedAt = '2026-09-05T18:00:00.000Z';
      expect(() => reconcileLocalPilotCandidate(input)).toThrow();
    });

  it('does not resurrect the exhausted parked matrix row after terminal queue cleanup', () => {
    const input = failedSwitchFixture();
    input.state.queuedCandidates = input.state.queuedCandidates.filter(c => c.articleId !== refined.articleId);
    input.backlog = [original, other];
    const result = reconcileLocalPilotCandidate(input);
    expect(result.backlog).toEqual([other]);
    expect(result.state.decisions[fingerprint]).toEqual(input.state.decisions[fingerprint]);
    expect(result.state.manualRetryApproval).toEqual(input.state.manualRetryApproval);
  });

  it('requires the explicit same-target retry CLI flag and disallows combining authorizations', () => {
    const args = ['--run-id', 'collector-fixed-retry', '--candidate-file', 'artifacts/selected.json', '--retry-target-from', 'alternative-pilot', '--execute'];
    expect(parseLocalPilotArguments(args)).toEqual({ runId: 'collector-fixed-retry', candidateFile: 'artifacts/selected.json', retryTargetFrom: 'alternative-pilot' });
    expect(() => parseLocalPilotArguments([...args.slice(0, -1), '--switch-target-from', 'old', '--execute'])).toThrow();
  });

  it('adds a distinct selected candidate without mapping old history and idempotently reloads only its explicit pending switch', () => {
    const input = switchFixture();
    const before = structuredClone(input);
    input.state.queuedCandidates = [refined];
    input.backlog = [original];
    const result = reconcileLocalPilotCandidate(input);
    const queue = buildIncrementalQueue({ state: reserveManualPilot(result.state, input.runId, input.approvedAt), backlog: result.backlog,
      runId: input.runId, mode: 'manual_pilot', now: input.approvedAt });
    expect(queue.scan).toEqual([other]);
    expect(result.nextAttempt).toBe(1);
    expect(result.candidate).toEqual(other);
    expect(result.state.queuedCandidates).toEqual([refined, other]);
    expect(result.backlog).toEqual([refined, other]);
    expect(input.backlog).toEqual([original]);
    expect(input.state.queuedCandidates).toEqual([refined]);
    expect(result.state.manualRetryApproval).toEqual(before.state.manualRetryApproval);
    for (const key of ['decisions', 'runs', 'failures', 'candidates', 'contentHashes', 'pullRequests', 'candidateFingerprints', 'dedupeHashes'] as const) expect(result.state[key]).toEqual(before.state[key]);
    const reloaded = reconcileLocalPilotCandidate({ ...input, state: JSON.parse(JSON.stringify(result.state)), backlog: result.backlog, approvedAt: '2026-09-07T21:00:00.000Z' });
    expect(reloaded.state).toEqual(result.state);
    expect(() => reconcileLocalPilotCandidate({ ...input, state: result.state, switchTargetFrom: undefined })).toThrow();
    expect(() => reconcileLocalPilotCandidate({ ...input, state: result.state, runId: 'other-run' })).toThrow();
    expect(() => reconcileLocalPilotCandidate({ ...input, state: result.state, candidate: { ...other, title: 'Changed title' } })).toThrow();
  });

  it.each(['missing-exact-retained-row', 'wrong-retained-title', 'changed-campaign', 'changed-slug', 'attempted-matrix-row', 'duplicate-matrix-row'])('does not reconcile an unaudited parked backlog representation: %s', (problem) => {
    const input = switchFixture();
    input.backlog = [original, other];
    if (problem === 'missing-exact-retained-row') input.state.queuedCandidates = [other];
    if (problem === 'wrong-retained-title') input.state.queuedCandidates = [{ ...refined, title: 'Unapproved title' }, other];
    if (problem === 'changed-campaign') input.backlog[0] = { ...original, campaignId: 'newly-funded-founder' };
    if (problem === 'changed-slug') input.backlog[0] = { ...original, slug: 'unrelated-topic' };
    if (problem === 'attempted-matrix-row') input.state.decisions[candidateFingerprints(original).candidate] = { ...input.state.decisions[fingerprint],
      intentFingerprint: candidateFingerprints(original).intent, identities: Object.values(candidateFingerprints(original)) };
    if (problem === 'duplicate-matrix-row') input.backlog.push(original);
    const before = structuredClone(input);
    expect(() => reconcileLocalPilotCandidate(input)).toThrow();
    expect(input).toEqual(before);
  });

  it.each(['old-candidate', 'old-keyword', 'backlog-collision', 'scheduled-pilot', 'prepared-pilot', 'seen-hash', 'terminal-new', 'both-flags'])('rejects target-switch %s without altering retained state', (problem) => {
    const input = switchFixture();
    if (problem === 'old-candidate') input.candidate = refined;
    if (problem === 'old-keyword') input.candidate = { ...other, primaryKeyword: refined.primaryKeyword };
    if (problem === 'backlog-collision') input.backlog.push({ ...other, articleId: 'vc-c2-003' });
    if (problem === 'scheduled-pilot' || problem === 'prepared-pilot') input.state.manualPilot = { runId: 'other', status: problem === 'prepared-pilot' ? 'prepared' : 'leased', reservedAt: at, leaseExpiresAt: null, artifactHash: null, consumedAt: null };
    if (problem === 'seen-hash') input.state.candidateFingerprints.push(candidateFingerprints(other).keyword);
    if (problem === 'terminal-new') input.state.decisions[candidateFingerprints(other).candidate] = { ...input.state.decisions[fingerprint], articleId: other.articleId, intentFingerprint: candidateFingerprints(other).intent, identities: Object.values(candidateFingerprints(other)) };
    const before = structuredClone(input.state);
    expect(() => reconcileLocalPilotCandidate({ ...input, ...(problem === 'both-flags' ? { approveRetryFrom: 'automated-attempt-3' } : {}) })).toThrow();
    expect(input.state).toEqual(before);
  });

  it('reads only a private bounded bare Candidate file under artifacts, never a context/evidence envelope', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pilot-candidate-'));
    const directory = join(root, 'artifacts');
    await mkdir(directory);
    const path = join(directory, 'candidate.json');
    await writeFile(path, JSON.stringify(other), { mode: 0o600 });
    expect(await readLocalPilotCandidateFile(root, 'artifacts/candidate.json')).toEqual(other);
    await writeFile(path, JSON.stringify({ candidate: other, evidence: {} }));
    await expect(readLocalPilotCandidateFile(root, path)).rejects.toThrow();
    await writeFile(path, ' '.repeat(16_385));
    await expect(readLocalPilotCandidateFile(root, path)).rejects.toThrow();
    await writeFile(path, JSON.stringify(other));
    await chmod(path, 0o644);
    await expect(readLocalPilotCandidateFile(root, path)).rejects.toThrow();
    await chmod(path, 0o600);
    await symlink(path, join(directory, 'alias.json'));
    await expect(readLocalPilotCandidateFile(root, 'artifacts/alias.json')).rejects.toThrow();
    await writeFile(join(root, 'outside.json'), JSON.stringify(other), { mode: 0o600 });
    await expect(readLocalPilotCandidateFile(root, 'outside.json')).rejects.toThrow();
  });

  it('parses the explicit prior-run retry approval without adding a default override', () => {
    expect(parseLocalPilotArguments(['--run-id', 'approved-attempt-4', '--approve-retry-from', 'automated-pilot-2026-09-06-attempt-3', '--execute'])).toEqual({
      runId: 'approved-attempt-4', approveRetryFrom: 'automated-pilot-2026-09-06-attempt-3',
    });
    for (const args of [
      ['--run-id', 'new', '--approve-retry-from', '../old', '--execute'],
      ['--run-id', 'same', '--approve-retry-from', 'same', '--execute'],
      ['--run-id', 'new', '--approve-retry-from', 'old'],
      ['--run-id', 'new', '--approve-retry-from', 'old', '--execute', '--reset'],
      ['--run-id', 'new', '--approve-retry-from', '--execute'],
    ]) expect(() => parseLocalPilotArguments(args)).toThrow();
  });

  it('restores only the approved recorded terminal identity and retains all other queued history', () => {
    const input = terminalFixture();
    const before = structuredClone(input);
    const result = reconcileLocalPilotCandidate(input);
    expect(result.nextAttempt).toBe(4);
    expect(result.state.manualRetryApproval).toMatchObject({ runId: input.runId, priorRunId: input.approveRetryFrom,
      candidateFingerprint: fingerprint, identities: Object.values(candidateFingerprints(refined)),
      reason: 'user_authorized_after_input_fix', approvedAt: input.approvedAt, consumedAt: null });
    expect(result.state.queuedCandidates).toEqual([other, refined]);
    expect(result.state.decisions).toEqual(before.state.decisions);
    expect(result.state.runs).toEqual(before.state.runs);
    expect(result.state.failures).toEqual(before.state.failures);
    expect(result.state.dedupeHashes).toEqual(before.state.dedupeHashes);
    expect(result.state.candidateFingerprints).toEqual(before.state.candidateFingerprints);
    expect(input).toEqual(before);
    expect(reserveCandidate(result.state, refined, input.runId, 'manual_pilot', input.approvedAt).decisions[fingerprint].attempts).toBe(4);
  });

  it('reuses an identical unused approval only with the explicit flag and preserves its original audit date', () => {
    const input = terminalFixture();
    input.state = grantManualRetryApproval(input.state, refined, { priorRunId: input.approveRetryFrom, runId: input.runId, reason: 'user_authorized_after_input_fix', approvedAt: input.approvedAt });
    const before = structuredClone(input.state);
    input.approvedAt = '2026-09-07T21:00:00.000Z';
    const result = reconcileLocalPilotCandidate(input);
    expect(result.state.manualRetryApproval).toEqual(before.manualRetryApproval);
    expect(result.state.decisions).toEqual(before.decisions);
    expect(result.nextAttempt).toBe(4);
    expect(() => reconcileLocalPilotCandidate({ ...input, approveRetryFrom: undefined })).toThrow();
    const consumed = reserveCandidate(result.state, refined, input.runId, 'manual_pilot', input.approvedAt);
    expect(() => reconcileLocalPilotCandidate({ ...input, state: consumed })).toThrow();
  });

  it.each(['default', 'wrong-prior', 'missing-date', 'different-grant-run', 'different-grant-reason', 'missing-backlog', 'changed-title', 'prepared-pilot'])(
    'does not restore a terminal candidate with %s', (problem) => {
      const input = terminalFixture();
      if (problem === 'default') input.approveRetryFrom = undefined as unknown as string;
      if (problem === 'wrong-prior') input.approveRetryFrom = 'automated-attempt-2';
      if (problem === 'missing-date') input.approvedAt = undefined as unknown as string;
      if (problem === 'different-grant-run' || problem === 'different-grant-reason') input.state = grantManualRetryApproval(input.state, refined, { priorRunId: input.approveRetryFrom, runId: problem === 'different-grant-run' ? 'another-run' : input.runId,
        reason: problem === 'different-grant-reason' ? 'another_reason' : 'user_authorized_after_input_fix', approvedAt: input.approvedAt });
      if (problem === 'missing-backlog') input.backlog = [other];
      if (problem === 'changed-title') input.candidate = { ...refined, title: 'Changed title' };
      if (problem === 'prepared-pilot') input.state.manualPilot = { runId: 'old', status: 'prepared', reservedAt: at, leaseExpiresAt: null, artifactHash: 'a'.repeat(64), consumedAt: null };
      const before = structuredClone(input);
      expect(() => reconcileLocalPilotCandidate(input)).toThrow();
      expect(input).toEqual(before);
    },
  );

  it('requires an explicit execution flag and a fresh bounded run-id argument', () => {
    expect(parseLocalPilotArguments(['--run-id', 'automated-attempt-2', '--execute'])).toEqual({ runId: 'automated-attempt-2' });
    for (const args of [[], ['--run-id', 'attempt'], ['--execute'], ['--run-id', '../escape', '--execute'], ['--run-id', 'attempt', '--execute', '--reset'], ['--run-id', 'attempt', '--execute', '--candidate-id', 'new']]) {
      expect(() => parseLocalPilotArguments(args)).toThrow();
    }
  });
  it('reconciles only the same-id unattempted row and preserves the prior attempt and all history', () => {
    const input = fixture();
    const before = structuredClone(input);
    const result = reconcileLocalPilotCandidate(input);
    expect(result.candidate).toEqual(refined);
    expect(result.backlog).toEqual([refined, other]);
    expect(result.state.queuedCandidates).toEqual([refined, other]);
    expect(result.state.decisions).toEqual(before.state.decisions);
    expect(result.state.runs).toEqual(before.state.runs);
    expect(result.state.failures).toEqual(before.state.failures);
    expect(result.state.candidateFingerprints).toEqual(before.state.candidateFingerprints);
    expect(result.state.dedupeHashes).toEqual(before.state.dedupeHashes);
    expect(result.state.manualPilot).toBeNull();
    expect(result.nextAttempt).toBe(2);
    expect(input).toEqual(before);
    const reserved = reserveCandidate(result.state, refined, input.runId, 'manual_pilot', at);
    expect(reserved.decisions[fingerprint].attempts).toBe(2);
  });

  it('accepts an already-reconciled queue without consuming another attempt', () => {
    const input = fixture();
    input.state.queuedCandidates[0] = refined;
    const result = reconcileLocalPilotCandidate(input);
    expect(result.state.decisions[fingerprint].attempts).toBe(1);
    expect(result.state.queuedCandidates).toEqual([refined, other]);
  });

  it.each(['new-candidate-id', 'changed-identity', 'missing-decision', 'terminal', 'exhausted', 'pilot-reserved', 'prior-run', 'attempted-original', 'duplicate-row', 'content-already-prepared'] as const)('fails closed on %s without resetting state', (problem) => {
    const input = fixture();
    if (problem === 'new-candidate-id') input.candidate = { ...refined, articleId: 'vc-c2-999' };
    if (problem === 'changed-identity') input.candidate = { ...refined, title: 'New unreviewed title' };
    if (problem === 'missing-decision') delete input.state.decisions[fingerprint];
    if (problem === 'terminal') input.state.decisions[fingerprint].status = 'terminal';
    if (problem === 'exhausted') input.state.decisions[fingerprint].attempts = 3;
    if (problem === 'pilot-reserved') input.state = reserveManualPilot(input.state, 'other-run', at);
    if (problem === 'prior-run') input.runId = 'assisted-failure';
    if (problem === 'attempted-original') input.state = reserveCandidate(input.state, original, 'old-attempt', 'manual_pilot', at);
    if (problem === 'duplicate-row') input.state.queuedCandidates.push({ ...other, articleId: refined.articleId });
    if (problem === 'content-already-prepared') input.state.contentHashes[fingerprint] = 'a'.repeat(64);
    const before = structuredClone(input);
    expect(() => reconcileLocalPilotCandidate(input)).toThrow();
    expect(input).toEqual(before);
  });
});

describe('unmodified production model transport auditing', () => {
  it.each(['success', 'http-failure', 'transport-failure'])('stops before the fifth Responses POST after %s, excluding Apify GET and POST', async (outcome) => {
    const dispatched: string[] = [];
    const requests: unknown[] = [];
    const responses: unknown[] = [];
    const transport = createModelAuditTransport(async (request) => {
      dispatched.push(`${request.method} ${request.url}`);
      if (request.url === 'https://api.openai.com/v1/responses' && outcome === 'transport-failure') throw new Error('offline failure');
      return { status: outcome === 'http-failure' ? 500 : 200, headers: {}, body: {} };
    }, async (record) => { responses.push(record); }, async (record) => { requests.push(record); });
    const request = { method: 'POST' as const, url: 'https://api.openai.com/v1/responses', headers: {}, signal: new AbortController().signal, body: '{}' };
    for (let call = 1; call <= 4; call += 1) {
      await transport({ ...request, method: 'GET', url: 'https://api.apify.com/v2/datasets/example/items' });
      await transport({ ...request, url: 'https://api.apify.com/v2/acts/example/runs' });
      if (outcome === 'transport-failure') await expect(transport(request)).rejects.toThrow('offline failure');
      else expect((await transport(request)).status).toBe(outcome === 'http-failure' ? 500 : 200);
    }
    await expect(transport(request)).rejects.toThrow(/four|4|limit|budget/i);
    await expect(transport(request)).rejects.toThrow(/four|4|limit|budget/i);
    await transport({ ...request, url: 'https://api.apify.com/v2/acts/example/runs' });
    expect(dispatched.filter(value => value === 'POST https://api.openai.com/v1/responses')).toHaveLength(4);
    expect(dispatched).toHaveLength(13);
    expect(requests).toEqual([1, 2, 3, 4].map(call => ({ call, phase: 'unknown', requestBody: '{}' })));
    expect(responses).toHaveLength(outcome === 'transport-failure' ? 0 : 4);
  });

  it('durably records exact credential-free wire input before dispatch, even when the provider fails', async () => {
    const records: unknown[] = [];
    const payload = { model: 'fixture-model', store: false, input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ sourceFacts: [{ id: 's1', facts: [{ id: 'f1', text: 'Original support.' }] }] }) }] }], text: { format: { name: 'article_draft' } } };
    const request = { method: 'POST' as const, url: 'https://api.openai.com/v1/responses', headers: { Authorization: 'Bearer never-record-this' }, signal: new AbortController().signal, body: JSON.stringify(payload) };
    let dispatched = false;
    const transport = createModelAuditTransport(async (received) => {
      expect(records).toHaveLength(1);
      expect(received).toBe(request);
      dispatched = true;
      throw new Error('offline provider failure');
    }, async () => {}, async (record) => { records.push(record); });
    await expect(transport(request)).rejects.toThrow('offline provider failure');
    expect(dispatched).toBe(true);
    expect(records).toEqual([expect.objectContaining({ call: 1, phase: 'article_draft', requestBody: request.body })]);
    expect(JSON.stringify(records)).not.toContain('never-record-this');
  });

  it('refuses dispatch when the pre-request audit cannot be retained', async () => {
    let dispatched = false;
    const transport = createModelAuditTransport(async () => { dispatched = true; return { status: 200, headers: {}, body: {} }; }, async () => {}, async () => { throw new Error('audit unavailable'); });
    await expect(transport({ method: 'POST', url: 'https://api.openai.com/v1/responses', headers: {}, signal: new AbortController().signal, body: JSON.stringify({ text: { format: { name: 'article_draft' } } }) })).rejects.toThrow('audit unavailable');
    expect(dispatched).toBe(false);
  });

  it('retains the full response while forwarding the exact original request and response', async () => {
    const request = { method: 'POST' as const, url: 'https://api.openai.com/v1/responses', headers: { Authorization: 'fixture' }, signal: new AbortController().signal, body: JSON.stringify({ text: { format: { name: 'article_draft' } }, max_output_tokens: 24000 }) };
    const response = { status: 200, headers: {}, body: { status: 'completed', output: [{ content: [{ type: 'output_text', text: 'complete raw model output' }] }], usage: { output_tokens: 50 } } };
    const records: unknown[] = [];
    const transport = createModelAuditTransport(async (received) => { expect(received).toBe(request); return response; }, async (record) => { records.push(record); });
    expect(await transport(request)).toBe(response);
    expect(records).toEqual([{ call: 1, phase: 'article_draft', httpStatus: 200, response: response.body }]);
  });

  it('does not retain raw answers from non-model provider responses', async () => {
    const records: unknown[] = [];
    const response = { status: 200, headers: {}, body: { answer: 'provider answer, not source evidence' } };
    const transport = createModelAuditTransport(async () => response, async (record) => { records.push(record); });
    await transport({ method: 'GET', url: 'https://api.apify.com/v2/datasets/example/items', headers: {}, signal: new AbortController().signal });
    expect(records).toEqual([]);
  });
});

describe('fresh local pilot inventory', () => {
  const sha = 'a'.repeat(40);
  const repo = 'repos/INFR-Organisation/videoclaw-lander';
  function inventoryFixture(problem?: string) {
    const requests: string[] = [];
    const input = { head: problem === 'stale-checkout' ? 'b'.repeat(40) : sha, branch: 'seo/founder-video-blog-launch', clean: problem !== 'dirty-checkout', localArticles: [], candidate: refined };
    const get = async (path: string) => {
      requests.push(path);
      if (path.startsWith(`${repo}/git/ref/heads/`)) return { object: { sha } };
      if (path.endsWith('/pulls/55')) return { state: 'open', merged: false };
      if (path.includes('/git/trees/')) return { truncated: problem === 'truncated-tree', tree: [] };
      if (path.includes('/pulls?')) return [{ number: 12, html_url: 'https://github.com/INFR-Organisation/videoclaw-lander/pull/12', body: '', head: { ref: 'editor/review' } }];
      if (path.includes('/pulls/12/files')) return problem === 'duplicate-pr' ? [{ filename: 'content/articles/demo-day-video-checklist.md', status: 'added', sha }] : [];
      if (path.includes('/git/blobs/')) return { encoding: 'base64', content: Buffer.from(`---\nid: vc-c2-001\nslug: demo-day-video-checklist\ntitle: Demo Day Video Checklist\nprimaryKeyword: demo day video checklist\n---\n`).toString('base64') };
      if (path === `${repo}/git/matching-refs/heads/`) return [{ ref: problem === 'reserved-branch' ? 'refs/heads/autoblog/2026-09-05-demo-day-video-checklist' : 'refs/heads/main' }];
      if (path.includes('VideoClaw-ICP/git/matching-refs/')) return problem === 'remote-state' ? [{ ref: 'refs/heads/autoblogger-state' }] : [];
      throw new Error(`Unexpected inventory path: ${path}`);
    };
    return { input, get, requests };
  }

  it('reads the immutable target tree, all PR files and branch/state reservations before allowing work', async () => {
    const f = inventoryFixture();
    const snapshot = await inspectLocalPilotInventory(f.input, f.get);
    expect(snapshot.baseSha).toBe(sha);
    expect(snapshot.branchRefs).toEqual(['main']);
    expect(f.requests).toContain(`${repo}/git/trees/${sha}?recursive=1`);
    expect(f.requests).toContain(`${repo}/pulls/12/files?per_page=100`);
    expect(f.requests).toContain('repos/frenzy2004/VideoClaw-ICP/git/matching-refs/heads/autoblogger-state');
  });

  it.each(['stale-checkout', 'dirty-checkout', 'truncated-tree', 'duplicate-pr', 'reserved-branch', 'remote-state'])('blocks %s without any fallback inventory', async (problem) => {
    const f = inventoryFixture(problem);
    await expect(inspectLocalPilotInventory(f.input, f.get)).rejects.toThrow();
  });
});
