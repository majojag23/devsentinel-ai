import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createActivityStore,cleanEvent,summarize} from '../lib/activity.mjs';
const fresh=async()=>createActivityStore({dir:await mkdtemp(join(tmpdir(),'ds-act-'))});
test('events keep only known bounded fields: no code, tokens or snippets are stored',async()=>{
 const e=cleanEvent({type:'security',status:'reviewed',repo:'o/r',title:'x'.repeat(500),total:2,counts:{high:1,medium:1},token:'ghp_secret',content:'const k="AKIA…"',findings:[{severity:'high',title:'Eval',path:'a.js',line:3,snippet:'eval(secret)'}],evil:{a:1}});
 assert.equal(e.title.length,160);assert.deepEqual(e.counts,{critical:0,high:1,medium:1,low:0});
 assert.deepEqual(e.findings,[{severity:'high',title:'Eval',path:'a.js',line:3}]);
 const text=JSON.stringify(e);assert.ok(!/ghp_|AKIA|snippet|eval\(secret|evil|content/.test(text));
 assert.equal(cleanEvent({type:'weird',status:'weird',source:'weird'}).type,'repair');
});
test('add, list newest first, update and clear',async()=>{
 const store=await fresh();
 const a=await store.add('Mariana',{type:'repair',status:'proposed',repo:'o/r',title:'Primero'});
 await store.add('Mariana',{type:'security',status:'reviewed',repo:'o/r',title:'Segundo',total:0});
 const list=await store.list('mariana');
 assert.deepEqual(list.map(e=>e.title),['Segundo','Primero']);assert.match(a.id,/^[0-9a-f]{10}$/);
 const updated=await store.update('MARIANA',a.id,{status:'published',url:'https://github.com/o/r/pull/9',number:9});
 assert.equal(updated.status,'published');assert.equal(updated.id,a.id);assert.equal(updated.at,a.at);assert.equal(updated.title,'Primero');
 assert.equal(await store.update('mariana','nope',{status:'published'}),null);
 await store.clear('mariana');assert.deepEqual(await store.list('mariana'),[]);
});
test('users are isolated and files do not reveal the login',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ds-act-')),store=createActivityStore({dir});
 await store.add('alice',{title:'de alice'});await store.add('bob',{title:'de bob'});
 assert.deepEqual((await store.list('alice')).map(e=>e.title),['de alice']);
 assert.deepEqual(await store.list('carol'),[]);
 const files=await readdir(dir);assert.equal(files.length,2);assert.ok(files.every(f=>!/alice|bob/.test(f)));
});
test('concurrent writes never lose events and the history is capped',async()=>{
 const store=await fresh();
 await Promise.all(Array.from({length:30},(_,i)=>store.add('u',{title:'e'+i})));
 assert.equal((await store.list('u')).length,30);
 await Promise.all(Array.from({length:190},(_,i)=>store.add('u',{title:'f'+i})));
 assert.equal((await store.list('u')).length,200);
});
test('a corrupt file is treated as empty instead of breaking the dashboard',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ds-act-')),store=createActivityStore({dir});
 await store.add('u',{title:'ok'});
 const [name]=await readdir(dir);await (await import('node:fs/promises')).writeFile(join(dir,name),'{not json');
 assert.deepEqual(await store.list('u'),[]);
 await store.add('u',{title:'again'});assert.equal((await store.list('u')).length,1);
});
test('summaries come from real events: counts, pending approvals and repositories',()=>{
 const now=Date.parse('2026-10-27T12:00:00Z'),at=d=>new Date(now-d*864e5).toISOString();
 const events=[
  {id:'1',at:at(0),type:'repair',status:'published',repo:'o/a'},{id:'2',at:at(1),type:'repair',status:'proposed',repo:'o/a'},
  {id:'3',at:at(2),type:'repair',status:'no-fix',repo:'o/b'},{id:'4',at:at(3),type:'security',status:'reviewed',repo:'o/b',total:4},
  {id:'5',at:at(40),type:'repair',status:'proposed',repo:'o/c'},
 ];
 const s=summarize(events,{now});
 assert.equal(s.analyses,3);assert.equal(s.proposals,2);assert.equal(s.published,1);assert.equal(s.pending,1);assert.equal(s.securityReviews,1);assert.equal(s.findings,4);
 assert.deepEqual(s.repos.map(r=>[r.repo,r.events,r.prs]).sort(),[['o/a',2,1],['o/b',2,0],['o/c',1,0]]);
 assert.deepEqual(summarize([],{now}).repos,[]);
});
