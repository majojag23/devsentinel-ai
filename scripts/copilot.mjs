import {investigateWithCopilot} from '../lib/copilot.mjs';
try {console.log(JSON.stringify(await investigateWithCopilot(),null,2));}catch(e){console.error('Copilot no pudo completar el análisis:',e.message);process.exitCode=1;}
