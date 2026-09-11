import { z } from 'zod';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { GeneratedDraftV2Schema, type DraftSafetyFinding, type GeneratedDraftV2 } from './content-bundle';
import type { JsonSchema } from './openai-responses';
import { getRepairLocationLimits, inspectRepairDelta, type RepairPolicy } from './repair-policy';
import { containsSecretLikeValue } from './secrets';

type LocalBinding = Omit<GeneratedDraftV2['claimBindings'][number], 'location'>;
type Replacement = { text: string; bindings: LocalBinding[] };
type TextLeaf = { text: string; write: (text: string) => void };
const invalidMessage = 'Repair patch requires a valid original, policy and bounded field replacements.';
const nonblank = z.string().regex(/\S/u);
const PolicySchema = z.object({
  status: z.literal('ready'), findings: z.array(z.unknown()).max(0),
  originalFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  allowedLocations: z.array(nonblank),
  descriptionMaxChars: z.number().int().positive().max(200).nullable(),
  sources: z.array(z.object({
    page: nonblank.refine(page => {
      // This is an already captured host[:port][/path], not an input URL.
      // sourcePageIdentity removes one www prefix and is not idempotent.
      if (!/^(?:\[[0-9a-f:.]+\]|[^/:?#@\s\\]+)(?::\d+)?(?:\/[^\s?#\\]*)?$/iu.test(page)) return false;
      try {
        return new URL(`http://${page}`).hostname.length > 0;
      } catch { return false; }
    }), sourceIds: z.array(nonblank).min(1),
    initialDerivedWords: z.number().int().nonnegative(), maxDerivedWords: z.number().int().nonnegative(),
  }).strict().refine(source => source.maxDerivedWords <= source.initialDerivedWords)),
}).strict();

// Provider data is JSON. Reject hidden/inherited properties and accessors before
// validation or secret scanning can read them, and reject cyclic/non-JSON input.
function assertJson(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))) return;
  if (typeof value !== 'object' || ancestors.has(value)) throw new Error(invalidMessage);
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== (array ? Array.prototype : Object.prototype)) throw new Error(invalidMessage);
  ancestors.add(value);
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1) throw new Error(invalidMessage);
  for (const key of keys) {
    if (array && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor)
      || (array && !/^(?:0|[1-9]\d*)$/u.test(key))) throw new Error(invalidMessage);
    assertJson(descriptor.value, ancestors);
  }
  ancestors.delete(value);
}

// Register concrete scalar leaves from the validated shape. Never resolve or
// write a model-provided pointer through generic object/prototype traversal.
function textLeaves(draft: GeneratedDraftV2): Map<string, TextLeaf> {
  const leaves = new Map<string, TextLeaf>();
  function add<T, K extends keyof T>(location: string, owner: T, key: K) {
    leaves.set(location, { text: owner[key] as string, write: text => { owner[key] = text as T[K]; } });
  }
  for (const key of ['description', 'competitorGap', 'directAnswer'] as const) add(`/${key}`, draft, key);
  draft.sections.forEach((section, i) => {
    add(`/sections/${i}/heading`, section, 'heading');
    add(`/sections/${i}/markdown`, section, 'markdown');
  });
  draft.faqAnswers.forEach((faq, i) => add(`/faqAnswers/${i}/answer`, faq, 'answer'));
  for (const key of ['title', 'alt'] as const) add(`/editorialGraphic/${key}`, draft.editorialGraphic, key);
  draft.editorialGraphic.steps.forEach((step, i) => {
    add(`/editorialGraphic/steps/${i}/label`, step, 'label');
    add(`/editorialGraphic/steps/${i}/detail`, step, 'detail');
  });
  return leaves;
}

function contract(original: GeneratedDraftV2, policy: RepairPolicy) {
  assertJson(original);
  assertJson(policy);
  if (containsSecretLikeValue(original) || containsSecretLikeValue(policy)) throw new Error(invalidMessage);
  GeneratedDraftV2Schema.parse(original);
  PolicySchema.parse(policy);
  const leaves = textLeaves(original);
  if (new Set(policy.allowedLocations).size !== policy.allowedLocations.length
    || policy.allowedLocations.some(location => !leaves.has(location))
    || inspectRepairDelta(original, original, policy).length) throw new Error(invalidMessage);

  const repairFields: Record<string, Replacement> = {};
  const localFields: Record<string, z.ZodType<Replacement | null>> = {};
  const providerFields: Record<string, JsonSchema> = {};
  for (const location of policy.allowedLocations) {
    const bindings = original.claimBindings.filter(binding => binding.location === location).map(binding => ({
      span: binding.span, sourceFactIds: [...binding.sourceFactIds], productClaimId: binding.productClaimId,
    }));
    repairFields[location] = { text: leaves.get(location)!.text, bindings };
    const facts = [...new Set(bindings.flatMap(binding => binding.sourceFactIds))];
    const products = [...new Set(bindings.flatMap(binding => binding.productClaimId === null ? [] : [binding.productClaimId]))];
    const localBinding = z.object({
      span: nonblank, sourceFactIds: z.array(z.enum(facts)).min(1),
      productClaimId: products.length ? z.enum(products).nullable() : z.null(),
    }).strict();
    const localBindings = z.array(localBinding);
    localFields[location] = z.object({ text: nonblank, bindings: facts.length ? localBindings : localBindings.max(0) }).strict().nullable();
    const providerBinding = {
      type: 'object', additionalProperties: false,
      properties: {
        span: { type: 'string', pattern: '\\S' },
        sourceFactIds: { type: 'array', minItems: 1, items: { type: 'string', enum: facts } },
        productClaimId: products.length ? { type: ['string', 'null'], enum: [...products, null] } : { type: 'null' },
      },
      required: ['span', 'sourceFactIds', 'productClaimId'],
    };
    providerFields[location] = { anyOf: [
      { type: 'null' },
      { type: 'object', additionalProperties: false, properties: {
        text: { type: 'string', pattern: '\\S' },
        // An unbound location has no legal binding. Do not emit an empty enum
        // (invalid JSON Schema) or expose unrelated facts to fill that inventory.
        bindings: facts.length ? { type: 'array', items: providerBinding }
          : { type: 'array', maxItems: 0, items: { type: 'null' } },
      }, required: ['text', 'bindings'] },
    ] };
  }
  return {
    input: { originalFingerprint: policy.originalFingerprint, repairFields },
    local: z.object({
      schemaVersion: z.literal(1), originalFingerprint: z.literal(policy.originalFingerprint),
      changes: z.object(localFields).strict(),
    }).strict(),
    schema: {
      type: 'object', additionalProperties: false, properties: {
        schemaVersion: { type: 'integer', const: 1 },
        originalFingerprint: { type: 'string', const: policy.originalFingerprint },
        changes: { type: 'object', additionalProperties: false, properties: providerFields, required: [...policy.allowedLocations] },
      }, required: ['schemaVersion', 'originalFingerprint', 'changes'],
    } satisfies JsonSchema,
  };
}

/** Build the provider contract from the exact reviewed original, without I/O. */
export function createRepairPatchRequest(original: GeneratedDraftV2, policy: RepairPolicy): {
  schema: JsonSchema; input: {
    originalFingerprint: string; repairFields: Record<string, unknown>;
    repairLimits: ReturnType<typeof getRepairLocationLimits>;
  };
} {
  try {
    const { schema, input } = contract(original, policy);
    return { schema, input: { ...input, repairLimits: getRepairLocationLimits(original, policy) } };
  } catch {
    // Parser diagnostics and policy/model text can contain private values.
    throw new Error(invalidMessage);
  }
}

/** Assemble a clone; existing content and independent review gates still apply. */
export function applyRepairPatch(original: GeneratedDraftV2, policy: RepairPolicy, output: unknown):
  { status: 'ready'; draft: GeneratedDraftV2 } | { status: 'blocked'; findings: DraftSafetyFinding[] } {
  try {
    const { local } = contract(original, policy);
    assertJson(output);
    if (containsSecretLikeValue(output)) throw new Error(invalidMessage);
    const patch = local.parse(output);
    const draft = structuredClone(original);
    const leaves = textLeaves(draft);
    for (const [location, replacement] of Object.entries(patch.changes)) {
      if (replacement === null) continue;
      leaves.get(location)!.write(replacement.text);
      draft.claimBindings = draft.claimBindings.filter(binding => binding.location !== location);
      draft.claimBindings.push(...replacement.bindings.map(binding => ({ location, ...binding })));
    }
    // Validate without adopting Zod's trimming transforms: immutable and null
    // fields/bindings must remain byte-for-byte copies of the supplied original.
    GeneratedDraftV2Schema.parse(draft);
    const findings = inspectRepairDelta(original, draft, policy);
    return findings.length ? { status: 'blocked', findings } : { status: 'ready', draft };
  } catch {
    return { status: 'blocked', findings: [{ code: 'repair.patch_invalid', message: invalidMessage }] };
  }
}

type SentenceInfo = LocalBinding & { maxWords: number };
type SentenceField = { mode: 'sentences'; sentences: Record<string, SentenceInfo> } | { mode: 'field' };
type SentenceChanges = Record<string, string[] | null>;
type SentenceRange = { key: string; start: number; end: number; binding: LocalBinding; maxWords: number };
const sentenceWord = /^[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*[.,!?;:]*$/u;
const localSentenceWord = z.string().regex(sentenceWord).refine(word => !/\s/u.test(word));
const sentenceMarkdown = unified().use(remarkParse).use(remarkGfm);
const markdownBody = (location: string) => location === '/directAnswer' || /^\/sections\/\d+\/markdown$/u.test(location);
type MarkdownSentenceNode = {
  type: string; value?: string; children?: MarkdownSentenceNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
  checked?: boolean | null; ordered?: boolean | null; start?: number | null;
};

// Only literal text leaves in paragraphs/lists have an unambiguous raw range.
// GFM parsing also identifies tables, task lists, autolinks and strikethrough,
// all of which remain field mode. Never strip or reserialize Markdown.
function markdownSentenceLeaves(text: string) {
  const leaves: Array<{ start: number; end: number }> = [];
  const shape: unknown[] = [];
  const children: Record<string, readonly string[]> = {
    root: ['paragraph', 'list'], list: ['listItem'],
    listItem: ['paragraph', 'list'], paragraph: ['text'],
  };
  function visit(node: MarkdownSentenceNode): boolean {
    shape.push([node.type, node.ordered ?? null, node.start ?? null, node.children?.length ?? 0]);
    if (node.type === 'text') {
      const start = node.position?.start.offset, end = node.position?.end.offset;
      if (start === undefined || end === undefined || text.slice(start, end) !== node.value) return false;
      leaves.push({ start, end });
      return true;
    }
    return node.checked == null && !!node.children?.length && node.children.every(child =>
      children[node.type]?.includes(child.type) && visit(child));
  }
  return visit(sentenceMarkdown.parse(text)) && leaves.length ? { leaves, shape: JSON.stringify(shape) } : null;
}

// Every binding must occur once within one literal leaf, and every non-whitespace
// leaf byte must be covered. Only parser-owned structural bytes may sit outside.
function sentenceRanges(original: GeneratedDraftV2, location: string, text: string): SentenceRange[] | null {
  // Preserve the existing literal path, including its whitespace-only gaps.
  const lexicalText = text.replace(/["“”]/gu, '');
  const literal = lexicalText.trim().split(/\s+/u).every(word => sentenceWord.test(word))
    && !/(?:^|\n)(?: {4}|\t| {0,3}\d+[.)][ \t])/u.test(text);
  const mapped = markdownBody(location) ? markdownSentenceLeaves(text) : null;
  if (!mapped && !literal) return null;
  const leaves = mapped?.leaves ?? [{ start: 0, end: text.length }];
  const ranges: SentenceRange[] = [];
  for (const [index, binding] of original.claimBindings.entries()) {
    if (binding.location !== location) continue;
    const words = binding.span.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
    const start = text.indexOf(binding.span);
    if (!words.length || start < 0 || text.indexOf(binding.span, start + 1) !== -1) return null;
    ranges.push({ key: `b${index}`, start, end: start + binding.span.length, maxWords: words.length,
      binding: { span: binding.span, sourceFactIds: [...binding.sourceFactIds], productClaimId: binding.productClaimId },
    });
  }
  if (!ranges.length) return null;
  const ordered = [...ranges].sort((a, b) => a.start - b.start);
  let index = 0;
  for (const leaf of leaves) {
    let end = leaf.start;
    while (index < ordered.length && ordered[index].start < leaf.end) {
      const range = ordered[index++];
      if (range.start < end || range.end > leaf.end || /\S/u.test(text.slice(end, range.start))) return null;
      end = range.end;
    }
    if (/\S/u.test(text.slice(end, leaf.end))) return null;
  }
  return index === ranges.length ? ranges : null;
}

function sentenceContract(original: GeneratedDraftV2, policy: RepairPolicy) {
  const v1 = contract(original, policy);
  const sentenceFields: Record<string, SentenceField> = {};
  const rangesByLocation = new Map<string, SentenceRange[]>();
  const localFields: Record<string, z.ZodType<Replacement | SentenceChanges | null>> = {};
  const providerFields: Record<string, JsonSchema> = {};
  for (const location of policy.allowedLocations) {
    const ranges = location === '/description' && policy.descriptionMaxChars !== null
      ? null : sentenceRanges(original, location, v1.input.repairFields[location].text);
    if (!ranges) {
      sentenceFields[location] = { mode: 'field' };
      localFields[location] = v1.local.shape.changes.shape[location];
      providerFields[location] = v1.schema.properties.changes.properties[location];
      continue;
    }
    rangesByLocation.set(location, ranges);
    sentenceFields[location] = { mode: 'sentences', sentences: Object.fromEntries(ranges.map(range => [range.key, {
      ...range.binding, sourceFactIds: [...range.binding.sourceFactIds], maxWords: range.maxWords,
    }])) };
    localFields[location] = z.object(Object.fromEntries(ranges.map(range => [
      range.key, z.array(localSentenceWord).max(range.maxWords).nullable(),
    ]))).strict().nullable();
    providerFields[location] = { anyOf: [{ type: 'null' }, {
      type: 'object', additionalProperties: false, required: ranges.map(range => range.key),
      properties: Object.fromEntries(ranges.map(range => [range.key, { anyOf: [
        // Reject common multi-word packing at generation time. The stricter
        // Unicode word validator above remains authoritative after generation.
        { type: 'null' }, { type: 'array', maxItems: range.maxWords, items: { type: 'string', pattern: '^[^\\s_/-]+$' } },
      ] }])),
    }] };
  }
  return {
    v1, rangesByLocation,
    input: { ...v1.input, repairLimits: getRepairLocationLimits(original, policy), sentenceFields },
    local: z.object({ schemaVersion: z.literal(2), originalFingerprint: z.literal(policy.originalFingerprint),
      changes: z.object(localFields).strict(),
    }).strict(),
    schema: { ...v1.schema, properties: { ...v1.schema.properties,
      schemaVersion: { type: 'integer', const: 2 },
      changes: { type: 'object', additionalProperties: false, properties: providerFields, required: [...policy.allowedLocations] },
    } } satisfies JsonSchema,
  };
}

/** Assign code-owned sentence ranges while preserving v1 for complex fields. */
export function createSentenceRepairRequest(original: GeneratedDraftV2, policy: RepairPolicy): {
  schema: JsonSchema;
  input: {
    originalFingerprint: string;
    repairFields: Record<string, unknown>;
    repairLimits: ReturnType<typeof getRepairLocationLimits>;
    sentenceFields: Record<string, SentenceField>;
  };
} {
  try {
    const { schema, input } = sentenceContract(original, policy);
    return { schema, input };
  } catch {
    throw new Error(invalidMessage);
  }
}

/** Assemble bounded words with their original citations, then enforce v1 gates. */
export function applySentenceRepair(original: GeneratedDraftV2, policy: RepairPolicy, output: unknown):
  { status: 'ready'; draft: GeneratedDraftV2 } | { status: 'blocked'; findings: DraftSafetyFinding[] } {
  try {
    const { v1, local, rangesByLocation } = sentenceContract(original, policy);
    assertJson(output);
    if (containsSecretLikeValue(output)) throw new Error(invalidMessage);
    const patch = local.parse(output);
    const changes: Record<string, Replacement | null> = {};
    for (const [location, edit] of Object.entries(patch.changes)) {
      const ranges = rangesByLocation.get(location);
      if (edit === null || !ranges) {
        changes[location] = edit as Replacement | null;
        continue;
      }
      const sentences = edit as SentenceChanges;
      if (ranges.every(range => sentences[range.key] === null)) {
        changes[location] = null;
        continue;
      }
      let text = v1.input.repairFields[location].text;
      let deletionBaseline = text;
      for (const range of [...ranges].sort((a, b) => b.start - a.start)) {
        const words = sentences[range.key];
        if (words !== null) text = text.slice(0, range.start) + words.join(' ') + text.slice(range.end);
        if (words?.length === 0) deletionBaseline = deletionBaseline.slice(0, range.start) + deletionBaseline.slice(range.end);
      }
      // Bounded tokens such as "1." can still introduce a list at a block start.
      // Reject structural reinterpretation and deletion of a whole list item.
      const originalMarkdown = markdownBody(location) && markdownSentenceLeaves(v1.input.repairFields[location].text);
      if (originalMarkdown) {
        // Explicit deletion may remove an entire paragraph. Compare against
        // the original with ONLY those deletions, not a model-owned structure.
        const expected = markdownSentenceLeaves(deletionBaseline);
        const mapped = markdownSentenceLeaves(text);
        if (!expected || !mapped || mapped.shape !== expected.shape) {
          throw new Error(invalidMessage);
        }
      }
      // Keep local bindings in their original order, independent of prose order.
      const bindings = ranges.flatMap(range => {
        const words = sentences[range.key];
        return words === null ? [range.binding]
          : words.length ? [{ ...range.binding, span: words.join(' ') }] : [];
      });
      changes[location] = { text, bindings };
    }
    const assembledV1Patch = v1.local.parse({ schemaVersion: 1, originalFingerprint: patch.originalFingerprint, changes });
    return applyRepairPatch(original, policy, assembledV1Patch);
  } catch {
    return { status: 'blocked', findings: [{ code: 'repair.patch_invalid', message: invalidMessage }] };
  }
}
