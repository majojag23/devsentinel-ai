/** What Axel, the guide, says for each moment of the Studio. Pure: state in, message out. */
const hints=[
 [/reemplazar|casilla/i,'Tienes cambios sin publicar. Si quieres descartarlos, marca la casilla "Permitir reemplazar mis cambios" junto a Cargar y vuelve a pulsar.'],
 [/inicia sesi|sesión|Acceder|acceso a github/i,'Entra con GitHub desde "Acceder" (arriba a la derecha) y vuelve a intentarlo.'],
 [/límite|espera|varios análisis|demasiad/i,'Es un límite de uso para cuidar la cuota gratuita. Espera un minuto y vuelve a pulsar el botón.'],
 [/permisos de escritura/i,'Solo puedo proponer cambios en repositorios donde tú puedes escribir. Prueba con uno tuyo.'],
 [/públic/i,'Este repositorio es privado y el acceso a repos privados no está activado en este servidor.'],
 [/ya fue publicado|ya existe/i,'Ese cambio ya existe en GitHub. Búscalo en la lista de Pull requests del repositorio.'],
 [/en curso/i,'La CI todavía está corriendo. Espera 1 o 2 minutos y vuelve a probar.'],
 [/no tiene fallos/i,'Buena noticia: esa CI está en verde. No hay nada que arreglar.'],
 [/forks/i,'Aún no sé trabajar con PRs que vienen de un fork. Prueba con un PR de una rama del mismo repositorio.'],
 [/cerrado/i,'Ese PR ya está cerrado. Elige uno que siga abierto.'],
 [/no encontramos|404/i,'Revisa que el repositorio, el archivo y la rama estén escritos exactamente como en GitHub. Si es un repositorio privado, comprueba que la GitHub App de DevSentinel esté instalada en él.'],
 [/formato propietario/i,'El repositorio se escribe así: dueño/nombre, por ejemplo majojag23/mi-app.'],
 [/cambió desde|rama cambió/i,'Alguien cambió la rama mientras trabajabas. Vuelve a cargar el archivo y revisa el diff otra vez.'],
 [/tardó demasiado|no respondió/i,'El modelo de IA se demoró. Prueba de nuevo con una descripción más concreta.'],
];
export function explainError(message){
 const text=String(message||'');
 for(const [pattern,hint] of hints)if(pattern.test(text))return hint;
 return 'Revisa lo que escribiste (repositorio, archivo y rama) y vuelve a intentarlo. Si sigue igual, avísale a tu equipo.';
}
export const steps=['Elige tu repositorio','Pídeme el arreglo','Revisa y aprueba'];
export function axelGuide({busy='',error='',reviewing=false,published=false,changed=false,agentSummary=false,agentNoFix=false,github=false,security=null,proposalIssues=0}={}){
 const base={step:github?2:1,done:false};
 if(busy==='load')return {...base,mood:'thinking',title:'Trayendo tu archivo',text:'Estoy descargando el archivo de GitHub. Solo lo leo, no cambio nada.'};
 if(busy==='agent')return {...base,step:2,mood:'thinking',title:'Investigando',text:'Estoy leyendo tu repositorio para encontrar la causa. Puede tardar hasta un minuto.'};
 if(busy==='ci')return {...base,step:2,mood:'thinking',title:'Leyendo la CI',text:'Estoy viendo por qué falló la CI de ese PR y qué archivo hay que tocar.'};
 if(busy==='security')return {...base,mood:'thinking',title:'Revisando la seguridad',text:'Estoy leyendo solo las líneas que cambió el PR y consultando las vulnerabilidades conocidas de sus dependencias.'};
 if(busy==='publish')return {...base,step:3,mood:'determined',title:'Creando tu PR',text:'Lo dejo en borrador y en una rama aparte. Tu rama principal no se toca.'};
 if(error)return {...base,mood:'worried',title:'Algo no salió bien',text:explainError(error),detail:error};
 if(reviewing)return {step:3,done:false,mood:'determined',title:'Aquí decides tú',text:'Lee el diff: lo rojo se quita y lo verde se agrega. Si te convence, aprueba. Sin tu aprobación no publico nada.'};
 if(published)return {step:3,done:true,mood:'happy',title:'¡PR creado!',text:security&&security.remaining>0?`Ábrelo en GitHub cuando quieras. Te ${security.remaining===1?'queda 1 hallazgo':'quedan '+security.remaining+' hallazgos'} del informe: elige otro y pulsa "Proponer arreglo".`:'Ábrelo en GitHub y espera 1 o 2 minutos a que corra la CI. Si falla, vuelve aquí y pulsa "Arreglar CI" con su número.'};
 if(agentNoFix)return {...base,step:2,mood:'surprised',title:'No encontré un cambio seguro',text:'Cuéntame más: en qué archivo pasa, qué esperabas y qué ocurre en realidad. Mientras más concreto, mejor.'};
 if(agentSummary&&proposalIssues>0)return {step:3,done:false,mood:'worried',title:'Ojo con esta propuesta',text:'Mi comprobación automática encontró algo en el cambio, aunque el resumen del agente suene bien. Léela antes de aprobar.'};
 if(agentSummary||changed)return {step:3,done:false,mood:'determined',title:'Tengo una propuesta',text:'Revisa el diff y, si estás de acuerdo, pulsa "Revisar y preparar PR". Puedes editar el código antes.'};
 if(security&&security.total>0)return {...base,mood:'worried',title:'Encontré '+security.total+(security.total===1?' cosa por revisar':' cosas por revisar'),text:(security.serious?'Empieza por las graves, las marcadas en rojo. ':'')+'En cada una te explico el riesgo y cómo arreglarlo. Si el PR es de tu repositorio, puedo proponer el cambio.'};
 if(security)return {...base,mood:'happy',title:'No vi problemas',text:'Con mis reglas no encontré nada en las líneas que cambió el PR. No es una garantía: pide también una revisión de una persona.'};
 if(github)return {...base,mood:'neutral',title:'Archivo cargado',text:'Describe el problema y pulsa "Proponer arreglo". Si lo que falla es un PR, usa "Arreglar CI" con su número.'};
 return {...base,mood:'neutral',title:'Hola, soy Axel',text:'Te guío paso a paso. Primero escribe tu repositorio, por ejemplo dueño/nombre, y pulsa "Cargar".'};
}

/** Touch Axel and he laughs for a moment. Three phrases that take turns when you keep tickling him. */
export const TICKLE_MS=3400;
export const tickleLines=[
 {title:'¡Jajaja, eso hace cosquillas!',text:'¡Eh, eh! Hasta un centinela tiene un punto débil. Dame un segundo para recuperar mi seriedad… 😂'},
 {title:'¡Otra vez nooo! 😂',text:'¡Jajaja! Está bien, me descubriste: prefiero las cosquillas a los bugs. Ahora sí, seguimos juntos.'},
 {title:'¡Me rindo, me rindo!',text:'¡Ja, ja, ja! Prometo vigilar tu código… ¡pero deja mis orejas tranquilas! 🐾'},
];
export const tickleLine=n=>tickleLines[((n%tickleLines.length)+tickleLines.length)%tickleLines.length];
