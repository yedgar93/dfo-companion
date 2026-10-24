export function pcmToWav(pcm,rate,volume=1){
  if(!Buffer.isBuffer(pcm)||!pcm.length||pcm.length%2||pcm.length>8*1024*1024)throw Error('Invalid or excessive PCM length');
  if(!Number.isInteger(rate)||rate<8000||rate>96000)throw Error('Invalid sample rate');
  if(!Number.isFinite(volume)||volume<0||volume>1)throw Error('Invalid volume');
  const out=Buffer.alloc(44+pcm.length);out.write('RIFF',0);out.writeUInt32LE(36+pcm.length,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(pcm.length,40);
  for(let i=0;i<pcm.length;i+=2)out.writeInt16LE(Math.round(pcm.readInt16LE(i)*volume),44+i);return out;
}
export function sentences(text,{maxWords=40}={}){
  if(maxWords!==Infinity&&(!Number.isInteger(maxWords)||maxWords<1||maxWords>1000))throw Error('Invalid sentence word limit');
  const segments=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text.replace(/\s+/g,' ').trim())].map(s=>s.segment.trim());
  const joined=[];for(const s of segments){if(joined.length&&/\b(?:Mr|Mrs|Ms|Dr|St|Sr|Jr|Lt|Capt|Gen|Mt|vs|etc)\.$/i.test(joined.at(-1)))joined[joined.length-1]+=' '+s;else joined.push(s);}
  return joined.flatMap(s=>{const w=s.split(/\s+/),out=[];while(w.length)out.push(w.splice(0,maxWords).join(' '));return out;}).filter(Boolean);
}
