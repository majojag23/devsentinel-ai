import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeBody,decodeBody} from '../lib/wire.mjs';
test('el cuerpo codificado no contiene el texto original y se recupera igual',()=>{
 const value={content:'SELECT * FROM users; DROP TABLE x;--\ncat /etc/passwd | sh\n¡ñandú! 日本語 😀',summary:'a "b"',approved:true};
 const body=encodeBody(value);
 assert.ok(!/SELECT|passwd|DROP/.test(body));
 assert.deepEqual(decodeBody(body),value);
});
test('un archivo grande (150 KB) sobrevive al viaje',()=>{
 const content='línea de código ñ\n'.repeat(9000);assert.ok(content.length>150000);
 assert.equal(decodeBody(encodeBody({content})).content,content);
});
test('un cuerpo JSON normal sigue funcionando y uno roto falla',()=>{
 assert.deepEqual(decodeBody('{"repository":"o/r"}'),{repository:'o/r'});
 assert.throws(()=>decodeBody('no es json'));
});
