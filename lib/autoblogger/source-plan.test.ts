import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { DraftingContext, GeneratedDraftV2, SourceFact } from './content-bundle';
import { buildSourcePlan, buildSourceRepairPlan, measureReviewedSourceUse, sourceAllocationFindings, measurePotentialSourceUse as measure } from './source-plan';
import { extractSourceBody } from './source-extraction';

function source(id: string, url = `https://example.com/${id}`): SourceFact {
  return { id, label: id, url, checkedAt: '2026-09-06T10:00:00.000Z', facts: [
    { id: `${id}-irrelevant`, text: 'A conference offers refreshments.', evidenceKind: 'body' },
    { id: `${id}-demo`, text: 'A product demo starts with a buyer problem.', evidenceKind: 'body' },
    { id: `${id}-check`, text: 'The product demo checklist includes a playback check.', evidenceKind: 'body' },
    { id: `${id}-snippet`, text: 'Product demo checklist template examples.', evidenceKind: 'serp_snippet' },
  ] };
}
const facts = [source('a'), source('b')];
type Review = Parameters<typeof measureReviewedSourceUse>[2][number];
const planningContext = { candidate: { primaryKeyword: 'product demo checklist', icp: 'Founder preparing a buyer demonstration', intent: 'informational' }, sourceFacts: facts } as DraftingContext;
function specimen(spans: Array<{ location: string; words: number; factIds?: string[] }>) {
  const draft = { claimBindings: spans.map(({ location, words, factIds }) => ({
    location, span: Array.from({ length: words }, (_, i) => `word${i}`).join(' '), sourceFactIds: factIds ?? ['a-demo'], productClaimId: null,
  })) } as GeneratedDraftV2;
  const evaluations: Review[] = draft.claimBindings.map((b, bindingIndex) => ({
    bindingIndex, bindingHash: createHash('sha256').update(JSON.stringify([b.location, b.span, b.sourceFactIds, b.productClaimId])).digest('hex'),
    supported: true, kind: 'source_claim' as const, rationale: 'Source-derived statement.',
  }));
  return { draft, evaluations };
}

describe('source planning and cumulative reviewed usage', () => {
  it('gives initial composition one shared 120-word regional allowance per page, including FAQs and metadata', () => {
    const context = { ...planningContext, sourceFacts: [...facts, source('alias', 'https://example.com/a/?ref=track')] };
    const plan = buildSourcePlan(context);
    expect(plan.sources).toHaveLength(2);
    for (const page of plan.sources) {
      expect(page.regions.reduce((sum, r) => sum + r.targetDerivedWords, 0)).toBe(120);
      expect(Object.fromEntries(page.regions.map(r => [r.region, r.targetDerivedWords]))).toEqual({
        directAnswer: 20, body: 60, headings: 5, faq: 20, description: 5, graphic: 10, other: 0,
      });
    }
  });

  it('keeps a second source planning warning when another source already exceeds its final limit', () => {
    const input = specimen([{ location: '/sections/0/markdown', words: 181 },
      { location: '/sections/1/markdown', words: 144, factIds: ['b-demo'] }]);
    const usage = measureReviewedSourceUse(facts, input.draft, input.evaluations);
    expect(usage.findings).toEqual([expect.objectContaining({ code: 'content.source_budget' })]);
    expect(sourceAllocationFindings(usage)).toEqual([expect.objectContaining({
      code: 'content.source_allocation', message: expect.stringContaining('b is 144 words'),
    })]);
  });

  it('does not turn invalid review accounting or long original guidance into planning warnings', () => {
    const input = specimen([{ location: '/sections/0/markdown', words: 144 }]);
    expect(sourceAllocationFindings(measureReviewedSourceUse(facts, input.draft, []))).toEqual([]);
    const original = input.evaluations.map(e => ({ ...e, kind: 'original_guidance' as const }));
    expect(sourceAllocationFindings(measureReviewedSourceUse(facts, input.draft, original))).toEqual([]);
  });

  it('carries the fixed title scope into planning without changing the keyword or manufacturing facts', () => {
    const context = structuredClone(planningContext);
    context.candidate.title = 'Product Demo Checklist: Plan, Record and Rehearse';
    const before = structuredClone(context);
    expect(buildSourcePlan(context)).toMatchObject({
      readerTask: 'product demo checklist',
      articleTitle: 'Product Demo Checklist: Plan, Record and Rehearse',
    });
    expect(context).toEqual(before);
  });
  it('does not anchor an extracted H2 topic label attached to unrelated body prose', () => {
    const document = extractSourceBody('<h2>Product demo checklist</h2><p>The cafeteria serves lunch daily and closes early on Fridays.</p>');
    const a = source('a');
    a.facts = document.passages.map(({ text, bodyStart }) => ({ text, bodyStart, id: 'heading-only', evidenceKind: 'body' as const }));
    const before = structuredClone(a);
    expect(buildSourcePlan({ ...planningContext, sourceFacts: [a] }).sources[0].anchorFactIds).toEqual([]);
    expect(a).toEqual(before);
  });

  it.each([
    ['How does a product demo work?', 'A product demo works by walking buyers through a realistic workflow.'],
    ['How do product demos work?', 'A product demo works by walking buyers through a realistic workflow.'],
    ['How has a product demo changed?', 'A product demo changed when teams started walking buyers through a realistic workflow.'],
    ['How have product demos changed?', 'Product demos changed when teams started walking buyers through a realistic workflow.'],
  ])('keeps topical anchors across equivalent query framing: %s', (primaryKeyword, text) => {
    const a = source('a');
    a.facts = [{ id: 'work', text, evidenceKind: 'body' }];
    expect(buildSourcePlan({ ...planningContext, candidate: { ...planningContext.candidate, primaryKeyword }, sourceFacts: [a] }).sources[0].anchorFactIds).toEqual(['work']);
  });

  it('gives each verified source bounded relevant anchors without deleting original evidence', () => {
    const context = structuredClone(planningContext);
    context.sourceFacts[0].facts.push(...Array.from({ length: 20 }, (_, i) => ({ id: `a-extra-${i}`, text: `Product demo detail ${i} explains one buyer workflow.`, evidenceKind: 'body' as const })));
    const before = structuredClone(context);
    const plan = buildSourcePlan(context);
    expect(plan.sources).toHaveLength(2);
    expect(plan.sources[0].anchorFactIds).toHaveLength(3);
    expect(plan.sources[1].anchorFactIds).toHaveLength(2);
    expect(plan.sources[0].anchorFactIds[0]).toBe('a-check');
    expect(plan.sources[1].anchorFactIds).not.toContain('b-snippet');
    expect(plan.sources[1].anchorFactIds).not.toContain('b-irrelevant');
    expect(plan.readerTask).toBe('product demo checklist');
    expect(plan.originalWork.map(item => item.role)).toEqual(['decision_tool', 'hypothetical_example', 'troubleshooting']);
    expect(context).toEqual(before);
  });

  it('does not inflate source allowance or anchors using query aliases of the same page', () => {
    const context = { ...planningContext, sourceFacts: [source('a'), source('alias', 'https://example.com/a/?ref=track#intro'), source('b')] };
    const plan = buildSourcePlan(context);
    expect(plan.sources).toHaveLength(2);
    expect(plan.sources[0].sourceIds).toEqual(['a', 'alias']);
    expect(plan.sources[0].anchorFactIds).toHaveLength(2);
    expect(plan.sources[0].maxDerivedWords).toBe(180);
    expect(plan.sources[0]).toMatchObject({ targetDerivedWords: 120, reserveDerivedWords: 60 });
  });

  it('never spends an anchor slot on duplicate page text or facts with no query overlap', () => {
    const a = source('a');
    const alias = source('alias', 'https://example.com/a/?ref=track');
    alias.facts = a.facts.map(f => ({ ...f, id: `alias-${f.id}`, text: `  ${f.text.toUpperCase()}  ` }));
    const irrelevant = source('unrelated');
    irrelevant.facts = [{ id: 'unrelated', text: 'The conference offers refreshments.', evidenceKind: 'body' }];
    const plan = buildSourcePlan({ ...planningContext, sourceFacts: [a, alias, irrelevant] });
    expect(plan.sources[0].anchorFactIds).toEqual(['a-check', 'a-demo']);
    expect(plan.sources[1].anchorFactIds).toEqual([]);
  });

  it.each([
    ['product demo checklist', 'The product launch checklist assigns launch owners and deadlines.', 'The product demo should follow the buyer workflow and explain the result.'],
    ['payroll tax checklist', 'A payroll onboarding checklist introduces employees to the payroll system.', 'Payroll tax records should distinguish withheld tax from employer contributions.'],
    ['remote employee onboarding checklist', 'Employee onboarding introduces the team and explains the reporting structure.', 'Remote employee onboarding should explain where to obtain equipment and support.'],
    ['product demo checklist', 'Product pricing determines the launch budget. Demo Day pitches introduce the team.', 'Product demos should connect the buyer problem to a realistic workflow.'],
    ['How to create product demos checklist', 'The product launch checklist assigns launch owners and deadlines.', 'Product demos should connect the buyer problem to a realistic workflow.'],
    ['how to make remote employee onboarding checklist', 'Employee onboarding introduces the team and explains the reporting structure.', 'Remote employee onboarding should explain where to obtain equipment and support.'],
    ['product demo before launch', 'A product demo after launch can show customers the finished workflow.', 'A product demo before launch should label unfinished parts of the workflow.'],
  ])('requires the core topic and qualifiers for anchors: %s', (query, adjacent, topical) => {
    const a = source('a');
    a.facts = [{ id: 'adjacent', text: adjacent, evidenceKind: 'body' }, { id: 'topical', text: topical, evidenceKind: 'body' }];
    const plan = buildSourcePlan({ ...planningContext, candidate: { ...planningContext.candidate, primaryKeyword: query }, sourceFacts: [a] });
    expect(plan.sources[0].anchorFactIds).toEqual(['topical']);
  });

  it('does not promote isolated keywords, topic-only labels or a distant accidental co-occurrence', () => {
    const a = source('a');
    a.facts = [
      { id: 'label', text: 'Product demo checklist template examples.', evidenceKind: 'body' },
      { id: 'distant', text: `Product launches require ${'careful planning '.repeat(30)}before a demo day pitch.`, evidenceKind: 'body' },
    ];
    expect(buildSourcePlan({ ...planningContext, sourceFacts: [a] }).sources[0].anchorFactIds).toEqual([]);
  });

  it('adds disjoint public prose, FAQs, description and graphic words before enforcing the limit', () => {
    const input = specimen([{ location: '/sections/0/markdown', words: 100 }, { location: '/description', words: 20 },
      { location: '/faqAnswers/0/answer', words: 30 }, { location: '/editorialGraphic/steps/0/detail', words: 31 },
      { location: '/customerTrigger', words: 200 }, { location: '/competitorGap', words: 200 }]);
    const result = measureReviewedSourceUse(facts, input.draft, input.evaluations);
    expect(result.sources[0]).toMatchObject({ derivedWords: 181, bindingIndices: [0, 1, 2, 3] });
    expect(result.findings).toEqual([expect.objectContaining({ code: 'content.source_budget', bindingIndex: 3 })]);
  });

  it('does not charge contextual grounding as derivation when the independent reviewer classifies original guidance', () => {
    const input = specimen([{ location: '/sections/0/markdown', words: 180 }, { location: '/sections/1/markdown', words: 300 }]);
    const evaluations = input.evaluations.map((e, i) => ({ ...e, kind: i === 1 ? 'original_guidance' as const : e.kind }));
    const result = measureReviewedSourceUse(facts, input.draft, evaluations);
    expect(result.sources[0]).toMatchObject({ derivedWords: 180, groundedWords: 480 });
    expect(result.findings).toEqual([]);
  });

  it('counts a multi-source span in full for both pages rather than dividing its allowance', () => {
    const input = specimen([{ location: '/sections/0/markdown', words: 181, factIds: ['a-demo', 'b-demo'] }]);
    const result = measureReviewedSourceUse(facts, input.draft, input.evaluations);
    expect(result.sources.map(item => item.derivedWords)).toEqual([181, 181]);
    expect(result.findings).toHaveLength(2);
  });

  it('combines repeated page identities and does not allow duplicate fact IDs to multiply a span', () => {
    const input = specimen([{ location: '/sections/0/markdown', words: 90, factIds: ['a-demo', 'a-check'] }, { location: '/sections/1/markdown', words: 91, factIds: ['alias-demo'] }]);
    const result = measureReviewedSourceUse([...facts, source('alias', 'https://example.com/a/?ref=track')], input.draft, input.evaluations);
    expect(result.sources[0].derivedWords).toBe(181);
    expect(result.findings).toHaveLength(1);
  });

  it.each(['missing', 'stale', 'duplicate'])('refuses a %s classification ledger instead of letting it exempt prose', (problem) => {
    const input = specimen([{ location: '/sections/0/markdown', words: 181 }]);
    if (problem === 'missing') input.evaluations = [];
    if (problem === 'stale') input.evaluations[0].bindingHash = '0'.repeat(64);
    if (problem === 'duplicate') input.evaluations.push(input.evaluations[0]);
    expect(measureReviewedSourceUse(facts, input.draft, input.evaluations).findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'content.source_usage_review' }),
    ]));
  });
});

describe('bounded source repair planning', () => {
  it('never offers unused source capacity that the non-growing repair policy forbids', () => {
    const input = specimen([
      { location: '/sections/0/markdown', words: 64 },
      { location: '/sections/1/markdown', words: 108, factIds: ['b-demo'] },
    ]);
    const plan = buildSourceRepairPlan(planningContext, input.draft, input.evaluations);
    expect(plan.sources.map(page => page.targetDerivedWords)).toEqual([64, 108]);
    expect(plan.sources.map(page => page.availableDerivedWords)).toEqual([0, 0]);
    expect(plan.sources.map(page => page.regions.reduce((sum, region) => sum + region.targetDerivedWords, 0))).toEqual([64, 108]);
    expect(plan.reuseCandidates).toEqual([]);
  });

  it('reserves required answers before optional source repetition instead of deleting entire FAQs', () => {
    const input = specimen([
      { location: '/directAnswer', words: 51 },
      { location: '/description', words: 18 },
      { location: '/faqAnswers/0/answer', words: 22 },
      { location: '/faqAnswers/1/answer', words: 22 },
      { location: '/faqAnswers/2/answer', words: 21 },
      { location: '/sections/0/heading', words: 7 },
      { location: '/sections/0/markdown', words: 227 },
    ]);
    const page = buildSourceRepairPlan(planningContext, input.draft, input.evaluations).sources[0];
    expect(page.targetDerivedWords).toBe(120);
    expect(page.locations.find(l => l.location === '/directAnswer')!.targetDerivedWords).toBeGreaterThanOrEqual(40);
    expect(page.locations.filter(l => l.region === 'faq').every(l => l.targetDerivedWords >= 12)).toBe(true);
    expect(page.locations.find(l => l.location === '/description')!.targetDerivedWords).toBe(18);
    expect(page.locations.find(l => l.region === 'headings')!.targetDerivedWords).toBeGreaterThan(0);
    expect(page.locations.reduce((sum, l) => sum + l.targetDerivedWords, 0)).toBe(120);
    expect(page.locations.reduce((sum, l) => sum + l.removeDerivedWords, 0)).toBe(248);
  });

  it('credits retained contextual guidance towards required answer length without counting it as source derivation', () => {
    const input = specimen([
      { location: '/directAnswer', words: 25 },
      { location: '/directAnswer', words: 26 },
      { location: '/sections/0/markdown', words: 200 },
    ]);
    input.evaluations[1].kind = 'original_guidance';
    const page = buildSourceRepairPlan(planningContext, input.draft, input.evaluations).sources[0];
    // 26 retained original words + 14 source words can still meet 40 words.
    expect(page.locations.find(l => l.location === '/directAnswer')!.targetDerivedWords).toBe(14);
    expect(page.derivedWords).toBe(225);
    expect(page.groundedWords).toBe(251);
  });

  it.each([
    ['/directAnswer', 25, 26, 40],
    ['/faqAnswers/0/answer', 12, 13, 12],
  ] as const)('does not borrow a reservation from another source that is also being cut: %s', (location, first, second, minimum) => {
    const input = specimen([
      { location, words: first }, { location, words: second, factIds: ['b-demo'] },
      { location: '/sections/0/markdown', words: 200 },
      { location: '/sections/1/markdown', words: 200, factIds: ['b-demo'] },
    ]);
    const pages = buildSourceRepairPlan(planningContext, input.draft, input.evaluations).sources;
    const allocated = pages.reduce((sum, page) => sum + page.locations.find(l => l.location === location)!.targetDerivedWords, 0);
    expect(allocated).toBeGreaterThanOrEqual(minimum);
    expect(pages.every(page => page.allocationFeasible && page.targetDerivedWords === 120)).toBe(true);
  });

  it('aggregates repeated FAQs and every public region into one page budget with hash-bound removal targets', () => {
    const input = specimen([
      { location: '/directAnswer', words: 20 },
      { location: '/sections/0/markdown', words: 60 },
      { location: '/sections/0/heading', words: 5 },
      { location: '/faqAnswers/0/answer', words: 15 },
      { location: '/faqAnswers/0/answer', words: 20 },
      { location: '/faqAnswers/1/answer', words: 15 },
      { location: '/description', words: 15 },
      { location: '/editorialGraphic/alt', words: 10 },
      { location: '/editorialGraphic/steps/0/detail', words: 21 },
      { location: '/customerTrigger', words: 200 },
      { location: '/competitorGap', words: 200 },
    ]);
    const before = structuredClone({ context: planningContext, ...input });
    const plan = buildSourceRepairPlan(planningContext, input.draft, input.evaluations);
    expect(plan.status).toBe('ready');
    expect(plan.findings).toEqual([expect.objectContaining({ code: 'content.source_budget' })]);
    const page = plan.sources[0];
    expect(page).toMatchObject({ derivedWords: 181, maxDerivedWords: 180, targetDerivedWords: 120, removeDerivedWords: 61 });
    expect(Object.fromEntries(page.regions.map(r => [r.region, [r.derivedWords, r.targetDerivedWords, r.removeDerivedWords]]))).toEqual({
      directAnswer: [20, 20, 0], body: [60, 53, 7], headings: [5, 1, 4],
      faq: [50, 24, 26], description: [15, 15, 0], graphic: [31, 7, 24], other: [0, 0, 0],
    });
    expect(page.locations.find(l => l.location === '/faqAnswers/0/answer')).toMatchObject({
      derivedWords: 35, targetDerivedWords: 12, removeDerivedWords: 23,
      bindings: [
        { bindingIndex: 3, bindingHash: input.evaluations[3].bindingHash, derivedWords: 15 },
        { bindingIndex: 4, bindingHash: input.evaluations[4].bindingHash, derivedWords: 20 },
      ],
    });
    expect(page.locations.find(l => l.location === '/faqAnswers/1/answer')?.removeDerivedWords).toBe(3);
    expect(page.locations.find(l => l.location === '/description')?.removeDerivedWords).toBe(0);
    expect(page.locations.find(l => l.location === '/editorialGraphic/steps/0/detail')?.removeDerivedWords).toBe(17);
    expect(page.locations.some(l => ['/customerTrigger', '/competitorGap'].includes(l.location))).toBe(false);
    expect(page.locations.reduce((sum, l) => sum + l.removeDerivedWords, 0)).toBe(61);
    expect(plan.reviewBindings).toEqual(input.evaluations.map(({ bindingIndex, bindingHash }) => ({ bindingIndex, bindingHash })));
    expect(buildSourceRepairPlan(planningContext, input.draft, [...input.evaluations].reverse())).toEqual(plan);
    expect({ context: planningContext, ...input }).toEqual(before);
    expect(JSON.stringify(plan)).not.toContain('word0');
  });

  it('shares the allowance across query variants and charges shared-source spans in full to both pages', () => {
    const context = { ...planningContext, sourceFacts: [facts[0], source('alias', 'https://www.example.com/a/?ref=track#intro'), facts[1]] };
    const input = specimen([
      { location: '/sections/0/markdown', words: 90, factIds: ['a-demo', 'a-check', 'alias-demo', 'a-demo', 'b-demo'] },
      { location: '/faqAnswers/0/answer', words: 91, factIds: ['alias-demo'] },
    ]);
    const plan = buildSourceRepairPlan(context, input.draft, input.evaluations);
    expect(plan.sources).toHaveLength(2);
    expect(plan.sources.map(p => [p.sourceIds, p.derivedWords, p.removeDerivedWords])).toEqual([
      [['a', 'alias'], 181, 61], [['b'], 90, 0],
    ]);
    expect(plan.sources[0].locations[0].bindings).toHaveLength(1);
    expect(plan.sources.map(p => p.regions.reduce((sum, r) => sum + r.targetDerivedWords, 0))).toEqual([120, 90]);
    expect(plan.reuseCandidates).toEqual([]);
  });

  it.each(['missing', 'stale', 'duplicate', 'unknown index', 'unknown kind', 'product mismatch', 'unknown fact', 'ambiguous fact'])('refuses %s reviews instead of planning around a classification failure', problem => {
    const context = structuredClone(planningContext);
    const input = specimen([{ location: '/sections/0/markdown', words: 181 }]);
    if (problem === 'missing') input.evaluations = [];
    if (problem === 'stale') input.draft.claimBindings[0].span += ' changed';
    if (problem === 'duplicate') input.evaluations.push(input.evaluations[0]);
    if (problem === 'unknown index') input.evaluations[0].bindingIndex = 99;
    if (problem === 'unknown kind') input.evaluations[0].kind = 'unclassified' as Review['kind'];
    if (problem === 'product mismatch') input.evaluations[0].kind = 'product_claim';
    if (problem === 'unknown fact') context.sourceFacts[0].facts = [];
    if (problem === 'ambiguous fact') context.sourceFacts[1].facts[1].id = 'a-demo';
    const plan = buildSourceRepairPlan(context, input.draft, input.evaluations);
    expect(plan).toMatchObject({ status: 'blocked', sources: [], reuseCandidates: [] });
    expect(plan.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'content.source_usage_review' })]));
  });

  it('spreads cuts across repeated answers while keeping a usable answer allowance for each', () => {
    const context = { ...planningContext, sourceFacts: [...facts, source('c'), source('d'), source('off-topic')] };
    context.sourceFacts[4].facts = [{ id: 'unrelated', text: 'A conference offers refreshments.', evidenceKind: 'body' }];
    const input = specimen([
      { location: '/directAnswer', words: 16 }, { location: '/sections/0/markdown', words: 72 },
      { location: '/faqAnswers/0/answer', words: 21 }, { location: '/faqAnswers/1/answer', words: 11 },
      { location: '/faqAnswers/2/answer', words: 46 },
      { location: '/sections/1/markdown', words: 158, factIds: ['b-demo'] },
      { location: '/sections/2/markdown', words: 50, factIds: ['c-demo'] },
      { location: '/faqAnswers/3/answer', words: 46, factIds: ['d-demo'] },
    ]);
    const plan = buildSourceRepairPlan(context, input.draft, input.evaluations);
    expect(plan.sources.map(p => p.removeDerivedWords)).toEqual([46, 38, 0, 0, 0]);
    expect(plan.sources[0].locations.filter(l => l.removeDerivedWords > 0)).toEqual([
      expect.objectContaining({ location: '/sections/0/markdown', targetDerivedWords: 69, removeDerivedWords: 3 }),
      expect.objectContaining({ location: '/faqAnswers/0/answer', targetDerivedWords: 12, removeDerivedWords: 9 }),
      expect.objectContaining({ location: '/faqAnswers/2/answer', targetDerivedWords: 12, removeDerivedWords: 34 }),
    ]);
    expect(plan.reuseCandidates).toEqual([]);
    expect(plan.sources.map(p => p.regions.reduce((sum, r) => sum + r.targetDerivedWords, 0))).toEqual([120, 120, 50, 46, 0]);
    for (const page of plan.sources) {
      expect(page.locations.reduce((sum, l) => sum + l.targetDerivedWords, 0)).toBeLessThanOrEqual(120);
      expect(page.locations.reduce((sum, l) => sum + l.removeDerivedWords, 0)).toBe(page.removeDerivedWords);
    }
  });

  it('plans counted source claims alongside their unresolved support rejection for the same repair pass', () => {
    const input = specimen([
      { location: '/directAnswer', words: 16 }, { location: '/sections/0/markdown', words: 72 },
      { location: '/faqAnswers/0/answer', words: 78 },
    ]);
    input.evaluations[0].supported = false;
    const before = structuredClone(input);
    const plan = buildSourceRepairPlan(planningContext, input.draft, input.evaluations);
    expect(plan.status).toBe('ready');
    expect(plan.unsupportedBindingIndices).toEqual([0]);
    expect(plan.findings).toEqual([expect.objectContaining({ code: 'critique.support_rejected', bindingIndex: 0 })]);
    expect(plan.sources[0]).toMatchObject({ derivedWords: 166, removeDerivedWords: 46 });
    expect(plan.sources[0].locations.find(l => l.location === '/faqAnswers/0/answer')).toMatchObject({
      derivedWords: 78, targetDerivedWords: 32, removeDerivedWords: 46,
    });
    expect(input).toEqual(before);
  });

  it.each(['original_guidance', 'original_example'] as const)('reserves disputed %s exposure without rewriting the reviewed ledger or hiding the usable plan', kind => {
    const input = specimen([
      { location: '/sections/0/markdown', words: 79 },
      { location: '/faqAnswers/0/answer', words: 70 },
      { location: '/description', words: 5, factIds: ['b-demo'] },
    ]);
    input.evaluations[1].kind = kind;
    input.evaluations[1].supported = false;
    const plan = buildSourceRepairPlan(planningContext, input.draft, input.evaluations);
    expect(plan.status).toBe('ready');
    expect(plan.unsupportedBindingIndices).toEqual([1]);
    expect(plan.findings).toEqual([expect.objectContaining({ code: 'critique.support_rejected', bindingIndex: 1 })]);
    expect(plan.sources[0]).toMatchObject({ derivedWords: 79, groundedWords: 149, disputedWords: 70, unsafe: true });
    expect(plan.sources[0].disputedLocations).toEqual([{
      location: '/faqAnswers/0/answer', bindingIndex: 1, bindingHash: input.evaluations[1].bindingHash, words: 70,
    }]);
    expect(plan.sources[0].regions.reduce((sum, r) => sum + r.targetDerivedWords, 0)).toBe(79);
    expect(plan.sources[0].locations).toHaveLength(1);
    expect(plan.reuseCandidates).toEqual([]);
  });

  it('keeps grounded original guidance and examples out of derivation and removal targets', () => {
    const input = specimen([
      { location: '/sections/0/markdown', words: 79 },
      { location: '/faqAnswers/0/answer', words: 500 },
      { location: '/description', words: 200 },
      { location: '/editorialGraphic/steps/0/detail', words: 300, factIds: ['b-demo'] },
    ]);
    input.evaluations[1].kind = 'original_guidance';
    input.evaluations[2].kind = 'original_example';
    input.evaluations[3].kind = 'original_guidance';
    const plan = buildSourceRepairPlan(planningContext, input.draft, input.evaluations);
    expect(plan.status).toBe('ready');
    expect(plan.findings).toEqual([]);
    expect(plan.sources[0]).toMatchObject({ derivedWords: 79, groundedWords: 779, removeDerivedWords: 0 });
    expect(plan.sources[0].locations.map(l => l.location)).toEqual(['/sections/0/markdown']);
    expect(plan.sources[1]).toMatchObject({ derivedWords: 0, groundedWords: 300, removeDerivedWords: 0, locations: [] });
    expect(plan.reuseCandidates).toEqual([]);
  });

  it('reports an infeasible required reservation without raising the locked ceiling or erasing an answer', () => {
    const input = specimen([
      { location: '/directAnswer', words: 50 }, { location: '/description', words: 70 },
      { location: '/faqAnswers/0/answer', words: 20 },
    ]);
    const page = buildSourceRepairPlan(planningContext, input.draft, input.evaluations).sources[0];
    expect(page).toMatchObject({ allocationFeasible: false, requiredDerivedWords: 122, targetDerivedWords: 120, availableDerivedWords: 0 });
    expect(page.locations.map(l => l.targetDerivedWords)).toEqual([40, 70, 12]);
  });

  it.each([0, 1, 64, 108, 119, 120, 121, 180, 368])('keeps all feasible integer allocations within the non-growing ceiling: %s words', words => {
    const input = specimen(words ? [{ location: '/sections/0/markdown', words }] : []);
    const page = buildSourceRepairPlan(planningContext, input.draft, input.evaluations).sources[0];
    expect(page.allocationFeasible).toBe(true);
    expect(page.targetDerivedWords).toBe(Math.min(words, 120));
    expect(page.locations.reduce((sum, l) => sum + l.targetDerivedWords, 0)).toBe(Math.min(words, 120));
    expect(page.locations.reduce((sum, l) => sum + l.removeDerivedWords, 0)).toBe(Math.max(0, words - 120));
    expect(page.availableDerivedWords).toBe(0);
  });
});

describe('conservative potential source exposure', () => {
  it('exposes 226 words before repair even when the initial critic counts only 79', () => {
    const input = specimen([{ location: '/sections/0/markdown', words: 79 }, { location: '/faqAnswers/0/answer', words: 147 },
      { location: '/customerTrigger', words: 200 }, { location: '/competitorGap', words: 200 }]);
    const reviews = input.evaluations.map((evaluation, index) => ({ ...evaluation, kind: index === 1 ? 'original_guidance' as const : evaluation.kind }));
    expect(measureReviewedSourceUse(facts, input.draft, reviews).sources[0].derivedWords).toBe(79);
    const before = structuredClone(input.draft);
    const result = measure(facts, input.draft);
    expect(result.sources[0]).toMatchObject({ potentialDerivedWords: 226, bindingIndices: [0, 1], targetDerivedWords: 120, maxDerivedWords: 180 });
    expect(result.findings).toEqual([]);
    expect(result.warnings).toEqual([expect.objectContaining({ sourceIds: ['a'] })]);
    expect(input.draft).toEqual(before);
  });

  it('reserves margin before the hard limit and includes metadata and graphic text', () => {
    const input = specimen([{ location: '/description', words: 60 }, { location: '/editorialGraphic/steps/0/detail', words: 60 }]);
    expect(measure(facts, input.draft).findings).toEqual([]);
    input.draft.claimBindings.push({ ...input.draft.claimBindings[0], location: '/title', span: 'one' });
    expect(measure(facts, input.draft).sources[0].potentialDerivedWords).toBe(121);
    expect(measure(facts, input.draft).findings).toEqual([]);
    expect(measure(facts, input.draft).warnings).toHaveLength(1);
  });

  it('charges a span in full to each distinct page but does not multiply aliases or repeated fact references', () => {
    const input = specimen([{ location: '/sections/0/markdown', words: 121, factIds: ['a-demo', 'a-check', 'alias-demo', 'a-demo', 'b-demo'] }]);
    const result = measure([...facts, source('alias', 'https://www.example.com/a/?ref=track#intro')], input.draft);
    expect(result.sources.map(page => page.potentialDerivedWords)).toEqual([121, 121]);
    expect(result.sources[0].sourceIds).toEqual(['a', 'alias']);
    expect(result.sources.map(page => page.bindingIndices)).toEqual([[0], [0]]);
    expect(result.findings).toEqual([]);
    expect(result.warnings).toHaveLength(2);
  });

  it('does not block a long original-advice article solely because every span needs contextual grounding', () => {
    const input = specimen([{ location: '/sections/0/markdown', words: 500 }, { location: '/sections/1/markdown', words: 500, factIds: ['b-demo'] }]);
    const reviews = input.evaluations.map(evaluation => ({ ...evaluation, kind: 'original_guidance' as const }));
    expect(measureReviewedSourceUse(facts, input.draft, reviews).sources.map(page => page.derivedWords)).toEqual([0, 0]);
    const result = measure(facts, input.draft);
    expect(result.sources.map(page => page.potentialDerivedWords)).toEqual([500, 500]);
    expect(result.findings).toEqual([]);
    expect(result.warnings).toHaveLength(2);
  });

  it.each(['unknown', 'ambiguous'])('reports %s fact references instead of silently dropping potential exposure', problem => {
    const input = specimen([{ location: '/sections/0/markdown', words: 121, factIds: [problem === 'unknown' ? 'missing-fact' : 'a-demo'] }]);
    const ledgerFacts = structuredClone(facts);
    if (problem === 'ambiguous') ledgerFacts[1].facts[1].id = 'a-demo';
    expect(measure(ledgerFacts, input.draft).findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'content.source_usage_review' })]));
  });
});
