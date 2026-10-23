// Scene-local structural coordinates only. No container contents, hidden
// dungeon layout or mutating collision/pathfinding APIs are read.
export function copyInteriorLandmarks(position,yaw){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const ctx=this.interiorCtx;
 if(!ctx)return {available:false,reason:'NO_CURRENT_INTERIOR'};
 const landmarks=[];
 function add(kind,index,p,meaning){if(!p||p.length<3||!p.slice(0,3).every(Number.isFinite))return;const dx=p[0]-position.x,dy=p[1]-position.y,dz=p[2]-position.z,bearing=((Math.atan2(dx,dz)*180/Math.PI)%360+360)%360;landmarks.push({kind,index,position:{x:p[0],y:p[1],z:p[2],frame:'current interior/dungeon local',units:'game metres'},distanceMetres:Math.hypot(dx,dy,dz),verticalOffsetMetres:dy,heightRelation:dy>1.2?'ABOVE':dy< -1.2?'BELOW':'SAME_HEIGHT_BAND',bearingDegrees:bearing,relativeTurnDegrees:Number.isFinite(yaw)?((bearing-yaw*180/Math.PI+540)%360)-180:null,pointMeaning:meaning,reachability:'UNKNOWN'});}
 for(const [field,kind]of [['doors','door'],['ladders','ladder']]){
  const list=own(ctx,field);if(!Array.isArray(list))continue;
  for(let i=0;i<Math.min(128,list.length);i++){const entry=list[i],m=own(entry,'matrix');if(!m||m.length!==16)continue;const centre=own(entry,'centre');
   if(kind==='door'&&centre){const x=own(centre,'x'),y=own(centre,'y'),z=own(centre,'z');add(kind,i,[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]],'Transformed door centre; exit destination and open/locked status unknown.');}
   else add(kind,i,[m[12],m[13],m[14]],'Structural placement origin; exact opening or ladder endpoints not established.');
  }
 }
 const markers=own(ctx,'enterMarkers');if(Array.isArray(markers))for(let i=0;i<Math.min(64,markers.length);i++)add('entry_or_rest_marker',i,markers[i],'Source combines ENTER and REST markers; not asserted to be an exit.');
 return {available:true,landmarks,truncated:(own(ctx,'doors')?.length??0)>128||(own(ctx,'ladders')?.length??0)>128||(markers?.length??0)>64,stairs:{available:false,reason:'NO_SEMANTIC_STAIR_RECORDS'},floors:{available:false,reason:'HEIGHT_BANDS_ARE_NOT_FLOOR_NUMBERS'},routing:{available:false,reason:'NO_VALIDATED_WALKABILITY_GRAPH',canGiveTurnByTurn:false},scope:'Loaded interior structural landmarks and relative height only. No reachable-route, numbered-floor or stairway inference.'};
}
