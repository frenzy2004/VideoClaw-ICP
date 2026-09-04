import { z } from 'zod';

import {
  CandidateSchema,
  EvidenceBundleSchema,
  KeywordMetricsSchema,
  candidateFingerprints,
  type DraftBundle,
} from './domain';
import type { StructuredOutputClient } from './openai-responses';
import {
  GENERATED_DRAFT_V2_JSON_SCHEMA,
  GeneratedDraftV2Schema,
  assertSourceFacts,
  inspectGeneratedDraft,
  materializeDraftBundle,
  normalizeHttpUrl,
  selectProductMedia,
  type AllowlistedProductMedia,
  type DraftSafetyFinding,
  type DraftingContext,
  type GeneratedDraftV2,
} from './content-bundle';
import { isStrictIsoDateTime } from './date-time';
import { containsSecretLikeValue } from './secrets';

const CritiqueIssueSchema = z.object({
  id: z.string().trim().min(1),
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  repairInstruction: z.string().trim().min(1),
}).strict();

const DraftCritiqueV1Schema = z.object({
  schemaVersion: z.literal(1),
  approved: z.boolean(),
  issues: z.array(CritiqueIssueSchema),
}).strict().superRefine((critique, context) => {
  if (critique.approved !== (critique.issues.length === 0)) {
    context.addIssue({
      code: 'custom',
      message: 'approved must be true exactly when issues is empty',
      path: ['approved'],
    });
  }
  if (new Set(critique.issues.map(({ id }) => id)).size !== critique.issues.length) {
    context.addIssue({
      code: 'custom',
      message: 'critic issue identifiers must be unique',
      path: ['issues'],
    });
  }
});

export type DraftCritiqueV1 = z.infer<typeof DraftCritiqueV1Schema>;

export const DRAFT_CRITIQUE_V1_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    approved: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', pattern: '.*\\S.*' },
          code: { type: 'string', pattern: '.*\\S.*' },
          message: { type: 'string', pattern: '.*\\S.*' },
          repairInstruction: { type: 'string', pattern: '.*\\S.*' },
        },
        required: ['id', 'code', 'message', 'repairInstruction'],
      },
    },
  },
  required: ['schemaVersion', 'approved', 'issues'],
  allOf: [{
    if: { properties: { approved: { const: false } }, required: ['approved'] },
    then: { properties: { issues: { minItems: 1 } } },
    else: { properties: { issues: { maxItems: 0 } } },
  }],
} as const;

export type MediaBlockingBrief = {
  code: 'media.mapping_required';
  candidateFingerprint: string;
  slug: string;
  requiredWidth: 1200;
  requiredHeight: 675;
  message: string;
};

export type DraftingOutcome =
  | {
    status: 'ready';
    repaired: boolean;
    bundle: DraftBundle;
  }
  | {
    status: 'blocked';
    reason: 'media_mapping_required';
    mediaBrief: MediaBlockingBrief;
  }
  | {
    status: 'blocked';
    reason: 'content_safety_failed';
    findings: DraftSafetyFinding[];
  };

export type StructuredDrafterOptions = {
  client: StructuredOutputClient;
  mediaAllowlist: AllowlistedProductMedia[];
};

const DRAFT_SYSTEM = `Create version 2 article-generation JSON for VideoClaw.
Use only the supplied source facts and caller-approved product claims.
Bind every objective claim's exact location and span to lexically supporting facts
from selected visible sources; bind product claims to the supplied claim identifier.
The direct answer must be 40–60 words. Produce no Markdown H1, raw HTML, secrets,
internal research/debug prose, or links outside the supplied inventory. Answer the
three supplied FAQ questions exactly and reference every used product claim.`;

const CRITIQUE_SYSTEM = `Act as an independent factual, legal-copy, safety, and editorial critic.
Evaluate the draft against the supplied candidate, evidence, source facts, approved
product claims, and output rules. Do not rewrite it. Return approved only when there
are no issues; otherwise provide unique issue IDs and concrete repair instructions.
Never provide an acceptance predicate.`;

const REPAIR_SYSTEM = `Repair the version 2 article-generation JSON exactly once.
Address every independent-critique and deterministic-safety issue while preserving
the supplied candidate, source inventory, exact FAQ questions, and approved claim
bindings. Return a complete replacement object, with no commentary.`;

function modelContext(context: DraftingContext): Record<string, unknown> {
  return {
    candidate: context.candidate,
    evidence: context.evidence,
    keywordMetrics: context.keywordMetrics,
    provenance: context.provenance,
    sourceFacts: context.sourceFacts.map(({ id, label, url, checkedAt, facts }) => ({
      id,
      label,
      url,
      checkedAt,
      facts,
    })),
    productClaims: context.productClaims,
  };
}

function critiqueIssues(critique: DraftCritiqueV1): DraftSafetyFinding[] {
  if (critique.approved && critique.issues.length === 0) return [];
  if (critique.issues.length === 0) {
    return [{ code: 'critique.rejected', message: 'Independent critique rejected the draft.' }];
  }
  return critique.issues.map(({ id, code, message }) => ({ issueId: id, code, message }));
}

function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function assertDraftingContext(context: DraftingContext): void {
  CandidateSchema.parse(context.candidate);
  EvidenceBundleSchema.parse(context.evidence);
  KeywordMetricsSchema.parse(context.keywordMetrics);
  assertSourceFacts(context.sourceFacts);
  const expectedFingerprint = candidateFingerprints(context.candidate).candidate;
  if (context.evidence.candidateFingerprint !== expectedFingerprint) {
    throw new Error('Evidence candidate fingerprint does not match the drafting candidate.');
  }
  if (context.keywordMetrics.intent !== context.candidate.intent) {
    throw new Error('Keyword metrics intent does not match the drafting candidate.');
  }
  if (context.provenance.query !== context.candidate.primaryKeyword) {
    throw new Error('Apify provenance query must exactly match the primary keyword.');
  }
  if (
    !context.provenance.apifyRunId.trim()
    || !context.provenance.apifyDatasetId.trim()
    || context.provenance.locale !== 'en-US'
    || !validDateOnly(context.provenance.capturedAt)
  ) {
    throw new Error('Apify provenance requires exact run, dataset, en-US locale, and captured date values.');
  }
  if (
    context.evidence.faqQuestions.length !== 3
    || context.evidence.faqQuestions.some(
      (question, index) => question !== context.evidence.serp.peopleAlsoAsk[index],
    )
  ) {
    throw new Error('Drafting requires exactly three PAA-grounded FAQ questions.');
  }

  const evidenceByUrl = new Map(context.evidence.sources.flatMap((source) => {
    const normalized = normalizeHttpUrl(source.url);
    return normalized ? [[normalized, source] as const] : [];
  }));
  const reachableFinalUrls = new Set<string>();
  for (const checked of context.checkedSources) {
    const checkedUrl = normalizeHttpUrl(checked.url);
    const finalUrl = normalizeHttpUrl(checked.finalUrl);
    const evidenceSource = checkedUrl ? evidenceByUrl.get(checkedUrl) : undefined;
    if (
      evidenceSource
      && finalUrl
      && checked.reachable
      && checked.status >= 200
      && checked.status < 400
      && evidenceSource.authoritative === checked.authoritative
    ) {
      reachableFinalUrls.add(finalUrl);
    }
  }
  if (reachableFinalUrls.size < 2) {
    throw new Error('Drafting requires at least two distinct normalized checked final URLs from checked sources.');
  }
  const sourceFactFinalUrls = context.sourceFacts.flatMap((source) => {
    const normalized = normalizeHttpUrl(source.url);
    return normalized ? [normalized] : [];
  });
  if (new Set(sourceFactFinalUrls).size < 2) {
    throw new Error('Source facts require at least two distinct normalized checked final URLs.');
  }
  if (
    context.sourceFacts.length < 2
    || sourceFactFinalUrls.length !== context.sourceFacts.length
    || sourceFactFinalUrls.some((url) => !reachableFinalUrls.has(url))
  ) {
    throw new Error('Each source fact must bind to a reachable checked source final URL.');
  }
  const sourceIds = context.sourceFacts.map(({ id }) => id);
  const factIds = context.sourceFacts.flatMap(({ facts }) => facts.map(({ id }) => id));
  if (new Set(sourceIds).size !== sourceIds.length || new Set(factIds).size !== factIds.length) {
    throw new Error('Source and source-fact identifiers must be unique.');
  }
  const factIdSet = new Set(factIds);
  for (const claim of context.productClaims) {
    if (
      claim.allowedSourceFactIds.length === 0
      || claim.allowedSourceFactIds.some((factId) => !factIdSet.has(factId))
    ) {
      throw new Error('Product claims must bind to supplied allowed source facts.');
    }
  }
  if (!isStrictIsoDateTime(context.generatedAt)) {
    throw new Error('Draft generation timestamp must be a strict ISO date-time.');
  }
  if (containsSecretLikeValue(modelContext(context))) {
    throw new Error('Model-bound drafting context contains a secret-like value.');
  }
}

export function createStructuredDrafter(options: StructuredDrafterOptions) {
  return {
    async draft(context: DraftingContext): Promise<DraftingOutcome> {
      assertDraftingContext(context);
      const media = selectProductMedia(context.candidate, options.mediaAllowlist);
      if (!media) {
        return {
          status: 'blocked',
          reason: 'media_mapping_required',
          mediaBrief: {
            code: 'media.mapping_required',
            candidateFingerprint: context.evidence.candidateFingerprint,
            slug: context.candidate.slug,
            requiredWidth: 1200,
            requiredHeight: 675,
            message: 'Map this candidate to an existing allowlisted product video/poster pair before drafting.',
          },
        };
      }
      if (containsSecretLikeValue(media)) {
        throw new Error('Selected media contains a secret-like value.');
      }

      const suppliedContext = modelContext(context);
      const initial = GeneratedDraftV2Schema.parse(await options.client.generate({
        name: 'videoclaw_article_draft_v2',
        schema: GENERATED_DRAFT_V2_JSON_SCHEMA,
        system: DRAFT_SYSTEM,
        input: suppliedContext,
      }));
      const deterministicFindings = inspectGeneratedDraft(context, initial);
      if (containsSecretLikeValue(initial)) {
        return {
          status: 'blocked',
          reason: 'content_safety_failed',
          findings: deterministicFindings.length > 0
            ? deterministicFindings
            : [{ code: 'content.secret', message: 'Generated draft contains a secret-like value.' }],
        };
      }
      const critique = DraftCritiqueV1Schema.parse(await options.client.generate({
        name: 'videoclaw_article_critique_v1',
        schema: DRAFT_CRITIQUE_V1_JSON_SCHEMA,
        system: CRITIQUE_SYSTEM,
        input: { ...suppliedContext, draft: initial },
      }));
      if (containsSecretLikeValue(critique)) {
        return {
          status: 'blocked',
          reason: 'content_safety_failed',
          findings: [{ code: 'content.secret', message: 'Critic output contains a secret-like value.' }],
        };
      }
      const issues = [...deterministicFindings, ...critiqueIssues(critique)];
      if (issues.length === 0) {
        return {
          status: 'ready',
          repaired: false,
          bundle: materializeDraftBundle(context, initial, media),
        };
      }

      const repaired = GeneratedDraftV2Schema.parse(await options.client.generate({
        name: 'videoclaw_article_repair_v2',
        schema: GENERATED_DRAFT_V2_JSON_SCHEMA,
        system: REPAIR_SYSTEM,
        input: {
          ...suppliedContext,
          draft: initial,
          critique,
          deterministicFindings,
        },
      })) as GeneratedDraftV2;
      const remainingFindings = inspectGeneratedDraft(context, repaired);
      if (containsSecretLikeValue(repaired)) {
        return {
          status: 'blocked',
          reason: 'content_safety_failed',
          findings: remainingFindings.length > 0
            ? remainingFindings
            : [{ code: 'content.secret', message: 'Repaired draft contains a secret-like value.' }],
        };
      }
      const repairedCritique = DraftCritiqueV1Schema.parse(await options.client.generate({
        name: 'videoclaw_article_critique_v1',
        schema: DRAFT_CRITIQUE_V1_JSON_SCHEMA,
        system: CRITIQUE_SYSTEM,
        input: { ...suppliedContext, draft: repaired },
      }));
      if (containsSecretLikeValue(repairedCritique)) {
        return {
          status: 'blocked',
          reason: 'content_safety_failed',
          findings: [{ code: 'content.secret', message: 'Critic output contains a secret-like value.' }],
        };
      }
      remainingFindings.push(...critiqueIssues(repairedCritique));
      if (remainingFindings.length > 0) {
        return {
          status: 'blocked',
          reason: 'content_safety_failed',
          findings: remainingFindings,
        };
      }
      return {
        status: 'ready',
        repaired: true,
        bundle: materializeDraftBundle(context, repaired, media),
      };
    },
  };
}
