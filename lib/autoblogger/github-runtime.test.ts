import { describe, expect, it } from 'vitest';

import type { HttpRequest, HttpResponse, HttpTransport } from './http';
import {
  createGitHubPublisherBoundary,
  createGitHubStateStore,
  createPersistentWorkerState,
  PersistentWorkerStateSchema,
  compactPersistentWorkerState,
  PaaObservationsSchema,
  ResearchProvenanceSchema,
  retireDiagnosticHistory,
} from './github-runtime';
import { CandidateSchema, candidateFingerprints } from './domain';
import { grantManualRetryApproval, grantManualTargetSwitch, reserveCandidate, markCandidateFailure } from './recovery';
import { successfulDiagnosticFixture } from './test-fixtures/diagnostic-history';

const auth = {
  kind: 'github_app_installation' as const,
  token: 'ghs_synthetic_fixture_token_123456',
  expiresAt: '2026-09-05T12:00:00.000Z',
};

function queuedTransport(responses: HttpResponse[]) {
  const requests: HttpRequest[] = [];
  const transport: HttpTransport = async (request) => {
    requests.push(request);
    const response = responses.shift();
    if (!response) throw new Error('Unexpected request.');
    return response;
  };
  return { transport, requests };
}

const json = (body: unknown, status = 200): HttpResponse => ({ status, headers: {}, body });

it('retains at most two SERP collection attempts in full and persistent provenance', () => {
  const collection = { actorId: 'actor', runId: 'retry', datasetId: 'dataset', observedAt: '2026-09-06T21:00:00.000Z' };
  const attempts = [{ ...collection, runId: 'first-empty' }, collection];
  const full = { discovery: collection, serp: collection, serpAttempts: attempts };
  expect(ResearchProvenanceSchema.parse(full).serpAttempts).toEqual(attempts);
  const state = createPersistentWorkerState();
  state.provenance['candidate:test'] = { serp: { runId: collection.runId, datasetId: collection.datasetId, observedAt: collection.observedAt },
    keyword: { provider: 'pending', endpoint: null, observedAt: null, providerRequestId: null, sourceObservedAt: null }, serpAttempts: attempts };
  expect(PersistentWorkerStateSchema.parse(state).provenance['candidate:test'].serpAttempts).toEqual(attempts);
  expect(ResearchProvenanceSchema.safeParse({ ...full, serpAttempts: [...attempts, collection] }).success).toBe(false);
  state.provenance['candidate:test'].serpAttempts = [...attempts, collection];
  expect(PersistentWorkerStateSchema.safeParse(state).success).toBe(false);
});

describe('one-use manual retry state validation', () => {
  const candidate = CandidateSchema.parse({
    schemaVersion: 1, articleId: 'vc-c2-001', campaignId: 'accelerator-demo-day-founder', icp: 'founder',
    primaryKeyword: 'demo day video checklist', secondaryKeywords: [], title: 'Demo Day Video Checklist',
    slug: 'demo-day-video-checklist', intent: 'informational', funnelStage: 'top',
  });
  const fp = candidateFingerprints(candidate);
  const before = '2026-09-06T20:00:00.000Z';
  const at = '2026-09-06T21:00:00.000Z';
  function approvedState(consumed = false) {
    return {
      ...createPersistentWorkerState(),
      decisions: { [fp.candidate]: {
        articleId: candidate.articleId, identities: Object.values(fp), intentFingerprint: fp.intent,
        status: 'terminal', reason: 'candidate_failed', attempts: consumed ? 4 : 3,
        runId: consumed ? 'new-run' : 'prior-run', updatedAt: consumed ? at : before, leaseExpiresAt: null,
      } },
      runs: { 'prior-run': { schemaVersion: 1, runId: 'prior-run', mode: 'manual_pilot', startedAt: before, selectedCandidateFingerprints: [fp.candidate], status: 'failed' } },
      failures: [
        { runId: 'prior-run', code: 'candidate_failed', attempt: 3, observedAt: before, detail: 'Prior failure.' },
        ...(consumed ? [{ runId: 'new-run', code: 'candidate_failed', attempt: 4, observedAt: at, detail: 'New failure.', candidateFingerprint: fp.candidate }] : []),
      ],
      manualRetryApproval: {
        mode: 'manual_pilot', articleId: 'vc-c2-001', candidateFingerprint: fp.candidate, identities: Object.values(fp),
        priorRunId: 'prior-run', runId: 'new-run', reason: 'User authorized one artifact-only retry.', approvedAt: at, consumedAt: consumed ? at : null,
      },
    };
  }

  it.each(['failures', 'runs', 'decisions'])('pins both independent approval histories within the existing %s bound', (kind) => {
    const parked = PersistentWorkerStateSchema.parse(approvedState());
    const target = CandidateSchema.parse({ ...candidate, articleId: 'vc-c1-d-ab0e55b1dd7f78fa', campaignId: 'newly-funded-founder',
      primaryKeyword: 'product demo checklist', title: 'Plan a Product Demo Checklist', slug: 'product-demo-checklist' });
    const targetFp = candidateFingerprints(target).candidate;
    let state = grantManualTargetSwitch(parked, target, { parkedRetryRunId: 'new-run', runId: 'alternative', approvedAt: at });
    state = reserveCandidate(state, target, 'alternative', 'manual_pilot', at);
    state = markCandidateFailure(state, target, 'alternative', 'candidate_failed', false, at);
    state.runs.alternative = { schemaVersion: 1, runId: 'alternative', mode: 'manual_pilot', startedAt: at, selectedCandidateFingerprints: [targetFp], status: 'failed' };
    state.failures.push({ runId: 'alternative', candidateFingerprint: targetFp, code: 'candidate_failed', attempt: 1, observedAt: at, detail: 'Alternative failure.' });
    const before = structuredClone(state);
    for (let index = 0; index < (kind === 'decisions' ? 5_001 : kind === 'runs' ? 501 : 100); index += 1) {
      const runId = `unrelated-${index}`;
      const date = '2026-09-07T00:00:00.000Z';
      if (kind === 'decisions') state.decisions[`u:${index}`] = { articleId: 'old', intentFingerprint: `intent:${'a'.repeat(64)}`, identities: ['a', 'b', 'c', 'd', 'e', 'f'],
        status: 'terminal', reason: 'done', attempts: 3, runId: 'old', updatedAt: date, leaseExpiresAt: null };
      if (kind === 'runs') state.runs[runId] = { ...state.runs.alternative, runId, startedAt: date, selectedCandidateFingerprints: [] };
      if (kind === 'failures') state.failures.push({ runId, code: 'candidate_failed', attempt: 1, observedAt: date, detail: 'Unrelated failure.' });
    }
    const compacted = compactPersistentWorkerState(state);
    expect(Object.keys(compacted.runs)).toHaveLength(kind === 'runs' ? 500 : 2);
    expect(Object.keys(compacted.decisions)).toHaveLength(kind === 'decisions' ? 5_000 : 2);
    expect(compacted.failures).toHaveLength(kind === 'failures' ? 100 : 2);
    expect(compacted.failures.slice(0, 2)).toEqual(before.failures);
    expect(compacted.runs.alternative).toEqual(before.runs.alternative);
    expect(compacted.runs['prior-run']).toEqual(before.runs['prior-run']);
    expect(compacted.decisions[targetFp]).toEqual(before.decisions[targetFp]);
    expect(compacted.decisions[fp.candidate]).toEqual(before.decisions[fp.candidate]);
    expect(JSON.stringify(compacted.manualRetryApproval)).toBe(JSON.stringify(parked.manualRetryApproval));
    expect(compacted.manualTargetSwitch).toEqual(before.manualTargetSwitch);
    expect(PersistentWorkerStateSchema.safeParse(compacted).success).toBe(true);
  });

  it.each([false, true])('round-trips the exact audited grant (consumed: %s)', (consumed) => {
    const state = approvedState(consumed);
    const parsed = PersistentWorkerStateSchema.parse(state);
    expect(compactPersistentWorkerState(parsed)).toMatchObject(state);
  });

  function historicalProjection(status: 'selected' | 'researched') {
    const state = PersistentWorkerStateSchema.parse(approvedState());
    delete state.manualRetryApproval;
    state.candidates[fp.candidate] = { mode: 'manual_pilot', status, runId: 'older-failed-run', updatedAt: '2026-09-06T18:28:51.779Z' };
    state.runs['older-failed-run'] = { schemaVersion: 1, runId: 'older-failed-run', mode: 'manual_pilot',
      status: 'failed', startedAt: '2026-09-06T18:28:40.602Z', selectedCandidateFingerprints: [fp.candidate] };
    return state;
  }
  const grant = { priorRunId: 'prior-run', runId: 'new-run', reason: 'user_authorized_after_input_fix', approvedAt: at };

  it.each(['selected', 'researched'] as const)('allows a historical %s projection linked to an older failed manual run without rewriting history', (status) => {
    const state = historicalProjection(status);
    const original = structuredClone(state);
    const approved = grantManualRetryApproval(state, candidate, grant);
    const compacted = compactPersistentWorkerState(approved);
    for (const key of ['candidates', 'decisions', 'runs', 'failures', 'contentHashes', 'pullRequests'] as const) {
      expect(compacted[key]).toEqual(original[key]);
    }
    expect(compacted.manualRetryApproval?.consumedAt).toBeNull();
    expect(state).toEqual(original);
  });

  it('allows the historical projection timestamp at the latest failed decision boundary', () => {
    const state = historicalProjection('researched');
    state.candidates[fp.candidate].updatedAt = before;
    expect(grantManualRetryApproval(state, candidate, grant).candidates).toEqual(state.candidates);
  });

  it.each(['drafted', 'validated', 'pr_opened', 'newer', 'scheduled-projection', 'failed-scheduled', 'failed-newer', 'scheduled-run', 'successful-run', 'missing-run', 'wrong-run-id', 'different-candidate', 'later-run', 'before-run', 'artifact', 'pr', 'pilot'])(
    'rejects contradictory historical projection: %s', (problem) => {
      const state = historicalProjection('researched');
      const projection = state.candidates[fp.candidate];
      const run = state.runs[projection.runId];
      if (problem === 'drafted' || problem === 'validated' || problem === 'pr_opened') projection.status = problem;
      if (problem === 'newer') projection.updatedAt = '2026-09-06T20:00:00.001Z';
      if (problem === 'scheduled-projection') projection.mode = 'scheduled';
      if (problem === 'failed-scheduled' || problem === 'failed-newer') projection.status = 'failed';
      if (problem === 'failed-scheduled') projection.mode = 'scheduled';
      if (problem === 'failed-newer') projection.updatedAt = '2026-09-06T20:00:00.001Z';
      if (problem === 'scheduled-run') run.mode = 'scheduled';
      if (problem === 'successful-run') run.status = 'validated';
      if (problem === 'missing-run') delete state.runs[projection.runId];
      if (problem === 'wrong-run-id') run.runId = 'another-run';
      if (problem === 'different-candidate') run.selectedCandidateFingerprints = ['candidate:other:topic'];
      if (problem === 'later-run') run.startedAt = '2026-09-06T20:00:00.001Z';
      if (problem === 'before-run') projection.updatedAt = '2026-09-06T18:28:40.601Z';
      if (problem === 'artifact') state.contentHashes[fp.candidate] = 'a'.repeat(64);
      if (problem === 'pr') state.pullRequests[fp.candidate] = { number: 1, url: 'https://github.com/owner/repo/pull/1', status: 'opened' };
      if (problem === 'pilot') state.manualPilot = { runId: 'old', status: 'prepared', reservedAt: before, leaseExpiresAt: null, artifactHash: 'a'.repeat(64), consumedAt: null };
      const original = structuredClone(state);
      expect(() => grantManualRetryApproval(state, candidate, grant)).toThrow();
      expect(state).toEqual(original);
    },
  );

  it('pins the historical projection supporting run when more than 500 newer runs are compacted', () => {
    const state = grantManualRetryApproval(historicalProjection('researched'), candidate, grant);
    for (let index = 0; index < 501; index += 1) {
      const runId = `newer-${index}`;
      state.runs[runId] = { schemaVersion: 1, runId, mode: 'scheduled', startedAt: '2026-09-07T00:00:00.000Z', selectedCandidateFingerprints: [], status: 'failed' };
    }
    const compacted = compactPersistentWorkerState(state);
    expect(Object.keys(compacted.runs)).toHaveLength(500);
    expect(compacted.runs['older-failed-run']).toEqual(state.runs['older-failed-run']);
    expect(compacted.candidates).toEqual(state.candidates);
    expect(PersistentWorkerStateSchema.safeParse(compacted).success).toBe(true);
  });

  it.each(['missing-grant', 'unused-grant', 'different-candidate', 'different-run', 'scheduled-prior', 'successful-prior', 'missing-prior-failure', 'wrong-failure-fingerprint', 'wrong-failure-run', 'decremented-attempt', 'retryable-four', 'future-consumption', 'fifth-attempt'])(
    'rejects attempt four with %s', (problem) => {
      const state = approvedState(true);
      const input: Record<string, unknown> = state;
      if (problem === 'missing-grant') delete input.manualRetryApproval;
      if (problem === 'unused-grant') state.manualRetryApproval.consumedAt = null;
      if (problem === 'different-candidate') state.manualRetryApproval.candidateFingerprint = 'candidate:other:topic';
      if (problem === 'different-run') state.decisions[fp.candidate].runId = 'other-run';
      if (problem === 'scheduled-prior') state.runs['prior-run'].mode = 'scheduled';
      if (problem === 'successful-prior') state.runs['prior-run'].status = 'validated';
      if (problem === 'missing-prior-failure') state.failures.shift();
      if (problem === 'wrong-failure-fingerprint') state.failures[1].candidateFingerprint = 'candidate:other:topic';
      if (problem === 'wrong-failure-run') state.failures[1].runId = 'other-run';
      if (problem === 'decremented-attempt') state.decisions[fp.candidate].attempts = 3;
      if (problem === 'retryable-four') state.decisions[fp.candidate].status = 'retryable';
      if (problem === 'future-consumption') state.manualRetryApproval.consumedAt = '2026-09-06T22:00:00.000Z';
      if (problem === 'fifth-attempt') state.decisions[fp.candidate].attempts = 5;
      expect(PersistentWorkerStateSchema.safeParse(input).success).toBe(false);
    },
  );

  it('keeps legacy state without a grant valid and rejects an unaudited fourth failure', () => {
    const state = createPersistentWorkerState();
    expect(PersistentWorkerStateSchema.parse(state)).toEqual(state);
    expect(PersistentWorkerStateSchema.safeParse({ ...state, failures: [{ runId: 'any-run', code: 'candidate_failed', attempt: 4, observedAt: at, detail: 'No grant.' }] }).success).toBe(false);
  });

  it.each(['runs', 'decisions'])('pins the approval audit when compacting newer unrelated %s', (kind) => {
    const input = approvedState(true);
    const state = PersistentWorkerStateSchema.parse(input);
    for (let index = 0; kind === 'runs' && index < 501; index += 1) {
      const runId = `unrelated-${index}`;
      state.runs[runId] = { schemaVersion: 1, runId, mode: 'scheduled', startedAt: '2026-09-07T00:00:00.000Z', selectedCandidateFingerprints: [], status: 'failed' };
    }
    for (let index = 0; kind === 'decisions' && index < 5_000; index += 1) state.decisions[`old-${index}`] = {
      articleId: 'old', intentFingerprint: `intent:${'a'.repeat(64)}`, identities: ['a', 'b', 'c', 'd', 'e', 'f'],
      status: 'terminal', reason: 'done', attempts: 3, runId: 'old', updatedAt: '2026-09-07T00:00:00.000Z', leaseExpiresAt: null,
    };
    const compacted = compactPersistentWorkerState(state);
    expect(compacted.manualRetryApproval).toEqual(input.manualRetryApproval);
    expect(compacted.decisions[fp.candidate]).toEqual(input.decisions[fp.candidate]);
    expect(compacted.runs['prior-run']).toEqual(input.runs['prior-run']);
    expect(compacted.failures).toEqual(input.failures);
  });

  it('pins the required third and fourth failures ahead of 100 newer failures without exceeding the bound', () => {
    const input = approvedState(true);
    const state = PersistentWorkerStateSchema.parse(input);
    state.failures.push(...Array.from({ length: 100 }, (_, index) => ({ runId: `unrelated-${index}`,
      code: 'candidate_failed', attempt: 1, observedAt: '2026-09-07T00:00:00.000Z', detail: 'Unrelated failure.' })));
    const compacted = compactPersistentWorkerState(state);
    expect(compacted.failures).toHaveLength(100);
    expect(compacted.failures.slice(0, 2)).toEqual(input.failures);
    expect(compacted.failures[2].runId).toBe('unrelated-2');
    expect(PersistentWorkerStateSchema.safeParse(compacted).success).toBe(true);
    const unaudited = { ...state, manualRetryApproval: undefined };
    expect(() => compactPersistentWorkerState(unaudited)).toThrow();
  });
});

describe('least-privilege GitHub publisher boundary', () => {
  it('inspects the exact repository and materializes one commit without a GITHUB_TOKEN fallback', async () => {
    const sha = 'a'.repeat(40);
    const fixture = queuedTransport([
      json({ object: { sha } }),
      json({ number: 55, state: 'closed', merged: true, merged_at: '2026-09-05T00:00:00Z', merge_commit_sha: 'b'.repeat(40), base: { ref: 'main' } }),
      json([{ ref: 'refs/heads/autoblog/2026-09-05-existing' }]),
      json({ tree: [{ path: 'content/articles/existing.md', type: 'blob', sha: 'c'.repeat(40) }] }),
      json([{ number: 8, html_url: 'https://github.com/INFR-Organisation/videoclaw-lander/pull/8', title: 'Review: Existing', body: `- Article ID: vc-c1-001\n- Intent fingerprint: intent:${'e'.repeat(64)}\n<!-- autoblogger-bundle-sha256: ${'d'.repeat(64)} -->`, head: { ref: 'autoblog/2026-09-05-existing' } }]),
      json({ status: 'ahead' }),
      json({ encoding: 'base64', content: Buffer.from('---\nid: vc-c1-001\nslug: existing\ntitle: Existing\nprimaryKeyword: existing keyword\n---\n').toString('base64') }),
      json([]),
      json({ sha: '1'.repeat(40) }, 201),
      json({ sha: '2'.repeat(40) }, 201),
      json({ sha: '3'.repeat(40) }, 201),
      json({ sha: '4'.repeat(40) }, 201),
    ]);
    const boundary = createGitHubPublisherBoundary({ transport: fixture.transport });

    const snapshot = await boundary.inspectTarget({
      owner: 'INFR-Organisation',
      repository: 'videoclaw-lander',
      baseRef: 'main',
      blogLaunchPullRequest: 55,
      auth,
    });
    expect(snapshot).toMatchObject({
      baseSha: sha,
      blogLaunch: { state: 'merged', mergeCommitIncludedInBase: true },
      branchRefs: ['autoblog/2026-09-05-existing'],
      existingArticles: [{ id: 'vc-c1-001', articleId: 'vc-c1-001', slug: 'existing', primaryKeyword: 'existing keyword' }],
      openPullRequests: [{ number: 8, slug: 'existing', articleId: 'vc-c1-001', intentFingerprint: `intent:${'e'.repeat(64)}`, bundleHash: 'd'.repeat(64) }],
    });

    const prepared = await boundary.prepareCommit({
      owner: 'INFR-Organisation',
      repository: 'videoclaw-lander',
      baseSha: sha,
      headRef: 'autoblog/2026-09-05-new',
      message: 'content: add new review draft',
      files: [
        { path: 'content/articles/new.md', content: 'markdown' },
        { path: 'public/media/blog/new.svg', content: '<svg/>' },
      ],
      pullRequest: { title: 'Review: New', body: 'trace', baseRef: 'main', draft: true },
      auth,
    });
    expect(prepared).toEqual({ commitSha: '4'.repeat(40) });
    expect(fixture.requests.every(({ url }) => url.startsWith('https://api.github.com/repos/INFR-Organisation/videoclaw-lander/'))).toBe(true);
    expect(fixture.requests.every(({ headers }) => headers.Authorization === `Bearer ${auth.token}`)).toBe(true);
    expect(fixture.requests.some(({ body }) => String(body).includes('GITHUB_TOKEN'))).toBe(false);
    expect(fixture.requests[3].url).toContain(`/git/trees/${sha}?recursive=1`);
  });

  it('opens only a draft PR and preserves the bundle marker for idempotent reconciliation', async () => {
    const fixture = queuedTransport([
      json({}, 201),
      json({ number: 42, html_url: 'https://github.com/INFR-Organisation/videoclaw-lander/pull/42' }, 201),
      json([{ number: 42, html_url: 'https://github.com/INFR-Organisation/videoclaw-lander/pull/42', body: '<!-- autoblogger-bundle-sha256: ' + 'e'.repeat(64) + ' -->', head: { ref: 'autoblog/2026-09-05-new' } }]),
      json({}, 204),
    ]);
    const boundary = createGitHubPublisherBoundary({ transport: fixture.transport });
    await boundary.createBranch({ owner: 'INFR-Organisation', repository: 'videoclaw-lander', headRef: 'autoblog/2026-09-05-new', commitSha: 'a'.repeat(40), auth });
    await expect(boundary.createDraftPullRequest({
      owner: 'INFR-Organisation', repository: 'videoclaw-lander', baseRef: 'main', headRef: 'autoblog/2026-09-05-new',
      title: 'Review: New', body: 'trace', draft: true, bundleHash: 'e'.repeat(64), auth,
    })).resolves.toEqual({ number: 42, url: 'https://github.com/INFR-Organisation/videoclaw-lander/pull/42' });
    await expect(boundary.findOpenPullRequestByHead({ owner: 'INFR-Organisation', repository: 'videoclaw-lander', headRef: 'autoblog/2026-09-05-new', auth }))
      .resolves.toMatchObject({ number: 42, bundleHash: 'e'.repeat(64) });
    await boundary.deleteBranch({ owner: 'INFR-Organisation', repository: 'videoclaw-lander', headRef: 'autoblog/2026-09-05-new', auth });
    expect(fixture.requests[3].method).toBe('DELETE');
    expect(JSON.parse(fixture.requests[1].body as string)).toMatchObject({ draft: true, base: 'main' });
    expect(fixture.requests[1].body).toContain('autoblogger-bundle-sha256');
  });

  it('reads a premerge ref with distinct read-only auth and includes manual PR keywords and changed article identities', async () => {
    const readAuth = { kind: 'github_read_only' as const, token: 'github_pat_read_only_fixture_123456' };
    const blob = (id: string, slug: string) => json({ encoding: 'base64', content: Buffer.from(`---\nid: ${id}\nslug: ${slug}\ntitle: ${slug} article title\nprimaryKeyword: ${slug} keyword\n---\nArticle`).toString('base64') });
    const fixture = queuedTransport([
      json({ object: { sha: 'a'.repeat(40) } }),
      json({ state: 'open', merged: false, base: { ref: 'main' } }),
      json([{ ref: 'refs/heads/editor/manual-article' }, { ref: 'refs/heads/autoblog/2026-09-05-reserved' }]),
      json({ truncated: false, tree: [] }),
      json([
        { number: 12, html_url: 'https://github.com/owner/lander/pull/12', title: 'Editorial batch', body: null, head: { ref: 'editor/manual-article' } },
        { number: 13, html_url: 'https://github.com/owner/lander/pull/13', title: 'Manual keyword topic', body: '- Primary keyword: Founder Launch Video', head: { ref: 'manual/topic' } },
      ]),
      json([{ filename: 'content/articles/first.md', status: 'added', sha: 'b'.repeat(40) }, { filename: 'content/articles/second.md', status: 'modified', sha: 'c'.repeat(40) }]),
      blob('vc-c1-001', 'first'),
      blob('vc-c1-002', 'second'),
      json([]),
    ]);
    const snapshot = await createGitHubPublisherBoundary({ transport: fixture.transport }).inspectTarget({
      owner: 'owner', repository: 'lander', baseRef: 'seo/founder-video-blog-launch', blogLaunchPullRequest: 55, auth: readAuth,
    });
    expect(snapshot.openPullRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({ number: 12, articleId: 'vc-c1-001', slug: 'first', title: 'first article title', primaryKeyword: 'first keyword' }),
      expect.objectContaining({ number: 12, articleId: 'vc-c1-002', slug: 'second', primaryKeyword: 'second keyword' }),
      expect.objectContaining({ number: 13, primaryKeyword: 'Founder Launch Video' }),
    ]));
    expect(snapshot.branchRefs).toContain('editor/manual-article');
    expect(fixture.requests[0].url).toContain('heads/seo%2Ffounder-video-blog-launch');
    expect(fixture.requests.every(({ method, headers }) => method === 'GET' && headers.Authorization === `Bearer ${readAuth.token}`)).toBe(true);
    expect(fixture.requests.some(({ url }) => url.endsWith(`/git/blobs/${'b'.repeat(40)}`))).toBe(true);
  });

  it.each(['pulls-pagination', 'files-pagination', 'truncated-tree', 'invalid-branches', 'unreadable-blob'] as const)('fails closed on %s instead of returning partial inventory', async (failure) => {
    const next = { status: 200, headers: { link: '<https://api.github.com/next>; rel="next"' }, body: [] };
    const fixture = queuedTransport([
      json({ object: { sha: 'a'.repeat(40) } }),
      json({ state: 'open', merged: false, base: { ref: 'main' } }),
      json(failure === 'invalid-branches' ? {} : []),
      json({ tree: [], truncated: failure === 'truncated-tree' }),
      failure === 'pulls-pagination' ? next : json([{ number: 12, html_url: 'https://github.com/owner/lander/pull/12', title: 'Manual edit', head: { ref: 'manual/edit' } }]),
      failure === 'files-pagination' ? next : json([{ filename: 'content/articles/first.md', status: 'added', sha: 'b'.repeat(40) }]),
      json({ message: 'Not found' }, 404),
    ]);
    await expect(createGitHubPublisherBoundary({ transport: fixture.transport }).inspectTarget({
      owner: 'owner', repository: 'lander', baseRef: 'main', blogLaunchPullRequest: 55, auth: { kind: 'github_read_only', token: 'github_pat_read_only_fixture_123456' },
    })).rejects.toThrow();
  });

  it('rejects a read-only credential at every mutation boundary before HTTP', async () => {
    const fixture = queuedTransport([]);
    const boundary = createGitHubPublisherBoundary({ transport: fixture.transport });
    const readAuth = { kind: 'github_read_only', token: 'github_pat_read_only_fixture_123456' } as never;
    await expect(boundary.prepareCommit({ owner: 'owner', repository: 'lander', baseSha: '', headRef: '', message: '', files: [], pullRequest: { title: '', body: '', baseRef: 'main', draft: true }, auth: readAuth })).rejects.toThrow(/App/i);
    await expect(boundary.createBranch({ owner: 'owner', repository: 'lander', headRef: '', commitSha: '', auth: readAuth })).rejects.toThrow(/App/i);
    await expect(boundary.createDraftPullRequest({ owner: 'owner', repository: 'lander', baseRef: 'main', headRef: '', title: '', body: '', draft: true, bundleHash: '', auth: readAuth })).rejects.toThrow(/App/i);
    await expect(boundary.deleteBranch({ owner: 'owner', repository: 'lander', headRef: '', auth: readAuth })).rejects.toThrow(/App/i);
    expect(fixture.requests).toEqual([]);
  });
});

describe('compact same-repository state branch', () => {
  it('identifies the client on every state read, branch initialization and write request', async () => {
    const state = createPersistentWorkerState();
    const body = { sha: 'created-state-sha', encoding: 'base64', content: Buffer.from(JSON.stringify(state)).toString('base64') };
    const fixture = queuedTransport([
      json({ message: 'Not Found' }, 404),
      json({ object: { sha: 'a'.repeat(40) } }),
      json({ ref: 'refs/heads/autoblogger-state' }, 201),
      json({ content: { sha: 'created-state-sha' } }, 201),
      json(body),
    ]);
    const store = createGitHubStateStore({ owner: 'frenzy2004', repository: 'VideoClaw-ICP', token: 'fixture',
      transport: async request => {
        // GitHub rejects requests lacking a valid application/user identity.
        const agent = Object.entries(request.headers).find(([key]) => key.toLowerCase() === 'user-agent')?.[1];
        if (!agent?.trim()) return json({ message: 'User-Agent required' }, 403);
        return fixture.transport(request);
      },
    });
    const before = await store.load();
    expect(before.version).toBeNull();
    const saved = await store.save(state, before.version);
    expect((await store.load()).version).toBe(saved.version);
    expect(fixture.requests.map(request => request.method)).toEqual(['GET', 'GET', 'POST', 'PUT', 'GET']);
    for (const request of fixture.requests) expect(request.headers['User-Agent']).toMatch(/videoclaw/);
  });

  it.each(['remove', 'replace'])('refuses to %s a stored retirement marker even with the current GitHub SHA', async mutation => {
    const before = await successfulDiagnosticFixture();
    const retired = retireDiagnosticHistory(before, '2026-09-09T00:00:00.000Z');
    const fixture = queuedTransport([
      json({ sha: 'current', encoding: 'base64', content: Buffer.from(JSON.stringify(retired)).toString('base64') }),
      json({ content: { sha: 'next' } }),
    ]);
    const store = createGitHubStateStore({ transport: fixture.transport, owner: 'frenzy2004', repository: 'VideoClaw-ICP', token: 'fixture' });
    const loaded = await store.load();
    const changed = mutation === 'remove' ? before : { ...loaded.state, diagnosticRetirement: {
      ...retired.diagnosticRetirement!, retiredAt: '2026-09-10T00:00:00.000Z',
    } };
    expect(PersistentWorkerStateSchema.safeParse(changed).success).toBe(true);
    await expect(store.save(changed, loaded.version)).rejects.toThrow(/retirement/i);
    expect(fixture.requests.map(request => request.method)).toEqual(['GET']);
    await expect(store.save(retired, loaded.version)).resolves.toEqual({ version: 'next' });
  });

  it('does not let callers mutate the loaded marker to bypass GitHub retirement continuity', async () => {
    const retired = retireDiagnosticHistory(await successfulDiagnosticFixture(), '2026-09-09T00:00:00.000Z');
    const fixture = queuedTransport([
      json({ sha: 'current', encoding: 'base64', content: Buffer.from(JSON.stringify(retired)).toString('base64') }),
      json({ content: { sha: 'next' } }),
    ]);
    const store = createGitHubStateStore({ transport: fixture.transport, owner: 'frenzy2004', repository: 'VideoClaw-ICP', token: 'fixture' });
    const loaded = await store.load();
    delete loaded.state.diagnosticRetirement;
    await expect(store.save(loaded.state, loaded.version)).rejects.toThrow(/retirement/i);
    expect(fixture.requests.map(request => request.method)).toEqual(['GET']);
  });
  const collector = { actorId: 'paa-collector', runId: 'paa-run', datasetId: 'paa-data', observedAt: '2026-09-05T00:00:00.000Z' };
  const provenance = {
    serp: { runId: 'organic-run', datasetId: 'organic-data', observedAt: collector.observedAt },
    keyword: { provider: 'pending', endpoint: null, observedAt: null, providerRequestId: null, sourceObservedAt: null },
    paa: collector,
    paaAttempts: [{ ...collector, runId: 'paa-first-empty' }, collector],
    supportSearches: [{ ...collector, actorId: 'support-search', runId: 'support-run', datasetId: 'support-data' }],
  };
  const stateWithProvenance = (value: unknown) => ({
    ...createPersistentWorkerState(),
    decisions: { fixture: {
      articleId: 'vc-c2-001', intentFingerprint: `intent:${'a'.repeat(64)}`, identities: ['article:vc-c2-001', 'keyword:demo day video', 'title:demo day video', 'slug:demo-day-video', `intent:${'a'.repeat(64)}`, 'candidate:fixture'],
      status: 'retryable', reason: 'prior_failure', attempts: 1, runId: 'prior-run', updatedAt: collector.observedAt, leaseExpiresAt: null,
    } },
    provenance: { fixture: value },
  });

  it('round-trips bounded optional PAA and support-search metadata without relabeling the organic run', () => {
    const state = PersistentWorkerStateSchema.parse(stateWithProvenance(provenance));
    const compacted = compactPersistentWorkerState(state);
    expect(compacted.provenance.fixture).toEqual(provenance);
    expect(PersistentWorkerStateSchema.parse(JSON.parse(JSON.stringify(compacted))).provenance.fixture).toEqual(provenance);
    const legacy = { serp: provenance.serp, keyword: provenance.keyword };
    expect(PersistentWorkerStateSchema.parse(stateWithProvenance(legacy)).provenance.fixture).toEqual(legacy);
  });

  it.each([
    ['too many support searches', { ...provenance, supportSearches: Array.from({ length: 11 }, () => collector) }],
    ['too many PAA attempts', { ...provenance, paaAttempts: [collector, collector, collector] }],
    ['oversized actor id', { ...provenance, paa: { ...collector, actorId: 'x'.repeat(241) } }],
    ['oversized run id', { ...provenance, paa: { ...collector, runId: 'x'.repeat(161) } }],
    ['invalid collection time', { ...provenance, paa: { ...collector, observedAt: 'yesterday' } }],
    ['raw PAA answers', { ...provenance, paa: { ...collector, answer: 'not provenance' } }],
  ])('rejects %s in compact provenance', (_label, value) => {
    expect(PersistentWorkerStateSchema.safeParse(stateWithProvenance(provenance)).success).toBe(true);
    expect(PersistentWorkerStateSchema.safeParse(stateWithProvenance(value)).success).toBe(false);
  });

  it('bounds question-only PAA records and drops provider answers rather than storing them', () => {
    const row = { ...collector, query: 'demo day video', question: 'How do founders rehearse a demo day video?', parentQuestion: null, country: 'US', language: 'en', position: 1 };
    expect(PaaObservationsSchema.parse([{ ...row, answer: 'Raw provider answer' }])).toEqual([row]);
    expect(PaaObservationsSchema.safeParse(Array.from({ length: 30 }, () => row)).success).toBe(true);
    expect(PaaObservationsSchema.safeParse(Array.from({ length: 31 }, () => row)).success).toBe(false);
    for (const patch of [{ question: 'x'.repeat(501) }, { query: 'x'.repeat(501) }, { parentQuestion: 'x'.repeat(501) }, { position: 0 }, { country: 'GB' }, { language: 'fr' }, { observedAt: 'yesterday' }]) {
      expect(PaaObservationsSchema.safeParse([{ ...row, ...patch }]).success).toBe(false);
    }
  });

  it('loads, validates, and updates state with optimistic concurrency', async () => {
    const state = createPersistentWorkerState();
    const encoded = Buffer.from(`${JSON.stringify(state)}\n`).toString('base64');
    const fixture = queuedTransport([
      json({ sha: 'state-file-sha', encoding: 'base64', content: encoded }),
      json({ content: { sha: 'new-state-file-sha' }, commit: { sha: 'f'.repeat(40) } }, 200),
    ]);
    const store = createGitHubStateStore({
      transport: fixture.transport,
      owner: 'frenzy2004',
      repository: 'VideoClaw-ICP',
      token: 'ghs_same_repo_fixture_123456',
    });
    const loaded = await store.load();
    expect(loaded).toEqual({ state, version: 'state-file-sha' });
    await expect(store.save(state, 'state-file-sha')).resolves.toEqual({ version: 'new-state-file-sha' });
    expect(JSON.parse(fixture.requests[1].body as string)).toMatchObject({
      branch: 'autoblogger-state',
      sha: 'state-file-sha',
    });
  });

  it('fails closed on conflicts and rejects a state token for another repository', async () => {
    const fixture = queuedTransport([
      json({ sha: 'stale-sha', encoding: 'base64', content: Buffer.from(JSON.stringify(createPersistentWorkerState())).toString('base64') }),
      json({ message: 'sha does not match' }, 409),
    ]);
    const store = createGitHubStateStore({
      transport: fixture.transport,
      owner: 'frenzy2004',
      repository: 'VideoClaw-ICP',
      token: 'ghs_same_repo_fixture_123456',
    });
    const loaded = await store.load();
    await expect(store.save(loaded.state, loaded.version)).rejects.toThrow(/conflict/i);
    expect(fixture.requests.map(request => request.method)).toEqual(['GET', 'PUT']);
    expect(() => createGitHubStateStore({
      transport: fixture.transport,
      owner: 'frenzy2004',
      repository: 'VideoClaw-ICP',
      token: 'fixture',
      githubRepository: 'someone/else',
    })).toThrow(/same repository/i);
  });
});
