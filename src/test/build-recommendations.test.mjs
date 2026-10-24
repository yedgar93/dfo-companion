import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareEquipment,comparisonIndicator,createComparisonSession,prepareComparisons,bestInPack,sortInventory} from '../dashboard-items.mjs';
import {SKILL_NAMES,buildProfile,contextAfterSwap,customArmorValue,weaponScore,weaponTempo,completeEquipmentData} from '../upgrade-scoring.mjs';
import {projectDetails} from '../dashboard-model.mjs';

const context=(extra={})=>({inventoryComplete:true,restrictionEvidenceKnown:true,careerFlags:0,forbiddenMaterials:0,
 skills:SKILL_NAMES.map(name=>({name,display:name==='Long Blade'?50:20,permanent:name==='Long Blade'?50:20,effective:name==='Long Blade'?50:20})),
 skillGroups:{primarySkills:[29,34,20],majorSkills:[31,21,0],minorSkills:[28]},
 attributes:{strength:60,intelligence:50,willpower:50,agility:50,endurance:50,personality:50,speed:50,luck:50},level:5,race:'Breton',...extra});
const item=(extra={})=>({index:1,name:'Item',group:'Jewellery',templateIndex:135,material:1,equipSlot:null,identified:true,magicKnown:true,enchantmentCount:0,special:false,effectsComplete:true,condition:{current:100,max:100},affixes:[],...extra});
const sword=(extra={})=>item({name:'Sword',group:'Weapons',templateIndex:117,template:{weaponSkillUsed:'LongBlade'},displayStats:{damage:{min:2,max:16},hands:'One-handed',perUnitWeightKg:3},...extra});
const ring=(index,value,stat='intelligence')=>item({index,name:'Ring '+value,affixes:[{id:'stat',param:stat,value}]});
const oldSword=sword({index:0,equipSlot:19});

test('custom classes and renamed classes follow skills, never a class-name lookup',()=>{
 const ctx=context(),a=ring(1,5,'strength'),b=ring(2,5,'intelligence');
 for(const className of ['Warrior','Mage','Thief','Spellsword','Custom','Unrecognised career']){
  const session=createComparisonSession([oldSword,a,b],{...ctx,className});
  assert(session.compare(a).rank>session.compare(b).rank);
 }
 const caster=context({skillGroups:{primarySkills:[22,23,24],majorSkills:[25,26,27],minorSkills:[]}});
 assert(compareEquipment(b,[a,b],caster).rank>compareEquipment(a,[a,b],caster).rank);
});

test('hybrids blend career and trained skills and remain independent of equipment bonuses',()=>{
 const ctx=context({skillGroups:{primarySkills:[29,22,16],majorSkills:[23,13,31]}}),p=buildProfile(ctx);
 assert(p.mix.combat>0&&p.mix.magic>0&&p.mix.stealth>0);assert(Math.abs(Object.values(p.mix).reduce((a,b)=>a+b,0)-1)<1e-10);
 const boosted={...ctx,skills:ctx.skills.map(s=>({...s,display:s.name==='Destruction'?200:s.display}))};
 assert.deepEqual(buildProfile(boosted).mix,p.mix);
});

test('utility magnitude determines best in pack and upgrade sorting; ties are deterministic',()=>{
 const weak=ring(1,1),strong=ring(2,9),all=[weak,strong],session=createComparisonSession(all,context());
 assert.equal(session.forSlot(4)[0].item,strong);
 assert.equal(bestInPack(all.map(item=>({item,comparison:session.compare(item)}))).get(4).item,strong);
 assert.equal(sortInventory(all,'upgrades',session.compare)[0],strong);
 const b={...strong,index:3,name:'B'},a={...strong,index:4,name:'A'};
 const chosen=order=>bestInPack(order.map(item=>({item,comparison:compareEquipment(item,order,context())}))).get(4).item.name;
 assert.equal(chosen([b,a]),'A');assert.equal(chosen([a,b]),'A');
});

test('all compatible slots are evaluated and manual targets do not change automatic arrows',()=>{
 const strong={...ring(1,8),equipSlot:4},weak={...ring(2,2),equipSlot:5},next=ring(3,5),session=createComparisonSession([strong,weak,next],context());
 assert.equal(session.compare(next).slot,5);assert.equal(session.compare(next,4).kind,'tradeoff');
 assert.equal(session.forSlot(4).length,0);assert.equal(session.forSlot(5)[0].item,next);
 assert.equal(session.compare(next,19).kind,'blocked');assert.equal(session.compare(next).slot,5);
});

test('custom two-hander 560 is displaced by a shield and either one-handed target',()=>{
 const two=sword({index:0,name:'Thunderlock',templateIndex:560,template:{weaponSkillUsed:'Archery'},equipSlot:19,displayStats:{damage:{min:5,max:20},hands:'Two-handed',perUnitWeightKg:8}}),shield=item({group:'Armor',templateIndex:109,material:0,displayStats:{baseArmour:1}}),next=sword();
 for(const c of [compareEquipment(shield,[two,shield],context()),compareEquipment(next,[two,next],context(),21)]){
  assert.deepEqual(c.swap.removed.map(i=>i.name),['Thunderlock']);assert.equal(c.unknowns.length,0);
 }
});

test('two-handed swaps include shield bonuses and standard shields have source-matched coverage',()=>{
 const shield=item({index:3,name:'Shield',group:'Armor',templateIndex:112,material:0,equipSlot:21,displayStats:{baseArmour:4},affixes:[{id:'resist',param:'fire',value:20}]}),next=sword({templateIndex:123,displayStats:{damage:{min:4,max:18},hands:'Two-handed',perUnitWeightKg:7}});
 const c=compareEquipment(next,[oldSword,shield,next],context());
 assert.deepEqual(c.swap.removed.map(i=>i.name),['Sword','Shield']);assert(c.losses.some(l=>l.includes('fire resistance')));assert(c.buildScore.components.some(r=>r.label==='armor protection'&&r.delta<0));
});

test('swap context removes old STR and skill bonuses once and leaves the snapshot untouched',()=>{
 const ctx=context(),old=item({equipSlot:4,affixes:[{id:'stat',param:'strength',value:10},{id:'skill',param:29,value:8}]}),next=item({affixes:[{id:'stat',param:'strength',value:3}]});
 const saved=JSON.stringify(ctx),after=contextAfterSwap(ctx,[old],[next]);
 assert.equal(after.attributes.strength,53);assert.equal(after.skills.find(s=>s.name==='Long Blade').display,42);assert.equal(after.skills.find(s=>s.name==='Long Blade').effective,42);assert.equal(JSON.stringify(ctx),saved);
 const c=compareEquipment(next,[oldSword,old,next],ctx,4);
 assert(c.buildScore.offensiveChange<0);assert(c.losses.some(l=>l.includes('strength')));
});

test('attribute caps and set resistance caps cannot manufacture extra value',()=>{
 const saturated=ring(1,10,'strength'),ctx=context({attributes:{...context().attributes,strength:100}});
 assert.notEqual(compareEquipment(saturated,[saturated],ctx).kind,'upgrade');
 const resist=(index,value,equipSlot=null)=>item({index,equipSlot,rarity:'rare',affixes:[{id:'resist',param:'fire',value}]}),a=resist(1,30,4),b=resist(2,15,5),c=resist(3,20);
 const result=compareEquipment(c,[a,b,c],context(),5);assert.equal(result.buildScore.delta,0);assert.notEqual(result.kind,'upgrade');
});

test('known gains can outweigh minor losses, which stay visible beside the green recommendation',()=>{
 const old=item({group:'Armor',templateIndex:107,material:512,equipSlot:12,displayStats:{baseArmour:7},affixes:[{id:'warmth',value:1}]}),next=item({group:'Armor',templateIndex:107,material:513,displayStats:{baseArmour:9}});
 const c=compareEquipment(next,[old,next],context());assert.equal(c.kind,'upgrade');assert(c.losses.some(l=>l.includes('warmth')));assert.match(c.reason,/estimated score with trade-offs/);assert.equal(comparisonIndicator(c).kind,'upgrade');
});

test('custom armor uses RRI tables and a conservative range when leather or fur is unknown',()=>{
 assert.equal(customArmorValue({templateIndex:515,material:512}),6);
 assert.equal(customArmorValue({templateIndex:520,material:512}),5);
 assert.equal(customArmorValue({templateIndex:522,material:0,appearance:{message:1}}),5);
 assert.equal(customArmorValue({templateIndex:522,material:0}),null);
 const helmet=item({group:'Armor',templateIndex:522,material:0,appearance:{message:0},affixes:[{id:'stat',param:'endurance',value:2}]});
 assert.equal(compareEquipment(helmet,[helmet],context()).kind,'upgrade');
 const uncertain={...helmet,appearance:null},comparison=compareEquipment(uncertain,[uncertain],context());
 assert.equal(comparison.kind,'upgrade');assert.equal(comparison.buildScore.boundedArmor,true);assert(comparison.buildScore.deltaMin>0);assert(comparison.buildScore.deltaMax>comparison.buildScore.deltaMin);assert.equal(comparison.unknowns.length,0);
 const unsupported={...helmet,appearance:{message:2}};assert.equal(comparisonIndicator(compareEquipment(unsupported,[unsupported],context())).kind,'unknown');
});

test('overlapping armor variants show an explicit tradeoff and never a confirmed slot upgrade',()=>{
 const old=item({index:0,name:'Unknown leather or fur helm',group:'Armor',templateIndex:522,material:0,equipSlot:12,displayStats:null}),next=item({index:1,name:'Leather helm with armor bonus',group:'Armor',templateIndex:107,material:0,displayStats:{baseArmour:3},affixes:[{id:'armor',value:5}]}),session=createComparisonSession([old,next],context()),c=session.compare(next,12);
 assert(c.buildScore.deltaMin<0&&c.buildScore.deltaMax>0);assert.equal(c.kind,'tradeoff');assert.equal(c.unknowns.length,0);assert.equal(comparisonIndicator(c).kind,'tradeoff');assert.equal(comparisonIndicator(c).symbol,'↔');assert.match(c.reason,/Bounded comparison/);assert.equal(session.forSlot(12).length,0);assert.equal(session.suggestionsForSlot(12).length,0);
});

test('armor-class profile reports the majority, with custom material families normalized',()=>{
 const worn=Array.from({length:6},()=>({group:'Armor',templateIndex:107,material:0}));worn.push({group:'Armor',templateIndex:108,material:512});
 assert.equal(buildProfile(context(),worn).armorClass,'Leather');
 assert.equal(buildProfile(context(),[{group:'Armor',templateIndex:515,material:512}]).armorClass,'Chain');
});

test('unknown properties, unsupported parameters and missing compatibility never receive green',()=>{
 for(const next of [ring(1,10,'madeUpStat'),item({affixes:[{id:'resist',param:'madeUpElement',value:20}]}),item({affixes:[{id:'mystery',value:30}]}),{...ring(1,10),identified:false},{...ring(1,10),effectsComplete:false},{...ring(1,10),enchantmentCount:1,enchantmentTypes:[{type:99,param:0}]}])assert.notEqual(compareEquipment(next,[next],context()).kind,'upgrade');
 const next=ring(1,10);assert.notEqual(compareEquipment(next,[next],context({restrictionEvidenceKnown:false})).kind,'upgrade');
 const hidden=item({index:0,equipSlot:0,identified:false,magicKnown:false}),resist=item({affixes:[{id:'resist',param:'fire',value:10}]});
 assert.notEqual(compareEquipment(resist,[hidden,resist],context()).kind,'upgrade');
});

test('broken or forbidden gear is blocked while wear alone never improves a build',()=>{
 const broken={...ring(1,10),condition:{current:0,max:100}};assert.equal(compareEquipment(broken,[broken],context()).kind,'blocked');
 const forbidden=sword();assert.equal(compareEquipment(forbidden,[forbidden],context({careerFlags:2})).kind,'blocked');
 const old={...ring(1,5),equipSlot:4,condition:{current:20,max:100}},next=ring(2,5);assert.notEqual(compareEquipment(next,[old,next],context(),4).kind,'upgrade');
 const worn={...ring(1,1),equipSlot:4},better={...ring(2,5),condition:{current:10,max:100}};assert.equal(compareEquipment(better,[worn,better],context(),4).title,'Upgrade after repair');
});

test('weapon clock accounts for weight and handling; missing values are explicit',()=>{
 const ctx=context(),light=sword({displayStats:{damage:{min:2,max:16},hands:'One-handed',perUnitWeightKg:1}}),heavy=sword({displayStats:{damage:{min:2,max:16},hands:'One-handed',perUnitWeightKg:8}});
 assert(weaponTempo(light,ctx)<weaponTempo(heavy,ctx));assert.equal(weaponTempo(light,{...ctx,attributes:{strength:60}}),null);
 assert.equal(weaponScore(sword({displayStats:{damage:{min:0,max:1e12}}}),ctx).known,false);
 assert.equal(weaponScore(sword({displayStats:{damage:{min:10,max:2}}}),ctx).known,false);
});

test('archers compare a matching bow in its observed hand without guessing the bow setting',()=>{
 const bow=(extra={})=>sword({templateIndex:129,template:{weaponSkillUsed:'Archery'},displayStats:{damage:{min:4,max:16},hands:'Two-handed',perUnitWeightKg:2},...extra});
 for(const slot of [19,21]){
  const old=bow({index:0,equipSlot:slot}),next=bow({index:1,displayStats:{damage:{min:6,max:20},hands:'Two-handed',perUnitWeightKg:2}}),c=compareEquipment(next,[old,next],context());
  assert.equal(c.kind,'upgrade');assert.equal(c.slot,slot);assert.equal(c.swap.removed.length,1);
 }
 const next=bow(),archer=context({skills:context().skills.map(s=>({...s,display:s.name==='Archery'?95:s.name==='Hand-to-Hand'?5:s.display,effective:s.name==='Archery'?95:s.name==='Hand-to-Hand'?5:s.effective}))});
 assert.equal(compareEquipment(next,[next],archer).kind,'upgrade');
});

test('projection reuses copied effective skills, all sixteen affixes, minor skills and coverage flags',()=>{
 const raw={identity:{},skills:[{name:'Long Blade',display:140,effectiveCasting:115,permanent:140}],characterSheet:{career:{weaponArmorShieldsBitfield:0,forbiddenMaterialsFlags:0,minorSkills:[29]}},inventory:{available:true,items:[{identified:true,artifact:false,affixes:Array.from({length:16},()=>({id:'weight',value:1})),enchantments:[],customEnchantments:[]}]}};
 const details=projectDetails(raw,null);assert.equal(details.comparisonContext.skills[0].effective,115);assert.deepEqual(details.comparisonContext.skillGroups.minorSkills,[29]);assert.equal(details.items[0].affixes.length,16);assert.equal(details.items[0].effectsComplete,false);
});

test('raw equipment without the optional live template cache still produces usable comparisons',()=>{
 const raw=(extra={})=>({name:'Synthetic equipment',group:'Weapons',templateIndex:120,material:1,count:1,identified:true,affixes:[],enchantments:[],customEnchantments:[],condition:{current:100,max:100},storedStats:{minDamage:2,maxDamage:15},...extra});
 const career={weaponArmorShieldsBitfield:0,forbiddenMaterialsFlags:0,primarySkills:[29],majorSkills:[31],minorSkills:[28]},ctx=context();
 const input={identity:{level:5,race:'Breton'},attributes:{live:ctx.attributes},skills:ctx.skills,characterSheet:{career},inventory:{available:true,items:[raw({equipSlot:19}),raw({name:'Shield',group:'Armor',templateIndex:110,equipSlot:21,storedStats:{}}),raw({name:'Claymore',templateIndex:122,storedStats:{minDamage:2,maxDamage:19}}),raw({name:'Bow',templateIndex:129,storedStats:{minDamage:4,maxDamage:16}}),raw({name:'Gun',templateIndex:560,material:4,storedStats:{}})]}};
 const original=JSON.stringify(input),details=projectDetails(input,null),session=createComparisonSession(details.items,details.comparisonContext);
 assert.deepEqual(details.items[0].displayStats.damage,{min:2,max:15});assert.equal(details.items[0].template.weaponSkillUsed,'LongBlade');assert.equal(details.items[1].displayStats.baseArmour,2);
 for(const item of details.items.slice(2)){const c=session.compare(item);assert.notEqual(comparisonIndicator(c)?.kind,'unknown',JSON.stringify(c.unknowns));assert.equal(c.unknowns.length,0);}
 assert.equal(session.compare(details.items[3]).requiresChoice,true);assert.equal(session.compare(details.items[4]).requiresChoice,true);
 assert.equal(JSON.stringify(input),original);
});

test('fallback respects copied overrides and template IDs, not enchanted display names',()=>{
 const known=sword({templateIndex:120,name:'%it of Friendship',storedStats:{minDamage:8,maxDamage:21},displayStats:null,perUnitWeightKg:1});completeEquipmentData(known);
 assert.deepEqual(known.displayStats.damage,{min:8,max:21});assert.equal(known.displayStats.perUnitWeightKg,1);assert.equal(known.template.weaponSkillUsed,'LongBlade');
 const authoritative=sword({templateIndex:120,displayStats:{damage:{min:4,max:18},hands:'One-handed',perUnitWeightKg:2}});completeEquipmentData(authoritative);assert.equal(authoritative.displayStats.damage.max,18);
 const unknown=sword({templateIndex:99999,template:{weaponSkillUsed:null},displayStats:null});completeEquipmentData(unknown);assert.equal(unknown.displayStats,null);assert.equal(unknown.template.weaponSkillUsed,null);
});

test('weak Archery does not hide a strong melee recommendation while wearing a bow',()=>{
 const bow=sword({index:0,templateIndex:129,template:{weaponSkillUsed:'Archery'},equipSlot:19,displayStats:{damage:{min:4,max:16},hands:'Two-handed',perUnitWeightKg:1}}),melee=sword({templateIndex:120,index:2,displayStats:{damage:{min:2,max:15},hands:'One-handed',perUnitWeightKg:4.5}}),claymore=sword({index:3,templateIndex:122,displayStats:{damage:{min:2,max:19},hands:'Two-handed',perUnitWeightKg:7.5}}),ctx=context({skills:context().skills.map(s=>({...s,display:s.name==='Archery'?6:s.name==='Long Blade'?51:s.display,effective:s.name==='Archery'?6:s.name==='Long Blade'?51:s.effective}))}),all=[bow,melee,claymore];
 for(const next of [melee,claymore]){
  const c=createComparisonSession(all,ctx).compare(next,19);assert.equal(c.requiresChoice,true);assert.equal(c.kind,'upgrade');assert.equal(comparisonIndicator(c).kind,'upgrade');assert(c.rank>0);assert.deepEqual(c.swap.removed.map(i=>i.slot),[19]);
 }
 assert.equal(createComparisonSession(all,ctx).forSlot(19).length,2);
});

test('an unrelated forbidden bow cannot alter melee score, certainty or recommendation order',()=>{
 const fixed=(index,templateIndex,skill,damage,weight,both=false,equipSlot=null)=>sword({index,templateIndex,template:{weaponSkillUsed:skill},equipSlot,displayStats:{damage:{min:damage,max:damage},hands:both?'Two-handed':'One-handed',perUnitWeightKg:weight}});
 const old=fixed(0,120,'LongBlade',8,3,false,19),dagger=fixed(1,113,'ShortBlade',10,.5),claymore=fixed(2,122,'LongBlade',11,20,true),forbiddenBow=fixed(3,129,'Archery',4,1,true),ctx=context({careerFlags:1<<5,attributes:{...context().attributes,strength:50},skills:context().skills.map(s=>({...s,display:50,effective:50,permanent:50}))});
 const before=createComparisonSession([old,dagger,claymore],ctx),after=createComparisonSession([old,dagger,claymore,forbiddenBow],ctx);
 assert.equal(after.compare(forbiddenBow).kind,'blocked');
 for(const candidate of [dagger,claymore]){const a=before.compare(candidate,19),b=after.compare(candidate,19);assert.equal(a.rank,b.rank);assert.equal(a.kind,b.kind);assert.equal(a.buildScore.weaponComparisonBasis,b.buildScore.weaponComparisonBasis);assert.equal(compareEquipment(candidate,[old,dagger,claymore],ctx,19).rank,compareEquipment(candidate,[old,dagger,claymore,forbiddenBow],ctx,19).rank);}
 assert.deepEqual(before.forSlot(19).map(x=>x.item.index),after.forSlot(19).map(x=>x.item.index));
});

test('incoming hit and damage explanations include the complete stat and skill swap',()=>{
 const old=sword({index:0,templateIndex:120,equipSlot:19,affixes:[{id:'stat',param:'strength',value:10},{id:'skill',param:29,value:8}]}),next=sword({index:1,templateIndex:120,affixes:[{id:'stat',param:'strength',value:3},{id:'skill',param:29,value:2}]}),ctx=context(),after=contextAfterSwap(ctx,[old],[next]),beforeScore=weaponScore(old,ctx),afterScore=weaponScore(next,after),c=compareEquipment(next,[old,next],ctx,19),expected=afterScore.perSwing-beforeScore.perSwing;
 assert(Math.abs(c.score.delta-expected)<1e-9);assert.notEqual(afterScore.hitChance,weaponScore(next,ctx).hitChance);assert.notEqual(afterScore.expectedDamage,weaponScore(next,ctx).expectedDamage);
 assert(c.notes.some(n=>n.includes('Hit chance '+Math.round(beforeScore.hitChance*100)+'% → '+Math.round(afterScore.hitChance*100)+'%')));assert(c.notes.some(n=>n.includes('average hit '+beforeScore.expectedDamage.toFixed(1)+' → '+afterScore.expectedDamage.toFixed(1))));
});

test('positive provisional slot suggestions stay amber and separate from confirmed upgrades',()=>{
 const old=sword({index:0,templateIndex:120,equipSlot:19,displayStats:{damage:{min:1,max:2},hands:'One-handed',perUnitWeightKg:3}}),confirmed=sword({index:1,templateIndex:120,displayStats:{damage:{min:3,max:4},hands:'One-handed',perUnitWeightKg:3}}),partial=sword({index:2,templateIndex:120,identified:false,magicKnown:false,enchantmentCount:null,displayStats:{damage:{min:10,max:15},hands:'One-handed',perUnitWeightKg:3}}),negative=sword({index:3,templateIndex:120,identified:false,magicKnown:false,enchantmentCount:null,displayStats:{damage:{min:0,max:0},hands:'One-handed',perUnitWeightKg:3}}),session=createComparisonSession([old,confirmed,partial,negative],context());
 assert.deepEqual(session.forSlot(19).map(x=>x.item.index),[1]);
 assert.deepEqual(session.suggestionsForSlot(19).map(x=>x.item.index),[1,2]);
 const estimate=session.suggestionsForSlot(19)[1].comparison;assert.equal(estimate.kind,'unknown');assert.equal(estimate.provisional,true);assert.equal(comparisonIndicator(estimate).kind,'provisional');assert.equal(comparisonIndicator(estimate).symbol,'↑');assert.equal(bestInPack([{item:partial,comparison:estimate}]).size,0);
});

test('missing unidentified effect arrays are not misreported as a snapshot overflow',()=>{
 const projected=projectDetails({inventory:{available:true,items:[{group:'Weapons',templateIndex:120,material:1,identified:false,affixes:null,enchantments:null,customEnchantments:null}]}},null).items[0];
 assert.equal(projected.effectsComplete,null);assert.equal(projected.magicKnown,false);assert.deepEqual(projected.affixes,[]);
 const c=compareEquipment(projected,[oldSword,projected],context());assert.notEqual(c.kind,'upgrade');assert(!c.unknowns.some(s=>s.includes('coverage limit')));assert(c.unknowns.some(s=>s.includes('Unidentified')));
});

test('unidentified weapons show amber known-stat direction using the actual character skills',()=>{
 const old=sword({index:0,templateIndex:120,equipSlot:19}),next=sword({index:1,templateIndex:115,template:{weaponSkillUsed:'BluntWeapon'},identified:false,magicKnown:false,enchantmentCount:null,displayStats:{damage:{min:20,max:35},hands:'Two-handed',perUnitWeightKg:3}});
 const build=(long,blunt)=>context({skills:context().skills.map(s=>({...s,display:s.name==='Long Blade'?long:s.name==='Blunt Weapon'?blunt:s.display,effective:s.name==='Long Blade'?long:s.name==='Blunt Weapon'?blunt:s.effective,permanent:s.name==='Long Blade'?long:s.name==='Blunt Weapon'?blunt:s.permanent}))});
 for(const [ctx,direction] of [[build(80,5),'↓'],[build(5,80),'↑']]){
  const c=compareEquipment(next,[old,next],ctx),badge=comparisonIndicator(c);
  assert.equal(c.kind,'unknown');assert.equal(c.provisional,true);assert.equal(badge.kind,'provisional');assert.equal(badge.symbol,direction);assert.match(c.reason,/Known stats only/);assert.match(c.reason,/hidden bonuses/);
  assert.equal(bestInPack([{item:next,comparison:c}]).size,0);assert.equal(createComparisonSession([old,next],ctx).forSlot(19).length,0);
 }
 // Missing compatibility, numerical stats, or supported-effect coverage still
 // require a real question mark, rather than manufacturing a partial score.
 for(const [candidate,ctx] of [[{...next,displayStats:null},build(80,5)],[next,{...build(80,5),restrictionEvidenceKnown:false}],[{...next,special:true},build(80,5)]])assert.equal(comparisonIndicator(compareEquipment(candidate,[old,candidate],ctx)).kind,'unknown');
});

test('automatic slot choice prefers usable provisional evidence over an unsupported swap',()=>{
 const old=sword({index:0,templateIndex:120,equipSlot:19,displayStats:{damage:{min:40,max:60},hands:'One-handed',perUnitWeightKg:3}}),shield=item({index:2,name:'Special shield',group:'Armor',templateIndex:110,equipSlot:21,special:true,displayStats:{baseArmour:2}}),next=sword({index:3,templateIndex:120,identified:false,magicKnown:false,enchantmentCount:null,displayStats:{damage:{min:1,max:2},hands:'One-handed',perUnitWeightKg:1}}),all=[old,shield,next],ctx=context();
 const valid=compareEquipment(next,all,ctx,19),unsupported=compareEquipment(next,all,ctx,21);
 assert.equal(valid.provisional,true);assert.equal(comparisonIndicator(unsupported).kind,'unknown');assert(unsupported.rank>valid.rank);
 for(const c of [compareEquipment(next,all,ctx),createComparisonSession(all,ctx).compare(next)]){assert.equal(c.slot,19);assert.equal(c.provisional,true);assert.equal(comparisonIndicator(c).kind,'provisional');}
});

test('comparison preparation yields, cancels stale work and caches every target',async()=>{
 const rows=Array.from({length:500},(_,i)=>ring(i,i%12)),session=createComparisonSession(rows,context());let time=0,yields=0;
 assert.equal(await prepareComparisons(rows,session,{now:()=>++time,yieldNow:async()=>{yields++;}}),true);assert(yields>100);
 const cached=session.compare(rows[0],4);assert.equal(session.compare(rows[0],4),cached);
 let current=true;assert.equal(await prepareComparisons(rows,session,{now:()=>++time,yieldNow:async()=>{current=false;},isCurrent:()=>current}),false);
});

test('recommendation computation has no transport dependency and preserves snapshot inputs',()=>{
 for(const filename of ['dashboard-items.mjs','upgrade-scoring.mjs']){
  const source=readFileSync(new URL('../'+filename,import.meta.url),'utf8');assert.doesNotMatch(source,/\bfetch\s*\(|Runtime\.callFunctionOn|readOnce\(|from ['"].*(?:transport|reader|cached-module)/);
 }
 const next=ring(1,5),rows=[oldSword,next],ctx=context(),before=JSON.stringify([rows,ctx]);createComparisonSession(rows,ctx).compare(next);assert.equal(JSON.stringify([rows,ctx]),before);
});
