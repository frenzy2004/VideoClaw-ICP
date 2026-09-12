import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import matter from 'gray-matter';

const root=resolve(import.meta.dirname);
const origin=process.argv[2]??'http://127.0.0.1:3004';
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin),'Local review server only.');
const inventory=JSON.parse(await readFile(resolve(root,'inventory.json'),'utf8')) as {items:Array<{slug:string;sourceBatch:string}>};
const checks=[];
const media=new Set<string>();
const attribute=(tag:string,name:string)=>tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
async function get(path:string){const response=await fetch(origin+path);return {status:response.status,text:await response.text()};}
const index=await get('/blog');assert.equal(index.status,200);
for(const item of inventory.items){
  const {data}=matter(await readFile(resolve(root,'..',item.sourceBatch,'articles',item.slug+'.md'),'utf8'));
  const page=await get('/blog/'+item.slug);assert.equal(page.status,200,item.slug);
  const canonical=(page.text.match(/<link\b[^>]*>/g)??[]).find(tag=>attribute(tag,'rel')==='canonical');
  assert.equal(attribute(canonical??'','href'),'https://videoclaw.com/blog/'+item.slug,item.slug);
  const robots=(page.text.match(/<meta\b[^>]*>/g)??[]).find(tag=>attribute(tag,'name')==='robots');
  assert(attribute(robots??'','content')?.includes('noindex'),item.slug);
  assert.equal((page.text.match(/<h1\b/g)??[]).length,1,item.slug);
  assert(page.text.includes('href="/download"'),item.slug);
  assert(index.text.includes('href="/blog/'+item.slug+'"'),item.slug);
  for(const path of [data.productMedia.src,data.productMedia.poster,data.editorialGraphic.src])media.add(path);
  checks.push({slug:item.slug,status:200,canonical:true,noindex:true,h1Count:1,downloadLink:true,indexLink:true});
}
for(const path of media){const response=await fetch(origin+path,{method:'HEAD'});assert.equal(response.status,200,path);}
assert.equal((await get('/blog/unknown-manual250-slug')).status,404);
assert.equal((await get('/download')).status,200);
const sitemap=await get('/sitemap.xml');assert.equal(sitemap.status,200);assert(!sitemap.text.includes('/blog/'));
const robots=await get('/robots.txt');assert.equal(robots.status,200);assert(/Disallow: \/(?:\r?\n|$)/.test(robots.text));
const llms=await get('/llms.txt');assert.equal(llms.status,200);assert(!llms.text.includes('/blog/'));
const report={checkedAt:new Date().toISOString(),origin,articleCount:checks.length,mediaAssets:media.size,unknownSlug404:true,download200:true,previewSitemapExcludesDrafts:true,previewRobotsDisallowAll:true,previewLlmsExcludesDrafts:true,checks};
await writeFile(resolve(root,'http-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({articles:checks.length,mediaAssets:media.size,pass:true}));
