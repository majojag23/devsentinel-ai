import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scanPatch,addedDependencies,scanPullRequest,osvClient} from '../lib/security.mjs';
const patch=(...lines)=>'@@ -1,2 +10,'+lines.length+' @@\n context\n'+lines.map(l=>'+'+l).join('\n');
const ids=f=>f.map(x=>x.id);
test('secrets are found on the right line and never echoed in full',()=>{
 const key='AKIAIOSFODNN7EXAMPLE',gh='ghp_'+'a'.repeat(36);
 const f=scanPatch('src/config.js',patch(`const id = "${key}";`,'ok();',`const t = '${gh}';`));
 assert.deepEqual(ids(f),['aws-key','github-token']);
 assert.equal(f[0].line,11);assert.equal(f[1].line,13);assert.equal(f[0].severity,'critical');
 assert.ok(!JSON.stringify(f).includes(key)&&!JSON.stringify(f).includes(gh));assert.match(f[0].snippet,/AKIA••••/);
});
test('hardcoded passwords are flagged but placeholders and docs are not',()=>{
 assert.deepEqual(ids(scanPatch('app.py',patch('password = "hunter2-long-secret"'))),['hardcoded-secret']);
 assert.equal(scanPatch('app.py',patch('password = "your_password_here"','api_key = process.env.KEY','secret: "${SECRET}"')).length,0);
 assert.equal(scanPatch('README.md',patch('api_key = "abcdefgh12345678"')).length,0);
});
test('dangerous code patterns are found only in matching languages',()=>{
 const js=scanPatch('a.js',patch('eval(input);','exec(`ls ${dir}`);','el.innerHTML = html;','db.query("SELECT * FROM t WHERE id=" + id);','const o = {rejectUnauthorized: false};','const token = Math.random().toString(36);','const n = Math.random();'));
 assert.deepEqual(ids(js),['eval','cmd-injection','xss','sql-concat','tls-off','weak-random']);
 assert.equal(scanPatch('a.py',patch('eval(x)')).length,0);
 assert.deepEqual(ids(scanPatch('a.py',patch('os.system(cmd)','data = pickle.loads(b)','yaml.load(f)','cur.execute(f"SELECT {x}")'))),['py-shell','pickle-yaml','pickle-yaml','sql-concat']);
});
test('safe lines and removed lines produce nothing',()=>{
 const diff='@@ -1,3 +1,2 @@\n-eval(old);\n const a = 1;\n+db.query("SELECT 1 WHERE id = ?", [id]);\n+exec("ls");';
 assert.equal(scanPatch('a.js',diff).length,0);
});
test('workflow risks and env/key files are reported',()=>{
 const f=scanPatch('.github/workflows/ci.yml',patch('on: pull_request_target','- run: echo "${{ github.event.pull_request.title }}"','- uses: someone/action@main'));
 assert.deepEqual(ids(f),['actions-target','actions-injection','actions-unpinned']);
 assert.deepEqual(ids(scanPatch('.env',undefined)),['env-file']);
 assert.equal(scanPatch('.env.example',undefined).length,0);
 assert.deepEqual(ids(scanPatch('certs/id_rsa',undefined)),['key-file']);
});
test('added dependencies are read from a package.json patch',()=>{
 const deps=addedDependencies('@@ -3,2 +3,6 @@\n   "dependencies": {\n+    "lodash": "^4.17.15",\n+    "@scope/pkg": "~2.0.1",\n+    "version": "1.2.3",\n+    "dev": "node --test",\n+    "local": "file:../x"');
 assert.deepEqual(deps,[{name:'lodash',version:'4.17.15',line:4},{name:'@scope/pkg',version:'2.0.1',line:5}]);
});
function ghMock({priv=false,files,push=true,sameRepo=true,state='open'}){return async path=>{
 if(path.includes('/files'))return files;
 if(path.includes('/pulls/'))return {title:'Add stuff',state,head:{ref:'feature/x',repo:{full_name:sameRepo?'owner/repo':'fork/repo'}}};
 return {private:priv,permissions:{push}};
};}
test('a PR scan combines rules and OSV, sorts by severity and reports what it skipped',async()=>{
 const files=[
  {filename:'src/a.js',status:'modified',patch:patch('el.innerHTML = x;','eval(y);')},
  {filename:'package.json',status:'modified',patch:'@@ -1,1 +1,2 @@\n context\n+    "lodash": "4.17.15"'},
  {filename:'package-lock.json',status:'modified',patch:'+x'},
  {filename:'big.js',status:'modified'},
 ];
 const r=await scanPullRequest({github:ghMock({files}),osv:async deps=>deps.map(d=>d.name==='lodash'?['GHSA-1','GHSA-2']:[]),repository:'owner/repo',pr:7});
 assert.deepEqual(r.findings.map(f=>f.id),['eval','dep-vuln','xss']);
 assert.equal(r.counts.high,1);assert.equal(r.counts.medium,2);assert.equal(r.reviewed,2);assert.equal(r.skipped,2);assert.equal(r.depsChecked,1);
 assert.equal(r.base,'feature/x');assert.equal(r.canFix,true);assert.match(r.findings[1].url,/GHSA-1/);assert.ok(r.notes.some(n=>/big\.js/.test(n)));
});
test('PR scan degrades honestly: OSV down, forks, private repos, bad numbers',async()=>{
 const files=[{filename:'package.json',status:'modified',patch:'@@ -1,1 +1,2 @@\n context\n+    "lodash": "4.17.15"'}];
 const down=await scanPullRequest({github:ghMock({files}),osv:async()=>{throw new Error('x');},repository:'owner/repo',pr:1});
 assert.equal(down.depsChecked,0);assert.ok(down.notes.some(n=>/OSV/.test(n)));
 assert.equal((await scanPullRequest({github:ghMock({files:[],sameRepo:false}),osv:async()=>[],repository:'owner/repo',pr:1})).canFix,false);
 await assert.rejects(()=>scanPullRequest({github:ghMock({files:[],priv:true}),osv:async()=>[],repository:'owner/repo',pr:1}),e=>e.status===400);
 await assert.rejects(()=>scanPullRequest({github:ghMock({files:[]}),osv:async()=>[],repository:'owner/repo',pr:'x'}),e=>e.status===400);
});
test('osvClient maps batch results to vulnerability ids',async()=>{
 const query=osvClient(async()=>new Response(JSON.stringify({results:[{vulns:[{id:'A'},{id:'B'}]},{}]}),{status:200}));
 assert.deepEqual(await query([{name:'a',version:'1.0.0'},{name:'b',version:'1.0.0'}]),[['A','B'],[]]);
});
test('regression: camelCase secret names and SQL/commands with quotes inside the string',()=>{
 const demo=scanPatch('src/legacy/demo-inseguro.js',patch(
  'const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";',
  'const adminPassword = "hunter2-super-secreta";',
  'return db.query("SELECT * FROM users WHERE name = \'" + nombre + "\'");',
  "return db.query('SELECT * FROM users WHERE name = \"' + nombre + '\"');",
  'elemento.innerHTML = html;',
  'return eval(formula);'));
 assert.deepEqual(ids(demo),['aws-key','hardcoded-secret','sql-concat','sql-concat','xss','eval']);
 assert.deepEqual(ids(scanPatch('a.js',patch('exec("ls " + dir);',"execSync('rm ' + file);"))),['cmd-injection','cmd-injection']);
 assert.deepEqual(ids(scanPatch('c.js',patch('const dbPassword = "s3cr3t-value-123";','user_api_key: "abcd1234efgh5678"'))),['hardcoded-secret','hardcoded-secret']);
});
test('regression: parameterised SQL, labels and placeholders stay quiet',()=>{
 assert.equal(scanPatch('a.js',patch('db.query("SELECT * FROM users WHERE id = ?", [id]);','const label = "Contraseña de usuario";','const passwordHint = "Escribe tu contraseña";','const apiKey = process.env.API_KEY;','const secret = "<tu-secreto-aqui>";')).length,0);
});
import {changedLinesPatch,verifyProposal} from '../lib/security.mjs';
test('only lines a proposal really changes are scanned',()=>{
 const before='const a = 1;\nreturn eval(formula);\nexport {a};\n';
 assert.equal(scanPatch('a.js',changedLinesPatch(before,before)).length,0);
 const after='const a = 1;\nreturn new Function("return " + formula)();\nexport {a};\n';
 const f=scanPatch('a.js',changedLinesPatch(before,after));
 assert.deepEqual(ids(f),['eval']);assert.equal(f[0].line,2);
});
test('a proposal is re-verified: a bumped dependency that still has advisories is reported honestly',async()=>{
 const before='{\n  "dependencies": {\n    "lodash": "4.17.15",\n    "react": "^18.2.0"\n  }\n}\n';
 const after=before.replace('4.17.15','4.17.21');
 const osv=async deps=>deps.map(d=>d.version==='4.17.21'?['GHSA-a','GHSA-b','GHSA-c']:[]);
 const v=await verifyProposal({path:'package.json',original:before,content:after,osv});
 assert.deepEqual(v.deps,[{name:'lodash',version:'4.17.21',ids:['GHSA-a','GHSA-b','GHSA-c']}]);assert.equal(v.findings.length,0);
 const clean=await verifyProposal({path:'package.json',original:before,content:before.replace('4.17.15','4.18.1'),osv});
 assert.deepEqual(clean.deps[0].ids,[]);
 const down=await verifyProposal({path:'package.json',original:before,content:after,osv:async()=>{throw new Error('x');}});
 assert.ok(down.notes.some(n=>/OSV/.test(n)));
});
test('dependency findings suggest the latest version and say whether it is clean',async()=>{
 const files=[{filename:'package.json',status:'modified',patch:'@@ -1,1 +1,2 @@\n context\n+    "lodash": "4.17.15"'}];
 const osv=async deps=>deps.map(d=>d.version==='4.17.15'?['GHSA-1']:d.version==='9.9.9'?[]:['GHSA-x','GHSA-y']);
 const clean=await scanPullRequest({github:ghMock({files}),osv,latest:async()=>'9.9.9',repository:'owner/repo',pr:1});
 assert.match(clean.findings[0].fix,/Actualiza a 9\.9\.9.*no lista vulnerabilidades/);
 const dirty=await scanPullRequest({github:ghMock({files}),osv,latest:async()=>'8.0.0',repository:'owner/repo',pr:1});
 assert.match(dirty.findings[0].fix,/8\.0\.0\) todavía tiene 2 avisos/);
 const none=await scanPullRequest({github:ghMock({files}),osv,latest:async()=>null,repository:'owner/repo',pr:1});
 assert.match(none.findings[0].fix,/versión corregida/);
});
test('the reason a fix button is withheld is reported exactly: closed, fork or no write access',async()=>{
 const files=[{filename:'a.js',status:'modified',patch:patch('eval(x);')}];
 const run=opts=>scanPullRequest({github:ghMock({files,...opts}),osv:async()=>[],repository:'owner/repo',pr:1});
 const ok=await run({});assert.equal(ok.canFix,true);assert.equal(ok.fixBlock,'');
 const closed=await run({state:'closed'});assert.equal(closed.canFix,false);assert.equal(closed.fixBlock,'closed');
 assert.equal((await run({sameRepo:false})).fixBlock,'fork');
 assert.equal((await run({push:false})).fixBlock,'no-write');
 assert.equal((await run({state:'closed',sameRepo:false})).fixBlock,'closed');
});
test('removing a secret from the code still reminds you to revoke it; unrelated edits do not',async()=>{
 const osv=async()=>[];
 const before='const a = 1;\nconst GITHUB_TOKEN = "ghp_'+'A'.repeat(36)+'";\nexport {a};\n';
 const fixed=before.replace(/const GITHUB_TOKEN.*\n/,'const GITHUB_TOKEN = process.env.GITHUB_TOKEN;\n');
 const v=await verifyProposal({path:'src/a.js',original:before,content:fixed,osv});
 assert.equal(v.findings.length,0);assert.equal(v.reminders.length,1);assert.match(v.reminders[0],/historial de Git.*Revócala/);
 const plain=await verifyProposal({path:'src/a.js',original:'const a = 1;\n',content:'const a = 2;\n',osv});
 assert.deepEqual(plain.reminders,[]);
 const kept=await verifyProposal({path:'src/a.js',original:before,content:before.replace('const a = 1','const a = 2'),osv});
 assert.deepEqual(kept.reminders,[]);
 const stillThere=await verifyProposal({path:'src/a.js',original:before,content:before+'const GOOGLE = "AIza'+'x'.repeat(35)+'";\n',osv});
 assert.equal(stillThere.findings.length,1);assert.deepEqual(stillThere.reminders,[]);
});
