'use client';
import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
import {steps} from '../../lib/axel.mjs';
type Mood='neutral'|'happy'|'thinking'|'surprised'|'worried'|'determined';
export type AxelGuide={mood:Mood;title:string;text:string;step:number;done:boolean;detail?:string};
const frames:string[]=['neutral','happy','thinking','surprised','worried','determined','blink-half','blink-closed'];
const KEY='axel-minimized';
const BLINK:[string,number][]=[['blink-half',60],['blink-closed',100],['blink-half',60]];
/** Axel, the Sentinel: a guide that follows the Studio and explains each moment in plain words. */
export function Axel({guide}:{guide:AxelGuide}){
 const [minimized,setMinimized]=useState(false),[override,setOverride]=useState('');
 useEffect(()=>{try{setMinimized(localStorage.getItem(KEY)==='1');}catch{}},[]);
 // Idle life: irregular blinks (sometimes double) and now and then a glance to the side. Only while calm, never with reduced motion.
 useEffect(()=>{
  if(guide.mood!=='neutral'||minimized)return;
  let reduced=false;try{reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{}
  if(reduced)return;
  let dead=false,timer:ReturnType<typeof setTimeout>;
  const wait=(ms:number)=>new Promise<void>(r=>{timer=setTimeout(r,ms);});
  (async()=>{
   await wait(1200);
   for(let n=1;!dead;n++){
    if(n%4===0){setOverride('thinking');await wait(1100);if(dead)break;setOverride('');await wait(400);}
    else{
     const times=Math.random()<0.3?2:1;
     for(let i=0;i<times&&!dead;i++){
      for(const [frame,ms] of BLINK){if(dead)break;setOverride(frame);await wait(ms);}
      setOverride('');if(i<times-1)await wait(150);
     }
    }
    await wait(1600+Math.random()*2600);
   }
  })();
  return()=>{dead=true;clearTimeout(timer);setOverride('');};
 },[guide.mood,minimized]);
 function toggle(next:boolean){setMinimized(next);try{localStorage.setItem(KEY,next?'1':'0');}catch{}}
 const face=guide.mood==='neutral'&&override?override:guide.mood;
 const avatar=<span className="axel-body"><span className={'axel-stack'+(override?' fast':'')}>{frames.map(f=><img key={f} className={'axel-face'+(f===face?' on':'')} src={`/axel/${f}.webp`} width={384} height={384} alt={f===face?'Axel, tu guía':''} aria-hidden={f!==face} draggable={false}/>)}</span></span>;
 if(minimized)return <button type="button" className="axel axel-min" onClick={()=>toggle(false)} aria-label="Abrir la guía de Axel" title="Axel te guía">{avatar}<span className="axel-dot"/></button>;
 return <aside className={'axel axel-'+guide.mood} aria-label="Axel, tu guía">
  <div className="axel-bubble">
   <button type="button" className="axel-close" onClick={()=>toggle(true)} aria-label="Minimizar a Axel"><X size={13}/></button>
   {guide.step>0&&<ol className="axel-steps" aria-label="Pasos">{steps.map((s:string,i:number)=><li key={s} className={(guide.done||i+1<guide.step?'is-done':i+1===guide.step?'is-now':'')} aria-current={i+1===guide.step&&!guide.done?'step':undefined}><span>{guide.done||i+1<guide.step?'✓':i+1}</span>{s}</li>)}</ol>}
   <div role="status" aria-live="polite"><b>{guide.title}</b><p>{guide.text}</p>{guide.detail&&<small>Detalle: {guide.detail}</small>}</div>
  </div>
  <div className="axel-avatar" key={guide.mood+guide.title}>{avatar}</div>
 </aside>;
}
