import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';

import type { AutobloggerCliRuntime } from './cli';
import { CandidateSchema, DraftBundleSchema, EvidenceBundleSchema, KeywordMetricsSchema, candidateFingerprints } from './domain';
import { compactPersistentWorkerState, type GitHubStateStore, type PersistentWorkerState } from './github-runtime';
import { RUN_LIMITS, evaluateEligibility } from './policies';
import type { GitHubAppInstallationAuth, GitHubTargetSnapshot, Publisher } from './publisher';
import { containsSecretLikeValue, redactSensitive } from './secrets';
import type { AutobloggerRunReport } from './worker';

// This is a transport envelope, not a second lander article schema. The exact
// bundle is authorized by durable worker state and the lander's native checks.
export const PreparedPublicationSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u),
  bundle: DraftBundleSchema,
  keywordMetrics: KeywordMetricsSchema,
  origin: z.object({
    candidate: CandidateSchema,
    evidence: EvidenceBundleSchema,
    provenance: z.object({ apifyRunId: z.string().min(1), apifyDatasetId: z.string().min(1), query: z.string().min(1), locale: z.literal('en-US'), capturedAt: z.string().min(1) }).strict(),
    keywordProvenance: z.object({
      provider: z.enum(['pending', 'semrush', 'ahrefs', 'similarweb']), endpoint: z.string().url().nullable(),
      observedAt: z.string().datetime().nullable(), providerRequestId: z.string().nullable(), sourceObservedAt: z.string().nullable(),
    }).strict(),
    approvedMedia: z.object({
      product: z.array(z.object({ src: z.string(), poster: z.string() }).strict()),
      editorialGraphics: z.array(z.string()),
    }).strict(),
  }).strict(),
}).strict();

type PreparedPublication = z.infer<typeof PreparedPublicationSchema>;

export function assertPublicationAuth(auth: GitHubAppInstallationAuth, stateToken: string, now: Date): void {
  const remaining = Date.parse(auth.expiresAt) - now.getTime();
  if (auth.kind !== 'github_app_installation' || !/^ghs_[A-Za-z0-9_]{16,}$/u.test(auth.token)
    || auth.token === stateToken || auth.token === process.env.GITHUB_TOKEN
    || !z.string().datetime().safeParse(auth.expiresAt).success
    || !Number.isFinite(remaining) || remaining <= 30_000 || remaining > 2 * 60 * 60_000) {
    throw new Error('Publication requires a valid, unexpired lander GitHub App token distinct from the state token.');
  }
}

async function loadPrepared(directory: string, root: string, maximum: number): Promise<PreparedPublication[]> {
  const base = resolve(root);
  const target = resolve(base, directory);
  const rel = relative(base, target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('Prepared directory must remain inside the runtime root.');
  let current = base;
  for (const part of ['', ...rel.split(sep).filter(Boolean)]) {
    current = resolve(current, part);
    const metadata = await lstat(current);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error('Prepared directory must not contain symlinks.');
  }
  const names = (await readdir(target)).filter((name) => name.endsWith('.publication.json')).sort();
  if (names.length === 0 || names.length > maximum) throw new Error('Prepared publication count is empty or exceeds max-drafts.');
  return await Promise.all(names.map(async (name) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.publication\.json$/u.test(name)) throw new Error('Unsafe prepared artifact filename.');
    const path = resolve(target, name);
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 5_000_000) throw new Error('Prepared artifact must be a bounded regular file.');
    const raw = await readFile(path, 'utf8');
    if (containsSecretLikeValue(raw)) throw new Error('Prepared artifact contains a secret-like value.');
    const prepared = PreparedPublicationSchema.parse(JSON.parse(raw));
    if (name !== `${prepared.origin.candidate.slug}.publication.json`) throw new Error('Prepared candidate filename mismatch.');
    return prepared;
  }));
}

function assertPreparedState(state: PersistentWorkerState, runId: string, prepared: PreparedPublication[]): void {
  const run = state.runs[runId];
  if (!run || run.runId !== runId || run.mode !== 'scheduled' || run.status !== 'validated') {
    throw new Error('Run has no publishable prepared state; replay and failed runs are blocked.');
  }
  if (Object.values(state.decisions).some((decision) => decision.status === 'manual_attention'
    && ['publication_in_progress', 'reconciliation_required'].includes(decision.reason))) {
    throw new Error('Uncertain publication requires reconciliation before further publication.');
  }
  const expected = run.selectedCandidateFingerprints.filter((key) => {
    const decision = state.decisions[key];
    return decision?.runId === runId && decision.status === 'completed' && decision.reason === 'artifact_prepared';
  }).sort();
  const supplied = prepared.map(({ bundle }) => bundle.candidateFingerprint).sort();
  if (expected.length === 0 || new Set(supplied).size !== supplied.length || !isDeepStrictEqual(expected, supplied)) {
    throw new Error('Prepared artifacts do not exactly match the stored prepared candidate decisions.');
  }
  for (const item of prepared) {
    const ids = candidateFingerprints(item.origin.candidate);
    const key = ids.candidate;
    const decision = state.decisions[key];
    const provenance = state.provenance[key];
    if (item.runId !== runId || item.bundle.candidateFingerprint !== key || item.origin.evidence.candidateFingerprint !== key
      || !decision || decision.runId !== runId || decision.status !== 'completed' || decision.reason !== 'artifact_prepared'
      || decision.leaseExpiresAt !== null || decision.articleId !== item.origin.candidate.articleId || decision.intentFingerprint !== ids.intent
      || !isDeepStrictEqual([...decision.identities].sort(), Object.values(ids).sort())
      || state.pullRequests[key]
      || state.contentHashes[key] !== createHash('sha256').update(JSON.stringify(item.bundle)).digest('hex')) {
      throw new Error('Prepared bundle hash, candidate, or decision does not match persistent state.');
    }
    if (!provenance || !isDeepStrictEqual(provenance.keyword, item.origin.keywordProvenance)
      || provenance.serp.runId !== item.origin.provenance.apifyRunId
      || provenance.serp.datasetId !== item.origin.provenance.apifyDatasetId
      || provenance.serp.observedAt.slice(0, 10) !== item.origin.provenance.capturedAt
      || item.origin.provenance.query !== item.origin.candidate.primaryKeyword
      || item.keywordMetrics.provider !== provenance.keyword.provider
      || item.keywordMetrics.observedAt !== provenance.keyword.observedAt) {
      throw new Error('Prepared provenance does not match persistent state.');
    }
    if (!['semrush', 'ahrefs'].includes(item.keywordMetrics.provider)
      || !evaluateEligibility(item.origin.candidate, item.origin.evidence, item.keywordMetrics, 'scheduled').eligible) {
      throw new Error('Prepared publication requires complete paid metrics and eligible evidence.');
    }
  }
}

export function createPreparedPublicationRuntime(options: {
  root: string;
  preparedDir: string;
  maxDrafts: 1 | 2 | 3;
  landerRef: string;
  auth: GitHubAppInstallationAuth;
  stateToken: string;
  stateStore: GitHubStateStore;
  publisher: Publisher;
  inspectTarget(): Promise<GitHubTargetSnapshot>;
  now?: () => Date;
}): AutobloggerCliRuntime {
  const now = options.now ?? (() => new Date());
  return {
    validate: async () => { throw new Error('Use validate separately; publish always revalidates prepared bundles.'); },
    async execute({ command, runId }) {
      if (command !== 'run' || options.landerRef !== 'main') throw new Error('Publication requires run against main with merged PR #55.');
      assertPublicationAuth(options.auth, options.stateToken, now());
      const prepared = await loadPrepared(options.preparedDir, options.root, options.maxDrafts);
      const loaded = await options.stateStore.load();
      const state = loaded.state;
      let version = loaded.version;
      assertPreparedState(state, runId, prepared);
      // Authenticate before the first cross-repository request, then fail before
      // native installs if PR #55 is not actually included in main.
      const snapshot = await options.inspectTarget();
      if (snapshot.baseRef !== 'main' || snapshot.blogLaunch.pullRequestNumber !== 55
        || snapshot.blogLaunch.state !== 'merged' || snapshot.blogLaunch.baseRef !== 'main'
        || !snapshot.blogLaunch.mergeCommitIncludedInBase) throw new Error('PR #55 must be merged and included in main.');
      const report: AutobloggerRunReport = {
        schemaVersion: 1, command: 'run', runId, mode: 'scheduled', status: 'failed', startedAt: now().toISOString(), completedAt: now().toISOString(), limits: RUN_LIMITS,
        counts: { queued: 0, scanned: 0, shallowValidated: 0, metricsEnriched: 0, deepInspected: 0, eligible: prepared.length, drafted: 0, validated: 0, pullRequestsOpened: 0 },
        artifacts: [], failures: [],
      };
      for (const item of prepared) {
        const validation = await options.publisher.validateBundle(item.bundle);
        if (validation.status !== 'passed') throw new Error(`Prepared bundle validation failed: ${validation.failure ?? 'native checks failed'}`);
        const key = item.bundle.candidateFingerprint;
        const serp = state.provenance[key].serp;
        report.counts.validated += 1;
        report.artifacts.push({ candidateFingerprint: key, intentFingerprint: candidateFingerprints(item.origin.candidate).intent,
          articleId: item.origin.candidate.articleId, slug: item.origin.candidate.slug, icp: item.origin.candidate.icp,
          publication: 'artifact_only', bundle: item.bundle, validation, metrics: item.keywordMetrics,
          publicationOrigin: item.origin, keywordProvenance: item.origin.keywordProvenance,
          serpProvenance: { actorId: 'publication-from-state', ...serp },
        });
      }
      // A CAS reservation precedes all remote mutations. It deliberately has no
      // retry lease: a crash may occur after GitHub accepted the PR request.
      for (const { bundle } of prepared) {
        const key = bundle.candidateFingerprint;
        state.decisions[key] = { ...state.decisions[key], status: 'manual_attention', reason: 'publication_in_progress', updatedAt: now().toISOString(), leaseExpiresAt: null };
      }
      state.runs[runId] = { ...state.runs[runId], status: 'failed' };
      ({ version } = await options.stateStore.save(compactPersistentWorkerState(state), version));
      for (const artifact of report.artifacts) {
        const key = artifact.candidateFingerprint;
        try {
          assertPublicationAuth(options.auth, options.stateToken, now());
          // The exact validation object is retained, never deserialized.
          const result = await options.publisher.openDraftPullRequest({ bundle: artifact.bundle, validation: artifact.validation,
            mode: 'scheduled', keywordMetrics: artifact.metrics, origin: artifact.publicationOrigin, auth: options.auth });
          if (result.status !== 'opened' && result.status !== 'already_exists') throw new Error(`Publication stopped: ${result.status} (${result.reason}).`);
          artifact.publication = result.status;
          artifact.pullRequest = { number: result.number, url: result.url, headRef: result.headRef };
          if (result.status === 'opened') report.counts.pullRequestsOpened += 1;
          state.pullRequests[key] = { number: result.number, url: result.url, status: result.status };
          state.decisions[key] = { ...state.decisions[key], status: 'completed', reason: `pull_request_${result.status}`, updatedAt: now().toISOString() };
          ({ version } = await options.stateStore.save(compactPersistentWorkerState(state), version));
        } catch (error) {
          artifact.publication = 'reconciliation_required';
          const detail = redactSensitive(error, [options.auth.token, options.stateToken]).slice(0, 500);
          state.decisions[key] = { ...state.decisions[key], status: 'manual_attention', reason: 'reconciliation_required', updatedAt: now().toISOString() };
          state.failures = [...state.failures, { runId, code: 'reconciliation_required', attempt: 1, observedAt: now().toISOString(), detail }].slice(-100);
          // If this save also fails, the earlier durable in-progress marker still
          // blocks replay. Do not turn a lost state acknowledgement into a retry.
          await options.stateStore.save(compactPersistentWorkerState(state), version);
          report.failures.push({ candidateFingerprint: key, code: 'reconciliation_required', detail, retryable: false });
          report.completedAt = now().toISOString();
          return report;
        }
      }
      state.runs[runId] = { ...state.runs[runId], status: 'pr_opened' };
      await options.stateStore.save(compactPersistentWorkerState(state), version);
      report.status = 'pr_opened';
      report.completedAt = now().toISOString();
      return report;
    },
  };
}
