import {createHash} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {requireGitHub,requireSameOrigin,apiError} from '../../../../lib/github-auth';
import {githubClient,githubText,GitHubError} from '../../../../lib/github.mjs';
import {loadCiFailure} from '../../../../lib/ci.mjs';
import {createLimiter} from '../../../../lib/limit.mjs';
export const runtime='nodejs';
const limited=createLimiter(20,10*60*1000);
export async function POST(request:NextRequest){
 try{
  requireSameOrigin(request);
  const token=await requireGitHub(request);
  if(limited(createHash('sha256').update(token).digest('hex').slice(0,16)))throw new GitHubError('Demasiadas consultas. Espera unos minutos.',429);
  const text=await request.text();
  if(text.length>2000)throw new GitHubError('Solicitud demasiado grande.',413);
  let input:any;try{input=JSON.parse(text);}catch{throw new GitHubError('Solicitud JSON no válida.');}
  const result=await loadCiFailure({github:githubClient(token),text:githubText(token),repository:input.repository,pr:input.pr});
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
