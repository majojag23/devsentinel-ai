import {runDemo} from '../../../lib/demo.mjs';
export const runtime='nodejs';
export async function POST(){try{return Response.json(await runDemo());}catch{return Response.json({error:'No se pudo ejecutar el entorno de pruebas.'},{status:500});}}
