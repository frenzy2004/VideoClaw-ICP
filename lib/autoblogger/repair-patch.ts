import { z } from 'zod';
import { GeneratedDraftV2Schema, type DraftSafetyFinding, type GeneratedDraftV2 } from './content-bundle';
import type { JsonSchema } from './openai-responses';
import { inspectRepairDelta, type RepairPolicy } from './repair-policy';
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
  schema: JsonSchema; input: { originalFingerprint: string; repairFields: Record<string, unknown> };
} {
  try {
    const { schema, input } = contract(original, policy);
    return { schema, input };
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
