import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { DraftingContext, GeneratedDraftV2, SourceFact } from './content-bundle';
import { buildSourcePlan, measureReviewedSourceUse } from './source-plan';

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
  it('gives each verified source bounded relevant anchors without deleting original evidence', () => {
    const context = structuredClone(planningContext);
    context.sourceFacts[0].facts.push(...Array.from({ length: 20 }, (_, i) => ({ id: `a-extra-${i}`, text: `Product demo detail ${i}.`, evidenceKind: 'body' as const })));
    const before = structuredClone(context);
    const plan = buildSourcePlan(context);
    expect(plan.sources).toHaveLength(2);
    expect(plan.sources[0].anchorFactIds).toHaveLength(3);
    expect(plan.sources[1].anchorFactIds).toHaveLength(3);
    expect(plan.sources[0].anchorFactIds[0]).toBe('a-check');
    expect(plan.sources[1].anchorFactIds).toContain('b-snippet');
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
    expect(plan.sources[0].anchorFactIds).toHaveLength(3);
    expect(plan.sources[0].maxDerivedWords).toBe(180);
  });

  it('never spends an anchor slot on duplicate page text or facts with no query overlap', () => {
    const a = source('a');
    const alias = source('alias', 'https://example.com/a/?ref=track');
    alias.facts = a.facts.map(f => ({ ...f, id: `alias-${f.id}`, text: `  ${f.text.toUpperCase()}  ` }));
    const irrelevant = source('unrelated');
    irrelevant.facts = [{ id: 'unrelated', text: 'The conference offers refreshments.', evidenceKind: 'body' }];
    const plan = buildSourcePlan({ ...planningContext, sourceFacts: [a, alias, irrelevant] });
    expect(plan.sources[0].anchorFactIds).toEqual(['a-check', 'a-demo', 'a-snippet']);
    expect(plan.sources[1].anchorFactIds).toEqual([]);
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
