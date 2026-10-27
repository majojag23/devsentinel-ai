import {join} from 'node:path';
import {createActivityStore} from './activity.mjs';
// One shared store per server process (routes are bundled separately, so keep it on globalThis).
const g=globalThis as unknown as {__devsentinelActivity?:ReturnType<typeof createActivityStore>};
export const activity=g.__devsentinelActivity??=createActivityStore({dir:process.env.DATA_DIR||join(process.cwd(),'data')});
/** History must never break the action it records. */
export async function record<T>(work:()=>Promise<T>):Promise<T|undefined>{try{return await work();}catch{return undefined;}}
