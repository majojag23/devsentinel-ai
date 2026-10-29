import type {NextRequest} from 'next/server';
import {requireUser,requireSameOrigin,apiError} from '../../../../lib/github-auth';
import {githubClient,publishProposal,GitHubError} from '../../../../lib/github.mjs';
import {activity,record} from '../../../../lib/activity-store';
import {decodeBody} from '../../../../lib/wire.mjs';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 try{
  requireSameOrigin(request);
  const {token,login}=await requireUser(request);
  const text=await request.text();
  if(text.length>250000)throw new GitHubError('Solicitud demasiado grande.',413);
  let input:any;try{input=decodeBody(text);}catch{throw new GitHubError('Solicitud JSON no válida.');}
  const result=await publishProposal(githubClient(token),input);
  await record(async()=>{
   const done={status:'published',url:result.url,number:result.number};
   const linked=typeof input.activityId==='string'?await activity.update(login,input.activityId,done):null;
   if(!linked)await activity.add(login,{type:'repair',source:'manual',repo:input.repository,base:input.base,path:input.path,title:'PR creado en '+input.path,summary:input.summary,...done});
  });
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
