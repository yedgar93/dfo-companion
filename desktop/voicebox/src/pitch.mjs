// Duration-preserving mono phase vocoder. Same method as scripts/pitch.py,
// implemented in JavaScript so the portable worker needs no NumPy/Python.
const plans=new Map();
function fft(re,im,inverse=false){
  const n=re.length;let plan=plans.get(n);if(!plan){plan={swaps:[],stages:[]};for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)plan.swaps.push([i,j]);}for(let len=2;len<=n;len<<=1){const cos=Float64Array.from({length:len/2},(_,j)=>Math.cos(-2*Math.PI*j/len)),sin=Float64Array.from({length:len/2},(_,j)=>Math.sin(-2*Math.PI*j/len));plan.stages.push({len,cos,sin});}plans.set(n,plan);}
  for(const [i,j] of plan.swaps){let temp=re[i];re[i]=re[j];re[j]=temp;temp=im[i];im[i]=im[j];im[j]=temp;}
  for(const {len,cos,sin} of plan.stages)for(let offset=0;offset<n;offset+=len)for(let j=0;j<len/2;j++){const wr=cos[j],wi=inverse?-sin[j]:sin[j],a=offset+j,b=a+len/2,vr=re[b]*wr-im[b]*wi,vi=re[b]*wi+im[b]*wr;re[b]=re[a]-vr;im[b]=im[a]-vi;re[a]+=vr;im[a]+=vi;}
  if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}
}
export function pitchShift(audio,ratio=1){
  if(!(audio instanceof Float32Array)||!audio.length||audio.length>4*1024*1024||!Number.isFinite(ratio)||ratio<.85||ratio>1.15)throw Error('Invalid audio/pitch');
  if(Math.abs(ratio-1)<1e-6)return audio;
  const n=1024,hop=256,bins=513,window=Float64Array.from({length:n},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(n-1)));
  const frames=Math.floor((audio.length+n)/hop)+1,magnitudes=[],phases=[];
  for(let frame=0;frame<frames;frame++){const re=new Float64Array(n),im=new Float64Array(n),start=frame*hop-n/2;for(let i=0;i<n;i++)re[i]=(audio[start+i]??0)*window[i];fft(re,im);magnitudes.push(Float64Array.from({length:bins},(_,k)=>Math.hypot(re[k],im[k])));phases.push(Float64Array.from({length:bins},(_,k)=>Math.atan2(im[k],re[k])));}
  const rate=1/ratio,count=Math.ceil((frames-1)/rate),output=new Float64Array(hop*(count-1)+n),weights=new Float64Array(output.length),phase=phases[0].slice();
  for(let frame=0;frame<count;frame++){const step=frame*rate,index=Math.floor(step),fraction=step-index,re=new Float64Array(n),im=new Float64Array(n);
    for(let k=0;k<bins;k++){const mag=(1-fraction)*magnitudes[index][k]+fraction*magnitudes[index+1][k];re[k]=mag*Math.cos(phase[k]);im[k]=mag*Math.sin(phase[k]);if(k>0&&k<bins-1){re[n-k]=re[k];im[n-k]=-im[k];}const advance=2*Math.PI*hop*k/n;let delta=phases[index+1][k]-phases[index][k]-advance;delta-=2*Math.PI*Math.round(delta/(2*Math.PI));phase[k]+=advance+delta;}
    fft(re,im,true);const offset=frame*hop;for(let i=0;i<n;i++){output[offset+i]+=re[i]*window[i];weights[offset+i]+=window[i]*window[i];}
  }
  const shifted=new Float32Array(audio.length);for(let i=0;i<audio.length;i++){const position=n/2+i*ratio,index=Math.floor(position),mix=position-index;const left=output[index]/Math.max(weights[index],1e-10),right=output[index+1]/Math.max(weights[index+1],1e-10);shifted[i]=Math.max(-1,Math.min(1,left*(1-mix)+right*mix));}return shifted;
}
