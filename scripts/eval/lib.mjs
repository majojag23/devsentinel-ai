// Pieza reutilizable del banco: GitHub simulado, medidor de tokens, ejecución de un caso y resumen.
import {proposeFix} from '../../lib/agent.mjs';
import {createChat} from '../../lib/ai.mjs';
import {verifyProposal} from '../../lib/security.mjs';
/** Dólares por millón de tokens [entrada, salida]. Haiku 5.5 sube a 0.50/2.50 con prompts de más de 100K tokens: no ocurre en estos casos. */
export const PRICES={'claude-haiku-5-5':[0.10,0.50],'claude-sonnet-5-5':[2,10],'claude-opus-5-5':[4,20]};
export const costOf=(model,usage)=>{const p=PRICES[model];return p?(usage.in*p[0]+usage.out*p[1])/1e6:0;};
/** GitHub en memoria: solo lo que lee el agente (repo, rama, árbol y archivos). Nada sale a la red. */
export function mockGithub(files,commit='a'.repeat(40)){
 return async path=>{
  if(path.includes('/git/trees/'))return {tree:Object.entries(files).map(([p,c])=>({path:p,type:'blob',size:Buffer.byteLength(c)}))};
  if(path.includes('/git/ref/'))return {object:{sha:commit}};
  const m=/\/contents\/([^?]+)/.exec(path);
  if(m){const p=decodeURIComponent(m[1]);return {type:'file',encoding:'base64',size:Buffer.byteLength(files[p]),sha:'b'.repeat(40),content:Buffer.from(files[p]).toString('base64')};}
  return {private:false,permissions:{push:true}};
 };
}
/** fetch que suma los tokens que el proveedor dice haber usado. */
export function meteredFetch(meter,fetcher=fetch){
 return async(url,options)=>{const response=await fetcher(url,options);const data=await response.clone().json().catch(()=>null);if(data?.usage){meter.in+=data.usage.prompt_tokens||0;meter.out+=data.usage.completion_tokens||0;}return response;};
}
export async function runCase(testCase,{chat,osv,latest,now=Date.now}){
 const started=now();let result,error;
 try{result=await proposeFix({github:mockGithub(testCase.files),chat,repository:'o/r',base:'main',task:testCase.task,verify:p=>verifyProposal({path:p.path,original:p.original,content:p.content,osv,latest})});}catch(e){error=e.message;}
 const ms=now()-started;
 let verdict=error?{pass:false,why:'error: '+error}:{pass:false,why:'sin evaluar'};
 if(!error){try{verdict=await testCase.check(result,{osv});}catch(e){verdict={pass:false,why:'la comprobación falló: '+e.message};}}
 let issues=0;
 if(result?.proposal){try{const v=await verifyProposal({path:result.proposal.path,original:result.proposal.original,content:result.proposal.content,osv});issues=v.findings.length+v.deps.filter(d=>d.ids.length).length;}catch{}}
 const summary=result?.proposal?.summary||result?.message||'';
 const overclaim=issues>0&&/elimin|resuelv|soluciona|queda(?:n)? (?:corregid|resuelt)|eliminat|fixed|removes the vulnerab/i.test(summary);
 return {id:testCase.id,pass:!!verdict.pass,why:verdict.why||'',proposed:!!result?.proposal,retries:result?.retries||0,steps:(result?.events||[]).filter(e=>e.type==='action').length,issues,overclaim,ms};
}
/** Corre todos los casos x repeticiones con un tope de gasto. Si el tope se alcanza, el resto queda "omitido". */
export async function runAll({cases,reps,model,makeChat,osv,latest,budget,concurrency=2}){
 const jobs=[];for(let r=0;r<reps;r++)for(const c of cases)jobs.push({c,r});
 const runs=[];let spent=0,next=0;
 async function worker(){
  while(next<jobs.length){
   const {c,r}=jobs[next++];
   if(spent>=budget){runs.push({id:c.id,rep:r,skipped:true});continue;}
   const meter={in:0,out:0},chat=makeChat(meter);
   const out=await runCase(c,{chat,osv,latest});
   const cost=costOf(model,meter);spent+=cost;
   runs.push({...out,rep:r,tokensIn:meter.in,tokensOut:meter.out,cost});
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,jobs.length)},worker));
 return {model,runs:runs.sort((a,b)=>a.id.localeCompare(b.id)||a.rep-b.rep),spent};
}
export function summarize({model,runs,spent}){
 const done=runs.filter(r=>!r.skipped),byCase={};
 for(const r of done){(byCase[r.id]??=[]).push(r);}
 const pct=(n,d)=>d?Math.round(100*n/d)+'%':'—';
 const total=done.length,passed=done.filter(r=>r.pass).length;
 const lines=[`## ${model}`,'',`Aciertos: **${passed}/${total} (${pct(passed,total)})** · Costo total: **$${spent.toFixed(4)}** · Por ejecución: $${total?(spent/total).toFixed(4):'0'} · Omitidas por el tope: ${runs.length-total}`,'','| Caso | Aciertos | Pasos (prom.) | Reintentos | Avisos finales | Exageró | Segundos (prom.) |','|---|---|---|---|---|---|---|'];
 for(const [id,list] of Object.entries(byCase)){
  const avg=f=>(list.reduce((n,r)=>n+f(r),0)/list.length);
  lines.push(`| ${id} | ${list.filter(r=>r.pass).length}/${list.length} | ${avg(r=>r.steps).toFixed(1)} | ${list.filter(r=>r.retries>0).length} | ${list.filter(r=>r.issues>0).length} | ${list.filter(r=>r.overclaim).length} | ${(avg(r=>r.ms)/1000).toFixed(0)} |`);
 }
 const fails=done.filter(r=>!r.pass);
 if(fails.length){lines.push('','Por qué fallaron:');for(const f of fails)lines.push(`- ${f.id} (#${f.rep+1}): ${f.why}`);}
 const over=done.filter(r=>r.overclaim).length;
 lines.push('',`Exageraciones (el resumen dice que arregló, pero la comprobación encuentra algo): ${over}`);
 return lines.join('\n');
}
export const makeAnthropicChat=(model,key,meter,fetcher=fetch)=>createChat({provider:'anthropic',model,key,baseUrl:'https://api.anthropic.com/v1'},meteredFetch(meter,fetcher));
