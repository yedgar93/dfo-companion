// Data-only copy for the fingerprint-verified identity wire-to-scene converter.
// The caller must verify the current converter's exact body before using this.
export function copyIdentityRenderedPeerPositions(bodyPool,riderPool,walkerPool,world=null,frame={kind:'identity'}) {
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const peers=own(this,'peers');if(!(peers instanceof Map))return null;
 const pools=[own(bodyPool,'_bodies'),own(riderPool,'riders'),own(walkerPool,'walkers')],ids=new Set;
 for(const pool of pools)if(pool instanceof Map)for(const id of pool.keys()){if(ids.size>=128)break;ids.add(id);}
 const positions=[],origin=own(world,'mapOrigin'),comp=own(world,'compensation');
 const offset=comp?[own(comp,'0'),own(comp,'1'),own(comp,'2')]:null;
 if(frame.kind!=='identity'&&(!offset||!offset.every(Number.isFinite)))return null;
 if(frame.kind==='world'&&(!Number.isFinite(own(origin,'x'))||!Number.isFinite(own(origin,'y'))||frame.nativeUnitsPerMetre!==40))return null;
 for(const id of ids){const peer=peers.get(id),pose=own(peer,'shown');if(!pose)continue;let p=[own(pose,'x'),own(pose,'y'),own(pose,'z')];if(!p.every(v=>typeof v==='number'&&Number.isFinite(v)))continue;
  if(frame.kind==='world')p=[(p[0]-own(origin,'x')*32768)/40+offset[0],p[1]+offset[1],(p[2]-(499-own(origin,'y'))*32768)/40+offset[2]];
  else if(frame.kind==='local'&&frame.shiftY)p=[p[0],p[1]+offset[1],p[2]];
  else if(frame.kind!=='identity'&&frame.kind!=='local')return null;
  positions.push({id,position:p});}
 return positions;
}
