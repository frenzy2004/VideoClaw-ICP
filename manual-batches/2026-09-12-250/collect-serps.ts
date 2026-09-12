import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createApifyClient } from '../../lib/autoblogger/apify-client';
import { createNodeJsonHttpTransport } from '../../lib/autoblogger/runtime-http';
import { runApifyActor, SERP_ACTOR_ID } from '../../lib/autoblogger/research';
import { normalizeSerpItem } from '../../lib/keywords/apify-evidence.mjs';
import { containsSecretLikeValue, redactSensitive } from '../../lib/autoblogger/secrets';

const directory = resolve(import.meta.dirname);
const campaign=process.argv.find(arg=>arg.startsWith('--campaign='))?.split('=')[1];
const campaigns=['newly-funded-founder','accelerator-demo-day-founder','video-production-comparison','gtm-content-repurposing-buyer','portfolio-media-platform'];
if(campaign&&!campaigns.includes(campaign))throw new Error('Unknown campaign');
const allTopics = JSON.parse(await readFile(resolve(directory, campaign?`topics/${campaign}.json`:'topics.json'), 'utf8')) as {id:string;keyword:string}[];
const expected=campaign?40:200;
if (allTopics.length !== expected || new Set(allTopics.map(t => t.keyword)).size !== expected) throw new Error('Expected distinct approved expansion topics.');
const chunk=Number(process.argv.find(arg=>arg.startsWith('--chunk='))?.split('=')[1]??0);
if(!Number.isInteger(chunk)||chunk<0||chunk>3) throw new Error('Chunk must be 0 through 3');
const supplementId = process.argv.find(arg=>arg.startsWith('--supplement='))?.split('=')[1];
const supplementIds = supplementId?.split(',');
const topics = supplementIds ? allTopics.filter(topic=>supplementIds.includes(topic.id)) : campaign?allTopics:allTopics.slice(chunk*50,(chunk+1)*50);
if (topics.length === 0) throw new Error('Unknown supplemental topic.');
const envFile = process.argv[2];
if (envFile) process.loadEnvFile(resolve(envFile));
if (!process.env.APIFY_TOKEN) throw new Error('Existing APIFY_TOKEN is required.');
const output = resolve(directory, supplementId ? topics.length === 1 ? `serp-${topics[0].id}.json` : 'serp-refined-evidence.json' : campaign?`serp-${campaign}.json`:`serp-chunk-${chunk}.json`);
try { await readFile(output); throw new Error('Evidence already exists; this collector will not repeat a paid run.'); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
try {
  console.log(JSON.stringify({stage:'started',queries:topics.length,paidModels:0,workerStateWrites:0}));
  const client = createApifyClient({token:process.env.APIFY_TOKEN,transport:createNodeJsonHttpTransport(),runTimeoutSeconds:600,maxTotalChargeUsd:5});
  const result = await runApifyActor(client,SERP_ACTOR_ID,{
    queries:topics.map(t=>t.keyword).join('\n')+'\n',maxPagesPerQuery:1,countryCode:'us',languageCode:'en',
    mobileResults:false,includeUnfilteredResults:false,saveHtml:false,saveHtmlToKeyValueStore:false,websiteContentScraper:{enable:false},
  },{timeoutMs:620000,maxPolls:125,pollIntervalMs:5000,maxAttempts:2});
  const observations = result.items.map(item=>normalizeSerpItem(item,result.provenance));
  const records = topics.map(topic=>{
    const row = observations.find(row=>row.query.trim().toLowerCase()===topic.keyword.toLowerCase());
    return {id:topic.id,keyword:topic.keyword,found:Boolean(row),...(row?{...row,organicResults:row.organicResults.map((result:{position:number;title:string;url:string;domain:string;resultType:string})=>({position:result.position,title:result.title,url:result.url,domain:result.domain,resultType:result.resultType}))}:{})};
  });
  const evidence = {schemaVersion:1,kind:'manual_editorial_batch',provenance:result.provenance,records};
  if (containsSecretLikeValue(evidence)) throw new Error('Evidence contains secret-like material.');
  await writeFile(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({stage:'completed',...result.provenance,queries:records.length,withOrganic:records.filter(r=>'organicResults' in r&&r.organicResults.length>0).length}));
} catch(error) { console.error(redactSensitive(error,[process.env.APIFY_TOKEN])); process.exitCode=1; }
