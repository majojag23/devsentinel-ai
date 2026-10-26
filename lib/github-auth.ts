import {getToken} from 'next-auth/jwt';
import {auth,authReady} from '../auth';
import type {NextRequest} from 'next/server';
import {GitHubError} from './github.mjs';
export async function requireGitHub(request:NextRequest){
 if(!authReady)throw new GitHubError('Configura OAuth en el servidor antes de conectar GitHub.',503);
 const session=await auth();if(!session?.user)throw new GitHubError('Inicia sesión con GitHub para continuar.',401);
 const secureCookie=new URL(process.env.AUTH_URL||request.url).protocol==='https:';
 const token=await getToken({req:request,secret:process.env.AUTH_SECRET!,secureCookie});
 if(typeof token?.githubAccessToken!=='string')throw new GitHubError('Esta sesión no tiene acceso a GitHub. Inicia sesión con GitHub desde Acceder.',403);
 return token.githubAccessToken;
}
export function requireSameOrigin(request:NextRequest){const origin=request.headers.get('origin');const expected=new URL(process.env.AUTH_URL||request.url).origin;if(origin!==expected||!request.headers.get('content-type')?.startsWith('application/json'))throw new GitHubError('Origen de la solicitud no permitido.',403);}
export function apiError(error:unknown){const e=error as {status?:number;message?:string;branch?:string};return Response.json({error:e.status?e.message:'No se pudo completar la solicitud. Inténtalo de nuevo.',...(e.branch?{branch:e.branch}:{})},{status:e.status&&e.status>=400&&e.status<=599?e.status:500,headers:{'Cache-Control':'no-store'}});}
