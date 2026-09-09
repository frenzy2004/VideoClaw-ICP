import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GeneratedDraftV2Schema, type GeneratedDraftV2 } from './content-bundle';
import { buildRepairPolicy, type RepairPolicy } from './repair-policy';
import { applySentenceRepair, createRepairPatchRequest, createSentenceRepairRequest } from './repair-patch';

type Binding = GeneratedDraftV2['claimBindings'][number];
const body = '/sections/0/markdown';
const faq = '/faqAnswers/0/answer';
const bind = (location: string, span: string, sourceFactIds = ['fact-a'], productClaimId: string | null = null): Binding => (
  { location, span, sourceFactIds, productClaimId }
);

function fixture(): GeneratedDraftV2 {
  return {
    schemaVersion: 2, description: 'A practical demo guide.', customerTrigger: 'Prepare for a buyer meeting.',
    competitorGap: 'Choose a specific buyer problem.', directAnswer: 'Plan a demo for one buyer.',
    sections: [
      { heading: 'Plan the demo', markdown: 'Choose one buyer problem. Record the workflow.' },
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
    claimBindings: [
      bind(body, 'Choose one buyer problem.'),
      bind(body, 'Record the workflow.', ['fact-b'], 'product-b'),
      bind('/sections/1/markdown', 'Review the recording with a colleague.', ['fact-b']),
      bind(faq, 'Plan for the buyer.', ['fact-c'], 'product-c'),
      bind('/description', 'A practical demo guide.', ['fact-b']),
    ],
  };
}

function policyFor(original: GeneratedDraftV2, locations = [body, faq], code = 'critic'): RepairPolicy {
  return buildRepairPolicy(original, locations.map(location => ({ code, message: 'Narrow.', location })), {
    status: 'ready', sources: [], findings: [], unsupportedBindingIndices: [], reuseCandidates: [],
    reviewBindings: original.claimBindings.map((b, bindingIndex) => ({
      bindingIndex,
      bindingHash: createHash('sha256').update(JSON.stringify([b.location, b.span, b.sourceFactIds, b.productClaimId])).digest('hex'),
    })),
  });
}

const patchFor = (policy: RepairPolicy) => ({
  schemaVersion: 2, originalFingerprint: policy.originalFingerprint,
  changes: Object.fromEntries(policy.allowedLocations.map(location => [location, null as unknown])),
});

const replacement = (text: string, sourceFactIds = ['fact-a'], productClaimId: string | null = null) => ({
  text, bindings: [{ span: text, sourceFactIds, productClaimId }],
});
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function expectInvalid(result: ReturnType<typeof applySentenceRepair>) {
  expect(result).toEqual({ status: 'blocked', findings: [{
    code: 'repair.patch_invalid',
    message: 'Repair patch requires a valid original, policy and bounded field replacements.',
  }] });
}

describe('sentence-owned repair', () => {
  it('joins bounded words and preserves sentence-owned citations and the original', () => {
    const original = fixture();
    expect(GeneratedDraftV2Schema.safeParse(original).success).toBe(true);
    const before = structuredClone(original);
    const policy = policyFor(original);
    const output = patchFor(policy);
    output.changes[body] = { b0: ['Choose', 'one', 'buyer.'], b1: null };
    const result = applySentenceRepair(original, policy, output);
    expect(result).toMatchObject({ status: 'ready', draft: { sections: [
      { heading: 'Plan the demo', markdown: 'Choose one buyer. Record the workflow.' },
      original.sections[1],
    ] } });
    expect(result.status === 'ready' && result.draft.claimBindings.find(b => b.location === body)).toMatchObject({
      span: 'Choose one buyer.', sourceFactIds: ['fact-a'], productClaimId: null,
    });
    if (result.status === 'ready') {
      expect(result.draft.claimBindings.filter(b => b.span !== 'Choose one buyer.')).toEqual(expect.arrayContaining(before.claimBindings.slice(1)));
      expect(result.draft.claimBindings).toHaveLength(before.claimBindings.length);
      expect(result.draft).not.toBe(original);
    }
    expect(original).toEqual(before);
  });

  it('exposes stable original indices, bounded provider arrays and unchanged v1 guidance', () => {
    const original = fixture();
    const policy = policyFor(original);
    const request = createSentenceRepairRequest(original, policy);
    const v1 = createRepairPatchRequest(original, policy);
    expect(request.input).toEqual({ ...v1.input, sentenceFields: {
      [body]: { mode: 'sentences', sentences: {
        b0: { span: 'Choose one buyer problem.', maxWords: 4, sourceFactIds: ['fact-a'], productClaimId: null },
        b1: { span: 'Record the workflow.', maxWords: 3, sourceFactIds: ['fact-b'], productClaimId: 'product-b' },
      } },
      [faq]: { mode: 'sentences', sentences: {
        b3: { span: 'Plan for the buyer.', maxWords: 4, sourceFactIds: ['fact-c'], productClaimId: 'product-c' },
      } },
    } });
    expect(request.schema).toMatchObject({ type: 'object', additionalProperties: false,
      required: ['schemaVersion', 'originalFingerprint', 'changes'], properties: {
        schemaVersion: { type: 'integer', const: 2 }, originalFingerprint: { const: policy.originalFingerprint },
        changes: { additionalProperties: false, required: [faq, body], properties: {
          [body]: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false,
            required: ['b0', 'b1'], properties: {
              b0: { anyOf: [{ type: 'null' }, { type: 'array', maxItems: 4, items: { type: 'string', pattern: '^\\S+$' } }] },
              b1: { anyOf: [{ type: 'null' }, { type: 'array', maxItems: 3, items: { type: 'string', pattern: '^\\S+$' } }] },
            },
          }] },
        } },
      },
    });
    const field = request.input.sentenceFields[body];
    if (field.mode === 'sentences') field.sentences.b0.sourceFactIds.push('invented');
    expect(original.claimBindings[0].sourceFactIds).toEqual(['fact-a']);
    const patch = patchFor(policy);
    patch.changes[faq] = { b3: ['Plan', 'for', 'buyers.'] };
    const result = applySentenceRepair(original, policy, patch);
    expect(result.status === 'ready' && result.draft.claimBindings.find(b => b.location === faq)).toEqual(bind(faq, 'Plan for buyers.', ['fact-c'], 'product-c'));
  });

  it.each(['field', 'sentences'] as const)('preserves null %s bytes, binding order and caller ownership', mode => {
    const original = fixture();
    original.sections[0].markdown = ' \nChoose one buyer problem.  \nRecord the workflow. \t';
    original.claimBindings[0].sourceFactIds = ['fact-a', 'fact-a'];
    const before = structuredClone(original);
    const policy = freeze(policyFor(original));
    const output = patchFor(policy);
    if (mode === 'sentences') output.changes[body] = { b0: null, b1: null };
    const result = applySentenceRepair(freeze(original), policy, freeze(output));
    expect(result).toEqual({ status: 'ready', draft: before });
    if (result.status === 'ready') {
      result.draft.claimBindings[0].sourceFactIds.push('changed');
      expect(original).toEqual(before);
    }
  });

  it('splices by position while retaining local binding order, untouched bindings and unchanged whitespace', () => {
    const original = fixture();
    original.sections[0].markdown = ' \nChoose one buyer problem.  \nRecord the workflow. \t';
    original.claimBindings = [original.claimBindings[1], original.claimBindings[2], original.claimBindings[0], ...original.claimBindings.slice(3)];
    const before = structuredClone(original);
    const policy = policyFor(original);
    const output = patchFor(policy);
    output.changes[body] = { b0: ['Record', 'it.'], b2: ['Choose', 'buyers.'] };
    const result = applySentenceRepair(freeze(original), policy, output);
    expect(result.status === 'ready' && result.draft.sections[0].markdown).toBe(' \nChoose buyers.  \nRecord it. \t');
    expect(result.status === 'ready' && result.draft.claimBindings.filter(b => b.location === body)).toEqual([
      bind(body, 'Record it.', ['fact-b'], 'product-b'), bind(body, 'Choose buyers.'),
    ]);
    expect(result.status === 'ready' && result.draft.claimBindings.filter(b => b.location !== body)).toEqual(before.claimBindings.filter(b => b.location !== body));
    expect(original).toEqual(before);
  });

  it('accepts Unicode letters, numbers, apostrophes and trailing punctuation with matching word bounds', () => {
    const original = fixture();
    original.sections[0].markdown = "Don’t skip café 视频 2026. Don't rush.";
    original.claimBindings.splice(0, 2, bind(body, "Don’t skip café 视频 2026."), bind(body, "Don't rush.", ['fact-b'], 'product-b'));
    const policy = policyFor(original);
    expect(createSentenceRepairRequest(original, policy).input.sentenceFields[body]).toMatchObject({
      mode: 'sentences', sentences: { b0: { maxWords: 5 }, b1: { maxWords: 2 } },
    });
    const output = patchFor(policy);
    output.changes[body] = { b0: ['Don’t', 'skip', 'café', '视频', '2026.'], b1: ["Don't", 'hurry!'] };
    const result = applySentenceRepair(original, policy, output);
    expect(result.status === 'ready' && result.draft.sections[0].markdown).toBe("Don’t skip café 视频 2026. Don't hurry!");
    expect(result.status === 'ready' && result.draft.claimBindings.find(b => b.span === "Don't hurry!")).toEqual(bind(body, "Don't hurry!", ['fact-b'], 'product-b'));
  });

  it.each(['Choose buyers', 'buyer-problem', '<b>buyer</b>', '**buyer**', 'buyer&nbsp;problem',
    'one/two', 'one.two', 'one_two', 'buyer\n', '\tbuyer', 'buyer\u200b', 'buyer\u0000', '', '.', '💡',
  ])('rejects disguised or nonword token %j without modifying the draft', token => {
    const original = fixture();
    const before = structuredClone(original);
    const policy = policyFor(original);
    const output = patchFor(policy);
    output.changes[body] = { b0: [token], b1: null };
    expectInvalid(applySentenceRepair(original, policy, output));
    expect(original).toEqual(before);
  });

  it.each([
    ['oversized array', { b0: ['Choose', 'one', 'buyer', 'problem', 'now.'], b1: null }],
    ['citation key', { b0: ['Choose', 'buyers.'], b1: null, sourceFactIds: ['fact-c'] }],
    ['product key', { b0: ['Choose', 'buyers.'], b1: null, productClaimId: 'product-c' }],
    ['nested citation object', { b0: { words: ['Choose'], sourceFactIds: ['fact-c'] }, b1: null }],
    ['missing sentence', { b0: null }], ['unknown sentence', { b0: null, b1: null, b2: null }],
    ['string', { b0: 'Choose buyers.', b1: null }], ['nonstring item', { b0: [1], b1: null }],
    ['empty object', {}], ['mode override', { mode: 'field', ...replacement('Choose buyers.') }],
  ])('fails closed for %s', (_name, edit) => {
    const original = fixture();
    const policy = policyFor(original);
    const output = patchFor(policy);
    output.changes[body] = edit;
    expectInvalid(applySentenceRepair(original, policy, output));
  });

  it('deletes only the selected sentence and its binding without trimming surviving bytes', () => {
    const original = fixture();
    const policy = policyFor(original);
    const output = patchFor(policy);
    output.changes[body] = { b0: [], b1: null };
    const result = applySentenceRepair(original, policy, output);
    expect(result.status === 'ready' && result.draft.sections[0].markdown).toBe(' Record the workflow.');
    expect(result.status === 'ready' && result.draft.claimBindings).toEqual(expect.arrayContaining(original.claimBindings.slice(1)));
    expect(result.status === 'ready' && result.draft.claimBindings).toHaveLength(original.claimBindings.length - 1);
    output.changes[body] = { b0: [], b1: [] };
    expectInvalid(applySentenceRepair(original, policy, output));
  });

  it.each([
    ['repeated span', 'Choose buyers. Choose buyers.', ['Choose buyers.']],
    ['overlapping spans', 'Choose one buyer.', ['Choose one', 'one buyer.']],
    ['nonliteral span', 'Choose  buyers.', ['Choose buyers.']],
    ['link', 'Choose [buyers](https://example.com/a).', ['Choose buyers.']],
    ['emphasis', 'Choose **buyers**.', ['Choose buyers.']],
    ['entity', 'Choose&nbsp;buyers.', ['Choose buyers.']],
    ['HTML', 'Choose <b>buyers</b>.', ['Choose buyers.']],
    ['code', '`Choose buyers.`', ['Choose buyers.']],
    ['autolink', 'Visit www.example.com.', ['Visit www.example.com.']],
    ['ordered list', '1. Choose buyers.', ['Choose buyers.']],
    ['uncovered punctuation', 'Choose buyers. ;', ['Choose buyers.']],
  ])('uses compatible full-field repair for %s', (_name, text, spans) => {
    const original = fixture();
    original.sections[0].markdown = text;
    original.claimBindings = [...spans.map(span => bind(body, span)), ...original.claimBindings.slice(2)];
    const policy = policyFor(original, [body]);
    const request = createSentenceRepairRequest(original, policy);
    expect(request.input.sentenceFields[body]).toEqual({ mode: 'field' });
    const fields = (schema: ReturnType<typeof createRepairPatchRequest>['schema']) => (
      schema.properties as Record<string, { properties: Record<string, unknown> }>
    ).changes.properties;
    expect(fields(request.schema)[body]).toEqual(fields(createRepairPatchRequest(original, policy).schema)[body]);
    const output = patchFor(policy);
    output.changes[body] = replacement('Pick buyers.');
    const result = applySentenceRepair(original, policy, output);
    expect(result.status === 'ready' && result.draft.sections[0].markdown).toBe('Pick buyers.');
    expect(result.status === 'ready' && result.draft.claimBindings.filter(b => b.location === body)).toEqual([bind(body, 'Pick buyers.')]);
    output.changes[body] = { b0: ['Pick', 'buyers.'] };
    expectInvalid(applySentenceRepair(original, policy, output));
  });

  it('supports hybrid edits while enforcing the original field citation inventory and growth gate', () => {
    const original = fixture();
    original.faqAnswers[0].answer = 'Plan for the buyer!';
    original.claimBindings[3].span = 'Plan for the buyer'; // Uncovered punctuation selects field mode.
    const policy = policyFor(original);
    const output = patchFor(policy);
    output.changes[body] = { b0: ['Choose', 'buyers.'], b1: null };
    output.changes[faq] = replacement('Plan for buyers.', ['fact-c'], 'product-c');
    const result = applySentenceRepair(original, policy, output);
    expect(result.status === 'ready' && result.draft.faqAnswers[0].answer).toBe('Plan for buyers.');
    expect(result.status === 'ready' && result.draft.claimBindings.find(b => b.location === body)).toEqual(bind(body, 'Choose buyers.'));
    output.changes[faq] = replacement('Plan for buyers.', ['fact-a']);
    expectInvalid(applySentenceRepair(original, policy, output));
    output.changes[faq] = replacement('Plan for all buyers in every meeting.', ['fact-c'], 'product-c');
    const growth = applySentenceRepair(original, policy, output);
    expect(growth.status === 'blocked' && growth.findings).toContainEqual(expect.objectContaining({ code: 'repair.location_growth' }));
  });

  it.each(['content.description_duplicate', 'content.description_length'])('keeps %s expansion in field mode with the 200 character ceiling', code => {
    const original = fixture();
    const policy = policyFor(original, ['/description'], code);
    const request = createSentenceRepairRequest(original, policy);
    expect(request.input.sentenceFields['/description']).toEqual({ mode: 'field' });
    expect(request.input.repairLimits['/description']).toMatchObject({ maxCharacters: 200, maxRenderedWords: 4 });
    const output = patchFor(policy);
    output.changes['/description'] = replacement('A practical demo guide for the buyer.', ['fact-b']);
    const result = applySentenceRepair(original, policy, output);
    expect(result.status === 'ready' && result.draft.description).toBe('A practical demo guide for the buyer.');
    output.changes['/description'] = replacement('A ' + 'x '.repeat(99), ['fact-b']);
    expect(applySentenceRepair(original, policy, output).status).toBe('ready');
    output.changes['/description'] = replacement('A ' + 'x '.repeat(99) + 'x', ['fact-b']);
    expect(applySentenceRepair(original, policy, output).status).toBe('blocked');
  });

  it('keeps unbound fields in field mode and an empty policy scope as an exact no-op', () => {
    const original = fixture();
    const policy = policyFor(original, ['/directAnswer']);
    expect(createSentenceRepairRequest(original, policy).input.sentenceFields['/directAnswer']).toEqual({ mode: 'field' });
    const output = patchFor(policy);
    output.changes['/directAnswer'] = { text: 'Plan a demo.', bindings: [] };
    const result = applySentenceRepair(original, policy, output);
    expect(result.status === 'ready' && result.draft.directAnswer).toBe('Plan a demo.');
    output.changes['/directAnswer'] = replacement('Plan a demo.');
    expectInvalid(applySentenceRepair(original, policy, output));
    const empty = policyFor(original, []);
    expect(createSentenceRepairRequest(original, empty).input.sentenceFields).toEqual({});
    expect(applySentenceRepair(original, empty, patchFor(empty))).toEqual({ status: 'ready', draft: original });
  });

  it.each(['version', 'fingerprint', 'location', 'extra-location', 'root-key'])(
    'rejects invalid root %s', kind => {
      const original = fixture();
      const policy = policyFor(original);
      const output = patchFor(policy);
      if (kind === 'version') output.schemaVersion = 1;
      if (kind === 'fingerprint') output.originalFingerprint = '0'.repeat(64);
      if (kind === 'location') delete output.changes[faq];
      if (kind === 'extra-location') output.changes['/description'] = null;
      if (kind === 'root-key') Object.assign(output, { extra: 'untrusted parser detail' });
      expectInvalid(applySentenceRepair(original, policy, output));
    },
  );

  it.each(['secret', 'joined-secret', 'accessor', 'inherited', 'prototype-key', 'hidden', 'symbol', 'sparse-array', 'cycle'])(
    'rejects hostile %s data with a safe generic finding and no getter invocation', kind => {
      const original = fixture();
      const policy = policyFor(original);
      const output = patchFor(policy);
      let getterReads = 0;
      if (kind === 'secret') output.changes[body] = { b0: [`AKIA${'A'.repeat(16)}`], b1: null };
      if (kind === 'joined-secret') output.changes[body] = { b0: ['Bearer', 'syntheticvalue'], b1: null };
      if (kind === 'accessor') Object.defineProperty(output.changes, body, { enumerable: true, get: () => { getterReads++; return null; } });
      if (kind === 'inherited') output.changes[body] = Object.create({ b0: null, b1: null });
      if (kind === 'prototype-key') Object.defineProperty(output.changes, '__proto__', { value: null, enumerable: true });
      if (kind === 'hidden') Object.defineProperty(output, 'hidden', { value: 'hidden payload' });
      if (kind === 'symbol') Object.assign(output, { [Symbol('hidden')]: true });
      if (kind === 'sparse-array') output.changes[body] = { b0: new Array(1), b1: null };
      if (kind === 'cycle') output.changes[body] = output;
      expectInvalid(applySentenceRepair(original, policy, output));
      expect(getterReads).toBe(0);
    },
  );

  it.each(['stale', 'blocked', 'bad-location', 'duplicate-location', 'source-growth', 'original-secret', 'original-accessor', 'policy-prototype'])(
    'reuses original and policy validation for %s', kind => {
      const original = fixture();
      let policy = policyFor(original);
      let getterReads = 0;
      if (kind === 'stale') policy = { ...policy, originalFingerprint: '0'.repeat(64) };
      if (kind === 'blocked') policy = { ...policy, status: 'blocked' };
      if (kind === 'bad-location') policy = { ...policy, allowedLocations: ['/__proto__/polluted'] };
      if (kind === 'duplicate-location') policy = { ...policy, allowedLocations: [body, body] };
      if (kind === 'source-growth') policy = { ...policy, sources: [{ page: 'example.com/a', sourceIds: ['a'], initialDerivedWords: 1, maxDerivedWords: 2 }] };
      if (kind === 'original-secret') original.customerTrigger = `AKIA${'A'.repeat(16)}`;
      if (kind === 'original-accessor') Object.defineProperty(original, 'description', { enumerable: true, get: () => { getterReads++; return 'Private'; } });
      if (kind === 'policy-prototype') policy = Object.assign(Object.create({ extra: true }), policy);
      expect(() => createSentenceRepairRequest(original, policy)).toThrow('Repair patch requires a valid original, policy and bounded field replacements.');
      expectInvalid(applySentenceRepair(original, policy, patchFor(policy)));
      expect(getterReads).toBe(0);
    },
  );
});
