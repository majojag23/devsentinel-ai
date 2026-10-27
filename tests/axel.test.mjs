import {test} from 'node:test';
import assert from 'node:assert/strict';
import {axelGuide,explainError,steps} from '../lib/axel.mjs';
test('Axel starts as a friendly guide and follows the three steps',()=>{
 assert.equal(axelGuide().step,1);assert.equal(axelGuide().mood,'neutral');
 assert.equal(axelGuide({github:true}).step,2);
 assert.equal(axelGuide({agentSummary:true,github:true}).step,3);
 assert.equal(steps.length,3);
});
test('busy states win over everything and use thinking or determined',()=>{
 assert.equal(axelGuide({busy:'agent',error:'x',published:true}).mood,'thinking');
 assert.equal(axelGuide({busy:'ci'}).step,2);
 assert.equal(axelGuide({busy:'publish'}).mood,'determined');
});
test('errors are explained in plain words with a next step and keep the original detail',()=>{
 const g=axelGuide({error:'GitHub devolvió un error (404).'});
 assert.equal(g.mood,'worried');assert.match(g.text,/repositorio, el archivo y la rama/);assert.equal(g.detail,'GitHub devolvió un error (404).');
 assert.match(explainError('Inicia sesión con GitHub para continuar.'),/Acceder/);
 assert.match(explainError('El modelo de IA alcanzó su límite de uso.'),/Espera un minuto/);
 assert.match(explainError('La CI de ese PR no tiene fallos.'),/verde/);
 assert.match(explainError('Confirma que puedes reemplazar los cambios actuales marcando la casilla junto a Cargar.'),/Permitir reemplazar/);
 assert.match(explainError('algo raro'),/Revisa lo que escribiste/);
});
test('review, success and no-fix moments tell the user what to do next',()=>{
 assert.match(axelGuide({reviewing:true}).text,/Sin tu aprobación/);
 const done=axelGuide({published:true});assert.equal(done.mood,'happy');assert.equal(done.done,true);assert.match(done.text,/Arreglar CI/);
 assert.equal(axelGuide({agentNoFix:true}).mood,'surprised');
});
