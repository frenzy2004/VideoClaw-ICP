import assert from 'node:assert/strict';

export const normalize=(value:string)=>value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
// Editorial labels for this locked manual batch, not a SERP-intent classifier.
// Four campaign libraries teach a procedure; C3 evaluates a purchase/engagement.
// Funnel position alone does not establish the intent of a how-to search.
export function manualSearchIntent(campaign:string):'informational'|'commercial'{
  if(campaign==='video-production-comparison')return 'commercial';
  assert(['newly-funded-founder','accelerator-demo-day-founder','gtm-content-repurposing-buyer','portfolio-media-platform'].includes(campaign),'Unreviewed campaign intent');
  return 'informational';
}
export function collectLocalLinks(html:string):string[]{
  const links=new Set<string>();
  for(const match of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>/gi)){
    const path=match[1].replaceAll('&amp;','&');
    if(path.startsWith('/')&&!path.startsWith('//'))links.add(path);
  }
  return [...links];
}
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
