'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ShieldCheck,LayoutDashboard,GitBranch,GitPullRequest,Activity,Settings,ChevronDown,ArrowUpRight,ArrowRight,Search,Bell,Check,Terminal,Code2,Clock,CheckCheck,X,FlaskConical,Trash2,LoaderCircle} from 'lucide-react';
import {MissionHero} from './components/mission-hero';
import {AccountMenu} from './components/account-menu';
import {Axel,type AxelGuide} from './components/axel';
import {ago,daily,sparkPath} from '../lib/time.mjs';
type Ev=any;
const FILTERS=['Todos','Pendientes','Publicados','Seguridad'];
const STATUS_LABEL:Record<string,string>={proposed:'Pendiente de aprobación',published:'PR creado','no-fix':'Sin cambio',reviewed:'Revisada'};
const SOURCE_LABEL:Record<string,string>={manual:'Manual',ci:'Arreglo de CI',security:'Seguridad'};
const SEV_LABEL:Record<string,string>={critical:'críticos',high:'altos',medium:'medios',low:'bajos'};
/** Colour of an event: how much attention it needs. */
function attention(e:Ev){
 if(e.type==='security'){const c=e.counts||{};return c.critical||c.high?'high':c.medium||c.low?'medium':'low';}
 if(e.status==='no-fix')return 'medium';
 return e.verification&&!e.verification.ok?'medium':'low';
}
function badge(e:Ev){
 if(e.type==='security')return (e.total||0)+(e.total===1?' hallazgo':' hallazgos');
 if(e.status==='no-fix')return 'Sin cambio';
 return e.verification?(e.verification.ok?'Verificada':e.verification.issues+' avisos'):'Propuesta';
}
const kindOf=(e:Ev)=>e.type==='security'?'SEGURIDAD':e.source==='ci'?'CI':'CÓDIGO';
function Landing({note}:{note:string}){
 const guide:AxelGuide={step:0,done:false,mood:'happy',title:'Hola, soy Axel',text:'Soy tu guía. Entra con GitHub y te acompaño paso a paso: yo propongo, tú decides.'};
 return <div className="product-page landing">
  <div className="product-top"><a className="brand" href="/"><span className="brand-icon"><ShieldCheck size={23}/></span><span>devsentinel<span className="ai">AI</span></span></a><AccountMenu/></div>
  <section className="landing-hero">
   <div className="hero-kicker"><span className="signal-dot"/> AUTONOMOUS CODE OPERATIONS</div>
   <h1>Menos bugs.<br/><span>Más control.</span></h1>
   <p>Un agente que arregla código, repara tu CI y revisa la seguridad de cada PR. Tú lo apruebas antes de que nada se publique.</p>
   <div className="hero-actions"><Link className="primary" href="/login">Entrar con GitHub <ArrowUpRight size={16}/></Link><Link className="hero-secondary" href="/studio">Abrir el editor</Link></div>
   {note&&<p className="landing-note" role="status">{note}</p>}
   <div className="hero-caption"><ShieldCheck size={12}/> HUMAN-IN-THE-LOOP <span/> NO AUTO-MERGE</div>
  </section>
  <div className="landing-cards">{[[Code2,'Arregla código','Describe el problema y el agente propone el cambio como un diff que tú revisas.'],[GitPullRequest,'Repara tu CI','Lee por qué falló un PR y propone la corrección sobre su misma rama.'],[ShieldCheck,'Revisa la seguridad','Busca claves expuestas, código peligroso y dependencias con vulnerabilidades conocidas.']].map(([Icon,title,text]:any)=><div key={title}><Icon size={20}/><h3>{title}</h3><p>{text}</p></div>)}</div>
  <Axel guide={guide}/>
 </div>;
}
export default function Home(){
 const [state,setState]=useState<'loading'|'ready'|'anon'|'error'>('loading'),[note,setNote]=useState(''),[data,setData]=useState<any>(null);
 const [nav,setNav]=useState('Overview'),[selected,setSelected]=useState(''),[query,setQuery]=useState(''),[tab,setTab]=useState('summary'),[filter,setFilter]=useState('Todos'),[modal,setModal]=useState(''),[toast,setToast]=useState(''),[busy,setBusy]=useState(false);
 async function load(){
  try{
   const response=await fetch('/api/activity',{cache:'no-store'}),body=await response.json();
   if(response.status===401||response.status===403){setNote(response.status===403?body.error||'':'');setState('anon');return;}
   if(!response.ok)throw Error(body.error);
   setData(body);setState('ready');
  }catch(e:any){setNote(e.message||'No se pudo cargar tu actividad.');setState('anon');}
 }
 useEffect(()=>{load();},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(t);},[toast]);
 const events:Ev[]=useMemo(()=>data?.events||[],[data]);
 const visible=useMemo(()=>events.filter((e:Ev)=>(e.title+' '+e.repo+' '+(e.summary||'')).toLowerCase().includes(query.toLowerCase())&&(filter==='Todos'||(filter==='Pendientes'&&e.status==='proposed')||(filter==='Publicados'&&e.status==='published')||(filter==='Seguridad'&&e.type==='security'))),[events,query,filter]);
 useEffect(()=>{if(state==='ready'&&!events.some((e:Ev)=>e.id===selected))setSelected(events[0]?.id||'');},[state,events,selected]);
 async function clearHistory(){
  setBusy(true);
  try{const response=await fetch('/api/activity',{method:'DELETE',headers:{'Content-Type':'application/json'}});if(!response.ok)throw Error((await response.json()).error);setModal('');setSelected('');await load();setToast('Tu historial se borró.');}
  catch(e:any){setToast(e.message||'No se pudo borrar el historial.');}
  finally{setBusy(false);}
 }
 if(state==='loading')return <div className="product-page"><p className="muted" role="status">Cargando tu centro de control…</p></div>;
 if(state!=='ready')return <Landing note={note}/>;
 const stats=data.stats,user=data.user,ai=data.ai,sel:Ev|undefined=events.find((e:Ev)=>e.id===selected);
 const cards:[string,number,string,any,string,(e:Ev)=>boolean][]=[
  ['Análisis del agente',stats.analyses,`${stats.days} días · ${stats.proposals} con propuesta`,Activity,'',e=>e.type==='repair'],
  ['PR creados',stats.published,`de ${stats.proposals} propuestas`,Code2,'',e=>e.status==='published'],
  ['Esperando aprobación',stats.pending,'Revisión humana requerida',Clock,'amber',e=>e.status==='proposed'],
  ['Revisiones de seguridad',stats.securityReviews,`${stats.findings} hallazgos`,ShieldCheck,'',e=>e.type==='security'],
 ];
 const guide:AxelGuide=!events.length?{step:0,done:false,mood:'neutral',title:'Todavía no hay actividad',text:'Abre el editor y pídele algo al agente. Aquí verás todo lo que haga, con su comprobación y sus PR.'}
  :stats.pending>0?{step:0,done:false,mood:'determined',title:stats.pending===1?'Tienes 1 propuesta esperando':`Tienes ${stats.pending} propuestas esperando`,text:'Revísalas en el editor. Yo no publico nada sin tu aprobación.'}
  :{step:0,done:false,mood:'happy',title:'Todo al día',text:'No tienes propuestas pendientes. Cuando quieras, arregla una CI o revisa la seguridad de un PR.'};
 const published=events.filter((e:Ev)=>e.status==='published');
 const tabs:[string,string,any][]=[['summary','Resumen',Code2],['activity','Actividad',Terminal],...(sel?.type==='security'?[['findings','Hallazgos',FlaskConical] as [string,string,any]]:[])];
 return <div className="shell"><aside className="sidebar"><a className="brand" href="/"><span className="brand-icon"><ShieldCheck size={23}/></span><span>devsentinel<span className="ai">AI</span></span></a>
  <button className="workspace" onClick={()=>setModal('settings')}><span className="workspace-avatar" style={user.avatar?{backgroundImage:`url(${user.avatar})`,backgroundSize:'cover',color:'transparent'}:undefined}>{user.login[0]}</span><span>{user.login}<small>Cuenta de GitHub</small></span><ChevronDown size={15}/></button>
  <div className="nav-label">WORKSPACE</div>
  <nav>{[[LayoutDashboard,'Overview','Centro de control'],[Activity,'Agent activity','Actividad del agente'],[GitBranch,'Repositories','Repositorios'],[GitPullRequest,'Pull requests','Pull requests']].map(([Icon,key,label]:any)=><button key={key} className={nav===key?'active':''} onClick={()=>setNav(key)}><Icon size={18}/>{label}{key==='Overview'&&stats.pending>0&&<span className="nav-count">{stats.pending}</span>}</button>)}</nav>
  <div className="nav-label second">MANAGE</div>
  <nav><button onClick={()=>setModal('settings')}><Settings size={18}/>Configuración</button></nav>
  <div className="sidebar-bottom"><div className="agent-card"><span className="online-dot"/> SENTINEL ENGINE<small>{ai?ai.model:'Sin modelo configurado'}</small><div className="tiny-bars">{[8,16,11,22,14,26,18,12,21,28,16,23,12,18,26,16,24,13,19,25,17,12].map((h,i)=><i key={i} style={{height:h}}/>)}</div></div>
  <button className="profile" onClick={()=>setModal('settings')}><span className="avatar">{(user.name||user.login).slice(0,2).toUpperCase()}</span><span>{user.name||user.login}<small>GitHub</small></span><ChevronDown size={15}/></button></div></aside>
  <div className="main"><header><div className="breadcrumbs"><Terminal size={14}/> devsentinel <span>/</span> <b>centro-de-control</b></div>
   <div className="header-right"><span className="demo-tag" title="Modelo de IA configurado en el servidor"><span/> {ai?'IA · '+ai.model:'IA sin configurar'}</span><button className="icon-button" aria-label="Notificaciones" onClick={()=>setToast(stats.pending>0?`Tienes ${stats.pending} ${stats.pending===1?'propuesta esperando':'propuestas esperando'} tu aprobación.`:'No hay propuestas pendientes.')}><Bell size={18}/></button><AccountMenu/></div></header>
  <main><MissionHero title={nav} latest={events[0]||null} model={ai?.model||''}/>
   <div className="stats">{cards.map(([label,value,sub,Icon,tone,pick],i)=><div className="stat" key={label}><div>{label}<Icon size={17}/></div><strong>{String(value).padStart(2,'0')}</strong><small className={tone}>{sub}</small><svg className={'spark spark'+i} viewBox="0 0 100 35"><path d={sparkPath(daily(events,pick))}/></svg></div>)}</div>
   <div className="section-title"><h2>{nav==='Repositories'?'Repositorios con actividad':nav==='Pull requests'?'Pull requests creados':nav==='Agent activity'?'Todo lo que hizo el agente':'Centro de operaciones'} <button className="text-button" onClick={load}><Clock size={13}/> Actualizar</button></h2><span className="muted">{stats.days} DÍAS · {stats.repos.length} {stats.repos.length===1?'REPO':'REPOS'}</span></div>
   {nav==='Repositories'?(stats.repos.length?<div className="panel repo-grid">{stats.repos.map((r:any)=><button key={r.repo} className="repository" onClick={()=>{setNav('Overview');setQuery(r.repo)}}><GitBranch/> <b>{r.repo}</b><span>{r.events} {r.events===1?'evento':'eventos'} · {r.prs} PR · Ver actividad <ArrowRight size={14}/></span></button>)}</div>:<div className="panel empty"><GitBranch size={32}/><h2>Todavía no hay repositorios</h2><p>Aparecen aquí en cuanto el agente analice o revises uno desde el editor.</p><Link className="secondary" href="/studio">Abrir el editor</Link></div>)
   :nav==='Pull requests'?(published.length?<div className="panel repo-grid">{published.map((e:Ev)=><a key={e.id} className="repository" href={e.url} target="_blank" rel="noreferrer"><GitPullRequest/> <b>{e.repo} · PR #{e.number}</b><span>{e.path||e.title} · {ago(e.at)} <ArrowUpRight size={14}/></span></a>)}</div>:<div className="panel empty"><GitPullRequest size={32}/><h2>Todavía no has creado pull requests</h2><p>Cuando apruebes una propuesta en el editor, el PR en borrador aparece aquí con su enlace a GitHub.</p><Link className="secondary" href="/studio">Abrir el editor</Link></div>)
   :nav==='Agent activity'?(events.length?<section className="panel live-panel"><div className="timeline">{events.map((e:Ev)=><div className="timeline-item done" key={e.id}><div className="timeline-marker"><Check size={12}/></div><div><span className="log-kind">{kindOf(e)}</span><code>{e.title}</code><p>{e.repo} · {STATUS_LABEL[e.status]}{e.summary?' · '+e.summary:''}</p></div><small>{ago(e.at)}</small></div>)}</div></section>:<div className="panel empty"><Activity size={32}/><h2>Sin actividad todavía</h2><p>Todo lo que haga el agente quedará registrado aquí.</p><Link className="secondary" href="/studio">Abrir el editor</Link></div>)
   :!events.length?<div className="panel empty"><ShieldCheck size={32}/><h2>Todavía no hay actividad</h2><p>Abre el editor, carga un repositorio y pídele algo al agente. Cada análisis, revisión de seguridad y PR aparecerá aquí.</p><Link className="primary" href="/studio">Empezar en el editor <ArrowUpRight size={15}/></Link></div>
   :<><div className="operations"><section className="panel incident-panel"><div className="panel-head"><h3>Actividad <span className="count">{events.length}</span></h3><button className="icon-button" aria-label="Cambiar filtro" onClick={()=>setFilter(FILTERS[(FILTERS.indexOf(filter)+1)%FILTERS.length])}><span className="filter-text">{filter}</span><ChevronDown size={13}/></button></div>
    <label className="search"><Search size={15}/><input placeholder="Buscar por repositorio o texto…" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></label>
    <div className="incident-list">{visible.map((e:Ev)=><button key={e.id} onClick={()=>{setSelected(e.id);setTab('summary')}} className={'incident '+(selected===e.id?'selected':'')}><div className="incident-top"><span className={'severity '+attention(e)}><span/> {badge(e)}</span><small>{kindOf(e)}</small></div><h4>{e.title}</h4><p><GitBranch size={12}/>{e.repo}</p><div className="incident-bottom"><span className={'status st-'+e.status}>{STATUS_LABEL[e.status]}</span><small>{ago(e.at)}</small></div></button>)}{!visible.length&&<div className="empty">No hay resultados.</div>}</div>
    <div className="list-footer"><ShieldCheck size={14}/> {events.length} eventos guardados · solo tú los ves</div></section>
    {sel&&<section className="panel detail"><div className="detail-heading"><div className="detail-meta"><span className="issue-tag">{SOURCE_LABEL[sel.source]||'Manual'}</span><span>{sel.type==='security'?'REVISIÓN DE SEGURIDAD':'ARREGLO DE CÓDIGO'}</span><span>·</span><span>{ago(sel.at)}</span></div><h2>{sel.title}</h2><div className="detail-sub"><GitBranch size={13}/>{sel.repo}{sel.base&&<><span>→</span><code>{sel.base}</code></>}{sel.pr&&<span className="demo-text">PR #{sel.pr}</span>}</div></div>
    <div className="tabs">{tabs.map(([key,label,Icon])=><button className={tab===key?'selected':''} key={key} onClick={()=>setTab(key)}><Icon size={15}/> {label}</button>)}</div>
    {tab==='summary'&&<><div className="diagnosis"><span className="diagnosis-icon"><ShieldCheck size={19}/></span><div><h4>{sel.type==='security'?'Resultado de la revisión':sel.status==='no-fix'?'El agente no propuso un cambio':'Qué propuso el agente'}</h4><p>{sel.summary||sel.message||'Sin descripción.'}</p>{sel.counts&&<div className="sec-counts">{(['critical','high','medium','low'] as const).map(k=>sel.counts[k]>0&&<span key={k} className={'sec-chip sev-'+k}>{sel.counts[k]} {SEV_LABEL[k]}</span>)}{!sel.total&&<span className="sec-chip sev-ok">Sin hallazgos</span>}</div>}</div>{sel.verification&&<span className="risk">{sel.verification.ok?'Comprobación OK':sel.verification.issues+' avisos'}</span>}</div>
     {sel.path&&<div className="file-head"><span><Code2 size={15}/>{sel.path}</span><div><span>{sel.base}</span></div></div>}
     {sel.verification&&<div className="verification"><div><Check size={15}/><b>{sel.verification.ok?'Comprobación automática sin problemas':'La comprobación automática encontró '+sel.verification.issues+' aviso'+(sel.verification.issues===1?'':'s')}</b></div><span>Reglas fijas + OSV · independiente del resumen del agente</span></div>}</>}
    {tab==='activity'&&<div className="full-log">{sel.events?.length?sel.events.map((e:any,i:number)=><div key={i}><span className="log-kind">{e.type==='thought'?'AGENTE':e.type==='action'?'ACCIÓN':'RESULTADO'}</span>{e.type==='action'?<code>{e.text}</code>:<p>{e.text}</p>}</div>):<div className="empty">{sel.type==='security'?'Esta revisión usa reglas fijas; no interviene el agente.':'No se guardaron pasos de esta ejecución.'}</div>}</div>}
    {tab==='findings'&&<div className="test-results">{sel.findings?.length?sel.findings.map((f:any,i:number)=><div className="test-row" key={i}><span className={'sec-chip sev-'+f.severity}>{({critical:'CRÍTICO',high:'ALTO',medium:'MEDIO',low:'BAJO'} as Record<string,string>)[f.severity]}</span><code>{f.title} · {f.path}:{f.line}</code></div>):<div className="empty">No hubo hallazgos.</div>}{sel.total>(sel.findings?.length||0)&&<p className="muted">Se guardan los 10 más graves de {sel.total}.</p>}</div>}
    <div className="governance"><div><span className="gate-icon"><ShieldCheck size={20}/></span><span><b>{sel.status==='published'?'Aprobado por ti':sel.status==='proposed'?'Esperando tu aprobación':sel.status==='no-fix'?'Nada que aprobar':'Informe guardado'}</b><small>{sel.status==='published'?'El PR se creó en borrador; la CI de GitHub valida los tests.':sel.status==='proposed'?'Revisa el diff en el editor y aprueba solo si estás de acuerdo.':sel.status==='no-fix'?'Prueba con una descripción más concreta.':'Los arreglos se proponen desde el editor.'}</small></span></div>{sel.status==='published'&&sel.url?<a className="primary approve" href={sel.url} target="_blank" rel="noreferrer"><GitPullRequest size={16}/> Ver PR #{sel.number} <ArrowUpRight size={15}/></a>:<Link className="primary approve" href="/studio"><Code2 size={16}/> Abrir el editor <ArrowUpRight size={15}/></Link>}</div></section>}</div>
    {sel?.events?.length?<section className="panel live-panel"><div className="panel-head"><h3><Terminal size={17}/> Registro del agente <span className="live"><span/> {ago(sel.at).toUpperCase()}</span></h3></div><div className="timeline">{sel.events.map((e:any,i:number)=><div className="timeline-item done" key={i}><div className="timeline-marker"><Check size={12}/></div><div><span className="log-kind">{e.type==='thought'?'AGENTE':e.type==='action'?'ACCIÓN':'RESULTADO'}</span>{e.type==='action'?<code>{e.text}</code>:<p>{e.text}</p>}</div><small>{String(i+1).padStart(2,'0')}</small></div>)}</div><div className="live-footer"><span><CheckCheck size={13}/> El agente solo lee: no ejecuta código ni publica</span><span>Acciones y resultados registrados</span></div></section>:null}</>}
   <footer><span><ShieldCheck size={13}/> AUTONOMOUS REPAIR. HUMAN CONTROL.</span><span>DevSentinel AI <span className="version">v0.2</span></span></footer></main></div>
  {toast&&<div className="toast" role="status"><Check size={17}/>{toast}<button aria-label="Cerrar" onClick={()=>setToast('')}><X size={14}/></button></div>}
  {modal&&<div className="overlay" onClick={()=>setModal('')}><section className="modal" role="dialog" aria-modal="true" aria-label="DevSentinel" onClick={e=>e.stopPropagation()}><button className="close icon-button" aria-label="Cerrar" onClick={()=>setModal('')}><X size={19}/></button><span className="modal-icon">{modal==='clear'?<Trash2 size={26}/>:<Settings size={26}/>}</span>
   {modal==='clear'?<><h2>¿Borrar tu historial?</h2><p>Se eliminan los {events.length} eventos guardados de tu cuenta. No toca tus repositorios ni los PR ya creados. No se puede deshacer.</p><button className="primary modal-primary" disabled={busy} onClick={clearHistory}>{busy?<LoaderCircle size={16} className="spin"/>:<Trash2 size={16}/>} Sí, borrar mi historial</button></>
   :<><h2>Tu espacio de trabajo</h2><p>Estos son los datos reales de tu cuenta y del motor del agente.</p><div className="modal-info"><GitBranch size={18}/><div><b>{user.login}</b><small>Conectado con GitHub · {events.length} eventos guardados</small></div></div><div className="modal-info"><Terminal size={18}/><div><b>{ai?ai.model:'Sin modelo configurado'}</b><small>{ai?'Proveedor: '+ai.provider:'Falta AI_API_KEY en el servidor'}</small></div></div><p>Guardo solo resúmenes de lo que haces: repositorio, archivo y resultado. Nunca guardo tu código ni tus claves.</p><button className="secondary modal-primary" onClick={()=>setModal('clear')}><Trash2 size={16}/> Borrar mi historial</button><button className="primary modal-primary" onClick={()=>setModal('')}>Cerrar<ArrowRight size={16}/></button></>}
  </section></div>}
  <Axel guide={guide}/></div>;
}
