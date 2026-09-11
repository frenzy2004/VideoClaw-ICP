import { describe, expect, it } from 'vitest';

import { CAMPAIGN_IDS, CandidateSchema, candidateFingerprints } from './domain';
import { compactPersistentWorkerState, PersistentWorkerStateSchema } from './github-runtime';
import { consumePreparedManualPilot, grantManualFreshCandidate, grantManualTargetRetry, markCandidateCompleted,
  markCandidateFailure, markCandidateScanned, markManualPilotPrepared, reserveCandidate, reserveManualPilot } from './recovery';

import { failedTenthAttemptFixture } from './test-fixtures/diagnostic-history';

describe('fresh authorization over a sealed synthetic tenth-attempt audit', () => {
  it.each(['success', 'failure', 'successor-success', 'successor-failure'])('preserves all historical grants and attempts through %s', async scenario => {
    const outcome = scenario.endsWith('success') ? 'success' : 'failure';
    let history = failedTenthAttemptFixture();
    if (scenario.startsWith('successor')) {
      const prior = CandidateSchema.parse({ ...history.manualTargetSwitch!.candidate, articleId: 'vc-c1-998',
        primaryKeyword: 'synthetic webinar reuse', title: 'Synthetic Webinar Reuse', slug: 'synthetic-webinar-reuse' });
      const priorAt = '2026-09-08T05:00:00.000Z';
      history = grantManualFreshCandidate(history, prior, { runId: 'failed-fresh-predecessor', approvedAt: priorAt });
      history = reserveCandidate(history, prior, 'failed-fresh-predecessor', 'manual_pilot', priorAt);
      history = markCandidateFailure(history, prior, 'failed-fresh-predecessor', 'candidate_failed', true, priorAt);
      const priorFp = candidateFingerprints(prior).candidate;
      history.runs['failed-fresh-predecessor'] = { schemaVersion: 1, runId: 'failed-fresh-predecessor', mode: 'manual_pilot',
        startedAt: priorAt, selectedCandidateFingerprints: [priorFp], status: 'failed' };
      history.failures.push({ runId: 'failed-fresh-predecessor', candidateFingerprint: priorFp, attempt: 1,
        code: 'candidate_failed', observedAt: priorAt, detail: 'Synthetic predecessor failed once.' });
    }
    const original = structuredClone(history);
    const old = history.manualTargetSwitch!;
    expect(history.decisions[old.candidateFingerprint].attempts).toBe(10);
    const candidate = CandidateSchema.parse({ schemaVersion: 1, articleId: 'vc-c4-999', campaignId: CAMPAIGN_IDS[3],
      icp: CAMPAIGN_IDS[3], primaryKeyword: 'fresh authorization fixture video evidence', secondaryKeywords: [],
      title: 'Fresh Authorization Fixture Video Evidence', slug: 'fresh-authorization-fixture-video-evidence', intent: 'informational', funnelStage: 'top' });
    const fp = candidateFingerprints(candidate).candidate;
    const runId = 'fresh-authorization-fixture';
    const at = '2026-09-08T06:00:00.000Z';
    let state = grantManualFreshCandidate(history, candidate, { runId, approvedAt: at,
      ...(scenario.startsWith('successor') ? { previousFreshRunId: 'failed-fresh-predecessor' } : {}) });
    if (!scenario.startsWith('successor')) {
      expect(state).not.toHaveProperty('manualFreshCandidateHistory');
      expect(state.manualFreshCandidateApproval).not.toHaveProperty('priorFreshApprovalHash');
    }
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
