import test from 'node:test';
import assert from 'node:assert/strict';
import {readNavigationScope,copyTownShops,copyDiscoveredMap,copyHighlightedTarget} from '../navigation.mjs';
import {plainHudText,readVisibleHud} from '../visible-hud.mjs';
import {Observer} from '../observer.mjs';
import {runInNewContext} from 'node:vm';
import {PLAYER_EXPRESSION} from '../reader.mjs';

function scope(){return {W:{pos:new Float32Array([10,20,30])},U:{yaw:Math.PI/2,pitch:0},H:{current:{x:109,y:159},mapOrigin:{x:109,y:158},compensation:[0,0,819.2]},$:{mode:'exterior'},gb:{name:'Town',regionName:'Region',regionIndex:17,locationIndex:197}};}
test('own typed coordinates, compass convention and floating-origin stable world coordinates',()=>{
 const s=scope();Object.defineProperty(s,'X',{get(){throw Error('no accounts');}});Object.defineProperty(s,'J',{get(){throw Error('no entities');}});
 const r=readNavigationScope.call(s);assert.equal(r.available,true);assert.deepEqual(r.position,{x:10,y:20,z:30,frame:'floating-origin exterior local',units:'game metres'});assert.equal(r.orientation.heading,'east');assert.equal(r.orientation.headingDegrees,90);assert.equal(r.nativeWorld.x,109*32768+400);assert.equal(r.nativeWorld.z,(499-158)*32768+(30-819.2)*40);
 const shifted=scope();shifted.W.pos=new Float32Array([10+819.2,20,30]);shifted.H.compensation=[819.2,0,819.2];assert.ok(Math.abs(readNavigationScope.call(shifted).nativeWorld.x-r.nativeWorld.x)<.01);
});
test('reviewed mode getters report dungeon/interior correctly; no exterior GPS claimed inside',()=>{
 const s=scope();s.$={get mode(){return'dungeon';},get dungeonCtx(){return{name:'Known Hold'};},get interiorBuilding(){return null;}};
 const r=readNavigationScope.call(s);assert.equal(r.mode,'dungeon');assert.equal(r.nativeWorld,null);assert.equal(r.place.dungeonName,'Known Hold');assert.equal(r.position.frame,'current interior/dungeon local');
});
test('map serializer copies only the revealed record, bounded visited cells and recorded connections',()=>{
 const rec={revealed:new Set(['known']),visitedThisRun:new Set(['known','unrevealed']),trail:new Set(['1,2,3','bad']),notes:new Map([[1,{position:[1,2,3],note:'my note',secret:'DO_NOT_COPY'}]]),teleporters:new Map([['x',{entrance:{pos:[1,2,3],yawDeg:90},exit:{pos:[5,6,7],yawDeg:0},secret:'DO_NOT_COPY'}]]),entranceDiscovered:true};
 Object.defineProperty(rec,'model',{get(){throw Error('no full map');}});Object.defineProperty(rec,'undiscovered',{get(){throw Error('no unknown rows');}});
 const before=[...rec.revealed];const r=copyDiscoveredMap(rec);assert.deepEqual(r.revealedAreaKeys,['known']);assert.deepEqual(r.visitedThisRunKeys,['known']);assert.deepEqual(r.visitedTrail,[{x:1.5,y:2,z:3.5}]);assert.equal(r.discoveredConnections.length,1);assert.deepEqual([...rec.revealed],before);assert.equal(JSON.stringify(r).includes('DO_NOT_COPY'),false);
});
test('map missing state is honest and large trails/notes are bounded',()=>{
 assert.equal(copyDiscoveredMap(null).available,false);const r=copyDiscoveredMap({revealed:new Set(Array.from({length:513},(_,i)=>'r'+i)),trail:new Set(Array.from({length:1025},(_,i)=>`${i},0,0`)),notes:new Map(Array.from({length:65},(_,i)=>[i,{position:[0,0,0],note:'x'}]))});assert.equal(r.revealedAreaKeys.length,512);assert.equal(r.visitedTrail.length,1024);assert.equal(r.userNotes.length,64);assert.equal(r.truncated.trail,true);
});
test('public shops exclude private houses and unknown names, with correct bearing/relative turn',()=>{
 const directory=[{buildingType:9,buildingKey:1,name:'HIDDEN NAME',position:[10,0,0]},{buildingType:17,buildingKey:2,name:'PRIVATE HOUSE',position:[1,0,0]}];
 const r=copyTownShops(directory,[0,0,0],[],0);assert.equal(r.shops.length,1);assert.equal(r.shops[0].name,null);assert.equal(r.shops[0].type,'general store');assert.equal(r.shops[0].distanceMetres,10);assert.equal(r.shops[0].bearingDegrees,90);assert.equal(r.shops[0].relativeTurnDegrees,90);assert.equal(JSON.stringify(r).includes('HIDDEN NAME'),false);assert.equal(JSON.stringify(r).includes('PRIVATE HOUSE'),false);
 const known=copyTownShops(directory,[0,0,0],[{buildingKey:1,displayName:'Learned Name'}],Math.PI);assert.equal(known.shops[0].name,'Learned Name');assert.equal(known.shops[0].relativeTurnDegrees,-90);
});
test('highlighted resource is the existing selected target only, never a nearby scan',()=>{
 const provider={get target(){return {node:{kind:'tree',material:'oak',key:'DO_NOT_COPY',secret:'DO_NOT_COPY'},world:[3,0,4]};},nodesOf(){throw Error('no scan');}};
 const r=copyHighlightedTarget.call(provider,[0,0,0]);assert.equal(r.target.type,'logging tree');assert.equal(r.target.distanceMetres,5);assert.equal(r.target.material,'oak');assert.equal(JSON.stringify(r).includes('DO_NOT_COPY'),false);assert.equal(copyHighlightedTarget.call({target:null},[0,0,0]).target,null);
});
test('visible HUD text is bounded/decoded; hidden labels are never read',async()=>{
 assert.equal(plainHudText('<div>A &amp; B &#x26; C</div>'),'A & B & C');assert.equal(plainHudText('<div>'+ 'x'.repeat(500)+'</div>').length,240);
 const calls=[];
 const send=async(method,params)=>{calls.push({method,params});if(method==='DOM.querySelector')return{nodeId:params.selector==='.hud-foe.on'?2:0};if(method==='DOM.getBoxModel')throw Error('not rendered');throw Error('must not read hidden text');};
 const r=await readVisibleHud(send,1);assert.equal(r.currentFoe,null);assert.ok(!calls.some(c=>c.method==='DOM.getOuterHTML'));
});
test('visible foe HUD returns only displayed label and percent, no attacker list',async()=>{
 const selectors={'.hud-foe.on':2,'.hud-foename':3,'.hud-foetrack .hud-fill':4};
 const send=async(method,p)=>{if(method==='DOM.querySelector')return{nodeId:selectors[p.selector]??0};if(method==='DOM.getBoxModel')return{model:{width:100,height:20}};if(method==='CSS.getComputedStyleForNode')return{computedStyle:[{name:'opacity',value:'1'},{name:'display',value:'block'},{name:'visibility',value:'visible'}]};if(method==='DOM.getOuterHTML')return{outerHTML:'<div class="hud-foename">Elite Zombie</div>'};if(method==='DOM.getAttributes')return{attributes:['style','width: 42.5%;']};throw Error(method);};
 const r=await readVisibleHud(send,1);assert.equal(r.currentFoe.name,'Elite Zombie');assert.equal(r.currentFoe.healthPercent,42.5);assert.equal('enemies'in r,false);
});
test('navigation command is isolated from status and requires cached-mode opt in',async()=>{
 assert.equal((await new Observer({}).query('location')).reason,'CACHED_MODULE_OPT_IN_REQUIRED');
 let requested;const o=new Observer({cachedModule:true},async c=>{requested=c;return{available:true,location:{mode:'exterior'}};});const r=await o.query('shops');assert.equal(r.available,true);assert.equal(requested.navigationOnly,true);assert.equal(requested.navigationCommand,'shops');
});
test('item enhancements redact unidentified effects and fix real weight/identification fields',()=>{
 const player={isPlayer:true,health:1,maxHealth:1,skills:1,stats:{},items:[{name:'Unknown',isIdentified:false,weightInKg:2,stackCount:3,description:'HIDDEN EFFECT',enchantments:[{name:'HIDDEN EFFECT'}]},{name:'Known',isIdentified:true,weightInKg:1,stackCount:2,description:'Visible description',enchantments:[{name:'Known effect',type:1,param:3,secret:'DO_NOT_COPY'}]}]};
 const r=runInNewContext(PLAYER_EXPRESSION,{window:{__playerEntity:player}});const [a,b]=r.inventory.items;assert.equal(a.identified,false);assert.equal(a.perUnitWeightKg,2);assert.equal(a.totalStoredStackWeightKg,6);assert.equal(a.enchantments,null);assert.equal(a.description,null);assert.equal(b.description,'Visible description');assert.equal(b.enchantments[0].name,'Known effect');assert.equal(JSON.stringify(r).includes('HIDDEN EFFECT'),false);assert.equal(JSON.stringify(r).includes('DO_NOT_COPY'),false);
});
