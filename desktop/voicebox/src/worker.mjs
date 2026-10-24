import {parentPort,workerData} from 'node:worker_threads';
import {KokoroOnnx} from './engine.mjs';
import {pitchShift} from './pitch.mjs';
const config=workerData??JSON.parse(process.argv[2]);let messageHandler;const early=[];
const electronPort=process.parentPort;
const port=parentPort??(electronPort?{postMessage:m=>electronPort.postMessage(m),on(_event,fn){messageHandler=fn;for(const m of early.splice(0))fn(m);}}:null)??{postMessage:m=>process.send(m),on(event,fn){messageHandler=fn;for(const m of early.splice(0))fn(m);}};
if(electronPort)electronPort.on('message',event=>{if(messageHandler)messageHandler(event.data);else{if(early.length>=128)early.shift();early.push(event.data);}});
if(!parentPort&&!electronPort){process.on('message',m=>{if(messageHandler)messageHandler(m);else{if(early.length>=128)early.shift();early.push(m);}});process.on('disconnect',()=>process.exit(0));}
const engine=new KokoroOnnx(config.modelDir,config.options),cache=new Map();let cacheBytes=0,generation=config.generation,pending=null,busy=false;
await engine.load();await engine.synth('Ready.','af_heart');await engine.synth('Ready.','bm_george');
port.postMessage({type:'ready',provider:engine.provider,fallbackReason:engine.fallbackReason,model:engine.model,voices:[...engine.catalog],memory:process.memoryUsage(),pid:process.pid});
async function pump(){if(busy||!pending)return;busy=true;const request=pending;pending=null;
  try{const key=JSON.stringify([request.text,request.voice,request.speed,request.pitch]),hit=cache.get(key);let result=hit;
    if(!hit){const start=performance.now();result=await engine.synth(request.text,request.voice,request.speed);const {audio,...meta}=result;result={...meta,audio:pitchShift(audio,request.pitch),totalMs:performance.now()-start};}
    if(request.generation!==generation)return;
    if(!hit&&result.audio.byteLength<=4*1024*1024){cache.set(key,result);cacheBytes+=result.audio.byteLength;while(cacheBytes>16*1024*1024){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).audio.byteLength;cache.delete(oldest);}}
    const audio=result.audio.slice();port.postMessage({type:'audio',id:request.id,generation,audio,rate:result.rate,cacheHit:!!hit,totalMs:result.totalMs,leadingRemovedMs:result.leadingRemovedMs,trailingRemovedMs:result.trailingRemovedMs},[audio.buffer]);
  }catch(error){if(request.generation===generation)port.postMessage({type:'error',id:request.id,error:error.message});}
  finally{busy=false;void pump();}
}
port.on('message',request=>{
  if(request.type==='cancel'){generation=request.generation;pending=null;return;}
  if(request.type!=='synth'||request.generation!==generation)return;
  if(pending){port.postMessage({type:'error',id:request.id,error:'One-sentence prefetch limit'});return;}
  pending=request;void pump();
});
