import { describe, expect, it } from 'vitest';
import { mergeInventory, selectEvidence, collectLocalLinks } from './batch-utils';

const item=(n:number,campaign='c1')=>({id:`id-${n}`,slug:`slug-${n}`,title:`Title ${n}`,keyword:`query ${n}`,campaign});
describe('incremental manual expansion',()=>{
  it('retains existing entries and accepts a partial batch',()=>{
    const retained=[item(1)];
    expect(mergeInventory(retained,[item(2)])).toEqual([...retained,item(2)]);
    expect(retained).toEqual([item(1)]);
  });
  it.each(['id','slug','title','keyword'] as const)('rejects normalized duplicate %s',key=>{
    expect(()=>mergeInventory([item(1)],[{...item(2),[key]:`  ${item(1)[key].toUpperCase()}  `}])).toThrow(/Duplicate/);
  });
  it('enforces campaign counts only when final completion is requested',()=>{
    expect(()=>mergeInventory([item(1)],[],{campaigns:['c1','c2'],perCampaign:1})).toThrow(/Expected/);
    expect(mergeInventory([item(1)],[item(2,'c2')],{campaigns:['c1','c2'],perCampaign:1})).toHaveLength(2);
  });
  it('selects only exact live US/en desktop organic evidence',()=>{
    const base={id:'id-1',query:'query 1',country:'US',language:'en',device:'DESKTOP',page:1,observedAt:'2026-09-12',organicResults:[{url:'https://example.com'}]};
    expect(selectEvidence(item(1),[{...base,country:'GB'},{...base,query:'query 2'}])).toBeUndefined();
    expect(selectEvidence(item(1),[{...base,organicResults:[]},base])).toEqual(base);
  });
  it('allows pending evidence incrementally but refuses final completion',()=>{
    expect(selectEvidence(item(1),[])).toBeUndefined();
    expect(()=>selectEvidence(item(1),[],true)).toThrow(/Missing exact-term/);
  });
  it('collects actual local anchors without remote or asset destinations',()=>{
    expect(collectLocalLinks('<a href="/blog/demo">Demo</a><a href="/blog/demo">Again</a><a href="/download?a=1&amp;b=2">App</a><a href="https://example.com">Source</a><a href="//example.com">Remote</a><link href="/style.css"/>')).toEqual(['/blog/demo','/download?a=1&b=2']);
  });
});
