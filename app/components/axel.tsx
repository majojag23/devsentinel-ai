'use client';
import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {steps,tickleLine,TICKLE_MS} from '../../lib/axel.mjs';
type Mood='neutral'|'happy'|'thinking'|'surprised'|'worried'|'determined';
export type AxelGuide={mood:Mood;title:string;text:string;step:number;done:boolean;detail?:string};
const frames:string[]=['neutral','happy','thinking','surprised','worried','determined','blink-half','blink-closed','laughing'];
const KEY='axel-minimized';
const BLINK:[string,number][]=[['blink-half',60],['blink-closed',100],['blink-half',60]];
const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}};
/** Axel, the Sentinel: a guide that follows the Studio and explains each moment in plain words. Touch him and he laughs. */
export function Axel({guide}:{guide:AxelGuide}){
 const [minimized,setMinimized]=useState(false),[override,setOverride]=useState('');
 const [tickle,setTickle]=useState<{title:string;text:string}|null>(null),[laugh,setLaugh]=useState('laughing');
 const timer=useRef<ReturnType<typeof setTimeout>>(undefined),loop=useRef<ReturnType<typeof setInterval>>(undefined),count=useRef(0);
 const tickled=tickle!==null;
 useEffect(()=>{try{setMinimized(localStorage.getItem(KEY)==='1');}catch{}},[]);
 function stopTickle(){clearTimeout(timer.current);clearInterval(loop.current);setTickle(null);}
 function tickleNow(){
  if(!tickled)count.current=0;
  clearTimeout(timer.current);clearInterval(loop.current);
  setTickle(tickleLine(count.current++));setLaugh('laughing');
  if(!reducedMotion()){let phase=0;loop.current=setInterval(()=>setLaugh(++phase%4===0?'happy':'laughing'),240);}
  timer.current=setTimeout(stopTickle,TICKLE_MS);
 }
 // The moment changed (a request started, an error came): the guide wins over the game.
 useEffect(()=>{stopTickle();},[guide.mood,guide.title]);
 useEffect(()=>()=>{clearTimeout(timer.current);clearInterval(loop.current);},[]);
 // Idle life: irregular blinks (sometimes double) and now and then a glance to the side. Only while calm, never with reduced motion.
 useEffect(()=>{
  if(guide.mood!=='neutral'||minimized||tickled||reducedMotion())return;
  let dead=false,wake:ReturnType<typeof setTimeout>;
  const wait=(ms:number)=>new Promise<void>(r=>{wake=setTimeout(r,ms);});
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
  return()=>{dead=true;clearTimeout(wake);setOverride('');};
 },[guide.mood,minimized,tickled]);
 function toggle(next:boolean){setMinimized(next);try{localStorage.setItem(KEY,next?'1':'0');}catch{}}
 const face=tickled?laugh:guide.mood==='neutral'&&override?override:guide.mood;
 const avatar=<span className="axel-body"><span className={'axel-stack'+(override||tickled?' fast':'')}>{frames.map(f=><img key={f} className={'axel-face'+(f===face?' on':'')} src={`/axel/${f}.webp`} width={384} height={384} alt="" aria-hidden="true" draggable={false}/>)}</span></span>;
 if(minimized)return <button type="button" className="axel axel-min" onClick={()=>toggle(false)} aria-label="Abrir la guía de Axel" title="Axel te guía">{avatar}<span className="axel-dot"/></button>;
 return <aside className={'axel axel-'+guide.mood+(tickled?' tickled':'')} aria-label="Axel, tu guía">
  <div className="axel-bubble">
   <button type="button" className="axel-close" onClick={()=>toggle(true)} aria-label="Minimizar a Axel"><X size={13}/></button>
   {guide.step>0&&!tickled&&<ol className="axel-steps" aria-label="Pasos">{steps.map((s:string,i:number)=><li key={s} className={(guide.done||i+1<guide.step?'is-done':i+1===guide.step?'is-now':'')} aria-current={i+1===guide.step&&!guide.done?'step':undefined}><span>{guide.done||i+1<guide.step?'✓':i+1}</span>{s}</li>)}</ol>}
   <div role="status" aria-live="polite">{tickle?<><b>{tickle.title}</b><p>{tickle.text}</p><small className="axel-tickle-foot">● Riendo contigo</small></>:<><b>{guide.title}</b><p>{guide.text}</p>{guide.detail&&<small>Detalle: {guide.detail}</small>}</>}</div>
  </div>
  <button type="button" className="axel-avatar axel-touch" key={guide.mood+guide.title} onClick={tickleNow} aria-label={tickled?'Axel se está riendo':'Axel, tu guía. Tócalo para hacerle cosquillas'} title="¡Tócame!">{avatar}{tickled&&<span className="axel-particles" aria-hidden="true"><span>¡ja!</span><span>✦</span><span>¡ja, ja!</span></span>}</button>
 </aside>;
}
