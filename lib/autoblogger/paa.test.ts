import { describe, expect, it } from 'vitest';
import { normalizePaaRows } from './paa';

const provenance = {actorId:'santhej/people-also-ask-scraper',runId:'observed-run',datasetId:'observed-dataset',observedAt:'2026-09-05T19:24:52.533Z'};
const row = {record_type:'paa_question',keyword:'demo day video checklist',question:'How does yc demo day work?',parent_question:null,answer_type:'ai_overview',answer_text:null,answer_source_url:null,position:1,country:'us',language:'en',checked_at:'2026-09-05T19:24:52.334Z'};

describe('dedicated PAA observation normalization', () => {
  it('keeps exact questions, locale and run lineage without accepting AI answers as facts', () => {
    const result = normalizePaaRows([row], 'demo day video checklist', provenance);
    expect(result.questions).toEqual(['How does yc demo day work?']);
    expect(result.observations[0]).toEqual({question:'How does yc demo day work?',parentQuestion:null,query:'demo day video checklist',country:'US',language:'en',observedAt:'2026-09-05T19:24:52.334Z',position:1,runId:'observed-run',datasetId:'observed-dataset',actorId:provenance.actorId});
    expect(JSON.stringify(result)).not.toContain('answer_text');
  });
  it('does not relabel suggestions, foreign locale rows or another query as PAA', () => {
    const result = normalizePaaRows([
      {...row,record_type:'related_searches',related_searches:['demo day checklist pdf']},
      {...row,keyword:'a different topic'}, {...row,country:'gb'}, {...row,language:'de'},
      {...row,question:'',position:0}, {...row,checked_at:'invalid'},
    ], 'demo day video checklist', provenance);
    expect(result.questions).toEqual([]);
    expect(result.relatedSearches).toEqual(['demo day checklist pdf']);
  });
  it('deduplicates expanded questions and rejects secret-like provider output', () => {
    const result=normalizePaaRows([row,{...row,position:2}, {...row,question:`Question ${['apify','api','notarealtokenvalue123456789'].join('_')}?`}],row.keyword,provenance);
    expect(result.questions).toEqual([row.question]);
  });
});
