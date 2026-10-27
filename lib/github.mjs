import {createHash} from 'node:crypto';
export class GitHubError extends Error {constructor(message,status=400,branch=undefined){super(message);this.status=status;this.branch=branch;}}
export function validateTarget(input){
 if(!input||typeof input!=='object')throw new GitHubError('Solicitud no válida.');
 const {repository,path,base='main'}=input;
 if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository||''))throw new GitHubError('Usa el formato propietario/repositorio.');
 if(!path||path.length>300||path.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('.'))||!/^[-\w./]+$/.test(path)||! /\.(tsx?|jsx?|mjs|cjs|css|html|json|md|py|go|rs|java|yaml|yml|txt)$/.test(path))throw new GitHubError('Selecciona un archivo de código compatible, sin rutas ocultas ni relativas.');
 if(!/^[\w./-]{1,150}$/.test(base)||base.includes('..')||base.startsWith('/')||base.endsWith('/'))throw new GitHubError('Rama base no válida.');
 return {repository,path,base};
}
export function githubClient(token,fetcher=fetch){return async function request(path,method='GET',body){const response=await fetcher(`https://api.github.com${path}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw new GitHubError(response.status===401?'La sesión de GitHub expiró. Vuelve a iniciar sesión.':response.status===403?'GitHub no autorizó la acción. Comprueba permisos o límites de uso.':response.status===404?'No encontramos el repositorio, rama o archivo con tus permisos.':`GitHub devolvió un error (${response.status}).`,response.status);return data;};}
export const encodePath=path=>path.split('/').map(encodeURIComponent).join('/');
export async function loadSource(client,input){const {repository,path,base}=validateTarget(input);const prefix=`/repos/${repository}`;const repo=await client(prefix);if(repo.private)throw new GitHubError('Esta versión solo admite repositorios públicos.');if(!repo.permissions?.push)throw new GitHubError('Necesitas permisos de escritura sobre este repositorio.',403);const ref=await client(`${prefix}/git/ref/heads/${encodeURIComponent(base)}`);const file=await client(`${prefix}/contents/${encodePath(path)}?ref=${ref.object.sha}`);if(file.type!=='file'||file.encoding!=='base64'||file.size>150000)throw new GitHubError('Solo se admiten archivos de texto de hasta 150 KB.');return {repository,path,base,baseCommit:ref.object.sha,fileSha:file.sha,content:Buffer.from(file.content.replace(/\n/g,''),'base64').toString('utf8')};}
export async function publishProposal(client,input){
 const {repository,path,base}=validateTarget(input);
 if(input.approved!==true)throw new GitHubError('Debes aprobar expresamente el cambio.');
 if(typeof input.content!=='string'||Buffer.byteLength(input.content)>150000)throw new GitHubError('El contenido supera el límite de 150 KB.');
 if(!/^[a-f0-9]{40}$/.test(input.baseCommit||'')||!/^[a-f0-9]{40}$/.test(input.fileSha||''))throw new GitHubError('Carga el archivo de nuevo antes de publicar.');
 const source=await loadSource(client,input);
 if(source.baseCommit!==input.baseCommit||source.fileSha!==input.fileSha)throw new GitHubError('La rama cambió desde que abriste el archivo. Carga la nueva versión y revisa el diff otra vez.',409);
 if(source.content===input.content)throw new GitHubError('No hay cambios para publicar.');
 const digest=createHash('sha256').update(JSON.stringify([repository,path,base,input.baseCommit,input.content])).digest('hex').slice(0,14);
 const branch=`sentinel/edit-${digest}`;
 const prefix=`/repos/${repository}`;
 let created=false;
 try{
 await client(`${prefix}/git/refs`,'POST',{ref:`refs/heads/${branch}`,sha:source.baseCommit});created=true;
 await client(`${prefix}/contents/${encodePath(path)}`,'PUT',{message:`fix: review ${path} with DevSentinel`,content:Buffer.from(input.content,'utf8').toString('base64'),sha:source.fileSha,branch});
 const pr=await client(`${prefix}/pulls`,'POST',{title:`fix: update ${path}`,head:branch,base,draft:true,body:`## Human-approved edit\n\n${typeof input.summary==='string'&&input.summary.trim()?`Change proposed by the DevSentinel AI agent and approved by a human.\n\n> ${input.summary.trim().slice(0,1500).replace(/\n/g,'\n> ')}`:'Manual change proposed through DevSentinel AI.'}\n\n- File: ${path}\n- Reviewed base: ${source.baseCommit}\n- Automated tests: **not executed for this manual edit**\n- Human approval: explicit confirmation before publication\n\nReview the diff and require CI before merging.`});
 return {url:pr.html_url,number:pr.number,branch};
 }catch(error){if(created)throw new GitHubError(`No se completó la publicación. La rama ${branch} conserva los cambios disponibles; revísala en GitHub antes de reintentar.`,502,branch);throw error;}
}
