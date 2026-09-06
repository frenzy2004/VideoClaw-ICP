import { createHash } from 'node:crypto';
import { normalizeHttpUrl, type DraftSafetyFinding, type DraftingContext, type GeneratedDraftV2, type SourceFact } from './content-bundle';
import { scoreSourceTopic, sourcePageIdentity } from './source-relevance';

export const MAX_SOURCE_DERIVED_WORDS = 180;
export const TARGET_SOURCE_DERIVED_WORDS = 120;

// Conservative budget identity, NOT a URL canonicalization claim: query variants
// share one allowance even when they might genuinely contain different material.
function sourceGroups(facts: SourceFact[]) {
  const groups = new Map<string, SourceFact[]>();
  for (const source of facts) {
    const normalized = normalizeHttpUrl(source.url);
    if (!normalized) throw new Error('Source planning requires a valid HTTP source URL.');
    const key = sourcePageIdentity(normalized);
    const entries = groups.get(key) ?? [];
    entries.push(source);
    groups.set(key, entries);
  }
  return [...groups.values()];
}

export function buildSourcePlan(context: DraftingContext) {
  const relevance = (fact: SourceFact['facts'][number]) => scoreSourceTopic(context.candidate.primaryKeyword, fact.text, fact.bodyStart);
  const anchors = (group: SourceFact[]) => {
    const seen = new Set<string>();
    return group.flatMap(source => source.facts)
      .filter(fact => fact.evidenceKind === 'body' && relevance(fact) > 0)
      .sort((a, b) => relevance(b) - relevance(a))
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
      targetDerivedWords: TARGET_SOURCE_DERIVED_WORDS,
      reserveDerivedWords: MAX_SOURCE_DERIVED_WORDS - TARGET_SOURCE_DERIVED_WORDS,
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

/** Nonblocking sensitivity diagnostic, independent of critic classification.
 * Grounding is mandatory even for original advice: these totals are potential
 * exposure under reclassification, NOT copying/derivation evidence or a gate.
 * Only invalid fact references produce findings. Claim coverage and semantic
 * copying checks remain the responsibility of the existing truth gates.
 */
export function measurePotentialSourceUse(facts: SourceFact[], draft: GeneratedDraftV2) {
  const findings: DraftSafetyFinding[] = [];
  const groups = sourceGroups(facts);
  const sources = groups.map(group => ({
    sourceIds: group.map(source => source.id), url: group[0].url,
    maxDerivedWords: MAX_SOURCE_DERIVED_WORDS, targetDerivedWords: TARGET_SOURCE_DERIVED_WORDS,
    potentialDerivedWords: 0, bindingIndices: [] as number[],
  }));
  const factPages = new Map<string, Set<number>>();
  groups.forEach((group, pageIndex) => group.forEach(source => source.facts.forEach(fact => {
    const pages = factPages.get(fact.id) ?? new Set<number>();
    pages.add(pageIndex);
    factPages.set(fact.id, pages);
  })));
  draft.claimBindings.forEach((binding, bindingIndex) => {
    const pages = new Set<number>();
    for (const id of new Set(binding.sourceFactIds)) {
      const matches = factPages.get(id);
      if (!matches || matches.size !== 1) {
        findings.push({ code: 'content.source_usage_review', bindingIndex, location: binding.location,
          message: 'Potential source accounting requires known, unambiguous fact IDs.' });
      }
      for (const page of matches ?? []) pages.add(page);
    }
    if (['/customerTrigger', '/competitorGap'].includes(binding.location)) return;
    const words = binding.span.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
    for (const pageIndex of pages) {
      sources[pageIndex].potentialDerivedWords += words;
      sources[pageIndex].bindingIndices.push(bindingIndex);
    }
  });
  const warnings = sources.filter(page => page.potentialDerivedWords > TARGET_SOURCE_DERIVED_WORDS).map(page => ({
    sourceIds: page.sourceIds,
    message: `${page.potentialDerivedWords} cited public words could be exposed to reclassification; the reviewed derivation target is ${TARGET_SOURCE_DERIVED_WORDS} and final limit ${MAX_SOURCE_DERIVED_WORDS}. Contextual grounding of longer original advice is not evidence of copying or derivation. This diagnostic alone must not block acceptance or force deletion.`,
  }));
  return { sources, findings, warnings };
}

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
