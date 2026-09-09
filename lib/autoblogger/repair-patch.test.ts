import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GeneratedDraftV2Schema, type DraftingContext, type GeneratedDraftV2 } from './content-bundle';
import { candidateFingerprints } from './domain';
import { buildSourceRepairPlan } from './source-plan';
import { buildRepairPolicy, type RepairPolicy } from './repair-policy';
import { applyRepairPatch, createRepairPatchRequest } from './repair-patch';

type Binding = GeneratedDraftV2['claimBindings'][number];
const body = '/sections/0/markdown';
const faq = '/faqAnswers/0/answer';
const bind = (location: string, span: string, sourceFactIds = ['fact-a'], productClaimId: string | null = null): Binding => (
  { location, span, sourceFactIds, productClaimId }
);

function fixture() {
  const original: GeneratedDraftV2 = {
    schemaVersion: 2, description: 'A practical demo guide.', customerTrigger: 'Prepare for a buyer meeting.',
    competitorGap: 'Choose a specific buyer problem.', directAnswer: 'Plan a demo for one buyer.',
    sections: [
      { heading: 'Plan the demo', markdown: 'Choose one buyer problem before recording the product demo.' },
      { heading: 'Review the recording', markdown: 'Review the recording with a colleague.' },
    ],
    faqAnswers: ['Who is it for?', 'What should I record?', 'When should I review?'].map(question => ({
      question, answer: 'Plan for the buyer.',
    })),
    sourceReferences: [{ sourceId: 'a' }, { sourceId: 'b' }],
    editorialGraphic: { title: 'Demo planning', alt: 'Three demo planning steps.', steps: [
      { label: 'Plan', detail: 'Choose one buyer problem.' },
      { label: 'Record', detail: 'Record the workflow.' },
      { label: 'Review', detail: 'Review the recording.' },
    ] },
    claimBindings: [],
  };
  original.claimBindings = [
    bind(body, original.sections[0].markdown),
    bind('/sections/1/markdown', original.sections[1].markdown, ['fact-b']),
    bind(faq, original.faqAnswers[0].answer, ['fact-c'], 'product-c'),
    bind('/description', original.description, ['fact-b']),
  ];
  return original;
}

function policyFor(original: GeneratedDraftV2, locations = [body, faq]): RepairPolicy {
  return buildRepairPolicy(original, locations.map(location => ({ code: 'critic', message: 'Narrow.', location })), {
    status: 'ready', sources: [], findings: [], unsupportedBindingIndices: [], reuseCandidates: [],
    reviewBindings: original.claimBindings.map((b, bindingIndex) => ({
      bindingIndex,
      bindingHash: createHash('sha256').update(JSON.stringify([b.location, b.span, b.sourceFactIds, b.productClaimId])).digest('hex'),
    })),
  });
}

const patchFor = (policy: RepairPolicy) => ({
  schemaVersion: 1, originalFingerprint: policy.originalFingerprint,
  changes: Object.fromEntries(policy.allowedLocations.map(location => [location, null as unknown])),
});
const replacement = (text = 'Choose one buyer problem.', sourceFactIds = ['fact-a'], productClaimId: string | null = null) => ({
  text, bindings: [{ span: text, sourceFactIds, productClaimId }],
});
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

describe('bounded repair patch request', () => {
  it.each([
    ['Markdown destinations', 'Read [the guide](https://example.com/a/very/long/path).',
      [bind(body, 'Read the guide.')], 3, { 'fact-a': 3 }, ['https://example.com/a/very/long/path']],
    ['repeated occurrences and duplicate fact IDs', 'Choose a buyer. Choose a buyer.',
      [bind(body, 'Choose a buyer.', ['fact-a', 'fact-a'])], 6, { 'fact-a': 6 }, []],
    ['cumulative bindings per fact', 'Choose a buyer. Record the workflow.',
      [bind(body, 'Choose a buyer.'), bind(body, 'Record the workflow.', ['fact-a', 'fact-b'])],
      6, { 'fact-a': 6, 'fact-b': 3 }, []],
    ['Unicode and apostrophes', "Don’t skip café-quality 视频 checks. Don't rush.",
      [bind(body, "Don’t skip café-quality 视频 checks. Don't rush.")], 8, { 'fact-a': 8 }, []],
  ])('supplies exact accounting for %s', (_name, text, bindings, maxRenderedWords, maxBoundWordsByFact, allowedCitationUrls) => {
    const original = fixture();
    original.sections[0].markdown = text;
    original.claimBindings = [...bindings, ...original.claimBindings.filter(binding => binding.location !== body)];
    const request = createRepairPatchRequest(original, policyFor(original, [body]));
    expect(request.input).toHaveProperty('repairLimits', {
      [body]: { maxRenderedWords, maxCharacters: null, maxBoundWordsByFact, allowedCitationUrls },
    });
  });

  it.each([
    ['/directAnswer', 2], ['/sections/0/heading', 2], [faq, 6],
  ])('uses the native rendering rules at %s', (location, maxRenderedWords) => {
    const original = fixture();
    const text = 'Read [guide](https://example.com/a).';
    if (location === '/directAnswer') original.directAnswer = text;
    else if (location === faq) original.faqAnswers[0].answer = text;
    else original.sections[0].heading = text;
    original.claimBindings = original.claimBindings.filter(binding => binding.location !== location);
    original.claimBindings.push(bind(location, location === faq ? text : 'Read guide.'));
    const request = createRepairPatchRequest(original, policyFor(original, [location]));
    expect(request.input).toHaveProperty('repairLimits', {
      [location]: { maxRenderedWords, maxCharacters: null,
        maxBoundWordsByFact: { 'fact-a': maxRenderedWords }, allowedCitationUrls: ['https://example.com/a'] },
    });
  });

  it.each(['content.description_duplicate', 'content.description_length', 'critic'])('exposes the exact description exception for %s', code => {
    const original = fixture();
    const reviewPlan = { status: 'ready' as const, sources: [], findings: [], unsupportedBindingIndices: [], reuseCandidates: [],
      reviewBindings: original.claimBindings.map((b, bindingIndex) => ({ bindingIndex,
        bindingHash: createHash('sha256').update(JSON.stringify([b.location, b.span, b.sourceFactIds, b.productClaimId])).digest('hex'),
      })),
    };
    const policy = buildRepairPolicy(original, [{ code, message: 'Fix description.', location: '/description' }], reviewPlan);
    const request = createRepairPatchRequest(original, policy);
    expect(request.input).toHaveProperty('repairLimits', {
      '/description': { maxRenderedWords: 4, maxCharacters: code === 'critic' ? null : 200,
        maxBoundWordsByFact: { 'fact-b': 4 }, allowedCitationUrls: [] },
    });
    const patch = patchFor(policy);
    // Both word counts may grow under the existing character exception.
    patch.changes['/description'] = replacement('A practical demo guide for the buyer.', ['fact-b']);
    expect(applyRepairPatch(original, policy, patch).status).toBe(code === 'critic' ? 'blocked' : 'ready');
    patch.changes['/description'] = replacement('A ' + 'x '.repeat(99), ['fact-b']);
    expect(applyRepairPatch(original, policy, patch).status).toBe(code === 'critic' ? 'blocked' : 'ready');
    patch.changes['/description'] = replacement('A ' + 'x '.repeat(99) + 'x', ['fact-b']);
    expect(applyRepairPatch(original, policy, patch).status).toBe('blocked');
  });

  it.each([
    ['https://www.example.com', 'example.com', '?tracking=1'],
    ['http://www.example.com:443', 'example.com:443', '?tracking=1'],
    ['https://www.www.example.com', 'www.example.com', ''],
  ])('accepts a real nonempty reviewed source plan with normalized page identities from %s', (origin, pageHost, query) => {
    const original = fixture();
    const candidate: DraftingContext['candidate'] = {
      schemaVersion: 1, articleId: 'vc-c2-011', campaignId: 'accelerator-demo-day-founder',
      icp: 'Founder preparing a demo', primaryKeyword: 'product demo', secondaryKeywords: [],
      title: 'Plan a product demo', slug: 'plan-product-demo', intent: 'informational', funnelStage: 'middle',
    };
    const sourceFacts: DraftingContext['sourceFacts'] = ['a', 'b', 'c'].map(id => ({
      id, label: id, url: `${origin}/${id}/${query}`, checkedAt: '2026-09-10T00:00:00.000Z',
      facts: [{ id: `fact-${id}`, text: 'Plan a product demo for one buyer.', evidenceKind: 'body' }],
    }));
    const context: DraftingContext = {
      candidate, sourceFacts, generatedAt: '2026-09-10T00:00:00.000Z', productClaims: [],
      keywordMetrics: { schemaVersion: 1, provider: 'pending', observedAt: null, volume: null, difficulty: null, cpc: null, intent: 'informational' },
      provenance: { apifyRunId: 'fixture', apifyDatasetId: 'fixture', query: 'product demo', locale: 'en-US', capturedAt: '2026-09-10' },
      checkedSources: sourceFacts.map(source => ({ url: source.url, finalUrl: source.url, status: 200, reachable: true, authoritative: true })),
      evidence: {
        schemaVersion: 2, candidateFingerprint: candidateFingerprints(candidate).candidate,
        signals: { autocomplete: [], peopleAlsoAsk: [], relatedSearches: [] },
        serp: { organicResultCount: 3, peopleAlsoAsk: [] }, faqQuestions: original.faqAnswers.map(faq => faq.question),
        sources: sourceFacts.map(source => ({ originalUrl: source.url, finalUrl: source.url, authoritative: true })),
      },
    };
    const plan = buildSourceRepairPlan(context, original, original.claimBindings.map((b, bindingIndex) => ({
      bindingIndex, bindingHash: createHash('sha256').update(JSON.stringify([b.location, b.span, b.sourceFactIds, b.productClaimId])).digest('hex'),
      supported: true, kind: b.productClaimId === null ? 'source_claim' : 'product_claim',
    })));
    expect(plan.status).toBe('ready');
    const policy = buildRepairPolicy(original, [{ code: 'critic', message: 'Narrow.', location: body }], plan);
    expect(policy.status).toBe('ready');
    expect(policy.sources.map(source => source.page)).toEqual([`${pageHost}/a`, `${pageHost}/b`, `${pageHost}/c`]);
    expect(createRepairPatchRequest(original, policy).input.repairFields).toHaveProperty(body);
    expect(applyRepairPatch(original, policy, patchFor(policy))).toEqual({ status: 'ready', draft: original });
    const patch = patchFor(policy);
    patch.changes[body] = replacement();
    expect(applyRepairPatch(original, policy, patch).status).toBe('ready');
  });

  it.each(['https://example.com/a', 'example.com/a?query=1', 'example.com/a#fragment',
    'user@example.com/a', 'example.com:99999/a', '/example.com/a', 'example.com\\a', 'example.com/a b',
  ])('rejects malformed page identity %s while retaining policy bounds', page => {
    const original = fixture();
    const policy = { ...policyFor(original), sources: [{ page, sourceIds: ['a'], initialDerivedWords: 10, maxDerivedWords: 10 }] };
    expect(() => createRepairPatchRequest(original, policy)).toThrow();
    expect(applyRepairPatch(original, policy, patchFor(policy)).status).toBe('blocked');
  });

  it.each([
    { sourceIds: [], initialDerivedWords: 10, maxDerivedWords: 10 },
    { sourceIds: ['a'], initialDerivedWords: -1, maxDerivedWords: 0 },
    { sourceIds: ['a'], initialDerivedWords: 10, maxDerivedWords: 11 },
    { sourceIds: ['a'], initialDerivedWords: 10, maxDerivedWords: 1.5 },
  ])('retains source inventory and word-bound validation for %j', source => {
    const original = fixture();
    const policy = { ...policyFor(original), sources: [{ page: 'www.example.com/a', ...source }] };
    expect(() => createRepairPatchRequest(original, policy)).toThrow();
    expect(applyRepairPatch(original, policy, patchFor(policy)).status).toBe('blocked');
  });

  it('exposes exact required locations and only their original fact/product inventories', () => {
    const original = fixture();
    const policy = policyFor(original);
    const request = createRepairPatchRequest(original, policy);
    expect(request.input).toEqual({ originalFingerprint: policy.originalFingerprint, repairFields: {
      [body]: { text: original.sections[0].markdown, bindings: [{
        span: original.sections[0].markdown, sourceFactIds: ['fact-a'], productClaimId: null,
      }] },
      [faq]: { text: 'Plan for the buyer.', bindings: [{
        span: 'Plan for the buyer.', sourceFactIds: ['fact-c'], productClaimId: 'product-c',
      }] },
    }, repairLimits: {
      [body]: { maxRenderedWords: 9, maxCharacters: null, maxBoundWordsByFact: { 'fact-a': 9 }, allowedCitationUrls: [] },
      [faq]: { maxRenderedWords: 4, maxCharacters: null, maxBoundWordsByFact: { 'fact-c': 4 }, allowedCitationUrls: [] },
    } });
    expect(request.schema).toMatchObject({ type: 'object', additionalProperties: false,
      required: ['schemaVersion', 'originalFingerprint', 'changes'],
      properties: { schemaVersion: { const: 1 }, originalFingerprint: { const: policy.originalFingerprint },
        changes: { type: 'object', additionalProperties: false, required: [...policy.allowedLocations] } },
    });
    // Provider output must constrain each location independently, never a global inventory.
    const changes = (request.schema.properties as Record<string, { properties: Record<string, unknown> }>).changes.properties;
    expect(Object.keys(changes).sort()).toEqual([faq, body]);
    const serializedBody = JSON.stringify(changes[body]);
    expect(serializedBody).toContain('fact-a');
    expect(serializedBody).not.toMatch(/fact-b|fact-c|product-c|"location"/u);
    expect(JSON.stringify(changes[faq])).toContain('product-c');
    expect(JSON.stringify(changes[faq])).not.toContain('fact-a');
    expect(changes[body]).toMatchObject({ anyOf: expect.arrayContaining([
      { type: 'null' }, expect.objectContaining({ type: 'object', additionalProperties: false,
        required: ['text', 'bindings'], properties: { text: expect.any(Object), bindings: {
          type: 'array', items: { type: 'object', additionalProperties: false,
            required: ['span', 'sourceFactIds', 'productClaimId'], properties: {
              span: expect.any(Object), sourceFactIds: { type: 'array', minItems: 1, items: { type: 'string', enum: ['fact-a'] } },
              productClaimId: { type: 'null' },
            } },
        } },
      }),
    ]) });
    (request.input.repairFields[body] as { bindings: { sourceFactIds: string[] }[] }).bindings[0].sourceFactIds.push('new-fact');
    expect(original.claimBindings[0].sourceFactIds).toEqual(['fact-a']);
  });

  it.each(['/sections', '/sections/99/markdown', '/sections/01/markdown', '/customerTrigger',
    '/faqAnswers/0/question', '/__proto__/polluted', '/constructor/prototype/polluted',
    '/sections/0/__proto__', '/sections/0/markdown/child', '/sections~10~1markdown',
  ])('rejects invalid policy location %s before requesting or assembling', location => {
    const original = fixture();
    const policy = { ...policyFor(original), allowedLocations: [location] };
    expect(() => createRepairPatchRequest(original, policy)).toThrow();
    expect(applyRepairPatch(original, policy, patchFor(policy)).status).toBe('blocked');
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it.each(['stale', 'blocked', 'duplicate', 'malformed', 'invalid-baseline', 'invalid-original', 'secret'])(
    'rejects %s inputs before request creation', kind => {
      const original = fixture();
      let policy = policyFor(original);
      if (kind === 'stale') policy = { ...policy, originalFingerprint: '0'.repeat(64) };
      if (kind === 'blocked') policy = { ...policy, status: 'blocked' };
      if (kind === 'duplicate') policy = { ...policy, allowedLocations: [body, body] };
      if (kind === 'malformed') policy = { ...policy, descriptionMaxChars: -1 };
      if (kind === 'invalid-original') Object.assign(original, { unexpected: true });
      if (kind === 'invalid-baseline') {
        original.claimBindings[0].span = 'Unrelated words.';
        policy = policyFor(original);
      }
      if (kind === 'secret') original.customerTrigger = `sk-proj-${'synthetic'.repeat(4)}`;
      expect(() => createRepairPatchRequest(original, policy)).toThrow();
      expect(applyRepairPatch(original, policy, patchFor(policy)).status).toBe('blocked');
    },
  );
});

describe('bounded repair patch assembly', () => {
  it('preserves exact original text/bindings for null fields in a separate clone', () => {
    const original = fixture();
    original.description = ` ${original.description} `;
    const before = structuredClone(original);
    const policy = freeze(policyFor(original));
    const output = freeze(patchFor(policy));
    const result = applyRepairPatch(freeze(original), policy, output);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.draft).toEqual(before);
    expect(result.draft).not.toBe(original);
    result.draft.claimBindings[0].sourceFactIds.push('new-fact');
    expect(original).toEqual(before);
  });

  it('shrinks one field with complete local bindings, retaining every immutable/null binding', () => {
    const original = freeze(fixture());
    const before = structuredClone(original);
    const policy = policyFor(original);
    const output = patchFor(policy);
    output.changes[body] = replacement();
    const result = applyRepairPatch(original, policy, freeze(output));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.draft.sections[0].markdown).toBe('Choose one buyer problem.');
    expect(result.draft.claimBindings.filter(b => b.location !== body)).toEqual(before.claimBindings.filter(b => b.location !== body));
    expect(result.draft.claimBindings.filter(b => b.location === body)).toEqual([bind(body, 'Choose one buyer problem.')]);
    expect(GeneratedDraftV2Schema.safeParse(result.draft).success).toBe(true);
    expect(original).toEqual(before);
  });

  it('accepts empty scope as an exact no-op', () => {
    const original = fixture();
    const policy = policyFor(original, []);
    expect(createRepairPatchRequest(original, policy).input.repairFields).toEqual({});
    expect(applyRepairPatch(original, policy, patchFor(policy))).toEqual({ status: 'ready', draft: original });
  });

  it.each([
    ['/description', 'Demo guide.'], ['/competitorGap', 'Choose a buyer problem.'],
    ['/directAnswer', 'Plan a demo.'], ['/sections/0/heading', 'Plan demo'],
    [body, 'Choose one buyer problem.'], [faq, 'Plan for buyers.'],
    ['/editorialGraphic/title', 'Demo'], ['/editorialGraphic/alt', 'Demo steps.'],
    ['/editorialGraphic/steps/0/label', 'Plan'], ['/editorialGraphic/steps/0/detail', 'Choose a problem.'],
  ])('writes only the known scalar leaf %s', (location, text) => {
    const original = fixture();
    const policy = policyFor(original, [location]);
    const output = patchFor(policy);
    const local = original.claimBindings.filter(b => b.location === location);
    output.changes[location] = { text, bindings: local.map(b => ({
      span: text, sourceFactIds: b.sourceFactIds, productClaimId: b.productClaimId,
    })) };
    const result = applyRepairPatch(original, policy, output);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    const segments = location.slice(1).split('/');
    const value = segments.reduce<unknown>((v, key) => (v as Record<string, unknown>)[key], result.draft);
    expect(value).toBe(text);
  });

  it.each([
    ['unknown location', (p: ReturnType<typeof patchFor>) => { p.changes['/description'] = null; }],
    ['missing location', (p: ReturnType<typeof patchFor>) => { delete p.changes[faq]; }],
    ['stale fingerprint', (p: ReturnType<typeof patchFor>) => { p.originalFingerprint = '0'.repeat(64); }],
    ['wrong version', (p: ReturnType<typeof patchFor>) => { p.schemaVersion = 2; }],
    ['extra root key', (p: ReturnType<typeof patchFor>) => { Object.assign(p, { draft: {} }); }],
    ['extra field key', (p: ReturnType<typeof patchFor>) => { p.changes[body] = { ...replacement(), extra: true }; }],
    ['binding location', (p: ReturnType<typeof patchFor>) => { const r = replacement(); Object.assign(r.bindings[0], { location: body }); p.changes[body] = r; }],
    ['unknown fact', (p: ReturnType<typeof patchFor>) => { p.changes[body] = replacement(undefined, ['invented']); }],
    ['transferred fact', (p: ReturnType<typeof patchFor>) => { p.changes[body] = replacement(undefined, ['fact-c']); }],
    ['transferred product', (p: ReturnType<typeof patchFor>) => { p.changes[body] = replacement(undefined, ['fact-a'], 'product-c'); }],
    ['empty facts', (p: ReturnType<typeof patchFor>) => { p.changes[body] = replacement(undefined, []); }],
    ['missing product', (p: ReturnType<typeof patchFor>) => { p.changes[body] = { text: 'Choose one buyer problem.', bindings: [{ span: 'Choose one buyer problem.', sourceFactIds: ['fact-a'] }] }; }],
    ['blank text', (p: ReturnType<typeof patchFor>) => { p.changes[body] = replacement(' '); }],
    ['format control', (p: ReturnType<typeof patchFor>) => { p.changes[body] = replacement('Choose\u200B buyers.'); }],
    ['prototype key', (p: ReturnType<typeof patchFor>) => { Object.assign(p.changes, JSON.parse('{"/__proto__/polluted":null}')); }],
    ['raw prototype key', (p: ReturnType<typeof patchFor>) => { Object.defineProperty(p.changes, '__proto__', { value: null, enumerable: true }); }],
  ])('blocks %s', (_name, mutate) => {
    const original = fixture();
    const before = structuredClone(original);
    const policy = policyFor(original);
    const output = patchFor(policy);
    mutate(output);
    expect(applyRepairPatch(original, policy, output).status).toBe('blocked');
    expect(original).toEqual(before);
  });

  it.each([
    ['uncovered text', { text: 'Choose one buyer problem.', bindings: [] }, 'repair.binding_coverage'],
    ['partial coverage', { text: 'Choose one buyer problem.', bindings: [{ span: 'Choose one', sourceFactIds: ['fact-a'], productClaimId: null }] }, 'repair.binding_coverage'],
    ['location growth', replacement('Choose one buyer problem before recording the product demo for all potential buyers.'), 'repair.location_growth'],
    ['citation destination', replacement('[Choose one buyer problem.](https://example.com/new)'), 'repair.citation_changed'],
  ])('retains the existing delta gate for %s', (_name, value, code) => {
    const original = fixture();
    const policy = policyFor(original);
    const output = patchFor(policy);
    output.changes[body] = value;
    const result = applyRepairPatch(original, policy, output);
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') expect(result.findings).toContainEqual(expect.objectContaining({ code }));
  });

  it('rejects dropping retained-word evidence even when IDs remain locally available', () => {
    const original = fixture();
    original.claimBindings[0].sourceFactIds.push('fact-b');
    const policy = policyFor(original);
    const output = patchFor(policy);
    output.changes[body] = replacement(original.sections[0].markdown);
    const result = applyRepairPatch(original, policy, output);
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') expect(result.findings).toContainEqual(expect.objectContaining({ code: 'repair.evidence_changed' }));
  });

  it('gives unbound fields no fact inventory or way to introduce bindings', () => {
    const original = fixture();
    const policy = policyFor(original, ['/directAnswer']);
    const request = createRepairPatchRequest(original, policy);
    expect(JSON.stringify(request.schema)).not.toContain('fact-a');
    const output = patchFor(policy);
    output.changes['/directAnswer'] = replacement('Plan a demo.');
    expect(applyRepairPatch(original, policy, output).status).toBe('blocked');
  });

  it.each([null, 'not an object', [], {}, 1])('fails closed for malformed output %j', output => {
    const original = fixture();
    expect(applyRepairPatch(original, policyFor(original), output).status).toBe('blocked');
  });

  it('returns safe generic findings without echoing secret values or parser errors', () => {
    const original = fixture();
    const policy = policyFor(original);
    const output = patchFor(policy);
    const secret = `sk-proj-${'synthetic'.repeat(4)}`;
    output.changes[body] = replacement(secret);
    const result = applyRepairPatch(original, policy, output);
    expect(result.status).toBe('blocked');
    expect(JSON.stringify(result)).not.toContain(secret);
    const hostile = { get changes() { throw new Error(secret); } };
    expect(applyRepairPatch(original, policy, hostile).status).toBe('blocked');
    expect(JSON.stringify(applyRepairPatch(original, policy, hostile))).not.toContain(secret);
  });

  it.each(['inherited', 'getter', 'symbol', 'non-enumerable', 'array-property'])(
    'rejects non-JSON %s data without silently accepting hidden fields', kind => {
      const original = fixture();
      const policy = policyFor(original);
      const output = patchFor(policy);
      if (kind === 'inherited') {
        output.changes[body] = Object.create(replacement());
      } else if (kind === 'getter') {
        Object.defineProperty(output.changes, body, { get: () => replacement(), enumerable: true });
      } else if (kind === 'symbol') {
        Object.assign(output, { [Symbol('hidden')]: true });
      } else if (kind === 'non-enumerable') {
        Object.defineProperty(output, 'hidden', { value: true });
      } else {
        const value = replacement();
        Object.assign(value.bindings, { extra: true });
        output.changes[body] = value;
      }
      expect(applyRepairPatch(original, policy, output).status).toBe('blocked');
    },
  );

  it('validates final native graphic constraints after applying a replacement', () => {
    const original = fixture();
    const policy = policyFor(original, ['/editorialGraphic/title']);
    const output = patchFor(policy);
    output.changes['/editorialGraphic/title'] = { text: 'Demo\u0001', bindings: [] };
    expect(applyRepairPatch(original, policy, output).status).toBe('blocked');
  });
});
