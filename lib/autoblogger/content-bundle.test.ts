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
  type GeneratedDraftV1,
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
      checkedAt: '2026-09-04',
      facts: [{ id: 'yc-bullets', text: 'The application video guidance recommends speaking from bullets.' }],
      excerpt: 'A transient excerpt with twelve uniquely copied words should never persist in any output artifact.',
    },
    {
      id: 'ftc',
      label: 'Federal Trade Commission: Advertising FAQs',
      url: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business',
      checkedAt: '2026-09-04',
      facts: [{ id: 'ftc-support', text: 'Objective advertising claims require an appropriate basis.' }],
      excerpt: 'Another source excerpt exists only while the copied passage heuristic performs its comparison.',
    },
    {
      id: 'videoclaw',
      label: 'VideoClaw product features',
      url: 'https://videoclaw.com/features',
      checkedAt: '2026-09-04',
      facts: [{ id: 'vc-text-editing', text: 'The current product supports text-based editing for recorded video.' }],
      excerpt: 'Product source text remains transient and is not sent to the language model or serialized.',
    },
  ],
  productClaims: [{
    id: 'vc-editing-claim',
    text: 'VideoClaw lets creators edit a recorded video with text.',
    allowedSourceFactIds: ['vc-text-editing'],
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

const generatedDraft: GeneratedDraftV1 = {
  schemaVersion: 1,
  description: 'Create a credible founder pitch video with natural delivery, source-controlled claims, visible product proof, careful editing, reviewed captions, and one tested next step.',
  customerTrigger: 'The founder is preparing a pitch video and needs a factual workflow that preserves natural delivery.',
  competitorGap: 'Observed results separate pitch advice from claim control and product-proof production.',
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
  claimReferences: [{ claimId: 'vc-editing-claim', sourceFactIds: ['vc-text-editing'] }],
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

function withDraft(change: Partial<GeneratedDraftV1>): GeneratedDraftV1 {
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
    ['unsupported claim fact', withDraft({ claimReferences: [{ claimId: 'vc-editing-claim', sourceFactIds: ['ftc-support'] }] }), 'content.claim_reference'],
    ['unsupported VideoClaw claim', withDraft({ sections: [{ heading: 'Unsafe', markdown: 'VideoClaw guarantees a tenfold conversion increase.' }, generatedDraft.sections[1]] }), 'content.claim_reference'],
    ['copied FAQ passage', withDraft({ faqAnswers: [{ ...generatedDraft.faqAnswers[0], answer: context.sourceFacts[0].excerpt as string }, ...generatedDraft.faqAnswers.slice(1)] }), 'content.copied_passage'],
    ['non-PAA FAQ', withDraft({ faqAnswers: [{ ...generatedDraft.faqAnswers[0], question: 'Invented question?' }, ...generatedDraft.faqAnswers.slice(1)] }), 'content.faq_mismatch'],
    ['citation inventory mismatch', withDraft({ sourceReferences: [{ sourceId: 'yc' }, { sourceId: 'missing' }] }), 'content.citation_mismatch'],
  ])('blocks %s', (_label, draft, code) => {
    expect(inspectGeneratedDraft(context, draft).map((finding) => finding.code)).toContain(code);
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
