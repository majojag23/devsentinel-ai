import type {NextRequest} from 'next/server';
import {requireGitHub,requireSameOrigin,apiError} from '../../../../lib/github-auth';
import {githubClient,publishProposal,GitHubError} from '../../../../lib/github.mjs';
export const runtime='nodejs';
export async function POST(request:NextRequest){try{requireSameOrigin(request);const token=await requireGitHub(request);const text=await request.text();if(text.length>250000)throw new GitHubError('Solicitud demasiado grande.',413);let input;try{input=JSON.parse(text);}catch{throw new GitHubError('Solicitud JSON no válida.');}const result=await publishProposal(githubClient(token),input);return Response.json(result,{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
