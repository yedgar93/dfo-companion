import test from 'node:test';import assert from 'node:assert/strict';
import {copyLoadedGathering} from '../gathering.mjs';
const world={mapOrigin:{x:100,y:100},compensation:[3,-500,819.2]};
const map=nodes=>new Map([['loaded',{entry:{px:100,py:101},nodes}]]);
test('loaded gathering coordinates use tile translation and current floating compensation',()=>{
 const r=copyLoadedGathering.call(map([{kind:'herb',key:'patch',herb:7,tier:1,local:[10,501,20]}]),world,[3,1,20],0);
 assert.deepEqual(r.nearestHerb.position,{x:13,y:1,z:20,frame:'floating-origin exterior local',units:'game metres'});assert.equal(r.nearestHerb.distanceMetres,10);assert.equal(r.nearestHerb.bearingDegrees,90);assert.equal(r.nearestHerb.herbId,7);assert.equal(r.nearestHerb.availability,'UNKNOWN');
});
test('nearest tier-one hand patch is distinct from a closer sickle patch',()=>{
 const r=copyLoadedGathering.call(map([{kind:'herb',tier:3,local:[1,500,0]},{kind:'herb',tier:1,offSeason:true,local:[2,500,0]},{kind:'herb',tier:1,key:'hand',local:[3,500,0]}]),world,[3,0,0],0);
 assert.equal(r.nearestHerb.requiredTool,'Sickle');assert.equal(r.nearestHandPickHerb.nodeKey,'hand');assert.equal(r.nearestHandPickHerb.requiredTool,'None for hand-picking');
});
test('school markers are not described as interactable fishing-bank targets',()=>{
 const r=copyLoadedGathering.call(map([{kind:'haul',school:true,local:[0,500,0]}]),world,[3,0,0],0);assert.equal(r.nearestFishing.schoolHint,true);assert.equal(r.nearestFishing.interactable,false);assert.equal(r.nearestFishing.requiredTool,'Fishing Net');
});
test('turn angles remain bounded for unwrapped positive and negative camera rotations',()=>{
 for(const yaw of [20*Math.PI, -21*Math.PI,22.07079941536291]){const r=copyLoadedGathering.call(map([{kind:'tree',local:[1,500,-3]}]),world,[3,0,0],yaw);assert(r.nodes[0].relativeTurnDegrees>=-180&&r.nodes[0].relativeTurnDegrees<=180);}
});
test('data-only scan never calls generators, depletion checks or property getters',()=>{
 const node={kind:'herb',tier:1,local:[1,500,0],get name(){throw Error('getter');},gone(){throw Error('depletion');},plan(){throw Error('plan');}};
 const tile={entry:{px:100,py:101},nodes:[node],nodesOf(){throw Error('generator');}};const r=copyLoadedGathering.call(new Map([['loaded',tile]]),world,[3,0,0],0);assert.equal(r.nearestHerb.name,'herb patch');assert.equal(r.nearestHerb.interactable,null);
});
test('list bounds do not hide the nearest node behind a different resource kind',()=>{
 const r=copyLoadedGathering.call(map([...Array.from({length:20},(_,i)=>({kind:'tree',local:[i+1,500,0]})),{kind:'herb',tier:1,local:[100,500,0]}]),world,[3,0,0],0);assert.equal(r.nodes.length,13);assert(r.nearestHerb);assert.equal(r.scanTruncated,false);assert.equal(r.nodeListTruncated,true);
});
