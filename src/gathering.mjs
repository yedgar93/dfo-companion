// Data-only read of existing loaded records. Never invokes node generators.
export function copyLoadedGathering(world,player,yaw) {
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const text=v=>typeof v==='string'?v.slice(0,100):null;
 const origin=own(world,'mapOrigin'),comp=own(world,'compensation'),ox=own(origin,'x'),oy=own(origin,'y'),offset=comp?[own(comp,'0'),own(comp,'1'),own(comp,'2')]:null;
 if(!(this instanceof Map)||!Number.isFinite(ox)||!Number.isFinite(oy)||!offset?.every(Number.isFinite)||!player?.every(Number.isFinite))return {available:false,reason:'LOADED_GATHERING_FRAME_UNAVAILABLE'};
 const groups={},counts={},rows=[];let tiles=0,examined=0,truncated=false;
 outer:for(const loaded of this.values()){
  if(++tiles>256){truncated=true;break;}
  const entry=own(loaded,'entry'),px=own(entry,'px'),py=own(entry,'py'),nodes=own(loaded,'nodes');
  if(!Number.isFinite(px)||!Number.isFinite(py)||!Array.isArray(nodes))continue;
  const tr=[(px-ox)*819.2+offset[0],offset[1],-(py-oy)*819.2+offset[2]];
  for(const node of nodes){
   if(++examined>12000){truncated=true;break outer;}
   const local=own(node,'local'),kind=text(own(node,'kind'));if(!local||!kind)continue;
   const p=[own(local,'0'),own(local,'1'),own(local,'2')];if(!p.every(Number.isFinite))continue;
   for(let i=0;i<3;i++)p[i]+=tr[i];const dx=p[0]-player[0],dy=p[1]-player[1],dz=p[2]-player[2],distance=Math.hypot(dx,dy,dz);if(distance>2048)continue;
   const bearing=(Math.atan2(dx,dz)*180/Math.PI+360)%360,type=kind==='herb'?'herb patch':kind==='haul'?'fishing spot':kind==='tree'?'logging tree':kind==='mine'?'mining node':kind,school=own(node,'school')===true,tier=own(node,'tier');counts[kind]=(counts[kind]??0)+1;
   const row={type,kind,name:text(own(node,'name'))??(school?'Fishing school':type),nodeKey:text(own(node,'key')),herb:text(own(node,'herb')),herbId:Number.isInteger(own(node,'herb'))?own(node,'herb'):null,material:text(own(node,'material')),resource:text(own(node,'what')),tier:Number.isFinite(tier)?tier:null,schoolHint:school,offSeason:own(node,'offSeason')===true,position:{x:p[0],y:p[1],z:p[2],frame:'floating-origin exterior local',units:'game metres'},distanceMetres:Math.round(distance*10)/10,bearingDegrees:Math.round(bearing*10)/10,relativeTurnDegrees:Number.isFinite(yaw)?Math.round((((bearing-((yaw*180/Math.PI%360+360)%360)+540)%360)-180)*10)/10:null,visibility:'LOADED_ONLY',interactable:school?false:null,availability:'UNKNOWN',requiredTool:kind==='haul'?'Fishing Net':kind==='tree'?'Wood Axe':kind==='mine'?'Pickaxe':kind==='herb'&&tier>1?'Sickle':kind==='herb'&&tier===1?'None for hand-picking':null,toolRequirementSource:'Reviewed definitions; possession and other eligibility are not established',routing:'STRAIGHT_LINE_ONLY'};
   (groups[kind]??=[]).push(row);
  }
 }
 for(const group of Object.values(groups)){group.sort((a,b)=>a.distanceMetres-b.distanceMetres);rows.push(...group.slice(0,12));}rows.sort((a,b)=>a.distanceMetres-b.distanceMetres);
 const listTruncated=Object.values(groups).some(g=>g.length>12);
 return {available:true,nodes:rows,counts,nearestHerb:groups.herb?.[0]??null,nearestHandPickHerb:groups.herb?.find(n=>n.tier===1&&!n.offSeason)??null,nearestFishing:groups.haul?.[0]??null,tilesExamined:tiles,nodesExamined:examined,truncated:truncated||listTruncated,scanTruncated:truncated,nodeListTruncated:listTruncated,rangeMetres:2048,scope:'Existing loaded profession records only. No line-of-sight test; depletion, skill, tool possession and reachability are unknown. Fishing schools are hints; the net interaction requires suitable water and current aim. No generator or interaction method was called.'};
}
