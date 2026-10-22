import {summarizeOwner,ownerDifferences} from './history.mjs';
// "Since last look" feed. Compares the dashboard's own projected snapshots in memory;
// no extra reads. Vital fluctuations are left to the live bars.
export function ownerFromSnapshot(s){const d=s?.details;if(!d||!s.player)return null;return {identity:s.player.identity,vitals:{},inventory:{available:d.inventoryAvailable===true,truncated:d.inventoryTruncated===true,items:d.items??[]},journal:Array.isArray(d.quests)?{available:true,truncated:false,active:d.quests.map(q=>({name:q.name,complete:q.complete,entries:q.entries??[]}))}:null,progression:null};}
const words={inventoryCount:c=>(c.delta>0?'Gained ':'Lost ')+Math.abs(c.delta)+' × '+c.name,equipment:c=>(c.afterSlots.length?'Equipped ':'Unequipped ')+c.name,condition:c=>{const b=conditionPercent(c.before,c.beforeMax),a=conditionPercent(c.after,c.afterMax);if(b===null||a===null)return null;if(a===0&&b>0)return c.name+' broke (0%)';const step=Math.floor(b/10)!==Math.floor(a/10),low=a<25&&b>=25;if(!step&&!low)return null;return c.name+' condition '+b+'% → '+a+'%'+(a<25?' · low':'');},recordedQuestAdded:c=>'New quest: '+c.name,recordedQuestCompleted:c=>'Quest completed: '+c.name,recordedQuestProgressChanged:c=>'Journal updated: '+c.name,progressionChanged:c=>c.field==='level'?'Reached level '+c.after:null,finishedJournalAdded:()=>'A finished quest was recorded'};
// Condition is reported in whole percent, only when it crosses a 10% step, drops below 25% or breaks.
export function conditionPercent(current,max){return Number.isFinite(current)&&Number.isFinite(max)&&max>0?Math.max(0,Math.min(100,Math.round(current/max*100))):null;}
export function describeChange(c){const f=words[c.kind];return f?f(c):null;}
export class SinceLastLook{
 #baseline=null;#seenAt=null;#owner=null;#now;
 constructor({now=()=>Date.now()}={}){this.#now=now;}
 changes(snapshot){
  const owner=ownerFromSnapshot(snapshot);if(!owner)return {available:false,seenAt:this.#seenAt,items:[]};
  const current=summarizeOwner(owner);
  if(!this.#baseline||this.#owner!==owner.identity?.name){this.#baseline=current;this.#owner=owner.identity?.name??null;this.#seenAt=new Date(this.#now()).toISOString();}
  const items=ownerDifferences(this.#baseline,current).filter(c=>c.kind!=='vital').map(c=>({kind:c.kind,message:describeChange(c)})).filter(c=>c.message).slice(0,20);
  this.current=current;return {available:true,seenAt:this.#seenAt,items};
 }
 markSeen(snapshot){const owner=ownerFromSnapshot(snapshot);if(owner){this.#baseline=summarizeOwner(owner);this.#owner=owner.identity?.name??null;}this.#seenAt=new Date(this.#now()).toISOString();return {seenAt:this.#seenAt};}
}
