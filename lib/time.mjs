/** "Hace 4 min" style time, in Spanish. */
export function ago(iso,now=Date.now()){
 const seconds=Math.max(0,Math.round((now-Date.parse(iso))/1000));
 if(!Number.isFinite(seconds))return '';
 if(seconds<60)return 'Hace un momento';
 const minutes=Math.floor(seconds/60);if(minutes<60)return `Hace ${minutes} min`;
 const hours=Math.floor(minutes/60);if(hours<24)return `Hace ${hours} h`;
 const days=Math.floor(hours/24);if(days<30)return `Hace ${days} ${days===1?'día':'días'}`;
 return new Date(iso).toLocaleDateString('es');
}
/** Daily counts for the last `days` days (oldest first), for the small trend lines. */
export function daily(events,pick,days=14,now=Date.now()){
 const counts=Array(days).fill(0),end=new Date(now);end.setHours(23,59,59,999);
 for(const e of events){if(!pick(e))continue;const back=Math.floor((end.getTime()-Date.parse(e.at))/864e5);if(back>=0&&back<days)counts[days-1-back]++;}
 return counts;
}
/** SVG path for a trend line in a 100×35 box. */
export function sparkPath(counts){
 const max=Math.max(1,...counts);
 return counts.map((c,i)=>`${i?'L':'M'}${(i*100/(counts.length-1)).toFixed(1)} ${(32-(c/max)*28).toFixed(1)}`).join(' ');
}
