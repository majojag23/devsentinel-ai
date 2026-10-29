import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newDb} from 'pg-mem';
import {createPgActivityStore} from '../lib/activity-pg.mjs';
const fresh=()=>{const db=newDb(),pool=new (db.adapters.createPg().Pool)();return {pool,store:createPgActivityStore({pool})};};
test('pg: add, list newest first, update and clear',async()=>{
 const {store}=fresh();
 const a=await store.add('Mariana',{type:'repair',status:'proposed',repo:'o/r',title:'Primero'});
 await store.add('Mariana',{type:'security',status:'reviewed',repo:'o/r',title:'Segundo',total:0});
 const list=await store.list('mariana');
 assert.deepEqual(list.map(e=>e.title),['Segundo','Primero']);assert.match(a.id,/^[0-9a-f]{10}$/);
 const updated=await store.update('MARIANA',a.id,{status:'published',url:'https://github.com/o/r/pull/9',number:9});
 assert.equal(updated.status,'published');assert.equal(updated.id,a.id);assert.equal(updated.at,a.at);assert.equal(updated.title,'Primero');
 assert.equal((await store.list('mariana')).find(e=>e.id===a.id).number,9);
 assert.equal(await store.update('mariana','nope',{status:'published'}),null);
 await store.clear('mariana');assert.deepEqual(await store.list('mariana'),[]);
});
test('pg: users are isolated and the login is not stored in clear',async()=>{
 const {store,pool}=fresh();
 await store.add('alice',{title:'de alice'});await store.add('bob',{title:'de bob'});
 assert.deepEqual((await store.list('alice')).map(e=>e.title),['de alice']);
 assert.deepEqual(await store.list('carol'),[]);
 const rows=(await pool.query('SELECT user_key FROM activity_events')).rows;
 assert.equal(rows.length,2);assert.ok(rows.every(r=>!/alice|bob/.test(r.user_key)));
 await store.clear('alice');assert.equal((await store.list('bob')).length,1);
});
test('pg: only known fields are stored, never code or tokens',async()=>{
 const {store,pool}=fresh();
 await store.add('u',{title:'x',token:'ghp_secret',content:'const k="AKIA"',findings:[{severity:'high',title:'Eval',path:'a.js',line:3,snippet:'eval(secret)'}]});
 const text=JSON.stringify((await pool.query('SELECT event FROM activity_events')).rows);
 assert.ok(!/ghp_|AKIA|snippet|eval\(secret|content/.test(text));
});
test('pg: concurrent writes never lose events and the history is capped at 200 per user',async()=>{
 const {store}=fresh();
 await Promise.all(Array.from({length:30},(_,i)=>store.add('u',{title:'e'+i})));
 assert.equal((await store.list('u')).length,30);
 await Promise.all(Array.from({length:190},(_,i)=>store.add('u',{title:'f'+i})));
 const list=await store.list('u');assert.equal(list.length,200);
 assert.equal(list[0].title,'f189');
 await store.add('other',{title:'otro'});assert.equal((await store.list('u')).length,200);
 assert.equal((await store.list('u',5)).length,5);
});
test('pg: if the database is down once, the next call retries instead of staying broken',async()=>{
 const db=newDb(),real=new (db.adapters.createPg().Pool)();let fail=true;
 const pool={query:(...a)=>{if(fail){fail=false;return Promise.reject(new Error('conexión rechazada'));}return real.query(...a);}};
 const store=createPgActivityStore({pool});
 await assert.rejects(store.add('u',{title:'a'}),/conexión rechazada/);
 await store.add('u',{title:'b'});assert.deepEqual((await store.list('u')).map(e=>e.title),['b']);
});
