import { describe, expect, it } from 'vitest';

import { CandidateSchema, candidateFingerprints, type Candidate } from './domain';
import { createPersistentWorkerState } from './github-runtime';
import {
  buildIncrementalQueue,
  consumePreparedManualPilot,
  markManualPilotPrepared,
  markCandidateFailure,
  markCandidateScanned,
  recoverExpiredReservations,
  reserveCandidate,
  reserveManualPilot,
} from './recovery';
import { createFileStateStore } from './local-state';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

function candidate(index: number): Candidate {
  return CandidateSchema.parse({
    schemaVersion: 1,
    articleId: `vc-c1-${String(index).padStart(3, '0')}`,
    campaignId: 'newly-funded-founder',
    icp: 'newly funded founder planning a founder video launch',
    primaryKeyword: `founder launch video plan ${index}`,
    secondaryKeywords: [],
    title: `Founder Launch Video Plan ${index}`,
    slug: `founder-launch-video-plan-${index}`,
    intent: 'informational',
    funnelStage: 'top',
  });
}

describe('bounded candidate recovery', () => {
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
