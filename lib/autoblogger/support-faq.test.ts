import { describe, expect, it } from 'vitest';
import { createResearcher, selectRelevantPaaQuestions, SERP_ACTOR_ID, type ShallowResearchResult } from './research';
import type { ApifyClient } from './apify-client';
import { createSafeSourceChecker } from './sources';
import { PRODUCTION_SOURCE_AUTHORITY_POLICIES } from './source-policy';
import { candidateFingerprints } from './domain';
import { planFaqEvidence } from './faq-evidence';
import { buildDraftingContextFromResearch } from './runtime';
import { createPendingKeywordProvider } from './keyword-providers';

const at = '2026-09-09T00:00:00.000Z';
const creation = 'How can I create an explainer video?';
const definition = 'What is an explainer video?';
const duration = 'How long should an explainer video be?';
const initial = ['What is the best explainer video?', creation, 'What is the best AI to create explainer videos?'];
const shallow: ShallowResearchResult = {
  candidate: { schemaVersion: 1, articleId: 'vc-c4-test-support-faq', campaignId: 'gtm-content-repurposing-buyer',
    icp: 'Startup GTM lead making a product video', primaryKeyword: 'explainer video', secondaryKeywords: [],
    title: 'Explainer Video: Plan a Clear Product Story', slug: 'explainer-video', intent: 'informational', funnelStage: 'middle' },
  suggestions: ['explainer video guide'], peopleAlsoAsk: initial, relatedQueries: [],
  organicResults: [{url: 'https://publisher.example/explainer', title: 'Explainer guide', snippet: 'Not source evidence.', resultType: 'article'}],
  provenance: { discovery: {actorId: 'autocomplete', runId: 'discovery', datasetId: 'discovery-data', observedAt: at},
    serp: {actorId: SERP_ACTOR_ID, runId: 'original', datasetId: 'original-data', observedAt: at} },
};

const row = (questions: string[], patch: Record<string, unknown> = {}) => ({
  searchQuery: {term: creation, device: 'DESKTOP', page: 1, countryCode: 'US', languageCode: 'en', ...patch},
  organicResults: [{position: 1, title: 'Recording guide', url: 'https://www.descript.com/blog/article/explainer', description: 'Not source evidence.'}],
  peopleAlsoAsk: questions.map(question => ({question, answer: 'RAW_PROVIDER_ANSWER', url: 'https://unsafe.example/not-a-source'})),
  relatedQueries: [],
});

async function inspect(rows: unknown[], input = shallow) {
  const searches: Record<string, unknown>[] = [];
  const bodyUrls: string[] = [];
  const selectionQuestions: string[][] = [];
  const client: ApifyClient = {
    startActor: async (actor, body) => {
      if (actor !== SERP_ACTOR_ID || searches.length) throw new Error('Unexpected additional paid collection');
      searches.push(body);
      return {id: 'support', status: 'SUCCEEDED', defaultDatasetId: 'support-data', startedAt: at, finishedAt: at};
    },
    getRun: async () => { throw new Error('Already complete'); },
    getDatasetItems: async () => rows,
    abortRun: async id => ({id, status: 'ABORTED'}),
  };
  const checker = createSafeSourceChecker({
    authorityPolicies: PRODUCTION_SOURCE_AUTHORITY_POLICIES,
    resolveHostname: async () => ['93.184.216.34'],
    transport: async request => {
      bodyUrls.push(request.url);
      const html = '<article><p>An explainer video is a short recording that explains a product or service.</p>'
        + '<p>To create an explainer video, choose a single product task and write a short script.</p>'
        + '<p>An explainer video should last one minute for this particular presentation.</p></article>';
      return {status: 200, url: request.url, redirected: false, peerAddress: request.allowedPeerAddresses[0],
        headers: {'content-type': 'text/html'}, body: (async function* () {yield new TextEncoder().encode(html);})()};
    },
  });
  const researcher = createResearcher({apify: client, execution: {nowMs: () => Date.parse(at)}, sourceChecker: {
    select: checker.select,
    selectWithContent: async (urls, relevance) => {
      selectionQuestions.push([...(relevance?.questions ?? [])]);
      return checker.selectWithContent(urls, relevance);
    },
  }});
  const result = (await researcher.inspect([input])).results[0];
  return {result, searches, bodyUrls, selectionQuestions};
}

describe('support-search observed FAQ recovery', () => {
  it('does not count make/create cost variants as two distinct FAQ intents', () => {
    expect(() => selectRelevantPaaQuestions('explainer video', [creation,
      'How much does it cost to make an explainer video?',
      'How much does it cost to create an explainer video?',
    ])).toThrow(/three relevant/);
    expect(selectRelevantPaaQuestions('explainer video', [creation,
      'How much does it cost to make an explainer video?',
      'How much does it cost to create an explainer video?', definition,
    ])).toEqual([creation, 'How much does it cost to make an explainer video?', definition]);
  });
  it('uses real support-query questions and carries their exact provenance through body-backed selection', async () => {
    const before = structuredClone(shallow);
    const {result, searches, bodyUrls, selectionQuestions} = await inspect([row([definition, duration])]);
    expect(result.evidence.faqQuestions).toEqual([creation, definition, duration]);
    expect(result.evidence.signals.peopleAlsoAsk).toEqual([...initial, definition, duration]);
    expect(selectionQuestions[0]).toContain(definition);
    expect(result.provenance.serp).toEqual(before.provenance.serp);
    expect(result.evidence.serp.organicResultCount).toBe(1);
    expect(result.paaObservations).toEqual([
      {actorId: SERP_ACTOR_ID, runId: 'support', datasetId: 'support-data', observedAt: at,
        query: creation, question: definition, parentQuestion: null, country: 'US', language: 'en', position: 1},
      {actorId: SERP_ACTOR_ID, runId: 'support', datasetId: 'support-data', observedAt: at,
        query: creation, question: duration, parentQuestion: null, country: 'US', language: 'en', position: 2},
    ]);
    expect(JSON.stringify(result)).not.toContain('RAW_PROVIDER_ANSWER');
    expect(bodyUrls).not.toContain('https://unsafe.example/not-a-source');
    expect(searches).toHaveLength(1);
    expect(String(searches[0].queries).trim().split('\n')).toHaveLength(7);
    expect(shallow).toEqual(before);
    const {metrics} = await createPendingKeywordProvider().enrich({keyword: 'explainer video', intent: 'informational', mode: 'manual_pilot'});
    const context = buildDraftingContextFromResearch({result, shallow, metrics, generatedAt: at});
    expect(context.evidence.candidateFingerprint).toBe(candidateFingerprints(shallow.candidate).candidate);
    expect(planFaqEvidence(context.evidence.faqQuestions, context.sourceFacts).every(x => x.sourceFactIds.length > 0)).toBe(true);
  });

  it.each([
    {term: 'unrequested explainer video query'}, {term: 'explainer video site ycombinator com'},
    {countryCode: 'GB'}, {languageCode: 'fr'},
    {device: 'MOBILE'}, {page: 2},
  ])('never attributes questions from an out-of-scope support row: %j', async patch => {
    const {result} = await inspect([row([]), row([definition, duration], patch)]);
    expect(result.evidence.faqQuestions).toEqual(initial);
    expect(result.evidence.signals.peopleAlsoAsk).toEqual(initial);
    expect(result.paaObservations ?? []).toEqual([]);
  });

  it('retains the reported query spelling without fabricating PAA expansion ancestry', async () => {
    const reportedQuery = creation.toUpperCase();
    const {result} = await inspect([row([definition, duration], {term: reportedQuery})]);
    expect(result.paaObservations).toHaveLength(2);
    expect(result.paaObservations?.every(observation => observation.query === reportedQuery
      && observation.parentQuestion === null)).toBe(true);
  });

  it('retains the original positions before empty and duplicate PAA entries are removed', async () => {
    const supportRow = row([]);
    const {result} = await inspect([{...supportRow, peopleAlsoAsk: [
      null, '', {question: definition}, {question: definition.toUpperCase()},
      {title: duration}, {question: ''}, duration,
    ]}]);
    expect(result.paaObservations?.map(({question, position}) => ({question, position}))).toEqual([
      {question: definition, position: 3}, {question: duration, position: 5},
    ]);
  });

  it('rejects unrelated, unsafe, overlong and duplicated questions without inventing replacements', async () => {
    const {result} = await inspect([row([
      'What is the most viewed educational video?', `What is an explainer video ${'x'.repeat(501)}?`,
      'What is an explainer video\u0000?', 'What is an explainer video\u200b?',
      'What is an explainer video api_key=0123456789abcdef0123456789abcdef?',
      definition, definition.toUpperCase(), duration,
    ])]);
    expect(result.evidence.faqQuestions).toEqual([creation, definition, duration]);
    expect(result.paaObservations?.map(x => x.question)).toEqual([definition, duration]);
    expect(result.evidence.signals.peopleAlsoAsk).toEqual([...initial, definition, duration]);
  });

  it('does not promote a heading or PAA answer into body evidence', async () => {
    const best = 'What is the best explainer video?';
    const {result} = await inspect([row([best])]);
    expect(result.evidence.faqQuestions).toEqual(initial);
    expect(result.sourceDocuments?.every(d => !d.text.includes('RAW_PROVIDER_ANSWER'))).toBe(true);
  });

  it('caps source-selection questions at nine and retained observations at thirty', async () => {
    const many = Array.from({length: 40}, (_, i) => `What is explainer video production method ${i + 1}?`);
    const {result, selectionQuestions, searches} = await inspect([row(many)]);
    expect(selectionQuestions[0].length).toBeLessThanOrEqual(9);
    expect(result.paaObservations?.length).toBeLessThanOrEqual(30);
    expect(result.paaObservations?.length).toBeGreaterThan(0);
    expect(searches).toHaveLength(1);
    expect(result.evidence.faqQuestions).toEqual(initial);
  });

  it('retains selected support and original PAA provenance at the observation cap', async () => {
    const input: ShallowResearchResult = {...shallow, paaObservations: Array.from({length: 30}, (_, i) => ({
      actorId: 'paa', runId: 'prior-paa', datasetId: 'prior-data', observedAt: at,
      query: 'explainer video', question: i === 29 ? creation : `What is video encoding rule ${i}?`,
      parentQuestion: null, country: 'US', language: 'en', position: i + 1,
    }))};
    const {result} = await inspect([row([definition, duration])], input);
    expect(result.evidence.faqQuestions).toEqual([creation, definition, duration]);
    expect(result.paaObservations).toHaveLength(30);
    expect(result.paaObservations?.find(x => x.question === creation)).toMatchObject({runId: 'prior-paa', query: 'explainer video'});
    expect(result.paaObservations?.find(x => x.question === duration)).toMatchObject({runId: 'support', query: creation});
    expect(result.paaObservations?.find(x => x.question === definition)).toMatchObject({runId: 'support', query: creation});
    expect(input.paaObservations).toHaveLength(30);
  });
});
