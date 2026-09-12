import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { containsSecretLikeValue } from '../../lib/autoblogger/secrets';

const root=resolve(import.meta.dirname);
const files=(await readdir(resolve(root,'articles'))).filter(name=>name.endsWith('.md'));
assert.equal(files.length,50);
const counts:Record<string,number>={};
const records=[];
const shingleSets:Array<{slug:string;grams:Set<string>}>=[];
const normalizeUrl=(url:string)=>url.replace(/#.*$/,'').replace(/\/$/,'');
for(const file of files) {
  const text=await readFile(resolve(root,'articles',file),'utf8');
  const {data,content}=matter(text);
  const notes=JSON.parse(await readFile(resolve(root,'editorial-notes',file.replace(/\.md$/,'.json')),'utf8'));
  assert(!containsSecretLikeValue({text,notes}),`Secret-shaped value: ${file}`);
  assert.equal(data.status,'review');
  assert.equal(data.publishedAt,undefined);
  assert(Object.values(data.approvals).every(value=>value===false));
  assert.equal(data.faqs.length,3);
  assert(data.sources.length>=2);
  assert(notes.sourceNotes.some((note:{kind:string})=>note.kind==='primary'),`Primary source missing: ${file}`);
  const sourceUrls=new Set<string>(data.sources.map((source:{url:string})=>normalizeUrl(source.url)));
  const inlineUrls=[...content.matchAll(/\]\((https:\/\/[^\s)]+)\)/g)].map(match=>match[1]);
  assert(inlineUrls.length>=2,`Inline sources missing: ${file}`);
  assert(inlineUrls.every(url=>sourceUrls.has(normalizeUrl(url))),`Unlisted inline citation: ${file}`);
  const bodyWords=content.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').split(/\s+/).filter(word=>/[\p{L}\p{N}]/u.test(word)).length;
  assert(bodyWords>=850,`Insufficient substantive body: ${file}`);
  const svg=await readFile(resolve(root,'media',file.replace(/\.md$/,'.svg')),'utf8');
  assert(!/<(?:script|foreignObject|iframe|image)\b|\bon\w+\s*=|javascript:/i.test(svg),`Unsafe SVG: ${file}`);
  counts[data.campaign]=(counts[data.campaign]??0)+1;
  const words=content.toLowerCase().replace(/https?:\/\/[^\s)]+/g,'').match(/[a-z0-9]+/g)??[];
  const grams=new Set(words.slice(0,-7).map((_,i)=>words.slice(i,i+8).join(' ')));
  shingleSets.push({slug:data.slug,grams});
  records.push({slug:data.slug,bodyWords,sources:data.sources.length,faqs:data.faqs.length,articleSha256:createHash('sha256').update(text).digest('hex'),graphicSha256:createHash('sha256').update(svg).digest('hex')});
}
assert.equal(Object.keys(counts).length,5);
assert(Object.values(counts).every(count=>count===10));
assert.equal(new Set(records.map(record=>record.articleSha256)).size,50);
assert.equal(new Set(records.map(record=>record.graphicSha256)).size,50);
const nearDuplicates=[];
for(let i=0;i<shingleSets.length;i++)for(let j=i+1;j<shingleSets.length;j++){
  const a=shingleSets[i],b=shingleSets[j];
  const shared=[...a.grams].filter(gram=>b.grams.has(gram)).length;
  const containment=shared/Math.min(a.grams.size,b.grams.size);
  if(containment>=0.12)nearDuplicates.push({a:a.slug,b:b.slug,containment});
}
assert.equal(nearDuplicates.length,0,'Potentially repetitive bodies need review.');
const report={kind:'manual_batch_content_checks',checkedAt:new Date().toISOString(),articles:50,campaigns:counts,totalBodyWords:records.reduce((sum,row)=>sum+row.bodyWords,0),nearDuplicateMethod:'8-word shingle containment >=12%; not a plagiarism or intent-uniqueness guarantee',nearDuplicates,productionChanges:false,records};
await writeFile(resolve(root,'content-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({articles:50,campaigns:counts,totalBodyWords:report.totalBodyWords,nearDuplicates:nearDuplicates.length,pass:true}));
