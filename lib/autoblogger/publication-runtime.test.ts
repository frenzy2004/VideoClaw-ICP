import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { candidateFingerprints, type Candidate } from './domain';
import { createPersistentWorkerState, type GitHubStateStore } from './github-runtime';
import { createPreparedPublicationRuntime } from './publication-runtime';
import type { GitHubTargetSnapshot, Publisher, ValidationReport } from './publisher';
import { markCandidateCompleted, markCandidateScanned, reserveCandidate } from './recovery';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'autoblogger-publish-'));
  const at = '2026-09-05T00:00:00.000Z';
  const candidate: Candidate = { schemaVersion: 1, articleId: 'vc-c1-001', campaignId: 'newly-funded-founder', icp: 'founder launch video', primaryKeyword: 'founder launch video', secondaryKeywords: [], title: 'Founder Launch Video', slug: 'founder-launch-video', intent: 'informational', funnelStage: 'top' };
  const fingerprints = candidateFingerprints(candidate);
  const metrics = { schemaVersion: 1, provider: 'semrush', observedAt: at, volume: 100, difficulty: 20, cpc: null, intent: 'informational' };
  const keyword = { provider: 'semrush', endpoint: 'https://api.semrush.com/', observedAt: at, providerRequestId: null, sourceObservedAt: null };
  const envelope = {
    schemaVersion: 1, runId: 'run-1',
    bundle: { schemaVersion: 1, candidateFingerprint: fingerprints.candidate, article: { id: candidate.articleId, slug: candidate.slug, keywordMetrics: metrics }, markdown: 'prepared Markdown', svg: '<svg/>' },
    keywordMetrics: metrics,
    origin: {
      candidate,
      evidence: { schemaVersion: 2, candidateFingerprint: fingerprints.candidate, signals: { autocomplete: ['founder launch video'], peopleAlsoAsk: [], relatedSearches: [] }, serp: { organicResultCount: 2, peopleAlsoAsk: ['one', 'two', 'three'] }, sources: [{ originalUrl: 'https://a.example/', finalUrl: 'https://a.example/', authoritative: true }, { originalUrl: 'https://b.example/', finalUrl: 'https://b.example/', authoritative: false }], faqQuestions: ['one', 'two', 'three'] },
      provenance: { apifyRunId: 'serp-run', apifyDatasetId: 'serp-data', query: candidate.primaryKeyword, locale: 'en-US', capturedAt: '2026-09-05' },
      keywordProvenance: keyword,
      approvedMedia: { product: [], editorialGraphics: [] },
    },
  };
  const file = join(root, `${candidate.slug}.publication.json`);
  await writeFile(file, JSON.stringify(envelope));
  let state = markCandidateScanned(createPersistentWorkerState(), candidate, 'run-1', at);
  state = reserveCandidate(state, candidate, 'run-1', 'scheduled', at);
  state = markCandidateCompleted(state, candidate, 'run-1', 'artifact_prepared', at);
  state.runs['run-1'] = { schemaVersion: 1, runId: 'run-1', mode: 'scheduled', status: 'validated', startedAt: at, selectedCandidateFingerprints: [fingerprints.candidate] };
  state.contentHashes[fingerprints.candidate] = createHash('sha256').update(JSON.stringify(envelope.bundle)).digest('hex');
  state.provenance[fingerprints.candidate] = { serp: { runId: 'serp-run', datasetId: 'serp-data', observedAt: at }, keyword: keyword as never };
  let version = 1;
  const save = vi.fn<GitHubStateStore['save']>(async (next, expected) => {
    if (expected !== String(version)) throw new Error('state conflict');
    state = structuredClone(next); version += 1; return { version: String(version) };
  });
  const store: GitHubStateStore = { load: async () => ({ state: structuredClone(state), version: String(version) }), save };
  const validation: ValidationReport = { status: 'passed', cleanup: 'completed', bundleHash: state.contentHashes[fingerprints.candidate], landerRef: 'main', commands: [] };
  const validateBundle = vi.fn<Publisher['validateBundle']>(async () => validation);
  const openDraftPullRequest = vi.fn<Publisher['openDraftPullRequest']>(async (input) => {
    expect(input.validation).toBe(validation);
    expect(input.origin).toEqual(envelope.origin);
    expect(input.keywordMetrics).toEqual(metrics);
    expect(state.decisions[fingerprints.candidate]).toMatchObject({ status: 'manual_attention', reason: 'publication_in_progress' });
    return { status: 'opened', number: 101, url: 'https://github.com/owner/lander/pull/101', headRef: 'autoblog/2026-09-05-founder-launch-video' };
  });
  const snapshot: GitHubTargetSnapshot = { baseRef: 'main', baseSha: 'a'.repeat(40), blogLaunch: { pullRequestNumber: 55, state: 'merged', baseRef: 'main', mergeCommitIncludedInBase: true }, branchRefs: [], existingArticles: [], openPullRequests: [] };
  const inspectTarget = vi.fn(async () => snapshot);
  const options = { root, preparedDir: root, maxDrafts: 1 as const, landerRef: 'main', auth: { kind: 'github_app_installation' as const, token: `ghs_${'fixture'.repeat(4)}`, expiresAt: '2026-09-05T00:40:00.000Z' }, stateToken: 'state-token', stateStore: store, publisher: { validateBundle, openDraftPullRequest }, inspectTarget, now: () => new Date(at) };
  return { root, file, envelope, fingerprints, get state() { return state; }, save, options, validateBundle, openDraftPullRequest, inspectTarget, snapshot };
}

describe('prepared publication runtime', () => {
  it('revalidates on the publishing instance, reserves before writing, persists PR outcome, and blocks replay', async () => {
    const f = await fixture();
    const runtime = createPreparedPublicationRuntime(f.options);
    const report = await runtime.execute({ command: 'run', runId: 'run-1' });
    expect(report).toMatchObject({ status: 'pr_opened', counts: { drafted: 0, pullRequestsOpened: 1 } });
    expect(f.validateBundle).toHaveBeenCalledWith(f.envelope.bundle);
    expect(f.state.pullRequests[f.fingerprints.candidate]).toMatchObject({ number: 101 });
    await expect(runtime.execute({ command: 'run', runId: 'run-1' })).rejects.toThrow(/prepared|replay/i);
    expect(f.openDraftPullRequest).toHaveBeenCalledTimes(1);
  });

  it.each(['bundle', 'run', 'candidate', 'decision', 'provenance', 'missing', 'uncertain'] as const)('blocks mismatched %s before validation or publication', async (change) => {
    const f = await fixture();
    if (change === 'bundle') f.envelope.bundle.markdown = 'tampered';
    if (change === 'run') f.envelope.runId = 'different-run';
    if (change === 'candidate') f.envelope.origin.candidate.articleId = 'vc-c1-002';
    if (change === 'decision') f.state.decisions[f.fingerprints.candidate].reason = 'candidate_failed';
    if (change === 'provenance') f.envelope.origin.provenance.apifyRunId = 'other-run';
    if (change === 'missing') delete f.state.contentHashes[f.fingerprints.candidate];
    if (change === 'uncertain') f.state.decisions[f.fingerprints.candidate].status = 'manual_attention';
    await writeFile(f.file, JSON.stringify(f.envelope));
    await expect(createPreparedPublicationRuntime(f.options).execute({ command: 'run', runId: 'run-1' })).rejects.toThrow();
    expect(f.validateBundle).not.toHaveBeenCalled();
    expect(f.openDraftPullRequest).not.toHaveBeenCalled();
  });

  it.each(['expired', 'pat', 'state-token', 'main', 'unmerged'] as const)('checks %s access before publication', async (change) => {
    const f = await fixture();
    if (change === 'expired') f.options.auth.expiresAt = '2026-09-04T00:00:00.000Z';
    if (change === 'pat') f.options.auth.token = `ghp_${'fixture'.repeat(4)}`;
    if (change === 'state-token') f.options.stateToken = f.options.auth.token;
    if (change === 'main') f.options.landerRef = 'feature';
    if (change === 'unmerged') f.snapshot.blogLaunch.mergeCommitIncludedInBase = false;
    await expect(async () => createPreparedPublicationRuntime(f.options).execute({ command: 'run', runId: 'run-1' })).rejects.toThrow();
    if (change !== 'unmerged') expect(f.inspectTarget).not.toHaveBeenCalled();
    expect(f.openDraftPullRequest).not.toHaveBeenCalled();
  });

  it('does not publish after a state conflict or failed validation', async () => {
    const f = await fixture();
    f.save.mockRejectedValue(new Error('state conflict'));
    await expect(createPreparedPublicationRuntime(f.options).execute({ command: 'run', runId: 'run-1' })).rejects.toThrow(/conflict/);
    expect(f.openDraftPullRequest).not.toHaveBeenCalled();
    f.validateBundle.mockResolvedValue({ status: 'failed', cleanup: 'completed', landerRef: 'main', bundleHash: '', commands: [] });
    await expect(createPreparedPublicationRuntime(f.options).execute({ command: 'run', runId: 'run-1' })).rejects.toThrow(/validation/i);
    expect(f.openDraftPullRequest).not.toHaveBeenCalled();
  });

  it('retains uncertain publication state and rejects a retry without redrafting', async () => {
    const f = await fixture();
    f.openDraftPullRequest.mockResolvedValue({ status: 'reconciliation_required', reason: 'pull_request_state_uncertain', headRef: 'autoblog/uncertain' });
    const runtime = createPreparedPublicationRuntime(f.options);
    expect(await runtime.execute({ command: 'run', runId: 'run-1' })).toMatchObject({ status: 'failed' });
    expect(f.state.decisions[f.fingerprints.candidate]).toMatchObject({ status: 'manual_attention', reason: 'reconciliation_required' });
    await expect(runtime.execute({ command: 'run', runId: 'run-1' })).rejects.toThrow();
    expect(f.openDraftPullRequest).toHaveBeenCalledTimes(1);
  });

  it('preserves the durable reservation when state writes fail after GitHub accepts a PR', async () => {
    const f = await fixture();
    const save = f.save.getMockImplementation()!;
    let saves = 0;
    f.save.mockImplementation(async (...args) => {
      if (++saves > 1) throw new Error('state acknowledgement lost');
      return await save(...args);
    });
    const runtime = createPreparedPublicationRuntime(f.options);
    await expect(runtime.execute({ command: 'run', runId: 'run-1' })).rejects.toThrow(/acknowledgement/);
    expect(f.state.decisions[f.fingerprints.candidate]).toMatchObject({ status: 'manual_attention', reason: 'publication_in_progress' });
    await expect(runtime.execute({ command: 'run', runId: 'run-1' })).rejects.toThrow();
    expect(f.openDraftPullRequest).toHaveBeenCalledTimes(1);
  });
});
