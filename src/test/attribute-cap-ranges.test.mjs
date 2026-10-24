import test from 'node:test';
import assert from 'node:assert/strict';
import {contextAfterSwap,createBuildEvaluator,buildProfile,weaponScore,weaponTempo,SKILL_NAMES} from '../upgrade-scoring.mjs';

const context={careerFlags:0,forbiddenMaterials:0,level:5,race:'Breton',attributes:{strength:100,intelligence:50,willpower:50,agility:50,endurance:50,personality:50,speed:50,luck:50},skills:SKILL_NAMES.map(name=>({name,permanent:30,display:30,effective:30})),skillGroups:{primarySkills:[29],majorSkills:[31]}};
const ring=(value,extra={})=>({group:'MiscItems',templateIndex:1000,equipSlot:15,affixes:[{id:'stat',param:'strength',value}],identified:true,magicKnown:true,enchantmentTypes:[],...extra});
const sword={group:'Weapons',templateIndex:120,material:1,equipSlot:19,affixes:[],identified:true,magicKnown:true,enchantmentTypes:[],template:{weaponSkillUsed:'LongBlade'},displayStats:{damage:{min:2,max:15},hands:'One-handed',perUnitWeightKg:4.5}};

test('capped live attributes retain hidden-overflow ranges without mutating source context',()=>{
 const old=ring(10),next=ring(5),before=JSON.stringify(context),swapped=contextAfterSwap(context,[old],[next]);
 assert.deepEqual(swapped.attributeRanges,{strength:{min:95,max:100}});assert.equal(swapped.attributes.strength,95);assert.equal(JSON.stringify(context),before);
 const zero={...context,attributes:{...context.attributes,strength:0}},gain=contextAfterSwap(zero,[ring(-10)],[ring(5)]);
 assert.deepEqual(gain.attributeRanges.strength,{min:0,max:15});
 const uncapped={...context,attributes:{...context.attributes,strength:80}};assert.deepEqual(contextAfterSwap(uncapped,[old],[next]).attributeRanges,{});
});

test('overflow replacement bounds stat priorities and reference offense together',()=>{
 const old=ring(10),next=ring(5),worn=[sword,old],before=JSON.stringify({context,worn,next}),score=createBuildEvaluator(context,worn)(next,[old],15);
 assert.equal(score.known,true);assert.equal(score.boundedStats,true);assert(score.deltaMin<0);assert.equal(score.deltaMax,0);assert.equal(score.delta,score.deltaMin);
 const row=score.components.find(c=>c.label==='stat strength');assert.equal(row.quantityMin,-5);assert.equal(row.quantityMax,0);
 const expected=weaponScore(sword,{...context,attributes:{...context.attributes,strength:95}}).perSwing/weaponTempo(sword,{...context,attributes:{...context.attributes,strength:95}})-weaponScore(sword,context).perSwing/weaponTempo(sword,context);
 assert.equal(score.offensiveChangeMin,expected);assert.equal(score.offensiveChangeMax,0);assert.match(score.notes.join(' '),/Capped live attributes/);assert.equal(JSON.stringify({context,worn,next}),before);
});

test('a lower-cap recovery can be entirely hidden and cannot guarantee a positive score',()=>{
 const ctx={...context,attributes:{...context.attributes,strength:0}},old=ring(-10),next=ring(5),worn=[sword,old],score=createBuildEvaluator(ctx,worn)(next,[old],15);
 assert.equal(score.known,true);assert.equal(score.boundedStats,true);assert.equal(score.deltaMin,0);assert(score.deltaMax>0);assert.equal(score.delta,0);
 const row=score.components.find(c=>c.label==='stat strength');assert.equal(row.quantityMin,0);assert.equal(row.quantityMax,15);
});

test('combined armor and capped-stat ranges can straddle zero without a false positive',()=>{
 const old={...ring(10),group:'Armor',templateIndex:522,material:0,special:false,artifact:false,equipSlot:12},next={...ring(5),group:'Armor',templateIndex:107,material:512,special:false,artifact:false,equipSlot:null},worn=[sword,old];
 const score=createBuildEvaluator(context,worn)(next,[old],12);
 assert.equal(score.known,true);assert.equal(score.boundedStats,true);assert.equal(score.boundedArmor,true);assert(score.deltaMin<0);assert(score.deltaMax>0);assert(score.delta<=0);
});

test('armor-only swaps do not invent stat uncertainty or depend on unavailable combat skills',()=>{
 const old={group:'Armor',templateIndex:107,material:512,special:false,affixes:[],equipSlot:12,identified:true,magicKnown:true},next={...old,material:513,equipSlot:null},ctx={...context,skills:[]},profile={...buildProfile(context,[old]),known:true};
 const score=createBuildEvaluator(ctx,[old],profile)(next,[old],12);assert.equal(score.boundedStats,false);assert.equal(score.known,true);assert(score.delta>0);assert.equal(score.deltaMin,score.deltaMax);
});
