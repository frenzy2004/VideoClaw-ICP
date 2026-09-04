import matter from 'gray-matter';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

import { candidateFingerprints, type Candidate, type EvidenceBundle, type KeywordMetrics } from './domain';
import type { CheckedSource } from './sources';
import {
  inspectGeneratedDraft,
  materializeDraftBundle,
  renderEditorialSvg,
  selectProductMedia,
  type AllowlistedProductMedia,
  type DraftingContext,
  type GeneratedDraftV2,
} from './content-bundle';

type TestMarkdownNode = {
  type: string;
  depth?: number;
  value?: string;
  url?: string;
  children?: TestMarkdownNode[];
};

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
      excerpt: 'A transient excerpt with twelve uniquely copied words remains outside every persisted output artifact.',
    },
    {
      id: 'ftc',
      label: 'Federal Trade Commission: Advertising FAQs',
      url: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business',
      checkedAt: '2026-09-04T09:05:00.000Z',
      facts: [{ id: 'ftc-support', text: 'The FTC advertising guidance explains why objective claims need support.' }],
      excerpt: 'Another source excerpt exists only while the copied passage heuristic performs its comparison.',
    },
    {
      id: 'videoclaw',
      label: 'VideoClaw product features',
      url: 'https://videoclaw.com/features',
      checkedAt: '2026-09-04T09:10:00.000Z',
      facts: [{ id: 'vc-text-editing', text: 'VideoClaw lets creators edit a recorded video with text.' }],
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
  customerTrigger: 'Use this workflow for a factual pitch video with natural delivery.',
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
      'Follow the recipient requirements; otherwise set a duration that clearly communicates the problem, proof, and next step.',
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

const baselineEditorialClaims = [
  { id: 'fixture-description', location: '/description', span: 'Create a credible founder pitch video with natural delivery, source-controlled claims, visible product proof, careful editing, reviewed captions, and one tested next step.' },
  { id: 'fixture-trigger', location: '/customerTrigger', span: 'Use this workflow for a factual pitch video with natural delivery.' },
  { id: 'fixture-gap', location: '/competitorGap', span: 'Address the gap between pitch advice, claim control, and product-proof production.' },
  { id: 'fixture-answer-1', location: '/directAnswer', span: 'Create a founder pitch video by choosing one audience and next step, reducing the story to a few factual points, recording short natural takes, and showing one current product action.' },
  { id: 'fixture-answer-2', location: '/directAnswer', span: 'Then edit for clarity, verify every claim and caption against its source, and test the final playback path.' },
  { id: 'fixture-section-1', location: '/sections/0/markdown', span: 'Choose a few memorable points and speak from bullets, following application video guidance.' },
  { id: 'fixture-faq-1', location: '/faqAnswers/0/answer', span: 'Choose one audience, a few factual points, short founder-led takes, one product action, careful editing, and a tested next step.' },
  { id: 'fixture-faq-2', location: '/faqAnswers/1/answer', span: 'Include the customer situation, the useful change, relevant founder insight, one current product action, supportable evidence, and one next step.' },
  { id: 'fixture-faq-3', location: '/faqAnswers/2/answer', span: 'Follow the recipient requirements; otherwise set a duration that clearly communicates the problem, proof, and next step.' },
  { id: 'fixture-graphic-1', location: '/editorialGraphic/steps/0/detail', span: 'Choose one viewer and next step.' },
  { id: 'fixture-graphic-2', location: '/editorialGraphic/steps/1/detail', span: 'Bind each objective claim to evidence.' },
  { id: 'fixture-graphic-3', location: '/editorialGraphic/steps/2/detail', span: 'Record short natural sections.' },
  { id: 'fixture-graphic-4', location: '/editorialGraphic/steps/3/detail', span: 'Show one current product action.' },
  { id: 'fixture-graphic-5', location: '/editorialGraphic/steps/4/detail', span: 'Check captions, claims, and playback.' },
] as const;

context.sourceFacts[0].facts.push(...baselineEditorialClaims.map(({ id, span }) => ({ id, text: span })));
generatedDraft.claimBindings.unshift(...baselineEditorialClaims.map(({ id, location, span }) => ({
  location,
  span,
  sourceFactIds: [id],
  productClaimId: null,
})));

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
    ['/landing/%25252e%25252e/private/product.mp4', '/landing/full/founder-product.jpg'],
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

  it('rejects Unicode format controls in visible media labels', () => {
    expect(selectProductMedia(candidate, [{
      ...mediaAllowlist[0],
      caption: 'Trusted product demo\u202Egpj.exe',
    }])).toBeUndefined();
  });

  it.each(['title', 'alt', 'label', 'detail'] as const)('rejects XML-invalid controls in SVG-visible %s text', (field) => {
    const graphic = structuredClone(generatedDraft.editorialGraphic);
    if (field === 'title' || field === 'alt') graphic[field] = `Unsafe\u0001${field}`;
    else graphic.steps[0][field] = `Unsafe\u0001${field}`;

    expect(() => renderEditorialSvg(graphic)).toThrow(/XML/i);
  });

  it('rejects Unicode format controls in generated SVG-visible text', () => {
    expect(() => renderEditorialSvg({
      ...structuredClone(generatedDraft.editorialGraphic),
      title: 'Founder workflow\u202Egpj.exe',
    })).toThrow(/format control/i);
  });

  it('revalidates checked final URLs during direct materialization', () => {
    const uncheckedContext = {
      ...context,
      checkedSources: context.checkedSources.map((source, index) => index === 0
        ? { ...source, reachable: false }
        : source),
    };

    expect(() => materializeDraftBundle(uncheckedContext, generatedDraft, mediaAllowlist[0])).toThrow(/checked source/i);
  });

  it.each([
    { src: '/landing/../private/product.mp4' },
    { poster: '/landing/%25252e%25252e/private/product.jpg' },
    { width: 0 },
  ])('reparses and rejects malformed media during direct materialization', (mediaChange) => {
    expect(() => materializeDraftBundle(
      context,
      generatedDraft,
      { ...mediaAllowlist[0], ...mediaChange },
    )).toThrow(/media input/i);
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

  it.each([
    'Use VideoClaw because it cuts editing time in half.',
    'Use it because it cuts editing time in half.',
    'This workflow may double conversion.',
  ])('requires a binding for every product or modal prose claim: %s', (span) => {
    const unsafeDraft = withDraft({
      sections: [{
        ...generatedDraft.sections[0],
        markdown: `${generatedDraft.sections[0].markdown} ${span}`,
      }, generatedDraft.sections[1]],
    });

    expect(inspectGeneratedDraft(context, unsafeDraft)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding',
    }));
  });

  it('fails closed on an ordinary factual outcome sentence without a modal keyword', () => {
    const unsafeDraft = withDraft({
      sections: [{
        ...generatedDraft.sections[0],
        markdown: `${generatedDraft.sections[0].markdown} A backup copy remains available after recording.`,
      }, generatedDraft.sections[1]],
    });

    expect(inspectGeneratedDraft(context, unsafeDraft)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding',
    }));
  });

  it.each([
    'Editing costs are high',
    'Choose one audience\nEditing teams prefer backups',
    'Choose one audience\n\nEditing teams prefer backups',
    'Choose one audience; editing costs are high',
  ])('treats end, line, paragraph, and mixed-clause boundaries as claims: %s', (markdown) => {
    const unsafeDraft = withDraft({
      sections: [{ heading: 'Boundary case', markdown }, generatedDraft.sections[1]],
    });

    expect(inspectGeneratedDraft(context, unsafeDraft)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding',
    }));
  });

  it.each([
    'Choose one audience and review the final file.',
    'Choose one audience; backups matter',
    'Choose one audience and backups matter',
  ])('requires a binding for every substantive imperative-led prose span: %s', (markdown) => {
    const imperativeDraft = withDraft({
      sections: [{ heading: 'Imperative workflow', markdown }, generatedDraft.sections[1]],
    });

    expect(inspectGeneratedDraft(context, imperativeDraft)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding',
    }));
  });

  it.each([
    'A backup recording can protect the pitch.',
    'A backup recording could protect the pitch.',
    'A backup recording may protect the pitch.',
    'A backup recording might protect the pitch.',
    'A backup recording will protect the pitch.',
    'A backup recording would protect the pitch.',
    'A backup recording should protect the pitch.',
    'A backup recording must protect the pitch.',
  ])('requires a binding for a standalone modal claim: %s', (span) => {
    const unsafeDraft = withDraft({
      sections: [{
        ...generatedDraft.sections[0],
        markdown: `${generatedDraft.sections[0].markdown} ${span}`,
      }, generatedDraft.sections[1]],
    });

    expect(inspectGeneratedDraft(context, unsafeDraft)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding',
    }));
  });

  it('rejects a longer unsupported assertion bound to a shorter approved fact', () => {
    const shortFact = 'A backup recording protects the pitch.';
    const longerClaim = 'A backup recording protects the pitch and guarantees investor interest.';
    const shortFactContext: DraftingContext = {
      ...context,
      sourceFacts: context.sourceFacts.map((source) => source.id === 'yc'
        ? { ...source, facts: [...source.facts, { id: 'yc-backup', text: shortFact }] }
        : source),
    };
    const unsafeDraft = withDraft({
      sections: [{
        ...generatedDraft.sections[0],
        markdown: `${generatedDraft.sections[0].markdown} ${longerClaim}`,
      }, generatedDraft.sections[1]],
      claimBindings: [...generatedDraft.claimBindings, {
        location: '/sections/0/markdown',
        span: longerClaim,
        sourceFactIds: ['yc-backup'],
        productClaimId: null,
      }],
    });

    expect(inspectGeneratedDraft(shortFactContext, unsafeDraft)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding',
    }));
  });

  it.each(['Revenue doubles.', 'revenue doubles.'])('splits and rejects an appended unsupported outcome without intervening whitespace: %s', (appended) => {
    const unsafeDraft = withDraft({
      sections: [{
        ...generatedDraft.sections[0],
        markdown: `${generatedDraft.sections[0].markdown}${appended}`,
      }, generatedDraft.sections[1]],
    });

    expect(inspectGeneratedDraft(context, unsafeDraft)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding',
    }));
  });

  it('does not accept a topically overlapping advertising fact as support for an outcome claim', () => {
    const span = 'Objective advertising claims double conversion.';
    const unsafeDraft = withDraft({
      sections: [generatedDraft.sections[0], {
        ...generatedDraft.sections[1],
        markdown: `${generatedDraft.sections[1].markdown} ${span}`,
      }],
      claimBindings: [...generatedDraft.claimBindings, {
        location: '/sections/1/markdown',
        span,
        sourceFactIds: ['ftc-support'],
        productClaimId: null,
      }],
    });

    expect(inspectGeneratedDraft(context, unsafeDraft)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding',
    }));
  });

  it('accepts a normalized-exact approved fact and product claim for the reviewer causal example', () => {
    const span = 'Use VideoClaw because it cuts editing time in half.';
    const supportedContext: DraftingContext = {
      ...context,
      sourceFacts: context.sourceFacts.map((source) => source.id === 'videoclaw'
        ? {
          ...source,
          facts: [...source.facts, { id: 'vc-half-time', text: '  USE VideoClaw because it cuts editing time in half!  ' }],
        }
        : source),
      productClaims: [...context.productClaims, {
        id: 'vc-half-time-claim',
        text: span,
        allowedSourceFactIds: ['vc-half-time'],
        subjectAliases: ['VideoClaw', 'it'],
      }],
    };
    const supportedDraft = withDraft({
      sections: [{
        ...generatedDraft.sections[0],
        markdown: `${generatedDraft.sections[0].markdown} ${span}`,
      }, generatedDraft.sections[1]],
      claimBindings: [...generatedDraft.claimBindings, {
        location: '/sections/0/markdown',
        span,
        sourceFactIds: ['vc-half-time'],
        productClaimId: 'vc-half-time-claim',
      }],
    });

    expect(inspectGeneratedDraft(supportedContext, supportedDraft)).not.toContainEqual(expect.objectContaining({
      code: 'content.claim_binding',
    }));
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

  it.each([
    ['description', withDraft({ description: 'Create a founder workflow\u202Ewith hidden direction.' })],
    ['section body', withDraft({ sections: [{ heading: 'Safe heading', markdown: 'Review the file\u2066before delivery.' }, generatedDraft.sections[1]] })],
    ['FAQ answer', withDraft({ faqAnswers: [{ ...generatedDraft.faqAnswers[0], answer: '\uFEFFChoose one audience and final action.' }, ...generatedDraft.faqAnswers.slice(1)] })],
  ])('rejects a Unicode format control in generated %s', (_field, unsafeDraft) => {
    expect(inspectGeneratedDraft(context, unsafeDraft)).toContainEqual(expect.objectContaining({
      code: 'content.dto_invalid',
    }));
  });
});

describe('final serialized artifact inspection', () => {
  it.each([
    ['a Setext H1', 'Use this title\n===', ['Use this title'], /body_h1/],
    ['a closed code fence', 'Use this example.\n\n```text\nsafe\n```', ['Use this example.'], /code_fence/],
    ['a reference link', 'Use [the guide][yc].\n\n[yc]: https://www.ycombinator.com/video/', ['Use the guide.'], /reference_link/],
    ['an autolink', 'Use <https://www.ycombinator.com/video/>.', ['Use https://www.ycombinator.com/video/.'], /autolink/],
    ['a mailto destination', 'Use [email](mailto:editor@example.com).', ['Use email.'], /link_destination/],
    ['a javascript destination', 'Use [this](javascript:alert(1)).', ['Use this.'], /link_destination/],
    ['an unsafe image destination', 'Use this image.\n\n![Use proof](javascript:alert(1))', ['Use this image.', 'Use proof'], /link_destination/],
  ])('rejects final Markdown containing %s', (_label, markdown, spans, expected) => {
    const fixtureFacts = spans.map((span, index) => ({ id: `final-ast-${index}`, text: span }));
    const supportedContext = {
      ...context,
      sourceFacts: context.sourceFacts.map((source, index) => index === 0
        ? { ...source, facts: [...source.facts, ...fixtureFacts] }
        : source),
    };
    const unsafeDraft = withDraft({
      sections: [{ heading: 'Unsafe', markdown }, generatedDraft.sections[1]],
      claimBindings: [
        ...generatedDraft.claimBindings.filter(({ location }) => location !== '/sections/0/markdown'),
        ...spans.map((span, index) => ({
          location: '/sections/0/markdown',
          span,
          sourceFactIds: [`final-ast-${index}`],
          productClaimId: null,
        })),
      ],
    });

    expect(() => materializeDraftBundle(supportedContext, unsafeDraft, mediaAllowlist[0])).toThrow(expected);
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

  it.each(['   ', 'Trusted source\nInjected prose', 'Trusted\u0007source'])('rejects an invalid source label before serialization', (label) => {
    const invalidContext = {
      ...context,
      sourceFacts: context.sourceFacts.map((source, index) => index === 0 ? { ...source, label } : source),
    };

    expect(() => materializeDraftBundle(invalidContext, generatedDraft, mediaAllowlist[0])).toThrow(/source fact input/i);
  });

  it('renders the Sources section as exactly one link-only list with literal labels and destinations', () => {
    const injectedLabel = 'Trusted *source* [attempt](https://attacker.example/path)';
    const injectedContext = {
      ...context,
      sourceFacts: context.sourceFacts.map((source, index) => index === 0
        ? { ...source, label: injectedLabel }
        : source),
    };

    const body = matter(materializeDraftBundle(injectedContext, generatedDraft, mediaAllowlist[0]).markdown).content;
    const tree = unified().use(remarkParse).parse(body) as TestMarkdownNode & { children: TestMarkdownNode[] };
    const sourceHeadingIndex = tree.children.findIndex((node) => (
      node.type === 'heading'
      && node.depth === 2
      && node.children?.[0]?.value === 'Sources'
    ));
    const trailing = tree.children.slice(sourceHeadingIndex + 1);
    const list = trailing[0];

    expect(sourceHeadingIndex).toBeGreaterThan(-1);
    expect(trailing).toHaveLength(1);
    expect(list.type).toBe('list');
    expect(list.children).toHaveLength(3);
    expect(list.children?.map((item) => {
      const link = item.children?.[0]?.children?.[0];
      const text = link?.children?.[0];
      return { type: link?.type, url: link?.url, textType: text?.type, text: text?.value };
    })).toEqual([
      {
        type: 'link',
        url: 'https://www.ycombinator.com/video/',
        textType: 'text',
        text: injectedLabel,
      },
      {
        type: 'link',
        url: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business',
        textType: 'text',
        text: 'Federal Trade Commission: Advertising FAQs',
      },
      {
        type: 'link',
        url: 'https://videoclaw.com/features',
        textType: 'text',
        text: 'VideoClaw product features',
      },
    ]);
  });

  it('runs copied-passage protection over visible SVG text after assembly', () => {
    const copiedSpan = `Review ${context.sourceFacts[0].excerpt as string}`;
    const copiedContext = {
      ...context,
      sourceFacts: context.sourceFacts.map((source, index) => index === 0
        ? { ...source, facts: [...source.facts, { id: 'copied-graphic-fixture', text: copiedSpan }] }
        : source),
    };
    const copiedGraphic = withDraft({
      editorialGraphic: {
        ...generatedDraft.editorialGraphic,
        steps: generatedDraft.editorialGraphic.steps.map((step, index) => index === 0
          ? { ...step, detail: copiedSpan }
          : step),
      },
      claimBindings: [
        ...generatedDraft.claimBindings.filter(({ location }) => location !== '/editorialGraphic/steps/0/detail'),
        {
          location: '/editorialGraphic/steps/0/detail',
          span: copiedSpan,
          sourceFactIds: ['copied-graphic-fixture'],
          productClaimId: null,
        },
      ],
    });

    expect(() => materializeDraftBundle(copiedContext, copiedGraphic, mediaAllowlist[0])).toThrow(/copied_passage/);
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

  it('rejects a Unicode format control introduced by a runtime-owned final field', () => {
    const unsafeContext = {
      ...context,
      candidate: { ...context.candidate, title: 'Founder workflow\u202Egpj.exe' },
    };

    expect(() => materializeDraftBundle(unsafeContext, generatedDraft, mediaAllowlist[0])).toThrow(/format_control/);
  });
});
