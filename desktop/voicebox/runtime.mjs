import fs from 'node:fs/promises';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {fileURLToPath} from 'node:url';
import {createVoiceBox} from './src/index.mjs';
import {SpeechWorker} from './src/host.mjs';
import {ensureModels} from './models.mjs';
import {readFileSync} from 'node:fs';
const defaults=JSON.parse(readFileSync(new URL('./data/defaults.json',import.meta.url),'utf8'));
export function utilityWorkerFactory(utilityProcess){return (url,config)=>{
  const events=new EventEmitter(),child=utilityProcess.fork(fileURLToPath(url),[JSON.stringify(config.workerData)],{serviceName:'DFO VoiceBox speech',stdio:'pipe'});
  for(const name of ['message','error','exit'])child.on(name,(...args)=>events.emit(name,...args));
  child.stderr?.on('data',()=>{});
  events.postMessage=m=>{if(child.pid)child.postMessage(m);};
  events.terminate=async()=>{if(!child.pid)return;await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve();},1000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill();});};return events;
};}
export function createVoiceBoxRuntime({directory,send,service,workerFactory,models=ensureModels,boxFactory=createVoiceBox,workerClass=SpeechWorker}){
  let settings=structuredClone(defaults),box=null,worker=null,state='disabled',enabled=false,generation=0,controller=null,saveChain=null,saveVersion=0,savedVersion=0,preparation=Promise.resolve(),playId=0,playing=null,closed=false;
  const pendingOpinions=new Map();let opinionId=0;
  const emit=event=>{if(!closed)send(event);};
  const status=()=>({enabled,volume:settings.volume,state});
  const update=next=>{state=next;emit({type:'status',...status()});};
  const persist=()=>{saveVersion++;if(!saveChain)saveChain=(async()=>{await fs.mkdir(directory,{recursive:true});const file=path.join(directory,'settings.json');while(savedVersion<saveVersion){const version=saveVersion,content=JSON.stringify(settings,null,2);await fs.writeFile(file+'.tmp',content);await fs.rename(file+'.tmp',file);savedVersion=version;}})().finally(()=>{saveChain=null;});return saveChain;};
  const player={setVolume:value=>emit({type:'volume',value}),stop(){const old=playing;playing=null;old?.resolve();if(old)clearTimeout(old.timer);emit({type:'stop'});},play(audio,rate,onStarted){player.stop();if(closed||!enabled)return Promise.resolve();if(!(audio instanceof Float32Array)||audio.length>2880000||!Number.isInteger(rate)||rate<8000||rate>96000)return Promise.reject(Error('Invalid speech audio'));return new Promise((resolve,reject)=>{const id=++playId,timer=setTimeout(()=>{player.stop();reject(Error('Audio output unavailable'));},125000);playing={id,resolve,reject,onStarted,timer};emit({type:'audio',id,audio,rate});});}};
  const readOpinion=name=>new Promise(resolve=>{cancelOpinions();const id=++opinionId,timer=setTimeout(()=>{pendingOpinions.delete(id);resolve(null);},2000);pendingOpinions.set(id,{resolve,timer});service({type:'opinion',id,name});});
  const cancelOpinions=()=>{for(const p of pendingOpinions.values()){clearTimeout(p.timer);p.resolve(null);}pendingOpinions.clear();};
  async function disable(){enabled=false;settings.enabled=false;const token=++generation;controller?.abort();service({type:'enabled',value:false});cancelOpinions();const previous=box;box=null;worker=null;previous?.reset();player.stop();await previous?.disable();if(token===generation)update('disabled');await persist();}
  async function enable(){if(enabled||closed)return;enabled=true;settings.enabled=true;const token=++generation;controller=new AbortController();const signal=controller.signal;update('preparing');try{await persist();
    const operation=preparation.catch(()=>{}).then(()=>token===generation?models(path.join(directory,'models'),{signal,onProgress:()=>{if(token===generation)update('downloading');}}):null);preparation=operation;const modelDir=await operation;
    if(token!==generation||closed)return;
    worker=new workerClass(modelDir,{workerFactory,options:{provider:'auto',model:'model.onnx',threads:2,arena:true}});
    box=boxFactory({worker,player,settings,readOpinion,onSettingsChanged:()=>{const entries=Object.entries(settings.serviceSpeakers??{});settings.serviceSpeakers=Object.fromEntries(entries.slice(-512));void persist().catch(()=>update('unavailable'));},onStatus:s=>{if(token!==generation)return;if(['ready','playing'].includes(s.state))update('listening');else if(s.state==='speech-error'||s.state==='playback-error')update('speech-error');}});
    await box.enable();if(token!==generation||closed)return;service({type:'enabled',value:true});update('waiting');
  }catch(error){if(token!==generation||closed)return;await disable().catch(()=>{});update('unavailable');}}
  const ready=(async()=>{try{const saved=JSON.parse(await fs.readFile(path.join(directory,'settings.json'),'utf8'));if(typeof saved.enabled==='boolean')settings.enabled=saved.enabled;if(Number.isFinite(saved.volume)&&saved.volume>=0&&saved.volume<=1)settings.volume=saved.volume;for(const key of ['serviceSpeakers','voicesByName','gendersByName'])if(saved[key]&&typeof saved[key]==='object'&&!Array.isArray(saved[key]))settings[key]=Object.fromEntries(Object.entries(saved[key]).slice(-512).filter(([k,v])=>k.length<256&&typeof v==='string'&&v.length<256));}catch{}return status();})();
  return {ready,status,async command(message){await ready;if(closed||!message||typeof message!=='object')return status();
    if(message.type==='get')return status();
    if(message.type==='enabled'&&typeof message.value==='boolean'){if(message.value)void enable();else await disable();}
    if(message.type==='volume'&&Number.isFinite(message.value)&&message.value>=0&&message.value<=1){settings.volume=message.value;player.setVolume(message.value);if(box)box.volume(message.value);await persist();emit({type:'status',...status()});}
    if(message.type==='audio-started'&&message.id===playing?.id)playing.onStarted();
    if(message.type==='audio-ended'&&message.id===playing?.id){clearTimeout(playing.timer);const p=playing;playing=null;p.resolve();}
    if(message.type==='audio-error'&&message.id===playing?.id){const p=playing;player.stop();p.reject(Error('Audio output failed'));}
    if(message.type==='renderer-ready'){player.stop();emit({type:'volume',value:settings.volume});if(settings.enabled&&!enabled)void enable();else emit({type:'status',...status()});}
    return status();},receive(message){if(message?.type==='opinion'){const p=pendingOpinions.get(message.id);if(p){pendingOpinions.delete(message.id);clearTimeout(p.timer);p.resolve(message.value);}return;}if(!enabled||!box)return;if(message?.type==='snapshot')box.accept(message.snapshot);if(message?.type==='reset')box.reset();if(message?.type==='status'){const next=message.status?.state;update(next==='listening'?'listening':next==='disconnected'?'waiting':next==='capture-unavailable'?'unsupported':state);}},async close(){await ready;const restore=settings.enabled;closed=true;await disable();settings.enabled=restore;await persist();await saveChain;}};
}
