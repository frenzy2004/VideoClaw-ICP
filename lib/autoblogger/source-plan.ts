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
    articleTitle: context.candidate.title,
    audience: context.candidate.icp,
    sources: sourceGroups(context.sourceFacts).map(group => ({
      sourceIds: group.map(source => source.id),
      url: group[0].url,
      maxDerivedWords: MAX_SOURCE_DERIVED_WORDS,
      targetDerivedWords: TARGET_SOURCE_DERIVED_WORDS,
      reserveDerivedWords: MAX_SOURCE_DERIVED_WORDS - TARGET_SOURCE_DERIVED_WORDS,
      regions: Object.entries(REPAIR_REGION_WORDS).map(([region, targetDerivedWords]) => ({ region, targetDerivedWords })),
      // Anchor suggestions do not delete facts or certify relevance/support.
      anchorFactIds: anchors(group),
    })),
    originalWork: [
      { role: 'decision_tool', instruction: 'Build a useful original decision worksheet for the reader task; do not mirror a source outline or present your recommendations as sourced requirements.' },
      { role: 'hypothetical_example', instruction: 'Show one explicitly hypothetical application of that worksheet, without invented product capabilities, real-world results or customer endorsements.' },
      { role: 'troubleshooting', instruction: 'Offer checks and fallback choices relevant to the keyword AND every task promised by articleTitle, grounded in the supplied facts. Do not introduce unrelated work merely because the publisher sells video software.' },
    ],
  };
}

type SupportEvaluation = {
  bindingIndex: number; bindingHash: string; supported: boolean;
  kind: 'source_claim' | 'original_guidance' | 'original_example' | 'product_claim';
};

// One allowance per page, not per occurrence. Unused shares can move to other
// regions in this priority order; direct answers and body coverage come first.
const REPAIR_REGION_WORDS = { directAnswer: 20, body: 60, headings: 5, faq: 20, description: 5, graphic: 10, other: 0 };
type RepairRegion = keyof typeof REPAIR_REGION_WORDS;
type RepairLocation = {
  location: string; region: RepairRegion;
  derivedWords: number; targetDerivedWords: number; removeDerivedWords: number;
  bindings: Array<{ bindingIndex: number; bindingHash: string; derivedWords: number }>;
};

function repairRegion(location: string): RepairRegion {
  if (location === '/directAnswer') return 'directAnswer';
  if (/^\/sections\/\d+\/markdown$/.test(location)) return 'body';
  if (location === '/title' || /^\/sections\/\d+\/heading$/.test(location)) return 'headings';
  if (location.startsWith('/faqAnswers/')) return 'faq';
  if (location === '/description') return 'description';
  if (location.startsWith('/editorialGraphic/')) return 'graphic';
  return 'other'; // Unknown public fields still spend the same page allowance.
}

/** Read-only advice for exactly this reviewed draft; "ready" means usable
 * accounting, never draft approval. No text, citations or classifications are
 * changed. Reuse candidates/anchors do not establish claim or quote support;
 * every edited binding needs independent review and the unchanged final gates.
 * Rejected exemptions remain disputed, not derived. An unsafe page's allocations
 * are incomplete until those bindings are repaired and independently reviewed.
 */
export function buildSourceRepairPlan(context: DraftingContext, draft: GeneratedDraftV2, evaluations: SupportEvaluation[]) {
  const usage = measureReviewedSourceUse(context.sourceFacts, draft, evaluations);
  // Use only reference-integrity findings from the potential diagnostic, never
  // its exposure totals: contextual grounding must not become derivation.
  const reviewFindings = [...usage.findings, ...measurePotentialSourceUse(context.sourceFacts, draft).findings];
  for (const evaluation of evaluations) {
    const binding = draft.claimBindings[evaluation.bindingIndex];
    if (evaluation.supported === false) {
      reviewFindings.push({ code: 'critique.support_rejected', bindingIndex: evaluation.bindingIndex,
        message: `Binding ${evaluation.bindingIndex} remains unsupported; usable source accounting does not approve this claim or waive independent support review.` });
    }
    if (typeof evaluation.supported !== 'boolean'
      || !['source_claim', 'original_guidance', 'original_example', 'product_claim'].includes(evaluation.kind)
      || (binding && (binding.productClaimId !== null) !== (evaluation.kind === 'product_claim'))) {
      reviewFindings.push({ code: 'content.source_usage_review', bindingIndex: evaluation.bindingIndex,
        message: 'Source repair planning requires valid, current classifications.' });
    }
  }
  // Keep raw source/model prose out of the plan, including budget findings.
  const findings = reviewFindings.map(({ code, message, bindingIndex, location }) => ({ code, message, bindingIndex, location }));
  if (findings.some(finding => finding.code === 'content.source_usage_review')) {
    return { status: 'blocked' as const, findings, reviewBindings: [], unsupportedBindingIndices: [], sources: [], reuseCandidates: [] };
  }
  const reviewBindings = evaluations.map(({ bindingIndex, bindingHash }) => ({ bindingIndex, bindingHash }))
    .sort((a, b) => a.bindingIndex - b.bindingIndex);
  const unsupportedBindingIndices = evaluations.filter(evaluation => !evaluation.supported)
    .map(evaluation => evaluation.bindingIndex).sort((a, b) => a - b);
  const current = new Map(evaluations.map(evaluation => [evaluation.bindingIndex, evaluation]));
  const sources = usage.sources.map(page => {
    const factIds = new Set(context.sourceFacts.filter(source => page.sourceIds.includes(source.id)).flatMap(source => source.facts.map(fact => fact.id)));
    const disputedLocations = unsupportedBindingIndices.filter(index => {
      const binding = draft.claimBindings[index];
      return ['original_guidance', 'original_example'].includes(current.get(index)!.kind)
        && !['/customerTrigger', '/competitorGap'].includes(binding.location)
        && binding.sourceFactIds.some(id => factIds.has(id));
    }).map(index => ({ ...reviewBindings[index], location: draft.claimBindings[index].location,
      words: draft.claimBindings[index].span.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0 }));
    const disputedWords = disputedLocations.reduce((sum, location) => sum + location.words, 0);
    const byLocation = new Map<string, RepairLocation>();
    for (const bindingIndex of page.bindingIndices) {
      const binding = draft.claimBindings[bindingIndex];
      const words = binding.span.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
      const contribution = byLocation.get(binding.location) ?? {
        location: binding.location, region: repairRegion(binding.location),
        derivedWords: 0, targetDerivedWords: 0, removeDerivedWords: 0, bindings: [],
      } as RepairLocation;
      contribution.derivedWords += words;
      contribution.targetDerivedWords += words;
      contribution.bindings.push({ ...reviewBindings[bindingIndex], derivedWords: words });
      byLocation.set(binding.location, contribution);
    }
    const locations = [...byLocation.values()];
    const regions = (Object.keys(REPAIR_REGION_WORDS) as RepairRegion[]).map(region => {
      const derivedWords = locations.filter(location => location.region === region).reduce((sum, location) => sum + location.derivedWords, 0);
      return { region, derivedWords, targetDerivedWords: Math.min(derivedWords, REPAIR_REGION_WORDS[region]), removeDerivedWords: 0 };
    });
    let remaining = TARGET_SOURCE_DERIVED_WORDS - regions.reduce((sum, region) => sum + region.targetDerivedWords, 0);
    // First cover existing demand from unused shares, then restore any unused
    // regional allowance. Targets total 120 even on empty/under-budget pages.
    for (const demand of ['current', 'reserve']) {
      for (const region of regions) {
        const desired = demand === 'current' ? region.derivedWords : REPAIR_REGION_WORDS[region.region];
        const extra = Math.min(remaining, Math.max(0, desired - region.targetDerivedWords));
        region.targetDerivedWords += extra;
        remaining -= extra;
      }
    }
    for (const region of regions) {
      region.removeDerivedWords = Math.max(0, region.derivedWords - region.targetDerivedWords);
      let remove = region.removeDerivedWords;
      // Prioritize the largest concentration; equal totals use binding order.
      const concentrated = locations.filter(location => location.region === region.region)
        .sort((a, b) => b.derivedWords - a.derivedWords || a.bindings[0].bindingIndex - b.bindings[0].bindingIndex);
      for (const location of concentrated) {
        location.removeDerivedWords = Math.min(remove, location.derivedWords);
        location.targetDerivedWords -= location.removeDerivedWords;
        remove -= location.removeDerivedWords;
      }
    }
    return { ...page, targetDerivedWords: TARGET_SOURCE_DERIVED_WORDS, disputedWords, disputedLocations,
      unsafe: disputedLocations.length > 0,
      availableDerivedWords: Math.max(0, TARGET_SOURCE_DERIVED_WORDS - page.derivedWords - disputedWords),
      removeDerivedWords: Math.max(0, page.derivedWords - TARGET_SOURCE_DERIVED_WORDS), regions, locations };
  });
  const anchors = buildSourcePlan(context).sources;
  const reuseCandidates = sources.map((page, index) => ({
    sourceIds: page.sourceIds, url: page.url, derivedWords: page.derivedWords,
    availableDerivedWords: page.availableDerivedWords,
    anchorFactIds: page.unsafe ? [] : anchors[index].anchorFactIds,
  })).filter(page => page.availableDerivedWords > 0 && page.anchorFactIds.length > 0)
    .sort((a, b) => a.derivedWords - b.derivedWords || sourcePageIdentity(a.url).localeCompare(sourcePageIdentity(b.url)));
  return { status: 'ready' as const, findings, reviewBindings, unsupportedBindingIndices, sources, reuseCandidates };
}

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
      message: `${page.sourceIds.join(', ')} accounts for ${page.derivedWords} reviewed source-derived public words; limit ${MAX_SOURCE_DERIVED_WORDS}. Remove at least ${page.derivedWords - TARGET_SOURCE_DERIVED_WORDS} derived words to reach the ${TARGET_SOURCE_DERIVED_WORDS}-word planning target before independent re-review.`,
      repairInstruction: 'Restructure the whole article using each entry in sourceUsage.sources and its bindingIndices, including FAQs, description and graphic text. Delete redundant source-derived coverage; replace only with genuinely original task-relevant decisions/examples, not relabelled paraphrases. Supported paragraphs may need removal. Rebuild all affected bindings and keep every source below its cumulative limit.',
    });
  }
  return { sources, findings };
}

/** Planning warnings must remain per-page: one page above the final ceiling
 * cannot hide another page's exhausted review reserve. Invalid ledgers are not
 * usable accounting, and genuine original guidance remains excluded above.
 */
export function sourceAllocationFindings(usage: ReturnType<typeof measureReviewedSourceUse>): DraftSafetyFinding[] {
  if (usage.findings.some(finding => finding.code === 'content.source_usage_review')) return [];
  return usage.sources
    .filter(source => source.derivedWords > TARGET_SOURCE_DERIVED_WORDS && source.derivedWords <= MAX_SOURCE_DERIVED_WORDS)
    .map(source => ({
      code: 'content.source_allocation',
      message: `Reviewed derivation from ${source.sourceIds.join(', ')} is ${source.derivedWords} words, above the ${TARGET_SOURCE_DERIVED_WORDS}-word planning target. Remove at least ${source.derivedWords - TARGET_SOURCE_DERIVED_WORDS} derived words to restore the review reserve before the final ${MAX_SOURCE_DERIVED_WORDS}-word limit.`,
      repairInstruction: 'Restructure source-derived passages across the article, retaining necessary facts and genuinely original reader tools. Do not disguise paraphrases as original guidance or change citations to evade source accounting.',
    }));
}
