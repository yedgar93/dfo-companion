import test from 'node:test';
import assert from 'node:assert/strict';
import {copyTownShops,copyPublicTownEntrances} from '../navigation.mjs';
import {copyKnownJournal} from '../journal.mjs';
import {copyIdentityRenderedPeerPositions} from '../peer-positions.mjs';
import {readVisibleScene} from '../scene.mjs';

test('only a recorded quest key admits a private residence, with its known address',()=>{
 const directory=[{buildingKey:259,buildingType:18,position:[10,0,0]},{buildingKey:260,buildingType:18,position:[20,0,0]}];
 assert.equal(copyTownShops(directory,[0,0,0],[],0).shops.length,0);
 const r=copyTownShops(directory,[0,0,0],[],0,[{buildingKey:259,buildingName:'The Copperford Residence',questName:'The Bodyguard'}]);
 assert.equal(r.shops.length,1);assert.equal(r.shops[0].name,'The Copperford Residence');assert.equal(r.shops[0].bearingDegrees,90);assert.deepEqual(r.shops[0].questNames,['The Bodyguard']);
});
test('recorded residence doors are admitted without reading another private house',()=>{
 const directory=[{buildingKey:259,buildingType:18},{buildingKey:260,buildingType:18}],matrix=[1,0,0,0,0,1,0,0,0,0,1,0,10,0,20,1];
 const entries=[{pixelKey:'1,2',blockX:0,blockY:1,recordIndex:3,door:{doorType:1,matrix,centre:{x:0,y:0,z:0}}},{pixelKey:'1,2',blockX:0,blockY:1,recordIndex:4,get door(){throw Error('PRIVATE');}}];
 const r=copyPublicTownEntrances(directory,entries,'1,2',[0,0,0],[0,0,0],0,[259]);assert.equal(r.doors.length,1);assert.equal(r.doors[0].mapKey,259);assert.equal(r.doors[0].position.x,10);
});
function journal(text,person={displayName:'Ashwing',npcGender:1}){
 const resources=new Map([['giver',person],['home',{siteDetails:{buildingName:'Copperford',locationName:'Town',regionName:'Region',buildingKey:259,mapId:123}}]]);
 const q={displayName:'The Bodyguard',activeLogMessages:new Map([[1,{messageID:1,time:123}]]),messages:new Map([[1,{variants:[{tokens:[text]}]}]]),resources};
 return copyKnownJournal.call({name:'Player'},{machine:{quests:new Map([[1,q]])}}).active[0];
}
test('recorded actor gender resolves numbered pronouns and disclosed keys without hooks',()=>{
 const r=journal('On %qdt, _giver_ asked me to protect %g2 at _home_.');assert.match(r.entries[0].variants[0],/protect her/);assert.deepEqual(r.entries[0].unresolvedMacros,['%qdt']);assert.match(r.entries[0].displayVariants[0],/^Recorded entry:/);assert.equal(r.disclosedLocations[0].buildingKey,259);
});
test('unknown pronoun context remains a complete numbered macro without invoking getters',()=>{
 const person={displayName:'Known'};Object.defineProperty(person,'npcGender',{get(){throw Error('getter');}});const r=journal('_giver_ asked me to protect %g2.',person);assert(r.entries[0].unresolvedMacros.includes('%g2'));
});
test('identity copy selects rendered peers after more than 128 unrelated records and skips getters',()=>{
 const peers=new Map(Array.from({length:150},(_,i)=>['other'+i,{shown:{x:1000,y:0,z:1000}}]));peers.set('public',{shown:{x:0,y:0,z:-4}});const bad={};Object.defineProperty(bad,'x',{get(){throw Error('getter');}});peers.set('bad',{shown:bad});
 const r=copyIdentityRenderedPeerPositions.call({peers},null,null,{walkers:new Map([['public',{}],['bad',{}]])});assert.deepEqual(r,[{id:'public',position:[0,0,-4]}]);
});
test('visible candidate selection uses render pools instead of the network-map prefix',()=>{
 const peers=new Map(Array.from({length:150},(_,i)=>['other'+i,{id:'other'+i,name:'UNRENDERED',shown:{x:0,y:0,z:-4}}]));peers.set('public',{id:'public',name:'Visible Player',shown:{x:0,y:0,z:-4}});
 const renderer={_proj:[1,0,0,0,0,1,0,0,0,0,-1.02,-1,0,0,-.202,0],_view:[1,0,0,0,0,1,0,0,0,0,1,0,0,-1,0,1],_camPos:[0,1,0]};
 const r=readVisibleScene.call(renderer,{mode:'interior',people:[],network:{peers},walkers:new Map([['public',{batch:{}}]]),peerPositions:[{id:'public',position:[0,0,-4]}],collider:{_broad:{always:[],cells:new Map,coarseCells:new Map,frames:[]}}});assert.deepEqual(r.entities.map(e=>e.name),['Visible Player']);assert(!JSON.stringify(r).includes('UNRENDERED'));assert(!JSON.stringify(r).includes('"id":"public"'));
});
test('reviewed world-to-local copy applies native scale, map origin and vertical compensation',()=>{
 const world={mapOrigin:{x:109,y:159},compensation:[3,7,9]},p={x:109*32768+400,y:20,z:(499-159)*32768-800};
 const r=copyIdentityRenderedPeerPositions.call({peers:new Map([['p',{shown:p}]])},null,null,{walkers:new Map([['p',{}]])},world,{kind:'world',nativeUnitsPerMetre:40});assert.deepEqual(r[0].position,[13,27,-11]);
 assert.equal(copyIdentityRenderedPeerPositions.call({peers:new Map},null,null,null,world,{kind:'world',nativeUnitsPerMetre:1}),null);
});
