// Web-size copies of the Axel expression pack (same canvas, no per-frame trimming so frames never jump).
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const from=resolve('public/mascot/expressions'),to=resolve('public/axel');
const names=['neutral','happy','thinking','surprised','worried','determined','blink-half','blink-closed','laughing'];
await mkdir(to,{recursive:true});
for(const name of names){
 const info=await sharp(join(from,name+'.png')).resize(384,384,{fit:'contain',background:'#00000000'}).webp({quality:84,alphaQuality:90}).toFile(join(to,name+'.webp'));
 console.log(name.padEnd(13),Math.round(info.size/1024)+' KB');
}
