import { describe, expect, it } from 'vitest';
import { successfulDiagnosticFixture, failedTenthAttemptFixture } from './test-fixtures/diagnostic-history';
import { CandidateSchema, candidateFingerprints } from './domain';
import { compactPersistentWorkerState, PersistentWorkerStateSchema, retireDiagnosticHistory } from './github-runtime';
import { reserveCandidate, reserveManualPilot, buildIncrementalQueue } from './recovery';

const at = '2026-09-09T00:00:00.000Z';
const nextCandidate = CandidateSchema.parse({ schemaVersion: 1, articleId: 'vc-c4-999', campaignId: 'gtm-content-repurposing-buyer',
  icp: 'gtm-content-repurposing-buyer', primaryKeyword: 'new founder interview workflow', secondaryKeywords: [],
  title: 'New Founder Interview Workflow', slug: 'new-founder-interview-workflow', intent: 'informational', funnelStage: 'middle' });

describe('retiring diagnostic execution authority without retiring its history', () => {
  it('preserves the complete successful state and allows an unrelated scheduled reservation', async () => {
    const before = await successfulDiagnosticFixture();
    const original = structuredClone(before);
    let retired: typeof before;
    expect(() => { retired = retireDiagnosticHistory(before, at); }).not.toThrow();
    expect(before).toEqual(original);
    const { diagnosticRetirement, ...records } = retired!;
    expect(records).toEqual(original);
    expect(diagnosticRetirement?.successfulRunId).toBe('successful-diagnostic-pilot');
    const next = reserveCandidate(retired!, nextCandidate, 'scheduled-next', 'scheduled', at);
    expect(next.decisions[candidateFingerprints(nextCandidate).candidate]).toMatchObject({ attempts: 1, status: 'leased', runId: 'scheduled-next' });
    expect(next.manualTargetSwitch).toEqual(original.manualTargetSwitch);
    expect(PersistentWorkerStateSchema.safeParse(next).success).toBe(true);
  });

  it('does not create another pilot or reopen any historical topic', async () => {
    const before = await successfulDiagnosticFixture();
    const retired = retireDiagnosticHistory(before, at);
    expect(() => reserveManualPilot(retired, 'another-pilot', at)).toThrow();
    const old = [retired.manualTargetSwitch!.candidate, retired.manualFreshCandidateApproval!.candidate,
      ...retired.manualFreshCandidateHistory!.map(item => item.approval.candidate)];
    for (const candidate of old) expect(() => reserveCandidate(retired, candidate, 'forbidden-retry', 'scheduled', at)).toThrow();
    const queue = buildIncrementalQueue({ state: retired, backlog: [...old, nextCandidate], inventory: [], now: at, runId: 'scheduled-next', mode: 'scheduled' });
    expect(queue.all.map(item => item.articleId)).toEqual(['vc-c4-999']);
  });

  it('refuses failed, unacknowledged or backdated retirement', async () => {
    expect(() => retireDiagnosticHistory(failedTenthAttemptFixture(), at)).toThrow(/consumed successful pilot/);
    const success = await successfulDiagnosticFixture();
    expect(() => retireDiagnosticHistory(success, '2026-09-08T05:00:00.000Z')).toThrow(/retirement.*predate/i);
    expect(() => retireDiagnosticHistory({ ...success, manualPilot: { ...success.manualPilot!, status: 'prepared', consumedAt: null } }, at)).toThrow(/consumed successful pilot/);
  });

  it('screens aliases of a retired pre-scan failure before reserving or researching them', async () => {
    const retired = retireDiagnosticHistory(await successfulDiagnosticFixture(), at);
    const old = retired.manualFreshCandidateHistory![0].approval.candidate;
    const alias = { ...nextCandidate, slug: old.slug };
    const queue = buildIncrementalQueue({ state: retired, backlog: [alias, nextCandidate], inventory: [], now: at, runId: 'next', mode: 'scheduled' });
    expect(queue.all).toEqual([nextCandidate]);
    expect(queue.state.decisions).toEqual(retired.decisions);
  });

  it.each(['pilot', 'failed-attempts', 'failed-run', 'failure-detail', 'artifact-hash', 'retirement-hash'])('rejects changed sealed %s', async field => {
    const retired = retireDiagnosticHistory(await successfulDiagnosticFixture(), at);
    const changed = structuredClone(retired);
    if (field === 'pilot') changed.manualPilot = null;
    if (field === 'failed-attempts') changed.decisions[changed.manualTargetSwitch!.candidateFingerprint].attempts = 2;
    if (field === 'failed-run') delete changed.runs['target-failure-1'];
    if (field === 'failure-detail') changed.failures[0].detail = 'Changed history';
    if (field === 'artifact-hash') changed.contentHashes[candidateFingerprints(changed.manualFreshCandidateApproval!.candidate).candidate] = 'e'.repeat(64);
    if (field === 'retirement-hash') changed.diagnosticRetirement!.historySha256 = '0'.repeat(64);
    expect(PersistentWorkerStateSchema.safeParse(changed).success).toBe(false);
  });

  it('pins historical records through ordinary run and failure compaction', async () => {
    const retired = retireDiagnosticHistory(await successfulDiagnosticFixture(), at);
    const crowded = structuredClone(retired);
    for (let i = 0; i < 510; i++) {
      crowded.runs[`future-${i}`] = { schemaVersion: 1, runId: `future-${i}`, mode: 'scheduled', startedAt: at, status: 'failed', selectedCandidateFingerprints: [] };
      if (i < 100) crowded.failures.push({ runId: `future-${i}`, code: 'no_eligible_opportunities', attempt: 1, observedAt: at, detail: 'Ordinary failure.' });
    }
    const compacted = compactPersistentWorkerState(crowded);
    expect(Object.keys(compacted.runs)).toHaveLength(500);
    expect(compacted.failures).toHaveLength(100);
    expect(compacted.runs).toMatchObject(retired.runs);
    expect(compacted.failures.slice(0, retired.failures.length)).toEqual(retired.failures);
    expect(compacted.diagnosticRetirement).toEqual(retired.diagnosticRetirement);
    expect(compactPersistentWorkerState(compacted)).toEqual(compacted);
  });
});
