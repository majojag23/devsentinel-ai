import {auth,authReady,googleReady,githubReady} from '../../../auth';
export const dynamic='force-dynamic';
export async function GET(){const session=authReady?await auth():null;return Response.json({user:session?.user??null,googleReady,githubReady},{headers:{'Cache-Control':'no-store'}});}
