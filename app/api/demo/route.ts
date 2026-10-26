import {runDemo} from '../../../lib/demo.mjs';
export const runtime='nodejs';
// Public endpoint that spawns processes: allow one run at a time and 6 runs/min per client.
const hits=new Map<string,number[]>();
let busy=false;
function limited(ip:string){const now=Date.now();const recent=(hits.get(ip)||[]).filter(t=>now-t<60000);recent.push(now);hits.set(ip,recent);if(hits.size>500)for(const [k,v] of hits)if(!v.some(t=>now-t<60000))hits.delete(k);return recent.length>6;}
export async function POST(request:Request){
 const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'local';
 if(limited(ip))return Response.json({error:'Demasiadas ejecuciones. Espera un minuto e inténtalo de nuevo.'},{status:429,headers:{'Retry-After':'60'}});
 if(busy)return Response.json({error:'Hay un análisis en curso. Inténtalo en unos segundos.'},{status:429,headers:{'Retry-After':'5'}});
 busy=true;
 try{return Response.json(await runDemo(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'No se pudo ejecutar el entorno de pruebas.'},{status:500});}finally{busy=false;}
}
