import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

// Fixed data-only selection. No NPC generators, quest hooks or update functions.
export function copyLoadedNpcs(people,mode){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const text=v=>typeof v==='string'?v.slice(0,100).replace(/[\u0000-\u001f\u007f]/g,''):null;
 if(!Array.isArray(people))return {available:false,reason:'LOADED_NPC_RECORDS_UNAVAILABLE'};
 const npcs=[];
 for(let index=0;index<Math.min(people.length,512);index++){
  const entry=people[index];let person=own(entry,'person'),pos=own(entry,'pos');
  if(!person){if(mode!=='interior'||own(entry,'active')===false||own(entry,'lamp'))continue;person=entry;pos=[own(entry,'x'),own(entry,'y'),own(entry,'z')];}
  if(!pos||pos.length<3||![pos[0],pos[1],pos[2]].every(Number.isFinite))continue;
  const name=text(own(person,'nameNPC'))||text(own(person,'displayName'))||text(own(person,'name'))||text(own(own(person,'living'),'name'))||text(own(own(own(person,'living'),'res'),'name'));
  npcs.push({sourceSlot:index,name,nameKnown:!!name,position:{x:pos[0],y:pos[1],z:pos[2],frame:mode==='exterior'?'floating-origin exterior local':'current interior/dungeon local',units:'game metres'},rendered:!!own(entry,'person')||!!own(entry,'standBatch')||!!own(entry,'standDraw')});
 }
 return {available:true,complete:false,npcs,truncated:people.length>512,scope:'Active NPC records loaded for the current scene, including outside the camera view. Positions are current at capture time only. Does not include unloaded NPCs or generate missing names.'};
}

export class NpcMemory{
 constructor(path){this.path=path;}
 async observe(nav,capturedAt){
  const loaded=nav.scene?.loadedNpcs;
  if(!loaded?.available)return {available:false,reason:loaded?.reason??'CURRENT_NPCS_UNAVAILABLE'};
  let state={version:1,locations:[]};
  try{const raw=await readFile(this.path,'utf8');if(raw.length<1048576){const parsed=JSON.parse(raw);if(parsed.version===1&&Array.isArray(parsed.locations))state=parsed;}}catch{}
  const l=nav.location,place=l?.place??{},key=JSON.stringify([l?.mode,l?.mapPixel,place.regionIndex,place.locationIndex,place.buildingKey,place.buildingName,place.buildingType,place.dungeonName]);
  const record={key,lastObservedAt:capturedAt,place,mode:l?.mode,mapPixel:l?.mapPixel,floatingOrigin:l?.floatingOrigin,npcs:loaded.npcs};
  // Each location keeps its latest complete observation, avoiding false NPC
  // identities when anonymous render-array slots are reused or actors move.
  state.locations=state.locations.filter(v=>v.key!==key).slice(-31);state.locations.push(record);
  while(state.locations.length>1&&JSON.stringify(state).length>900000)state.locations.shift();
  await mkdir(dirname(this.path),{recursive:true});const temp=this.path+'.'+process.pid+'.'+randomUUID()+'.next';await writeFile(temp,JSON.stringify(state));await rename(temp,this.path);
  return {available:true,current:record,lastObservedLocations:state.locations.filter(v=>v.key!==key).map(({key,...v})=>({...v,stale:true,npcs:v.npcs.map(n=>({...n,provenance:{...n.provenance,state:"LASTSEEN",observedAt:v.lastObservedAt,isCurrentObservation:false,refreshBeforeGuidance:true}}))})),scope:'Latest observation for at most 32 locations. Other locations are last-known sightings, never asserted current. Anonymous source slots are not stable NPC identities. No background monitoring.'};
 }
}
