import {summarizeOwner,ownerDifferences} from './history.mjs';
// "Since last look" feed. Compares the dashboard's own projected snapshots in memory;
// no extra reads. Vital fluctuations are left to the live bars.
export function ownerFromSnapshot(s){const d=s?.details;if(!d||!s.player)return null;return {identity:s.player.identity,vitals:{},inventory:{available:d.inventoryAvailable===true,truncated:d.inventoryTruncated===true,items:d.items??[]},journal:Array.isArray(d.quests)?{available:true,truncated:false,active:d.quests.map(q=>({name:q.name,complete:q.complete,entries:q.entries??[]}))}:null,progression:null};}
const words={inventoryCount:c=>(c.delta>0?'Gained ':'Lost ')+Math.abs(c.delta)+' × '+c.name,equipment:c=>(c.afterSlots.length?'Equipped ':'Unequipped ')+c.name,condition:c=>c.name+' condition '+c.before+' → '+c.after,recordedQuestAdded:c=>'New quest: '+c.name,recordedQuestCompleted:c=>'Quest completed: '+c.name,recordedQuestProgressChanged:c=>'Journal updated: '+c.name,progressionChanged:c=>c.field==='level'?'Reached level '+c.after:null,finishedJournalAdded:()=>'A finished quest was recorded'};
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
