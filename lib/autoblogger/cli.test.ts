import { describe, expect, it } from 'vitest';

import {
  parseAutobloggerArguments,
  runAutobloggerCli,
  validateAutobloggerEnvironment,
} from './cli';

describe('autoblogger CLI contract', () => {
  it('parses only research, pilot, run, and validate with strict flags', () => {
    expect(parseAutobloggerArguments(['run', '--run-id', 'gha-123', '--artifact-dir', 'artifacts/run']))
      .toEqual({ command: 'run', runId: 'gha-123', artifactDir: 'artifacts/run' });
    expect(parseAutobloggerArguments(['validate', '--bundle', 'bundle.json', '--artifact-dir', 'artifacts/validate']))
      .toEqual({ command: 'validate', bundlePath: 'bundle.json', artifactDir: 'artifacts/validate' });
    expect(() => parseAutobloggerArguments(['publish'])).toThrow(/command/i);
    expect(() => parseAutobloggerArguments(['run', '--run-id', 'x', '--unknown', 'y'])).toThrow(/unknown/i);
    expect(() => parseAutobloggerArguments(['pilot'])).toThrow(/run-id/i);
  });

  it('fails closed on missing providers, keys, scheduled activation, and cross-repo app auth', () => {
    const base = {
      APIFY_TOKEN: 'fixture-apify-token',
      GITHUB_TOKEN: 'fixture-state-token',
      GITHUB_REPOSITORY: 'frenzy2004/VideoClaw-ICP',
      LANDER_REPOSITORY: 'https://github.com/INFR-Organisation/videoclaw-lander.git',
      LANDER_OWNER: 'INFR-Organisation',
      LANDER_NAME: 'videoclaw-lander',
      LANDER_BASE_REF: 'seo/founder-video-blog-launch',
      KEYWORD_PROVIDER: 'pending',
      OPENAI_API_KEY: 'fixture-openai-key',
    };
    expect(validateAutobloggerEnvironment('pilot', base)).toMatchObject({ keywordProvider: 'pending' });
    expect(() => validateAutobloggerEnvironment('run', base)).toThrow(/Semrush or Ahrefs/i);
    expect(() => validateAutobloggerEnvironment('research', { ...base, APIFY_TOKEN: '' })).toThrow(/APIFY_TOKEN/);
    expect(() => validateAutobloggerEnvironment('run', {
      ...base,
      KEYWORD_PROVIDER: 'semrush',
      SEMRUSH_API_KEY: 'fixture-semrush',
      LANDER_BASE_REF: 'main',
    })).toThrow(/LANDER_GITHUB_TOKEN/);
    expect(() => validateAutobloggerEnvironment('run', {
      ...base,
      KEYWORD_PROVIDER: 'semrush',
      SEMRUSH_API_KEY: 'fixture-semrush',
      GITHUB_EVENT_NAME: 'schedule',
      AUTOBLOG_SCHEDULE_ENABLED: 'false',
    })).toThrow(/disabled/i);
  });

  it('writes artifacts separately and emits only a redacted machine-readable summary', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const artifacts: unknown[] = [];
    const report = {
      schemaVersion: 1 as const,
      command: 'pilot' as const,
      runId: 'pilot-1',
      mode: 'manual_pilot' as const,
      status: 'validated' as const,
      startedAt: '2026-09-05T00:00:00.000Z',
      completedAt: '2026-09-05T00:01:00.000Z',
      limits: { maxCandidatesScanned: 50, maxDeepInspections: 10, maxDrafts: 3, maxDraftsPerIcp: 2, manualPilotDrafts: 1 } as const,
      counts: { queued: 50, scanned: 50, shallowValidated: 50, metricsEnriched: 50, deepInspected: 10, eligible: 3, drafted: 1, validated: 1, pullRequestsOpened: 0 },
      artifacts: [{
        bundle: { schemaVersion: 1 as const, candidateFingerprint: 'candidate:x', article: { slug: 'topic' }, markdown: 'article body', svg: '<svg/>' },
        validation: {
          status: 'passed' as const,
          cleanup: 'completed' as const,
          bundleHash: 'a'.repeat(64),
          landerRef: 'feature',
          commands: [{ label: 'build', exitCode: 0, stdout: 'large', stderr: '', durationMs: 1, timedOut: false }],
        },
        articleId: 'vc-c1-101', slug: 'topic', icp: 'founder', candidateFingerprint: 'candidate:x', publication: 'artifact_only' as const,
      }],
      failures: [],
    };
    const exit = await runAutobloggerCli({
      argv: ['pilot', '--run-id', 'pilot-1', '--artifact-dir', 'artifacts/pilot-1'],
      env: {},
      io: {
        stdout: (line) => stdout.push(line),
        stderr: (line) => stderr.push(line),
        writeArtifacts: async (value) => { artifacts.push(value); },
      },
      runtime: {
        execute: async () => report,
        validate: async () => { throw new Error('not used'); },
      },
      skipEnvironmentValidationForTests: true,
    });
    expect(exit).toBe(0);
    expect(artifacts).toEqual([report]);
    expect(stdout).toHaveLength(1);
    expect(JSON.parse(stdout[0])).toMatchObject({ runId: 'pilot-1', status: 'validated', artifacts: [{ slug: 'topic' }] });
    expect(stdout[0]).not.toContain('article body');
    expect(stdout[0]).not.toContain('<svg');
    expect(stderr).toEqual([]);

    const secret = 'apify_api_synthetic_cli_fixture_123456';
    const failed = await runAutobloggerCli({
      argv: ['research', '--run-id', 'failed-1'],
      env: {},
      io: { stdout: () => undefined, stderr: (line) => stderr.push(line), writeArtifacts: async () => undefined },
      runtime: { execute: async () => { throw new Error(`failure ${secret}`); }, validate: async () => undefined },
      skipEnvironmentValidationForTests: true,
    });
    expect(failed).toBe(1);
    expect(stderr.at(-1)).toContain('[REDACTED]');
    expect(stderr.at(-1)).not.toContain(secret);
  });
});
