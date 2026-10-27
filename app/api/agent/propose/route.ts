import {createHash} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {requireGitHub,requireSameOrigin,apiError} from '../../../../lib/github-auth';
import {githubClient,GitHubError} from '../../../../lib/github.mjs';
import {aiConfig,createChat} from '../../../../lib/ai.mjs';
import {proposeFix} from '../../../../lib/agent.mjs';
import {createLimiter} from '../../../../lib/limit.mjs';
export const runtime='nodejs';
export const maxDuration=60;
// Per user: 6 runs / 10 min. Globally: 2 runs at once, so a free model quota is not drained.
const limited=createLimiter(6,10*60*1000);
let running=0;
export async function POST(request:NextRequest){
 let acquired=false;
 try{
  requireSameOrigin(request);
  const token=await requireGitHub(request);
  const config=aiConfig();
  if(!config)throw new GitHubError('El agente de IA aún no está configurado en el servidor.',503);
  if(limited(createHash('sha256').update(token).digest('hex').slice(0,16)))throw new GitHubError('Has alcanzado el límite de análisis. Espera unos minutos.',429);
  if(running>=2)throw new GitHubError('Hay varios análisis en curso. Inténtalo en unos segundos.',429);
  const text=await request.text();
  if(text.length>20000)throw new GitHubError('Solicitud demasiado grande.',413);
  let input:any;try{input=JSON.parse(text);}catch{throw new GitHubError('Solicitud JSON no válida.');}
  running++;acquired=true;
  const result=await proposeFix({github:githubClient(token),chat:createChat(config),repository:input.repository,base:input.base||'main',task:input.task});
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}finally{if(acquired)running--;}
}
