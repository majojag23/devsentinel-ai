/** Deterministic security review of a pull request: only the lines it adds, fixed rules, known-vulnerable dependencies (OSV). No AI, no code execution. */
import {GitHubError} from './github.mjs';
const MAX_FILES=100,MAX_PATCH=100000,MAX_DEPS=40,MAX_FINDINGS=60;
const ORDER={critical:4,high:3,medium:2,low:1};
const skipPath=/(^|\/)(node_modules|vendor|dist|build|coverage|\.next)\/|package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$|\.min\.(js|css)$|\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|woff2?)$/i;
const script=/\.(m?[jt]sx?|cjs)$/i,python=/\.py$/i,anyCode=/\.(m?[jt]sx?|cjs|py|rb|php|go|java|cs|sh)$/i,workflow=/(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i,docs=/\.(md|txt|rst)$/i;
const placeholder=/^(your|example|sample|changeme|change_me|placeholder|replace|insert|dummy|test|todo|xxx+|\*+|<|\$\{|\{\{|%|process\.env|os\.environ|env\.)/i;
const rules=[
 {id:'aws-key',severity:'critical',secret:true,re:/\bAKIA[0-9A-Z]{16}\b/,title:'Clave de acceso de AWS en el código',why:'Quien lea el repositorio puede usar esa clave y gastar o robar datos de tu cuenta de AWS.',fix:'Bórrala del código, revócala en AWS y guárdala en una variable de entorno o en un gestor de secretos.'},
 {id:'github-token',severity:'critical',secret:true,re:/\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,title:'Token de GitHub en el código',why:'Cualquiera con ese token puede actuar como tú en GitHub.',fix:'Revócalo en GitHub (Settings → Developer settings) y usa una variable de entorno.'},
 {id:'private-key',severity:'critical',secret:true,re:/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/,title:'Llave privada en el código',why:'Una llave privada expuesta permite suplantar tu servidor o abrir tus conexiones.',fix:'Elimínala del repositorio, genera una nueva y guárdala fuera del código.'},
 {id:'stripe-live',severity:'critical',secret:true,re:/\b[sr]k_live_[0-9a-zA-Z]{20,}/,title:'Clave en vivo de Stripe en el código',why:'Permite cobrar o reembolsar con tu cuenta real.',fix:'Revócala en el panel de Stripe y usa una variable de entorno.'},
 {id:'google-key',severity:'high',secret:true,re:/\bAIza[0-9A-Za-z_-]{35}\b/,title:'Clave de API de Google en el código',why:'Cualquiera puede usar tu cuota y, según los permisos, tus datos.',fix:'Restríngela o bórrala en Google Cloud y mueve la clave a una variable de entorno.'},
 {id:'slack-token',severity:'high',secret:true,re:/\bxox[baprs]-[A-Za-z0-9-]{10,}/,title:'Token de Slack en el código',why:'Permite leer o enviar mensajes en tu espacio de trabajo.',fix:'Revócalo en Slack y usa una variable de entorno.'},
 {id:'hardcoded-secret',severity:'high',secret:true,notDocs:true,re:/[\w.-]*(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key)\w*["']?\s*[:=]\s*["']([^"'\s]{8,})["']/i,group:1,title:'Contraseña o secreto escrito en el código',why:'Los secretos escritos en el código quedan en el historial de Git para siempre.',fix:'Léelo desde una variable de entorno (por ejemplo process.env.NOMBRE) y cambia el valor que ya se expuso.'},
 {id:'eval',severity:'high',path:script,re:/\beval\s*\(|new\s+Function\s*\(/,title:'Ejecución de código con eval o new Function',why:'Si el texto viene del usuario, puede ejecutar código arbitrario en tu aplicación.',fix:'Evita eval: usa JSON.parse para datos o una función normal para la lógica.'},
 {id:'cmd-injection',severity:'high',path:script,re:/\b(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|"[^"]*"\s*\+|'[^']*'\s*\+)/,title:'Comando del sistema armado con texto variable',why:'Si una parte viene del usuario, puede añadir comandos propios (inyección de comandos).',fix:'Usa execFile o spawn con los argumentos en una lista, sin armar el comando con texto.'},
 {id:'py-shell',severity:'high',path:python,re:/\bos\.system\s*\(|subprocess\.[a-z_]+\([^)]*shell\s*=\s*True/,title:'Comando ejecutado a través del shell',why:'Si una parte viene del usuario, puede ejecutar comandos propios.',fix:'Usa subprocess.run con una lista de argumentos y sin shell=True.'},
 {id:'sql-concat',severity:'high',path:anyCode,re:/\b(?:query|execute|exec|raw)\s*\(\s*(?:`[^`]*\b(?:select|insert|update|delete)\b[^`]*\$\{|"[^"]*\b(?:select|insert|update|delete)\b[^"]*"\s*\+|'[^']*\b(?:select|insert|update|delete)\b[^']*'\s*\+|f["'][^"']*\b(?:select|insert|update|delete)\b)/i,title:'Consulta SQL armada con texto variable',why:'Un valor malicioso puede cambiar la consulta y leer o borrar datos (inyección SQL).',fix:'Usa consultas parametrizadas: el texto de la consulta fijo y los valores aparte.'},
 {id:'tls-off',severity:'high',path:anyCode,re:/rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0|\bverify\s*=\s*False\b/,title:'Verificación de certificados desactivada',why:'Sin verificar el certificado, un atacante en la red puede espiar o alterar la conexión.',fix:'Quita esa opción y, si usas un certificado propio, configúralo como confiable.'},
 {id:'pickle-yaml',severity:'high',path:python,re:/\bpickle\.loads?\(|\byaml\.load\((?![^)]*Loader)/,title:'Lectura insegura de datos (pickle o yaml.load)',why:'Leer datos no confiables con estas funciones puede ejecutar código del atacante.',fix:'Usa json o yaml.safe_load.'},
 {id:'xss',severity:'medium',path:script,re:/\.innerHTML\s*\+?=|dangerouslySetInnerHTML|document\.write\s*\(/,title:'HTML insertado sin limpiar',why:'Si el contenido viene del usuario, puede inyectar scripts en la página (XSS).',fix:'Usa textContent o el texto normal de React; si necesitas HTML, límpialo antes con una librería como DOMPurify.'},
 {id:'cors-any',severity:'medium',path:anyCode,re:/origin\s*:\s*["']\*["']|Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']/i,title:'CORS abierto a cualquier sitio',why:'Cualquier página web puede llamar a tu API desde el navegador de tus usuarios.',fix:'Permite solo los dominios que de verdad usas.'},
 {id:'weak-random',severity:'medium',path:script,re:/Math\.random\(\)/,also:/token|secret|password|session|nonce|apikey|api_key/i,title:'Aleatoriedad débil para algo secreto',why:'Math.random es predecible; un atacante puede adivinar el valor.',fix:'Usa crypto.randomUUID() o crypto.randomBytes().'},
 {id:'weak-hash',severity:'low',path:anyCode,re:/createHash\(\s*["'](?:md5|sha1)["']\s*\)|hashlib\.(?:md5|sha1)\(/,title:'Algoritmo de hash débil (MD5 o SHA-1)',why:'No sirve para contraseñas ni para firmas: se puede romper.',fix:'Para contraseñas usa bcrypt o argon2; para huellas, SHA-256.'},
 {id:'actions-injection',severity:'high',path:workflow,re:/\$\{\{\s*github\.(?:event\.(?:issue|pull_request|comment|review|head_commit)\.[\w.[\]*]*(?:title|body|message|name|label|ref|email)|head_ref)\s*\}\}/,title:'Texto de un PR o issue usado dentro de un comando de Actions',why:'Alguien puede poner comandos en el título o la rama y ejecutarlos en tu flujo de CI.',fix:'Pásalo por una variable de entorno (env:) y úsalo como "$VARIABLE" dentro del comando.'},
 {id:'actions-target',severity:'medium',path:workflow,re:/\bpull_request_target\b/,title:'Flujo con pull_request_target',why:'Corre con permisos del repositorio y, si descarga el código del PR, puede ejecutar código de un desconocido.',fix:'Usa pull_request, o no descargues ni ejecutes el código del PR en ese flujo.'},
 {id:'actions-unpinned',severity:'low',path:workflow,re:/\buses:\s*[\w.-]+\/[\w.-]+@(?:main|master)\b/,title:'Acción de terceros sin versión fija',why:'Si cambian esa rama, tu CI ejecuta código nuevo sin que lo revises.',fix:'Fija una versión o el commit exacto, por ejemplo @v4.'},
];
export const RULE_COUNT=rules.length+2;
const mask=(text,rule,match)=>{const value=rule.group?match[rule.group]:match[0];return text.replace(value,value.slice(0,4)+'••••');};
const snippet=s=>s.trim().replace(/\s+/g,' ').slice(0,140);
/** Findings in the lines a unified-diff patch adds. */
export function scanPatch(path,patch){
 const out=[];
 if(/(^|\/)\.env(\.[\w-]+)?$/.test(path)&&!/\.(example|sample|template|dist)$/.test(path))out.push({id:'env-file',severity:'high',title:'Archivo .env añadido al repositorio',why:'Los archivos .env suelen contener contraseñas y claves reales.',fix:'Quítalo del PR, agrégalo a .gitignore y rota cualquier clave que contenga.',path,line:1,snippet:path});
 if(/\.(pem|key|p12|pfx)$|(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/.test(path))out.push({id:'key-file',severity:'high',title:'Archivo de llave o certificado privado',why:'Las llaves privadas no deben vivir en el repositorio.',fix:'Quítalo del PR, rota la llave y guárdala en un gestor de secretos.',path,line:1,snippet:path});
 let line=0;
 for(const raw of String(patch||'').split('\n')){
  const hunk=/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
  if(hunk){line=Number(hunk[1]);continue;}
  if(raw.startsWith('+')&&!raw.startsWith('+++')){
   const text=raw.slice(1);
   for(const rule of rules){
    if(rule.path&&!rule.path.test(path))continue;
    if(rule.notDocs&&docs.test(path))continue;
    const match=rule.re.exec(text);
    if(!match)continue;
    if(rule.also&&!rule.also.test(text))continue;
    if(rule.id==='hardcoded-secret'&&placeholder.test(match[1]))continue;
    out.push({id:rule.id,severity:rule.severity,title:rule.title,why:rule.why,fix:rule.fix,path,line,snippet:snippet(rule.secret?mask(text,rule,match):text)});
   }
   line++;
  }else if(!raw.startsWith('-')&&!raw.startsWith('\\'))line++;
 }
 return out;
}
const semver=/^[\^~>=<\s]*(\d+\.\d+\.\d+[\w.+-]*)$/;
/** Dependencies a package.json patch adds or bumps: [{name,version,line}]. */
export function addedDependencies(patch){
 const deps=[];let line=0;
 for(const raw of String(patch||'').split('\n')){
  const hunk=/^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
  if(hunk){line=Number(hunk[1]);continue;}
  if(raw.startsWith('+')&&!raw.startsWith('+++')){
   const m=/^\+\s*"(@?[\w./-]+)"\s*:\s*"([^"]+)"\s*,?\s*$/.exec(raw);
   if(m&&!['name','version','node','npm'].includes(m[1])){const v=semver.exec(m[2]);if(v)deps.push({name:m[1],version:v[1],line});}
   line++;
  }else if(!raw.startsWith('-')&&!raw.startsWith('\\'))line++;
 }
 return deps;
}
export function osvClient(fetcher=fetch){
 return async function query(deps){
  const response=await fetcher('https://api.osv.dev/v1/querybatch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queries:deps.map(d=>({package:{name:d.name,ecosystem:'npm'},version:d.version}))}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('osv');
  return ((await response.json()).results||[]).map(r=>(r.vulns||[]).map(v=>v.id));
 };
}
/** Latest published npm version of a package, or null. */
export function npmLatest(fetcher=fetch){
 return async function latest(name){
  try{const response=await fetcher('https://registry.npmjs.org/'+name.split('/').map(encodeURIComponent).join('/')+'/latest',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});if(!response.ok)return null;const v=(await response.json()).version;return typeof v==='string'?v:null;}catch{return null;}
 };
}
/** Minimal patch: only lines of `content` that do not exist in `original` count as added (enough to scan what a proposal really changes). */
export function changedLinesPatch(original,content){
 const counts=new Map();
 for(const l of String(original).split('\n'))counts.set(l,(counts.get(l)||0)+1);
 const body=String(content).split('\n').map(l=>{const n=counts.get(l)||0;if(n>0){counts.set(l,n-1);return ' '+l;}return '+'+l;});
 return `@@ -1,0 +1,${body.length} @@\n`+body.join('\n');
}
/** Line-level secret rules: removing one from the code does not undo its exposure in Git history. */
const SECRET_IDS=new Set(['aws-key','github-token','private-key','stripe-live','google-key','slack-token','hardcoded-secret']);
const secretCounts=(path,text)=>{const counts=new Map();for(const f of scanPatch(path,changedLinesPatch('',text)))if(SECRET_IDS.has(f.id))counts.set(f.id,(counts.get(f.id)||0)+1);return counts;};
/** Re-checks an agent proposal with the same fixed rules and OSV, so its own summary is never taken on trust. */
export async function verifyProposal({path,original,content,osv}){
 const patch=changedLinesPatch(original,content),notes=[],deps=[],reminders=[];
 const findings=scanPatch(path,patch);
 if(/(^|\/)package\.json$/.test(path)){
  const list=addedDependencies(patch).slice(0,MAX_DEPS);
  if(list.length){try{const result=await osv(list);list.forEach((d,i)=>deps.push({name:d.name,version:d.version,ids:result[i]||[]}));}catch{notes.push('No pude consultar OSV para comprobar las versiones nuevas.');}}
 }
 const before=secretCounts(path,original),after=secretCounts(path,content);
 if([...before].some(([id,n])=>n>(after.get(id)||0)))reminders.push('Quitar la clave del código no basta: ya quedó en el historial de Git de este repositorio. Revócala o cámbiala en el servicio (GitHub, AWS, Stripe, Google, Slack…) antes de dar el problema por resuelto.');
 return {findings:findings.slice(0,20),deps,notes,reminders};
}
export async function scanPullRequest({github,osv,repository,pr,latest}){
 if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository||''))throw new GitHubError('Usa el formato propietario/repositorio.');
 const number=Number(pr);if(!Number.isInteger(number)||number<1||number>9999999)throw new GitHubError('Indica un número de PR válido.');
 const prefix=`/repos/${repository}`;
 const repo=await github(prefix);
 if(repo.private)throw new GitHubError('Esta versión solo admite repositorios públicos.');
 const data=await github(`${prefix}/pulls/${number}`);
 const files=await github(`${prefix}/pulls/${number}/files?per_page=${MAX_FILES}`);
 const findings=[],notes=[],depsFound=[];
 let reviewed=0,skipped=0;
 for(const file of Array.isArray(files)?files:[]){
  if(file.status==='removed'||skipPath.test(file.filename)){skipped++;continue;}
  if(typeof file.patch!=='string'||file.patch.length>MAX_PATCH){if(!/(^|\/)\.env/.test(file.filename)){skipped++;notes.push(`No pude revisar ${file.filename} (archivo muy grande o sin vista previa).`);continue;}}
  reviewed++;
  findings.push(...scanPatch(file.filename,file.patch));
  if(/(^|\/)package\.json$/.test(file.filename))depsFound.push(...addedDependencies(file.patch).map(d=>({...d,path:file.filename})));
 }
 if(Array.isArray(files)&&files.length>=MAX_FILES)notes.push(`El PR tiene ${MAX_FILES} archivos o más: solo revisé los primeros ${MAX_FILES}.`);
 let depsChecked=0;
 if(depsFound.length){
  const list=depsFound.slice(0,MAX_DEPS);
  try{
   const result=await osv(list);depsChecked=list.length;
   const vulnerable=[];
   list.forEach((d,i)=>{const ids=result[i]||[];if(ids.length)vulnerable.push({d,ids});});
   for(const {d,ids} of vulnerable){
    let fix='Actualiza a una versión corregida; los avisos de OSV dicen cuál.',newest=null;
    if(latest&&vulnerable.length<=10){
     newest=await latest(d.name);
     if(newest&&newest!==d.version){try{const check=(await osv([{name:d.name,version:newest}]))[0]||[];fix=check.length?`La última versión publicada (${newest}) todavía tiene ${check.length} aviso${check.length===1?'':'s'} en OSV (${check.slice(0,3).join(', ')}). Revisa si hay una alternativa.`:`Actualiza a ${newest}, la última versión publicada: OSV no lista vulnerabilidades para ella.`;}catch{newest=null;}}
    }
    findings.push({id:'dep-vuln',severity:'medium',title:`${d.name}@${d.version} tiene vulnerabilidades conocidas`,why:`La base OSV lista ${ids.length}: ${ids.slice(0,4).join(', ')}${ids.length>4?'…':''}.`,fix,path:d.path,line:d.line,snippet:`${d.name} ${d.version}`,url:'https://osv.dev/vulnerability/'+ids[0]});
   }
  }catch{notes.push('No pude consultar la base de vulnerabilidades OSV; las dependencias nuevas quedaron sin revisar.');}
  if(depsFound.length>MAX_DEPS)notes.push(`El PR cambia ${depsFound.length} dependencias: solo consulté ${MAX_DEPS}.`);
 }
 findings.sort((a,b)=>ORDER[b.severity]-ORDER[a.severity]||a.path.localeCompare(b.path)||a.line-b.line);
 const counts={critical:0,high:0,medium:0,low:0};for(const f of findings)counts[f.severity]++;
 const sameRepo=data.head?.repo?.full_name?.toLowerCase()===repository.toLowerCase();
 const fixBlock=data.state!=='open'?'closed':!sameRepo?'fork':!repo.permissions?.push?'no-write':'';
 return {repository,pr:number,title:String(data.title||'').slice(0,200),base:data.head?.ref||'',canFix:!fixBlock,fixBlock,findings:findings.slice(0,MAX_FINDINGS),total:findings.length,counts,reviewed,skipped,depsChecked,rules:RULE_COUNT,notes};
}
