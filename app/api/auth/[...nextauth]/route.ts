import {handlers,authReady} from '../../../../auth';
import type {NextRequest} from 'next/server';
export const runtime='nodejs';
export async function GET(request:NextRequest){if(!authReady)return Response.json({error:'OAuth pendiente de configurar.'},{status:503});return handlers.GET(request);}
export async function POST(request:NextRequest){if(!authReady)return Response.json({error:'OAuth pendiente de configurar.'},{status:503});return handlers.POST(request);}
