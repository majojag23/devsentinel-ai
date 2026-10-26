import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishProposal,validateTarget} from '../lib/github.mjs';
const sha='a'.repeat(40),fileSha='b'.repeat(40);
const input={repository:'owner/repo',path:'src/auth.ts',base:'main',baseCommit:sha,fileSha,content:'new content',approved:true};
function mock(commit=sha,failPR=false){const calls=[];const client=async(path,method='GET',body)=>{calls.push({path,method,body});if(path.endsWith('/pulls')){if(failPR)throw Error('offline');return {html_url:'https://github.com/owner/repo/pull/1',number:1};}if(path.includes('/git/ref/'))return {object:{sha:commit}};if(path.includes('/contents/')&&method==='GET')return {type:'file',encoding:'base64',size:3,sha:fileSha,content:Buffer.from('old').toString('base64')};return {private:false,permissions:{push:true}};};return {client,calls};}
test('publishes only an approved draft PR on a new branch',async()=>{const {client,calls}=mock();const result=await publishProposal(client,input);assert.match(result.branch,/^sentinel\/edit-/);const writes=calls.filter(c=>c.method!=='GET');assert.equal(writes.length,3);assert.equal(writes[0].body.sha,sha);assert.notEqual(writes[1].body.branch,'main');assert.equal(writes[2].body.draft,true);assert.match(writes[2].body.body,/not executed/);});
test('rejects stale reviewed commits before any write',async()=>{const {client,calls}=mock('c'.repeat(40));await assert.rejects(()=>publishProposal(client,input),e=>e.status===409);assert.equal(calls.filter(c=>c.method!=='GET').length,0);});
test('rejects a request without explicit approval',async()=>{const {client,calls}=mock();await assert.rejects(()=>publishProposal(client,{...input,approved:false}));assert.equal(calls.length,0);});
test('blocks hidden files and path traversal',()=>{for(const path of ['../secret.txt','.env.local','.github/workflows/ci.yml','src/../../file.ts'])assert.throws(()=>validateTarget({...input,path}));});
test('reports retained branch after a partial failure',async()=>{const {client}=mock(sha,true);await assert.rejects(()=>publishProposal(client,input),e=>e.status===502&&e.branch.startsWith('sentinel/'));});
