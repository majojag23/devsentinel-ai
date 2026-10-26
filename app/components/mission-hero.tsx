'use client';
import { ArrowUpRight, GitBranch, Play, Radar, ShieldCheck, Terminal, Workflow } from 'lucide-react';

export function MissionHero({title,running,verified,approved,onRun,onNew}:{title:string;running:boolean;verified:boolean;approved:boolean;onRun:()=>void;onNew:()=>void}) {
  const stages=['Detectar','Investigar','Reparar','Verificar','Aprobar'];
  const active=approved?4:verified?3:running?1:0;
  return <section className={'mission-hero '+(running?'is-running':'')} aria-label="Centro de control del agente">
    <div className="hero-copy">
      <div className="hero-kicker"><span className="signal-dot"/> AUTONOMOUS CODE OPERATIONS <span className="hero-edition">/ 001</span></div>
      <h1>{title==='Overview'?<>Menos bugs.<br/><span>Más control.</span></>:title==='Agent activity'?'Actividad del agente':title==='Repositories'?'Tus repositorios':title==='Pull requests'?'Cambios revisables':'Configuración'}</h1>
      <p>Tu agente investiga y verifica la reparación.<br/>La decisión de publicar siempre es tuya.</p>
      <div className="hero-actions"><button className="primary" onClick={onNew}><Terminal size={16}/> Nuevo análisis <ArrowUpRight size={16}/></button><button className="hero-secondary" onClick={onRun} disabled={running}>{running?<Radar size={15} className="spin"/>:<Play size={13}/>} {running?'Ejecutando suite…':'Probar el flujo'}</button></div>
      <div className="hero-caption"><ShieldCheck size={12}/> HUMAN-IN-THE-LOOP <span/> NO AUTO-MERGE</div>
    </div>
    <div className="agent-topology" aria-hidden="true">
      <div className="topology-grid"/>
      <div className="topology-label"><span/> SENTINEL ENGINE <span className="topology-mode">LOCAL / DEMO</span></div>
      <svg className="topology-wires" viewBox="0 0 500 260" fill="none">
        <defs><linearGradient id="wire"><stop stopColor="#bedf75" stopOpacity=".1"/><stop offset=".5" stopColor="#bedf75"/><stop offset="1" stopColor="#bedf75" stopOpacity=".1"/></linearGradient></defs>
        <circle cx="250" cy="132" r="91" stroke="#b8d987" strokeOpacity=".08"/>
        <circle cx="250" cy="132" r="65" stroke="#b8d987" strokeOpacity=".14" strokeDasharray="2 7"/>
        <path d="M80 74 H148 Q160 74 160 86 V120 Q160 132 172 132 H210 M80 197 H148 Q160 197 160 185 V144 Q160 132 172 132 M290 132 H328 Q340 132 340 120 V86 Q340 74 352 74 H420 M290 132 H328 Q340 132 340 144 V185 Q340 197 352 197 H420" stroke="url(#wire)"/>
        <path d="M250 30 V82 M250 182 V236" stroke="#b8d987" strokeOpacity=".15"/>
        <circle className="wire-pulse" cx="160" cy="100" r="3" fill="#c0e88c"/>
        <circle className="wire-pulse delay" cx="340" cy="164" r="3" fill="#c0e88c"/>
      </svg>
      <div className="engine-core"><div className="core-frame"><ShieldCheck size={37} strokeWidth={1.2}/></div><span>SENTINEL</span><small>{running?'EXECUTING':verified?'VERIFIED':'READY TO RUN'}</small></div>
      <div className="topology-node node-input"><GitBranch size={16}/><span>GitHub event<small>BUILD #402</small></span><i/></div>
      <div className="topology-node node-sandbox"><Terminal size={16}/><span>Repair workspace<small>NODE.JS FIXTURE</small></span><i/></div>
      <div className="topology-node node-tests"><Workflow size={16}/><span>Test suite<small>{verified?'4 / 4 PASSED':'READY TO VERIFY'}</small></span><i/></div>
      <div className="topology-node node-human"><ShieldCheck size={16}/><span>Human review<small>{approved?'APPROVED · DEMO':'APPROVAL REQUIRED'}</small></span><i/></div>
      <div className="topology-footer"><span className="signal-dot"/>{running?'Prueba local en ejecución':verified?'Reparación verificada en demo':'Entorno de demostración preparado'}<span>REACT LOOP ↗</span></div>
    </div>
    <div className="mission-pipeline"><span className="pipeline-caption">REPAIR LIFECYCLE</span>{stages.map((stage,i)=><div key={stage} className={'pipeline-stage '+(i<=active?'complete':'')+(i===active?' current':'')}><span className="stage-number">0{i+1}</span><span>{stage}</span>{i<4&&<span className="stage-link"/>}</div>)}</div>
  </section>;
}
