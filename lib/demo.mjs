import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
export const before = `export function getUserName(user) {\n  return user.profile.name.trim();\n}\n`;
export const after = `export function getUserName(user) {\n  return user?.profile?.name?.trim() || 'Anonymous';\n}\n`;
const suite = `import {test} from 'node:test';\nimport assert from 'node:assert/strict';\nimport {getUserName} from './auth.mjs';\ntest('returns a trimmed name',()=>assert.equal(getUserName({profile:{name:' Ada '}}),'Ada'));\ntest('handles missing user',()=>assert.equal(getUserName(undefined),'Anonymous'));\ntest('handles missing profile',()=>assert.equal(getUserName({}),'Anonymous'));\ntest('handles blank name',()=>assert.equal(getUserName({profile:{name:' '}}),'Anonymous'));`;
export async function runDemo() {
 const directory = await mkdtemp(join(tmpdir(),'devsentinel-'));
 try {
 await writeFile(join(directory,'auth.mjs'),before);
 await writeFile(join(directory,'auth.test.mjs'),suite);
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 async function test(){try {const r=await exec(process.execPath,['--test','--test-reporter=tap','auth.test.mjs'],{cwd:directory,env,timeout:15000,maxBuffer:100000});return {passed:true,log:r.stdout};} catch(e){return {passed:false,log:e.stdout || e.message};}}
 const baseline = await test();
 await writeFile(join(directory,'auth.mjs'),after);
 const verification = await test();
 return {id:crypto.randomUUID(),mode:'demo',status:verification.passed?'awaiting_approval':'failed',baseline,verification,before,after,createdAt:new Date().toISOString()};
 } finally {await rm(directory,{recursive:true,force:true});}
}
