import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { renderEditorialSvg } from '../../lib/autoblogger/content-bundle';
import { MEDIA_ALLOWLIST } from '../../lib/autoblogger/runtime';
import type { CampaignId } from '../../lib/autoblogger/domain';
import { mergeInventory, selectEvidence } from './batch-utils';
import { containsSecretLikeValue } from '../../lib/autoblogger/secrets';

const root=resolve(import.meta.dirname);
const topics=JSON.parse(await readFile(resolve(root,'topics.json'),'utf8')) as Array<{id:string;campaign:CampaignId;icp:string;customerTrigger:string;funnelStage:string;keyword:string;title:string;slug:string}>;
type SerpRecord={id:string;query:string;country:string;language:string;device:string;page:number;observedAt:string;runId:string;datasetId:string;organicResults:Array<{url:string;title:string}>;peopleAlsoAsk?:string[]};
const records:SerpRecord[]=[];
for(const file of (await readdir(root)).filter(name=>name.startsWith('serp-')&&name.endsWith('.json'))) {
  const doc=JSON.parse(await readFile(resolve(root,file),'utf8'));
  records.push(...doc.records);
}
const Source=z.object({label:z.string().min(1),url:z.url(),checkedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
const Metadata=z.object({id:z.string(),description:z.string().min(70).max(200),secondaryKeywords:z.array(z.string().min(1)).min(1),
  competitorGap:z.string().min(20),sources:z.array(Source).min(2),faqs:z.array(z.object({question:z.string().min(5),answer:z.string().min(15)})).length(3),
  editorialGraphic:z.object({title:z.string(),alt:z.string(),steps:z.array(z.object({label:z.string(),detail:z.string()}))}),
  sourceNotes:z.array(z.object({url:z.url(),supports:z.string().min(15),kind:z.string()})).min(2),
}).passthrough();
const retainedRoot=resolve(root,'../2026-09-12-50');
const retained=JSON.parse(await readFile(resolve(retainedRoot,'inventory.json'),'utf8')).items;
mergeInventory(retained,topics); // Check all topics before writing any output.
const slugSet=new Set([...retained,...topics].map(t=>t.slug));
const normalize=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,' ');
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const output=[];
const pendingEvidence:string[]=[];
for(const item of retained){
  assert.equal(hash(await readFile(resolve(retainedRoot,'articles',item.slug+'.md'),'utf8')),item.articleSha256,'Retained article changed');
  assert.equal(hash(await readFile(resolve(retainedRoot,'media',item.slug+'.svg'),'utf8')),item.graphicSha256,'Retained graphic changed');
}
const allBodyHashes=new Set<string>();
for(const topic of topics) {
  const base=resolve(root,'drafts',topic.campaign,topic.slug);
  try { await readFile(base+'.json'); await readFile(base+'.md'); } catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT') continue; throw error; }
  const metadata=Metadata.parse(JSON.parse(await readFile(base+'.json','utf8')));
  const body=(await readFile(base+'.md','utf8')).trim();
  assert.equal(metadata.id,topic.id);
  assert(!body.startsWith('---'),'Author input must be body only.');
  assert(!containsSecretLikeValue({metadata,body}),'Secret-like content rejected.');
  const bodyHash=hash(body);
  assert(!allBodyHashes.has(bodyHash),'Duplicate article body.');allBodyHashes.add(bodyHash);
  const evidence=selectEvidence(topic,records,process.argv.includes('--final'));
  if(!evidence){pendingEvidence.push(topic.id);continue;}
  assert(evidence.country==='US'&&evidence.language==='en'&&evidence.device==='DESKTOP'&&evidence.page===1,'Wrong SERP scope.');
  const product=MEDIA_ALLOWLIST.find(m=>m.campaignIds?.includes(topic.campaign));assert(product);
  const productMedia={src:product.src,poster:product.poster,alt:product.alt,caption:product.caption,width:product.width,height:product.height};
  const date='2026-09-12';
  const data={id:topic.id,campaign:topic.campaign,icp:topic.icp,customerTrigger:topic.customerTrigger,funnelStage:topic.funnelStage,
    primaryKeyword:topic.keyword,secondaryKeywords:metadata.secondaryKeywords,searchIntent:topic.funnelStage==='consideration'?'commercial':'informational',
    competitorGap:metadata.competitorGap,provenance:{apifyRunId:evidence.runId,apifyDatasetId:evidence.datasetId,query:topic.keyword,locale:'en-US',capturedAt:evidence.observedAt.slice(0,10)},
    title:topic.title,description:metadata.description,slug:topic.slug,canonicalPath:`/blog/${topic.slug}`,sources:metadata.sources,faqs:metadata.faqs,
    productMedia,editorialGraphic:{src:`/media/blog/${topic.slug}.svg`,alt:metadata.editorialGraphic.alt,width:1200,height:675},
    cta:{label:'Download the desktop app',href:'/download'},status:'review',approvals:{copy:false,factual:false,legal:false,visual:false},createdAt:date,updatedAt:date,
    searchMetrics:{volume:'provider-pending',keywordDifficulty:'provider-pending',cpc:'provider-pending'}};
  const related=[...body.matchAll(/\]\((\/blog\/([a-z0-9-]+))(?:#[^)]*)?\)/g)].map(m=>m[2]);
  assert(related.length>=2,`At least two related guides required: ${topic.slug}`);
  assert(related.every(slug=>slugSet.has(slug)&&slug!==topic.slug),`Unknown or self related guide: ${topic.slug}`);
  const words=body.split(/\s+/).filter(w=>/[\p{L}\p{N}]/u.test(w)).length;
  const markdown=`---\n${JSON.stringify(data,null,2)}\n---\n\n${body}\n`;
  const svg=renderEditorialSvg(metadata.editorialGraphic);
  const faqEvidence=metadata.faqs.map(faq=>{
    const observed=records.find(row=>(row.peopleAlsoAsk??[]).some((q:string)=>normalize(q)===normalize(faq.question)));
    return {question:faq.question,basis:observed?'observed_paa':'editorial',...(observed?{query:observed.query,runId:observed.runId,datasetId:observed.datasetId}:{})};
  });
  await Promise.all(['articles','media','editorial-notes'].map(dir=>mkdir(resolve(root,dir),{recursive:true})));
  await writeFile(resolve(root,'articles',topic.slug+'.md'),markdown);
  await writeFile(resolve(root,'media',topic.slug+'.svg'),svg+'\n');
  await writeFile(resolve(root,'editorial-notes',topic.slug+'.json'),JSON.stringify({id:topic.id,kind:'manually_curated_review_draft',sourceNotes:metadata.sourceNotes,faqEvidence,competitorGap:metadata.competitorGap,reviewNotes:metadata.reviewNotes??[],serp:evidence,paidMetrics:'provider-pending'},null,2)+'\n');
  output.push({id:topic.id,campaign:topic.campaign,title:topic.title,keyword:topic.keyword,slug:topic.slug,words,articleSha256:hash(markdown),graphicSha256:hash(svg+'\n'),sourceCount:metadata.sources.length,faqEvidence,reviewStatus:'review',warnings:[...(words<850?['short_article_requires_editorial_review']:[]),...(topic.title.length>65?['long_title_review_serp_display']:[])]});
}
const items=mergeInventory(retained.map((item:Record<string,unknown>)=>({...item,sourceBatch:'2026-09-12-50'})),output.map(item=>({...item,sourceBatch:'2026-09-12-250'})),process.argv.includes('--final')?{campaigns:[...new Set(topics.map(topic=>topic.campaign))],perCampaign:50}:undefined);
assert.equal((await readdir(resolve(root,'articles'))).filter(f=>f.endsWith('.md')).length,output.length);
const inventory={schemaVersion:1,kind:'manual_review_batch',count:items.length,newCount:output.length,retainedCount:retained.length,targetCount:250,productionChanges:false,scheduledWorkerPilot:false,items};
await writeFile(resolve(root,'inventory.json'),JSON.stringify(inventory,null,2)+'\n');
const rows=items.map(row=>`| ${row.id} | [${row.title}](../${row.sourceBatch}/articles/${row.slug}.md) | ${row.keyword} | ${row.words} | review |`).join('\n');
const campaignRows=[...new Set(topics.map(topic=>topic.campaign))].map(campaign=>`| ${campaign} | ${items.filter(item=>item.campaign===campaign).length} | 50 |`).join('\n');
await writeFile(resolve(root,'INDEX.md'),`# Manual review library: ${items.length} of 250 articles\n\nTarget: fifty per ICP. Original fifty are retained unchanged; ${output.length} additional articles assembled. These are unpublished editorial drafts, not demand-validated or team-approved posts. All volume, difficulty and CPC values remain provider-pending.\n\n| ICP campaign | Complete drafts | Target |\n|---|---:|---:|\n${campaignRows}\n\n| ID | Markdown article | Primary query | Body words | Status |\n|---|---|---|---:|---|\n${rows}\n`);
console.log(JSON.stringify({stage:'assembled',articles:items.length,newArticles:output.length,graphics:output.length,pendingEvidence,words:output.reduce((n,a)=>n+a.words,0),warnings:output.filter(a=>a.warnings.length).map(a=>({slug:a.slug,warnings:a.warnings}))}));
