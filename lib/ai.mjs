/** Provider-agnostic chat client. Any OpenAI-compatible endpoint works: switch with env vars only. */
export class AgentError extends Error{constructor(message,status=500){super(message);this.status=status;}}
const presets={
 gemini:{baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-2.5-flash'},
 groq:{baseUrl:'https://api.groq.com/openai/v1',model:'llama-3.3-70b-versatile'},
 openrouter:{baseUrl:'https://openrouter.ai/api/v1',model:'meta-llama/llama-3.3-70b-instruct:free'},
 anthropic:{baseUrl:'https://api.anthropic.com/v1',model:'claude-sonnet-5-5'},
};
export function aiConfig(env=process.env){
 if(!env.AI_API_KEY)return null;
 const provider=env.AI_PROVIDER||'gemini',preset=presets[provider];
 const baseUrl=env.AI_BASE_URL||preset?.baseUrl,model=env.AI_MODEL||preset?.model;
 if(!baseUrl||!model)return null;
 return {provider,model,key:env.AI_API_KEY,baseUrl:baseUrl.replace(/\/$/,'')};
}
export function createChat(config,fetcher=fetch){
 return async function chat({messages,tools}){
  let response;
  try{response=await fetcher(`${config.baseUrl}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages,tools,tool_choice:'auto',temperature:0.1}),signal:AbortSignal.timeout(40000)});}
  catch{throw new AgentError('El modelo de IA no respondió a tiempo. Inténtalo de nuevo.',504);}
  if(response.status===429)throw new AgentError('El modelo de IA alcanzó su límite de uso. Espera un minuto e inténtalo de nuevo.',429);
  if(response.status===401||response.status===403)throw new AgentError('La clave del modelo de IA no es válida en el servidor.',503);
  if(!response.ok)throw new AgentError(`El modelo de IA devolvió un error (${response.status}).`,502);
  const data=await response.json().catch(()=>null);
  const message=data?.choices?.[0]?.message;
  if(!message)throw new AgentError('El modelo de IA devolvió una respuesta vacía.',502);
  return message;
 };
}
