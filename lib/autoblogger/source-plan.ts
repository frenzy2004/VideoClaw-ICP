import { createHash } from 'node:crypto';
import { normalizeHttpUrl, type DraftSafetyFinding, type DraftingContext, type GeneratedDraftV2, type SourceFact } from './content-bundle';

export const MAX_SOURCE_DERIVED_WORDS = 180;

// Conservative budget identity, NOT a URL canonicalization claim: query variants
// share one allowance even when they might genuinely contain different material.
function sourceGroups(facts: SourceFact[]) {
  const groups = new Map<string, SourceFact[]>();
  for (const source of facts) {
    const normalized = normalizeHttpUrl(source.url);
    if (!normalized) throw new Error('Source planning requires a valid HTTP source URL.');
    const url = new URL(normalized);
    const key = `${url.hostname.replace(/^www\./, '')}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/+$/, '')}`;
    const entries = groups.get(key) ?? [];
    entries.push(source);
    groups.set(key, entries);
  }
  return [...groups.values()];
}

export function buildSourcePlan(context: DraftingContext) {
  const stopwords = new Set('a an the of in for with and or on at is are what when before after your you from this that should do can how to'.split(' '));
  const terms = new Set((context.candidate.primaryKeyword.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(term => !stopwords.has(term)));
  const relevance = (text: string) => [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].filter(term => terms.has(term)).length;
  const anchors = (group: SourceFact[]) => {
    const seen = new Set<string>();
    return group.flatMap(source => source.facts)
      .filter(fact => relevance(fact.text) > 0)
      .sort((a, b) => Number(b.evidenceKind === 'body') - Number(a.evidenceKind === 'body') || relevance(b.text) - relevance(a.text))
      .filter(fact => {
        const key = fact.text.normalize('NFKC').toLowerCase().trim().replace(/\s+/gu, ' ');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 3).map(fact => fact.id);
  };
  return {
    readerTask: context.candidate.primaryKeyword,
    audience: context.candidate.icp,
    sources: sourceGroups(context.sourceFacts).map(group => ({
      sourceIds: group.map(source => source.id),
      url: group[0].url,
      maxDerivedWords: MAX_SOURCE_DERIVED_WORDS,
      // Anchor suggestions do not delete facts or certify relevance/support.
      anchorFactIds: anchors(group),
    })),
    originalWork: [
      { role: 'decision_tool', instruction: 'Build a useful original decision worksheet for the reader task; do not mirror a source outline or present your recommendations as sourced requirements.' },
      { role: 'hypothetical_example', instruction: 'Show one explicitly hypothetical application of that worksheet, without invented product capabilities, real-world results or customer endorsements.' },
      { role: 'troubleshooting', instruction: 'Offer task-relevant checks and fallback choices as your recommendations; do not introduce recording or other work the evidence and reader task do not call for.' },
    ],
  };
}

type SupportEvaluation = {
  bindingIndex: number; bindingHash: string; supported: boolean;
  kind: 'source_claim' | 'original_guidance' | 'original_example' | 'product_claim';
};

export function measureReviewedSourceUse(facts: SourceFact[], draft: GeneratedDraftV2, evaluations: SupportEvaluation[]) {
  const findings: DraftSafetyFinding[] = [];
  const sources = sourceGroups(facts).map(group => ({
    sourceIds: group.map(source => source.id), url: group[0].url,
    maxDerivedWords: MAX_SOURCE_DERIVED_WORDS, derivedWords: 0, groundedWords: 0, bindingIndices: [] as number[],
  }));
  const factPages = new Map(facts.flatMap(source => source.facts.map(fact => [fact.id, sources.findIndex(page => page.sourceIds.includes(source.id))] as const)));
  const current = new Map<number, SupportEvaluation>();
  for (const evaluation of evaluations) {
    const binding = draft.claimBindings[evaluation.bindingIndex];
    const hash = binding && createHash('sha256').update(JSON.stringify([binding.location, binding.span, binding.sourceFactIds, binding.productClaimId])).digest('hex');
    if (!binding || current.has(evaluation.bindingIndex) || hash !== evaluation.bindingHash) {
      findings.push({ code: 'content.source_usage_review', message: 'Cumulative source accounting requires a unique current review for every binding.' });
    }
    current.set(evaluation.bindingIndex, evaluation);
  }
  if (draft.claimBindings.some((_, i) => !current.has(i))) {
    findings.push({ code: 'content.source_usage_review', message: 'Source accounting cannot exempt prose with missing review classifications.' });
  }
  if (findings.length) return { sources, findings };

  draft.claimBindings.forEach((binding, index) => {
    // Only these two contract fields are private. All other bound prose is public,
    // including headings, metadata, FAQ answers and editorial graphic text.
    if (['/customerTrigger', '/competitorGap'].includes(binding.location)) return;
    const words = binding.span.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
    const evaluation = current.get(index)!;
    for (const pageIndex of new Set(binding.sourceFactIds.map(id => factPages.get(id)))) {
      if (pageIndex === undefined) {
        findings.push({ code: 'content.source_usage_review', message: 'Source accounting encountered an unknown fact ID.', bindingIndex: index });
        continue;
      }
      const page = sources[pageIndex];
      page.groundedWords += words;
      // Contextual grounding is not automatically derivation. Classification is
      // an independent model judgment, not proof: semantic copying review still
      // applies, including when it detects disguised "original" paraphrases.
      if (evaluation.kind === 'original_guidance' || evaluation.kind === 'original_example') continue;
      page.derivedWords += words;
      page.bindingIndices.push(index);
    }
  });
  for (const page of sources) {
    if (page.derivedWords <= MAX_SOURCE_DERIVED_WORDS) continue;
    const bindingIndex = page.bindingIndices.at(-1)!;
    const binding = draft.claimBindings[bindingIndex];
    findings.push({
      code: 'content.source_budget', bindingIndex, location: binding.location, span: binding.span, sourceFactIds: binding.sourceFactIds,
      message: `${page.sourceIds.join(', ')} accounts for ${page.derivedWords} reviewed source-derived public words; limit ${MAX_SOURCE_DERIVED_WORDS}.`,
      repairInstruction: 'Restructure the whole article using each entry in sourceUsage.sources and its bindingIndices, including FAQs, description and graphic text. Delete redundant source-derived coverage; replace only with genuinely original task-relevant decisions/examples, not relabelled paraphrases. Supported paragraphs may need removal. Rebuild all affected bindings and keep every source below its cumulative limit.',
    });
  }
  return { sources, findings };
}
