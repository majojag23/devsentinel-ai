import {getToken} from 'next-auth/jwt';
import {auth,authReady} from '../auth';
import type {NextRequest} from 'next/server';
import {createHash} from 'node:crypto';
import {GitHubError,githubClient} from './github.mjs';
export async function requireGitHub(request:NextRequest){
 if(!authReady)throw new GitHubError('Configura OAuth en el servidor antes de conectar GitHub.',503);
 const session=await auth();if(!session?.user)throw new GitHubError('Inicia sesión con GitHub para continuar.',401);
 const secureCookie=new URL(process.env.AUTH_URL||request.url).protocol==='https:';
 const token=await getToken({req:request,secret:process.env.AUTH_SECRET!,secureCookie});
 if(typeof token?.githubAccessToken!=='string')throw new GitHubError('Esta sesión no tiene acceso a GitHub. Inicia sesión con GitHub desde Acceder.',403);
 return token.githubAccessToken;
}
const identities=new Map<string,{login:string;name:string;avatar:string;exp:number}>();
/** GitHub token plus who it belongs to. The identity is looked up once an hour and never stores the token. */
export async function requireUser(request:NextRequest){
 const token=await requireGitHub(request);
 const key=createHash('sha256').update(token).digest('hex').slice(0,24);
 const hit=identities.get(key);
 if(hit&&hit.exp>Date.now())return {token,login:hit.login,name:hit.name,avatar:hit.avatar};
 const me=await githubClient(token)('/user');
 const user={login:String(me.login),name:String(me.name||me.login),avatar:String(me.avatar_url||''),exp:Date.now()+3600e3};
 if(identities.size>500)identities.clear();
 identities.set(key,user);
 return {token,login:user.login,name:user.name,avatar:user.avatar};
}
export function requireSameOrigin(request:NextRequest){const origin=request.headers.get('origin');const expected=new URL(process.env.AUTH_URL||request.url).origin;if(origin!==expected||!request.headers.get('content-type')?.startsWith('application/json'))throw new GitHubError('Origen de la solicitud no permitido.',403);}
export function apiError(error:unknown){const e=error as {status?:number;message?:string;branch?:string};return Response.json({error:e.status?e.message:'No se pudo completar la solicitud. Inténtalo de nuevo.',...(e.branch?{branch:e.branch}:{})},{status:e.status&&e.status>=400&&e.status<=599?e.status:500,headers:{'Cache-Control':'no-store'}});}
