import {join} from 'node:path';
import pg from 'pg';
import {createActivityStore} from './activity.mjs';
import {createPgActivityStore} from './activity-pg.mjs';
type Store=ReturnType<typeof createActivityStore>;
// One shared store per server process (routes are bundled separately, so keep it on globalThis).
// With DATABASE_URL the history lives in Postgres; without it, in small files (local development and the shared host).
const g=globalThis as unknown as {__devsentinelActivity?:Store};
function build():Store{
 const url=process.env.DATABASE_URL;
 if(!url)return createActivityStore({dir:process.env.DATA_DIR||join(process.cwd(),'data')});
 // Render's internal URL needs no TLS; its external URL does.
 const ssl=/\.render\.com/.test(url)?{rejectUnauthorized:false}:undefined;
 return createPgActivityStore({pool:new pg.Pool({connectionString:url,ssl,max:5})}) as Store;
}
export const activity=g.__devsentinelActivity??=build();
/** History must never break the action it records. */
export async function record<T>(work:()=>Promise<T>):Promise<T|undefined>{try{return await work();}catch{return undefined;}}
