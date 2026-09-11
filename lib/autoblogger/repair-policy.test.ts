import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { DraftingContext, DraftSafetyFinding, GeneratedDraftV2, SourceFact } from './content-bundle';
import { buildSourceRepairPlan, measureReviewedSourceUse } from './source-plan';
import { buildRepairPolicy, getRepairLocationLimits, inspectRepairDelta, inspectRepairSourceGrowth } from './repair-policy';

type Binding = GeneratedDraftV2['claimBindings'][number];
type Review = Parameters<typeof measureReviewedSourceUse>[2][number];
const facts: SourceFact[] = ['a', 'b', 'c'].map(id => ({
  id, label: id, url: `https://example.com/${id}`, checkedAt: '2026-09-08T00:00:00.000Z',
  facts: ['one', 'two'].map(key => ({ id: `${id}-${key}`, text: 'A product demo shows a buyer workflow.', evidenceKind: 'body' })),
}));
const context = { candidate: { primaryKeyword: 'product demo', title: 'Plan a product demo', icp: 'Founders' }, sourceFacts: facts } as DraftingContext;
const words = (count: number) => Array.from({ length: count }, (_, i) => `word${i}`).join(' ');
const bind = (location: string, span: string, sourceFactIds = ['a-one']): Binding => ({ location, span, sourceFactIds, productClaimId: null });
function draft(): GeneratedDraftV2 {
  return {
    schemaVersion: 2, description: 'A practical product demo guide.', customerTrigger: 'Prepare for the buyer meeting.',
    competitorGap: 'Both publishers recommend every planning step.', directAnswer: 'Plan a demo for one buyer.',
    sections: [
      { heading: 'Plan the demo', markdown: 'Choose one buyer problem before recording the product demo.' },
      { heading: 'Review the recording', markdown: 'Review the recording with a colleague.' },
    ],
    faqAnswers: ['Who is it for?', 'What should I record?', 'When should I review?'].map(question => ({ question, answer: 'Plan for the buyer.' })),
    sourceReferences: [{ sourceId: 'a' }, { sourceId: 'b' }],
    editorialGraphic: { title: 'Demo planning', alt: 'Three demo planning steps.', steps: [
      { label: 'Plan', detail: 'Choose one buyer problem.' },
      { label: 'Record', detail: 'Record the workflow.' },
      { label: 'Review', detail: 'Review the recording.' },
    ] },
    claimBindings: [
      bind('/competitorGap', 'Both publishers recommend every planning step.', ['a-one', 'b-one']),
      bind('/sections/0/markdown', 'Choose one buyer problem before recording the product demo.'),
      bind('/sections/1/markdown', 'Review the recording with a colleague.', ['b-one']),
    ],
  };
}
function review(value: GeneratedDraftV2, kinds: Review['kind'][] = []): Review[] {
  return value.claimBindings.map((b, bindingIndex) => ({
    bindingIndex, bindingHash: createHash('sha256').update(JSON.stringify([b.location, b.span, b.sourceFactIds, b.productClaimId])).digest('hex'),
    supported: true, kind: kinds[bindingIndex] ?? 'source_claim',
  }));
}
const target = (location: string): DraftSafetyFinding => ({ code: 'critique.support_rejected', message: 'Narrow the unsupported claim.', location });
const plan = (value: GeneratedDraftV2) => buildSourceRepairPlan(context, value, review(value));
const policyFor = (value: GeneratedDraftV2, findings: DraftSafetyFinding[] = []) => buildRepairPolicy(value, findings, plan(value));
function changeBody(value: GeneratedDraftV2, text: string, sourceFactIds = ['a-one']) {
  value.sections[0].markdown = text;
  value.claimBindings[1] = bind('/sections/0/markdown', text, sourceFactIds);
}
function usage(count: number, kind: Review['kind'] = 'source_claim', factId = 'a-one') {
  const value = draft();
  changeBody(value, words(count), [factId]);
  value.claimBindings = [value.claimBindings[1]];
  return measureReviewedSourceUse(facts, value, review(value, [kind]));
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe('repair location limits', () => {
  it('returns only allowed locations without mutating or sharing the frozen baseline', () => {
    const original = draft();
    original.sections[0].markdown = 'Read [the guide](https://example.com/a).';
    original.claimBindings[1].span = 'Read the guide.';
    const policy = freeze(policyFor(original, [target('/sections/0/markdown'), target('/directAnswer')]));
    const before = structuredClone(original);
    expect(getRepairLocationLimits).toBeTypeOf('function');
    const limits = getRepairLocationLimits(freeze(original), policy);
    expect(limits).toEqual({
      '/directAnswer': { maxRenderedWords: 6, maxCharacters: null, maxBoundWordsByFact: {}, allowedCitationUrls: [] },
      '/sections/0/markdown': { maxRenderedWords: 3, maxCharacters: null,
        maxBoundWordsByFact: { 'a-one': 3 }, allowedCitationUrls: ['https://example.com/a'] },
    });
    limits['/sections/0/markdown'].maxBoundWordsByFact['a-one'] = 999;
    limits['/sections/0/markdown'].allowedCitationUrls.push('https://example.com/new');
    expect(getRepairLocationLimits(original, policy)['/sections/0/markdown']).toEqual({
      maxRenderedWords: 3, maxCharacters: null, maxBoundWordsByFact: { 'a-one': 3 }, allowedCitationUrls: ['https://example.com/a'],
    });
    expect(original).toEqual(before);
    expect(getRepairLocationLimits(original, policyFor(original))).toEqual({});
  });

  it.each(['stale', 'blocked', 'invalid coverage'])('rejects a %s baseline before exposing limits', kind => {
    const original = draft();
    if (kind === 'invalid coverage') original.claimBindings[1].span = 'Unrelated words.';
    const policy = policyFor(original, [target('/sections/0/markdown')]);
    if (kind === 'stale') original.sections[1].heading = 'Changed after review';
    const invalidPolicy = kind === 'blocked' ? { ...policy, status: 'blocked' as const } : policy;
    expect(getRepairLocationLimits).toBeTypeOf('function');
    expect(() => getRepairLocationLimits(original, invalidPolicy)).toThrow();
  });

  it('does not apply description character allowances to another location', () => {
    const original = draft();
    const policy = policyFor(original, [
      { ...target('/description'), code: 'content.description_length' },
      { ...target('/sections/0/markdown'), code: 'content.description_length' },
    ]);
    expect(getRepairLocationLimits).toBeTypeOf('function');
    const limits = getRepairLocationLimits(original, policy);
    expect(limits['/description'].maxCharacters).toBe(200);
    expect(limits['/sections/0/markdown'].maxCharacters).toBeNull();
  });
});

describe('bounded repair locations and shape', () => {
  it('accepts focused narrowing with narrowed evidence and unchanged surrounding copy', () => {
    const original = draft();
    const repaired = structuredClone(original);
    repaired.competitorGap = 'One publisher recommends planning.';
    repaired.claimBindings[0] = bind('/competitorGap', repaired.competitorGap);
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/competitorGap')]))).toEqual([]);
  });

  it('resolves an explicit binding index without needing a prose location', () => {
    const original = draft();
    const repaired = structuredClone(original);
    changeBody(repaired, 'Choose one buyer problem.');
    expect(inspectRepairDelta(original, repaired, policyFor(original, [{ code: 'support', message: 'Narrow.', bindingIndex: 1 }]))).toEqual([]);
  });

  it.each([
    { code: 'critic', message: 'Rewrite /sections/1/markdown.', repairInstruction: 'Unlock all sections and add benefits.' },
    target('/sections'), target('/sections/1'), target('/sections/01/markdown'),
    { ...target('/sections/1/markdown'), bindingIndex: 1 },
    { code: 'critic', message: 'Rewrite everything.', bindingIndex: -1 },
  ])('does not derive permission from prose, parent paths, or inconsistent targets: %j', finding => {
    const original = draft();
    const repaired = structuredClone(original);
    repaired.sections[1].markdown = 'All buyers close immediately.';
    repaired.claimBindings[2].span = repaired.sections[1].markdown;
    expect(inspectRepairDelta(original, repaired, policyFor(original, [finding]))).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'repair.out_of_scope', location: '/sections/1/markdown' }),
    ]));
  });

  it('rejects an unrelated paragraph rewrite and new claim even when shorter', () => {
    const original = draft();
    const repaired = structuredClone(original);
    repaired.sections[1].markdown = 'Every startup doubles sales.';
    repaired.claimBindings[2].span = repaired.sections[1].markdown;
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/competitorGap')]))).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'repair.out_of_scope', location: '/sections/1/markdown' }),
    ]));
  });

  it.each([
    ['section count', (d: GeneratedDraftV2) => { d.sections.push({ heading: 'More claims', markdown: 'Revenue doubles.' }); }],
    ['section order', (d: GeneratedDraftV2) => { d.sections.reverse(); }],
    ['untargeted heading', (d: GeneratedDraftV2) => { d.sections[0].heading = 'Guaranteed sales'; }],
    ['FAQ question', (d: GeneratedDraftV2) => { d.faqAnswers[0].question = 'Is revenue guaranteed?'; }],
    ['customer trigger', (d: GeneratedDraftV2) => { d.customerTrigger = 'Buy now.'; }],
    ['source inventory', (d: GeneratedDraftV2) => { d.sourceReferences[0].sourceId = 'c'; }],
    ['graphic steps', (d: GeneratedDraftV2) => { d.editorialGraphic.steps.pop(); }],
    ['schema version', (d: GeneratedDraftV2) => { Object.assign(d, { schemaVersion: 3 }); }],
    ['unknown field', (d: GeneratedDraftV2) => { Object.assign(d, { extraClaim: 'Revenue doubles.' }); }],
  ] as const)('keeps %s immutable even if a structural field is explicitly named', (_, change) => {
    const original = draft();
    const repaired = structuredClone(original);
    change(repaired);
    const findings = ['/sections/0/markdown', '/faqAnswers/0/question', '/customerTrigger', '/sourceReferences', '/editorialGraphic/steps', '/schemaVersion']
      .map(target);
    expect(inspectRepairDelta(original, repaired, policyFor(original, findings)).length).toBeGreaterThan(0);
  });

  it('allows an explicitly targeted heading without unlocking its body', () => {
    const original = draft();
    const repaired = structuredClone(original);
    repaired.sections[0].heading = 'Plan carefully';
    const policy = policyFor(original, [target('/sections/0/heading')]);
    expect(inspectRepairDelta(original, repaired, policy)).toEqual([]);
    changeBody(repaired, 'All buyers convert.');
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.location === '/sections/0/markdown')).toBe(true);
  });

  it.each(['unchanged', 'punctuation', 'case', 'markdown'] as const)('keeps section order fixed with %s edits even when all fields are targeted', style => {
    const original = draft();
    changeBody(original, 'Choose buyer scope.');
    original.sections[1].markdown = 'Check final output.';
    original.claimBindings[2] = bind('/sections/1/markdown', original.sections[1].markdown);
    const repaired = structuredClone(original);
    repaired.sections.reverse();
    for (const section of repaired.sections) {
      if (style === 'punctuation') {
        section.heading += '!';
        section.markdown = section.markdown.replace('.', '!');
      } else if (style === 'case') {
        section.heading = section.heading.toUpperCase();
        section.markdown = section.markdown.toUpperCase();
      } else if (style === 'markdown') {
        section.heading = `**${section.heading}**`;
        section.markdown = `**${section.markdown}**`;
      }
    }
    repaired.claimBindings[1].span = repaired.sections[0].markdown.replaceAll('**', '');
    repaired.claimBindings[2].span = repaired.sections[1].markdown.replaceAll('**', '');
    const targets = [0, 1].flatMap(i => [target(`/sections/${i}/heading`), target(`/sections/${i}/markdown`)]);
    expect(inspectRepairDelta(original, repaired, policyFor(original, targets)).some(f => f.code === 'repair.structure_changed')).toBe(true);
  });

  it('unlocks every contributor to an over-target source, not only the last binding', () => {
    const original = draft();
    changeBody(original, words(100));
    original.faqAnswers[0].answer = words(30);
    original.claimBindings.push(bind('/faqAnswers/0/answer', words(30)));
    const policy = policyFor(original);
    const repaired = structuredClone(original);
    changeBody(repaired, words(90));
    repaired.faqAnswers[0].answer = words(20);
    repaired.claimBindings[3].span = words(20);
    expect(inspectRepairDelta(original, repaired, policy)).toEqual([]);
    repaired.sections[1].markdown = 'New unrelated claim.';
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.code === 'repair.out_of_scope')).toBe(true);
  });

  it('blocks a stale or incomplete source plan rather than borrowing its permissions', () => {
    const original = draft();
    const stale = plan(original);
    changeBody(original, 'Choose the audience before recording.');
    expect(inspectRepairDelta(original, original, buildRepairPolicy(original, [], stale)).some(f => f.code === 'repair.policy_invalid')).toBe(true);
    const blocked = buildSourceRepairPlan(context, original, []);
    expect(inspectRepairDelta(original, original, buildRepairPolicy(original, [], blocked)).some(f => f.code === 'repair.policy_invalid')).toBe(true);
  });
});

describe('bounded repair text and provenance', () => {
  it.each(['content.description_duplicate', 'content.description_length'])('allows bounded description formatting for explicit %s', code => {
    const original = draft();
    original.claimBindings.push(bind('/description', original.description));
    const repaired = structuredClone(original);
    repaired.description = 'Plan a focused product demo with a practical buyer worksheet, recording checklist, and review steps.';
    repaired.claimBindings[3].span = repaired.description;
    const policy = policyFor(original, [{ ...target('/description'), code }]);
    expect(inspectRepairDelta(original, repaired, policy)).toEqual([]);
    expect(inspectRepairSourceGrowth(
      measureReviewedSourceUse(facts, original, review(original)),
      measureReviewedSourceUse(facts, repaired, review(repaired)), policy,
    ).some(f => f.code === 'repair.source_growth')).toBe(true);
    repaired.description = 'x'.repeat(201);
    repaired.claimBindings[3].span = repaired.description;
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.code === 'repair.location_growth')).toBe(true);
  });

  it('does not grant the description exception to generic findings or the same code at another location', () => {
    const original = draft();
    const repaired = structuredClone(original);
    repaired.description = 'Plan a focused product demo with a practical buyer worksheet, recording checklist, and review steps.';
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/description')])).some(f => f.code === 'repair.location_growth')).toBe(true);
    changeBody(repaired, words(12));
    expect(inspectRepairDelta(original, repaired, policyFor(original, [{ ...target('/sections/0/markdown'), code: 'content.description_length' }]))
      .some(f => f.code === 'repair.location_growth' && f.location === '/sections/0/markdown')).toBe(true);
  });

  it('blocks a known stale binding baseline instead of permitting an in-place binding correction', () => {
    const original = draft();
    original.claimBindings[1].span = 'Choose one buyer problem before recording the product demo incorrectly.';
    const repaired = structuredClone(original);
    repaired.claimBindings[1].span = repaired.sections[0].markdown;
    const policy = policyFor(original, [{ ...target('/sections/0/markdown'), code: 'content.claim_binding', reason: 'span_mismatch', bindingIndex: 1 }]);
    expect(policy).toMatchObject({ status: 'blocked', allowedLocations: [], findings: expect.arrayContaining([
      expect.objectContaining({ code: 'repair.invalid_baseline', reason: 'span_mismatch', location: '/sections/0/markdown' }),
    ]) });
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.code === 'repair.invalid_baseline')).toBe(true);
  });

  it('blocks the nine-visible/four-bound baseline before a legitimate five-word narrowing', () => {
    const original = draft();
    original.claimBindings[1].span = 'Choose one buyer problem.';
    const repaired = structuredClone(original);
    changeBody(repaired, 'Choose one buyer before recording.');
    const policy = policyFor(original, [{ ...target('/sections/0/markdown'), code: 'content.claim_binding', reason: 'missing_binding' }]);
    expect(policy).toMatchObject({ status: 'blocked', allowedLocations: [], findings: expect.arrayContaining([
      expect.objectContaining({ code: 'repair.invalid_baseline', reason: 'missing_binding' }),
    ]) });
    expect(policy.sources[0].initialDerivedWords).toBe(4);
    expect(policy.sources[0].maxDerivedWords).toBe(4);
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.code === 'repair.invalid_baseline')).toBe(true);
    // A valid nine-word baseline and its current review make the same narrowing
    // legitimate. The helper never silently manufactures that reviewed baseline.
    const valid = draft();
    expect(inspectRepairDelta(valid, repaired, policyFor(valid, [target('/sections/0/markdown')]))).toEqual([]);
  });

  it('blocks a known missing binding at an unrelated location before granting any repair permissions', () => {
    const original = draft();
    original.claimBindings.splice(2, 1);
    const policy = policyFor(original, [target('/competitorGap'), {
      code: 'content.claim_binding', message: 'Missing exact binding.', reason: 'missing_binding', location: '/sections/1/markdown',
    }]);
    expect(policy.status).toBe('blocked');
    expect(policy.allowedLocations).toEqual([]);
  });

  it.each(['same', 'punctuation', 'case'] as const)('rejects fact removal from %s visible text even when accounting falls from 139 to 69', style => {
    const original = draft();
    changeBody(original, words(70), ['a-one', 'b-one']);
    original.sections[1].markdown = words(69);
    original.claimBindings[2] = bind('/sections/1/markdown', words(69));
    const repaired = structuredClone(original);
    changeBody(repaired, style === 'punctuation' ? `${words(70)}!` : style === 'case' ? words(70).toUpperCase() : words(70), ['b-one']);
    const initialUsage = measureReviewedSourceUse(facts, original, review(original));
    const repairedUsage = measureReviewedSourceUse(facts, repaired, review(repaired));
    expect(initialUsage.sources[0].derivedWords).toBe(139);
    expect(repairedUsage.sources[0].derivedWords).toBe(69);
    const policy = policyFor(original);
    expect(inspectRepairSourceGrowth(initialUsage, repairedUsage, policy)).toEqual([]);
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.code === 'repair.evidence_changed')).toBe(true);
  });

  it('preserves the exact product ID on unchanged text in an unlocked location', () => {
    const original = draft();
    original.claimBindings[1].productClaimId = 'approved-product-claim';
    const sourcePlan = buildSourceRepairPlan(context, original, review(original, ['source_claim', 'product_claim', 'source_claim']));
    const policy = buildRepairPolicy(original, [target('/sections/0/markdown')], sourcePlan);
    const repaired = structuredClone(original);
    repaired.claimBindings[1].productClaimId = null;
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.code === 'repair.evidence_changed')).toBe(true);
  });

  it('rejects partitioning unchanged location words to drop citations without growing reviewed totals', () => {
    const original = draft();
    changeBody(original, words(70), ['a-one', 'b-one']);
    original.sections[1].markdown = words(69);
    original.claimBindings[2] = bind('/sections/1/markdown', words(69));
    const repaired = structuredClone(original);
    const tokens = words(70).split(' ');
    const first = `${tokens.slice(0, 35).join(' ')}.`;
    const second = `${tokens.slice(35).join(' ')}.`;
    repaired.sections[0].markdown = `${first} ${second}`;
    repaired.claimBindings[1] = bind('/sections/0/markdown', first, ['a-one', 'b-one']);
    repaired.claimBindings.push(bind('/sections/0/markdown', second, ['b-one']));
    const initialUsage = measureReviewedSourceUse(facts, original, review(original));
    const repairedUsage = measureReviewedSourceUse(facts, repaired, review(repaired));
    expect(initialUsage.sources[0].derivedWords).toBe(139);
    expect(repairedUsage.sources[0].derivedWords).toBe(104);
    const policy = policyFor(original);
    expect(inspectRepairSourceGrowth(initialUsage, repairedUsage, policy)).toEqual([]);
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.code === 'repair.evidence_changed')).toBe(true);
  });

  it('accepts fact-set reordering and punctuation correction without changing unchanged claim evidence', () => {
    const original = draft();
    changeBody(original, 'Choose one buyer problem.', ['a-one', 'b-one']);
    const repaired = structuredClone(original);
    changeBody(repaired, 'Choose one buyer problem!', ['b-one', 'a-one']);
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/sections/0/markdown')]))).toEqual([]);
  });

  it.each(['delete', 'partial', 'duplicate'] as const)('rejects %s binding coverage that would hide unchanged source copy', mode => {
    const original = draft();
    const repaired = structuredClone(original);
    if (mode === 'delete') repaired.claimBindings.splice(1, 1);
    else {
      repaired.claimBindings[1].span = 'Choose one buyer';
      if (mode === 'duplicate') repaired.claimBindings.push({ ...repaired.claimBindings[1] }, { ...repaired.claimBindings[1] });
    }
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/sections/0/markdown')])).some(f => f.code === 'repair.binding_coverage')).toBe(true);
  });

  it('counts repeated rendered source copy even if only one binding names its span', () => {
    const original = draft();
    changeBody(original, 'Choose a buyer.');
    original.sections[0].markdown += ' Record the workflow.';
    original.claimBindings.push(bind('/sections/0/markdown', 'Record the workflow.', ['b-one']));
    const repaired = structuredClone(original);
    repaired.sections[0].markdown = 'Choose a buyer. Choose a buyer.';
    repaired.claimBindings.pop();
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/sections/0/markdown')])).some(f => f.code === 'repair.evidence_growth')).toBe(true);
  });

  it('rejects growth in an allowed location without borrowing cuts elsewhere', () => {
    const original = draft();
    const repaired = structuredClone(original);
    changeBody(repaired, 'Choose one buyer problem before recording the product demo and guarantee that sales double.');
    repaired.competitorGap = 'Plan.';
    repaired.claimBindings[0].span = 'Plan.';
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/sections/0/markdown'), target('/competitorGap')]))).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'repair.location_growth', location: '/sections/0/markdown' }),
    ]));
  });

  it('counts contractions, Unicode and hyphens like reviewed source use; punctuation buys no extra words', () => {
    const original = draft();
    changeBody(original, 'Don’t skip café-quality 视频 checks.'); // Six words in the source-accounting tokenizer.
    const repaired = structuredClone(original);
    changeBody(repaired, 'Don’t skip café-quality 视频 checks!');
    const policy = policyFor(original, [target('/sections/0/markdown')]);
    expect(measureReviewedSourceUse(facts, { ...original, claimBindings: [original.claimBindings[1]] }, review({ ...original, claimBindings: [original.claimBindings[1]] })).sources[0].derivedWords).toBe(6);
    expect(inspectRepairDelta(original, repaired, policy)).toEqual([]);
    changeBody(repaired, 'Don’t skip café-quality 视频 checks today!');
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.code === 'repair.location_growth')).toBe(true);
  });

  it('allows a citation punctuation correction but does not trade URL tokens for prose', () => {
    const original = draft();
    original.sections[0].markdown = 'Read [the guide](https://example.com/a/very/long/source/path).';
    original.claimBindings[1].span = 'Read the guide.';
    const repaired = structuredClone(original);
    repaired.sections[0].markdown = 'Read [the guide](https://example.com/a/very/long/source/path)!';
    repaired.claimBindings[1].span = 'Read the guide!';
    const policy = policyFor(original, [target('/sections/0/markdown')]);
    expect(inspectRepairDelta(original, repaired, policy)).toEqual([]);
    changeBody(repaired, 'Read the guide and double revenue.');
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.code === 'repair.location_growth')).toBe(true);
  });

  it('rejects citation destination laundering in a targeted location', () => {
    const original = draft();
    original.sections[0].markdown = 'Read [the guide](https://example.com/a).';
    original.claimBindings[1].span = 'Read the guide.';
    const repaired = structuredClone(original);
    repaired.sections[0].markdown = 'Read [the guide](https://example.com/b).';
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/sections/0/markdown')]))).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'repair.citation_changed', location: '/sections/0/markdown' }),
    ]));
  });

  it.each(['a-two', 'b-one', 'c-one'])('rejects newly introduced fact/source %s even if it exists elsewhere in inventory', id => {
    const original = draft();
    const repaired = structuredClone(original);
    changeBody(repaired, 'Choose one buyer problem.', [id]);
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/sections/0/markdown')]))).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'repair.evidence_expansion', location: '/sections/0/markdown' }),
    ]));
  });

  it('preserves immutable bindings as an order-independent set, but rejects rebinding or deletion', () => {
    const original = draft();
    const policy = policyFor(original);
    const repaired = structuredClone(original);
    repaired.claimBindings.reverse();
    repaired.claimBindings[2].sourceFactIds.reverse();
    expect(inspectRepairDelta(original, repaired, policy)).toEqual([]);
    repaired.claimBindings[0].sourceFactIds = ['a-one'];
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.code === 'repair.immutable_bindings')).toBe(true);
    repaired.claimBindings = original.claimBindings.slice(1);
    expect(inspectRepairDelta(original, repaired, policy).some(f => f.code === 'repair.immutable_bindings')).toBe(true);
  });

  it('rejects new product claims in an allowed location', () => {
    const original = draft();
    const repaired = structuredClone(original);
    repaired.claimBindings[1].productClaimId = 'new-product-capability';
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/sections/0/markdown')])).some(f => f.code === 'repair.evidence_expansion')).toBe(true);
  });

  it('does not permit a source transfer between unchanged spans in one allowed location', () => {
    const original = draft();
    changeBody(original, 'Choose a buyer.');
    original.sections[0].markdown += ' Record the workflow.';
    original.claimBindings.push(bind('/sections/0/markdown', 'Record the workflow.', ['b-one']));
    const repaired = structuredClone(original);
    repaired.claimBindings[1].sourceFactIds = ['b-one'];
    repaired.claimBindings[3].sourceFactIds = ['a-one'];
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/sections/0/markdown')])).some(f => f.code === 'repair.evidence_expansion')).toBe(true);
  });

  it('keeps evidence word limits per location across a binding partition', () => {
    const original = draft();
    changeBody(original, 'Choose a buyer.');
    original.sections[0].markdown += ' Record the workflow.';
    original.claimBindings.push(bind('/sections/0/markdown', 'Record the workflow.', ['b-one']));
    const repaired = structuredClone(original);
    repaired.claimBindings[1] = bind('/sections/0/markdown', 'Choose a');
    repaired.claimBindings[3] = bind('/sections/0/markdown', 'buyer. Record the workflow.');
    expect(inspectRepairDelta(original, repaired, policyFor(original, [target('/sections/0/markdown')])).some(f => f.code === 'repair.evidence_growth')).toBe(true);
  });
});

describe('post-review source non-growth', () => {
  it('distinguishes an unchanged heading reclassification from newly written source copy without raising the captured ceiling', () => {
    const original = draft();
    original.sections[0].heading = 'Copy ready shot list template for a spreadsheet';
    original.claimBindings = [bind('/sections/0/heading', original.sections[0].heading)];
    const repaired = structuredClone(original);
    const initialReview = review(original, ['original_guidance']);
    const finalReview = review(repaired, ['source_claim']);
    const initialUsage = measureReviewedSourceUse(facts, original, initialReview);
    const finalUsage = measureReviewedSourceUse(facts, repaired, finalReview);
    const policy = buildRepairPolicy(original, [], buildSourceRepairPlan(context, original, initialReview));
    const before = JSON.stringify([original, repaired, initialReview, finalReview, policy]);
    expect(policy.sources[0].maxDerivedWords).toBe(0);
    expect(finalUsage.sources[0].derivedWords).toBe(8);
    expect(inspectRepairSourceGrowth(initialUsage, finalUsage, policy, {facts, original, repaired, initialReview, finalReview})).toEqual([]);
    expect(JSON.stringify([original, repaired, initialReview, finalReview, policy])).toBe(before);
  });

  it.each(['text', 'evidence', 'location', 'context', 'stale review', 'wrong policy'])('does not exempt %s changes as retained reclassification', change => {
    const original = draft();
    original.sections[0].markdown = 'Plan the demo before recording.';
    original.claimBindings = [bind('/sections/0/markdown', original.sections[0].markdown)];
    const initialReview = review(original, ['original_guidance']);
    const policy = buildRepairPolicy(original, [target('/sections/0/markdown'), target('/sections/0/heading')], buildSourceRepairPlan(context, original, initialReview));
    const repaired = structuredClone(original);
    if(change === 'text') {repaired.sections[0].markdown = 'Plan the video before recording.'; repaired.claimBindings[0].span = repaired.sections[0].markdown;}
    if(change === 'evidence') repaired.claimBindings[0].sourceFactIds = ['a-two'];
    if(change === 'location') {repaired.claimBindings[0].location = '/sections/1/markdown'; repaired.sections[1].markdown = repaired.sections[0].markdown;}
    if(change === 'context') repaired.sections[0].heading = 'Advice from the publisher';
    const finalReview = review(repaired, ['source_claim']);
    if(change === 'stale review') initialReview[0].bindingHash = '0'.repeat(64);
    const selectedPolicy = change === 'wrong policy' ? {...policy, originalFingerprint: '0'.repeat(64)} : policy;
    const findings = inspectRepairSourceGrowth(measureReviewedSourceUse(facts, original, initialReview), measureReviewedSourceUse(facts, repaired, finalReview), selectedPolicy, {facts, original, repaired, initialReview, finalReview});
    expect(findings.length).toBeGreaterThan(0);
  });

  it.each([121, 181])('retained reclassification still cannot exceed the repair target or hard source limit (%i words)', count => {
    const original = draft(); original.sections[0].markdown = words(count);
    original.claimBindings = [bind('/sections/0/markdown', original.sections[0].markdown)];
    const repaired = structuredClone(original), initialReview = review(original, ['original_guidance']), finalReview = review(repaired, ['source_claim']);
    const policy = buildRepairPolicy(original, [], buildSourceRepairPlan(context, original, initialReview));
    const findings = inspectRepairSourceGrowth(measureReviewedSourceUse(facts, original, initialReview), measureReviewedSourceUse(facts, repaired, finalReview), policy, {facts, original, repaired, initialReview, finalReview});
    expect(findings.some(f => f.code === 'repair.source_growth')).toBe(true);
    if(count === 181) expect(findings.some(f => f.code === 'content.source_budget')).toBe(true);
  });

  it('cannot spend retained reclassification on newly derived rewritten words elsewhere', () => {
    const original = draft();
    original.sections[0].heading = 'Copy ready shot list template for a spreadsheet';
    original.sections[0].markdown = 'Choose a buyer.';
    original.claimBindings = [bind('/sections/0/heading', original.sections[0].heading), bind('/sections/0/markdown', original.sections[0].markdown)];
    const repaired = structuredClone(original);
    repaired.sections[0].markdown = 'Choose one actor.'; repaired.claimBindings[1].span = repaired.sections[0].markdown;
    const initialReview = review(original, ['original_guidance', 'original_guidance']), finalReview = review(repaired);
    const policy = buildRepairPolicy(original, [target('/sections/0/markdown')], buildSourceRepairPlan(context, original, initialReview));
    const findings = inspectRepairSourceGrowth(measureReviewedSourceUse(facts, original, initialReview), measureReviewedSourceUse(facts, repaired, finalReview), policy, {facts, original, repaired, initialReview, finalReview});
    expect(findings.some(f => f.code === 'repair.source_growth')).toBe(true);
  });

  it.each([
    [87, 87, false], [87, 88, true], [87, 120, true], [87, 215, true],
    [121, 120, false], [144, 121, true], [181, 120, false], [215, 180, true],
  ])('enforces initial %i -> repaired %i words (reject=%s)', (initial, repaired, reject) => {
    const findings = inspectRepairSourceGrowth(usage(initial), usage(repaired));
    expect(findings.some(f => f.code === 'repair.source_growth')).toBe(reject);
    if (repaired > 180) expect(findings.some(f => f.code === 'content.source_budget')).toBe(true);
  });

  it('does not use a long originally grounded guidance span as extra derived allowance', () => {
    const original = usage(400, 'original_guidance');
    expect(original.sources[0]).toMatchObject({ derivedWords: 0, groundedWords: 400 });
    expect(inspectRepairSourceGrowth(original, usage(10)).some(f => f.code === 'repair.source_growth')).toBe(true);
    expect(inspectRepairSourceGrowth(original, usage(400, 'original_guidance'))).toEqual([]);
  });

  it('blocks transfer to a previously unused source despite a lower article total', () => {
    expect(inspectRepairSourceGrowth(usage(87), usage(50, 'source_claim', 'b-one')).some(f => f.code === 'repair.source_growth')).toBe(true);
  });

  it('groups query aliases of a page and never compares sources by array position', () => {
    const original = usage(87);
    const repaired = usage(90);
    repaired.sources[0].url = 'https://www.example.com/a/?tracking=repair#notes';
    repaired.sources.reverse();
    expect(inspectRepairSourceGrowth(original, repaired).some(f => f.code === 'repair.source_growth')).toBe(true);
  });

  it('rejects invalid accounting and uses the captured policy ceiling on repeated checks', () => {
    const original = draft();
    changeBody(original, words(87));
    original.claimBindings = [original.claimBindings[1]];
    const policy = policyFor(original);
    expect(inspectRepairSourceGrowth(usage(100), usage(99), policy).some(f => f.code === 'repair.source_growth')).toBe(true);
    const invalid = usage(87);
    invalid.findings.push({ code: 'content.source_usage_review', message: 'Stale review.' });
    expect(inspectRepairSourceGrowth(invalid, usage(0)).some(f => f.code === 'content.source_usage_review')).toBe(true);
    const malformed = usage(87);
    malformed.sources[0].derivedWords = Number.NaN;
    expect(inspectRepairSourceGrowth(usage(87), malformed).some(f => f.code === 'repair.source_usage_invalid')).toBe(true);
  });

  it('does not mutate drafts, findings, plans, policies or usage ledgers', () => {
    const original = freeze(draft());
    const repaired = freeze(structuredClone(original));
    const findings = freeze([target('/competitorGap')]);
    const sourcePlan = freeze(plan(original));
    const initialUsage = freeze(usage(87));
    const repairedUsage = freeze(usage(86));
    const before = JSON.stringify([original, repaired, findings, sourcePlan, initialUsage, repairedUsage]);
    const policy = freeze(buildRepairPolicy(original, findings, sourcePlan));
    expect(inspectRepairDelta(original, repaired, policy)).toEqual([]);
    expect(inspectRepairSourceGrowth(initialUsage, repairedUsage, policy)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'repair.source_growth' }), // Captured draft ceiling is nine, not 87.
    ]));
    expect(JSON.stringify([original, repaired, findings, sourcePlan, initialUsage, repairedUsage])).toBe(before);
  });
});
