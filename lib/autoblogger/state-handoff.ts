import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { retireDiagnosticHistory, type PersistentWorkerState } from './github-runtime';
import { createFileStateStore } from './local-state';
import { containsSecretLikeValue } from './secrets';

type HandoffPaths = { statePath: string; outputRoot: string };
type HandoffReport = {
  schemaVersion: 1;
  status: 'exported';
  originalSha256: string;
  exportedSha256: string;
  consumedPilot: { runId: string; artifactHash: string };
  runCount: number;
  failureCount: number;
  diagnosticRetirement: NonNullable<PersistentWorkerState['diagnosticRetirement']>;
};

export function parseStateHandoffArguments(argv: string[]): HandoffPaths {
  const usage = 'Usage: autoblog:handoff --state <file> --output <directory>';
  if (argv.length !== 4) throw new Error(usage);
  const options = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i], value = argv[i + 1];
    if (!['--state', '--output'].includes(flag) || options.has(flag) || !value?.trim() || value.startsWith('--')) {
      throw new Error(usage);
    }
    options.set(flag, value);
  }
  return { statePath: options.get('--state')!, outputRoot: options.get('--output')! };
}

async function writePrivateFile(path: string, content: string): Promise<void> {
  const file = await open(path, 'wx', 0o600);
  try {
    await file.chmod(0o600);
    await file.writeFile(content, 'utf8');
  } finally {
    await file.close();
  }
}

/** Prepare a local copy only; never save to the source store or invoke remote services. */
export async function exportStateHandoff(input: HandoffPaths & { timestamp: string }): Promise<{ directory: string; report: HandoffReport }> {
  if (!input.statePath.trim() || !input.outputRoot.trim() || containsSecretLikeValue([input.statePath, input.outputRoot])) {
    throw new Error('Explicit local state and output paths without secret-like values are required.');
  }
  const statePath = resolve(input.statePath);
  const { state, version } = await createFileStateStore(statePath).load();
  if (version === null) throw new Error('State handoff requires an existing local state file.');
  const originalBytes = await readFile(statePath);
  const originalSha256 = createHash('sha256').update(originalBytes).digest('hex');
  if (originalSha256 !== version) throw new Error('Local state changed while preparing handoff.');
  if (containsSecretLikeValue(state)) throw new Error('Local state contains a secret-like value.');
  // Refuse schema normalization so all exported records retain their original values.
  if (!isDeepStrictEqual(JSON.parse(originalBytes.toString('utf8')), state)) {
    throw new Error('Local state requires normalization; handoff must preserve every record.');
  }
  const pilot = state.manualPilot;
  if (pilot?.status !== 'consumed' || !pilot.consumedAt || !pilot.artifactHash || state.runs[pilot.runId]?.status !== 'validated') {
    throw new Error('State handoff requires a consumed successful pilot.');
  }
  const retired = retireDiagnosticHistory(state, input.timestamp);
  const content = `${JSON.stringify(retired)}\n`;
  const report: HandoffReport = {
    schemaVersion: 1, status: 'exported', originalSha256,
    exportedSha256: createHash('sha256').update(content).digest('hex'),
    consumedPilot: { runId: pilot.runId, artifactHash: pilot.artifactHash },
    runCount: Object.keys(state.runs).length, failureCount: state.failures.length,
    diagnosticRetirement: retired.diagnosticRetirement!,
  };
  const outputRoot = resolve(input.outputRoot);
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(outputRoot, 'handoff-'));
  try {
    await chmod(directory, 0o700);
    await writePrivateFile(join(directory, 'state.json'), content);
    await writePrivateFile(join(directory, 'handoff-report.json'), `${JSON.stringify(report)}\n`);
    return { directory, report };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
