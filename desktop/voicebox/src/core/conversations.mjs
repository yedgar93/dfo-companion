import {businessKey,genericBusiness} from './service-identity.mjs';
import {farewellTone} from './regard.mjs';
export const normalize = s => s.replace(/\s+/g,' ').trim();
export class Conversations {
  constructor(emit,{speakPlayer=false,farewell=false,farewellPhrases=['Goodbye.'],farewellPools={},random=Math.random}={}) {this.emit=emit;this.speakPlayer=speakPlayer;this.farewell=farewell;this.farewellPhrases=farewellPhrases;this.farewellPools=farewellPools;this.random=random;this.lastFarewells=new Map();this.farewellBags=new Map();this.lastGlobalFarewell=null;this.seq=0;this.talk=null;this.notice=null;this.documentId=null;}
  closingLine(name,regard=null,opinion=null,{peek=false,preferred=null}={}){
    const tone=farewellTone(regard,opinion),candidates=this.farewellPools?.[tone]??(tone==='unfriendly'?this.farewellPools?.hostile:undefined)??this.farewellPhrases;
    const valid=Array.isArray(candidates)?[...new Set(candidates.filter(s=>typeof s==='string'&&s.trim().length>0&&s.length<=64).slice(0,16))]:[],phrases=valid.length?valid:['Goodbye.'];
    const key=name.toLowerCase()+'|'+tone,signature=JSON.stringify(phrases),last=this.lastFarewells.get(name);
    const goodbye=phrases.find(line=>/^goodbye[.!]?$/i.test(line.trim())),varied=phrases.filter(line=>line!==goodbye);
    const shuffle=()=>{const remaining=[...(varied.length?varied:phrases)];for(let i=remaining.length-1;i>0;i--){const j=Math.min(i,Math.floor(this.random()*(i+1)));[remaining[i],remaining[j]]=[remaining[j],remaining[i]];}return {signature,remaining};};
    let bag=this.farewellBags.get(key);if(!bag||bag.signature!==signature||!bag.remaining.length)bag=shuffle();else bag={...bag,remaining:[...bag.remaining]};
    // An occasional Goodbye does not consume or reset the shuffled phrase bag.
    const repeatGoodbye=goodbye&&goodbye!==last&&goodbye!==this.lastGlobalFarewell&&(preferred===goodbye||(!preferred&&this.random()<0.15));
    const allowed=line=>line!==last&&line!==this.lastGlobalFarewell;
    let index=preferred?bag.remaining.findLastIndex(line=>line===preferred&&allowed(line)):-1;if(index<0)index=bag.remaining.findLastIndex(allowed);
    if(index<0)index=bag.remaining.findLastIndex(line=>line!==last);
    if(index<0)index=bag.remaining.length-1;
    const phrase=repeatGoodbye?goodbye:bag.remaining.splice(index,1)[0];if(peek)return phrase;this.farewellBags.delete(key);this.farewellBags.set(key,bag);if(this.farewellBags.size>512)this.farewellBags.delete(this.farewellBags.keys().next().value);
    this.lastFarewells.delete(name);this.lastFarewells.set(name,phrase);if(this.lastFarewells.size>512)this.lastFarewells.delete(this.lastFarewells.keys().next().value);this.lastGlobalFarewell=phrase;return phrase;
  }
  planFarewell(){const talk=this.talk;if(!talk||!this.farewell)return null;const tone=farewellTone(talk.regard,talk.opinion);if(talk.farewellPlan?.tone!==tone)talk.farewellPlan={tone,text:this.closingLine(talk.name,talk.regard,talk.opinion,{peek:true})};return {source:'farewell',role:'npc',speakerName:talk.name,text:talk.farewellPlan.text,sessionId:'farewell-'+talk.id};}
  setOpinion(documentId,sessionId,name,opinion){if(this.documentId!==documentId||this.talk?.id!==sessionId||this.talk.name!==normalize(name)||opinion?.source!=='game-npc-session'||!Number.isFinite(opinion.reactionToPlayer)||Math.abs(opinion.reactionToPlayer)>10000)return false;this.talk.opinion={source:opinion.source,reactionToPlayer:opinion.reactionToPlayer,answerTier:opinion.answerTier};return true;}
  reset(documentId=null) {this.emit({type:'cancel',reason:'document-change'});this.talk=null;this.notice=null;this.service=null;this.serviceContext=null;this.pendingServiceSpeaker=null;this.lastBusiness=null;this.documentId=documentId;}
  accept(s) {
    if(!s || s.version!==1 || typeof s.documentId!=='string' || s.documentId.length>200) return false;
    if(this.documentId!==s.documentId) this.reset(s.documentId);
    if(s.type==='talk') return this.acceptTalk(s);
    if(s.type==='notice') return this.acceptNotice(s);
    if(s.type==='service') return this.acceptService(s);
    if(s.type==='status') this.emit({type:'status',status:s.status});
    return true;
  }
  acceptTalk(s) {
    if(s.visible===false){if(this.talk){const old=this.talk;this.emit({type:'cancel',sessionId:old.id,reason:'talk-close'});this.talk=null;if(this.farewell&&!s.suppressFarewell)this.emit({type:'utterance',sessionId:'farewell-'+old.id,entryIndex:-1,speakerName:old.name,source:'farewell',role:'npc',farewellTone:farewellTone(old.regard,old.opinion),opinionSource:old.regard?'personal-regard':old.opinion?.source??'unavailable',reactionToPlayer:old.opinion?.reactionToPlayer,text:this.closingLine(old.name,old.regard,old.opinion,{preferred:old.farewellPlan?.tone===farewellTone(old.regard,old.opinion)?old.farewellPlan.text:null})});}return true;}
    if(s.visible!==true || typeof s.name!=='string' || s.name.length>256 || !Array.isArray(s.entries) || s.entries.length>256) return false;
    if(!s.entries.every(e=>e && ['npc','player'].includes(e.role) && typeof e.text==='string' && e.text.length<=8192))return false;
    const entries=s.entries.map(e=>({role:e.role,text:normalize(e.text)}));
    const name=normalize(s.name);let from=0;
    const old=this.talk;
    const prefix=old && old.name===name && old.entries.length<=entries.length && old.entries.every((e,i)=>e.role===entries[i].role && e.text===entries[i].text);
    if(!prefix){
      const context=this.serviceContext;if(context?.talkAvailable&&(context.active||Date.now()-context.closedAt<1500)){
        if(genericBusiness(context.business))this.pendingServiceSpeaker={name,expires:Date.now()+30000};
        else this.emit({type:'service-speaker-link',business:businessKey(context.business),speakerName:name});
        context.talkAvailable=false;
      }else if(this.pendingServiceSpeaker&&this.pendingServiceSpeaker.name!==name)this.pendingServiceSpeaker=null;
      if(this.farewell)this.emit({type:'cancel',reason:'new-conversation'});
      if(old)this.emit({type:'cancel',sessionId:old.id,reason:'talk-replacement'});
      this.talk={id:`talk-${++this.seq}`,name,entries:[]};
      this.emit({type:'session-open',sessionId:this.talk.id,name});
      // Attachment/replacement never reads an old conversation history.
      from=entries.findLastIndex(e=>e.role==='npc');if(from<0)from=entries.length;
    }else {from=old.entries.length;if(from<entries.length)this.emit({type:'cancel',sessionId:old.id,reason:'new-dialogue-turn'});}
    this.talk.entries=entries;
    this.talk.regard=s.regard&&['friend','neutral','enemy','hostile'].includes(s.regard.standing)?{standing:s.regard.standing,value:Number.isFinite(s.regard.value)&&Math.abs(s.regard.value)<=100?s.regard.value:null}:null;
    for(let i=from;i<entries.length;i++)if(entries[i].text && (entries[i].role==='npc'||this.speakPlayer))this.emit({type:'utterance',sessionId:this.talk.id,entryIndex:i,speakerName:name,source:'talk',...entries[i]});
    return true;
  }
  acceptNotice(s){
    if(s.visible===false){if(this.notice)this.emit({type:'cancel',sessionId:this.notice.id,reason:'notice-close'});this.notice=null;return true;}
    if(s.visible!==true || typeof s.owner!=='string' || s.owner.length>256 || typeof s.text!=='string' || s.text.length>8192)return false;
    const text=normalize(s.text);if(this.notice?.owner===s.owner && this.notice.text===text)return true;
    if(this.notice)this.emit({type:'cancel',sessionId:this.notice.id,reason:'notice-revision'});
    this.notice={id:`notice-${++this.seq}`,owner:s.owner,text};
    this.emit({type:'notice-update',sessionId:this.notice.id,source:'notice',role:'narrator',speakerName:'Narrator',text});return true;
  }
  acceptService(s){
    if(s.visible===false){if(this.service)this.emit({type:'cancel',sessionId:this.service.id,reason:'service-close'});this.service=null;if(this.serviceContext){if(!genericBusiness(this.serviceContext.business))this.lastBusiness={name:this.serviceContext.business,seen:Date.now()};this.serviceContext.active=false;this.serviceContext.closedAt=Date.now();}return true;}
    if(s.visible!==true||typeof s.owner!=='string'||s.owner.length>256||typeof s.speakerName!=='string'||s.speakerName.length>256||!['innkeeper','merchant'].includes(s.serviceKind)||typeof s.text!=='string'||s.text.length>8192)return false;
    let business=s.speakerName;
    if(genericBusiness(business)&&this.serviceContext?.active&&!genericBusiness(this.serviceContext.business))business=this.serviceContext.business;
    else if(genericBusiness(business)&&this.lastBusiness&&Date.now()-this.lastBusiness.seen<1500)business=this.lastBusiness.name;
    if(!genericBusiness(business)){
      this.lastBusiness={name:business,seen:Date.now()};
      if(this.pendingServiceSpeaker){if(Date.now()<this.pendingServiceSpeaker.expires)this.emit({type:'service-speaker-link',business:businessKey(business),speakerName:this.pendingServiceSpeaker.name});this.pendingServiceSpeaker=null;}
    }
    this.serviceContext={business,talkAvailable:s.talkAvailable===true,active:true};
    const text=normalize(s.text);if(!text){if(this.service)this.emit({type:'cancel',sessionId:this.service.id,reason:'service-menu'});this.service=null;return true;}if(this.service?.owner===s.owner&&this.service.text===text)return true;
    this.emit({type:'cancel',reason:'service-revision'});this.service={id:`service-${++this.seq}`,owner:s.owner,text};
    this.emit({type:'utterance',sessionId:this.service.id,entryIndex:0,source:'service',role:'npc',speakerName:s.speakerName,serviceKind:s.serviceKind,text});return true;
  }
}
