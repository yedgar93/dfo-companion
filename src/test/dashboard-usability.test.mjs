import test from 'node:test';
import assert from 'node:assert/strict';
import {fittedDungeonFrame,dungeonCamera} from '../dashboard-interior-model.mjs';
import {compareEquipment} from '../dashboard-items.mjs';

test('explicit fit contains tall dungeon geometry in plan and rotated 3D views',()=>{
 const points=[];for(const x of [-120,80])for(const y of [-40,60])for(const z of [-30,190])points.push({x,y,z});
 for(const [yaw,pitch] of [[0,Math.PI/2],[.65,.85],[2,.12],[-2,1.5]]){
  const frame=fittedDungeonFrame(points,{x:10,y:0,z:0},yaw,pitch),camera=dungeonCamera(frame.center,frame.span,yaw,pitch);
  for(const p of points){const q=camera.project(p);assert(q.x>0&&q.x<320);assert(q.y>0&&q.y<160);}
 }
});
const clothing=(name,affixes,extra={})=>({index:1,name,group:'WomensClothing',templateIndex:193,identified:true,magicKnown:true,enchantmentCount:0,affixes,condition:{current:100,max:100},...extra});
const context={inventoryComplete:true,restrictionEvidenceKnown:true,careerFlags:0,forbiddenMaterials:0};
test('social gains retain standing losses alongside gains and never get a green upgrade',()=>{
 const worn=clothing('Old',[{id:'standing',param:'underworld',value:3}],{index:0,equipSlot:24});
 const next=clothing('Suit',[{id:'standing',param:'merchants',value:3},{id:'stat',param:'personality',value:1}]);
 const c=compareEquipment(next,[worn,next],context);
 assert.equal(c.kind,'tradeoff');assert(c.losses.includes('-3 underworld standing'));assert(c.gains.includes('+3 merchants standing'));
});
test('a loss-free social comparison explains its benefit category',()=>{
 const worn=clothing('Plain',[],{index:0,equipSlot:24});const next=clothing('Suit',[{id:'standing',param:'merchants',value:3}]);
 const c=compareEquipment(next,[worn,next],context);assert.equal(c.kind,'upgrade');assert.equal(c.title,'Social-stat improvement');
});
