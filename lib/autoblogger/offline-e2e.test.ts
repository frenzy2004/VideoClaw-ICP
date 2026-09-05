import { describe, expect, it } from 'vitest';

import type { DraftingContext, GeneratedDraftV2 } from './content-bundle';
import { CandidateSchema, EvidenceBundleSchema, KeywordMetricsSchema, candidateFingerprints, type Candidate } from './domain';
import { createStructuredDrafter } from './drafting';
import { createPersistentWorkerState, type PersistentWorkerState } from './github-runtime';
import type { StructuredOutputClient, StructuredOutputRequest } from './openai-responses';
import type { ShallowResearchResult } from './research';
import { createAutobloggerWorker } from './worker';

const directAnswer = 'Choose one audience, define one next step, record short founder-led takes, and show one current product action with evidence the viewer can verify. Review every factual statement against its cited source, add accurate captions, check pacing and sound, then test the complete playback path before sharing the final video.';

function candidates(): Candidate[] {
  return Array.from({ length: 50 }, (_unused, index) => {
    const campaignNumber = index % 3 + 1;
    const campaignId = ['newly-funded-founder', 'accelerator-demo-day-founder', 'video-production-comparison'][campaignNumber - 1];
    return CandidateSchema.parse({
      schemaVersion: 1,
      articleId: `vc-c${campaignNumber}-${index + 100}`,
      campaignId,
      icp: campaignId,
      primaryKeyword: `founder video workflow ${index}`,
      secondaryKeywords: [],
      title: `Founder Video Workflow ${index}`,
      slug: `founder-video-workflow-${index}`,
      intent: 'informational',
      funnelStage: index % 2 ? 'middle' : 'top',
    });
  });
}

function shallow(candidate: Candidate): ShallowResearchResult {
  return {
    candidate,
    suggestions: [`${candidate.primaryKeyword} checklist`],
    organicResults: [
      { url: `https://primary.example/${candidate.slug}`, title: 'Primary checked guidance', snippet: 'Use checked evidence before recording.', resultType: 'article' },
      { url: `https://secondary.example/${candidate.slug}`, title: 'Independent checked guidance', snippet: 'Test the complete playback path before sharing.', resultType: 'article' },
    ],
    peopleAlsoAsk: [
      `What is ${candidate.primaryKeyword}?`,
      `How do you plan ${candidate.primaryKeyword}?`,
      `Why does ${candidate.primaryKeyword} matter?`,
    ],
    relatedQueries: [`${candidate.primaryKeyword} template`],
    provenance: {
      discovery: { actorId: 'autocomplete', runId: 'autocomplete-fixture', datasetId: 'autocomplete-data', observedAt: '2026-09-05T00:00:00.000Z' },
      serp: { actorId: 'serp', runId: 'serp-fixture', datasetId: 'serp-data', observedAt: '2026-09-05T00:01:00.000Z' },
    },
  };
}

const visibleSpans = {
  initialDescription: 'This checked founder video workflow connects audience, evidence, recording, review, and playback.',
  repairedDescription: 'This source-backed founder video workflow connects audience, evidence, recording, review, and playback.',
  customerTrigger: 'Use this workflow when a founder video needs checked evidence.',
  competitorGap: 'Address the gap between recording advice and evidence review.',
  answerOne: 'Choose one audience, define one next step, record short founder-led takes, and show one current product action with evidence the viewer can verify.',
  answerTwo: 'Review every factual statement against its cited source, add accurate captions, check pacing and sound, then test the complete playback path before sharing the final video.',
  headingOne: 'Plan the evidence',
  sectionOne: 'Use the first checked source before recording.',
  headingTwo: 'Test the playback path',
  sectionTwo: 'Use the second checked source before sharing.',
  faq: 'Use the checked sources and test the final playback path.',
  graphicTitle: 'Founder video evidence map',
  graphicAlt: 'Three-step founder video evidence map',
  labelOne: 'Audience', detailOne: 'Choose one viewer and one next step.',
  labelTwo: 'Evidence', detailTwo: 'Bind every factual statement to a source.',
  labelThree: 'Playback', detailThree: 'Test the complete final video.',
};

function generated(context: DraftingContext, repaired: boolean): GeneratedDraftV2 {
  const firstUrl = context.sourceFacts[0].url;
  const secondUrl = context.sourceFacts[1].url;
  const bindings = [
    [repaired ? 'description-repaired' : 'description', '/description', repaired ? visibleSpans.repairedDescription : visibleSpans.initialDescription],
    ['trigger', '/customerTrigger', visibleSpans.customerTrigger],
    ['gap', '/competitorGap', visibleSpans.competitorGap],
    ['answer-1', '/directAnswer', visibleSpans.answerOne],
    ['answer-2', '/directAnswer', visibleSpans.answerTwo],
    ['heading-1', '/sections/0/heading', visibleSpans.headingOne],
    ['section-1', '/sections/0/markdown', visibleSpans.sectionOne],
    ['heading-2', '/sections/1/heading', visibleSpans.headingTwo],
    ['section-2', '/sections/1/markdown', visibleSpans.sectionTwo],
    ['faq', '/faqAnswers/0/answer', visibleSpans.faq],
    ['faq', '/faqAnswers/1/answer', visibleSpans.faq],
    ['faq', '/faqAnswers/2/answer', visibleSpans.faq],
    ['graphic-title', '/editorialGraphic/title', visibleSpans.graphicTitle],
    ['graphic-alt', '/editorialGraphic/alt', visibleSpans.graphicAlt],
    ['label-1', '/editorialGraphic/steps/0/label', visibleSpans.labelOne],
    ['detail-1', '/editorialGraphic/steps/0/detail', visibleSpans.detailOne],
    ['label-2', '/editorialGraphic/steps/1/label', visibleSpans.labelTwo],
    ['detail-2', '/editorialGraphic/steps/1/detail', visibleSpans.detailTwo],
    ['label-3', '/editorialGraphic/steps/2/label', visibleSpans.labelThree],
    ['detail-3', '/editorialGraphic/steps/2/detail', visibleSpans.detailThree],
  ] as const;
  return {
    schemaVersion: 2,
    description: repaired ? visibleSpans.repairedDescription : visibleSpans.initialDescription,
    customerTrigger: visibleSpans.customerTrigger,
    competitorGap: visibleSpans.competitorGap,
    directAnswer,
    sections: [
      { heading: visibleSpans.headingOne, markdown: `Use the [first checked source](${firstUrl}) before recording.` },
      { heading: visibleSpans.headingTwo, markdown: `Use the [second checked source](${secondUrl}) before sharing.` },
    ],
    faqAnswers: context.evidence.faqQuestions.map((question) => ({ question, answer: visibleSpans.faq })),
    sourceReferences: [{ sourceId: 'source-1' }, { sourceId: 'source-2' }],
    claimBindings: bindings.map(([id, location, span]) => ({ location, span, sourceFactIds: [id], productClaimId: null })),
    editorialGraphic: {
      title: visibleSpans.graphicTitle,
      alt: visibleSpans.graphicAlt,
      steps: [
        { label: visibleSpans.labelOne, detail: visibleSpans.detailOne },
        { label: visibleSpans.labelTwo, detail: visibleSpans.detailTwo },
        { label: visibleSpans.labelThree, detail: visibleSpans.detailThree },
      ],
    },
  };
}

class RepairingFixtureClient implements StructuredOutputClient {
  requests: StructuredOutputRequest[] = [];

  async generate(request: StructuredOutputRequest): Promise<unknown> {
    this.requests.push(request);
    const input = request.input as { candidate: Candidate; draft?: GeneratedDraftV2; originalIssues?: Array<{ id: string }> };
    const context = (this.contexts.get(input.candidate.articleId) as DraftingContext);
    if (request.name === 'videoclaw_article_draft_v2') return generated(context, false);
    if (request.name === 'videoclaw_article_critique_v1') {
      return { schemaVersion: 1, approved: false, issues: [{ id: 'editorial-1', code: 'editorial.specificity', message: 'Use source-backed wording.', repairInstruction: 'Replace the description with the supplied source-backed fact.' }] };
    }
    if (request.name === 'videoclaw_article_repair_v2') return generated(context, true);
    if (request.name === 'videoclaw_article_repair_verification_v1') {
      return { schemaVersion: 1, approved: true, evaluations: [{ issueId: 'editorial-1', resolved: true, message: 'The repaired description uses the supplied fact.' }], newIssues: [] };
    }
    throw new Error(`Unexpected fixture request ${request.name}`);
  }

  readonly contexts = new Map<string, DraftingContext>();
}

describe('offline 50-candidate flow', () => {
  it('proves 50 shallow → 10 deep → 3 repaired Markdown/SVG artifacts with state idempotency', async () => {
    const backlog = candidates();
    const client = new RepairingFixtureClient();
    let state: PersistentWorkerState = createPersistentWorkerState();
    let version: string | null = 'v1';
    let scanCount = 0;
    let deepCount = 0;
    let validationCount = 0;
    const worker = createAutobloggerWorker({
      backlog,
      stateStore: {
        load: async () => ({ state, version }),
        save: async (next, expected) => {
          expect(expected).toBe(version);
          state = next;
          version = `${version}-next`;
          return { version };
        },
      },
      researcher: {
        scan: async (items) => {
          scanCount += items.length;
          return { scannedCount: items.length, results: items.map(shallow) };
        },
        inspect: async ([observation]) => {
          deepCount += 1;
          return {
            scannedCount: 1,
            deepInspectionCount: 1,
            results: [{
              candidate: observation.candidate,
              provenance: observation.provenance,
              evidence: EvidenceBundleSchema.parse({
                schemaVersion: 1,
                candidateFingerprint: candidateFingerprints(observation.candidate).candidate,
                suggestions: [...observation.suggestions, ...observation.relatedQueries],
                serp: { organicResultCount: 2, peopleAlsoAsk: observation.peopleAlsoAsk },
                sources: [
                  { url: observation.organicResults[0].url, authoritative: true },
                  { url: observation.organicResults[1].url, authoritative: false },
                ],
                faqQuestions: observation.peopleAlsoAsk,
              }),
            }],
          };
        },
      },
      keywordProvider: {
        enrich: async ({ keyword, intent }) => ({
          metrics: KeywordMetricsSchema.parse({
            schemaVersion: 1, provider: 'semrush', observedAt: '2026-09-05T00:00:00.000Z',
            volume: Number(keyword.split(' ').at(-1)) + 10, difficulty: 20, cpc: 1, intent,
          }),
          provenance: { provider: 'semrush', endpoint: 'fixture', observedAt: '2026-09-05T00:00:00.000Z', providerRequestId: 'fixture', sourceObservedAt: '2026-09' },
        }),
      },
      drafter: createStructuredDrafter({
        client,
        mediaAllowlist: [{
          id: 'offline-product',
          campaignIds: ['newly-funded-founder', 'accelerator-demo-day-founder', 'video-production-comparison'],
          src: '/landing/full/founder-product.mp4', poster: '/landing/full/founder-product.jpg',
          alt: 'A founder-led product demonstration', caption: 'An existing product demonstration.', width: 1280, height: 720,
        }],
      }),
      buildDraftContext: ({ result, metrics }) => {
        const facts = [
          { id: 'description', text: visibleSpans.initialDescription },
          { id: 'description-repaired', text: visibleSpans.repairedDescription },
          { id: 'trigger', text: visibleSpans.customerTrigger },
          { id: 'gap', text: visibleSpans.competitorGap },
          { id: 'answer-1', text: visibleSpans.answerOne },
          { id: 'answer-2', text: visibleSpans.answerTwo },
          { id: 'heading-1', text: visibleSpans.headingOne },
          { id: 'section-1', text: visibleSpans.sectionOne },
          { id: 'heading-2', text: visibleSpans.headingTwo },
          { id: 'section-2', text: visibleSpans.sectionTwo },
          { id: 'faq', text: visibleSpans.faq },
          { id: 'graphic-title', text: visibleSpans.graphicTitle },
          { id: 'graphic-alt', text: visibleSpans.graphicAlt },
          { id: 'label-1', text: visibleSpans.labelOne },
          { id: 'detail-1', text: visibleSpans.detailOne },
          { id: 'label-2', text: visibleSpans.labelTwo },
          { id: 'detail-2', text: visibleSpans.detailTwo },
          { id: 'label-3', text: visibleSpans.labelThree },
          { id: 'detail-3', text: visibleSpans.detailThree },
        ];
        const context: DraftingContext = {
          candidate: result.candidate,
          evidence: result.evidence,
          keywordMetrics: metrics,
          checkedSources: result.evidence.sources.map((source) => ({ url: source.url, finalUrl: source.url, status: 200, reachable: true, authoritative: source.authoritative })),
          provenance: { apifyRunId: 'serp-fixture', apifyDatasetId: 'serp-data', query: result.candidate.primaryKeyword, locale: 'en-US', capturedAt: '2026-09-05' },
          sourceFacts: [
            { id: 'source-1', label: 'Primary source', url: result.evidence.sources[0].url, checkedAt: '2026-09-05T00:01:00.000Z', facts },
            { id: 'source-2', label: 'Secondary source', url: result.evidence.sources[1].url, checkedAt: '2026-09-05T00:01:00.000Z', facts: [{ id: 'secondary', text: 'Secondary checked guidance' }] },
          ],
          productClaims: [],
          generatedAt: '2026-09-05T00:02:00.000Z',
        };
        client.contexts.set(result.candidate.articleId, context);
        return context;
      },
      publisher: {
        validateBundle: async (bundle) => {
          validationCount += 1;
          expect(bundle.markdown).toMatch(/status:\s*["']?review["']?/u);
          expect(bundle.svg).toContain('width="1200"');
          return { status: 'passed', cleanup: 'completed', bundleHash: 'a'.repeat(64), landerRef: 'seo/founder-video-blog-launch', checkedOutHeadSha: 'b'.repeat(40), articlePath: `content/articles/${String(bundle.article.slug)}.md`, svgPath: `public/media/blog/${String(bundle.article.slug)}.svg`, commands: [] };
        },
        openDraftPullRequest: async () => { throw new Error('Pre-merge fixture must not call the PR publisher.'); },
      },
      landerRef: 'seo/founder-video-blog-launch',
      approvedMedia: { product: [], editorialGraphics: [] },
      now: () => new Date('2026-09-05T00:03:00.000Z'),
    });

    const first = await worker.execute({ command: 'run', runId: 'offline-e2e-1' });
    expect(first.failures).toEqual([]);
    expect({ scanCount, deepCount, validationCount }).toEqual({ scanCount: 50, deepCount: 10, validationCount: 3 });
    expect(first.artifacts).toHaveLength(3);
    expect(first.artifacts.every(({ publication, bundle }) => publication === 'artifact_only' && bundle.svg !== null)).toBe(true);
    expect(client.requests.map(({ name }) => name)).toHaveLength(12);
    expect(client.requests.filter(({ name }) => name === 'videoclaw_article_repair_verification_v1')).toHaveLength(3);

    const again = await worker.execute({ command: 'run', runId: 'offline-e2e-1' });
    expect(again.status).toBe('already_recorded');
    expect({ scanCount, deepCount, validationCount }).toEqual({ scanCount: 50, deepCount: 10, validationCount: 3 });
  });
});
