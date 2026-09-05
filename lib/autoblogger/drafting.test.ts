import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { candidateFingerprints, type Candidate } from './domain';
import type { StructuredOutputClient, StructuredOutputRequest } from './openai-responses';
import {
  createStructuredDrafter,
  DRAFT_CRITIQUE_V1_JSON_SCHEMA,
  DRAFT_REPAIR_VERIFICATION_V1_JSON_SCHEMA,
  type DraftCritiqueV1,
  type DraftRepairVerificationV1,
} from './drafting';
import type {
  AllowlistedProductMedia,
  DraftingContext,
  GeneratedDraftV2,
} from './content-bundle';
import { GENERATED_DRAFT_V2_JSON_SCHEMA, inspectGeneratedDraft } from './content-bundle';

const candidate: Candidate = {
  schemaVersion: 1,
  articleId: 'vc-c2-011',
  campaignId: 'accelerator-demo-day-founder',
  icp: 'US startup founder preparing for Demo Day',
  primaryKeyword: 'founder pitch video workflow',
  secondaryKeywords: ['record startup pitch video'],
  title: 'Founder Pitch Video Workflow for a Clear Demo Day Story',
  slug: 'founder-pitch-video-workflow',
  intent: 'informational',
  funnelStage: 'middle',
};

const fingerprint = candidateFingerprints(candidate).candidate;

const context: DraftingContext = {
  candidate,
  evidence: {
    schemaVersion: 2,
    candidateFingerprint: fingerprint,
    signals: { autocomplete: ['founder pitch video workflow checklist'], peopleAlsoAsk: [], relatedSearches: [] },
    serp: {
      organicResultCount: 8,
      peopleAlsoAsk: [
        'How do you plan a founder pitch video?',
        'What belongs in a founder pitch video?',
        'How long should a founder pitch video be?',
      ],
    },
    sources: [
      { originalUrl: 'https://www.ycombinator.com/video/', finalUrl: 'https://www.ycombinator.com/video/', authoritative: true },
      { originalUrl: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business', finalUrl: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business', authoritative: true },
    ],
    faqQuestions: [
      'How do you plan a founder pitch video?',
      'What belongs in a founder pitch video?',
      'How long should a founder pitch video be?',
    ],
  },
  keywordMetrics: {
    schemaVersion: 1,
    provider: 'pending',
    observedAt: null,
    volume: null,
    difficulty: null,
    cpc: null,
    intent: 'informational',
  },
  checkedSources: [
    {
      url: 'https://www.ycombinator.com/video/',
      finalUrl: 'https://www.ycombinator.com/video/',
      status: 200,
      reachable: true,
      authoritative: true,
    },
    {
      url: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business',
      finalUrl: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business',
      status: 200,
      reachable: true,
      authoritative: true,
    },
  ],
  provenance: {
    apifyRunId: 'run_fixture_002',
    apifyDatasetId: 'dataset_fixture_002',
    query: 'founder pitch video workflow',
    locale: 'en-US',
    capturedAt: '2026-09-04',
  },
  sourceFacts: [
    {
      id: 'yc',
      label: 'Y Combinator: Application Video',
      url: 'https://www.ycombinator.com/video/',
      checkedAt: '2026-09-04T09:00:00.000Z',
      facts: [{ id: 'yc-bullets', text: 'The current guidance recommends speaking from bullets.' }],
      excerpt: 'This exact transient excerpt must never appear in a model request or generated bundle output.',
    },
    {
      id: 'ftc',
      label: 'Federal Trade Commission: Advertising FAQs',
      url: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business',
      checkedAt: '2026-09-04T09:05:00.000Z',
      facts: [{ id: 'ftc-basis', text: 'Objective advertising claims need a reasonable basis.' }],
      excerpt: 'A second transient excerpt exists solely for local copied passage comparison after generation.',
    },
  ],
  productClaims: [],
  generatedAt: '2026-09-05T02:00:00.000Z',
};

const media: AllowlistedProductMedia = {
  id: 'founder-demo',
  candidateFingerprints: [fingerprint],
  src: '/landing/full/founder-product.mp4',
  poster: '/landing/full/founder-product.jpg',
  alt: 'A founder presenting beside a product walkthrough',
  caption: 'An existing VideoClaw founder-led product demonstration.',
  width: 1280,
  height: 720,
};

const draft: GeneratedDraftV2 = {
  schemaVersion: 2,
  description: 'Plan a clear founder pitch video with factual points, natural delivery, visible product proof, supported claims, careful editing, reviewed captions, and a tested final playback path.',
  customerTrigger: 'Use this workflow for a clear, supportable Demo Day founder video.',
  competitorGap: 'Address the gap across natural delivery, claim control, product proof, and playback checks.',
  directAnswer: 'Plan a founder pitch video by choosing one audience and next step, reducing the story to a few factual points, recording short natural takes, and showing one current product action. Then edit for clarity, verify each objective claim and caption against its source, and test the complete final playback path.',
  sections: [
    {
      heading: 'Choose the story and delivery',
      markdown: 'Use a few memorable points and follow [current application guidance](https://www.ycombinator.com/video/) for the recipient program.',
    },
    {
      heading: 'Verify every objective claim',
      markdown: 'Use the [FTC advertising guidance](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business) to frame a careful internal claim review.',
    },
  ],
  faqAnswers: context.evidence.faqQuestions.map((question) => ({
    question,
    answer: 'Use the recipient requirements, support factual statements, keep the delivery natural, and test the exact final playback path.',
  })),
  sourceReferences: [{ sourceId: 'yc' }, { sourceId: 'ftc' }],
  claimBindings: [],
  editorialGraphic: {
    title: 'Founder pitch video workflow',
    alt: 'A four-step founder pitch video workflow',
    steps: [
      { label: 'Audience', detail: 'Choose one viewer and next step.' },
      { label: 'Story', detail: 'Reduce the pitch to factual points.' },
      { label: 'Record', detail: 'Capture short natural takes and proof.' },
      { label: 'Review', detail: 'Verify claims, captions, and playback.' },
    ],
  },
};

const baselineDraftClaims = [
  { id: 'fixture-description', location: '/description', span: 'Plan a clear founder pitch video with factual points, natural delivery, visible product proof, supported claims, careful editing, reviewed captions, and a tested final playback path.' },
  { id: 'fixture-trigger', location: '/customerTrigger', span: 'Use this workflow for a clear, supportable Demo Day founder video.' },
  { id: 'fixture-gap', location: '/competitorGap', span: 'Address the gap across natural delivery, claim control, product proof, and playback checks.' },
  { id: 'fixture-answer-1', location: '/directAnswer', span: 'Plan a founder pitch video by choosing one audience and next step, reducing the story to a few factual points, recording short natural takes, and showing one current product action.' },
  { id: 'fixture-answer-2', location: '/directAnswer', span: 'Then edit for clarity, verify each objective claim and caption against its source, and test the complete final playback path.' },
  { id: 'fixture-heading-1', location: '/sections/0/heading', span: 'Choose the story and delivery' },
  { id: 'fixture-section-1', location: '/sections/0/markdown', span: 'Use a few memorable points and follow current application guidance for the recipient program.' },
  { id: 'fixture-heading-2', location: '/sections/1/heading', span: 'Verify every objective claim' },
  { id: 'fixture-section-2', location: '/sections/1/markdown', span: 'Use the FTC advertising guidance to frame a careful internal claim review.' },
  { id: 'fixture-faq', location: '/faqAnswers/0/answer', span: 'Use the recipient requirements, support factual statements, keep the delivery natural, and test the exact final playback path.' },
  { id: 'fixture-faq', location: '/faqAnswers/1/answer', span: 'Use the recipient requirements, support factual statements, keep the delivery natural, and test the exact final playback path.' },
  { id: 'fixture-faq', location: '/faqAnswers/2/answer', span: 'Use the recipient requirements, support factual statements, keep the delivery natural, and test the exact final playback path.' },
  { id: 'fixture-graphic-title', location: '/editorialGraphic/title', span: 'Founder pitch video workflow' },
  { id: 'fixture-graphic-alt', location: '/editorialGraphic/alt', span: 'A four-step founder pitch video workflow' },
  { id: 'fixture-graphic-label-1', location: '/editorialGraphic/steps/0/label', span: 'Audience' },
  { id: 'fixture-graphic-1', location: '/editorialGraphic/steps/0/detail', span: 'Choose one viewer and next step.' },
  { id: 'fixture-graphic-label-2', location: '/editorialGraphic/steps/1/label', span: 'Story' },
  { id: 'fixture-graphic-2', location: '/editorialGraphic/steps/1/detail', span: 'Reduce the pitch to factual points.' },
  { id: 'fixture-graphic-label-3', location: '/editorialGraphic/steps/2/label', span: 'Record' },
  { id: 'fixture-graphic-3', location: '/editorialGraphic/steps/2/detail', span: 'Capture short natural takes and proof.' },
  { id: 'fixture-graphic-label-4', location: '/editorialGraphic/steps/3/label', span: 'Review' },
  { id: 'fixture-graphic-4', location: '/editorialGraphic/steps/3/detail', span: 'Verify claims, captions, and playback.' },
] as const;

context.sourceFacts[0].facts.push(...[
  ...new Map(baselineDraftClaims.map(({ id, span }) => [id, { id, text: span }])).values(),
]);
draft.claimBindings.push(...baselineDraftClaims.map(({ id, location, span }) => ({
  location,
  span,
  sourceFactIds: [id],
  productClaimId: null,
})));

const replacementDescriptions = {
  detailed: {
    id: 'fixture-replacement-detailed',
    text: 'Use this specific founder pitch workflow to plan factual points, record natural takes, show product proof, support claims, review captions, and test final playback.',
  },
  concise: {
    id: 'fixture-replacement-concise',
    text: 'Use this specific founder pitch workflow to plan factual points and final playback.',
  },
} as const;

context.sourceFacts[0].facts.push(...Object.values(replacementDescriptions).map(({ id, text }) => ({ id, text })));
context.sourceFacts[0].facts.push(
  { id: 'fixture-heading-changed', text: 'Changed' },
  { id: 'fixture-heading-alternate', text: 'Alternate' },
);

function draftWithBoundDescription(replacement: (typeof replacementDescriptions)[keyof typeof replacementDescriptions]): GeneratedDraftV2 {
  return {
    ...structuredClone(draft),
    description: replacement.text,
    claimBindings: draft.claimBindings.map((binding) => binding.location === '/description'
      ? { ...binding, span: replacement.text, sourceFactIds: [replacement.id] }
      : structuredClone(binding)),
  };
}

function supportedBindings(value: GeneratedDraftV2 = draft): DraftCritiqueV1['supportEvaluations'] {
  return value.claimBindings.map((binding, bindingIndex) => ({
    bindingIndex,
    bindingHash: createHash('sha256').update(JSON.stringify([
      binding.location, binding.span, binding.sourceFactIds, binding.productClaimId,
    ])).digest('hex'),
    supported: true,
    kind: binding.productClaimId === null ? 'source_claim' : 'product_claim',
    rationale: `Fixture source ${binding.sourceFactIds.join(', ')} supports this span without added assertions.`,
  }));
}

function withSourceClaim(span: string, factId = 'yc-bullets'): GeneratedDraftV2 {
  return {
    ...structuredClone(draft),
    sections: [{ ...draft.sections[0], markdown: span }, draft.sections[1]],
    claimBindings: draft.claimBindings.map((binding) => binding.location === '/sections/0/markdown'
      ? { ...binding, span, sourceFactIds: [factId] }
      : binding),
  };
}

const approvedCritique: DraftCritiqueV1 = {
  schemaVersion: 1,
  approved: true,
  issues: [],
  supportEvaluations: supportedBindings(),
};

function resolvedVerification(critique: DraftCritiqueV1, repairedDraft = draft): DraftRepairVerificationV1 {
  return {
    schemaVersion: 1,
    approved: true,
    evaluations: critique.issues.map(({ id }) => ({
      issueId: id,
      resolved: true,
      message: 'The repaired draft resolves this original issue.',
    })),
    newIssues: [],
    supportEvaluations: supportedBindings(repairedDraft),
  };
}

function unresolvedVerification(critique: DraftCritiqueV1, repairedDraft = draft): DraftRepairVerificationV1 {
  return {
    schemaVersion: 1,
    approved: false,
    evaluations: critique.issues.map(({ id, message }) => ({
      issueId: id,
      resolved: false,
      message,
    })),
    newIssues: [],
    supportEvaluations: supportedBindings(repairedDraft),
  };
}

class FixtureStructuredClient implements StructuredOutputClient {
  readonly requests: StructuredOutputRequest[] = [];

  constructor(private readonly outputs: unknown[]) {}

  async generate(request: StructuredOutputRequest): Promise<unknown> {
    this.requests.push(request);
    if (this.outputs.length === 0) throw new Error('Fixture output exhausted.');
    return this.outputs.shift();
  }
}

describe('provider response schemas and runtime approval invariants', () => {
  const issue = {
    id: 'description-specificity',
    code: 'copy.too_generic',
    message: 'Make the opening more specific to the candidate.',
    repairInstruction: 'Name the founder pitch workflow in the opening.',
  };
  const rejectedCritique: DraftCritiqueV1 = {
    ...approvedCritique,
    approved: false,
    issues: [issue],
  };

  // OpenAI Structured Outputs rejects these keywords even in nested schemas.
  // https://developers.openai.com/api/docs/guides/structured-outputs
  const unsupportedKeywords = new Set([
    'allOf', 'not', 'dependentRequired', 'dependentSchemas', 'if', 'then', 'else',
  ]);
  function unsupportedPaths(value: unknown, path = '$'): string[] {
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, child]) => [
      ...(unsupportedKeywords.has(key) ? [`${path}.${key}`] : []),
      ...unsupportedPaths(child, `${path}.${key}`),
    ]);
  }

  it.each(Object.entries({
    GENERATED_DRAFT_V2_JSON_SCHEMA,
    DRAFT_CRITIQUE_V1_JSON_SCHEMA,
    DRAFT_REPAIR_VERIFICATION_V1_JSON_SCHEMA,
  }))('%s contains no unsupported composition keywords', (_name, schema) => {
    expect(unsupportedPaths(schema)).toEqual([]);
    expect(schema).toMatchObject({ type: 'object', additionalProperties: false });
    expect(schema).not.toHaveProperty('anyOf');
  });

  it.each([
    { approved: true, issues: [issue] },
    { approved: false, issues: [] },
  ])('rejects inconsistent critique approval in Zod: %j', async (changes) => {
    const client = new FixtureStructuredClient([draft, { ...approvedCritique, ...changes }]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    await expect(drafter.draft(context)).rejects.toMatchObject({
      name: 'ZodError',
      issues: expect.arrayContaining([expect.objectContaining({ code: 'custom', path: ['approved'] })]),
    });
    expect(client.requests).toHaveLength(2);
  });

  it.each([
    { evaluations: [{ issueId: issue.id, resolved: false, message: 'The original issue remains.' }], newIssues: [] },
    { evaluations: [{ issueId: issue.id, resolved: true, message: 'The original issue is resolved.' }], newIssues: [{ ...issue, id: 'new-issue' }] },
  ])('rejects inconsistent repair approval in Zod: %j', async (changes) => {
    const repaired = draftWithBoundDescription(replacementDescriptions.detailed);
    const client = new FixtureStructuredClient([
      draft,
      rejectedCritique,
      repaired,
      { ...resolvedVerification(rejectedCritique, repaired), ...changes },
    ]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    await expect(drafter.draft(context)).rejects.toMatchObject({
      name: 'ZodError',
      issues: expect.arrayContaining([expect.objectContaining({ code: 'custom', path: ['approved'] })]),
    });
    expect(client.requests).toHaveLength(4);
  });

  it('allows repair verification to withhold approval even when its listed issues are resolved', async () => {
    const repaired = draftWithBoundDescription(replacementDescriptions.detailed);
    const client = new FixtureStructuredClient([
      draft,
      rejectedCritique,
      repaired,
      { ...resolvedVerification(rejectedCritique, repaired), approved: false },
    ]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    await expect(drafter.draft(context)).resolves.toMatchObject({
      status: 'blocked',
      reason: 'content_safety_failed',
      findings: [expect.objectContaining({ code: 'critique.verification_rejected' })],
    });
    expect(client.requests).toHaveLength(4);
  });
});

describe('structured drafting orchestration', () => {
  it('accepts a natural paraphrase only after complete independent support verification', async () => {
    const paraphrase = withSourceClaim('The application advice favors bullet points for speaking.');
    const critique: DraftCritiqueV1 = {
      ...approvedCritique,
      supportEvaluations: supportedBindings(paraphrase).map((evaluation) => (
        paraphrase.claimBindings[evaluation.bindingIndex].location === '/sections/0/markdown'
          ? { ...evaluation, rationale: 'yc-bullets recommends speaking from bullets; this paraphrase preserves that limited advice without asserting any body-only details or results.' }
          : evaluation
      )),
    };
    const client = new FixtureStructuredClient([paraphrase, critique]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);

    expect(outcome).toMatchObject({ status: 'ready', repaired: false });
    if (outcome.status !== 'ready') throw new Error('Expected independently reviewed paraphrase.');
    expect(outcome.bundle.markdown).toContain('The application advice favors bullet points for speaking.');
    expect(client.requests).toHaveLength(2);
    expect(client.requests[1].input).toMatchObject({
      bindingManifest: expect.arrayContaining([expect.objectContaining({
        bindingIndex: 6,
        bindingHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        location: '/sections/0/markdown',
        span: 'The application advice favors bullet points for speaking.',
        sourceFactIds: ['yc-bullets'],
      })]),
    });
  });

  it.each([
    ['unrelated citation', 'The application advice favors bullet points for speaking.', 'ftc-basis', 'ftc-basis concerns substantiation of advertising claims, not speaking from bullets.'],
    ['lexically overlapping outcome', 'Objective advertising claims double conversion.', 'ftc-basis', 'A reasonable basis for advertising claims does not imply a conversion gain.'],
    ['unsupported extension', 'The current guidance recommends speaking from bullets and guarantees investor interest.', 'yc-bullets', 'The snippet recommends bullets but says nothing about investor interest or a guarantee.'],
    ['unseen body detail', 'The application guidance includes a five-minute script template.', 'yc-bullets', 'The snippet mentions speaking from bullets, not a script template or its duration; the body was not supplied.'],
    ['unlabelled invented example', 'A founder won funding after following these bullets.', 'yc-bullets', 'No actual founder outcome is evidenced and this invented example is not labelled hypothetical.'],
    ['implicit unapproved capability', 'Automatic subtitles appear after each recording.', 'yc-bullets', 'In this product workflow this implies an unapproved capability, with neither an approved claim nor an allowed product fact.'],
  ])('blocks %s when the independent critic rejects support, even if repair issue checks claim success', async (_label, span, factId, rationale) => {
    const unsupported = withSourceClaim(span, factId);
    const supportEvaluations = supportedBindings(unsupported).map((evaluation) => (
      unsupported.claimBindings[evaluation.bindingIndex].location === '/sections/0/markdown'
        ? { ...evaluation, supported: false, rationale }
        : evaluation
    ));
    const critique: DraftCritiqueV1 = {
      schemaVersion: 1,
      approved: false,
      issues: [{ id: 'unsupported-source-claim', code: 'source.unsupported', message: rationale, repairInstruction: 'Remove unsupported assertions or use a supported paraphrase.' }],
      supportEvaluations,
    };
    // There is no lexical heuristic gate: the independent negative support judgment must block ready.
    expect(inspectGeneratedDraft(context, unsupported)).toEqual([]);
    const client = new FixtureStructuredClient([
      unsupported,
      critique,
      unsupported,
      { ...resolvedVerification(critique, unsupported), supportEvaluations },
    ]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);

    expect(outcome).toMatchObject({ status: 'blocked', reason: 'content_safety_failed', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'critique.support_rejected', message: expect.stringContaining(rationale) }),
    ]) });
    expect(outcome).not.toHaveProperty('bundle');
    expect(client.requests).toHaveLength(4);
  });

  it.each([
    ['missing sentence', (items: DraftCritiqueV1['supportEvaluations']) => items.slice(1), 'critique.support_incomplete'],
    ['missing FAQ', (items: DraftCritiqueV1['supportEvaluations']) => items.filter(({ bindingIndex }) => bindingIndex !== 9), 'critique.support_incomplete'],
    ['missing graphic label', (items: DraftCritiqueV1['supportEvaluations']) => items.filter(({ bindingIndex }) => bindingIndex !== 14), 'critique.support_incomplete'],
    ['duplicate index', (items: DraftCritiqueV1['supportEvaluations']) => [...items, items[0]], 'critique.support_unexpected'],
    ['unknown index', (items: DraftCritiqueV1['supportEvaluations']) => [...items, { ...items[0], bindingIndex: 999 }], 'critique.support_unexpected'],
    ['stale hash', (items: DraftCritiqueV1['supportEvaluations']) => items.map((item, i) => i === 0 ? { ...item, bindingHash: '0'.repeat(64) } : item), 'critique.support_stale'],
    ['false product classification', (items: DraftCritiqueV1['supportEvaluations']) => items.map((item, i) => i === 0 ? { ...item, kind: 'product_claim' as const } : item), 'critique.support_kind'],
  ] as const)('fails closed on %s in both independent support reviews', async (_label, change, code) => {
    const paraphrase = withSourceClaim('The application advice favors bullet points for speaking.');
    const supportEvaluations = change(supportedBindings(paraphrase));
    const client = new FixtureStructuredClient([
      paraphrase,
      { ...approvedCritique, supportEvaluations },
      paraphrase,
      { ...resolvedVerification(approvedCritique, paraphrase), supportEvaluations },
    ]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);

    expect(outcome).toMatchObject({ status: 'blocked', reason: 'content_safety_failed', findings: expect.arrayContaining([
      expect.objectContaining({ code }),
    ]) });
    expect(client.requests).toHaveLength(4);
    expect(client.requests[2].input).toMatchObject({ bindingSupportFindings: expect.arrayContaining([expect.objectContaining({ code })]) });
  });

  it.each(['text', 'fact IDs', 'location'] as const)('requires fresh support for repaired %s even when all original issues are resolved', async (change) => {
    const original = withSourceClaim('The application advice favors bullet points for speaking.');
    const critique: DraftCritiqueV1 = {
      schemaVersion: 1,
      approved: false,
      issues: [{ id: 'revise', code: 'copy.revise', message: 'Revise the explanation.', repairInstruction: 'Use a clearer explanation.' }],
      supportEvaluations: supportedBindings(original),
    };
    const repaired = change === 'text'
      ? withSourceClaim('The application advice recommends using bullet points when speaking.')
      : change === 'fact IDs'
        ? withSourceClaim(original.sections[0].markdown, 'ftc-basis')
        : { ...structuredClone(original), claimBindings: [...original.claimBindings].reverse() };
    const staleVerification = { ...resolvedVerification(critique, repaired), supportEvaluations: supportedBindings(original) };
    const client = new FixtureStructuredClient([original, critique, repaired, staleVerification]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);

    expect(outcome).toMatchObject({ status: 'blocked', reason: 'content_safety_failed', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'critique.support_stale' }),
    ]) });
    expect(client.requests).toHaveLength(4);
    expect(client.requests[3].input).toMatchObject({ originalIssues: critique.issues, repairedDraft: repaired });
    expect((client.requests[3].input as { bindingManifest: unknown }).bindingManifest)
      .not.toEqual((client.requests[1].input as { bindingManifest: unknown }).bindingManifest);
  });

  it('distinguishes explicitly supplied body facts from legacy search titles and snippets', async () => {
    const provenanceContext = structuredClone(context);
    provenanceContext.sourceFacts[0].facts[0].evidenceKind = 'body';
    provenanceContext.sourceFacts[1].facts[0].evidenceKind = 'serp_snippet';
    const client = new FixtureStructuredClient([draft, approvedCritique]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(provenanceContext);

    expect(outcome.status).toBe('ready');
    expect(client.requests[1].input).toMatchObject({ sourceFacts: [
      expect.objectContaining({ facts: expect.arrayContaining([
        expect.objectContaining({ id: 'yc-bullets', evidenceKind: 'body' }),
        expect.objectContaining({ id: 'fixture-description', evidenceKind: 'serp_title_or_snippet' }),
      ]) }),
      expect.objectContaining({ facts: [expect.objectContaining({ id: 'ftc-basis', evidenceKind: 'serp_snippet' })] }),
    ] });
    expect(JSON.stringify(client.requests)).not.toContain(context.sourceFacts[0].excerpt);
  });

  it('never accepts legacy blanket approval with no per-binding support coverage', async () => {
    const client = new FixtureStructuredClient([
      draft,
      { schemaVersion: 1, approved: true, issues: [] },
      draft,
      { schemaVersion: 1, approved: true, evaluations: [], newIssues: [] },
    ]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);

    expect(outcome).toMatchObject({ status: 'blocked', reason: 'content_safety_failed' });
    expect(outcome).not.toHaveProperty('bundle');
    expect(client.requests).toHaveLength(4);
  });

  it('returns a blocking media brief without a DraftBundle or model call when no mapping is suitable', async () => {
    const client = new FixtureStructuredClient([draft, approvedCritique]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({
      status: 'blocked',
      reason: 'media_mapping_required',
      mediaBrief: {
        candidateFingerprint: fingerprint,
        slug: candidate.slug,
        requiredWidth: 1200,
        requiredHeight: 675,
      },
    });
    expect(outcome).not.toHaveProperty('bundle');
    expect(client.requests).toHaveLength(0);
  });

  it.each([
    { src: '/landing/../private/product.mp4' },
    { poster: '/landing/%2e%2e/private/product.jpg' },
    { src: '/landing/%25252e%25252e/private/product.mp4' },
    { candidateFingerprints: undefined, keywordIncludes: ['---'] },
  ])('blocks an invalid media mapping before any model call', async (mediaChange) => {
    const client = new FixtureStructuredClient([draft, approvedCritique]);
    const drafter = createStructuredDrafter({
      client,
      mediaAllowlist: [{ ...media, ...mediaChange }],
    });

    await expect(drafter.draft(context)).resolves.toMatchObject({
      status: 'blocked',
      reason: 'media_mapping_required',
    });
    expect(client.requests).toHaveLength(0);
  });

  it('rejects secret-like selected media before any model call', async () => {
    const client = new FixtureStructuredClient([draft, approvedCritique]);
    const drafter = createStructuredDrafter({
      client,
      mediaAllowlist: [{ ...media, alt: 'Synthetic github_pat_fixture_123456789 credential' }],
    });

    await expect(drafter.draft(context)).rejects.toThrow(/secret/i);
    expect(client.requests).toHaveLength(0);
  });

  it('always drafts then independently critiques before returning a bundle', async () => {
    const client = new FixtureStructuredClient([draft, approvedCritique]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({ status: 'ready', repaired: false });
    expect(outcome).toHaveProperty('bundle.markdown');
    expect(client.requests.map(({ name }) => name)).toEqual([
      'videoclaw_article_draft_v2',
      'videoclaw_article_critique_v1',
    ]);
    expect(client.requests[1].system).toMatch(/independent/i);
    expect(JSON.stringify(client.requests)).not.toContain(context.sourceFacts[0].excerpt);
  });

  it('does not send a generated secret-like draft into the critic context', async () => {
    const secretDraft = {
      ...structuredClone(draft),
      editorialGraphic: {
        ...structuredClone(draft.editorialGraphic),
        title: 'Synthetic github_pat_generated_fixture_123456789 credential',
      },
    };
    const client = new FixtureStructuredClient([secretDraft, approvedCritique]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({ status: 'blocked', reason: 'content_safety_failed' });
    if (outcome.status !== 'blocked' || outcome.reason !== 'content_safety_failed') {
      throw new Error('Expected content-safety block.');
    }
    expect(outcome.findings).toContainEqual(expect.objectContaining({ code: 'content.secret' }));
    expect(client.requests).toHaveLength(1);
    expect(JSON.stringify(client.requests)).not.toContain('github_pat_generated_fixture_123456789');
  });

  it('does not send a secret-like critic issue into the repair context', async () => {
    const secretCritique: DraftCritiqueV1 = {
      supportEvaluations: supportedBindings(),
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'unsafe-critic-output',
        code: 'copy.revise',
        message: 'Synthetic apify_api_critic_fixture_123456789 credential',
        repairInstruction: 'Revise the description.',
      }],
    };
    const client = new FixtureStructuredClient([draft, secretCritique, draft]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({
      status: 'blocked',
      reason: 'content_safety_failed',
      findings: [{ code: 'content.secret' }],
    });
    expect(client.requests).toHaveLength(2);
    expect(JSON.stringify(client.requests)).not.toContain('apify_api_critic_fixture_123456789');
  });

  it('rejects a critic response that tries to supply its own acceptance predicate', async () => {
    const selfAttestedCritique = {
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'self-attested',
        code: 'copy.revise',
        message: 'Revise the copy.',
        repairInstruction: 'Revise the description.',
        predicate: { path: '/description', operator: 'contains', value: 'anything' },
      }],
    };
    const client = new FixtureStructuredClient([draft, selfAttestedCritique]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    await expect(drafter.draft(context)).rejects.toThrow(/predicate|unrecognized/i);
    expect(client.requests).toHaveLength(2);
  });

  it('runs exactly one repair when the independent critique rejects the first draft', async () => {
    const critique: DraftCritiqueV1 = {
      supportEvaluations: supportedBindings(),
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'description-specificity',
        code: 'copy.too_generic',
        message: 'Make the opening more specific to the candidate.',
        repairInstruction: 'Name the founder pitch workflow in the opening.',
      }],
    };
    const repairedDraft = draftWithBoundDescription(replacementDescriptions.detailed);
    const client = new FixtureStructuredClient([draft, critique, repairedDraft, resolvedVerification(critique, repairedDraft)]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({ status: 'ready', repaired: true });
    expect(client.requests.map(({ name }) => name)).toEqual([
      'videoclaw_article_draft_v2',
      'videoclaw_article_critique_v1',
      'videoclaw_article_repair_v2',
      'videoclaw_article_repair_verification_v1',
    ]);
    expect(JSON.stringify(outcome)).toContain(repairedDraft.description);
  });

  it('requires clean post-repair verification before accepting a repaired issue', async () => {
    const firstCritique: DraftCritiqueV1 = {
      supportEvaluations: supportedBindings(),
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'description-specificity',
        code: 'copy.too_generic',
        message: 'Make the opening more specific to the candidate.',
        repairInstruction: 'Name the founder pitch workflow in the opening.',
      }],
    };
    const repairedDraft = draftWithBoundDescription(replacementDescriptions.concise);
    const client = new FixtureStructuredClient([
      draft,
      firstCritique,
      repairedDraft,
      resolvedVerification(firstCritique, repairedDraft),
    ]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({ status: 'ready', repaired: true });
    expect(client.requests.map(({ name }) => name)).toEqual([
      'videoclaw_article_draft_v2',
      'videoclaw_article_critique_v1',
      'videoclaw_article_repair_v2',
      'videoclaw_article_repair_verification_v1',
    ]);
    expect(client.requests[3]).toMatchObject({
      input: {
        originalIssues: firstCritique.issues,
        repairedDraft,
      },
    });
  });

  it.each([true, false])('blocks when post-repair verification omits an original critic issue (approved: %s)', async (approved) => {
    const firstCritique: DraftCritiqueV1 = {
      supportEvaluations: supportedBindings(),
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'description-specificity',
        code: 'copy.too_generic',
        message: 'Make the opening more specific to the candidate.',
        repairInstruction: 'Name the founder pitch workflow in the opening.',
      }],
    };
    const repairedDraft = draftWithBoundDescription(replacementDescriptions.concise);
    const forgetfulVerification = {
      supportEvaluations: supportedBindings(repairedDraft),
      schemaVersion: 1,
      approved,
      evaluations: [],
      newIssues: [],
    };
    const client = new FixtureStructuredClient([
      draft,
      firstCritique,
      repairedDraft,
      forgetfulVerification,
    ]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({
      status: 'blocked',
      reason: 'content_safety_failed',
      findings: [expect.objectContaining({
        code: 'critique.verification_incomplete',
        issueId: 'description-specificity',
      })],
    });
    expect(client.requests.filter(({ name }) => name === 'videoclaw_article_repair_v2')).toHaveLength(1);
  });

  it('blocks a new issue found during post-repair verification without repairing again', async () => {
    const firstCritique: DraftCritiqueV1 = {
      supportEvaluations: supportedBindings(),
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'description-specificity',
        code: 'copy.too_generic',
        message: 'Make the opening more specific to the candidate.',
        repairInstruction: 'Name the founder pitch workflow in the opening.',
      }],
    };
    const verification: DraftRepairVerificationV1 = {
      ...resolvedVerification(firstCritique),
      approved: false,
      newIssues: [{
        id: 'new-legal-risk',
        code: 'legal.new_risk',
        message: 'The repaired wording introduces a new legal risk.',
        repairInstruction: 'Remove the new legal risk.',
      }],
    };
    const client = new FixtureStructuredClient([
      draft,
      firstCritique,
      structuredClone(draft),
      verification,
      structuredClone(draft),
    ]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({
      status: 'blocked',
      reason: 'content_safety_failed',
      findings: [expect.objectContaining({
        code: 'legal.new_risk',
        issueId: 'new-legal-risk',
      })],
    });
    expect(client.requests.filter(({ name }) => name === 'videoclaw_article_repair_v2')).toHaveLength(1);
    expect(client.requests).toHaveLength(4);
  });

  it('blocks an unrelated repair when the second critique still rejects it and never repairs twice', async () => {
    const firstCritique: DraftCritiqueV1 = {
      supportEvaluations: supportedBindings(),
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'source-specificity',
        code: 'copy.unspecific',
        message: 'The source explanation is too generic.',
        repairInstruction: 'Explain the source guidance.',
      }],
    };
    const secondVerification: DraftRepairVerificationV1 = {
      supportEvaluations: supportedBindings(),
      schemaVersion: 1,
      approved: false,
      evaluations: [{
        issueId: 'source-specificity',
        resolved: false,
        message: 'The source explanation remains too generic.',
      }],
      newIssues: [],
    };
    const unrelatedRepair = {
      ...structuredClone(draft),
      sections: [
        { ...structuredClone(draft.sections[0]), heading: 'Changed' },
        structuredClone(draft.sections[1]),
      ],
      claimBindings: draft.claimBindings.map((binding) => binding.location === '/sections/0/heading'
        ? { ...binding, span: 'Changed', sourceFactIds: ['fixture-heading-changed'] }
        : structuredClone(binding)),
    };
    const client = new FixtureStructuredClient([
      draft,
      firstCritique,
      unrelatedRepair,
      secondVerification,
      structuredClone(draft),
    ]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({ status: 'blocked', reason: 'content_safety_failed' });
    if (outcome.status !== 'blocked' || outcome.reason !== 'content_safety_failed') {
      throw new Error('Expected content-safety block.');
    }
    expect(outcome.findings).toContainEqual(expect.objectContaining({
      code: 'copy.unspecific',
      issueId: 'source-specificity',
    }));
    expect(client.requests.filter(({ name }) => name === 'videoclaw_article_repair_v2')).toHaveLength(1);
    expect(client.requests).toHaveLength(4);
  });

  it('blocks after one repair when deterministic safety findings remain', async () => {
    const unsafeDraft = {
      ...structuredClone(draft),
      sections: [
        { heading: 'Unsafe', markdown: '<script>doNotRun()</script>' },
        draft.sections[1],
      ],
    };
    const client = new FixtureStructuredClient([
      unsafeDraft,
      approvedCritique,
      unsafeDraft,
      resolvedVerification(approvedCritique),
    ]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({ status: 'blocked', reason: 'content_safety_failed' });
    if (outcome.status !== 'blocked' || outcome.reason !== 'content_safety_failed') {
      throw new Error('Expected content-safety block.');
    }
    expect(outcome.findings).toContainEqual(expect.objectContaining({ code: 'content.raw_html' }));
    expect(outcome).not.toHaveProperty('bundle');
    expect(client.requests).toHaveLength(4);
  });

  describe('bounded repair of final materialization failures', () => {
    const sourcesFinding = {
      code: 'content.body_sources',
      message: 'Sources must be rendered from frontmatter.sources, not a generated body section.',
    };
    const duplicateSources = {
      ...structuredClone(draft),
      sections: [{ ...draft.sections[0], heading: 'Sources' }, draft.sections[1]],
      claimBindings: draft.claimBindings.map((binding) => binding.location === '/sections/0/heading'
        ? { ...binding, span: 'Sources' }
        : binding),
    };
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(duplicateSources) };

    it('repairs final-only findings even after an otherwise approved initial draft', async () => {
      expect(inspectGeneratedDraft(context, duplicateSources)).toEqual([]);
      const client = new FixtureStructuredClient([duplicateSources, critique, draft, resolvedVerification(critique)]);

      const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);

      expect(outcome).toMatchObject({ status: 'ready', repaired: true });
      expect(client.requests.map(({ name }) => name)).toEqual([
        'videoclaw_article_draft_v2', 'videoclaw_article_critique_v1',
        'videoclaw_article_repair_v2', 'videoclaw_article_repair_verification_v1',
      ]);
      expect(client.requests[2].input).toMatchObject({ deterministicFindings: [sourcesFinding] });
      if (outcome.status !== 'ready') throw new Error('Expected repaired artifact.');
      expect(outcome.bundle.markdown).not.toMatch(/^## Sources$/gm);
    });

    it('returns exact final findings when the one repair still cannot materialize', async () => {
      const client = new FixtureStructuredClient([
        duplicateSources, critique, duplicateSources, resolvedVerification(critique, duplicateSources),
      ]);

      await expect(createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context)).resolves.toEqual({
        status: 'blocked', reason: 'content_safety_failed', findings: [sourcesFinding],
      });
      expect(client.requests).toHaveLength(4);
      expect(client.requests[2].input).toMatchObject({ deterministicFindings: [sourcesFinding] });
    });

    it('blocks a final artifact failure introduced by repair without a second repair', async () => {
      const rejected = {
        ...approvedCritique, approved: false,
        issues: [{ id: 'copy-clarity', code: 'copy.clarity', message: 'Clarify the opening.', repairInstruction: 'Clarify the opening.' }],
      };
      const client = new FixtureStructuredClient([
        draft, rejected, duplicateSources, resolvedVerification(rejected, duplicateSources),
      ]);

      await expect(createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context)).resolves.toEqual({
        status: 'blocked', reason: 'content_safety_failed', findings: [sourcesFinding],
      });
      expect(client.requests).toHaveLength(4);
    });
  });

  it('blocks an unchanged repair after the independent critic rejected the draft', async () => {
    const critique: DraftCritiqueV1 = {
      supportEvaluations: supportedBindings(),
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'workflow-specificity',
        code: 'copy.unspecific',
        message: 'The workflow needs a more specific explanation.',
        repairInstruction: 'Make the workflow explanation specific.',
      }],
    };
    const client = new FixtureStructuredClient([
      draft,
      critique,
      structuredClone(draft),
      unresolvedVerification(critique),
    ]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({
      status: 'blocked',
      reason: 'content_safety_failed',
      findings: [{ code: 'copy.unspecific', issueId: 'workflow-specificity' }],
    });
    expect(client.requests).toHaveLength(4);
  });

  it('blocks a repair that edits an unrelated field when the second critique still rejects it', async () => {
    const critique: DraftCritiqueV1 = {
      supportEvaluations: supportedBindings(),
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'source-specificity',
        code: 'copy.unspecific',
        message: 'The source explanation is too generic.',
        repairInstruction: 'Explain that the guidance recommends speaking from bullets.',
      }],
    };
    const unrelatedRepair = {
      ...structuredClone(draft),
      sections: [
        { ...structuredClone(draft.sections[0]), heading: 'Alternate' },
        structuredClone(draft.sections[1]),
      ],
      claimBindings: draft.claimBindings.map((binding) => binding.location === '/sections/0/heading'
        ? { ...binding, span: 'Alternate', sourceFactIds: ['fixture-heading-alternate'] }
        : structuredClone(binding)),
    };
    const client = new FixtureStructuredClient([
      draft,
      critique,
      unrelatedRepair,
      unresolvedVerification(critique, unrelatedRepair),
    ]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({
      status: 'blocked',
      reason: 'content_safety_failed',
      findings: [{ code: 'copy.unspecific', issueId: 'source-specificity' }],
    });
    expect(client.requests).toHaveLength(4);
  });

  it.each([
    [
      'a mismatched candidate fingerprint',
      { evidence: { ...context.evidence, candidateFingerprint: 'candidate:wrong:fingerprint' } },
      /fingerprint/i,
    ],
    [
      'provenance for another query',
      { provenance: { ...context.provenance, query: 'different query' } },
      /query/i,
    ],
    [
      'a source fact not bound to a reachable checked final URL',
      { checkedSources: [{ ...context.checkedSources[0], reachable: false }, context.checkedSources[1]] },
      /checked source/i,
    ],
    [
      'fewer than two distinct normalized checked final URLs',
      {
        evidence: {
          ...context.evidence,
          sources: [
            ...context.evidence.sources,
            { originalUrl: 'https://videoclaw.com/features', finalUrl: 'https://videoclaw.com/features', authoritative: true },
          ],
        },
        checkedSources: [
          context.checkedSources[0],
          { ...context.checkedSources[1], finalUrl: 'https://www.ycombinator.com/video/#duplicate' },
          {
            url: 'https://videoclaw.com/features',
            finalUrl: 'https://videoclaw.com/features',
            status: 200,
            reachable: true,
            authoritative: true,
          },
        ],
        sourceFacts: [
          context.sourceFacts[0],
          { ...context.sourceFacts[1], url: 'https://www.ycombinator.com/video/' },
        ],
      },
      /distinct normalized checked final URLs/i,
    ],
    [
      'a loose generated timestamp',
      { generatedAt: 'September 5, 2026 02:00 UTC' },
      /ISO date-time/i,
    ],
    [
      'a date-only source check timestamp',
      { sourceFacts: [{ ...context.sourceFacts[0], checkedAt: '2026-09-04' }, context.sourceFacts[1]] },
      /source checkedAt.*ISO date-time/i,
    ],
    [
      'an empty source label',
      { sourceFacts: [{ ...context.sourceFacts[0], label: '   ' }, context.sourceFacts[1]] },
      /source fact input/i,
    ],
    [
      'a multiline source label',
      { sourceFacts: [{ ...context.sourceFacts[0], label: 'Trusted source\nInjected prose' }, context.sourceFacts[1]] },
      /source fact input/i,
    ],
    [
      'a control-bearing source label',
      { sourceFacts: [{ ...context.sourceFacts[0], label: 'Trusted\u0007source' }, context.sourceFacts[1]] },
      /source fact input/i,
    ],
    [
      'a Unicode format-control source label',
      { sourceFacts: [{ ...context.sourceFacts[0], label: 'Trusted\u202Esource' }, context.sourceFacts[1]] },
      /source fact input/i,
    ],
    [
      'a source URL containing credentials',
      { sourceFacts: [{ ...context.sourceFacts[0], url: 'https://fixture:secret@example.com/source' }, context.sourceFacts[1]] },
      /source fact input/i,
    ],
    [
      'a blank source fact',
      { sourceFacts: [{ ...context.sourceFacts[0], facts: [{ id: 'yc-bullets', text: '   ' }] }, context.sourceFacts[1]] },
      /source fact input/i,
    ],
    [
      'a secret-like value in model-bound source facts',
      {
        sourceFacts: [{
          ...context.sourceFacts[0],
          facts: [{ id: 'yc-bullets', text: 'API_KEY=abcdefghijklmnop123456' }],
        }, context.sourceFacts[1]],
      },
      /secret/i,
    ],
    [
      'a raw Apify token in outbound model context',
      {
        sourceFacts: [{
          ...context.sourceFacts[0],
          facts: [{ id: 'yc-bullets', text: 'Synthetic apify_api_fixture_123456789 token' }],
        }, context.sourceFacts[1]],
      },
      /secret/i,
    ],
  ])('rejects %s before sending model content', async (_label, changes, expected) => {
    const client = new FixtureStructuredClient([draft, approvedCritique]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    await expect(drafter.draft({ ...context, ...changes })).rejects.toThrow(expected);
    expect(client.requests).toHaveLength(0);
  });
});
