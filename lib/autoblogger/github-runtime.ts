import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { z } from 'zod';

import { AutobloggerStateSchema, createAutobloggerState } from './state';
import { CandidateSchema, candidateFingerprints } from './domain';
import { containsSecretLikeValue, redactSensitive } from './secrets';
import { requestWithTimeout, type HttpRequest, type HttpResponse, type HttpTransport } from './http';
import type {
  GitHubAppInstallationAuth,
  GitHubPublisherBoundary,
  GitHubReadOnlyAuth,
  GitHubTargetSnapshot,
  PreparedCommit,
} from './publisher';

const DEFAULT_GITHUB_API = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const DEFAULT_TIMEOUT_MS = 20_000;
const STATE_PATH = 'state.json';
const STATE_BRANCH = 'autoblogger-state';
const SAFE_IDENTITY = /^[A-Za-z0-9_.-]+$/;

export function createGitHubReadOnlyAuth(token: string, stateToken?: string): GitHubReadOnlyAuth {
  if (!/^github_pat_[A-Za-z0-9_]{16,}$/u.test(token) || token === stateToken || token === process.env.GITHUB_TOKEN) {
    throw new Error('LANDER_READ_TOKEN must be a separate fine-grained read-only PAT with contents:read and pull_requests:read; state and publication tokens are forbidden.');
  }
  return { kind: 'github_read_only', token };
}

function assertMutationAuth(auth: GitHubAppInstallationAuth): void {
  if (!auth || auth.kind !== 'github_app_installation' || !/^ghs_[A-Za-z0-9_]{16,}$/u.test(auth.token) || auth.token === process.env.GITHUB_TOKEN) {
    throw new Error('GitHub mutations require an explicit lander App installation token.');
  }
}

const CompactFailureSchema = z.object({
  runId: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(120),
  attempt: z.number().int().min(1).max(3),
  observedAt: z.string().datetime(),
  detail: z.string().trim().min(1).max(500),
}).strict();

const CompactProvenanceSchema = z.object({
  serp: z.object({
    runId: z.string().trim().min(1).max(160),
    datasetId: z.string().trim().min(1).max(160),
    observedAt: z.string().datetime(),
  }).strict(),
  keyword: z.object({
    provider: z.enum(['pending', 'semrush', 'ahrefs', 'similarweb']),
    endpoint: z.string().url().max(1_000).nullable(),
    observedAt: z.string().datetime().nullable(),
    providerRequestId: z.string().trim().min(1).max(500).nullable(),
    sourceObservedAt: z.string().trim().min(1).max(100).nullable(),
  }).strict(),
}).strict();

export const CandidateDecisionSchema = z.object({
  articleId: z.string().trim().min(1).max(128),
  intentFingerprint: z.string().regex(/^intent:[0-9a-f]{64}$/u),
  identities: z.array(z.string().trim().min(1).max(500)).min(6).max(6),
  status: z.enum(['scanned', 'retryable', 'leased', 'completed', 'terminal', 'manual_attention']),
  reason: z.string().trim().min(1).max(240),
  attempts: z.number().int().min(0).max(3),
  runId: z.string().trim().min(1).max(160),
  updatedAt: z.string().datetime(),
  leaseExpiresAt: z.string().datetime().nullable(),
}).strict();

const ManualPilotSchema = z.object({
  runId: z.string().trim().min(1).max(160),
  status: z.enum(['leased', 'prepared', 'consumed']),
  reservedAt: z.string().datetime(),
  leaseExpiresAt: z.string().datetime().nullable(),
  artifactHash: z.string().regex(/^[0-9a-f]{64}$/u).nullable(),
  consumedAt: z.string().datetime().nullable(),
}).strict();

export const PersistentWorkerStateSchema = AutobloggerStateSchema.extend({
  manualPilot: ManualPilotSchema.nullable(),
  queuedCandidates: z.array(CandidateSchema).max(500),
  candidateFingerprints: z.array(z.string().trim().min(1).max(500)).max(20_000),
  dedupeHashes: z.array(z.string().regex(/^[0-9a-f]{64}$/u)).max(30_000),
  decisions: z.record(z.string(), CandidateDecisionSchema),
  provenance: z.record(z.string(), CompactProvenanceSchema),
  contentHashes: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
  pullRequests: z.record(z.string(), z.object({
    number: z.number().int().positive(),
    url: z.string().url(),
    status: z.enum(['opened', 'already_exists', 'reconciliation_required']),
  }).strict()),
  failures: z.array(CompactFailureSchema).max(100),
}).strict();

export type PersistentWorkerState = z.infer<typeof PersistentWorkerStateSchema>;

export function createPersistentWorkerState(): PersistentWorkerState {
  return PersistentWorkerStateSchema.parse({
    ...createAutobloggerState(),
    manualPilot: null,
    queuedCandidates: [],
    candidateFingerprints: [],
    dedupeHashes: [],
    decisions: {},
    provenance: {},
    contentHashes: {},
    pullRequests: {},
    failures: [],
  });
}

export type CandidateDecision = z.infer<typeof CandidateDecisionSchema>;

export const MAX_PERSISTENT_STATE_BYTES = 1_500_000;
const MAX_DECISIONS = 5_000;
const MAX_RUNS = 500;

function identityHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function compactPersistentWorkerState(input: PersistentWorkerState): PersistentWorkerState {
  const parsed = PersistentWorkerStateSchema.parse(input);
  const orderedDecisions = Object.entries(parsed.decisions).sort((left, right) => (
    right[1].updatedAt.localeCompare(left[1].updatedAt) || left[0].localeCompare(right[0])
  ));
  const active = orderedDecisions.filter(([, decision]) => ['leased', 'retryable', 'manual_attention'].includes(decision.status));
  if (active.length > MAX_DECISIONS) throw new Error('Persistent state contains too many active or retryable decisions to compact safely.');
  const retainedDecisionEntries = [
    ...active,
    ...orderedDecisions.filter(([, decision]) => !['leased', 'retryable', 'manual_attention'].includes(decision.status)),
  ].slice(0, MAX_DECISIONS);
  const retainedDecisionKeys = new Set(retainedDecisionEntries.map(([key]) => key));
  const droppedIdentityHashes = orderedDecisions
    .filter(([key]) => !retainedDecisionKeys.has(key))
    .flatMap(([, decision]) => decision.identities.map(identityHash));
  const allIdentityHashes = parsed.candidateFingerprints.map(identityHash);
  const candidateFingerprints = [...new Set(parsed.candidateFingerprints)].sort().slice(-20_000);
  const dedupeHashes = [...new Set([
    ...parsed.dedupeHashes,
    ...allIdentityHashes,
    ...droppedIdentityHashes,
  ])].sort();
  if (dedupeHashes.length > 30_000) throw new Error('Durable deduplication capacity reached; archive state before continuing. No identities were discarded.');
  const retainedRuns = Object.entries(parsed.runs)
    .sort((left, right) => right[1].startedAt.localeCompare(left[1].startedAt) || left[0].localeCompare(right[0]))
    .slice(0, MAX_RUNS);
  const compacted = PersistentWorkerStateSchema.parse({
    ...parsed,
    runs: Object.fromEntries(retainedRuns),
    decisions: Object.fromEntries(retainedDecisionEntries.sort(([a], [b]) => a.localeCompare(b))),
    candidateFingerprints,
    dedupeHashes,
    provenance: Object.fromEntries(Object.entries(parsed.provenance).filter(([key]) => retainedDecisionKeys.has(key)).sort(([a], [b]) => a.localeCompare(b))),
    contentHashes: Object.fromEntries(Object.entries(parsed.contentHashes).filter(([key]) => retainedDecisionKeys.has(key)).sort(([a], [b]) => a.localeCompare(b))),
    pullRequests: Object.fromEntries(Object.entries(parsed.pullRequests).filter(([key]) => retainedDecisionKeys.has(key)).sort(([a], [b]) => a.localeCompare(b))),
    failures: parsed.failures.slice(-100),
  });
  if (Buffer.byteLength(JSON.stringify(compacted), 'utf8') > MAX_PERSISTENT_STATE_BYTES) {
    throw new Error('Persistent state exceeds the 1.5MB fail-closed size limit after deterministic compaction.');
  }
  return compacted;
}

type GitHubRuntimeOptions = {
  transport: HttpTransport;
  apiBase?: string;
  timeoutMs?: number;
};

function assertIdentity(value: string, label: string): void {
  if (!SAFE_IDENTITY.test(value) || value === '.' || value === '..') throw new Error(`Unsafe GitHub ${label}.`);
}

function apiBase(value: string | undefined): string {
  const parsed = new URL(value ?? DEFAULT_GITHUB_API);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('GitHub API base must be credential-free HTTPS.');
  }
  return parsed.toString().replace(/\/$/u, '');
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a string.`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function authHeaders(token: string): Record<string, string> {
  if (!token.trim()) throw new Error('An explicit GitHub token is required.');
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
  };
}

async function requestGitHub(
  options: Required<Pick<GitHubRuntimeOptions, 'transport' | 'timeoutMs'>> & { apiBase: string },
  token: string,
  method: HttpRequest['method'],
  path: string,
  body?: unknown,
  accepted: number[] = [200],
): Promise<HttpResponse> {
  try {
    const response = await requestWithTimeout(options.transport, {
      method,
      url: `${options.apiBase}${path}`,
      headers: {
        ...authHeaders(token),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }, options.timeoutMs);
    if (!accepted.includes(response.status)) {
      throw new Error(`GitHub API returned HTTP ${response.status}.`);
    }
    const link = Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'link')?.[1] ?? '';
    if (/rel="next"/iu.test(link)) {
      throw new Error('GitHub inventory pagination exceeded the bounded first page.');
    }
    return response;
  } catch (error) {
    throw new Error(`GitHub API request failed: ${redactSensitive(error, [token])}`);
  }
}

function repoPath(owner: string, repository: string): string {
  assertIdentity(owner, 'owner');
  assertIdentity(repository, 'repository');
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
}

function parseArticle(content: string): { id?: string; articleId?: string; intentFingerprint?: string; slug?: string; title?: string; primaryKeyword?: string } {
  const data = matter(content).data as Record<string, unknown>;
  const result: { id?: string; articleId?: string; intentFingerprint?: string; slug?: string; title?: string; primaryKeyword?: string } = {};
  for (const key of ['id', 'slug', 'title', 'primaryKeyword'] as const) {
    if (typeof data[key] === 'string' && data[key].trim()) result[key] = data[key].trim();
  }
  if (result.id) result.articleId = result.id;
  if (typeof data.intentFingerprint === 'string' && /^intent:[0-9a-f]{64}$/u.test(data.intentFingerprint)) {
    result.intentFingerprint = data.intentFingerprint;
  } else {
    const candidate = CandidateSchema.safeParse({
      schemaVersion: 1,
      articleId: result.id,
      campaignId: data.campaign,
      icp: data.icp,
      primaryKeyword: result.primaryKeyword,
      secondaryKeywords: Array.isArray(data.secondaryKeywords) ? data.secondaryKeywords : [],
      title: result.title,
      slug: result.slug,
      intent: data.searchIntent,
      funnelStage: data.funnelStage,
    });
    if (candidate.success) result.intentFingerprint = candidateFingerprints(candidate.data).intent;
  }
  if (!result.id && !result.slug && !result.title && !result.primaryKeyword) {
    throw new Error('Lander article inventory record has no identity.');
  }
  return result;
}

function decodeBlob(value: unknown): string {
  const blob = record(value, 'GitHub blob');
  if (blob.encoding !== 'base64') throw new Error('GitHub blob must use base64 encoding.');
  return Buffer.from(string(blob.content, 'GitHub blob content').replace(/\s/gu, ''), 'base64').toString('utf8');
}

function bundleMarker(body: unknown): string | undefined {
  if (typeof body !== 'string') return undefined;
  return body.match(/<!--\s*autoblogger-bundle-sha256:\s*([0-9a-f]{64})\s*-->/iu)?.[1];
}

function bodyIdentity(body: unknown, pattern: RegExp): string | undefined {
  if (typeof body !== 'string') return undefined;
  return body.match(pattern)?.[1]?.trim() || undefined;
}

function slugFromHead(head: string): string | undefined {
  return head.match(/^autoblog\/\d{4}-\d{2}-\d{2}-(.+)$/u)?.[1];
}

function parsePullRequest(value: unknown) {
  const pr = record(value, 'GitHub pull request');
  const head = record(pr.head, 'GitHub pull request head');
  const headRef = string(head.ref, 'GitHub pull request head ref');
  const title = typeof pr.title === 'string' ? pr.title.replace(/^Review:\s*/u, '').trim() : undefined;
  const slug = slugFromHead(headRef);
  return {
    number: integer(pr.number, 'GitHub pull request number'),
    url: string(pr.html_url, 'GitHub pull request URL'),
    headRef,
    ...(bundleMarker(pr.body) ? { bundleHash: bundleMarker(pr.body) } : {}),
    ...(slug ? { slug } : {}),
    ...(title ? { title } : {}),
    ...(bodyIdentity(pr.body, /^\s*-\s*Article ID:\s*(\S+)\s*$/imu)
      ? { articleId: bodyIdentity(pr.body, /^\s*-\s*Article ID:\s*(\S+)\s*$/imu) }
      : {}),
    ...(bodyIdentity(pr.body, /^\s*-\s*Primary keyword:[ \t]*([^\r\n]+)$/imu)
      ? { primaryKeyword: bodyIdentity(pr.body, /^\s*-\s*Primary keyword:[ \t]*([^\r\n]+)$/imu) }
      : {}),
    ...(bodyIdentity(pr.body, /^\s*-\s*Intent fingerprint:\s*(intent:[0-9a-f]{64})\s*$/imu)
      ? { intentFingerprint: bodyIdentity(pr.body, /^\s*-\s*Intent fingerprint:\s*(intent:[0-9a-f]{64})\s*$/imu) }
      : {}),
  };
}

export function createGitHubPublisherBoundary(input: GitHubRuntimeOptions): GitHubPublisherBoundary {
  const options = {
    transport: input.transport,
    apiBase: apiBase(input.apiBase),
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
  return {
    async inspectTarget({ owner, repository, baseRef, blogLaunchPullRequest, auth }): Promise<GitHubTargetSnapshot> {
      if (auth.kind === 'github_read_only') createGitHubReadOnlyAuth(auth.token);
      else assertMutationAuth(auth);
      const root = repoPath(owner, repository);
      const baseResponse = await requestGitHub(
        options,
        auth.token,
        'GET',
        `${root}/git/ref/heads/${encodeURIComponent(baseRef)}`,
      );
      const baseObject = record(record(baseResponse.body, 'GitHub base ref').object, 'GitHub base object');
      const baseSha = string(baseObject.sha, 'GitHub base SHA');
      const [launchResponse, branchResponse, treeResponse, pullsResponse] = await Promise.all([
        requestGitHub(options, auth.token, 'GET', `${root}/pulls/${blogLaunchPullRequest}`),
        requestGitHub(options, auth.token, 'GET', `${root}/git/matching-refs/heads/`),
        requestGitHub(options, auth.token, 'GET', `${root}/git/trees/${encodeURIComponent(baseSha)}?recursive=1`),
        requestGitHub(options, auth.token, 'GET', `${root}/pulls?state=open&per_page=100`),
      ]);
      const launch = record(launchResponse.body, 'GitHub blog-launch pull request');
      const merged = launch.merged === true || launch.merged_at !== null && launch.merged_at !== undefined;
      const mergeCommit = typeof launch.merge_commit_sha === 'string' ? launch.merge_commit_sha : null;
      let mergeCommitIncludedInBase = false;
      if (merged && mergeCommit) {
        const compare = await requestGitHub(options, auth.token, 'GET', `${root}/compare/${encodeURIComponent(mergeCommit)}...${encodeURIComponent(baseSha)}`);
        const status = record(compare.body, 'GitHub compare result').status;
        mergeCommitIncludedInBase = status === 'ahead' || status === 'identical';
      }
      if (!Array.isArray(branchResponse.body)) throw new Error('GitHub branch inventory is incomplete.');
      const branches = branchResponse.body;
      const branchRefs = branches.map((entry) => string(record(entry, 'GitHub ref').ref, 'GitHub ref name').replace(/^refs\/heads\//u, ''));
      const tree = record(treeResponse.body, 'GitHub repository tree');
      if (tree.truncated === true || !Array.isArray(tree.tree)) throw new Error('GitHub article inventory tree is incomplete.');
      const articleEntries = tree.tree.filter((entry) => {
        const item = record(entry, 'GitHub tree entry');
        return item.type === 'blob' && typeof item.path === 'string' && /^content\/articles\/[^/]+\.md$/u.test(item.path);
      });
      const existingArticles = await Promise.all(articleEntries.map(async (entry) => {
        const item = record(entry, 'GitHub article tree entry');
        const blob = await requestGitHub(options, auth.token, 'GET', `${root}/git/blobs/${encodeURIComponent(string(item.sha, 'GitHub blob SHA'))}`);
        return parseArticle(decodeBlob(blob.body));
      }));
      if (!Array.isArray(pullsResponse.body)) throw new Error('GitHub open pull-request inventory is malformed.');
      const openPullRequests: GitHubTargetSnapshot['openPullRequests'] = [];
      for (const entry of pullsResponse.body) {
        const pull = parsePullRequest(entry);
        const files = await requestGitHub(options, auth.token, 'GET', `${root}/pulls/${pull.number}/files?per_page=100`);
        if (!Array.isArray(files.body)) throw new Error('GitHub pull-request file inventory is incomplete.');
        const articleFiles = files.body.filter((value) => {
          const file = record(value, 'GitHub pull-request file');
          return file.status !== 'removed' && /^content\/articles\/[^/]+\.md$/u.test(string(file.filename, 'GitHub changed file name'));
        });
        const articles = await Promise.all(articleFiles.map(async (value) => {
          const file = record(value, 'GitHub changed article');
          const sha = string(file.sha, 'GitHub changed article SHA');
          if (!/^[0-9a-f]{40,64}$/iu.test(sha)) throw new Error('GitHub changed article SHA is invalid.');
          // Read immutable blob content through the authenticated repository API;
          // never follow raw_url or download_url supplied by a PR or fork.
          const blob = await requestGitHub(options, auth.token, 'GET', `${root}/git/blobs/${sha}`);
          const article = parseArticle(decodeBlob(blob.body));
          if (!article.articleId || !article.slug || !article.title || !article.primaryKeyword) {
            throw new Error('Changed PR article is missing a required ID, slug, title, or primary keyword.');
          }
          return article;
        }));
        // A manual PR may contain multiple articles and no traceability bullets.
        // Give each article its own inventory entry rather than its PR title.
        if (articles.length > 0) {
          for (const article of articles) {
            openPullRequests.push({ number: pull.number, url: pull.url, headRef: pull.headRef, ...article,
              ...(pull.bundleHash ? { bundleHash: pull.bundleHash } : {}) });
          }
        } else {
          openPullRequests.push(pull);
        }
      }
      const launchBase = record(launch.base, 'GitHub blog-launch base');
      return {
        baseRef,
        baseSha,
        blogLaunch: {
          pullRequestNumber: blogLaunchPullRequest,
          state: merged ? 'merged' : launch.state === 'open' ? 'open' : 'closed',
          baseRef: string(launchBase.ref, 'GitHub blog-launch base ref'),
          mergeCommitIncludedInBase,
        },
        branchRefs,
        existingArticles,
        openPullRequests,
      };
    },
    async prepareCommit(input: PreparedCommit) {
      assertMutationAuth(input.auth);
      const root = repoPath(input.owner, input.repository);
      const blobs = await Promise.all(input.files.map(async (file) => {
        const response = await requestGitHub(options, input.auth.token, 'POST', `${root}/git/blobs`, {
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        }, [201]);
        return { path: file.path, sha: string(record(response.body, 'GitHub blob result').sha, 'GitHub blob SHA') };
      }));
      const treeResponse = await requestGitHub(options, input.auth.token, 'POST', `${root}/git/trees`, {
        base_tree: input.baseSha,
        tree: blobs.map(({ path, sha }) => ({ path, mode: '100644', type: 'blob', sha })),
      }, [201]);
      const treeSha = string(record(treeResponse.body, 'GitHub tree result').sha, 'GitHub tree SHA');
      const commitResponse = await requestGitHub(options, input.auth.token, 'POST', `${root}/git/commits`, {
        message: input.message,
        tree: treeSha,
        parents: [input.baseSha],
      }, [201]);
      return { commitSha: string(record(commitResponse.body, 'GitHub commit result').sha, 'GitHub commit SHA') };
    },
    async createBranch({ owner, repository, headRef, commitSha, auth }) {
      assertMutationAuth(auth);
      await requestGitHub(options, auth.token, 'POST', `${repoPath(owner, repository)}/git/refs`, {
        ref: `refs/heads/${headRef}`,
        sha: commitSha,
      }, [201]);
    },
    async createDraftPullRequest({ owner, repository, baseRef, headRef, title, body, draft, bundleHash, auth }) {
      assertMutationAuth(auth);
      const marker = `<!-- autoblogger-bundle-sha256: ${bundleHash} -->`;
      const response = await requestGitHub(options, auth.token, 'POST', `${repoPath(owner, repository)}/pulls`, {
        title,
        body: `${body}\n\n${marker}`,
        head: headRef,
        base: baseRef,
        draft,
      }, [201]);
      const result = record(response.body, 'GitHub draft pull request');
      return {
        number: integer(result.number, 'GitHub pull request number'),
        url: string(result.html_url, 'GitHub pull request URL'),
      };
    },
    async findOpenPullRequestByHead({ owner, repository, headRef, auth }) {
      const query = new URLSearchParams({ state: 'open', head: `${owner}:${headRef}`, per_page: '2' });
      const response = await requestGitHub(options, auth.token, 'GET', `${repoPath(owner, repository)}/pulls?${query}`);
      if (!Array.isArray(response.body)) throw new Error('GitHub pull-request lookup is malformed.');
      const matches = response.body.map((entry) => parsePullRequest(entry));
      if (matches.length > 1) throw new Error('GitHub returned multiple pull requests for one autoblogger branch.');
      if (matches.length === 0) return null;
      return matches[0];
    },
    async deleteBranch({ owner, repository, headRef, auth }) {
      assertMutationAuth(auth);
      await requestGitHub(
        options,
        auth.token,
        'DELETE',
        `${repoPath(owner, repository)}/git/ref/heads/${headRef.split('/').map(encodeURIComponent).join('/')}`,
        undefined,
        [204],
      );
    },
  };
}

export interface GitHubStateStore {
  load(): Promise<{ state: PersistentWorkerState; version: string | null }>;
  save(state: PersistentWorkerState, expectedVersion: string | null): Promise<{ version: string }>;
}

type GitHubStateStoreOptions = GitHubRuntimeOptions & {
  owner: string;
  repository: string;
  token: string;
  githubRepository?: string;
  branch?: string;
  path?: string;
  baseRef?: string;
};

export function createGitHubStateStore(input: GitHubStateStoreOptions): GitHubStateStore {
  assertIdentity(input.owner, 'owner');
  assertIdentity(input.repository, 'repository');
  if (!input.token.trim()) throw new Error('Same-repository GITHUB_TOKEN is required for state.');
  const expectedRepository = `${input.owner}/${input.repository}`;
  if (input.githubRepository && input.githubRepository !== expectedRepository) {
    throw new Error('State GITHUB_TOKEN may only be used with the same repository.');
  }
  const options = {
    transport: input.transport,
    apiBase: apiBase(input.apiBase),
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
  const root = repoPath(input.owner, input.repository);
  const branch = input.branch ?? STATE_BRANCH;
  const path = input.path ?? STATE_PATH;
  const baseRef = input.baseRef ?? 'seo-campaign';
  const contentsPath = `${root}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;
  return {
    async load() {
      const response = await requestWithTimeout(options.transport, {
        method: 'GET',
        url: `${options.apiBase}${contentsPath}`,
        headers: authHeaders(input.token),
      }, options.timeoutMs);
      if (response.status === 404) return { state: createPersistentWorkerState(), version: null };
      if (response.status !== 200) throw new Error(`State load failed with HTTP ${response.status}.`);
      const body = record(response.body, 'GitHub state file');
      const content = decodeBlob(body);
      if (containsSecretLikeValue(content)) throw new Error('Persistent state contains a secret-like value.');
      return {
        state: PersistentWorkerStateSchema.parse(JSON.parse(content)),
        version: string(body.sha, 'GitHub state file SHA'),
      };
    },
    async save(stateInput, expectedVersion) {
      const state = compactPersistentWorkerState(PersistentWorkerStateSchema.parse(stateInput));
      if (containsSecretLikeValue(state)) throw new Error('Persistent state contains a secret-like value.');
      const content = Buffer.from(`${JSON.stringify(state)}\n`).toString('base64');
      if (expectedVersion === null) {
        const baseResponse = await requestGitHub(options, input.token, 'GET', `${root}/git/ref/heads/${encodeURIComponent(baseRef)}`);
        const object = record(record(baseResponse.body, 'GitHub state base ref').object, 'GitHub state base object');
        const baseSha = string(object.sha, 'GitHub state base SHA');
        const createResponse = await requestWithTimeout(options.transport, {
          method: 'POST',
          url: `${options.apiBase}${root}/git/refs`,
          headers: { ...authHeaders(input.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
        }, options.timeoutMs);
        if (![201, 422].includes(createResponse.status)) throw new Error('State branch initialization failed.');
      }
      const response = await requestWithTimeout(options.transport, {
        method: 'PUT',
        url: `${options.apiBase}${root}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,
        headers: { ...authHeaders(input.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'chore(autoblogger): update compact worker state',
          content,
          branch,
          ...(expectedVersion === null ? {} : { sha: expectedVersion }),
        }),
      }, options.timeoutMs);
      if ([409, 422].includes(response.status)) throw new Error('Persistent state update conflict; rerun after reloading state.');
      if (![200, 201].includes(response.status)) throw new Error(`Persistent state update failed with HTTP ${response.status}.`);
      const result = record(response.body, 'GitHub state update');
      const updated = record(result.content, 'GitHub state content result');
      return { version: string(updated.sha, 'GitHub state content SHA') };
    },
  };
}
