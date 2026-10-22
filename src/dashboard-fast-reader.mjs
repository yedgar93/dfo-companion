import {startIdleDungeonMap} from './dashboard-dungeon-reader.mjs';
import {interiorSceneKey,dungeonKeyMatches} from './dashboard-interior-model.mjs';
import {randomUUID} from 'node:crypto';
import {readPlayer} from './reader.mjs';
import {copyPublicQuestTracker,enrichTrackerDestinations} from './quest-tracker.mjs';
import {copyKnownJournal} from './journal.mjs';
import {copyOwnTownPose,copyPublicTownYards} from './town-map.mjs';
import {copyTownShops} from './navigation.mjs';
import {readNavigationScope} from './navigation.mjs';
// One bounded call against references retained only after exact source/realm proof.
// No debugger protocol, scope enumeration, module import, or side-effect-guard evaluation.
export function copyFastDashboard(readOwn,readTracker,readJournal,readPose,coreOnly=false){
 if(location.protocol!=='dagger:'||location.host!=='game'||location.pathname!=='/play/index.html')return {available:false,reason:'PAGE_CHANGED'};
 if(!this.canvas?.isConnected||document.querySelector('#c')!==this.canvas)return {available:false,reason:'GAME_CANVAS_UNAVAILABLE'};
 // Location-change guard: for a few seconds after a scene change only pose and vitals are copied.
 const deferred=!coreOnly&&!!this.lastFullPlayer&&this.deferUntil>performance.now();if(deferred)coreOnly=true;const lanes={};let laneAt=performance.now();const lane=k=>{const t=performance.now();lanes[k]=t-laneAt;laneAt=t;};
 const started=performance.now(),p=coreOnly&&this.lastFullPlayer?this.copyLightPlayer(this.player,this.lastFullPlayer):readOwn(this.player,true);
 if(!p?.available)return p;lane(coreOnly?'core':'own');
 if(!coreOnly&&this.tracker){p.questTracker=readTracker.call(this.tracker);lane('tracker');}
 if(!coreOnly&&this.manager){p.journal=readJournal.call(this.player,this.manager,this.journalCache??={});p.dashboardJournalReused=this.journalCache.lastReused===true;lane('journal');}if(!coreOnly)this.lastFullPlayer=p;p.dashboardCoreOnly=coreOnly;
 if(this.motor&&this.camera&&this.world&&this.modes){
  let loc=readPose.call({W:this.motor,U:this.camera,H:this.world,$:this.modes,gb:this.place});if(loc?.mode==='exterior'&&this.exteriorMotor)loc=readPose.call({W:this.exteriorMotor,U:this.exteriorCamera,H:this.world,$:this.modes,gb:this.place});
  const changed=loc?.mode!==this.mode||(loc?.mode!=='exterior'&&(loc?.mapPixel?.x!==this.pixelX||loc?.mapPixel?.y!==this.pixelY))||loc?.place?.buildingKey!==this.buildingKey||loc?.place?.dungeonName!==this.dungeonName;
  if(loc?.available){const scene=[loc.mode,loc.mapPixel?.x,loc.mapPixel?.y,loc.place?.buildingKey,loc.place?.dungeonName].join('|');if(this.sceneKey!==undefined&&scene!==this.sceneKey){this.deferUntil=performance.now()+3000;if(this.journalCache)this.journalCache.force=true;}this.sceneKey=scene;}
  if(loc?.available){if(loc.mode==='exterior'&&(loc.mapPixel?.x!==this.pixelX||loc.mapPixel?.y!==this.pixelY))loc.place={...loc.place,name:null,regionName:null,locationIndex:null};this.currentLocation=loc;p.dashboardPose={capturedAt:new Date().toISOString(),location:loc,town:this.tiles?this.copyTownPose.call(this.tiles,loc):null};}
  else {p.dashboardPose=null;}
 }
 lane('pose');const waitMs=(this.deferUntil??0)-performance.now();p.dashboardDeferred=waitMs>0?{until:new Date(Date.now()+waitMs).toISOString(),panels:['details','quests']}:null;p.dashboardLaneMs=lanes;
 p.dashboardDungeonNeedsReference=this.dungeonNeedsReference===true;p.dashboardDungeonStatus=typeof this.dungeonStatus==='string'?this.dungeonStatus:null;p.dashboardDungeonCost=this.dungeonDiagnostics?.copyMs??null;this.lastCorePose=p.dashboardPose??null;p.dashboardCopyMs=performance.now()-started;
 return p;
}
export function fastDashboardEligible(session,context,now=Date.now()){const cache=session?.lowImpact;return !!cache&&cache.contextId===context.uniqueId;}
export async function readFastDashboard(c,cache){
 if(cache.push&&!c.dashboardPush)return {available:false,reason:'IDLE_READER_WAITING'};
 const reply=cache.push?{result:{value:c.dashboardPush?.value??cache.snapshot}}:await c.send('Runtime.callFunctionOn',{objectId:cache.objectId,functionDeclaration:`function(){return (${copyFastDashboard.toString()}).call(this,${readPlayer.toString()},${copyPublicQuestTracker.toString()},${copyKnownJournal.toString()},${readNavigationScope.toString()});}`,returnByValue:true,throwOnSideEffect:false,silent:true,generatePreview:false});
 if(cache.push&&c.dashboardPush&&Date.now()-c.dashboardPush.at>15000)return {available:false,reason:'IDLE_READER_WAITING'};
 if(reply.exceptionDetails||!reply.result?.value)throw Object.assign(Error('FAST_READ_UNAVAILABLE'),{code:'FAST_READ_UNAVAILABLE'});
 const result=reply.result.value;if(!result.available)return result;
 // Keep source-reviewed metadata; fresh own fields and public tracker replace it.
 if(c.dashboardDetailPush?.value?.available&&c.dashboardDetailPush.at!==(cache.latestDetailAt??null)){cache.latest=c.dashboardDetailPush.value;cache.latestDetailAt=c.dashboardDetailPush.at;}const merged={...(cache.latest??cache.snapshot),...result};
 merged.vitals=structuredClone(result.vitals);
 if(Number.isFinite(cache.snapshot.vitals?.health?.rawBase)){const h=merged.vitals.health,b=cache.snapshot.vitals.health.rawBase;h.max=(h.limiter>=1&&h.limiter<b?h.limiter:b)+(h.renownBonus??0)+(h.spireBonus??0);}
 for(const k of ['health','magicka'])if(merged.vitals[k]?.max===null)merged.vitals[k].max=cache.snapshot.vitals?.[k]?.max??null;
 if(merged.questTracker?.available){enrichTrackerDestinations(merged.questTracker,merged.journal);for(const v of merged.questTracker.views??[]){const d=v.destination;if(!d)continue;const old=cache.snapshot.questTracker?.views?.find(x=>x.id===v.id&&x.destination?.locationName===d.locationName&&x.destination?.regionName===d.regionName)?.destination;if(old?.point)d.point=old.point;}}
 const loc=merged.dashboardPose?.location;if(loc?.mode==='dungeon')loc.dungeonSceneKey=interiorSceneKey(loc);if(loc){const place=c.dashboardPlaces?.get(loc.mapPixel?.x+','+loc.mapPixel?.y);if(place)loc.place={...loc.place,name:place.name,regionName:place.regionName??loc.place?.regionName??(place.region===17?'Daggerfall':null),regionIndex:place.region};const key=loc.mapPixel?.x+','+loc.mapPixel?.y;merged.dashboardMapUpdate=c.dashboardMaps?.get(key)??null;}const oldTown=cache.snapshot.dashboardPose?.town;
 if(loc?.mode==='exterior'&&oldTown?.origin&&oldTown.pixelKey===loc.mapPixel?.x+','+loc.mapPixel?.y){const f=loc.floatingOrigin,p=loc.position,m=loc.mapPixel;if(f?.compensation)merged.dashboardPose.town={pixelKey:oldTown.pixelKey,origin:oldTown.origin,headingDegrees:loc.orientation?.headingDegrees,position:{x:p.x-(m.x-f.mapPixelX)*819.2-f.compensation[0]-oldTown.origin[0],z:p.z+(m.y-f.mapPixelY)*819.2-f.compensation[2]-oldTown.origin[2],frame:'town local'}};}
 const dungeon=c.dashboardDungeon;if(loc?.mode==='dungeon'&&dungeonKeyMatches(dungeon?.sceneKey,loc))merged.dashboardDungeonMap=dungeon;if(loc?.mode==='dungeon')merged.dashboardDungeonResetScene=dungeon?.sceneKey??null;
 merged.readerProfile=cache.snapshot.readerProfile;
 merged.dashboardLowImpact=true;
 merged.dashboardMetadataAt=new Date(cache.reviewedAt).toISOString();
 return merged;
}
export async function retainDashboardReader(c,{playerId,tracker,binding,poseRefs,canvas,context,snapshot,mapAccessor=null,mapRecord=null,mapBinding=null,dungeonMarks=null}){
 await c.send('Runtime.releaseObjectGroup',{objectGroup:'dfo-dashboard-live'});
 const refs=[tracker,binding?.('Dh'),poseRefs?.motor,poseRefs?.camera,binding?.('H'),binding?.('$'),binding?.('gb'),binding?.('Bm'),binding?.('G'),binding?.('publicQuestPlaces'),binding?.('W'),binding?.('U'),mapAccessor,mapRecord,dungeonMarks];
 const arguments_=refs.map(r=>r?.objectId?{objectId:r.objectId}:{value:r?.value??null});
 const loc=snapshot.dashboardPose?.location;
 if(c.dashboardBinding)await c.send('Runtime.removeBinding',{name:c.dashboardBinding.name});
 const pushName='__dfoCompanionSnapshot_'+randomUUID().replaceAll('-','');
 await c.send('Runtime.addBinding',{name:pushName,executionContextId:context.id});
 c.dashboardBinding={name:pushName,contextId:context.id};c.dashboardPush=null;c.dashboardDetailPush=null;
 const reply=await c.send('Runtime.callFunctionOn',{objectId:playerId,arguments:[...arguments_,{objectId:canvas.objectId},{value:{identity:snapshot.identity,vitals:snapshot.vitals,mode:loc?.mode,buildingKey:loc?.place?.buildingKey??null,dungeonName:loc?.place?.dungeonName??null,pixelX:loc?.mapPixel?.x,pixelY:loc?.mapPixel?.y}}],functionDeclaration:`function(tracker,manager,motor,camera,world,modes,place,tiles,ui,places,exteriorMotor,exteriorCamera,mapAccessor,mapRecord,dungeonMarks,canvas,scene){const state={incrementalDetails:true,detailsAt:new Date().toISOString(),lastFullPlayer:{identity:scene.identity,vitals:scene.vitals},player:this,mapAccessor,mapRecord,dungeonMarks,tracker,manager,motor,camera,world,modes,place,tiles,ui,places,exteriorMotor,exteriorCamera,canvas,copyTownPose:${copyOwnTownPose.toString()},copyLightPlayer:${copyLightDashboard.toString()},...scene};const readOwn=${readPlayer.toString()},readTracker=${copyPublicQuestTracker.toString()},readJournal=${copyKnownJournal.toString()},readPose=${readNavigationScope.toString()},copy=${copyFastDashboard.toString()};(${startIdleDungeonMap.toString()})(state,${JSON.stringify(pushName)});(${startIdleMapUpdates.toString()})(state,${JSON.stringify(pushName)},${copyTownShops.toString()},${copyPublicTownYards.toString()});(${startIdleDetailUpdates.toString()})(state,readOwn,readTracker,readJournal,${JSON.stringify(pushName)});(${startIdleSnapshots.toString()})(state,coreOnly=>copy.call(state,readOwn,readTracker,readJournal,readPose,coreOnly),${JSON.stringify(pushName)});return state;}`,objectGroup:'dfo-dashboard-live',returnByValue:false,throwOnSideEffect:false,silent:true});
 if(!reply.result?.objectId||reply.exceptionDetails)return null;
 return {push:true,objectId:reply.result.objectId,contextId:context.uniqueId,reviewedAt:Date.now(),snapshot,mapBinding};
}

// This scheduler owns only its timer and snapshot container. It never hooks a game loop.
export function startIdleSnapshots(state,read,bindingName){
 state.idleDiagnostics={runs:0,budget:null,error:null};const emit=globalThis[bindingName];if(typeof emit!=='function'||typeof requestIdleCallback!=='function')return;
 let stopped=false,interval=500,average=0,slow=0,healthy=0,lastDetails=state.incrementalDetails?performance.now():null,lastDetailsAt=state.detailsAt??null,lastCost=null;
 const alive=()=>!stopped&&globalThis[bindingName]===emit&&state.canvas?.isConnected;
 const schedule=(delay=interval)=>{if(alive())setTimeout(()=>{if(alive())requestIdleCallback(run);},delay);};
 function run(deadline){if(!alive())return;state.idleDiagnostics.runs++;state.idleDiagnostics.budget=deadline.timeRemaining();const now=performance.now(),detailsDue=lastDetails===null||now-lastDetails>=4000,canDetail=!state.incrementalDetails&&detailsDue&&!(state.deferUntil>now)&&deadline.timeRemaining()>=2;
  if(deadline.timeRemaining()<.5||(lastDetails===null&&!canDetail)){schedule(100);return;}
  try{const start=performance.now(),value=read(!canDetail);if(!value.available&&!['PAGE_CHANGED','GAME_CANVAS_UNAVAILABLE'].includes(value.reason))value.reason='IDLE_READER_WAITING';if(canDetail&&value.available){lastDetails=now;lastDetailsAt=new Date().toISOString();}value.dashboardCoreOnly=!canDetail;value.dashboardDetailsAt=state.detailsAt??lastDetailsAt;value.dashboardCapturedAt=new Date().toISOString();value.dashboardPerformance={mode:interval>500?'protecting':'normal',intervalMs:interval,detailsIntervalMs:4000,copyMs:lastCost,averageCopyMs:average,slowSamples:slow,lane:canDetail?'details':'position and vitals'};const payload=JSON.stringify(value);emit(payload);const cost=performance.now()-start;lastCost=cost;average=average?average*.8+cost*.2:cost;if(cost>2){slow++;healthy=0;interval=Math.min(4000,interval*2);}else if(cost<.5&&++healthy>=8){interval=Math.max(500,Math.round(interval*.75));healthy=0;}if(!value.available&&['PAGE_CHANGED','GAME_CANVAS_UNAVAILABLE'].includes(value.reason))stopped=true;state.idleDiagnostics.error=null;
  }catch(error){state.idleDiagnostics.error=String(error?.message??error).slice(0,160);emit(JSON.stringify({available:false,reason:'IDLE_READER_WAITING'}));}schedule();
 }
 requestIdleCallback(run);
}

export function copyLightDashboard(player,previous){const own=(o,k)=>Object.getOwnPropertyDescriptor(o??{},k)?.value,n=(o,k)=>{const v=own(o,k);return typeof v==='number'&&Number.isFinite(v)?v:null;};if(own(player,'isPlayer')!==true||own(player,'peer'))return {available:false,reason:'PLAYER_SURFACE_UNAVAILABLE'};return {available:true,identity:{...previous.identity,name:own(player,'name')??previous.identity?.name,level:n(player,'level')},resources:{goldPieces:n(player,'goldPieces')},vitals:{health:{...previous.vitals.health,current:n(player,'health'),renownBonus:n(player,'renownHp')??0,spireBonus:n(player,'spireHp')??0,limiter:n(player,'maxHealthLimiter')},magicka:{...previous.vitals.magicka,current:n(player,'magicka')},fatigue:{...previous.vitals.fatigue,current:n(player,'fatigue')}}};}

// Incremental public map copies share the existing binding. No inspector requests.
export function startIdleMapUpdates(state,bindingName,copyShops,copyYards){
 const emit=globalThis[bindingName],own=(o,k)=>Object.getOwnPropertyDescriptor(o??{},k)?.value;
 if(typeof emit!=='function'||typeof requestIdleCallback!=='function')return;
 let iterator=state.places instanceof Map?state.places.values():null,work=null,scene=null,sceneAt=0,directory=null,metadataDone=false;
 const completed=new Map,alive=()=>globalThis[bindingName]===emit&&state.canvas?.isConnected;
 state.mapDiagnostics={phase:'waiting',error:null};
 const schedule=()=>{if(alive())setTimeout(()=>{if(alive())requestIdleCallback(run);},iterator||work?50:1000);};
 function run(deadline){if(!alive())return;if(deadline.timeRemaining()<2){schedule();return;}
  try{
   const start=performance.now();
   if(iterator){const rows=[];for(let n=0;n<64&&performance.now()-start<.75;n++){const step=iterator.next();if(step.done){iterator=null;break;}const r=step.value,x=own(r,'px'),y=own(r,'py'),region=own(r,'region'),name=own(r,'name');if(Number.isFinite(x)&&Number.isFinite(y)&&Number.isInteger(region)&&typeof name==='string')rows.push({x,y,region,name:name.slice(0,120)});}if(rows.length)emit(JSON.stringify({mapEvent:'places',rows}));}
   const loc=state.currentLocation,key=loc?.mapPixel?.x+','+loc?.mapPixel?.y;
   if(loc&&loc.mode!=='dungeon'&&state.tiles instanceof Map){
    const signature=key+'|'+loc.mode+'|'+(loc.place?.buildingKey??''),tile=Map.prototype.get.call(state.tiles,key),blocks=own(tile,'locBlocks'),origin=own(tile,'locOrigin'),currentDirectory=state.ui?.buildingDirectory;
    if(signature!==scene||directory!==currentDirectory){scene=signature;sceneAt=performance.now();directory=currentDirectory;metadataDone=false;}
    if(work&&(work.key!==key||work.tile!==tile||work.blocks!==blocks))work=null;
    const ready=Array.isArray(blocks)&&blocks.length>0&&blocks.length<=144&&Array.isArray(origin)&&performance.now()-sceneAt>=1500;
    if(ready&&!work){
     const geometry=completed.get(key),pose=state.copyTownPose.call(state.tiles,loc),pos=pose?.position??{x:0,z:0};
     if(geometry?.tile===tile&&geometry.blocks===blocks&&geometry.count===blocks.length){
      if(!metadataDone&&Array.isArray(directory)&&directory.length){const shops=copyShops(directory,[pos.x,0,pos.z],[],loc.orientation?.yawRadians,[]);emit(JSON.stringify({mapEvent:'town-metadata',key,location:loc,shops,publicYards:copyYards.call(state.tiles,key)}));metadataDone=true;}
      state.mapDiagnostics.phase=metadataDone?'current':'waiting for directory';
     }else if(Array.isArray(directory)&&directory.length){
      work={key,tile,blocks,index:0,width:0,height:0};const shops=copyShops(directory,[pos.x,0,pos.z],[],loc.orientation?.yawRadians,[]);emit(JSON.stringify({mapEvent:'town-start',key,origin:origin.slice(0,3),shops,publicYards:copyYards.call(state.tiles,key),location:loc}));metadataDone=true;state.mapDiagnostics.phase='copying';
     }else state.mapDiagnostics.phase='waiting for directory';
    }
    if(work&&performance.now()-start<1){const b=work.blocks[work.index++],x=own(b,'x'),y=own(b,'y'),bytes=own(own(own(own(b,'dfBlock'),'rmbBlock'),'fldHeader'),'autoMapData');if(Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<16&&y<16&&bytes?.length===4096){work.width=Math.max(work.width,x+1);work.height=Math.max(work.height,y+1);emit(JSON.stringify({mapEvent:'town-block',key,x,y,pixels:Array.from(bytes)}));}if(work.index>=work.blocks.length){if(work.width&&work.height){emit(JSON.stringify({mapEvent:'town-end',key,width:work.width*64,height:work.height*64}));if(completed.size>=8)completed.delete(completed.keys().next().value);completed.set(key,{tile:work.tile,blocks:work.blocks,count:work.blocks.length});state.mapDiagnostics.phase='current';}work=null;}}
   }else {work=null;scene=null;state.mapDiagnostics.phase='waiting for town';}
   state.mapDiagnostics.error=null;
  }catch(error){work=null;metadataDone=false;state.mapDiagnostics.phase='retrying';state.mapDiagnostics.error=String(error?.message??error).slice(0,120);}
  schedule();
 }
 schedule();
}

// Large detail snapshots are assembled in bounded idle slices; core updates never wait for them.
export function startIdleDetailUpdates(state,readOwn,readTracker,readJournal,bindingName){
 const emit=globalThis[bindingName],alive=()=>globalThis[bindingName]===emit&&state.canvas?.isConnected;
 if(typeof emit!=='function'||typeof requestIdleCallback!=='function')return;
 let phase=0,detail=null,index=0,batch=8,lastCost=0;
 const schedule=delay=>{if(alive())setTimeout(()=>{if(alive())requestIdleCallback(run);},delay);};
 function run(deadline){if(!alive())return;if(deadline.timeRemaining()<.75){schedule(50);return;}if(state.deferUntil>performance.now()){schedule(500);return;}
  try{const start=performance.now();
   if(phase===0){detail=readOwn(state.player,true,{section:'base'});if(!detail?.available){schedule(250);return;}detail.inventory.items=[];index=0;phase=1;}
   else if(phase===1){const part=readOwn(state.player,true,{section:'items',start:index,end:index+batch});if(!part.available)throw Error('Player unavailable');detail.inventory.available=part.inventory.available;detail.inventory.truncated=part.inventory.truncated;detail.inventory.items.push(...part.inventory.items);index+=batch;if(index>=part.total)phase=2;}
   else if(phase===2){if(state.tracker)detail.questTracker=readTracker.call(state.tracker);phase=3;}
   else if(phase===3){if(state.manager)detail.journal=readJournal.call(state.player,state.manager,state.journalCache??={});phase=4;}
   else {state.detailsAt=new Date().toISOString();state.lastFullPlayer=detail;detail.dashboardDetailsAt=state.detailsAt;detail.dashboardCapturedAt=state.detailsAt;detail.dashboardCoreOnly=false;detail.dashboardPose=state.lastCorePose??null;detail.dashboardPerformance={mode:'idle slices',intervalMs:500,detailsIntervalMs:4000,copyMs:lastCost,lane:'details'};emit(JSON.stringify(detail));phase=0;}
   lastCost=performance.now()-start;if(lastCost>1&&batch>1)batch=Math.max(1,Math.floor(batch/2));state.detailDiagnostics={phase,lastCost,batch};
  }catch(error){phase=0;state.detailDiagnostics={error:String(error?.message??error).slice(0,120)};}
  schedule(phase===0?4000:50);
 }
 schedule(50);
}
