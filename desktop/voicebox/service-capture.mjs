import {DialogueCapture} from './src/capture.mjs';
import {readCurrentOpinion} from './src/core/opinion-core.mjs';
// Shares the reader's authenticated connection. No sockets, timers, launchers,
// save reads or independent game discovery are created by this module.
export function createServiceCapture({subscribe,send,captureFactory=(c,o)=>new DialogueCapture(c,o),opinion=readCurrentOpinion}){
  let enabled=false,connection=null,capture=null,generation=0,serial=Promise.resolve();
  const queue=()=>{const token=++generation;serial=serial.catch(()=>{}).then(async()=>{const old=capture;capture=null;await old?.close();if(!enabled||!connection||connection.closed||token!==generation)return;const c=connection,adapter={call:(...args)=>c.send(...args),on:(...args)=>c.on(...args),off:(...args)=>c.off(...args),contexts:c.contexts};
    const current=captureFactory(adapter,{onSnapshot:snapshot=>{if(enabled&&token===generation)send({type:'snapshot',snapshot});},onReset:()=>send({type:'reset'}),onStatus:status=>{if(enabled&&token===generation)send({type:'status',status});}});capture=current;
    try{await current.attach();}catch{if(capture===current){capture=null;await current.close();send({type:'status',status:{state:'capture-unavailable'}});}}
  });return serial;};
  const unsubscribe=subscribe(next=>{if(connection===next)return;connection=next;void queue();});
  return {setEnabled(value){enabled=value===true;return queue();},async opinion(name){const c=connection,token=generation;if(!enabled||!capture||!c||typeof name!=='string'||name.length>256)return null;const result=await opinion({call:(...args)=>c.send(...args)},name);return token===generation?result:null;},async close(){enabled=false;unsubscribe();await queue();}};
}
