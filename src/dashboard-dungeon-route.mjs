import {exploredInteriorMesh} from './dashboard-interior-model.mjs';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const center=t=>({x:(t[0].x+t[1].x+t[2].x)/3,y:(t[0].y+t[1].y+t[2].y)/3,z:(t[0].z+t[1].z+t[2].z)/3});
function hitSegment(a,b,t){
 const sub=(p,q)=>[p.x-q.x,p.y-q.y,p.z-q.z],cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],dot=(u,v)=>u.reduce((n,x,i)=>n+x*v[i],0),d=sub(b,a),e1=sub(t[1],t[0]),e2=sub(t[2],t[0]),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-8)return false;
 const inv=1/det,s=sub(a,t[0]),u=inv*dot(s,h);if(u<-.001||u>1.001)return false;const q=cross(s,e1),v=inv*dot(d,q);if(v<-.001||u+v>1.001)return false;const along=inv*dot(e2,q);return along>.001&&along<.999;
}
export function buildDungeonGraph(mesh){
 const nodes=[],portals=new Map,walls=new Map,cell=4;
 const bins=t=>{const xs=t.map(p=>p.x),zs=t.map(p=>p.z),out=[];for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++)for(let z=Math.floor(Math.min(...zs)/cell);z<=Math.floor(Math.max(...zs)/cell);z++)out.push(x+','+z);return out.slice(0,1024);};
 for(const t of mesh.triangles){const u={x:t[1].x-t[0].x,y:t[1].y-t[0].y,z:t[1].z-t[0].z},v={x:t[2].x-t[0].x,y:t[2].y-t[0].y,z:t[2].z-t[0].z},n={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x},length=Math.hypot(n.x,n.y,n.z);if(length<.02)continue;
  if(n.y/length>.64&&nodes.length<12000){const id=nodes.length,node={triangle:t,center:center(t),links:[]};nodes.push(node);for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3];if(Math.hypot(a.x-b.x,a.z-b.z)<.6)continue;const key=p=>Math.round(p.x*20)+','+Math.round(p.z*20),ka=key(a),kb=key(b),k=ka<kb?ka+'|'+kb:kb+'|'+ka;const entries=portals.get(k)??[];entries.push({id,a,b});portals.set(k,entries);}}
  else if(Math.abs(n.y/length)<.8){for(const key of bins(t)){const list=walls.get(key)??[];list.push(t);walls.set(key,list);}}
 }
 const blocked=(a,b)=>{const from={...a,y:a.y+1},to={...b,y:b.y+1},seen=new Set;for(const key of bins([a,b]))for(const wall of walls.get(key)??[]){if(seen.has(wall))continue;seen.add(wall);if(hitSegment(from,to,wall))return true;}return false;};
 for(const entries of portals.values())for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){const a=entries[i],b=entries[j],heightA=(a.a.y+a.b.y)/2,heightB=(b.a.y+b.b.y)/2;if(Math.abs(heightA-heightB)>.65)continue;const na=nodes[a.id],nb=nodes[b.id];if(blocked(na.center,nb.center))continue;const point={x:(a.a.x+a.b.x)/2,y:(heightA+heightB)/2,z:(a.a.z+a.b.z)/2};na.links.push({to:b.id,point,cost:dist(na.center,point)+dist(point,nb.center)});nb.links.push({to:a.id,point,cost:dist(nb.center,point)+dist(point,na.center)});}
 return {nodes,scope:'Estimated static explored-floor connections; doors, moving obstacles and undiscovered gaps are not certified.'};
}
function onTriangle(p,t){const [a,b,c]=t,det=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(det)<1e-8)return null;const u=((b.z-c.z)*(p.x-c.x)+(c.x-b.x)*(p.z-c.z))/det,v=((c.z-a.z)*(p.x-c.x)+(a.x-c.x)*(p.z-c.z))/det,w=1-u-v;if(u<-.01||v<-.01||w<-.01)return null;return u*a.y+v*b.y+w*c.y;}
export function findDungeonRoute(graph,start,goal){
 if(!start||!goal)return {available:false,reason:'No displayed objective position.'};
 const nearest=p=>{let found=-1,best=2;for(let i=0;i<graph.nodes.length;i++){const y=onTriangle(p,graph.nodes[i].triangle);if(y!==null&&Math.abs(y-p.y)<best){best=Math.abs(y-p.y);found=i;}}return found;};
 const first=nearest(start),last=nearest(goal);if(first<0||last<0)return {available:false,reason:'No connected explored floor at you or the objective yet.'};
 const queue=[first],cost=new Map([[first,0]]),previous=new Map,closed=new Set;let visits=0;
 while(queue.length&&visits++<16000){let at=0,best=Infinity;for(let i=0;i<queue.length;i++){const n=queue[i],score=cost.get(n)+dist(graph.nodes[n].center,goal);if(score<best){best=score;at=i;}}const id=queue.splice(at,1)[0];if(closed.has(id))continue;if(id===last){const steps=[];let n=last;while(n!==first){const p=previous.get(n);if(!p)break;steps.push(graph.nodes[n].center,p.point);n=p.from;}return {available:true,estimated:true,points:[start,...steps.reverse(),goal],reason:'Estimated route through explored floors · doors or moving obstacles may block it.'};}closed.add(id);for(const edge of graph.nodes[id].links){if(closed.has(edge.to))continue;const next=cost.get(id)+edge.cost;if(next<(cost.get(edge.to)??Infinity)){cost.set(edge.to,next);previous.set(edge.to,{from:id,point:edge.point});queue.push(edge.to);}}}
 return {available:false,reason:'No connected explored route found. The marker shows the destination, not a path through unseen rooms.'};
}
if(typeof self!=='undefined'&&typeof document==='undefined'&&typeof self.postMessage==='function'){
 let graph=null,key=null;self.onmessage=event=>{try{const m=event.data;if(m.kind==='mesh'){key=m.key;graph=buildDungeonGraph(exploredInteriorMesh({geometry:{parts:m.parts}}));self.postMessage({kind:'ready',key,nodes:graph.nodes.length});}else if(m.kind==='route'&&m.key===key)self.postMessage({kind:'route',key,id:m.id,result:findDungeonRoute(graph,m.start,m.goal)});}catch{self.postMessage({kind:'error',key});}};
}
