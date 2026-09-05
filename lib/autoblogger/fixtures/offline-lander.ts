import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createProcessCommandBoundary, createPublisher, type CommandRequest, type GitHubPublisherBoundary } from '../publisher';

export const LANDER_REF = 'seo/founder-video-blog-launch';
export const PRODUCT_MEDIA = { src: '/landing/full/founder-product.mp4', poster: '/landing/full/founder-product.jpg' };

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
const workerRoot = resolve(fixtureDirectory, '../../..');
const digest = (content: string | Buffer) => createHash('sha256').update(content).digest('hex');

export function findNativeLanderPath(): string | undefined {
  // An explicit value is never treated as an optional checkout: invalid/empty paths
  // and missing dependencies fail during native fixture setup, rather than skipping.
  if (process.env.AUTOBLOG_NATIVE_LANDER_PATH !== undefined) return process.env.AUTOBLOG_NATIVE_LANDER_PATH;
  const sibling = resolve(workerRoot, '../videoclaw-lander-blog-launch');
  return existsSync(sibling) ? sibling : undefined;
}

/** Temporary repository with the unmodified production articles.ts, real npm/ESLint,
 * and a small static Markdown build. This intentionally does not claim a full Next.js build.
 * npm file dependencies reuse already-installed packages; an empty private cache and
 * offline=true prevent registry requests or downloads. The original checkout is read-only.
 */
export async function createOfflineLander(root: string, nativeLanderPath?: string) {
  // npm records file links relative to the package directory. Match the depth of
  // root/validations/<publisher-mkdtemp>/checkout so the committed lock survives cloning.
  const repository = join(root, 'seed', 'lander', 'checkout');
  const validationRoot = join(root, 'validations');
  await mkdir(repository, { recursive: true });
  await mkdir(validationRoot);
  const processBoundary = createProcessCommandBoundary({ maxCaptureCharacters: 30_000 });
  const runSetup = async (command: string, args: string[], cwd = repository) => {
    const result = await processBoundary.run({ label: 'fixture-setup', command, args, cwd, timeoutMs: 30_000 });
    assert.equal(result.exitCode, 0, result.stdout + result.stderr);
    assert.equal(result.timedOut, false);
    return result.stdout.trim();
  };
  let head = '';
  let assertReadOnly = async () => {};
  // Non-native rejection tests still use the real publisher. Their drafts must
  // fail before it invokes a command, so they require no lander or dependencies.
  if (nativeLanderPath !== undefined) {
    assert.ok(nativeLanderPath.trim(), 'AUTOBLOG_NATIVE_LANDER_PATH must not be empty');
    const originalLander = resolve(nativeLanderPath);
    assert.ok(existsSync(join(originalLander, 'app/lib/articles.ts')), 'Native lander requires app/lib/articles.ts at ' + originalLander);
    const originalStatus = await runSetup('git', ['status', '--porcelain', '--untracked-files=all'], originalLander);
    const originalPaths = ['app/lib/articles.ts', 'package.json', 'package-lock.json', ...Object.values(PRODUCT_MEDIA).map((path) => 'public' + path)];
    const originalHashes = await Promise.all(originalPaths.map(async (path) => digest(await readFile(join(originalLander, path)))));
    const put = async (path: string, content: string) => {
      await mkdir(dirname(join(repository, path)), { recursive: true });
      await writeFile(join(repository, path), content);
    };
    await put('app/lib/articles.ts', await readFile(join(originalLander, 'app/lib/articles.ts'), 'utf8'));
    for (const media of Object.values(PRODUCT_MEDIA)) {
      const path = join(repository, 'public' + media);
      await mkdir(dirname(path), { recursive: true });
      await copyFile(join(originalLander, 'public' + media), path);
    }
    const dependencies: Record<string, string> = {};
    for (const name of ['gray-matter', 'mdast-util-to-string', 'remark-gfm', 'remark-parse', 'unified', 'zod', 'react', 'react-dom', 'react-markdown', 'eslint']) {
      dependencies[name] = 'file:' + await realpath(join(originalLander, 'node_modules', name));
    }
    await put('package.json', JSON.stringify({
      name: 'videoclaw-offline-native-contract', version: '1.0.0', private: true, type: 'module', dependencies,
      scripts: {
        'check:blog': 'node --experimental-strip-types scripts/check-blog.mjs',
        lint: 'eslint scripts/*.mjs eslint.config.mjs',
        build: 'node --experimental-strip-types scripts/build.mjs',
      },
    }, null, 2) + '\n');
    await put('.npmrc', 'offline=true\naudit=false\nfund=false\nupdate-notifier=false\npackage-lock=true\ninstall-links=false\ncache=' + join(root, 'npm-cache') + '\n');
    await put('.gitignore', 'node_modules/\ndist/\n');
    for (const path of ['scripts/check-blog.mjs', 'scripts/build.mjs', 'eslint.config.mjs']) {
      await put(path, await readFile(join(fixtureDirectory, 'offline-lander-package', path), 'utf8'));
    }
    await runSetup('npm', ['install', '--package-lock-only', '--ignore-scripts', '--offline']);
    const lock = JSON.parse(await readFile(join(repository, 'package-lock.json'), 'utf8'));
    // Local links must be the whole lock graph: a registry dependency would invalidate this fixture.
    for (const entry of Object.values(lock.packages) as Array<{ resolved?: string }>) {
      if (entry.resolved) assert.doesNotMatch(entry.resolved, /^https?:/u);
    }
    await runSetup('git', ['init', '--initial-branch=' + LANDER_REF]);
    await runSetup('git', ['add', '--', '.']);
    // Commit only the disposable fixture so createPublisher can perform a real local clone.
    await runSetup('git', ['-c', 'user.name=Offline Fixture', '-c', 'user.email=offline@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'test fixture: native lander contract']);
    head = await runSetup('git', ['rev-parse', 'HEAD']);
    assertReadOnly = async () => {
      assert.equal(await runSetup('git', ['status', '--porcelain', '--untracked-files=all'], originalLander), originalStatus);
      assert.deepEqual(await Promise.all(originalPaths.map(async (path) => digest(await readFile(join(originalLander, path))))), originalHashes);
      assert.equal(await runSetup('git', ['status', '--porcelain', '--untracked-files=all']), '');
      assert.equal(digest(await readFile(join(repository, 'app/lib/articles.ts'))), originalHashes[0]);
    };
  }
  const commands: CommandRequest[] = [];
  const commandFailures: string[] = [];
  const rendered: Array<{ slug: string; markdown: string; svg: string; html: string; publicRoutes: string[] }> = [];
  const githubCalls: string[] = [];
  const forbidden = async (operation: string): Promise<never> => {
    githubCalls.push(operation);
    throw new Error('Offline premerge execution must not touch GitHub: ' + operation);
  };
  const github: GitHubPublisherBoundary = {
    inspectTarget: () => forbidden('inspectTarget'), prepareCommit: () => forbidden('prepareCommit'),
    createBranch: () => forbidden('createBranch'), createDraftPullRequest: () => forbidden('createDraftPullRequest'),
    findOpenPullRequestByHead: () => forbidden('findOpenPullRequestByHead'), deleteBranch: () => forbidden('deleteBranch'),
  };
  const publisher = createPublisher({
    lander: { repository, ref: LANDER_REF, owner: 'offline-fixture', name: 'videoclaw-lander' },
    temporaryRoot: validationRoot,
    commandTimeoutMs: 30_000,
    reportOutputLimit: 20_000,
    github,
    command: {
      async run(request) {
        commands.push(request);
        if (request.label === 'install') {
          assert.equal(request.command, 'npm');
          assert.deepEqual(request.args, ['ci']);
        }
        const result = await processBoundary.run(request);
        if (result.exitCode !== 0) commandFailures.push(request.label + ': ' + result.stdout + result.stderr);
        if (request.label === 'build' && result.exitCode === 0) {
          const articles = await readdir(join(request.cwd, 'content/articles'));
          assert.equal(articles.length, 1);
          const slug = articles[0].replace(/\.md$/u, '');
          rendered.push({
            slug,
            markdown: await readFile(join(request.cwd, 'content/articles', articles[0]), 'utf8'),
            svg: await readFile(join(request.cwd, 'public/media/blog', slug + '.svg'), 'utf8'),
            html: await readFile(join(request.cwd, 'dist/preview', slug + '.html'), 'utf8'),
            publicRoutes: JSON.parse(await readFile(join(request.cwd, 'dist/public-routes.json'), 'utf8')),
          });
        }
        return result;
      },
    },
  });
  return { publisher, commands, commandFailures, rendered, githubCalls, head, validationRoot, assertReadOnly };
}
