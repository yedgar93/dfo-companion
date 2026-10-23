// Mirrors the reviewed quest tracker’s existing actor-reference selection,
// restricted to names already disclosed by the currently visible objective.
export function copyKnownLoadedQuestTargets(names,position,yaw){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const norm=s=>typeof s==='string'?s.trim().toLowerCase():'';
 const ctx=this.dungeonCtx,foes=own(ctx,'foes');
 if(!Array.isArray(foes))return {available:false,reason:'CURRENT_DUNGEON_FOE_ARRAY_UNAVAILABLE',descriptor:ctx&&Object.getOwnPropertyDescriptor(ctx,'foes')?.get?'getter':'absent'};
 if(!names?.length)return {available:false,reason:'NO_NAMED_TARGET_DISCLOSED_IN_VISIBLE_OBJECTIVE'};
 const matches=[],coverage={loadedActorRecords:foes.length,activeActorRecords:0,questBehaviours:0,targetResourceDataReferences:0,namedResourceReferences:0,targetResourceAccessors:0,behaviourFields:[]};
 for(const actor of foes.slice(0,512)){
  if(own(actor,'dead'))continue;coverage.activeActorRecords++;const behaviour=own(actor,'questBehaviour'),resource=own(behaviour,'targetResource'),entity=own(actor,'entity'),mobile=own(actor,'mobile');let name=own(resource,'displayName'),identitySource='QUEST_RESOURCE_REFERENCE';
  if(behaviour){coverage.questBehaviours++;if(!coverage.behaviourFields.length)coverage.behaviourFields=Object.getOwnPropertyNames(behaviour).filter(k=>/quest|target|resource/i.test(k)).slice(0,16);if(resource)coverage.targetResourceDataReferences++;if(typeof name==='string'&&name)coverage.namedResourceReferences++;const proto=Object.getPrototypeOf(behaviour);if(Object.getOwnPropertyDescriptor(behaviour,'targetResource')?.get||proto&&Object.getOwnPropertyDescriptor(proto,'targetResource')?.get)coverage.targetResourceAccessors++;}
  if(!names.some(n=>norm(n)===norm(name))){name=[own(actor,'name'),own(actor,'displayName'),own(entity,'name'),own(entity,'displayName'),own(own(mobile,'basics'),'name')].find(v=>names.some(n=>norm(n)===norm(v)));identitySource='PUBLIC_ACTOR_NAME_ONLY';}
  if(!name||own(resource,'isHidden')===true)continue;
  const quest=own(behaviour,'targetQuest')??own(resource,'parentQuest');if(own(quest,'questComplete')===true||own(quest,'questTombstoned')===true||own(quest,'shelvedAt')!=null)continue;
  const effects=own(own(actor,'entity'),'activeEffects');if(Array.isArray(effects)&&effects.some(e=>['invisNormal','invisTrue','chameleonNormal','chameleonTrue','shadeNormal','shadeTrue'].includes(own(e,'kind'))))continue;
  const feet=own(own(actor,'ai'),'feet');if(!feet||![feet[0],feet[1],feet[2]].every(Number.isFinite))continue;
  const dx=feet[0]-position.x,dy=feet[1]-position.y,dz=feet[2]-position.z,bearing=(Math.atan2(dx,dz)*180/Math.PI+360)%360,heading=(yaw*180/Math.PI%360+360)%360;
  matches.push({name,identitySource,questReferenceVerified:identitySource==='QUEST_RESOURCE_REFERENCE',position:{x:feet[0],y:feet[1],z:feet[2],frame:'current dungeon local',units:'game metres'},distanceMetres:Math.hypot(dx,dy,dz),horizontalDistanceMetres:Math.hypot(dx,dz),verticalOffsetMetres:dy,bearingDegrees:bearing,relativeTurnDegrees:(bearing-heading+540)%360-180,state:'NEARBY',visibility:'NOT_ESTABLISHED',reachability:'UNKNOWN',source:identitySource==='QUEST_RESOURCE_REFERENCE'?'Loaded actor directly references the quest resource disclosed on the HUD':'Loaded public actor name exactly matches the name disclosed on the HUD; no quest-reference confirmation'});
 }
 matches.sort((a,b)=>a.distanceMetres-b.distanceMetres);
 return {available:true,result:matches.length?'MATCHED_LOADED_TARGET':coverage.questBehaviours===0?'LOADED_ACTOR_IDENTITIES_UNAVAILABLE':'NO_NAMED_MATCH_IN_SUPPORTED_LOADED_ACTORS',matches,disclosedNames:names,coverage,canConcludeTargetAbsent:false,truncated:foes.length>512,scope:'Only matching already-disclosed quest target names in the current loaded dungeon actors. No unspawned quest resources, hidden actors or route inference.'};
}
