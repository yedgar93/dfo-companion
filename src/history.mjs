import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function summarizeOwner(player){
 const items={};for(const [location,list]of [['pack',player.inventory?.items],['wagon',player.inventory?.storage?.wagon?.items],['bag',player.inventory?.storage?.bag?.items]])for(const i of list??[]){const key=digest([location,i.name,i.group,i.templateIndex,i.material,i.affixes]);const row=items[key]??={name:i.name,location,count:0,equipped:[],conditionCurrent:0,conditionMax:0};row.count+=i.count??1;if(i.equipSlot!==null)row.equipped.push(i.equipSlot);row.conditionCurrent+=i.condition?.current??0;row.conditionMax+=i.condition?.max??0;}
 const effects={};for(const e of player.activeEffects??[]){const key=digest([e.kind,e.name,e.stat,e.statMods]);effects[key]={kind:e.kind,name:e.name,stat:e.stat,magnitude:e.magnitude,roundsRemaining:e.roundsRemaining};}
 const inventory=player.inventory;const coverage={items:Object.fromEntries([['pack',inventory],['wagon',inventory?.storage?.wagon],['bag',inventory?.storage?.bag]].map(([k,v])=>[k,!!v&&v.available!==false&&!v.truncated&&Array.isArray(v.items)])),spells:!!player.spells&&!player.spells.truncated&&Array.isArray(player.spells.known),effects:Array.isArray(player.activeEffects)&&!player.activeEffectsTruncated,quests:!!player.journal&&player.journal.available!==false&&!player.journal.truncated};
 return {coverage,vitals:Object.fromEntries(Object.entries(player.vitals??{}).map(([k,v])=>[k,v.current])),items,effects,level:player.identity?.level??null,levelProgress:player.progression?.levelProgress??null,spells:(player.spells?.known??[]).map(s=>({index:s.index,name:s.name})),quests:(player.journal?.active??[]).map(q=>({name:q.name,complete:q.complete,entryCount:q.entries?.length??0,progressDigest:digest(q.entries??[])})),finished:player.journal?.finished??[]};
}
export function ownerDifferences(before,after){
 const changes=[];
 for(const [key,v]of Object.entries(after.vitals))if(before.vitals?.[key]!==v)changes.push({kind:'vital',field:key,before:before.vitals?.[key]??null,after:v});
 const keys=new Set([...Object.keys(before.items??{}),...Object.keys(after.items)]);
 for(const key of keys){const a=before.items?.[key],b=after.items[key],location=b?.location??a?.location??'pack';if(before.coverage?.items?.[location]===false||after.coverage?.items?.[location]===false)continue;const delta=(b?.count??0)-(a?.count??0);if(delta)changes.push({kind:'inventoryCount',location,name:b?.name??a.name,before:a?.count??0,after:b?.count??0,delta});if(a&&b&&JSON.stringify(a.equipped)!==JSON.stringify(b.equipped))changes.push({kind:'equipment',location,name:b.name,beforeSlots:a.equipped,afterSlots:b.equipped});if(a&&b&&a.conditionCurrent!==b.conditionCurrent)changes.push({kind:'condition',location,name:b.name,before:a.conditionCurrent,after:b.conditionCurrent,beforeMax:a.conditionMax,afterMax:b.conditionMax});}
 if(before.coverage?.spells!==false&&after.coverage?.spells!==false){const spellKey=s=>s.index+'|'+s.name,oldSpells=new Set((before.spells??[]).map(spellKey)),newSpells=new Set(after.spells.map(spellKey));for(const s of after.spells)if(!oldSpells.has(spellKey(s)))changes.push({kind:'spellAdded',name:s.name});for(const s of before.spells??[])if(!newSpells.has(spellKey(s)))changes.push({kind:'spellRemoved',name:s.name});
 }
 if(before.coverage?.quests!==false&&after.coverage?.quests!==false){const oldQuests=new Map((before.quests??[]).map(q=>[q.name,q]));for(const q of after.quests){const old=oldQuests.get(q.name);if(!old)changes.push({kind:'recordedQuestAdded',name:q.name});else {if(!old.complete&&q.complete)changes.push({kind:'recordedQuestCompleted',name:q.name});if(old.progressDigest&&q.progressDigest&&old.progressDigest!==q.progressDigest)changes.push({kind:'recordedQuestProgressChanged',name:q.name,beforeEntryCount:old.entryCount,afterEntryCount:q.entryCount});}}
 }
 if(before.coverage?.effects!==false&&after.coverage?.effects!==false){for(const [key,e]of Object.entries(after.effects??{})){const old=before.effects?.[key];if(!old)changes.push({kind:'effectObserved',name:e.name,effectKind:e.kind});else if(Number.isFinite(e.roundsRemaining)&&Number.isFinite(old.roundsRemaining)&&e.roundsRemaining!==old.roundsRemaining)changes.push({kind:'effectDurationChanged',name:e.name,effectKind:e.kind,beforeRounds:old.roundsRemaining,afterRounds:e.roundsRemaining,expiringSoon:e.roundsRemaining<=2});}
 for(const [key,e]of Object.entries(before.effects??{}))if(!after.effects?.[key])changes.push({kind:'effectNoLongerObserved',name:e.name,effectKind:e.kind});
 }
 for(const key of ['level','levelProgress'])if(before[key]!=null&&after[key]!=null&&before[key]!==after[key])changes.push({kind:'progressionChanged',field:key,before:before[key],after:after[key]});
 if(before.coverage?.quests!==false&&after.coverage?.quests!==false){const oldFinished=new Set(before.finished??[]);for(const text of after.finished)if(!oldFinished.has(text))changes.push({kind:'finishedJournalAdded',text:text.slice(0,2000)});
 }
 return changes.slice(0,100);
}
export class LocalHistory{
 constructor(path){this.path=path;}
 async observe(player,capturedAt){
  let previous=null;try{const raw=await readFile(this.path,'utf8');if(raw.length<=1000000){const parsed=JSON.parse(raw);if(parsed.version===3)previous=parsed;}}catch{}
  const ownerKey=JSON.stringify([player.identity?.name,player.identity?.race,player.identity?.className]);if(previous?.ownerKey!==ownerKey)previous=null;
  const current=summarizeOwner(player),records=(previous?.records??[]).slice(-30),changes=previous?ownerDifferences(previous.current,current):[];
  if(changes.length)records.push({from:previous.capturedAt,to:capturedAt,changes});
  const bounded=records.slice(-30),state={version:3,ownerKey,capturedAt,current,records:bounded};while(bounded.length&&JSON.stringify(state).length>900000)bounded.shift();if(JSON.stringify(state).length>900000)return {available:false,reason:'HISTORY_BASELINE_TOO_LARGE'};await mkdir(dirname(this.path),{recursive:true});const temp=this.path+'.'+process.pid+'.'+randomUUID()+'.next';await writeFile(temp,JSON.stringify(state));await rename(temp,this.path);
  return {available:true,records:bounded,baseline:!previous,coverage:current.coverage,scope:'Unavailable or truncated sections are not compared. At most 30 bounded differences between on-demand observations, saved locally. Count/name changes do not establish an exact pickup, sale, loss cause or attacker.'};
 }
}
