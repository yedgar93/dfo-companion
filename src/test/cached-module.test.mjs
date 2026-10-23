import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {proveCachedModule,inspectCached} from '../cached-module.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const sources={player:'const player={isPlayer:true}; export {player as GF};',host:'import {GF as p} from "./worldTick-TEST.js"; canvas.addEventListener("click",()=>p.health);'};
 const player='dagger://game/assets/worldTick-TEST.js',host='dagger://game/assets/world-TEST.js';
 return {scripts:[{scriptId:'player',url:player,isModule:true,executionContextId:1},{scriptId:'host',url:host,isModule:true,executionContextId:1}],listeners:[{scriptId:'host'}],sources,contextId:1,manifest:{player:{url:player,export:'GF',sha256:sha(sources.player),healthFunction:'nxe',magickaFunction:'rxe',mapCurrentExport:'_k',mapRecordExport:'gk',mapModelBinding:'iE',learnedNamesExport:'zk',learnedNamesBinding:'MT',hotbarAnchorExport:'UD',hotbarBinding:'LK'},hosts:[{url:host,sha256:sha(sources.host),playerModule:player,playerExport:'GF'}]}};
}
test('cache proof requires executed reviewed host and matching reviewed singleton in same realm',()=>{
 const f=fixture();const p=proveCachedModule(f);assert.equal(p.export,'GF');assert.equal(p.contextId,1);
 assert.throws(()=>proveCachedModule({...f,listeners:[]}),/NO_REVIEWED_EXECUTED_HOST/);
 assert.throws(()=>proveCachedModule({...f,sources:{...f.sources,player:'changed'}}),/PLAYER_SOURCE_NOT_REVIEWED/);
 assert.throws(()=>proveCachedModule({...f,sources:{...f.sources,host:'changed'}}),/NO_REVIEWED_EXECUTED_HOST/);
 assert.throws(()=>proveCachedModule({...f,contextId:2}),/PLAYER_MODULE_NOT_UNIQUE/);
 assert.throws(()=>proveCachedModule({...f,scripts:[...f.scripts,{...f.scripts[0],scriptId:'duplicate'}]}),/PLAYER_MODULE_NOT_UNIQUE/);
});
test('downloaded or parsed modules alone never authorize import; import chain must be reviewed',()=>{
 const f=fixture();f.manifest.hosts[0].playerModule='dagger://game/assets/worldTick-OTHER.js';
 assert.throws(()=>proveCachedModule(f),/UNREVIEWED_IMPORT_CHAIN/);
 f.manifest.hosts[0].playerModule=f.manifest.player.url;f.manifest.player.export='GF); doAnything(';
 assert.throws(()=>proveCachedModule(f),/UNREVIEWED_IMPORT_CHAIN/);
});
test('inspection never imports when sources are unreviewed; no pause/input/control methods sent',async()=>{
 const sent=[];const f=fixture();
 class Socket extends EventTarget{
  constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
  event(method,params){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({method,params})}));}
  send(raw){const m=JSON.parse(raw);sent.push(m);queueMicrotask(()=>{
    let result={};
    if(m.method==='Runtime.enable')this.event('Runtime.executionContextCreated',{context:{id:1,uniqueId:'realm-1',auxData:{isDefault:true}}});
    if(m.method==='Debugger.enable')for(const s of f.scripts)this.event('Debugger.scriptParsed',s);
    if(m.method==='Runtime.evaluate')result={result:{value:true}};
    if(m.method==='DOM.getDocument')result={root:{nodeId:1}};
    if(m.method==='DOM.querySelector')result={nodeId:2};
    if(m.method==='DOM.resolveNode')result={object:{objectId:'canvas'}};
    if(m.method==='DOMDebugger.getEventListeners')result={listeners:f.listeners};
    if(m.method==='Debugger.getScriptSource')result={scriptSource:f.sources[m.params.scriptId]};
    this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:m.id,result})}));
  });}
  close(){}
 }
 const r=await inspectCached('ws://127.0.0.1:9223/devtools/page/A',{Socket});assert.equal(r.ready,false);assert.equal(r.reason,'PLAYER_SOURCE_NOT_REVIEWED');
 assert.ok(!sent.some(m=>/pause|resume|Breakpoint|Input|reload|setScript/i.test(m.method)));
 assert.ok(!sent.some(m=>m.params?.expression?.includes('import(')));
 assert.ok(sent.filter(m=>m.method==='Runtime.evaluate').every(m=>m.params.throwOnSideEffect&&m.params.uniqueContextId==='realm-1'));
 assert.ok(sent.some(m=>m.method==='Debugger.disable'));
});
test('verified cached read uses only exact approved module in same unique realm and closes',async()=>{
 const sent=[];const f=fixture();let closed=false;
 class Socket extends EventTarget{
  constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
  event(method,params){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({method,params})}));}
  send(raw){const m=JSON.parse(raw);sent.push(m);queueMicrotask(()=>{
    let result={};
    if(m.method==='Runtime.enable')this.event('Runtime.executionContextCreated',{context:{id:1,uniqueId:'realm-1',auxData:{isDefault:true}}});
    if(m.method==='Debugger.enable')for(const s of f.scripts)this.event('Debugger.scriptParsed',s);
    if(m.method==='Runtime.evaluate')result={result:m.params.expression.startsWith('location.')?{value:true}:m.params.expression.startsWith('import(')?{objectId:'module'}:{objectId:'canvas'}};
    if(m.method==='Runtime.getProperties'&&m.params.objectId==='module')result={result:[{name:'GF',value:{objectId:'player'}}]};
    if(m.method==='Runtime.callFunctionOn'&&m.params.objectId==='player')result={result:{value:{available:true,vitals:{health:{current:7,max:9}},inventory:{items:[]},spells:{}}}};
    if(m.method==='DOM.getDocument')result={root:{nodeId:1}};
    if(m.method==='DOM.querySelector')result={nodeId:2};
    if(m.method==='DOM.resolveNode')result={object:{objectId:'canvas'}};
    if(m.method==='DOMDebugger.getEventListeners')result={listeners:f.listeners};
    if(m.method==='Debugger.getScriptSource')result={scriptSource:f.sources[m.params.scriptId]};
    this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:m.id,result})}));
  });}
  close(){closed=true;}
 }
 const r=await inspectCached('ws://127.0.0.1:9223/devtools/page/A',{Socket,reviewManifest:f.manifest,read:true});assert.equal(r.vitals.health.current,7);
 const imports=sent.filter(m=>m.params?.expression?.startsWith('import('));assert.equal(imports.length,1);const p=imports[0].params;
 assert.equal(p.expression,'import("dagger://game/assets/worldTick-TEST.js")');assert.ok(sent.some(m=>m.method==='Runtime.callFunctionOn'&&m.params.objectId==='player'&&m.params.functionDeclaration.includes('readPlayer')));assert.equal(p.uniqueContextId,'realm-1');assert.equal(p.awaitPromise,true);assert.equal(p.userGesture,false);assert.equal(closed,true);
 const sourceRead=sent.findIndex(m=>m.method==='Debugger.getScriptSource');assert.ok(sourceRead<sent.indexOf(imports[0]));
});
