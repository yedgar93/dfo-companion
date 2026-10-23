// Pure snapshot processing. No network, game APIs, timers, sound or notifications.
export class QuietAlerts{
 constructor(){this.owner=null;this.lastSample=null;this.states=new Map;this.visible=[];}
 dismiss(){for(const v of this.states.values())v.dismissed=true;this.visible=[];}
 reset(){this.owner=null;this.lastSample=null;this.states.clear();this.visible=[];}
 update(s,now=Date.now()){
  if(s.stale||s.status?.kind!=='live'||!Number.isFinite(Date.parse(s.lastSuccess))||now-Date.parse(s.lastSuccess)>30000)return [];
  const owner=s.player?.identity?.name;if(!owner)return [];
  if(this.owner!==owner){this.reset();this.owner=owner;}
  if(s.lastSuccess===this.lastSample)return this.visible;
  this.lastSample=s.lastSuccess;const h=s.player?.vitals?.health,health=Number.isFinite(h?.current)&&h.max>0?h.current/h.max:null;
  const gear=(s.details?.items??[]).filter(i=>Number.isInteger(i.equipSlot)&&i.equipSlot>=0&&['Armor','Weapons'].includes(i.group));
  const gearComplete=s.details?.inventoryAvailable===true&&!s.details.inventoryTruncated;const known=gear.filter(i=>Number.isFinite(i.condition?.current)&&i.condition.max>0),low=known.filter(i=>i.condition.current/i.condition.max<=.2),recover=known.every(i=>i.condition.current/i.condition.max>=.3);
  const c=s.details?.carrying,carry=c?.complete===true&&Number.isFinite(c.capacityKg)&&c.capacityKg>0&&Number.isFinite(c.carriedKg)?c.carriedKg/c.capacityKg:null;
  const checks=[['health',health!==null&&health<=.3,health!==null&&health>=.45,'Low health'],['gear',gearComplete&&low.length>0,gearComplete&&recover&&known.length===gear.length,'Low equipment condition: '+low.slice(0,2).map(i=>i.name).join(', ')+(low.length>2?' and '+(low.length-2)+' more':'')],['carry',carry!==null&&carry>=.9,carry!==null&&carry<.8,'Near carrying capacity']];
  for(const [id,trigger,clear,message]of checks){let v=this.states.get(id);if(!v){v={active:false,dismissed:false,lastShown:-Infinity,message};this.states.set(id,v);}if(clear){v.active=false;v.dismissed=false;}else if(trigger&&!v.active){v.active=true;v.dismissed=now-v.lastShown<120000;v.message=message;if(!v.dismissed)v.lastShown=now;}else if(trigger&&v.active)v.message=message;}
  const valid={health:health!==null,gear:gearComplete&&known.length===gear.length,carry:carry!==null};this.visible=[...this.states.entries()].filter(([id,v])=>valid[id]&&v.active&&!v.dismissed).map(([id,v])=>({id,message:v.message}));return this.visible;
 }
}
