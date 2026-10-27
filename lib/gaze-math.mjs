export const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const selectGazeMask=(eyeIndex,dx,originalMask,rightwardMask)=>eyeIndex===1&&dx>0?rightwardMask:originalMask;
// Re-sample only inside the eye opening. Zero displacement is an exact copy.
export function warpEye(source,width,height,mask,dx,dy){
 const output=new Uint8ClampedArray(source);
 if(Math.abs(dx)+Math.abs(dy)<.01)return output;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const offset=(y*width+x)*4,coverage=mask[offset+3]/255;
  if(!coverage)continue;
  const nx=(x-width/2)/(width*.52),ny=(y-height/2)/(height*.62);
  const radius=Math.sqrt(nx*nx+ny*ny);
  const weight=clamp((1-radius)/.42,0,1);
  const sx=clamp(x-dx*weight,0,width-1),sy=clamp(y-dy*weight,0,height-1);
  const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(x0+1,width-1),y1=Math.min(y0+1,height-1),fx=sx-x0,fy=sy-y0;
  for(let channel=0;channel<3;channel++){
   const top=source[(y0*width+x0)*4+channel]*(1-fx)+source[(y0*width+x1)*4+channel]*fx;
   const bottom=source[(y1*width+x0)*4+channel]*(1-fx)+source[(y1*width+x1)*4+channel]*fx;
   output[offset+channel]=source[offset+channel]*(1-coverage)+(top*(1-fy)+bottom*fy)*coverage;
  }
 }
 return output;
}
/** The eye boxes are measured on the 1254 px original; scale one to the size of the image actually shown. */
export const scaleBox=(shape,scale)=>({x:Math.round(shape.x*scale),y:Math.round(shape.y*scale),w:Math.max(1,Math.round(shape.w*scale)),h:Math.max(1,Math.round(shape.h*scale))});
/** Where Axel looks, from -1 to 1 on each axis, for a pointer at (x, y) and the box he is drawn in. */
export function gazeTarget(x,y,rect,width,height){
 const cx=rect.left+rect.width*.52,cy=rect.top+rect.height*.55;
 const rangeX=Math.max(100,Math.min(320,(x<cx?cx:width-cx)*.8));
 const rangeY=Math.max(100,Math.min(260,(y<cy?cy:height-cy)*.8));
 const tx=clamp((x-cx)/rangeX,-1,1),ty=clamp((y-cy)/rangeY,-1,1),length=Math.hypot(tx,ty);
 // A diagonal must never add up to more than one straight direction: that is where the eye artwork smears.
 return length>1?{x:tx/length,y:ty/length}:{x:tx,y:ty};
}
/** The viewer-right eye drags a dark corner into the white when it looks left, so it travels less that way, and less up or down while it does, to keep the catchlight from twisting. */
export const eyeShift=(eyeIndex,dx,dy)=>eyeIndex===1&&dx<0?{dx:dx*.55,dy:dy*.6}:{dx,dy};
