const finite=v=>Number.isFinite(v),point=v=>v&&[v.x,v.y,v.z].every(finite);
export function interiorSceneKey(loc){return [loc?.mode,loc?.mapPixel?.x,loc?.mapPixel?.y,loc?.place?.buildingKey,loc?.place?.buildingName,loc?.place?.dungeonName??loc?.place?.name].join('|');}
export function assetSceneKey(loc){if(!loc?.available)return null;if(loc.mode==='exterior'&&!loc.place?.name)return 'exterior|wilderness';return interiorSceneKey(loc);}
export function projectInteriorMap(nav,capturedAt=new Date().toISOString()){const loc=nav?.location;if(!loc||!['interior','dungeon'].includes(loc.mode))return null;const map=loc.mode==='dungeon'?nav.discoveredMap:null;return {available:map?.available===true,sceneKey:interiorSceneKey(loc),mode:loc.mode,name:loc.place?.dungeonName??loc.place?.buildingName??'Interior',capturedAt,geometry:map?.geometry?.available===true?map.geometry:null,landmarks:nav.navigation?.available===true?(nav.navigation.landmarks??[]).slice(0,320):[],trail:map?.available===true?map.visitedTrail??[]:[],notes:map?.available===true?map.userNotes??[]:[],reason:map?.geometry?.available===true?null:loc.mode==='dungeon'?'Explored dungeon geometry is not available yet.':'This building has no supported public floor plan.',scope:'Only the current explored automap. No unseen rooms, actors or inferred routes.'};}
export function transformInteriorPoint(p,m){if(!Array.isArray(p)||p.length!==3||!p.every(finite))return null;if(!m)return {x:p[0],y:p[1],z:p[2]};if(m.length!==16||!Array.from(m).every(finite))return null;const w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];if(!finite(w)||Math.abs(w)<1e-8)return null;return {x:(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w,y:(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w,z:(m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14])/w};}
export function exploredInteriorMesh(map){const triangles=[],points=[];let total=0;for(const part of map?.geometry?.parts??[]){const v=part.positions,indices=part.indices;if(!Array.isArray(v)||v.length%3||v.length>120000||!Array.isArray(indices)||indices.length>180000)continue;total+=v.length+indices.length;if(total>1000000)break;const vertices=[];for(let i=0;i<v.length;i+=3)vertices.push(transformInteriorPoint(v.slice(i,i+3),part.matrix));for(let i=0;i+2<indices.length;i+=3){const t=indices.slice(i,i+3).map(k=>Number.isInteger(k)&&k>=0?vertices[k]:null);if(t.every(point)){triangles.push(t);points.push(...t);}if(triangles.length>=50000)break;}if(triangles.length>=50000)break;}for(const p of map?.trail??[])if(point(p))points.push(p);return {triangles,points};}
export function interiorFrame(mesh,position){const points=mesh.points.filter(point);if(point(position))points.push(position);if(!points.length)return null;let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;for(const p of points){x0=Math.min(x0,p.x);z0=Math.min(z0,p.z);x1=Math.max(x1,p.x);z1=Math.max(z1,p.z);}const span=Math.max(20,x1-x0,(z1-z0)*2),cx=(x0+x1)/2,cz=(z0+z1)/2;return {x0:cx-span*.55,z0:cz-span*.275,width:span*1.1,height:span*.55};}
export function pointOnInterior(p,frame){return point(p)&&frame?{x:(p.x-frame.x0)/frame.width*320,y:160-(p.z-frame.z0)/frame.height*160}:null;}
export function trianglesAtHeight(mesh,y,near=true){if(!near||!finite(y))return mesh.triangles;return mesh.triangles.filter(t=>Math.min(...t.map(p=>p.y))<=y+3&&Math.max(...t.map(p=>p.y))>=y-3);}

export function dungeonCamera(center,span,yaw,pitch){
 const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),hx=span/2,hy=span/4,depth=Math.max(1000,span*4);
 const matrix=[c/hx,-sp*s/hy,-cp*s/depth,0,0,cp/hy,-sp/depth,0,-s/hx,-sp*c/hy,-cp*c/depth,0,0,0,0,1];
 matrix[12]=-(matrix[0]*center.x+matrix[4]*center.y+matrix[8]*center.z);matrix[13]=-(matrix[1]*center.x+matrix[5]*center.y+matrix[9]*center.z);matrix[14]=-(matrix[2]*center.x+matrix[6]*center.y+matrix[10]*center.z);
 return {matrix,project(p){return {x:(matrix[0]*p.x+matrix[4]*p.y+matrix[8]*p.z+matrix[12]+1)*160,y:(1-matrix[1]*p.x-matrix[5]*p.y-matrix[9]*p.z-matrix[13])*80};}};
}

// Remove coplanar triangle diagonals; retain corners and open boundaries.
export function dungeonMeshBuffers(mesh){
 const faces=[],edges=new Map,key=p=>[p.x,p.y,p.z].map(n=>Math.round(n*1000)).join(',');
 for(const t of mesh.triangles){const a=t[0],b=t[1],c=t[2],u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z},n=[u.y*v.z-u.z*v.y,u.z*v.x-u.x*v.z,u.x*v.y-u.y*v.x],len=Math.hypot(...n);if(len<1e-8)continue;for(let i=0;i<3;i++)n[i]/=len;
  for(const p of t)faces.push(p.x,p.y,p.z,...n);
  for(let i=0;i<3;i++){const p=t[i],q=t[(i+1)%3],kp=key(p),kq=key(q),k=kp<kq?kp+'|'+kq:kq+'|'+kp,row=edges.get(k);if(row){row.count++;if(Math.abs(row.n.reduce((s,x,j)=>s+x*n[j],0))<.98)row.corner=true;}else edges.set(k,{p,q,n,count:1,corner:false});}
 }
 const lines=[];for(const e of edges.values())if(e.count===1||e.corner)lines.push(e.p.x,e.p.y,e.p.z,e.q.x,e.q.y,e.q.z);
 return {faces:new Float32Array(faces),lines:new Float32Array(lines)};
}

// Objective lies toward the top of this camera's ground plane. Preserve yaw near the target.
export function objectiveCameraYaw(position,goal,previous=.65){if(!position||!goal||![position.x,position.z,goal.x,goal.z].every(Number.isFinite))return previous;const dx=goal.x-position.x,dz=goal.z-position.z;if(Math.hypot(dx,dz)<2)return previous;const target=Math.atan2(-dx,-dz),delta=Math.atan2(Math.sin(target-previous),Math.cos(target-previous));return Math.abs(delta)<.035?previous:previous+delta;}

// Project a short world-space facing vector through the same camera as the mesh.
export function dungeonScreenHeading(camera,position,degrees){if(!camera||!position||!Number.isFinite(degrees))return null;const angle=degrees*Math.PI/180,a=camera.project(position),b=camera.project({x:position.x+Math.sin(angle),y:position.y,z:position.z+Math.cos(angle)}),dx=b.x-a.x,dy=b.y-a.y;if(![dx,dy].every(Number.isFinite)||Math.hypot(dx,dy)<1e-8)return null;return (Math.atan2(dx,-dy)*180/Math.PI+360)%360;}
