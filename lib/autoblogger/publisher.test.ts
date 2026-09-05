// @vitest-environment node

import { execFile } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import type { DraftBundle } from './domain';
import {
  createProcessCommandBoundary,
  createPublisher,
  type CommandBoundary,
  type CommandRequest,
  type CommandResult,
  type GitHubPublisherBoundary,
  type GitHubTargetSnapshot,
  type PreparedCommit,
} from './publisher';

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

async function runGit(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}

async function createLanderRepository(lockfile: 'npm' | 'pnpm' = 'npm') {
  const root = await mkdtemp(join(tmpdir(), 'autoblogger-publisher-source-'));
  temporaryDirectories.push(root);
  await mkdir(join(root, 'content/articles'), { recursive: true });
  await mkdir(join(root, 'public/media/blog'), { recursive: true });
  await mkdir(join(root, 'public/landing/full'), { recursive: true });
  await writeFile(join(root, 'public/landing/full/founder-product.mp4'), 'video fixture');
  await writeFile(join(root, 'public/landing/full/founder-product.jpg'), 'poster fixture');
  await writeFile(join(root, 'package.json'), JSON.stringify({
    name: 'fixture-lander',
    private: true,
    ...(lockfile === 'pnpm' ? { packageManager: 'pnpm@10.0.0' } : {}),
    scripts: { 'check:blog': 'fixture', lint: 'fixture', build: 'fixture' },
  }));
  await writeFile(join(root, lockfile === 'npm' ? 'package-lock.json' : 'pnpm-lock.yaml'), '{}\n');
  await writeFile(join(root, '.gitignore'), 'node_modules\n.next\n');
  await runGit(root, ['init', '-b', 'main']);
  await runGit(root, ['config', 'user.name', 'Fixture']);
  await runGit(root, ['config', 'user.email', 'fixture@example.com']);
  await runGit(root, ['add', '.']);
  await runGit(root, ['commit', '-m', 'fixture lander']);
  return root;
}

function bundleFixture(overrides: Partial<DraftBundle> = {}): DraftBundle {
  return {
    schemaVersion: 1,
    candidateFingerprint: 'candidate:accelerator-demo-day-founder:founder pitch video workflow',
    article: {
      id: 'vc-c2-051',
      campaign: 'accelerator-demo-day-founder',
      icp: 'US startup founder preparing for Demo Day',
      primaryKeyword: 'founder pitch video workflow',
      searchIntent: 'informational',
      title: 'Founder Pitch Video Workflow',
      slug: 'founder-pitch-video-workflow',
      canonicalPath: '/blog/founder-pitch-video-workflow',
      competitorGap: 'Current results omit an evidence-led video workflow.',
      provenance: {
        apifyRunId: 'run_fixture_004',
        apifyDatasetId: 'dataset_fixture_004',
        query: 'founder pitch video workflow',
        locale: 'en-US',
        capturedAt: '2026-09-05',
      },
      sources: [
        { label: 'Y Combinator', url: 'https://www.ycombinator.com/video/', checkedAt: '2026-09-05' },
        { label: 'FTC', url: 'https://www.ftc.gov/business-guidance/', checkedAt: '2026-09-05' },
      ],
      productMedia: {
        src: '/landing/full/founder-product.mp4',
        poster: '/landing/full/founder-product.jpg',
        alt: 'Founder product demonstration',
        caption: 'VideoClaw product media',
        width: 1280,
        height: 720,
      },
      editorialGraphic: {
        src: '/media/blog/founder-pitch-video-workflow.svg',
        alt: 'Founder pitch video workflow',
        width: 1200,
        height: 675,
      },
      cta: { label: 'Download the desktop app', href: '/download' },
      status: 'review',
      approvals: { copy: false, factual: false, legal: false, visual: false },
      createdAt: '2026-09-05',
      updatedAt: '2026-09-05',
      searchMetrics: { volume: 120, keywordDifficulty: 22, cpc: 4.5 },
    },
    markdown: '---\nid: "vc-c2-051"\n---\n\nDirect answer.\n',
    svg: '<svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg"><text>Workflow</text></svg>',
    ...overrides,
  };
}

class FixtureCommandBoundary implements CommandBoundary {
  readonly requests: CommandRequest[] = [];
  readonly observedFiles: Array<{ markdown: string; svg: string; remotes: string }> = [];
  private readonly process = createProcessCommandBoundary();

  constructor(private readonly outcomes: Partial<Record<string, CommandResult | Error>> = {}) {}

  async run(request: CommandRequest): Promise<CommandResult> {
    this.requests.push(structuredClone(request));
    if (request.command === 'git') return this.process.run(request);
    if (request.label === 'check:blog') {
      this.observedFiles.push({
        markdown: await readFile(join(request.cwd, 'content/articles/founder-pitch-video-workflow.md'), 'utf8'),
        svg: await readFile(join(request.cwd, 'public/media/blog/founder-pitch-video-workflow.svg'), 'utf8'),
        remotes: (await execFileAsync('git', ['remote'], { cwd: request.cwd })).stdout.trim(),
      });
    }
    const outcome = this.outcomes[request.label];
    if (outcome instanceof Error) throw outcome;
    if (outcome) return structuredClone(outcome);
    return { exitCode: 0, stdout: `${request.label} passed`, stderr: '', durationMs: 2, timedOut: false };
  }
}

const readySnapshot: GitHubTargetSnapshot = {
  baseRef: 'main',
  baseSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  blogLaunch: {
    pullRequestNumber: 55,
    state: 'merged',
    baseRef: 'main',
    mergeCommitIncludedInBase: true,
  },
  branchRefs: [],
  existingArticles: [],
  openPullRequests: [],
};

class FixtureGitHubBoundary implements GitHubPublisherBoundary {
  readonly calls: string[] = [];
  readonly branches = new Set<string>();
  readonly pullRequests: Array<{ number: number; url: string; headRef: string; bundleHash: string }> = [];
  prepared?: PreparedCommit;
  failAt?: 'prepare' | 'branch' | 'pull_request';
  invalidPreparedSha = false;
  invalidPullRequestResponse = false;

  constructor(readonly snapshot: GitHubTargetSnapshot = structuredClone(readySnapshot)) {}

  async inspectTarget(): Promise<GitHubTargetSnapshot> {
    this.calls.push('inspect');
    return structuredClone(this.snapshot);
  }

  async prepareCommit(input: PreparedCommit): Promise<{ commitSha: string }> {
    this.calls.push('prepare');
    if (this.failAt === 'prepare') throw new Error('prepare failed');
    this.prepared = structuredClone(input);
    return { commitSha: this.invalidPreparedSha ? '../invalid' : 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' };
  }

  async createBranch(input: { headRef: string }): Promise<void> {
    this.calls.push('branch');
    if (this.failAt === 'branch') throw new Error('branch failed');
    this.branches.add(input.headRef);
  }

  async createDraftPullRequest(input: {
    headRef: string;
    bundleHash: string;
  }): Promise<{ number: number; url: string }> {
    this.calls.push('pull_request');
    if (this.failAt === 'pull_request') throw new Error('pull request failed');
    if (this.invalidPullRequestResponse) return { number: 0, url: 'javascript:invalid' };
    const pullRequest = { number: 91, url: 'https://github.test/pull/91', headRef: input.headRef, bundleHash: input.bundleHash };
    this.pullRequests.push(pullRequest);
    return pullRequest;
  }

  async findOpenPullRequestByHead(input: { headRef: string }) {
    this.calls.push('find_pull_request');
    return this.pullRequests.find(({ headRef }) => headRef === input.headRef) ?? null;
  }

  async deleteBranch(input: { headRef: string }): Promise<void> {
    this.calls.push('delete_branch');
    this.branches.delete(input.headRef);
  }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Publisher.validateBundle', () => {
  it('rejects unsafe repository identities and refs before executing a command', async () => {
    const source = await createLanderRepository();
    const command = new FixtureCommandBoundary();
    expect(() => createPublisher({
      lander: { repository: source, ref: '../main', owner: 'INFR-Organisation', name: 'videoclaw-lander' },
      command,
    })).toThrow(/ref/i);
    expect(() => createPublisher({
      lander: { repository: source, ref: 'main', owner: '../INFR-Organisation', name: 'videoclaw-lander' },
      command,
    })).toThrow(/owner|repository identity/i);
    expect(command.requests).toEqual([]);
  });

  it('validates one immutable bundle in a disposable clone without changing the configured source checkout', async () => {
    const source = await createLanderRepository();
    await writeFile(join(source, 'local-uncommitted-note.txt'), 'must remain untouched');
    const beforeHead = (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: source })).stdout.trim();
    const beforeStatus = (await execFileAsync('git', ['status', '--porcelain'], { cwd: source })).stdout;
    const command = new FixtureCommandBoundary();
    const frozenBundle = Object.freeze(bundleFixture());
    const publisher = createPublisher({
      lander: { repository: source, ref: 'main', owner: 'INFR-Organisation', name: 'videoclaw-lander' },
      command,
    });

    const report = await publisher.validateBundle(frozenBundle);

    expect(report).toMatchObject({ status: 'passed', cleanup: 'completed', packageManager: 'npm' });
    expect(report.articlePath).toBe('content/articles/founder-pitch-video-workflow.md');
    expect(report.svgPath).toBe('public/media/blog/founder-pitch-video-workflow.svg');
    expect(report.commands.map(({ label, exitCode }) => [label, exitCode])).toEqual([
      ['clone', 0],
      ['checkout', 0],
      ['isolate-checkout', 0],
      ['install', 0],
      ['check:blog', 0],
      ['lint', 0],
      ['build', 0],
      ['workspace-integrity', 0],
    ]);
    expect(command.observedFiles).toEqual([{ markdown: frozenBundle.markdown, svg: frozenBundle.svg, remotes: '' }]);
    expect((await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: source })).stdout.trim()).toBe(beforeHead);
    expect((await execFileAsync('git', ['status', '--porcelain'], { cwd: source })).stdout).toBe(beforeStatus);
    expect(report).not.toHaveProperty('temporaryCheckout');
  });

  it('chooses the frozen install command from the target repository package manager', async () => {
    const source = await createLanderRepository('pnpm');
    const command = new FixtureCommandBoundary();
    const publisher = createPublisher({
      lander: { repository: source, ref: 'main', owner: 'INFR-Organisation', name: 'videoclaw-lander' },
      command,
    });

    const report = await publisher.validateBundle(bundleFixture());

    expect(report.status).toBe('passed');
    expect(report.packageManager).toBe('pnpm');
    expect(command.requests.find(({ label }) => label === 'install')).toMatchObject({
      command: 'pnpm',
      args: ['install', '--frozen-lockfile'],
    });
  });

  it('fails before install when declared product media is unavailable', async () => {
    const source = await createLanderRepository();
    const bundle = bundleFixture();
    bundle.article = {
      ...(bundle.article as Record<string, unknown>),
      productMedia: {
        ...((bundle.article as Record<string, unknown>).productMedia as Record<string, unknown>),
        src: '/landing/full/missing-product.mp4',
      },
    };
    const command = new FixtureCommandBoundary();
    const publisher = createPublisher({
      lander: { repository: source, ref: 'main', owner: 'INFR-Organisation', name: 'videoclaw-lander' },
      command,
    });

    const report = await publisher.validateBundle(bundle);

    expect(report).toMatchObject({ status: 'failed', cleanup: 'completed' });
    expect(report.failure).toMatch(/ENOENT|media/i);
    expect(command.requests.some(({ label }) => label === 'install')).toBe(false);
  });

  it('refuses a symlinked article directory without writing outside the temporary checkout', async () => {
    const source = await createLanderRepository();
    const outside = await mkdtemp(join(tmpdir(), 'autoblogger-publisher-outside-'));
    temporaryDirectories.push(outside);
    await rm(join(source, 'content/articles'), { recursive: true });
    await symlink(outside, join(source, 'content/articles'), 'dir');
    await runGit(source, ['add', '-A']);
    await runGit(source, ['commit', '-m', 'symlinked article directory fixture']);
    const command = new FixtureCommandBoundary();
    const publisher = createPublisher({
      lander: { repository: source, ref: 'main', owner: 'INFR-Organisation', name: 'videoclaw-lander' },
      command,
    });

    const report = await publisher.validateBundle(bundleFixture());

    expect(report.status).toBe('failed');
    await expect(access(join(outside, 'founder-pitch-video-workflow.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(command.requests.some(({ label }) => label === 'install')).toBe(false);
  });

  it('redacts and bounds command failures, reports timeout, and removes the disposable checkout', async () => {
    const source = await createLanderRepository();
    const secret = 'ghs_syntheticvalidationsecret123456789';
    const command = new FixtureCommandBoundary({
      lint: {
        exitCode: null,
        stdout: 'x'.repeat(500),
        stderr: `timed out with ${secret}`,
        durationMs: 999,
        timedOut: true,
      },
    });
    const publisher = createPublisher({
      lander: { repository: source, ref: 'main', owner: 'INFR-Organisation', name: 'videoclaw-lander' },
      command,
      reportOutputLimit: 120,
    });

    const report = await publisher.validateBundle(bundleFixture());
    const lint = report.commands.find(({ label }) => label === 'lint');
    const checkout = command.requests.find(({ label }) => label === 'lint')?.cwd;

    expect(report).toMatchObject({ status: 'failed', cleanup: 'completed' });
    expect(lint).toMatchObject({ exitCode: null, timedOut: true });
    expect(lint?.stdout.length).toBeLessThanOrEqual(120);
    expect(lint?.stderr).not.toContain(secret);
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(checkout).toBeTruthy();
    await expect(access(checkout as string)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(command.requests.some(({ label }) => label === 'build')).toBe(false);
  });

  it('turns a thrown command-boundary error into a redacted structured command report', async () => {
    const source = await createLanderRepository();
    const secret = 'apify_api_syntheticcommandfailure123456789';
    const command = new FixtureCommandBoundary({ install: new Error(`install rejected ${secret}`) });
    const publisher = createPublisher({
      lander: { repository: source, ref: 'main', owner: 'INFR-Organisation', name: 'videoclaw-lander' },
      command,
    });

    const report = await publisher.validateBundle(bundleFixture());

    expect(report).toMatchObject({ status: 'failed', cleanup: 'completed' });
    expect(report.commands.at(-1)).toMatchObject({ label: 'install', exitCode: null, timedOut: false });
    expect(report.commands.at(-1)?.stderr).toContain('[REDACTED]');
    expect(JSON.stringify(report)).not.toContain(secret);
  });

  it('does not expose worker credentials to a spawned lander command', async () => {
    const variableName = 'AUTOBLOGGER_FIXTURE_API_TOKEN';
    const previous = process.env[variableName];
    process.env[variableName] = 'synthetic-worker-secret';
    try {
      const boundary = createProcessCommandBoundary();
      const result = await boundary.run({
        label: 'environment-check',
        command: process.execPath,
        args: ['-e', `process.stdout.write(process.env.${variableName} ?? 'absent')`],
        cwd: process.cwd(),
        timeoutMs: 5_000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('absent');
    } finally {
      if (previous === undefined) delete process.env[variableName];
      else process.env[variableName] = previous;
    }
  });
});

describe('Publisher.openDraftPullRequest', () => {
  async function setup(
    ref = 'main',
    github = new FixtureGitHubBoundary(),
    bundle = bundleFixture(),
  ) {
    const source = await createLanderRepository();
    if (ref !== 'main') await runGit(source, ['branch', ref, 'main']);
    const command = new FixtureCommandBoundary();
    const publisher = createPublisher({
      lander: { repository: source, ref, owner: 'INFR-Organisation', name: 'videoclaw-lander' },
      command,
      github,
      now: () => new Date('2026-09-05T04:00:00.000Z'),
    });
    const validation = await publisher.validateBundle(bundle);
    expect(validation.status).toBe('passed');
    return { publisher, bundle, validation, github };
  }

  const auth = {
    kind: 'github_app_installation' as const,
    token: 'ghs_fixture_installation_token_123456789',
    expiresAt: '2026-09-05T04:45:00.000Z',
  };
  const paidKeywordMetrics = {
    schemaVersion: 1 as const,
    provider: 'semrush' as const,
    observedAt: '2026-09-05T03:45:00.000Z',
    volume: 120,
    difficulty: 22,
    cpc: 4.5,
    intent: 'informational' as const,
  };
  const pendingKeywordMetrics = {
    schemaVersion: 1 as const,
    provider: 'pending' as const,
    observedAt: null,
    volume: null,
    difficulty: null,
    cpc: null,
    intent: 'informational' as const,
  };

  it('keeps output artifact-only before the blog launch is merged into main', async () => {
    const feature = await setup('seo/founder-video-blog-launch');
    const result = await feature.publisher.openDraftPullRequest({
      bundle: feature.bundle,
      validation: feature.validation,
      mode: 'scheduled',
      keywordMetrics: paidKeywordMetrics,
      auth,
    });

    expect(result).toEqual({ status: 'artifact_only', reason: 'lander_base_not_ready' });
    expect(feature.github.calls).toEqual([]);

    const snapshot = structuredClone(readySnapshot);
    snapshot.blogLaunch.state = 'open';
    snapshot.blogLaunch.mergeCommitIncludedInBase = false;
    const unmerged = await setup('main', new FixtureGitHubBoundary(snapshot));
    const unmergedResult = await unmerged.publisher.openDraftPullRequest({
      bundle: unmerged.bundle,
      validation: unmerged.validation,
      mode: 'scheduled',
      keywordMetrics: paidKeywordMetrics,
      auth,
    });
    expect(unmergedResult).toEqual({ status: 'artifact_only', reason: 'blog_launch_not_merged_into_main' });
    expect(unmerged.github.calls).toEqual(['inspect']);
  });

  it('requires explicit short-lived GitHub App installation authentication', async () => {
    const fixture = await setup();
    const result = await fixture.publisher.openDraftPullRequest({
      bundle: fixture.bundle,
      validation: fixture.validation,
      mode: 'scheduled',
      keywordMetrics: paidKeywordMetrics,
    });

    expect(result).toEqual({ status: 'blocked', reason: 'github_app_auth_required' });
    expect(fixture.github.calls).toEqual([]);
  });

  it('refuses the normal Actions GITHUB_TOKEN even if it is mislabeled as installation auth', async () => {
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = auth.token;
    try {
      const fixture = await setup();
      const result = await fixture.publisher.openDraftPullRequest({
        bundle: fixture.bundle,
        validation: fixture.validation,
        mode: 'scheduled',
        keywordMetrics: paidKeywordMetrics,
        auth,
      });

      expect(result).toEqual({ status: 'blocked', reason: 'github_app_auth_required' });
      expect(fixture.github.calls).toEqual([]);
    } finally {
      if (previous === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previous;
    }
  });

  it('keeps the pending-metrics manual pilot artifact-only', async () => {
    const bundle = bundleFixture();
    bundle.article = {
      ...(bundle.article as Record<string, unknown>),
      searchMetrics: {
        volume: 'provider-pending',
        keywordDifficulty: 'provider-pending',
        cpc: 'provider-pending',
      },
    };
    const fixture = await setup('main', new FixtureGitHubBoundary(), bundle);

    const result = await fixture.publisher.openDraftPullRequest({
      bundle,
      validation: fixture.validation,
      mode: 'manual_pilot',
      keywordMetrics: pendingKeywordMetrics,
      auth,
    });

    expect(result).toEqual({ status: 'artifact_only', reason: 'manual_pilot_cannot_publish' });
    expect(fixture.github.calls).toEqual([]);
  });

  it('opens one draft PR from a prepared commit with traceability outside public prose', async () => {
    const fixture = await setup();
    const result = await fixture.publisher.openDraftPullRequest({
      bundle: Object.freeze(fixture.bundle),
      validation: fixture.validation,
      mode: 'scheduled',
      keywordMetrics: paidKeywordMetrics,
      auth,
    });

    expect(result).toEqual({
      status: 'opened',
      number: 91,
      url: 'https://github.test/pull/91',
      headRef: 'autoblog/2026-09-05-founder-pitch-video-workflow',
    });
    expect(fixture.github.calls).toEqual(['inspect', 'prepare', 'branch', 'pull_request']);
    expect(fixture.github.prepared).toMatchObject({
      baseSha: readySnapshot.baseSha,
      files: [
        { path: 'content/articles/founder-pitch-video-workflow.md', content: fixture.bundle.markdown },
        { path: 'public/media/blog/founder-pitch-video-workflow.svg', content: fixture.bundle.svg },
      ],
    });
    expect(fixture.github.prepared?.pullRequest.title).toBe('Review: Founder Pitch Video Workflow');
    expect(fixture.github.prepared?.pullRequest.draft).toBe(true);
    expect(fixture.github.prepared?.pullRequest.body).toContain('US startup founder preparing for Demo Day');
    expect(fixture.github.prepared?.pullRequest.body).toContain('run_fixture_004');
    expect(fixture.github.prepared?.pullRequest.body).toContain('dataset_fixture_004');
    expect(fixture.github.prepared?.pullRequest.body).toContain('Volume: 120');
    expect(fixture.github.prepared?.pullRequest.body).toContain('Keyword difficulty: 22');
    expect(fixture.github.prepared?.pullRequest.body).toContain('Keyword provider: semrush');
    expect(fixture.github.prepared?.pullRequest.body).toContain('Metrics observed: 2026-09-05T03:45:00.000Z');
    expect(fixture.github.prepared?.pullRequest.body).toContain('Current results omit an evidence-led video workflow.');
    expect(fixture.github.prepared?.pullRequest.body).toContain('https://www.ycombinator.com/video/');
    expect(fixture.github.prepared?.pullRequest.body).toContain('/landing/full/founder-product.mp4');
    expect(fixture.github.prepared?.pullRequest.body).not.toContain('Direct answer.');
    expect(fixture.github.branches).toEqual(new Set(['autoblog/2026-09-05-founder-pitch-video-workflow']));
    expect(fixture.github.pullRequests).toHaveLength(1);
  });

  it('rolls back its branch when commit publication or PR creation fails', async () => {
    for (const failAt of ['prepare', 'branch', 'pull_request'] as const) {
      const github = new FixtureGitHubBoundary();
      github.failAt = failAt;
      const fixture = await setup('main', github);
      const result = await fixture.publisher.openDraftPullRequest({
        bundle: fixture.bundle,
        validation: fixture.validation,
        mode: 'scheduled',
        keywordMetrics: paidKeywordMetrics,
        auth,
      });

      expect(result).toMatchObject({ status: 'blocked', reason: 'github_operation_failed' });
      expect(github.branches.size).toBe(0);
      expect(github.pullRequests).toHaveLength(0);
    }
  });

  it('rejects malformed commit and pull-request responses without leaving a branch or PR', async () => {
    for (const malformed of ['commit', 'pull_request'] as const) {
      const github = new FixtureGitHubBoundary();
      if (malformed === 'commit') github.invalidPreparedSha = true;
      else github.invalidPullRequestResponse = true;
      const fixture = await setup('main', github);

      const result = await fixture.publisher.openDraftPullRequest({
        bundle: fixture.bundle,
        validation: fixture.validation,
        mode: 'scheduled',
        keywordMetrics: paidKeywordMetrics,
        auth,
      });

      expect(result).toMatchObject({ status: 'blocked', reason: 'github_operation_failed' });
      expect(github.branches.size).toBe(0);
      expect(github.pullRequests).toHaveLength(0);
    }
  });

  it('blocks duplicates before preparing a commit and treats an exact open PR as an idempotent rerun', async () => {
    const duplicateSnapshot = structuredClone(readySnapshot);
    duplicateSnapshot.existingArticles.push({ slug: 'founder-pitch-video-workflow' });
    const duplicate = await setup('main', new FixtureGitHubBoundary(duplicateSnapshot));
    await expect(duplicate.publisher.openDraftPullRequest({
      bundle: duplicate.bundle,
      validation: duplicate.validation,
      mode: 'scheduled',
      keywordMetrics: paidKeywordMetrics,
      auth,
    })).resolves.toEqual({ status: 'blocked', reason: 'duplicate_target' });
    expect(duplicate.github.calls).toEqual(['inspect']);

    const rerun = await setup();
    rerun.github.snapshot.branchRefs.push('autoblog/2026-09-05-founder-pitch-video-workflow');
    rerun.github.snapshot.openPullRequests.push({
      number: 89,
      url: 'https://github.test/pull/89',
      headRef: 'autoblog/2026-09-05-founder-pitch-video-workflow',
      bundleHash: rerun.validation.bundleHash,
    });
    await expect(rerun.publisher.openDraftPullRequest({
      bundle: rerun.bundle,
      validation: rerun.validation,
      mode: 'scheduled',
      keywordMetrics: paidKeywordMetrics,
      auth,
    })).resolves.toEqual({
      status: 'already_exists',
      number: 89,
      url: 'https://github.test/pull/89',
      headRef: 'autoblog/2026-09-05-founder-pitch-video-workflow',
    });
    expect(rerun.github.calls).toEqual(['inspect']);
  });

  it.each([
    ['published status', { status: 'published' }],
    ['an approval enabled', { approvals: { copy: true, factual: false, legal: false, visual: false } }],
    ['publishedAt', { publishedAt: '2026-09-05' }],
    ['an unsupported CTA', { cta: { label: 'Contact sales', href: '/contact' } }],
    ['pending scheduled metrics', { searchMetrics: { volume: 'provider-pending', keywordDifficulty: 'provider-pending', cpc: 'provider-pending' } }],
  ])('revalidates and blocks %s even after a successful native validation', async (_label, articlePatch) => {
    const bundle = bundleFixture();
    bundle.article = { ...(bundle.article as Record<string, unknown>), ...articlePatch };
    const fixture = await setup('main', new FixtureGitHubBoundary(), bundle);

    const result = await fixture.publisher.openDraftPullRequest({
      bundle,
      validation: fixture.validation,
      mode: 'scheduled',
      keywordMetrics: paidKeywordMetrics,
      auth,
    });

    expect(result).toMatchObject({ status: 'blocked', reason: 'publication_gate_failed' });
    expect(fixture.github.calls).toEqual([]);
  });

  it('rejects a validation report for a different bundle without any GitHub side effect', async () => {
    const fixture = await setup();
    const changed = bundleFixture({ markdown: `${fixture.bundle.markdown}\nChanged.` });

    const result = await fixture.publisher.openDraftPullRequest({
      bundle: changed,
      validation: fixture.validation,
      mode: 'scheduled',
      keywordMetrics: paidKeywordMetrics,
      auth,
    });

    expect(result).toMatchObject({ status: 'blocked', reason: 'publication_gate_failed' });
    expect(fixture.github.calls).toEqual([]);
  });

  it('rejects paid metrics that do not match the validated article frontmatter', async () => {
    const fixture = await setup();
    const result = await fixture.publisher.openDraftPullRequest({
      bundle: fixture.bundle,
      validation: fixture.validation,
      mode: 'scheduled',
      keywordMetrics: { ...paidKeywordMetrics, volume: 999 },
      auth,
    });

    expect(result).toMatchObject({ status: 'blocked', reason: 'publication_gate_failed' });
    expect(fixture.github.calls).toEqual([]);
  });

  it('rejects a structurally valid report produced by another publisher instance', async () => {
    const source = await createLanderRepository();
    const first = createPublisher({
      lander: { repository: source, ref: 'main', owner: 'INFR-Organisation', name: 'videoclaw-lander' },
      command: new FixtureCommandBoundary(),
    });
    const bundle = bundleFixture();
    const foreignReport = await first.validateBundle(bundle);
    expect(foreignReport.status).toBe('passed');
    const github = new FixtureGitHubBoundary();
    const second = createPublisher({
      lander: { repository: source, ref: 'main', owner: 'INFR-Organisation', name: 'videoclaw-lander' },
      command: new FixtureCommandBoundary(),
      github,
      now: () => new Date('2026-09-05T04:00:00.000Z'),
    });

    const result = await second.openDraftPullRequest({
      bundle,
      validation: foreignReport,
      mode: 'scheduled',
      keywordMetrics: paidKeywordMetrics,
      auth,
    });

    expect(result).toMatchObject({ status: 'blocked', reason: 'publication_gate_failed' });
    expect(github.calls).toEqual([]);
  });

  it('fails closed when GitHub returns a malformed target snapshot', async () => {
    const malformed = structuredClone(readySnapshot);
    malformed.baseSha = '';
    const fixture = await setup('main', new FixtureGitHubBoundary(malformed));

    const result = await fixture.publisher.openDraftPullRequest({
      bundle: fixture.bundle,
      validation: fixture.validation,
      mode: 'scheduled',
      keywordMetrics: paidKeywordMetrics,
      auth,
    });

    expect(result).toMatchObject({ status: 'blocked', reason: 'github_inspection_failed' });
    expect(fixture.github.calls).toEqual(['inspect']);
    expect(fixture.github.branches.size).toBe(0);
    expect(fixture.github.pullRequests).toHaveLength(0);
  });
});
