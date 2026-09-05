import { describe, expect, it } from 'vitest';

import { CAMPAIGN_IDS, CandidateSchema, candidateFingerprints, type Candidate } from './domain';
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
