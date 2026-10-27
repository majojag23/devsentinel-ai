import {test} from 'node:test';
import assert from 'node:assert/strict';
import {warpEye,selectGazeMask,scaleBox,gazeTarget,eyeShift} from '../lib/gaze-math.mjs';
test('highlight correction affects only the viewer-right eye looking right',()=>{const original=new Uint8ClampedArray([0]),corrected=new Uint8ClampedArray([255]);for(const dx of [-22,0,22])assert.equal(selectGazeMask(0,dx,original,corrected),original);for(const dx of [-22,0])assert.equal(selectGazeMask(1,dx,original,corrected),original);assert.equal(selectGazeMask(1,22,original,corrected),corrected);});
test('centered gaze preserves every original pixel',()=>{const input=Uint8ClampedArray.from({length:16*16*4},(_,i)=>i%251),mask=new Uint8ClampedArray(input.length).fill(255);assert.deepEqual(warpEye(input,16,16,mask,0,0),input);});
test('all four gaze directions preserve alpha and pixels outside the eye mask',()=>{const w=32,h=24,input=Uint8ClampedArray.from({length:w*h*4},(_,i)=>i%251),mask=new Uint8ClampedArray(input.length);for(let y=5;y<19;y++)for(let x=7;x<25;x++)mask[(y*w+x)*4+3]=255;for(const [dx,dy]of [[6,0],[-6,0],[0,4],[0,-4]]){const output=warpEye(input,w,h,mask,dx,dy);assert.equal(output.length,input.length);let changed=false;for(let i=0;i<input.length;i++){if(i%4===3||mask[i-i%4+3]===0)assert.equal(output[i],input[i]);if(output[i]!==input[i])changed=true;}assert.ok(changed);}});
test('the eye boxes scale from the 1254 px original to the 384 px image shown in the app',()=>{
 const s=384/1254;
 assert.deepEqual(scaleBox({x:444,y:620,w:182,h:124},1),{x:444,y:620,w:182,h:124});
 const b=scaleBox({x:444,y:620,w:182,h:124},s);
 assert.deepEqual(b,{x:136,y:190,w:56,h:38});
 assert.ok(b.x+b.w<=384&&b.y+b.h<=384);
 assert.deepEqual(scaleBox({x:0,y:0,w:1,h:1},.1),{x:0,y:0,w:1,h:1});
});
test('Axel looks toward the pointer, clamped to -1..1, and straight ahead at his own centre',()=>{
 const rect={left:800,top:600,width:150,height:150},cx=800+150*.52,cy=600+150*.55;
 assert.deepEqual(gazeTarget(cx,cy,rect,1200,800),{x:0,y:0});
 const right=gazeTarget(1190,cy,rect,1200,800),left=gazeTarget(0,cy,rect,1200,800);
 assert.ok(right.x>0.5&&right.x<=1);assert.equal(left.x,-1);
 assert.equal(gazeTarget(cx,0,rect,1200,800).y,-1);
 assert.ok(gazeTarget(cx,799,rect,1200,800).y>0);
 for(const [x,y] of [[-5000,-5000],[9000,9000],[cx,cy]]){const t=gazeTarget(x,y,rect,1200,800);assert.ok(Math.abs(t.x)<=1&&Math.abs(t.y)<=1);}
});
test('a diagonal gaze never exceeds the reach of a single straight direction',()=>{
 const rect={left:800,top:600,width:150,height:150};
 for(const [x,y] of [[0,0],[1199,0],[0,799],[1199,799],[-9000,-9000]]){const t=gazeTarget(x,y,rect,1200,800);assert.ok(Math.hypot(t.x,t.y)<=1.000001);}
 const corner=gazeTarget(0,0,rect,1200,800);assert.ok(corner.x<-0.6&&corner.y<-0.6);
});
test('only the viewer-right eye looking left travels less; everything else is untouched',()=>{
 const s=eyeShift(1,-10,5);assert.equal(s.dx,-5.5);assert.equal(s.dy,3);
 for(const [eye,dx] of [[0,-10],[0,10],[1,10],[1,0]])assert.deepEqual(eyeShift(eye,dx,2),{dx,dy:2});
});
