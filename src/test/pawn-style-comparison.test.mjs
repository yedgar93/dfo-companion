import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProfile,buildScale,SKILL_NAMES,affixWeight} from '../upgrade-scoring.mjs';
import {createComparisonSession,prepareComparisons,comparisonIndicator} from '../dashboard-items.mjs';
const ctx=(group=[22,23,24])=>({inventoryComplete:true,restrictionEvidenceKnown:true,careerFlags:0,forbiddenMaterials:0,level:5,race:'Breton',attributes:{strength:50,intelligence:50,willpower:50,agility:50,endurance:50,personality:50,speed:50,luck:50},skills:SKILL_NAMES.map(name=>({name,permanent:30,display:30,effective:30})),skillGroups:{primarySkills:group,majorSkills:[],minorSkills:[]}});
const ring=(index,value,equipSlot=null,extra={})=>({index,name:'Ring '+index,group:'Jewellery',templateIndex:135,equipSlot,identified:true,magicKnown:true,enchantmentCount:0,special:false,effectsComplete:true,condition:{current:100,max:100},affixes:[{id:'stat',param:'intelligence',value}],...extra});
test('automatic scale reports the exact weights used for custom-class comparisons',()=>{
 const context=ctx(),profile=buildProfile(context),scale=buildScale(profile);
 assert.equal(scale.attributes.length,8);assert.equal(scale.skills.length,35);assert.match(scale.source,/heuristic/);
 for(const row of scale.attributes)assert.equal(row.weight,affixWeight({id:'stat',param:row.name},profile));
 const combat=buildScale(buildProfile(ctx([29,31,34])));
 assert(scale.attributes.find(x=>x.name==='intelligence').weight>combat.attributes.find(x=>x.name==='intelligence').weight);
});
test('score components reconcile to the conservative total and show effective stat quantities',()=>{
 const context=ctx(),old=ring(0,3,4),next=ring(1,8),session=createComparisonSession([old,next],context),c=session.compare(next,4);
 assert.equal(c.kind,'upgrade');assert(Math.abs(c.buildScore.components.reduce((n,x)=>n+x.delta,0)-c.buildScore.delta)<1e-9);
 const row=c.buildScore.components.find(x=>x.label==='stat intelligence');assert.equal(row.quantity,5);assert.equal(row.delta,row.quantity*row.weight);
 const capped=createComparisonSession([old,next],{...context,attributes:{...context.attributes,intelligence:99}}).compare(next,4);
 assert.equal(capped.buildScore.components.find(x=>x.label==='stat intelligence').quantity,1);
});
test('best-in-pack marks the strongest owned confirmed candidate for each explicit paired-slot baseline',async()=>{
 const oldA=ring(0,7,4),oldB=ring(1,1,5),good=ring(2,3),best=ring(3,9),partial=ring(4,30,null,{identified:false,magicKnown:false});
 const all=[oldA,oldB,good,best,partial],session=createComparisonSession(all,ctx());await prepareComparisons(all,session);
 assert.deepEqual(session.bestFitSlotsFor(best),[4,5]);assert.deepEqual(session.bestFitSlotsFor(good),[]);assert.deepEqual(session.bestFitSlotsFor(partial),[]);assert.deepEqual(session.bestFitSlotsFor(oldA),[]);
 const slots=session.bestFitSlotsFor(best);slots.length=0;assert.deepEqual(session.bestFitSlotsFor(best),[4,5]);
 const reversed=createComparisonSession([...all].reverse(),ctx());assert.deepEqual(reversed.bestFitSlotsFor(best).sort(),[4,5]);
 const next=createComparisonSession([oldA,oldB,good],ctx());assert.deepEqual(next.bestFitSlotsFor(good),[5]);
});
test('a forbidden weapon skill cannot turn jewelry into an upgrade or bias the automatic scale',()=>{
 const context={...ctx([22,23,24]),careerFlags:1<<1},old=ring(0,0,4),next=ring(1,0,null,{affixes:[{id:'skill',param:29,value:20}]}),session=createComparisonSession([old,next],context),c=session.compare(next,4);
 assert.notEqual(c.kind,'upgrade');assert.equal(c.buildScore.delta,0);assert.equal(buildScale(session.profile).skills.find(x=>x.name==='Long Blade').weight,0);
 const trained={...context,skills:context.skills.map(s=>s.name==='Long Blade'?{...s,display:100,permanent:100,effective:100}:s)};
 assert.deepEqual(buildProfile(context).mix,buildProfile(trained).mix);
 assert(affixWeight({id:'skill',param:'Destruction'},session.profile)>0);
});

test('a capped-stat replacement that may be unchanged is a tradeoff rather than a definite downgrade',()=>{
 const context=ctx(),old=ring(0,0,4,{affixes:[{id:'stat',param:'strength',value:10}]}),next=ring(1,0,null,{affixes:[{id:'stat',param:'strength',value:5}]});context.attributes.strength=100;
 const c=createComparisonSession([old,next],context).compare(next,4);assert.equal(c.buildScore.boundedStats,true);assert(c.buildScore.deltaMin<0);assert.equal(c.buildScore.deltaMax,0);assert.notEqual(c.kind,'upgrade');assert.equal(comparisonIndicator(c).kind,'tradeoff');assert.match(c.reason,/Bounded comparison/);
});
