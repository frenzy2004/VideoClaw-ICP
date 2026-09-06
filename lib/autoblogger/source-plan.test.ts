import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { DraftingContext, GeneratedDraftV2, SourceFact } from './content-bundle';
import { buildSourcePlan, measureReviewedSourceUse, measurePotentialSourceUse as measure } from './source-plan';
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
const planningContext = { candidate: { primaryKeyword: 'product demo checklist', icp: 'Founder preparing a buyer demonstration', intent: 'informational' }, sourceFacts: facts } as DraftingContext;
function specimen(spans: Array<{ location: string; words: number; factIds?: string[] }>) {
  const draft = { claimBindings: spans.map(({ location, words, factIds }) => ({
    location, span: Array.from({ length: words }, (_, i) => `word${i}`).join(' '), sourceFactIds: factIds ?? ['a-demo'], productClaimId: null,
  })) } as GeneratedDraftV2;
  const evaluations = draft.claimBindings.map((b, bindingIndex) => ({
    bindingIndex, bindingHash: createHash('sha256').update(JSON.stringify([b.location, b.span, b.sourceFactIds, b.productClaimId])).digest('hex'),
    supported: true, kind: 'source_claim' as const, rationale: 'Source-derived statement.',
  }));
  return { draft, evaluations };
}

describe('source planning and cumulative reviewed usage', () => {
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
