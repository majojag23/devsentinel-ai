'use client';
import {useLayoutEffect,useRef,type RefObject} from 'react';
import {warpEye,selectGazeMask,scaleBox,gazeTarget,eyeShift} from '../../lib/gaze-math.mjs';

/**
 * Axel's eyes follow the pointer. The authored iris artwork is gently displaced inside two fixed eye masks;
 * only those two patches are drawn on a transparent layer over the visible image, so the head never moves,
 * alpha and every pixel outside the masks stay untouched, and a centred gaze is the original image.
 * Works on the poses whose eyes are open; blinks, thinking, alert and laughing keep their authored look.
 */
const SUPPORTED=new Set(['neutral','happy','determined']);
const SOURCE=1254;            // the eye shapes below are measured on the 1254 px original
const TRAVEL_X=17,TRAVEL_UP=6,TRAVEL_DOWN=9; // maximum displacement, in original pixels. Upward is short: the eye is half covered by the brow and lid, and a longer shift leaves a pale gap under the iris.
type Shape={x:number;y:number;w:number;h:number;path:(p:CanvasRenderingContext2D)=>void};
const SHAPES:Shape[]=[
 {x:444,y:620,w:182,h:124,path:p=>{p.moveTo(13,28);p.bezierCurveTo(30,-2,77,2,108,32);p.bezierCurveTo(137,53,158,78,167,100);p.bezierCurveTo(116,121,61,111,33,84);p.bezierCurveTo(13,67,7,48,13,28);}},
 {x:756,y:666,w:148,h:101,path:p=>{p.moveTo(16,43);p.bezierCurveTo(45,27,90,0,124,2);p.bezierCurveTo(140,22,134,54,120,68);p.bezierCurveTo(89,90,42,98,14,77);p.bezierCurveTo(10,66,10,54,16,43);}},
];
type Region={x:number;y:number;w:number;h:number;pixels:ImageData;mask:Uint8ClampedArray;rightward:Uint8ClampedArray};
type Options={face:string;enabled:boolean;canvas:RefObject<HTMLCanvasElement|null>;area:RefObject<HTMLElement|null>;stack:RefObject<HTMLElement|null>;remountKey:string};

export function useGaze({face,enabled,canvas,area,stack,remountKey}:Options){
 const position=useRef({x:0,y:0}),target=useRef({x:0,y:0});
 useLayoutEffect(()=>{
  const layer=canvas.current,box=area.current,host=stack.current;
  if(!layer||!box||!host)return;
  const context=layer.getContext('2d');
  const image=host.querySelector<HTMLImageElement>(`img[data-face="${face}"]`);
  if(!context||!enabled||!SUPPORTED.has(face)||!image){context?.clearRect(0,0,layer.width,layer.height);return;}
  let reduced=false;try{reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{}
  const ctx=context,img=image;
  let frame=0,ready=false,scale=1,regions:Region[]=[];

  function draw(){
   if(!ready)return;
   ctx.clearRect(0,0,layer!.width,layer!.height);
   const dx=position.current.x*TRAVEL_X*scale,dy=position.current.y*(position.current.y<0?TRAVEL_UP:TRAVEL_DOWN)*scale;
   if(Math.abs(dx)+Math.abs(dy)>=.01){
    for(const [i,region] of regions.entries()){
     const shift=eyeShift(i,dx,dy);
     const mask=selectGazeMask(i,shift.dx,region.mask,region.rightward);
     const pixels=warpEye(region.pixels.data,region.w,region.h,mask,shift.dx,shift.dy);
     ctx.putImageData(new ImageData(pixels as any,region.w,region.h),region.x,region.y);
    }
   }
   layer!.dataset.gazeX=position.current.x.toFixed(2);layer!.dataset.gazeY=position.current.y.toFixed(2);
  }
  function schedule(){if(!frame&&ready&&!document.hidden)frame=requestAnimationFrame(tick);}
  function tick(){
   frame=0;if(!ready)return;
   const dx=target.current.x-position.current.x,dy=target.current.y-position.current.y,k=reduced?1:.18;
   position.current.x+=dx*k;position.current.y+=dy*k;
   if(Math.abs(dx)<.008)position.current.x=target.current.x;
   if(Math.abs(dy)<.008)position.current.y=target.current.y;
   draw();
   if(Math.abs(target.current.x-position.current.x)+Math.abs(target.current.y-position.current.y)>.008)schedule();
  }
  function look(x:number,y:number){
   const r=box!.getBoundingClientRect();
   target.current=gazeTarget(x,y,{left:r.left,top:r.top,width:r.width,height:r.height},innerWidth,innerHeight);schedule();
  }
  function centre(){target.current={x:0,y:0};schedule();}
  const onMove=(e:PointerEvent)=>{if(e.pointerType==='mouse'||e.pointerType==='pen')look(e.clientX,e.clientY);};
  const onDown=(e:PointerEvent)=>{if(e.pointerType==='touch')look(e.clientX,e.clientY);};
  const onVisibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();};

  function build(){
   if(!img.complete||!img.naturalWidth)return;
   try{
    scale=img.naturalWidth/SOURCE;
    layer!.width=img.naturalWidth;layer!.height=img.naturalHeight;
    const buffer=document.createElement('canvas');buffer.width=img.naturalWidth;buffer.height=img.naturalHeight;
    const source=buffer.getContext('2d',{willReadFrequently:true});if(!source)return;
    source.drawImage(img,0,0);
    regions=SHAPES.map(shape=>{
     const b=scaleBox(shape,scale);
     const maskCanvas=document.createElement('canvas');maskCanvas.width=b.w;maskCanvas.height=b.h;
     const m=maskCanvas.getContext('2d',{willReadFrequently:true})!;
     m.scale(b.w/shape.w,b.h/shape.h);m.fillStyle='#fff';m.beginPath();shape.path(m);m.closePath();m.fill();
     return {...b,pixels:source.getImageData(b.x,b.y,b.w,b.h),mask:m.getImageData(0,0,b.w,b.h).data,rightward:new Uint8ClampedArray(b.w*b.h*4).fill(255)};
    });
    ready=true;draw();schedule();
   }catch{ready=false;ctx.clearRect(0,0,layer!.width,layer!.height);}
  }

  document.addEventListener('pointermove',onMove,{passive:true});
  document.addEventListener('pointerdown',onDown,{passive:true});
  document.documentElement.addEventListener('pointerleave',centre);
  window.addEventListener('blur',centre);
  document.addEventListener('visibilitychange',onVisibility);
  if(img.complete&&img.naturalWidth)build();else img.addEventListener('load',build,{once:true});
  return()=>{
   cancelAnimationFrame(frame);ready=false;
   document.removeEventListener('pointermove',onMove);document.removeEventListener('pointerdown',onDown);
   document.documentElement.removeEventListener('pointerleave',centre);window.removeEventListener('blur',centre);
   document.removeEventListener('visibilitychange',onVisibility);img.removeEventListener('load',build);
   ctx.clearRect(0,0,layer.width,layer.height);
  };
  // remountKey: the avatar is re-created whenever the guide changes, so the layer must be rebuilt for the new elements.
 },[face,enabled,remountKey,canvas,area,stack]);
}
