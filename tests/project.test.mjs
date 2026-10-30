import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,relative,resolve,extname} from 'node:path';
import {execFileSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const ignored=new Set(['.git','node_modules','test-results','__pycache__']);
async function walk(directory=root){
 const files=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  if(ignored.has(entry.name))continue;
  const path=join(directory,entry.name);
  if(entry.isDirectory())files.push(...await walk(path));else files.push(path);
 }
 return files;
}

test('eight stock layouts and real local assets are included',async()=>{
 for(const file of ['template.html','layouts.html']){
  const html=await readFile(join(root,file),'utf8');
  assert.equal((html.match(/<section class="slide /g)||[]).length,8,file);
  assert.equal((html.match(/<!-- SLIDES:BEGIN -->/g)||[]).length,1);
  assert.equal((html.match(/<!-- SLIDES:END -->/g)||[]).length,1);
 }
 for(const file of (await walk()).filter(path=>extname(path)==='.html')){
  const html=await readFile(file,'utf8');
  for(const match of html.matchAll(/<(?:img|script|link|a)\b[^>]*\b(?:src|href)="([^"]+)"/g)){
   const path=match[1];
   if(/^(?:https?:|data:|#)/.test(path))continue;
   assert.ok(!path.startsWith('/'),'Project links must work in a hosting subdirectory: '+path);
   assert.ok((await stat(resolve(root,path))).isFile(),relative(root,file)+': '+path);
  }
 }
});

test('published tree excludes private files, contact details and credentials',async()=>{
 const secretPatterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{30,}/,/AKIA[A-Z0-9]{16}/,/(?:sk-|sk_live_)[A-Za-z0-9_-]{24,}/];
 for(const file of await walk()){
  const path=relative(root,file).replaceAll('\\','/');
  assert.ok(!/(?:^|\/)(?:uploads|photos|backups|exports|private|data)(?:\/|$)/i.test(path),path);
  assert.ok(!/(?:^|\/)\.env(?:\.|$)|\.(?:key|pem|pfx|p12|sqlite3?|db|log)$/i.test(path),path);
  if(extname(path)==='.png'){assert.equal(path,'docs/preview.png');continue;}
  assert.ok(['.html','.css','.js','.mjs','.md','.svg','.py','.bat',''].includes(extname(path)),path);
  const text=await readFile(file,'utf8');
  for(const pattern of secretPatterns)assert.ok(!pattern.test(text),'Possible credential in '+path);
  assert.ok(!/[A-Z]:\\(?:Users|OpenCodeProject|Documents)\\/i.test(text),'Local path in '+path);
  assert.ok(!/QQ群\s*\d{5,}|(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/.test(text),'Contact number in '+path);
  assert.ok(!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text),'Email address in '+path);
 }
});

test('JavaScript entry points parse without a build step',async()=>{
 for(const file of (await walk(join(root,'js'))).filter(path=>extname(path)==='.js'))execFileSync(process.execPath,['--check',file]);
});
