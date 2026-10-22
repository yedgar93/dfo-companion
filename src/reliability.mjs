export function actionableError(reason){
 const messages={
  ATTACH_DISABLED:'Enable DFO_OBSERVER_ALLOW_ATTACH=1 for this reader process, or use Invoke-Companion.ps1 / Read Companion.command.',
  CACHED_MODULE_OPT_IN_REQUIRED:'Enable DFO_OBSERVER_CACHED_MODULE=1 for the reviewed reader.',
  DEBUG_ENDPOINT_UNAVAILABLE:'The local connection is unavailable. Keep the current game intact; save and exit when convenient, then launch DFO with Companion.',
  GAME_TARGET_UNAVAILABLE:'DFO has not reached its game page. Finish normal loading/login, then retry the same read.',
  AMBIGUOUS_GAME_TARGET:'More than one game page was found. Close an unintended duplicate when convenient; no game was selected.',
  INSPECTION_DISCONNECTED:'The game page changed or the connection closed. Retry the same read after loading finishes.',
  PAGE_CHANGED:'The game page changed during the observation. Retry the same read.',
  SCENE_COVERED_BY_GAME_UI:'The open game interface covers the scene. Visible UI text may still be available; close the interface normally to read the scene.',
  NO_CURRENT_DISCOVERED_DUNGEON_MAP:'There is no current discovered dungeon map in this location.',
  TOWN_BEARINGS_REQUIRE_EXTERIOR:'This is expected indoors: the town shop-bearing reader needs an exterior position. If the user wants town directions, read it again after they go outside within town.',
  INTERIOR_LANDMARKS_REQUIRE_INTERIOR:'This is expected outside an interior: use the public exterior shop entrances and bearings in this location.',
  NO_VALIDATED_WALKABILITY_GRAPH:'Only landmarks and bearings are available. Do not give turn-by-turn directions or assert a reachable route.'
 };
 if(messages[reason])return messages[reason];
 if(/SOURCE_NOT_REVIEWED|UNREVIEWED|PROOF|UNSUPPORTED_INSTALLED_VERSION|NO_REVIEWED_EXECUTED_HOST/.test(reason??''))return 'This game build or source fingerprint has not passed review. Keep the game intact and update/review the companion compatibility manifest before reconnecting; do not bypass its checks.';
 if(/SIDE_EFFECT_GUARD/.test(reason??''))return 'The guarded read was refused. This field is unknown; use a displayed UI value when available and keep the guard enabled.';
 return 'This section is unavailable. Retry a fresh snapshot; if it persists, use its reason code to review the adapter. No stale current value is substituted.';
}

export function stampActors(nav,startedAt,completedAt){
 if(nav.visibleText?.sceneCovered&&nav.scene){nav.scene={available:false,reason:'SCENE_COVERED_BY_GAME_UI',loadedNpcs:nav.scene.loadedNpcs,loadedQuestTargets:nav.scene.loadedQuestTargets,dungeonActions:nav.scene.dungeonActions,diagnostics:nav.scene.diagnostics,entities:[],aimedAt:null};}
 const window={startedAt,completedAt};
 const evidence=(state,source)=>({state,observedAt:completedAt,observationWindow:window,source,isCurrentObservation:state!=='LASTSEEN'&&state!=='UNKNOWN',refreshBeforeGuidance:true});
 for(const e of nav.scene?.entities??[])e.provenance=evidence('CURRENTVISIBLE','Current public render membership plus geometric visibility estimate');
 for(const e of nav.scene?.loadedNpcs?.npcs??[]){
  const visible=nav.scene?.entities?.find(v=>v.kind==='npc'&&Math.hypot((v.position?.x??Infinity)-e.position.x,(v.position?.y??Infinity)-e.position.y,(v.position?.z??Infinity)-e.position.z)<.05);
  e.provenance=evidence(visible?'CURRENTVISIBLE':'NEARBY','Current loaded scene NPC data; NEARBY does not establish line of sight or reachability');
  const p=nav.location?.position;if(p){const dx=e.position.x-p.x,dy=e.position.y-p.y,dz=e.position.z-p.z,bearing=((Math.atan2(dx,dz)*180/Math.PI)%360+360)%360,yaw=nav.location.orientation?.headingDegrees;e.relative={distanceMetres:Math.hypot(dx,dy,dz),verticalOffsetMetres:dy,heightRelation:dy>1.2?'ABOVE':dy< -1.2?'BELOW':'SAME_HEIGHT_BAND',bearingDegrees:bearing,relativeTurnDegrees:Number.isFinite(yaw)?((bearing-yaw+540)%360)-180:null,reachability:'UNKNOWN'};}
 }
 if(nav.scene)nav.scene.unknownCoverage={state:'UNKNOWN',reason:'Unloaded NPCs, unsupported actor sources and visibility failures are not established by this observation.'};
 return nav;
}

export function snapshotSections(owner,context){
 const sections={};
 const add=(key,path,data,observation)=>{const available=!!data&&data.available!==false;sections[key]={available,path,observationWindow:{startedAt:observation?.capturedAt??null,completedAt:observation?.completedAt??null},coverage:'partial',...!available?{reason:data?.reason??observation?.reason??'SECTION_UNAVAILABLE',action:actionableError(data?.reason??observation?.reason)}:{}};};
 for(const [key,field]of [['character','characterSheet'],['inventory','inventory'],['spells','spells'],['quests','journal'],['vitals','vitals'],['effects','activeEffects'],['guidance','guidance']])add(key,'player.'+field,owner.player?.[field],owner);
 for(const [key,field]of [['scene','scene'],['navigation','location'],['landmarks','navigation'],['map','discoveredMap'],['shops','shops'],['ui','visibleText']])add(key,'context.'+field,context?.[field],context);
 return {sections,allSectionsAvailable:Object.values(sections).every(v=>v.available),unavailableSections:Object.entries(sections).filter(([,v])=>!v.available).map(([k])=>k),atomic:false,scope:'Section windows describe when each sequential read ran. Availability does not mean complete world or field coverage. Refresh before time-sensitive guidance.'};
}
