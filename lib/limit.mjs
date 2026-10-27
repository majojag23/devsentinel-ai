/** In-memory sliding-window limiter, per process. Enough for a single-server deployment. */
export function createLimiter(max,windowMs){
 const hits=new Map();
 return function limited(key,now=Date.now()){
  const recent=(hits.get(key)||[]).filter(t=>now-t<windowMs);recent.push(now);hits.set(key,recent);
  if(hits.size>500)for(const [k,v] of hits)if(!v.some(t=>now-t<windowMs))hits.delete(k);
  return recent.length>max;
 };
}
