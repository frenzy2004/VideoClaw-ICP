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
      mode: 'scheduled',
      status: 'selected',
      runId: 'run-2026-09-04-a',
      updatedAt: '2026-09-04T00:00:00.000Z',
    });

    expect(selected.candidates[fingerprint]).toEqual({
      mode: 'scheduled',
      status: 'selected',
      runId: 'run-2026-09-04-a',
      updatedAt: '2026-09-04T00:00:00.000Z',
    });
    expect(transitionCandidateState(selected, {
      candidateFingerprint: fingerprint,
      mode: 'scheduled',
      status: 'selected',
      runId: 'run-2026-09-04-a',
      updatedAt: '2026-09-04T01:00:00.000Z',
    })).toEqual(selected);
  });

  it('refuses an illegal state jump', () => {
    expect(() => transitionCandidateState(createAutobloggerState(), {
      candidateFingerprint: fingerprint,
      mode: 'scheduled',
      status: 'drafted',
      runId: 'run-2026-09-04-a',
      updatedAt: '2026-09-04T00:00:00.000Z',
    })).toThrow(/Illegal state transition/);
  });

  it('refuses a manual-pilot transition to an opened pull request', () => {
    let state = createAutobloggerState();
    for (const status of ['selected', 'researched', 'drafted', 'validated'] as const) {
      state = transitionCandidateState(state, {
        candidateFingerprint: fingerprint,
        mode: 'manual_pilot',
        status,
        runId: 'run-2026-09-04-pilot',
        updatedAt: '2026-09-04T00:00:00.000Z',
      });
    }

    expect(() => transitionCandidateState(state, {
      candidateFingerprint: fingerprint,
      mode: 'manual_pilot',
      status: 'pr_opened',
      runId: 'run-2026-09-04-pilot',
      updatedAt: '2026-09-04T01:00:00.000Z',
    })).toThrow(/Manual pilot.*pull request/i);
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

  it('refuses to record a manual-pilot pull-request run', () => {
    expect(() => recordRun(createAutobloggerState(), {
      schemaVersion: 1,
      runId: 'run-2026-09-04-pilot-pr',
      mode: 'manual_pilot',
      startedAt: '2026-09-04T00:00:00.000Z',
      selectedCandidateFingerprints: [fingerprint],
      status: 'pr_opened',
    })).toThrow(/Manual pilot.*pull request/i);
  });
});
