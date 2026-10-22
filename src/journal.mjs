// Reads only notebook entries and messages already entered in the quest log.
// Never enumerates future task/message text or unrelated quest resources.
export function copyKnownJournal(manager){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const clean=v=>typeof v==='string'?v.slice(0,16000):null;
 const rows=tokens=>(Array.isArray(tokens)?tokens:[]).slice(0,1024).map(t=>typeof t==='string'?t:own(t,'text')||(['nothing','center','newline',0].includes(own(t,'formatting'))?'\n':'')).join('');
 const notebook=own(manager,'notebook'),quests=own(own(manager,'machine'),'quests'),active=[];
 if(quests instanceof Map)for(const q of quests.values()){
  if(active.length>=64)break;const logs=own(q,'activeLogMessages'),messages=own(q,'messages'),resources=own(q,'resources');
  if(!(logs instanceof Map)||!logs.size||!(messages instanceof Map)||!(resources instanceof Map))continue;
  const disclosedLocations=[];
  const expand=text=>{let lastActor=null;return text.replace(/(_{1,4})([A-Za-z0-9.]+)_|%[Gg](?:2self|[1-4])?(?![A-Za-z0-9])/g,(match,prefix,name)=>{
   if(!prefix){const gender=own(lastActor,'npcGender')??own(lastActor,'humanoidGender');if(gender!==0&&gender!==1)return match;const female=gender===1,code=match.toLowerCase(),value=code==='%g'||code==='%g1'?(female?'she':'he'):code==='%g2'?(female?'her':'him'):code==='%g2self'?(female?'herself':'himself'):code==='%g3'?(female?'her':'his'):(female?'hers':'his');return match[1]==='G'?value[0].toUpperCase()+value.slice(1):value;}
   const r=resources.get(name),linked=own(r,'assignedPlaceSymbol')??own(r,'homePlaceSymbol'),place=own(r,'siteDetails')?r:linked?resources.get(typeof linked==='string'?linked:own(linked,'name')):null,site=own(place,'siteDetails');
   if(Number.isInteger(own(r,'npcGender'))||Number.isInteger(own(r,'humanoidGender')))lastActor=r;
   const value=prefix.length===1?own(r,'displayName')??own(site,'buildingName'):prefix.length===2?own(r,'displayName')?own(site,'buildingName'):own(site,'locationName'):prefix.length===3?own(site,'locationName'):own(site,'regionName');
   if(typeof value!=='string'||!value)return match;
   if(site){const row={publicActor:own(r,'displayName')??null,buildingName:own(site,'buildingName')??null,locationName:own(site,'locationName')??null,regionName:own(site,'regionName')??null,regionIndex:own(site,'regionIndex')??null,buildingKey:own(site,'buildingKey')??null,mapId:own(site,'mapId')??null};if(!disclosedLocations.some(l=>JSON.stringify(l)===JSON.stringify(row)))disclosedLocations.push(row);}return value;
  }).replaceAll('%pcn',own(this,'name')??'%pcn').replaceAll('%pcf',(own(this,'name')??'%pcf').split(' ')[0]);};
  const entries=[];for(const log of logs.values()){
   if(entries.length>=32)break;const m=messages.get(own(log,'messageID')),variants=own(m,'variants');
   if(Array.isArray(variants)){const text=variants.slice(0,8).map(v=>expand(rows(own(v,'tokens'))).slice(0,16000)),unresolvedMacros=[...new Set(text.flatMap(v=>v.match(/%[A-Za-z][A-Za-z0-9]*|_{1,4}[A-Za-z0-9.]+_/g)??[]))];entries.push({recordedAtGameSeconds:own(log,'time')??null,variants:text,displayVariants:text.map(v=>v.replace(/^(On )?%q(?:dt|dat)[:,]?\s*/,'Recorded entry: ')),resolved:unresolvedMacros.length===0,unresolvedMacros});}
  }
  active.push({id:String(own(q,'uid')??''),name:clean(own(q,'displayName'))??clean(own(q,'questName')),complete:own(q,'questComplete')===true,success:own(q,'questSuccess')===true,entries,disclosedLocations});
 }
 const copyList=key=>(own(notebook,key)??[]).slice(0,128).map(tokens=>clean(rows(tokens)));
 const truncated=(quests instanceof Map&&quests.size>64)||active.some(q=>q.entries.length>=32)||['notes','finishedQuests'].some(k=>Array.isArray(own(notebook,k))&&own(notebook,k).length>128);
 return {available:!!notebook||quests instanceof Map,truncated,active,notes:copyList('notes'),finished:copyList('finishedQuests'),scope:'Recorded quest-log messages, notebook and completed journal entries only. Locations come only from macros in those messages; no hidden objectives or future quest scripts.'};
}

// Same public clock eligibility predicate used by the reviewed quest-log UI.
// Called under V8 guard; no questLog/getMessage/localize or clock tick calls.
export function copyKnownDeadlines(knownNames,player){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const machine=own(this,'machine'),quests=own(machine,'quests'),items=own(player,'items')??[],out=[];
 if(!(quests instanceof Map))return out;
 for(const q of quests.values()){
  const name=own(q,'displayName')||own(q,'questName'),letterIndices=[];
  for(let i=0;i<Math.min(items.length,500);i++){const item=items[i];if(own(item,'group')==='UselessItems2'&&own(item,'templateIndex')===279&&own(item,'questItem')&&own(item,'questUID')===own(q,'uid'))letterIndices.push(i);}
  if(!knownNames.includes(name)&&!letterIndices.length)continue;
  const resources=own(q,'resources'),tasks=own(q,'tasks');if(!(resources instanceof Map)||!(tasks instanceof Map))continue;
  const eligible=clock=>{const n=own(own(clock,'symbol'),'name'),task=tasks.get(n);if(!task)return false;const actions=own(task,'actions')??[];if(actions.some(a=>!own(a,'isTriggerCondition'))||(own(task,'pendingActionLines')??[]).length)return true;
   for(const t of tasks.values()){if(own(own(t,'targetSymbol'),'name')===n)return true;for(const a of own(t,'actions')??[])if((own(a,'evaluations')??[]).some(e=>String(own(e,'task')??'').replace(/^_+|_+$/g,'')===n))return true;}return false;};
  const clocks=[];let classificationIncomplete=false;
  for(const clock of resources.values()){
   if(!own(clock,'clockEnabled')||own(clock,'clockFinished')||!Number.isFinite(own(clock,'remainingTimeInSeconds')))continue;
   const deadline=own(clock,'_deadline');if(deadline==null){classificationIncomplete=true;continue;}
   if(!deadline||(own(clock,'_closesOnSuccess')&&own(q,'questSuccess')&&!own(clock,'startedAfterSuccess'))||!eligible(clock))continue;
   const seconds=Math.max(0,own(clock,'remainingTimeInSeconds'));clocks.push({name:own(own(clock,'symbol'),'name')??'',remainingSeconds:seconds,remainingGameDays:seconds/86400,role:'DISPLAYED_QUEST_COUNTDOWN',failureConfirmed:false,consequence:'UNVERIFIED',classificationBasis:'Cached game UI countdown classification, including explicit reminder whitelists; not proof of quest failure at expiry.'});
  }
  out.push({name,letterIndices,clocks:clocks.slice(0,32),classificationIncomplete});
 }
 return out;
}
