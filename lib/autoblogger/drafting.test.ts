import { describe, expect, it } from 'vitest';

import { candidateFingerprints, type Candidate } from './domain';
import type { StructuredOutputClient, StructuredOutputRequest } from './openai-responses';
import {
  createStructuredDrafter,
  type DraftCritiqueV1,
} from './drafting';
import type {
  AllowlistedProductMedia,
  DraftingContext,
  GeneratedDraftV1,
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
      checkedAt: '2026-09-04',
      facts: [{ id: 'yc-bullets', text: 'The current guidance recommends speaking from bullets.' }],
      excerpt: 'This exact transient excerpt must never appear in a model request or generated bundle output.',
    },
    {
      id: 'ftc',
      label: 'Federal Trade Commission: Advertising FAQs',
      url: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business',
      checkedAt: '2026-09-04',
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

const draft: GeneratedDraftV1 = {
  schemaVersion: 1,
  description: 'Plan a clear founder pitch video with factual points, natural delivery, visible product proof, supported claims, careful editing, reviewed captions, and a tested final playback path.',
  customerTrigger: 'Demo Day is approaching and the founder needs a clear, supportable video workflow.',
  competitorGap: 'Observed guides do not combine natural delivery, claim control, product proof, and playback checks.',
  directAnswer: 'Plan a founder pitch video by choosing one audience and next step, reducing the story to a few factual points, recording short natural takes, and showing one current product action. Then edit for clarity, verify each objective claim and caption against its source, and test the complete final playback path.',
  sections: [
    {
      heading: 'Choose the story and delivery',
      markdown: 'Use a few memorable points and follow [current application guidance](https://www.ycombinator.com/video/) when that program is the recipient.',
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
  claimReferences: [],
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

  it('always drafts then independently critiques before returning a bundle', async () => {
    const client = new FixtureStructuredClient([draft, approvedCritique]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({ status: 'ready', repaired: false });
    expect(outcome).toHaveProperty('bundle.markdown');
    expect(client.requests.map(({ name }) => name)).toEqual([
      'videoclaw_article_draft_v1',
      'videoclaw_article_critique_v1',
    ]);
    expect(client.requests[1].system).toMatch(/independent/i);
    expect(JSON.stringify(client.requests)).not.toContain(context.sourceFacts[0].excerpt);
  });

  it('runs exactly one repair when the independent critique rejects the first draft', async () => {
    const critique: DraftCritiqueV1 = {
      schemaVersion: 1,
      approved: false,
      issues: [{
        code: 'copy.too_generic',
        message: 'Make the opening more specific to the candidate.',
        repairInstruction: 'Name the founder pitch workflow in the opening.',
      }],
    };
    const repairedDraft = {
      ...structuredClone(draft),
      description: 'Use this specific founder pitch workflow to plan factual points, record natural takes, show product proof, support claims, review captions, and test final playback.',
    };
    const client = new FixtureStructuredClient([draft, critique, repairedDraft, draft]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({ status: 'ready', repaired: true });
    expect(client.requests.map(({ name }) => name)).toEqual([
      'videoclaw_article_draft_v1',
      'videoclaw_article_critique_v1',
      'videoclaw_article_repair_v1',
    ]);
    expect(JSON.stringify(outcome)).toContain(repairedDraft.description);
  });

  it('blocks after one repair when deterministic safety findings remain', async () => {
    const unsafeDraft = {
      ...structuredClone(draft),
      sections: [
        { heading: 'Unsafe', markdown: '<script>doNotRun()</script>' },
        draft.sections[1],
      ],
    };
    const client = new FixtureStructuredClient([unsafeDraft, approvedCritique, unsafeDraft, draft]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({
      status: 'blocked',
      reason: 'content_safety_failed',
      findings: [{ code: 'content.raw_html' }],
    });
    expect(outcome).not.toHaveProperty('bundle');
    expect(client.requests).toHaveLength(3);
  });

  it('blocks an unchanged repair after the independent critic rejected the draft', async () => {
    const critique: DraftCritiqueV1 = {
      schemaVersion: 1,
      approved: false,
      issues: [{
        code: 'copy.unspecific',
        message: 'The workflow needs a more specific explanation.',
        repairInstruction: 'Make the workflow explanation specific.',
      }],
    };
    const client = new FixtureStructuredClient([draft, critique, structuredClone(draft)]);
    const drafter = createStructuredDrafter({ client, mediaAllowlist: [media] });

    const outcome = await drafter.draft(context);

    expect(outcome).toMatchObject({
      status: 'blocked',
      reason: 'content_safety_failed',
      findings: [{ code: 'critique.unresolved' }],
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
      'a secret-like value in model-bound source facts',
      {
        sourceFacts: [{
          ...context.sourceFacts[0],
          facts: [{ id: 'yc-bullets', text: 'API_KEY=abcdefghijklmnop123456' }],
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
