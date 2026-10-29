import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkVisibility,loadSource} from '../lib/github.mjs';
const FLAG='ALLOW_PRIVATE_REPOS';
const withFlag=async(value,fn)=>{const old=process.env[FLAG];if(value===undefined)delete process.env[FLAG];else process.env[FLAG]=value;try{return await fn();}finally{if(old===undefined)delete process.env[FLAG];else process.env[FLAG]=old;}};
const gh=priv=>async path=>{
 if(/\/git\/ref\//.test(path))return {object:{sha:'a'.repeat(40)}};
 if(/\/contents\//.test(path))return {type:'file',encoding:'base64',size:5,sha:'b'.repeat(40),content:Buffer.from('hola\n').toString('base64')};
 return {private:priv,permissions:{push:true}};
};
test('los repos privados se rechazan salvo que el servidor los active expresamente',async()=>{
 await withFlag(undefined,()=>{assert.throws(()=>checkVisibility({private:true}),e=>e.status===400);checkVisibility({private:false});});
 await withFlag('false',()=>assert.throws(()=>checkVisibility({private:true}),/públicos/));
 await withFlag('true',()=>{checkVisibility({private:true});checkVisibility({private:false});});
});
test('con la opción activa se puede cargar un archivo de un repo privado, y sin ella no',async()=>{
 const input={repository:'o/r',path:'src/a.js',base:'main'};
 await withFlag(undefined,()=>assert.rejects(()=>loadSource(gh(true),input),e=>e.status===400));
 const s=await withFlag('true',()=>loadSource(gh(true),input));
 assert.equal(s.content,'hola\n');
});
test('aunque el repo sea privado, sigue exigiéndose permiso de escritura',async()=>{
 const noPush=async path=>/\/contents\/|\/git\/ref\//.test(path)?{}:{private:true,permissions:{push:false}};
 await withFlag('true',()=>assert.rejects(()=>loadSource(noPush,{repository:'o/r',path:'src/a.js',base:'main'}),e=>e.status===403));
});
