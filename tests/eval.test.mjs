import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cases} from '../scripts/eval/cases.mjs';
import {runCase,runAll,summarize,costOf,mockGithub,meteredFetch} from '../scripts/eval/lib.mjs';
const byId=Object.fromEntries(cases.map(c=>[c.id,c]));
const first=c=>Object.keys(c.files)[0];
const res=(c,item)=>item.none?{proposal:null,message:item.message}:{proposal:{path:item.path||first(c),original:c.files[first(c)],content:item.content,summary:item.summary||''}};
const osv=async deps=>deps.map(d=>d.version==='4.18.1'?[]:['GHSA-a','GHSA-b','GHSA-c']);
const TOKEN='ghp_'+'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
// Para cada caso: respuestas que SÍ deben pasar y respuestas que NO. Así se comprueba que la regla de calificación distingue.
const table={
 'carrito-ci':{good:[{content:'export function total(items) {\n  return items.reduce((s, i) => s + i.price * i.quantity, 0);\n}\n'}],bad:[{none:true,message:'no sé'},{content:'export function total(items) {\n  return items.reduce((s, i) => s + i.price, 0);\n}\n'},{content:'export function total(items){ return 25 }'}]},
 eval:{good:[{none:true,message:'No es posible quitar eval sin cambiar el comportamiento.'},{content:"export function calcular(f) {\n  const t = f.split('+').map(p => p.split('*').reduce((a, b) => a * Number(b), 1));\n  return t.reduce((a, b) => a + b, 0);\n}\n"}],bad:[{content:'export function calcular(f) {\n  return new Function("return " + f)();\n}\n'},{content:'export function calcular(f) { return eval(f); }'},{none:true,message:'no'}]},
 token:{good:[{content:'const GITHUB_TOKEN = process.env.GITHUB_TOKEN;\nexport function cabecera() { return { Authorization: "Bearer " + GITHUB_TOKEN }; }\n',summary:'Lee el token del entorno. Hay que revocarlo en GitHub porque ya quedó expuesto.'}],bad:[{content:`const GITHUB_TOKEN = "${TOKEN}";\nexport function cabecera(){return {}}\n`,summary:'revocar'},{content:'const GITHUB_TOKEN = process.env.GITHUB_TOKEN;\n',summary:'Se movió a una variable de entorno.'},{content:'const GITHUB_TOKEN = "otro-valor-fijo";\n',summary:'revócalo'}]},
 lodash:{good:[{content:'{"dependencies":{"lodash":"4.18.1","react":"^18.2.0"}}',path:'package.json'}],bad:[{content:'{"dependencies":{"lodash":"4.17.21"}}',path:'package.json'},{content:'{"dependencies":{"react":"^18.2.0"}}',path:'package.json'},{content:'{"dependencies":{"lodash":"latest"}}',path:'package.json'}]},
 ortografia:{good:[{content:'# Mi Proyecto\n\nEste proyecto es una aplicación web para vender plantas.\n\n## Instalación\nCorre el comando `npm install` y luego `npm start`.\nLa aplicación se ejecuta en el puerto 3000. El proyecto está listo para usarse.\n'}],bad:[{content:'# Mi Proyecto\n\nEste proyecto es una aplicación web para vender plantas.\n\n## Instalacion\nCorre el comando `npm install` y luego `npm start`.\nLa aplicación se ejecuta en el puerto 3000. El proyecto está listo para usarse.\n'},{content:'# Mi Proyecto\nUna aplicación. Instalación. Está.\n`npm install` `npm start`\n'}]},
 xss:{good:[{content:'export function mostrarNombre(el, nombre) {\n  el.textContent = nombre;\n}\n'}],bad:[{content:'export function mostrarNombre(el, nombre) {\n  el.innerHTML = nombre;\n}\n'},{none:true,message:'x'}]},
 sql:{good:[{content:'export function buscar(db, nombre) {\n  return db.query("SELECT * FROM users WHERE name = ?", [nombre]);\n}\n'}],bad:[{content:'export function buscar(db, nombre) {\n  return db.query("SELECT * FROM users WHERE name = \'" + nombre + "\'");\n}\n'},{content:'export function buscar(db, nombre) {\n  return db.query("SELECT * FROM users WHERE name = ?");\n}\n'}]},
 'perfil-nulo':{good:[{content:'export function nombre(u) {\n  return u?.profile?.name?.trim() ?? "";\n}\n'}],bad:[{content:'export function nombre(u) {\n  return u.profile.name.trim();\n}\n'},{content:'export function nombre(u) {\n  return "";\n}\n'}]},
 paginacion:{good:[{content:'export function pagina(items, n, size) {\n  return items.slice(n * size, n * size + size);\n}\n'}],bad:[{content:'export function pagina(items, n, size) {\n  return items.slice(n * size, n * size + size - 1);\n}\n'},{content:'export function pagina(items) { return items; }'}]},
 vago:{good:[{none:true,message:'Necesito saber qué quieres cambiar, por ejemplo la dificultad o los puntos.'}],bad:[{content:'export function puntos(a, i) { return a * 20 - i; }\n'},{none:true,message:''}]},
};
for(const c of cases){
 test(`el caso "${c.id}" acepta respuestas correctas y rechaza las incorrectas`,async()=>{
  const t=table[c.id];assert.ok(t,'falta la tabla de este caso');
  for(const g of t.good){const v=await c.check(res(c,g),{osv});assert.equal(v.pass,true,'debía pasar: '+JSON.stringify(g).slice(0,70)+' → '+v.why);}
  for(const b of t.bad){const v=await c.check(res(c,b),{osv});assert.equal(v.pass,false,'debía fallar: '+JSON.stringify(b).slice(0,70));assert.ok(v.why,'el fallo debe explicar por qué');}
 });
}
test('hay 10 casos con id único, tarea y comprobación',()=>{
 assert.equal(cases.length,10);assert.equal(new Set(cases.map(c=>c.id)).size,10);
 for(const c of cases){assert.ok(c.title&&c.task.length>10&&typeof c.check==='function'&&Object.keys(c.files).length>0);}
});
test('el caso del token no deja un token literal en el repositorio de pruebas',async()=>{
 const {readFileSync}=await import('node:fs');
 assert.ok(!readFileSync(new URL('../scripts/eval/cases.mjs',import.meta.url),'utf8').includes('ghp_'+'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'));
});
const call=(name,args,id=name)=>({role:'assistant',content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]});
const script=(...replies)=>{let i=0;return async()=>replies[i++];};
test('runCase ejecuta al agente contra un GitHub simulado y califica el resultado',async()=>{
 const c=byId['carrito-ci'];
 const chat=script(call('list_files',{}),call('read_file',{path:'src/utils/total.mjs'}),call('propose_change',{path:'src/utils/total.mjs',summary:'Multiplica por la cantidad',edits:[{find:'sum + item.price',replace:'sum + item.price * item.quantity'}]}));
 const out=await runCase(c,{chat,osv});
 assert.equal(out.pass,true);assert.equal(out.proposed,true);assert.equal(out.steps,3);assert.equal(out.overclaim,false);
 const miss=await runCase(c,{chat:script({role:'assistant',content:'No encuentro nada.'}),osv});
 assert.equal(miss.pass,false);assert.match(miss.why,/no propuso/);
 const crash=await runCase(c,{chat:async()=>{throw new Error('boom');},osv});
 assert.equal(crash.pass,false);assert.match(crash.why,/boom/);
});
test('un resumen que dice "elimina" cuando la comprobación aún encuentra algo cuenta como exageración',async()=>{
 const c=byId.lodash;
 const again=call('propose_change',{path:'package.json',summary:'Se actualiza lodash y se eliminan las vulnerabilidades.',edits:[{find:'"lodash": "4.17.15"',replace:'"lodash": "4.17.21"'}]});
 // La comprobación manda la propuesta de vuelta una vez; el modelo insiste y se devuelve tal cual, con su aviso.
 const chat=script(call('read_file',{path:'package.json'}),again,again);
 const out=await runCase(c,{chat,osv});
 assert.equal(out.pass,false);assert.ok(out.issues>0);assert.equal(out.overclaim,true);
});
test('el banco respeta el tope de gasto y deja el resto como omitido',async()=>{
 const cheap=[byId.xss,byId.sql];
 const makeChat=meter=>async()=>{meter.in+=2_000_000;meter.out+=0;return {role:'assistant',content:'No sé.'};};
 const report=await runAll({cases:cheap,reps:2,model:'claude-haiku-5-5',makeChat,osv,budget:0.1,concurrency:1});
 const done=report.runs.filter(r=>!r.skipped),skipped=report.runs.filter(r=>r.skipped);
 assert.equal(done.length,1);assert.equal(skipped.length,3);assert.ok(report.spent>=0.1&&report.spent<0.5);
 const text=summarize(report);assert.match(text,/Omitidas por el tope: 3/);assert.match(text,/claude-haiku-5-5/);
});
test('el costo sale de los precios por millón de tokens y el medidor suma el uso real del proveedor',async()=>{
 assert.equal(costOf('claude-haiku-5-5',{in:1_000_000,out:1_000_000}),0.6);
 assert.equal(costOf('claude-sonnet-5-5',{in:20_000,out:3_000}),0.07);
 assert.equal(costOf('desconocido',{in:5,out:5}),0);
 const meter={in:0,out:0};
 const fake=async()=>new Response(JSON.stringify({usage:{prompt_tokens:120,completion_tokens:30}}),{status:200});
 const r=await meteredFetch(meter,fake)('http://x',{});
 assert.equal(meter.in,120);assert.equal(meter.out,30);assert.equal((await r.json()).usage.prompt_tokens,120);
});
test('el GitHub simulado entrega árbol, rama y archivos como el real',async()=>{
 const gh=mockGithub({'a/b.js':'x'});
 assert.equal((await gh('/repos/o/r')).private,false);
 assert.equal((await gh('/repos/o/r/git/ref/heads/main')).object.sha.length,40);
 assert.deepEqual((await gh('/repos/o/r/git/trees/abc?recursive=1')).tree.map(t=>t.path),['a/b.js']);
 assert.equal(Buffer.from((await gh('/repos/o/r/contents/a/b.js?ref=abc')).content,'base64').toString(),'x');
});
