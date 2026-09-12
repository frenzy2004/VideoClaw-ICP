import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createProductionSourceChecker } from '../../lib/autoblogger/runtime';
import { redactSensitive } from '../../lib/autoblogger/secrets';

const root=resolve(import.meta.dirname);
const topics=JSON.parse(await readFile(resolve(root,'topics.json'),'utf8')) as Array<{id:string;campaign:string;slug:string}>;
const output=resolve(root,'source-audit.json');
type Receipt={url:string;status:string;checkedAt:string;finalUrl?:string;httpStatus?:number;bodySha256?:string;extractedWords?:number;error?:string};
const prior=await readFile(output,'utf8').then(text=>JSON.parse(text).receipts as Receipt[]).catch((error:NodeJS.ErrnoException)=>{if(error.code!=='ENOENT')throw error;return []});
const receipts=new Map(prior.map(row=>[row.url,row]));
const urls=new Set<string>();
let available=0;
for(const topic of topics) {
  try {
    const metadata=JSON.parse(await readFile(resolve(root,'drafts',topic.campaign,topic.slug+'.json'),'utf8'));
    for(const source of metadata.sources??[]) urls.add(source.url);
    available++;
  } catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}
const queue=[...urls].filter(url=>!receipts.has(url));
const checker=createProductionSourceChecker();
async function work() {
  for(;;) {
    const url=queue.shift();if(!url)return;
    try {
      const page=await checker.read(url);
      receipts.set(url,{url,status:'body_retrieved',checkedAt:page.checkedAt,finalUrl:page.finalUrl,httpStatus:page.status,bodySha256:page.bodySha256,extractedWords:page.text.split(/\s+/).length});
    } catch(error) {receipts.set(url,{url,status:'automatic_retrieval_unavailable',checkedAt:new Date().toISOString(),error:redactSensitive(error).slice(0,300)});}
  }
}
await Promise.all(Array.from({length:4},work));
const rows=[...receipts.values()].sort((a,b)=>a.url.localeCompare(b.url));
await writeFile(output,JSON.stringify({schemaVersion:1,kind:'source_transport_audit_not_editorial_approval',articlesAvailable:available,receipts:rows},null,2)+'\n');
console.log(JSON.stringify({articlesAvailable:available,sources:rows.length,retrieved:rows.filter(r=>r.status==='body_retrieved').length,unavailable:rows.filter(r=>r.status!=='body_retrieved').map(r=>({url:r.url,error:r.error}))}));
