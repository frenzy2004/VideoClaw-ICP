import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import {
  CandidateSchema,
  DraftBundleSchema,
  EvidenceBundleSchema,
  KeywordMetricsSchema,
  candidateFingerprints,
  normalizeKeyword,
  normalizeSlug,
  normalizeTitle,
  type Candidate,
  type DraftBundle,
  type EvidenceBundle,
  type KeywordMetrics,
} from './domain';
import type { DraftProvenance } from './content-bundle';
import { isStrictIsoDateTime } from './date-time';
import type { RunMode } from './policies';
import { containsSecretLikeValue, redactSensitive } from './secrets';

const DEFAULT_COMMAND_TIMEOUT_MS = 10 * 60 * 1_000;
const DEFAULT_REPORT_OUTPUT_LIMIT = 4_000;
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_REF = /^[A-Za-z0-9](?:[A-Za-z0-9._/-]{0,198}[A-Za-z0-9])?$/;
const SAFE_REPOSITORY_IDENTITY = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,98}[A-Za-z0-9])?$/;
const INVENTORY_IDENTITY_LIMITS = {
  id: 128,
  slug: 200,
  title: 300,
  primaryKeyword: 500,
} as const;

export type CommandRequest = {
  label: string;
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
};

export type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
};

export interface CommandBoundary {
  run(request: CommandRequest): Promise<CommandResult>;
}

export type ValidationCommandReport = CommandResult & {
  label: string;
};

export type ValidationReport = {
  status: 'passed' | 'failed';
  cleanup: 'completed' | 'failed';
  bundleHash: string;
  landerRef: string;
  checkedOutHeadSha?: string;
  articlePath?: string;
  svgPath?: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn';
  commands: ValidationCommandReport[];
  failure?: string;
};

type ValidationAuthorization = Readonly<{
  bundleHash: string;
  checkedOutHeadSha: string;
  landerRef: string;
  articlePath: string;
  svgPath: string;
  commandLabels: ReadonlyArray<string>;
}>;

export type PublisherOptions = {
  lander: {
    repository: string;
    ref: string;
    owner: string;
    name: string;
  };
  command: CommandBoundary;
  github?: GitHubPublisherBoundary;
  githubWebBase?: string;
  temporaryRoot?: string;
  commandTimeoutMs?: number;
  reportOutputLimit?: number;
  now?: () => Date;
};

export interface Publisher {
  validateBundle(bundle: Readonly<DraftBundle>): Promise<ValidationReport>;
  openDraftPullRequest(input: OpenDraftPullRequestInput): Promise<OpenDraftPullRequestResult>;
}

export type GitHubAppInstallationAuth = {
  kind: 'github_app_installation';
  token: string;
  expiresAt: string;
};

export type ArticleInventoryEntry = {
  id?: string;
  slug?: string;
  title?: string;
  primaryKeyword?: string;
};

export type GitHubTargetSnapshot = {
  baseRef: string;
  baseSha: string;
  blogLaunch: {
    pullRequestNumber: number;
    state: 'open' | 'closed' | 'merged';
    baseRef: string;
    mergeCommitIncludedInBase: boolean;
  };
  branchRefs: string[];
  existingArticles: ArticleInventoryEntry[];
  openPullRequests: Array<ArticleInventoryEntry & {
    number: number;
    url: string;
    headRef: string;
    bundleHash?: string;
  }>;
};

export type PreparedCommit = {
  owner: string;
  repository: string;
  baseSha: string;
  headRef: string;
  message: string;
  files: Array<{ path: string; content: string }>;
  pullRequest: {
    title: string;
    body: string;
    baseRef: 'main';
    draft: true;
  };
  auth: GitHubAppInstallationAuth;
};

export interface GitHubPublisherBoundary {
  inspectTarget(input: {
    owner: string;
    repository: string;
    baseRef: 'main';
    blogLaunchPullRequest: 55;
    auth: GitHubAppInstallationAuth;
  }): Promise<GitHubTargetSnapshot>;
  prepareCommit(input: PreparedCommit): Promise<{ commitSha: string }>;
  createBranch(input: {
    owner: string;
    repository: string;
    headRef: string;
    commitSha: string;
    auth: GitHubAppInstallationAuth;
  }): Promise<void>;
  createDraftPullRequest(input: {
    owner: string;
    repository: string;
    baseRef: 'main';
    headRef: string;
    title: string;
    body: string;
    draft: true;
    bundleHash: string;
    auth: GitHubAppInstallationAuth;
  }): Promise<{ number: number; url: string }>;
  findOpenPullRequestByHead(input: {
    owner: string;
    repository: string;
    headRef: string;
    auth: GitHubAppInstallationAuth;
  }): Promise<{ number: number; url: string; headRef: string; bundleHash?: string } | null>;
  deleteBranch(input: {
    owner: string;
    repository: string;
    headRef: string;
    auth: GitHubAppInstallationAuth;
  }): Promise<void>;
}

export type OpenDraftPullRequestInput = {
  bundle: Readonly<DraftBundle>;
  validation: Readonly<ValidationReport>;
  mode: RunMode;
  keywordMetrics: Readonly<KeywordMetrics>;
  origin: Readonly<PublisherOrigin>;
  auth?: GitHubAppInstallationAuth;
};

export type ApprovedPublicationMedia = {
  product: ReadonlyArray<Readonly<{ src: string; poster: string }>>;
  editorialGraphics: ReadonlyArray<string>;
};

export type PublisherOrigin = {
  candidate: Readonly<Candidate>;
  evidence: Readonly<EvidenceBundle>;
  provenance: Readonly<DraftProvenance>;
  approvedMedia: Readonly<ApprovedPublicationMedia>;
};

export type OpenDraftPullRequestResult =
  | { status: 'opened'; number: number; url: string; headRef: string }
  | { status: 'already_exists'; number: number; url: string; headRef: string }
  | { status: 'reconciliation_required'; reason: 'pull_request_state_uncertain'; headRef: string }
  | { status: 'artifact_only'; reason: 'lander_base_not_ready' | 'blog_launch_not_merged_into_main' | 'manual_pilot_cannot_publish' }
  | { status: 'blocked'; reason: string; detail?: string };

function appendBounded(current: string, chunk: Buffer, limit: number): string {
  if (current.length >= limit) return current;
  return current + chunk.toString('utf8').slice(0, limit - current.length);
}

function isolatedCommandEnvironment(): NodeJS.ProcessEnv {
  const allowed = [
    'PATH',
    'HOME',
    'TMPDIR',
    'TMP',
    'TEMP',
    'LANG',
    'LC_ALL',
    'TERM',
    'CI',
    'NO_COLOR',
    'FORCE_COLOR',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY',
    'http_proxy',
    'https_proxy',
    'no_proxy',
    'SSL_CERT_FILE',
    'SSL_CERT_DIR',
    'NODE_EXTRA_CA_CERTS',
    'SystemRoot',
  ];
  return {
    NODE_ENV: process.env.NODE_ENV ?? 'production',
    NPM_CONFIG_AUDIT: 'false',
    NPM_CONFIG_FUND: 'false',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    ...Object.fromEntries(allowed.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])),
  };
}

export function createProcessCommandBoundary(options: { maxCaptureCharacters?: number } = {}): CommandBoundary {
  const maxCaptureCharacters = options.maxCaptureCharacters ?? 16_000;
  return {
    run(request) {
      return new Promise((resolveCommand, rejectCommand) => {
        const startedAt = Date.now();
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let settled = false;
        let hardKill: NodeJS.Timeout | undefined;
        let outerDeadline: NodeJS.Timeout | undefined;
        const useProcessGroup = process.platform !== 'win32';
        const child = spawn(request.command, request.args, {
          cwd: request.cwd,
          env: isolatedCommandEnvironment(),
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: useProcessGroup,
        });
        const terminateTree = (signal: NodeJS.Signals) => {
          if (!child.pid) return;
          if (useProcessGroup) {
            try {
              process.kill(-child.pid, signal);
              return;
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ESRCH') child.kill(signal);
              return;
            }
          }
          child.kill(signal);
        };
        const clearTimers = () => {
          clearTimeout(timeout);
          if (hardKill) clearTimeout(hardKill);
          if (outerDeadline) clearTimeout(outerDeadline);
        };
        const finish = (exitCode: number | null) => {
          if (settled) return;
          settled = true;
          clearTimers();
          resolveCommand({
            exitCode,
            stdout,
            stderr,
            durationMs: Date.now() - startedAt,
            timedOut,
          });
        };
        const timeout = setTimeout(() => {
          timedOut = true;
          terminateTree('SIGTERM');
          hardKill = setTimeout(() => terminateTree('SIGKILL'), 250);
          hardKill.unref();
          outerDeadline = setTimeout(() => {
            terminateTree('SIGKILL');
            child.stdout.destroy();
            child.stderr.destroy();
            finish(null);
          }, 750);
          outerDeadline.unref();
        }, request.timeoutMs);
        timeout.unref();
        child.stdout.on('data', (chunk: Buffer) => {
          stdout = appendBounded(stdout, chunk, maxCaptureCharacters);
        });
        child.stderr.on('data', (chunk: Buffer) => {
          stderr = appendBounded(stderr, chunk, maxCaptureCharacters);
        });
        child.once('error', (error) => {
          if (settled) return;
          if (timedOut) {
            finish(null);
            return;
          }
          settled = true;
          clearTimers();
          rejectCommand(error);
        });
        child.once('close', (exitCode) => {
          finish(exitCode);
        });
      });
    },
  };
}

function isSafeRef(value: string): boolean {
  return SAFE_REF.test(value)
    && !value.includes('..')
    && !value.includes('@{')
    && !value.includes('//')
    && !value.endsWith('.')
    && !value.endsWith('/')
    && !value.endsWith('.lock');
}

function assertSafeRepository(value: string): void {
  if (isAbsolute(value)) return;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Lander repository must be an absolute path or HTTPS URL.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Remote lander repository must use credential-free HTTPS.');
  }
}

function assertSafeRepositoryIdentity(owner: string, repository: string): void {
  if (
    !SAFE_REPOSITORY_IDENTITY.test(owner)
    || !SAFE_REPOSITORY_IDENTITY.test(repository)
    || owner === '.'
    || owner === '..'
    || repository === '.'
    || repository === '..'
  ) {
    throw new Error('Unsafe GitHub owner or repository identity.');
  }
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Article ${key} must be a non-empty string.`);
  return value;
}

function safePublicAssetRelativePath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[?#]/.test(value)) {
    throw new Error('Media paths must be local root-relative paths.');
  }
  const segments = value.slice(1).split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Media paths cannot contain empty or traversal segments.');
  }
  return segments.join('/');
}

type BundleCoordinates = {
  slug: string;
  articlePath: string;
  svgPath: string;
  productMediaPaths: string[];
};

function bundleCoordinates(bundle: DraftBundle): BundleCoordinates {
  const article = readRecord(bundle.article, 'Article');
  const slug = readString(article, 'slug');
  if (!SAFE_SLUG.test(slug)) throw new Error('Article slug is unsafe.');
  if (readString(article, 'canonicalPath') !== `/blog/${slug}`) throw new Error('Article canonicalPath must match its slug.');
  const editorialGraphic = readRecord(article.editorialGraphic, 'Article editorialGraphic');
  const editorialSrc = readString(editorialGraphic, 'src');
  if (editorialSrc !== `/media/blog/${slug}.svg`) throw new Error('Editorial graphic path must match the article slug.');
  if (bundle.svg === null) throw new Error('A generated editorial SVG is required.');
  const productMedia = readRecord(article.productMedia, 'Article productMedia');
  const productMediaPaths = [readString(productMedia, 'src'), readString(productMedia, 'poster')]
    .map(safePublicAssetRelativePath);
  return {
    slug,
    articlePath: `content/articles/${slug}.md`,
    svgPath: `public/media/blog/${slug}.svg`,
    productMediaPaths,
  };
}

function hashBundle(bundle: DraftBundle): string {
  return createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
}

function sanitizeCommandResult(
  label: string,
  result: CommandResult,
  outputLimit: number,
): ValidationCommandReport {
  const bounded = (value: string) => redactSensitive(value).slice(0, outputLimit);
  return {
    label,
    exitCode: result.exitCode,
    stdout: bounded(result.stdout),
    stderr: bounded(result.stderr),
    durationMs: Math.max(0, Math.trunc(result.durationMs)),
    timedOut: result.timedOut,
  };
}

function packageCommands(packageJson: Record<string, unknown>) {
  const packageManager = typeof packageJson.packageManager === 'string'
    ? packageJson.packageManager.split('@')[0]
    : undefined;
  return { packageManager };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function choosePackageManager(checkout: string): Promise<{
  manager: 'npm' | 'pnpm' | 'yarn';
  install: string[];
}> {
  const packageJson = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8')) as Record<string, unknown>;
  const declared = packageCommands(packageJson).packageManager;
  const hasNpm = await pathExists(join(checkout, 'package-lock.json')) || await pathExists(join(checkout, 'npm-shrinkwrap.json'));
  const hasPnpm = await pathExists(join(checkout, 'pnpm-lock.yaml'));
  const hasYarn = await pathExists(join(checkout, 'yarn.lock'));
  if (declared === undefined && [hasNpm, hasPnpm, hasYarn].filter(Boolean).length !== 1) {
    throw new Error('Lander checkout must contain exactly one supported lockfile when packageManager is not declared.');
  }
  if ((declared === undefined || declared === 'npm') && hasNpm) return { manager: 'npm', install: ['ci'] };
  if ((declared === undefined || declared === 'pnpm') && hasPnpm) return { manager: 'pnpm', install: ['install', '--frozen-lockfile'] };
  if (declared === 'yarn' && hasYarn) return { manager: 'yarn', install: ['install', '--immutable'] };
  throw new Error('Lander checkout must declare a supported package manager with its matching lockfile.');
}

async function assertExistingFileInsidePublic(checkout: string, relativeAssetPath: string): Promise<void> {
  const publicRoot = await realpath(join(checkout, 'public'));
  const assetPath = resolve(publicRoot, relativeAssetPath);
  const relativeAsset = relative(publicRoot, assetPath);
  if (!relativeAsset || relativeAsset.startsWith(`..${sep}`) || isAbsolute(relativeAsset)) {
    throw new Error('Media path escapes the lander public directory.');
  }
  const metadata = await lstat(assetPath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Media asset is not a regular file: /${relativeAssetPath}`);
  const finalPath = await realpath(assetPath);
  const finalRelative = relative(publicRoot, finalPath);
  if (finalRelative.startsWith(`..${sep}`) || isAbsolute(finalRelative)) {
    throw new Error('Media symlink escapes the lander public directory.');
  }
}

async function ensureDirectoryInsideCheckout(checkout: string, relativeDirectory: string): Promise<void> {
  const checkoutRoot = await realpath(checkout);
  let current = checkoutRoot;
  for (const segment of relativeDirectory.split('/')) {
    current = join(current, segment);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new Error(`Unsafe directory in temporary lander checkout: ${relativeDirectory}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await mkdir(current);
    }
    const finalDirectory = await realpath(current);
    const relativeDirectoryPath = relative(checkoutRoot, finalDirectory);
    if (relativeDirectoryPath.startsWith(`..${sep}`) || isAbsolute(relativeDirectoryPath)) {
      throw new Error('Temporary lander output directory escapes its checkout.');
    }
  }
}

function expectedWorkspaceStatus(coordinates: BundleCoordinates): string[] {
  return [`?? ${coordinates.articlePath}`, `?? ${coordinates.svgPath}`].sort();
}

type PublicationMetadata = {
  id: string;
  campaign: string;
  icp: string;
  primaryKeyword: string;
  title: string;
  slug: string;
  competitorGap: string;
  provenance: {
    apifyRunId: string;
    apifyDatasetId: string;
    query: string;
    locale: string;
    capturedAt: string;
  };
  sources: Array<{ label: string; url: string }>;
  productMedia: { src: string; poster: string };
  editorialGraphic: { src: string };
  metrics: {
    provider: KeywordMetrics['provider'];
    observedAt: string | null;
    volume: number | 'provider-pending' | null;
    difficulty: number | 'provider-pending' | null;
    cpc: number | 'provider-pending' | null;
  };
};

function readArticleMetric(
  record: Record<string, unknown>,
  key: string,
): number | 'provider-pending' | null {
  const value = record[key];
  if (value === undefined) return null;
  if (value === 'provider-pending') return value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Article searchMetrics.${key} must be non-negative or provider-pending.`);
  }
  return value;
}

function assertReviewState(article: Record<string, unknown>): void {
  if (article.status !== 'review') throw new Error('Publisher only accepts review articles.');
  if (Object.prototype.hasOwnProperty.call(article, 'publishedAt')) {
    throw new Error('Review articles cannot define publishedAt.');
  }
  const approvals = readRecord(article.approvals, 'Article approvals');
  const expectedApprovals = ['copy', 'factual', 'legal', 'visual'];
  if (
    Object.keys(approvals).sort().join(',') !== expectedApprovals.sort().join(',')
    || expectedApprovals.some((key) => approvals[key] !== false)
  ) {
    throw new Error('Every article approval must be explicitly false.');
  }
  const cta = readRecord(article.cta, 'Article CTA');
  if (cta.href !== '/download') throw new Error('Article CTA must point to /download.');
}

function expectedArticleMetric(
  metrics: KeywordMetrics,
  value: number | null,
): number | 'provider-pending' | null {
  return metrics.provider === 'pending' ? 'provider-pending' : value;
}

function readPublicationMetadata(
  bundle: DraftBundle,
  mode: RunMode,
  metricsInput: Readonly<KeywordMetrics>,
): PublicationMetadata {
  const article = readRecord(bundle.article, 'Article');
  assertReviewState(article);
  const coordinates = bundleCoordinates(bundle);
  const campaign = readString(article, 'campaign');
  const primaryKeyword = readString(article, 'primaryKeyword');
  const expectedFingerprint = `candidate:${campaign}:${normalizeKeyword(primaryKeyword)}`;
  if (bundle.candidateFingerprint !== expectedFingerprint) {
    throw new Error('Draft bundle fingerprint does not match the article campaign and primary keyword.');
  }
  const provenance = readRecord(article.provenance, 'Article provenance');
  const searchMetrics = readRecord(article.searchMetrics, 'Article searchMetrics');
  const keywordMetrics = KeywordMetricsSchema.parse(metricsInput);
  const volume = readArticleMetric(searchMetrics, 'volume');
  const difficulty = readArticleMetric(searchMetrics, 'keywordDifficulty');
  const cpc = readArticleMetric(searchMetrics, 'cpc');
  if (typeof difficulty === 'number' && difficulty > 100) {
    throw new Error('Article keyword difficulty cannot exceed 100.');
  }
  const metrics = {
    provider: keywordMetrics.provider,
    observedAt: keywordMetrics.observedAt,
    volume,
    difficulty,
    cpc,
  };
  if (
    mode === 'scheduled'
    && (
      !['semrush', 'ahrefs'].includes(keywordMetrics.provider)
      || keywordMetrics.observedAt === null
      || keywordMetrics.volume === null
      || keywordMetrics.difficulty === null
    )
  ) {
    throw new Error('Scheduled publication requires observed volume and keyword difficulty.');
  }
  if (
    volume !== expectedArticleMetric(keywordMetrics, keywordMetrics.volume)
    || difficulty !== expectedArticleMetric(keywordMetrics, keywordMetrics.difficulty)
    || cpc !== expectedArticleMetric(keywordMetrics, keywordMetrics.cpc)
  ) {
    throw new Error('Keyword metrics do not match the validated article frontmatter.');
  }
  if (readString(article, 'searchIntent') !== keywordMetrics.intent) {
    throw new Error('Keyword metrics intent does not match the article search intent.');
  }
  const sourcesValue = article.sources;
  if (!Array.isArray(sourcesValue) || sourcesValue.length < 2) throw new Error('Article requires at least two sources.');
  const sources = sourcesValue.map((value) => {
    const source = readRecord(value, 'Article source');
    return { label: readString(source, 'label'), url: readString(source, 'url') };
  });
  const productMedia = readRecord(article.productMedia, 'Article productMedia');
  const editorialGraphic = readRecord(article.editorialGraphic, 'Article editorialGraphic');
  return {
    id: readString(article, 'id'),
    campaign,
    icp: readString(article, 'icp'),
    primaryKeyword,
    title: readString(article, 'title'),
    slug: coordinates.slug,
    competitorGap: readString(article, 'competitorGap'),
    provenance: {
      apifyRunId: readString(provenance, 'apifyRunId'),
      apifyDatasetId: readString(provenance, 'apifyDatasetId'),
      query: readString(provenance, 'query'),
      locale: readString(provenance, 'locale'),
      capturedAt: readString(provenance, 'capturedAt'),
    },
    sources,
    productMedia: {
      src: readString(productMedia, 'src'),
      poster: readString(productMedia, 'poster'),
    },
    editorialGraphic: { src: readString(editorialGraphic, 'src') },
    metrics,
  };
}

function assertExactKeys(record: Record<string, unknown>, keys: string[], label: string): void {
  if (Object.keys(record).sort().join(',') !== [...keys].sort().join(',')) {
    throw new Error(`${label} contains unsupported fields.`);
  }
}

function readBoundedOriginString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.length > 1_000
    || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)
  ) throw new Error(`${label}.${key} must be a bounded non-empty string.`);
  return value;
}

function assertPublisherOrigin(
  bundle: DraftBundle,
  metadata: PublicationMetadata,
  input: Readonly<PublisherOrigin>,
): void {
  if (containsSecretLikeValue(input)) throw new Error('Publisher origin contains a secret-like value.');
  const origin = readRecord(input, 'Publisher origin');
  assertExactKeys(origin, ['candidate', 'evidence', 'provenance', 'approvedMedia'], 'Publisher origin');
  const candidate = CandidateSchema.parse(origin.candidate);
  const evidence = EvidenceBundleSchema.parse(origin.evidence);
  const expectedFingerprint = candidateFingerprints(candidate).candidate;
  if (
    bundle.candidateFingerprint !== expectedFingerprint
    || evidence.candidateFingerprint !== expectedFingerprint
    || candidate.articleId !== metadata.id
    || candidate.campaignId !== metadata.campaign
    || candidate.icp !== metadata.icp
    || candidate.primaryKeyword !== metadata.primaryKeyword
    || candidate.title !== metadata.title
    || candidate.slug !== metadata.slug
    || candidate.intent !== (bundle.article as Record<string, unknown>).searchIntent
  ) throw new Error('Publisher candidate/evidence binding does not match the draft bundle.');

  const provenance = readRecord(origin.provenance, 'Publisher provenance');
  assertExactKeys(
    provenance,
    ['apifyRunId', 'apifyDatasetId', 'query', 'locale', 'capturedAt'],
    'Publisher provenance',
  );
  const trustedProvenance: DraftProvenance = {
    apifyRunId: readBoundedOriginString(provenance, 'apifyRunId', 'Publisher provenance'),
    apifyDatasetId: readBoundedOriginString(provenance, 'apifyDatasetId', 'Publisher provenance'),
    query: readBoundedOriginString(provenance, 'query', 'Publisher provenance'),
    locale: readBoundedOriginString(provenance, 'locale', 'Publisher provenance'),
    capturedAt: readBoundedOriginString(provenance, 'capturedAt', 'Publisher provenance'),
  };
  if (
    trustedProvenance.query !== candidate.primaryKeyword
    || Object.entries(trustedProvenance).some(([key, value]) => (
      metadata.provenance[key as keyof DraftProvenance] !== value
    ))
  ) throw new Error('Publisher Apify provenance does not exactly match the draft bundle.');

  const approvedMedia = readRecord(origin.approvedMedia, 'Approved publication media');
  assertExactKeys(approvedMedia, ['product', 'editorialGraphics'], 'Approved publication media');
  if (!Array.isArray(approvedMedia.product) || !Array.isArray(approvedMedia.editorialGraphics)) {
    throw new Error('Approved publication media must contain product and editorial arrays.');
  }
  const approvedProduct = approvedMedia.product.map((entry) => {
    const record = readRecord(entry, 'Approved product media');
    assertExactKeys(record, ['src', 'poster'], 'Approved product media');
    return {
      src: `/${safePublicAssetRelativePath(readBoundedOriginString(record, 'src', 'Approved product media'))}`,
      poster: `/${safePublicAssetRelativePath(readBoundedOriginString(record, 'poster', 'Approved product media'))}`,
    };
  });
  const approvedEditorial = approvedMedia.editorialGraphics.map((entry) => (
    `/${safePublicAssetRelativePath(readBoundedOriginString({ entry }, 'entry', 'Approved editorial media'))}`
  ));
  if (
    !approvedProduct.some(({ src, poster }) => (
      src === metadata.productMedia.src && poster === metadata.productMedia.poster
    ))
    || !approvedEditorial.includes(metadata.editorialGraphic.src)
  ) throw new Error('Draft media is not present in the approved publication allowlist.');

  const evidenceSourceUrls = new Set(evidence.sources.map(({ url }) => url));
  if (metadata.sources.some(({ url }) => !evidenceSourceUrls.has(url))) {
    throw new Error('Draft sources are not bound to the originating evidence bundle.');
  }
}

function assertValidationAuthorization(
  bundle: DraftBundle,
  authorization: ValidationAuthorization,
  landerRef: string,
): void {
  const coordinates = bundleCoordinates(bundle);
  if (
    authorization.bundleHash !== hashBundle(bundle)
    || authorization.landerRef !== landerRef
    || !/^[0-9a-f]{40,64}$/i.test(authorization.checkedOutHeadSha)
    || authorization.articlePath !== coordinates.articlePath
    || authorization.svgPath !== coordinates.svgPath
  ) {
    throw new Error('An internal validation authorization for this exact bundle and lander ref is required.');
  }
  const requiredCommands = ['clone', 'checkout', 'resolve-head', 'isolate-checkout', 'install', 'check:blog', 'lint', 'build', 'workspace-integrity'];
  if (authorization.commandLabels.join(',') !== requiredCommands.join(',')) {
    throw new Error('Validation authorization is missing a successful native lander command.');
  }
}

function validInstallationAuth(auth: GitHubAppInstallationAuth | undefined, now: Date): auth is GitHubAppInstallationAuth {
  if (!auth || auth.kind !== 'github_app_installation' || !/^ghs_[A-Za-z0-9_]{16,}$/.test(auth.token)) return false;
  if (process.env.GITHUB_TOKEN && auth.token === process.env.GITHUB_TOKEN) return false;
  if (!isStrictIsoDateTime(auth.expiresAt)) return false;
  const expiresAt = Date.parse(auth.expiresAt);
  const remaining = expiresAt - now.getTime();
  return remaining > 30_000 && remaining <= 2 * 60 * 60 * 1_000;
}

function sameIdentity(metadata: PublicationMetadata, entry: ArticleInventoryEntry): boolean {
  return Boolean(
    (entry.id && entry.id === metadata.id)
    || (entry.slug && normalizeSlug(entry.slug) === normalizeSlug(metadata.slug))
    || (entry.title && normalizeTitle(entry.title) === normalizeTitle(metadata.title))
    || (entry.primaryKeyword && normalizeKeyword(entry.primaryKeyword) === normalizeKeyword(metadata.primaryKeyword)),
  );
}

function safeTraceValue(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, ' ').trim().slice(0, 1_000);
}

function pullRequestBody(
  metadata: PublicationMetadata,
  authorization: ValidationAuthorization,
): string {
  const metric = (value: number | 'provider-pending' | null) => value === null ? 'unavailable' : String(value);
  const body = [
    '## Autoblogger review bundle',
    '',
    `- ICP: ${safeTraceValue(metadata.icp)}`,
    `- Article ID: ${safeTraceValue(metadata.id)}`,
    `- Campaign: ${safeTraceValue(metadata.campaign)}`,
    `- Primary keyword: ${safeTraceValue(metadata.primaryKeyword)}`,
    `- Keyword provider: ${metadata.metrics.provider}`,
    `- Metrics observed: ${metadata.metrics.observedAt ?? 'provider-pending'}`,
    `- Volume: ${metric(metadata.metrics.volume)}`,
    `- Keyword difficulty: ${metric(metadata.metrics.difficulty)}`,
    `- CPC: ${metric(metadata.metrics.cpc)}`,
    `- Apify run: ${safeTraceValue(metadata.provenance.apifyRunId)}`,
    `- Apify dataset: ${safeTraceValue(metadata.provenance.apifyDatasetId)}`,
    `- SERP query: ${safeTraceValue(metadata.provenance.query)} (${safeTraceValue(metadata.provenance.locale)})`,
    `- SERP captured: ${safeTraceValue(metadata.provenance.capturedAt)}`,
    `- Competitor gap: ${safeTraceValue(metadata.competitorGap)}`,
    `- Product media: ${safeTraceValue(metadata.productMedia.src)} (poster: ${safeTraceValue(metadata.productMedia.poster)})`,
    `- Editorial graphic: ${safeTraceValue(metadata.editorialGraphic.src)}`,
    '',
    '### Sources',
    ...metadata.sources.map(({ label, url }) => `- ${safeTraceValue(label)} — ${safeTraceValue(url)}`),
    '',
    '### QA',
    `- Bundle SHA-256: ${authorization.bundleHash}`,
    ...authorization.commandLabels.map((label) => `- ${label}: passed`),
    '',
    'This is a review-only draft. It does not publish, approve, merge, or deploy the article.',
  ].join('\n');
  if (containsSecretLikeValue(body)) throw new Error('Pull-request traceability contains a secret-like value.');
  return redactSensitive(body).slice(0, 12_000);
}

function githubFailureDetail(error: unknown, auth?: GitHubAppInstallationAuth): string {
  return redactSensitive(error, auth ? [auth.token] : []).slice(0, 1_000);
}

function assertPresentInventoryIdentities(record: Record<string, unknown>, label: string): number {
  let present = 0;
  for (const [key, limit] of Object.entries(INVENTORY_IDENTITY_LIMITS) as Array<[
    keyof typeof INVENTORY_IDENTITY_LIMITS,
    number,
  ]>) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    present += 1;
    const value = record[key];
    if (
      typeof value !== 'string'
      || !value.trim()
      || value.length > limit
      || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)
    ) {
      throw new Error(`${label} ${key} must be a bounded non-empty string.`);
    }
  }
  return present;
}

function assertTargetSnapshot(
  value: GitHubTargetSnapshot,
  expectedPullRequestUrl: (number: number) => string,
): GitHubTargetSnapshot {
  const snapshot = readRecord(value, 'GitHub target snapshot');
  if (snapshot.baseRef !== 'main' || typeof snapshot.baseSha !== 'string' || !/^[0-9a-f]{40,64}$/i.test(snapshot.baseSha)) {
    throw new Error('GitHub target snapshot has an invalid main base.');
  }
  const blogLaunch = readRecord(snapshot.blogLaunch, 'GitHub blog launch state');
  if (
    blogLaunch.pullRequestNumber !== 55
    || !['open', 'closed', 'merged'].includes(String(blogLaunch.state))
    || typeof blogLaunch.baseRef !== 'string'
    || typeof blogLaunch.mergeCommitIncludedInBase !== 'boolean'
  ) {
    throw new Error('GitHub target snapshot has invalid blog-launch state.');
  }
  if (!Array.isArray(snapshot.branchRefs) || snapshot.branchRefs.some((ref) => typeof ref !== 'string' || !isSafeRef(ref))) {
    throw new Error('GitHub target snapshot contains an unsafe branch ref.');
  }
  if (!Array.isArray(snapshot.existingArticles) || !Array.isArray(snapshot.openPullRequests)) {
    throw new Error('GitHub target snapshot inventories must be arrays.');
  }
  for (const entry of snapshot.existingArticles as unknown[]) {
    const record = readRecord(entry, 'GitHub article inventory entry');
    if (assertPresentInventoryIdentities(record, 'GitHub article inventory entry') === 0) {
      throw new Error('GitHub article inventory entry requires an identity.');
    }
  }
  for (const entry of snapshot.openPullRequests as unknown[]) {
    const record = readRecord(entry, 'GitHub open pull request');
    if (assertPresentInventoryIdentities(record, 'GitHub open pull request') === 0) {
      throw new Error('GitHub open pull request requires an article identity.');
    }
    if (
      typeof record.number !== 'number'
      || !Number.isInteger(record.number)
      || record.number <= 0
      || typeof record.url !== 'string'
      || record.url !== expectedPullRequestUrl(record.number)
      || typeof record.headRef !== 'string'
      || !isSafeRef(record.headRef)
      || (record.bundleHash !== undefined && (typeof record.bundleHash !== 'string' || !/^[0-9a-f]{64}$/i.test(record.bundleHash)))
    ) {
      throw new Error('GitHub open pull-request inventory entry is invalid.');
    }
  }
  return value;
}

function normalizeGitHubWebBase(value: string): string {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.search
      || url.hash
    ) throw new Error('invalid GitHub web base');
    url.pathname = url.pathname.replace(/\/+$/u, '');
    return url.toString().replace(/\/$/u, '');
  } catch {
    throw new Error('GitHub web base must be a credential-free HTTPS URL.');
  }
}

function pullRequestUrlFor(webBase: string, owner: string, repository: string, number: number): string {
  return `${webBase}/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/pull/${number}`;
}

function assertCommitSha(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{40,64}$/i.test(value)) {
    throw new Error('GitHub returned an invalid prepared commit SHA.');
  }
  return value;
}

function assertPullRequestResult(
  value: unknown,
  expectedPullRequestUrl: (number: number) => string,
): { number: number; url: string } {
  const result = readRecord(value, 'GitHub pull-request result');
  if (
    typeof result.number !== 'number'
    || !Number.isInteger(result.number)
    || result.number <= 0
    || typeof result.url !== 'string'
    || result.url !== expectedPullRequestUrl(result.number)
  ) {
    throw new Error('GitHub returned an invalid draft pull request.');
  }
  return { number: result.number, url: result.url };
}

export function createPublisher(options: PublisherOptions): Publisher {
  const timeoutMs = options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  const outputLimit = options.reportOutputLimit ?? DEFAULT_REPORT_OUTPUT_LIMIT;
  const now = options.now ?? (() => new Date());
  const githubWebBase = normalizeGitHubWebBase(options.githubWebBase ?? 'https://github.com');
  const expectedPullRequestUrl = (number: number) => pullRequestUrlFor(
    githubWebBase,
    options.lander.owner,
    options.lander.name,
    number,
  );
  const validationAuthorizations = new WeakMap<ValidationReport, ValidationAuthorization>();
  if (!isSafeRef(options.lander.ref)) throw new Error('Unsafe lander ref.');
  assertSafeRepository(options.lander.repository);
  assertSafeRepositoryIdentity(options.lander.owner, options.lander.name);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new Error('commandTimeoutMs must be a positive integer.');
  if (!Number.isInteger(outputLimit) || outputLimit <= 0) throw new Error('reportOutputLimit must be a positive integer.');

  return {
    async validateBundle(input) {
      const exactInputHash = hashBundle(input as DraftBundle);
      if (containsSecretLikeValue(input)) {
        return {
          status: 'failed',
          cleanup: 'completed',
          bundleHash: exactInputHash,
          landerRef: options.lander.ref,
          commands: [],
          failure: 'Draft bundle contains a secret-like value.',
        };
      }
      const bundle = DraftBundleSchema.parse(input);
      const bundleHash = hashBundle(bundle);
      const report: ValidationReport = {
        status: 'failed',
        cleanup: 'completed',
        bundleHash,
        landerRef: options.lander.ref,
        commands: [],
      };
      let temporaryDirectory: string | undefined;
      const run = async (request: Omit<CommandRequest, 'timeoutMs'>) => {
        const startedAt = Date.now();
        let raw: CommandResult;
        try {
          raw = await options.command.run({ ...request, timeoutMs });
        } catch (error) {
          const failed = sanitizeCommandResult(request.label, {
            exitCode: null,
            stdout: '',
            stderr: redactSensitive(error),
            durationMs: Date.now() - startedAt,
            timedOut: false,
          }, outputLimit);
          report.commands.push(failed);
          throw new Error(`${request.label} failed.`);
        }
        const commandReport = sanitizeCommandResult(request.label, raw, outputLimit);
        report.commands.push(commandReport);
        if (commandReport.timedOut || commandReport.exitCode !== 0) {
          throw new Error(`${request.label} failed${commandReport.timedOut ? ' by timeout' : ''}.`);
        }
        return raw;
      };

      try {
        const coordinates = bundleCoordinates(bundle);
        report.articlePath = coordinates.articlePath;
        report.svgPath = coordinates.svgPath;
        temporaryDirectory = await mkdtemp(join(options.temporaryRoot ?? tmpdir(), 'videoclaw-lander-validation-'));
        const checkout = join(temporaryDirectory, 'checkout');
        await run({
          label: 'clone',
          command: 'git',
          args: ['clone', '--no-local', '--no-checkout', '--branch', options.lander.ref, '--', options.lander.repository, checkout],
          cwd: temporaryDirectory,
        });
        await run({ label: 'checkout', command: 'git', args: ['checkout', '--detach', 'HEAD'], cwd: checkout });
        const resolvedHead = (await run({
          label: 'resolve-head',
          command: 'git',
          args: ['rev-parse', '--verify', 'HEAD'],
          cwd: checkout,
        })).stdout.trim();
        report.checkedOutHeadSha = assertCommitSha(resolvedHead);
        await run({ label: 'isolate-checkout', command: 'git', args: ['remote', 'remove', 'origin'], cwd: checkout });
        if (await pathExists(join(checkout, coordinates.articlePath)) || await pathExists(join(checkout, coordinates.svgPath))) {
          throw new Error('Article or editorial graphic already exists in the configured lander ref.');
        }
        await Promise.all(coordinates.productMediaPaths.map((path) => assertExistingFileInsidePublic(checkout, path)));
        await ensureDirectoryInsideCheckout(checkout, dirname(coordinates.articlePath));
        await ensureDirectoryInsideCheckout(checkout, dirname(coordinates.svgPath));
        await writeFile(join(checkout, coordinates.articlePath), bundle.markdown, { flag: 'wx' });
        await writeFile(join(checkout, coordinates.svgPath), bundle.svg as string, { flag: 'wx' });
        const install = await choosePackageManager(checkout);
        report.packageManager = install.manager;
        await run({ label: 'install', command: install.manager, args: install.install, cwd: checkout });
        for (const label of ['check:blog', 'lint', 'build'] as const) {
          await run({ label, command: install.manager, args: ['run', label], cwd: checkout });
        }
        const integrity = await run({
          label: 'workspace-integrity',
          command: 'git',
          args: ['status', '--porcelain', '--untracked-files=all'],
          cwd: checkout,
        });
        const actualStatus = integrity.stdout.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).sort();
        if (JSON.stringify(actualStatus) !== JSON.stringify(expectedWorkspaceStatus(coordinates))) {
          throw new Error('Lander validation commands changed files outside the proposed article bundle.');
        }
        report.status = 'passed';
      } catch (error) {
        report.failure = redactSensitive(error).slice(0, outputLimit);
      }

      if (temporaryDirectory) {
        try {
          await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 2 });
        } catch (error) {
          report.status = 'failed';
          report.cleanup = 'failed';
          report.failure = redactSensitive(error).slice(0, outputLimit);
        }
      }
      if (report.status === 'passed' && report.cleanup === 'completed') {
        if (!report.checkedOutHeadSha || !report.articlePath || !report.svgPath) {
          report.status = 'failed';
          report.failure = 'Validation authorization is incomplete.';
        } else {
          validationAuthorizations.set(report, Object.freeze({
            bundleHash: report.bundleHash,
            checkedOutHeadSha: report.checkedOutHeadSha,
            landerRef: report.landerRef,
            articlePath: report.articlePath,
            svgPath: report.svgPath,
            commandLabels: Object.freeze(report.commands.map(({ label }) => label)),
          }));
        }
      }
      return report;
    },
    async openDraftPullRequest(input) {
      let bundle: DraftBundle;
      let metadata: PublicationMetadata;
      let authorization: ValidationAuthorization;
      try {
        bundle = DraftBundleSchema.parse(input.bundle);
        metadata = readPublicationMetadata(bundle, input.mode, input.keywordMetrics);
        assertPublisherOrigin(bundle, metadata, input.origin);
        const retained = validationAuthorizations.get(input.validation as ValidationReport);
        if (!retained) throw new Error('Validation report identity was not authorized by this publisher instance.');
        authorization = retained;
        assertValidationAuthorization(bundle, authorization, options.lander.ref);
        if (containsSecretLikeValue(bundle)) throw new Error('Draft bundle contains a secret-like value.');
      } catch (error) {
        return { status: 'blocked', reason: 'publication_gate_failed', detail: githubFailureDetail(error) };
      }
      if (input.mode === 'manual_pilot') {
        return { status: 'artifact_only', reason: 'manual_pilot_cannot_publish' };
      }
      if (options.lander.ref !== 'main') {
        return { status: 'artifact_only', reason: 'lander_base_not_ready' };
      }
      const operationTime = now();
      if (!Number.isFinite(operationTime.getTime())) {
        return { status: 'blocked', reason: 'invalid_operation_time' };
      }
      if (!validInstallationAuth(input.auth, operationTime)) {
        return { status: 'blocked', reason: 'github_app_auth_required' };
      }
      if (!options.github) return { status: 'blocked', reason: 'github_boundary_required' };
      const auth = input.auth;
      const headRef = `autoblog/${operationTime.toISOString().slice(0, 10)}-${metadata.slug}`;
      if (!isSafeRef(headRef)) return { status: 'blocked', reason: 'unsafe_head_ref' };
      let snapshot: GitHubTargetSnapshot;
      try {
        snapshot = assertTargetSnapshot(await options.github.inspectTarget({
          owner: options.lander.owner,
          repository: options.lander.name,
          baseRef: 'main',
          blogLaunchPullRequest: 55,
          auth,
        }), expectedPullRequestUrl);
      } catch (error) {
        return { status: 'blocked', reason: 'github_inspection_failed', detail: githubFailureDetail(error, auth) };
      }
      if (
        snapshot.baseRef !== 'main'
        || snapshot.blogLaunch.pullRequestNumber !== 55
        || snapshot.blogLaunch.state !== 'merged'
        || snapshot.blogLaunch.baseRef !== 'main'
        || !snapshot.blogLaunch.mergeCommitIncludedInBase
      ) {
        return { status: 'artifact_only', reason: 'blog_launch_not_merged_into_main' };
      }
      if (
        snapshot.baseRef !== options.lander.ref
        || snapshot.baseSha !== authorization.checkedOutHeadSha
      ) {
        return { status: 'blocked', reason: 'validated_base_mismatch' };
      }
      const existingHeadPullRequest = snapshot.openPullRequests.find(({ headRef: current }) => current === headRef);
      if (existingHeadPullRequest?.bundleHash === authorization.bundleHash) {
        return {
          status: 'already_exists',
          number: existingHeadPullRequest.number,
          url: existingHeadPullRequest.url,
          headRef,
        };
      }
      if (
        snapshot.branchRefs.includes(headRef)
        || snapshot.existingArticles.some((entry) => sameIdentity(metadata, entry))
        || snapshot.openPullRequests.some((entry) => sameIdentity(metadata, entry) || entry.headRef === headRef)
      ) {
        return { status: 'blocked', reason: 'duplicate_target' };
      }
      const coordinates = bundleCoordinates(bundle);
      const title = `Review: ${metadata.title}`;
      const body = pullRequestBody(metadata, authorization);
      const prepared: PreparedCommit = {
        owner: options.lander.owner,
        repository: options.lander.name,
        baseSha: snapshot.baseSha,
        headRef,
        message: `content: add ${metadata.slug} review draft`,
        files: [
          { path: coordinates.articlePath, content: bundle.markdown },
          { path: coordinates.svgPath, content: bundle.svg as string },
        ],
        pullRequest: { title, body, baseRef: 'main', draft: true },
        auth,
      };
      let branchCreated = false;
      try {
        const preparedCommit = await options.github.prepareCommit(prepared);
        const commitSha = assertCommitSha(preparedCommit.commitSha);
        await options.github.createBranch({
          owner: options.lander.owner,
          repository: options.lander.name,
          headRef,
          commitSha,
          auth,
        });
        branchCreated = true;
        const pullRequest = assertPullRequestResult(await options.github.createDraftPullRequest({
          owner: options.lander.owner,
          repository: options.lander.name,
          baseRef: 'main',
          headRef,
          title,
          body,
          draft: true,
          bundleHash: authorization.bundleHash,
          auth,
        }), expectedPullRequestUrl);
        return { status: 'opened', number: pullRequest.number, url: pullRequest.url, headRef };
      } catch (error) {
        if (branchCreated) {
          let existing: Awaited<ReturnType<GitHubPublisherBoundary['findOpenPullRequestByHead']>>;
          try {
            existing = await options.github.findOpenPullRequestByHead({
              owner: options.lander.owner,
              repository: options.lander.name,
              headRef,
              auth,
            });
          } catch {
            return { status: 'reconciliation_required', reason: 'pull_request_state_uncertain', headRef };
          }
          if (existing !== null) {
            try {
              const reconciled = assertPullRequestResult(existing, expectedPullRequestUrl);
              if (
                existing.headRef === headRef
                && existing.bundleHash === authorization.bundleHash
              ) {
                return { status: 'already_exists', number: reconciled.number, url: reconciled.url, headRef };
              }
            } catch {
              // A malformed reconciliation response is not proof that the remote branch is safe to delete.
            }
            return { status: 'reconciliation_required', reason: 'pull_request_state_uncertain', headRef };
          }
          try {
            await options.github.deleteBranch({
              owner: options.lander.owner,
              repository: options.lander.name,
              headRef,
              auth,
            });
          } catch (cleanupError) {
            return {
              status: 'blocked',
              reason: 'github_cleanup_failed',
              detail: githubFailureDetail(cleanupError, auth),
            };
          }
        }
        return { status: 'blocked', reason: 'github_operation_failed', detail: githubFailureDetail(error, auth) };
      }
    },
  };
}
