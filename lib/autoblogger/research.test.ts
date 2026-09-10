import { describe, expect, it } from 'vitest';

import { CandidateSchema, EvidenceBundleSchema, type Candidate } from './domain';
import {
  AUTOCOMPLETE_ACTOR_ID,
  SERP_ACTOR_ID,
  createResearcher,
  runApifyActor,
  rankObservedPaaQuestions,
  selectRelevantPaaQuestions,
} from './research';
import type { ApifyClient, ApifyRun } from './apify-client';
import { PAA_ACTOR_ID } from './paa';
import { createSafeSourceChecker } from './sources';
import { PRODUCTION_SOURCE_AUTHORITY_POLICIES } from './source-policy';
const researchClock={nowMs:()=>Date.parse('2026-09-04T08:15:00.000Z')};

describe('observed FAQ admission before semantic preparation', () => {
  it('ranks real wording without rewriting, merging tool names or approving relevance', () => {
    const questions = ['What are payroll taxes?', 'How do I record video testimonials?',
      'How to make a testimonial video with Canvas?', 'How to make a testimonial video with Canva?',
      'What is the best video testimonial software?'];
    const ranked = rankObservedPaaQuestions('video testimonial software', questions);
    expect(ranked[0]).toBe(questions[4]);
    expect(ranked.at(-1)).toBe(questions[0]);
    expect(new Set(ranked)).toEqual(new Set(questions));
  });

  it('excludes unsafe text and exact/creation aliases, preserving the first observation', () => {
    const first = 'How to make a testimonial video?';
    const other = ['Are video testimonials effective?', 'How do I record video testimonials?'];
    const unsafe = ['', 'What is video\u0000?', 'What is video\u200b?', `What is ${'x'.repeat(501)}?`,
      'What is video api_key=0123456789abcdef0123456789abcdef?'];
    const ranked = rankObservedPaaQuestions('video testimonial software', [first, first.toUpperCase(),
      'How to create a video testimonial?', ...unsafe, ...other]);
    expect(new Set(ranked)).toEqual(new Set([first, ...other]));
    expect(() => rankObservedPaaQuestions('video testimonial software', [first,
      'How to create a video testimonial?', ...unsafe, other[0]])).toThrow(/three distinct observed/);
  });
  it('retains buyer questions without requiring them to repeat the commercial keyword suffix', async () => {
    const candidate = {...candidates(1)[0], primaryKeyword: 'video testimonial software', title: 'Choose Video Testimonial Software'};
    const exact = 'What is the best video testimonial software?';
    const record = 'How do I record video testimonials?';
    const effective = 'Are video testimonials effective?';
    const urls = ['https://www.techsmith.com/blog/testimonial-videos/', 'https://vendor.example/testimonials'];
    let query = '', starts = 0, reads = 0;
    const apify: ApifyClient = {
      startActor: async (actor, input) => {
        expect(actor).toBe(SERP_ACTOR_ID);
        starts++;
        query = String(input.queries).trim().split('\n')[0];
        return successfulRun('buyer-support-run', 'buyer-support-data');
      },
      getRun: async () => {throw new Error('Already complete');},
      getDatasetItems: async () => [{searchQuery: {term: query, device: 'DESKTOP', page: 1, countryCode: 'US', languageCode: 'en'},
        organicResults: [], relatedQueries: [], peopleAlsoAsk: [{question: record}, {question: effective}]}],
      abortRun: async id => ({id, status: 'ABORTED'}),
    };
    const input = {candidate, suggestions: [candidate.primaryKeyword], relatedQueries: [], peopleAlsoAsk: [exact],
      organicResults: urls.map(url => ({url, title: 'Testimonial recording', snippet: 'Observed page', resultType: 'article'})),
      provenance: {discovery: {actorId: 'autocomplete', runId: 'discovery', datasetId: 'discovery', observedAt: '2026-09-04T08:01:00.000Z'},
        serp: {actorId: SERP_ACTOR_ID, runId: 'primary', datasetId: 'primary-data', observedAt: '2026-09-04T08:01:00.000Z'}}};
    const original = structuredClone(input);
    const researcher = createResearcher({apify, execution: researchClock, sourceChecker: {
      select: async () => {throw new Error('Body source retrieval required');},
      selectWithContent: async (_urls, options) => {
        reads++;
        expect(options?.questions).toEqual([exact, record, effective]);
        return {sources: urls.map((url, index) => ({originalUrl: url, finalUrl: url, authoritative: index === 0})), sourceDocuments: []};
      },
    }});
    const result = (await researcher.inspect([input])).results[0];
    expect(result.evidence.faqQuestions).toEqual([exact, record, effective]);
    expect(result.paaObservations?.map(item => ({question: item.question, query: item.query, runId: item.runId})))
      .toEqual([{question: record, query, runId: 'buyer-support-run'}, {question: effective, query, runId: 'buyer-support-run'}]);
    expect(starts).toBe(1);
    expect(reads).toBe(1);
    expect(input).toEqual(original);
  });
});

describe('bounded PAA completion during deep discovery', () => {
  const questions = ['How to make a testimonial video?', 'What is a testimonial video?', 'How long should a testimonial video be?'];
  it.each([0, 1, 2])('completes %s initial questions with one attributable support search', async count => {
    const candidate = {...candidates(1)[0], primaryKeyword:'testimonial video examples', title:'Testimonial Video Examples'};
    let starts=0, query='';
    const apify: ApifyClient = {
      startActor: async (actor,input) => {
        expect(actor).toBe(SERP_ACTOR_ID); starts++;
        const queries=String(input.queries).trim().split('\n');
        expect(queries.length).toBeLessThanOrEqual(7); query=queries[0];
        return successfulRun('support-run','support-data');
      },
      getRun:async()=>{throw new Error('Already complete');},
      getDatasetItems:async()=>[{searchQuery:{term:query,device:'DESKTOP',page:1,countryCode:'US',languageCode:'en'},
        organicResults:[],peopleAlsoAsk:questions.map(question=>({question})),relatedQueries:[]}],
      abortRun:async id=>({id,status:'ABORTED'}),
    };
    const urls=['https://www.descript.com/blog/article/testimonial','https://independent.example/testimonial'];
    const input={candidate,suggestions:[candidate.primaryKeyword],relatedQueries:[],peopleAlsoAsk:questions.slice(0,count),
      organicResults:urls.map(url=>({url,title:'Testimonial guide',snippet:'Observed page.',resultType:'article'})),
      provenance:{discovery:{actorId:'a',runId:'a',datasetId:'a',observedAt:'2026-09-04T08:01:00.000Z'},
        serp:{actorId:SERP_ACTOR_ID,runId:'original-run',datasetId:'original-data',observedAt:'2026-09-04T08:01:00.000Z'}}};
    const original=structuredClone(input);
    const researcher=createResearcher({apify,execution:researchClock,sourceChecker:{select:async()=>{throw new Error('Body selection required');},
      selectWithContent:async()=>({sources:urls.map((url,index)=>({originalUrl:url,finalUrl:url,authoritative:index===0})),sourceDocuments:[]})}});
    const result=(await researcher.inspect([input])).results[0];
    expect(starts).toBe(1);
    expect(result.evidence.faqQuestions).toEqual(questions);
    expect(result.provenance.serp.runId).toBe('original-run');
    expect(result.paaObservations).toHaveLength(3-count);
    expect(result.paaObservations?.every(observation=>observation.runId==='support-run' && observation.query===query)).toBe(true);
    expect(input).toEqual(original);
  });
});

describe('testimonial creation aliases at the research boundary', () => {
  it.each([false, true])('counts one creation slot and retains first wording (duration=%s)', async hasDuration => {
    const candidate = { ...candidates(1)[0], primaryKeyword: 'testimonial video examples', title: 'Testimonial Video Examples' };
    const first = 'How to make a testimonial video?';
    const alias = 'How to create a video testimonial?';
    const definition = 'What is a video testimonial?';
    const duration = 'How long should a testimonial video be?';
    const urls = ['https://www.descript.com/blog/article/testimonial', 'https://independent.example/testimonial'];
    const input = {
      candidate, suggestions: [candidate.primaryKeyword], relatedQueries: [], peopleAlsoAsk: [first, definition, alias],
      organicResults: urls.map(url => ({ url, title: 'Testimonial guide', snippet: 'Observed page.', resultType: 'article' })),
      provenance: {
        discovery: { actorId: 'autocomplete', runId: 'original-discovery', datasetId: 'original-discovery-data', observedAt: '2026-09-04T08:01:00.000Z' },
        serp: { actorId: SERP_ACTOR_ID, runId: 'original-serp', datasetId: 'original-serp-data', observedAt: '2026-09-04T08:01:00.000Z' },
      },
    };
    const original = structuredClone(input);
    let starts = 0;
    let query = '';
    let sourceReads = 0;
    const apify: ApifyClient = {
      startActor: async (actorId, request) => {
        expect(actorId).toBe(SERP_ACTOR_ID);
        starts += 1;
        if (starts > 1) throw new Error('Unexpected second support batch.');
        const queries = String(request.queries).trim().split('\n');
        expect(queries.length).toBeLessThanOrEqual(7);
        query = queries[0];
        return successfulRun('alias-support-run', 'alias-support-data');
      },
      getRun: async () => { throw new Error('The support run is already complete.'); },
      getDatasetItems: async datasetId => {
        expect(datasetId).toBe('alias-support-data');
        return [{
          searchQuery: { term: query, device: 'DESKTOP', page: 1, countryCode: 'US', languageCode: 'en' },
          organicResults: [], relatedQueries: [],
          peopleAlsoAsk: hasDuration ? [{ question: duration }] : [],
        }];
      },
      abortRun: async id => ({ id, status: 'ABORTED' }),
    };
    const researcher = createResearcher({
      apify, execution: researchClock,
      sourceChecker: {
        select: async () => { throw new Error('Body selection required.'); },
        selectWithContent: async () => {
          sourceReads += 1;
          return { sources: urls.map((url, index) => ({ originalUrl: url, finalUrl: url, authoritative: index === 0 })), sourceDocuments: [] };
        },
      },
    });

    if (hasDuration) {
      const result = (await researcher.inspect([input])).results[0];
      expect(result.evidence.faqQuestions).toEqual([first, definition, duration]);
      expect(result.evidence.serp.peopleAlsoAsk).toEqual([first, definition, duration]);
      expect(result.provenance.serp).toEqual(original.provenance.serp);
      expect(result.paaObservations).toEqual([expect.objectContaining({
        question: duration, query, runId: 'alias-support-run', datasetId: 'alias-support-data',
      })]);
    } else {
      await expect(researcher.inspect([input])).rejects.toThrow(/three distinct observed/i);
    }
    expect(starts).toBe(1);
    expect(sourceReads).toBe(hasDuration ? 1 : 0);
    expect(input).toEqual(original);
  });
});

describe('bounded zero-organic SERP recovery', () => {
  const questions = [
    'How do you plan a founder video topic?',
    'What belongs in a founder video topic?',
    'Why does a founder video topic matter?',
  ];
  function row(query: string, organic: boolean) {
    return {
      searchQuery: { term: query, device: 'DESKTOP', page: 1, countryCode: 'US', languageCode: 'en' },
      serpProviderCode: 'L', hasNextPage: organic,
      organicResults: organic ? [{ position: 1, title: 'Demo planning guide', url: 'https://publisher.example/guide', description: 'Observed guide.' }] : [],
      peopleAlsoAsk: organic ? questions.map((question) => ({ question })) : [],
      relatedQueries: organic ? [{ title: 'founder video topic planning' }] : [],
      paidResults: [], paidProducts: [], suggestedResults: [], customData: null,
    };
  }
  function boundary(initial: unknown[], retried: unknown[] | Error) {
    const requests: Record<string, unknown>[] = [];
    const client: ApifyClient = {
      startActor: async (actor, input) => {
        if (actor === AUTOCOMPLETE_ACTOR_ID) return successfulRun('discovery', 'discovery');
        if (actor !== SERP_ACTOR_ID) throw new Error('Unexpected paid actor');
        requests.push(input);
        if (requests.length > 2) throw new Error('Unbounded SERP retry');
        if (requests.length === 2 && retried instanceof Error) throw retried;
        return { ...successfulRun(`serp-${requests.length}`, `dataset-${requests.length}`),
          finishedAt: requests.length === 1 ? '2026-09-04T08:01:00.000Z' : '2026-09-04T08:02:00.000Z' };
      },
      getRun: async () => { throw new Error('Already complete'); },
      getDatasetItems: async (id) => id === 'discovery' ? [] : id === 'dataset-1' ? initial : retried as unknown[],
      abortRun: async (id) => ({ id, status: 'ABORTED' }),
    };
    return { requests, researcher: createResearcher({ apify: client, sourceChecker: { select: async () => [] }, execution: researchClock }) };
  }

  it('retries only empty exact queries and carries the selected row run into deep evidence', async () => {
    const input = candidates(3);
    const initial = input.map((candidate, index) => row(candidate.primaryKeyword, index === 1));
    const recovered = row(input[0].primaryKeyword, true);
    const stillEmpty = row(input[2].primaryKeyword, false);
    const { researcher, requests } = boundary(initial, [stillEmpty, row('unrequested topic', true), recovered]);
    const result = await researcher.scan(input);

    expect(result.results.map(({ organicResults }) => organicResults.length)).toEqual([1, 1, 0]);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual({
      queries: 'founder video topic 1\nfounder video topic 3\n', maxPagesPerQuery: 1,
      countryCode: 'us', languageCode: 'en', mobileResults: false,
      includeUnfilteredResults: false, saveHtml: false, saveHtmlToKeyValueStore: false,
      websiteContentScraper: { enable: false },
    });
    expect(result.results[0].peopleAlsoAsk).toEqual(questions);
    expect(result.results[0].relatedQueries).toEqual(['founder video topic planning']);
    expect(result.results[0].provenance.serp).toMatchObject({ runId: 'serp-2', datasetId: 'dataset-2', observedAt: '2026-09-04T08:02:00.000Z' });
    expect(result.results[0].provenance.serpAttempts?.map(({ runId }) => runId)).toEqual(['serp-1', 'serp-2']);
    expect(result.results[1].provenance.serp.runId).toBe('serp-1');
    expect(result.results[1].provenance.serpAttempts).toBeUndefined();
    expect(result.results[2].provenance.serp.runId).toBe('serp-2');
    expect(result.results[2].serpCollectionError).toMatch(/no organic/i);
    const deep = await researcher.inspect([result.results[0]]);
    expect(deep.results[0].evidence.serp.organicResultCount).toBe(1);
    expect(deep.results[0].provenance.serpAttempts?.map(({ runId }) => runId)).toEqual(['serp-1', 'serp-2']);
  });

  it('stops after one still-empty retry and preserves both observation IDs', async () => {
    const input = candidates(1);
    const empty = row(input[0].primaryKeyword, false);
    const { researcher, requests } = boundary([empty], [empty]);
    const result = await researcher.scan(input);
    expect(requests).toHaveLength(2);
    expect(result.results[0].organicResults).toEqual([]);
    expect(result.results[0].provenance.serpAttempts?.map(({ datasetId }) => datasetId)).toEqual(['dataset-1', 'dataset-2']);
    expect(result.results[0].serpCollectionError).toMatch(/no organic/i);
  });

  it('keeps the original empty observation when the single retry fails to start', async () => {
    const input = candidates(1);
    const { researcher, requests } = boundary([row(input[0].primaryKeyword, false)], new Error('temporary provider failure'));
    const result = await researcher.scan(input);
    expect(requests).toHaveLength(2);
    expect(result.results[0].organicResults).toEqual([]);
    expect(result.results[0].provenance.serp.runId).toBe('serp-1');
    expect(result.results[0].serpCollectionError).toContain('temporary provider failure');
  });

  it.each(['wrong query', 'wrong country', 'wrong language', 'mobile', 'second page', 'duplicate', 'missing'])('does not accept %s retry evidence', async (problem) => {
    const input = candidates(1);
    const observation = row(input[0].primaryKeyword, true);
    if (problem === 'wrong query') observation.searchQuery.term = 'another founder video topic';
    if (problem === 'wrong country') observation.searchQuery.countryCode = 'GB';
    if (problem === 'wrong language') observation.searchQuery.languageCode = 'fr';
    if (problem === 'mobile') observation.searchQuery.device = 'MOBILE';
    if (problem === 'second page') observation.searchQuery.page = 2;
    const retry = problem === 'missing' ? [] : problem === 'duplicate' ? [observation, observation] : [observation];
    const { researcher, requests } = boundary([row(input[0].primaryKeyword, false)], retry);
    const result = await researcher.scan(input);
    expect(requests).toHaveLength(2);
    expect(result.results[0].organicResults).toEqual([]);
    expect(result.results[0].peopleAlsoAsk).toEqual([]);
    expect(result.results[0].provenance.serp.runId).toBe('serp-1');
    expect(result.results[0].provenance.serpAttempts?.map(({ runId }) => runId)).toEqual(['serp-1', 'serp-2']);
    expect(result.results[0].serpCollectionError).toBeTruthy();
  });

  it('does not pay for a retry when every initial row contains organic results', async () => {
    const input = candidates(2);
    const { researcher, requests } = boundary(input.map((candidate) => row(candidate.primaryKeyword, true)), []);
    const result = await researcher.scan(input);
    expect(requests).toHaveLength(1);
    // US/en describes the market and interface. Adding lr=lang_en changes the
    // search population and reproduced empty Google pages for populated terms.
    expect(requests[0]).toMatchObject({ countryCode: 'us', languageCode: 'en', mobileResults: false });
    expect(requests[0]).not.toHaveProperty('searchLanguage');
    expect(result.results.map(({ organicResults }) => organicResults.length)).toEqual([1, 1]);
  });

  it('bounds retry queries to the initial 50-candidate scan', async () => {
    const input = candidates(55);
    const { researcher, requests } = boundary(input.slice(0, 50).map((candidate) => row(candidate.primaryKeyword, false)), []);
    const result = await researcher.scan(input);
    expect(result.scannedCount).toBe(50);
    expect(requests).toHaveLength(2);
    expect(String(requests[1].queries).trim().split('\n')).toHaveLength(50);
    expect(String(requests[1].queries)).not.toContain('founder video topic 51');
  });
});

describe('missing PAA collector recovery', () => {
  describe('FAQ relevance through collection and inspection', () => {
    const candidate = { ...candidates(1)[0], primaryKeyword: 'product demo checklist' };
    const genericQuestions = [
      'What is a product demo?',
      'When starting a product demo, what should you do first?',
    ];
    const adjacentQuestion = 'What are the steps involved in a product launch checklist?';
    const checklistQuestion = 'What should a product demo checklist include?';

    function boundary(initial: string[], collections: string[][], queryCandidate = candidate) {
      const requests: Record<string, unknown>[] = [];
      const client: ApifyClient = {
        startActor: async (actor, input) => {
          if (actor === PAA_ACTOR_ID) {
            requests.push(input);
            if (requests.length > collections.length) throw new Error('Unexpected PAA attempt');
            return successfulRun(`paa-${requests.length}`, `paa-data-${requests.length}`);
          }
          if (actor !== AUTOCOMPLETE_ACTOR_ID && actor !== SERP_ACTOR_ID) throw new Error('Unexpected actor');
          return successfulRun(actor, actor);
        },
        getRun: async () => { throw new Error('Already complete'); },
        abortRun: async (id) => ({ id, status: 'ABORTED' }),
        getDatasetItems: async (id) => {
          if (id === AUTOCOMPLETE_ACTOR_ID) return [];
          if (id === SERP_ACTOR_ID) return [{
            searchQuery: { term: queryCandidate.primaryKeyword, device: 'DESKTOP', page: 1, countryCode: 'US', languageCode: 'en' },
            organicResults: [{ position: 1, title: 'Demo planning', url: 'https://publisher.example/plan', description: 'Planning.' }],
            peopleAlsoAsk: initial.map((question) => ({ question })), relatedQueries: [],
          }];
          const collection = Number(id.replace('paa-data-', ''));
          return collections[collection - 1].map((question, index) => ({
            record_type: 'paa_question', keyword: queryCandidate.primaryKeyword, question,
            parent_question: adjacentQuestion, position: index + 1, country: 'us', language: 'en',
            checked_at: '2026-09-04T08:01:00.000Z',
          }));
        },
      };
      return {
        requests,
        researcher: createResearcher({ apify: client, sourceChecker: { select: async () => [] }, execution: researchClock }),
      };
    }

    it('retains nonliteral candidate receipts through scan and inspect when a prior attempt filled the cap', async () => {
      const buyer = {...candidate, primaryKeyword: 'video testimonial software'};
      const exact = 'What is the best video testimonial software?';
      const variants = ['How do I record video testimonials?', 'Are video testimonials effective?'];
      const {researcher, requests} = boundary([exact], [
        Array.from({length: 30}, (_, index) => `What are payroll tax rules for area ${index}?`), variants,
      ], buyer);
      const scanned = await researcher.scan([buyer]);
      expect(requests).toHaveLength(2);
      const result = scanned.results[0];
      expect(result.paaObservations).toHaveLength(30);
      const deep = (await researcher.inspect([result])).results[0];
      expect(deep.evidence.faqQuestions).toEqual([exact, ...variants]);
      for (const observed of [result, deep]) {
        for (const [index, question] of variants.entries()) {
          expect(observed.paaObservations?.find(item => item.question === question)).toMatchObject({
            query: buyer.primaryKeyword, runId: 'paa-2', datasetId: 'paa-data-2', position: index + 1,
          });
        }
      }
    });

    it('recovers a missing topical FAQ in two bounded attempts and retains its exact observation at the cap', async () => {
      const initial = [...genericQuestions, adjacentQuestion];
      const { researcher, requests } = boundary(initial, [
        Array.from({ length: 30 }, (_, index) => `What belongs in product launch checklist ${index + 1}?`),
        [checklistQuestion],
      ]);
      const scanned = await researcher.scan([candidate]);
      expect(requests).toEqual(Array(2).fill({
        keywords: ['product demo checklist'], countryCode: 'us', languageCode: 'en', includeRelatedSearches: true,
      }));
      const shallow = scanned.results[0];
      expect(shallow.peopleAlsoAsk).toEqual(expect.arrayContaining([...initial, checklistQuestion]));
      expect(shallow.paaObservations).toHaveLength(30);
      expect(shallow.paaObservations?.find(({ question }) => question === checklistQuestion)).toEqual({
        question: checklistQuestion, parentQuestion: adjacentQuestion, query: 'product demo checklist',
        actorId: PAA_ACTOR_ID, runId: 'paa-2', datasetId: 'paa-data-2',
        observedAt: '2026-09-04T08:01:00.000Z', position: 1, country: 'US', language: 'en',
      });
      const deep = (await researcher.inspect([shallow])).results[0];
      expect(deep.evidence.faqQuestions).toEqual([checklistQuestion, ...genericQuestions]);
      expect(deep.evidence.serp.peopleAlsoAsk).toEqual([checklistQuestion, ...genericQuestions]);
      expect(deep.evidence.signals.peopleAlsoAsk).toEqual(shallow.peopleAlsoAsk);
      expect(deep.provenance.serp.runId).toBe(SERP_ACTOR_ID);
      expect(deep.provenance.paaAttempts?.map(({ runId, datasetId }) => [runId, datasetId]))
        .toEqual([['paa-1', 'paa-data-1'], ['paa-2', 'paa-data-2']]);
    });

    it('stops after two adjacent-only collections and retains provisional questions for semantic review', async () => {
      const initial = [...genericQuestions, adjacentQuestion];
      const { researcher, requests } = boundary(initial, [[adjacentQuestion], [adjacentQuestion]]);
      const scanned = await researcher.scan([candidate]);
      expect(requests).toHaveLength(2);
      expect(scanned.results[0].peopleAlsoAsk).toEqual(initial);
      expect(scanned.results[0].provenance.paaAttempts?.map(({ runId }) => runId)).toEqual(['paa-1', 'paa-2']);
      const deep = (await researcher.inspect(scanned.results)).results[0];
      expect(deep.evidence.signals.peopleAlsoAsk).toEqual(initial);
      expect(new Set(deep.evidence.faqQuestions)).toEqual(new Set(initial));
      expect(deep.provenance.paaAttempts?.map(({ runId }) => runId)).toEqual(['paa-1', 'paa-2']);
    });

    it('uses sufficient observed SERP FAQs without starting the PAA collector', async () => {
      const initial = [...genericQuestions, checklistQuestion];
      const { researcher, requests } = boundary(initial, []);
      const scanned = await researcher.scan([candidate]);
      const deep = await researcher.inspect(scanned.results);
      expect(requests).toEqual([]);
      expect(deep.results[0].evidence.faqQuestions).toEqual([checklistQuestion, ...genericQuestions]);
      expect(deep.results[0].provenance.paa).toBeUndefined();
      expect(scanned.results[0].peopleAlsoAsk).toEqual(initial);
    });

    it.each([true, false])('ranks short video-topic questions but leaves semantic acceptance to preparation (recovers=%s)', async recovers => {
      const videoCandidate = { ...candidate, primaryKeyword: 'video marketing' };
      const initial = ['What is video marketing?', 'What is AI video marketing?', 'What is the 3-3-3 rule in marketing?'];
      const third = 'What are examples of video marketing?';
      const { researcher, requests } = boundary(initial, recovers ? [[third]] : [[initial[2]], [initial[2]]], videoCandidate);
      const scan = await researcher.scan([videoCandidate]);
      expect(requests).toHaveLength(recovers ? 1 : 2);
      if (!recovers) {
        const deep = (await researcher.inspect(scan.results)).results[0];
        expect(deep.evidence.faqQuestions).toEqual(initial);
        return;
      }
      const deep = (await researcher.inspect(scan.results)).results[0];
      expect(deep.evidence.faqQuestions).toEqual([...initial.slice(0, 2), third]);
      expect(scan.results[0].paaObservations?.find(q => q.question === third)).toMatchObject({ query: 'video marketing', runId: 'paa-1', datasetId: 'paa-data-1' });
    });

    it.each([false, true])('preserves the original how-to query and bounded FAQ recovery (needsRecovery=%s)', async (needsRecovery) => {
      const howToCandidate = { ...candidate, primaryKeyword: 'how to make a founder pitch video' };
      const questions = [
        'How do you plan a founder pitch video?',
        'What belongs in a founder pitch video?',
        'How long should a founder pitch video be?',
      ];
      const { researcher, requests } = boundary(
        needsRecovery ? questions.slice(0, 2) : questions,
        needsRecovery ? [[], [questions[2]]] : [],
        howToCandidate,
      );
      const scanned = await researcher.scan([howToCandidate]);
      expect(requests).toEqual(needsRecovery ? Array(2).fill({
        keywords: ['how to make a founder pitch video'], countryCode: 'us', languageCode: 'en', includeRelatedSearches: true,
      }) : []);
      const deep = (await researcher.inspect(scanned.results)).results[0];
      expect(deep.evidence.faqQuestions).toEqual(questions);
      expect(deep.evidence.serp.peopleAlsoAsk).toEqual(questions);
      expect(deep.provenance.serp.runId).toBe(SERP_ACTOR_ID);
      if (needsRecovery) {
        expect(deep.provenance.paaAttempts?.map(({ runId }) => runId)).toEqual(['paa-1', 'paa-2']);
        expect(scanned.results[0].paaObservations?.[0]).toMatchObject({
          query: 'how to make a founder pitch video', question: questions[2],
          actorId: PAA_ACTOR_ID, runId: 'paa-2', datasetId: 'paa-data-2', observedAt: '2026-09-04T08:01:00.000Z',
        });
      } else {
        expect(deep.provenance.paa).toBeUndefined();
      }
    });
  });

  it.each(['2026-09-03T08:01:00.000Z','2026-09-05T08:01:00.000Z'])('rejects fresh-run PAA rows with invalid freshness: %s', async(checkedAt)=>{
    const candidate={...candidates(1)[0],primaryKeyword:'demo day video checklist'};
    const questions=['What is a demo day?','How does yc demo day work?','Can anyone attend YC demo day?'];
    const client:ApifyClient={startActor:async(actor)=>successfulRun(actor,actor),getRun:async()=>{throw Error('unexpected');},abortRun:async(id)=>({id,status:'ABORTED'}),getDatasetItems:async(id)=>id===AUTOCOMPLETE_ACTOR_ID?[]:id===PAA_ACTOR_ID?questions.map((question,i)=>({record_type:'paa_question',keyword:candidate.primaryKeyword,question,position:i+1,country:'us',language:'en',checked_at:checkedAt})):[{searchQuery:{term:candidate.primaryKeyword,device:'DESKTOP',page:1,countryCode:'US',languageCode:'en'},organicResults:[{position:1,title:'Plan',url:'https://publisher.example/plan',description:'Planning'}],peopleAlsoAsk:[],relatedQueries:[]}]};
    const result=await createResearcher({apify:client,sourceChecker:{select:async()=>[]},execution:researchClock}).scan([candidate]);
    expect(result.results[0].peopleAlsoAsk).toEqual([]);
    expect(result.results[0].paaObservations).toEqual([]);
  });
  it('retains provenance for selected FAQs when the first collection fills the observation cap with unrelated questions', async()=>{
    const candidate={...candidates(1)[0],primaryKeyword:'demo day video checklist'};
    const questions=['What is a demo day?','How does yc demo day work?','Can anyone attend YC demo day?'];
    let calls=0;
    const client:ApifyClient={startActor:async(actor)=>{const id=actor===PAA_ACTOR_ID?`paa-${++calls}`:actor;return successfulRun(id,id);},getRun:async()=>{throw Error('unexpected');},abortRun:async(id)=>({id,status:'ABORTED'}),getDatasetItems:async(id)=>id===AUTOCOMPLETE_ACTOR_ID?[]:id.startsWith('paa-')?(id==='paa-1'?Array.from({length:30},(_,i)=>`What is unrelated accounting rule ${i}?`):questions).map((question,i)=>({record_type:'paa_question',keyword:candidate.primaryKeyword,question,position:i+1,country:'us',language:'en',checked_at:'2026-09-04T08:01:00.000Z'})):[{searchQuery:{term:candidate.primaryKeyword,device:'DESKTOP',page:1,countryCode:'US',languageCode:'en'},organicResults:[{position:1,title:'Plan',url:'https://publisher.example/plan',description:'Planning'}],peopleAlsoAsk:[],relatedQueries:[]}]};
    const result=await createResearcher({apify:client,sourceChecker:{select:async()=>[]},execution:researchClock}).scan([candidate]);
    const selected=selectRelevantPaaQuestions(candidate.primaryKeyword,result.results[0].peopleAlsoAsk);
    expect(selected).toEqual(questions);
    for(const question of selected) expect(result.results[0].paaObservations?.find(item=>item.question===question)).toMatchObject({runId:'paa-2',datasetId:'paa-2'});
    expect(result.results[0].paaObservations!.length).toBeLessThanOrEqual(30);
  });
  it.each([false,true])('automatically reuses only recent exact-query PAA observations (stale=%s)', async (stale) => {
    const candidate={...candidates(1)[0],primaryKeyword:'demo day video checklist'};
    const questions=['What is a demo day?','How does yc demo day work?','Can anyone attend YC demo day?'];
    const checkedAt=stale?'2026-09-04T06:00:00.000Z':'2026-09-04T08:01:00.000Z';
    const client:ApifyClient={
      startActor:async(actorId)=>successfulRun(actorId,actorId),
      getRun:async()=>{throw new Error('not needed');},abortRun:async(id)=>({id,status:'ABORTED'}),
      getRecentActorRuns:async()=>[{...successfulRun('prior-observation','prior-dataset'),finishedAt:checkedAt}],
      getDatasetItems:async(id)=>id===AUTOCOMPLETE_ACTOR_ID||id===PAA_ACTOR_ID?[]:id==='prior-dataset'
        ?questions.map((question,index)=>({record_type:'paa_question',keyword:candidate.primaryKeyword,question,position:index+1,country:'us',language:'en',checked_at:checkedAt}))
        :[{searchQuery:{term:candidate.primaryKeyword,device:'DESKTOP',page:1,countryCode:'US',languageCode:'en'},organicResults:[{position:1,title:'Planning',url:'https://publisher.example/planning',description:'Planning evidence.'}],peopleAlsoAsk:[],relatedQueries:[]}],
    };
    const result=await createResearcher({apify:client,sourceChecker:{select:async()=>[]},execution:{nowMs:()=>Date.parse('2026-09-04T08:15:00.000Z')}}).scan([candidate]);
    expect(result.results[0].peopleAlsoAsk).toEqual(stale?[]:questions);
    if(!stale){expect(result.results[0].paaCacheReused).toBe(true);expect(result.results[0].provenance.paa?.runId).toBe('prior-observation');expect(result.results[0].paaObservations?.[0].observedAt).toBe(checkedAt);}
  });
  it('retries an empty dynamic PAA response once and retains both collection IDs', async () => {
    const candidate={...candidates(1)[0],primaryKeyword:'demo day video checklist'};
    const questions=['What is a demo day?','How does yc demo day work?','Can anyone attend YC demo day?'];
    let paaRuns=0;
    const client:ApifyClient={
      startActor:async(actorId)=>{const id=actorId===PAA_ACTOR_ID?`paa-${++paaRuns}`:actorId;return successfulRun(id,id);},
      getRun:async()=>{throw new Error('not needed');},abortRun:async(id)=>({id,status:'ABORTED'}),
      getDatasetItems:async(id)=>id===AUTOCOMPLETE_ACTOR_ID||id==='paa-1'?[]:id==='paa-2'
        ?questions.map((question,index)=>({record_type:'paa_question',keyword:candidate.primaryKeyword,question,position:index+1,country:'us',language:'en',checked_at:'2026-09-04T08:01:00.000Z'}))
        :[{searchQuery:{term:candidate.primaryKeyword,device:'DESKTOP',page:1,countryCode:'US',languageCode:'en'},organicResults:[{position:1,title:'Planning',url:'https://publisher.example/planning',description:'Planning evidence.'}],peopleAlsoAsk:[],relatedQueries:[]}],
    };
    const result=await createResearcher({apify:client,sourceChecker:{select:async()=>[]},execution:researchClock}).scan([candidate]);
    expect(paaRuns).toBe(2);
    expect(result.results[0].peopleAlsoAsk).toEqual(questions);
    expect(result.results[0].provenance.paaAttempts?.map(({runId})=>runId)).toEqual(['paa-1','paa-2']);
  });
  it('preserves organic observations but records the missing evidence when the optional PAA collector fails', async () => {
    const candidate={...candidates(1)[0],primaryKeyword:'demo day video checklist'};
    const client:ApifyClient={
      startActor:async(actorId)=>{if(actorId===PAA_ACTOR_ID)throw new Error('temporary collector failure');return successfulRun(actorId,actorId);},
      getRun:async()=>{throw new Error('not needed');},abortRun:async(id)=>({id,status:'ABORTED'}),
      getDatasetItems:async(id)=>id===AUTOCOMPLETE_ACTOR_ID?[]:[{searchQuery:{term:candidate.primaryKeyword,device:'DESKTOP',page:1,countryCode:'US',languageCode:'en'},organicResults:[{position:1,title:'Planning',url:'https://publisher.example/planning',description:'Planning evidence.'}],peopleAlsoAsk:[],relatedQueries:[]}],
    };
    const result=await createResearcher({apify:client,sourceChecker:{select:async()=>[]},execution:researchClock}).scan([candidate]);
    expect(result.results[0].organicResults).toHaveLength(1);
    expect(result.results[0].peopleAlsoAsk).toEqual([]);
    expect(result.results[0].paaCollectionError).toContain('temporary collector failure');
    expect(()=>selectRelevantPaaQuestions(candidate.primaryKeyword,result.results[0].peopleAlsoAsk)).toThrow();
  });
  it('passes retrieved body documents to drafting and never falls back to reachability when body verification fails', async () => {
    const candidate={...candidates(1)[0],primaryKeyword:'demo day video checklist',title:'Demo Day Video Checklist: Record and Rehearse'};
    const source={originalUrl:'https://www.ycombinator.com/about',finalUrl:'https://www.ycombinator.com/about',authoritative:true};
    const doc={url:source.originalUrl,finalUrl:source.finalUrl,status:200,reachable:true,authoritative:true,checkedAt:'2026-09-04T08:02:00.000Z',contentType:'text/html',bodySha256:'a'.repeat(64),text:'The program ends with Demo Day.',passages:[{text:'The program ends with Demo Day.',start:0,end:31}]};
    const noIo=async()=>{throw new Error('Unexpected I/O');};
    let searches = 0;
    const client:ApifyClient={startActor:async (_actor, input) => {
      searches++;
      expect(String(input.queries)).toContain('demo day video site:descript.com/blog/article/');
      return successfulRun('scope-search', 'scope-dataset');
    },getRun:noIo,getDatasetItems:async()=>[],abortRun:noIo};
    const shallow={candidate,suggestions:[],organicResults:[{title:'YC',url:source.originalUrl,snippet:'Snippet must not be used.',resultType:'article'}],peopleAlsoAsk:['What is a demo day?','How does yc demo day work?','Can anyone attend YC demo day?'],relatedQueries:[],provenance:{discovery:{actorId:'a',runId:'a',datasetId:'a',observedAt:'2026-09-04T08:01:00.000Z'},serp:{actorId:'s',runId:'s',datasetId:'s',observedAt:'2026-09-04T08:01:00.000Z'}}};
    const result=await createResearcher({apify:client,sourceChecker:{select:noIo,selectWithContent:async()=>({sources:[source],sourceDocuments:[doc]})}}).inspect([shallow]);
    expect(result.results[0].sourceDocuments).toEqual([doc]);
    expect(searches).toBe(1); // Topic/authority success must not skip practitioner discovery.
    expect(result.results[0].provenance.supportSearches?.[0].runId).toBe('scope-search');
  });
  it('automatically discovers primary source URLs without counting them as target keyword competitors', async () => {
    const candidate={...candidates(1)[0],primaryKeyword:'demo day video checklist'};
    const faq=['What is a demo day?','How does yc demo day work?','Can anyone attend YC demo day?'];
    let sourceSearches=0;
    let supportInput: Record<string, unknown> | undefined;
    const client: ApifyClient = {
      startActor:async(actorId,input)=>{supportInput=input;expect(actorId).toBe(SERP_ACTOR_ID); const queries=String(input.queries).trim().split('\n');expect(queries).toHaveLength(2);expect(queries.every(q=>q.includes('site:ycombinator.com'))).toBe(true);sourceSearches++;return successfulRun('sources-run','sources-dataset');},
      getRun:async()=>{throw new Error('not needed');},abortRun:async(id)=>({id,status:'ABORTED'}),
      getDatasetItems:async()=>[candidate.primaryKeyword,faq[0]].map(question=>({searchQuery:{term:`${question} (site:ycombinator.com OR site:techstars.com OR site:techsmith.com/blog/ OR site:descript.com/blog/article/)`,device:'DESKTOP',page:1,countryCode:'US',languageCode:'en'},organicResults:[{position:1,title:'What Happens at YC',url:'https://www.ycombinator.com/about',description:'Demo day details.'}],peopleAlsoAsk:[],relatedQueries:[]})),
    };
    const result=await createResearcher({apify:client,sourceChecker:{select:async(urls)=>{
      if(!urls.includes('https://www.ycombinator.com/about')) throw new Error('No primary source');
      return [{originalUrl:'https://publisher.example/checklist',finalUrl:'https://publisher.example/checklist',authoritative:false},{originalUrl:'https://www.ycombinator.com/about',finalUrl:'https://www.ycombinator.com/about',authoritative:true}];
    }}}).inspect([{candidate,suggestions:[],organicResults:[{title:'Checklist',url:'https://publisher.example/checklist',snippet:'Plan video',resultType:'article'}],peopleAlsoAsk:faq,relatedQueries:[],provenance:{discovery:{actorId:'a',runId:'r',datasetId:'d',observedAt:'2026-09-04T08:01:00.000Z'},serp:{actorId:SERP_ACTOR_ID,runId:'original-run',datasetId:'original-dataset',observedAt:'2026-09-04T08:01:00.000Z'}}}]);
    expect(sourceSearches).toBe(1);
    expect(supportInput).toMatchObject({ countryCode: 'us', languageCode: 'en', mobileResults: false });
    expect(supportInput).not.toHaveProperty('searchLanguage');
    expect(result.results[0].evidence.serp.organicResultCount).toBe(1);
    expect(result.results[0].evidence.sources).toHaveLength(2);
    expect(result.results[0].provenance.supportSearches?.[0].runId).toBe('sources-run');
  });
  it('retrieves scoped practitioner bodies discovered by exact US/en support searches, rejecting unrelated rows', async () => {
    const candidate = { ...candidates(1)[0], primaryKeyword: 'product demo checklist', title: 'Product Demo Checklist: Plan, Record and Rehearse' };
    const faq = ['How to structure a product demo?', 'When starting a product demo, what should you do first?', 'Can you give me an example of a product demo?'];
    const queries = [
      'product demo site:ycombinator.com', 'product demo site:techstars.com',
      'product demo site:techsmith.com/blog/', 'product demo site:descript.com/blog/article/',
      ...faq,
    ];
    const good = ['https://www.techsmith.com/blog/demo/', 'https://independent.example/guide'];
    const requested: string[] = [];
    const checker = createSafeSourceChecker({
      authorityPolicies: PRODUCTION_SOURCE_AUTHORITY_POLICIES,
      resolveHostname: async () => ['93.184.216.34'],
      transport: async request => {
        requested.push(request.url);
        const body = good.includes(request.url)
          ? '<article><p>A product demo explains a customer task through a recorded walkthrough.</p></article>'
          : '<article><p>The accelerator cohort attends a networking event before fundraising season.</p></article>';
        return { status: 200, headers: { 'content-type': 'text/html' }, url: request.url,
          redirected: false, peerAddress: request.allowedPeerAddresses[0],
          body: (async function* () { yield new TextEncoder().encode(body); })() };
      },
    });
    const row = (term: string, url: string, countryCode = 'US', languageCode = 'en') => ({
      searchQuery: { term, countryCode, languageCode, device: 'DESKTOP', page: 1 },
      organicResults: [{ position: 1, title: 'Guide', url, description: 'Snippet is not evidence.' }],
    });
    const client: ApifyClient = {
      startActor: async (actor, input) => {
        expect(actor).toBe(SERP_ACTOR_ID);
        expect(input.queries).toBe(`${queries.join('\n')}\n`);
        return successfulRun('support', 'support-dataset');
      },
      getRun: async () => { throw new Error('Already complete'); },
      abortRun: async id => ({ id, status: 'ABORTED' }),
      getDatasetItems: async () => [
        row(queries[0], good[0]),
        row(faq[1], good[1]), // A supporting page found only by an observed FAQ.
        row('unrequested query', 'https://www.techsmith.com/blog/wrong-query/'),
        row(queries[0], 'https://independent.example/not-the-publisher-query'),
        row(faq[1], 'http://127.0.0.1/private'),
        row(faq[1], 'https://127.0.0.1/private'),
        row(faq[1], 'https://user:password@independent.example/credentials'),
        row(queries[0], 'https://www.descript.com/blog/article-spoof/outside'),
        row(queries[0], 'https://www.techsmith.com.evil.example/blog/spoof/'),
      ],
    };
    const result = await createResearcher({ apify: client, sourceChecker: checker, execution: researchClock }).inspect([{
      candidate, suggestions: [], relatedQueries: [], peopleAlsoAsk: faq,
      organicResults: [{ title: 'Launch guide', url: 'https://publisher.example/launch', snippet: 'Not a verified fact.', resultType: 'article' }],
      provenance: { discovery: { actorId: 'a', runId: 'a', datasetId: 'a', observedAt: '2026-09-04T08:01:00.000Z' },
        serp: { actorId: SERP_ACTOR_ID, runId: 'original', datasetId: 'original-dataset', observedAt: '2026-09-04T08:01:00.000Z' } },
    }]);
    expect(result.results[0].evidence.sources.map(source => source.finalUrl)).toEqual(good);
    expect(result.results[0].sourceDocuments?.every(document => document.passages.length > 0)).toBe(true);
    expect(result.results[0].evidence.sources.map(source => source.authoritative)).toEqual([true, false]);
    expect(result.results[0].evidence.serp.organicResultCount).toBe(1);
    expect(result.results[0].provenance.serp.runId).toBe('original');
    expect(result.results[0].provenance.supportSearches?.[0].runId).toBe('support');
    expect([...new Set(requested)]).toEqual(['https://publisher.example/launch', ...good]);
  });
  it('reserves source inspection slots for later publishers when the organic and first support sets are full', async () => {
    const candidate = { ...candidates(1)[0], primaryKeyword: 'product demo checklist', title: 'Product Demo Checklist: Plan, Record and Rehearse' };
    const questions = ['How to structure a product demo?', 'When starting a product demo, what should you do first?', 'Can you give me an example of a product demo?'];
    const organic = Array.from({ length: 20 }, (_, i) => ({ title: 'Demo', url: `https://publisher.example/demo-${i}`, snippet: 'Snippet', resultType: 'article' }));
    let queries: string[] = [];
    let fetched: string[] = [];
    const client: ApifyClient = {
      startActor: async (_actor, input) => { queries = String(input.queries).trim().split('\n'); return successfulRun('scope', 'scope-data'); },
      getRun: async () => { throw new Error('Already complete'); }, abortRun: async id => ({ id, status: 'ABORTED' }),
      getDatasetItems: async () => queries.map((term, group) => ({
        searchQuery: { term, device: 'DESKTOP', page: 1, countryCode: 'US', languageCode: 'en' },
        organicResults: Array.from({ length: 10 }, (_, i) => ({ position: i + 1, title: 'Guide', description: 'Snippet',
          url: group ? `https://www.descript.com/blog/article/record-${i}` : `https://www.ycombinator.com/companies/demo-${i}` })),
      })),
    };
    const result = await createResearcher({ apify: client, sourceChecker: {
      select: async () => { throw new Error('Body verification required'); },
      selectWithContent: async urls => {
        fetched = urls;
        if (!urls.includes('https://www.descript.com/blog/article/record-0')) throw new Error('Recording sources crowded out');
        return { sources: urls.slice(0, 2).map(url => ({ originalUrl: url, finalUrl: url, authoritative: true })), sourceDocuments: [] };
      },
    }, execution: researchClock }).inspect([{ candidate, suggestions: [], relatedQueries: [], peopleAlsoAsk: questions, organicResults: organic,
      provenance: { discovery: { actorId: 'a', runId: 'a', datasetId: 'a', observedAt: '2026-09-04T08:01:00.000Z' },
        serp: { actorId: SERP_ACTOR_ID, runId: 'original', datasetId: 'original-data', observedAt: '2026-09-04T08:01:00.000Z' } } }]);
    expect(fetched).toHaveLength(24);
    expect(fetched.slice(0, 3)).toEqual(['https://publisher.example/demo-0', 'https://www.ycombinator.com/companies/demo-0', 'https://www.descript.com/blog/article/record-0']);
    expect(result.results[0].evidence.serp.organicResultCount).toBe(20);
  });
  it.each([true, false])('uses only observed, topic-relevant body-supported FAQ alternatives; coverage available: %s', async supportedAlternative => {
    const candidate = {...candidates(1)[0], primaryKeyword: 'how to make a tutorial video', title: 'How to Make a Tutorial Video for Your Product'};
    const questions = ['How to do tutorial video?', 'What is a tutorial video called?', 'How do I record my screen for a tutorial video?',
      'What is a tutorial video?', 'What is a marketing campaign?'];
    const urls = ['https://www.descript.com/blog/article/tutorial', 'https://independent.example/tutorial'];
    const bodies = [
      '<article><section><p>To do a tutorial video, choose one task and prepare a clear example.</p></section><section><h2>Record your tutorial video</h2><p>Click Screen Recording. Select the application window.</p></section></article>',
      '<article><section><p>A tutorial video can demonstrate a customer task using a sequence of recorded steps.</p></section>'
        + (supportedAlternative ? '<section><p>A tutorial video is a recording that teaches one task through a sequence of visible actions.</p></section>' : '')
        + '<section><p>A marketing campaign is a coordinated sequence of promotional activities for a defined audience.</p></section></article>',
    ];
    const checker = createSafeSourceChecker({authorityPolicies: PRODUCTION_SOURCE_AUTHORITY_POLICIES,
      resolveHostname: async () => ['93.184.216.34'], transport: async request => ({
        status: 200, headers: {'content-type': 'text/html'}, url: request.url, redirected: false,
        peerAddress: request.allowedPeerAddresses[0], body: (async function* () {yield new TextEncoder().encode(bodies[urls.indexOf(request.url)]);})(),
      })});
    let starts = 0;
    const apify: ApifyClient = {startActor: async (_actor, input) => {starts++; expect(String(input.queries).trim().split('\n')).toHaveLength(7); return successfulRun('support', 'support-data');},
      getRun: async () => {throw Error('Already complete');}, getDatasetItems: async () => [], abortRun: async id => ({id, status: 'ABORTED'})};
    const shallow = {candidate, suggestions: [], relatedQueries: [], peopleAlsoAsk: questions,
      organicResults: urls.map(url => ({title: 'Tutorial guide', url, snippet: 'Not evidence.', resultType: 'article'})),
      provenance: {discovery: {actorId: 'a', runId: 'a', datasetId: 'a', observedAt: '2026-09-04T08:01:00.000Z'},
        serp: {actorId: SERP_ACTOR_ID, runId: 'original', datasetId: 'original-data', observedAt: '2026-09-04T08:01:00.000Z'}}};
    const before = JSON.stringify(shallow);
    const result = (await createResearcher({apify, sourceChecker: checker, execution: researchClock}).inspect([shallow])).results[0];
    // Retrieving a matching passage does not constitute semantic FAQ approval.
    expect(result.evidence.faqQuestions).toEqual(questions.slice(0, 3));
    expect(result.evidence.signals.peopleAlsoAsk).toEqual(questions);
    expect(result.provenance.serp.runId).toBe('original');
    expect(starts).toBe(1);
    expect(JSON.stringify(shallow)).toBe(before);
  });
  it('recovers exact-query questions through one dedicated collection and keeps separate provenance', async () => {
    const candidate = {...candidates(1)[0],primaryKeyword:'demo day video checklist'};
    const questions=['What is a demo day?', 'How does yc demo day work?', 'Can anyone attend YC demo day?'];
    let starts=0;
    const client: ApifyClient = {
      async startActor(actorId, input) {
        starts++;
        if(actorId===PAA_ACTOR_ID) expect(input).toEqual({keywords:[candidate.primaryKeyword],countryCode:'us',languageCode:'en',includeRelatedSearches:true});
        return successfulRun(actorId,actorId);
      },
      getRun:async()=>{throw new Error('not needed');}, abortRun:async(id)=>({id,status:'ABORTED'}),
      getDatasetItems:async(id)=> id===AUTOCOMPLETE_ACTOR_ID ? [] : id===PAA_ACTOR_ID
        ? questions.map((question,index)=>({record_type:'paa_question',keyword:candidate.primaryKeyword,question,position:index+1,country:'us',language:'en',checked_at:'2026-09-04T08:01:00.000Z'}))
        : [{searchQuery:{term:candidate.primaryKeyword,device:'DESKTOP',page:1,countryCode:'US',languageCode:'en'},organicResults:[{position:1,title:'Video planning',url:'https://publisher.example/checklist',description:'Plan a video.'}],peopleAlsoAsk:[],relatedQueries:[]}],
    };
    const result=await createResearcher({apify:client,sourceChecker:{select:async()=>[]},execution:researchClock}).scan([candidate]);
    expect(starts).toBe(3);
    expect(result.results[0].peopleAlsoAsk).toEqual(questions);
    expect(result.results[0].provenance.serp.runId).toBe(SERP_ACTOR_ID);
    expect(result.results[0].provenance.paa?.runId).toBe(PAA_ACTOR_ID);
    expect(result.results[0].paaObservations?.map(({query})=>query)).toEqual(Array(3).fill(candidate.primaryKeyword));
  });
});

function candidates(count: number): Candidate[] {
  return Array.from({ length: count }, (_, index) => CandidateSchema.parse({
    schemaVersion: 1,
    articleId: `vc-c1-${String(index + 1).padStart(3, '0')}`,
    campaignId: 'newly-funded-founder',
    icp: 'newly-funded-founder',
    primaryKeyword: `founder video topic ${index + 1}`,
    secondaryKeywords: [],
    title: `Founder video topic ${index + 1}`,
    slug: `founder-video-topic-${index + 1}`,
    intent: 'informational',
    funnelStage: 'top',
  }));
}

function successfulRun(id: string, datasetId: string): ApifyRun {
  return {
    id,
    status: 'SUCCEEDED',
    defaultDatasetId: datasetId,
    finishedAt: '2026-09-04T08:01:00.000Z',
  };
}

function delayed<T>(milliseconds: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), milliseconds));
}

describe('bounded Apify execution', () => {
  it('allows a valid 117-second live-sized batch under the default polling budget', async () => {
    let elapsed = 0;
    const client: ApifyClient = {
      startActor: async () => ({ id: 'live-sized-run', status: 'RUNNING' }),
      getRun: async () => elapsed < 117_000
        ? { id: 'live-sized-run', status: 'RUNNING' }
        : successfulRun('live-sized-run', 'complete-dataset'),
      getDatasetItems: async () => [{ query: 'founder video' }],
      abortRun: async (id) => ({ id, status: 'ABORTING' }),
    };
    const result = await runApifyActor(client, SERP_ACTOR_ID, {}, {
      nowMs: () => elapsed,
      sleep: async (milliseconds) => { elapsed += milliseconds; },
    });
    expect(result.items).toEqual([{ query: 'founder video' }]);
    expect(result.provenance.runId).toBe('live-sized-run');
    expect(elapsed).toBeGreaterThanOrEqual(117_000);
  });

  it('times out a hanging startActor dependency', async () => {
    const client: ApifyClient = {
      startActor: async () => delayed(25, successfulRun('run-123', 'dataset-456')),
      getRun: async () => { throw new Error('not used'); },
      getDatasetItems: async () => [],
      abortRun: async (runId) => ({ id: runId, status: 'ABORTING' }),
    };

    await expect(runApifyActor(client, SERP_ACTOR_ID, {}, {
      timeoutMs: 5,
      maxAttempts: 1,
    })).rejects.toThrow(/timed out.*start/i);
  });

  it('times out a hanging getRun poll dependency', async () => {
    const client: ApifyClient = {
      startActor: async () => ({ id: 'run-123', status: 'RUNNING' }),
      getRun: async () => delayed(25, successfulRun('run-123', 'dataset-456')),
      getDatasetItems: async () => [],
      abortRun: async (runId) => ({ id: runId, status: 'ABORTING' }),
    };

    await expect(runApifyActor(client, SERP_ACTOR_ID, {}, {
      timeoutMs: 5,
      maxAttempts: 1,
      pollIntervalMs: 0,
      sleep: async () => undefined,
    })).rejects.toThrow(/timed out.*poll/i);
  });

  it('times out a hanging polling sleep dependency', async () => {
    const client: ApifyClient = {
      startActor: async () => ({ id: 'run-123', status: 'RUNNING' }),
      getRun: async () => successfulRun('run-123', 'dataset-456'),
      getDatasetItems: async () => [],
      abortRun: async (runId) => ({ id: runId, status: 'ABORTING' }),
    };

    await expect(runApifyActor(client, SERP_ACTOR_ID, {}, {
      timeoutMs: 5,
      maxAttempts: 1,
      pollIntervalMs: 1,
      sleep: async () => delayed(25, undefined),
    })).rejects.toThrow(/timed out.*sleep/i);
  });

  it('times out a hanging dataset dependency', async () => {
    const client: ApifyClient = {
      startActor: async () => successfulRun('run-123', 'dataset-456'),
      getRun: async () => { throw new Error('not used'); },
      getDatasetItems: async () => delayed(25, []),
      abortRun: async (runId) => ({ id: runId, status: 'ABORTING' }),
    };

    await expect(runApifyActor(client, SERP_ACTOR_ID, {}, {
      timeoutMs: 5,
      maxAttempts: 1,
    })).rejects.toThrow(/timed out.*dataset/i);
  });

  it('bounds polling, retries transient reads, and preserves exact run/dataset provenance', async () => {
    let pollAttempts = 0;
    let elapsed = 0;
    const client: ApifyClient = {
      startActor: async () => ({ id: 'run-123', status: 'RUNNING' }),
      getRun: async () => {
        pollAttempts += 1;
        if (pollAttempts === 1) throw new Error('temporary read failure');
        if (pollAttempts === 2) return { id: 'run-123', status: 'RUNNING' };
        return successfulRun('run-123', 'dataset-456');
      },
      getDatasetItems: async () => [{ observed: true }],
      abortRun: async (runId) => ({ id: runId, status: 'ABORTING' }),
    };

    const result = await runApifyActor(client, SERP_ACTOR_ID, { queries: 'topic\n' }, {
      maxPolls: 3,
      maxAttempts: 2,
      pollIntervalMs: 10,
      timeoutMs: 100,
      nowMs: () => elapsed,
      sleep: async (milliseconds) => { elapsed += milliseconds; },
    });

    expect(pollAttempts).toBe(3);
    expect(result).toEqual({
      items: [{ observed: true }],
      provenance: {
        actorId: SERP_ACTOR_ID,
        runId: 'run-123',
        datasetId: 'dataset-456',
        observedAt: '2026-09-04T08:01:00.000Z',
      },
    });
  });

  it('stops at the polling bound and redacts recognizable tokens', async () => {
    let elapsed = 0;
    const client: ApifyClient = {
      startActor: async () => ({ id: 'run-secret', status: 'RUNNING' }),
      getRun: async () => ({ id: 'run-secret', status: 'RUNNING' }),
      getDatasetItems: async () => [],
      abortRun: async (runId) => ({ id: runId, status: 'ABORTING' }),
    };

    await expect(runApifyActor(client, AUTOCOMPLETE_ACTOR_ID, {}, {
      maxPolls: 2,
      maxAttempts: 1,
      pollIntervalMs: 10,
      timeoutMs: 100,
      nowMs: () => elapsed,
      sleep: async (milliseconds) => { elapsed += milliseconds; },
    })).rejects.toThrow(/polling limit/i);

    const failingClient: ApifyClient = {
      ...client,
      startActor: async () => {
        throw new Error(`failed with ${['apify', 'api', 'fake', 'private'].join('_')}`);
      },
    };
    await expect(runApifyActor(failingClient, AUTOCOMPLETE_ACTOR_ID, {}))
      .rejects.toThrow(/\[REDACTED\]/);
  });
});

describe('staged researcher', () => {
  it.each(['video marketing', 'video marketing for startups'])('does not reduce %s FAQs to generic marketing questions', keyword => {
    const observed = ['What is video marketing?', 'What is AI video marketing?', 'What is the 3-3-3 rule in marketing?', 'What are 7 types of digital marketing?'];
    expect(() => selectRelevantPaaQuestions(keyword, observed)).toThrow(/three relevant/i);
    const recovered = [...observed, 'What are examples of video marketing?'];
    expect(selectRelevantPaaQuestions(keyword, recovered)).toEqual([observed[0], observed[1], recovered[4]]);
  });

  it('retains the medium for short video-editing topics without requiring singular wording', () => {
    const questions = ['What is editing?', 'How do you start editing videos?', 'What software helps with video editing?', 'What is a video editing workflow?'];
    expect(selectRelevantPaaQuestions('video editing', questions)).toEqual(questions.slice(1));
  });

  it('scans at most 50 and directly stages at most 10 US/en desktop first-page inspections', async () => {
    const starts: Array<{ actorId: string; input: Record<string, unknown> }> = [];
    const autocompleteItems = candidates(50).map((candidate) => ({
      keyword: candidate.primaryKeyword,
      suggestion: `${candidate.primaryKeyword} guide`,
      parentKeyword: null,
      depth: 0,
      country: 'us',
      language: 'en',
      scrapedAt: '2026-09-04T08:00:00.000Z',
    }));
    const serpItems = candidates(50).map((candidate, index) => ({
      searchQuery: {
        term: candidate.primaryKeyword,
        device: 'DESKTOP',
        page: 1,
        countryCode: 'US',
        languageCode: 'en',
      },
      organicResults: [
        {
          position: 1,
          title: `${candidate.title} primary source`,
          url: `https://authority.example/topic-${index + 1}`,
          description: 'Primary source.',
        },
        {
          position: 2,
          title: `${candidate.title} guide`,
          url: `https://publisher.example/topic-${index + 1}`,
          description: 'Independent guide.',
        },
        ...(index === 49 ? Array.from({ length: 8 }, (_unused, extra) => ({
          position: extra + 3,
          title: `${candidate.title} result ${extra + 3}`,
          url: `https://publisher.example/topic-${index + 1}-${extra + 3}`,
          description: 'Independent guide.',
        })) : []),
      ],
      peopleAlsoAsk: [
        `What is founder video topic ${index + 1}?`,
        `How do you plan founder video topic ${index + 1}?`,
        `Why does founder video topic ${index + 1} matter?`,
        'What is an unrelated accounting rule?',
      ],
      relatedQueries: [],
    }));
    const client: ApifyClient = {
      startActor: async (actorId, input) => {
        starts.push({ actorId, input });
        return actorId === AUTOCOMPLETE_ACTOR_ID
          ? successfulRun('autocomplete-run', 'autocomplete-dataset')
          : successfulRun('serp-run', 'serp-dataset');
      },
      getRun: async () => { throw new Error('Already complete'); },
      getDatasetItems: async (datasetId) =>
        datasetId === 'autocomplete-dataset' ? autocompleteItems : serpItems,
      abortRun: async (runId) => ({ id: runId, status: 'ABORTING' }),
    };
    const researcher = createResearcher({
      apify: client,
      sourceChecker: {
        select: async (urls) => urls.map((url, index) => ({
          originalUrl: url,
          finalUrl: url,
          authoritative: index === 0,
        })),
      },
    });

    const result = await researcher.research(candidates(55));

    expect(result.scannedCount).toBe(50);
    expect(result.deepInspectionCount).toBe(10);
    expect(result.results).toHaveLength(10);
    expect(starts[0]).toMatchObject({
      actorId: AUTOCOMPLETE_ACTOR_ID,
      // The 50-candidate shallow stage must not expand into 1,350 paid queries.
      input: { country: 'us', language: 'en', maxRequestRetries: 3, maxDepth: 1, appendAlphabet: false },
    });
    expect((starts[0].input.keywords as string[])).toHaveLength(50);
    expect(starts[1]).toMatchObject({
      actorId: SERP_ACTOR_ID,
      input: {
        maxPagesPerQuery: 1,
        countryCode: 'us',
        languageCode: 'en',
        mobileResults: false,
        saveHtml: false,
        saveHtmlToKeyValueStore: false,
      },
    });
    expect((starts[1].input.queries as string).trim().split('\n')).toHaveLength(50);
    expect(result.results.some(({ candidate }) => candidate.articleId === 'vc-c1-050')).toBe(true);
    expect(result.results.every(({ evidence }) => EvidenceBundleSchema.safeParse(evidence).success))
      .toBe(true);
    expect(result.results[0].provenance).toEqual({
      discovery: {
        actorId: AUTOCOMPLETE_ACTOR_ID,
        runId: 'autocomplete-run',
        datasetId: 'autocomplete-dataset',
        observedAt: '2026-09-04T08:01:00.000Z',
      },
      serp: {
        actorId: SERP_ACTOR_ID,
        runId: 'serp-run',
        datasetId: 'serp-dataset',
        observedAt: '2026-09-04T08:01:00.000Z',
      },
    });
  });

  it('requires three deduplicated questions relevant to the candidate keyword', () => {
    expect(selectRelevantPaaQuestions('demo day video checklist', [
      'What belongs in a demo day checklist?',
      'How long should a demo day video be?',
      'How do founders plan a demo day video?',
      'HOW DO FOUNDERS PLAN A DEMO DAY VIDEO?',
      'What are payroll tax deadlines?',
    ])).toEqual([
      'What belongs in a demo day checklist?',
      'How long should a demo day video be?',
      'How do founders plan a demo day video?',
    ]);
    expect(() => selectRelevantPaaQuestions('demo day video checklist', [
      'What belongs in a demo day checklist?',
      'What are payroll tax deadlines?',
      'How is a corporation registered?',
    ])).toThrow(/three relevant/i);
  });

  it('rejects the observed product-launch checklist FAQ while retaining generic product-demo questions', () => {
    expect(selectRelevantPaaQuestions('product demo checklist', [
      'What are the steps involved in a product launch checklist?',
      'What is a product demo?',
      'When starting a product demo, what should you do first?',
      'How do you prepare a product demo?',
    ])).toEqual([
      'What is a product demo?',
      'When starting a product demo, what should you do first?',
      'How do you prepare a product demo?',
    ]);
  });

  it.each(['workflow', 'workflows', 'process', 'processes', 'plan', 'plans', 'planning'])(
    'retains the existing founder-pitch FAQ triplet when the keyword ends in %s', (modifier) => {
      const questions = [
        'How do you plan a founder pitch video?',
        'What belongs in a founder pitch video?',
        'How long should a founder pitch video be?',
      ];
      expect(selectRelevantPaaQuestions(`founder pitch video ${modifier}`, questions)).toEqual(questions);
    },
  );

  it.each(['make', 'create'])('retains founder-pitch FAQs without the leading how-to-%s framing', (verb) => {
    const questions = [
      'How do you plan a founder pitch video?',
      'What belongs in a founder pitch video?',
      'How long should a founder pitch video be?',
    ];
    expect(selectRelevantPaaQuestions(`how to ${verb} a founder pitch video`, questions)).toEqual(questions);
  });

  it.each([
    {
      keyword: 'how to make a product demo checklist',
      questions: ['What is a product demo?', 'How do you prepare a product demo?', 'How do you make a product launch checklist?'],
    },
    {
      keyword: 'how to create a product launch video',
      questions: ['What is a product launch video?', 'How do you plan a product launch video?', 'How do you create a product demo video?'],
    },
    {
      keyword: 'how to create a customer onboarding email',
      questions: ['What is a customer onboarding email?', 'When do you send a customer onboarding email?', 'How do you create a customer retention email?'],
    },
    {
      keyword: 'how to make a product demo recording process',
      questions: ['What is the product demo recording process?', 'Who manages the product demo recording process?', 'How do you make a product demo editing process?'],
    },
    {
      keyword: 'how to record a founder pitch video',
      questions: ['How do you record a founder pitch video?', 'Where do you record a founder pitch video?', 'How long should a founder pitch video be?'],
    },
    {
      keyword: 'make a founder pitch video',
      questions: ['How do you make a founder pitch video?', 'Why make a founder pitch video?', 'How long should a founder pitch video be?'],
    },
  ])('does not erase essential terms or verbs outside the supported framing in $keyword', ({ keyword, questions }) => {
    expect(() => selectRelevantPaaQuestions(keyword, questions)).toThrow(/three relevant/i);
  });

  it('retains the existing Demo Day planning-checklist FAQ triplet', () => {
    const questions = [
      'What should a Demo Day video include?',
      'How long should a Demo Day video be?',
      'How do you prepare for Demo Day?',
    ];
    expect(selectRelevantPaaQuestions('Demo Day video planning checklist', questions)).toEqual(questions);
  });

  it('inspects founder-pitch workflow evidence using exact generic topic FAQs and ranks an observed workflow FAQ first', async () => {
    const candidate = { ...candidates(1)[0], primaryKeyword: 'founder pitch video workflow' };
    const genericQuestions = [
      'How do you plan a founder pitch video?',
      'What belongs in a founder pitch video?',
      'How long should a founder pitch video be?',
    ];
    const workflowQuestion = 'Who reviews the founder pitch video workflow?';
    const noIo = async () => { throw new Error('Unexpected I/O'); };
    const researcher = createResearcher({
      apify: { startActor: noIo, getRun: noIo, getDatasetItems: noIo, abortRun: noIo },
      sourceChecker: { select: async () => [] },
    });
    const provenance = {
      discovery: { actorId: 'autocomplete', runId: 'discovery', datasetId: 'discovery-data', observedAt: '2026-09-04T08:01:00.000Z' },
      serp: { actorId: SERP_ACTOR_ID, runId: 'serp', datasetId: 'serp-data', observedAt: '2026-09-04T08:01:00.000Z' },
    };
    for (const questions of [genericQuestions, [...genericQuestions, workflowQuestion]]) {
      const result = await researcher.inspect([{
        candidate, suggestions: [], organicResults: [], peopleAlsoAsk: questions, relatedQueries: [], provenance,
      }]);
      expect(result.results[0].evidence.faqQuestions).toEqual(questions.length === 3
        ? genericQuestions : [workflowQuestion, ...genericQuestions.slice(0, 2)]);
      expect(result.results[0].evidence.signals.peopleAlsoAsk).toEqual(questions);
      expect(result.results[0].provenance).toEqual(provenance);
    }
  });

  it.each([
    {
      keyword: 'product demo workflow',
      questions: ['What is a product demo?', 'How do you prepare a product demo?', 'What belongs in a product launch workflow?'],
    },
    {
      keyword: 'customer onboarding email process',
      questions: ['What is a customer onboarding email?', 'When do you send a customer onboarding email?', 'What belongs in a customer retention email process?'],
    },
    {
      keyword: 'business process automation checklist',
      questions: ['What is business process automation?', 'How do you implement business process automation?', 'What belongs in a business automation checklist?'],
    },
    {
      keyword: 'workflow automation checklist',
      questions: ['What is workflow automation?', 'How do you implement workflow automation?', 'What belongs in a marketing automation checklist?'],
    },
  ])('keeps substantive topic terms required in $keyword', ({ keyword, questions }) => {
    expect(() => selectRelevantPaaQuestions(keyword, questions)).toThrow(/three relevant/i);
  });

  it('ranks stronger observed FAQs ahead of generic topic questions without rewriting or duplicating them', () => {
    const questions = [
      'What is a product demo?',
      'When starting a product demo, what should you do first?',
      'How do you prepare a product demo?',
      'What should a Product Demo checklist include?',
      'WHAT SHOULD A PRODUCT DEMO CHECKLIST INCLUDE?',
      'Who reviews a product-demo checklist?',
    ];
    const original = [...questions];
    expect(selectRelevantPaaQuestions('product demo checklist', questions)).toEqual([
      'What should a Product Demo checklist include?',
      'Who reviews a product-demo checklist?',
      'What is a product demo?',
    ]);
    expect(questions).toEqual(original);
  });

  it.each([
    ['product demo checklist', 'What are the steps involved in a product launch checklist?'],
    ['product demo guide', 'What belongs in a product launch guide?'],
    ['product demo template', 'What belongs in a product launch template?'],
    ['product demo examples', 'Where can I find product launch examples?'],
  ])('does not let format words replace a missing topic term for %s', (keyword, adjacentQuestion) => {
    expect(() => selectRelevantPaaQuestions(keyword, [
      'What is a product demo?',
      'When starting a product demo, what should you do first?',
      adjacentQuestion,
      'WHAT IS A PRODUCT DEMO?',
    ])).toThrow(/three relevant/i);
  });

  it('rejects adjacent topics beyond product demos even with two or more matching words', () => {
    expect(selectRelevantPaaQuestions('customer onboarding email checklist', [
      'What belongs in a customer retention email checklist?',
      'What is a customer onboarding email?',
      'How do you write a customer onboarding email?',
      'When do you send a customer onboarding email?',
    ])).toEqual([
      'What is a customer onboarding email?',
      'How do you write a customer onboarding email?',
      'When do you send a customer onboarding email?',
    ]);
  });

  it('does not count a format-only keyword or weaken the existing overlap minimum', () => {
    expect(() => selectRelevantPaaQuestions('video checklist', [
      'What is a checklist?', 'Who uses a checklist?', 'How do you write a checklist?',
    ])).toThrow(/three relevant/i);
    expect(() => selectRelevantPaaQuestions('demo checklist', [
      'What is a demo?', 'Who presents a demo?', 'How do you prepare a demo?',
    ])).toThrow(/three relevant/i);
  });

  it('rejects questions whose only overlap is a generic video or startup token', () => {
    expect(() => selectRelevantPaaQuestions('startup product demo video', [
      'Which video codec is best for archival footage?',
      'How does a startup register for payroll tax?',
      'Why is video compression useful for television?',
      'What product demo evidence should a buyer review?',
    ])).toThrow(/three relevant/i);
  });
});
