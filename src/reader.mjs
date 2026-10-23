// This function is the complete renderer boundary. It takes no user expression,
// calls no game methods, imports nothing, and writes only newly allocated objects.
export function readPlayer(playerOverride,dashboard=false,dashboardSlice=null) {
  const own = (o, k) => {
    if (!o || typeof o !== 'object') return undefined;
    const d = Object.getOwnPropertyDescriptor(o, k);
    return d && 'value' in d ? d.value : undefined;
  };
  const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const text = v => typeof v === 'string' ? v.slice(0, 120).replace(/[\u0000-\u001f\u007f]/g, '') : null;
  const val = (o,k) => own(o,k);
  const n = (o,k) => num(val(o,k));
  const str = (o,k) => text(val(o,k));
  const description = (o,k) => {const v=val(o,k);return typeof v==='string'?v.slice(0,600).replace(/[\u0000-\u001f\u007f]/g,''):null;};
  const data = (o, keys) => Object.fromEntries(keys.map(k => [k, num(val(o,k))]));
  const list = (o,k,limit) => { const a=val(o,k); return Array.isArray(a) ? a.slice(0,limit) : []; };
  // Applied only to explicitly selected owner-visible spell/class/progression
  // fields, never an entity, account, networking, scene or quest object graph.
  const copyData=(v,depth=0)=>{
   if(v===null||typeof v==='boolean')return v;if(typeof v==='number')return num(v);if(typeof v==='string')return v.slice(0,2000);
   if(!v||typeof v!=='object'||depth>4)return null;
   if(Array.isArray(v)||ArrayBuffer.isView(v))return Array.from(v).slice(0,128).map(x=>copyData(x,depth+1));
   const out={};for(const k of Object.keys(v).slice(0,64)){const d=Object.getOwnPropertyDescriptor(v,k);if(d&&'value'in d&&typeof d.value!=='function')out[k]=copyData(d.value,depth+1);}return out;
  };
  const spell=s=>({name:str(s,'name'),index:n(s,'index'),icon:n(s,'icon'),cost:n(s,'cost'),path:str(s,'path'),element:n(s,'element'),rangeType:n(s,'rangeType'),rri:val(s,'rri')===true,effectsTruncated:Array.isArray(val(s,'effects'))&&val(s,'effects').length>16,minimumCastingCost:val(s,'minimumCastingCost')===true,effects:list(s,'effects',16).map(e=>data(e,['type','subType','durationBase','durationMod','durationPerLevel','chanceBase','chanceMod','chancePerLevel','magnitudeBaseLow','magnitudeBaseHigh','magnitudeLevelBase','magnitudeLevelHigh','magnitudePerLevel']))});
  const p = playerOverride ?? own(window, '__playerEntity');
  if (!p || val(p,'isPlayer') !== true || val(p,'peer')) return {available:false, reason:'PLAYER_SURFACE_UNAVAILABLE'};
  const itemsOnly=dashboard&&dashboardSlice?.section==='items';
  const keys = ['strength','intelligence','willpower','agility','endurance','personality','speed','luck'];
  const effects = list(p,'activeEffects',128);
  const stats = itemsOnly?{}:data(val(p,'stats'),keys);
  const mods = val(p,'_mods');
  const mentor = val(p,'_mentor');
  // Pure formula checked against the installed equip-ILA-RpDX.js, 0.1.10161.
  function liveStat(k) {
    if (stats[k] === null) return null;
    const base = stats[k] - (n(val(mentor,'statCut'),k) ?? 0);
    let mod=0, max=0, survival=0, curse=0;
    for (const e of effects) {
      const kind=str(e,'kind'), ended=val(e,'ended') === true;
      if (!ended) max += n(val(e,'statMaxMods'),k) ?? 0;
      const map=n(val(e,'statMods'),k) ?? 0;
      if (kind==='disease' || kind==='poison') mod += map;
      else if (kind==='racialOverride') {if(!ended) {if(map<0)curse+=map;else mod+=map;}}
      else if(kind==='artifact') {if(!ended)mod+=map;}
      else if(kind==='survival') survival+=map;
      else if(str(e,'stat')===k) {
        if(kind==='fortifyAttribute')mod+=n(e,'magnitude')??0;
        else if(kind==='drainAttribute'||kind==='transferAttribute')mod-=n(e,'magnitude')??0;
      }
    }
    mod += n(val(mods,'stats'),k)??0;
    max += n(val(mods,'statMax'),k)??0;
    if(curse<0)curse=-Math.min(-curse,Math.max(0,Math.min(Math.max(base+mod,0),100)-1));
    mod+=curse;
    if(survival<0)survival=-Math.min(-survival,Math.max(0,Math.min(base,Math.min(Math.max(base+mod,0),100))-5));
    return Math.min(Math.max(base+mod+survival,0),100+max);
  }
  const effectsTruncated=Array.isArray(val(p,'activeEffects'))&&val(p,'activeEffects').length>128;
  const live = itemsOnly?{}:Object.fromEntries(keys.map(k=>[k,effectsTruncated?null:liveStat(k)]));
  const skillNames=['Medical','Etiquette','Streetwise','Jumping','Orcish','Harpy','Giantish','Dragonish','Nymph','Daedric','Spriggan','Centaurian','Impish','Lockpicking','Mercantile','Pickpocket','Stealth','Swimming','Climbing','Backstabbing','Dodging','Running','Destruction','Restoration','Illusion','Alteration','Thaumaturgy','Mysticism','Short Blade','Long Blade','Hand-to-Hand','Axe','Blunt Weapon','Archery','Critical Strike'];
  const skills=itemsOnly?[]:skillNames.map((name,id)=>{
    const pinned=n(val(p,'skillOverrides'),String(id));
    const raw=val(p,'skills');
    const permanent=pinned??(typeof raw==='number'?num(raw):n(raw,String(id)));
    if(permanent===null)return {name,permanent:null,display:null};
    if(pinned!==null)return {name,permanent,display:pinned,effectiveCasting:pinned};
    const masteryOn=val(p,'_online')===true||val(p,'masterSkills')===true,mastered=list(p,'masteredSkills',35).includes(id);
    let display=permanent>100&&!(masteryOn&&mastered)?100:permanent;
    const factor=n(mentor,'skillFactor'),ceiling=n(mentor,'skillCeiling');
    if(mentor && display>30 && factor!==null && ceiling!==null)display=Math.max(Math.min(display,30),Math.min(display,ceiling,Math.floor(30+(display-30)*factor)));
    let mod=n(val(val(p,'_enchantMods'),'skillMods'),String(id))??0;
    for(const e of effects)if(str(e,'kind')==='racialOverride'&&val(e,'ended')!==true)mod+=n(val(e,'skillMods'),String(id))??0;
    mod+=n(val(mods,'skills'),String(id))??0;
    const scaled=display>100?Math.floor(100+(Math.min(200,display)-100)*.25+(display>=125?2:0)+(display>=150?3:0)+(display>=175?4:0)+(display>=200?6:0)):display;
    return {name,permanent,display:effectsTruncated?null:display+mod,effectiveCasting:effectsTruncated?null:scaled+mod};
  });
  // Own standing data only. Native Map iteration bypasses game-provided methods.
  const factions=[];let factionsTruncated=false;const factionMap=val(val(p,'factionRep'),'dict');
  if(!itemsOnly&&factionMap instanceof Map){const iterator=Map.prototype.values.call(factionMap);for(let i=0;i<1024;i++){const step=iterator.next();if(step.done)break;const row=step.value,rep=n(row,'rep');if(rep!==null&&rep!==0){if(factions.length>=96){factionsTruncated=true;break;}factions.push({id:n(row,'id'),name:str(row,'name'),reputation:rep});}if(i===1023)factionsTruncated=true;}}
  const allItems=val(p,'items'),lightSource=val(p,'lightSource');
  const copyItems=source=>(Array.isArray(source)?source.slice(itemsOnly?dashboardSlice.start:0,itemsOnly?Math.min(500,dashboardSlice.end):500):[]).map((item,index)=>{
   const flag=val(item,'isIdentified')??val(item,'identified');
   // Reviewed inventory predicate LW: ordinary items need no identification.
   const magical=list(item,'enchantments',32).length>0||list(item,'customEnchantments',32).length>0;
   const identified=!magical||flag===true;
   const perUnitWeight=n(item,'weightInKg')??n(item,'weight');
   const count=n(item,'stackCount')??1;
   const enchantment=e=>({name:str(e,'name'),description:description(e,'description'),kind:str(e,'kind'),key:str(e,'key'),type:n(e,'type')??str(e,'type'),param:n(e,'param')??str(e,'param'),magnitude:n(e,'magnitude'),duration:n(e,'duration')});
   return {
    index:index+(itemsOnly?dashboardSlice.start:0),name:str(item,'name')??str(item,'shortName'),group:str(item,'group'),templateIndex:n(item,'templateIndex'),
    count,material:str(item,'material')??n(item,'material'),appearance:{dye:n(item,'dye'),variant:n(item,'variant'),message:n(item,'message')},iconSource:{worldTextureArchive:n(item,'worldTextureArchive'),worldTextureRecord:n(item,'worldTextureRecord'),playerTextureArchive:n(item,'playerTextureArchive'),playerTextureRecord:n(item,'playerTextureRecord')},
    equipSlot:(item===lightSource||(!lightSource&&n(item,'templateIndex')===248&&val(item,'beltLantern')===true))?27:n(item,'equipSlot')??str(item,'equipSlot'),
    condition:{current:n(item,'currentCondition'),max:n(item,'maxCondition')},
    weight:perUnitWeight,perUnitWeightKg:perUnitWeight,totalStoredStackWeightKg:perUnitWeight===null?null:perUnitWeight*count,value:n(item,'value'),identified,
    description:identified===true?(description(item,'description')??description(item,'shortDescription')):null,
    enchantments:identified===true?list(item,'enchantments',32).map(enchantment):null,
    customEnchantments:identified===true?list(item,'customEnchantments',32).map(enchantment):null,
    rarity:identified===true?str(item,'rarity'):null,
    affixes:identified?list(item,'affixes',16).map(e=>({id:str(e,'id'),name:str(e,'name'),key:str(e,'key'),kind:str(e,'kind'),stat:str(e,'stat'),param:n(e,'param')??str(e,'param'),magnitude:n(e,'magnitude'),value:n(e,'value')})):null,
    bookId:val(item,'group')==='Books'?n(item,'message'):null,
    storedStats:data(item,['minDamage','maxDamage','armorValue','toHitModifier','damageModifier','water','potent','quality','gilded','horseBond','dye','variant','flags']),
    questItem:val(item,'questItem')===true,artifact:!!val(item,'artifact'),
    cardCode:str(item,'card'),potionRecipeKey:n(item,'potionRecipeKey'),poisonType:n(item,'poisonType'),poisonCharges:n(item,'poisonCharges'),
    legendary:identified?str(item,'legendary'):null,aetheric:identified?str(item,'aetheric'):null,sigil:identified?str(item,'sigil'):null,
    cardDecks:val(item,'templateIndex')===582?list(item,'decks',16).map(d=>({name:str(d,'name'),cards:list(d,'cards',80).filter(v=>typeof v==='string').map(v=>text(v))})):null,
    detailsScope:'Stored own-item fields only; unidentified magical details omitted; missing computed tooltip fields remain null.'
   };
  });
  const items=dashboardSlice?.section==='base'?[]:copyItems(allItems),storage=dashboard?{}:Object.fromEntries([['wagon','wagonItems'],['bag','bagItems']].map(([name,key])=>{const source=val(p,key);return[name,{available:Array.isArray(source),items:copyItems(source),truncated:Array.isArray(source)&&source.length>500,scope:'Stored own '+name+' inventory only; presence does not establish access or proximity.'}];}));
  if(itemsOnly)return {available:true,inventory:{available:Array.isArray(allItems),items,truncated:Array.isArray(allItems)&&allItems.length>500},total:Math.min(500,Array.isArray(allItems)?allItems.length:0)};
  // Never invoke game accessors. The cached-module path has no V8 side-effect
  // guard around import, so only own data properties cross this boundary.
  const maximum = key => n(p,key);
  const career=val(p,'career'),magickaFlag=n(career,'abilityFlagsAndSpellPointsBitfield')??4096;
  const magickaFactor=({0:3,4:2,8:1.75,12:1.5,16:1,20:.5})[(magickaFlag&7168)>>8]??1;
  const calculatedMaxMagicka=career&&live.intelligence!==null?Math.max(0,Math.floor(live.intelligence*magickaFactor)+(n(p,'maxMagickaModifier')??0)+Math.max(0,Math.trunc(n(p,'renownMp')??0))+Math.max(0,Math.trunc(n(mods,'magicka')??0))):null;
  return {
    available:true,
    identity:{name:str(p,'name'),race:str(p,'race'),gender:str(p,'gender'),faceIndex:n(p,'faceIndex'),level:n(p,'level'),className:str(val(p,'career'),'name'),careerIndex:n(p,'careerIndex')},
    characterSheet:{factions,factionsTruncated,socialReputations:itemsOnly?null:copyData(val(p,'sGroupReputations')),legalReputation:itemsOnly?null:copyData(val(p,'legalRep')),guildMemberships:itemsOnly?null:copyData(val(p,'guildMemberships')),career:copyData(val(p,'career')),armor:n(p,'armor'),armorValues:copyData(val(p,'armorValues')),currentBreath:n(p,'currentBreath'),reflexes:n(p,'reflexes'),weightAllowanceMultiplier:(n(val(p,'_enchantMods'),'weightAllowanceMult')??0)+(n(mods,'weightMult')??0)},
    progression:dashboard?null:{onlineMode:typeof val(p,'_online')==='boolean'?val(p,'_online'):null,levelProgress:n(p,'levelProgress'),levelingSystem:str(p,'levelingSystem'),readyToLevelUp:val(p,'readyToLevelUp')===true,pendingLevel:n(p,'pendingLevel'),pendingBonusPool:n(p,'pendingBonusPool'),startingLevelUpSkillSum:n(p,'startingLevelUpSkillSum'),currentLevelUpSkillSum:n(p,'currentLevelUpSkillSum'),skillProgress:copyData(val(p,'skillProgress')),skillUses:copyData(val(p,'skillUses')),masteredSkills:copyData(val(p,'masteredSkills')),arcanePath:copyData(val(p,'arcanePath')),martialPath:copyData(val(p,'martialPath'))},
    spells:dashboard?{known:[],pending:[]}:{known:list(p,'spells',256).map(spell),pending:list(p,'spellsPending',64).map(spell),readied:{available:false,reason:'REQUIRES_REVIEWED_WORLD_MAGIC_CONTEXT'},truncated:Array.isArray(val(p,'spells'))&&val(p,'spells').length>256},
    resources:dashboard?{goldPieces:n(p,'goldPieces')}:{goldPieces:n(p,'goldPieces'),survival:copyData(val(p,'survival')),isResting:val(p,'isResting')===true,restKind:str(p,'restKind'),isLoitering:val(p,'isLoitering')===true,gameMinutes:n(p,'lastGameMinutes'),legalReputation:n(p,'legalRep'),crimeCommitted:n(p,'crimeCommitted'),inPrison:val(p,'inPrison')===true,guildMemberships:copyData(val(p,'guildMemberships')),gameBankAccounts:list(p,'bankAccounts',64).map(a=>({...data(a,['regionIndex','accountGold','loanTotal','loanDueDate']),hasDefaulted:val(a,'hasDefaulted')===true}))},
    vitals:{health:{current:n(p,'health'),max:maximum('maxHealth'),renownBonus:Math.max(0,Math.trunc(n(p,'renownHp')??0)),spireBonus:Math.max(0,Math.trunc(n(p,'spireHp')??0)),limiter:n(p,'maxHealthLimiter')},magicka:{current:n(p,'magicka'),max:maximum('maxMagicka')??calculatedMaxMagicka,calculation:'Copied rxe formula: live Intelligence, career multiplier, own modifiers/renown'},fatigue:{current:n(p,'fatigue'),max:live.strength!==null&&live.endurance!==null?(live.strength+live.endurance)*64:null,units:'raw x64'}},
    attributes:{permanent:stats,live,calculation:'Copied reviewed live-stat formula; active fingerprints are in readerProfile'},skills,
    inventory:{available:Array.isArray(allItems),items,storage,truncated:Array.isArray(allItems)&&allItems.length>500},
    activeEffects:dashboard?[]:effects.filter(e=>val(e,'ended')!==true).map(e=>({kind:str(e,'kind'),name:str(e,'name'),stat:str(e,'stat'),magnitude:n(e,'magnitude'),roundsRemaining:n(e,'roundsRemaining'),statMods:data(val(e,'statMods'),keys)})),
    activeEffectsTruncated:effectsTruncated,
    location:null,
    visibleContext:{available:false,reason:'USE_CONTEXT_LOCATION_SHOPS_OR_MAP_COMMAND'},
    limitations:['Status contains only the player object; use context/location/shops/map for the separately verified navigation reads.','No nearby hidden entities, chat, accounts, or other players.','Item names are stored labels and may omit localization or dynamic modifiers; weights are stored values, not computed template fallbacks.','Skills display values are sheet values, not combat formula values.']
  };
}

// Constant only: neither the CLI nor MCP accepts an expression or CDP command.
export const PLAYER_EXPRESSION = `(${readPlayer.toString()})()`;
