// @vitest-environment node

import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { PersistentWorkerStateSchema, retireDiagnosticHistory } from './github-runtime';
import { createFileStateStore } from './local-state';
import { successfulDiagnosticFixture } from './test-fixtures/diagnostic-history';

const retiredAt = '2026-09-09T00:00:00.000Z';
const futureAt = '2026-09-10T00:00:00.000Z';
const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function temporaryStore() {
  const directory = await mkdtemp(join(tmpdir(), 'autoblogger-local-retirement-'));
  temporaryDirectories.push(directory);
  const path = join(directory, 'state.json');
  return { directory, path, store: createFileStateStore(path) };
}

describe('local state diagnostic retirement continuity', () => {
  it.each(['removal', 'retirement-time replacement', 'resealed-history replacement'] as const)(
    'rejects schema-valid marker %s even with the matching CAS version, without writing',
    async change => {
      const { directory, path, store } = await temporaryStore();
      const beforeRetirement = await successfulDiagnosticFixture();
      const retired = retireDiagnosticHistory(beforeRetirement, retiredAt);
      await store.save(retired, null);
      const current = await store.load();
      const bytes = await readFile(path);

      let rollback = structuredClone(beforeRetirement);
      if (change === 'retirement-time replacement') {
        rollback = retireDiagnosticHistory(rollback, futureAt);
      } else if (change === 'resealed-history replacement') {
        rollback.runs['added-historical-run'] = {
          schemaVersion: 1, runId: 'added-historical-run', mode: 'scheduled',
          startedAt: retiredAt, selectedCandidateFingerprints: [], status: 'failed',
        };
        rollback = retireDiagnosticHistory(rollback, retiredAt);
      }
      // The incoming state is valid on its own; only stored continuity forbids it.
      expect(PersistentWorkerStateSchema.safeParse(rollback).success).toBe(true);
      expect(rollback.diagnosticRetirement).not.toEqual(current.state.diagnosticRetirement);
      expect(current.version).not.toBeNull();

      await expect(store.save(rollback, current.version)).rejects.toThrow(/diagnostic retirement/i);

      expect(await readFile(path)).toEqual(bytes);
      expect(await store.load()).toEqual(current);
      expect(await readdir(directory)).toEqual(['state.json']);
    },
  );

  it('allows initial retirement and future state saves with the same parsed marker', async () => {
    const { path, store } = await temporaryStore();
    const initial = await store.save(await successfulDiagnosticFixture(), null);
    const beforeRetirement = await store.load();
    const retired = retireDiagnosticHistory(beforeRetirement.state, retiredAt);
    const retirementSave = await store.save(retired, initial.version);
    expect(retirementSave.version).not.toBe(initial.version);
    const current = await store.load();
    const marker = current.state.diagnosticRetirement!;
    expect(marker).toEqual(retired.diagnosticRetirement);
    const next = structuredClone(current.state);
    // Property insertion order must not turn an identical parsed marker into a replacement.
    next.diagnosticRetirement = {
      historySha256: marker.historySha256, retainedRunIds: [...marker.retainedRunIds],
      retiredAt: marker.retiredAt, successfulRunId: marker.successfulRunId, schemaVersion: 1,
    };
    next.runs['scheduled-after-retirement'] = {
      schemaVersion: 1, runId: 'scheduled-after-retirement', mode: 'scheduled',
      startedAt: futureAt, selectedCandidateFingerprints: [], status: 'failed',
    };
    next.failures.push({
      runId: 'scheduled-after-retirement', code: 'no_eligible_opportunities',
      attempt: 1, observedAt: futureAt, detail: 'No eligible candidates in this future run.',
    });

    const saved = await store.save(next, current.version);
    const loaded = await createFileStateStore(path).load();

    expect(saved.version).not.toBe(current.version);
    expect(loaded.version).toBe(saved.version);
    expect(loaded.state).toEqual(next);
    expect(loaded.state.diagnosticRetirement).toEqual(marker);
  });
});
