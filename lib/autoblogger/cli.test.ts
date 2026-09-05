import { describe, expect, it } from 'vitest';

import {
  parseAutobloggerArguments,
  runAutobloggerCli,
  validateAutobloggerEnvironment,
} from './cli';

describe('autoblogger CLI contract', () => {
  it('parses only research, pilot, run, and validate with strict flags', () => {
    expect(parseAutobloggerArguments(['run', '--phase', 'prepare', '--run-id', 'gha-123', '--artifact-dir', 'artifacts/run']))
      .toEqual({ command: 'run', phase: 'prepare', maxDrafts: 1, runId: 'gha-123', artifactDir: 'artifacts/run' });
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
      LANDER_READ_TOKEN: 'github_pat_read_inventory_fixture_123456',
    };
    expect(validateAutobloggerEnvironment('pilot', base)).toMatchObject({ keywordProvider: 'pending' });
    expect(() => validateAutobloggerEnvironment('run', base)).toThrow(/Semrush or Ahrefs/i);
    expect(() => validateAutobloggerEnvironment('research', { ...base, APIFY_TOKEN: '' })).toThrow(/APIFY_TOKEN/);
    expect(() => validateAutobloggerEnvironment('run', {
      ...base,
      KEYWORD_PROVIDER: 'semrush',
      SEMRUSH_API_KEY: 'fixture-semrush',
      LANDER_BASE_REF: 'main',
    }, { phase: 'publish', preparedDir: 'prepared' })).toThrow(/LANDER_GITHUB_TOKEN/);
    expect(() => validateAutobloggerEnvironment('run', {
      ...base,
      KEYWORD_PROVIDER: 'semrush',
      SEMRUSH_API_KEY: 'fixture-semrush',
      GITHUB_EVENT_NAME: 'schedule',
      AUTOBLOG_SCHEDULE_ENABLED: 'false',
    })).toThrow(/disabled/i);
  });

  it('requires explicit run phases and rejects ambiguous or inapplicable publication flags', () => {
    expect(() => parseAutobloggerArguments(['run', '--run-id', 'r'])).toThrow(/phase/i);
    expect(parseAutobloggerArguments(['run', '--run-id', 'r', '--phase', 'publish', '--prepared-dir', 'prepared', '--max-drafts', '3']))
      .toMatchObject({ phase: 'publish', preparedDir: 'prepared', maxDrafts: 3 });
    for (const args of [
      ['run', '--run-id', 'r', '--phase', 'publish'],
      ['run', '--run-id', 'r', '--phase', 'prepare', '--prepared-dir', 'prepared'],
      ['run', '--run-id', 'r', '--phase', 'all'],
      ['run', '--run-id', 'r', '--phase', 'prepare', '--max-drafts', '4'],
      ['pilot', '--run-id', 'r', '--phase', 'publish'],
      ['research', '--run-id', 'r', '--max-drafts', '1'],
      ['validate', '--bundle', 'b', '--prepared-dir', 'p'],
    ]) expect(() => parseAutobloggerArguments(args)).toThrow();
  });

  it('requires neither OpenAI for research nor paid credentials for publishing', () => {
    const base = {
      APIFY_TOKEN: 'fixture-apify', KEYWORD_PROVIDER: 'pending', GITHUB_TOKEN: 'fixture-state',
      GITHUB_REPOSITORY: 'owner/icp', LANDER_REPOSITORY: '/tmp/fixture-lander', LANDER_OWNER: 'owner',
      LANDER_NAME: 'lander', LANDER_BASE_REF: 'main',
      LANDER_READ_TOKEN: 'github_pat_read_inventory_fixture_123456',
    };
    expect(validateAutobloggerEnvironment('research', base)).toMatchObject({ openaiApiKey: null, landerGitHubToken: null });
    const publication = { ...base, APIFY_TOKEN: undefined, LANDER_GITHUB_TOKEN: `ghs_${'fixture'.repeat(4)}`, LANDER_TOKEN_EXPIRES_AT: '2026-09-05T00:40:00.000Z' };
    expect(validateAutobloggerEnvironment('run', publication, { phase: 'publish', preparedDir: 'prepared' }))
      .toMatchObject({ phase: 'publish', apifyToken: null, openaiApiKey: null, keywordApiKey: null });
    expect(() => validateAutobloggerEnvironment('run', { ...publication, OPENAI_API_KEY: 'fixture-openai' }, { phase: 'publish', preparedDir: 'prepared' })).toThrow(/isolated/i);
    expect(() => validateAutobloggerEnvironment('research', { ...base, LANDER_GITHUB_TOKEN: publication.LANDER_GITHUB_TOKEN })).toThrow(/publication App token/i);
    expect(() => validateAutobloggerEnvironment('research', { ...base, LANDER_READ_TOKEN: undefined })).toThrow(/LANDER_READ_TOKEN/);
    expect(() => validateAutobloggerEnvironment('research', { ...base, LANDER_READ_TOKEN: base.GITHUB_TOKEN })).toThrow(/LANDER_READ_TOKEN/);
    expect(() => validateAutobloggerEnvironment('research', { ...base, GITHUB_TOKEN: base.LANDER_READ_TOKEN })).toThrow(/LANDER_READ_TOKEN/);
    expect(() => validateAutobloggerEnvironment('research', { ...base, LANDER_READ_TOKEN: publication.LANDER_GITHUB_TOKEN })).toThrow(/publication tokens/);
  });

  it('writes initialization and malformed argument failures through the same artifact boundary', async () => {
    for (const argv of [
      ['run', '--run-id', 'r', '--artifact-dir', 'artifacts/failure'],
      ['research', '--run-id', 'r', '--artifact-dir', 'artifacts/failure'],
      ['validate', '--bundle', 'b', '--artifact-dir', 'artifacts/failure'],
    ]) {
      const writes: Array<{ value: unknown; dir: string }> = [];
      expect(await runAutobloggerCli({
        argv, env: {}, createValidationRuntime: () => { throw new Error('validation config missing'); },
        io: { stdout: () => undefined, stderr: () => undefined, writeArtifacts: async (value, dir) => { writes.push({ value, dir }); } },
      })).toBe(1);
      expect(writes).toEqual([{ dir: 'artifacts/failure', value: expect.objectContaining({ status: 'failed' }) }]);
    }
  });

  it('finalizes the pilot only after durable artifacts, and writes redacted failure artifacts', async () => {
    const events: string[] = [];
    const report = { command: 'pilot', runId: 'p', mode: 'manual_pilot', status: 'validated', artifacts: [], failures: [] };
    const runtime = {
      execute: async () => report as never,
      validate: async () => undefined,
      finalizeArtifacts: async () => { events.push('finalize'); },
    };
    const writes: unknown[] = [];
    const invoke = (fail: boolean) => runAutobloggerCli({
      argv: ['pilot', '--run-id', 'p'], env: {}, runtime, skipEnvironmentValidationForTests: true,
      io: { stdout: () => events.push('stdout'), stderr: () => events.push('stderr'), writeArtifacts: async (value) => {
        writes.push(value); events.push('write'); if (fail) throw new Error('disk full');
      } },
    });
    expect(await invoke(false)).toBe(0);
    expect(events).toEqual(['write', 'finalize', 'stdout']);
    events.length = 0;
    expect(await invoke(true)).toBe(1);
    expect(events).not.toContain('finalize');
    expect(writes.at(-1)).toMatchObject({ status: 'failed', error: expect.stringContaining('disk full') });
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
        intentFingerprint: `intent:${'b'.repeat(64)}`,
        metrics: { schemaVersion: 1 as const, provider: 'pending' as const, observedAt: null, volume: null, difficulty: null, cpc: null, intent: 'informational' as const },
        keywordProvenance: { provider: 'pending' as const, endpoint: null, observedAt: null, providerRequestId: null, sourceObservedAt: null },
        serpProvenance: { actorId: 'serp', runId: 'run', datasetId: 'dataset', observedAt: '2026-09-05T00:00:00.000Z' },
        publicationOrigin: {
          candidate: { schemaVersion: 1 as const, articleId: 'vc-c1-101', campaignId: 'newly-funded-founder' as const, icp: 'founder launch video', primaryKeyword: 'founder launch video', secondaryKeywords: [], title: 'Founder Launch Video', slug: 'topic', intent: 'informational' as const, funnelStage: 'top' as const },
          evidence: { schemaVersion: 2 as const, candidateFingerprint: 'candidate:x', signals: { autocomplete: ['founder launch video'], peopleAlsoAsk: [], relatedSearches: [] }, serp: { organicResultCount: 2, peopleAlsoAsk: ['a', 'b', 'c'] }, sources: [{ originalUrl: 'https://a.example', finalUrl: 'https://a.example', authoritative: true }, { originalUrl: 'https://b.example', finalUrl: 'https://b.example', authoritative: false }], faqQuestions: ['a', 'b', 'c'] },
          provenance: { apifyRunId: 'run', apifyDatasetId: 'dataset', query: 'founder launch video', locale: 'en-US', capturedAt: '2026-09-05' },
          keywordProvenance: { provider: 'pending' as const, endpoint: null, observedAt: null, providerRequestId: null, sourceObservedAt: null },
          approvedMedia: { product: [], editorialGraphics: [] },
        },
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
