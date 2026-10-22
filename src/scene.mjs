// Standalone bounded scene observation. All writes are to newly allocated local
// arrays/sets/objects. Never calls the collider's mutating raycast/_near methods.
// Uses its already-built spatial index and triangle cells only for occlusion;
// no collision geometry, bucket keys, unseen names or private IDs are returned.
export function readVisibleScene(inputs) {
 const own=(o,k)=>{if(!o||typeof o!=='object')return undefined;const d=Object.getOwnPropertyDescriptor(o,k);return d&&'value'in d?d.value:undefined;};
 const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const text=v=>typeof v==='string'?v.slice(0,100).replace(/[\u0000-\u001f\u007f]/g,''):null;
 const vector=v=>(Array.isArray(v)||ArrayBuffer.isView(v))&&v.length>=3&&Number.isFinite(v[0])&&Number.isFinite(v[1])&&Number.isFinite(v[2])?[v[0],v[1],v[2]]:null;
 const renderer=this,proj=own(renderer,'_proj'),view=own(renderer,'_view'),eye=vector(own(renderer,'_camPos'));
 const collider=inputs.collider,broad=own(collider,'_broad');
 if(!eye||proj?.length!==16||view?.length!==16||!broad)return {available:false,reason:'CURRENT_VIEW_OR_COLLISION_INDEX_UNAVAILABLE'};
 const forward=[-view[2],-view[6],-view[10]],entities=[],candidates=[];
 const budget={work:0,bounded:false,unknownVisibility:false,reasons:[]};
 const diagnostics={npcRecords:0,npcWithPosition:0,npcRendered:0,peerRecords:0,renderedPeers:0,hiddenPeers:0,peerPoses:0,inRange:0,inFrustum:0,occluded:0};
 const unknown=reason=>{budget.unknownVisibility=true;if(!budget.reasons.includes(reason))budget.reasons.push(reason);};
 const spatialKey=(x,z)=>(x+1048576)*2097152+(z+1048576);
 function rayCells(o,d,limit,size,visit){
  let x=Math.floor(o[0]/size),z=Math.floor(o[2]/size),sx=Math.sign(d[0]),sz=Math.sign(d[2]);
  let tx=sx?((x+(sx>0?1:0))*size-o[0])/d[0]:Infinity,tz=sz?((z+(sz>0?1:0))*size-o[2])/d[2]:Infinity;
  const dx=sx?Math.abs(size/d[0]):Infinity,dz=sz?Math.abs(size/d[2]):Infinity;
  for(let steps=0;steps<1024;steps++){
   // Neighbours cover exact cell edges/corners and the engine's index padding.
   for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)visit(x+a,z+b);
   if(Math.min(tx,tz)>limit)break;if(tx<tz){x+=sx;tx+=dx;}else{z+=sz;tz+=dz;}
  }
 }
 function project(p){
  const x=view[0]*p[0]+view[4]*p[1]+view[8]*p[2]+view[12],y=view[1]*p[0]+view[5]*p[1]+view[9]*p[2]+view[13],z=view[2]*p[0]+view[6]*p[1]+view[10]*p[2]+view[14],w=view[3]*p[0]+view[7]*p[1]+view[11]*p[2]+view[15];
  const cx=proj[0]*x+proj[4]*y+proj[8]*z+proj[12]*w,cy=proj[1]*x+proj[5]*y+proj[9]*z+proj[13]*w,cz=proj[2]*x+proj[6]*y+proj[10]*z+proj[14]*w,cw=proj[3]*x+proj[7]*y+proj[11]*z+proj[15]*w;
  return cw>0&&Math.abs(cx)<=cw&&Math.abs(cy)<=cw&&cz>=-cw&&cz<=cw?{x:cx/cw,y:cy/cw}:null;
 }
 function boxHit(o,d,min,max,limit){let low=0,high=limit;for(let i=0;i<3;i++){if(d[i]===0){if(o[i]<min[i]-.001||o[i]>max[i]+.001)return false;continue;}let a=(min[i]-.001-o[i])/d[i],b=(max[i]+.001-o[i])/d[i];if(a>b){const t=a;a=b;b=t;}low=Math.max(low,a);high=Math.min(high,b);if(low>high)return false;}return true;}
 function triangle(o,d,a,b,c,limit){
  const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];
  if(Math.abs(det)<1e-8)return false;const inv=1/det,t=[o[0]-a[0],o[1]-a[1],o[2]-a[2]],u=(t[0]*p[0]+t[1]*p[1]+t[2]*p[2])*inv;if(u<0||u>1)return false;
  const q=[t[1]*e1[2]-t[2]*e1[1],t[2]*e1[0]-t[0]*e1[2],t[0]*e1[1]-t[1]*e1[0]],v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*inv;if(v<0||u+v>1)return false;const dist=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;return dist>.02&&dist<limit;
 }
 function terrainHeight(x,z){
  if(inputs.mode!=='exterior')return -Infinity;
  const state=inputs.state,origin=own(state,'mapOrigin'),comp=own(state,'compensation'),built=inputs.built,scale=inputs.heightScale;
  if(!origin||!comp||!(built instanceof Map)||!Number.isFinite(scale))return null;
  const px=origin.x+Math.floor((x-comp[0])/819.2),py=origin.y-Math.floor((z-comp[2])/819.2),tile=built.get(px+','+py);
  if(!tile||own(tile,'deepWaters'))return null;
  const samples=own(tile,'samples');if(!samples||samples.length<16641)return null;
  const lx=x-(px-origin.x)*819.2-comp[0],lz=z+(py-origin.y)*819.2-comp[2];if(lx<0||lz<0||lx>=819.2||lz>=819.2)return null;
  const sx=lx/6.4,sz=lz/6.4,ix=Math.min(127,Math.floor(sx)),iz=Math.min(127,Math.floor(sz)),fx=sx-ix,fz=sz-iz;
  const h=(samples[ix*129+iz]*(1-fx)*(1-fz)+samples[(ix+1)*129+iz]*fx*(1-fz)+samples[ix*129+iz+1]*(1-fx)*fz+samples[(ix+1)*129+iz+1]*fx*fz)*scale+comp[1];
  return Number.isFinite(h)?h:null;
 }
 function clear(to){
  const delta=[to[0]-eye[0],to[1]-eye[1],to[2]-eye[2]],distance=Math.hypot(...delta),limit=distance-.18;if(!(limit>0))return false;
  const direction=delta.map(x=>x/distance);
  if(inputs.mode==='exterior')for(let n=1,steps=Math.ceil(distance);n<steps;n++){const f=n/steps,x=eye[0]+delta[0]*f,z=eye[2]+delta[2]*f,h=terrainHeight(x,z);if(h===null){unknown('TERRAIN_UNAVAILABLE');return false;}if(h>eye[1]+delta[1]*f-.03)return false;}
  const buckets=[],seen=new Set;
  const add=b=>{if(b&&!seen.has(b)){seen.add(b);buckets.push(b);}};
  for(const b of own(broad,'always')??[])add(b);
  for(const [field,size] of [['cells',8],['coarseCells',256]]){
   const cells=own(broad,field);if(!(cells instanceof Map)){unknown('SPATIAL_INDEX_UNAVAILABLE');return false;}
   rayCells(eye,direction,limit,size,(x,z)=>{for(const b of cells.get(spatialKey(x,z))??[])add(b);});
  }
  for(const bucket of buckets){
   let shift=[0,0,0],rotation=null;
   // The reviewed host registers the floating world frame only for pixel
   // translations. Its index records the translation used for this frame.
   // Other dynamic obstacles remain uncertain; never call a pose callback.
   if(own(bucket,'moves')){
    const frame=own(bucket,'frame'),record=(own(broad,'frames')??[]).find(f=>own(f,'bucket')===bucket);
    const comp=own(inputs.state,'compensation');
    if(frame===inputs.state&&record&&comp){shift=[own(record,'x'),comp[1],own(record,'z')];if(!shift.every(Number.isFinite)){unknown('FRAME_TRANSFORM_UNAVAILABLE');return false;}}
    else {const pose=(inputs.poses??[]).find(p=>p.ord===own(bucket,'ord'));shift=vector(pose?.translation);rotation=pose?.rotation??null;if(!shift||(rotation&&rotation.length!==9)){unknown('DYNAMIC_TRANSFORM_UNAVAILABLE');return false;}}
   }
   const relative=[eye[0]-shift[0],eye[1]-shift[1],eye[2]-shift[2]];
   const local=v=>rotation?[rotation[0]*v[0]+rotation[1]*v[1]+rotation[2]*v[2],rotation[3]*v[0]+rotation[4]*v[1]+rotation[5]*v[2],rotation[6]*v[0]+rotation[7]*v[1]+rotation[8]*v[2]]:v;
   const o=local(relative),d=local(direction),min=own(bucket,'min'),max=own(bucket,'max');
   if(!min||!max||!boxHit(o,d,min,max,limit))continue;
   const end=[o[0]+d[0]*limit,o[1]+d[1]*limit,o[2]+d[2]*limit],grid=own(bucket,'grid'),tris=own(bucket,'tris'),ids=new Set;
   if(!(grid instanceof Map)||!Array.isArray(tris)){unknown('TRIANGLE_INDEX_UNAVAILABLE');return false;}
   for(const id of own(bucket,'wide')??[])ids.add(id);
   rayCells(o,d,limit,2,(x,z)=>{for(const id of grid.get(spatialKey(x,z))??[])ids.add(id);});
   for(const id of ids){if(++budget.work>24000){budget.bounded=true;return false;}const tri=tris[id];if(tri&&triangle(o,d,tri[0],tri[1],tri[2],limit))return false;}
  }
  return true;
 }
 function observe(kind,entry,feet,name,appearance,height=.95){
  if(!feet)return;const delta=[feet[0]-eye[0],feet[1]-eye[1],feet[2]-eye[2]],distance=Math.hypot(...delta);if(!(distance>.2&&distance<=128))return;diagnostics.inRange++;
  const heights=kind==='corpse'?[height]:[height,1.6,.35];
  const samples=heights.map(h=>{const point=[feet[0],feet[1]+h,feet[2]];return {point,screen:project(point)};}).filter(p=>p.screen);if(!samples.length)return;
  diagnostics.inFrustum++;candidates.push({distance,emit:()=>{const visible=samples.find(p=>clear(p.point));if(!visible){diagnostics.occluded++;return;}const screen=visible.screen;
  const bearing=((Math.atan2(delta[0],delta[2])*180/Math.PI)%360+360)%360;
  const yaw=((Math.atan2(forward[0],forward[2])*180/Math.PI)%360+360)%360,turn=((bearing-yaw+540)%360)-180;
  const nameValue=typeof name==='function'?name():name;
  const row={kind,name:text(nameValue),position:{x:feet[0],y:feet[1],z:feet[2],frame:inputs.mode==='exterior'?'floating-origin exterior local':'current interior/dungeon local',units:'game metres'},distanceMetres:Math.round(distance*10)/10,bearingDegrees:Math.round(bearing*10)/10,relativeTurnDegrees:Math.round(turn*10)/10,screen:{x:Math.round((screen.x+1)*50),y:Math.round((1-screen.y)*50)},appearance:appearance?{race:text(own(appearance,'race')),gender:text(own(appearance,'gender'))}:null};
  // Same 0.45m-radius / 1.8m-high person activation cylinder as xI in the
  // reviewed UI. No activation function is called.
  const h=Math.hypot(forward[0],forward[2])||1e-6,fx=forward[0]/h,fz=forward[2]/h,along=delta[0]*fx+delta[2]*fz,side=Math.hypot(delta[0]-fx*along,delta[2]-fz*along),rayY=eye[1]+forward[1]*(along/h);
  row.underCrosshair=along>0&&side<=.45&&rayY>=feet[1]-.1&&rayY<=feet[1]+(kind==='corpse'?.5:1.9);
  if(row.underCrosshair&&!clear([eye[0]+forward[0]*(along/h),rayY,eye[2]+forward[2]*(along/h)]))row.underCrosshair=false;
  entities.push(row);
  }});
 }
 let npcCount=0;
 for(const entry of Array.isArray(inputs.people)?inputs.people:[]){if(++npcCount>256){budget.bounded=true;break;}diagnostics.npcRecords++;let person=own(entry,'person'),feet=vector(own(entry,'pos'));
  if(!person&&inputs.mode==='interior'){if(own(entry,'active')===false||!own(entry,'stood')||(!own(entry,'standBatch')&&!own(entry,'standDraw'))||own(entry,'lamp'))continue;person=entry;feet=[own(entry,'x'),own(entry,'y'),own(entry,'z')];if(!feet.every(Number.isFinite))continue;}
  if(feet)diagnostics.npcWithPosition++;diagnostics.npcRendered++;
  observe('npc',entry,feet,()=>own(person,'nameNPC')||own(person,'displayName')||own(person,'name')||own(own(person,'living'),'name')||own(own(own(person,'living'),'res'),'name'),person);}
 const network=inputs.network,hidden=inputs.hiddenPeers;
 const peerMap=own(network,'peers'),peerCoverage=peerMap instanceof Map,renderCoverage=inputs.bodies instanceof Map||inputs.riders instanceof Map||inputs.walkers instanceof Map;
 diagnostics.peerMapAvailable=peerCoverage;diagnostics.playerRenderPoolsAvailable=renderCoverage;diagnostics.networkPresent=!!network;diagnostics.peerCoordinatesAvailable=Array.isArray(inputs.peerPositions);diagnostics.networkStatus=text(own(network,'status'));diagnostics.renderPoolCounts={bodies:inputs.bodies instanceof Map?inputs.bodies.size:null,riders:inputs.riders instanceof Map?inputs.riders.size:null,walkers:inputs.walkers instanceof Map?inputs.walkers.size:null};
 // Positive membership in the game's current render pools avoids calling the
 // network clock/visibility methods or enumerating merely nearby peers.
 if(network){const peers=own(network,'peers');if(peers instanceof Map){const candidates=new Set;for(const pool of [inputs.bodies,inputs.riders,inputs.walkers])if(pool instanceof Map)for(const id of pool.keys()){if(candidates.size>=128){budget.bounded=true;break;}candidates.add(id);}diagnostics.peerRecords=peers.size;diagnostics.candidatePeerRecords=candidates.size;for(const id of candidates){const peer=peers.get(id);if(!peer)continue;if(hidden instanceof Set&&hidden.has(id)){diagnostics.hiddenPeers++;continue;}
  const body=inputs.bodies instanceof Map?inputs.bodies.get(id):null,rider=inputs.riders instanceof Map?inputs.riders.get(id):null,walker=inputs.walkers instanceof Map?inputs.walkers.get(id):null;
  const renderedBody=body&&own(body,'state')==='ok'&&own(body,'goneAt')==null&&!own(body,'far');
  if(!renderedBody&&!own(rider,'batch')&&!own(walker,'batch'))continue;diagnostics.renderedPeers++;
  const pose=own(peer,'shown');if(!pose||own(pose,'dd'))continue;diagnostics.peerPoses++;const feet=vector(inputs.peerPositions?.find(p=>p.id===id)?.position);if(!feet||!feet.every(Number.isFinite)){unknown('PLAYER_COORDINATE_FRAME_UNAVAILABLE');continue;}observe('player',peer,feet,()=>own(peer,'name'),own(peer,'look'));}}}
 let foeCount=0;
 const actors=(Array.isArray(inputs.drawnFoes)?inputs.drawnFoes:[]).map(entry=>({entry,kind:'enemy'})).concat((Array.isArray(inputs.guards)?inputs.guards:[]).map(entry=>({entry,kind:'guard'})));
 for(const {entry,kind} of actors){if(++foeCount>256){budget.bounded=true;break;}
  const effects=own(own(entry,'entity'),'activeEffects');if(Array.isArray(effects)&&effects.some(e=>['invisNormal','invisTrue','chameleonNormal','chameleonTrue','shadeNormal','shadeTrue'].includes(own(e,'kind'))))continue;
  if(own(entry,'dead')){const corpse=own(entry,'corpseMarker');if(own(entry,'corpse')&&!own(entry,'corpseDisabled')&&corpse)observe('corpse',entry,vector(own(corpse,'pos')),()=>{const name=own(own(own(entry,'mobile'),'basics'),'name');return typeof name==='string'?name+' corpse':null;},null,.2);continue;}
  if(!own(entry,'_mout'))continue;
  // Copy jL's conservative eligibility: ordinary visible foes only. Suppress
  // all concealment rather than invoking phase initialization/reveal effects.

  const batch=own(entry,'batch'),feet=vector(own(batch,'origin'));observe(kind,entry,feet,()=>own(own(own(entry,'mobile'),'basics'),'name')??own(own(entry,'entity'),'name'),null);}
 candidates.sort((a,b)=>a.distance-b.distance);for(const c of candidates){if(entities.length>=64||budget.work>24000){budget.bounded=true;break;}c.emit();}
 return {available:true,complete:false,entities,diagnostics,cameraPosition:eye,rangeMetres:128,bounded:budget.bounded,visibilityIncomplete:budget.unknownVisibility,visibilityUncertainty:budget.reasons,coverage:{npcRecords:Array.isArray(inputs.people),foeRecords:Array.isArray(inputs.drawnFoes),publicPlayerRenderPools:peerCoverage&&renderCoverage&&Array.isArray(inputs.peerPositions),playerReason:!Array.isArray(inputs.peerPositions)?'PLAYER_COORDINATE_FRAME_UNAVAILABLE':!peerCoverage?'CURRENT_PEER_MAP_UNAVAILABLE':!renderCoverage?'CURRENT_PLAYER_RENDER_POOLS_UNAVAILABLE':null},scope:'Current camera frustum plus copied mesh/terrain line-of-sight test. Public character labels only; no private IDs, chat, inventories or stats.',limitations:['Geometric visibility estimate, not pixel recognition; lighting, partial bodies and small HUD occluders may differ.','Not a complete scene description; occlusion uncertainty suppresses a character.','All concealed enemies are conservatively omitted, including briefly revealed ones.','Health and hostility are not inferred from private entity state.']};
}
