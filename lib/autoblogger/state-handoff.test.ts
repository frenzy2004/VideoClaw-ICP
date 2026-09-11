// @vitest-environment node

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

import { createPersistentWorkerState, PersistentWorkerStateSchema } from './github-runtime';
import { createFileStateStore } from './local-state';
import { exportStateHandoff, parseStateHandoffArguments } from './state-handoff';
import { failedTenthAttemptFixture, successfulDiagnosticFixture } from './test-fixtures/diagnostic-history';

const timestamp = '2026-09-09T00:00:00.000Z';
const temporaryDirectories: string[] = [];
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const execute = promisify(execFile);

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) await rm(directory, { recursive: true, force: true });
});

async function fixture(content?: string) {
  const root = await mkdtemp(join(tmpdir(), 'autoblogger-handoff-test-'));
  temporaryDirectories.push(root);
  const statePath = join(root, 'source.json');
  const outputRoot = join(root, 'exports');
  if (content !== undefined) await writeFile(statePath, content, { mode: 0o600, flag: 'wx' });
  return { root, statePath, outputRoot, timestamp };
}

async function sourceSnapshot(path: string) {
  const metadata = await stat(path);
  return { bytes: await readFile(path), inode: metadata.ino, mode: metadata.mode, mtime: metadata.mtimeMs, ctime: metadata.ctimeMs };
}

describe('offline state handoff', () => {
  it('exports valid private state preserving every record, consumed pilot and attempt, with hashes of the exact bytes', async () => {
    const original = await successfulDiagnosticFixture();
    const input = await fixture(`\n${JSON.stringify(original, null, 2)}\n\n`);
    const before = await sourceSnapshot(input.statePath);

    const { directory, report } = await exportStateHandoff(input);

    expect(dirname(directory)).toBe(input.outputRoot);
    expect(await readdir(directory)).toEqual(['handoff-report.json', 'state.json']);
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    const exportedPath = join(directory, 'state.json');
    const reportPath = join(directory, 'handoff-report.json');
    for (const path of [exportedPath, reportPath]) expect((await stat(path)).mode & 0o777).toBe(0o600);
    const exportedBytes = await readFile(exportedPath);
    const exported = JSON.parse(exportedBytes.toString('utf8'));
    expect(PersistentWorkerStateSchema.safeParse(exported).success).toBe(true);
    expect((await createFileStateStore(exportedPath).load()).state).toEqual(exported);
    const { diagnosticRetirement, ...records } = exported;
    expect(records).toEqual(original);
    expect(exported.manualPilot).toMatchObject({ status: 'consumed', runId: 'successful-diagnostic-pilot', artifactHash: 'd'.repeat(64) });
    expect(exported.decisions[original.manualTargetSwitch!.candidateFingerprint].attempts).toBe(10);
    expect(diagnosticRetirement).toMatchObject({ schemaVersion: 1, retiredAt: timestamp, successfulRunId: 'successful-diagnostic-pilot' });
    expect(diagnosticRetirement.retainedRunIds.slice().sort()).toEqual(Object.keys(original.runs).sort());
    expect(report).toEqual({
      schemaVersion: 1, status: 'exported', originalSha256: sha256(before.bytes), exportedSha256: sha256(exportedBytes),
      consumedPilot: { runId: 'successful-diagnostic-pilot', artifactHash: 'd'.repeat(64) },
      runCount: 15, failureCount: 14, diagnosticRetirement,
    });
    const reportText = await readFile(reportPath, 'utf8');
    expect(reportText).toBe(`${JSON.stringify(report)}\n`);
    expect(await sourceSnapshot(input.statePath)).toEqual(before);
    expect(await readdir(input.root)).toEqual(['exports', 'source.json']);
  });

  it('gives repeated exports distinct directories and never overwrites an earlier export', async () => {
    const input = await fixture(JSON.stringify(await successfulDiagnosticFixture()));
    const first = await exportStateHandoff(input);
    const oldState = await sourceSnapshot(join(first.directory, 'state.json'));
    const oldReport = await sourceSnapshot(join(first.directory, 'handoff-report.json'));
    const second = await exportStateHandoff(input);
    expect(second.directory).not.toBe(first.directory);
    expect(await readdir(input.outputRoot)).toHaveLength(2);
    expect(await sourceSnapshot(join(first.directory, 'state.json'))).toEqual(oldState);
    expect(await sourceSnapshot(join(first.directory, 'handoff-report.json'))).toEqual(oldReport);
    expect(second.report).toEqual(first.report);
  });

  it.each(['missing', 'malformed', 'invalid', 'empty', 'failed', 'unconsumed', 'secret', 'escaped-secret', 'normalizing'])(
    'refuses %s input before creating any export or changing the source', async kind => {
      let content: string | undefined;
      if (kind === 'malformed') content = '{bad json';
      else if (kind === 'invalid') content = '{}';
      else if (kind === 'empty') content = JSON.stringify(createPersistentWorkerState());
      else if (kind === 'failed') content = JSON.stringify(failedTenthAttemptFixture());
      else if (kind !== 'missing') {
        const state = await successfulDiagnosticFixture();
        if (kind === 'unconsumed') state.manualPilot = { ...state.manualPilot!, status: 'prepared', consumedAt: null };
        if (kind === 'secret' || kind === 'escaped-secret') state.failures[0].detail = `Bearer ${'x'.repeat(24)}`;
        if (kind === 'normalizing') state.failures[0].detail = '  Whitespace must not silently change.  ';
        content = JSON.stringify(state);
        if (kind === 'escaped-secret') content = content.replace('Bearer', '\\u0042earer');
      }
      const input = await fixture(content);
      const before = content === undefined ? undefined : await sourceSnapshot(input.statePath);
      await expect(exportStateHandoff(input)).rejects.toThrow();
      expect(await readdir(input.root)).toEqual(content === undefined ? [] : ['source.json']);
      if (before) expect(await sourceSnapshot(input.statePath)).toEqual(before);
    },
  );

  it('uses the local loader to reject a symlink source and leaves its target untouched', async () => {
    const input = await fixture(JSON.stringify(await successfulDiagnosticFixture()));
    const before = await sourceSnapshot(input.statePath);
    const link = join(input.root, 'linked.json');
    await symlink(input.statePath, link);
    await expect(exportStateHandoff({ ...input, statePath: link })).rejects.toThrow(/regular file/i);
    expect(await readdir(input.root)).toEqual(['linked.json', 'source.json']);
    expect(await sourceSnapshot(input.statePath)).toEqual(before);
  });

  it('refuses a retirement timestamp before successful consumption without creating an export', async () => {
    const input = await fixture(JSON.stringify(await successfulDiagnosticFixture()));
    await expect(exportStateHandoff({ ...input, timestamp: '2026-09-08T05:00:00.000Z' })).rejects.toThrow(/predate/i);
    expect(await readdir(input.root)).toEqual(['source.json']);
  });
});

describe('handoff CLI', () => {
  it('requires explicit unambiguous state and output paths', () => {
    expect(parseStateHandoffArguments(['--output', 'exports', '--state', 'source.json'])).toEqual({ statePath: 'source.json', outputRoot: 'exports' });
    for (const argv of [[], ['--state', 'source.json'], ['--output', 'exports'], ['--state', '', '--output', 'exports'],
      ['--state', '--output', 'exports'], ['--state', 'source.json', '--output', 'exports', '--execute'],
      ['--state', 'one', '--state', 'two'], ['source.json', 'exports'],
      ['--state', 'source.json', '--output', 'exports', '--timestamp', timestamp]]) {
      expect(() => parseStateHandoffArguments(argv)).toThrow();
    }
  });

  it('runs offline using the current timestamp and emits only the compact report and directory', async () => {
    const input = await fixture(JSON.stringify(await successfulDiagnosticFixture()));
    const before = await sourceSnapshot(input.statePath);
    const started = Date.now();
    const { stdout, stderr } = await execute(process.execPath, ['--import', 'tsx', 'lib/autoblogger/state-handoff-entry.ts',
      '--state', input.statePath, '--output', input.outputRoot]);
    expect(stderr).toBe('');
    const output = JSON.parse(stdout);
    expect(output.status).toBe('exported');
    const report = JSON.parse(await readFile(join(output.directory, 'handoff-report.json'), 'utf8'));
    expect(output).toEqual({ directory: output.directory, ...report });
    const retiredAt = Date.parse(report.diagnosticRetirement.retiredAt);
    expect(retiredAt).toBeGreaterThanOrEqual(started);
    expect(retiredAt).toBeLessThanOrEqual(Date.now());
    expect(stdout).not.toMatch(/"(?:state|decisions|failures|manualPilot|manualTargetSwitch)":/);
    expect(await sourceSnapshot(input.statePath)).toEqual(before);
  });

  it.each(['missing', 'failed', 'secret', 'malformed'])('reports %s input failure without state, secrets or export', async kind => {
    const secret = `Bearer ${'x'.repeat(24)}`;
    let content: string | undefined;
    if (kind === 'failed') content = JSON.stringify(failedTenthAttemptFixture());
    if (kind === 'malformed') content = `{"DO_NOT_ECHO_SOURCE": ${secret}`;
    if (kind === 'secret') {
      const state = await successfulDiagnosticFixture();
      state.failures[0].detail = secret;
      content = JSON.stringify(state);
    }
    const input = await fixture(content);
    const result = await execute(process.execPath, ['--import', 'tsx', 'lib/autoblogger/state-handoff-entry.ts',
      '--state', input.statePath, '--output', input.outputRoot]).catch(error => error);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr).status).toBe('failed');
    expect(result.stderr).not.toContain(secret);
    expect(result.stderr).not.toContain('DO_NOT_ECHO_SOURCE');
    expect(result.stderr).not.toContain('Synthetic');
    expect(await readdir(input.root)).toEqual(content === undefined ? [] : ['source.json']);
  });
});
