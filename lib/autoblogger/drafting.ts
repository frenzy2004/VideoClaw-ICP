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
  GENERATED_DRAFT_V1_JSON_SCHEMA,
  GeneratedDraftV1Schema,
  hasSecretLikeValue,
  inspectGeneratedDraft,
  materializeDraftBundle,
  selectProductMedia,
  type AllowlistedProductMedia,
  type DraftSafetyFinding,
  type DraftingContext,
  type GeneratedDraftV1,
} from './content-bundle';

const DraftCritiqueV1Schema = z.object({
  schemaVersion: z.literal(1),
  approved: z.boolean(),
  issues: z.array(z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    repairInstruction: z.string().trim().min(1),
  }).strict()),
}).strict();

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
          code: { type: 'string', minLength: 1 },
          message: { type: 'string', minLength: 1 },
          repairInstruction: { type: 'string', minLength: 1 },
        },
        required: ['code', 'message', 'repairInstruction'],
      },
    },
  },
  required: ['schemaVersion', 'approved', 'issues'],
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

const DRAFT_SYSTEM = `Create version 1 article-generation JSON for VideoClaw.
Use only the supplied source facts and caller-approved product claims.
The direct answer must be 40–60 words. Produce no Markdown H1, raw HTML, secrets,
internal research/debug prose, or links outside the supplied inventory. Answer the
three supplied FAQ questions exactly and reference every used product claim.`;

const CRITIQUE_SYSTEM = `Act as an independent factual, legal-copy, safety, and editorial critic.
Evaluate the draft against the supplied candidate, evidence, source facts, approved
product claims, and output rules. Do not rewrite it. Return approved only when there
are no issues; otherwise provide concrete repair instructions.`;

const REPAIR_SYSTEM = `Repair the version 1 article-generation JSON exactly once.
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
  return critique.issues.map(({ code, message }) => ({ code, message }));
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

  const evidenceByUrl = new Map(context.evidence.sources.map((source) => [source.url, source]));
  const reachableFinalUrls = new Set<string>();
  for (const checked of context.checkedSources) {
    const evidenceSource = evidenceByUrl.get(checked.url);
    if (
      evidenceSource
      && checked.reachable
      && checked.status >= 200
      && checked.status < 400
      && evidenceSource.authoritative === checked.authoritative
    ) {
      reachableFinalUrls.add(checked.finalUrl);
    }
  }
  if (
    context.sourceFacts.length < 2
    || context.sourceFacts.some((source) => !reachableFinalUrls.has(source.url))
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
  if (!Number.isFinite(Date.parse(context.generatedAt))) {
    throw new Error('Draft generation timestamp must be a valid ISO date-time.');
  }
  if (hasSecretLikeValue(modelContext(context))) {
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

      const suppliedContext = modelContext(context);
      const initial = GeneratedDraftV1Schema.parse(await options.client.generate({
        name: 'videoclaw_article_draft_v1',
        schema: GENERATED_DRAFT_V1_JSON_SCHEMA,
        system: DRAFT_SYSTEM,
        input: suppliedContext,
      }));
      const deterministicFindings = inspectGeneratedDraft(context, initial);
      const critique = DraftCritiqueV1Schema.parse(await options.client.generate({
        name: 'videoclaw_article_critique_v1',
        schema: DRAFT_CRITIQUE_V1_JSON_SCHEMA,
        system: CRITIQUE_SYSTEM,
        input: { ...suppliedContext, draft: initial },
      }));
      const issues = [...deterministicFindings, ...critiqueIssues(critique)];
      if (issues.length === 0) {
        return {
          status: 'ready',
          repaired: false,
          bundle: materializeDraftBundle(context, initial, media),
        };
      }

      const repaired = GeneratedDraftV1Schema.parse(await options.client.generate({
        name: 'videoclaw_article_repair_v1',
        schema: GENERATED_DRAFT_V1_JSON_SCHEMA,
        system: REPAIR_SYSTEM,
        input: {
          ...suppliedContext,
          draft: initial,
          critique,
          deterministicFindings,
        },
      })) as GeneratedDraftV1;
      const remainingFindings = inspectGeneratedDraft(context, repaired);
      if (
        critiqueIssues(critique).length > 0
        && JSON.stringify(repaired) === JSON.stringify(initial)
      ) {
        remainingFindings.push({
          code: 'critique.unresolved',
          message: 'The repair did not change a draft rejected by the independent critique.',
        });
      }
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
