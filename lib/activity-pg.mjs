/** Per-user activity history in Postgres. Same interface as createActivityStore; stores summaries only: never code, tokens or secrets. */
import {createHash,randomBytes} from 'node:crypto';
import {cleanEvent} from './activity.mjs';
const MAX_EVENTS=200;
const SCHEMA=`CREATE TABLE IF NOT EXISTS activity_events (
 seq BIGSERIAL PRIMARY KEY,
 user_key TEXT NOT NULL,
 id TEXT NOT NULL,
 at TEXT NOT NULL,
 event JSONB NOT NULL
)`;
const INDEX='CREATE INDEX IF NOT EXISTS activity_events_user_idx ON activity_events (user_key, seq)';
/** `pool` only needs `query(text, params)`, which is what pg.Pool offers. */
export function createPgActivityStore({pool,now=()=>new Date()}){
 const queues=new Map();
 const key=user=>createHash('sha256').update(String(user).toLowerCase()).digest('hex').slice(0,24);
 let ready;
 const ensure=()=>ready??=(async()=>{await pool.query(SCHEMA);await pool.query(INDEX);})().catch(error=>{ready=undefined;throw error;});
 // One write at a time per user, as in the file store.
 function locked(user,work){const k=key(user),previous=queues.get(k)||Promise.resolve();const next=previous.catch(()=>{}).then(async()=>{await ensure();return work(k);});queues.set(k,next);next.finally(()=>{if(queues.get(k)===next)queues.delete(k);}).catch(()=>{});return next;}
 const parse=row=>typeof row.event==='string'?JSON.parse(row.event):row.event;
 return {
  add:(user,input)=>locked(user,async k=>{
   const event={id:randomBytes(5).toString('hex'),at:now().toISOString(),...cleanEvent(input)};
   await pool.query('INSERT INTO activity_events (user_key, id, at, event) VALUES ($1, $2, $3, $4)',[k,event.id,event.at,JSON.stringify(event)]);
   await pool.query('DELETE FROM activity_events WHERE user_key = $1 AND seq NOT IN (SELECT seq FROM activity_events WHERE user_key = $1 ORDER BY seq DESC LIMIT $2)',[k,MAX_EVENTS]);
   return event;
  }),
  update:(user,id,patch)=>locked(user,async k=>{
   const found=await pool.query('SELECT event FROM activity_events WHERE user_key = $1 AND id = $2',[k,id]);
   if(!found.rows.length)return null;
   const current=parse(found.rows[0]);
   const updated={...current,...cleanEvent({...current,...patch}),id:current.id,at:current.at};
   await pool.query('UPDATE activity_events SET event = $3 WHERE user_key = $1 AND id = $2',[k,id,JSON.stringify(updated)]);
   return updated;
  }),
  list:async(user,limit=MAX_EVENTS)=>{await ensure();const r=await pool.query('SELECT event FROM activity_events WHERE user_key = $1 ORDER BY seq DESC LIMIT $2',[key(user),Math.max(1,Math.min(MAX_EVENTS,Number(limit)||MAX_EVENTS))]);return r.rows.map(parse);},
  clear:user=>locked(user,async k=>{await pool.query('DELETE FROM activity_events WHERE user_key = $1',[k]);}),
 };
}
