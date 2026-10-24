import fs from 'node:fs/promises';
const binding='__dfoVoiceBoxPortableBindingV1';
export class DialogueCapture {
  // connection is supplied and authenticated by the host. Never launches a game.
  constructor(connection,{onSnapshot,onReset,onStatus=()=>{}}){this.cdp=connection;this.onSnapshot=onSnapshot;this.onReset=onReset;this.onStatus=onStatus;this.handlers=[];this.contexts=new Map();this.injected=new Set();this.pending=[];this.closed=false;}
  on(event,handler){this.cdp.on(event,handler);this.handlers.push([event,handler]);}
  payload(context,payload){if(this.closed||context!==this.context||typeof payload!=='string'||payload.length>60000)return;let snapshot;try{snapshot=JSON.parse(payload);}catch{return;}if(!this.document){this.pending.push([context,payload]);if(this.pending.length>8)this.pending.shift();return;}if(snapshot.documentId===this.document)this.onSnapshot(snapshot);}
  async inject(context){if(this.closed||!this.ready||this.injected.has(context))return;this.injected.add(context);this.context=context;this.document=null;this.onReset();
    try{const result=await this.cdp.call('Runtime.evaluate',{expression:this.observer,contextId:context,returnByValue:true});if(result.exceptionDetails||typeof result.result?.value!=='string')throw Error('Unsupported dialogue observer');if(this.closed||context!==this.context)return;this.document=result.result.value;for(const [id,payload] of this.pending.splice(0))this.payload(id,payload);this.onStatus({state:'listening'});}catch(error){this.injected.delete(context);this.onStatus({state:'capture-unavailable',message:error.message});}}
  reset(){this.context=null;this.document=null;this.pending=[];this.onReset();}
  async attach(){
    for(const context of this.cdp.contexts?.values()??[])if(context.auxData?.isDefault)this.contexts.set(context.id,context);
    this.observer=await fs.readFile(new URL('./observe-page.js',import.meta.url),'utf8');
    this.on('Runtime.executionContextCreated',({context})=>{if(context.auxData?.isDefault){this.contexts.set(context.id,context);if(this.ready&&context.auxData.frameId===this.mainFrame)void this.inject(context.id);}});
    this.on('Runtime.executionContextDestroyed',({executionContextId})=>{this.contexts.delete(executionContextId);this.injected.delete(executionContextId);if(executionContextId===this.context)this.reset();});
    this.on('Runtime.executionContextsCleared',()=>{this.contexts.clear();this.injected.clear();this.reset();});
    this.on('Runtime.bindingCalled',event=>{if(event.name===binding)this.payload(event.executionContextId,event.payload);});
    this.on('disconnect',()=>{this.reset();this.onStatus({state:'disconnected'});});
    await this.cdp.call('Page.enable');const {frameTree}=await this.cdp.call('Page.getFrameTree');
    if(!/^dagger:\/\/game\/play\/index\.html(?:[?#]|$)/.test(frameTree?.frame?.url??''))throw Error('Connection is not the DFO game page');this.mainFrame=frameTree.frame.id;
    if(this.closed)return;
    this.on('Page.frameNavigated',({frame})=>{if(!frame.parentId){this.mainFrame=frame.id;this.ready=/^dagger:\/\/game\/play\/index\.html(?:[?#]|$)/.test(frame.url??'');this.injected.clear();this.reset();}});
    await this.cdp.call('Runtime.enable');if(this.closed)return;await this.cdp.call('Runtime.addBinding',{name:binding});this.bound=true;if(this.closed){await this.cdp.call('Runtime.removeBinding',{name:binding}).catch(()=>{});return;}
    this.script=(await this.cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:this.observer})).identifier;if(this.closed){await this.cdp.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:this.script}).catch(()=>{});return;}this.ready=true;
    const context=[...this.contexts.values()].find(c=>c.auxData.frameId===this.mainFrame);if(context)await this.inject(context.id);
  }
  async close(){if(this.closed)return;this.closed=true;for(const [event,fn] of this.handlers)this.cdp.off(event,fn);this.handlers=[];this.onReset();
    if(this.context)await this.cdp.call('Runtime.evaluate',{expression:'globalThis.__dfoVoiceBoxPortableV1?.teardown()',contextId:this.context}).catch(()=>{});
    if(this.script)await this.cdp.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:this.script}).catch(()=>{});
    if(this.bound)await this.cdp.call('Runtime.removeBinding',{name:binding}).catch(()=>{});
    // Companion owns this connection; do not close or disable its Runtime/Page.
  }
}
