import test from 'node:test';
import assert from 'node:assert/strict';
import {armorParts,armorPartsRange,armorProtection,buildProfile,createBuildEvaluator,weaponScore,weaponTempo,SKILL_NAMES} from '../upgrade-scoring.mjs';

const context={careerFlags:0,forbiddenMaterials:0,restrictionEvidenceKnown:true,level:5,race:'Breton',attributes:{strength:50,intelligence:50,willpower:50,agility:50,endurance:50,personality:50,speed:50,luck:50},skills:SKILL_NAMES.map(name=>({name,permanent:30,display:30,effective:30})),skillGroups:{primarySkills:[22,29,23],majorSkills:[25,27,20]}};
const armor=(extra={})=>({group:'Armor',templateIndex:522,material:0,special:false,artifact:false,identified:true,magicKnown:true,affixes:[{id:'armor',value:6}],equipSlot:12,...extra});

test('missing RRI leather/fur appearance has a complete bounded protection range',()=>{
 const item=armor(),original=JSON.stringify(item),range=armorPartsRange(item);
 assert.equal(armorParts(item).known,false);assert.equal(range.known,true);assert.equal(range.bounded,true);
 assert.equal(armorProtection(range.minParts),2.1);assert.equal(armorProtection(range.maxParts),3.1);
 for(const message of [0,1]){const exact=armorParts({...item,appearance:{message}});for(let p=0;p<7;p++)assert(exact.parts[p]>=range.minParts[p]&&exact.parts[p]<=range.maxParts[p]);}
 assert.equal(JSON.stringify(item),original);
});

test('known copied RRI protection remains exact when appearance is absent',()=>{
 const item=armor({displayStats:{baseArmour:5}}),range=armorPartsRange(item);
 assert.equal(armorParts(item).known,true);assert.equal(range.bounded,false);assert.deepEqual(range.minParts,range.maxParts);assert.equal(armorProtection(range.minParts),3.1);
});

test('unsupported armor evidence and special effects do not receive guessed bounds',()=>{
 for(const item of [armor({templateIndex:999}),armor({material:999}),armor({appearance:{message:2}}),armor({special:true}),armor({artifact:true}),armor({affixes:[{id:'armor',value:null}]})])assert.equal(armorPartsRange(item).known,false,JSON.stringify(item));
});

test('recommendation score is the worst-case gain across every allowed armor variant',()=>{
 const old=armor(),next=armor({templateIndex:107,material:512,affixes:[],equipSlot:null}),evaluator=createBuildEvaluator(context,[old],buildProfile(context,[old])),score=evaluator(next,[old],12);
 assert.equal(score.known,true);assert.equal(score.boundedArmor,true);assert(Math.abs(score.deltaMin-.4)<1e-9);assert(Math.abs(score.deltaMax-1.4)<1e-9);assert.equal(score.delta,score.deltaMin);assert.match(score.notes.join(' '),/least favorable/);
 for(const message of [0,1]){const exactOld={...old,appearance:{message}},exact=createBuildEvaluator(context,[exactOld],buildProfile(context,[exactOld]))(next,[exactOld],12);assert(exact.delta>=score.deltaMin-1e-9&&exact.delta<=score.deltaMax+1e-9);}
});

test('overlapping protection ranges cannot manufacture a positive recommendation',()=>{
 const old=armor({affixes:[]}),next=armor({templateIndex:107,material:0,affixes:[{id:'armor',value:5}],equipSlot:null}),score=createBuildEvaluator(context,[old],buildProfile(context,[old]))(next,[old],12);
 assert.equal(score.known,true);assert(score.deltaMin<0&&score.deltaMax>0);assert(score.delta<=0);
 const unknown=armor({special:true,artifact:null});assert.equal(createBuildEvaluator(context,[unknown],buildProfile(context,[unknown]))(next,[unknown],12).known,false);
});

test('explicit per-attack basis keeps melee and ranged candidates in matching units and uses actual proficiency',()=>{
 const weapon=(index,min,max,weight,skill,equipSlot=null)=>({group:'Weapons',templateIndex:index,material:1,identified:true,magicKnown:true,special:false,affixes:[],enchantmentTypes:[],equipSlot,template:{weaponSkillUsed:skill},displayStats:{damage:{min,max},hands:index===120?'One-handed':'Two-handed',perUnitWeightKg:weight}});
 const old=weapon(120,2,15,4.5,'LongBlade',19),melee=weapon(122,2,19,7.5,'LongBlade'),ranged=weapon(129,4,16,1,'Archery'),ctx={...context,weaponComparisonBasis:'per-attack',skills:context.skills.map(s=>({...s,display:s.name==='Long Blade'?80:s.name==='Archery'?6:s.display,effective:s.name==='Long Blade'?80:s.name==='Archery'?6:s.effective}))},profile=buildProfile(ctx,[old]),evaluate=createBuildEvaluator(ctx,[old],profile);
 for(const candidate of [melee,ranged]){const score=evaluate(candidate,[old],19),expected=weaponScore(candidate,ctx).perSwing-weaponScore(old,ctx).perSwing;assert.equal(score.weaponComparisonBasis,'per-attack');assert(Math.abs(score.offensiveChange-expected)<1e-9);assert.match(score.notes.join(' '),/per attack, not per second/);}
 assert(evaluate(ranged,[old],19).offensiveChange<0);
 const archer={...ctx,skills:ctx.skills.map(s=>s.name==='Archery'?{...s,display:95,effective:95}:s)};assert(createBuildEvaluator(archer,[old],buildProfile(archer,[old]))(ranged,[old],19).offensiveChange>0);
 const automatic=createBuildEvaluator({...ctx,weaponComparisonBasis:undefined},[old],profile)(melee,[old],19);assert.equal(automatic.weaponComparisonBasis,'per-second');assert.notEqual(automatic.offensiveChange,evaluate(melee,[old],19).offensiveChange);
});

test('ranged reference cadence follows default bow release and single-gun reload clocks',()=>{
 for(const templateIndex of [129,130]){
  assert.equal(weaponTempo({templateIndex},context),.25+1300/980);
  assert.equal(weaponTempo({templateIndex},{...context,attributes:{speed:90}}),.25+900/980);
  assert.equal(weaponTempo({templateIndex},{attributes:{}}),null);
 }
 assert.equal(weaponTempo({templateIndex:560},context),6/14+1.7);
 assert.equal(weaponTempo({templateIndex:562},context),6/12+1.4);
 assert.equal(weaponTempo({templateIndex:560},{attributes:{speed:90}}),6/14+1.7);
});

test('automatic weapon comparisons use one stable per-second scale and reject unsupported cadence',()=>{
 const weapon=(templateIndex,skill,equipSlot=null)=>({group:'Weapons',templateIndex,material:1,identified:true,magicKnown:true,special:false,affixes:[],enchantmentTypes:[],equipSlot,template:{weaponSkillUsed:skill},displayStats:{damage:{min:3,max:15},hands:'One-handed',perUnitWeightKg:4.5}});
 const old=weapon(120,'LongBlade',19),evaluate=createBuildEvaluator(context,[old],buildProfile(context,[old]));
 for(const candidate of [weapon(122,'LongBlade'),weapon(129,'Archery'),weapon(560,'Archery'),weapon(562,'Archery')]){
  const score=evaluate(candidate,[old],19),expected=weaponScore(candidate,context).perSwing/weaponTempo(candidate,context)-weaponScore(old,context).perSwing/weaponTempo(old,context);
  assert.equal(score.weaponComparisonBasis,'per-second');assert(Math.abs(score.offensiveChange-expected)<1e-9);
  if(candidate.templateIndex>=129)assert.match(score.notes.join(' '),/Reference cadence assumes/);
 }
 const unsupported=evaluate(weapon(999,'LongBlade'),[old],19);assert.equal(unsupported.known,false);assert.equal(unsupported.weaponComparisonBasis,null);assert.match(unsupported.unknowns.join(' '),/cadence is unavailable/);
});

test('Critical Strike uses effective proficiency while preserving the display fallback',()=>{
 const item={group:'Weapons',templateIndex:120,material:1,template:{weaponSkillUsed:'LongBlade'},affixes:[],displayStats:{damage:{min:2,max:15}}};
 const withCritical=(effective,display)=>({...context,skills:context.skills.map(s=>s.name==='Critical Strike'?{...s,effective,display}:s)});
 const effectiveZero=weaponScore(item,withCritical(0,95)),displayZero=weaponScore(item,withCritical(undefined,0)),effectiveHigh=weaponScore(item,withCritical(95,0)),displayHigh=weaponScore(item,withCritical(undefined,95));
 assert.equal(effectiveZero.hitChance,displayZero.hitChance);assert.equal(effectiveHigh.hitChance,displayHigh.hitChance);assert(effectiveHigh.perSwing>effectiveZero.perSwing);assert.equal(effectiveHigh.expectedDamage,effectiveZero.expectedDamage);
});
