import { describe, expect, it } from 'vitest';

import type { HttpRequest, HttpResponse, HttpTransport } from './http';
import {
  createGitHubPublisherBoundary,
  createGitHubStateStore,
  createPersistentWorkerState,
} from './github-runtime';

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

describe('least-privilege GitHub publisher boundary', () => {
  it('inspects the exact repository and materializes one commit without a GITHUB_TOKEN fallback', async () => {
    const sha = 'a'.repeat(40);
    const fixture = queuedTransport([
      json({ object: { sha } }),
      json({ number: 55, state: 'closed', merged: true, merged_at: '2026-09-05T00:00:00Z', merge_commit_sha: 'b'.repeat(40), base: { ref: 'main' } }),
      json([{ ref: 'refs/heads/autoblog/2026-09-05-existing' }]),
      json({ tree: [{ path: 'content/articles/existing.md', type: 'blob', sha: 'c'.repeat(40) }] }),
      json([{ number: 8, html_url: 'https://github.com/INFR-Organisation/videoclaw-lander/pull/8', title: 'Review: Existing', body: '<!-- autoblogger-bundle-sha256: ' + 'd'.repeat(64) + ' -->', head: { ref: 'autoblog/2026-09-05-existing' } }]),
      json({ status: 'ahead' }),
      json({ encoding: 'base64', content: Buffer.from('---\nid: vc-c1-001\nslug: existing\ntitle: Existing\nprimaryKeyword: existing keyword\n---\n').toString('base64') }),
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
      existingArticles: [{ id: 'vc-c1-001', slug: 'existing', primaryKeyword: 'existing keyword' }],
      openPullRequests: [{ number: 8, slug: 'existing', bundleHash: 'd'.repeat(64) }],
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
});

describe('compact same-repository state branch', () => {
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
    const fixture = queuedTransport([json({ message: 'sha does not match' }, 409)]);
    const store = createGitHubStateStore({
      transport: fixture.transport,
      owner: 'frenzy2004',
      repository: 'VideoClaw-ICP',
      token: 'ghs_same_repo_fixture_123456',
    });
    await expect(store.save(createPersistentWorkerState(), 'stale-sha')).rejects.toThrow(/conflict/i);
    expect(() => createGitHubStateStore({
      transport: fixture.transport,
      owner: 'frenzy2004',
      repository: 'VideoClaw-ICP',
      token: 'fixture',
      githubRepository: 'someone/else',
    })).toThrow(/same repository/i);
  });
});
