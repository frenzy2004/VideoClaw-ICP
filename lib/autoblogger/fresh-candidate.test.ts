import { describe, expect, it } from 'vitest';

import { CAMPAIGN_IDS, CandidateSchema, candidateFingerprints } from './domain';
import { compactPersistentWorkerState, createPersistentWorkerState, PersistentWorkerStateSchema,
  QUALITY_REVALIDATION_PRIOR_RUN, INTERRUPTION_PRIOR_RUN, QualityRevalidationEvidenceSchema } from './github-runtime';
import { consumePreparedManualPilot, grantManualFreshCandidate, grantManualRetryApproval, grantManualTargetSwitch, grantManualTargetRetry, markCandidateCompleted,
  markCandidateFailure, markCandidateScanned, markManualPilotPrepared, reserveCandidate, reserveManualPilot } from './recovery';

// Build synthetic history through the real authorization and failure transitions.
// Fixed evidence represents closed failures; no local artifacts or live state are used.
function failedTenthAttemptFixture() {
  let state = createPersistentWorkerState();
  const parked = CandidateSchema.parse({ schemaVersion: 1, articleId: 'vc-c2-001', campaignId: CAMPAIGN_IDS[1],
    icp: CAMPAIGN_IDS[1], primaryKeyword: 'synthetic demo day video', secondaryKeywords: [],
    title: 'Synthetic Demo Day Video', slug: 'synthetic-demo-day-video', intent: 'informational', funnelStage: 'top' });
  const target = CandidateSchema.parse({ ...parked, articleId: 'vc-c1-001', campaignId: CAMPAIGN_IDS[0], icp: CAMPAIGN_IDS[0],
    primaryKeyword: 'synthetic product video', title: 'Synthetic Product Video', slug: 'synthetic-product-video' });
  const fail = (candidate: typeof target, runId: string, at: string, code = 'candidate_failed', detail = 'Synthetic closed failure.') => {
    const fp = candidateFingerprints(candidate).candidate;
    state = reserveCandidate(state, candidate, runId, 'manual_pilot', at);
    state = markCandidateScanned(state, candidate, runId, at);
    state = markCandidateFailure(state, candidate, runId, code, true, at);
    state.runs[runId] = { schemaVersion: 1, runId, mode: 'manual_pilot', startedAt: at, selectedCandidateFingerprints: [fp], status: 'failed' };
    state.failures.push({ runId, candidateFingerprint: fp, attempt: state.decisions[fp].attempts, code, observedAt: at, detail });
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    fail(parked, `parked-failure-${attempt}`, `2026-09-05T0${attempt}:00:00.000Z`);
  }
  state = grantManualRetryApproval(state, parked, { priorRunId: 'parked-failure-3', runId: 'parked-unused-retry',
    reason: 'user_authorized_after_input_fix', approvedAt: '2026-09-05T04:00:00.000Z' });
  state = grantManualTargetSwitch(state, target, { parkedRetryRunId: 'parked-unused-retry', runId: 'target-failure-1', approvedAt: '2026-09-06T01:00:00.000Z' });
  let priorRunId = 'target-failure-1';
  for (let attempt = 1; attempt <= 10; attempt++) {
    const at = `2026-09-06T${String(attempt).padStart(2, '0')}:00:00.000Z`;
    const runId = attempt === 8 ? QUALITY_REVALIDATION_PRIOR_RUN : attempt === 9 ? INTERRUPTION_PRIOR_RUN : `target-failure-${attempt}`;
    if (attempt > 1) {
      const prior = state.failures.at(-1)!;
      const evidence = { priorRunId, candidateFingerprint: candidateFingerprints(target).candidate, articleId: target.articleId,
        reportStartedAt: state.runs[priorRunId].startedAt, reportCompletedAt: prior.observedAt, auditCompletedAt: prior.observedAt,
        reportHash: 'a'.repeat(64), auditHash: 'b'.repeat(64), implementationHash: 'c'.repeat(64) };
      const input: Parameters<typeof grantManualTargetRetry>[2] = { priorRunId, runId, approvedAt: at };
      if (attempt === 4) input.extraAttempt = true;
      if (attempt === 5) input.sourcePlanRetry = true;
      if (attempt === 6) input.reviewRepairRetry = true;
      if (attempt === 7) input.scopeAlignmentRetry = true;
      if (attempt === 8) { input.engineeringResume = true; input.engineeringResumeEvidence = evidence; }
      if (attempt >= 9) {
        input.qualityRevalidation = true;
        input.qualityRevalidationEvidence = QualityRevalidationEvidenceSchema.parse({ ...evidence,
          priorRunId: attempt === 9 ? QUALITY_REVALIDATION_PRIOR_RUN : INTERRUPTION_PRIOR_RUN, failureDetail: prior.detail });
      }
      state = grantManualTargetRetry(state, target, input);
    }
    const detail = attempt === 8 ? 'Error: Draft blocked: content_safety_failed (content.unsupported_claim).'
      : attempt === 9 ? 'Error: OpenAI structured generation failed: Error: HTTP request timed out after 240000ms.' : 'Synthetic closed failure.';
    fail(target, runId, at, attempt === 7 ? 'deep_inspection_failed' : 'candidate_failed', detail);
    priorRunId = runId;
  }
  return PersistentWorkerStateSchema.parse(state);
}

describe('fresh authorization over a sealed synthetic tenth-attempt audit', () => {
  it.each(['success', 'failure'])('preserves all historical grants and attempts through %s', async outcome => {
    const history = failedTenthAttemptFixture();
    const original = structuredClone(history);
    const old = history.manualTargetSwitch!;
    expect(history.decisions[old.candidateFingerprint].attempts).toBe(10);
    const candidate = CandidateSchema.parse({ schemaVersion: 1, articleId: 'vc-c4-999', campaignId: CAMPAIGN_IDS[3],
      icp: CAMPAIGN_IDS[3], primaryKeyword: 'fresh authorization fixture video evidence', secondaryKeywords: [],
      title: 'Fresh Authorization Fixture Video Evidence', slug: 'fresh-authorization-fixture-video-evidence', intent: 'informational', funnelStage: 'top' });
    const fp = candidateFingerprints(candidate).candidate;
    const runId = 'fresh-authorization-fixture';
    const at = '2026-09-08T06:00:00.000Z';
    let state = grantManualFreshCandidate(history, candidate, { runId, approvedAt: at });
    state = reserveCandidate(reserveManualPilot(state, runId, at), candidate, runId, 'manual_pilot', at);
    state = markCandidateScanned(state, candidate, runId, at);
    state = outcome === 'success' ? markCandidateCompleted(state, candidate, runId, 'artifact_prepared', at)
      : markCandidateFailure(state, candidate, runId, 'candidate_failed', true, at);
    state.runs[runId] = { schemaVersion: 1, runId, mode: 'manual_pilot', startedAt: at, selectedCandidateFingerprints: [fp], status: outcome === 'success' ? 'validated' : 'failed' };
    if (outcome === 'success') {
      state.contentHashes[fp] = 'd'.repeat(64);
      state = markManualPilotPrepared(state, runId, 'd'.repeat(64), at);
      await consumePreparedManualPilot({ load: async () => ({ state, version: 'v1' }), save: async next => {
        state = compactPersistentWorkerState(next); return { version: 'v2' };
      } }, runId, 'd'.repeat(64), at);
      expect(state.manualPilot?.status).toBe('consumed');
      const unrelated = structuredClone(state);
      unrelated.runs.unrelated = { ...state.runs[runId], runId: 'unrelated' };
      expect(PersistentWorkerStateSchema.safeParse(unrelated).success).toBe(false);
    } else {
      state.manualPilot = null;
      state.failures.push({ runId, candidateFingerprint: fp, attempt: 1, code: 'candidate_failed', observedAt: at, detail: 'New topic failed once.' });
    }
    const compacted = compactPersistentWorkerState(state);
    expect(compacted.decisions[fp]).toMatchObject({ attempts: 1, status: outcome === 'success' ? 'completed' : 'terminal' });
    expect(compacted.manualRetryApproval).toEqual(history.manualRetryApproval);
    expect(compacted.manualTargetSwitch).toEqual(history.manualTargetSwitch);
    expect(compacted.decisions).toMatchObject(history.decisions);
    expect(compacted.runs).toMatchObject(history.runs);
    expect(compacted.failures.slice(0, history.failures.length)).toEqual(history.failures);
    expect(() => grantManualTargetRetry({ ...compacted, manualPilot: null }, old.candidate, {
      priorRunId: old.retry!.runId, runId: 'forbidden-eleventh', approvedAt: at })).toThrow();
    expect(history).toEqual(original);
  });
});
