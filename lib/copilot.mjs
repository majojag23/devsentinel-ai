/** Optional Copilot fixture runner. No shell, network or publication tool is exposed. */
import {CopilotClient,defineTool} from '@github/copilot-sdk';
import {z} from 'zod';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {before} from './demo.mjs';
const exec=promisify(execFile);
export async function investigateWithCopilot(){
 const directory=await mkdtemp(join(tmpdir(),'sentinel-copilot-'));
 const events=[];
 let client,session;
 try{
 await writeFile(join(directory,'auth.mjs'),before);
 await writeFile(join(directory,'auth.test.mjs'),`import {test} from 'node:test';import assert from 'node:assert/strict';import {getUserName} from './auth.mjs';test('normal user',()=>assert.equal(getUserName({profile:{name:' Ada '}}),'Ada'));test('missing user',()=>assert.equal(getUserName(undefined),'Anonymous'));test('missing profile',()=>assert.equal(getUserName({}),'Anonymous'));test('blank name',()=>assert.equal(getUserName({profile:{name:' '}}),'Anonymous'));`);
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 async function tests(){try{const r=await exec(process.execPath,['--test','--test-reporter=tap','auth.test.mjs'],{cwd:directory,env,timeout:15000,maxBuffer:100000});return {passed:true,log:r.stdout};}catch(e){return {passed:false,log:e.stdout||e.message};}}
 const baseline=await tests();
 function audit(action,observation){events.push({action,observation,at:new Date().toISOString()});return observation;}
 const allowed=new Set(['auth.mjs','auth.test.mjs']);
 const tools=[
 defineTool('fetch_ci_logs',{description:'Read the failing fixture test log.',parameters:z.object({build_id:z.literal(402)}),handler:async()=>audit('fetch_ci_logs',baseline.log)}),
 defineTool('read_file',{description:'Read one fixture file.',parameters:z.object({path:z.enum(['auth.mjs','auth.test.mjs'])}),handler:async({path})=>{if(!allowed.has(path))throw Error('File denied');return audit('read_file',await readFile(join(directory,path),'utf8'));}}),
 defineTool('write_file',{description:'Propose a repair to auth.mjs. Tests cannot be edited.',parameters:z.object({path:z.literal('auth.mjs'),content:z.string().max(16000)}),handler:async({path,content})=>{if(path!=='auth.mjs')throw Error('File denied');await writeFile(join(directory,path),content);return audit('write_file','Repair written to isolated fixture.');}}),
 defineTool('run_test_suite',{description:'Execute the fixed Node.js fixture suite.',parameters:z.object({}),handler:async()=>audit('run_test_suite',await tests())}),
 ];
 client=new CopilotClient({workingDirectory:directory});
 await client.start();
 session=await client.createSession({model:process.env.COPILOT_MODEL||'gpt-5',tools,availableTools:tools.map(t=>'custom:'+t.name),excludedTools:['builtin:*','mcp:*'],onPermissionRequest:()=>({kind:'denied-by-rules',rules:[]}),systemMessage:{mode:'replace',content:'Repair the provided trusted fixture using only the registered tools. Read the CI log, inspect auth.mjs and immutable tests, propose a minimal fix and verify. Return only a brief diagnosis and evidence. Never reveal private reasoning. Do not publish, use shell, or access other files.'}});
 await session.sendAndWait({prompt:'Build #402 failed. Repair getUserName so missing users, missing profiles and blank names return Anonymous. Preserve trimmed valid names. Execute tests.'},120000);
 const verification=await tests();
 return {id:crypto.randomUUID(),mode:'copilot',status:verification.passed?'awaiting_approval':'failed',baseline,verification,before,after:await readFile(join(directory,'auth.mjs'),'utf8'),events,createdAt:new Date().toISOString()};
 }finally{if(session)await session.disconnect();if(client)await client.stop();await rm(directory,{recursive:true,force:true});}
}

