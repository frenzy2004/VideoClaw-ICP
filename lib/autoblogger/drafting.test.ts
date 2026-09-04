import { describe, expect, it } from 'vitest';

import { candidateFingerprints, type Candidate } from './domain';
import type { StructuredOutputClient, StructuredOutputRequest } from './openai-responses';
import {
  createStructuredDrafter,
  type DraftCritiqueV1,
  type DraftRepairVerificationV1,
} from './drafting';
import type {
  AllowlistedProductMedia,
  DraftingContext,
  GeneratedDraftV2,
} from './content-bundle';

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
    schemaVersion: 1,
    candidateFingerprint: fingerprint,
    suggestions: ['founder pitch video workflow checklist'],
    serp: {
      organicResultCount: 8,
      peopleAlsoAsk: [
        'How do you plan a founder pitch video?',
        'What belongs in a founder pitch video?',
        'How long should a founder pitch video be?',
      ],
    },
    sources: [
      { url: 'https://www.ycombinator.com/video/', authoritative: true },
      { url: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business', authoritative: true },
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

const approvedCritique: DraftCritiqueV1 = {
  schemaVersion: 1,
  approved: true,
  issues: [],
};

function resolvedVerification(critique: DraftCritiqueV1): DraftRepairVerificationV1 {
  return {
    schemaVersion: 1,
    approved: true,
    evaluations: critique.issues.map(({ id }) => ({
      issueId: id,
      resolved: true,
      message: 'The repaired draft resolves this original issue.',
    })),
    newIssues: [],
  };
}

function unresolvedVerification(critique: DraftCritiqueV1): DraftRepairVerificationV1 {
  return {
    schemaVersion: 1,
    approved: false,
    evaluations: critique.issues.map(({ id, message }) => ({
      issueId: id,
      resolved: false,
      message,
    })),
    newIssues: [],
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

describe('structured drafting orchestration', () => {
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
    expect(client.requests[0].system).toMatch(/every objective claim's exact location and span/i);
    expect(JSON.stringify(client.requests)).not.toContain(context.sourceFacts[0].excerpt);
  });

  it('does not send a generated secret-like draft into the critic context', async () => {
    const secretDraft = {
      ...structuredClone(draft),
      description: 'Use synthetic github_pat_generated_fixture_123456789 credentials only in this fixture.',
    };
    const client = new FixtureStructuredClient([secretDraft, approvedCritique]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({
      status: 'blocked',
      reason: 'content_safety_failed',
      findings: [{ code: 'content.secret' }],
    });
    expect(client.requests).toHaveLength(1);
    expect(JSON.stringify(client.requests)).not.toContain('github_pat_generated_fixture_123456789');
  });

  it('does not send a secret-like critic issue into the repair context', async () => {
    const secretCritique: DraftCritiqueV1 = {
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
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'description-specificity',
        code: 'copy.too_generic',
        message: 'Make the opening more specific to the candidate.',
        repairInstruction: 'Name the founder pitch workflow in the opening.',
      }],
    };
    const repairedDraft = {
      ...structuredClone(draft),
      description: 'Use this specific founder pitch workflow to plan factual points, record natural takes, show product proof, support claims, review captions, and test final playback.',
    };
    const client = new FixtureStructuredClient([draft, critique, repairedDraft, resolvedVerification(critique)]);
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
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'description-specificity',
        code: 'copy.too_generic',
        message: 'Make the opening more specific to the candidate.',
        repairInstruction: 'Name the founder pitch workflow in the opening.',
      }],
    };
    const repairedDraft = {
      ...structuredClone(draft),
      description: 'Use this specific founder pitch workflow to plan factual points and final playback.',
    };
    const client = new FixtureStructuredClient([
      draft,
      firstCritique,
      repairedDraft,
      resolvedVerification(firstCritique),
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
      schemaVersion: 1,
      approved: false,
      issues: [{
        id: 'description-specificity',
        code: 'copy.too_generic',
        message: 'Make the opening more specific to the candidate.',
        repairInstruction: 'Name the founder pitch workflow in the opening.',
      }],
    };
    const repairedDraft = {
      ...structuredClone(draft),
      description: 'Use this specific founder pitch workflow to plan factual points and final playback.',
    };
    const forgetfulVerification = {
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
      description: 'Use a different description without changing the source explanation.',
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

  it('blocks an unchanged repair after the independent critic rejected the draft', async () => {
    const critique: DraftCritiqueV1 = {
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
      description: 'Use a changed description for the draft.',
    };
    const client = new FixtureStructuredClient([
      draft,
      critique,
      unrelatedRepair,
      unresolvedVerification(critique),
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
            { url: 'https://videoclaw.com/features', authoritative: true },
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
