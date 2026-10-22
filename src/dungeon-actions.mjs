// Reads existing action records and their explicit next-object keys only.
// Never calls receive/toggle/play/tick/collect/restore or any collider method.
export function copyNearbyDungeonActions(position,yaw){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const ctx=this.dungeonCtx,system=own(ctx,'actions'),objects=own(system,'objects'),links=own(system,'_links');
 if(!(objects instanceof Map)||!(links instanceof Map))return {available:false,reason:'LOADED_ACTION_MAP_UNAVAILABLE'};
 const vector=v=>v&&[v[0],v[1],v[2]].every(Number.isFinite)?[v[0],v[1],v[2]]:null;
 const point=o=>{const matrix=own(o,'matrix');return matrix?.length===16&&[matrix[12],matrix[13],matrix[14]].every(Number.isFinite)?[matrix[12],matrix[13],matrix[14]]:vector(own(o,'origin'));};
 const delta=o=>{const p=point(o);return p?Math.hypot(p[0]-position.x,p[1]-position.y,p[2]-position.z):Infinity;};
 const row=o=>{const p=point(o),bearing=p?(Math.atan2(p[0]-position.x,p[2]-position.z)*180/Math.PI+360)%360:null,heading=(yaw*180/Math.PI%360+360)%360;
  const components=v=>v?{x:own(v,'x')??null,y:own(v,'y')??null,z:own(v,'z')??null}:null;
  return {key:own(o,'key'),kind:own(o,'kind'),modelId:own(o,'modelIdNum')??null,state:own(o,'state'),progress:own(o,'t')??null,moveState:own(o,'moveState')??null,moveProgress:own(o,'moveT')??null,translation:components(own(o,'translation')),moveTranslation:components(own(o,'moveTranslation')),rotation:components(own(o,'rotation')),position:p?{x:p[0],y:p[1],z:p[2],frame:'current dungeon local',pointMeaning:'Action placement origin, not a certified accessible interaction point'}:null,distanceMetres:p?delta(o):null,bearingDegrees:bearing,relativeTurnDegrees:bearing===null?null:(bearing-heading+540)%360-180,verticalOffsetMetres:p?p[1]-position.y:null,visibility:'LOADED_ONLY',reachability:'UNKNOWN'};};
 const nearby=[];let scanned=0;
 for(const o of objects.values()){if(++scanned>4096)break;if(delta(o)<=12)nearby.push(o);}nearby.sort((a,b)=>delta(a)-delta(b));
 const actions=nearby.slice(0,24).map(o=>{const next=own(o,'nextKey'),target=Number.isInteger(next)&&next>=0?links.get(String(own(o,'ns'))+':'+next):null;return {...row(o),linkedTarget:target?row(target):null};});
 return {available:true,actions,truncated:scanned>4096||nearby.length>24,radiusMetres:12,scope:'Nearby loaded action origins and one explicit next-object link. Raw movement state only; no switch activation, collision mutation or route/accessibility inference.'};
}
