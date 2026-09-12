import assert from 'node:assert/strict';

export const normalize=(value:string)=>value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
type Identity={id:string;slug:string;title:string;keyword:string;campaign:string};
export function mergeInventory<T extends Identity>(retained:T[],added:T[],final?:{campaigns:string[];perCampaign:number}):T[]{
  const combined=[...retained,...added];
  for(const key of ['id','slug','title','keyword'] as const){
    const seen=new Set<string>();
    for(const row of combined){const value=normalize(row[key]);assert(value&&!seen.has(value),`Duplicate or empty ${key}: ${row[key]}`);seen.add(value);}
  }
  if(final){
    assert.equal(combined.length,final.campaigns.length*final.perCampaign,'Expected final article total');
    for(const campaign of final.campaigns)assert.equal(combined.filter(row=>row.campaign===campaign).length,final.perCampaign,`Expected ${final.perCampaign} articles in ${campaign}`);
  }
  return combined;
}
type Serp={id:string;query:string;country:string;language:string;device:string;page:number;observedAt:string;organicResults:unknown[]};
export function selectEvidence<T extends Serp>(topic:{id:string;keyword:string},records:T[],final=false):T|undefined{
  const evidence=records.filter(row=>row.id===topic.id&&normalize(row.query??'')===normalize(topic.keyword)&&row.country==='US'&&row.language==='en'&&row.device==='DESKTOP'&&row.page===1&&row.organicResults?.length>0).sort((a,b)=>b.observedAt.localeCompare(a.observedAt))[0];
  if(final)assert(evidence,`Missing exact-term organic SERP evidence for ${topic.keyword}`);
  return evidence;
}
