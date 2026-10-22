// Read only the active target's resource, placement and loaded actor association.
export function copyCurrentQuestAssociation(names,position,yaw,manager){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;},norm=s=>typeof s==='string'?s.trim().toLowerCase():'';
 const ctx=this.dungeonCtx,foes=own(ctx,'foes')??[],machine=own(manager,'machine'),quests=own(machine,'quests'),out=[];
 if(!(quests instanceof Map))return {available:false,reason:'QUEST_MACHINE_MAP_UNAVAILABLE'};
 for(const q of quests.values()){
  if(own(q,'questComplete')||own(q,'questTombstoned')||own(q,'shelvedAt')!=null)continue;
  const resources=own(q,'resources');if(!(resources instanceof Map))continue;
  for(const r of resources.values()){
   const name=own(r,'displayName');if(!names.some(n=>norm(n)===norm(name)))continue;
   const sym=own(own(r,'symbol'),'name'),questName=own(q,'questName'),uid=own(q,'uid'),actors=[];
   for(const a of foes){const b=own(a,'questBehaviour'),pup=own(a,'_pupQuest'),ent=own(a,'entity');
    const direct=own(b,'targetResource')===r,tag=!!pup&&own(pup,'q')===questName&&own(pup,'s')===sym;
    const itemUid=own(ent,'questUID')===uid&&own(ent,'questResourceSymbol')===sym;
    if(!direct&&!tag&&!itemUid)continue;
    const feet=own(own(a,'ai'),'feet')??own(own(a,'batch'),'origin');if(!feet||![feet[0],feet[1],feet[2]].every(Number.isFinite))continue;
    const dx=feet[0]-position.x,dy=feet[1]-position.y,dz=feet[2]-position.z;
    actors.push({association:direct?'DIRECT_RESOURCE':tag?'SHARED_QUEST_SYMBOL':'ENTITY_QUEST_SYMBOL',dead:!!own(a,'dead'),position:{x:feet[0],y:feet[1],z:feet[2],frame:'current dungeon local'},horizontalDistanceMetres:Math.hypot(dx,dz),verticalOffsetMetres:dy,bearingDegrees:(Math.atan2(dx,dz)*180/Math.PI+360)%360});
   }
   const places=[];
   for(const p of resources.values()){const site=own(p,'siteDetails');if(!site)continue;const markers=[own(site,'selectedMarker'),...(own(site,'questSpawnMarkers')??[])];
    const matched=markers.filter(m=>(own(m,'targetResources')??[]).some(s=>s===own(r,'symbol')||own(s,'name')===sym));
    if(matched.length)places.push({fields:Object.getOwnPropertyNames(site).filter(k=>!/seed|script/i.test(k)),mapId:own(site,'mapId'),locationName:own(site,'locationName'),markers:matched.map(m=>({fields:Object.getOwnPropertyNames(m),dungeonX:own(m,'dungeonX'),dungeonZ:own(m,'dungeonZ'),markerID:own(m,'markerID'),position:own(m,'position'),x:own(m,'x'),y:own(m,'y'),z:own(m,'z')}))});
   }
   const rb=own(r,'_questResourceBehaviour'),people=own(ctx,'people')??[];
   const personRows=people.filter(p=>own(p,'person')===r||own(p,'host')===r||own(p,'behaviour')===rb||own(own(p,'person'),'questBehaviour')===rb||own(p,'questBehaviour')===rb).map(p=>({fields:Object.getOwnPropertyNames(p),position:own(p,'pos')??[own(p,'x'),own(p,'y'),own(p,'z')],active:own(p,'active')}));
   const scalar=o=>o&&typeof o==='object'?Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(o)).filter(([k,d])=>'value'in d&&/quest|target|resource|host|entity|person|symbol|place|uid|position|marker|name/i.test(k)).map(([k,d])=>[k,typeof d.value==='object'?{fields:d.value?Object.getOwnPropertyNames(d.value).slice(0,35):null}:typeof d.value==='function'?'FUNCTION':d.value])):o;
   const related=[];for(const res of resources.values()){const site=own(res,'siteDetails'),beh=own(res,'_questResourceBehaviour');if(own(res,'foeType')!=null||site)related.push({symbol:own(own(res,'symbol'),'name'),displayName:own(res,'displayName'),foeType:own(res,'foeType'),typeName:own(res,'typeName'),assignedPlaceSymbol:scalar(own(res,'assignedPlaceSymbol')),behaviour:scalar(beh),site:site?Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(site)).filter(([k,d])=>'value'in d).map(([k,d])=>[k,d.value&&typeof d.value==='object'?{fields:Object.getOwnPropertyNames(d.value).slice(0,20)}:d.value])):null});}
   out.push({name,questName,symbol:sym,resourceFields:Object.getOwnPropertyNames(r).filter(k=>!/script|task/i.test(k)),isDestroyed:own(r,'isDestroyed'),killCount:own(r,'killCount'),assignedPlaceSymbol:scalar(own(r,'assignedPlaceSymbol')),behaviour:scalar(rb),peopleCount:people.length,personRows,actors,places,resourcePlacement:scalar(own(r,'questorData')),related});
  }
 }
 for(const row of out){const q=[...quests.values()].find(q=>own(q,'questName')===row.questName),rs=own(q,'resources');row.dungeonMarkers=[];row.foeResources=[];for(const res of rs.values()){const site=own(res,'siteDetails');if(site&&own(site,'siteType')===2)row.dungeonMarkers.push({place:own(own(res,'symbol'),'name'),selectedMarker:own(site,'selectedMarker'),spawnMarkers:own(site,'questSpawnMarkers')});if(own(res,'foeType')!=null)row.foeResources.push(Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(res)).filter(([k,d])=>'value'in d&&!/parentQuest|behaviour|message|task|script/i.test(k)&& (d.value==null||typeof d.value!=='object'||k==='symbol')).map(([k,d])=>[k,k==='symbol'?own(d.value,'name'):d.value])));}}
 return {available:true,targets:out,ctxFields:Object.getOwnPropertyNames(ctx),coverage:{questCount:quests.size,loadedActors:foes.length,puppetTags:foes.filter(a=>!!own(a,'_pupQuest')).length,behaviours:foes.filter(a=>!!own(a,'questBehaviour')).length},scope:'Current named quest target only; current resource placement and loaded actor association. No task or future script reads.'};
}
