import {fork} from 'node:child_process';
import {EventEmitter} from 'node:events';
// Separate owned process releases native/GPU allocations fully when disabled.
// Companion can inject an Electron utilityProcess adapter with this same API.
class ProcessWorker extends EventEmitter {
  constructor(url,config){super();this.child=fork(url,[JSON.stringify(config.workerData)],{execArgv:[],serialization:'advanced',windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});this.child.on('message',m=>this.emit('message',m));this.child.on('error',e=>this.emit('error',e));this.child.on('exit',code=>this.emit('exit',code));this.child.stderr.on('data',()=>{});}
  postMessage(message){if(this.child.connected)this.child.send(message,error=>{if(error)this.emit('error',error);});}
  async terminate(){if(this.child.exitCode!==null)return;await new Promise(resolve=>{this.child.once('exit',resolve);this.child.kill();});}
}
export class SpeechWorker {
  constructor(modelDir,{options={provider:'auto',model:'model.onnx',threads:2,arena:true},workerFactory=(url,config)=>new ProcessWorker(url,config)}={}){this.modelDir=modelDir;this.options=options;this.workerFactory=workerFactory;this.jobs=new Map();this.seq=0;this.generation=0;}
  enable(){if(this.ready)return this.ready;const child=this.workerFactory(new URL('./worker.mjs',import.meta.url),{execArgv:[],workerData:{modelDir:this.modelDir,options:this.options,generation:this.generation}});this.child=child;
    this.ready=new Promise((resolve,reject)=>{this.rejectReady=reject;const timer=setTimeout(()=>{reject(Error('Model warm-up timed out'));void this.disable();},90000);this.readyTimer=timer;
      child.on('message',m=>{if(this.child!==child)return;if(m.type==='ready'){clearTimeout(timer);resolve(m);return;}const job=this.jobs.get(m.id);if(!job)return;this.jobs.delete(m.id);clearTimeout(job.timer);if(m.type==='audio'&&m.generation===this.generation)job.resolve(m);else job.reject(Error(m.error??'Stale speech discarded'));});
      const fail=error=>{if(this.child!==child)return;clearTimeout(timer);reject(error);this.cancel();this.child=null;this.ready=null;};child.on('error',fail);child.on('exit',()=>fail(Error('Speech worker exited')));
    });return this.ready;
  }
  async synth(text,voice,speed=1,pitch=1){const generation=this.generation;await this.enable();if(generation!==this.generation)throw Error('Speech cancelled');if(!Number.isFinite(pitch)||pitch<.85||pitch>1.15)throw Error('Invalid pitch');if(this.jobs.size>=2)throw Error('One-sentence prefetch limit');
    return new Promise((resolve,reject)=>{const id=++this.seq,timer=setTimeout(()=>{this.jobs.delete(id);reject(Error('Synthesis timed out'));this.cancel();},30000);this.jobs.set(id,{resolve,reject,timer});this.child.postMessage({type:'synth',id,generation,text,voice,speed,pitch});});
  }
  cancel(){this.generation++;for(const job of this.jobs.values()){clearTimeout(job.timer);job.reject(Error('Speech cancelled'));}this.jobs.clear();this.child?.postMessage({type:'cancel',generation:this.generation});}
  async disable(){this.cancel();clearTimeout(this.readyTimer);this.rejectReady?.(Error('Speech disabled'));const child=this.child;this.child=null;this.ready=null;if(child)await child.terminate();}
}
