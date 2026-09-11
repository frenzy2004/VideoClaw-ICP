import { CAMPAIGN_IDS, CandidateSchema, candidateFingerprints } from '../domain';
import { compactPersistentWorkerState, createPersistentWorkerState, PersistentWorkerStateSchema, QUALITY_REVALIDATION_PRIOR_RUN, INTERRUPTION_PRIOR_RUN, QualityRevalidationEvidenceSchema } from '../github-runtime';
import { consumePreparedManualPilot, grantManualFreshCandidate, grantManualRetryApproval, grantManualTargetSwitch, grantManualTargetRetry, markCandidateCompleted, markCandidateFailure, markCandidateScanned, markManualPilotPrepared, reserveCandidate, reserveManualPilot } from '../recovery';

// Build synthetic history through the real authorization and failure transitions.
// Fixed evidence represents closed failures; no local artifacts or live state are used.
export function failedTenthAttemptFixture() {
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

export async function successfulDiagnosticFixture() {
  let state = failedTenthAttemptFixture();
  const predecessor = CandidateSchema.parse({ ...state.manualTargetSwitch!.candidate, articleId: 'vc-c4-997', campaignId: CAMPAIGN_IDS[3],
    icp: CAMPAIGN_IDS[3], primaryKeyword: 'synthetic podcast edit', title: 'Synthetic Podcast Edit', slug: 'synthetic-podcast-edit' });
  const firstAt = '2026-09-08T05:00:00.000Z';
  state = grantManualFreshCandidate(state, predecessor, { runId: 'failed-fresh-predecessor', approvedAt: firstAt });
  state = reserveCandidate(state, predecessor, 'failed-fresh-predecessor', 'manual_pilot', firstAt);
  state = markCandidateFailure(state, predecessor, 'failed-fresh-predecessor', 'candidate_failed', true, firstAt);
  const previousFp = candidateFingerprints(predecessor).candidate;
  state.runs['failed-fresh-predecessor'] = { schemaVersion: 1, runId: 'failed-fresh-predecessor', mode: 'manual_pilot',
    startedAt: firstAt, selectedCandidateFingerprints: [previousFp], status: 'failed' };
  state.failures.push({ runId: 'failed-fresh-predecessor', candidateFingerprint: previousFp, attempt: 1,
    code: 'candidate_failed', observedAt: firstAt, detail: 'Synthetic failed first attempt.' });
  const candidate = CandidateSchema.parse({ ...predecessor, articleId: 'vc-c4-998', primaryKeyword: 'synthetic webinar clips',
    title: 'Synthetic Webinar Clips', slug: 'synthetic-webinar-clips' });
  const at = '2026-09-08T06:00:00.000Z', runId = 'successful-diagnostic-pilot';
  state = grantManualFreshCandidate(state, candidate, { runId, approvedAt: at, previousFreshRunId: 'failed-fresh-predecessor' });
  state = reserveCandidate(reserveManualPilot(state, runId, at), candidate, runId, 'manual_pilot', at);
  state = markCandidateScanned(state, candidate, runId, at);
  state = markCandidateCompleted(state, candidate, runId, 'artifact_prepared', at);
  const fp = candidateFingerprints(candidate).candidate;
  state.runs[runId] = { schemaVersion: 1, runId, mode: 'manual_pilot', startedAt: at, selectedCandidateFingerprints: [fp], status: 'validated' };
  state.contentHashes[fp] = 'd'.repeat(64);
  state = markManualPilotPrepared(state, runId, 'd'.repeat(64), at);
  await consumePreparedManualPilot({ load: async () => ({ state, version: 'v1' }), save: async next => {
    state = compactPersistentWorkerState(next); return { version: 'v2' };
  } }, runId, 'd'.repeat(64), at);
  return state;
}
