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
test('Axel reacts to a security report without ever promising the code is safe',()=>{
 assert.equal(axelGuide({busy:'security'}).mood,'thinking');
 const bad=axelGuide({security:{total:3,serious:1}});assert.equal(bad.mood,'worried');assert.match(bad.title,/3 cosas/);assert.match(bad.text,/graves/);
 assert.match(axelGuide({security:{total:1,serious:0}}).title,/1 cosa por revisar/);
 const clean=axelGuide({security:{total:0,serious:0}});assert.equal(clean.mood,'happy');assert.match(clean.text,/No es una garantía/);
 assert.equal(axelGuide({security:{total:2,serious:0},agentSummary:true}).title,'Tengo una propuesta');
});
test('Axel warns when the automatic check of a proposal finds something',()=>{
 const g=axelGuide({agentSummary:true,proposalIssues:2});assert.equal(g.mood,'worried');assert.match(g.title,/Ojo con esta propuesta/);
 assert.equal(axelGuide({agentSummary:true,proposalIssues:0}).title,'Tengo una propuesta');
});
test('after a PR is created Axel points to the next pending finding',()=>{
 const more=axelGuide({published:true,security:{total:5,serious:1,remaining:3}});
 assert.equal(more.mood,'happy');assert.match(more.text,/quedan 3 hallazgos/);assert.match(more.text,/Proponer arreglo/);
 assert.match(axelGuide({published:true,security:{total:5,serious:1,remaining:1}}).text,/queda 1 hallazgo/);
 assert.match(axelGuide({published:true,security:{total:5,serious:1,remaining:0}}).text,/Arreglar CI/);
 assert.match(axelGuide({published:true}).text,/Arreglar CI/);
});
