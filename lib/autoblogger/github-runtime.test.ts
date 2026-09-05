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
