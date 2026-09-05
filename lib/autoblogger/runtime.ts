import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, rename } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import matter from 'gray-matter';

import { createApifyClient } from './apify-client';
import type { AutobloggerCliRuntime, AutobloggerRuntimeEnvironment } from './cli';
import {
  normalizeHttpUrl,
  type AllowlistedProductMedia,
  type DraftingContext,
} from './content-bundle';
import { DraftBundleSchema, type Candidate, type KeywordMetrics } from './domain';
import { createStructuredDrafter } from './drafting';
import {
  createGitHubPublisherBoundary,
  createGitHubReadOnlyAuth,
  createGitHubStateStore,
} from './github-runtime';
import {
  createAhrefsKeywordProvider,
  createPendingKeywordProvider,
  createSemrushKeywordProvider,
} from './keyword-providers';
import { intakeCampaignMatrices } from './matrices';
import { createOpenAIResponsesClient } from './openai-responses';
import { createProcessCommandBoundary, createPublisher, type ArticleInventoryEntry } from './publisher';
import { assertPublicationAuth, createPreparedPublicationRuntime } from './publication-runtime';
import { createResearcher, type ResearchResult, type ShallowResearchResult } from './research';
import { createNodeDnsResolver, createNodeJsonHttpTransport, createNodeSourceHttpTransport } from './runtime-http';
import { containsSecretLikeValue } from './secrets';
import { createSafeSourceChecker } from './sources';
import { consumePreparedManualPilot } from './recovery';
import { createAutobloggerWorker, type AutobloggerRunReport } from './worker';
import type { HttpTransport } from './http';

const MATRIX_FILES = [
  ['newly-funded-founder', 'docs/research/campaigns/newly-funded-founder-article-matrix.md'],
  ['accelerator-demo-day-founder', 'docs/research/campaigns/accelerator-demo-day-founder-article-matrix.md'],
  ['video-production-comparison', 'docs/research/campaigns/video-production-comparison-article-matrix.md'],
  ['gtm-content-repurposing-buyer', 'docs/research/campaigns/gtm-content-repurposing-buyer-article-matrix.md'],
  ['portfolio-media-platform', 'docs/research/campaigns/portfolio-media-platform-article-matrix.md'],
] as const;

const MEDIA_ALLOWLIST: AllowlistedProductMedia[] = [
  {
    id: 'founder-product-demo',
    campaignIds: ['newly-funded-founder', 'accelerator-demo-day-founder'],
    src: '/landing/full/founder-product.mp4',
    poster: '/landing/full/founder-product.jpg',
    alt: 'A founder presenting alongside a VideoClaw product walkthrough',
    caption: 'An existing VideoClaw founder-led product demonstration.',
    width: 1280,
    height: 720,
  },
  {
    id: 'kinetic-type-demo',
    campaignIds: ['video-production-comparison', 'gtm-content-repurposing-buyer'],
    src: '/landing/full/kinetic-type.mp4',
    poster: '/landing/full/kinetic-type.jpg',
    alt: 'Kinetic type rendered in an existing VideoClaw product demonstration',
    caption: 'An existing VideoClaw kinetic-type demonstration.',
    width: 1280,
    height: 720,
  },
  {
    id: 'screen-record-demo',
    campaignIds: ['portfolio-media-platform'],
    src: '/landing/full/screen-record-demo.mp4',
    poster: '/landing/full/screen-record-demo.jpg',
    alt: 'An existing VideoClaw screen-recording demonstration',
    caption: 'An existing VideoClaw screen-recording demonstration.',
    width: 1280,
    height: 720,
  },
];

const MAX_SERP_FACT_CHARACTERS = 600;

export async function loadBacklogCandidates(root: string): Promise<Candidate[]> {
  const inputs = await Promise.all(MATRIX_FILES.map(async ([campaignId, path]) => ({
    campaignId,
    markdown: await readFile(resolve(root, path), 'utf8'),
  })));
  const intake = intakeCampaignMatrices(inputs);
  const articleIds = new Set<string>();
  return intake.candidates.filter(({ articleId }) => {
    if (articleIds.has(articleId)) return false;
    articleIds.add(articleId);
    return true;
  });
}

function cleanVisibleFact(value: string): string | undefined {
  const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (!cleaned) return undefined;
  return Array.from(cleaned).slice(0, MAX_SERP_FACT_CHARACTERS).join('').trim();
}

export function buildDraftingContextFromResearch(input: {
  result: ResearchResult;
  shallow: ShallowResearchResult;
  metrics: KeywordMetrics;
  generatedAt: string;
}): DraftingContext {
  const checkedAt = input.result.provenance.serp.observedAt;
  const sourceFacts = input.result.evidence.sources.map((source, sourceIndex) => {
    const normalized = normalizeHttpUrl(source.originalUrl);
    const organic = input.shallow.organicResults.find((result) => normalizeHttpUrl(result.url) === normalized);
    if (!organic) throw new Error('A checked source has no matching live SERP observation.');
    const visible = [cleanVisibleFact(organic.title), cleanVisibleFact(organic.snippet)].filter((value): value is string => Boolean(value));
    if (visible.length === 0) throw new Error('A checked source has no safe visible facts.');
    return {
      id: `source-${sourceIndex + 1}`,
      label: new URL(source.finalUrl).hostname.replace(/^www\./u, ''),
      url: source.finalUrl,
      checkedAt,
      facts: visible.map((text, factIndex) => ({ id: `source-${sourceIndex + 1}-fact-${factIndex + 1}`, text })),
    };
  });
  return {
    candidate: input.result.candidate,
    evidence: input.result.evidence,
    keywordMetrics: input.metrics,
    checkedSources: input.result.evidence.sources.map((source) => ({
      url: source.originalUrl,
      finalUrl: source.finalUrl,
      status: 200,
      reachable: true,
      authoritative: source.authoritative,
    })),
    provenance: {
      apifyRunId: input.result.provenance.serp.runId,
      apifyDatasetId: input.result.provenance.serp.datasetId,
      query: input.result.candidate.primaryKeyword,
      locale: 'en-US',
      capturedAt: checkedAt.slice(0, 10),
    },
    sourceFacts,
    productClaims: [],
    generatedAt: input.generatedAt,
  };
}

function compactReport(report: AutobloggerRunReport) {
  return {
    ...report,
    artifacts: report.artifacts.map((artifact) => ({
      candidateFingerprint: artifact.candidateFingerprint,
      intentFingerprint: artifact.intentFingerprint,
      articleId: artifact.articleId,
      slug: artifact.slug,
      icp: artifact.icp,
      publication: artifact.publication,
      metrics: artifact.metrics,
      keywordProvenance: artifact.keywordProvenance,
      serpProvenance: artifact.serpProvenance,
      pullRequest: artifact.pullRequest,
      validation: {
        status: artifact.validation.status,
        cleanup: artifact.validation.cleanup,
        bundleHash: artifact.validation.bundleHash,
        landerRef: artifact.validation.landerRef,
        checkedOutHeadSha: artifact.validation.checkedOutHeadSha,
        articlePath: artifact.validation.articlePath,
        svgPath: artifact.validation.svgPath,
        commands: artifact.validation.commands.map(({ label, exitCode, durationMs, timedOut }) => ({ label, exitCode, durationMs, timedOut })),
        failure: artifact.validation.failure,
      },
    })),
  };
}

function assertArtifactContainment(base: string, target: string): void {
  const pathFromRoot = relative(base, target);
  if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    throw new Error('Artifact directory must remain inside the configured artifact root.');
  }
}

async function safeArtifactTarget(directory: string, root: string): Promise<string> {
  const base = resolve(root);
  const target = resolve(base, directory);
  assertArtifactContainment(base, target);
  const baseInfo = await lstat(base);
  if (baseInfo.isSymbolicLink() || !baseInfo.isDirectory()) {
    throw new Error('Configured artifact root must be a real directory, not a symlink.');
  }
  const canonicalBase = await realpath(base);
  let current = base;
  const pathFromRoot = relative(base, target);
  for (const segment of pathFromRoot.split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) {
        throw new Error('Artifact directory cannot contain symlinks or non-directory components.');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await mkdir(current, { mode: 0o700 });
    }
    assertArtifactContainment(canonicalBase, await realpath(current));
  }
  return target;
}

async function writeArtifact(path: string, content: string): Promise<void> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error('Artifact output path must be a regular file.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(content, 'utf8');
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, path);
}

export async function writeAutobloggerArtifacts(report: unknown, directory: string, root = process.cwd()): Promise<void> {
  const target = await safeArtifactTarget(directory, root);
  if (containsSecretLikeValue(report)) throw new Error('Refusing to write secret-like artifact content.');
  if (report && typeof report === 'object' && Array.isArray((report as { artifacts?: unknown }).artifacts)) {
    const run = report as AutobloggerRunReport;
    for (const artifact of run.artifacts) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(artifact.slug)) throw new Error('Artifact slug is unsafe.');
      await writeArtifact(resolve(target, `${artifact.slug}.md`), artifact.bundle.markdown);
      if (artifact.bundle.svg !== null) await writeArtifact(resolve(target, `${artifact.slug}.svg`), artifact.bundle.svg);
      await writeArtifact(resolve(target, `${artifact.slug}.bundle.json`), `${JSON.stringify(artifact.bundle, null, 2)}\n`);
      await writeArtifact(resolve(target, `${artifact.slug}.publication.json`), `${JSON.stringify({
        schemaVersion: 1,
        runId: run.runId,
        bundle: artifact.bundle,
        keywordMetrics: artifact.metrics,
        origin: artifact.publicationOrigin,
      }, null, 2)}\n`);
    }
    await writeArtifact(resolve(target, 'run-report.json'), `${JSON.stringify(compactReport(run), null, 2)}\n`);
    const directoryHandle = await open(target, 'r');
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    return;
  }
  const failure = (report as { status?: string; error?: string })?.status === 'failed' && typeof (report as { error?: string }).error === 'string';
  await writeArtifact(resolve(target, failure ? 'failure-report.json' : 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const directoryHandle = await open(target, 'r');
  try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
}

async function localLanderInventory(repository: string, root: string): Promise<ArticleInventoryEntry[]> {
  if (/^[a-z][a-z0-9+.-]*:/iu.test(repository)) {
    throw new Error('LANDER_REPOSITORY must be an authenticated local checkout. Configure LANDER_READ_TOKEN for the private lander checkout; the state token cannot provide cross-repository access.');
  }
  const checkout = resolve(root, repository);
  await lstat(resolve(checkout, '.git'));
  const directory = resolve(checkout, 'content/articles');
  let names: string[];
  try { names = await readdir(directory); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return await Promise.all(names.filter((name) => name.endsWith('.md')).map(async (name) => {
    const data = matter(await readFile(resolve(directory, name), 'utf8')).data;
    const entry: ArticleInventoryEntry = {};
    for (const key of ['slug', 'title', 'primaryKeyword', 'intentFingerprint'] as const) {
      if (typeof data[key] === 'string' && data[key]) entry[key] = data[key];
    }
    if (typeof data.id === 'string' && data.id) entry.articleId = data.id;
    if (Object.keys(entry).length === 0) throw new Error('Local lander article has no inventory identity.');
    return entry;
  }));
}

function providerFor(config: AutobloggerRuntimeEnvironment, transport: ReturnType<typeof createNodeJsonHttpTransport>) {
  if (config.keywordProvider === 'semrush') {
    return createSemrushKeywordProvider({ apiKey: config.keywordApiKey as string, transport });
  }
  if (config.keywordProvider === 'ahrefs') {
    return createAhrefsKeywordProvider({ apiKey: config.keywordApiKey as string, transport });
  }
  return createPendingKeywordProvider();
}

export async function createProductionAutobloggerRuntime(
  config: AutobloggerRuntimeEnvironment,
  root = process.cwd(),
  dependencies: { transport?: HttpTransport } = {},
): Promise<AutobloggerCliRuntime> {
  const transport = dependencies.transport ?? createNodeJsonHttpTransport();
  const [stateOwner, stateRepository] = config.githubRepository.split('/');
  const stateStore = createGitHubStateStore({
    transport,
    owner: stateOwner,
    repository: stateRepository,
    token: config.githubToken,
    githubRepository: config.githubRepository,
  });
  if (config.phase === 'publish') {
    const auth = { kind: 'github_app_installation' as const, token: config.landerGitHubToken ?? '', expiresAt: config.landerTokenExpiresAt ?? '' };
    assertPublicationAuth(auth, config.githubToken, new Date());
    if (config.landerBaseRef !== 'main') throw new Error('Publication requires main and merged PR #55.');
    await localLanderInventory(config.landerRepository, root);
    const github = createGitHubPublisherBoundary({ transport });
    const publisher = createPublisher({
      lander: { repository: resolve(root, config.landerRepository), ref: 'main', owner: config.landerOwner, name: config.landerName },
      command: createProcessCommandBoundary(), github,
    });
    return createPreparedPublicationRuntime({
      root, preparedDir: config.preparedDir ?? '', maxDrafts: config.maxDrafts, landerRef: config.landerBaseRef,
      auth, stateToken: config.githubToken, stateStore, publisher,
      inspectTarget: () => github.inspectTarget({ owner: config.landerOwner, repository: config.landerName, baseRef: 'main', blogLaunchPullRequest: 55, auth }),
    });
  }
  const readAuth = createGitHubReadOnlyAuth(config.landerReadToken ?? '', config.githubToken);
  const localInventory = await localLanderInventory(config.landerRepository, root);
  const snapshot = await createGitHubPublisherBoundary({ transport }).inspectTarget({
    owner: config.landerOwner, repository: config.landerName, baseRef: config.landerBaseRef,
    blogLaunchPullRequest: 55, auth: readAuth,
  });
  const sourceChecker = createSafeSourceChecker({
    transport: createNodeSourceHttpTransport(),
    resolveHostname: createNodeDnsResolver(),
    authorityPolicies: [
      { hostname: 'ycombinator.com' },
      { hostname: 'www.ycombinator.com' },
      { hostname: 'techstars.com' },
      { hostname: 'www.techstars.com' },
      { hostname: 'www.nist.gov' },
      { hostname: 'www.ftc.gov' },
      { hostname: 'www.w3.org' },
      { hostname: 'developers.google.com', pathPrefix: '/search/' },
      { hostname: 'learn.microsoft.com' },
      { hostname: 'videoclaw.com' },
      { hostname: 'www.videoclaw.com' },
    ],
  });
  const researcher = createResearcher({
    apify: createApifyClient({ token: config.apifyToken as string, transport }),
    sourceChecker,
  });
  const publisher = createPublisher({
    lander: {
      repository: resolve(root, config.landerRepository),
      ref: config.landerBaseRef,
      owner: config.landerOwner,
      name: config.landerName,
    },
    command: createProcessCommandBoundary(),
  });
  const client = config.openaiApiKey
    ? createOpenAIResponsesClient({ apiKey: config.openaiApiKey, transport, env: { OPENAI_MODEL: config.openaiModel } })
    : { generate: async () => { throw new Error('OPENAI_API_KEY is required for drafting.'); } };
  const backlog = await loadBacklogCandidates(root);
  const worker = createAutobloggerWorker({
    backlog,
    stateStore,
    researcher,
    keywordProvider: providerFor(config, transport),
    drafter: createStructuredDrafter({ client, mediaAllowlist: MEDIA_ALLOWLIST }),
    buildDraftContext: ({ result, shallow, metrics }) => buildDraftingContextFromResearch({
      result,
      shallow,
      metrics,
      generatedAt: new Date().toISOString(),
    }),
    publisher,
    landerRef: config.landerBaseRef,
    approvedMedia: {
      product: MEDIA_ALLOWLIST.map(({ src, poster }) => ({ src, poster })),
      editorialGraphics: [],
    },
    landerInventory: [...localInventory, ...snapshot.existingArticles],
    openPullRequestInventory: snapshot.openPullRequests,
    branchInventory: snapshot.branchRefs,
    publicationEnabled: false,
    maxDrafts: config.maxDrafts,
    persistArtifact: (artifact, report) => writeAutobloggerArtifacts({ ...report, artifacts: [artifact] }, config.artifactDir, root),
  });
  return {
    execute: (input) => worker.execute(input),
    async finalizeArtifacts(report) {
      if (report.status !== 'validated' || report.mode !== 'manual_pilot' || report.artifacts.length !== 1) return;
      const hash = createHash('sha256').update(JSON.stringify(report.artifacts[0].bundle)).digest('hex');
      await consumePreparedManualPilot(stateStore, report.runId, hash, new Date().toISOString());
    },
    async validate(bundlePath) {
      const raw = await readFile(resolve(root, bundlePath), 'utf8');
      if (containsSecretLikeValue(raw)) throw new Error('Bundle file contains a secret-like value.');
      const bundle = DraftBundleSchema.parse(JSON.parse(raw));
      return await publisher.validateBundle(bundle);
    },
  };
}

export function createProductionValidationRuntime(
  env: Record<string, string | undefined>,
  root = process.cwd(),
): AutobloggerCliRuntime {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} is required for validation.`);
    return value;
  };
  const publisher = createPublisher({
    lander: {
      repository: required('LANDER_REPOSITORY'),
      ref: required('LANDER_BASE_REF'),
      owner: required('LANDER_OWNER'),
      name: required('LANDER_NAME'),
    },
    command: createProcessCommandBoundary(),
  });
  return {
    execute: async () => { throw new Error('Worker execution is unavailable in validation-only mode.'); },
    async validate(bundlePath) {
      const raw = await readFile(resolve(root, bundlePath), 'utf8');
      if (containsSecretLikeValue(raw)) throw new Error('Bundle file contains a secret-like value.');
      return await publisher.validateBundle(DraftBundleSchema.parse(JSON.parse(raw)));
    },
  };
}
