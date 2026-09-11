import { createHash } from 'node:crypto';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { DraftSafetyFinding, GeneratedDraftV2 } from './content-bundle';
import { MAX_SOURCE_DERIVED_WORDS, TARGET_SOURCE_DERIVED_WORDS, type buildSourceRepairPlan, measureReviewedSourceUse } from './source-plan';
import { sourcePageIdentity } from './source-relevance';

type Binding = GeneratedDraftV2['claimBindings'][number];
type SourceUsage = ReturnType<typeof measureReviewedSourceUse>;
type MarkdownNode = { type: string; value?: string; alt?: string; url?: string; children?: MarkdownNode[] };
const markdown = unified().use(remarkParse).use(remarkGfm);
const descriptionRepairCodes = new Set(['content.description_duplicate', 'content.description_length']);
const repairableLocation = /^\/(?:description|competitorGap|directAnswer|sections\/(?:0|[1-9]\d*)\/(?:heading|markdown)|faqAnswers\/(?:0|[1-9]\d*)\/answer|editorialGraphic\/(?:title|alt)|editorialGraphic\/steps\/(?:0|[1-9]\d*)\/(?:label|detail))$/u;

export type RepairPolicy = {
  readonly status: 'ready' | 'blocked';
  readonly findings: readonly DraftSafetyFinding[];
  readonly originalFingerprint: string;
  readonly allowedLocations: readonly string[];
  readonly descriptionMaxChars: number | null;
  readonly sources: readonly {
    readonly page: string; readonly sourceIds: readonly string[];
    readonly initialDerivedWords: number; readonly maxDerivedWords: number;
  }[];
};

// Deliberately identical to source-plan.ts's reviewed-binding tokenizer, which
// is not exported. Neither punctuation nor UTF-16 string length is a word count.
const wordTokens = (text: string): string[] => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
const wordCount = (text: string): number => wordTokens(text).length;
// Identity only, never support/entailment: punctuation, spacing, case and
// compatibility characters do not turn retained words into a new claim.
const wordIdentity = (text: string): string => wordTokens(text.normalize('NFKC').toLowerCase())
  .map(word => word.replaceAll('’', "'")).join(' ');

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
const fingerprint = (draft: GeneratedDraftV2) => createHash('sha256').update(stable(draft)).digest('hex');
const bindingHash = (binding: Binding) => createHash('sha256')
  .update(JSON.stringify([binding.location, binding.span, binding.sourceFactIds, binding.productClaimId])).digest('hex');
const finding = (code: string, message: string, location?: string): DraftSafetyFinding => ({ code, message, ...(location ? { location } : {}) });

function textLocations(draft: GeneratedDraftV2): Map<string, string> {
  const result = new Map<string, string>();
  function visit(value: unknown, path: string) {
    if (typeof value === 'string' && repairableLocation.test(path)) result.set(path, value);
    else if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) visit(entry, `${path}/${key}`);
    }
  }
  visit(draft, '');
  return result;
}

function rendered(text: string, location: string): { words: number; tokens: string[]; urls: Set<string> } {
  const urls = new Set<string>();
  // Only these fields are rendered as Markdown by the native bundle contract.
  if (location === '/directAnswer' || /^\/sections\/\d+\/(?:heading|markdown)$/u.test(location)) {
    function visit(node: MarkdownNode): string {
      if (node.url) urls.add(node.url);
      if (node.type === 'definition' || node.type === 'html') return '';
      if (node.type === 'image') return node.alt ?? '';
      if (node.value !== undefined) return node.value;
      const separator = ['root', 'paragraph', 'heading', 'blockquote', 'list', 'listItem', 'table', 'tableRow', 'tableCell'].includes(node.type) ? '\n' : '';
      return (node.children ?? []).map(visit).join(separator);
    }
    const tokens = wordTokens(visit(markdown.parse(text) as MarkdownNode));
    return { words: tokens.length, tokens, urls };
  }
  for (const match of text.matchAll(/https?:\/\/[^\s)<>'"]+/gu)) urls.add(match[0]);
  const tokens = wordTokens(text);
  return { words: tokens.length, tokens, urls };
}

function structuralIdentity(value: unknown, path: string): string {
  if (typeof value === 'string' && repairableLocation.test(path)) return stable(wordIdentity(rendered(value, path).tokens.join(' ')));
  if (value && typeof value === 'object') return stable(Object.fromEntries(Object.entries(value)
    .map(([key, entry]) => [key, structuralIdentity(entry, `${path}/${key}`)])));
  return stable(value);
}

/** Pure, serializable bounds for one original draft and its current source plan.
 * Only explicit machine locations/indices grant permission; critic prose does
 * not. This is a delta gate, never semantic new-claim or truth verification.
 * Pass ALL initial deterministic findings from inspectGeneratedDraft. A known
 * mismatch/missing binding invalidates the reviewed baseline even when every
 * supplied binding has a current review hash. Repair cannot reconstruct that
 * baseline: valid bindings and an independent initial review are prerequisites.
 */
export function buildRepairPolicy(original: GeneratedDraftV2, findings: DraftSafetyFinding[], sourcePlan: ReturnType<typeof buildSourceRepairPlan>): RepairPolicy {
  const invalidBaselineReasons = new Set(['span_mismatch', 'missing_binding', 'duplicate_binding', 'repeated_span']);
  const baselineFindings: DraftSafetyFinding[] = findings.filter(issue => issue.code === 'content.claim_binding'
    && invalidBaselineReasons.has(issue.reason ?? '')).map(issue => ({
    code: 'repair.invalid_baseline', reason: issue.reason, location: issue.location, bindingIndex: issue.bindingIndex,
    message: 'Initial binding coverage is invalid; bounded repair requires valid bindings and a current independent review before source ceilings can be used.',
  }));
  const locations = textLocations(original);
  const allowed = new Set<string>();
  let descriptionMaxChars: number | null = null;
  for (const issue of findings) {
    const binding = issue.bindingIndex === undefined ? undefined : original.claimBindings[issue.bindingIndex];
    if (issue.bindingIndex !== undefined && (!Number.isInteger(issue.bindingIndex) || !binding
      || (issue.location !== undefined && issue.location !== binding.location))) continue;
    const location = issue.location ?? binding?.location;
    if (!location || !locations.has(location)) continue;
    allowed.add(location);
    if (location === '/description' && descriptionRepairCodes.has(issue.code)) descriptionMaxChars = 200;
  }
  const reviewed = new Map(sourcePlan.reviewBindings.map(entry => [entry.bindingIndex, entry.bindingHash]));
  const ready = baselineFindings.length === 0 && sourcePlan.status === 'ready'
    && reviewed.size === sourcePlan.reviewBindings.length && reviewed.size === original.claimBindings.length
    && original.claimBindings.every((binding, index) => reviewed.get(index) === bindingHash(binding));
  if (ready) {
    for (const source of sourcePlan.sources) {
      if (source.derivedWords <= TARGET_SOURCE_DERIVED_WORDS) continue;
      // Use every contributing binding, not just the last budget finding or
      // the region that the advisory allocation happened to select for cutting.
      for (const index of source.bindingIndices) {
        const location = original.claimBindings[index]?.location;
        if (location && locations.has(location)) allowed.add(location);
      }
    }
  }
  return {
    status: ready ? 'ready' : 'blocked', findings: baselineFindings, originalFingerprint: fingerprint(original),
    allowedLocations: ready ? [...allowed].sort() : [], descriptionMaxChars: ready ? descriptionMaxChars : null,
    sources: sourcePlan.sources.map(source => ({
      page: sourcePageIdentity(source.url), sourceIds: [...source.sourceIds],
      initialDerivedWords: source.derivedWords, maxDerivedWords: Math.min(source.derivedWords, TARGET_SOURCE_DERIVED_WORDS),
    })),
  };
}

function bindingSet(bindings: Binding[]): string {
  return stable(bindings.map(binding => stable({ ...binding, sourceFactIds: [...binding.sourceFactIds].sort() })).sort());
}

function factWords(bindings: Binding[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const binding of bindings) {
    for (const id of new Set(binding.sourceFactIds)) result.set(id, (result.get(id) ?? 0) + wordCount(binding.span));
  }
  return result;
}

// Count every rendered occurrence, including repeated spans represented by one
// binding. Token coverage is only an accounting guard; the native exact-sentence
// coverage and semantic review still decide whether each binding is valid.
function boundCoverage(tokens: string[], bindings: Binding[]) {
  const covered = new Set<number>();
  const byFact = new Map<string, Set<number>>();
  for (const binding of bindings) {
    const span = wordTokens(binding.span);
    if (!span.length) continue;
    for (let start = 0; start <= tokens.length - span.length; start++) {
      if (!span.every((token, offset) => token === tokens[start + offset])) continue;
      for (let offset = 0; offset < span.length; offset++) {
        covered.add(start + offset);
        for (const id of binding.sourceFactIds) {
          const positions = byFact.get(id) ?? new Set<number>();
          positions.add(start + offset);
          byFact.set(id, positions);
        }
      }
    }
  }
  const counts = factWords(bindings);
  for (const [id, positions] of byFact) counts.set(id, Math.max(counts.get(id) ?? 0, positions.size));
  return { covered, counts };
}

export type RepairLocationLimit = {
  maxRenderedWords: number;
  maxCharacters: number | null;
  maxBoundWordsByFact: Record<string, number>;
  allowedCitationUrls: string[];
};

/** Request guidance from the delta gate's exact original accounting. A non-null
 * description maxCharacters replaces both word ceilings; those counts then only
 * describe the baseline. This does not replace independent review or any gate.
 */
export function getRepairLocationLimits(original: GeneratedDraftV2, policy: RepairPolicy): Record<string, RepairLocationLimit> {
  if (inspectRepairDelta(original, original, policy).length) {
    throw new Error('Repair limits require a valid baseline and its current repair policy.');
  }
  const locations = textLocations(original);
  return Object.fromEntries(policy.allowedLocations.map(location => {
    const text = rendered(locations.get(location) ?? '', location);
    const bindings = original.claimBindings.filter(binding => binding.location === location);
    return [location, {
      maxRenderedWords: text.words,
      maxCharacters: location === '/description' ? policy.descriptionMaxChars : null,
      maxBoundWordsByFact: Object.fromEntries(boundCoverage(text.tokens, bindings).counts),
      allowedCitationUrls: [...text.urls],
    }];
  }));
}

/** Call on schema-validated drafts, before independent review. Keep the normal
 * schema, full binding coverage, citation, product and semantic review gates.
 * Allowed edits may paraphrase; lexical bounds cannot prove their truth.
 */
export function inspectRepairDelta(original: GeneratedDraftV2, repaired: GeneratedDraftV2, policy: RepairPolicy): DraftSafetyFinding[] {
  if (policy.status !== 'ready' || policy.originalFingerprint !== fingerprint(original)) {
    return [...policy.findings, finding('repair.policy_invalid', 'Repair requires a policy for this exact original draft and valid binding coverage with a complete current source review.')];
  }
  const findings: DraftSafetyFinding[] = [];
  const allowed = new Set(policy.allowedLocations);
  const originalLocations = textLocations(original);
  const repairedLocations = textLocations(repaired);
  // Compare the entire object by positional paths, except the separately checked
  // binding set. No permission can add fields, reorder structural identities,
  // or change array sizes, FAQ questions, customerTrigger or sourceReferences.
  function compare(before: unknown, after: unknown, path: string) {
    if (path === '/claimBindings' || before === after) return;
    if (typeof before === 'string' && typeof after === 'string' && allowed.has(path)) {
      const originalText = rendered(before, path);
      const repairedText = rendered(after, path);
      const descriptionException = path === '/description' && policy.descriptionMaxChars !== null;
      if (descriptionException ? after.length > policy.descriptionMaxChars! : repairedText.words > originalText.words) {
        findings.push(finding('repair.location_growth', descriptionException
          ? `Description formatting repair exceeds ${policy.descriptionMaxChars} characters.`
          : `Repair expands this location from ${originalText.words} to ${repairedText.words} words.`, path));
      }
      if ([...repairedText.urls].some(url => !originalText.urls.has(url))) {
        findings.push(finding('repair.citation_changed', 'Repair introduces a citation destination unavailable at this original location.', path));
      }
      return;
    }
    if (before && after && typeof before === 'object' && typeof after === 'object'
      && Array.isArray(before) === Array.isArray(after)) {
      if (stable(Object.keys(before).sort()) !== stable(Object.keys(after).sort())) {
        findings.push(finding('repair.structure_changed', 'Repair changes the original field or array shape.', path));
        return;
      }
      if (Array.isArray(before) && Array.isArray(after)) {
        const identities = before.map((entry, index) => structuralIdentity(entry, `${path}/${index}`));
        if (after.some((entry, index) => {
          const identity = structuralIdentity(entry, `${path}/${index}`);
          return identity !== identities[index] && identities.includes(identity);
        })) {
          findings.push(finding('repair.structure_changed', 'Repair moves an existing structural entry to a different index.', path));
        }
      }
      for (const key of Object.keys(before)) compare((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key], `${path}/${key}`);
      return;
    }
    findings.push(finding('repair.out_of_scope', 'Repair changes a location outside the explicit repair scope.', path));
  }
  compare(original, repaired, '');

  const locations = new Set([...original.claimBindings, ...repaired.claimBindings].map(binding => binding.location));
  for (const location of locations) {
    const before = original.claimBindings.filter(binding => binding.location === location);
    const after = repaired.claimBindings.filter(binding => binding.location === location);
    if (!allowed.has(location)) {
      if (bindingSet(before) !== bindingSet(after)) findings.push(finding('repair.immutable_bindings', 'Bindings at this immutable location must remain the same order-independent set.', location));
      continue;
    }
    const available = new Set(before.flatMap(binding => binding.sourceFactIds));
    const products = new Set(before.map(binding => binding.productClaimId));
    for (const binding of after) {
      const unchanged = before.filter(entry => wordIdentity(entry.span) === wordIdentity(binding.span));
      // Retained words retain the exact fact set and product attribution. A
      // punctuation/case edit cannot remove a source from its accounting.
      if (unchanged.length && !unchanged.every(entry => entry.productClaimId === binding.productClaimId
        && stable([...new Set(entry.sourceFactIds)].sort()) === stable([...new Set(binding.sourceFactIds)].sort()))) {
        findings.push({ ...finding('repair.evidence_changed', 'Unchanged visible words must retain their exact original fact set and product claim ID.', location), sourceFactIds: [...binding.sourceFactIds] });
      }
      const matchingFacts = unchanged.length ? new Set(unchanged.flatMap(entry => entry.sourceFactIds)) : available;
      if (binding.sourceFactIds.some(id => !matchingFacts.has(id))
        || (binding.productClaimId !== null && !products.has(binding.productClaimId))) {
        findings.push({ ...finding('repair.evidence_expansion', 'Repair adds or transfers fact/product evidence unavailable to this original claim or location.', location), sourceFactIds: [...binding.sourceFactIds] });
      }
    }
    const originalText = rendered(originalLocations.get(location) ?? '', location);
    const repairedText = rendered(repairedLocations.get(location) ?? '', location);
    if (wordIdentity(originalText.tokens.join(' ')) === wordIdentity(repairedText.tokens.join(' '))) {
      const normalizedBindings = (bindings: Binding[]) => bindingSet(bindings.map(binding => ({
        ...binding, span: wordIdentity(binding.span), sourceFactIds: [...new Set(binding.sourceFactIds)],
      })));
      if (normalizedBindings(before) !== normalizedBindings(after)) findings.push(finding('repair.evidence_changed',
        'Unchanged location words must retain the complete normalized binding set; partitioning cannot remove source or product attribution.', location));
    }
    const originalCoverage = boundCoverage(originalText.tokens, before);
    const repairedCoverage = boundCoverage(repairedText.tokens, after);
    if (before.length && repairedCoverage.covered.size < repairedText.words) {
      findings.push(finding('repair.binding_coverage', 'Repair leaves rendered words unaccounted for by bindings at this targeted location.', location));
    }
    // Aggregate before comparing: splitting a binding cannot multiply a fact's
    // allowance. This is grounding exposure, not a derivation classification.
    // Description formatting has its explicit exception; reviewed source growth
    // must still be checked after independent classification of the final text.
    if (location === '/description' && policy.descriptionMaxChars !== null) continue;
    for (const [id, count] of repairedCoverage.counts) {
      if (available.has(id) && count > (originalCoverage.counts.get(id) ?? 0)) {
        findings.push({ ...finding('repair.evidence_growth', 'Repair expands the words bound to an existing fact at this location.', location), sourceFactIds: [id] });
      }
    }
  }
  return findings;
}

type RepairDerivationContext = {
  facts: Parameters<typeof measureReviewedSourceUse>[0];
  original: GeneratedDraftV2;
  repaired: GeneratedDraftV2;
  initialReview: Parameters<typeof measureReviewedSourceUse>[2];
  finalReview: Parameters<typeof measureReviewedSourceUse>[2];
};

/** Reclassification is still charged to the final source total, but identical
 * retained fields did not add those words during repair. Never grant this
 * comparison adjustment to edited prose, changed citations, stale ledgers or
 * changed section/FAQ/graphic framing. This does not alter either verdict.
 */
function retainedReclassification(
  originalUsage: SourceUsage, repairedUsage: SourceUsage, policy: RepairPolicy,
  proof: RepairDerivationContext,
): Map<string, number> {
  const result = new Map<string, number>();
  if (policy.status !== 'ready' || policy.originalFingerprint !== fingerprint(proof.original)
    || inspectRepairDelta(proof.original, proof.repaired, policy).length) return result;
  const before = measureReviewedSourceUse(proof.facts, proof.original, proof.initialReview);
  const after = measureReviewedSourceUse(proof.facts, proof.repaired, proof.finalReview);
  if (stable(before) !== stable(originalUsage) || stable(after) !== stable(repairedUsage)
    || [...before.findings, ...after.findings].some(issue => issue.code !== 'content.source_budget')) return result;
  const originalLocations = textLocations(proof.original), repairedLocations = textLocations(proof.repaired);
  const framing = (draft: GeneratedDraftV2, location: string) => {
    const section = /^\/sections\/(\d+)\//u.exec(location);
    if (section) return draft.sections[Number(section[1])]?.heading;
    const faq = /^\/faqAnswers\/(\d+)\//u.exec(location);
    if (faq) return draft.faqAnswers[Number(faq[1])]?.question;
    const step = /^\/editorialGraphic\/steps\/(\d+)\//u.exec(location);
    if (step) return stable([draft.editorialGraphic.title, draft.editorialGraphic.steps[Number(step[1])]?.label]);
    return location.startsWith('/editorialGraphic/') ? draft.editorialGraphic.title : '';
  };
  const initialByHash = new Map(proof.initialReview.map(entry => [entry.bindingHash, entry]));
  const reclassified = new Set<number>();
  for (const entry of proof.finalReview) {
    const previous = initialByHash.get(entry.bindingHash);
    if (!previous?.supported || !entry.supported
      || !['original_guidance', 'original_example'].includes(previous.kind)
      || !['source_claim', 'product_claim'].includes(entry.kind)) continue;
    const binding = proof.repaired.claimBindings[entry.bindingIndex], location = binding.location;
    const oldBindings = proof.original.claimBindings.filter(b => b.location === location);
    const newBindings = proof.repaired.claimBindings.filter(b => b.location === location);
    if (!originalLocations.has(location) || originalLocations.get(location) !== repairedLocations.get(location)
      || framing(proof.original, location) !== framing(proof.repaired, location)
      || stable(oldBindings.map(bindingHash).sort()) !== stable(newBindings.map(bindingHash).sort())) continue;
    reclassified.add(entry.bindingIndex);
  }
  for (const source of after.sources) {
    const count = source.bindingIndices.filter(index => reclassified.has(index))
      .reduce((sum, index) => sum + wordCount(proof.repaired.claimBindings[index].span), 0);
    if (count) result.set(sourcePageIdentity(source.url), count);
  }
  return result;
}

/** Post-review gate: independently supported claims still may not expand source
 * use. Always pass the INITIAL reviewed usage, not the previous repair's totals.
 * A captured policy also prevents a later ledger from increasing that ceiling.
 * Grounded original guidance is not derivation or extra derived-word allowance;
 * independent semantic review must still reject disguised source paraphrases.
 */
export function inspectRepairSourceGrowth(originalUsage: SourceUsage, repairedUsage: SourceUsage, policy?: RepairPolicy, proof?: RepairDerivationContext): DraftSafetyFinding[] {
  const findings = [...originalUsage.findings.filter(entry => entry.code !== 'content.source_budget'), ...repairedUsage.findings];
  if (policy && policy.status !== 'ready') findings.push(...policy.findings, finding('repair.policy_invalid', 'Source growth requires a usable original repair policy.'));
  function pages(usage: SourceUsage) {
    const result = new Map<string, { derivedWords: number; groundedWords: number }>();
    for (const source of usage.sources) {
      if (![source.derivedWords, source.groundedWords].every(value => Number.isSafeInteger(value) && value >= 0)
        || source.derivedWords > source.groundedWords) {
        findings.push(finding('repair.source_usage_invalid', 'Source usage requires finite nonnegative word counts with derivation no greater than grounding.'));
        continue;
      }
      try {
        const page = sourcePageIdentity(source.url);
        const total = result.get(page) ?? { derivedWords: 0, groundedWords: 0 };
        result.set(page, { derivedWords: total.derivedWords + source.derivedWords, groundedWords: total.groundedWords + source.groundedWords });
      } catch {
        findings.push(finding('repair.source_usage_invalid', 'Source usage has an invalid page identity.'));
      }
    }
    return result;
  }
  const initial = pages(originalUsage);
  const repaired = pages(repairedUsage);
  const reclassified = policy && proof ? retainedReclassification(originalUsage, repairedUsage, policy, proof) : new Map<string, number>();
  for (const [page, usage] of repaired) {
    const captured = policy?.sources.find(source => source.page === page);
    const ceiling = Math.min(initial.get(page)?.derivedWords ?? 0, TARGET_SOURCE_DERIVED_WORDS,
      policy ? captured?.maxDerivedWords ?? 0 : TARGET_SOURCE_DERIVED_WORDS);
    const retained = reclassified.get(page) ?? 0;
    if (usage.derivedWords > TARGET_SOURCE_DERIVED_WORDS || usage.derivedWords - retained > ceiling || (!initial.has(page) && usage.groundedWords > 0)) {
      findings.push(finding('repair.source_growth', `${page} has ${usage.derivedWords} reviewed source-derived words; repair ceiling ${ceiling} (initial usage capped at ${TARGET_SOURCE_DERIVED_WORDS}).${retained ? ` ${retained} words were reclassified in unchanged fields, not newly written; the final total still cannot exceed ${TARGET_SOURCE_DERIVED_WORDS}.` : ''}`));
    }
    if (usage.derivedWords > MAX_SOURCE_DERIVED_WORDS && !repairedUsage.findings.some(entry => entry.code === 'content.source_budget')) {
      findings.push(finding('content.source_budget', `${page} exceeds the existing ${MAX_SOURCE_DERIVED_WORDS}-word hard source limit.`));
    }
  }
  return findings;
}
