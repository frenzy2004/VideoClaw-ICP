import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

import { candidateFingerprints, type Candidate, type EvidenceBundle, type KeywordMetrics } from './domain';
import type { CheckedSource } from './sources';
import {
  inspectGeneratedDraft,
  materializeDraftBundle,
  selectProductMedia,
  type AllowlistedProductMedia,
  type DraftingContext,
  type GeneratedDraftV2,
} from './content-bundle';

const candidate: Candidate = {
  schemaVersion: 1,
  articleId: 'vc-c2-008',
  campaignId: 'accelerator-demo-day-founder',
  icp: 'US startup founder preparing for Demo Day',
  primaryKeyword: 'how to make a founder pitch video',
  secondaryKeywords: ['founder video workflow', 'startup pitch recording process'],
  title: 'How to Make a Founder Pitch Video Without Losing Your Voice',
  slug: 'how-to-make-founder-pitch-video',
  intent: 'informational',
  funnelStage: 'middle',
};

const evidence: EvidenceBundle = {
  schemaVersion: 1,
  candidateFingerprint: candidateFingerprints(candidate).candidate,
  suggestions: ['how to make a founder pitch video naturally'],
  serp: {
    organicResultCount: 9,
    peopleAlsoAsk: [
      'How do you create a founder pitch video?',
      'What should a startup pitch video include?',
      'How long should a founder pitch video be?',
    ],
  },
  sources: [
    { url: 'https://www.ycombinator.com/video/', authoritative: true },
    { url: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business', authoritative: true },
    { url: 'https://videoclaw.com/features', authoritative: true },
  ],
  faqQuestions: [
    'How do you create a founder pitch video?',
    'What should a startup pitch video include?',
    'How long should a founder pitch video be?',
  ],
};

const keywordMetrics: KeywordMetrics = {
  schemaVersion: 1,
  provider: 'semrush',
  observedAt: '2026-09-04T11:30:00.000Z',
  volume: 90,
  difficulty: 31,
  cpc: 4.2,
  intent: 'informational',
};

const checkedSources: CheckedSource[] = evidence.sources.map((source) => ({
  url: source.url,
  finalUrl: source.url,
  status: 200,
  reachable: true,
  authoritative: source.authoritative,
}));

const context: DraftingContext = {
  candidate,
  evidence,
  keywordMetrics,
  checkedSources,
  provenance: {
    apifyRunId: 'run_apify_fixture_001',
    apifyDatasetId: 'dataset_apify_fixture_001',
    query: 'how to make a founder pitch video',
    locale: 'en-US',
    capturedAt: '2026-09-04',
  },
  sourceFacts: [
    {
      id: 'yc',
      label: 'Y Combinator: Application Video',
      url: 'https://www.ycombinator.com/video/',
      checkedAt: '2026-09-04T09:00:00.000Z',
      facts: [{ id: 'yc-bullets', text: 'The application video guidance recommends speaking from bullets.' }],
      excerpt: 'A transient excerpt with twelve uniquely copied words should never persist in any output artifact.',
    },
    {
      id: 'ftc',
      label: 'Federal Trade Commission: Advertising FAQs',
      url: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business',
      checkedAt: '2026-09-04T09:05:00.000Z',
      facts: [{ id: 'ftc-support', text: 'Objective advertising claims require an appropriate basis.' }],
      excerpt: 'Another source excerpt exists only while the copied passage heuristic performs its comparison.',
    },
    {
      id: 'videoclaw',
      label: 'VideoClaw product features',
      url: 'https://videoclaw.com/features',
      checkedAt: '2026-09-04T09:10:00.000Z',
      facts: [{ id: 'vc-text-editing', text: 'The current product supports text-based editing for recorded video.' }],
      excerpt: 'Product source text remains transient and is not sent to the language model or serialized.',
    },
  ],
  productClaims: [{
    id: 'vc-editing-claim',
    text: 'VideoClaw lets creators edit a recorded video with text.',
    allowedSourceFactIds: ['vc-text-editing'],
    subjectAliases: ['VideoClaw', 'the app', 'it'],
  }],
  generatedAt: '2026-09-05T01:23:45.000Z',
};

const mediaAllowlist: AllowlistedProductMedia[] = [{
  id: 'founder-product-demo',
  candidateFingerprints: [evidence.candidateFingerprint],
  src: '/landing/full/founder-product.mp4',
  poster: '/landing/full/founder-product.jpg',
  alt: 'A VideoClaw founder-led demo combining a presenter and product walkthrough',
  caption: 'An existing VideoClaw founder-led product demonstration.',
  width: 1280,
  height: 720,
}];

const generatedDraft: GeneratedDraftV2 = {
  schemaVersion: 2,
  description: 'Create a credible founder pitch video with natural delivery, source-controlled claims, visible product proof, careful editing, reviewed captions, and one tested next step.',
  customerTrigger: 'Use this workflow when preparing a pitch video that needs factual, natural delivery.',
  competitorGap: 'Address the gap between pitch advice, claim control, and product-proof production.',
  directAnswer: 'Create a founder pitch video by choosing one audience and next step, reducing the story to a few factual points, recording short natural takes, and showing one current product action. Then edit for clarity, verify every claim and caption against its source, and test the final playback path.',
  sections: [
    {
      heading: 'Build a factual story spine',
      markdown: 'Choose a few memorable points and speak from bullets, following [application video guidance](https://www.ycombinator.com/video/).',
    },
    {
      heading: 'Check product and advertising claims',
      markdown: 'The [FTC advertising guidance](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business) explains why objective claims need support. VideoClaw lets creators edit a recorded video with text.',
    },
  ],
  faqAnswers: evidence.faqQuestions.map((question, index) => ({
    question,
    answer: [
      'Choose one audience, a few factual points, short founder-led takes, one product action, careful editing, and a tested next step.',
      'Include the customer situation, the useful change, relevant founder insight, one current product action, supportable evidence, and one next step.',
      'Follow the recipient requirements; otherwise use the shortest duration that clearly communicates the problem, proof, and next step.',
    ][index],
  })),
  sourceReferences: [{ sourceId: 'yc' }, { sourceId: 'ftc' }, { sourceId: 'videoclaw' }],
  claimBindings: [
    {
      location: '/sections/1/markdown',
      span: 'The FTC advertising guidance explains why objective claims need support.',
      sourceFactIds: ['ftc-support'],
      productClaimId: null,
    },
    {
      location: '/sections/1/markdown',
      span: 'VideoClaw lets creators edit a recorded video with text.',
      sourceFactIds: ['vc-text-editing'],
      productClaimId: 'vc-editing-claim',
    },
  ],
  editorialGraphic: {
    title: 'Founder pitch video workflow <script>alert("x")</script>',
    alt: 'Five-step founder pitch video workflow from audience choice to final playback check',
    steps: [
      { label: 'Audience', detail: 'Choose one viewer and next step.' },
      { label: 'Facts', detail: 'Bind each objective claim to evidence.' },
      { label: 'Takes', detail: 'Record short natural sections.' },
      { label: 'Proof', detail: 'Show one current product action.' },
      { label: 'Review', detail: 'Check captions, claims, and playback.' },
    ],
  },
};

function withDraft(change: Partial<GeneratedDraftV2>): GeneratedDraftV2 {
  return { ...structuredClone(generatedDraft), ...change };
}

describe('content bundle materialization', () => {
  it('selects only an explicitly allowlisted product video and poster mapping', () => {
    expect(selectProductMedia(candidate, mediaAllowlist)).toEqual(mediaAllowlist[0]);
    expect(selectProductMedia(
      { ...candidate, articleId: 'vc-c2-009', primaryKeyword: 'different keyword' },
      mediaAllowlist,
    )).toBeUndefined();
  });

  it('ignores structurally unsafe entries even when their candidate mapping matches', () => {
    expect(selectProductMedia(candidate, [{
      ...mediaAllowlist[0],
      src: 'https://cdn.example.com/unapproved.mp4',
      width: 0,
    }])).toBeUndefined();
  });

  it.each([
    ['/landing/../private/product.mp4', '/landing/full/founder-product.jpg'],
    ['/landing/%2e%2e/private/product.mp4', '/landing/full/founder-product.jpg'],
    ['/landing/./product.mp4', '/landing/full/founder-product.jpg'],
    ['/landing/full/product.mp4', '/landing/../private/product.jpg'],
  ])('rejects media paths containing traversal or dot segments (%s)', (src, poster) => {
    expect(selectProductMedia(candidate, [{ ...mediaAllowlist[0], src, poster }])).toBeUndefined();
  });

  it('rejects media mappings whose configured selectors normalize to empty text', () => {
    expect(selectProductMedia(candidate, [{
      ...mediaAllowlist[0],
      candidateFingerprints: undefined,
      keywordIncludes: ['---'],
    }])).toBeUndefined();
  });

  it('serializes the exact review-state lander fields and a deterministic escaped 1200x675 SVG', () => {
    const media = selectProductMedia(candidate, mediaAllowlist);
    if (!media) throw new Error('Fixture media mapping missing.');

    const first = materializeDraftBundle(context, generatedDraft, media);
    const second = materializeDraftBundle(context, generatedDraft, media);
    const parsed = matter(first.markdown);

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe(1);
    expect(first.candidateFingerprint).toBe(evidence.candidateFingerprint);
    expect(parsed.data).toMatchObject({
      id: 'vc-c2-008',
      campaign: 'accelerator-demo-day-founder',
      icp: candidate.icp,
      customerTrigger: generatedDraft.customerTrigger,
      funnelStage: 'consideration',
      primaryKeyword: candidate.primaryKeyword,
      secondaryKeywords: candidate.secondaryKeywords,
      searchIntent: 'informational',
      competitorGap: generatedDraft.competitorGap,
      provenance: context.provenance,
      title: candidate.title,
      description: generatedDraft.description,
      slug: candidate.slug,
      canonicalPath: `/blog/${candidate.slug}`,
      faqs: generatedDraft.faqAnswers,
      productMedia: {
        src: media.src,
        poster: media.poster,
        alt: media.alt,
        caption: media.caption,
        width: 1280,
        height: 720,
      },
      editorialGraphic: {
        src: `/media/blog/${candidate.slug}.svg`,
        alt: generatedDraft.editorialGraphic.alt,
        width: 1200,
        height: 675,
      },
      cta: { label: 'Download the desktop app', href: '/download' },
      status: 'review',
      approvals: { copy: false, factual: false, legal: false, visual: false },
      createdAt: '2026-09-05',
      updatedAt: '2026-09-05',
      searchMetrics: { volume: 90, keywordDifficulty: 31, cpc: 4.2 },
    });
    expect(parsed.data).not.toHaveProperty('publishedAt');
    expect(parsed.data.sources).toHaveLength(3);
    expect(parsed.data.sources.map(({ checkedAt }: { checkedAt: string }) => checkedAt)).toEqual([
      '2026-09-04',
      '2026-09-04',
      '2026-09-04',
    ]);
    expect(parsed.content.trimStart()).toMatch(/^Create a founder pitch video/);
    expect(parsed.content).toContain('[Y Combinator: Application Video](https://www.ycombinator.com/video/)');
    expect(parsed.content).not.toContain(context.sourceFacts[0].excerpt);
    expect(first.svg).toContain('width="1200"');
    expect(first.svg).toContain('height="675"');
    expect(first.svg).toContain('&lt;script&gt;');
    expect(first.svg).not.toMatch(/<script/i);
  });

  it('preserves explicit pending metrics without inventing values', () => {
    const media = mediaAllowlist[0];
    const pending = materializeDraftBundle({
      ...context,
      keywordMetrics: {
        schemaVersion: 1,
        provider: 'pending',
        observedAt: null,
        volume: null,
        difficulty: null,
        cpc: null,
        intent: 'informational',
      },
    }, generatedDraft, media);

    expect(matter(pending.markdown).data.searchMetrics).toEqual({
      volume: 'provider-pending',
      keywordDifficulty: 'provider-pending',
      cpc: 'provider-pending',
    });
  });
});

describe('generated-content safety review', () => {
  it.each([
    ['raw HTML', withDraft({ sections: [{ heading: 'Unsafe', markdown: '<aside>hidden</aside>' }, generatedDraft.sections[1]] }), 'content.raw_html'],
    ['body H1', withDraft({ sections: [{ heading: 'Unsafe', markdown: '# Duplicate title' }, generatedDraft.sections[1]] }), 'content.body_h1'],
    ['secret-like text', withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Token: sk-proj-abcdefghijklmnopqrstuvwxyz123456' }, generatedDraft.sections[1]] }), 'content.secret'],
    ['unsupported link', withDraft({ sections: [{ heading: 'Unsafe', markdown: '[Unknown](https://example.net/unsupported)' }, generatedDraft.sections[1]] }), 'content.unsupported_link'],
    ['unsupported raw URL', withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Read https://example.net/unsupported before recording.' }, generatedDraft.sections[1]] }), 'content.unsupported_link'],
    ['malformed Markdown', withDraft({ sections: [{ heading: 'Unsafe', markdown: '```text\nnever closed' }, generatedDraft.sections[1]] }), 'content.markdown_malformed'],
    ['research boilerplate', withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Our debug research notes from the SERP say this is best.' }, generatedDraft.sections[1]] }), 'content.research_boilerplate'],
    ['copied source passage', withDraft({ sections: [{ heading: 'Unsafe', markdown: context.sourceFacts[0].excerpt as string }, generatedDraft.sections[1]] }), 'content.copied_passage'],
    ['unsupported claim fact', withDraft({ claimBindings: generatedDraft.claimBindings.map((binding, index) => index === 1 ? { ...binding, sourceFactIds: ['ftc-support'] } : binding) }), 'content.claim_binding'],
    ['unsupported product assertion', withDraft({ sections: [{ heading: 'Unsafe', markdown: 'The app guarantees a tenfold conversion increase.' }, generatedDraft.sections[1]] }), 'content.claim_binding'],
    ['appended objective assertion', withDraft({ sections: [generatedDraft.sections[0], { ...generatedDraft.sections[1], markdown: `${generatedDraft.sections[1].markdown} This workflow doubles conversion.` }] }), 'content.claim_binding'],
    ['objective metadata assertion', withDraft({ customerTrigger: `${generatedDraft.customerTrigger} Market demand doubled.` }), 'content.claim_binding'],
    ['objective SVG assertion', withDraft({
      editorialGraphic: {
        ...generatedDraft.editorialGraphic,
        steps: generatedDraft.editorialGraphic.steps.map((step, index) => index === 0
          ? { ...step, detail: 'Reliable workflows double conversion.' }
          : step),
      },
    }), 'content.claim_binding'],
    ['objective assertion bound to an unrelated fact', withDraft({
      sections: [generatedDraft.sections[0], { ...generatedDraft.sections[1], markdown: `${generatedDraft.sections[1].markdown} Reliable workflows double conversion.` }],
      claimBindings: [...generatedDraft.claimBindings, {
        location: '/sections/1/markdown',
        span: 'Reliable workflows double conversion.',
        sourceFactIds: ['ftc-support'],
        productClaimId: null,
      }],
    }), 'content.claim_binding'],
    ['missing objective binding', withDraft({ claimBindings: generatedDraft.claimBindings.slice(1) }), 'content.claim_binding'],
    ['unknown source fact binding', withDraft({ claimBindings: generatedDraft.claimBindings.map((binding, index) => index === 0 ? { ...binding, sourceFactIds: ['missing-fact'] } : binding) }), 'content.claim_binding'],
    ['pronoun product claim with generic binding', withDraft({
      sections: [generatedDraft.sections[0], { ...generatedDraft.sections[1], markdown: `${generatedDraft.sections[1].markdown} It guarantees faster editing.` }],
      claimBindings: [...generatedDraft.claimBindings, {
        location: '/sections/1/markdown',
        span: 'It guarantees faster editing.',
        sourceFactIds: ['ftc-support'],
        productClaimId: null,
      }],
    }), 'content.claim_binding'],
    ['copied FAQ passage', withDraft({ faqAnswers: [{ ...generatedDraft.faqAnswers[0], answer: context.sourceFacts[0].excerpt as string }, ...generatedDraft.faqAnswers.slice(1)] }), 'content.copied_passage'],
    ['non-PAA FAQ', withDraft({ faqAnswers: [{ ...generatedDraft.faqAnswers[0], question: 'Invented question?' }, ...generatedDraft.faqAnswers.slice(1)] }), 'content.faq_mismatch'],
    ['citation inventory mismatch', withDraft({ sourceReferences: [{ sourceId: 'yc' }, { sourceId: 'missing' }] }), 'content.citation_mismatch'],
    ['duplicate normalized source URLs', withDraft({ sourceReferences: [{ sourceId: 'yc' }, { sourceId: 'yc-copy' }] }), 'content.citation_mismatch'],
  ])('blocks %s', (_label, draft, code) => {
    const inspectedContext = _label === 'duplicate normalized source URLs'
      ? {
        ...context,
        sourceFacts: [...context.sourceFacts, {
          ...context.sourceFacts[0],
          id: 'yc-copy',
          url: 'https://www.ycombinator.com/video/#copy',
          facts: [{ id: 'yc-copy-fact', text: 'A separately identified copy of the same final source.' }],
        }],
      }
      : context;
    expect(inspectGeneratedDraft(inspectedContext, draft).map((finding) => finding.code)).toContain(code);
  });

  it('requires the opening direct answer to contain 40–60 visible words', () => {
    const tooShort = withDraft({ directAnswer: 'Choose one audience, record a clear pitch, verify claims, and test playback.' });
    const tooLong = withDraft({ directAnswer: Array.from({ length: 61 }, (_, index) => `word${index}`).join(' ') });

    expect(inspectGeneratedDraft(context, tooShort)).toContainEqual(expect.objectContaining({
      code: 'content.direct_answer_words',
    }));
    expect(inspectGeneratedDraft(context, tooLong)).toContainEqual(expect.objectContaining({
      code: 'content.direct_answer_words',
    }));
  });
});

describe('final serialized artifact inspection', () => {
  it.each([
    [
      'a Setext H1',
      withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Use this title\n===' }, generatedDraft.sections[1]] }),
      /body_h1/,
    ],
    [
      'a closed code fence',
      withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Use this example.\n\n```text\nsafe\n```' }, generatedDraft.sections[1]] }),
      /code_fence/,
    ],
    [
      'a reference link',
      withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Use [the guide][yc].\n\n[yc]: https://www.ycombinator.com/video/' }, generatedDraft.sections[1]] }),
      /reference_link/,
    ],
    [
      'an autolink',
      withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Use <https://www.ycombinator.com/video/>.' }, generatedDraft.sections[1]] }),
      /autolink/,
    ],
    [
      'a mailto destination',
      withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Use [email](mailto:editor@example.com).' }, generatedDraft.sections[1]] }),
      /link_destination/,
    ],
    [
      'a javascript destination',
      withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Use [this](javascript:alert(1)).' }, generatedDraft.sections[1]] }),
      /link_destination/,
    ],
    [
      'an unsafe image destination',
      withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Use this image.\n\n![Use proof](javascript:alert(1))' }, generatedDraft.sections[1]] }),
      /link_destination/,
    ],
  ])('rejects final Markdown containing %s', (_label, unsafeDraft, expected) => {
    expect(() => materializeDraftBundle(context, unsafeDraft, mediaAllowlist[0])).toThrow(expected);
  });

  it('requires the final direct answer to be a real paragraph', () => {
    const quotedAnswer = `> ${generatedDraft.directAnswer}`;
    const unsafeDraft = withDraft({
      directAnswer: quotedAnswer,
    });

    expect(() => materializeDraftBundle(context, unsafeDraft, mediaAllowlist[0])).toThrow(/direct_answer_paragraph/);
  });

  it('escapes a source label so it cannot inject a second link destination', () => {
    const injectedContext = {
      ...context,
      sourceFacts: context.sourceFacts.map((source, index) => index === 0
        ? { ...source, label: 'Trusted source](javascript:alert(1))' }
        : source),
    };

    const bundle = materializeDraftBundle(injectedContext, generatedDraft, mediaAllowlist[0]);
    const body = matter(bundle.markdown).content;

    expect(body).toContain('Trusted source\\]\\(javascript:alert\\(1\\)\\)');
    expect(body).not.toMatch(/\]\(javascript:/);
  });

  it('runs copied-passage protection over visible SVG text after assembly', () => {
    const copiedGraphic = withDraft({
      editorialGraphic: {
        ...generatedDraft.editorialGraphic,
        steps: generatedDraft.editorialGraphic.steps.map((step, index) => index === 0
          ? { ...step, detail: context.sourceFacts[0].excerpt as string }
          : step),
      },
    });

    expect(() => materializeDraftBundle(context, copiedGraphic, mediaAllowlist[0])).toThrow(/copied_passage/);
  });

  it('rejects a pronoun-based product claim even when it is lexically bound to a product fact', () => {
    const span = 'During editing, it supports text editing for recorded video.';
    const pronounDraft = withDraft({
      sections: [generatedDraft.sections[0], {
        ...generatedDraft.sections[1],
        markdown: `${generatedDraft.sections[1].markdown} ${span}`,
      }],
      claimBindings: [...generatedDraft.claimBindings, {
        location: '/sections/1/markdown',
        span,
        sourceFactIds: ['vc-text-editing'],
        productClaimId: null,
      }],
    });

    expect(inspectGeneratedDraft(context, pronounDraft)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding',
    }));
  });

  it.each([
    ['raw Apify token', 'apify_api_synthetic_fixture_123456'],
    ['fine-grained GitHub token', 'github_pat_synthetic_fixture_123456'],
  ])('scans final Markdown, frontmatter, and SVG for a %s', (_label, syntheticSecret) => {
    expect(() => materializeDraftBundle(context, generatedDraft, {
      ...mediaAllowlist[0],
      caption: `Synthetic redacted fixture ${syntheticSecret}`,
    })).toThrow(/secret/);
    expect(() => materializeDraftBundle(context, withDraft({
      editorialGraphic: {
        ...generatedDraft.editorialGraphic,
        title: `Synthetic ${syntheticSecret}`,
      },
    }), mediaAllowlist[0])).toThrow(/secret/);
  });

  it('normalizes strict ISO date-times to UTC date-only publication fields', () => {
    const shiftedContext = {
      ...context,
      generatedAt: '2026-09-05T00:30:00-05:00',
      sourceFacts: context.sourceFacts.map((source) => ({
        ...source,
        checkedAt: '2026-09-04T23:30:00-05:00',
      })),
    };

    const parsed = matter(materializeDraftBundle(shiftedContext, generatedDraft, mediaAllowlist[0]).markdown);
    expect(parsed.data.createdAt).toBe('2026-09-05');
    expect(parsed.data.updatedAt).toBe('2026-09-05');
    expect(parsed.data.sources.every(({ checkedAt }: { checkedAt: string }) => checkedAt === '2026-09-05')).toBe(true);
  });
});
