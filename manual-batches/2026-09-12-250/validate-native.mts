import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root=resolve(import.meta.dirname);
const lander=resolve(process.argv[2]??'');
// Validation writes only to a disposable clone, never to the original lander.
assert(lander.startsWith('/tmp/videoclaw-manual50-')&&lander.endsWith('/lander'),'Use the isolated manual50 clone.');
assert.equal(execFileSync('git',['branch','--show-current'],{cwd:lander,encoding:'utf8'}).trim(),'seo/founder-video-blog-launch');
assert.equal(execFileSync('git',['remote'],{cwd:lander,encoding:'utf8'}).trim(),'','Preview clone must have no push remote.');
const manifest=JSON.parse(await readFile(resolve(root,'inventory.json'),'utf8')) as {items:Array<{id:string;slug:string;campaign:string;articleSha256:string;sourceBatch:string}>};
if(process.argv.includes('--final')) assert.equal(manifest.items.length,250);
await mkdir(resolve(lander,'public/media/blog'),{recursive:true});
for(const item of manifest.items) {
  await copyFile(resolve(root,'..',item.sourceBatch,'articles',item.slug+'.md'),resolve(lander,'content/articles',item.slug+'.md'));
  await copyFile(resolve(root,'..',item.sourceBatch,'media',item.slug+'.svg'),resolve(lander,'public/media/blog',item.slug+'.svg'));
}
// Import the native contract; no duplicate worker schema can make this pass.
const library=await import(pathToFileURL(resolve(lander,'app/lib/articles.ts')).href);
const routes=await import(pathToFileURL(resolve(lander,'app/lib/blog-route-data.ts')).href);
const options={contentDirectory:resolve(lander,'content/articles'),publicDirectory:resolve(lander,'public'),env:{NODE_ENV:'development'}};
const all=library.getAllArticles(options);
const batch=all.filter((article:{id:string})=>manifest.items.some(item=>item.id===article.id));
assert.equal(batch.length,manifest.items.length);
assert.equal(library.getPublishedArticles(options).length,0);
const production={...options,env:{NODE_ENV:'production',VERCEL_ENV:'production'}};
const checks=[];
for(const article of batch) {
  assert.equal(article.status,'review');
  assert(Object.values(article.approvals).every(value=>value===false));
  assert.equal(article.publishedAt,undefined);
  assert.equal(article.cta.href,'/download');
  assert.equal(library.getArticleBySlug(article.slug,production),undefined);
  const data=routes.buildArticlePageData(article,all,'preview');
  assert.deepEqual(data.metadata.robots,{index:false,follow:false});
  assert.equal(data.metadata.canonicalPath,`/blog/${article.slug}`);
  assert.equal(data.jsonLd.length,0);
  const unsafe=article.body.match(/\]\((?:javascript|data|file):/i);assert.equal(unsafe,null);
  checks.push({id:article.id,slug:article.slug,nativeContract:'pass',previewNoindex:true,production404:true,faqs:article.faqs.length,media:'files_present',canonical:data.metadata.canonicalPath});
}
assert.equal(new Set(all.map((a:{slug:string})=>a.slug)).size,all.length);
const result={schemaVersion:1,nativeBase:execFileSync('git',['rev-parse','HEAD'],{cwd:lander,encoding:'utf8'}).trim(),batchCount:batch.length,combinedArticleCount:all.length,publishedCount:0,generatedLanderPrs:0,checks};
await writeFile(resolve(root,'native-contract-report.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({nativeBase:result.nativeBase,batchCount:batch.length,combinedArticleCount:all.length,publishedCount:0,pass:true,files:manifest.items.length}));
