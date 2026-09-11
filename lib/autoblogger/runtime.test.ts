import { cp, mkdir, mkdtemp, readFile, readdir, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CandidateSchema, EvidenceBundleSchema, KeywordMetricsSchema, candidateFingerprints } from './domain';
import { writeAutobloggerArtifacts, buildDraftingContextFromResearch, loadBacklogCandidates, createProductionAutobloggerRuntime, createProductionSourceChecker, createRuntimeDraftClient } from './runtime';
import { validateAutobloggerEnvironment } from './cli';
import { createPersistentWorkerState } from './github-runtime';
import type { HttpRequest, HttpTransport } from './http';
import type { ResearchResult, ShallowResearchResult } from './research';
import { createSafeSourceChecker } from './sources';
import * as sourceModule from './sources';
import * as runtimeHttp from './runtime-http';

afterEach(() => vi.restoreAllMocks());

const reviewUrls = ['https://www.ycombinator.com/library/video', 'https://example.com/video'];
const reviewOptions = { query: 'demo day video', articleTitle: 'Demo Day Video', questions: [] };

function offlineSourceTransport() {
  vi.spyOn(runtimeHttp, 'createNodeDnsResolver').mockReturnValue(async () => ['93.184.216.34']);
  vi.spyOn(runtimeHttp, 'createNodeSourceHttpTransport').mockReturnValue(async request => ({
    status: 200, url: request.url, redirected: false, peerAddress: request.allowedPeerAddresses[0],
    headers: { 'content-type': 'text/html' },
    body: (async function* () { yield new TextEncoder().encode('<main><p>Rehearse the demo day video before presenting the product to the audience.</p></main>'); })(),
  }));
}

it('uses the supplied source reviewer and propagates its failure without lexical fallback or retry', async () => {
  offlineSourceTransport();
  let calls = 0;
  const checker = createProductionSourceChecker({ async generate() { calls++; throw new Error('offline source review failed'); } });
  await expect(checker.selectWithContent(reviewUrls, reviewOptions)).rejects.toThrow('offline source review failed');
  expect(calls).toBe(1);
});

it.each(['pilot', 'research'] as const)('wires configured article review while preserving credential-free research: %s', async command => {
  offlineSourceTransport();
  const checkerFactory = vi.spyOn(sourceModule, 'createSafeSourceChecker');
  const root = await mkdtemp(join(tmpdir(), 'autoblogger-source-wiring-'));
  await mkdir(join(root, '.git'));
  const requests: HttpRequest[] = [];
  const config = validateAutobloggerEnvironment(command, {
    APIFY_TOKEN: 'fixture-apify', ...(command === 'pilot' ? { OPENAI_API_KEY: 'fixture-model' } : {}),
    KEYWORD_PROVIDER: 'pending', GITHUB_TOKEN: 'fixture-state', GITHUB_REPOSITORY: 'owner/icp',
    LANDER_REPOSITORY: root, LANDER_OWNER: 'owner', LANDER_NAME: 'lander', LANDER_BASE_REF: 'feature',
    LANDER_READ_TOKEN: 'github_pat_read_inventory_fixture_123456',
    OPENAI_REASONING_EFFORT: 'high', OPENAI_MAX_OUTPUT_TOKENS: '48000', OPENAI_TIMEOUT_MS: '600000',
  });
  const transport: HttpTransport = async request => {
    requests.push(request);
    const url = new URL(request.url);
    if (url.hostname === 'api.openai.com') return { status: 503, headers: {}, body: { error: 'offline source review unavailable' } };
    expect(url.hostname).toBe('api.github.com');
    expect(request.method).toBe('GET');
    let body: unknown;
    if (url.pathname.endsWith('/git/ref/heads/feature')) body = { object: { sha: 'a'.repeat(40) } };
    else if (url.pathname.endsWith('/pulls/55')) body = { state: 'open', merged: false, base: { ref: 'main' } };
    else if (url.pathname.includes('/git/trees/')) body = { tree: [], truncated: false };
    else if (url.pathname.endsWith('/pulls') || url.pathname.endsWith('/git/matching-refs/heads/')) body = [];
    else throw new Error(`Unexpected endpoint: ${url.pathname}`);
    return { status: 200, headers: {}, body };
  };
  await createProductionAutobloggerRuntime(config, process.cwd(), { transport });
  const checker = checkerFactory.mock.results[0].value as ReturnType<typeof createSafeSourceChecker>;
  if (command === 'pilot') {
    await expect(checker.selectWithContent(reviewUrls, reviewOptions)).rejects.toThrow('offline source review unavailable');
    const modelRequests = requests.filter(({ url }) => url === 'https://api.openai.com/v1/responses');
    expect(modelRequests).toHaveLength(1);
    expect(JSON.parse(modelRequests[0].body!)).toMatchObject({ model: 'gpt-5.5', reasoning: { effort: 'high' }, max_output_tokens: 48000 });
  } else {
    expect((await checker.selectWithContent(reviewUrls, reviewOptions)).sourceDocuments).toHaveLength(2);
    expect(requests.every(({ url }) => new URL(url).hostname === 'api.github.com')).toBe(true);
    await expect(createRuntimeDraftClient(config, transport).generate({ name: 'unconfigured', schema: {}, system: '', input: {} })).rejects.toThrow('OPENAI_API_KEY');
  }
});

it('carries CLI quality settings through the production runtime to the Responses API', async () => {
  const config = validateAutobloggerEnvironment('pilot', {
    APIFY_TOKEN: 'fixture-apify', OPENAI_API_KEY: 'fixture-model', KEYWORD_PROVIDER: 'pending', GITHUB_TOKEN: 'fixture-state',
    GITHUB_REPOSITORY: 'owner/icp', LANDER_REPOSITORY: '/tmp/fixture-lander', LANDER_OWNER: 'owner', LANDER_NAME: 'lander',
    LANDER_BASE_REF: 'feature', LANDER_READ_TOKEN: 'github_pat_read_inventory_fixture_123456',
    OPENAI_REASONING_EFFORT: 'high', OPENAI_MAX_OUTPUT_TOKENS: '48000', OPENAI_TIMEOUT_MS: '600000',
  });
  const requests: HttpRequest[] = [];
  const client = createRuntimeDraftClient(config, async request => {
    requests.push(request);
    return { status: 200, headers: {}, body: { status: 'completed', output: [
      { type: 'message', content: [{ type: 'output_text', text: '{}' }] },
    ] } };
  });
  await expect(client.generate({ name: 'fixture', schema: { type: 'object' }, system: 'Fixture', input: {} })).resolves.toEqual({});
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://api.openai.com/v1/responses');
  expect(JSON.parse(requests[0].body!)).toMatchObject({ model: 'gpt-5.5', reasoning: { effort: 'high' }, max_output_tokens: 48000 });
});

async function sourceDocumentsFor(urls: string[], body: string) {
  const checker = createSafeSourceChecker({
    resolveHostname: async () => ['93.184.216.34'],
    authorityPolicies: [{ hostname: 'primary.example' }],
    transport: async (request) => ({
      status: 200, url: request.url, redirected: false,
      peerAddress: request.allowedPeerAddresses[0],
      headers: { 'content-type': 'text/html' },
      body: (async function* () { yield new TextEncoder().encode(body); })(),
    }),
  });
  // Synthetic transport data, never live or manually curated page facts.
  return Promise.all(urls.map((url) => checker.read(url)));
}

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
    }, { artifactDir: 'private-receipts' });
    await cp(join(process.cwd(), 'docs/research/campaigns'), join(root, 'docs/research/campaigns'), { recursive: true });
    const runtime = await createProductionAutobloggerRuntime(config, root, { transport });
    await expect(stat(join(root, 'private-receipts'))).rejects.toThrow();
    expect(requests.some(({ url }) => url.endsWith('/pulls/12/files?per_page=100'))).toBe(true);
    const report = await runtime.execute({ command: 'research', runId: 'early-dedupe' });
    expect(report.counts).toMatchObject({ scanned: 0, drafted: 0 });
    for (const candidate of [existing, openPr, reserved]) {
      expect(state.decisions[candidateFingerprints(candidate).candidate]).toBeDefined();
    }
    expect(state.decisions[candidateFingerprints(reserved).candidate].reason).toBe('reconciliation_required');
    expect(state.pullRequests[candidateFingerprints(openPr).candidate]).toMatchObject({ number: 12 });
    const auditFiles = (await readdir(join(root, 'private-receipts'), { recursive: true }))
      .filter(name => name.endsWith('validation-report.json'));
    const audit = await Promise.all(auditFiles.map(async name => JSON.parse(await readFile(join(root, 'private-receipts', name), 'utf8'))));
    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({ runId: 'early-dedupe', phase: 'execution', status: 'started' }),
      expect.objectContaining({ runId: 'early-dedupe', phase: 'execution', status: 'completed', verdict: { status: 'researched' } }),
    ]));
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

  it.each([
    { label: 'legacy absence', bodyStart: undefined, valid: true },
    { label: 'no heading', bodyStart: 0, valid: true },
    { label: 'heading prefix', bodyStart: 16, valid: true },
    { label: 'negative offset', bodyStart: -1, valid: false },
    { label: 'fractional offset', bodyStart: 1.5, valid: false },
    { label: 'out-of-bounds offset', bodyStart: 1000, valid: false },
    { label: 'NaN offset', bodyStart: NaN, valid: false },
    { label: 'infinite offset', bodyStart: Infinity, valid: false },
  ])('preserves body fact provenance and validates bodyStart: $label', ({ bodyStart, valid }) => {
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
    const passageText = 'Demo checklist. Do not skip rehearsal before sharing.';
    const preamble = 'Document preamble. ';
    const sourceDocuments = evidence.sources.map((source) => ({
      url: source.originalUrl, finalUrl: source.finalUrl, status: 200, reachable: true,
      authoritative: source.authoritative, checkedAt: '2026-09-05T00:01:30.000Z',
      contentType: 'text/html', bodySha256: 'a'.repeat(64),
      text: preamble + passageText,
      passages: [{ text: passageText, start: preamble.length, end: preamble.length + passageText.length,
        ...(bodyStart === undefined ? {} : { bodyStart }),
      }],
    }));
    const result: ResearchResult = Object.assign({ candidate, evidence, provenance: shallow.provenance }, { sourceDocuments });
    const metrics = KeywordMetricsSchema.parse({ schemaVersion: 1, provider: 'pending', observedAt: null, volume: null, difficulty: null, cpc: null, intent: 'informational' });

    const input = { result, shallow, metrics, generatedAt: '2026-09-05T00:02:00.000Z' };
    if (!valid) {
      expect(() => buildDraftingContextFromResearch(input)).toThrow(/invalid verified source body document/i);
      return;
    }
    const context = buildDraftingContextFromResearch(input);
    expect(context.sourceFacts).toHaveLength(2);
    expect(context.sourceFacts[0]).toMatchObject({
      url: 'https://primary.example/guide',
      checkedAt: '2026-09-05T00:01:30.000Z',
      facts: [
        { text: passageText, evidenceKind: 'body', ...(bodyStart === undefined ? {} : { bodyStart }) },
      ],
    });
    if (bodyStart === undefined) expect(context.sourceFacts[0].facts[0]).not.toHaveProperty('bodyStart');
    expect(JSON.stringify(context.sourceFacts)).not.toContain('visible product proof');
    expect(context.checkedSources.every(({ reachable, status }) => reachable && status === 200)).toBe(true);
    expect(context.provenance).toEqual({ apifyRunId: 'run-s', apifyDatasetId: 'data-s', query: candidate.primaryKeyword, locale: 'en-US', capturedAt: '2026-09-05' });
    for (const mutatedDocuments of [
      undefined,
      [],
      sourceDocuments.map((document) => ({ ...document, finalUrl: 'https://unrelated.example/claim' })),
      sourceDocuments.map((document) => ({ ...document, passages: [{ text: 'A claim not present in the document.', start: 0, end: 35 }] })),
      sourceDocuments.map((document) => ({ ...document, reachable: false, status: 503 })),
      sourceDocuments.map((document) => ({ ...document,
        text: '\u200d' + document.text,
        passages: [{ text: '\u200d' + document.text, start: 0, end: document.text.length + 1 }],
      })),
    ]) {
      expect(() => buildDraftingContextFromResearch({
        result: Object.assign({}, result, { sourceDocuments: mutatedDocuments }), shallow, metrics,
        generatedAt: '2026-09-05T00:02:00.000Z',
      })).toThrow(/body|document|source/i);
    }
  });

  it('bounds complete body facts and ignores oversized SERP snippets', async () => {
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
    const sourceDocuments = await sourceDocumentsFor(evidence.sources.map(({ originalUrl }) => originalUrl),
      '<main><section><p>' + 'Do not truncate this body paragraph. '.repeat(70) + '</p></section>'
      + '<section><p>Rehearse the founder video before sharing the final file.</p></section></main>');
    const context = buildDraftingContextFromResearch({
      result: Object.assign({ candidate, evidence, provenance: shallow.provenance }, { sourceDocuments }),
      shallow,
      metrics,
      generatedAt: '2026-09-05T00:02:00.000Z',
    });

    expect(context.sourceFacts[0].facts).toEqual([
      { id: 'source-1-fact-1', text: 'Rehearse the founder video before sharing the final file.', evidenceKind: 'body', bodyStart: 0 },
    ]);
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
        faqEvidencePlan: {schemaVersion: 1, contextHash: 'b'.repeat(64), candidateQuestions: ['Observed question?'],
          selections: [{question: 'Observed question?', intent: 'definition',
            anchors: [{sourceFactId: 'body-1', excerpt: 'Private exact body anchor for the evidence receipt.'}]}]},
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
    expect(compact).not.toContain('Private exact body anchor');
    const evidencePath = join(root, 'fixture-article.faq-evidence.json');
    expect(JSON.parse(await readFile(evidencePath, 'utf8'))).toEqual(report.artifacts[0].faqEvidencePlan);
    expect((await stat(evidencePath)).mode & 0o777).toBe(0o600);
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
