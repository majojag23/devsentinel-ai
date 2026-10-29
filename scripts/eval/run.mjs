// Uso (en el servidor, con la clave en el entorno):
//   node scripts/eval/run.mjs --model claude-haiku-5-5 --reps 3 --budget 1.5
// Opciones: --bank base|hard  --cases id1,id2  --concurrency 2  --out eval-results
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const bank=process.argv.includes('--bank')?process.argv[process.argv.indexOf('--bank')+1]:'base';
const {cases}=await import(bank==='hard'?'./cases-hard.mjs':'./cases.mjs');
import {runAll,summarize,makeAnthropicChat,PRICES} from './lib.mjs';
import {osvClient,npmLatest} from '../../lib/security.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i>=0?process.argv[i+1]:fallback;};
const model=arg('model','claude-haiku-5-5'),reps=Number(arg('reps',3)),budget=Number(arg('budget',1.5)),concurrency=Number(arg('concurrency',2));
const only=arg('cases','').split(',').filter(Boolean);
const key=process.env.AI_API_KEY;
if(!key){console.error('Falta AI_API_KEY en el entorno.');process.exit(1);}
if(!PRICES[model]){console.error('Modelo sin precio conocido: '+model);process.exit(1);}
const chosen=only.length?cases.filter(c=>only.includes(c.id)):cases;
console.error(`Modelo ${model} · ${chosen.length} casos x ${reps} repeticiones · tope $${budget}`);
const report=await runAll({cases:chosen,reps,model,budget,concurrency,osv:osvClient(),latest:npmLatest(),makeChat:meter=>makeAnthropicChat(model,key,meter)});
const dir=arg('out','eval-results');mkdirSync(dir,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
writeFileSync(join(dir,`${bank}-${model}-${stamp}.json`),JSON.stringify(report,null,1));
console.log(summarize(report));
