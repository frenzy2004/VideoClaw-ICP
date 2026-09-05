import { describe, expect, it } from 'vitest';

import { CandidateSchema, EvidenceBundleSchema, type Candidate } from './domain';
import {
  AUTOCOMPLETE_ACTOR_ID,
  SERP_ACTOR_ID,
  createResearcher,
  runApifyActor,
  selectRelevantPaaQuestions,
} from './research';
import type { ApifyClient, ApifyRun } from './apify-client';
import { PAA_ACTOR_ID } from './paa';
const researchClock={nowMs:()=>Date.parse('2026-09-04T08:15:00.000Z')};

describe('missing PAA collector recovery', () => {
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
    const candidate={...candidates(1)[0],primaryKeyword:'demo day video checklist'};
    const source={originalUrl:'https://www.ycombinator.com/about',finalUrl:'https://www.ycombinator.com/about',authoritative:true};
    const doc={url:source.originalUrl,finalUrl:source.finalUrl,status:200,reachable:true,authoritative:true,checkedAt:'2026-09-04T08:02:00.000Z',contentType:'text/html',bodySha256:'a'.repeat(64),text:'The program ends with Demo Day.',passages:[{text:'The program ends with Demo Day.',start:0,end:31}]};
    const noIo=async()=>{throw new Error('Unexpected I/O');};
    const client:ApifyClient={startActor:noIo,getRun:noIo,getDatasetItems:noIo,abortRun:noIo};
    const shallow={candidate,suggestions:[],organicResults:[{title:'YC',url:source.originalUrl,snippet:'Snippet must not be used.',resultType:'article'}],peopleAlsoAsk:['What is a demo day?','How does yc demo day work?','Can anyone attend YC demo day?'],relatedQueries:[],provenance:{discovery:{actorId:'a',runId:'a',datasetId:'a',observedAt:'2026-09-04T08:01:00.000Z'},serp:{actorId:'s',runId:'s',datasetId:'s',observedAt:'2026-09-04T08:01:00.000Z'}}};
    const result=await createResearcher({apify:client,sourceChecker:{select:noIo,selectWithContent:async()=>({sources:[source],sourceDocuments:[doc]})}}).inspect([shallow]);
    expect(result.results[0].sourceDocuments).toEqual([doc]);
  });
  it('automatically discovers primary source URLs without counting them as target keyword competitors', async () => {
    const candidate={...candidates(1)[0],primaryKeyword:'demo day video checklist'};
    const faq=['What is a demo day?','How does yc demo day work?','Can anyone attend YC demo day?'];
    let sourceSearches=0;
    const client: ApifyClient = {
      startActor:async(actorId,input)=>{expect(actorId).toBe(SERP_ACTOR_ID); const queries=String(input.queries).trim().split('\n');expect(queries).toHaveLength(2);expect(queries.every(q=>q.includes('site:ycombinator.com'))).toBe(true);sourceSearches++;return successfulRun('sources-run','sources-dataset');},
      getRun:async()=>{throw new Error('not needed');},abortRun:async(id)=>({id,status:'ABORTED'}),
      getDatasetItems:async()=>faq.slice(0,2).map(question=>({searchQuery:{term:`${question} (site:ycombinator.com OR site:techstars.com)`,device:'DESKTOP',page:1,countryCode:'US',languageCode:'en'},organicResults:[{position:1,title:'What Happens at YC',url:'https://www.ycombinator.com/about',description:'Demo day details.'}],peopleAlsoAsk:[],relatedQueries:[]})),
    };
    const result=await createResearcher({apify:client,sourceChecker:{select:async(urls)=>{
      if(!urls.includes('https://www.ycombinator.com/about')) throw new Error('No primary source');
      return [{originalUrl:'https://publisher.example/checklist',finalUrl:'https://publisher.example/checklist',authoritative:false},{originalUrl:'https://www.ycombinator.com/about',finalUrl:'https://www.ycombinator.com/about',authoritative:true}];
    }}}).inspect([{candidate,suggestions:[],organicResults:[{title:'Checklist',url:'https://publisher.example/checklist',snippet:'Plan video',resultType:'article'}],peopleAlsoAsk:faq,relatedQueries:[],provenance:{discovery:{actorId:'a',runId:'r',datasetId:'d',observedAt:'2026-09-04T08:01:00.000Z'},serp:{actorId:SERP_ACTOR_ID,runId:'original-run',datasetId:'original-dataset',observedAt:'2026-09-04T08:01:00.000Z'}}}]);
    expect(sourceSearches).toBe(1);
    expect(result.results[0].evidence.serp.organicResultCount).toBe(1);
    expect(result.results[0].evidence.sources).toHaveLength(2);
    expect(result.results[0].provenance.supportSearches?.[0].runId).toBe('sources-run');
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

  it('rejects questions whose only overlap is a generic video or startup token', () => {
    expect(() => selectRelevantPaaQuestions('startup product demo video', [
      'Which video codec is best for archival footage?',
      'How does a startup register for payroll tax?',
      'Why is video compression useful for television?',
      'What product demo evidence should a buyer review?',
    ])).toThrow(/three relevant/i);
  });
});
