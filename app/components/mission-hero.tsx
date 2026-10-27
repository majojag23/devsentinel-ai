'use client';
import Link from 'next/link';
import {ArrowUpRight,GitBranch,ShieldCheck,Terminal,Workflow} from 'lucide-react';
import {ago} from '../../lib/time.mjs';

/** Which pipeline stage the latest real event reached (0 detect … 4 approve). */
function stageOf(latest:any){
  if(!latest)return 0;
  if(latest.type==='security')return 3;
  if(latest.status==='published')return 4;
  if(latest.status==='proposed')return latest.verification&&!latest.verification.ok?2:3;
  return 1;
}
export function MissionHero({title,latest,model}:{title:string;latest:any|null;model:string}) {
  const stages=['Detectar','Investigar','Reparar','Verificar','Aprobar'];
  const active=stageOf(latest);
  const check=latest?.verification?(latest.verification.ok?'COMPROBACIÓN OK':latest.verification.issues+' AVISOS'):latest?.type==='security'?(latest.total||0)+' HALLAZGOS':'REGLAS + OSV';
  return <section className="mission-hero" aria-label="Centro de control del agente">
    <div className="hero-copy">
      <div className="hero-kicker"><span className="signal-dot"/> AUTONOMOUS CODE OPERATIONS <span className="hero-edition">/ 001</span></div>
      <h1>{title==='Overview'?<>Menos bugs.<br/><span>Más control.</span></>:title==='Agent activity'?'Actividad del agente':title==='Repositories'?'Tus repositorios':'Cambios revisables'}</h1>
      <p>Tu agente investiga y verifica la reparación.<br/>La decisión de publicar siempre es tuya.</p>
      <div className="hero-actions"><Link className="primary" href="/studio"><Terminal size={16}/> Nuevo análisis <ArrowUpRight size={16}/></Link><Link className="hero-secondary" href="/studio"><ShieldCheck size={14}/> Revisar seguridad de un PR</Link></div>
      <div className="hero-caption"><ShieldCheck size={12}/> HUMAN-IN-THE-LOOP <span/> NO AUTO-MERGE</div>
    </div>
    <div className="agent-topology" aria-hidden="true">
      <div className="topology-grid"/>
      <div className="topology-label"><span/> SENTINEL ENGINE <span className="topology-mode">EN VIVO</span></div>
      <svg className="topology-wires" viewBox="0 0 500 260" fill="none">
        <defs><linearGradient id="wire"><stop stopColor="#bedf75" stopOpacity=".1"/><stop offset=".5" stopColor="#bedf75"/><stop offset="1" stopColor="#bedf75" stopOpacity=".1"/></linearGradient></defs>
        <circle cx="250" cy="132" r="91" stroke="#b8d987" strokeOpacity=".08"/>
        <circle cx="250" cy="132" r="65" stroke="#b8d987" strokeOpacity=".14" strokeDasharray="2 7"/>
        <path d="M80 74 H148 Q160 74 160 86 V120 Q160 132 172 132 H210 M80 197 H148 Q160 197 160 185 V144 Q160 132 172 132 M290 132 H328 Q340 132 340 120 V86 Q340 74 352 74 H420 M290 132 H328 Q340 132 340 144 V185 Q340 197 352 197 H420" stroke="url(#wire)"/>
        <path d="M250 30 V82 M250 182 V236" stroke="#b8d987" strokeOpacity=".15"/>
        <circle className="wire-pulse" cx="160" cy="100" r="3" fill="#c0e88c"/>
        <circle className="wire-pulse delay" cx="340" cy="164" r="3" fill="#c0e88c"/>
      </svg>
      <div className="engine-core"><div className="core-frame"><ShieldCheck size={37} strokeWidth={1.2}/></div><span>SENTINEL</span><small>{model?model.toUpperCase().slice(0,24):'SIN MODELO'}</small></div>
      <div className="topology-node node-input"><GitBranch size={16}/><span>PR / CI<small>{latest?.repo?latest.repo.toUpperCase().slice(0,26):'SIN ACTIVIDAD'}</small></span><i/></div>
      <div className="topology-node node-sandbox"><Terminal size={16}/><span>Repositorio<small>{latest?.path?latest.path.toUpperCase().slice(-26):'LECTURA SOLAMENTE'}</small></span><i/></div>
      <div className="topology-node node-tests"><Workflow size={16}/><span>Verificación<small>{check}</small></span><i/></div>
      <div className="topology-node node-human"><ShieldCheck size={16}/><span>Revisión humana<small>{latest?.status==='published'?'APROBADO POR TI':'APROBACIÓN REQUERIDA'}</small></span><i/></div>
      <div className="topology-footer"><span className="signal-dot"/>{latest?'Última actividad '+ago(latest.at).toLowerCase():'Todavía no hay actividad: abre el editor y empieza'}<span>HUMAN IN THE LOOP</span></div>
    </div>
    <div className="mission-pipeline"><span className="pipeline-caption">REPAIR LIFECYCLE</span>{stages.map((stage,i)=><div key={stage} className={'pipeline-stage '+(latest&&i<=active?'complete':'')+(latest&&i===active?' current':'')}><span className="stage-number">0{i+1}</span><span>{stage}</span>{i<4&&<span className="stage-link"/>}</div>)}</div>
  </section>;
}
