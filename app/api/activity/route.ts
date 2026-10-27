import type {NextRequest} from 'next/server';
import {requireUser,requireSameOrigin,apiError} from '../../../lib/github-auth';
import {aiConfig} from '../../../lib/ai.mjs';
import {summarize} from '../../../lib/activity.mjs';
import {activity} from '../../../lib/activity-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 try{
  const {login,name,avatar}=await requireUser(request);
  const events=await activity.list(login);
  const config=aiConfig();
  return Response.json({user:{login,name,avatar},ai:config?{provider:config.provider,model:config.model}:null,events,stats:summarize(events)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
export async function DELETE(request:NextRequest){
 try{
  requireSameOrigin(request);
  const {login}=await requireUser(request);
  await activity.clear(login);
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
