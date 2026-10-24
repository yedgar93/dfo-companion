// Remove very low-energy model padding, keeping a margin for breath/consonants.
export function trimPadding(audio,rate,{tailMs=140}={}){
  const window=Math.max(1,Math.round(rate*.005)),energy=[];let peak=0;
  for(let i=0;i<audio.length;i+=window){let sum=0;const end=Math.min(audio.length,i+window);for(let k=i;k<end;k++)sum+=audio[k]*audio[k];const rms=Math.sqrt(sum/(end-i));energy.push(rms);peak=Math.max(peak,rms);}
  if(peak<1e-7)return {audio,leadingRemovedMs:0,trailingRemovedMs:0};
  const threshold=Math.max(1e-7,peak*.0025),first=energy.findIndex(x=>x>threshold),last=energy.findLastIndex(x=>x>threshold);
  const start=Math.max(0,Math.min(Math.round(rate*.45),first*window-Math.round(rate*.035))),end=Math.min(audio.length,(last+1)*window+Math.round(rate*tailMs/1000));
  return {audio:audio.slice(start,end),leadingRemovedMs:start/rate*1000,trailingRemovedMs:(audio.length-end)/rate*1000};
}
