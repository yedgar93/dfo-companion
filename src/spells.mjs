import {readFileSync} from 'node:fs';
const metadata=JSON.parse(readFileSync(new URL('./spell-metadata.json',import.meta.url),'utf8'));
const effects=new Map(metadata.effects.map(e=>[e.type+','+e.subType,e]));
export const effectSchoolName=e=>({22:'Destruction',23:'Restoration',24:'Illusion',25:'Alteration',26:'Thaumaturgy',27:'Mysticism'})[metadata.costs[e.type+','+(e.subType&255)]?.skill??22];
export function describeSpells(player){
 const known=player.spells?.known??[],level=player.identity?.level;
 for(const spell of known){spell.elementName=['Fire','Frost','Poison','Shock','Magicka'][spell.element]??null;spell.rangeName=['Caster only','By touch','Single target at range','Area around caster','Area at range'][spell.rangeType]??null;
  spell.effectDescriptions=(spell.effects??[]).filter(e=>e.type>=0).map(e=>{const m=effects.get(e.type+','+(e.subType&255));return {name:m?.name??null,parameters:m?.uses??[],magnitude:m?.uses.includes('magnitude')?{baseMin:e.magnitudeBaseLow,baseMax:e.magnitudeBaseHigh,levelMin:e.magnitudeLevelBase,levelMax:e.magnitudeLevelHigh,perLevels:e.magnitudePerLevel}:null,duration:m?.uses.includes('duration')?{base:e.durationBase,perLevel:e.durationMod,perLevels:e.durationPerLevel,units:'game rounds'}:null,chance:m?.uses.includes('chance')?{base:e.chanceBase,perLevel:e.chanceMod,perLevels:e.chancePerLevel}:null};});
  let gold=0,points=0,offlinePoints=0,overcap=false,complete=Array.isArray(spell.effects)&&spell.effects.length>0&&Number.isInteger(spell.rangeType)&&spell.rangeType>=0&&spell.rangeType<=4;for(const e of spell.effects??[]){if(e.type<0)continue;if(!Number.isInteger(e.type)||!Number.isInteger(e.subType)){complete=false;continue;}const cost=metadata.costs[e.type+','+(e.subType&255)];if(!cost){complete=false;continue;}const skill=player.skills?.[cost.skill]?.effectiveCasting??player.skills?.[cost.skill]?.display;overcap ||= skill>100;if(!Number.isFinite(skill)){complete=false;continue;}for(const part of ['duration','chance'])if(cost[part]&&['Base','Mod','PerLevel'].some(k=>!Number.isFinite(e[part+k])))complete=false;if(cost.magnitude&&['magnitudeBaseLow','magnitudeBaseHigh','magnitudeLevelBase','magnitudeLevelHigh','magnitudePerLevel'].some(k=>!Number.isFinite(e[k])))complete=false;let total=0,used=false;const part=(c,base,mod,per)=>Math.trunc(c.offset+c.A*(base??0)+c.B*Math.trunc((mod??0)/Math.max(1,per??1)));
   for(const p of ['duration','chance'])if(cost[p]){used=true;total+=part(cost[p],e[p+'Base'],e[p+'Mod'],e[p+'PerLevel']);}
   if(cost.magnitude){used=true;total+=part(cost.magnitude,Math.trunc(((e.magnitudeBaseLow??0)+(e.magnitudeBaseHigh??0))/2),Math.trunc(((e.magnitudeLevelBase??0)+(e.magnitudeLevelHigh??0))/2),e.magnitudePerLevel);}
   if(!used)total+=320;gold+=total;offlinePoints+=Math.trunc(total*(110-skill)/400);points+=Math.trunc(skill>100?total*1000/(skill*400):total*(110-skill)/400);
  }
  const range=[1,1,1.5,2,2.5][spell.rangeType]??1;
  const baselineComplete=(complete&&!spell.path&&!spell.effectsTruncated)||spell.minimumCastingCost===true,modeKnown=!overcap||typeof player.progression?.onlineMode==='boolean',baselinePoints=player.progression?.onlineMode===false?offlinePoints:points;
  spell.castingCost={copiedBaseline:{complete:baselineComplete&&modeKnown,cost:baselineComplete&&modeKnown?(spell.minimumCastingCost?5:Math.max(5,Math.trunc(baselinePoints*range))):null,reason:!baselineComplete?'UNREVIEWED_PATH_OR_EFFECT':!modeKnown?'ONLINE_MODE_UNKNOWN':null,source:'Copied Hp/Rp/Qp baseline and ct skill mastery/mentor/softcap; registered modifiers applied separately under guard'},stored:spell.cost,baseOnlineEstimate:complete?spell.minimumCastingCost?5:Math.max(5,Math.trunc(points*range)):null,currentSource:spell.currentCastingCostSource??null,current:spell.currentCastingCost??(player.spells.readied?.available===true&&spell.index!=null&&player.spells.readied.spell?.index===spell.index&&player.spells.readied.spell?.name===spell.name&&Number.isFinite(player.spells.readied.cost)?player.spells.readied.cost:null),scope:'Current is guarded native or fully reviewed source-derived cost when available; stored/base estimate may differ with class, mastery, item or mod adjustments. Stored zero does not mean a free cast.'};
 }
 const healthSpells=known.filter(s=>s.effects?.some(e=>e.type===10&&e.subType===8)||s.effects?.some(e=>e.type===18));
 player.spells.recoveryOptions={health:healthSpells.map(s=>({index:s.index,name:s.name,cost:s.castingCost,range:s.rangeName})),fatigue:known.filter(s=>s.effects?.some(e=>e.type===10&&e.subType===9)).map(s=>({index:s.index,name:s.name,cost:s.castingCost})),scope:'Known healing/regeneration/fatigue effects only; no spell is selected or cast.'};
 player.spells.metadataSource={source:'Copied effect names and base cost tables from reviewed installed spellEffects/spellcast bundles',hashes:metadata.sourceHashes,level};
}

export function copyCurrentSpellCosts(calculate){
 const items=Object.getOwnPropertyDescriptor(this,'spells')?.value;if(!Array.isArray(items))return [];
 return items.slice(0,256).map(spell=>({index:spell.index,cost:calculate(spell,this).sp}));
}
