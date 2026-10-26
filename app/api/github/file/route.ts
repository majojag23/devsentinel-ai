import type {NextRequest} from 'next/server';
import {requireGitHub,apiError} from '../../../../lib/github-auth';
import {githubClient,loadSource} from '../../../../lib/github.mjs';
export const runtime='nodejs';
export async function GET(request:NextRequest){try{const token=await requireGitHub(request);const q=request.nextUrl.searchParams;const result=await loadSource(githubClient(token),{repository:q.get('repository'),path:q.get('path'),base:q.get('base')||'main'});return Response.json(result,{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
