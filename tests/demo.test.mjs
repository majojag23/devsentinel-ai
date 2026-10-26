import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runDemo} from '../lib/demo.mjs';
test('reproduces the bug and verifies the proposed repair in a temporary directory',async()=>{const r=await runDemo();assert.equal(r.baseline.passed,false);assert.equal(r.verification.passed,true);assert.equal(r.status,'awaiting_approval');assert.match(r.verification.log, /pass 4/);});
