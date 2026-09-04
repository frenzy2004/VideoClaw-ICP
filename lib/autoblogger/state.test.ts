import { describe, expect, it } from 'vitest';
import { type RunRecord } from './domain';
import {
  createAutobloggerState,
  recordRun,
  transitionCandidateState,
} from './state';

const fingerprint = 'candidate:accelerator-demo-day-founder:demo day video planning checklist';

describe('compact persistent autoblogger state', () => {
  it('advances legal candidate states and makes a repeated event idempotent', () => {
    const initial = createAutobloggerState();
    const selected = transitionCandidateState(initial, {
      candidateFingerprint: fingerprint,
      status: 'selected',
      runId: 'run-2026-09-04-a',
      updatedAt: '2026-09-04T00:00:00.000Z',
    });

    expect(selected.candidates[fingerprint]).toEqual({
      status: 'selected',
      runId: 'run-2026-09-04-a',
      updatedAt: '2026-09-04T00:00:00.000Z',
    });
    expect(transitionCandidateState(selected, {
      candidateFingerprint: fingerprint,
      status: 'selected',
      runId: 'run-2026-09-04-a',
      updatedAt: '2026-09-04T01:00:00.000Z',
    })).toEqual(selected);
  });

  it('refuses an illegal state jump', () => {
    expect(() => transitionCandidateState(createAutobloggerState(), {
      candidateFingerprint: fingerprint,
      status: 'drafted',
      runId: 'run-2026-09-04-a',
      updatedAt: '2026-09-04T00:00:00.000Z',
    })).toThrow(/Illegal state transition/);
  });

  it('records the same run idempotently but refuses a changed rerun record', () => {
    const run: RunRecord = {
      schemaVersion: 1,
      runId: 'run-2026-09-04-a',
      mode: 'manual_pilot',
      startedAt: '2026-09-04T00:00:00.000Z',
      selectedCandidateFingerprints: [fingerprint],
      status: 'selected',
    };
    const recorded = recordRun(createAutobloggerState(), run);

    expect(recordRun(recorded, run)).toEqual(recorded);
    expect(() => recordRun(recorded, { ...run, status: 'drafted' })).toThrow(/Run id collision/);
  });
});
