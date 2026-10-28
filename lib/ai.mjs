/** Provider-agnostic chat client. Any OpenAI-compatible endpoint works: switch with env vars only. */
export class AgentError extends Error{constructor(message,status=500){super(message);this.status=status;}}
const presets={
 gemini:{baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-2.5-flash'},
 groq:{baseUrl:'https://api.groq.com/openai/v1',model:'llama-3.3-70b-versatile'},
 openrouter:{baseUrl:'https://openrouter.ai/api/v1',model:'meta-llama/llama-3.3-70b-instruct:free'},
 anthropic:{baseUrl:'https://api.anthropic.com/v1',model:'claude-haiku-5-5'},
};
export function aiConfig(env=process.env){
 if(!env.AI_API_KEY)return null;
 const provider=env.AI_PROVIDER||'gemini',preset=presets[provider];
 const baseUrl=env.AI_BASE_URL||preset?.baseUrl,model=env.AI_MODEL||preset?.model;
 if(!baseUrl||!model)return null;
 return {provider,model,key:env.AI_API_KEY,baseUrl:baseUrl.replace(/\/$/,'')};
}
const MAX_WAIT_MS=12000,RETRIES=2;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
/** Seconds the provider asks us to wait: Retry-After, else the token-window reset ("585ms", "1.5s", "1m2s"). */
function waitMs(headers){
 const retry=Number(headers.get('retry-after'));if(retry>0)return retry*1000;
 const reset=headers.get('x-ratelimit-reset-tokens')||'';
 const m=/^(?:(\d+)m)?(?:([\d.]+)s)?(?:([\d.]+)ms)?$/.exec(reset);
 return m?(Number(m[1]||0)*60+Number(m[2]||0))*1000+Number(m[3]||0):2000;
}
/** Claude's OpenAI-compatible endpoint rejects a temperature below 1 on current models and wants an explicit token cap; every other provider keeps the cool 0.1. */
export function requestBody(config,messages,tools){
 return {model:config.model,messages,tools,tool_choice:'auto',...(config.provider==='anthropic'?{max_tokens:4096}:{temperature:0.1})};
}
export function createChat(config,fetcher=fetch,sleep=pause){
 return async function chat({messages,tools}){
  let response;
  for(let attempt=0;;attempt++){
   try{response=await fetcher(`${config.baseUrl}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify(requestBody(config,messages,tools)),signal:AbortSignal.timeout(40000)});}
   catch{throw new AgentError('El modelo de IA no respondió a tiempo. Inténtalo de nuevo.',504);}
   if(response.status!==429||attempt>=RETRIES)break;
   const wait=waitMs(response.headers)+250;
   if(wait>MAX_WAIT_MS)break;
   await sleep(wait);
  }
  if(response.status===429)throw new AgentError('El modelo de IA alcanzó su límite de uso. Espera un minuto e inténtalo de nuevo.',429);
  if(response.status===401||response.status===403)throw new AgentError('La clave del modelo de IA no es válida en el servidor.',503);
  if(!response.ok){
   const body=await response.json().catch(()=>null),detail=body?.error;
   // A malformed tool call comes back as 400 with the attempted text: hand it to the agent, which can still recover or retry it.
   if(response.status===400&&detail?.code==='tool_use_failed'&&typeof detail.failed_generation==='string')return {role:'assistant',content:detail.failed_generation.slice(0,6000)};
   const why=typeof detail?.message==='string'?`: ${detail.message.replace(/\s+/g,' ').slice(0,160)}`:'';
   throw new AgentError(`El modelo de IA devolvió un error (${response.status})${why}`,502);
  }
  const data=await response.json().catch(()=>null);
  const message=data?.choices?.[0]?.message;
  if(!message)throw new AgentError('El modelo de IA devolvió una respuesta vacía.',502);
  return message;
 };
}
