/** Per-user activity history in small JSON files. Stores summaries only: never code, tokens or secrets. */
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,rename,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
const MAX_EVENTS=200,TYPES=['repair','security'],STATUSES=['proposed','published','no-fix','reviewed'],SOURCES=['manual','ci','security'],SEVERITIES=['critical','high','medium','low'];
const str=(v,n)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,n):'';
const num=v=>Number.isInteger(v)&&v>=0&&v<1e9?v:undefined;
/** Keeps only known, bounded fields of an event. */
export function cleanEvent(input){
 const e={type:TYPES.includes(input?.type)?input.type:'repair',status:STATUSES.includes(input?.status)?input.status:'reviewed',source:SOURCES.includes(input?.source)?input.source:'manual',repo:str(input?.repo,100),title:str(input?.title,160)};
 for(const [k,n] of [['summary',700],['path',200],['base',150],['url',300],['message',500]]){const v=str(input?.[k],n);if(v)e[k]=v;}
 for(const k of ['pr','number','total','line'])if(num(input?.[k])!==undefined)e[k]=input[k];
 if(input?.counts&&typeof input.counts==='object'){e.counts={};for(const s of SEVERITIES)e.counts[s]=num(input.counts[s])||0;}
 if(input?.verification&&typeof input.verification==='object')e.verification={ok:!!input.verification.ok,issues:num(input.verification.issues)||0};
 if(Array.isArray(input?.findings))e.findings=input.findings.slice(0,10).map(f=>({severity:SEVERITIES.includes(f?.severity)?f.severity:'low',title:str(f?.title,140),path:str(f?.path,200),line:num(f?.line)||0}));
 if(Array.isArray(input?.events))e.events=input.events.slice(0,14).map(x=>({type:['thought','action','observation'].includes(x?.type)?x.type:'observation',text:str(x?.text,300)}));
 return e;
}
export function createActivityStore({dir,now=()=>new Date()}){
 const queues=new Map();
 const file=user=>join(dir,createHash('sha256').update(String(user).toLowerCase()).digest('hex').slice(0,24)+'.json');
 async function read(user){try{const data=JSON.parse(await readFile(file(user),'utf8'));return Array.isArray(data)?data:[];}catch{return [];}}
 async function write(user,events){await mkdir(dir,{recursive:true});const target=file(user),temp=target+'.'+randomBytes(4).toString('hex')+'.tmp';await writeFile(temp,JSON.stringify(events));await rename(temp,target);}
 // One write at a time per user, so two requests never overwrite each other.
 function locked(user,work){const key=file(user),previous=queues.get(key)||Promise.resolve();const next=previous.catch(()=>{}).then(work);queues.set(key,next);next.finally(()=>{if(queues.get(key)===next)queues.delete(key);}).catch(()=>{});return next;}
 return {
  add:(user,input)=>locked(user,async()=>{const events=await read(user);const event={id:randomBytes(5).toString('hex'),at:now().toISOString(),...cleanEvent(input)};events.unshift(event);await write(user,events.slice(0,MAX_EVENTS));return event;}),
  update:(user,id,patch)=>locked(user,async()=>{const events=await read(user);const i=events.findIndex(e=>e.id===id);if(i<0)return null;events[i]={...events[i],...cleanEvent({...events[i],...patch}),id:events[i].id,at:events[i].at};await write(user,events);return events[i];}),
  list:async(user,limit=MAX_EVENTS)=>(await read(user)).slice(0,limit),
  clear:user=>locked(user,async()=>{await rm(file(user),{force:true});}),
 };
}
/** Real numbers for the dashboard, from the events of the last `days` days. */
export function summarize(events,{days=30,now=Date.now()}={}){
 const since=now-days*864e5,recent=events.filter(e=>Date.parse(e.at)>=since);
 const repairs=recent.filter(e=>e.type==='repair'),security=recent.filter(e=>e.type==='security');
 const pending=events.filter(e=>e.type==='repair'&&e.status==='proposed'&&Date.parse(e.at)>=now-7*864e5);
 const repos=new Map();
 for(const e of events){if(!e.repo)continue;const r=repos.get(e.repo)||{repo:e.repo,events:0,prs:0,last:e.at};r.events++;if(e.status==='published')r.prs++;repos.set(e.repo,r);}
 return {days,analyses:repairs.length,proposals:repairs.filter(e=>e.status==='proposed'||e.status==='published').length,published:repairs.filter(e=>e.status==='published').length,pending:pending.length,securityReviews:security.length,findings:security.reduce((n,e)=>n+(e.total||0),0),repos:[...repos.values()]};
}
