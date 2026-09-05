import { z } from 'zod';
import { RunRecordSchema, type RunRecord } from './domain';

export const CandidateStateSchema = z.object({
  mode: z.enum(['manual_pilot', 'scheduled']),
  status: z.enum(['selected', 'researched', 'drafted', 'validated', 'pr_opened', 'failed']),
  runId: z.string().trim().min(1),
  updatedAt: z.string().datetime(),
}).strict();

export const AutobloggerStateSchema = z.object({
  schemaVersion: z.literal(1),
  candidates: z.record(z.string(), CandidateStateSchema),
  runs: z.record(z.string(), RunRecordSchema),
}).strict();

export type AutobloggerState = z.infer<typeof AutobloggerStateSchema>;
export type CandidateState = z.infer<typeof CandidateStateSchema>;

const NEXT_STATES: Record<CandidateState['status'] | 'discovered', CandidateState['status'][]> = {
  discovered: ['selected', 'failed'],
  selected: ['researched', 'failed'],
  researched: ['drafted', 'failed'],
  drafted: ['validated', 'failed'],
  validated: ['pr_opened', 'failed'],
  pr_opened: [],
  failed: [],
};

export function createAutobloggerState(): AutobloggerState {
  return { schemaVersion: 1, candidates: {}, runs: {} };
}

export function transitionCandidateState(
  state: AutobloggerState,
  next: CandidateState & { candidateFingerprint: string },
): AutobloggerState {
  const current = state.candidates[next.candidateFingerprint];
  if (current && current.mode !== next.mode) {
    throw new Error(`Candidate run mode cannot change from ${current.mode} to ${next.mode}.`);
  }
  if (next.mode === 'manual_pilot' && next.status === 'pr_opened') {
    throw new Error('Manual pilot runs cannot open a pull request.');
  }
  if (current?.status === next.status) return state;

  const currentStatus = current?.status ?? 'discovered';
  if (!NEXT_STATES[currentStatus].includes(next.status)) {
    throw new Error(`Illegal state transition from ${currentStatus} to ${next.status}.`);
  }

  return AutobloggerStateSchema.parse({
    ...state,
    candidates: {
      ...state.candidates,
      [next.candidateFingerprint]: {
        mode: next.mode,
        status: next.status,
        runId: next.runId,
        updatedAt: next.updatedAt,
      },
    },
  });
}

export function recordRun(state: AutobloggerState, run: RunRecord): AutobloggerState {
  const parsedRun = RunRecordSchema.parse(run);
  if (parsedRun.mode === 'manual_pilot' && parsedRun.status === 'pr_opened') {
    throw new Error('Manual pilot runs cannot open a pull request.');
  }
  const existing = state.runs[parsedRun.runId];
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(parsedRun)) return state;
    throw new Error(`Run id collision for ${parsedRun.runId}.`);
  }
  return AutobloggerStateSchema.parse({
    ...state,
    runs: { ...state.runs, [parsedRun.runId]: parsedRun },
  });
}
