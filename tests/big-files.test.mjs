import {test} from 'node:test';
import assert from 'node:assert/strict';
import {view,search,proposeFix} from '../lib/agent.mjs';
import {mockGithub} from '../scripts/eval/lib.mjs';
const big=Array.from({length:2000},(_,i)=>`const linea${i+1} = ${i+1};`).join('\n');
const call=(name,args)=>({role:'assistant',content:null,tool_calls:[{id:name+Math.random(),type:'function',function:{name,arguments:JSON.stringify(args)}}]});
const script=(...r)=>{let i=0;return async()=>r[i++];};
test('un archivo corto se devuelve entero y sin nota, igual que antes',()=>{
 const v=view('a\nb\nc');assert.equal(v.text,'a\nb\nc');assert.equal(v.note,undefined);assert.equal(v.total,3);
});
test('un archivo largo se devuelve por partes de menos de 16 KB y la nota dice cómo seguir',()=>{
 const first=view(big);assert.ok(first.text.length<16000);assert.match(first.note,/^\[Líneas 1-\d+ de 2000\. Sigue con start_line=\d+\.\]$/);
 assert.ok(first.text.startsWith('const linea1 = 1;'));
 // Seguir las notas hasta el final reconstruye el archivo completo, sin huecos ni repeticiones.
 let rebuilt='',from=1,guard=0;
 while(from<=2000&&guard++<100){const v=view(big,from);rebuilt+=v.text;from=v.to+1;}
 assert.equal(rebuilt,big+'\n');
 assert.match(view(big,1990).note,/Fin del archivo/);
});
test('se puede pedir un rango concreto y los valores raros no rompen nada',()=>{
 const v=view(big,100,102);assert.equal(v.text,'const linea100 = 100;\nconst linea101 = 101;\nconst linea102 = 102;\n');assert.equal(v.from,100);assert.equal(v.to,102);
 assert.equal(view(big,-5,2).from,1);assert.equal(view(big,'x','y').from,1);
 assert.throws(()=>view(big,5000),/only 2000 lines/);
 const huge='x'.repeat(40000);assert.ok(view(huge,1,1).text.length<16000);
});
test('search_file devuelve números de línea, limita los resultados y rechaza búsquedas vacías',()=>{
 assert.equal(search(big,'LINEA1999'),'línea 1999: const linea1999 = 1999;');
 assert.equal(search(big,'no-existe'),'No matches.');
 const many=search(big,'linea');assert.equal(many.split('\n').length,26);assert.match(many,/1975 más/);
 assert.throws(()=>search(big,'a'),/at least 2/);
});
test('el agente puede leer y proponer un cambio en un archivo de hasta 150 KB, y no más',async()=>{
 const files={'src/grande.js':big+'\nexport function f(a){return a+1;}\n'};
 assert.ok(Buffer.byteLength(files['src/grande.js'])>16000);
 const r=await proposeFix({github:mockGithub(files),repository:'o/r',task:'f(1) debería devolver 2 pero devuelve otra cosa.',
  chat:script(call('search_file',{path:'src/grande.js',query:'function f'}),call('read_file',{path:'src/grande.js',start_line:2001,end_line:2002}),call('propose_change',{path:'src/grande.js',summary:'ok',edits:[{find:'return a+1;',replace:'return a + 2;'}]}))});
 assert.ok(r.proposal);assert.match(r.proposal.content,/a \+ 2/);assert.equal(r.proposal.original,files['src/grande.js']);
 assert.ok(r.events.some(e=>e.type==='action'&&/search_file/.test(e.text)));
 assert.ok(r.events.some(e=>e.type==='observation'&&/líneas 2001-/.test(e.text)));
 const tooBig={'src/enorme.js':'x'.repeat(160000)};
 const gh=mockGithub(tooBig);
 const r2=await proposeFix({github:gh,repository:'o/r',task:'arregla el archivo enorme por favor',chat:script(call('read_file',{path:'src/enorme.js'}),{role:'assistant',content:'No pude leerlo.'})});
 assert.equal(r2.proposal,null);
});
