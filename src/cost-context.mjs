// Data-only copies used after exact callback/module fingerprint validation.
export function copyOwnCostInputs(){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const equip=own(this,'equip'),slots=equip?own(equip,'slots'):undefined;
 if(!Array.isArray(slots)||slots.length>64)return {available:false,reason:'EQUIPPED_SLOT_DATA_UNAVAILABLE'};
 let mora=0,focus=false,power=false;
 for(const item of slots){if(!item)continue;if(own(own(item,'sigil'),'set')==='mora')mora++;
  const affixes=own(item,'affixes');if(affixes!=null&&!Array.isArray(affixes))return {available:false,reason:'EQUIPPED_AFFIX_DATA_UNAVAILABLE'};
  if((affixes??[]).some(a=>own(a,'id')==='focus'&&own(a,'value')>0))focus=true;
  const rarity=own(item,'rarity');if(typeof own(item,rarity==='legendary'?'legendary':rarity==='rare'?'imprint':rarity==='gilded'?'gilded':'')==='string')power=true;
 }
 const wardActive=own(this,'arcanePath')==='wardwright'&&!own(this,'_mentor');
 return {available:true,mentor:!!own(this,'_mentor'),arcanePath:own(this,'arcanePath')??null,mora:{known:mora<4,less:0,reason:mora>=4?'ACTIVE_MORA_SET_REQUIRES_COPY':null},equipment:{known:!focus&&!power,less:0,reason:focus||power?'EQUIPPED_FOCUS_OR_POWER_REQUIRES_COPY':null},wardwright:{known:!wardActive,less:0,reason:wardActive?'ACTIVE_WARDWRIGHT_REQUIRES_COPY':null}};
}

export function copyCourtCostContext(context,focusTable,familyTable,lastBoard,counter){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 if(!context||own(context,'entity')!==this)return {available:true,focusFraction:0,freeReady:false,scope:'No own active Court context.'};
 const vs=own(context,'vs'),focus=own(focusTable,'focus'),values=own(focus,'v'),id=own(focus,'id');
 if(!Array.isArray(vs)||vs.length>128||!Array.isArray(values)||!Number.isFinite(id)||!Number.isFinite(counter))return {available:false,reason:'COURT_COST_DATA_UNAVAILABLE'};
 let rank=0,arcana=0;for(const pair of vs){if(!Array.isArray(pair))return {available:false,reason:'COURT_COST_DATA_INVALID'};if(pair[0]===id)rank=pair[1];if(own(own(familyTable,String(pair[0])),'fam')==='arcana')arcana++;}
 const value=rank?values[rank-1]:0;if(!Number.isInteger(rank)||rank<0||!Number.isFinite(value))return {available:false,reason:'COURT_FOCUS_INVALID'};
 return {available:true,focusFraction:value??0,freeReady:arcana>=3&&lastBoard===own(context,'b')&&counter%4===3,scope:'Only own current Court cost fraction and free-cast readiness; no IDs or other-player state.'};
}

export function copyFirmamentCostValues(){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const symbol=Object.getOwnPropertySymbols(this).find(s=>s.description==='firmament prices'),prices=symbol?own(this,symbol):null,keys=['castCost',...['Destruction','Restoration','Illusion','Alteration','Thaumaturgy','Mysticism'].map(k=>'castCost.'+k)],gains={},costs={};
 for(const k of keys){const a=own(this,k)??0,b=own(prices,k)??0;if(!Number.isFinite(a)||!Number.isFinite(b))return {available:false,reason:'FIRMAMENT_COST_VALUE_INVALID'};gains[k]=a;costs[k]=b;}
 return {available:true,gains,prices:costs};
}

export function copiedModifierRows(player,inputs,court,firmament,schoolFor){
 return (player.spells?.known??[]).map(spell=>{
  const schoolSet=new Set((spell.effects??[]).filter(e=>e.type>-1).map(schoolFor)),keys=['castCost'];if(schoolSet.size===1)keys.push('castCost.'+[...schoolSet][0]);
  let positive=0,price=0;for(const key of keys){positive+=(firmament.gains?.[key]??0)-(firmament.prices?.[key]??0);price+=firmament.prices?.[key]??0;}
  const offensive=(spell.effects??[]).some(e=>e.type===4&&e.subType===0||e.type===1&&e.subType===0);
  return {modifiers:[inputs.mora,{known:court.available,scale:1-(court.focusFraction??0),reason:court.reason},inputs.equipment,inputs.wardwright,{known:firmament.available&&!spell.effectsTruncated,less:Math.min(25,positive)+price,reason:spell.effectsTruncated?'SPELL_EFFECTS_TRUNCATED':firmament.reason}],free:{known:court.available&&(!court.freeReady||!spell.effectsTruncated),value:!!court.freeReady&&offensive,reason:spell.effectsTruncated?'SPELL_EFFECTS_TRUNCATED':court.reason}};
 });
}
