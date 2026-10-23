import test from 'node:test';import assert from 'node:assert/strict';
import {copyOwnCostInputs,copyCourtCostContext,copyFirmamentCostValues,copiedModifierRows} from '../cost-context.mjs';
import {readPlayer} from '../reader.mjs';import {describeSpells} from '../spells.mjs';

test('equipped cost proofs preserve unknown active powers and sets rather than assuming no discount',()=>{
 const slots=Array(27).fill(null),p={equip:{slots}};slots[19]={rarity:'magic',affixes:[]};assert.equal(copyOwnCostInputs.call(p).equipment.known,true);
 slots[19].affixes=[{id:'focus',value:5}];assert.equal(copyOwnCostInputs.call(p).equipment.known,false);slots[19]={rarity:'legendary',legendary:'unknown-owned-power'};assert.equal(copyOwnCostInputs.call(p).equipment.known,false);
 for(let i=0;i<4;i++)slots[i]={sigil:{set:'mora'}};assert.equal(copyOwnCostInputs.call(p).mora.known,false);p.arcanePath='wardwright';assert.equal(copyOwnCostInputs.call(p).wardwright.known,false);p._mentor={};assert.equal(copyOwnCostInputs.call(p).wardwright.known,true);
});

test('Court cost context reads only the owner and reproduces focus rank plus fourth offensive cast readiness',()=>{
 const owner={},context={entity:owner,vs:[[1,1],[2,2],[3,1]],b:'PRIVATE BOARD'},focus={focus:{id:2,v:[.05,.1,.15]}},family={1:{fam:'arcana'},2:{fam:'arcana'},3:{fam:'arcana'}};
 const r=copyCourtCostContext.call(owner,context,focus,family,'PRIVATE BOARD',3);assert.equal(r.focusFraction,.1);assert.equal(r.freeReady,true);assert(!JSON.stringify(r).includes('PRIVATE BOARD'));
 const other={entity:{}};Object.defineProperty(other,'vs',{get(){throw Error('OTHER STATE READ');}});assert.equal(copyCourtCostContext.call(owner,other).focusFraction,0);
});

test('Firmament copy retains private-symbol prices and applies the cap before adding prices',()=>{
 const config={'castCost':5,'castCost.Restoration':30};Object.defineProperty(config,Symbol('firmament prices'),{value:{'castCost.Restoration':-10}});Object.freeze(config);
 const firm=copyFirmamentCostValues.call(config),p={spells:{known:[{effects:[{type:23,subType:0}]},{effects:[{type:23,subType:0},{type:22,subType:0}]}]}},inputs={mora:{known:true,less:0},equipment:{known:true,less:0},wardwright:{known:true,less:0}},court={available:true,focusFraction:0,freeReady:true};
 const r=copiedModifierRows(p,inputs,court,firm,e=>e.type===23?'Restoration':'Destruction');assert.equal(r[0].modifiers[4].less,15);assert.equal(r[1].modifiers[4].less,5);assert.equal(r[0].free.value,false);
});

test('mastered skill casting uses the diminishing-return value while sheet display preserves the raw skill',()=>{
 const p={isPlayer:true,_online:true,masteredSkills:[22],skills:Array(35).fill(30),stats:{},items:[]};p.skills[22]=200;const r=readPlayer(p);assert.equal(r.skills[22].display,200);assert.equal(r.skills[22].effectiveCasting,140);p.masteredSkills=[];assert.equal(readPlayer(p).skills[22].effectiveCasting,100);p.skillOverrides={22:150};assert.equal(readPlayer(p).skills[22].effectiveCasting,150);
});

test('copied baseline refuses incomplete effects and unreviewed path remapping',()=>{
 const p={skills:Array.from({length:35},()=>({display:30,effectiveCasting:30})),spells:{known:[{index:1,path:'unknown-path',rangeType:0,effects:[{type:10,subType:8,magnitudeBaseLow:1,magnitudeBaseHigh:1,magnitudeLevelBase:0,magnitudeLevelHigh:0,magnitudePerLevel:1}]},{index:2,rangeType:0,effects:[{type:10,subType:8,magnitudeBaseLow:null}]}]}};describeSpells(p);assert.equal(p.spells.known[0].castingCost.copiedBaseline.complete,false);assert.equal(p.spells.known[1].castingCost.copiedBaseline.complete,false);assert.equal(p.spells.known[1].castingCost.current,null);
});
