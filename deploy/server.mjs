// Servidor de producción de DevSentinel AI.
// El hosting compartido bloquea escuchar por TCP, así que la app escucha en un socket de archivo (app.sock)
// y el proxy PHP se conecta a él. Para probar en local: PORT=3130 node deploy/server.mjs
import {createServer} from 'node:http';
import {chmodSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import next from 'next';
const dir=process.cwd(),socket=process.env.SOCKET_PATH||'',port=Number(process.env.PORT)||0;
if(!socket&&!port){console.error('Define SOCKET_PATH (producción) o PORT (pruebas en local).');process.exit(1);}
const app=next({dev:false,dir,hostname:'localhost',port:port||3000});
const handle=app.getRequestHandler();
await app.prepare();
if(socket&&existsSync(socket))unlinkSync(socket);
const server=createServer((request,response)=>handle(request,response));
server.on('error',error=>{console.error('No se pudo escuchar:',error.code,error.message);process.exit(1);});
if(socket)server.listen(socket,()=>{chmodSync(socket,0o660);console.log('Escuchando en el socket',socket);});
else server.listen(port,'127.0.0.1',()=>console.log('Escuchando en http://127.0.0.1:'+port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{if(socket)try{unlinkSync(socket);}catch{}process.exit(0);}));
