import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { candidateFingerprints, type Candidate } from './domain';
import type { StructuredOutputClient, StructuredOutputRequest } from './openai-responses';
import {
  createStructuredDrafter,
  finalizeReviewedRepair,
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
import { GENERATED_DRAFT_V2_JSON_SCHEMA, inspectGeneratedDraft, productReferenceManifest } from './content-bundle';
import { measureReviewedSourceUse } from './source-plan';

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
      facts: [{ id: 'yc-bullets', text: 'The current guidance recommends speaking from bullets.' },
        { id: 'faq-planning', text: 'To plan a founder pitch video, choose a problem and prepare bullet points before recording.', evidenceKind: 'body' },
        { id: 'faq-contents', text: 'A founder pitch video should include an introduction and a concise explanation of the product.', evidenceKind: 'body' },
        { id: 'faq-duration', text: 'A founder pitch video should last one minute for this specific application.', evidenceKind: 'body' }],
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
  customerTrigger: candidate.icp,
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

// These are synthetic support fixtures, not assertions about the real publishers.
// Distribute their fact inventory so ordinary happy-path tests do not rely on an
// article whose entire public copy exceeds one source's cumulative allowance.
[...new Map(baselineDraftClaims.map(({ id, span }) => [id, { id, text: span }])).values()]
  .forEach((fact, i) => context.sourceFacts[i % 2].facts.push(fact));
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
      ? { ...binding, span: replacement.text }
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
    // Synthetic descriptions summarize this article's guidance; FAQs are our
    // advice. Neither attributes these steps to a publisher. Keep that same
    // classification before AND after repair; budget tests override explicitly.
    kind: binding.productClaimId !== null ? 'product_claim'
      : binding.location === '/description' || binding.location.startsWith('/faqAnswers/') ? 'original_guidance' : 'source_claim',
    rationale: binding.location === '/description' ? 'Article-added summary of the practical guidance below, not an external publisher claim.'
      : `Fixture source ${binding.sourceFactIds.join(', ')} supports this span without added assertions.`,
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
    const output = this.outputs.shift();
    return typeof output === 'function' ? output(request) : output;
  }
}

// Simulate the external verifier copying the registry it actually receives.
// Tests below independently assert registry contents, coverage and rejection.
function verifyRequest(repaired = draft) {
  return (request: StructuredOutputRequest): DraftRepairVerificationV1 => ({
    schemaVersion: 1, approved: true, newIssues: [], supportEvaluations: supportedBindings(repaired),
    evaluations: (request.input as { originalIssues: DraftCritiqueV1['issues'] }).originalIssues.map(issue => ({
      issueId: issue.id, resolved: true, message: 'This issue is resolved in the supplied replacement.',
    })),
  });
}

describe('finalizeReviewedRepair', () => {
  // Captured IDs are deliberately unrelated to the current checker's findings.
  const originalIssues: DraftCritiqueV1['issues'] = [{
    id: 'check-captured-before-parser-fix', code: 'content.claim_binding',
    message: 'The old checker reported a binding mismatch.',
    repairInstruction: 'Correct the reported binding.',
  }];
  function input() {
    return structuredClone({
      context, repaired: draft, originalIssues, media,
      verification: resolvedVerification({ ...approvedCritique, approved: false, issues: originalIssues }),
    });
  }

  it('materializes unchanged saved JSON using the exact captured issue registry without mutating inputs', () => {
    const saved = input();
    const before = structuredClone(saved);
    expect(inspectGeneratedDraft(saved.context, saved.repaired)).toEqual([]);
    const result = finalizeReviewedRepair(saved);
    expect(result).toMatchObject({ status: 'ready', repaired: true });
    if (result.status !== 'ready') throw new Error('Expected a reviewed bundle.');
    expect(result.bundle.markdown).toContain(draft.directAnswer);
    expect(result.bundle.markdown).toContain('/landing/full/founder-product.mp4');
    expect(saved).toEqual(before);
  });

  it.each([
    ['unresolved', 'content.claim_binding'],
    ['missing', 'critique.verification_incomplete'],
    ['orphan', 'critique.verification_unexpected'],
    ['withheld', 'critique.verification_rejected'],
    ['new issue', 'copy.new_issue'],
  ])('blocks a %s original independent verdict', (kind, code) => {
    const saved = input();
    if (kind === 'unresolved') {
      saved.verification.approved = false;
      saved.verification.evaluations[0].resolved = false;
    } else if (kind === 'missing') saved.verification.evaluations = [];
    else if (kind === 'orphan') saved.verification.evaluations.push({ issueId: 'invented-id', resolved: true, message: 'Resolved.' });
    else if (kind === 'withheld') saved.verification.approved = false;
    else {
      saved.verification.approved = false;
      saved.verification.newIssues = [{ ...originalIssues[0], id: 'new-issue', code }];
    }
    const result = finalizeReviewedRepair(saved);
    expect(result).toMatchObject({ status: 'blocked', reason: 'content_safety_failed', findings: expect.arrayContaining([
      expect.objectContaining({ code, ...(['unresolved', 'missing'].includes(kind) ? { issueId: originalIssues[0].id } : {}) }),
    ]) });
    expect(result).not.toHaveProperty('bundle');
  });

  it.each([
    ['stale', 'critique.support_stale'],
    ['unsupported', 'critique.support_rejected'],
    ['missing', 'critique.support_incomplete'],
    ['duplicate', 'critique.support_unexpected'],
    ['orphan', 'critique.support_unexpected'],
    ['wrong kind', 'critique.support_kind'],
  ])('blocks %s binding support in the saved verdict', (kind, code) => {
    const saved = input();
    const items = saved.verification.supportEvaluations;
    if (kind === 'stale') items[0].bindingHash = '0'.repeat(64);
    else if (kind === 'unsupported') items[0].supported = false;
    else if (kind === 'missing') items.shift();
    else if (kind === 'duplicate') items.push({ ...items[0] });
    else if (kind === 'orphan') items.push({ ...items[0], bindingIndex: 999 });
    else items[0].kind = 'product_claim';
    const result = finalizeReviewedRepair(saved);
    expect(result).toMatchObject({ status: 'blocked', reason: 'content_safety_failed', findings: expect.arrayContaining([
      expect.objectContaining({ code }),
    ]) });
    expect(result).not.toHaveProperty('bundle');
  });

  it.each(['draft shape', 'verdict shape', 'duplicate evaluations', 'inconsistent approval'])('parses and rejects invalid %s', (kind) => {
    const saved = input();
    if (kind === 'draft shape') Object.assign(saved.repaired, { schemaVersion: 1 });
    else if (kind === 'verdict shape') Object.assign(saved.verification, { approved: 'true' });
    else if (kind === 'duplicate evaluations') saved.verification.evaluations.push({ ...saved.verification.evaluations[0] });
    else saved.verification.evaluations[0].resolved = false;
    expect(() => finalizeReviewedRepair(saved)).toThrow(expect.objectContaining({ name: 'ZodError' }));
  });

  it.each(['draft', 'verdict'])('blocks secret-like content in the saved %s', (kind) => {
    const saved = input();
    const secret = 'Synthetic github_pat_fixture_123456789 credential';
    if (kind === 'draft') saved.repaired.directAnswer = secret;
    else saved.verification.evaluations[0].message = secret;
    const result = finalizeReviewedRepair(saved);
    expect(result).toMatchObject({ status: 'blocked', reason: 'content_safety_failed', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'content.secret' }),
    ]) });
    expect(result).not.toHaveProperty('bundle');
  });

  it('blocks unsafe draft markup despite an approving saved verdict', () => {
    const saved = input();
    saved.repaired.sections[0].markdown = '<script>doNotRun()</script>';
    const result = finalizeReviewedRepair(saved);
    expect(result).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'content.raw_html' }),
    ]) });
    expect(result).not.toHaveProperty('bundle');
  });

  it('enforces reviewed cumulative source use despite complete approving support', () => {
    const saved = input();
    saved.repaired.claimBindings.forEach(binding => { binding.sourceFactIds = ['yc-bullets']; });
    saved.verification.supportEvaluations = supportedBindings(saved.repaired).map(item => ({ ...item, kind: 'source_claim' }));
    expect(inspectGeneratedDraft(saved.context, saved.repaired)).toEqual([]);
    const result = finalizeReviewedRepair(saved);
    expect(result).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'content.source_budget' }),
    ]) });
    expect(result).not.toHaveProperty('bundle');
  });

  it('returns final materialization findings after all review gates pass', () => {
    const saved = input();
    saved.repaired.sections[0].heading = 'Sources';
    saved.repaired.claimBindings.find(binding => binding.location === '/sections/0/heading')!.span = 'Sources';
    saved.verification.supportEvaluations = supportedBindings(saved.repaired);
    expect(inspectGeneratedDraft(saved.context, saved.repaired)).toEqual([]);
    expect(finalizeReviewedRepair(saved)).toEqual({
      status: 'blocked', reason: 'content_safety_failed', findings: [{
        code: 'content.body_sources',
        message: 'Sources must be rendered from frontmatter.sources, not a generated body section.',
      }],
    });
  });

  it.each(['fingerprint', 'unchecked source', 'context secret', 'media secret'])('enforces live %s preconditions', (kind) => {
    const saved = input();
    if (kind === 'fingerprint') saved.context.evidence.candidateFingerprint = 'different-candidate';
    else if (kind === 'unchecked source') saved.context.checkedSources[0].reachable = false;
    else if (kind === 'context secret') saved.context.sourceFacts[0].facts[0].text = 'Synthetic github_pat_fixture_123456789 credential';
    else saved.media.alt = 'Synthetic github_pat_fixture_123456789 credential';
    expect(() => finalizeReviewedRepair(saved)).toThrow(kind.endsWith('secret') ? /secret/i : /fingerprint|checked|reachable/i);
  });

  it.each([
    { src: '/landing/../private/product.mp4' },
    { poster: '/landing/%2e%2e/private/product.jpg' },
    { candidateFingerprints: ['another-candidate'] },
    { candidateFingerprints: undefined, keywordIncludes: ['---'] },
  ])('blocks unsafe or mismatched media using live selection rules: %j', (change) => {
    const saved = input();
    Object.assign(saved.media, change);
    const result = finalizeReviewedRepair(saved);
    expect(result).toMatchObject({ status: 'blocked', reason: 'media_mapping_required' });
    expect(result).not.toHaveProperty('bundle');
  });

  it('replays the actual live verifier input and verdict to the same result', async () => {
    const critique = { ...approvedCritique, approved: false, issues: originalIssues };
    let captured: ReturnType<typeof input> | undefined;
    const client = new FixtureStructuredClient([draft, critique, draft, (request: StructuredOutputRequest) => {
      const wire = request.input as { repairedDraft: GeneratedDraftV2; originalIssues: DraftCritiqueV1['issues'] };
      const verification = verifyRequest()(request);
      captured = structuredClone({ context, repaired: wire.repairedDraft, originalIssues: wire.originalIssues, verification, media });
      return verification;
    }]);
    const live = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(live).toMatchObject({ status: 'ready', repaired: true });
    expect(client.requests).toHaveLength(4);
    expect(captured).toBeDefined();
    expect(finalizeReviewedRepair(captured!)).toEqual(live);
  });
});

describe('consistent repair issue registry', () => {
  it('carries a heading-scoped body anchor through the real preflight to the model boundary', async () => {
    const input = structuredClone(context);
    const question = 'How do I record my screen for a founder pitch video?';
    input.evidence.faqQuestions[1] = question;
    input.evidence.serp.peopleAlsoAsk[1] = question;
    const heading = 'Record your founder pitch video ';
    input.sourceFacts[0].facts.push({id: 'recording-procedure', text: heading + 'Open the capture panel. Click Screen Recording.', bodyStart: heading.length, evidenceKind: 'body'});
    let request: StructuredOutputRequest | undefined;
    const client: StructuredOutputClient = {async generate(value) {request = value; throw new Error('fixture model boundary reached');}};
    await expect(createStructuredDrafter({client, mediaAllowlist: [media]}).draft(input)).rejects.toThrow('fixture model boundary reached');
    expect(request!.input).toMatchObject({faqEvidencePlan: expect.arrayContaining([
      {question, sourceFactIds: ['recording-procedure']},
    ])});
  });

  it('blocks a topical PAA question with no answer-shaped body evidence before any model call', async () => {
    const input = structuredClone(context);
    input.evidence.faqQuestions[1] = 'What is AI video marketing?';
    input.evidence.serp.peopleAlsoAsk[1] = input.evidence.faqQuestions[1];
    const client = new FixtureStructuredClient([draft, approvedCritique]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(input);
    expect(outcome).toMatchObject({ status: 'blocked', reason: 'content_safety_failed', findings: [expect.objectContaining({ code: 'research.faq_evidence_missing' })] });
    expect(client.requests).toHaveLength(0);
    expect(outcome).not.toHaveProperty('bundle');
  });

  it('supplies exact FAQ fact anchors without claiming that preflight establishes answer entailment', async () => {
    const client = new FixtureStructuredClient([draft, approvedCritique]);
    expect(await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context)).toMatchObject({ status: 'ready' });
    expect(client.requests[0].input).toMatchObject({ faqEvidencePlan: [
      { question: context.evidence.faqQuestions[0], sourceFactIds: ['faq-planning', 'faq-contents'] },
      { question: context.evidence.faqQuestions[1], sourceFactIds: ['faq-planning', 'faq-contents'] },
      { question: context.evidence.faqQuestions[2], sourceFactIds: ['faq-duration'] },
    ] });
  });

  function titleOnlyDraft() {
    const value = structuredClone(draft);
    value.description = candidate.title;
    value.claimBindings.find(binding => binding.location === '/description')!.span = candidate.title;
    return value;
  }
  it('gives a deterministic-only repair the same stable issue IDs at generation and verification', async () => {
    const initial = titleOnlyDraft();
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(initial) };
    const client = new FixtureStructuredClient([initial, critique, draft, verifyRequest()]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(outcome).toMatchObject({ status: 'ready', repaired: true });
    const repair = client.requests[2].input as { originalIssues: DraftCritiqueV1['issues'] };
    const verify = client.requests[3].input as { originalIssues: DraftCritiqueV1['issues'] };
    expect(repair.originalIssues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'content.description_duplicate' })]));
    expect(repair.originalIssues.length).toBeGreaterThan(0);
    expect(verify.originalIssues).toEqual(repair.originalIssues);
    expect(new Set(verify.originalIssues.map(issue => issue.id)).size).toBe(verify.originalIssues.length);
    const schema = client.requests[3].schema as typeof DRAFT_REPAIR_VERIFICATION_V1_JSON_SCHEMA;
    expect(schema.properties.evaluations.items.properties.issueId).toMatchObject({ enum: verify.originalIssues.map(issue => issue.id) });
    expect(client.requests).toHaveLength(4);
    for (const index of [0, 2]) {
      const draftSchema = client.requests[index].schema as typeof GENERATED_DRAFT_V2_JSON_SCHEMA;
      expect(draftSchema.properties.customerTrigger).toMatchObject({ enum: [candidate.icp] });
    }
    for (const request of client.requests) {
      expect(request.input).toMatchObject({ campaignContext: { customerTrigger: candidate.icp, provenance: 'candidate.icp' } });
    }
  });

  it.each(['omitted', 'unknown', 'unresolved'])('rejects %s deterministic repair verification even when the new copy is clean', async (mode) => {
    const initial = titleOnlyDraft();
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(initial) };
    const client = new FixtureStructuredClient([initial, critique, draft, (request: StructuredOutputRequest) => {
      const result = verifyRequest()(request);
      if (mode === 'omitted') result.evaluations = [];
      if (mode === 'unknown') result.evaluations.push({ issueId: 'invented-id', resolved: true, message: 'Not in the original registry.' });
      if (mode === 'unresolved' && result.evaluations[0]) {
        result.approved = false;
        result.evaluations[0].resolved = false;
      }
      return result;
    }]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(outcome).toMatchObject({ status: 'blocked', reason: 'content_safety_failed' });
    expect(outcome).not.toHaveProperty('bundle');
    expect(client.requests).toHaveLength(4);
  });

  it('keeps machine IDs stable across reruns and separates a colliding critic ID', async () => {
    const initial = titleOnlyDraft();
    const baseCritique = { ...approvedCritique, supportEvaluations: supportedBindings(initial) };
    const registries: DraftCritiqueV1['issues'][] = [];
    for (let i = 0; i < 3; i += 1) {
      const critique = i < 2 ? baseCritique : {
        ...baseCritique, approved: false,
        issues: [{ id: registries[0][0].id, code: 'copy.clarity', message: 'Clarify the help offered.', repairInstruction: 'Write a useful description.' }],
      };
      const client = new FixtureStructuredClient([initial, critique, draft, verifyRequest()]);
      expect(await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context)).toMatchObject({ status: 'ready' });
      registries.push((client.requests[2].input as { originalIssues: DraftCritiqueV1['issues'] }).originalIssues);
    }
    expect(registries[1]).toEqual(registries[0]);
    expect(registries[2]).toHaveLength(registries[0].length + 1);
    expect(new Set(registries[2].map(issue => issue.id)).size).toBe(registries[2].length);
    expect(registries[2].filter(issue => issue.code === 'content.description_duplicate')[0].id).not.toBe(registries[2][0].id);
  });

  it('rejects duplicate issue evaluations even when every duplicate is marked resolved', async () => {
    const initial = titleOnlyDraft();
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(initial) };
    const client = new FixtureStructuredClient([initial, critique, draft, (request: StructuredOutputRequest) => {
      const result = verifyRequest()(request);
      result.evaluations.push({ ...result.evaluations[0] });
      return result;
    }]);
    await expect(createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context)).rejects.toMatchObject({ name: 'ZodError' });
    expect(client.requests).toHaveLength(4);
  });
});

describe('contextual review and targeted bounded repair', () => {
  it('blocks citation removal from unchanged words before the final verification call', async () => {
    const initial = withSourceClaim('The application advice favors bullet points for speaking.');
    initial.claimBindings.find(binding => binding.location === '/sections/0/markdown')!.sourceFactIds.push('faq-planning');
    const repaired = withSourceClaim('The application advice favors bullet points for speaking!');
    const critique = { ...approvedCritique, approved: false, supportEvaluations: supportedBindings(initial), issues: [{
      id: 'narrow', code: 'copy.narrow', message: 'Narrow the advice.', repairInstruction: 'Remove unsupported wording.', locations: ['/sections/0/markdown'],
    }] };
    const client = new FixtureStructuredClient([initial, critique, repaired, verifyRequest(repaired)]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(outcome).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'repair.evidence_changed', location: '/sections/0/markdown' }),
    ]) });
    expect(client.requests).toHaveLength(3);
  });

  it('blocks punctuation-disguised section movement before verification despite equal counts and facts', async () => {
    const initial = structuredClone(draft);
    initial.sections = [{ heading: 'Plan carefully', markdown: 'Choose buyer scope.' }, { heading: 'Review carefully', markdown: 'Check final output.' }];
    for (const binding of initial.claimBindings.filter(binding => binding.location.startsWith('/sections/'))) {
      const index = Number(binding.location.split('/')[2]);
      binding.span = binding.location.endsWith('/heading') ? initial.sections[index].heading : initial.sections[index].markdown;
      binding.sourceFactIds = ['yc-bullets'];
    }
    const repaired = structuredClone(initial);
    repaired.sections.reverse();
    for (const section of repaired.sections) {
      section.heading += '!';
      section.markdown = section.markdown.replace('.', '!');
    }
    for (const binding of repaired.claimBindings.filter(binding => binding.location.startsWith('/sections/'))) {
      const index = Number(binding.location.split('/')[2]);
      binding.span = binding.location.endsWith('/heading') ? repaired.sections[index].heading : repaired.sections[index].markdown;
    }
    const critique = { ...approvedCritique, approved: false, supportEvaluations: supportedBindings(initial), issues: [{
      id: 'clarity', code: 'copy.clarity', message: 'Clarify the two sections.', repairInstruction: 'Preserve the section order.',
      locations: ['/sections/0/heading', '/sections/0/markdown', '/sections/1/heading', '/sections/1/markdown'],
    }] };
    const client = new FixtureStructuredClient([initial, critique, repaired, verifyRequest(repaired)]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(outcome).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([expect.objectContaining({ code: 'repair.structure_changed' })]) });
    expect(client.requests).toHaveLength(3);
  });

  it('blocks sentence partitioning that preserves visible words but removes source attribution', async () => {
    const initial = withSourceClaim('The current application advice favors bullet points for speaking.');
    initial.claimBindings.find(binding => binding.location === '/sections/0/markdown')!.sourceFactIds.push('ftc-basis');
    const repaired = structuredClone(initial);
    repaired.sections[0].markdown = 'The current application advice favors. Bullet points for speaking.';
    const binding = repaired.claimBindings.find(binding => binding.location === '/sections/0/markdown')!;
    binding.span = 'The current application advice favors.';
    binding.sourceFactIds = ['yc-bullets'];
    repaired.claimBindings.push({ ...binding, span: 'Bullet points for speaking.', sourceFactIds: ['ftc-basis'] });
    // Both ledgers and exact rendered sentence bindings are otherwise valid.
    expect(inspectGeneratedDraft(context, repaired)).toEqual([]);
    const critique = { ...approvedCritique, approved: false, supportEvaluations: supportedBindings(initial), issues: [{
      id: 'narrow', code: 'copy.narrow', message: 'Narrow the advice.', repairInstruction: 'Remove unsupported wording.', locations: ['/sections/0/markdown'],
    }] };
    const client = new FixtureStructuredClient([initial, critique, repaired, verifyRequest(repaired)]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(outcome).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'repair.evidence_changed', location: '/sections/0/markdown' }),
    ]) });
    expect(client.requests).toHaveLength(3);
  });

  it.each(['span_mismatch', 'missing_binding'] as const)('blocks a known initial %s before repair instead of comparing against undercounted usage', async reason => {
    const initial = withSourceClaim('The current application advice favors bullet points for speaking.'); // Nine visible words.
    const index = initial.claimBindings.findIndex(binding => binding.location === '/sections/0/markdown');
    if (reason === 'span_mismatch') initial.claimBindings[index].span = 'The application advice favors'; // Four bound words.
    else initial.claimBindings.splice(index, 1);
    const repaired = withSourceClaim('Use bullets for natural speaking.'); // Five words, a real cut from nine.
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(initial) };
    const client = new FixtureStructuredClient([initial, critique, repaired, verifyRequest(repaired)]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(outcome).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'content.claim_binding', reason, location: '/sections/0/markdown' }),
      expect.objectContaining({ code: 'repair.policy_invalid' }),
    ]) });
    expect(client.requests).toHaveLength(2);
    expect(outcome).not.toHaveProperty('bundle');
  });

  it('rejects unrelated rewriting before spending the final verification call', async () => {
    const initial = structuredClone(draft);
    const changed = structuredClone(draft);
    changed.sections[1].markdown = 'A two week cadence guarantees more leads.';
    changed.claimBindings.find(b => b.location === '/sections/1/markdown')!.span = changed.sections[1].markdown;
    const critique = { ...approvedCritique, approved: false, issues: [{ id: 'faq', code: 'FAQ_SUPPORT',
      message: 'Narrow the first FAQ.', repairInstruction: 'Keep the answer scoped to this application.', locations: ['/faqAnswers/0/answer'] }] };
    const client = new FixtureStructuredClient([initial, critique, changed, verifyRequest(changed)]);
    const result = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(result).toMatchObject({ status: 'blocked', reason: 'content_safety_failed', findings: expect.arrayContaining([expect.objectContaining({ code: 'repair.out_of_scope' })]) });
    expect(client.requests).toHaveLength(3);
    expect(result).not.toHaveProperty('bundle');
  });

  it.each(['TITLE_SCOPE_MISMATCH', 'EDITORIAL_MISSING_WORKFLOW'])(
    'does not grant article-wide edits to unlocalized %s and still blocks an unresolved repair', async (code) => {
      const scopedContext = structuredClone(context);
      scopedContext.candidate.title = 'Product Demo Checklist: Plan, Record and Rehearse';
      scopedContext.candidate.primaryKeyword = 'product demo checklist';
      scopedContext.provenance.query = 'product demo checklist';
      scopedContext.evidence.candidateFingerprint = candidateFingerprints(scopedContext.candidate).candidate;
      const scopedMedia = { ...media, candidateFingerprints: [scopedContext.evidence.candidateFingerprint] };
      const before = structuredClone(scopedContext);
      const initial = structuredClone(draft); // No recording workflow in its body sections.
      if (code === 'EDITORIAL_MISSING_WORKFLOW') {
        initial.description = scopedContext.candidate.title;
        initial.claimBindings.find(binding => binding.location === '/description')!.span = initial.description;
      }
      const issue = { id: 'ISS-001', code, message: 'The fixed title promises Record but the body has no actionable recording workflow.',
        repairInstruction: 'Add supported recording coverage to the body; a title edit or isolated reference fixes cannot resolve this issue.' };
      const critique = { ...approvedCritique, approved: false, issues: [issue], supportEvaluations: supportedBindings(initial) };
      // Deliberately leave the article-level defect unresolved: this is a routing
      // regression, not a fixture claiming that a real model repaired the article.
      const client = new FixtureStructuredClient([initial, critique, initial, unresolvedVerification(critique, initial)]);
      const outcome = await createStructuredDrafter({ client, mediaAllowlist: [scopedMedia] }).draft(scopedContext);
      const repair = client.requests[2].input as {
        repairStrategy: string; articleLevelIssues: DraftCritiqueV1['issues']; originalIssues: DraftCritiqueV1['issues'];
        deterministicFindings: Array<{ code: string }>; repairTargets: unknown[];
      };
      expect(repair.deterministicFindings.some(f => ['content.source_budget', 'content.source_allocation'].includes(f.code))).toBe(false);
      expect(repair.repairStrategy).toBe('targeted_repair');
      expect(repair.articleLevelIssues).toEqual([]);
      expect(repair.originalIssues).toContainEqual(issue);
      if (code === 'TITLE_SCOPE_MISMATCH') expect(repair.repairTargets).toEqual([]);
      else expect(repair.repairTargets.length).toBeGreaterThan(0);
      expect(client.requests[3].input).toMatchObject({ originalIssues: repair.originalIssues, repairedDraft: initial });
      for (const request of client.requests) expect(request.input).toMatchObject({
        candidate: before.candidate, evidence: before.evidence, productClaims: before.productClaims,
      });
      for (const index of [0, 2]) {
        const schema = client.requests[index].schema as typeof GENERATED_DRAFT_V2_JSON_SCHEMA;
        expect(schema.additionalProperties).toBe(false);
        expect(schema.properties).not.toHaveProperty('title');
      }
      expect(outcome).toMatchObject({ status: 'blocked', reason: 'content_safety_failed',
        findings: expect.arrayContaining([expect.objectContaining({ code, issueId: 'ISS-001' })]) });
      expect(outcome).not.toHaveProperty('bundle');
      expect(client.requests.map(request => request.name)).toEqual([
        'videoclaw_article_draft_v2', 'videoclaw_article_critique_v1',
        'videoclaw_article_repair_v2', 'videoclaw_article_repair_verification_v1',
      ]);
      expect(scopedContext).toEqual(before);
    });

  it('keeps a localized machine-only description repair targeted', async () => {
    const initial = structuredClone(draft);
    initial.description = candidate.title;
    initial.claimBindings.find(binding => binding.location === '/description')!.span = initial.description;
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(initial) };
    const client = new FixtureStructuredClient([initial, critique, draft, verifyRequest()]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(client.requests[2].input).toMatchObject({ repairStrategy: 'targeted_repair', articleLevelIssues: [],
      repairTargets: expect.arrayContaining([expect.objectContaining({ location: '/description', span: candidate.title })]) });
    expect(outcome).toMatchObject({ status: 'ready', repaired: true });
    expect(client.requests).toHaveLength(4);
  });

  it.each([100, 190])('cuts a %i-word source passage to the planning target without changing its source or classification', async (count) => {
    // Synthetic long/short versions isolate accounting, not a real publisher's
    // prose. The same bound fact and independent source_claim classification
    // survive the reduction; no transfer to FTC and no relabelling as guidance.
    const initial = withSourceClaim(`${Array.from({ length: count }, (_, i) => `point${i}`).join(' ')}.`);
    const repaired = withSourceClaim('The application advice favors bullet points for speaking.');
    const initialUsage = measureReviewedSourceUse(context.sourceFacts, initial, supportedBindings(initial));
    const repairedUsage = measureReviewedSourceUse(context.sourceFacts, repaired, supportedBindings(repaired));
    expect(initialUsage.sources[0].derivedWords).toBeGreaterThan(120);
    if (count === 100) expect(initialUsage.sources[0].derivedWords).toBeLessThanOrEqual(180);
    else expect(initialUsage.sources[0].derivedWords).toBeGreaterThan(180);
    expect(repairedUsage.sources[0].derivedWords).toBeLessThanOrEqual(120);
    expect(repairedUsage.sources[1].derivedWords).toBe(initialUsage.sources[1].derivedWords);
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(initial) };
    const client = new FixtureStructuredClient([initial, critique, repaired, verifyRequest(repaired)]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(outcome).toMatchObject({ status: 'ready', repaired: true });
    expect(client.requests[2].input).toMatchObject({
      repairStrategy: 'bounded_source_reduction',
      articleLevelIssues: expect.arrayContaining([expect.objectContaining({ code: count === 100 ? 'content.source_allocation' : 'content.source_budget' })]),
      deterministicFindings: expect.arrayContaining([expect.objectContaining({ code: count === 100 ? 'content.source_allocation' : 'content.source_budget' })]),
    });
  });

  it('does not hard-limit contextual grounding of original guidance at the planning target', async () => {
    const initial = structuredClone(draft);
    initial.claimBindings.forEach(binding => { binding.sourceFactIds = ['yc-bullets']; });
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(initial).map(e => ({ ...e, kind: 'original_guidance' as const })) };
    const client = new FixtureStructuredClient([initial, critique]);
    expect(await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context)).toMatchObject({ status: 'ready', repaired: false });
    expect(client.requests).toHaveLength(2);
  });

  it.each(['fenced', 'indented', 'definition'])('blocks %s FAQ text with missing bindings before repair even if the initial critic approves', async (format) => {
    const value = structuredClone(draft);
    const prose = Array.from({ length: 181 }, (_, i) => `detail${i}`).join(' ');
    value.faqAnswers[0].answer = format === 'fenced' ? `\x60\x60\x60text\n${prose}\n\x60\x60\x60`
      : format === 'indented' ? `    ${prose}` : `[hidden]: ${context.sourceFacts[0].url} "${prose}"`;
    value.claimBindings = value.claimBindings.filter(b => b.location !== '/faqAnswers/0/answer');
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(value) };
    const client = new FixtureStructuredClient([value, critique, value, resolvedVerification(critique, value)]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(client.requests).toHaveLength(2);
    expect(outcome).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'content.claim_binding', location: '/faqAnswers/0/answer', reason: 'missing_binding' }),
    ]) });
    expect(outcome).not.toHaveProperty('bundle');
  });

  it.each([true, false])('blocks citation redistribution or unchanged over-budget copy despite approval (redistributed: %s)', async (redistributed) => {
    const initial = structuredClone(draft);
    // Deliberately point all spans to one fact. The fixture critic approves them;
    // code must still reject the cumulative source use rather than trusting approval.
    initial.claimBindings.forEach(binding => { binding.sourceFactIds = ['yc-bullets']; });
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(initial).map(e => ({ ...e, kind: 'source_claim' as const })) };
    const repaired = redistributed ? draft : initial;
    const client = new FixtureStructuredClient([initial, critique, repaired, (request: StructuredOutputRequest) => {
      const result = verifyRequest(repaired)(request);
      if (!redistributed) result.supportEvaluations = result.supportEvaluations.map(e => ({ ...e, kind: 'source_claim' as const }));
      return result;
    }]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(client.requests).toHaveLength(redistributed ? 3 : 4);
    expect(client.requests[2].input).toMatchObject({
      repairStrategy: 'bounded_source_reduction',
      articleLevelIssues: expect.arrayContaining([expect.objectContaining({ code: 'content.source_budget' })]),
      sourceUsage: { sources: expect.arrayContaining([expect.objectContaining({ sourceIds: ['yc'], maxDerivedWords: 180 })]) },
      sourceRepairPlan: {
        status: 'ready',
        sources: expect.arrayContaining([expect.objectContaining({
          sourceIds: ['yc'], targetDerivedWords: 120,
          locations: expect.arrayContaining([
            expect.objectContaining({ location: '/description', region: 'description' }),
            expect.objectContaining({ location: '/faqAnswers/0/answer', region: 'faq' }),
          ]),
        })]),
      },
      deterministicFindings: expect.arrayContaining([expect.objectContaining({ code: 'content.source_budget' })]),
    });
    for (const request of client.requests) {
      expect(request.input).toMatchObject({ sourcePlan: { readerTask: candidate.primaryKeyword, sources: expect.any(Array) } });
    }
    expect(outcome).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
      expect.objectContaining({ code: redistributed ? 'repair.evidence_expansion' : 'content.source_budget' }),
    ]) });
    expect(outcome).not.toHaveProperty('bundle');
  });

  it('preserves the complete evidence inventory without treating snippet facts as body anchors', async () => {
    const client = new FixtureStructuredClient([draft, approvedCritique]);
    await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(client.requests[0].input).toMatchObject({ sourcePlan: {
      sources: [expect.objectContaining({ sourceIds: ['yc'], anchorFactIds: expect.any(Array) }), expect.objectContaining({ sourceIds: ['ftc'] })],
    } });
    const input = client.requests[0].input as { sourceFacts: DraftingContext['sourceFacts']; sourcePlan: { sources: { anchorFactIds: string[] }[] } };
    expect(input.sourceFacts.flatMap(s => s.facts.map(f => f.id))).toEqual(context.sourceFacts.flatMap(s => s.facts.map(f => f.id)));
    expect(input.sourcePlan.sources.map(s => s.anchorFactIds.length)).toEqual([0, 0]);
    expect(client.requests[0].system).not.toContain('Recommended recording workflow');
  });

  it('blocks a repair that only soft-wraps the repeated labels while updating exact bindings', async () => {
    const initial = structuredClone(draft);
    const originalSpans = ['Original recommendation: Plan the recording.', 'Original editorial note: Rehearse the opening.'];
    initial.sections[0].markdown = originalSpans.join('\n\n');
    initial.claimBindings = initial.claimBindings.filter(({ location }) => location !== '/sections/0/markdown');
    initial.claimBindings.push(...originalSpans.map(span => ({
      location: '/sections/0/markdown', span, sourceFactIds: ['yc-bullets'], productClaimId: null,
    })));
    const repaired = structuredClone(initial);
    repaired.sections[0].markdown = 'Original\nrecommendation: Plan the recording.\n\nOriginal editorial\nnote: Rehearse the opening.';
    repaired.claimBindings = repaired.claimBindings.filter(({ location }) => location !== '/sections/0/markdown');
    repaired.claimBindings.push(...['Original', 'recommendation: Plan the recording.', 'Original editorial', 'note: Rehearse the opening.'].map(span => ({
      location: '/sections/0/markdown', span, sourceFactIds: ['yc-bullets'], productClaimId: null,
    })));
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(initial) };
    const client = new FixtureStructuredClient([initial, critique, repaired, resolvedVerification(critique, repaired)]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(client.requests).toHaveLength(3);
    expect(outcome).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'repair.evidence_changed', location: '/sections/0/markdown' }),
    ]) });
    const final = finalizeReviewedRepair({ context, repaired, media, originalIssues: critique.issues, verification: resolvedVerification(critique, repaired) });
    expect(final).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'content.editorial_scaffolding', location: '/sections/0/markdown' }),
    ]) });
    expect(outcome).not.toHaveProperty('bundle');
  });

  it.each([true, false])('keeps editorial defects in the one bounded repair even when the critic approves (fixed: %s)', async (fixed) => {
    const initial = structuredClone(draft);
    initial.description = candidate.title;
    const spans = ['Original recommendation: Plan the recording.', 'Original editorial note: Rehearse the opening.'];
    initial.sections[0].markdown = spans.join('\n\n');
    initial.claimBindings = initial.claimBindings.filter(({ location }) => location !== '/description' && location !== '/sections/0/markdown');
    initial.claimBindings.push(
      { location: '/description', span: initial.description, sourceFactIds: ['yc-bullets'], productClaimId: null },
      ...spans.map(span => ({ location: '/sections/0/markdown', span, sourceFactIds: ['yc-bullets'], productClaimId: null })),
    );
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(initial) };
    const repaired = structuredClone(initial);
    if (fixed) {
      repaired.description = draft.description;
      repaired.claimBindings.find(binding => binding.location === '/description')!.span = repaired.description;
      repaired.sections[0].markdown = 'Plan the recording.\n\nRehearse the opening.';
      for (const binding of repaired.claimBindings.filter(binding => binding.location === '/sections/0/markdown')) {
        binding.span = binding.span.replace(/^Original (?:recommendation|editorial note): /u, '');
      }
    }
    const client = new FixtureStructuredClient([initial, critique, repaired, verifyRequest(repaired)]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(client.requests).toHaveLength(4);
    expect(client.requests[2].input).toMatchObject({
      deterministicFindings: expect.arrayContaining([
        expect.objectContaining({ code: 'content.description_duplicate', location: '/description' }),
        expect.objectContaining({ code: 'content.editorial_scaffolding', location: '/sections/0/markdown' }),
      ]),
    });
    if (fixed) {
      expect(outcome).toMatchObject({ status: 'ready', repaired: true });
      if (outcome.status !== 'ready') throw new Error('Expected repaired review artifact.');
      expect(outcome.bundle.markdown).toContain(draft.description);
      expect(outcome.bundle.markdown).not.toContain('Original recommendation:');
    } else {
      expect(outcome).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
        expect.objectContaining({ code: 'content.description_duplicate' }),
        expect.objectContaining({ code: 'content.editorial_scaffolding' }),
      ]) });
      expect(outcome).not.toHaveProperty('bundle');
    }
  });

  it('accepts an ordinary recording referent only after complete independent support review', async () => {
    const value = withSourceClaim('If practice partners are unavailable, record the presentation and watch it back with the same questions.');
    expect(inspectGeneratedDraft(context, value)).toEqual([]);
    const client = new FixtureStructuredClient([value, { ...approvedCritique, supportEvaluations: supportedBindings(value) }]);
    await expect(createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context))
      .resolves.toMatchObject({ status: 'ready', repaired: false });
    expect(client.requests).toHaveLength(2);
  });

  it.each([true, false])('targets the unsupported timing heading and cited facts within four calls (repaired: %s)', async (fix) => {
    const sourceContext = structuredClone(context);
    const fact = { id: 'yc-followup', text: 'YC continues supporting startups during fundraising in the weeks after Demo Day.', evidenceKind: 'body' as const };
    sourceContext.sourceFacts[0].facts.push(fact);
    const initial = structuredClone(draft);
    const location = '/sections/0/heading';
    const span = 'Prepare media assets and follow up before demo day attention arrives';
    initial.sections[0].heading = span;
    const bindingIndex = initial.claimBindings.findIndex((binding) => binding.location === location);
    initial.claimBindings[bindingIndex] = { location, span, sourceFactIds: [fact.id], productClaimId: null };
    expect(inspectGeneratedDraft(sourceContext, initial)).toEqual([]);
    const issue = { id: 'unsupported-timing', code: 'source.unsupported', message: 'The bound fact supports post-event fundraising, not pre-event attention.', repairInstruction: 'Remove the unsupported before-event timing; use only the supplied post-event scope.' };
    const supportEvaluations = supportedBindings(initial);
    supportEvaluations[bindingIndex] = { ...supportEvaluations[bindingIndex], supported: false, rationale: issue.message };
    const critique = { ...approvedCritique, approved: false, issues: [issue], supportEvaluations };
    const repaired = structuredClone(initial);
    if (fix) {
      repaired.sections[0].heading = 'Prepare media assets for post-event investor conversations';
      repaired.claimBindings[bindingIndex].span = repaired.sections[0].heading;
    }
    const verification = fix ? verifyRequest(repaired) : {
      ...unresolvedVerification(critique, repaired), supportEvaluations,
    };
    const client = new FixtureStructuredClient([initial, critique, repaired, verification]);
    const result = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(sourceContext);
    expect(result.status).toBe(fix ? 'ready' : 'blocked');
    expect(client.requests).toHaveLength(4);
    const target = expect.objectContaining({
      bindingIndex, location, span, sourceFactIds: [fact.id],
      citedFactRefs: [{ sourceId: 'yc', factId: fact.id, evidenceKind: 'body' }],
      findings: expect.arrayContaining([expect.objectContaining({ code: 'critique.support_rejected', message: expect.stringContaining(issue.message) })]),
    });
    expect(client.requests[2].input).toMatchObject({ repairTargets: expect.arrayContaining([target]) });
    expect(client.requests[3].input).toMatchObject({ originalRepairTargets: expect.arrayContaining([target]) });
    for (const index of [2, 3]) {
      expect(client.requests[index].input).toMatchObject({ sourceFacts: expect.arrayContaining([
        expect.objectContaining({ id: 'yc', facts: expect.arrayContaining([fact]) }),
      ]) });
      expect(JSON.stringify(client.requests[index].input).match(new RegExp(fact.text, 'g'))).toHaveLength(1);
    }
    if (!fix) expect(result).toMatchObject({ findings: expect.arrayContaining([
      expect.objectContaining({ code: 'critique.support_rejected', bindingIndex, location, span, sourceFactIds: [fact.id] }),
    ]) });
  });

  it('targets deterministic product violations even if both model reviews approve them', async () => {
    const value = withSourceClaim('The app automatically adds captions.');
    const critique = { ...approvedCritique, supportEvaluations: supportedBindings(value) };
    const client = new FixtureStructuredClient([value, critique, value, resolvedVerification(critique, value)]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    const bindingIndex = value.claimBindings.findIndex((binding) => binding.location === '/sections/0/markdown');
    expect(outcome.status).toBe('blocked');
    expect(client.requests).toHaveLength(4);
    expect(client.requests[2].input).toMatchObject({ repairTargets: expect.arrayContaining([
      expect.objectContaining({ bindingIndex, span: value.sections[0].markdown, findings: expect.arrayContaining([
        expect.objectContaining({ code: 'content.claim_binding', reason: 'unapproved_product_reference' }),
      ]) }),
    ]) });
  });

  it('places helper-independent editorial and targeted repair instructions in the production prompts', async () => {
    const critique = { ...approvedCritique, approved: false, issues: [{ id: 'clarity', code: 'copy.clarity', message: 'Clarify.', repairInstruction: 'Clarify the opening.' }] };
    const client = new FixtureStructuredClient([draft, critique, draft, resolvedVerification(critique)]);
    await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    for (const index of [0, 2]) {
      expect(client.requests[index].system).toContain('Do not quote source wording');
      expect(client.requests[index].system).toContain('180');
      expect(client.requests[index].system).toContain('no numbered headings');
      expect(client.requests[index].system).toContain('native page renders sources and FAQ answers');
      expect(client.requests[index].system).toContain('plain paragraph of 40–60 words');
      expect(client.requests[index].system).toContain('Do not add filler to reach exactly 50');
      expect(client.requests[index].system).toContain('Name the publisher when attributing advice');
      expect(client.requests[index].system).toContain('Frame competitorGap as a proposed editorial synthesis');
      expect(client.requests[index].system).toContain('Separate source-supported themes from original editorial additions in competitorGap');
      expect(client.requests[index].system).toContain('Label invented outcome lists as example outcomes');
      expect(client.requests[index].system).not.toContain('50 whitespace-separated words');
    }
    expect(client.requests[2].system).toContain('repairTargets');
    expect(client.requests[2].system).toContain('Preserve unaffected');
    expect(client.requests[2].system).toContain('Change ONLY its allowedLocations');
    expect(client.requests[2].system).toContain('If an issue needs a broader redesign');
    expect(client.requests[2].system).toContain('Do not create a\nclaimBinding for /customerTrigger');
    expect(client.requests[2].system).toContain('Audit all bindings');
    expect(client.requests[2].system).toContain('Rebuild only affected bindings');
    expect(client.requests[2].system).toContain('Never add unrelated advice');
    for (const index of [0, 2]) expect(client.requests[index].system).toContain('Write all public prose in English');
    for (const index of [1, 3]) expect(client.requests[index].system).toContain('ordinary non-VideoClaw referent');
    for (const index of [1, 3]) expect(client.requests[index].system).toContain('For a list attributed to named publishers, require cited support for every item');
  });

  it('blocks stale repaired graphic bindings before verification and independently in the finalizer', async () => {
    const critique = { ...approvedCritique, approved: false, issues: [{ id: 'quality', code: 'source.unsupported', message: 'Recording quality is not supported.', repairInstruction: 'Narrow the final review step.', locations: ['/editorialGraphic/steps/3/detail'] }] };
    const repaired = structuredClone(draft);
    const location = '/editorialGraphic/steps/3/detail';
    repaired.editorialGraphic.steps[3].detail = 'Review claims and playback.';
    const client = new FixtureStructuredClient([draft, critique, repaired, resolvedVerification(critique, repaired)]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(outcome).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'repair.binding_coverage', location }),
    ]) });
    expect(client.requests).toHaveLength(3);
    const final = finalizeReviewedRepair({ context, repaired, media, originalIssues: critique.issues, verification: resolvedVerification(critique, repaired) });
    expect(final).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
      expect.objectContaining({ code: 'content.claim_binding', location, reason: 'span_mismatch' }),
      expect.objectContaining({ code: 'content.claim_binding', location, span: repaired.editorialGraphic.steps[3].detail, reason: 'missing_binding' }),
    ]) });
  });
});

describe('provider response schemas and runtime approval invariants', () => {
  const issue = {
    id: 'description-specificity',
    code: 'copy.too_generic',
    message: 'Make the opening more specific to the candidate.',
    repairInstruction: 'Name the founder pitch workflow in the opening.',
    locations: ['/description'],
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
  it.each(['rendered heading', 'earlier FAQ sentence'])('finalizer retains %s product context', field => {
    const value = structuredClone(draft);
    const product = { id: 'fixture-export', text: 'VideoClaw exports video.', allowedSourceFactIds: ['fixture-product-fact'], subjectAliases: ['VideoClaw'] };
    const localContext = structuredClone(context);
    localContext.productClaims = [product];
    localContext.sourceFacts[0].facts.push({ id: 'fixture-product-fact', text: product.text });
    const spans = [product.text, 'The team reviews a webinar.', 'It guarantees perfect edits for the team.'];
    const location = field === 'rendered heading' ? '/sections/0/markdown' : '/faqAnswers/0/answer';
    if (field === 'rendered heading') {
      value.sections[0] = { heading: product.text.replace('VideoClaw', '**Video**Claw'), markdown: `The team reviews a webinar. A speaker prepares the introduction. ${spans[2]}` };
      value.claimBindings = value.claimBindings.filter(b => !b.location.startsWith('/sections/0/'));
      value.claimBindings.push({ location: '/sections/0/heading', span: product.text, sourceFactIds: product.allowedSourceFactIds, productClaimId: product.id });
      spans.splice(0, 2, 'The team reviews a webinar.', 'A speaker prepares the introduction.');
    } else {
      value.faqAnswers[0].answer = spans.join(' ');
      value.claimBindings = value.claimBindings.filter(b => b.location !== location);
    }
    value.claimBindings.push(...spans.map(span => ({ location, span,
      sourceFactIds: span === product.text ? product.allowedSourceFactIds : ['yc-bullets'],
      productClaimId: span === product.text ? product.id : null })));
    const referenceReviews = productReferenceManifest(localContext, value).map(entry => ({
      bindingIndex: entry.bindingIndex, bindingHash: entry.bindingHash, contextHash: entry.contextHash,
      classification: 'non_product', subject: 'the team', rationale: 'Fixture deliberately attempts to waive product context.',
    }));
    expect(finalizeReviewedRepair({ context: localContext, repaired: value, originalIssues: [], media,
      verification: { schemaVersion: 1, approved: true, evaluations: [], newIssues: [], referenceReviews,
        supportEvaluations: supportedBindings(value) },
    })).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([expect.objectContaining({ location, reason: 'unapproved_product_reference' })]) });
  });

  it.each(['FAQ question', 'article title'])('finalizer cannot waive product context from the %s', field => {
    const value = structuredClone(draft);
    const localContext = structuredClone(context);
    const span = 'It guarantees perfect edits for the team, prepares the presentation, corrects every caption, and delivers a polished founder video without any additional review.';
    const location = field === 'FAQ question' ? '/faqAnswers/0/answer' : '/description';
    if (field === 'FAQ question') {
      const question = 'What can VideoClaw do for the team?';
      localContext.evidence.faqQuestions[0] = question;
      localContext.evidence.serp.peopleAlsoAsk[0] = question;
      value.faqAnswers[0] = { question, answer: span };
    } else {
      localContext.candidate.title = 'VideoClaw for the Team';
      value.description = span;
    }
    value.claimBindings = value.claimBindings.filter(b => b.location !== location);
    value.claimBindings.push({ location, span, sourceFactIds: ['yc-bullets'], productClaimId: null });
    const referenceReviews = productReferenceManifest(localContext, value).map(entry => ({
      bindingIndex: entry.bindingIndex, bindingHash: entry.bindingHash, contextHash: entry.contextHash,
      classification: 'non_product', subject: 'the team', rationale: 'Fixture deliberately attempts to waive product context.',
    }));
    expect(finalizeReviewedRepair({ context: localContext, repaired: value, originalIssues: [], media,
      verification: { schemaVersion: 1, approved: true, evaluations: [], newIssues: [], referenceReviews,
        supportEvaluations: supportedBindings(value) },
    })).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([expect.objectContaining({ location, reason: 'unapproved_product_reference' })]) });
  });

  it.each(['supported', 'unsupported', 'missing review', 'stale context'])('keeps final repaired reference acceptance coupled to %s evidence', scenario => {
    const value = structuredClone(draft);
    const spans = ['The team reviews the webinar.', 'It records an introduction and sends the draft for approval.'];
    value.sections[0].markdown = spans.join(' ');
    value.claimBindings = value.claimBindings.filter(b => b.location !== '/sections/0/markdown');
    value.claimBindings.push(...spans.map(span => ({ location: '/sections/0/markdown', span, sourceFactIds: ['yc-bullets'], productClaimId: null })));
    const referenceReviews = productReferenceManifest(context, value).map(entry => ({
      bindingIndex: entry.bindingIndex, bindingHash: entry.bindingHash,
      contextHash: scenario === 'stale context' ? '0'.repeat(64) : entry.contextHash,
      classification: 'non_product', subject: 'The team', rationale: 'A human team is the named actor in the preceding sentence.',
    }));
    const outcome = finalizeReviewedRepair({ context, repaired: value, originalIssues: [], media,
      verification: { schemaVersion: 1, approved: true, evaluations: [], newIssues: [],
        referenceReviews: scenario === 'missing review' ? [] : referenceReviews,
        supportEvaluations: supportedBindings(value).map(e => value.claimBindings[e.bindingIndex].location === '/sections/0/markdown'
          ? { ...e, supported: scenario !== 'unsupported', kind: 'original_example' } : e),
      },
    });
    expect(outcome.status).toBe(scenario === 'supported' ? 'ready' : 'blocked');
    if (scenario !== 'supported') expect(outcome).not.toHaveProperty('bundle');
  });

  it('uses a current independent referent review without skipping factual support or materialization checks', async () => {
    const value = structuredClone(draft);
    const spans = ['The team reviews the webinar.', 'It records an introduction and sends the draft for approval.'];
    value.sections[0].markdown = spans.join(' ');
    value.claimBindings = value.claimBindings.filter(b => b.location !== '/sections/0/markdown');
    value.claimBindings.push(...spans.map(span => ({ location: '/sections/0/markdown', span, sourceFactIds: ['yc-bullets'], productClaimId: null })));
    const referenceReviews = productReferenceManifest(context, value).map(entry => ({
      bindingIndex: entry.bindingIndex, bindingHash: entry.bindingHash, contextHash: entry.contextHash,
      classification: 'non_product', subject: 'The team', rationale: 'The visible adjacent team is the actor; this is hypothetical editorial work, not software capability.',
    }));
    const critique = { ...approvedCritique, referenceReviews, supportEvaluations: supportedBindings(value).map(e =>
      value.claimBindings[e.bindingIndex].location === '/sections/0/markdown' ? { ...e, kind: 'original_example' as const } : e) };
    const client = new FixtureStructuredClient([value, critique]);
    const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
    expect(outcome).toMatchObject({ status: 'ready', repaired: false });
    if (outcome.status !== 'ready') throw new Error('Expected fully reviewed fixture');
    expect(outcome.bundle.markdown).toContain(spans[1]);
    expect(client.requests[1].input).toMatchObject({ referenceManifest: expect.arrayContaining([expect.objectContaining({ span: spans[1], explicitProductContext: false })]) });
    expect(client.requests).toHaveLength(2);
  });

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
        bindingIndex: 5,
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
  ] as const)('blocks %s before repair and independently in the final verifier', async (_label, change, code) => {
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
    expect(client.requests).toHaveLength(2);
    const final = finalizeReviewedRepair({ context, repaired: paraphrase, media, originalIssues: [],
      verification: { ...resolvedVerification(approvedCritique, paraphrase), supportEvaluations } });
    expect(final).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([expect.objectContaining({ code })]) });
  });

  it.each(['text', 'fact IDs', 'binding order'] as const)('requires fresh support for repaired %s even when all original issues are resolved', async (change) => {
    const original = withSourceClaim('The application advice favors bullet points for speaking.');
    if (change === 'fact IDs') original.claimBindings.find(binding => binding.location === '/sections/0/markdown')!.sourceFactIds.push('faq-planning');
    const critique: DraftCritiqueV1 = {
      schemaVersion: 1,
      approved: false,
      issues: [{ id: 'revise', code: 'copy.revise', message: 'Revise the explanation.', repairInstruction: 'Use a clearer explanation.', locations: ['/sections/0/markdown'] }],
      supportEvaluations: supportedBindings(original),
    };
    const repaired = change === 'text'
      ? withSourceClaim('The application guidance recommends speaking from bullets.')
      : change === 'fact IDs'
        ? withSourceClaim('The application guidance recommends speaking from bullets.', 'yc-bullets')
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
      expect.objectContaining({ facts: expect.arrayContaining([expect.objectContaining({ id: 'ftc-basis', evidenceKind: 'serp_snippet' })]) }),
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
    expect(client.requests).toHaveLength(2);
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
        locations: ['/description'],
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
        locations: ['/description'],
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
        locations: ['/description'],
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
        locations: ['/description'],
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

  it('blocks an unrelated repair before a second critique and never repairs twice', async () => {
    const firstCritique: DraftCritiqueV1 = {
      supportEvaluations: supportedBindings(),
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'source-specificity',
        code: 'copy.unspecific',
        message: 'The source explanation is too generic.',
        repairInstruction: 'Explain the source guidance.',
        locations: ['/sections/0/markdown'],
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
      code: 'repair.out_of_scope',
      location: '/sections/0/heading',
    }));
    expect(client.requests.filter(({ name }) => name === 'videoclaw_article_repair_v2')).toHaveLength(1);
    expect(client.requests).toHaveLength(3);
  });

  it('blocks unsafe markup and its mismatched initial binding before repair', async () => {
    const unsafeDraft = {
      ...structuredClone(draft),
      sections: [
        { heading: draft.sections[0].heading, markdown: '<script>doNotRun()</script>' },
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
    expect(client.requests).toHaveLength(2);
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

    it('includes final-only formatting findings even when initial source allocation also needs repair', async () => {
      const crowded = { ...critique, supportEvaluations: supportedBindings(duplicateSources).map(e => ({ ...e, kind: 'source_claim' as const })) };
      const client = new FixtureStructuredClient([duplicateSources, crowded, draft, verifyRequest()]);
      expect(await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context)).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
        expect.objectContaining({ code: 'repair.location_growth', location: '/sections/0/heading' }),
      ]) });
      expect(client.requests).toHaveLength(3);
      expect(client.requests[2].input).toMatchObject({ deterministicFindings: expect.arrayContaining([
        sourcesFinding, expect.objectContaining({ code: 'content.source_allocation' }),
      ]) });
    });

    it('includes final-only findings alongside independent critique issues in the same repair', async () => {
      const rejected = { ...critique, approved: false, issues: [{ id: 'copy', code: 'copy.clarity', message: 'Clarify the opening.', repairInstruction: 'Clarify the opening.' }] };
      const client = new FixtureStructuredClient([duplicateSources, rejected, draft, verifyRequest()]);
      await expect(createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context)).resolves.toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
        expect.objectContaining({ code: 'repair.out_of_scope', location: '/sections/0/heading' }),
      ]) });
      expect(client.requests).toHaveLength(3);
      expect(client.requests[2].input).toMatchObject({ deterministicFindings: expect.arrayContaining([sourcesFinding]), critique: rejected });
    });

    it('blocks an unlocalized Sources-heading rewrite that also expands its word count', async () => {
      expect(inspectGeneratedDraft(context, duplicateSources)).toEqual([]);
      const client = new FixtureStructuredClient([duplicateSources, critique, draft, verifyRequest()]);

      const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);

      // This final-only diagnostic has no machine location. A bounded repair
      // cannot infer permission from its message or grow Sources into five words.
      expect(outcome).toMatchObject({ status: 'blocked', findings: expect.arrayContaining([
        expect.objectContaining({ code: 'repair.out_of_scope', location: '/sections/0/heading' }),
      ]) });
      expect(client.requests.map(({ name }) => name)).toEqual([
        'videoclaw_article_draft_v2', 'videoclaw_article_critique_v1',
        'videoclaw_article_repair_v2',
      ]);
      expect(client.requests[2].input).toMatchObject({ deterministicFindings: [sourcesFinding] });
      expect(outcome).not.toHaveProperty('bundle');
    });

    it('repairs a final-only Sources heading when explicitly localized and kept to one word', async () => {
      const localized = { ...critique, approved: false, issues: [{ id: 'heading', code: 'copy.heading',
        message: 'This section describes delivery.', repairInstruction: 'Use a delivery heading.', locations: ['/sections/0/heading'] }] };
      const repaired = structuredClone(duplicateSources);
      repaired.sections[0].heading = 'Delivery';
      repaired.claimBindings.find(binding => binding.location === '/sections/0/heading')!.span = 'Delivery';
      const client = new FixtureStructuredClient([duplicateSources, localized, repaired, verifyRequest(repaired)]);
      const outcome = await createStructuredDrafter({ client, mediaAllowlist: [media] }).draft(context);
      expect(outcome).toMatchObject({ status: 'ready', repaired: true });
      expect(client.requests).toHaveLength(4);
      if (outcome.status !== 'ready') throw new Error('Expected a reviewed heading correction.');
      expect(outcome.bundle.markdown).not.toMatch(/^## Sources$/gm);
    });

    it('returns exact final findings when the one repair still cannot materialize', async () => {
      const client = new FixtureStructuredClient([
        duplicateSources, critique, duplicateSources, verifyRequest(duplicateSources),
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
        issues: [{ id: 'copy-clarity', code: 'copy.clarity', message: 'Clarify the first heading.', repairInstruction: 'Clarify the first heading.', locations: ['/sections/0/heading'] }],
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

  it('blocks a repair that edits an unrelated field before asking the second critic', async () => {
    const critique: DraftCritiqueV1 = {
      supportEvaluations: supportedBindings(),
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'source-specificity',
        code: 'copy.unspecific',
        message: 'The source explanation is too generic.',
        repairInstruction: 'Explain that the guidance recommends speaking from bullets.',
        locations: ['/sections/0/markdown'],
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
      findings: expect.arrayContaining([expect.objectContaining({ code: 'repair.out_of_scope', location: '/sections/0/heading' })]),
    });
    expect(client.requests).toHaveLength(3);
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
