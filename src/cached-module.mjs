import {acceptDungeonMapEvent} from './dashboard-dungeon-cache.mjs';
import {interiorSceneKey} from './dashboard-interior-model.mjs';
import {deriveCompatibleProfile} from './automatic-profile.mjs';
import {fastDashboardEligible,readFastDashboard,retainDashboardReader} from './dashboard-fast-reader.mjs';
import {readResource} from './dashboard-resources.mjs';
import {copyPublicTownRaster,copyOwnTownPose,copyPublicTownYards}from'./town-map.mjs';
import {copyPublicQuestTracker,copyPublicQuestMapPoints,enrichTrackerDestinations} from './quest-tracker.mjs';
import {copyCurrentQuestAssociation} from './quest-association.mjs';
import {copyNearbyDungeonActions} from './dungeon-actions.mjs';
import {copyKnownLoadedQuestTargets} from './dungeon-targets.mjs';
import {copyLoadedGathering} from './gathering.mjs';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {readPlayer} from './reader.mjs';
import {readNavigationScope,copyDiscoveredMap,copyTownShops,copyHighlightedTarget,copyRevealedGeometry,copyPublicTownEntrances} from './navigation.mjs';
import {readVisibleHud} from './visible-hud.mjs';
import {readVisibleText} from './visible-text.mjs';
import {readVisibleScene} from './scene.mjs';
import {copyLoadedNpcs} from './npc-tracking.mjs';
import {copyInteriorLandmarks} from './landmarks.mjs';
import {copyOwnLetters,readOwnedBookAsset,decodeBookFile,copyOwnedTemplates,enrichInventory} from './item-details.mjs';
import {copyKnownJournal,copyKnownDeadlines} from './journal.mjs';
import {describeSpells,effectSchoolName} from './spells.mjs';
import {copyOwnCostInputs,copyCourtCostContext,copyFirmamentCostValues,copiedModifierRows} from './cost-context.mjs';
import {copyIdentityRenderedPeerPositions} from './peer-positions.mjs';
import {ownerGuidance} from './guidance.mjs';
const bundlePattern=/^dagger:\/\/game\/assets\/(worldTick|world|dungeon|equip|wagonKinds|main|deepWaterRuntime|arenaGate|propBodies|renderer|peerBodies|person|setCard|dataSource|mysticism|spellcast|interiorContext|meshReader|notify|skillSoftcap|sigilSetPowers|gateCourt|weaponRig|pauseDoor|potionRecipes|firmamentLaw|gateBoss|lateSolid|npcBodies)-[\w-]+\.js$/;
const reviewedPath=new URL('./reviewed-bundles.json',import.meta.url);
const sourceDirectory=new URL('../../work/live-source/',import.meta.url);
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};

export async function resolvePoseBindings(mode,exterior,insideNames,readInside){
 if(mode==='exterior')return exterior?.motor?.objectId&&exterior?.camera?.objectId?exterior:null;
 if(!['interior','dungeon'].includes(mode)||!insideNames?.motor||!insideNames?.camera)return null;
 const refs=await readInside(insideNames.motor,insideNames.camera);
 return refs?.motor?.objectId&&refs?.camera?.objectId?refs:null;
}
async function readCurrentOwnLocation(c,binding,manifest,onRefs=null){
 const exterior={motor:binding('W'),camera:binding('U')};if(!exterior.motor?.objectId||!exterior.camera?.objectId)return {available:false,reason:'OWN_POSITION_BINDINGS_UNAVAILABLE'};
 const read=async refs=>{onRefs?.(refs);const args=[{objectId:refs.camera.objectId},...['H','$','gb'].map(n=>{const r=binding(n);return r?.objectId?{objectId:r.objectId}:{value:r?.value??null};})];return value(await c.send('Runtime.callFunctionOn',{objectId:refs.motor.objectId,arguments:args,functionDeclaration:`function(camera,world,modes,place){return (${readNavigationScope.toString()}).call({W:this,U:camera,H:world,$:modes,gb:place});}`,returnByValue:true,throwOnSideEffect:true,silent:true,generatePreview:false}),'CURRENT_OWN_POSE')?.value;};
 const initial=await read(exterior);if(!initial?.available)return initial;if(initial.mode==='exterior')return initial;
 const refs=await resolvePoseBindings(initial.mode,exterior,manifest.insideBindings,async(motorName,cameraName)=>{const modes=binding('$');if(!modes?.objectId)return null;const props=await c.send('Runtime.getProperties',{objectId:modes.objectId,ownProperties:true,generatePreview:false}),getter=props.result?.find(p=>p.name==='mode')?.get;if(!getter?.objectId)return null;return {motor:await closureBinding(c,getter.objectId,motorName),camera:await closureBinding(c,getter.objectId,cameraName)};});
 if(!refs)return {available:false,reason:'CURRENT_INTERIOR_POSITION_BINDINGS_UNAVAILABLE'};const current=await read(refs);return current?.mode===initial.mode?current:{available:false,reason:'SCENE_CHANGED_DURING_POSE_READ'};
}

// These are the complete inspection protocol methods. There is no caller-supplied
// expression/command/target and no breakpoint, pause, input, reload or patch path.
const methods=new Set(['Runtime.enable','Runtime.disable','Runtime.addBinding','Runtime.removeBinding','Runtime.evaluate','Runtime.callFunctionOn','Runtime.getProperties','Runtime.releaseObjectGroup','Debugger.enable','Debugger.disable','Debugger.getScriptSource','DOM.getDocument','DOM.querySelector','DOM.resolveNode','DOM.getBoxModel','DOM.getOuterHTML','DOM.getAttributes','CSS.getComputedStyleForNode','DOM.disable','DOMDebugger.getEventListeners']);
async function connect(address,Socket){
 const socket=new Socket(address),pending=new Map(),contexts=new Map(),scripts=new Map(),allScripts=new Map(),knownScriptIds=new Set(),traffic={calls:0,debuggerEnables:0,sourceReads:0};let id=0,closed=false;
 socket.addEventListener('message',e=>{
  if(typeof e.data!=='string'||e.data.length>24*1024*1024)return;
  let m;try{m=JSON.parse(e.data);}catch{return;}
  if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Object.assign(new Error('INSPECTION_COMMAND_REFUSED'),{code:'INSPECTION_COMMAND_REFUSED'})):p.resolve(m.result);}return;}
  if(m.method==='Runtime.bindingCalled'&&connection.dashboardBinding?.name===m.params?.name&&connection.dashboardBinding.contextId===m.params?.executionContextId){try{if(typeof m.params.payload==='string'&&m.params.payload.length<2000000){const value=JSON.parse(m.params.payload);if(value.mapEvent?.startsWith('dungeon-')){acceptDungeonMapEvent(connection,value);return;}if(value.mapEvent){connection.dashboardPlaces??=new Map;connection.dashboardMaps??=new Map;connection.dashboardMapPending??=new Map;const pending=connection.dashboardMapPending;if(value.mapEvent==='places')for(const row of (value.rows??[]).slice(0,64))connection.dashboardPlaces.set(row.x+','+row.y,row);if(value.mapEvent==='town-metadata'){const row=connection.dashboardMaps.get(value.key);if(row)connection.dashboardMaps.set(value.key,{...row,revision:Date.now(),location:value.location,shops:value.shops,publicYards:value.publicYards});}if(value.mapEvent==='town-start'){if(pending.size>2)pending.clear();pending.set(value.key,{location:value.location,shops:value.shops,publicYards:value.publicYards,townMap:{available:true,pixelKey:value.key,blocks:[],width:0,height:0,metresPerPixel:1.6}});}if(value.mapEvent==='town-block'){const row=pending.get(value.key);if(row&&row.townMap.blocks.length<144&&value.pixels?.length===4096)row.townMap.blocks.push({x:value.x,y:value.y,pixels:value.pixels});}if(value.mapEvent==='town-end'){const row=pending.get(value.key);if(row&&value.width>0&&value.height>0){row.townMap.width=value.width;row.townMap.height=value.height;if(connection.dashboardMaps.size>=8)connection.dashboardMaps.delete(connection.dashboardMaps.keys().next().value);row.revision=Date.now();connection.dashboardMaps.set(value.key,row);}pending.delete(value.key);}return;}if(typeof value?.available==='boolean'){const at=Date.now();connection.dashboardPush={value,at};if(value.available&&!value.dashboardCoreOnly)connection.dashboardDetailPush={value,at};traffic.pushSnapshots=(traffic.pushSnapshots??0)+1;}}}catch{}return;}
  if(m.method==='Runtime.executionContextCreated'){const c=m.params?.context;if(c?.auxData?.isDefault&&c.uniqueId)contexts.set(c.id,c);}
  if(m.method==='Runtime.executionContextDestroyed')contexts.delete(m.params?.executionContextId);
  if(m.method==='Runtime.executionContextsCleared'){contexts.clear();scripts.clear();allScripts.clear();knownScriptIds.clear();}
  if(m.method==='Debugger.scriptParsed'){const s=m.params;if(s?.scriptId)knownScriptIds.add(s.scriptId);if(s?.isModule&&/^dagger:\/\/game\/assets\/[\w-]+\.js$/.test(s.url))allScripts.set(s.scriptId,s);if(s?.isModule&&bundlePattern.test(s.url))scripts.set(s.scriptId,s);}
 });
 const rejectAll=()=>{closed=true;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Object.assign(new Error('INSPECTION_DISCONNECTED'),{code:'INSPECTION_DISCONNECTED'}));}pending.clear();};
 socket.addEventListener('close',rejectAll);socket.addEventListener('error',rejectAll);
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('INSPECTION_CONNECT_TIMEOUT')),2500);socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('INSPECTION_CONNECT_FAILED'));},{once:true});});}catch(e){socket.close();throw e;}
 const send=(method,params={})=>{
  if(!methods.has(method)||closed)fail('INSPECTION_METHOD_REFUSED');
  traffic.calls++;if(method==='Debugger.enable')traffic.debuggerEnables++;if(method==='Debugger.getScriptSource')traffic.sourceReads++;
  const messageId=++id;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(messageId);reject(Object.assign(new Error('INSPECTION_TIMEOUT'),{code:'INSPECTION_TIMEOUT'}));},4000);pending.set(messageId,{resolve,reject,timer});socket.send(JSON.stringify({id:messageId,method,params}));});
 };
 const connection={send,contexts,scripts,allScripts,knownScriptIds,traffic,get closed(){return closed;},close:()=>{if(connection.dashboardBinding&&!closed)void send('Runtime.removeBinding',{name:connection.dashboardBinding.name}).catch(()=>{});socket.close();}};return connection;
}
function value(reply,stage='INSPECTION'){
 if(reply?.exceptionDetails){
  const d=reply.exceptionDetails.exception?.description??'';
  const kind=/side.effect/i.test(d)?'SIDE_EFFECT_GUARD':/not a function/i.test(d)?'API_UNAVAILABLE':/Cannot read/i.test(d)?'MISSING_FIELD':/timed out/i.test(d)?'TIMEOUT':'EVALUATION_REFUSED';
  fail(stage+'_'+kind);
 }
 return reply?.result;
}
async function closureBinding(c,fnId,name){
 const fn=await c.send('Runtime.getProperties',{objectId:fnId,ownProperties:true,generatePreview:false});
 const id=fn.internalProperties?.find(p=>p.name==='[[Scopes]]')?.value?.objectId;if(!id)return null;
 const scopes=await c.send('Runtime.getProperties',{objectId:id,ownProperties:true,generatePreview:false});
 for(const p of scopes.result??[]){if(!/^\d+$/.test(p.name)||!p.value?.objectId||p.value.description==='Global')continue;
  const scope=await c.send('Runtime.getProperties',{objectId:p.value.objectId,ownProperties:true,generatePreview:false});
  const field=scope.result?.find(p=>p.name===name);if(field)return field.value;
 }
 return null;
}
async function refreshDungeonReference(c,cache,loc,needsReference=false){
 if(!cache?.mapBinding||loc?.mode!=='dungeon'){if(cache)cache.dungeonScene=null;return;}
 const key=interiorSceneKey(loc);
 if(cache.dungeonScene!==key){cache.dungeonScene=key;cache.dungeonSince=Date.now();cache.dungeonReady=false;}
 if(needsReference)cache.dungeonReady=false;
 if(cache.dungeonReady||Date.now()-cache.dungeonSince<1500||Date.now()-(cache.dungeonAttempt??0)<5000)return;
 cache.dungeonAttempt=Date.now();try{
 const fn=value(await c.send('Runtime.callFunctionOn',{objectId:cache.objectId,functionDeclaration:'function(){return this.mapAccessor;}',returnByValue:false,objectGroup:'dfo-dungeon-reference',throwOnSideEffect:true,silent:true}),'MAP_ACCESSOR');
 if(!fn?.objectId)return;const view=await closureBinding(c,fn.objectId,cache.mapBinding);if(!view?.objectId)return;
 await c.send('Runtime.callFunctionOn',{objectId:cache.objectId,arguments:[{objectId:view.objectId},{value:key}],functionDeclaration:'function(model,key){this.dungeonModel=model;this.dungeonModelScene=key;this.dungeonNeedsReference=false;}',returnByValue:true,throwOnSideEffect:false,silent:true});cache.dungeonReady=true;
 }catch{}finally{try{await c.send('Runtime.releaseObjectGroup',{objectGroup:'dfo-dungeon-reference'});}catch{}}
}
async function readDynamicPoses(c,colliderId){
 if(!colliderId)return [];
 const list=value(await c.send('Runtime.callFunctionOn',{objectId:colliderId,functionDeclaration:'function(){return Object.getOwnPropertyDescriptor(this,"_broad")?.value?.always;}',throwOnSideEffect:true,silent:true}),'POSE_INDEX');
 if(!list?.objectId)return [];
 const props=await c.send('Runtime.getProperties',{objectId:list.objectId,ownProperties:true,generatePreview:false});
 if((props.result?.find(p=>p.name==='length')?.value?.value??129)>128)return [];
 const poses=[];
 for(const p of props.result??[]){if(!/^\d+$/.test(p.name)||!p.value?.objectId)continue;
  try{const pose=value(await c.send('Runtime.callFunctionOn',{objectId:p.value.objectId,functionDeclaration:'function(){if(!this.moves)return null;const t=this.t(),r=this.r?this.r():null;return {ord:this.ord,translation:[t[0],t[1],t[2]],rotation:r?Array.from(r):null};}',returnByValue:true,throwOnSideEffect:true,silent:true}),'DYNAMIC_POSE')?.value;if(pose)poses.push(pose);}catch{}
 }
 return poses;
}
export async function guardedSpellCosts(c,playerId,calculateId,count,copiedBaselines=[],copyFactory=null){
 const callbacks={};
 for(const name of ['Jp','Xp']){const map=await closureBinding(c,calculateId,name);if(!map?.objectId)fail('COST_MODIFIER_REGISTRY_UNAVAILABLE');
  const array=value(await c.send('Runtime.callFunctionOn',{objectId:map.objectId,functionDeclaration:'function(){return Array.from(this.values()).slice(0,33);}',throwOnSideEffect:false,silent:true}),'COST_MODIFIER_LIST');
  const props=await c.send('Runtime.getProperties',{objectId:array.objectId,ownProperties:true,generatePreview:false});if((props.result?.find(p=>p.name==='length')?.value?.value??33)>32)fail('COST_MODIFIER_LIMIT');callbacks[name]=(props.result??[]).filter(p=>/^\d+$/.test(p.name)).map(p=>p.value?.objectId);if(callbacks[name].some(id=>!id))fail('COST_MODIFIER_INVALID');
 }
 let copies=[];if(copyFactory)try{copies=await copyFactory(callbacks);}catch{}
 const rows=[];
 const started=Date.now();
 for(let i=0;i<Math.min(count,256);i++){
  if(Date.now()-started>3000){for(;i<Math.min(count,256);i++)rows.push({arrayIndex:i,cost:null,reason:'CURRENT_COST_READ_BUDGET'});break;}
  try{let cost,baselineSource='GUARDED_NATIVE';try{cost=value(await c.send('Runtime.callFunctionOn',{objectId:playerId,arguments:[{objectId:calculateId},{value:i}],functionDeclaration:'function(calculate,i){const spell=Object.getOwnPropertyDescriptor(this,"spells")?.value?.[i];return calculate(spell,this,{portMods:false}).sp;}',returnByValue:true,throwOnSideEffect:true,silent:true}),'BASE_CURRENT_COST')?.value;}catch(e){const fallback=copiedBaselines[i];if(e.code==='BASE_CURRENT_COST_SIDE_EFFECT_GUARD'&&fallback?.complete&&Number.isFinite(fallback.cost)){cost=fallback.cost;baselineSource='COPIED_REVIEWED_BASELINE';}else throw e;}if(!Number.isFinite(cost))fail('CURRENT_COST_INVALID');
   for(const [j,id]of callbacks.Jp.entries()){let v;try{v=value(await c.send('Runtime.callFunctionOn',{objectId:playerId,arguments:[{objectId:id},{value:i},{value:cost}],functionDeclaration:'function(callback,i,cost){const spell=Object.getOwnPropertyDescriptor(this,"spells")?.value?.[i];return callback(this,cost,spell);}',returnByValue:true,throwOnSideEffect:true,silent:true}),'CURRENT_COST_MODIFIER')?.value;}catch(e){const copy=copies[i]?.modifiers?.[j];if(e.code==='CURRENT_COST_MODIFIER_SIDE_EFFECT_GUARD'&&copy?.known){v=copy.scale!==undefined?cost*copy.scale:cost*(100-copy.less)/100;}else throw e;}if(Number.isFinite(v))cost=Math.max(1,Math.round(v));}
   for(const [j,id]of callbacks.Xp.entries()){let free;try{free=value(await c.send('Runtime.callFunctionOn',{objectId:playerId,arguments:[{objectId:id},{value:i}],functionDeclaration:'function(callback,i){const spell=Object.getOwnPropertyDescriptor(this,"spells")?.value?.[i];return callback(this,spell);}',returnByValue:true,throwOnSideEffect:true,silent:true}),'CURRENT_FREE_CAST')?.value;}catch(e){const copy=j===0?copies[i]?.free:null;if(e.code==='CURRENT_FREE_CAST_SIDE_EFFECT_GUARD'&&copy?.known)free=copy.value;else throw e;}if(free===true){cost=0;break;}}
   rows.push({arrayIndex:i,cost,baselineSource});
  }catch(e){rows.push({arrayIndex:i,cost:null,reason:e.code??'CURRENT_COST_UNAVAILABLE'});}
 }
 return rows;
}
async function captureCostSources(c,calculateId){
 const descriptions=[];
 for(const name of ['Jp','Xp']){const map=await closureBinding(c,calculateId,name);if(!map?.objectId)continue;
  const array=value(await c.send('Runtime.callFunctionOn',{objectId:map.objectId,functionDeclaration:'function(){return Array.from(this.values()).slice(0,32);}',throwOnSideEffect:false,silent:true}),'MODIFIER_REFERENCES');
  const props=await c.send('Runtime.getProperties',{objectId:array.objectId,ownProperties:true,generatePreview:false});
  for(const p of props.result??[]){if(!/^\d+$/.test(p.name)||!p.value?.objectId)continue;const fn=await c.send('Runtime.getProperties',{objectId:p.value.objectId,ownProperties:true,generatePreview:false}),loc=fn.internalProperties?.find(p=>p.name==='[[FunctionLocation]]')?.value?.value,info=c.allScripts.get(loc?.scriptId);if(!info)continue;
   const {scriptSource}=await c.send('Debugger.getScriptSource',{scriptId:loc.scriptId});await writeFile(new URL(info.url.split('/').at(-1),sourceDirectory),scriptSource);descriptions.push({registry:name,index:Number(p.name),url:info.url,sha256:hash(scriptSource),location:loc});
   const helpers={Jp:{0:['ae','re'],1:['ba'],2:['Er','Or'],3:['Kt','op'],4:['fv','_v','Sy']},Xp:{0:['g']}};
   for(const symbol of helpers[name]?.[Number(p.name)]??[]){const ref=await closureBinding(c,p.value.objectId,symbol);if(!ref?.objectId)continue;const meta=await c.send('Runtime.getProperties',{objectId:ref.objectId,ownProperties:true,generatePreview:false}),location=meta.internalProperties?.find(p=>p.name==='[[FunctionLocation]]')?.value?.value,module=c.allScripts.get(location?.scriptId);if(!module)continue;const {scriptSource:body}=await c.send('Debugger.getScriptSource',{scriptId:location.scriptId});await writeFile(new URL(module.url.split('/').at(-1),sourceDirectory),body);descriptions.push({helper:symbol,registry:name,index:Number(p.name),url:module.url,sha256:hash(body),location});}
  }
 }
 await writeFile(new URL('../../work/cost-modifier-locations.json',import.meta.url),JSON.stringify(descriptions,null,2));
}
async function reviewedCostCopies(c,playerId,player,callbacks,manifest,sources){
 const review=manifest.costCopies;if(!review)return [];
 for(const group of ['Jp','Xp']){
  if(callbacks[group].length!==review[group].length)fail('COST_CALLBACK_SET_CHANGED');
  for(let i=0;i<callbacks[group].length;i++){const id=callbacks[group][i],expected=review[group][i],props=await c.send('Runtime.getProperties',{objectId:id,ownProperties:true,generatePreview:false}),loc=props.internalProperties?.find(p=>p.name==='[[FunctionLocation]]')?.value?.value,info=c.allScripts.get(loc?.scriptId);
   if(info?.url!==expected.url||hash(sources[loc?.scriptId]??'')!==expected.sha256||loc.lineNumber!==expected.location.lineNumber||loc.columnNumber!==expected.location.columnNumber)fail('COST_CALLBACK_SOURCE_CHANGED');
   const text=value(await c.send('Runtime.callFunctionOn',{objectId:id,functionDeclaration:'function(){return Function.prototype.toString.call(this);}',returnByValue:true,throwOnSideEffect:false,silent:true}),'COST_CALLBACK_TEXT')?.value;if(hash(text??'')!==expected.functionSha256)fail('COST_CALLBACK_BODY_CHANGED');
  }
 }
 const inputs=value(await c.send('Runtime.callFunctionOn',{objectId:playerId,functionDeclaration:copyOwnCostInputs.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'OWN_COST_INPUTS')?.value;if(!inputs?.available)return [];
 const arg=r=>r?.objectId?{objectId:r.objectId}:{value:r?.value??null};
 const context=await closureBinding(c,callbacks.Jp[1],'$'),tableFunction=await closureBinding(c,callbacks.Jp[1],'ba'),focusTable=await closureBinding(c,tableFunction?.objectId,'P'),familyTable=await closureBinding(c,tableFunction?.objectId,'M'),lastBoard=await closureBinding(c,callbacks.Xp[0],'Xv'),counter=await closureBinding(c,callbacks.Xp[0],'Iv');
 const court=value(await c.send('Runtime.callFunctionOn',{objectId:playerId,arguments:[context,focusTable,familyTable,lastBoard,counter].map(arg),functionDeclaration:copyCourtCostContext.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'OWN_COURT_COST')?.value??{available:false};
 const reader=await closureBinding(c,callbacks.Jp[4],'fv'),disabledReader=await closureBinding(c,callbacks.Jp[4],'op'),disabled=await closureBinding(c,disabledReader?.objectId,'x'),frozen=await closureBinding(c,callbacks.Jp[4],'GB');
 let firmament={available:false,reason:'FIRMAMENT_COST_CONTEXT_UNAVAILABLE'};
 if(inputs.mentor||disabled?.value===true||frozen?.value===true){firmament={available:true,gains:{},prices:{}};if(disabled?.value===true)inputs.wardwright={known:true,less:0};}
 else if(disabled?.value===false&&frozen?.value===false){const enabled=await closureBinding(c,reader?.objectId,'Xa');
  if(enabled?.value===false)firmament={available:true,gains:{},prices:{}};
  else if(enabled?.value===true){const config=await closureBinding(c,reader?.objectId,'Ja'),data=await closureBinding(c,reader?.objectId,'Ya');if(config?.objectId){const props=await c.send('Runtime.getProperties',{objectId:config.objectId,ownProperties:true,generatePreview:false}),start=props.result?.find(p=>p.name==='start');if(start?.value){if(!start.value.value)firmament={available:true,gains:{},prices:{}};else if(data?.objectId)firmament=value(await c.send('Runtime.callFunctionOn',{objectId:data.objectId,functionDeclaration:copyFirmamentCostValues.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'OWN_FIRMAMENT_COST')?.value??firmament;}}}
 }
 const rows=copiedModifierRows(player,inputs,court,firmament,effectSchoolName);
 player.spells.currentCostContext={reviewed:true,source:'Fingerprint-matched callback set, copied data-only context, guarded native callbacks retained',moraKnown:inputs.mora.known,equipmentKnown:inputs.equipment.known,wardwrightKnown:inputs.wardwright.known,courtKnown:court.available,firmamentKnown:firmament.available,scope:'Unknown positive set/gear/specialization cases remain unavailable; no gameplay hook or settings getter is invoked by the copied context.'};
 return rows;
}
async function worldBindings(c,listeners,scripts,proof,sources){
 const host=scripts.find(s=>s.url===proof.host),listener=listeners.find(l=>l.scriptId===host?.scriptId&&(l.originalHandler?.objectId||l.handler?.objectId));
 const handler=listener?.originalHandler?.objectId??listener?.handler?.objectId;if(!handler)return ()=>null;
 const fn=await c.send('Runtime.getProperties',{objectId:handler,ownProperties:true,generatePreview:false});
 const id=fn.internalProperties?.find(p=>p.name==='[[Scopes]]')?.value?.objectId;if(!id)return ()=>null;
 const list=await c.send('Runtime.getProperties',{objectId:id,ownProperties:true,generatePreview:false});
 const scope=list.result?.find(p=>p.value?.description===`Closure (${proof.scopeName})`||p.value?.description===`Block (${proof.scopeName})`)?.value;
 if(!scope?.objectId)return ()=>null;
 const props=await c.send('Runtime.getProperties',{objectId:scope.objectId,ownProperties:true,generatePreview:false});
 return name=>props.result?.find(p=>p.name===(name==='publicQuestPlaces'&&sources[host.scriptId]?.includes('ra.set(t.mapTableData.mapId>>>0')?'ra':proof.bindings?.[name]))?.value;
}
export function proveCachedModule({scripts,listeners,sources,manifest,contextId}){
 const candidates=[...scripts].filter(s=>s.executionContextId===contextId&&s.isModule&&/\/worldTick-[\w-]+\.js$/.test(s.url));
 if(candidates.length!==1)fail('PLAYER_MODULE_NOT_UNIQUE');
 const player=candidates[0],review=manifest.player;
 if(player.url!==review.url||hash(sources[player.scriptId]??'')!==review.sha256)fail('PLAYER_SOURCE_NOT_REVIEWED');
 const activeHosts=[...scripts].filter(s=>s.executionContextId===contextId&&s.isModule&&/\/(world|dungeon)-[\w-]+\.js$/.test(s.url)&&listeners.some(l=>l.scriptId===s.scriptId));
 const host=activeHosts.find(s=>manifest.hosts.some(h=>h.url===s.url&&h.sha256===hash(sources[s.scriptId]??'')));
 if(!host)fail('NO_REVIEWED_EXECUTED_HOST');
 // Review manifest records a verified direct static import of this singleton.
 // A listener registered by that host proves its code executed, so its static
 // dependency completed evaluation. Merely parsed/downloaded scripts fail.
 const hostReview=manifest.hosts.find(h=>h.url===host.url);
 if(hostReview.playerModule!==review.url||hostReview.playerExport!==review.export||!/^[$A-Z_a-z][$\w]*$/.test(review.export))fail('UNREVIEWED_IMPORT_CHAIN');
 return {module:review.url,export:review.export,host:host.url,contextId,scopeName:hostReview.scopeName??'DRt',bindings:manifest.bindings??{}};
}
export function selectReviewedProfile(manifest,scripts,sources){
 if(!manifest.profiles)return manifest;
 return manifest.profiles.find(p=>scripts.some(s=>s.url===p.player.url&&hash(sources[s.scriptId]??'')===p.player.sha256))??deriveCompatibleProfile(scripts,sources);
}
export async function inspectCached(address,{read=false,capture=false,navigationOnly=false,navigationCommand='location',documentOnly=false,dashboardCore=false,dashboardLive=false,session=null,townGeometryKeys=[],Socket=WebSocket,reviewManifest}={}){
 const reusable=session?.connection&&!session.connection.closed&&session.address===address;
 const c=reusable?session.connection:await connect(address,Socket);let debuggerEnabled=false,usedFast=false;
 if(session&&!reusable){session.lowImpact=null;session.templates=null;session.sources=null;session.connection=c;session.address=address;}
 try{
  if(!reusable)await c.send('Runtime.enable');
  const contexts=[...c.contexts.values()];if(contexts.length!==1)fail('MAIN_CONTEXT_NOT_UNIQUE');
  const context=contexts[0];
  const warm=!!session?.sources&&session.contextId===context.uniqueId&&!capture;
  if(read&&dashboardLive&&!navigationOnly&&!documentOnly&&warm&&fastDashboardEligible(session,context)){try{const result=await readFastDashboard(c,session.lowImpact);session.stats.fastReads++;await refreshDungeonReference(c,session.lowImpact,result.dashboardPose?.location,result.dashboardDungeonNeedsReference);if(result.dashboardSceneChanged||!result.available&&result.reason!=='IDLE_READER_WAITING')session.lowImpact=null;if(result.inventory?.items&&session.templates?.size)enrichInventory(result.inventory.items,[...session.templates.values()]);usedFast=true;return result;}catch(error){session.stats.fastReadErrors=(session.stats.fastReadErrors??0)+1;session.stats.lastFastReadError=String(error?.code??error?.message??'FAST_READ_FAILED').slice(0,160);usedFast=true;return {available:false,reason:'IDLE_READER_WAITING'};}}
  if(!warm){if(session)session.templates=null;await c.send('Debugger.enable',{maxScriptsCacheSize:16000000});debuggerEnabled=true;}
  const base={uniqueContextId:context.uniqueId,disableBreaks:true,silent:true,userGesture:false,includeCommandLineAPI:false,generatePreview:false,timeout:250};
  const page=value(await c.send('Runtime.evaluate',{...base,expression:'location.protocol === "dagger:" && location.host === "game" && location.pathname === "/play/index.html"',returnByValue:true,throwOnSideEffect:true}),'PAGE_CHECK');
  if(page?.value!==true)fail('PAGE_CHANGED');
  if(documentOnly){const text=value(await c.send('Runtime.evaluate',{...base,expression:`(${readVisibleText.toString()})()`,returnByValue:true,throwOnSideEffect:false,timeout:500}),'VISIBLE_TEXT_READ')?.value;return {available:!!text?.available,visibleText:text??{available:false,reason:'VISIBLE_TEXT_UNAVAILABLE'}};}

  const {root}=await c.send('DOM.getDocument',{depth:0,pierce:false});
  if(!root?.nodeId)fail('GAME_DOCUMENT_UNAVAILABLE');
  const {nodeId}=await c.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#c'});
  if(!nodeId)fail('GAME_CANVAS_UNAVAILABLE');
  const {object:canvas}=await c.send('DOM.resolveNode',{nodeId,executionContextId:context.id,objectGroup:'dfo-observer-proof'});
  if(!canvas?.objectId||canvas.subtype==='null')fail('GAME_CANVAS_UNAVAILABLE');
  const {listeners=[]}=await c.send('DOMDebugger.getEventListeners',{objectId:canvas.objectId,depth:0,pierce:false});
  if(listeners.length>2048)fail('TOO_MANY_LISTENERS');
  if(warm&&listeners.some(l=>l.scriptId&&!c.knownScriptIds.has(l.scriptId))){session.sources=null;fail('REVIEWED_RUNTIME_CHANGED');}
  const scripts=[...c.scripts.values()].filter(s=>s.executionContextId===context.id);
  const sources=warm?session.sources:{};const summary=[];
  // Proof phase reads source only. After proof, fixed reviewed bindings are selected below.
  if(!warm)for(const s of scripts){const {scriptSource}=await c.send('Debugger.getScriptSource',{scriptId:s.scriptId});if(typeof scriptSource!=='string'||scriptSource.length>12000000)fail('INVALID_REVIEW_SOURCE');sources[s.scriptId]=scriptSource;summary.push({url:s.url,sha256:hash(scriptSource),canvasListenerRegistered:listeners.some(l=>l.scriptId===s.scriptId)});if(capture){await mkdir(sourceDirectory,{recursive:true});await writeFile(new URL(new URL(s.url).pathname.split('/').at(-1),sourceDirectory),scriptSource);}}
  if(!c.contexts.has(context.id))fail('PAGE_CHANGED');
  if(session){session.sources=sources;session.contextId=context.uniqueId;session.stats??={proofReads:0,fastReads:0};session.stats[warm?'fastReads':'proofReads']++;}
  let manifest;try{manifest=reviewManifest??JSON.parse(await readResource('reviewed-bundles.json','utf8'));}catch{fail('REVIEW_MANIFEST_MISSING');}
  manifest=warm&&session?.resolvedProfile?session.resolvedProfile:selectReviewedProfile(manifest,scripts,sources);if(session&&manifest)session.resolvedProfile=manifest;if(!manifest){if(read)fail('PLAYER_SOURCE_NOT_REVIEWED');return {ready:false,reason:'PLAYER_SOURCE_NOT_REVIEWED',sources:summary};}
  let proof;try{proof=proveCachedModule({scripts,listeners,sources,manifest,contextId:context.id});}catch(e){if(read)throw e;return {ready:false,reason:e.code??'PROOF_FAILED',sources:summary};}
  if(!read)return {ready:true,proof,sources:summary};
  for(const name of ['mapCurrentExport','mapRecordExport','mapModelBinding','learnedNamesExport','learnedNamesBinding','hotbarAnchorExport','hotbarBinding','healthFunction','magickaFunction'])if(!/^[$A-Z_a-z][$\w]*$/.test(manifest.player[name]??''))fail('REVIEWED_PROFILE_BINDING_MISSING');
  if(navigationOnly){
   const modesDependency=manifest.navigationDependencies?.find(d=>d.role==='world-modes');
   const modesScript=scripts.find(s=>s.url===modesDependency?.url);
   if(!modesScript||hash(sources[modesScript.scriptId]??'')!==modesDependency.sha256)fail('WORLD_MODES_SOURCE_NOT_REVIEWED');
   const host=scripts.find(s=>s.url===proof.host);
   const listener=listeners.find(l=>l.scriptId===host?.scriptId&&(l.originalHandler?.objectId||l.handler?.objectId));
   const handlerId=listener?.originalHandler?.objectId??listener?.handler?.objectId;
   if(!handlerId)fail('REVIEWED_HOST_LISTENER_UNAVAILABLE');
   const fn=await c.send('Runtime.getProperties',{objectId:handlerId,ownProperties:true,generatePreview:false});
   const listId=fn.internalProperties?.find(p=>p.name==='[[Scopes]]')?.value?.objectId;
   if(!listId)fail('HOST_SCOPE_METADATA_UNAVAILABLE');
   const scopeList=await c.send('Runtime.getProperties',{objectId:listId,ownProperties:true,generatePreview:false});
   const scopes=(scopeList.result??[]).filter(p=>/^\d+$/.test(p.name)).map(p=>p.value).filter(Boolean);
   const scope=scopes.find(s=>s.description===`Closure (${proof.scopeName})`||s.description===`Block (${proof.scopeName})`);
   if(!scope?.objectId)return {available:false,reason:'WORLD_LOCATION_SCOPE_UNAVAILABLE',diagnosticScopeNames:scopes.map(s=>s.description).slice(0,16)};
   // V8 synthetic scopes cannot be used as ordinary JS receivers. Inspect the
   // scope's descriptor metadata, then select ONLY the five source-reviewed
   // remote references; other descriptors are never traversed or returned.
   const scopeProperties=await c.send('Runtime.getProperties',{objectId:scope.objectId,ownProperties:true,generatePreview:false});
   const binding=name=>(scopeProperties.result??[]).find(p=>p.name===proof.bindings?.[name])?.value;
   const location=await readCurrentOwnLocation(c,binding,manifest);
   if(!location?.available)return {available:false,reason:location?.reason??'LOCATION_UNAVAILABLE',bindingTypes:location?.bindingTypes};
   location.readerProfile={reviewedVersion:manifest.reviewedVersion,playerSha256:manifest.player.sha256,host:proof.host};
   let navigation={available:false,reason:location.mode==='interior'?'INTERIOR_LANDMARKS_UNAVAILABLE':'INTERIOR_LANDMARKS_REQUIRE_INTERIOR',routing:{available:false,reason:'NO_VALIDATED_WALKABILITY_GRAPH',canGiveTurnByTurn:false}};
   if(location.mode==='interior')try{const dep=manifest.navigationDependencies?.find(d=>d.role==='scene-interior'),script=scripts.find(s=>s.url===dep?.url);if(script&&hash(sources[script.scriptId]??'')===dep.sha256){const modes=binding('$');navigation=value(await c.send('Runtime.callFunctionOn',{objectId:modes.objectId,arguments:[{value:location.position},{value:location.orientation.yawRadians}],functionDeclaration:copyInteriorLandmarks.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'INTERIOR_LANDMARKS')?.value??navigation;}}catch{}
   let loadedQuestTargets=null;
   if(location.mode==='dungeon'&&manifest.dungeonQuestTargetsReviewed&&['scene','context'].includes(navigationCommand))try{
    const text=value(await c.send('Runtime.evaluate',{...base,expression:`(${readVisibleText.toString()})()`,returnByValue:true,throwOnSideEffect:false,timeout:500}),'TARGET_OBJECTIVE_TEXT')?.value;
    const names=(text?.lines??[]).map(r=>r.text?.match(/^(?:Slay the mad wizard|Kill|Defeat) (.+?)(?: in | at |…|$)/i)?.[1]).filter(Boolean).slice(0,8),modes=binding('$');
    if(modes?.objectId)loadedQuestTargets=value(await c.send('Runtime.callFunctionOn',{objectId:modes.objectId,arguments:[{value:names},{value:location.position},{value:location.orientation.yawRadians}],functionDeclaration:copyKnownLoadedQuestTargets.toString(),returnByValue:true,throwOnSideEffect:false,silent:true,timeout:500}),'KNOWN_LOADED_QUEST_TARGETS')?.value;
    const manager=binding('Dh');if(modes?.objectId&&manager?.objectId){const association=value(await c.send('Runtime.callFunctionOn',{objectId:modes.objectId,arguments:[{value:names},{value:location.position},{value:location.orientation.yawRadians},{objectId:manager.objectId}],functionDeclaration:copyCurrentQuestAssociation.toString(),returnByValue:true,throwOnSideEffect:false,silent:true,timeout:500}),'CURRENT_QUEST_ASSOCIATION')?.value;loadedQuestTargets??={};loadedQuestTargets.association=association;try{const fn=value(await c.send('Runtime.callFunctionOn',{objectId:modes.objectId,functionDeclaration:'function(){return this.dungeonCtx.questSpawnSpots;}',throwOnSideEffect:true,silent:true}),'QUEST_SPOT_ACCESSOR');const layout=await closureBinding(c,fn?.objectId,'x');if(layout?.objectId)loadedQuestTargets.currentBlocks=value(await c.send('Runtime.callFunctionOn',{objectId:layout.objectId,arguments:[{value:association?.targets?.flatMap(t=>t.dungeonMarkers??[]).map(p=>p.selectedMarker)??[]}],functionDeclaration:'function(targets){const own=(o,k)=>Object.getOwnPropertyDescriptor(o??{},k)?.value;const b=own(this,"blocks"),out=[];for(const r of b??[])for(const m of own(own(r,"layout"),"markers")??[])for(const t of targets){const p=t.flatPosition;if(p&&Math.abs(m.x-p.x)<.001&&Math.abs(m.y-p.y)<.001&&Math.abs(m.z-p.z)<.001)out.push({blockName:r.name,originX:r.originX,originZ:r.originZ,blockDataPosition:own(own(r,"dfBlock"),"position"),markerFields:Object.getOwnPropertyNames(m),markerPosition:own(m,"position"),markerId:own(m,"markerID"),record:m.record,position:{x:m.x+r.originX,y:m.y,z:m.z+r.originZ,frame:"current dungeon local"}});}return {matches:out,blocks:(b??[]).map(r=>({name:r.name,originX:r.originX,originZ:r.originZ,base:r.dfBlock?.position,markerCount:r.layout?.markers?.length,markers:(r.layout?.markers??[]).filter(m=>m.record===11).map(m=>({x:m.x,y:m.y,z:m.z,record:m.record}))}))};}',returnByValue:true,throwOnSideEffect:false,silent:true}),'CURRENT_BLOCK_ORIGINS')?.value;}catch(e){loadedQuestTargets.blockOriginsReason=e.code;}try{loadedQuestTargets.currentSpawnSpots=value(await c.send('Runtime.callFunctionOn',{objectId:modes.objectId,functionDeclaration:'function(){return this.dungeonCtx.questSpawnSpots();}',returnByValue:true,throwOnSideEffect:true,silent:true,timeout:500}),'GUARDED_CURRENT_QUEST_SPOTS')?.value;}catch(e){loadedQuestTargets.spawnSpotsReason=e.code;}}
   }catch(e){loadedQuestTargets={available:false,reason:e.code??'CURRENT_DUNGEON_TARGETS_UNAVAILABLE'};}
   let dungeonActions=null;
   if(location.mode==='dungeon'&&manifest.dungeonActionsReviewed&&['scene','context'].includes(navigationCommand))try{const modes=binding('$');if(modes?.objectId)dungeonActions=value(await c.send('Runtime.callFunctionOn',{objectId:modes.objectId,arguments:[{value:location.position},{value:location.orientation.yawRadians}],functionDeclaration:copyNearbyDungeonActions.toString(),returnByValue:true,throwOnSideEffect:false,silent:true,timeout:500}),'LOADED_DUNGEON_ACTIONS')?.value;}catch(e){dungeonActions={available:false,reason:e.code??'DUNGEON_ACTIONS_UNAVAILABLE'};}
   let scene;
   if(['scene','context'].includes(navigationCommand)){
    try{
     for(const role of ['scene-collider','scene-renderer','scene-peers','scene-concealment','scene-ui','town-ui']){const dep=manifest.navigationDependencies?.find(d=>d.role===role),script=scripts.find(s=>s.url===dep?.url);if(!script||hash(sources[script.scriptId]??'')!==dep.sha256)fail('SCENE_SOURCE_NOT_REVIEWED');}
     if(location.mode==='interior'){const dep=manifest.navigationDependencies?.find(d=>d.role==='scene-interior'),script=scripts.find(s=>s.url===dep?.url);if(!script||hash(sources[script.scriptId]??'')!==dep.sha256)fail('INTERIOR_SOURCE_NOT_REVIEWED');}
     {
      const renderer=binding('t');if(!renderer?.objectId)fail('SCENE_RENDERER_UNAVAILABLE');
      let drawnFoes=null,travelPeople=null,guards=null;const pool=binding('J');if(location.mode==='exterior'&&pool?.objectId){const fn=value(await c.send('Runtime.callFunctionOn',{objectId:pool.objectId,functionDeclaration:'function(){return Object.getOwnPropertyDescriptor(this,"batches")?.value;}',throwOnSideEffect:true,silent:true}),'FOE_RENDER_ACCESSOR');if(fn?.objectId)drawnFoes=await closureBinding(c,fn.objectId,'z');}
      try{let guardPool=binding('GD');if(location.mode!=='exterior'){const modesRef=binding('$'),props=await c.send('Runtime.getProperties',{objectId:modesRef.objectId,ownProperties:true,generatePreview:false}),getter=props.result?.find(p=>p.name==='mode')?.get;
       if(location.mode==='interior'){const pool=await closureBinding(c,getter?.objectId,manifest.insideBindings?.foes);guardPool=await closureBinding(c,getter?.objectId,manifest.insideBindings?.guards);if(pool?.objectId){const methods=await c.send('Runtime.getProperties',{objectId:pool.objectId,ownProperties:true,generatePreview:false}),batches=methods.result?.find(p=>p.name==='batches')?.value;drawnFoes=await closureBinding(c,batches?.objectId,'z');}}
       else if(location.mode==='dungeon'){const ctx=await closureBinding(c,getter?.objectId,'J');if(ctx?.objectId){const props=await c.send('Runtime.getProperties',{objectId:ctx.objectId,ownProperties:true,generatePreview:false});drawnFoes=props.result?.find(p=>p.name==='foes')?.value;}guardPool=null;}}
       if(guardPool?.objectId){const props=await c.send('Runtime.getProperties',{objectId:guardPool.objectId,ownProperties:true,generatePreview:false});guards=props.result?.find(p=>p.name==='guards')?.value;}
      }catch{}
      const travelers=binding('Kp');if(location.mode==='exterior'&&travelers?.objectId)try{const f=value(await c.send('Runtime.callFunctionOn',{objectId:travelers.objectId,functionDeclaration:'function(){return Object.getOwnPropertyDescriptor(this,"talkSeats")?.value;}',throwOnSideEffect:true,silent:true}),'TRAVELERS_ACCESSOR'),options=await closureBinding(c,f?.objectId,'e');if(options?.objectId){const sprites=value(await c.send('Runtime.callFunctionOn',{objectId:options.objectId,functionDeclaration:'function(){return Object.getOwnPropertyDescriptor(this,"sprites")?.value;}',throwOnSideEffect:true,silent:true}),'CURRENT_TRAVEL_SPRITES');if(sprites?.objectId){const persons=value(await c.send('Runtime.callFunctionOn',{objectId:sprites.objectId,functionDeclaration:'function(){return Object.getOwnPropertyDescriptor(this,"persons")?.value;}',throwOnSideEffect:true,silent:true}),'CURRENT_TRAVEL_PERSONS');travelPeople=await closureBinding(c,persons?.objectId,'m');}}}catch{}
      let livingPeople=null;const living=binding('dp');if(location.mode==='interior'&&living?.objectId)try{livingPeople=value(await c.send('Runtime.callFunctionOn',{objectId:living.objectId,functionDeclaration:'function(){return this.seats();}',throwOnSideEffect:true,silent:true}),'CURRENT_LIVING_NPCS');}catch{}
      const modes=binding('$'),exteriorCollider=binding('gg');let activeCollider=exteriorCollider;
      if(location.mode!=='exterior'&&modes?.objectId)activeCollider=value(await c.send('Runtime.callFunctionOn',{objectId:modes.objectId,arguments:[{value:location.mode}],functionDeclaration:'function(mode){return (mode==="interior"?this.interiorCtx:this.dungeonCtx)?.collider;}',throwOnSideEffect:true,silent:true}),'CURRENT_COLLIDER');
      const poses=await readDynamicPoses(c,activeCollider?.objectId);
      let peerPositions=null;const networkRef=binding('X'),peerPose=binding('peerPose');
      if(networkRef?.objectId&&peerPose?.objectId&&manifest.peerPoseFunctionSha256)try{
       const body=value(await c.send('Runtime.callFunctionOn',{objectId:peerPose.objectId,functionDeclaration:'function(){return Function.prototype.toString.call(this);}',returnByValue:true,throwOnSideEffect:false,silent:true}),'PEER_CONVERTER_SOURCE')?.value;
       let frame=hash(body??'')===manifest.peerPoseFunctionSha256?{kind:'identity'}:manifest.peerPoseCopies?.find(row=>row.functionSha256===hash(body??''));if(!frame)fail('PEER_CONVERTER_SOURCE_CHANGED');
       if(frame.conditionalY){const condition=await closureBinding(c,peerPose.objectId,'c');if(typeof condition?.value!=='boolean')fail('PEER_FRAME_CONDITION_UNAVAILABLE');frame={...frame,shiftY:condition.value};}
       const pools=['gP','lP','dP'].map(n=>{const r=binding(n);return r?.objectId?{objectId:r.objectId}:{value:null};});
       const world=binding('H');pools.push(world?.objectId?{objectId:world.objectId}:{value:null},{value:frame});
       peerPositions=value(await c.send('Runtime.callFunctionOn',{objectId:networkRef.objectId,arguments:pools,functionDeclaration:copyIdentityRenderedPeerPositions.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'RENDERED_PEER_COORDINATES')?.value??null;
      }catch{}
      if(peerPositions===null&&networkRef?.objectId&&peerPose?.objectId)try{peerPositions=value(await c.send('Runtime.callFunctionOn',{objectId:networkRef.objectId,arguments:[{objectId:peerPose.objectId}],functionDeclaration:'function(toLocal){const peers=Object.getOwnPropertyDescriptor(this,"peers")?.value;if(!(peers instanceof Map))return null;return Array.from(peers.values()).slice(0,128).map(p=>({id:Object.getOwnPropertyDescriptor(p,"id")?.value,position:p.shown?toLocal(p.shown):null}));}',returnByValue:true,throwOnSideEffect:true,silent:true}),'CURRENT_PEER_COORDINATES')?.value??null;}catch{}

      const args=['Pm','kx','gg','X','RO','H','Bm','Im','$','gP','lP','dP'].map(n=>{const r=binding(n);return r?.objectId?{objectId:r.objectId}:{value:r?.value??null};});args.push({value:location.mode},drawnFoes?.objectId?{objectId:drawnFoes.objectId}:{value:null});
      const gameUI=binding('G');args.push({value:poses},travelPeople?.objectId?{objectId:travelPeople.objectId}:{value:null},gameUI?.objectId?{objectId:gameUI.objectId}:{value:null},guards?.objectId?{objectId:guards.objectId}:{value:null},livingPeople?.objectId?{objectId:livingPeople.objectId}:{value:null},{value:peerPositions});
      const declaration=`function(people,base,collider,network,hidden,state,built,heightScale,modes,bodyPool,riderPool,walkerPool,mode,drawnFoes,poses,travelPeople,ui,guards,livingPeople,peerPositions){const active=mode==="interior"?modes.interiorCtx:mode==="dungeon"?modes.dungeonCtx:null;const npcPeople=active?(active.people??[]).concat(livingPeople??[]):(base??[]).concat(travelPeople??[]);const loadedNpcs=(${copyLoadedNpcs.toString()})(npcPeople,mode);if(ui?.overlayActive||modes?.hudCovered)return {available:false,reason:"SCENE_COVERED_BY_GAME_UI",loadedNpcs,diagnostics:{peerCoordinatesAvailable:Array.isArray(peerPositions),mappedRenderedPeers:peerPositions?.length??null}};const scene=(${readVisibleScene.toString()}).call(this,{people:npcPeople,collider:active?active.collider:collider,network,hiddenPeers:hidden,bodies:bodyPool?Object.getOwnPropertyDescriptor(bodyPool,"_bodies")?.value:null,riders:riderPool?.riders,walkers:walkerPool?.walkers,drawnFoes,guards,poses,peerPositions,state,built,heightScale,mode});return {...scene,loadedNpcs};}`;
      scene=value(await c.send('Runtime.callFunctionOn',{objectId:renderer.objectId,arguments:args,functionDeclaration:declaration,returnByValue:true,throwOnSideEffect:false,silent:true,generatePreview:false}),'VISIBLE_SCENE_READ')?.value;
      if(scene?.entities){scene.entities.sort((a,b)=>a.distanceMetres-b.distanceMetres);scene.aimedAt=scene.entities.find(e=>e.underCrosshair)??null;scene.truncated=scene.entities.length>64;scene.entities=scene.entities.slice(0,64);}
     }
    }catch(e){scene={available:false,reason:e.code??'VISIBLE_SCENE_UNAVAILABLE'};}
   }
   if(loadedQuestTargets){scene??={available:false,reason:'VISIBLE_SCENE_UNAVAILABLE'};scene.loadedQuestTargets=loadedQuestTargets;}
   if(dungeonActions){scene??={available:false,reason:'VISIBLE_SCENE_UNAVAILABLE'};scene.dungeonActions=dungeonActions;}
   let gathering={available:false,reason:location.mode==='exterior'?'LOADED_GATHERING_UNAVAILABLE':'GATHERING_REQUIRES_EXTERIOR'};
   if(['scene','context'].includes(navigationCommand)&&location.mode==='exterior')try{const dep=manifest.navigationDependencies?.find(d=>d.role==='gathering-host'),actual=scripts.find(s=>s.url===dep?.url);if(!actual||hash(sources[actual.scriptId]??'')!==dep.sha256)fail('GATHERING_SOURCE_NOT_REVIEWED');const host=binding('Vo'),state=binding('H');if(host?.objectId&&state?.objectId){const props=await c.send('Runtime.getProperties',{objectId:host.objectId,ownProperties:true,generatePreview:false}),accessor=props.result?.find(p=>p.name==='nodesOf')?.value,nodes=await closureBinding(c,accessor?.objectId,'s');if(nodes?.objectId)gathering=value(await c.send('Runtime.callFunctionOn',{objectId:nodes.objectId,arguments:[{objectId:state.objectId},{value:[location.position.x,location.position.y,location.position.z]},{value:location.orientation.yawRadians}],functionDeclaration:copyLoadedGathering.toString(),returnByValue:true,throwOnSideEffect:false,silent:true,timeout:1000}),'LOADED_GATHERING_READ')?.value??gathering;try{gathering.aimed=!!host?.objectId?value(await c.send('Runtime.callFunctionOn',{objectId:host.objectId,arguments:[{value:[location.position.x,location.position.y,location.position.z]}],functionDeclaration:copyHighlightedTarget.toString(),returnByValue:true,throwOnSideEffect:true,silent:true}),'CURRENT_GATHERING_AIM')?.value?.target??null:null;}catch(e){gathering.aimed=null;gathering.aimReason=e.code??'GATHERING_AIM_UNAVAILABLE';}}}catch(e){gathering={available:false,reason:e.code??'LOADED_GATHERING_UNAVAILABLE'};}
   if(navigationCommand==='scene'){let visibleHud;try{visibleHud=await readVisibleHud(c.send,root.nodeId);}catch{visibleHud={available:false,reason:'VISIBLE_HUD_UNAVAILABLE'};}let visibleText;try{visibleText=value(await c.send('Runtime.evaluate',{...base,expression:`(${readVisibleText.toString()})()`,returnByValue:true,throwOnSideEffect:false,timeout:500}),'VISIBLE_TEXT_READ')?.value;}catch{visibleText={available:false,reason:'VISIBLE_TEXT_UNAVAILABLE'};}return {available:true,location,navigation,scene,gathering,visibleHud,visibleText};}
   const module=value(await c.send('Runtime.evaluate',{...base,expression:`import(${JSON.stringify(proof.module)})`,objectGroup:'dfo-observer-proof',returnByValue:false,awaitPromise:true,throwOnSideEffect:false,timeout:500}),'MAP_MODULE')?.objectId;
   let recordedDestinations=[];
   if(module)try{const dep=manifest.navigationDependencies?.find(d=>d.role==='quest-messages'),actual=scripts.find(s=>s.url===dep?.url),manager=binding('Dh');if(manager?.objectId&&actual&&hash(sources[actual.scriptId]??'')===dep.sha256){const exp=await c.send('Runtime.getProperties',{objectId:module,ownProperties:true,generatePreview:false}),player=exp.result?.find(p=>p.name===proof.export)?.value;if(player?.objectId)recordedDestinations=value(await c.send('Runtime.callFunctionOn',{objectId:player.objectId,arguments:[{objectId:manager.objectId}],functionDeclaration:`function(manager){const journal=(${copyKnownJournal.toString()}).call(this,manager);return (journal.active??[]).flatMap(q=>q.disclosedLocations.map(d=>({...d,questId:q.id,questName:q.name,questComplete:q.complete}))).slice(0,128);}`,returnByValue:true,throwOnSideEffect:false,silent:true}),'RECORDED_DESTINATION_KEYS')?.value??[];}}catch{}
   recordedDestinations=recordedDestinations.filter(d=>d.locationName===location.place.name&&(!d.regionName||d.regionName===location.place.regionName));
   let shops={available:false,reason:'TOWN_DIRECTORY_UNAVAILABLE'},highlighted={available:false,reason:'HIGHLIGHTED_TARGET_UNAVAILABLE'};
   if(['shops','context','town'].includes(navigationCommand)){try{
    const dep=manifest.navigationDependencies?.find(d=>d.role==='town-ui');
    const actual=scripts.find(s=>s.url===dep?.url);
    if(!actual||hash(sources[actual.scriptId]??'')!==dep.sha256)fail('TOWN_UI_SOURCE_NOT_REVIEWED');
    const ui=binding('G'),built=binding('Bm'),prof=binding('Vo');
    let townPosition=null;
    if(built?.objectId){
     const origin=value(await c.send('Runtime.callFunctionOn',{objectId:built.objectId,arguments:[{value:location.mapPixel.x+','+location.mapPixel.y}],functionDeclaration:'function(key){const tile=this.get(key);const d=tile&&Object.getOwnPropertyDescriptor(tile,"locOrigin");const v=d&&"value"in d?d.value:null;return Array.isArray(v)?v.slice(0,3):null;}',returnByValue:true,throwOnSideEffect:true,silent:true}),'TOWN_ORIGIN_READ')?.value;
     const f=location.floatingOrigin,p=location.position,m=location.mapPixel;
     if(Array.isArray(origin)&&origin.length===3&&origin.every(Number.isFinite)&&Array.isArray(f.compensation))townPosition=[p.x-(m.x-f.mapPixelX)*819.2-f.compensation[0]-origin[0],p.y-f.compensation[1]-origin[1],p.z+(m.y-f.mapPixelY)*819.2-f.compensation[2]-origin[2]];
    }
    let learned=[];if(module&&(location.mode==='exterior'||navigationCommand==='town'))try{const exp=await c.send('Runtime.getProperties',{objectId:module,ownProperties:true,generatePreview:false}),fn=exp.result?.find(p=>p.name===(manifest.player.learnedNamesExport))?.value,records=await closureBinding(c,fn?.objectId,manifest.player.learnedNamesBinding);if(records?.objectId)learned=value(await c.send('Runtime.callFunctionOn',{objectId:records.objectId,arguments:[{value:location.place.regionIndex+':'+location.place.name}],functionDeclaration:'function(key){const values=this.get(key);if(!(values instanceof Map))return [];return Array.from(values.values()).slice(0,256).map(b=>({buildingKey:b.buildingKey,displayName:b.displayName,customUserDisplayName:b.customUserDisplayName}));}',returnByValue:true,throwOnSideEffect:false,silent:true}),'LEARNED_TOWN_NAMES')?.value??[];}catch{}
    if(location.mode!=='exterior'&&navigationCommand==='town')townPosition=[0,0,0];if(location.mode!=='exterior'&&navigationCommand!=='town')shops={available:false,reason:'TOWN_BEARINGS_REQUIRE_EXTERIOR'};
    else if(ui?.objectId&&townPosition&&module)shops=value(await c.send('Runtime.callFunctionOn',{objectId:ui.objectId,arguments:[{value:townPosition},{value:location.orientation.yawRadians},{value:learned},{value:recordedDestinations}],functionDeclaration:`function(position,yaw,learned,recorded){return (${copyTownShops.toString()})(this.buildingDirectory,position,learned,yaw,recorded);}`,returnByValue:true,throwOnSideEffect:false,silent:true,generatePreview:false,timeout:1000}),'TOWN_SHOPS_READ')?.value??shops;
    const doorDep=manifest.navigationDependencies?.find(d=>d.role==='town-door-types'),doorScript=scripts.find(s=>s.url===doorDep?.url),doorsReviewed=doorScript&&hash(sources[doorScript.scriptId]??'')===doorDep.sha256;
    const entrances=binding('Rv');if(location.mode==='exterior'&&doorsReviewed&&shops.available&&ui?.objectId&&entrances?.objectId){const f=location.floatingOrigin,m=location.mapPixel,p=location.position,translation=[(m.x-f.mapPixelX)*819.2+f.compensation[0],f.compensation[1],-(m.y-f.mapPixelY)*819.2+f.compensation[2]];try{shops.entrances=value(await c.send('Runtime.callFunctionOn',{objectId:ui.objectId,arguments:[{objectId:entrances.objectId},{value:m.x+','+m.y},{value:translation},{value:[p.x,p.y,p.z]},{value:location.orientation.yawRadians},{value:recordedDestinations.map(d=>d.buildingKey).filter(Number.isInteger)}],functionDeclaration:`function(entries,pixel,translation,player,yaw,recordedKeys){return (${copyPublicTownEntrances.toString()})(this.buildingDirectory,entries,pixel,translation,player,yaw,recordedKeys);}`,returnByValue:true,throwOnSideEffect:false,silent:true}),'PUBLIC_TOWN_ENTRANCES')?.value;}catch(e){shops.entrances={available:false,reason:e.code??'ENTRANCES_UNAVAILABLE'};}}
    if(shops.available){shops.shops.sort((a,b)=>a.distanceMetres-b.distanceMetres);shops.questDestinations=shops.shops.filter(b=>b.questNames?.length).map(b=>({...b,entrances:(shops.entrances?.doors??[]).filter(d=>d.mapKey===b.mapKey).sort((a,b)=>a.distanceMetres-b.distanceMetres),routing:{available:false,reason:'NO_VALIDATED_WALKABILITY_GRAPH',straightLineOnly:true}}));}
    if(prof?.objectId&&navigationCommand==='context')try{highlighted=value(await c.send('Runtime.callFunctionOn',{objectId:prof.objectId,arguments:[{value:[location.position.x,location.position.y,location.position.z]}],functionDeclaration:copyHighlightedTarget.toString(),returnByValue:true,throwOnSideEffect:true,silent:true,generatePreview:false}),'HIGHLIGHTED_TARGET_READ')?.value??highlighted;}catch(e){highlighted={available:false,reason:e.code??'HIGHLIGHTED_READ_FAILED'};}
   }catch(e){shops={available:false,reason:e.code??'TOWN_SHOPS_UNAVAILABLE'};}
   }
   if(['shops','town'].includes(navigationCommand)){let townMap=null;const key=location.mapPixel.x+','+location.mapPixel.y;if(navigationCommand==='town'&&location.mode!=='dungeon'&&!townGeometryKeys.includes(key)){const tiles=binding('Bm');if(tiles?.objectId)try{townMap=value(await c.send('Runtime.callFunctionOn',{objectId:tiles.objectId,arguments:[{value:key}],functionDeclaration:copyPublicTownRaster.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'PUBLIC_TOWN_MAP')?.value;}catch{}}if(location.mode!=='exterior'&&shops.available){shops.playerTownPosition=null;for(const b of shops.shops){b.distanceMetres=null;b.bearingDegrees=null;b.relativeTurnDegrees=null;}}let publicYards=[];const tiles=binding('Bm');if(navigationCommand==='town'&&tiles?.objectId)try{publicYards=value(await c.send('Runtime.callFunctionOn',{objectId:tiles.objectId,arguments:[{value:key}],functionDeclaration:copyPublicTownYards.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'PUBLIC_MERCHANT_YARD_MAP_PINS')?.value??[];}catch{}return {available:true,location,shops,townMap,publicYards};}
   let map={available:false,reason:'DISCOVERED_MAP_ACCESSOR_UNAVAILABLE'};
   if(location.mode==='dungeon'&&module)try{map=value(await c.send('Runtime.callFunctionOn',{objectId:module,functionDeclaration:`function(){return (${copyDiscoveredMap.toString()})(this[${JSON.stringify(manifest.player.mapRecordExport)}](this[${JSON.stringify(manifest.player.mapCurrentExport)}]()));}`,returnByValue:true,throwOnSideEffect:false,silent:true,generatePreview:false}),'DISCOVERED_MAP_READ')?.value??map;}catch(e){map={available:false,reason:e.code??'DISCOVERED_MAP_UNAVAILABLE'};}
   if(map.available&&module)try{const exp=await c.send('Runtime.getProperties',{objectId:module,ownProperties:true,generatePreview:false}),accessor=exp.result?.find(p=>p.name===(manifest.player.mapCurrentExport))?.value,currentModel=await closureBinding(c,accessor?.objectId,manifest.player.mapModelBinding);if(currentModel?.objectId)map.geometry=value(await c.send('Runtime.callFunctionOn',{objectId:currentModel.objectId,functionDeclaration:copyRevealedGeometry.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'REVEALED_MAP_GEOMETRY')?.value;}catch(e){map.geometry={available:false,reason:e.code??'REVEALED_GEOMETRY_UNAVAILABLE'};}
   if(navigationCommand==='context'){let visibleHud,visibleText;try{visibleHud=await readVisibleHud(c.send,root.nodeId);}catch(e){visibleHud={available:false,reason:e.code??'VISIBLE_HUD_UNAVAILABLE'};}try{visibleText=value(await c.send('Runtime.evaluate',{...base,expression:`(${readVisibleText.toString()})()`,returnByValue:true,throwOnSideEffect:false,timeout:500}),'VISIBLE_TEXT_READ')?.value;}catch(e){visibleText={available:false,reason:e.code??'VISIBLE_TEXT_UNAVAILABLE'};}return {available:true,location,navigation,shops,highlighted,scene,gathering,visibleHud,visibleText,discoveredMap:map};}
   return {available:true,location,discoveredMap:map,navigation};
  }
  // The asynchronous import is allowed ONLY after executed-host + source/realm
  // proof. It uses the exact cached URL, no cache-busting query or fallback URL.
  const namespace=value(await c.send('Runtime.evaluate',{...base,expression:`import(${JSON.stringify(proof.module)})`,objectGroup:'dfo-observer-proof',returnByValue:false,awaitPromise:true,throwOnSideEffect:false,timeout:500}),'PLAYER_MODULE')?.objectId;
  if(!namespace)fail('PLAYER_MODULE_UNAVAILABLE');
  const exports=await c.send('Runtime.getProperties',{objectId:namespace,ownProperties:true,generatePreview:false});
  const exported=name=>exports.result?.find(p=>p.name===name)?.value;
  const playerId=exported(proof.export)?.objectId;if(!playerId)fail('PLAYER_REFERENCE_UNAVAILABLE');

  const result=value(await c.send('Runtime.callFunctionOn',{objectId:playerId,functionDeclaration:`function(){const start=performance.now();const result=(${readPlayer.toString()})(this,${dashboardLive});if(${dashboardLive})result.dashboardCopyMs=performance.now()-start;return result;}`,returnByValue:true,throwOnSideEffect:false,silent:true}),'PLAYER_READ');
  if(typeof result?.value?.available!=='boolean')fail('INVALID_PLAYER_RESPONSE');
  let dashboardWorldBindings=null,dashboardPoseRefs=null;
  if(result.value.available){
   try{const properties=await c.send('Runtime.getProperties',{objectId:playerId,ownProperties:true,generatePreview:false}),getter=properties.result?.find(p=>p.name==='maxHealth')?.get;
    if(getter?.objectId){const meta=await c.send('Runtime.getProperties',{objectId:getter.objectId,ownProperties:true,generatePreview:false}),loc=meta.internalProperties?.find(p=>p.name==='[[FunctionLocation]]')?.value?.value,playerScript=scripts.find(s=>s.url===proof.module),source=sources[playerScript.scriptId];
     if(loc?.scriptId===playerScript.scriptId){const lines=source.split('\n'),offset=lines.slice(0,loc.lineNumber).reduce((n,l)=>n+l.length+1,0)+loc.columnNumber,start=source.indexOf('function '+(manifest.player.healthFunction)+'(e){'),end=source.indexOf('function '+(manifest.player.magickaFunction)+'(e){',start);if(offset>=start&&offset<end){const baseHealth=await closureBinding(c,getter.objectId,'n');if(typeof baseHealth?.value==='number'){const h=result.value.vitals.health;h.rawBase=baseHealth.value;h.max=(h.limiter>=1&&h.limiter<baseHealth.value?h.limiter:baseHealth.value)+h.renownBonus+h.spireBonus;h.calculation='Copied reviewed maxHealth getter using captured raw base and own bonuses; getter not invoked';}}}
    }
   }catch{}
   for(const [field,vital]of [['maxHealth','health'],['maxMagicka','magicka']])try{const maximum=value(await c.send('Runtime.callFunctionOn',{objectId:playerId,functionDeclaration:`function(){const value=this.${field};return typeof value==="number"&&Number.isFinite(value)?value:null;}`,returnByValue:true,throwOnSideEffect:true,silent:true}),'OWN_VITAL_MAX')?.value;if(maximum!==null)result.value.vitals[vital].max=maximum;}catch{}
   if(dashboardCore||dashboardLive){
    let dashboardPose=null;
    try{
     const dep=manifest.navigationDependencies?.find(d=>d.role==='world-modes'),script=scripts.find(s=>s.url===dep?.url);
     if(!script||hash(sources[script.scriptId]??'')!==dep.sha256)throw Error('Unreviewed location');
     const bind=dashboardWorldBindings=await worldBindings(c,listeners,scripts,proof,sources);
     {
      const location=await readCurrentOwnLocation(c,bind,manifest,refs=>{dashboardPoseRefs=refs;});
      const tiles=bind('Bm');let town=null;
      if(location?.available&&location.mode==='exterior'&&tiles?.objectId)town=value(await c.send('Runtime.callFunctionOn',{objectId:tiles.objectId,arguments:[{value:location}],functionDeclaration:copyOwnTownPose.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'DASHBOARD_TOWN_POSE')?.value;
      dashboardPose={capturedAt:new Date().toISOString(),location:location?.available?{available:true,mode:location.mode,mapPixel:location.mapPixel,place:location.place,orientation:location.orientation,position:location.position}:null,town};
     }
    }catch{}
    result.value.dashboardPose=dashboardPose;
    if(dashboardCore)return {available:true,dashboardPose,identity:result.value.identity,vitals:result.value.vitals,resources:{goldPieces:result.value.resources.goldPieces},readerProfile:{reviewedVersion:manifest.reviewedVersion,playerSha256:manifest.player.sha256}};
   }
   if(!dashboardLive)try{const slots=await closureBinding(c,exported(manifest.player.hotbarAnchorExport)?.objectId,manifest.player.hotbarBinding);if(slots?.objectId)result.value.spells.hotbar=value(await c.send('Runtime.callFunctionOn',{objectId:slots.objectId,functionDeclaration:'function(){return this.slice(0,16).map((s,i)=>({slot:i+1,binding:s?{type:s.type,name:s.name,spellIndex:s.type==="spell"?s.index:null,kind:s.type==="item"?s.kind:null}:null}));}',returnByValue:true,throwOnSideEffect:false,silent:true}),'OWN_HOTBAR')?.value;}catch(e){result.value.spells.hotbar={available:false,reason:e.code??'HOTBAR_UNAVAILABLE'};}
   const catalogDep=manifest.navigationDependencies?.find(d=>d.role==='item-templates'),catalogScript=scripts.find(s=>s.url===catalogDep?.url);
   const ownedForTemplates=[...result.value.inventory.items,...Object.values(result.value.inventory.storage??{}).flatMap(s=>s.items??[])];
   const templateHit=session?.templates&&ownedForTemplates.every(i=>session.templates.has(i.templateIndex));
   if(templateHit){enrichInventory(ownedForTemplates,[...session.templates.values()]);result.value.inventory.displayDetails={available:true,source:'Reviewed static template cache'};}
   if(!templateHit&&catalogScript&&hash(sources[catalogScript.scriptId]??'')===catalogDep.sha256&&sources[scripts.find(s=>s.url===proof.module).scriptId].includes('from"./wagonKinds-BKOEBsGj.js"'))try{
    const catalog=value(await c.send('Runtime.evaluate',{...base,expression:`import(${JSON.stringify(catalogDep.url)})`,returnByValue:false,awaitPromise:true,throwOnSideEffect:false,objectGroup:'dfo-observer-proof'}),'CACHED_ITEM_CATALOG')?.objectId;
    const catalogExports=await c.send('Runtime.getProperties',{objectId:catalog,ownProperties:true,generatePreview:false}),lookup=catalogExports.result?.find(p=>p.name==='U')?.value;
    const baseTemplates=await closureBinding(c,lookup?.objectId,'K'),custom=await closureBinding(c,lookup?.objectId,'q'),extra=await closureBinding(c,lookup?.objectId,'kn');
    if(baseTemplates?.objectId){const templates=value(await c.send('Runtime.callFunctionOn',{objectId:baseTemplates.objectId,arguments:[custom?.objectId?{objectId:custom.objectId}:{value:null},extra?.objectId?{objectId:extra.objectId}:{value:null},{value:[...result.value.inventory.items,...Object.values(result.value.inventory.storage??{}).flatMap(s=>s.items??[])].map(i=>i.templateIndex)}],functionDeclaration:copyOwnedTemplates.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'OWN_ITEM_TEMPLATES')?.value;if(session){session.templates??=new Map;for(const t of templates??[])session.templates.set(t.index,t);}enrichInventory(ownedForTemplates,templates??[]);result.value.inventory.displayDetails={available:true,source:'Static template data and copied formulas'};}
   }catch(e){result.value.inventory.displayDetails={available:false,reason:e.code??'TEMPLATE_DATA_UNAVAILABLE'};}
   const binding=dashboardWorldBindings??await worldBindings(c,listeners,scripts,proof,sources),manager=binding('Dh');
   try{if(manifest.player.publicQuestTrackerExport&&sources[scripts.find(s=>s.url===proof.module).scriptId].includes(manifest.player.publicQuestTrackerLocal+' as '+manifest.player.publicQuestTrackerExport)){const tracker=exported(manifest.player.publicQuestTrackerExport);if(tracker?.objectId){result.value.questTracker=value(await c.send('Runtime.callFunctionOn',{objectId:tracker.objectId,functionDeclaration:copyPublicQuestTracker.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'PUBLIC_QUEST_TRACKER')?.value;const maps=binding('publicQuestPlaces'),ids=(result.value.questTracker?.views??[]).map(v=>v.destination).filter(Boolean);if(maps?.objectId&&ids.length){const points=value(await c.send('Runtime.callFunctionOn',{objectId:maps.objectId,arguments:[{value:ids}],functionDeclaration:copyPublicQuestMapPoints.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'PUBLIC_QUEST_MAP_POINTS')?.value??[];for(const v of result.value.questTracker.views)if(v.destination)v.destination.point=points.find(p=>p.locationName===v.destination.locationName&&(v.destination.mapId==null||p.mapId===v.destination.mapId))??null;}}}}catch(e){if(!result.value.questTracker?.available)result.value.questTracker={available:false,reason:e.code??'PUBLIC_TRACKER_UNAVAILABLE'};else result.value.questTracker.mapReason=e.code??'DESTINATION_POINTS_UNAVAILABLE';}

   if(!dashboardLive){
   const books=result.value.inventory.items.filter(i=>i.group==='Books'&&!i.artifact&&Number.isInteger(i.bookId)).slice(0,32);
   const bookDep=manifest.navigationDependencies?.find(d=>d.role==='item-readables'),bookScript=scripts.find(s=>s.url===bookDep?.url);
   if(books.length&&bookScript&&hash(sources[bookScript.scriptId]??'')===bookDep.sha256&&sources[scripts.find(s=>s.url===proof.module).scriptId].includes('from"./'+new URL(bookDep.url).pathname.split('/').at(-1)+'"')){
    try{const bookNamespace=value(await c.send('Runtime.evaluate',{...base,expression:`import(${JSON.stringify(bookDep.url)})`,returnByValue:false,awaitPromise:true,throwOnSideEffect:false,objectGroup:'dfo-observer-proof'}),'CACHED_BOOK_MODULE')?.objectId;
     const exp=await c.send('Runtime.getProperties',{objectId:bookNamespace,ownProperties:true,generatePreview:false}),title=exp.result?.find(p=>p.name==='on')?.value;
     const builtin=await closureBinding(c,title?.objectId,'Hc'),classic=await closureBinding(c,title?.objectId,'Cc');
     for(const item of books){let book=null;if(builtin?.objectId){book=value(await c.send('Runtime.callFunctionOn',{objectId:builtin.objectId,arguments:[{value:item.bookId}],functionDeclaration:'function(id){const b=this.get(id);if(!b)return null;return {kind:"book",title:b.title,author:b.author,pages:b.pages?.slice(0,256).map(page=>page.map(line=>typeof line==="string"?line:line.text??"").join("\\n").slice(0,32000)),resolved:true,source:"Owned built-in book; stored public text, no reader UI opened"};}',returnByValue:true,throwOnSideEffect:false,silent:true}),'OWN_BUILTIN_BOOK')?.value;}
      if(!book&&classic?.objectId){const known=value(await c.send('Runtime.callFunctionOn',{objectId:classic.objectId,arguments:[{value:item.bookId===10000?5:item.bookId}],functionDeclaration:'function(id){return this.has(id);}',returnByValue:true,throwOnSideEffect:true,silent:true}),'OWN_BOOK_REFERENCE')?.value;if(known){const file='BOK'+String((item.bookId===10000?5:item.bookId)&255).padStart(5,'0')+'.TXT';const encoded=value(await c.send('Runtime.evaluate',{...base,expression:`(${readOwnedBookAsset.toString()})(${JSON.stringify(file)})`,returnByValue:true,awaitPromise:true,throwOnSideEffect:false,timeout:1000}),'OWN_BOOK_ASSET')?.value;if(encoded)book=decodeBookFile(Buffer.from(encoded,'base64'));}}
      item.readable=book??{available:false,reason:'OWNED_BOOK_ASSET_UNAVAILABLE'};
     }
    }catch(e){result.value.inventory.books={available:false,reason:e.code??'OWNED_BOOK_READ_FAILED'};}
   }
   const magic=binding('UO'),magicDep=manifest.navigationDependencies?.find(d=>d.role==='town-ui'),magicScript=scripts.find(s=>s.url===magicDep?.url);
   if(magic?.objectId&&magicScript&&hash(sources[magicScript.scriptId]??'')===magicDep.sha256){
    try{result.value.spells.readied=value(await c.send('Runtime.callFunctionOn',{objectId:magic.objectId,functionDeclaration:'function(){const s=this.readied();return {available:true,spell:s?{name:s.name,index:s.index,element:s.element,rangeType:s.rangeType}:null,cost:this.readiedCost(),armed:this.spellArmed(),casting:this.castInProgress()};}',returnByValue:true,throwOnSideEffect:true,silent:true}),'READIED_SPELL')?.value;}catch(e){result.value.spells.readied={available:false,reason:e.code??'READIED_SPELL_UNAVAILABLE'};}
   }
   const costDep=manifest.navigationDependencies?.find(d=>d.role==='spell-cost'),costScript=scripts.find(s=>s.url===costDep?.url);
   describeSpells(result.value);
   if(costScript&&hash(sources[costScript.scriptId]??'')===costDep.sha256&&sources[scripts.find(s=>s.url===proof.module).scriptId].includes('from"./'+new URL(costDep.url).pathname.split('/').at(-1)+'"'))try{
    const costModule=value(await c.send('Runtime.evaluate',{...base,expression:`import(${JSON.stringify(costDep.url)})`,returnByValue:false,awaitPromise:true,throwOnSideEffect:false,objectGroup:'dfo-observer-proof'}),'CACHED_SPELL_COST_MODULE')?.objectId;
    const exp=await c.send('Runtime.getProperties',{objectId:costModule,ownProperties:true,generatePreview:false}),calculate=exp.result?.find(p=>p.name==='yr')?.value;
    if(capture&&calculate?.objectId){const review={};for(const name of ['Jp','Xp']){const map=await closureBinding(c,calculate.objectId,name);if(map?.objectId)review[name]=value(await c.send('Runtime.callFunctionOn',{objectId:map.objectId,functionDeclaration:'function(){return Array.from(this.values()).slice(0,32).map(fn=>Function.prototype.toString.call(fn).slice(0,16000));}',returnByValue:true,throwOnSideEffect:false,silent:true}),'COST_MODIFIER_SOURCE')?.value;}await writeFile(new URL('../../work/cost-modifier-review.json',import.meta.url),JSON.stringify(review,null,2));await captureCostSources(c,calculate.objectId);}
    const skillDep=manifest.navigationDependencies?.find(d=>d.role==='skill-softcap'),skillScript=scripts.find(s=>s.url===skillDep?.url),copiedReviewed=manifest.player.copiedBaselineReviewed&&skillScript&&hash(sources[skillScript.scriptId]??'')===skillDep.sha256;
    const costs=await guardedSpellCosts(c,playerId,calculate?.objectId,result.value.spells.known.length,copiedReviewed?result.value.spells.known.map(s=>s.castingCost.copiedBaseline):[],refs=>reviewedCostCopies(c,playerId,result.value,refs,manifest,sources));
    for(const row of costs){const s=result.value.spells.known[row.arrayIndex];if(s&&Number.isFinite(row.cost)){s.currentCastingCost=row.cost;s.currentCastingCostSource=row.baselineSource;}}
    result.value.spells.currentCosts={available:costs.every(r=>Number.isFinite(r.cost)),reason:costs.find(r=>!Number.isFinite(r.cost))?.reason??null,method:'Reviewed copied baseline/context when needed, guarded native callbacks, Qp modifier ordering/rounding/free-cast rules',failures:costs.filter(r=>!Number.isFinite(r.cost))};
   }catch(e){result.value.spells.currentCosts={available:false,reason:e.code??'SPELL_COST_UNAVAILABLE'};}
   describeSpells(result.value);
   }
   const dep=manifest.navigationDependencies?.find(d=>d.role==='quest-messages'),actual=scripts.find(s=>s.url===dep?.url);
   if(manager?.objectId&&actual&&hash(sources[actual.scriptId]??'')===dep.sha256){
    try{result.value.journal=value(await c.send('Runtime.callFunctionOn',{objectId:playerId,arguments:[{objectId:manager.objectId}],functionDeclaration:copyKnownJournal.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'KNOWN_JOURNAL')?.value;}catch(e){result.value.journal={available:false,reason:e.code??'JOURNAL_UNAVAILABLE'};}
    if(result.value.journal?.available&&result.value.questTracker?.available){enrichTrackerDestinations(result.value.questTracker,result.value.journal);const maps=binding('publicQuestPlaces'),destinations=result.value.questTracker.views.map(v=>v.destination).filter(d=>d&&!d.point);if(maps?.objectId&&destinations.length)try{const points=value(await c.send('Runtime.callFunctionOn',{objectId:maps.objectId,arguments:[{value:destinations}],functionDeclaration:copyPublicQuestMapPoints.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'PUBLIC_RECORDED_DESTINATION_POINTS')?.value??[];for(const v of result.value.questTracker.views)if(v.destination&&!v.destination.point)v.destination.point=points.find(p=>p.locationName===v.destination.locationName&&(v.destination.mapId==null||p.mapId===v.destination.mapId))??null;}catch{}}
    if(result.value.journal?.available&&!dashboardLive)try{const deadlines=value(await c.send('Runtime.callFunctionOn',{objectId:manager.objectId,arguments:[{value:result.value.journal.active.map(q=>q.name)},{objectId:playerId}],functionDeclaration:copyKnownDeadlines.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'KNOWN_QUEST_DEADLINES')?.value;
     result.value.journal.deadlines={available:true,quests:deadlines??[],scope:'Cached UI countdown classifications and recorded journal eligibility only, including carried letters. A displayed countdown is not proof of quest failure. Unclassified/private timers suppressed; no clock getter, tick or quest methods called'};
    }catch(e){result.value.journal.deadlines={available:false,reason:e.code??'DEADLINES_UNAVAILABLE'};}
    if(!dashboardLive)try{const args=[{objectId:manager.objectId}],letters=value(await c.send('Runtime.callFunctionOn',{objectId:playerId,arguments:args,functionDeclaration:copyOwnLetters.toString(),returnByValue:true,throwOnSideEffect:false,silent:true}),'OWN_LETTERS')?.value??[];
     for(const letter of letters){const item=result.value.inventory.items[letter.index];if(item)item.readable=letter;}
    }catch(e){result.value.inventory.readables={available:false,reason:e.code??'OWN_LETTERS_UNAVAILABLE'};}
   }
  }
  if(result.value.available){result.value.readerProfile={reviewedVersion:manifest.reviewedVersion,playerSha256:manifest.player.sha256,host:proof.host};ownerGuidance(result.value);}
  if(dashboardLive&&session&&result.value.available){try{let dungeonMarks=null;const dep=manifest.navigationDependencies?.find(d=>d.role==='world-modes'),script=scripts.find(s=>s.url===dep?.url),source=script?sources[script.scriptId]:null,match=source?.match(/questMarks:\(\)=>([A-Za-z0-9_$]+)\(\)/);if(source&&hash(source)===dep.sha256&&match&&source.includes(match[1]+'=()=>')){const modes=dashboardWorldBindings?.('$');if(modes?.objectId){const props=await c.send('Runtime.getProperties',{objectId:modes.objectId,ownProperties:true,generatePreview:false}),getter=props.result?.find(p=>p.name==='mode')?.get;if(getter?.objectId)dungeonMarks=await closureBinding(c,getter.objectId,match[1]);}}session.lowImpact=await retainDashboardReader(c,{playerId,tracker:exported(manifest.player.publicQuestTrackerExport),binding:name=>{if(name==='G'){const dep=manifest.navigationDependencies?.find(d=>d.role==='town-ui'),script=scripts.find(s=>s.url===dep?.url);if(!script||hash(sources[script.scriptId]??'')!==dep.sha256)return null;}return dashboardWorldBindings?.(name);},poseRefs:dashboardPoseRefs,canvas,context,snapshot:result.value,mapAccessor:exported(manifest.player.mapCurrentExport),mapRecord:exported(manifest.player.mapRecordExport),mapBinding:manifest.player.mapModelBinding,dungeonMarks});}catch{session.lowImpact=null;}}
  return result.value;
 }finally{
  if(!usedFast)try{await c.send('Runtime.releaseObjectGroup',{objectGroup:'dfo-observer-proof'});}catch{}
  if(debuggerEnabled)try{await c.send('Debugger.disable');}catch{}
  if(!usedFast)try{await c.send('DOM.disable');}catch{}
  if(!session){try{await c.send('Runtime.disable');}catch{}c.close();}
 }
}
