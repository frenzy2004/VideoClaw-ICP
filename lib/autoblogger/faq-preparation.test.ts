import { describe, expect, it } from 'vitest';

import type { DraftingContext } from './content-bundle';
import { candidateFingerprints } from './domain';
import { faqBodyMatches } from './faq-evidence';
import { prepareFaqEvidence, validateFaqEvidencePlan, type FaqEvidencePlan } from './faq-preparation';
import type { StructuredOutputClient, StructuredOutputRequest } from './openai-responses';

// Entirely synthetic research; no runtime imports, private artifacts or network.
const questions = [
  'What is an explainer video?',
  'How to make an explainer video?',
  'What are examples of explainer videos?',
  'How to create an explainer video?',
  'How to make an explainer video with Canva?',
  'How to make an explainer video with Canvas?',
];
const heading = 'What is an explainer video? A detailed definition ';
const definition = 'Short films that clarify a product or an idea are commonly known as explainer videos.';
const procedure = 'Choose a single topic, write a concise script, record the scenes and review the final edit.';
const examples = 'Examples include animated product introductions and recorded walkthroughs of a service.';

function contextFixture(): DraftingContext {
  const candidate: DraftingContext['candidate'] = {
    schemaVersion: 1, articleId: 'vc-c2-011', campaignId: 'accelerator-demo-day-founder',
    icp: 'Startup founder preparing a product introduction', primaryKeyword: 'explainer video',
    secondaryKeywords: [], title: 'Plan an Explainer Video', slug: 'plan-an-explainer-video',
    intent: 'informational', funnelStage: 'middle',
  };
  const urls = ['https://guide.example/production', 'https://reference.example/examples'];
  return {
    candidate,
    evidence: {
      schemaVersion: 2, candidateFingerprint: candidateFingerprints(candidate).candidate,
      signals: { autocomplete: ['explainer video planning'], peopleAlsoAsk: [...questions], relatedSearches: [] },
      serp: { organicResultCount: 8, peopleAlsoAsk: questions.slice(3) },
      sources: urls.map(url => ({ originalUrl: url, finalUrl: url, authoritative: true })),
      faqQuestions: questions.slice(3),
    },
    keywordMetrics: { schemaVersion: 1, provider: 'pending', observedAt: null, volume: null,
      difficulty: null, cpc: null, intent: 'informational' },
    checkedSources: urls.map(url => ({ url, finalUrl: url, status: 200, reachable: true, authoritative: true })),
    provenance: { apifyRunId: 'fixture-run', apifyDatasetId: 'fixture-dataset', query: 'explainer video',
      locale: 'en-US', capturedAt: '2026-09-09' },
    sourceFacts: [
      { id: 'guide', label: 'Synthetic production guide', url: urls[0], checkedAt: '2026-09-09T01:00:00.000Z',
        facts: [
          { id: 'definition', evidenceKind: 'body', text: heading + definition, bodyStart: heading.length },
          { id: 'procedure', evidenceKind: 'body', text: procedure },
          { id: 'snippet', evidenceKind: 'serp_snippet', text: definition },
          { id: 'title', evidenceKind: 'serp_title', text: definition },
          { id: 'legacy', text: definition },
          { id: 'heading-only', evidenceKind: 'body', text: heading.trim(), bodyStart: heading.trim().length },
        ], excerpt: 'PRIVATE raw comparison material, omitted from model requests.' },
      { id: 'reference', label: 'Synthetic examples', url: urls[1], checkedAt: '2026-09-09T01:01:00.000Z',
        facts: [{ id: 'examples', evidenceKind: 'body', text: examples }] },
    ],
    productClaims: [], generatedAt: '2026-09-09T02:00:00.000Z',
  };
}

function selections(): FaqEvidencePlan['selections'] {
  return [
    { question: questions[0], intent: 'definition', anchors: [{ sourceFactId: 'definition', excerpt: definition }] },
    { question: questions[1], intent: 'production steps', anchors: [{ sourceFactId: 'procedure', excerpt: procedure }] },
    { question: questions[2], intent: 'examples', anchors: [{ sourceFactId: 'examples', excerpt: examples }] },
  ];
}

type Response = { status: string; contextHash: string; reason: string; selections: FaqEvidencePlan['selections'] };
function fixtureClient(change?: (response: Response, request: StructuredOutputRequest) => unknown) {
  const requests: StructuredOutputRequest[] = [];
  const client: StructuredOutputClient = {
    async generate(request) {
      requests.push(request);
      const { contextHash } = request.input as { contextHash: string };
      const response: Response = { status: 'ready', contextHash, reason: 'Three literal body anchors found.', selections: selections() };
      return change ? change(response, request) : response;
    },
  };
  return { client, requests };
}

async function preparedFixture() {
  return prepareFaqEvidence(contextFixture(), fixtureClient().client, questions);
}

describe('prepareFaqEvidence', () => {
  it('sends body-only anchor text separately from heading context without asking the model to count UTF-16 offsets', async () => {
    const context = contextFixture();
    const prefix = '🎬 Definition — ';
    context.sourceFacts[0].facts[0].text = prefix + definition;
    context.sourceFacts[0].facts[0].bodyStart = prefix.length;
    const before = structuredClone(context);
    const fixture = fixtureClient((response, request) => {
      const input = request.input as {sourceFacts: Array<{facts: Array<{id: string; bodyText: string; headingContext: string}>}>};
      expect(input.sourceFacts[0].facts).toEqual([
        {id: 'definition', headingContext: prefix, bodyText: definition},
        {id: 'procedure', headingContext: '', bodyText: procedure},
      ]);
      response.selections[0].anchors[0].excerpt = input.sourceFacts[0].facts[0].bodyText;
      return response;
    });
    const prepared = await prepareFaqEvidence(context, fixture.client, questions);
    expect(validateFaqEvidencePlan(prepared, prepared.faqEvidencePlan)[0]).toEqual({
      question: questions[0], sourceFactIds: ['definition'],
    });
    expect(context).toEqual(before);
    expect(prepared.sourceFacts).toEqual(before.sourceFacts);
  });

  it('preserves quoted observed questions without embedding them in provider schema literals', async () => {
    const context = contextFixture();
    const pool = [...questions];
    pool[0] = 'What does "explainer video" mean?';
    context.evidence.signals.peopleAlsoAsk = pool;
    const provider = fixtureClient((response, request) => {
      // Reproduce the live Responses API rejection at the external boundary;
      // all real preparation and exact-membership checks run unchanged.
      function rejectQuotedEnum(value: unknown): void {
        if (!value || typeof value !== 'object') return;
        if ('enum' in value && Array.isArray(value.enum)
          && value.enum.some(item => typeof item === 'string' && item.includes('"'))) {
          throw new Error('Invalid schema: quotation marks are not allowed in enum literals.');
        }
        for (const child of Object.values(value)) rejectQuotedEnum(child);
      }
      rejectQuotedEnum(request.schema);
      response.selections[0].question = pool[0];
      return response;
    });
    const result = await prepareFaqEvidence(context, provider.client, pool);
    expect(result.evidence.faqQuestions[0]).toBe('What does "explainer video" mean?');
    expect(validateFaqEvidencePlan(result, result.faqEvidencePlan)[0]).toEqual({
      question:'What does "explainer video" mean?', sourceFactIds:['definition'],
    });
  });

  it('rejects removing quotation marks from an observed question even if the model gives valid anchors', async () => {
    const context = contextFixture();
    const pool = [...questions];
    pool[0] = 'What does "explainer video" mean?';
    context.evidence.signals.peopleAlsoAsk = pool;
    const provider = fixtureClient(response => {
      response.selections[0].question = 'What does explainer video mean?';
      return response;
    });
    await expect(prepareFaqEvidence(context, provider.client, pool)).rejects.toThrow(/outside.*observed.*pool/);
  });

  it('accepts alternate definition wording with an exact body anchor and returns the legacy plan shape', async () => {
    expect(faqBodyMatches(questions[0], heading + definition, heading.length)).toBe(false);
    const prepared = await preparedFixture();
    expect(validateFaqEvidencePlan(prepared, prepared.faqEvidencePlan)).toEqual([
      { question: questions[0], sourceFactIds: ['definition'] },
      { question: questions[1], sourceFactIds: ['procedure'] },
      { question: questions[2], sourceFactIds: ['examples'] },
    ]);
    expect(prepared.faqEvidencePlan).toEqual({ schemaVersion: 1, contextHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      candidateQuestions: questions, selections: selections() });
  });

  it('clones research and selections without mutating the input or retaining mutable aliases', async () => {
    const context = contextFixture();
    const before = structuredClone(context);
    const pool = [...questions];
    const fixture = fixtureClient();
    const prepared = await prepareFaqEvidence(context, fixture.client, pool);
    expect(context).toEqual(before);
    expect(prepared.evidence.faqQuestions).toEqual(questions.slice(0, 3));
    expect(prepared.evidence.serp.peopleAlsoAsk).toEqual(questions.slice(0, 3));
    expect(prepared.evidence.signals.peopleAlsoAsk).toEqual(questions);
    prepared.sourceFacts[0].facts[0].text = 'changed';
    prepared.evidence.faqQuestions[0] = 'changed';
    expect(context).toEqual(before);
    expect(prepared.evidence.serp.peopleAlsoAsk[0]).toBe(questions[0]);
    pool[0] = 'changed';
    expect(prepared.faqEvidencePlan.candidateQuestions[0]).toBe(questions[0]);
  });

  it('makes one bounded structured request with exact question and usable body-fact inventories', async () => {
    const fixture = fixtureClient();
    await prepareFaqEvidence(contextFixture(), fixture.client, questions);
    expect(fixture.requests).toHaveLength(1);
    const request = fixture.requests[0];
    expect(request.name).toBe('videoclaw_faq_evidence_v1');
    const schemaText = JSON.stringify(request.schema);
    expect(request.schema).toMatchObject({properties:{selections:{anyOf:[{
      items:{properties:{question:{type:'string', minLength:1, maxLength:43}}},
    }, expect.anything()]}}});
    expect(request.input).toMatchObject({candidateQuestions:questions});
    expect(schemaText).toContain(JSON.stringify({ type: 'string', enum: ['definition', 'procedure', 'examples'] }));
    expect(request.schema).toMatchObject({ type: 'object', additionalProperties: false,
      required: ['status', 'contextHash', 'reason', 'selections'] });
    const inputText = JSON.stringify(request.input);
    expect(inputText).not.toContain('PRIVATE raw comparison material');
    expect(inputText).not.toContain('faqEvidencePlan');
    expect(inputText).not.toContain('faqQuestions');
    expect(request.system).toMatch(/independent critic/i);
    expect(request.system).toMatch(/not.*(?:approval|permission)/i);
  });

  it.each([
    ['too few', questions.slice(0, 2)],
    ['too many', [...questions, 'a', 'b', 'c', 'd']],
    ['duplicate', [questions[0], questions[0], questions[1]]],
    ['unobserved', [questions[0], questions[1], 'What is fabricated?']],
    ['rewritten', [questions[0].toUpperCase(), questions[1], questions[2]]],
    ['blank', [questions[0], questions[1], ' ']],
  ])('rejects a %s pool before dispatch', async (_label, pool) => {
    const fixture = fixtureClient();
    await expect(prepareFaqEvidence(contextFixture(), fixture.client, pool)).rejects.toThrow();
    expect(fixture.requests).toHaveLength(0);
  });

  it('requires observations even if the preliminary selected lists contain the questions', async () => {
    const context = contextFixture();
    context.evidence.signals.peopleAlsoAsk = [];
    const fixture = fixtureClient();
    await expect(prepareFaqEvidence(context, fixture.client, questions.slice(3))).rejects.toThrow();
    expect(fixture.requests).toHaveLength(0);
  });

  it.each([3, 9])('accepts the %i-question boundary while retaining exact observed strings', async count => {
    const context = contextFixture();
    const pool = [...questions, 'Which scenes are useful?', 'How do you plan the audio?', 'How do you review the edit?'].slice(0, count);
    pool[0] = ` ${pool[0]} `;
    context.evidence.signals.peopleAlsoAsk = [...pool];
    const fixture = fixtureClient(response => { response.selections[0].question = pool[0]; return response; });
    const prepared = await prepareFaqEvidence(context, fixture.client, pool);
    expect(prepared.faqEvidencePlan.candidateQuestions).toEqual(pool);
    expect(prepared.evidence.faqQuestions[0]).toBe(pool[0]);
  });

  it.each([
    ['unreachable source', (c: DraftingContext) => { c.checkedSources[0].reachable = false; }],
    ['unchecked URL', (c: DraftingContext) => { c.sourceFacts[0].url = 'https://unchecked.example/'; }],
    ['duplicate fact IDs', (c: DraftingContext) => { c.sourceFacts[1].facts[0].id = 'definition'; }],
    ['duplicate source IDs', (c: DraftingContext) => { c.sourceFacts[1].id = 'guide'; }],
    ['invalid body offset', (c: DraftingContext) => { c.sourceFacts[0].facts[0].bodyStart = -1; }],
    ['mismatched candidate', (c: DraftingContext) => { c.evidence.candidateFingerprint = 'wrong'; }],
    ['mismatched provenance', (c: DraftingContext) => { c.provenance.query = 'unrelated'; }],
    ['invalid timestamp', (c: DraftingContext) => { c.generatedAt = 'yesterday'; }],
    ['no body evidence', (c: DraftingContext) => { c.sourceFacts.forEach(s => s.facts.forEach(f => { f.evidenceKind = 'serp_snippet'; })); }],
  ])('rejects %s before dispatch', async (_label, change) => {
    const context = contextFixture();
    change(context);
    const fixture = fixtureClient();
    await expect(prepareFaqEvidence(context, fixture.client, questions)).rejects.toThrow();
    expect(fixture.requests).toHaveLength(0);
  });

  it('fails on insufficient evidence without retrying or returning unprepared research', async () => {
    const fixture = fixtureClient(response => ({ ...response, status: 'insufficient_evidence', selections: [], reason: 'No third supported question.' }));
    await expect(prepareFaqEvidence(contextFixture(), fixture.client, questions)).rejects.toThrow(/insufficient/i);
    expect(fixture.requests).toHaveLength(1);
  });

  it.each([
    ['unknown status', (r: Response) => ({ ...r, status: 'maybe' })],
    ['wrong hash', (r: Response) => ({ ...r, contextHash: '0'.repeat(64) })],
    ['ready without selections', (r: Response) => ({ ...r, selections: [] })],
    ['only two selections', (r: Response) => ({ ...r, selections: r.selections.slice(0, 2) })],
    ['insufficient with selections', (r: Response) => ({ ...r, status: 'insufficient_evidence' })],
    ['missing reason', (r: Response) => ({ status: r.status, contextHash: r.contextHash, selections: r.selections })],
    ['extra field', (r: Response) => ({ ...r, approved: true })],
    ['non-object', () => 'ready'],
    ['unknown question', (r: Response) => { r.selections[0].question = 'An invented question?'; return r; }],
    ['unknown fact', (r: Response) => { r.selections[0].anchors[0].sourceFactId = 'missing'; return r; }],
    ['fabricated excerpt', (r: Response) => { r.selections[0].anchors[0].excerpt = 'This fabricated passage is definitely not in the source body.'; return r; }],
    ['heading excerpt', (r: Response) => { r.selections[0].anchors[0].excerpt = heading; return r; }],
    ['heading plus body excerpt', (r: Response) => { r.selections[0].anchors[0].excerpt = heading + definition; return r; }],
    ['short excerpt', (r: Response) => { r.selections[0].anchors[0].excerpt = definition.slice(0, 29); return r; }],
    ['duplicate intent', (r: Response) => { r.selections[1].intent = '  DEFINITION  '; return r; }],
    ['blank intent', (r: Response) => { r.selections[1].intent = ' '; return r; }],
    ['overlong intent', (r: Response) => { r.selections[1].intent = 'x'.repeat(81); return r; }],
    ['no anchors', (r: Response) => { r.selections[0].anchors = []; return r; }],
    ['four anchors', (r: Response) => { r.selections[0].anchors = Array(4).fill(r.selections[0].anchors[0]); return r; }],
    ['nested extra field', (r: Response) => ({ ...r, selections: [{ ...r.selections[0], approved: true }, ...r.selections.slice(1)] })],
  ])('rejects model output with %s', async (_label, change) => {
    const fixture = fixtureClient(change);
    await expect(prepareFaqEvidence(contextFixture(), fixture.client, questions)).rejects.toThrow();
    expect(fixture.requests).toHaveLength(1);
  });

  it('rejects equivalent make/create questions even with different supplied intent labels', async () => {
    const fixture = fixtureClient(response => { response.selections[2].question = questions[3]; return response; });
    await expect(prepareFaqEvidence(contextFixture(), fixture.client, questions)).rejects.toThrow(/distinct|duplicate/i);
  });

  it('rejects creation aliases with reversed testimonial-video noun order', async () => {
    // Exercise receipt identity independently of the critic's source semantics.
    const context = contextFixture();
    const aliases = ['How to make a testimonial video?', 'How to create a video testimonial?'];
    const pool = [...questions, ...aliases];
    context.evidence.signals.peopleAlsoAsk = pool;
    const fixture = fixtureClient(response => {
      response.selections[1].question = aliases[0];
      response.selections[2].question = aliases[1];
      return response;
    });
    await expect(prepareFaqEvidence(context, fixture.client, pool)).rejects.toThrow(/distinct|duplicate/i);
  });

  it('preserves different tool qualifiers when checking question keys', async () => {
    const fixture = fixtureClient(response => {
      response.selections[1].question = questions[4];
      response.selections[2].question = questions[5];
      return response;
    });
    const prepared = await prepareFaqEvidence(contextFixture(), fixture.client, questions);
    expect(prepared.evidence.faqQuestions).toEqual([questions[0], questions[4], questions[5]]);
  });

  it('rejects research changed while awaiting the model response', async () => {
    const context = contextFixture();
    const fixture = fixtureClient(response => { context.sourceFacts[0].facts[0].text += ' Changed.'; return response; });
    await expect(prepareFaqEvidence(context, fixture.client, questions)).rejects.toThrow(/context|hash|changed/i);
  });

  it('isolates the request payload from the research used for receipt validation', async () => {
    const context = contextFixture();
    const before = structuredClone(context);
    const fixture = fixtureClient((response, request) => {
      const input = request.input as { sourceFacts: Array<{facts: Array<{bodyText: string}>}>; candidateQuestions: string[] };
      input.sourceFacts[0].facts[0].bodyText = 'Mutated client input';
      input.candidateQuestions[0] = 'Mutated pool';
      return response;
    });
    const prepared = await prepareFaqEvidence(context, fixture.client, questions);
    expect(context).toEqual(before);
    expect(validateFaqEvidencePlan(prepared, prepared.faqEvidencePlan)[0].sourceFactIds).toEqual(['definition']);
  });

  it.each(['input', 'output', 'error'] as const)('rejects secret-like %s without echoing the value', async location => {
    const secret = `sk-proj-${'synthetic'.repeat(4)}`;
    const context = contextFixture();
    if (location === 'input') context.sourceFacts[0].excerpt = secret;
    const fixture = fixtureClient(response => {
      if (location === 'error') throw new Error(secret);
      return { ...response, reason: secret };
    });
    const result = prepareFaqEvidence(context, fixture.client, questions);
    await expect(result).rejects.toThrow(/secret/i);
    await expect(result).rejects.not.toThrow(secret);
    expect(fixture.requests).toHaveLength(location === 'input' ? 0 : 1);
  });
});

describe('validateFaqEvidencePlan', () => {
  it.each([
    ['candidate', (c: DraftingContext) => { c.candidate.title += ' changed'; }],
    ['signals', (c: DraftingContext) => { c.evidence.signals.relatedSearches.push('new observation'); }],
    ['provenance', (c: DraftingContext) => { c.provenance.apifyRunId += '-changed'; }],
    ['source body', (c: DraftingContext) => { c.sourceFacts[0].facts[0].text += ' changed'; }],
    ['source raw excerpt', (c: DraftingContext) => { c.sourceFacts[0].excerpt += ' changed'; }],
    ['checked sources', (c: DraftingContext) => { c.checkedSources[0].status = 201; }],
    ['keyword metrics', (c: DraftingContext) => { c.keywordMetrics.volume = 1; }],
    ['generatedAt', (c: DraftingContext) => { c.generatedAt = '2026-09-09T03:00:00.000Z'; }],
  ])('invalidates a receipt when %s changes', async (_label, change) => {
    const prepared = await preparedFixture();
    change(prepared);
    expect(() => validateFaqEvidencePlan(prepared, prepared.faqEvidencePlan)).toThrow(/hash|context/i);
  });

  it('excludes preliminary FAQ lists from the immutable research hash', async () => {
    const first = await preparedFixture();
    const context = contextFixture();
    context.evidence.faqQuestions = [];
    context.evidence.serp.peopleAlsoAsk = [];
    const second = await prepareFaqEvidence(context, fixtureClient().client, questions);
    expect(second.faqEvidencePlan.contextHash).toBe(first.faqEvidencePlan.contextHash);
    expect(() => validateFaqEvidencePlan(second, second.faqEvidencePlan)).not.toThrow();
  });

  it.each(['faqQuestions', 'serpQuestions'] as const)('requires exact selected order and length in %s', async list => {
    const prepared = await preparedFixture();
    const target = list === 'faqQuestions' ? prepared.evidence.faqQuestions : prepared.evidence.serp.peopleAlsoAsk;
    target.reverse();
    expect(() => validateFaqEvidencePlan(prepared, prepared.faqEvidencePlan)).toThrow(/question|selection/i);
    target.reverse();
    target.push(questions[3]);
    expect(() => validateFaqEvidencePlan(prepared, prepared.faqEvidencePlan)).toThrow(/question|selection/i);
  });

  it.each([
    ['version', (p: FaqEvidencePlan) => ({ ...p, schemaVersion: 2 })],
    ['hash', (p: FaqEvidencePlan) => ({ ...p, contextHash: '0'.repeat(64) })],
    ['extra field', (p: FaqEvidencePlan) => ({ ...p, approved: true })],
    ['question outside pool', (p: FaqEvidencePlan) => ({ ...p, candidateQuestions: questions.slice(3) })],
    ['unobserved pool question', (p: FaqEvidencePlan) => ({ ...p, candidateQuestions: [...questions, 'Invented?'] })],
    ['duplicate question', (p: FaqEvidencePlan) => { p.selections[1].question = p.selections[0].question; return p; }],
    ['duplicate intent', (p: FaqEvidencePlan) => { p.selections[1].intent = p.selections[0].intent; return p; }],
    ['unknown fact', (p: FaqEvidencePlan) => { p.selections[0].anchors[0].sourceFactId = 'missing'; return p; }],
    ['fabricated anchor', (p: FaqEvidencePlan) => { p.selections[0].anchors[0].excerpt += ' Fabricated.'; return p; }],
    ['short anchor', (p: FaqEvidencePlan) => { p.selections[0].anchors[0].excerpt = definition.slice(0, 29); return p; }],
    ['long anchor', (p: FaqEvidencePlan) => { p.selections[0].anchors[0].excerpt = 'x'.repeat(601); return p; }],
    ['heading anchor', (p: FaqEvidencePlan) => { p.selections[0].anchors[0].excerpt = heading; return p; }],
    ['snippet anchor', (p: FaqEvidencePlan) => { p.selections[0].anchors[0].sourceFactId = 'snippet'; return p; }],
    ['title anchor', (p: FaqEvidencePlan) => { p.selections[0].anchors[0].sourceFactId = 'title'; return p; }],
    ['legacy anchor', (p: FaqEvidencePlan) => { p.selections[0].anchors[0].sourceFactId = 'legacy'; return p; }],
    ['heading-only fact', (p: FaqEvidencePlan) => { p.selections[0].anchors[0] = { sourceFactId: 'heading-only', excerpt: heading }; return p; }],
    ['extra anchor field', (p: FaqEvidencePlan) => ({ ...p, selections: [{ ...p.selections[0], anchors: [{ ...p.selections[0].anchors[0], approved: true }] }, ...p.selections.slice(1)] })],
  ])('rejects a receipt with %s', async (_label, change) => {
    const prepared = await preparedFixture();
    expect(() => validateFaqEvidencePlan(prepared, change(structuredClone(prepared.faqEvidencePlan)))).toThrow();
  });

  it('returns distinct fact IDs for multiple exact anchors without mutating the receipt', async () => {
    const fixture = fixtureClient(response => {
      response.selections[0].anchors.push({ sourceFactId: 'definition', excerpt: definition.slice(0, 30) },
        { sourceFactId: 'procedure', excerpt: procedure });
      return response;
    });
    const prepared = await prepareFaqEvidence(contextFixture(), fixture.client, questions);
    const before = structuredClone(prepared);
    const plan = validateFaqEvidencePlan(prepared, prepared.faqEvidencePlan);
    expect(plan[0].sourceFactIds).toEqual(['definition', 'procedure']);
    plan[0].sourceFactIds.push('injected');
    expect(prepared).toEqual(before);
  });

  it.each([30, 600])('accepts a literal %i-character body excerpt', async length => {
    const context = contextFixture();
    const text = 'A'.repeat(length);
    context.sourceFacts[0].facts[0].text = heading + text;
    const fixture = fixtureClient(response => { response.selections[0].anchors[0].excerpt = text; return response; });
    const prepared = await prepareFaqEvidence(context, fixture.client, questions);
    expect(() => validateFaqEvidencePlan(prepared, prepared.faqEvidencePlan)).not.toThrow();
  });
});
