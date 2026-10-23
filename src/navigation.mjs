// Fixed own-location binding reader. Called only on the inspected closure of the
// source/hash-verified running world host, never a game object or global scope.
// No binding enumeration, game calls, getters, hidden entities, or map reveal.
export function readNavigationScope() {
 const own=(o,k)=>{if(!o||typeof o!=='object')return undefined;const d=Object.getOwnPropertyDescriptor(o,k);return d&&'value'in d?d.value:undefined;};
 const n=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const s=v=>typeof v==='string'?v.slice(0,120).replace(/[\u0000-\u001f\u007f]/g,''):null;
 const vec=v=>(Array.isArray(v)||ArrayBuffer.isView(v))&&v.length>=3?[n(own(v,'0')),n(own(v,'1')),n(own(v,'2'))]:null;
 // The receiver is a V8 synthetic scope wrapper, not a game object. Access only
 // these five reviewed lexical bindings; V8's side-effect guard covers reads.
 const motor=this.W,camera=this.U,world=this.H,modes=this.$,place=this.gb;
 const position=vec(own(motor,'pos'));
 if(!position||position.some(v=>v===null))return {available:false,reason:'OWN_POSITION_BINDINGS_UNAVAILABLE',bindingTypes:{W:typeof motor,U:typeof camera,H:typeof world,$:typeof modes,gb:typeof place}};
 // These three world-modes getters are source-reviewed single field returns,
 // checked against the loaded arenaGate bundle before this guarded function.
 const mode=s(modes?.mode)??'unknown';
 const yaw=n(own(camera,'yaw')),pitch=n(own(camera,'pitch'));
 const degrees=yaw===null?null:((yaw*180/Math.PI)%360+360)%360;
 const names=['north','northeast','east','southeast','south','southwest','west','northwest'];
 const current=own(world,'current'),origin=own(world,'mapOrigin');
 const dungeon=modes?.dungeonCtx,building=modes?.interiorBuilding;
 return {
  available:true,mode,position:{x:position[0],y:position[1],z:position[2],frame:mode==='exterior'?'floating-origin exterior local':'current interior/dungeon local',units:'game metres'},
  orientation:{yawRadians:yaw,pitchRadians:pitch,headingDegrees:degrees,heading:degrees===null?null:names[Math.round(degrees/45)%8],convention:'0 north (+Z), 90 east (+X); Y up'},
  mapPixel:{x:n(own(current,'x')),y:n(own(current,'y'))},
  floatingOrigin:{mapPixelX:n(own(origin,'x')),mapPixelY:n(own(origin,'y')),compensation:vec(own(world,'compensation'))},
  nativeWorld:mode==='exterior'&&n(own(origin,'x'))!==null&&n(own(origin,'y'))!==null&&vec(own(world,'compensation'))?{x:own(origin,'x')*32768+(position[0]-own(world,'compensation')[0])*40,z:(499-own(origin,'y'))*32768+(position[2]-own(world,'compensation')[2])*40,units:'classic world units (40 per game metre)',frame:'stable exterior native world'}:null,
  place:{name:s(own(place,'name')),regionName:s(own(place,'regionName')),regionIndex:n(own(place,'regionIndex')),locationIndex:n(own(place,'locationIndex')),dungeonName:s(own(dungeon,'name')),buildingName:s(own(building,'name')),buildingType:n(own(building,'buildingType')),buildingKey:n(own(building,'buildingKey'))},
  limitations:['Local coordinates are not a route through a dungeon.','No undiscovered geometry, hidden entities, or exits were read.']
 };
}

// A read-only accessor in the reviewed shared module returns the current record.
// This function receives that record only; no gameplay API is invoked here.
export function copyDiscoveredMap(record) {
 const own=(o,k)=>{if(!o||typeof o!=='object')return undefined;const d=Object.getOwnPropertyDescriptor(o,k);return d&&'value'in d?d.value:undefined;};
 const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const text=v=>typeof v==='string'?v.slice(0,120).replace(/[\u0000-\u001f\u007f]/g,''):null;
 const vec=v=>Array.isArray(v)&&v.length===3&&v.every(x=>num(x)!==null)?v.slice():null;
 if(!record)return {available:false,reason:'NO_CURRENT_DISCOVERED_DUNGEON_MAP'};
 const revealed=own(record,'revealed'),visited=own(record,'visitedThisRun'),trail=own(record,'trail'),notes=own(record,'notes'),teleporters=own(record,'teleporters');
 const revealedKeys=[];if(revealed instanceof Set)for(const k of revealed){if(revealedKeys.length>=512)break;if(typeof k==='string'||typeof k==='number')revealedKeys.push(typeof k==='string'?text(k):num(k));}
 const visitedKeys=[];if(visited instanceof Set)for(const k of visited){if(visitedKeys.length>=512)break;if(revealed instanceof Set&&revealed.has(k)&&(typeof k==='string'||typeof k==='number'))visitedKeys.push(typeof k==='string'?text(k):num(k));}
 const visitedTrail=[];if(trail instanceof Set)for(const k of trail){if(visitedTrail.length>=1024)break;if(typeof k!=='string'||!/^[-\d.]+,[-\d.]+,[-\d.]+$/.test(k))continue;const p=k.split(',').map(Number);if(p.length===3&&p.every(Number.isFinite))visitedTrail.push({x:p[0]+.5,y:p[1],z:p[2]+.5});}
 const userNotes=[];if(notes instanceof Map)for(const v of notes.values()){if(userNotes.length>=64)break;const p=vec(own(v,'position'));if(p)userNotes.push({position:p,note:text(own(v,'note'))});}
 const discoveredConnections=[];if(teleporters instanceof Map)for(const v of teleporters.values()){if(discoveredConnections.length>=64)break;const a=own(v,'entrance'),b=own(v,'exit'),from=vec(own(a,'pos')),to=vec(own(b,'pos'));if(from&&to)discoveredConnections.push({from,to,fromYawDegrees:num(own(a,'yawDeg')),toYawDegrees:num(own(b,'yawDeg'))});}
 return {available:true,entranceDiscovered:own(record,'entranceDiscovered')===true,revealedAreaKeys:revealedKeys,visitedThisRunKeys:visitedKeys,visitedTrail,userNotes,discoveredConnections,truncated:{revealedAreas:revealed instanceof Set&&revealed.size>512,visitedAreas:visited instanceof Set&&visited.size>512,trail:trail instanceof Set&&trail.size>1024,notes:notes instanceof Map&&notes.size>64,connections:teleporters instanceof Map&&teleporters.size>64},scope:'Only the current normally discovered automap record; no full model/layout/undiscovered rows.'};
}

export function copyTownShops(directory,townPosition,discovered,yaw,recordedDestinations=[]) {
 const own=(o,k)=>{if(!o||typeof o!=='object')return undefined;const d=Object.getOwnPropertyDescriptor(o,k);return d&&'value'in d?d.value:undefined;};
 const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const text=v=>typeof v==='string'?v.slice(0,120).replace(/[\u0000-\u001f\u007f]/g,''):null;
 if(!Array.isArray(directory)||!(Array.isArray(townPosition)||ArrayBuffer.isView(townPosition)))return {available:false,reason:'TOWN_DIRECTORY_UNAVAILABLE'};
 const types={0:'alchemist',2:'armorer',3:'bank',5:'bookseller',6:'clothing store',7:'furniture store',8:'gem store',9:'general store',10:'library',11:'guild hall',12:'pawnshop',13:'weaponsmith',14:'temple',15:'tavern',16:'palace'};
 const heading=typeof yaw==='number'?((yaw*180/Math.PI)%360+360)%360:null;
 const shops=[];
 for(const b of directory){
  const type=number(own(b,'buildingType')),questSites=recordedDestinations.filter(d=>Number.isInteger(d.buildingKey)&&d.buildingKey===own(b,'buildingKey'));if(!types[type]&&!questSites.length)continue;
  const pos=own(b,'position');if(!Array.isArray(pos)||pos.length<3||pos.some(v=>number(v)===null))continue;
  const dx=pos[0]-townPosition[0],dz=pos[2]-townPosition[2],distance=Math.hypot(dx,dz),bearing=((Math.atan2(dx,dz)*180/Math.PI)%360+360)%360;
  const learned=typeof discovered==='function'?discovered(own(b,'buildingKey')):(Array.isArray(discovered)?discovered.find(e=>own(e,'buildingKey')===own(b,'buildingKey')):null);
  const turn=heading===null?null:((bearing-heading+540)%360)-180;
  const questName=text(questSites[0]?.buildingName),learnedName=learned?(text(own(learned,'customUserDisplayName'))||text(own(learned,'displayName'))):null;
  shops.push({mapKey:number(own(b,'buildingKey')),type:types[type]??'recorded quest destination',name:learnedName||questName,nameDiscovered:!!learned||!!questName,nameSource:learnedName?'learned map record':questName?'recorded quest address':null,questNames:[...new Set(questSites.map(d=>d.questName).filter(Boolean))],questSites:questSites.slice(0,16).map(d=>({questId:d.questId??null,publicActor:d.publicActor??null})),distanceMetres:Math.round(distance*10)/10,bearingDegrees:Math.round(bearing*10)/10,relativeTurnDegrees:turn===null?null:Math.round(turn*10)/10,position:{x:pos[0],y:pos[1],z:pos[2],frame:'town local'},pointMeaning:'mapped building position; use entrances for a door',potentialGearBuyer:[2,9,12,13].includes(type)});
 }
 return {available:true,playerTownPosition:{x:townPosition[0],y:townPosition[1],z:townPosition[2]},shops:shops.slice(0,128),truncated:shops.length>128,scope:'Public town services plus addresses explicitly disclosed in recorded quests; names come from learned map records or those recorded addresses.',limitations:['Straight-line bearing, not obstacle-aware routing.','Opening hours and purchase acceptance are not established.']};
}

export function copyPublicTownEntrances(directory,entries,pixelKey,translation,player,yaw,recordedKeys=[]){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const allowed=new Set;for(const b of directory??[])if([0,2,3,5,6,7,8,9,10,11,12,13,14,15,16].includes(own(b,'buildingType'))||recordedKeys.includes(own(b,'buildingKey')))allowed.add(own(b,'buildingKey'));
 const doors=[];let inspected=0;for(const e of entries??[]){if(++inspected>4096)break;if(own(e,'pixelKey')!==pixelKey)continue;
  const raw=(own(e,'blockX')<<16)+(own(e,'blockY')<<8)+own(e,'recordIndex'),key=raw===0?16777216:raw;if(!allowed.has(key))continue;
  const door=own(e,'door');if(own(door,'doorType')!==1)continue;const m=own(door,'matrix'),c=own(door,'centre');if(!m||m.length!==16||!c)continue;const cx=own(c,'x'),cy=own(c,'y'),cz=own(c,'z');
  const p=[m[0]*cx+m[4]*cy+m[8]*cz+m[12]+translation[0],m[1]*cx+m[5]*cy+m[9]*cz+m[13]+translation[1],m[2]*cx+m[6]*cy+m[10]*cz+m[14]+translation[2]];if(!p.every(Number.isFinite))continue;
  const dx=p[0]-player[0],dz=p[2]-player[2],bearing=(Math.atan2(dx,dz)*180/Math.PI+360)%360,heading=(yaw*180/Math.PI+360)%360;
  doors.push({mapKey:key,position:{x:p[0],y:p[1],z:p[2],frame:'floating-origin exterior local',units:'game metres'},distanceMetres:Math.round(Math.hypot(dx,dz)*10)/10,bearingDegrees:Math.round(bearing*10)/10,relativeTurnDegrees:Math.round((((bearing-heading+540)%360)-180)*10)/10});if(doors.length>=128)break;
 }
 return {available:true,doors,truncated:inspected>4096||doors.length>=128,scope:'Exterior door centres for public services and explicitly recorded quest addresses. Other private residences are excluded.',limitations:['An entrance position does not establish open hours, unlocked state, walkable approach or a route around buildings.']};
}

export function copyHighlightedTarget(playerPosition) {
 const own=(o,k)=>{if(!o||typeof o!=='object')return undefined;const d=Object.getOwnPropertyDescriptor(o,k);return d&&'value'in d?d.value:undefined;};
 const text=v=>typeof v==='string'?v.slice(0,120).replace(/[\u0000-\u001f\u007f]/g,''):null;
 // Reviewed getter in xVe: get target(){return u}. u is only the current
 // line-of-sight/range-tested profession target chosen by the game's own frame.
 const target=this.target;
 if(!target)return {available:true,target:null,scope:'current highlighted profession interactable only'};
 const node=own(target,'node'),kind=text(own(node,'kind')),p=own(target,'world');
 const position=Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)?p.slice():null;
 const type=kind==='tree'?'logging tree':kind;
 const distance=position&&Array.isArray(playerPosition)?Math.hypot(position[0]-playerPosition[0],position[1]-playerPosition[1],position[2]-playerPosition[2]):null;
 return {available:true,target:{type,material:text(own(node,'material')),name:text(own(node,'name')),resource:text(own(node,'what')),distanceMetres:distance===null?null:Math.round(distance*10)/10,position},scope:'current highlighted profession interactable only; no nearby-node scan'};
}

// The current model's byKey map is queried ONLY with already revealed keys.
// Never iterates model.rows, byKey or historical layout variants.
export function copyRevealedGeometry(){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const record=own(this,'rec'),model=own(this,'model'),revealed=own(record,'revealed'),byKey=own(model,'byKey');
 if(!(revealed instanceof Set)||!(byKey instanceof Map))return {available:false,reason:'CURRENT_REVEALED_MODEL_UNAVAILABLE'};
 const parts=[];let values=0,truncated=false;
 const numbers=(a,limit)=>{if(!Array.isArray(a)&&!ArrayBuffer.isView(a))return null;if(a.length>limit||values+a.length>60000){truncated=true;return null;}const copy=Array.from(a);if(!copy.every(Number.isFinite))return null;values+=copy.length;return copy;};
 for(const key of revealed){if(parts.length>=256){truncated=true;break;}const row=byKey.get(key);if(!row)continue;const bounds=own(row,'aabb');
  parts.push({key:typeof key==='string'?key.slice(0,160):key,bounds:{min:numbers(own(bounds,'min'),3),max:numbers(own(bounds,'max'),3)},elementName:typeof own(row,'elementName')==='string'?own(row,'elementName').slice(0,80):null,positions:numbers(own(row,'positions'),12000),indices:numbers(own(row,'indices'),18000),matrix:numbers(own(row,'matrix'),16)});
 }
 return {available:true,parts,truncated,units:'Current dungeon local game metres; apply each part matrix to its vertices',scope:'Exactly the game automap model parts whose keys are already revealed. No undiscovered rows, historical layouts or global geometry.',limitations:['Geometry describes the discovered automap, not a certified walkable route.','Small doors, moving obstacles and vertical connectivity can require player confirmation.']};
}
