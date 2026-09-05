import matter from 'gray-matter';
import { z } from 'zod';

import { AutobloggerStateSchema, createAutobloggerState } from './state';
import { CandidateSchema } from './domain';
import { containsSecretLikeValue, redactSensitive } from './secrets';
import { requestWithTimeout, type HttpRequest, type HttpResponse, type HttpTransport } from './http';
import type {
  GitHubPublisherBoundary,
  GitHubTargetSnapshot,
  PreparedCommit,
} from './publisher';

const DEFAULT_GITHUB_API = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const DEFAULT_TIMEOUT_MS = 20_000;
const STATE_PATH = 'state.json';
const STATE_BRANCH = 'autoblogger-state';
const SAFE_IDENTITY = /^[A-Za-z0-9_.-]+$/;

const CompactFailureSchema = z.object({
  runId: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(120),
  attempt: z.number().int().min(1).max(3),
  observedAt: z.string().datetime(),
  detail: z.string().trim().min(1).max(500),
}).strict();

const CompactProvenanceSchema = z.object({
  runId: z.string().trim().min(1).max(160),
  datasetId: z.string().trim().min(1).max(160),
  provider: z.enum(['pending', 'semrush', 'ahrefs']),
  observedAt: z.string().datetime(),
}).strict();

export const PersistentWorkerStateSchema = AutobloggerStateSchema.extend({
  manualPilot: z.object({
    runId: z.string().trim().min(1).max(160),
    consumedAt: z.string().datetime(),
  }).strict().nullable(),
  queuedCandidates: z.array(CandidateSchema).max(500),
  candidateFingerprints: z.array(z.string().trim().min(1).max(500)).max(20_000),
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
    provenance: {},
    contentHashes: {},
    pullRequests: {},
    failures: [],
  });
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
    if (/rel="next"/iu.test(response.headers.link ?? '')) {
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

function parseArticle(content: string): { id?: string; slug?: string; title?: string; primaryKeyword?: string } {
  const data = matter(content).data as Record<string, unknown>;
  const result: { id?: string; slug?: string; title?: string; primaryKeyword?: string } = {};
  for (const key of ['id', 'slug', 'title', 'primaryKeyword'] as const) {
    if (typeof data[key] === 'string' && data[key].trim()) result[key] = data[key].trim();
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
        requestGitHub(options, auth.token, 'GET', `${root}/git/matching-refs/heads/autoblog/`),
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
      const branches = Array.isArray(branchResponse.body) ? branchResponse.body : [];
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
      const openPullRequests = pullsResponse.body
        .map((entry) => parsePullRequest(entry))
        .filter(({ headRef }) => headRef.startsWith('autoblog/'));
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
      await requestGitHub(options, auth.token, 'POST', `${repoPath(owner, repository)}/git/refs`, {
        ref: `refs/heads/${headRef}`,
        sha: commitSha,
      }, [201]);
    },
    async createDraftPullRequest({ owner, repository, baseRef, headRef, title, body, draft, bundleHash, auth }) {
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
      const state = PersistentWorkerStateSchema.parse(stateInput);
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
