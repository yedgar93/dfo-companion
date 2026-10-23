// Synthetic worst-size carried pack. Never imports a reader or contacts DFO.
import {createComparisonSession,prepareComparisons} from '../src/dashboard-items.mjs';
import {SKILL_NAMES} from '../src/upgrade-scoring.mjs';
const context={inventoryComplete:true,restrictionEvidenceKnown:true,careerFlags:0,forbiddenMaterials:0,level:5,race:'Breton',
 attributes:{strength:60,intelligence:50,willpower:50,agility:50,endurance:50,personality:50,speed:50,luck:50},
 skills:SKILL_NAMES.map(name=>({name,display:30,effective:30,permanent:30})),skillGroups:{primarySkills:[29,34,20],majorSkills:[31,21,0]}};
const sword=i=>({index:i,name:'Synthetic sword '+i,group:'Weapons',templateIndex:117,material:1,equipSlot:i===0?19:null,identified:true,magicKnown:true,enchantmentCount:0,special:false,effectsComplete:true,condition:{current:100,max:100},template:{weaponSkillUsed:'LongBlade'},displayStats:{damage:{min:2+i%3,max:16+i%5},hands:'One-handed',perUnitWeightKg:3},affixes:[{id:'stat',param:'strength',value:i%4}]});
const items=Array.from({length:500},(_,i)=>sword(i)),runs=[];
for(let n=0;n<7;n++){
 const start=performance.now(),session=createComparisonSession(items,context);let last=start,maxChunk=0,yields=0;
 await prepareComparisons(items,session,{yieldNow:async()=>{maxChunk=Math.max(maxChunk,performance.now()-last);yields++;await new Promise(resolve=>setTimeout(resolve,0));last=performance.now();}});
 maxChunk=Math.max(maxChunk,performance.now()-last);
 const end=performance.now(),cached=performance.now();for(const i of items)session.compare(i);session.forSlot(19);session.forSlot(21);
 runs.push({elapsedMs:end-start,maxChunkMs:maxChunk,yields,cachedMs:performance.now()-cached});
}
const measured=runs.slice(2),median=key=>measured.map(r=>r[key]).sort((a,b)=>a-b)[Math.floor(measured.length/2)];
console.log(JSON.stringify({items:500,gameReads:0,samplingChanged:false,warmMedianMs:median('elapsedMs'),warmMedianChunkMs:median('maxChunkMs'),warmMedianCachedMs:median('cachedMs'),runs},null,2));
