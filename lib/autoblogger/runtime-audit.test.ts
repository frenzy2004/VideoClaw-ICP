import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntimeAudit } from './runtime-audit';
import { createProductionSourceChecker, createRuntimeDraftClient, writeAutobloggerArtifacts } from './runtime';
import * as runtimeHttp from './runtime-http';
import { createSafeSourceChecker } from './sources';
import { createStructuredDrafter } from './drafting';
import { candidateFingerprints } from './domain';
import type { DraftingContext } from './content-bundle';
import type { HttpRequest, HttpTransport } from './http';
import type { StructuredOutputRequest } from './openai-responses';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
afterEach(() => vi.restoreAllMocks());
const request: StructuredOutputRequest = {
  name: 'videoclaw_article_critique_v1', schema: { type: 'object' }, system: 'Original system instructions.',
  input: { draft: { directAnswer: 'Private generated answer.' }, sourceFacts: [{ text: 'Private page passage.' }] },
};
const modelConfig = { openaiApiKey: 'opaque-model-credential', openaiModel: 'gpt-5.5',
  openaiLimits: { reasoningEffort: 'high' as const, maxOutputTokens: 48000, timeoutMs: 600000 } };
const envelope = (value: unknown) => ({ status: 200, headers: { 'x-private-header': 'never-retain-this-header' },
  body: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] } });

async function fixture(directory = 'private-output') {
  const root = await mkdtemp(join(tmpdir(), 'runtime-audit-'));
  const output = join(root, directory);
  const audit = createRuntimeAudit({ secrets: [modelConfig.openaiApiKey, 'opaque-source-credential'],
    write: (record, name) => writeAutobloggerArtifacts(record, join(output, name), root) });
  async function files() {
    try { return (await readdir(output, { recursive: true })).filter(name => name.endsWith('.json')).sort(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  async function records() {
    return Promise.all((await files()).map(async name => JSON.parse(await readFile(join(output, name), 'utf8'))));
  }
  return { root, output, audit, files, records };
}

describe('standard runtime audit', () => {
  it('blocks paid dispatch after a caught source receipt failure while allowing the state transport to save', async () => {
    const f = await fixture();
    const audit = createRuntimeAudit({ write: async (record, name) => {
      if ((record as { phase: string }).phase === 'source_selection') throw new Error('source receipt disk failure');
      await writeAutobloggerArtifacts(record, join(f.output, name), f.root);
    } });
    const dispatched: HttpRequest[] = [];
    const response = { status: 200, headers: {}, body: {} };
    const transport: HttpTransport = async request => { dispatched.push(request); return response; };
    const paid = audit.paidTransport(transport);
    const checker = audit.sourceChecker(createSafeSourceChecker({ resolveHostname: async () => ['93.184.216.34'],
      transport: async () => { throw new Error('Source retrieval must not start after its receipt fails'); } }));
    const stateRequest: HttpRequest = { method: 'PUT', url: 'https://api.github.com/repos/owner/state/contents/state.json',
      headers: { Authorization: 'Bearer opaque-state-fixture' }, body: '{"failure":"audit_integrity_failed"}', signal: new AbortController().signal };
    await expect(audit.execute({ runId: 'caught-source-failure' }, async () => {
      // Research catches selection failures before trying an Apify support search.
      await expect(checker.selectWithContent(['https://www.ycombinator.com/video'])).rejects.toThrow(/audit/i);
      for (const url of ['https://api.apify.com/v2/acts/apify~google-search-scraper/runs',
        'https://api.openai.com/v1/responses', 'https://api.semrush.com/apis/v4/keywords/v1/metrics', 'https://api.ahrefs.com/v3/keywords-explorer/overview']) {
        await expect(paid({ ...stateRequest, method: 'POST', url })).rejects.toThrow(/audit/i);
      }
      expect(await transport(stateRequest)).toBe(response);
      return { status: 'failed' };
    })).rejects.toThrow(/audit/i);
    expect(dispatched).toEqual([stateRequest]);
    expect(JSON.stringify(await f.records())).not.toMatch(/Authorization|opaque-state-fixture|headers/);
  });

  it('retains the first fetched hash before selection fails with only one usable body', async () => {
    const f = await fixture();
    const body = '<main><p>Rehearse the demo video before sharing the recording with the audience.</p></main>';
    let reads = 0;
    vi.spyOn(runtimeHttp, 'createNodeDnsResolver').mockReturnValue(async () => ['93.184.216.34']);
    vi.spyOn(runtimeHttp, 'createNodeSourceHttpTransport').mockReturnValue(async request => ({
      status: ++reads === 1 ? 200 : 403, url: request.url, redirected: false, peerAddress: request.allowedPeerAddresses[0],
      headers: { 'content-type': 'text/html' },
      body: (async function* () { yield new TextEncoder().encode(body); })(),
    }));
    const checker = createProductionSourceChecker({ async generate() { throw new Error('Early source-count failure must precede model admission'); } }, f.audit);
    await expect(f.audit.execute({ runId: 'insufficient-sources' }, () => checker.selectWithContent([
      'https://www.ycombinator.com/video', 'https://secondary.example/video',
    ], { query: 'demo video' }))).rejects.toThrow(/two usable body evidence sources/);
    expect(reads).toBe(2);
    const receipts = (await f.records()).filter(row => row.phase === 'source_retrieval');
    expect(receipts).toHaveLength(1);
    expect(receipts[0].sources).toEqual([{ finalUrl: 'https://www.ycombinator.com/video',
      checkedAt: expect.stringMatching(/^\d{4}-.*Z$/), bodySha256: createHash('sha256').update(body).digest('hex') }]);
    expect(JSON.stringify(await f.records())).not.toContain('Rehearse');
  });

  it.each([false, true])('retains fetched source receipts even when independent review fails: %s', async fail => {
    const f = await fixture();
    const body = '<main><p>Rehearse the demo video and check the final recording before sharing it with the audience.</p></main>';
    const urls = ['https://www.ycombinator.com/redirect', 'https://secondary.example/video'];
    const reads: string[] = [];
    const model = f.audit.client(createRuntimeDraftClient(modelConfig, async wire => {
      if (fail) return { status: 503, headers: {}, body: { error: 'private source review failure' } };
      const input = JSON.parse(JSON.parse(wire.body!).input[1].content[0].text);
      return envelope({ schemaVersion: 1, contextHash: input.contextHash,
        decisions: input.documents.map((doc: { id: string; passages: { bodyText: string }[] }) => ({
          documentId: doc.id, relevant: true, reason: 'Relevant workflow body.',
          anchors: [{ passageIndex: 0, excerpt: doc.passages[0].bodyText }],
        })) });
    }));
    vi.spyOn(runtimeHttp, 'createNodeDnsResolver').mockReturnValue(async () => ['93.184.216.34']);
    vi.spyOn(runtimeHttp, 'createNodeSourceHttpTransport').mockReturnValue(async request => {
        reads.push(request.url);
        const redirect = request.url.endsWith('/redirect');
        return { status: redirect ? 302 : 200, url: request.url, redirected: false, peerAddress: request.allowedPeerAddresses[0],
          headers: { 'content-type': 'text/html', 'x-private': 'opaque-source-credential', ...(redirect ? { location: '/video' } : {}) },
          body: (async function* () { yield new TextEncoder().encode(redirect ? '' : body); })() };
    });
    const checker = createProductionSourceChecker(model, f.audit);
    const execution = f.audit.execute({ runId: 'source-run' }, () => checker.selectWithContent(urls, { query: 'demo video', articleTitle: 'Prepare a Demo Video' }));
    if (fail) await expect(execution).rejects.toThrow('private source review failure');
    else {
      const result = await execution;
      expect(result.sourceDocuments).toHaveLength(2);
      expect(result.sourceDocuments.every(doc => doc.text.includes('Rehearse the demo video'))).toBe(true);
      const completed = (await f.records()).find(row => row.phase === 'source_selection' && row.status === 'completed');
      expect(completed.sources).toEqual(result.sourceDocuments.map(({ finalUrl, checkedAt, bodySha256 }) => ({ finalUrl, checkedAt, bodySha256 })));
      expect((await f.records()).find(row => row.phase === 'source_relevance_gate' && row.status === 'completed').verdict.decisions)
        .toEqual(expect.arrayContaining([expect.objectContaining({ documentId: 'source-1', relevant: true })]));
    }
    const records = await f.records();
    const observed = records.find(row => row.phase === 'source_documents');
    expect(observed.sources).toEqual(['https://www.ycombinator.com/video', 'https://secondary.example/video'].map(finalUrl => ({
      finalUrl, checkedAt: expect.stringMatching(/^\d{4}-.*Z$/), bodySha256: createHash('sha256').update(body).digest('hex'),
    })));
    expect(reads).toHaveLength(3);
    expect(JSON.stringify(records)).not.toMatch(/Rehearse|<main>|opaque-source-credential|x-private|private source review failure/);
  });

  it.each([false, true])('records the real FAQ acceptance gate (invalid anchor: %s) and preserves input', async invalid => {
    const f = await fixture();
    const context = evidenceContext();
    const before = structuredClone(context);
    let calls = 0;
    const client = f.audit.client(createRuntimeDraftClient(modelConfig, async wire => {
      calls++;
      const input = JSON.parse(JSON.parse(wire.body!).input[1].content[0].text);
      return envelope({ status: 'ready', contextHash: input.contextHash, reason: 'Three anchored questions.',
        selections: context.evidence.signals.peopleAlsoAsk.map((question, index) => ({ question, intent: `intent-${index}`,
          anchors: [{ sourceFactId: `fact-${index}`, excerpt: invalid ? 'Invented content that is not present in the source body.' : context.sourceFacts[0].facts[index].text }],
        })) });
    }));
    const drafter = f.audit.drafter(createStructuredDrafter({ client, mediaAllowlist: [{ id: 'demo', campaignIds: [context.candidate.campaignId],
      src: '/demo.mp4', poster: '/demo.jpg', alt: 'Demo', caption: 'Product demo', width: 1280, height: 720 }] }));
    const run = f.audit.execute({ runId: 'evidence-run' }, () => drafter.prepareEvidence!(context));
    if (invalid) await expect(run).rejects.toThrow(/anchor/i);
    else {
      const prepared = await run;
      expect(prepared.sourceFacts).toEqual(before.sourceFacts);
      expect(prepared.faqEvidencePlan?.selections).toHaveLength(3);
      const accepted = (await f.records()).find(row => row.phase === 'faq_evidence_gate' && row.status === 'completed');
      expect(accepted.resultSha256).toBe(digest(prepared));
      expect(accepted.verdict.selections[0]).toMatchObject({ questionSha256: digest(context.evidence.faqQuestions[0]), anchors: [{ sourceFactId: 'fact-0' }] });
    }
    expect(context).toEqual(before);
    expect(calls).toBe(1);
    const records = await f.records();
    expect(records).toEqual(expect.arrayContaining([expect.objectContaining({ phase: 'faq_evidence_gate', status: invalid ? 'failed' : 'completed' })]));
    expect(JSON.stringify(records)).not.toContain(context.sourceFacts[0].facts[0].text);
  });

  it('records the real draft gate rejection without adding generation or changing the verdict', async () => {
    const f = await fixture();
    const context = evidenceContext();
    const real = createStructuredDrafter({ client: createRuntimeDraftClient(modelConfig, async () => { throw new Error('Unexpected model call'); }), mediaAllowlist: [] });
    const expected = await real.draft(context);
    const result = await f.audit.execute({ runId: 'blocked-draft' }, () => f.audit.drafter(real).draft(context));
    expect(result).toEqual(expected);
    expect(result).toMatchObject({ status: 'blocked', reason: 'media_mapping_required' });
    expect((await f.records()).find(row => row.phase === 'draft_gate' && row.status === 'completed')).toMatchObject({
      resultSha256: digest(expected), verdict: { status: 'blocked', reasonSha256: digest('media_mapping_required') },
    });
  });
  it('retains independent critique/repair verdicts and hashes without changing requests, results or model count', async () => {
    const f = await fixture();
    const responses = [
      { approved: false, issues: [{ id: 'issue-1', code: 'content.unsupported', message: 'Private page passage.',
        repairInstruction: 'Remove the unsupported claim.', locations: ['/directAnswer'] }],
        supportEvaluations: [{ bindingIndex: 0, bindingHash: 'a'.repeat(64), supported: false, kind: 'source_claim', rationale: 'Private page passage.' }],
        editorialReview: { draftHash: 'b'.repeat(64), instructionConsistency: { passed: false, issueIds: ['issue-1'], rationale: 'Conflicting steps.' } } },
      { directAnswer: 'Private repaired answer.' },
      { approved: true, evaluations: [{ issueId: 'issue-1', resolved: true, message: 'The claim was removed.' }], newIssues: [],
        supportEvaluations: [{ bindingIndex: 0, bindingHash: 'c'.repeat(64), supported: true, kind: 'original_guidance', rationale: 'Independent advice.' }],
        referenceReviews: [{ bindingIndex: 0, bindingHash: 'c'.repeat(64), contextHash: 'd'.repeat(64), classification: 'non_product', subject: 'A recording', rationale: 'No product promise.' }] },
    ];
    const names = ['videoclaw_article_critique_v1', 'videoclaw_article_repair_patch_v2', 'videoclaw_article_repair_verification_v1'];
    const run = async (audited: boolean) => {
      const requests: HttpRequest[] = [];
      const externalResponses = responses.map(envelope);
      const beforeResponses = structuredClone(externalResponses);
      const transport: HttpTransport = async req => { requests.push(req); return externalResponses[requests.length - 1]; };
      const real = createRuntimeDraftClient(modelConfig, audited ? f.audit.paidTransport(transport) : transport);
      const client = audited ? f.audit.client(real) : real;
      const inputs = names.map(name => ({ ...structuredClone(request), name }));
      const beforeInputs = structuredClone(inputs);
      const results = [];
      for (const input of inputs) results.push(await client.generate(input));
      expect(inputs).toEqual(beforeInputs);
      expect(externalResponses).toEqual(beforeResponses);
      expect(results).toEqual(responses);
      return requests.map(({ method, url, headers, body }) => ({ method, url, headers, body }));
    };
    const baseline = await run(false);
    const actual = await f.audit.execute({ runId: 'review-run' }, () => run(true));
    expect(actual).toEqual(baseline);
    expect(actual).toHaveLength(3);
    const records = await f.records();
    for (const [index, phase] of names.entries()) {
      const started = records.find(row => row.phase === phase && row.status === 'started');
      const completed = records.find(row => row.phase === phase && row.status === 'completed');
      expect(started).toMatchObject({ runId: 'review-run', inputSha256: digest({ ...request, name: phase }) });
      expect(completed).toMatchObject({ operationId: started.operationId, resultSha256: digest(responses[index]) });
    }
    expect(records.find(row => row.phase === names[0] && row.status === 'completed').verdict).toMatchObject({
      approved: false, issues: [{ id: 'issue-1', code: 'content.unsupported', locations: ['/directAnswer'] }],
      supportEvaluations: [{ bindingIndex: 0, bindingHash: 'a'.repeat(64), supported: false, kind: 'source_claim' }],
      editorialReview: { draftHash: 'b'.repeat(64), instructionConsistency: { passed: false, issueIds: ['issue-1'] } },
    });
    expect(records.find(row => row.phase === names[2] && row.status === 'completed').verdict).toMatchObject({
      approved: true, evaluations: [{ issueId: 'issue-1', resolved: true }], newIssues: [],
      referenceReviews: [{ classification: 'non_product', contextHash: 'd'.repeat(64) }],
    });
    const saved = JSON.stringify(records);
    for (const absent of ['Private', 'Authorization', 'headers', modelConfig.openaiApiKey, 'never-retain-this-header', 'Original system']) expect(saved).not.toContain(absent);
    for (const file of await f.files()) expect((await stat(join(f.output, file))).mode & 0o777).toBe(0o600);
    expect((await stat(f.output)).mode & 0o777).toBe(0o700);
    expect(Buffer.byteLength(saved)).toBeLessThan(16000);
  });

  it.each(['http', 'malformed'] as const)('records %s failure without raw bodies or changed exceptions/retries', async failure => {
    const f = await fixture();
    let calls = 0;
    const transport: HttpTransport = async () => {
      calls++;
      return failure === 'http' ? { status: 503, headers: {}, body: { error: 'private upstream detail opaque-model-credential' } }
        : { status: 200, headers: {}, body: 'private malformed wire body' };
    };
    const real = createRuntimeDraftClient(modelConfig, transport);
    const baseline = await real.generate(request).catch(error => error);
    const error = await f.audit.execute({ runId: 'failed-run' }, () => f.audit.client(real).generate(request)).catch(error => error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe((baseline as Error).message);
    expect(calls).toBe(2); // One baseline and one audited call; neither retries.
    const records = await f.records();
    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: request.name, status: 'failed', errorSha256: digest(String(error)) }),
      expect.objectContaining({ phase: 'execution', status: 'failed' }),
    ]));
    expect(JSON.stringify(records)).not.toMatch(/private|credential|headers/);
  });

  it('passes through result identities but fails execution on disk errors, preserving original provider errors', async () => {
    const error = new Error('original failure');
    const response = Object.freeze({ approved: true });
    const f = await fixture();
    const unwritable = createRuntimeAudit({ write: async record => {
      if ((record as { status: string }).status !== 'started') throw new Error('disk full');
    } });
    for (const audit of [f.audit, unwritable]) {
      const client = audit.client({ async generate(received) { expect(received).toBe(request); return response; } });
      if (audit === f.audit) expect(await audit.execute({ runId: 'identity' }, () => client.generate(request))).toBe(response);
      else await expect(audit.execute({ runId: 'identity' }, () => client.generate(request))).rejects.toThrow(/audit/i);
      await expect(audit.execute({ runId: 'identity-error' }, () => audit.client({ async generate() { throw error; } }).generate(request))).rejects.toBe(error);
    }
  });

  it('does not audit construction, direct wrapper calls, or work after an execution closes', async () => {
    const f = await fixture();
    const client = f.audit.client(createRuntimeDraftClient(modelConfig, async () => envelope({ approved: true })));
    await client.generate(request);
    expect(await f.files()).toEqual([]);
    let lateCall!: () => Promise<unknown>;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await f.audit.execute({ runId: 'closed-run' }, async () => {
      // This continuation inherits async context but must not retain an active run.
      const late = pending.then(() => client.generate(request));
      lateCall = () => { release(); return late; };
      return { status: 'researched' };
    });
    const before = await f.records();
    await lateCall();
    expect(await f.records()).toEqual(before);
  });

  it('keeps repeated and overlapping runs in independent files without overwriting earlier receipts', async () => {
    const f = await fixture();
    const client = f.audit.client(createRuntimeDraftClient(modelConfig, async () => envelope({ approved: true })));
    await f.audit.execute({ runId: 'same-run' }, () => client.generate(request));
    const before = new Map(await Promise.all((await f.files()).map(async file => [file, await readFile(join(f.output, file), 'utf8')] as const)));
    await Promise.all(['same-run', 'other-run'].map(runId => f.audit.execute({ runId }, () => client.generate(request))));
    const records = await f.records();
    expect(records).toHaveLength(12);
    expect(new Set(records.map(row => row.executionId)).size).toBe(3);
    for (const id of new Set(records.map(row => row.executionId))) {
      const group = records.filter(row => row.executionId === id);
      expect(new Set(group.map(row => row.runId)).size).toBe(1);
      expect(group.map(row => row.sequence)).toEqual([1, 2, 3, 4]);
    }
    for (const [file, content] of before) expect(await readFile(join(f.output, file), 'utf8')).toBe(content);
  });

  it.each(['../outside', 'link'] as const)('fails execution for unsafe artifact destination %s', async directory => {
    const f = await fixture(directory);
    const outside = await mkdtemp(join(tmpdir(), 'audit-outside-'));
    if (directory === 'link') await symlink(outside, f.output);
    let calls = 0;
    const client = f.audit.client(createRuntimeDraftClient(modelConfig, async () => { calls++; return envelope({ approved: true }); }));
    await expect(f.audit.execute({ runId: 'safe-run' }, () => client.generate(request))).rejects.toThrow(/audit/i);
    expect(calls).toBe(0);
    expect(await readdir(outside)).toEqual([]);
    if (directory === '../outside') await expect(stat(f.output)).rejects.toThrow();
  });

  it.each(['sk-proj-abcdefghijklmnopqrstuv', 'opaque-source-credential'])(
    'fails execution on secret-bearing verdict fields without changing model output: %s', async secret => {
      const f = await fixture();
      const response = { approved: false, issues: [{ id: secret, code: 'content.unsupported' }] };
      const client = f.audit.client(createRuntimeDraftClient(modelConfig, async () => envelope(response)));
      const before = structuredClone(response);
      await expect(f.audit.execute({ runId: 'secret-receipt' }, () => client.generate(request))).rejects.toThrow(/audit/i);
      expect(response).toEqual(before);
      const records = await f.records();
      expect(records.some(row => row.phase === request.name && row.status === 'completed')).toBe(false);
      expect(records.find(row => row.phase === 'execution' && row.status === 'failed').omittedRecords).toBe(1);
      expect(JSON.stringify(records)).not.toContain(secret);
    },
  );

  it('does not invoke an operation when its started receipt fails', async () => {
    let calls = 0;
    const audit = createRuntimeAudit({ write: async record => {
      if ((record as { phase: string }).phase !== 'execution') throw new Error('disk full at request receipt');
    } });
    const client = audit.client(createRuntimeDraftClient(modelConfig, async () => { calls++; return envelope({ approved: true }); }));
    await expect(audit.execute({ runId: 'start-failed' }, () => client.generate(request))).rejects.toThrow(/audit/i);
    expect(calls).toBe(0);
  });

  it.each([{ headers: { innocuous: 'short' } }, { apiKey: 'short' }, { note: '{"Authorization":"short"}' }])(
    'rejects header/credential structures before dispatch and in model results: %#', async unsafe => {
      const f = await fixture();
      let calls = 0;
      const client = f.audit.client(createRuntimeDraftClient(modelConfig, async () => { calls++; return envelope(unsafe); }));
      await expect(f.audit.execute({ runId: 'unsafe-input' }, () => client.generate({ ...request, input: unsafe }))).rejects.toThrow(/audit/i);
      expect(calls).toBe(0);
      await expect(f.audit.execute({ runId: 'unsafe-output' }, () => client.generate(request))).rejects.toThrow(/audit/i);
      expect(calls).toBe(1);
      expect(JSON.stringify(await f.records())).not.toMatch(/headers|apiKey|Authorization|short/);
    },
  );

  it.each(['/video?token=short', '/opaque%2Dsource%2Dcredential'])('rejects credential-bearing source URL receipts: %s', async suffix => {
    const f = await fixture();
    vi.spyOn(runtimeHttp, 'createNodeDnsResolver').mockReturnValue(async () => ['93.184.216.34']);
    vi.spyOn(runtimeHttp, 'createNodeSourceHttpTransport').mockReturnValue(async request => ({
      status: 200, url: request.url, redirected: false, peerAddress: request.allowedPeerAddresses[0], headers: { 'content-type': 'text/html' },
      body: (async function* () { yield new TextEncoder().encode('<main><p>Rehearse the recording before sharing the video with its intended audience.</p></main>'); })(),
    }));
    const checker = createProductionSourceChecker(undefined, f.audit);
    await expect(f.audit.execute({ runId: 'unsafe-source' }, () => checker.read(`https://www.ycombinator.com${suffix}`))).rejects.toThrow(/audit/i);
    expect(JSON.stringify(await f.records())).not.toContain(suffix);
  });

  it('does not continue to a later operation after losing a successful response receipt', async () => {
    let calls = 0;
    const audit = createRuntimeAudit({ write: async record => {
      const row = record as { phase: string; status: string };
      if (row.phase === request.name && row.status === 'completed') throw new Error('disk full at response receipt');
    } });
    const client = audit.client(createRuntimeDraftClient(modelConfig, async () => { calls++; return envelope({ approved: true }); }));
    await expect(audit.execute({ runId: 'result-failed' }, async () => {
      await client.generate(request);
      return client.generate({ ...request, name: 'later-model-phase' });
    })).rejects.toThrow(/audit/i);
    expect(calls).toBe(1);
  });
});

function evidenceContext(): DraftingContext {
  const candidate: DraftingContext['candidate'] = { schemaVersion: 1, articleId: 'vc-c2-011', campaignId: 'accelerator-demo-day-founder',
    icp: 'Startup founder', primaryKeyword: 'explainer video', secondaryKeywords: [], title: 'Plan an Explainer Video',
    slug: 'plan-an-explainer-video', intent: 'informational', funnelStage: 'middle' };
  const questions = ['What is an explainer video?', 'How to make an explainer video?', 'What are examples of explainer videos?'];
  const urls = ['https://primary.example/video', 'https://secondary.example/video'];
  return { candidate, evidence: { schemaVersion: 2, candidateFingerprint: candidateFingerprints(candidate).candidate,
    signals: { autocomplete: ['explainer video planning'], peopleAlsoAsk: questions, relatedSearches: [] },
    serp: { organicResultCount: 8, peopleAlsoAsk: questions }, faqQuestions: questions,
    sources: urls.map(url => ({ originalUrl: url, finalUrl: url, authoritative: true })) },
    keywordMetrics: { schemaVersion: 1, provider: 'pending', observedAt: null, volume: null, difficulty: null, cpc: null, intent: 'informational' },
    checkedSources: urls.map(url => ({ url, finalUrl: url, status: 200, reachable: true, authoritative: true })),
    provenance: { apifyRunId: 'fixture-run', apifyDatasetId: 'fixture-dataset', query: candidate.primaryKeyword, locale: 'en-US', capturedAt: '2026-09-09' },
    sourceFacts: urls.map((url, index) => ({ id: `source-${index}`, label: 'Synthetic guide', url, checkedAt: '2026-09-09T01:00:00.000Z',
      facts: (index === 0 ? [
        'Short films that clarify a product or an idea are commonly known as explainer videos.',
        'Choose a single topic, write a concise script, record the scenes and review the final edit.',
        'Examples include animated product introductions and recorded walkthroughs of a service.',
      ] : ['Review the complete recording before sharing it with the intended audience.'])
        .map((text, factIndex) => ({ id: index === 0 ? `fact-${factIndex}` : 'other-fact', text, evidenceKind: 'body' as const })) })),
    productClaims: [], generatedAt: '2026-09-09T02:00:00.000Z' };
}
