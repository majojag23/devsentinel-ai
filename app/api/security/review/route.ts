import {createHash} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {requireUser,requireSameOrigin,apiError} from '../../../../lib/github-auth';
import {githubClient,GitHubError} from '../../../../lib/github.mjs';
import {scanPullRequest,osvClient,npmLatest} from '../../../../lib/security.mjs';
import {createLimiter} from '../../../../lib/limit.mjs';
import {activity,record} from '../../../../lib/activity-store';
export const runtime='nodejs';
export const maxDuration=30;
const limited=createLimiter(15,10*60*1000);
export async function POST(request:NextRequest){
 try{
  requireSameOrigin(request);
  const {token,login}=await requireUser(request);
  if(limited(createHash('sha256').update(token).digest('hex').slice(0,16)))throw new GitHubError('Demasiadas revisiones seguidas. Espera unos minutos.',429);
  const text=await request.text();
  if(text.length>2000)throw new GitHubError('Solicitud demasiado grande.',413);
  let input:any;try{input=JSON.parse(text);}catch{throw new GitHubError('Solicitud JSON no válida.');}
  const result=await scanPullRequest({github:githubClient(token),osv:osvClient(),latest:npmLatest(),repository:input.repository,pr:input.pr});
  await record(()=>activity.add(login,{type:'security',status:'reviewed',source:'security',repo:result.repository,pr:result.pr,title:'Revisión de seguridad del PR #'+result.pr,summary:result.title,total:result.total,counts:result.counts,findings:result.findings}));
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
