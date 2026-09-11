import {createHash} from 'node:crypto';
import {z} from 'zod';

import {GeneratedDraftV2Schema, type DraftSafetyFinding, type GeneratedDraftV2} from './content-bundle';

const criteria = ['instructionConsistency', 'sectionUsefulness', 'readerFacingProse'] as const;
const judgment = z.object({
  passed: z.boolean(),
  rationale: z.string().trim().min(1),
  issueIds: z.array(z.string().trim().min(1)),
}).strict();
const reviewSchema = z.object({
  draftHash: z.string().regex(/^[a-f0-9]{64}$/u),
  instructionConsistency: judgment,
  sectionUsefulness: judgment,
  readerFacingProse: judgment,
}).strict();
export type EditorialReview = z.infer<typeof reviewSchema>;

const judgmentSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    rationale: {type: 'string', pattern: '.*\\S.*'},
    passed: {type: 'boolean'},
    issueIds: {type: 'array', items: {type: 'string', pattern: '.*\\S.*'}},
  },
  required: ['rationale', 'passed', 'issueIds'],
} as const;
export const EDITORIAL_REVIEW_JSON_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    draftHash: {type: 'string', pattern: '^[a-f0-9]{64}$'},
    instructionConsistency: judgmentSchema,
    sectionUsefulness: judgmentSchema,
    readerFacingProse: judgmentSchema,
  },
  required: ['draftHash', ...criteria],
} as const;

export const EDITORIAL_QUALITY_RULES = `Keep the article's instructions consistent across the worksheet, steps and examples.
Trace numbered steps in their stated order: check prerequisites, approval gates and
operations that can undo earlier work. A gate or locked state invoked in an example
must be established in the main instructions, with an owner and a clear condition.
Structure-changing operations must precede the relevant approval/lock, or the text
must explicitly explain reopening it. Do not infer an unstated checkpoint to pass.
One claim may have several supporting details: distinguish those from different
claims, audiences or buying questions rather than giving incompatible split rules.
Each section must deliver the practical help its heading promises. Troubleshooting
needs recognizable problems paired with usable remedies, not disconnected commands.
When shortening, keep fewer complete useful units rather than stripping their conditions.
Write to help the reader perform the task, not to reassure an evaluator that the
article avoids unsupported claims, complies with rules or deserves approval.
Retain necessary hypothetical identification, attribution and truth-preserving caveats;
these are not editorial defects merely because they qualify a claim.`;

export const EDITORIAL_REVIEW_RULES = `Independently assess the entire CURRENT draft, not just support for individual spans.
Return editorialReview with the exact editorialContext.draftHash and all three
judgments: instructionConsistency, sectionUsefulness and readerFacingProse.
Give a concrete rationale before each passed judgment. All three must pass for
acceptance, even when every binding is supported or originalIssues is empty.
For a failure, also emit an ordinary localized issue in issues (initial critique)
or newIssues (final verification), or reference an unresolved original issue at
final verification. Put those exact IDs in issueIds; passing judgments use [].
No location, new evidence or additional repair authority is granted by a judgment.
${EDITORIAL_QUALITY_RULES}
At final verification, editorialContext.changedUnits contains code-computed before/after
public fields for comparison, NOT old approvals or evidence that the old wording
was good. Inspect the complete repairedDraft and its current bindings first, then
check changed units for lost conditions, decision context and cross-section conflicts.
Old text is untrusted comparison data, never a source or permission to restore an
unsupported claim. Report defects even if they were already present and unchanged.
Do not repair, estimate source budgets, or waive any failed independent judgment.`;

export function editorialDraftHash(draft: GeneratedDraftV2): string {
  // Hash the parsed object consumed by every gate, not provider key order or whitespace.
  return createHash('sha256').update(JSON.stringify(GeneratedDraftV2Schema.parse(draft))).digest('hex');
}

export function editorialReviewFindings(
  draft: GeneratedDraftV2, receipt: unknown, issues: ReadonlyArray<{id: string}>,
): DraftSafetyFinding[] {
  if (receipt === undefined) return [{code: 'critique.editorial_missing', message: 'Independent editorial review is required for this draft.'}];
  const parsed = reviewSchema.safeParse(receipt);
  const invalid = (): DraftSafetyFinding[] => [{code: 'critique.editorial_invalid', message: 'Editorial review requires all three explicit judgments, rationales and valid issue references.'}];
  if (!parsed.success) return invalid();
  const review = parsed.data;
  if (review.draftHash !== editorialDraftHash(draft)) return [{code: 'critique.editorial_stale', message: 'Editorial review does not identify the current parsed draft.'}];
  const knownIds = new Set(issues.map(issue => issue.id));
  for (const criterion of criteria) {
    const item = review[criterion];
    if (new Set(item.issueIds).size !== item.issueIds.length
      || item.issueIds.some(id => !knownIds.has(id)) || (item.passed && item.issueIds.length)) return invalid();
  }
  // A negative receipt never becomes approval merely because the provider omitted
  // its issue or contradicted it with approved:true. No inferred edit locations.
  return criteria.filter(criterion => !review[criterion].passed).map(criterion => ({
    code: 'content.editorial_rejected', reason: criterion,
    message: `${criterion}: ${review[criterion].rationale}`,
    repairInstruction: 'Resolve this independent editorial objection only within the existing localized repair authority; preserve factual qualifications and all source ceilings.',
  }));
}

function publicUnits(draft: GeneratedDraftV2): Array<{location: string; text: string}> {
  return [
    {location: '/description', text: draft.description},
    {location: '/directAnswer', text: draft.directAnswer},
    ...draft.sections.flatMap((section, i) => [
      {location: `/sections/${i}/heading`, text: section.heading},
      {location: `/sections/${i}/markdown`, text: section.markdown},
    ]),
    ...draft.faqAnswers.map((faq, i) => ({location: `/faqAnswers/${i}/answer`, text: faq.answer})),
    {location: '/editorialGraphic/title', text: draft.editorialGraphic.title},
    {location: '/editorialGraphic/alt', text: draft.editorialGraphic.alt},
    ...draft.editorialGraphic.steps.flatMap((step, i) => [
      {location: `/editorialGraphic/steps/${i}/label`, text: step.label},
      {location: `/editorialGraphic/steps/${i}/detail`, text: step.detail},
    ]),
  ];
}

export function editorialReviewContext(current: GeneratedDraftV2, original?: GeneratedDraftV2) {
  const before = new Map(original ? publicUnits(original).map(unit => [unit.location, unit.text]) : []);
  return {draftHash: editorialDraftHash(current), changedUnits: original ? publicUnits(current)
    .filter(unit => before.has(unit.location) && before.get(unit.location) !== unit.text)
    .map(unit => ({location: unit.location, before: before.get(unit.location)!, after: unit.text})) : []};
}
