import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proposeFix,applyEdits} from '../lib/agent.mjs';
import {aiConfig} from '../lib/ai.mjs';
const sha='a'.repeat(40),fileSha='b'.repeat(40),source='export function name(u) {\n  return u.profile.name.trim();\n}\n';
function github({priv=false,push=true}={}){return async path=>{
 if(path.endsWith('/git/trees/'+sha+'?recursive=1'))return {tree:[{path:'src/auth.ts',type:'blob',size:60},{path:'.env',type:'blob',size:5},{path:'node_modules/x/index.js',type:'blob',size:5},{path:'src',type:'tree'}]};
 if(path.includes('/git/ref/'))return {object:{sha}};
 if(path.includes('/contents/'))return {type:'file',encoding:'base64',size:60,sha:fileSha,content:Buffer.from(source).toString('base64')};
 return {private:priv,permissions:{push}};
};}
const call=(name,args,id=name)=>({role:'assistant',content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]});
function script(...replies){const seen=[];let i=0;const chat=async({messages})=>{seen.push(messages.length);return replies[i++];};chat.seen=seen;return chat;}
const base={repository:'owner/repo',base:'main',task:'Fix the crash when the user has no profile'};
test('agent lists, reads and returns a verified find/replace proposal',async()=>{
 const chat=script(call('list_files',{}),call('read_file',{path:'src/auth.ts'}),call('propose_change',{path:'src/auth.ts',summary:'Guard missing profile',edits:[{find:'u.profile.name.trim()',replace:"u?.profile?.name?.trim() || 'Anonymous'"}]}));
 const r=await proposeFix({github:github(),chat,...base});
 assert.equal(r.proposal.path,'src/auth.ts');assert.equal(r.proposal.baseCommit,sha);assert.equal(r.proposal.fileSha,fileSha);
 assert.match(r.proposal.content,/Anonymous/);assert.equal(r.proposal.original,source);
 assert.deepEqual(r.events.map(e=>e.type),['action','observation','action','observation','action','observation']);
});
test('agent only sees allowed files',async()=>{
 const chat=script(call('list_files',{}),{role:'assistant',content:'done'});let listed='';
 const wrapped=async a=>{const m=await chat(a);const last=a.messages.at(-1);if(last.role==='tool')listed=last.content;return m;};
 await proposeFix({github:github(),chat:wrapped,...base});
 assert.equal(listed,'src/auth.ts');
});
test('a failed edit is returned to the model so it can retry',async()=>{
 const chat=script(call('propose_change',{path:'src/auth.ts',summary:'x',edits:[{find:'does not exist',replace:'y'}]}),call('propose_change',{path:'src/auth.ts',summary:'ok',edits:[{find:'.trim()',replace:'.trim() || "?"'}]}));
 const r=await proposeFix({github:github(),chat,...base});
 assert.ok(r.proposal);assert.ok(r.events.some(e=>/not found/.test(e.text)));
});
test('plain text answer yields no proposal',async()=>{
 const r=await proposeFix({github:github(),chat:script({role:'assistant',content:'No safe fix.'}),...base});
 assert.equal(r.proposal,null);assert.equal(r.message,'No safe fix.');
});
test('rejects private repos, missing write access and hidden/unlisted paths',async()=>{
 await assert.rejects(()=>proposeFix({github:github({priv:true}),chat:script(),...base}),e=>e.status===400);
 await assert.rejects(()=>proposeFix({github:github({push:false}),chat:script(),...base}),e=>e.status===403);
 const chat=script(call('read_file',{path:'.env'}),{role:'assistant',content:'cannot'});
 const r=await proposeFix({github:github(),chat,...base});
 assert.ok(r.events.some(e=>/not available/.test(e.text)));
});
test('applyEdits requires a unique match and rejects empty input',()=>{
 assert.throws(()=>applyEdits('a a','x'.slice(1)));
 assert.throws(()=>applyEdits('a a',[{find:'a',replace:'b'}]),/2 times/);
 assert.equal(applyEdits('a b',[{find:'b',replace:'c'}]),'a c');
});
test('aiConfig needs a key and supports presets and custom endpoints',()=>{
 assert.equal(aiConfig({}),null);
 assert.equal(aiConfig({AI_API_KEY:'k'}).provider,'gemini');
 assert.match(aiConfig({AI_API_KEY:'k',AI_PROVIDER:'groq'}).baseUrl,/groq/);
 assert.equal(aiConfig({AI_API_KEY:'k',AI_PROVIDER:'custom'}),null);
 assert.equal(aiConfig({AI_API_KEY:'k',AI_PROVIDER:'custom',AI_BASE_URL:'http://x/v1/',AI_MODEL:'m'}).baseUrl,'http://x/v1');
});
