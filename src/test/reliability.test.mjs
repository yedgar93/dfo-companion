import test from 'node:test';
import assert from 'node:assert/strict';
import {stampActors,snapshotSections,actionableError} from '../reliability.mjs';
import {copyInteriorLandmarks} from '../landmarks.mjs';
import {buildAdvice} from '../guidance.mjs';
import {summarizeOwner,ownerDifferences} from '../history.mjs';
import {Observer} from '../observer.mjs';
import {selectReviewedProfile,proveCachedModule} from '../cached-module.mjs';
import {createHash} from 'node:crypto';
import {readPlayer} from '../reader.mjs';

test('modal coverage suppresses current-visible actors but preserves nearby NPC coordinates',()=>{
 const npc={position:{x:1,y:2,z:3}},nav={visibleText:{sceneCovered:true},scene:{entities:[{kind:'npc',position:npc.position}],loadedNpcs:{npcs:[npc]}}};
 stampActors(nav,'a','b');assert.equal(nav.scene.available,false);assert.equal(nav.scene.entities.length,0);assert.equal(npc.provenance.state,'NEARBY');assert.equal(npc.provenance.observedAt,'b');assert.equal(nav.scene.unknownCoverage.state,'UNKNOWN');
});

test('snapshot reports section windows and partial failure without presenting stale sections',async()=>{
 let calls=0;const observer=new Observer({cachedModule:true},async()=>++calls===1?{available:true,vitals:{health:{current:1}},inventory:{available:true,items:[]},spells:{known:[]},journal:{available:true,active:[]},characterSheet:{},activeEffects:[],guidance:{}}:{available:true,location:{available:true},scene:{available:false,reason:'SCENE_COVERED_BY_GAME_UI'},visibleText:{available:true,lines:[]}});
 const s=await observer.query('snapshot');assert.equal(calls,2);assert.equal(s.snapshot.atomic,false);assert.equal(s.snapshot.sections.inventory.available,true);assert.equal(s.snapshot.sections.scene.available,false);assert(s.snapshot.sections.scene.action.includes('interface'));assert(s.snapshot.sections.inventory.observationWindow.completedAt);assert(s.snapshot.sections.ui.observationWindow.completedAt);assert.equal(s.snapshot.allSectionsAvailable,false);assert.equal('entities'in s.context.scene,false);
});

test('interior landmarks transform doors and expose height without claiming stairs or a reachable route',()=>{
 const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,10,4,20,1],ctx={doors:[{matrix,centre:{x:1,y:1,z:0}}],ladders:[{matrix}],enterMarkers:[[2,0,3]]};Object.defineProperty(ctx,'containers',{get(){throw Error('PRIVATE CONTENT READ');}});
 const r=copyInteriorLandmarks.call({interiorCtx:ctx},{x:0,y:0,z:0},0);assert.equal(r.landmarks[0].position.x,11);assert.equal(r.landmarks[0].heightRelation,'ABOVE');assert.equal(r.landmarks[0].reachability,'UNKNOWN');assert.equal(r.routing.canGiveTurnByTurn,false);assert.equal(r.stairs.available,false);assert.equal(r.landmarks[2].kind,'entry_or_rest_marker');
});

test('landmark traversal is bounded and never reads a record beyond the limit',()=>{
 const rows=Array.from({length:128},()=>({matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}));Object.defineProperty(rows,'128',{get(){throw Error('OUTSIDE BUDGET');}});
 const r=copyInteriorLandmarks.call({interiorCtx:{doors:rows}},{x:0,y:0,z:0},0);assert.equal(r.landmarks.length,128);assert.equal(r.truncated,true);
});

test('gear and emergency advice keep restrictions, skill tradeoffs and unknown current spell costs explicit',()=>{
 const p={inventory:{items:[{index:0,name:'Held blade',group:'Weapons',equipSlot:19,condition:{current:100,percent:100},classRestriction:{weaponKind:'long blade'},displayStats:{damage:{min:2,max:8},hands:'One-handed'}},{index:1,name:'Forbidden axe',group:'Weapons',equipSlot:null,condition:{current:100,percent:100},classRestriction:{forbidden:true,reasons:['Class forbids Axe'],weaponKind:'axe'},displayStats:{damage:{min:10,max:20},hands:'Two-handed'}}]},vitals:{health:{current:10,max:100},magicka:{current:5,max:100}},skills:[{name:'Long Blade',display:60}],spells:{known:[],recoveryOptions:{health:[{index:1,name:'Heal',cost:{stored:0,baseOnlineEstimate:5,current:null}}]}}};
 const r=buildAdvice(p);assert.equal(r.gearComparisons[0].assessment,'DO_NOT_EQUIP_KNOWN_RESTRICTION');assert.equal(r.emergency.healthState,'CRITICAL');assert.equal(r.emergency.healing[0].affordable,null);assert.equal(r.emergency.healing[0].castsAvailable,null);assert.equal(r.emergency.healing[0].baseEstimateAffordable,true);
});

test('quest guidance orders known game-time deadlines and includes letter destinations without inventing a wall-clock due date',()=>{
 const r=buildAdvice({inventory:{items:[{index:3,readable:{disclosedLocations:[{buildingName:'Known Inn'}]}}]},journal:{active:[],deadlines:{quests:[{name:'Later',clocks:[{remainingSeconds:100000}],letterIndices:[]},{name:'Sooner',clocks:[{remainingSeconds:100,failureConfirmed:true}],letterIndices:[3]},{name:'Unknown',clocks:[],letterIndices:[]}]}}});
 assert.deepEqual(r.questPriority.map(q=>q.name),['Sooner','Later','Unknown']);assert.equal(r.questPriority[0].destinations[0].buildingName,'Known Inn');assert.equal(r.questPriority[0].priority,'URGENT');assert(!JSON.stringify(r).includes('dueDate'));
});

test('persistent summaries track recorded quest progress and expiring effects without saving objective text',()=>{
 const player={vitals:{},inventory:{items:[]},spells:{known:[]},journal:{active:[{name:'Known',entries:[{variants:['PRIVATE OBJECTIVE TEXT']}]}]},activeEffects:[{kind:'fortifyAttribute',stat:'strength',roundsRemaining:5}]};
 const before=summarizeOwner(player);player.journal.active[0].entries.push({variants:['NEW OBJECTIVE TEXT']});player.activeEffects[0].roundsRemaining=1;const after=summarizeOwner(player),r=ownerDifferences(before,after);assert(r.some(v=>v.kind==='recordedQuestProgressChanged'));assert(r.some(v=>v.kind==='effectDurationChanged'&&v.expiringSoon));assert(!JSON.stringify(after).includes('OBJECTIVE TEXT'));player.activeEffects=[];assert(ownerDifferences(after,summarizeOwner(player)).some(v=>v.kind==='effectNoLongerObserved'));
});

test('compatibility errors instruct review and never suggest bypassing guards or restarting an active game',()=>{
 assert(actionableError('PLAYER_SOURCE_NOT_REVIEWED').includes('do not bypass'));assert(actionableError('DEBUG_ENDPOINT_UNAVAILABLE').includes('when convenient'));assert(actionableError('CURRENT_SPELL_COSTS_SIDE_EFFECT_GUARD').includes('keep the guard enabled'));
});

test('a reviewed update selects its own singleton export and bindings; unknown hashes cannot reuse an older profile',()=>{
 const hash=s=>createHash('sha256').update(s).digest('hex'),url='dagger://game/assets/worldTick-CURRENT.js',host='dagger://game/assets/world-CURRENT.js',source='const ownPlayer={isPlayer:true};export {ownPlayer as qF};',hostSource='import{qF as V}from"./worldTick-CURRENT.js";canvas.addEventListener("click",()=>V);';
 const profile={player:{url,export:'qF',sha256:hash(source)},hosts:[{url:host,sha256:hash(hostSource),playerModule:url,playerExport:'qF',scopeName:'HRt'}],bindings:{Dh:'ih'}},scripts=[{scriptId:'p',url,isModule:true,executionContextId:1},{scriptId:'h',url:host,isModule:true,executionContextId:1}],sources={p:source,h:hostSource},manifest={profiles:[{player:{url:'old',export:'GF',sha256:'old'}},profile]};
 assert.equal(selectReviewedProfile(manifest,scripts,sources),profile);assert.equal(selectReviewedProfile(manifest,scripts,{...sources,p:source+'changed'}),null);const proof=proveCachedModule({manifest:profile,scripts,sources,listeners:[{scriptId:'h'}],contextId:1});assert.equal(proof.export,'qF');assert.equal(proof.scopeName,'HRt');assert.equal(proof.bindings.Dh,'ih');
});

test('own wagon and bag inventories use the same redaction and bounds without reading world containers',()=>{
 const p={isPlayer:true,items:[],wagonItems:[{name:'Stored Sword',uid:'PRIVATE UID',health:999}],bagItems:Array.from({length:501},()=>({name:'Bag Item'})),stats:{}};Object.defineProperty(p,'otherItems',{get(){throw Error('WORLD CONTAINER READ');}});
 const r=readPlayer(p);assert.equal(r.inventory.storage.wagon.items[0].name,'Stored Sword');assert.equal(r.inventory.storage.bag.items.length,500);assert.equal(r.inventory.storage.bag.truncated,true);assert(!JSON.stringify(r).includes('PRIVATE UID'));assert(!JSON.stringify(r).includes('999'));
});
