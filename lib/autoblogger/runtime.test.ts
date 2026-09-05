import { mkdir, mkdtemp, readFile, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CandidateSchema, EvidenceBundleSchema, KeywordMetricsSchema, candidateFingerprints } from './domain';
import { writeAutobloggerArtifacts, buildDraftingContextFromResearch, loadBacklogCandidates, createProductionAutobloggerRuntime } from './runtime';
import { validateAutobloggerEnvironment } from './cli';
import { createPersistentWorkerState } from './github-runtime';
import type { HttpRequest, HttpTransport } from './http';
import type { ResearchResult, ShallowResearchResult } from './research';

describe('runtime context and artifacts', () => {
  it('reconciles fresh article, manual PR, and reserved branch identities before any paid API', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoblogger-read-inventory-'));
    await mkdir(join(root, '.git'));
    const backlog = await loadBacklogCandidates(process.cwd());
    const [existing, openPr, reserved] = backlog;
    let state = createPersistentWorkerState();
    state.candidateFingerprints = backlog.slice(3).flatMap((candidate) => Object.values(candidateFingerprints(candidate)));
    const requests: HttpRequest[] = [];
    const readToken = 'github_pat_read_inventory_fixture_123456';
    const stateToken = 'fixture-state-token';
    const transport: HttpTransport = async (request) => {
      requests.push(request);
      const url = new URL(request.url);
      expect(url.hostname).toBe('api.github.com'); // Any paid request is a test failure.
      let body: unknown;
      if (url.pathname.startsWith('/repos/owner/icp/')) {
        expect(request.headers.Authorization).toBe(`Bearer ${stateToken}`);
        if (request.method === 'GET') body = { sha: 'state-sha', encoding: 'base64', content: Buffer.from(JSON.stringify(state)).toString('base64') };
        else {
          state = JSON.parse(Buffer.from(JSON.parse(request.body as string).content, 'base64').toString('utf8'));
          body = { content: { sha: 'updated-state-sha' } };
        }
      } else {
        expect(request.headers.Authorization).toBe(`Bearer ${readToken}`);
        expect(request.method).toBe('GET');
        if (url.pathname.endsWith('/git/ref/heads/feature')) body = { object: { sha: 'a'.repeat(40) } };
        else if (url.pathname.endsWith('/pulls/55')) body = { state: 'open', merged: false, base: { ref: 'main' } };
        else if (url.pathname.endsWith('/git/matching-refs/heads/')) body = [{ ref: `refs/heads/autoblog/2026-09-05-${reserved.slug}` }];
        else if (url.pathname.includes('/git/trees/')) body = { tree: [{ path: 'content/articles/existing.md', type: 'blob', sha: 'b'.repeat(40) }], truncated: false };
        else if (url.pathname.includes('/git/blobs/')) body = { encoding: 'base64', content: Buffer.from(`---\nid: ${existing.articleId}\nslug: ${existing.slug}\ntitle: ${existing.title}\nprimaryKeyword: ${existing.primaryKeyword}\n---\n`).toString('base64') };
        else if (url.pathname.endsWith('/pulls')) body = [{ number: 12, html_url: 'https://github.com/owner/lander/pull/12', title: 'Manual topic', body: `- Primary keyword: ${openPr.primaryKeyword}`, head: { ref: 'editor/topic' } }];
        else if (url.pathname.endsWith('/pulls/12/files')) body = [];
        else throw new Error(`Unexpected endpoint: ${url.pathname}`);
      }
      return { status: 200, headers: {}, body };
    };
    const config = validateAutobloggerEnvironment('research', {
      APIFY_TOKEN: 'fixture-apify', KEYWORD_PROVIDER: 'pending', GITHUB_TOKEN: stateToken, GITHUB_REPOSITORY: 'owner/icp',
      LANDER_REPOSITORY: root, LANDER_OWNER: 'owner', LANDER_NAME: 'lander', LANDER_BASE_REF: 'feature', LANDER_READ_TOKEN: readToken,
    });
    const runtime = await createProductionAutobloggerRuntime(config, process.cwd(), { transport });
    expect(requests.some(({ url }) => url.endsWith('/pulls/12/files?per_page=100'))).toBe(true);
    const report = await runtime.execute({ command: 'research', runId: 'early-dedupe' });
    expect(report.counts).toMatchObject({ scanned: 0, drafted: 0 });
    for (const candidate of [existing, openPr, reserved]) {
      expect(state.decisions[candidateFingerprints(candidate).candidate]).toBeDefined();
    }
    expect(state.decisions[candidateFingerprints(reserved).candidate].reason).toBe('reconciliation_required');
    expect(state.pullRequests[candidateFingerprints(openPr).candidate]).toMatchObject({ number: 12 });
  });

  it('stops preparation on read-access failure before constructing a paid runtime', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoblogger-read-denied-'));
    await mkdir(join(root, '.git'));
    const requests: HttpRequest[] = [];
    const config = validateAutobloggerEnvironment('pilot', {
      APIFY_TOKEN: 'fixture-apify', OPENAI_API_KEY: 'fixture-model', KEYWORD_PROVIDER: 'pending', GITHUB_TOKEN: 'fixture-state', GITHUB_REPOSITORY: 'owner/icp',
      LANDER_REPOSITORY: root, LANDER_OWNER: 'owner', LANDER_NAME: 'lander', LANDER_BASE_REF: 'feature', LANDER_READ_TOKEN: 'github_pat_read_inventory_fixture_123456',
    });
    await expect(createProductionAutobloggerRuntime(config, process.cwd(), { transport: async (request) => {
      requests.push(request); return { status: 403, headers: {}, body: {} };
    } })).rejects.toThrow(/403/);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain('/repos/owner/lander/');
  });

  it('loads the incremental matrix backlog without enforcing an exact library gate', async () => {
    const candidates = await loadBacklogCandidates(process.cwd());
    expect(candidates.length).toBeGreaterThanOrEqual(250);
    expect(new Set(candidates.map(({ articleId }) => articleId)).size).toBe(candidates.length);
  });

  it('builds exact transient source facts only from checked SERP observations', () => {
    const candidate = CandidateSchema.parse({
      schemaVersion: 1, articleId: 'vc-c2-901', campaignId: 'accelerator-demo-day-founder', icp: 'demo day founder',
      primaryKeyword: 'founder video proof workflow', secondaryKeywords: [], title: 'Founder Video Proof Workflow',
      slug: 'founder-video-proof-workflow', intent: 'informational', funnelStage: 'middle',
    });
    const shallow: ShallowResearchResult = {
      candidate,
      suggestions: ['founder video proof workflow guide'],
      organicResults: [
        { url: 'https://primary.example/guide', title: 'Primary founder guide', snippet: 'A founder workflow should connect the customer problem to visible product proof.', resultType: 'article' },
        { url: 'https://secondary.example/checklist', title: 'Independent checklist', snippet: 'A final playback check catches avoidable presentation failures.', resultType: 'article' },
      ],
      peopleAlsoAsk: ['What is founder video proof?', 'How do founders show video proof?', 'Why does founder video proof matter?'],
      relatedQueries: [],
      provenance: {
        discovery: { actorId: 'autocomplete', runId: 'run-a', datasetId: 'data-a', observedAt: '2026-09-05T00:00:00.000Z' },
        serp: { actorId: 'serp', runId: 'run-s', datasetId: 'data-s', observedAt: '2026-09-05T00:01:00.000Z' },
      },
    };
    const evidence = EvidenceBundleSchema.parse({
      schemaVersion: 2,
      candidateFingerprint: candidateFingerprints(candidate).candidate,
      signals: { autocomplete: shallow.suggestions, peopleAlsoAsk: shallow.peopleAlsoAsk, relatedSearches: shallow.relatedQueries },
      serp: { organicResultCount: 2, peopleAlsoAsk: shallow.peopleAlsoAsk },
      sources: [
        { originalUrl: shallow.organicResults[0].url, finalUrl: shallow.organicResults[0].url, authoritative: true },
        { originalUrl: shallow.organicResults[1].url, finalUrl: shallow.organicResults[1].url, authoritative: false },
      ],
      faqQuestions: shallow.peopleAlsoAsk,
    });
    const result: ResearchResult = { candidate, evidence, provenance: shallow.provenance };
    const metrics = KeywordMetricsSchema.parse({ schemaVersion: 1, provider: 'pending', observedAt: null, volume: null, difficulty: null, cpc: null, intent: 'informational' });

    const context = buildDraftingContextFromResearch({ result, shallow, metrics, generatedAt: '2026-09-05T00:02:00.000Z' });
    expect(context.sourceFacts).toHaveLength(2);
    expect(context.sourceFacts[0]).toMatchObject({
      url: 'https://primary.example/guide',
      facts: [
        { text: 'Primary founder guide' },
        { text: 'A founder workflow should connect the customer problem to visible product proof.' },
      ],
    });
    expect(context.checkedSources.every(({ reachable, status }) => reachable && status === 200)).toBe(true);
    expect(context.provenance).toEqual({ apifyRunId: 'run-s', apifyDatasetId: 'data-s', query: candidate.primaryKeyword, locale: 'en-US', capturedAt: '2026-09-05' });
  });

  it('bounds SERP-derived source facts before they enter the model context', () => {
    const candidate = CandidateSchema.parse({
      schemaVersion: 1, articleId: 'vc-c2-902', campaignId: 'accelerator-demo-day-founder', icp: 'demo day founder',
      primaryKeyword: 'bounded founder video workflow', secondaryKeywords: [], title: 'Bounded Founder Video Workflow',
      slug: 'bounded-founder-video-workflow', intent: 'informational', funnelStage: 'middle',
    });
    const shallow: ShallowResearchResult = {
      candidate,
      suggestions: ['bounded founder video workflow guide'],
      organicResults: [
        { url: 'https://primary.example/bounded', title: 'Primary source', snippet: 'x'.repeat(20_000), resultType: 'article' },
        { url: 'https://secondary.example/bounded', title: 'Secondary source', snippet: 'Short checked fact.', resultType: 'article' },
      ],
      peopleAlsoAsk: ['What is bounded founder video?', 'How is bounded founder video planned?', 'Why is bounded founder video useful?'],
      relatedQueries: [],
      provenance: {
        discovery: { actorId: 'autocomplete', runId: 'run-a', datasetId: 'data-a', observedAt: '2026-09-05T00:00:00.000Z' },
        serp: { actorId: 'serp', runId: 'run-s', datasetId: 'data-s', observedAt: '2026-09-05T00:01:00.000Z' },
      },
    };
    const evidence = EvidenceBundleSchema.parse({
      schemaVersion: 2,
      candidateFingerprint: candidateFingerprints(candidate).candidate,
      signals: { autocomplete: shallow.suggestions, peopleAlsoAsk: shallow.peopleAlsoAsk, relatedSearches: shallow.relatedQueries },
      serp: { organicResultCount: 2, peopleAlsoAsk: shallow.peopleAlsoAsk },
      sources: [
        { originalUrl: shallow.organicResults[0].url, finalUrl: shallow.organicResults[0].url, authoritative: true },
        { originalUrl: shallow.organicResults[1].url, finalUrl: shallow.organicResults[1].url, authoritative: false },
      ],
      faqQuestions: shallow.peopleAlsoAsk,
    });
    const metrics = KeywordMetricsSchema.parse({ schemaVersion: 1, provider: 'pending', observedAt: null, volume: null, difficulty: null, cpc: null, intent: 'informational' });
    const context = buildDraftingContextFromResearch({
      result: { candidate, evidence, provenance: shallow.provenance },
      shallow,
      metrics,
      generatedAt: '2026-09-05T00:02:00.000Z',
    });

    expect(context.sourceFacts[0].facts[1].text.length).toBeLessThanOrEqual(600);
  });

  it('writes Markdown, SVG, and a compact report without overwriting outside the artifact directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoblogger-artifacts-'));
    const report = {
      schemaVersion: 1,
      command: 'pilot',
      runId: 'pilot-artifact',
      mode: 'manual_pilot',
      status: 'validated',
      startedAt: '2026-09-05T00:00:00.000Z',
      completedAt: '2026-09-05T00:01:00.000Z',
      limits: { maxCandidatesScanned: 50, maxDeepInspections: 10, maxDrafts: 3, maxDraftsPerIcp: 2, manualPilotDrafts: 1 },
      counts: { queued: 50, scanned: 50, shallowValidated: 50, metricsEnriched: 50, deepInspected: 10, eligible: 1, drafted: 1, validated: 1, pullRequestsOpened: 0 },
      failures: [],
      artifacts: [{
        candidateFingerprint: 'candidate:x', articleId: 'vc-c1-101', slug: 'fixture-article', icp: 'founder', publication: 'artifact_only',
        bundle: { schemaVersion: 1, candidateFingerprint: 'candidate:x', article: { slug: 'fixture-article' }, markdown: '---\nstatus: review\n---\nArticle', svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
        validation: { status: 'passed', cleanup: 'completed', bundleHash: 'a'.repeat(64), landerRef: 'feature', commands: [] },
      }],
    };
    await writeAutobloggerArtifacts(report, root, root);
    await expect(readFile(join(root, 'fixture-article.md'), 'utf8')).resolves.toContain('status: review');
    await expect(readFile(join(root, 'fixture-article.svg'), 'utf8')).resolves.toContain('<svg');
    const compact = await readFile(join(root, 'run-report.json'), 'utf8');
    expect(compact).not.toContain('Article');
    expect(compact).not.toContain('<svg');
    await expect(stat(join(root, 'fixture-article.bundle.json'))).resolves.toBeTruthy();
    expect(JSON.parse(await readFile(join(root, 'fixture-article.publication.json'), 'utf8')))
      .toMatchObject({ runId: 'pilot-artifact', bundle: report.artifacts[0].bundle });
    await expect(writeAutobloggerArtifacts(report, '../escape', root)).rejects.toThrow(/artifact directory/i);
  });

  it('retains the prepared report when a later operation writes a failure artifact', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoblogger-failure-'));
    await writeAutobloggerArtifacts({ status: 'passed' }, root, root);
    await writeAutobloggerArtifacts({ schemaVersion: 1, status: 'failed', error: 'initialization failed' }, root, root);
    expect(JSON.parse(await readFile(join(root, 'failure-report.json'), 'utf8'))).toMatchObject({ status: 'failed' });
    expect(JSON.parse(await readFile(join(root, 'validation-report.json'), 'utf8'))).toEqual({ status: 'passed' });
  });

  it('rejects a symlinked artifact directory before writing outside the configured root', async () => {
    const fixture = await mkdtemp(join(tmpdir(), 'autoblogger-artifact-symlink-'));
    const root = join(fixture, 'root');
    const outside = join(fixture, 'outside');
    await mkdir(root);
    await mkdir(outside);
    await symlink(outside, join(root, 'escape'), 'dir');

    await expect(writeAutobloggerArtifacts({ status: 'safe' }, 'escape', root)).rejects.toThrow(/symlink|artifact directory/i);
    await expect(stat(join(outside, 'validation-report.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
