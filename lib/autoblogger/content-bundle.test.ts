import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

import { candidateFingerprints, type Candidate, type EvidenceBundle, type KeywordMetrics } from './domain';
import type { CheckedSource } from './sources';
import {
  DraftMaterializationError,
  GENERATED_DRAFT_V2_JSON_SCHEMA,
  GeneratedDraftV2Schema,
  assertSourceFacts,
  inspectFinalMarkdown,
  inspectGeneratedDraft,
  productReferenceManifest,
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
  schemaVersion: 2,
  candidateFingerprint: candidateFingerprints(candidate).candidate,
  signals: { autocomplete: ['how to make a founder pitch video naturally'], peopleAlsoAsk: [], relatedSearches: [] },
  serp: {
    organicResultCount: 9,
    peopleAlsoAsk: [
      'How do you create a founder pitch video?',
      'What should a startup pitch video include?',
      'How long should a founder pitch video be?',
    ],
  },
  sources: [
    { originalUrl: 'https://www.ycombinator.com/video/', finalUrl: 'https://www.ycombinator.com/video/', authoritative: true },
    { originalUrl: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business', finalUrl: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business', authoritative: true },
    { originalUrl: 'https://videoclaw.com/features', finalUrl: 'https://videoclaw.com/features', authoritative: true },
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
  url: source.originalUrl,
  finalUrl: source.finalUrl,
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
  customerTrigger: candidate.icp,
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
  { id: 'fixture-gap', location: '/competitorGap', span: 'Address the gap between pitch advice, claim control, and product-proof production.' },
  { id: 'fixture-answer-1', location: '/directAnswer', span: 'Create a founder pitch video by choosing one audience and next step, reducing the story to a few factual points, recording short natural takes, and showing one current product action.' },
  { id: 'fixture-answer-2', location: '/directAnswer', span: 'Then edit for clarity, verify every claim and caption against its source, and test the final playback path.' },
  { id: 'fixture-heading-1', location: '/sections/0/heading', span: 'Build a factual story spine' },
  { id: 'fixture-section-1', location: '/sections/0/markdown', span: 'Choose a few memorable points and speak from bullets, following application video guidance.' },
  { id: 'fixture-heading-2', location: '/sections/1/heading', span: 'Check product and advertising claims' },
  { id: 'fixture-faq-1', location: '/faqAnswers/0/answer', span: 'Choose one audience, a few factual points, short founder-led takes, one product action, careful editing, and a tested next step.' },
  { id: 'fixture-faq-2', location: '/faqAnswers/1/answer', span: 'Include the customer situation, the useful change, relevant founder insight, one current product action, supportable evidence, and one next step.' },
  { id: 'fixture-faq-3', location: '/faqAnswers/2/answer', span: 'Follow the recipient requirements; otherwise set a duration that clearly communicates the problem, proof, and next step.' },
  { id: 'fixture-graphic-title', location: '/editorialGraphic/title', span: 'Founder pitch video workflow <script>alert("x")</script>' },
  { id: 'fixture-graphic-alt', location: '/editorialGraphic/alt', span: 'Five-step founder pitch video workflow from audience choice to final playback check' },
  { id: 'fixture-graphic-label-1', location: '/editorialGraphic/steps/0/label', span: 'Audience' },
  { id: 'fixture-graphic-1', location: '/editorialGraphic/steps/0/detail', span: 'Choose one viewer and next step.' },
  { id: 'fixture-graphic-label-2', location: '/editorialGraphic/steps/1/label', span: 'Facts' },
  { id: 'fixture-graphic-2', location: '/editorialGraphic/steps/1/detail', span: 'Bind each objective claim to evidence.' },
  { id: 'fixture-graphic-label-3', location: '/editorialGraphic/steps/2/label', span: 'Takes' },
  { id: 'fixture-graphic-3', location: '/editorialGraphic/steps/2/detail', span: 'Record short natural sections.' },
  { id: 'fixture-graphic-label-4', location: '/editorialGraphic/steps/3/label', span: 'Proof' },
  { id: 'fixture-graphic-4', location: '/editorialGraphic/steps/3/detail', span: 'Show one current product action.' },
  { id: 'fixture-graphic-label-5', location: '/editorialGraphic/steps/4/label', span: 'Review' },
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

describe('source fact body offsets', () => {
  const text = 'Demo checklist. Do not skip rehearsal before sharing.';

  it.each([undefined, 0, 16, text.length])('accepts bodyStart %j without changing evidence text or inventing an offset', (bodyStart) => {
    const sources = structuredClone(context.sourceFacts);
    sources[0].facts[0] = { id: 'offset-fixture', text, evidenceKind: 'body',
      ...(bodyStart === undefined ? {} : { bodyStart }),
    };
    expect(() => assertSourceFacts(sources)).not.toThrow();
    expect(sources[0].facts[0].text).toBe(text);
    if (bodyStart === undefined) expect(sources[0].facts[0]).not.toHaveProperty('bodyStart');
    else expect(sources[0].facts[0]).toHaveProperty('bodyStart', bodyStart);
  });

  it.each([-1, 1.5, text.length + 1, NaN, Infinity, '16', null])('rejects invalid bodyStart %j', (bodyStart) => {
    const sources = structuredClone(context.sourceFacts);
    sources[0].facts[0] = { id: 'offset-fixture', text, evidenceKind: 'body' };
    Object.assign(sources[0].facts[0], { bodyStart });
    expect(() => assertSourceFacts(sources)).toThrow(/Invalid source fact input/);
  });
});

describe('caller-owned campaign context', () => {
  it('accepts the canonical customerTrigger without a source fact or binding', () => {
    expect(inspectGeneratedDraft(context, generatedDraft)).toEqual([]);
    expect(matter(materializeDraftBundle(context, generatedDraft, mediaAllowlist[0]).markdown).data.customerTrigger)
      .toBe(candidate.icp);
  });

  it.each([
    'A different audience',
    `${candidate.icp} Market demand doubled.`,
    candidate.icp.toLowerCase(),
    ` ${candidate.icp} `,
  ])('rejects altered customerTrigger metadata deterministically: %j', (customerTrigger) => {
    const value = withDraft({ customerTrigger });
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({
      code: 'content.campaign_context', location: '/customerTrigger', span: customerTrigger,
    }));
    expect(() => materializeDraftBundle(context, value, mediaAllowlist[0])).toThrow(/content.campaign_context/);
  });

  it('rejects customerTrigger source bindings in both draft schemas', () => {
    const value = withDraft({ claimBindings: [...generatedDraft.claimBindings, {
      location: '/customerTrigger', span: candidate.icp, sourceFactIds: ['yc-bullets'], productClaimId: null,
    }] });
    expect(GeneratedDraftV2Schema.safeParse(value).success).toBe(false);
    const locationPattern = new RegExp(GENERATED_DRAFT_V2_JSON_SCHEMA.properties.claimBindings.items.properties.location.pattern);
    expect(locationPattern.test('/customerTrigger')).toBe(false);
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({ code: 'content.dto_invalid' }));
  });

  it.each(['/description', '/competitorGap', '/directAnswer', '/sections/0/markdown', '/faqAnswers/0/answer', '/editorialGraphic/steps/0/detail'])(
    'still requires source bindings at %s with canonical campaign metadata', (location) => {
      const value = withDraft({ claimBindings: generatedDraft.claimBindings.filter(binding => binding.location !== location) });
      expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({
        code: 'content.claim_binding', location, reason: 'missing_binding',
      }));
    },
  );

  it('does not exempt an unsupported public product claim under canonical metadata', () => {
    const span = 'The app guarantees a tenfold conversion increase.';
    const value = withDraft({
      sections: [{ ...generatedDraft.sections[0], markdown: span }, generatedDraft.sections[1]],
      claimBindings: [...generatedDraft.claimBindings.filter(binding => binding.location !== '/sections/0/markdown'), {
        location: '/sections/0/markdown', span, sourceFactIds: ['yc-bullets'], productClaimId: null,
      }],
    });
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', location: '/sections/0/markdown', span, reason: 'unapproved_product_reference',
    }));
  });
});

describe('reader-facing editorial quality', () => {
  it.each([
    candidate.title,
    'HOW TO MAKE A FOUNDER PITCH VIDEO — WITHOUT LOSING YOUR VOICE!',
  ])('rejects a description that repeats the normalized title: %s', (description) => {
    expect(inspectGeneratedDraft(context, withDraft({ description }))).toContainEqual(
      expect.objectContaining({ code: 'content.description_duplicate', location: '/description' }),
    );
  });

  it.each([79, 201])('rejects a %i-character description outside the worker house range', (length) => {
    expect(inspectGeneratedDraft(context, withDraft({ description: 'x'.repeat(length) }))).toContainEqual(
      expect.objectContaining({ code: 'content.description_length', location: '/description' }),
    );
  });

  it.each([80, 200])('allows the %i-character description boundary without claiming semantic quality', (length) => {
    const findings = inspectGeneratedDraft(context, withDraft({ description: 'x'.repeat(length) }));
    expect(findings.some(({ code }) => code.startsWith('content.description_'))).toBe(false);
  });

  it('rejects repeated process labels across visible prose and FAQs with exact repair locations', () => {
    const value = withDraft({});
    value.sections[0].markdown = '**Original recommendation:** Record a short practice take.';
    value.faqAnswers[0].answer = 'Original editorial note: Choose one audience.';
    expect(inspectGeneratedDraft(context, value)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'content.editorial_scaffolding', location: '/sections/0/markdown',
        span: 'Original recommendation: Record a short practice take.',
      }),
      expect.objectContaining({
        code: 'content.editorial_scaffolding', location: '/faqAnswers/0/answer',
        span: 'Original editorial note: Choose one audience.',
      }),
    ]));
  });

  it('allows a section-level recommendation heading and a visibly hypothetical example', () => {
    const value = withDraft({});
    value.sections[0] = {
      heading: 'Recommended recording workflow',
      markdown: 'Record a short practice take.\n\nHypothetical example: A founder rehearses the opening before recording.',
    };
    value.customerTrigger = 'Original editorial note: The audience framing belongs in private metadata.';
    value.competitorGap = 'Original recommendation: The proposed synthesis is not a measured market gap.';
    expect(inspectGeneratedDraft(context, value).some(({ code }) => code === 'content.editorial_scaffolding')).toBe(false);
  });

  it.each(['\n', '  \n', '\\\n'])('detects repeated visible labels across Markdown line breaks %j', (separator) => {
    const value = withDraft({});
    value.sections[0].markdown = `Original${separator}recommendation: Plan the recording.\n\nOriginal editorial${separator}note: Rehearse the opening.`;
    expect(inspectGeneratedDraft(context, value)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'content.editorial_scaffolding', location: '/sections/0/markdown',
        span: expect.stringContaining('recommendation: Plan the recording.'),
      }),
      expect.objectContaining({
        code: 'content.editorial_scaffolding', location: '/sections/0/markdown',
        span: expect.stringContaining('note: Rehearse the opening.'),
      }),
    ]));
  });
});

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

  it('gives bounded repair an exact copied-prose target instead of a generic rejection', () => {
    const copied = context.sourceFacts[0].excerpt as string;
    const draft = withDraft({ sections: [{ heading: 'Checklist', markdown: copied }, generatedDraft.sections[1]] });
    const issue = inspectGeneratedDraft(context, draft).find(({ code }) => code === 'content.copied_passage');
    expect(issue).toMatchObject({ location: '/sections/0/markdown', span: copied });
    expect(issue?.message).toContain('a transient excerpt with twelve uniquely copied words remains outside every persisted');
    expect(issue?.repairInstruction).toContain('paraphrase');
  });

  it('reports copied graphic text before the only repair pass', () => {
    const copied = context.sourceFacts[0].excerpt as string;
    const draft = withDraft({ editorialGraphic: { ...generatedDraft.editorialGraphic, alt: copied } });
    expect(inspectGeneratedDraft(context, draft)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'content.copied_passage', location: '/editorialGraphic/alt', span: copied }),
    ]));
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

  it.each(['autocomplete', 'relatedSearches', 'peopleAlsoAsk'] as const)('fills an empty secondary-keyword list only from covered %s evidence', (signal) => {
    const local = structuredClone(context);
    local.candidate.secondaryKeywords = [];
    local.evidence.signals.autocomplete = [];
    local.evidence.signals.relatedSearches = [];
    local.evidence.signals.peopleAlsoAsk = [];
    local.evidence.signals[signal] = [candidate.primaryKeyword, 'founder pitch video free download', 'founder pitch video'];
    const original = structuredClone(local);
    const bundle = materializeDraftBundle(local, generatedDraft, mediaAllowlist[0]);
    expect(matter(bundle.markdown).data.secondaryKeywords).toEqual(['founder pitch video']);
    expect(local).toEqual(original);
    expect(bundle.article).toMatchObject({status:'review', approvals:{copy:false, factual:false, legal:false, visual:false}});
  });

  it('retains an observed PAA question as secondary search evidence when the visible FAQ answers it', () => {
    const local = structuredClone(context);
    local.candidate.secondaryKeywords = [];
    local.evidence.signals.autocomplete = [];
    local.evidence.signals.relatedSearches = [];
    local.evidence.signals.peopleAlsoAsk = ['How long should a founder pitch video be?'];
    const bundle = materializeDraftBundle(local, generatedDraft, mediaAllowlist[0]);
    expect(matter(bundle.markdown).data.secondaryKeywords).toEqual(['how long should a founder pitch video be']);
  });

  it('does not use an uncovered PAA modifier or invent evidence from a visible FAQ alone', () => {
    const local = structuredClone(context);
    local.candidate.secondaryKeywords = [];
    local.evidence.signals.autocomplete = [];
    local.evidence.signals.relatedSearches = [];
    local.evidence.signals.peopleAlsoAsk = ['How long should a founder pitch video be for an IPO?'];
    expect(() => materializeDraftBundle(local, generatedDraft, mediaAllowlist[0])).toThrow('content.secondary_keyword_missing');
  });

  it.each(['no observations', 'primary only', 'uncovered modifier', 'unrelated phrase'])
  ('blocks empty secondary keywords with %s instead of inventing metadata', (variant) => {
    const local = structuredClone(context);
    local.candidate.secondaryKeywords = [];
    local.evidence.signals.autocomplete = variant === 'primary only' ? [candidate.primaryKeyword]
      : variant === 'uncovered modifier' ? ['founder pitch video free download']
      : variant === 'unrelated phrase' ? ['a tested next step'] : [];
    local.evidence.signals.relatedSearches = [];
    expect(() => materializeDraftBundle(local, generatedDraft, mediaAllowlist[0])).toThrow('content.secondary_keyword_missing');
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
    expect(parsed.content).toContain('[application video guidance](https://www.ycombinator.com/video/)');
    expect(parsed.content).not.toMatch(/^## (?:Sources|FAQs|Frequently asked questions)$/gmi);
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
  it('allows a natural general paraphrase with exact visible bindings and selected fact IDs', () => {
    const span = 'The application advice favors bullet points for speaking.';
    const paraphrase = withDraft({
      sections: [{ ...generatedDraft.sections[0], markdown: span }, generatedDraft.sections[1]],
      claimBindings: generatedDraft.claimBindings.map((binding) => binding.location === '/sections/0/markdown'
        ? { ...binding, span, sourceFactIds: ['yc-bullets'] }
        : binding),
    });

    // This checks structural eligibility only; the drafter must still obtain independent support review.
    expect(inspectGeneratedDraft(context, paraphrase)).toEqual([]);
  });

  it.each([
    ['raw HTML', withDraft({ sections: [{ heading: 'Unsafe', markdown: '<aside>hidden</aside>' }, generatedDraft.sections[1]] }), 'content.raw_html'],
    ['body H1', withDraft({ sections: [{ heading: 'Unsafe', markdown: '# Duplicate title' }, generatedDraft.sections[1]] }), 'content.body_h1'],
    ['secret-like text', withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Token: sk-proj-abcdefghijklmnopqrstuvwxyz123456' }, generatedDraft.sections[1]] }), 'content.secret'],
    ['unsupported link', withDraft({ sections: [{ heading: 'Unsafe', markdown: '[Unknown](https://example.net/unsupported)' }, generatedDraft.sections[1]] }), 'content.unsupported_link'],
    ['unsupported raw URL', withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Read https://example.net/unsupported before recording.' }, generatedDraft.sections[1]] }), 'content.unsupported_link'],
    ['malformed Markdown', withDraft({ sections: [{ heading: 'Unsafe', markdown: '```text\nnever closed' }, generatedDraft.sections[1]] }), 'content.markdown_malformed'],
    ['research boilerplate', withDraft({ sections: [{ heading: 'Unsafe', markdown: 'Our debug research notes from the SERP say this is best.' }, generatedDraft.sections[1]] }), 'content.research_boilerplate'],
    ['copied source passage', withDraft({ sections: [{ heading: 'Unsafe', markdown: context.sourceFacts[0].excerpt as string }, generatedDraft.sections[1]] }), 'content.copied_passage'],
    ['unapproved product fact', withDraft({ claimBindings: generatedDraft.claimBindings.map((binding) => binding.productClaimId === 'vc-editing-claim' ? { ...binding, sourceFactIds: ['ftc-support'] } : binding) }), 'content.claim_binding'],
    ['unsupported product assertion', withDraft({ sections: [{ heading: 'Unsafe', markdown: 'The app guarantees a tenfold conversion increase.' }, generatedDraft.sections[1]] }), 'content.claim_binding'],
    ['appended objective assertion', withDraft({ sections: [generatedDraft.sections[0], { ...generatedDraft.sections[1], markdown: `${generatedDraft.sections[1].markdown} This workflow doubles conversion.` }] }), 'content.claim_binding'],
    ['altered campaign metadata', withDraft({ customerTrigger: `${generatedDraft.customerTrigger} Market demand doubled.` }), 'content.campaign_context'],
    ['objective SVG assertion', withDraft({
      editorialGraphic: {
        ...generatedDraft.editorialGraphic,
        steps: generatedDraft.editorialGraphic.steps.map((step, index) => index === 0
          ? { ...step, detail: 'Reliable workflows double conversion.' }
          : step),
      },
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

  it('requires an exact approved fact binding for a factual section heading', () => {
    const unsafeDraft = withDraft({
      sections: [{ ...generatedDraft.sections[0], heading: 'VideoClaw doubles conversion' }, generatedDraft.sections[1]],
    });

    expect(inspectGeneratedDraft(context, unsafeDraft)).toContainEqual(expect.objectContaining({
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

describe('contextual product references and precise binding failures', () => {
  function withSpans(spans: string[]): GeneratedDraftV2 {
    return withDraft({
      sections: [{ heading: 'Founder demo workflow', markdown: spans.join(' ') }, generatedDraft.sections[1]],
      claimBindings: [
        ...generatedDraft.claimBindings.filter(({ location }) => !location.startsWith('/sections/0/')),
        { location: '/sections/0/heading', span: 'Founder demo workflow', sourceFactIds: ['yc-bullets'], productClaimId: null },
        ...spans.map((span) => ({
          location: '/sections/0/markdown', span,
          sourceFactIds: [span === context.productClaims[0].text ? 'vc-text-editing' : 'yc-bullets'],
          productClaimId: span === context.productClaims[0].text ? 'vc-editing-claim' : null,
        })),
      ].reverse(),
    });
  }

  const subject = 'The team';
  const ordinary = 'The team reviews the webinar.';
  const action = 'It records an introduction and sends the draft for approval.';
  function referentReview(value: GeneratedDraftV2, span = action) {
    const bindingIndex = value.claimBindings.findIndex(b => b.span === span);
    const binding = value.claimBindings[bindingIndex];
    return {
      bindingIndex,
      bindingHash: createHash('sha256').update(JSON.stringify([binding.location, binding.span, binding.sourceFactIds, binding.productClaimId])).digest('hex'),
      contextHash: createHash('sha256').update(JSON.stringify([context.candidate.title, value, context.productClaims])).digest('hex'),
      classification: 'non_product' as const, subject,
      rationale: 'The adjacent visible subject is the human team, not VideoClaw or an unnamed software product.',
    };
  }

  it('requires current independent contextual review to resolve a human-team pronoun', () => {
    const value = withSpans([ordinary, action]);
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({ span: action, reason: 'unapproved_product_reference' }));
    expect(inspectGeneratedDraft(context, value, [referentReview(value)]))
      .not.toContainEqual(expect.objectContaining({ span: action, reason: 'unapproved_product_reference' }));
  });

  it('retains an earlier object in the same numbered procedure for exact independent reference review', () => {
    const spans = ['Record a short sample from approved copy.', 'Listen for problems that would distract a buyer.',
      'Do not continue until the sample is usable.', 'If it fails, change one variable and test again.'];
    const value = withSpans(spans);
    value.sections[0].markdown = spans.map((span, index) => `${index + 1}. ${span}`).join('\n\n');
    const review = {...referentReview(value, spans[3]), subject:'a short sample from approved copy'};
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({span:spans[3], reason:'unapproved_product_reference'}));
    expect(inspectGeneratedDraft(context, value, [review]))
      .not.toContainEqual(expect.objectContaining({span:spans[3], reason:'unapproved_product_reference'}));
  });

  it.each(['separate procedures', 'future object', 'earlier product context'])('does not use %s to waive a reference finding', mode => {
    const first = 'Record a short sample from approved copy.';
    const target = 'If it fails, change one variable and test again.';
    const middle = ['Listen for distractions in the recording.', 'Check the input level before continuing.', 'Leave time for another test.'];
    const spans = mode === 'future object' ? [...middle, target, first]
      : mode === 'earlier product context' ? [first, 'The team also reviews VideoClaw.', ...middle, target]
        : [first, ...middle, target];
    const value = withSpans(spans);
    value.sections[0].markdown = spans.map((span, index) => `${index + 1}. ${span}`).join('\n\n');
    if(mode === 'separate procedures') value.sections[0].markdown = `1. ${first}\n\n---\n\n${[...middle,target].map((span,index)=>`${index+1}. ${span}`).join('\n\n')}`;
    const review = {...referentReview(value, target), subject:'a short sample from approved copy'};
    expect(inspectGeneratedDraft(context, value, [review]))
      .toContainEqual(expect.objectContaining({span:target, reason:'unapproved_product_reference'}));
  });

  it.each(['linked product', 'hidden label', 'linked target'])('uses rendered numbered-procedure text with external reference definitions: %s', mode => {
    const first = 'Record a short sample from approved copy.';
    const target = 'If it fails, change one variable and test again.';
    const spans = [...(mode === 'linked product' ? [context.productClaims[0].text] : []), first,
      'Listen for distractions in the recording.', 'Check the input level before continuing.', 'Leave time for another test.', target];
    const value = withSpans(spans);
    value.sections[0].markdown = spans.map((span,index)=>`${index+1}. ${span}`).join('\n\n');
    if(mode === 'linked product') value.sections[0].markdown = value.sections[0].markdown.replace('VideoClaw', 'Video[Claw][help]');
    if(mode === 'hidden label') value.sections[0].markdown = value.sections[0].markdown.replace('a short sample from approved copy', '[a short sample from approved copy][the phantom sample]');
    if(mode === 'linked target') value.sections[0].markdown = value.sections[0].markdown.replace('If it fails', 'If [it][help] fails');
    value.sections[0].markdown += '\n\n[help]: https://www.ycombinator.com/video/\n[the phantom sample]: https://www.ycombinator.com/video/';
    const review = {...referentReview(value,target),subject:mode === 'hidden label' ? 'the phantom sample' : 'a short sample from approved copy'};
    const findings = inspectGeneratedDraft(context,value,[review]);
    if(mode === 'linked target') expect(findings).not.toContainEqual(expect.objectContaining({span:target,reason:'unapproved_product_reference'}));
    else expect(findings).toContainEqual(expect.objectContaining({span:target,reason:'unapproved_product_reference'}));
  });

  it.each([
    ['Ask the product lead to check each screen.', 'the product lead'],
    ['Confirm the product flow before recording.', 'the product flow'],
    ['Build the product demo storyboard in order.', 'the product demo storyboard'],
    ['The product accuracy owner approves the script.', 'the product accuracy owner'],
  ])('lets a current independent review resolve an ordinary product compound: %s', (span, anchor) => {
    const value = withSpans([span]);
    const entry = productReferenceManifest(context, value).find(item => item.span === span)!;
    expect(entry).toBeDefined();
    expect(entry.explicitProductContext).toBe(false);
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({ span, reason: 'unapproved_product_reference' }));
    expect(inspectGeneratedDraft(context, value, [{ ...referentReview(value, span), subject: anchor }]))
      .not.toContainEqual(expect.objectContaining({ span, reason: 'unapproved_product_reference' }));
  });

  it.each([
    'The product lead says VideoClaw guarantees perfect edits.',
    'The product demo shows this app guarantees perfect edits.',
    'The product lead says the product guarantees perfect edits.',
    'Our product lead guarantees perfect edits.',
    'The product lead software guarantees perfect edits.',
    'The product demo tool guarantees perfect edits.',
    'The product demo-tool guarantees perfect edits.',
    'The product demo creation software guarantees perfect edits.',
    'The product flow editing tool automatically removes background noise.',
    'The product lead virtual assistant guarantees perfect edits.',
    'The product demo review software guarantees perfect edits.',
    'The product demo on-demand generation software guarantees perfect edits.',
    'The product flow review assistant guarantees perfect edits.',
    'The product demo review tools guarantee perfect edits.',
    'The product flow review assistants guarantee perfect edits.',
    'The product demo review editors guarantee perfect edits.',
    'The product flow review systems guarantee perfect edits.',
    'An automated editing system reviews the product demo and guarantees perfect edits.',
    'The product flow review product guarantees perfect edits.',
    "The product lead's tool guarantees perfect edits.",
    'The product automatically guarantees perfect edits.',
  ])('does not let a compound anchor waive an actual product context: %s', span => {
    const value = withSpans([span]);
    const anchor = span.match(/the product (?:demo|flow|lead)/iu)?.[0] ?? 'the product';
    expect(inspectGeneratedDraft(context, value, [{ ...referentReview(value, span), subject: anchor }]))
      .toContainEqual(expect.objectContaining({ span, reason: 'unapproved_product_reference' }));
  });

  it.each(['stale binding', 'stale context', 'missing subject', 'ambiguous', 'product', 'duplicate'])('does not accept a %s reference review', kind => {
    const value = withSpans([ordinary, action]);
    const review = referentReview(value);
    const altered = { ...review,
      ...(kind === 'stale binding' ? { bindingHash: '0'.repeat(64) } : {}),
      ...(kind === 'stale context' ? { contextHash: '0'.repeat(64) } : {}),
      ...(kind === 'missing subject' ? { subject: 'An absent presenter' } : {}),
      ...(['ambiguous', 'product'].includes(kind) ? { classification: kind } : {}),
    };
    expect(inspectGeneratedDraft(context, value, kind === 'duplicate' ? [review, review] : [altered]))
      .toContainEqual(expect.objectContaining({ span: action, reason: 'unapproved_product_reference' }));
  });

  it.each([
    ['The team reviews VideoClaw.', 'It automatically guarantees perfect edits.'],
    ['The team reviews the webinar.', 'VideoClaw guarantees perfect edits.'],
    ['The team reviews the webinar.', 'The app guarantees perfect edits.'],
    ['The team reviews the webinar.', 'This product guarantees perfect edits.'],
  ])('never lets contextual classification approve an explicit or adjacent product claim: %j', (before, span) => {
    const value = withSpans([before, span]);
    expect(inspectGeneratedDraft(context, value, [referentReview(value, span)]))
      .toContainEqual(expect.objectContaining({ span, reason: 'unapproved_product_reference' }));
  });

  it.each(['The team', 'VideoClaw'])('retains graphic label context for a following detail: %s', label => {
    const value = withDraft({ editorialGraphic: { ...generatedDraft.editorialGraphic,
      steps: [{ label, detail: 'It records an introduction for the team.' }, ...generatedDraft.editorialGraphic.steps.slice(1)],
    } });
    value.claimBindings = value.claimBindings.filter(b => !b.location.startsWith('/editorialGraphic/steps/0/'));
    value.claimBindings.push({ location: '/editorialGraphic/steps/0/label', span: label, sourceFactIds: ['yc-bullets'], productClaimId: null },
      { location: '/editorialGraphic/steps/0/detail', span: value.editorialGraphic.steps[0].detail, sourceFactIds: ['yc-bullets'], productClaimId: null });
    const entry = productReferenceManifest(context, value).find(e => e.location === '/editorialGraphic/steps/0/detail')!;
    expect(entry.nearby).toContain(label);
    const review = { ...referentReview(value, entry.span), subject: 'the team' };
    const blocked = inspectGeneratedDraft(context, value, [review]).some(f => f.span === entry.span && f.reason === 'unapproved_product_reference');
    expect(blocked).toBe(label === 'VideoClaw');
  });

  it('retains a product antecedent across a section boundary despite a claimed ordinary anchor', () => {
    const value = withSpans([context.productClaims[0].text]);
    value.sections[1] = { heading: 'Next step', markdown: 'It guarantees perfect edits for the team.' };
    value.claimBindings = value.claimBindings.filter(b => !b.location.startsWith('/sections/1/'));
    value.claimBindings.push({ location: '/sections/1/heading', span: 'Next step', sourceFactIds: ['yc-bullets'], productClaimId: null },
      { location: '/sections/1/markdown', span: value.sections[1].markdown, sourceFactIds: ['yc-bullets'], productClaimId: null });
    const review = { ...referentReview(value, value.sections[1].markdown), subject: 'the team' };
    expect(inspectGeneratedDraft(context, value, [review])).toContainEqual(expect.objectContaining({ span: value.sections[1].markdown, reason: 'unapproved_product_reference' }));
    expect(() => materializeDraftBundle(context, value, mediaAllowlist[0], [review])).toThrow('Unsafe generated draft');
  });

  it('reports an invalid section binding without crashing reference-manifest construction', () => {
    const value = withDraft({ claimBindings: [...generatedDraft.claimBindings,
      { location: '/sections/999/markdown', span: 'It guarantees perfect edits.', sourceFactIds: ['yc-bullets'], productClaimId: null }] });
    expect(() => productReferenceManifest(context, value)).not.toThrow();
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({ location: '/sections/999/markdown', reason: 'span_mismatch' }));
  });

  it.each(['What can VideoClaw do for the team?', 'What should the team do next?'])('retains FAQ question context: %s', question => {
    const value = structuredClone(generatedDraft);
    const localContext = structuredClone(context);
    localContext.evidence.faqQuestions[0] = question;
    value.faqAnswers[0] = { question, answer: action };
    value.claimBindings = value.claimBindings.filter(b => b.location !== '/faqAnswers/0/answer');
    value.claimBindings.push({ location: '/faqAnswers/0/answer', span: action, sourceFactIds: ['yc-bullets'], productClaimId: null });
    const entry = productReferenceManifest(localContext, value).find(e => e.location === '/faqAnswers/0/answer')!;
    expect(entry.nearby).toContain(question);
    const review = { ...referentReview(value), bindingHash: entry.bindingHash, contextHash: entry.contextHash };
    const blocked = question.includes('VideoClaw');
    expect(inspectGeneratedDraft(localContext, value, [review]).some(f => f.span === action && f.reason === 'unapproved_product_reference')).toBe(blocked);
    if (blocked) expect(() => materializeDraftBundle(localContext, value, mediaAllowlist[0], [review])).toThrow('Unsafe generated draft');
  });

  it('retains the article title for a pronoun-led description', () => {
    const value = structuredClone(generatedDraft);
    const localContext = structuredClone(context);
    localContext.candidate.title = 'VideoClaw for the Team';
    value.description = 'It guarantees perfect edits for the team, prepares the presentation, corrects every caption, and delivers a polished founder video without any additional review.';
    value.claimBindings = value.claimBindings.filter(b => b.location !== '/description');
    value.claimBindings.push({ location: '/description', span: value.description, sourceFactIds: ['yc-bullets'], productClaimId: null });
    const entry = productReferenceManifest(localContext, value).find(e => e.location === '/description')!;
    expect(entry.explicitProductContext).toBe(true);
    const review = { ...referentReview(value, value.description), bindingHash: entry.bindingHash, contextHash: entry.contextHash };
    expect(inspectGeneratedDraft(localContext, value, [review])).toContainEqual(expect.objectContaining({ location: '/description', reason: 'unapproved_product_reference' }));
    expect(() => materializeDraftBundle(localContext, value, mediaAllowlist[0], [review])).toThrow('Unsafe generated draft');
  });

  it.each(['rendered heading', 'earlier FAQ sentence'])('retains product context from %s after two ordinary spans', field => {
    const value = structuredClone(generatedDraft);
    const spans = [context.productClaims[0].text, 'The team reviews a webinar.', 'It guarantees perfect edits for the team.'];
    const location = field === 'rendered heading' ? '/sections/0/markdown' : '/faqAnswers/0/answer';
    if (field === 'rendered heading') {
      value.sections[0] = { heading: context.productClaims[0].text.replace('VideoClaw', '**Video**Claw'), markdown: `The team reviews a webinar. A speaker prepares the introduction. ${spans[2]}` };
      value.claimBindings = value.claimBindings.filter(b => !b.location.startsWith('/sections/0/'));
      value.claimBindings.push({ location: '/sections/0/heading', span: spans[0], sourceFactIds: ['vc-text-editing'], productClaimId: 'vc-editing-claim' });
      spans.splice(0, 2, 'The team reviews a webinar.', 'A speaker prepares the introduction.');
    } else {
      value.faqAnswers[0].answer = spans.join(' ');
      value.claimBindings = value.claimBindings.filter(b => b.location !== location);
    }
    value.claimBindings.push(...spans.map(span => ({ location, span,
      sourceFactIds: [span === context.productClaims[0].text ? 'vc-text-editing' : 'yc-bullets'],
      productClaimId: span === context.productClaims[0].text ? 'vc-editing-claim' : null })));
    const review = referentReview(value, spans[2]);
    expect(inspectGeneratedDraft(context, value, [review])).toContainEqual(expect.objectContaining({ location, span: spans[2], reason: 'unapproved_product_reference' }));
    expect(() => materializeDraftBundle(context, value, mediaAllowlist[0], [review])).toThrow('Unsafe generated draft');
  });

  it.each([
    'This guide keeps a focused scope: it connects investor presentation goals with practical video preparation.',
    'The viewer should understand what the company does, who the customer is, and why the product matters.',
    'Hypothetical example: an investor should understand the customer pain, the product response, and the next meeting we want.',
    'Ask whether each scene supports investor interest; if it does not, cut or defer it.',
    'That example is only a planning model, but it reflects the need to protect time for feedback.',
    'The brief can be one page if it answers practical questions.',
    'Recommendation: turn that prospect research into a short buyer brief rather than keeping it as scattered notes.',
    'Original editorial note: for a founder using a demo in customer acquisition, it can be useful to decide whether the next asset should educate, persuade or do both.',
    'Original recommendation: avoid relying on watch time alone, because it may not show whether the viewer understood the customer problem or the next step.',
    'Original recommendation: for a recorded acquisition demo, compress the agenda into three parts: state the customer problem, show the software path that addresses it and end with one concrete next action.',
    'Review that prospect research before turning it into notes.',
    'The buyer brief should be concise so it stays useful during preparation.',
    'Refine the script before turning it into shots.',
    'A sequence identifies the customer, shows the product response, and ends with a next step.',
    'The storyboard does not need to be artistic; it only needs to clarify what must be captured.',
    'Hypothetical storyboard row: the product screen illustrates a customer problem.',
    'Label that row as hypothetical if you use it, because it is an example structure.',
    'If practice partners are unavailable, record the presentation and watch it back with the same questions.',
    'Recommended scorecard: is the company clear, is the customer specific, and is the product value visible?',
    'Demo day is not only a moment on a calendar; it can be the start of investor conversations.',
    'Stop adding new content unless it fixes a clarity problem.',
    'YC also says it continues supporting startups during the fundraising process in the weeks after Demo Day.',
  ])('does not classify an explicit ordinary referent as VideoClaw: %s', (span) => {
    const sourceContext = structuredClone(context);
    sourceContext.sourceFacts[0].facts.push({
      id: 'yc-fundraising', evidenceKind: 'body',
      text: 'YC says it continues supporting startups during the fundraising process in the weeks after Demo Day.',
    });
    const value = withSpans([span]);
    if (span.startsWith('YC')) {
      value.claimBindings.find((binding) => binding.span === span)!.sourceFactIds = ['yc-fundraising'];
    }
    expect(inspectGeneratedDraft(sourceContext, value)).toEqual([]);
  });

  it.each([
    ['VideoClaw automatically adds captions.'],
    ['The app automatically adds captions.'],
    ['Hypothetical example: VideoClaw doubles conversion.'],
    [context.productClaims[0].text, 'It automatically adds captions.'],
    [context.productClaims[0].text, 'The script needs a review.', 'It automatically adds captions.'],
    [context.productClaims[0].text, 'Hypothetical example: the product automatically adds captions.'],
    ['The recording tool is ready; it automatically adds captions.'],
    ['The buyer brief tool is ready; it automatically adds captions.'],
    ['The prospect research platform is ready; it automatically adds captions.'],
    ['The watch time tool is ready; it automatically adds captions.'],
    ['It can be useful to automatically add captions.'],
    ['It can be useful to review footage and can automatically add captions.'],
    ['It can be useful to decide whether the next asset should educate, persuade or do both and can automatically add captions.'],
    ['It can be useful to decide whether the next asset should educate, persuade or do both; automatically generated captions are included.'],
    [context.productClaims[0].text, 'It can be useful to decide which scene to record.'],
    ['State the customer problem, show the software path that addresses it and automatically add captions.'],
    ['State the customer problem, show the software path that addresses it and end with one action; it automatically adds captions.'],
    [context.productClaims[0].text, 'After reviewing the buyer brief, it automatically adds captions.'],
    [context.productClaims[0].text, 'After reviewing the prospect research, it automatically adds captions.'],
    ['It automatically adds captions.'],
    ['The product automatically adds captions.'],
  ])('retains the product gate with complete, reordered bindings: %j', (...spans) => {
    expect(inspectGeneratedDraft(context, withSpans(spans))).toContainEqual(
      expect.objectContaining({ code: 'content.claim_binding' }),
    );
  });

  it.each([
    'Prepare supporting material only when it fits the buyer use case.',
    'Prepare an appendix if it answers buyer questions.',
    'Review collateral before it reaches the audience.',
    'Revise a handout when it lacks a clear next step.',
    'Check the agenda because it sets expectations.',
    'Use relevant evidence only if it supports the argument.',
  ])('resolves the direct object of an imperative as the local pronoun antecedent: %s', (span) => {
    expect(inspectGeneratedDraft(context, withSpans([span]))).toEqual([]);
  });

  const hypotheticalAntecedent = 'This example is hypothetical and is not a claim that any named product has these capabilities or outcomes.';
  const customerGoal = 'Your goal is to make one customer situation easy to understand, show the action that addresses it, and ask for a specific next step.';
  const clarificationAntecedent = 'That does not mean every founder must produce a polished advertisement.';
  const viewerClarification = 'It means the viewer should be able to connect the painful situation to the demonstrated response without needing a long feature lecture.';
  const practiceAsk = 'Third, practice the final ask until it sounds specific and natural.';
  const attributedAdvice = 'Descript says a software demo video should include a compelling story or use case, and it also advises concise, focused demos.';

  it.each([
    [customerGoal],
    ['The goal is to make a buyer problem easy to understand, show the action that addresses it, and ask for a clear next step.'],
    [clarificationAntecedent, viewerClarification],
    ['This does not mean each presenter should record a professional video.', 'It means the buyer should connect the customer problem to the proposed solution.'],
    [practiceAsk],
    ['Second, rehearse the closing request until it sounds clear and natural.'],
  ])('resolves closed human planning and propositional explanation grammar: %j', (...spans) => {
    expect(inspectGeneratedDraft(context, withSpans(spans))).toEqual([]);
  });

  const adviceContext: DraftingContext = { ...context, sourceFacts: [...context.sourceFacts, {
    id: 'descript', label: 'descript.com', url: 'https://www.descript.com/blog/article/software-demo-videos', checkedAt: context.generatedAt,
    facts: [{ id: 'demo-advice', text: 'A software demo video should include a compelling story or use case.' }],
  }] };
  function withAttributedAdvice(span: string) {
    const draft = withSpans([span]);
    draft.sourceReferences.push({ sourceId: 'descript' });
    draft.claimBindings.find(binding => binding.span === span)!.sourceFactIds = ['demo-advice'];
    return draft;
  }

  const worksheetAnchor = 'If the worksheet lists several customer segments, choose the one most likely to buy next.';
  const worksheetWorkflow = 'If it lists several workflows, choose the one that makes the clearest case for a follow up decision.';
  const worksheetObjection = 'If it lists several objections, rehearse the objection that could stop the deal rather than the easiest one to answer.';
  const openingRevision = 'If the opening feels weak, rewrite it around the buyer’s current obstacle instead of the founder’s category label.';
  const recordingAdvice = 'For software, Descript says one straightforward approach is to record the screen while walking through the product or feature, then add a voiceover that explains the steps shown.';

  it('resolves a bounded parallel worksheet chain in visible order, not binding order', () => {
    expect(inspectGeneratedDraft(context, withSpans([worksheetAnchor, worksheetWorkflow, worksheetObjection]))).toEqual([]);
  });

  it.each([
    'Remove company history unless it explains buyer risk.',
    'Remove company history if it lacks structure.',
    openingRevision,
    'If the introduction feels unclear, revise it around the customer’s current problem.',
  ])('resolves explicit human revision objects without inferring product capabilities: %s', span => {
    expect(inspectGeneratedDraft(context, withSpans([span]))).toEqual([]);
  });

  it('resolves the demonstrated product object in source-identified recording instructions', () => {
    expect(inspectGeneratedDraft(adviceContext, withAttributedAdvice(recordingAdvice))).toEqual([]);
  });

  it.each(['descript.attacker.example', 'descript.com.attacker.example', 'unrelated.example'])(
    'rejects publisher lookalikes rather than trusting the first hostname label: %s', hostname => {
      const spoofedContext = structuredClone(adviceContext);
      spoofedContext.sourceFacts.at(-1)!.url = `https://${hostname}/blog/article/software-demo-videos`;
      for (const span of [recordingAdvice, attributedAdvice]) {
        expect(inspectGeneratedDraft(spoofedContext, withAttributedAdvice(span))).toContainEqual(expect.objectContaining({
          code: 'content.claim_binding', span, reason: 'unapproved_product_reference',
        }));
      }
    },
  );

  it.each([
    [worksheetWorkflow],
    [worksheetObjection],
    ['The worksheet tool is ready.', worksheetWorkflow],
    [worksheetAnchor, 'The team reviewed the agenda.', worksheetWorkflow],
    [worksheetAnchor, worksheetWorkflow, 'It automatically adds captions.'],
    [worksheetAnchor, worksheetWorkflow.replace('choose the one', 'automatically caption the one')],
    [worksheetAnchor, worksheetWorkflow.replace('decision.', 'decision and it adds captions.')],
    [context.productClaims[0].text, worksheetAnchor, worksheetWorkflow],
    ['Remove company history unless it automatically adds captions.'],
    ['Remove company history unless it explains buyer risk and generates subtitles.'],
    ['Remove company history software unless it explains buyer risk.'],
    ['Remove Acme unless it explains buyer risk.'],
    [openingRevision.replace('the opening', 'the platform')],
    [openingRevision.replace('weak, rewrite', 'weak and automatically adds captions, rewrite')],
    [openingRevision.replace('label.', 'label and it automatically adds captions.')],
    [context.productClaims[0].text, openingRevision],
  ])('keeps ambiguous subjects and appended capabilities blocked in revision grammar: %j', (...spans) => {
    expect(inspectGeneratedDraft(context, withSpans(spans))).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', span: spans.at(-1), reason: 'unapproved_product_reference',
    }));
  });

  it.each([
    recordingAdvice.replace('Descript', 'VideoClaw'),
    recordingAdvice.replace('Descript', 'UnknownPublisher'),
    recordingAdvice.replace('walking through the product or feature', 'the product automatically captions the feature'),
    recordingAdvice.replace('steps shown.', 'steps shown and the product generates subtitles.'),
  ])('does not grant recording attribution exceptions to product assertions: %s', span => {
    expect(inspectGeneratedDraft(adviceContext, withAttributedAdvice(span))).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', span, reason: 'unapproved_product_reference',
    }));
  });

  it('resolves coordinated publisher advice only against the cited source identity', () => {
    expect(inspectGeneratedDraft(adviceContext, withAttributedAdvice(attributedAdvice))).toEqual([]);
  });

  it.each([
    [customerGoal.replace('ask for a specific next step', 'automatically add captions')],
    [customerGoal.replace('next step.', 'next step, and it automatically adds captions.')],
    [customerGoal.replace('customer situation', 'VideoClaw workflow')],
    [context.productClaims[0].text, customerGoal],
    [viewerClarification],
    ['The founder reviewed the recording.', viewerClarification],
    ['Descript does not mean every founder must produce a polished advertisement.', viewerClarification],
    [context.productClaims[0].text, clarificationAntecedent, viewerClarification],
    [clarificationAntecedent, viewerClarification.replace('the viewer', 'the product')],
    [clarificationAntecedent, viewerClarification.replace('lecture.', 'lecture, and it generates subtitles.')],
    [practiceAsk.replace('the final ask', 'Descript')],
    [practiceAsk.replace('the final ask', 'the recorder')],
    [practiceAsk.replace('sounds specific and natural', 'automatically adds captions')],
    [practiceAsk.replace('natural.', 'natural and automatically adds captions.')],
    [context.productClaims[0].text, practiceAsk],
  ])('does not grant planning exceptions to unknown subjects, capabilities or product context: %j', (...spans) => {
    expect(inspectGeneratedDraft(context, withSpans(spans))).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', span: spans.at(-1), reason: 'unapproved_product_reference',
    }));
  });

  it.each([
    attributedAdvice.replace('Descript', 'VideoClaw'),
    attributedAdvice.replace('Descript', 'UnknownPublisher'),
    attributedAdvice.replace('advises concise, focused demos', 'automatically adds captions'),
    attributedAdvice.replace('focused demos.', 'focused demos and automatically exports videos.'),
    attributedAdvice.replace('a compelling story or use case', 'a captioning tool that exports videos'),
  ])('keeps a cited publisher from shielding a product capability or unknown attribution: %s', span => {
    expect(inspectGeneratedDraft(adviceContext, withAttributedAdvice(span))).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', span, reason: 'unapproved_product_reference',
    }));
  });

  it('does not infer a publisher from uncited source inventory', () => {
    expect(inspectGeneratedDraft(adviceContext, withSpans([attributedAdvice]))).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', span: attributedAdvice, reason: 'unapproved_product_reference',
    }));
  });

  const checklistExplanation = 'It illustrates the checklist principle of matching the demo path to a buyer problem, a consistent story, a working demo setup, and a defined next step.';

  const decisionRouting = 'Use this decision filter: if a capability does not support the buyer problem, the value proposition, or the next step, move it to backup material.';
  const questionRouting = 'If the buyer asks about payment setup, the founder would either show a prepared answer if that topic is part of the decision or place it in the recap if the topic is secondary.';
  it.each([
    decisionRouting,
    'If a section does not support the buyer problem, move it to the appendix.',
    questionRouting,
    'If a customer asks about pricing, a presenter should either show a prepared answer if the topic is part of the decision or put it in the follow-up list if that topic is secondary.',
    'A useful demo checklist is not the longest one; it is the one that makes the next customer conversation clearer.',
    'The planning brief is concise; it focuses on the audience.',
    'After rehearsal, review the planning brief before sharing it.',
    'Before rehearsal, check the useful demo checklist and revise it.',
  ])('resolves editorial object routing and a qualified ordinary subject: %s', span => {
    expect(inspectGeneratedDraft(context, withSpans([span]))).toEqual([]);
  });

  it.each([
    [context.productClaims[0].text, decisionRouting],
    [context.productClaims[0].text, questionRouting],
    [decisionRouting.replace('a capability', 'VideoClaw')],
    [decisionRouting.replace('move it to backup material.', 'it automatically adds captions.')],
    [decisionRouting.replace('backup material.', 'backup material and it adds captions.')],
    [questionRouting.replace('would either show a prepared answer', 'automatically generates captions and would either show a prepared answer')],
    [questionRouting.replace('secondary.', 'secondary and it records the screen.')],
    [questionRouting.replace('payment setup', 'whether it automatically adds captions')],
    [questionRouting.replace('payment setup', 'its automatic captions')],
    [questionRouting.replace('payment setup', 'how they generate subtitles')],
    [questionRouting.replace('payment setup', 'a useful demo checklist it generates')],
    ['A useful demo checklist tool is ready; it adds captions.'],
    ['The planning brief platform is ready; it adds captions.'],
    ['After reviewing a useful demo checklist, it automatically adds captions.'],
    ['After reviewing a useful demo checklist, now it automatically adds captions.'],
    ['Before reviewing the planning brief, it records the screen.'],
    ['After reviewing a useful demo checklist it automatically adds captions.'],
    ['Using a useful demo checklist, it automatically exports videos.'],
    [questionRouting, 'It automatically adds captions.'],
  ])('does not let editorial routing admit software subjects or extra capabilities: %j', (...spans) => {
    expect(inspectGeneratedDraft(context, withSpans(spans))).toContainEqual(expect.objectContaining({
      span: spans.at(-1), reason: 'unapproved_product_reference',
    }));
  });

  it.each([
    [hypotheticalAntecedent, checklistExplanation],
    ['An example is illustrative.', 'It explains the planning approach.'],
    ['That example is a planning exercise.', 'It summarizes the review sequence.'],
    ['The worksheet is a review aid.', 'It outlines the demo structure.'],
    ['This worksheet lists the review steps.', 'It illustrates the planning principle of linking the demo path with a buyer problem and a clear next step.'],
    ['The example was hypothetical and was not an assertion that a named product provides those features or outcomes.', 'It explains the checklist purpose.'],
  ])('resolves an immediately preceding ordinary explanation subject: %j', (...spans) => {
    // withSpans reverses bindings: visible sentence order must determine reference.
    expect(inspectGeneratedDraft(context, withSpans(spans))).toEqual([]);
  });

  it.each([
    [checklistExplanation],
    ['This is hypothetical.', checklistExplanation],
    ['The example and the worksheet are ready.', checklistExplanation],
    ['The founder reviewed an example.', checklistExplanation],
    ['After reviewing the example, the presenter opened the editor.', checklistExplanation],
    ['This example is hypothetical.', 'Prepare the meeting agenda.', checklistExplanation],
    ['VideoClaw is a planning aid.', checklistExplanation],
    ['Descript is a planning aid.', checklistExplanation],
    ['The app is a planning aid.', checklistExplanation],
    ['The product is a planning aid.', checklistExplanation],
    ['This example software is a planning aid.', checklistExplanation],
    ['The worksheet tool is a review aid.', checklistExplanation],
    ['This example is a Descript worksheet.', checklistExplanation],
    ['This example is hypothetical and the app adds captions.', checklistExplanation],
    ['This example is hypothetical and is a claim that any named product has these capabilities or outcomes.', checklistExplanation],
    [context.productClaims[0].text, hypotheticalAntecedent, checklistExplanation],
    [hypotheticalAntecedent, 'It adds captions.'],
    [hypotheticalAntecedent, 'It can generate subtitles.'],
    [hypotheticalAntecedent, 'It supports automatic captions.'],
    [hypotheticalAntecedent, 'It illustrates the checklist principle and automatically adds captions.'],
    [hypotheticalAntecedent, 'It illustrates the checklist principle; it exports videos.'],
    [hypotheticalAntecedent, 'It explains how the software adds captions.'],
    [hypotheticalAntecedent, 'It illustrates the checklist principle and VideoClaw adds captions.'],
    [hypotheticalAntecedent, 'It explains the principle that generates captions.'],
    [hypotheticalAntecedent, 'It illustrates the checklist principle of matching the demo path to a buyer problem and generates subtitles.'],
  ])('keeps cross-sentence product, vague, and added capability references blocked: %j', (...spans) => {
    const span = spans.at(-1)!;
    const value = withSpans(spans);
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', location: '/sections/0/markdown', span,
      bindingIndex: value.claimBindings.findIndex(binding => binding.span === span),
      reason: 'unapproved_product_reference',
    }));
  });

  it('does not carry an ordinary explanation antecedent across section boundaries', () => {
    const value = withSpans([hypotheticalAntecedent]);
    value.sections[1] = { ...value.sections[1], markdown: checklistExplanation };
    value.claimBindings = value.claimBindings.filter(binding => binding.location !== '/sections/1/markdown');
    value.claimBindings.push({ location: '/sections/1/markdown', span: checklistExplanation, sourceFactIds: ['yc-bullets'], productClaimId: null });
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({
      location: '/sections/1/markdown', span: checklistExplanation, reason: 'unapproved_product_reference',
    }));
  });

  it.each([
    ['VideoClaw prepares supporting material only when it fits the buyer use case.'],
    ['Descript prepares supporting material only when it fits the buyer use case.'],
    ['Loom prepares an appendix when it automatically adds captions.'],
    ['Prepare Descript only when it fits the buyer use case.'],
    ['Prepare a Loom recording when it automatically adds captions.'],
    ['Prepare supporting material software only when it fits the buyer use case.'],
    ['Prepare a supporting material tool when it automatically adds captions.'],
    ['Prepare supporting material for the product when it automatically adds captions.'],
    ['Prepare supporting material with Descript when it automatically adds captions.'],
    ['Prepare supporting material with descript when it automatically adds captions.'],
    ['Prepare supporting material, then it automatically adds captions.'],
    ['Prepare supporting material only when it fits the buyer use case; it automatically adds captions.'],
    ['Prepare supporting material only when it fits the buyer use case and VideoClaw automatically adds captions.'],
    [context.productClaims[0].text, 'Prepare supporting material only when it fits the buyer use case.'],
    [context.productClaims[0].text, 'After preparing supporting material, it automatically adds captions.'],
    ['Prepare supporting material only when it fits the buyer use case.', 'It automatically adds captions.'],
  ])('keeps product subjects and ambiguous imperative objects blocked: %j', (...spans) => {
    const span = spans.at(-1)!;
    const value = withSpans(spans);
    const bindingIndex = value.claimBindings.findIndex((binding) => binding.span === span);
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', bindingIndex, location: '/sections/0/markdown',
      span, reason: 'unapproved_product_reference',
    }));
  });

  it.each([
    'Use descript because it automatically adds captions.',
    'Use the recorder because it automatically adds captions.',
    'Use the recorder because it adds captions.',
    'Use the recorder because it can add captions.',
    'Use the recorder because it supports automatic captions.',
    'Use the recorder only if it automatically adds captions.',
    'Use descript when it exports videos.',
    'Use descript because it answers buyer questions.',
    'Use the recorder when it reaches the audience.',
    'Use the recorder only if it answers buyer questions.',
    'Use descript only if it supports the argument.',
    'Prepare the recorder because it automatically adds captions.',
    'Review descript because it automatically adds captions.',
    'Revise the recorder when it generates subtitles.',
    'Check the recorder because it adds captions.',
    'Check descript because it answers buyer questions.',
    'Review descript because it answers buyer questions.',
    'Prepare the recorder when it answers buyer questions.',
    'Use relevant evidence only if it supports the argument and automatically adds captions.',
    'Prepare supporting material only when it fits the buyer use case and automatically adds captions.',
  ])('does not exempt an imperative with an unresolved capability subject: %s', (span) => {
    const value = withSpans([span]);
    const bindingIndex = value.claimBindings.findIndex((binding) => binding.span === span);
    expect(value.claimBindings[bindingIndex].productClaimId).toBeNull();
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', bindingIndex, location: '/sections/0/markdown',
      span, reason: 'unapproved_product_reference',
    }));
  });

  it('reports every broken binding and uncovered span instead of stopping at the first one', () => {
    const missing = generatedDraft.claimBindings.find(({ location }) => location === '/description')!;
    const bindings = generatedDraft.claimBindings.filter((binding) => binding !== missing).map((binding, index) => (
      index < 2 ? { ...binding, sourceFactIds: ['missing-fact'] } : binding
    ));
    const findings = inspectGeneratedDraft(context, withDraft({ claimBindings: bindings }));
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'content.claim_binding', bindingIndex: 0, location: bindings[0].location, span: bindings[0].span, reason: 'unknown_fact' }),
      expect.objectContaining({ code: 'content.claim_binding', bindingIndex: 1, location: bindings[1].location, span: bindings[1].span, reason: 'unknown_fact' }),
      expect.objectContaining({ code: 'content.claim_binding', location: '/description', span: missing.span, reason: 'missing_binding' }),
    ]));
  });

  it('does not let one binding cover repeated identical sentences at the same location', () => {
    const span = 'Review the recording.';
    const value = withSpans([span, span]);
    value.claimBindings.splice(value.claimBindings.findIndex((binding) => binding.span === span), 1);
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', location: '/sections/0/markdown', span,
    }));
  });

  it.each([
    'Review the recording tool because it automatically adds captions.',
    'Review a short video editor because it automatically adds captions.',
    'The company likes the product because it automatically adds captions.',
    'YC also says it continues supporting startups.',
  ])('does not infer an ordinary referent or third-party subject without the required context: %s', (span) => {
    expect(inspectGeneratedDraft(context, withSpans([span]))).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', span, reason: 'unapproved_product_reference',
    }));
  });

  it('resolves a new explicit ordinary subject without clearing ambiguous product context', () => {
    const ordinary = 'The storyboard does not need to be artistic; it only needs to clarify what must be captured.';
    expect(inspectGeneratedDraft(context, withSpans([context.productClaims[0].text, ordinary]))).toEqual([]);
    const ambiguous = 'It automatically adds captions.';
    expect(inspectGeneratedDraft(context, withSpans([context.productClaims[0].text, ordinary, ambiguous])))
      .toContainEqual(expect.objectContaining({ span: ambiguous, reason: 'unapproved_product_reference' }));
  });

  it.each([
    'After reviewing the recording, it automatically adds captions.',
    'Before exporting the video, it automatically adds captions.',
    'While checking the script, it automatically adds captions.',
    'For the recording, it automatically adds captions.',
    'After reviewing the recording it automatically adds captions.',
    'The recording review is complete; it automatically adds captions.',
  ])('does not let an introductory object override the prior product subject: %s', (span) => {
    const value = withSpans([context.productClaims[0].text, span]);
    const bindingIndex = value.claimBindings.findIndex((binding) => binding.span === span);
    expect(value.claimBindings[bindingIndex].productClaimId).toBeNull();
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', bindingIndex, location: '/sections/0/markdown',
      span, reason: 'unapproved_product_reference',
    }));
  });

  it.each([
    'A software demo video is useful when the viewer needs to see the product in action, while an explainer video is better suited to introducing the problem and solution context.',
    'A demo video shows the product in action.',
  ])('treats the demonstrated product as an object in a generic video category definition: %s', (span) => {
    expect(inspectGeneratedDraft(context, withSpans([span]))).toEqual([]);
  });

  it.each([
    ['A software demo video shows VideoClaw automatically adding captions.'],
    ['A software demo video shows the app automatically adding captions.'],
    ['A software demo video shows the product in action and the product automatically adds captions.'],
    ['A software demo video shows the product in action while it automatically adds captions.'],
    [context.productClaims[0].text, 'A software demo video shows the product in action.'],
  ])('does not use a generic video category to exempt product capabilities: %j', (...spans) => {
    expect(inspectGeneratedDraft(context, withSpans(spans))).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', reason: 'unapproved_product_reference',
    }));
  });
});

describe('literal claim coverage outside Markdown-rendered fields', () => {
  it.each(['Video**Claw** automatically adds captions', 'Video\x60Claw\x60 automatically adds captions'])('blocks a product name visually assembled by heading Markdown: %s', (heading) => {
    const value = structuredClone(generatedDraft);
    value.sections[0].heading = heading;
    value.claimBindings = value.claimBindings.filter(b => b.location !== '/sections/0/heading');
    value.claimBindings.push({ location: '/sections/0/heading', span: heading, sourceFactIds: ['yc-bullets'], productClaimId: null });
    expect(inspectGeneratedDraft(context, value)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'content.claim_binding', location: '/sections/0/heading' }),
    ]));
    expect(() => materializeDraftBundle(context, value, mediaAllowlist[0])).toThrow();
  });

  it('matches a legitimate heading binding to rendered Markdown text', () => {
    const value = structuredClone(generatedDraft);
    const original = value.sections[0].heading;
    value.sections[0].heading = `**${original}**`;
    expect(inspectGeneratedDraft(context, value)).toEqual([]);
    expect(materializeDraftBundle(context, value, mediaAllowlist[0]).markdown).toContain(`## **${original}**`);
  });

  const fields: Array<{ location: string; set: (draft: GeneratedDraftV2, text: string) => void }> = [
    { location: '/faqAnswers/0/answer', set: (draft, text) => { draft.faqAnswers[0].answer = text; } },
    { location: '/description', set: (draft, text) => { draft.description = text; } },
    { location: '/competitorGap', set: (draft, text) => { draft.competitorGap = text; } },
    { location: '/editorialGraphic/title', set: (draft, text) => { draft.editorialGraphic.title = text; } },
    { location: '/editorialGraphic/alt', set: (draft, text) => { draft.editorialGraphic.alt = text; } },
    { location: '/editorialGraphic/steps/0/label', set: (draft, text) => { draft.editorialGraphic.steps[0].label = text; } },
    { location: '/editorialGraphic/steps/0/detail', set: (draft, text) => { draft.editorialGraphic.steps[0].detail = text; } },
  ];
  const formats = [
    { format: 'fenced code', text: '```\nA brief.\n```', span: 'A brief.' },
    { format: 'indented code', text: '    A brief.', span: 'A brief.' },
    { format: 'definition', text: '[x]: / "A brief"', span: '[x]: / "A brief"' },
    { format: 'inline code', text: '`A brief.`', span: '`A brief.`' },
    { format: 'HTML', text: '<b>A brief.</b>', span: '<b>A brief.</b>' },
  ];

  it.each(fields.flatMap(field => formats.map(format => ({ ...field, ...format }))))(
    'requires the literal $format span at $location even when Markdown would hide or transform it',
    ({ location, set, text, span }) => {
      const value = withDraft({});
      set(value, text);
      value.claimBindings = value.claimBindings.filter(binding => binding.location !== location);
      expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({
        code: 'content.claim_binding', location, span, reason: 'missing_binding',
      }));
    },
  );

  it.each(fields)('accepts exact literal bindings at $location without stripping inline markers', ({ location, set }) => {
    const span = '`A brief.`';
    const value = withDraft({});
    set(value, span);
    value.claimBindings = value.claimBindings.filter(binding => binding.location !== location);
    value.claimBindings.push({ location, span, sourceFactIds: ['yc-bullets'], productClaimId: null });
    expect(inspectGeneratedDraft(context, value).filter(finding => finding.code === 'content.claim_binding')).toEqual([]);
  });

  it.each(['/directAnswer', '/sections/0/markdown'])(
    'keeps rendered Markdown sentence binding at %s', (location) => {
      const value = withDraft({});
      const markdown = 'Choose a **brief** and review `the agenda`.';
      if (location === '/directAnswer') value.directAnswer = markdown;
      else value.sections[0].markdown = markdown;
      value.claimBindings = value.claimBindings.filter(binding => binding.location !== location);
      value.claimBindings.push({
        location, span: 'Choose a brief and review the agenda.', sourceFactIds: ['yc-bullets'], productClaimId: null,
      });
      expect(inspectGeneratedDraft(context, value).filter(finding => finding.code === 'content.claim_binding')).toEqual([]);
    },
  );
});

describe('sentence boundaries in exact claim bindings', () => {
  it.each([
    'The guide is ready.It automatically adds captions.',
    'The guide is ready.Once it automatically adds captions, export the video.',
    'The guide is ready.IT automatically adds captions.',
    'The guide shows it clearly.It automatically adds captions.',
    'The guide shows it clearly and it automatically adds captions.',
  ])('does not let a merged dotted span inherit an ordinary antecedent: %s', (span) => {
    const value = boundSentences('/sections/0/markdown', span, [span]);
    expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({
      code: 'content.claim_binding', reason: 'unapproved_product_reference',
    }));
  });
  function boundSentences(location: string, text: string, spans: string[]) {
    const value = withDraft({});
    if (location === '/competitorGap') value.competitorGap = text;
    else value.sections[0].markdown = text;
    value.claimBindings = value.claimBindings.filter(binding => binding.location !== location);
    value.claimBindings.push(...spans.map(span => ({ location, span, sourceFactIds: ['yc-bullets'], productClaimId: null })));
    return value;
  }

  for (const location of ['/sections/0/markdown', '/competitorGap']) {
    it.each(['Rivia.AI', 'Acme.Tools', 'alpha.AI', 'Studio.X', 'version 2.5', 'version 2.5.0'])(
      `keeps a dotted token inside its complete sentence at ${location}: %s`, (name) => {
        const spans = [`Review ${name} before recording.`, 'Check the agenda.'];
        expect(inspectGeneratedDraft(context, boundSentences(location, spans.join(' '), spans))
          .filter(finding => finding.code === 'content.claim_binding')).toEqual([]);
      });

    it.each([
      ['Hypothetical example: “The owner checks renewal risk.”', 'The sentence is invented for illustration.'],
      ['Hypothetical example: "The owner checks renewal risk."', 'The sentence is invented for illustration.'],
      ["Hypothetical example: ‘The owner checks renewal risk.’", 'The sentence is invented for illustration.'],
      ["Hypothetical example: 'The owner checks renewal risk.'", 'The sentence is invented for illustration.'],
      ['Ask: “Is the agenda clear?”', 'Review the brief.'],
      ['Instruction: “Review the brief!”', 'Check the agenda.'],
      ['Example (“The owner checks renewal risk.”)', 'The sentence is invented for illustration.'],
    ])(`retains closing punctuation while separating bound sentences at ${location}: %s`, (...spans) => {
      expect(inspectGeneratedDraft(context, boundSentences(location, spans.join(' '), spans))
        .filter(finding => finding.code === 'content.claim_binding')).toEqual([]);
    });

    it.each([' ', ''])(`does not let a bound sentence conceal an adjacent unbound claim at ${location} with separator %j`, (separator) => {
      for (const first of ['Review the brief.', 'Review Rivia.AI guidance.', 'Example: “Review the brief.”']) {
        const value = boundSentences(location, `${first}${separator}Revenue doubles.`, [first]);
        expect(inspectGeneratedDraft(context, value)).toContainEqual(expect.objectContaining({ code: 'content.claim_binding', location, reason: 'missing_binding' }));
      }
    });

    it(`cannot use a single binding to merge separate quoted claims at ${location}`, () => {
      const text = 'Example: “Review the brief.” Revenue doubles.';
      expect(inspectGeneratedDraft(context, boundSentences(location, text, [text]))).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'content.claim_binding', location, reason: 'span_mismatch' }),
        expect.objectContaining({ code: 'content.claim_binding', location, span: 'Revenue doubles.', reason: 'missing_binding' }),
      ]));
    });
  }

  it('keeps Markdown rendering separate from literal text around dotted names', () => {
    const text = 'Review **Rivia.AI** guidance.';
    expect(inspectGeneratedDraft(context, boundSentences('/sections/0/markdown', text, ['Review Rivia.AI guidance.']))
      .filter(finding => finding.code === 'content.claim_binding')).toEqual([]);
    expect(inspectGeneratedDraft(context, boundSentences('/competitorGap', text, [text]))
      .filter(finding => finding.code === 'content.claim_binding')).toEqual([]);
    expect(inspectGeneratedDraft(context, boundSentences('/competitorGap', text, ['Review Rivia.AI guidance.'])))
      .toContainEqual(expect.objectContaining({ code: 'content.claim_binding', reason: 'span_mismatch' }));
  });

  it('preserves the product gate after a quoted sentence boundary', () => {
    const spans = ['Example: “Review the brief.”', 'VideoClaw automatically adds captions.'];
    expect(inspectGeneratedDraft(context, boundSentences('/sections/0/markdown', spans.join(' '), spans)))
      .toContainEqual(expect.objectContaining({ code: 'content.claim_binding', span: spans[1], reason: 'unapproved_product_reference' }));
  });
});

describe('final serialized artifact inspection', () => {
  describe('native frontmatter source inventory', () => {
    const expectedSources = [
      { label: 'YC guide', url: 'https://www.ycombinator.com/video/', checkedAt: '2026-09-04' },
      { label: 'FTC guide', url: 'https://www.ftc.gov/guidance', checkedAt: '2026-09-04' },
    ];
    const legacyBodySources = '\n\n## Sources\n\n- [YC guide](https://www.ycombinator.com/video/)\n- [FTC guide](https://www.ftc.gov/guidance)';
    const serialize = (sources: unknown, suffix = '') => (
      `---\n${JSON.stringify({ sources })}\n---\n\n${generatedDraft.directAnswer}${suffix}\n`
    );

    it('accepts the exact selected inventory without requiring a body Sources list', () => {
      expect(inspectFinalMarkdown(serialize(expectedSources), expectedSources)).toEqual([]);
    });

    it.each([
      ['missing inventory', undefined],
      ['null inventory', null],
      ['non-array inventory', expectedSources[0]],
      ['empty inventory', []],
      ['missing selected source', expectedSources.slice(0, 1)],
      ['extra source', [...expectedSources, { label: 'Extra', url: 'https://example.com/', checkedAt: '2026-09-04' }]],
      ['reordered sources', [...expectedSources].reverse()],
      ['duplicate source', [expectedSources[0], expectedSources[0]]],
      ['changed label', [{ ...expectedSources[0], label: 'Different label' }, expectedSources[1]]],
      ['non-string label', [{ ...expectedSources[0], label: 42 }, expectedSources[1]]],
      ['changed destination', [{ ...expectedSources[0], url: 'https://attacker.example/' }, expectedSources[1]]],
      ['added URL fragment', [{ ...expectedSources[0], url: `${expectedSources[0].url}#changed` }, expectedSources[1]]],
      ['unsafe destination', [{ ...expectedSources[0], url: 'javascript:alert(1)' }, expectedSources[1]]],
      ['credentialed destination', [{ ...expectedSources[0], url: 'https://user:pass@www.ycombinator.com/video/' }, expectedSources[1]]],
      ['changed checked date', [{ ...expectedSources[0], checkedAt: '2026-09-05' }, expectedSources[1]]],
      ['missing checked date', [{ label: expectedSources[0].label, url: expectedSources[0].url }, expectedSources[1]]],
      ['extra source field', [{ ...expectedSources[0], injected: 'extra prose' }, expectedSources[1]]],
    ])('rejects %s even when the legacy body list matches the inventory', (_label, sources) => {
      // An otherwise correct legacy body list must not stand in for frontmatter validation.
      for (const suffix of [legacyBodySources, '']) {
        expect(inspectFinalMarkdown(serialize(sources, suffix), expectedSources)).toContainEqual(
          expect.objectContaining({ code: 'content.sources_structure' }),
        );
      }
    });

    it.each([
      ['one source', expectedSources.slice(0, 1)],
      ['normalized duplicate URLs', [expectedSources[0], { ...expectedSources[1], url: `${expectedSources[0].url}#duplicate` }]],
      ['unsafe URLs', [{ ...expectedSources[0], url: 'javascript:alert(1)' }, expectedSources[1]]],
      ['impossible checked dates', [{ ...expectedSources[0], checkedAt: '2026-02-30' }, expectedSources[1]]],
    ])('rejects an unsafe expected inventory with %s even when frontmatter matches', (_label, sources) => {
      expect(inspectFinalMarkdown(serialize(sources), sources)).toContainEqual(
        expect.objectContaining({ code: 'content.sources_structure' }),
      );
    });
  });

  it.each([
    ['a Setext H1', 'Use this title\n===', ['Use this title'], /body_h1/],
    ['a closed code fence', 'Use this example.\n\n```text\nsafe\n```', ['Use this example.'], /code_fence/],
    ['a reference link', 'Use [the guide][yc].\n\n[yc]: https://www.ycombinator.com/video/', ['Use the guide.'], /reference_link/],
    ['an autolink', 'Use <https://www.ycombinator.com/video/>.', ['Use https://www.ycombinator.com/video/.'], /autolink/],
    ['a mailto destination', 'Use [email](mailto:editor@example.com).', ['Use email.'], /link_destination/],
    ['a javascript destination', 'Use [this](javascript:alert(1)).', ['Use this.'], /link_destination/],
    ['an unsafe image destination', 'Use this image.\n\n![Use proof](javascript:alert(1))', ['Use this image.', 'Use proof'], /link_destination/],
    ['a generated Sources section', '## Sources\n\nUse the guide.', ['Sources', 'Use the guide.'], /body_sources/],
    ['a formatted nested sources heading', '> ### **sources**:\n>\n> Use the guide.', ['sources:', 'Use the guide.'], /body_sources/],
    ['a Setext sources heading', 'Sources\n---\n\nUse the guide.', ['Sources', 'Use the guide.'], /body_sources/],
    ['a generated FAQs section', '## FAQs\n\nUse the guide.', ['FAQs', 'Use the guide.'], /body_faqs/],
    ['a generated FAQ section', '### FAQ\n\nUse the guide.', ['FAQ', 'Use the guide.'], /body_faqs/],
    ['a formatted nested FAQ heading', '> ### **Frequently asked questions**:\n>\n> Use the guide.', ['Frequently asked questions:', 'Use the guide.'], /body_faqs/],
    ['a Setext FAQ heading', 'Frequently Asked Questions\n---\n\nUse the guide.', ['Frequently Asked Questions', 'Use the guide.'], /body_faqs/],
  ])('rejects final Markdown containing %s', (_label, markdown, spans, expected) => {
    const fixtureFacts = spans.map((span, index) => ({ id: `final-ast-${index}`, text: span }));
    const supportedContext = {
      ...context,
      sourceFacts: context.sourceFacts.map((source, index) => index === 0
        ? { ...source, facts: [...source.facts, ...fixtureFacts, { id: 'final-ast-heading', text: 'Unsafe' }] }
        : source),
    };
    const unsafeDraft = withDraft({
      sections: [{ heading: 'Unsafe', markdown }, generatedDraft.sections[1]],
      claimBindings: [
        ...generatedDraft.claimBindings.filter(({ location }) => (
          location !== '/sections/0/heading' && location !== '/sections/0/markdown'
        )),
        ...spans.map((span, index) => ({
          location: '/sections/0/markdown',
          span,
          sourceFactIds: [`final-ast-${index}`],
          productClaimId: null,
        })),
        {
          location: '/sections/0/heading',
          span: 'Unsafe',
          sourceFactIds: ['final-ast-heading'],
          productClaimId: null,
        },
      ],
    });

    expect(() => materializeDraftBundle(supportedContext, unsafeDraft, mediaAllowlist[0])).toThrow(expected);
    expect(() => materializeDraftBundle(supportedContext, unsafeDraft, mediaAllowlist[0])).toThrow(DraftMaterializationError);
  });

  it('requires the final direct answer to be a real paragraph', () => {
    const quotedAnswer = `> ${generatedDraft.directAnswer}`;
    const unsafeDraft = withDraft({
      directAnswer: quotedAnswer,
    });

    expect(() => materializeDraftBundle(context, unsafeDraft, mediaAllowlist[0])).toThrow(/direct_answer_paragraph/);
  });

  it('keeps a source label literal in frontmatter so it cannot inject a body link destination', () => {
    const injectedContext = {
      ...context,
      sourceFacts: context.sourceFacts.map((source, index) => index === 0
        ? { ...source, label: 'Trusted source](javascript:alert(1))' }
        : source),
    };

    const bundle = materializeDraftBundle(injectedContext, generatedDraft, mediaAllowlist[0]);
    const { data, content: body } = matter(bundle.markdown);

    expect(data.sources[0]).toEqual({
      label: 'Trusted source](javascript:alert(1))',
      url: 'https://www.ycombinator.com/video/',
      checkedAt: '2026-09-04',
    });
    expect(body).not.toContain('Trusted source');
    expect(body).not.toMatch(/\]\(javascript:/);
  });

  it.each(['   ', 'Trusted source\nInjected prose', 'Trusted\u0007source'])('rejects an invalid source label before serialization', (label) => {
    const invalidContext = {
      ...context,
      sourceFacts: context.sourceFacts.map((source, index) => index === 0 ? { ...source, label } : source),
    };

    expect(() => materializeDraftBundle(invalidContext, generatedDraft, mediaAllowlist[0])).toThrow(/source fact input/i);
  });

  it('leaves Sources and FAQs rendering to native frontmatter with the complete literal source inventory', () => {
    const injectedLabel = 'Trusted *source* [attempt](https://attacker.example/path)';
    const injectedContext = {
      ...context,
      sourceFacts: context.sourceFacts.map((source, index) => index === 0
        ? { ...source, label: injectedLabel }
        : source),
    };

    const bundle = materializeDraftBundle(injectedContext, generatedDraft, mediaAllowlist[0]);
    const { data, content: body } = matter(bundle.markdown);
    const tree = unified().use(remarkParse).parse(body) as TestMarkdownNode & { children: TestMarkdownNode[] };
    const reservedHeadings = tree.children.filter((node) => (
      node.type === 'heading'
      && /^(?:Sources|FAQs|Frequently asked questions)$/i.test(node.children?.[0]?.value ?? '')
    ));

    expect(reservedHeadings).toEqual([]);
    expect(data.sources).toEqual([
      {
        label: injectedLabel,
        url: 'https://www.ycombinator.com/video/',
        checkedAt: '2026-09-04',
      },
      {
        label: 'Federal Trade Commission: Advertising FAQs',
        url: 'https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business',
        checkedAt: '2026-09-04',
      },
      {
        label: 'VideoClaw product features',
        url: 'https://videoclaw.com/features',
        checkedAt: '2026-09-04',
      },
    ]);
    expect(data.sources).toEqual(bundle.article.sources);
    expect(data.faqs).toEqual(generatedDraft.faqAnswers);
    expect(body).not.toContain(injectedLabel);
    expect(body).not.toContain('https://attacker.example/path');
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
    { heading: 'Review the recording', spans: ['Review it before sharing.'] },
    { heading: 'Review workflow', spans: ['Record a short video.', 'Review it before sharing.'] },
    { heading: 'Review workflow', spans: ['Write a short script.', 'Read it before recording.'] },
  ])('accepts an ordinary object pronoun with explicit local context: %j', ({ heading, spans }) => {
    const contextualDraft = withDraft({
      sections: [{ heading, markdown: spans.join(' ') }, generatedDraft.sections[1]],
      claimBindings: [
        ...generatedDraft.claimBindings.filter(({ location }) => !location.startsWith('/sections/0/')),
        { location: '/sections/0/heading', span: heading, sourceFactIds: ['yc-bullets'], productClaimId: null },
        ...spans.map((span) => ({ location: '/sections/0/markdown', span, sourceFactIds: ['yc-bullets'], productClaimId: null })),
      ].reverse(),
    });

    // The existing product aliases include "it"; binding order is not discourse order.
    expect(inspectGeneratedDraft(context, contextualDraft)).toEqual([]);
  });

  it.each([
    { heading: 'Review workflow', spans: ['Review it before sharing.'] },
    { heading: 'Review the recording', spans: ['It supports automatic captions.'] },
    { heading: 'Review the recording', spans: ['Review it because it cuts editing time in half.'] },
    { heading: 'Review workflow', spans: ['VideoClaw lets creators edit a recorded video with text.', 'Review it before sharing.'] },
  ])('keeps ambiguous and product pronouns fail-closed with complete bindings: %j', ({ heading, spans }) => {
    const contextualDraft = withDraft({
      sections: [{ heading, markdown: spans.join(' ') }, generatedDraft.sections[1]],
      claimBindings: [
        ...generatedDraft.claimBindings.filter(({ location }) => !location.startsWith('/sections/0/')),
        { location: '/sections/0/heading', span: heading, sourceFactIds: ['yc-bullets'], productClaimId: null },
        ...spans.map((span) => ({
          location: '/sections/0/markdown', span,
          sourceFactIds: [span.startsWith('VideoClaw') ? 'vc-text-editing' : 'yc-bullets'],
          productClaimId: span.startsWith('VideoClaw') ? 'vc-editing-claim' : null,
        })),
      ].reverse(),
    });

    expect(inspectGeneratedDraft(context, contextualDraft)).toContainEqual(expect.objectContaining({
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
