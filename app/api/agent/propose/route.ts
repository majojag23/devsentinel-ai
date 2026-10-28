import {createHash} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {requireUser,requireSameOrigin,apiError} from '../../../../lib/github-auth';
import {githubClient,GitHubError} from '../../../../lib/github.mjs';
import {aiConfig,createChat} from '../../../../lib/ai.mjs';
import {proposeFix} from '../../../../lib/agent.mjs';
import {osvClient,npmLatest,verifyProposal} from '../../../../lib/security.mjs';
import {createLimiter} from '../../../../lib/limit.mjs';
import {activity,record} from '../../../../lib/activity-store';
export const runtime='nodejs';
export const maxDuration=60;
// Per user: 6 runs / 10 min. Globally: 2 runs at once, so a free model quota is not drained.
const limited=createLimiter(6,10*60*1000);
let running=0;
export async function POST(request:NextRequest){
 let acquired=false;
 try{
  requireSameOrigin(request);
  const {token,login}=await requireUser(request);
  const config=aiConfig();
  if(!config)throw new GitHubError('El agente de IA aún no está configurado en el servidor.',503);
  if(limited(createHash('sha256').update(token).digest('hex').slice(0,16)))throw new GitHubError('Has alcanzado el límite de análisis. Espera unos minutos.',429);
  if(running>=2)throw new GitHubError('Hay varios análisis en curso. Inténtalo en unos segundos.',429);
  const text=await request.text();
  if(text.length>20000)throw new GitHubError('Solicitud demasiado grande.',413);
  let input:any;try{input=JSON.parse(text);}catch{throw new GitHubError('Solicitud JSON no válida.');}
  running++;acquired=true;
  const result:any=await proposeFix({github:githubClient(token),chat:createChat(config),repository:input.repository,base:input.base||'main',task:input.task,verify:(p:any)=>verifyProposal({path:p.path,original:p.original,content:p.content,osv:osvClient(),latest:npmLatest()})});
  if(result.proposal&&!result.verification){try{result.verification=await verifyProposal({path:result.proposal.path,original:result.proposal.original,content:result.proposal.content,osv:osvClient(),latest:npmLatest()});}catch{}}
  const source=['ci','security'].includes(input.source)?input.source:'manual';
  const v=result.verification,issues=v?v.findings.length+v.deps.filter((d:any)=>d.ids.length).length+(v.reminders?.length||0):0;
  const event:any=await record(()=>activity.add(login,result.proposal
   ?{type:'repair',status:'proposed',source,repo:input.repository,base:result.proposal.base,path:result.proposal.path,title:'Arreglo propuesto en '+result.proposal.path,summary:result.proposal.summary,verification:v?{ok:issues===0,issues}:undefined,events:result.events}
   :{type:'repair',status:'no-fix',source,repo:input.repository,base:input.base||'main',title:'Sin cambio propuesto',message:result.message,events:result.events}));
  if(event)result.activityId=event.id;
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}finally{if(acquired)running--;}
}
