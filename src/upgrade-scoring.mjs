// Item-upgrade scoring, phase 1: carried items against equipped ones, from the existing snapshot only.
// No game reads. Every formula below cites its home in daggerfall-js-source (DFO) and Daggerfall Unity (DFU).
// A missing input yields null (shown as "?"), never a guessed value.

// DFU DFCareer.Skills / DFO SKILL ids: weapon skills 28..33, Critical Strike 34.
export const WEAPON_SKILLS=['Short Blade','Long Blade','Hand-to-Hand','Axe','Blunt Weapon','Archery'];
const MAGIC_SKILLS=new Set(['Destruction','Restoration','Illusion','Alteration','Thaumaturgy','Mysticism']);
const STEALTH_SKILLS=new Set(['Stealth','Lockpicking','Pickpocket','Backstabbing']);
const SKILL_KEYS={shortblade:'Short Blade',longblade:'Long Blade',handtohand:'Hand-to-Hand',axe:'Axe',bluntweapon:'Blunt Weapon',missileweapon:'Archery',archery:'Archery'};
// DFO combat/formulas.js:169 WEAPON_MATERIAL_MODIFIER (DFU DaggerfallUnityItem.GetWeaponMaterialModifier): Iron..Daedric.
export const WEAPON_MATERIAL_MODIFIER=[-1,0,0,1,2,3,3,4,5,6];
// DFO combat/formulas.js:172 STRUCK_BODY_PARTS (DFU FormulaHelper.CalculateStruckBodyPart): 20 entries.
// Head 2, Right arm 3, Left arm 3, Chest 4, Hands 4, Legs 3, Feet 1.
export const STRUCK_WEIGHTS=[2,3,3,4,4,3,1].map(n=>n/20);
// DFO systems/armorMaterials.js:45-60 (DFU DaggerfallUnityItem.GetMaterialArmorValue / GetShieldArmorValue).
const PLATE_ARMOR_VALUES=[7,9,9,11,13,15,15,17,19,21];
const SHIELD_VALUES={109:1,110:2,111:3,112:4};
const SHIELD_PARTS={109:[2,4],110:[2,4,5],111:[2,4,5],112:[0,2,4,5]};
// Template -> body part (DFU ItemEquipTable / DFO equip.js armorBodyParts): cuirass, gauntlets, greaves, left/right pauldron, helm, boots.
const FOOTWEAR=new Set([147,148,149,186,187,188]);
const ARMOR_PART={102:3,103:4,104:5,105:2,106:1,107:0,108:6};
const CUSTOM_ARMOR_PART={515:3,516:5,517:2,518:1,519:6,520:3,521:5,522:0,523:6,524:4,525:2,526:1};
// Reference foe for hit chance (an assumption, stated in every reason): a monster with DFU ArmorValue 5 on the
// struck part (armorValues 25), agility/luck 50 and no Dodging. DFO calculateSuccessfulHit (formulas.js:384) then adds
// armour 25 + monster +40 - flat 50 (adjustmentsToHit) = +15.
export const REFERENCE_FOE_TO_HIT=15;

const fin=v=>Number.isFinite(v);
const skillKey=i=>SKILL_KEYS[String(i?.template?.weaponSkillUsed??i?.classRestriction?.weaponKind??'').replace(/[^a-z]/gi,'').toLowerCase()]??null;
const tr=Math.trunc;

/** Build profile from class, skill groups, skill values and worn gear. Pure; same snapshot -> same profile. */
export function inferProfile(context={}){
 const skills=context.skills??[],value=name=>skills.find(s=>s.name===name)?.display,groups=context.skillGroups??{};
 const favoured=new Set([...(groups.primarySkills??[]),...(groups.majorSkills??[])].map(s=>typeof s==='number'?SKILL_NAMES[s]:s).filter(Boolean));
 const flags=context.careerFlags;
 const forbidden=n=>fin(flags)&&!!(flags&(1<<WEAPON_SKILLS.indexOf(n)));
 const weapons=WEAPON_SKILLS.filter(n=>fin(value(n))&&!forbidden(n)).map(n=>({name:n,value:value(n),favoured:favoured.has(n),expert:fin(flags)&&!!((flags>>>16)&(1<<WEAPON_SKILLS.indexOf(n)))}))
  .sort((a,b)=>Number(b.favoured)-Number(a.favoured)||b.value-a.value);
 const preferredWeapons=weapons.length?weapons.filter(w=>w.favoured).slice(0,2).map(w=>w.name):[];
 if(!preferredWeapons.length&&weapons.length)preferredWeapons.push(weapons[0].name);
 const armorClasses=['Leather','Chain','Plate'];
 const allowedArmor=fin(flags)?armorClasses.filter((_,i)=>!(flags&(1<<(6+i)))):null;
 const worn=(context.worn??[]).filter(i=>i.group==='Armor'&&!SHIELD_VALUES[i.templateIndex]&&fin(i.material));
 const counts=[0,0,0];for(const i of worn){let m=i.material;if(i.templateIndex>=515&&i.templateIndex<=519&&m>=512)m-=256;else if(i.templateIndex>=520&&i.templateIndex<=526&&m>=512)m-=512;counts[m>=512?2:m>=256?1:0]++;}
 const wornClass=worn.length?armorClasses[counts.indexOf(Math.max(...counts))]:null;
 const count=set=>[...favoured].filter(n=>set.has(n)).length;
 const magic=count(MAGIC_SKILLS),stealth=count(STEALTH_SKILLS),combat=[...favoured].filter(n=>WEAPON_SKILLS.includes(n)||n==='Critical Strike'||n==='Dodging').length;
 const lean=!favoured.size?null:magic>combat&&magic>=stealth?'magic':stealth>combat&&stealth>magic?'stealth':'combat';
 return {skillNames:skills.map(s=>s.name),favouredSkills:[...favoured],className:context.className??null,preferredWeapons,weaponSkills:weapons,armorClass:allowedArmor?(wornClass&&allowedArmor.includes(wornClass)?wornClass:allowedArmor.at(-1)??null):wornClass,allowedArmor,lean,known:!!skills.some(s=>fin(s.display))&&fin(flags)};
}

/** DFO formulas.js:88 damageModifier = floor((STR-50)/5) (DFU FormulaHelper.DamageModifier). */
export const damageModifier=str=>Math.floor((str-50)/5);
/** DFO formulas.js proficiencyModifiers (DFU FormulaHelper.CalculateProficiencyModifiers). */
function proficiency(context,skill){const flags=context.careerFlags,level=context.level;if(!fin(flags)||!fin(level))return null;const bit=1<<WEAPON_SKILLS.indexOf(skill);return ((flags>>>16)&0x3f&bit)?{damage:tr(level/3)+1,toHit:level}:{damage:0,toHit:0};}
/** DFO formulas.js racialModifiers (DFU FormulaHelper.CalculateRacialModifiers). */
function racial(context,skill){const race=context.race,level=context.level;if(!race||!fin(level))return null;if(race==='DarkElf')return tr(level/4);if(skill==='Archery')return race==='WoodElf'?tr(level/3):0;return race==='Redguard'?tr(level/3):0;}

/** Expected damage per landed swing and hit chance against the reference foe. Null fields -> unknown. */
export function weaponScore(item,context={}){
 const d=item?.displayStats?.damage,skill=skillKey(item),a=context.attributes??{},missing=[];
 if(!fin(d?.min)||!fin(d?.max))missing.push('weapon damage');
 else if(!Number.isInteger(d.min)||!Number.isInteger(d.max)||d.min<0||d.max<d.min||d.max-d.min>2048)missing.push('a bounded weapon damage range');
 if(!skill)missing.push('weapon skill');
 const skillRow=context.skills?.find(s=>s.name===skill),skillValue=skill?(skillRow?.effective??skillRow?.display):null;if(skill&&!fin(skillValue))missing.push(skill+' skill value');
 if(!fin(a.strength))missing.push('Strength');if(!fin(a.agility)||!fin(a.luck))missing.push('Agility/Luck');
 if(!fin(item?.material))missing.push('weapon material');
 const prof=skill?proficiency(context,skill):null,race=skill?racial(context,skill):null;if(skill&&(!prof||race===null))missing.push('class expertise, race or level');
 const pct=(item?.affixes??[]).filter(x=>x.id==='damage').reduce((n,x)=>n+(fin(x.value)?x.value:NaN),0);if(!fin(pct))missing.push('damage affix value');
 if(missing.length)return {known:false,missing,skill};
 // Display range already includes the material modifier (DFO itemInfo.js:297 weaponDamageRange), matching
 // weaponAttackDamage (formulas.js:478): roll base, +material, then the swing's mods.
 const mod=WEAPON_MATERIAL_MODIFIER[item.material]??0,flat=damageModifier(a.strength)+prof.damage+race;let total=0,n=0;
 for(let roll=d.min-mod;roll<=d.max-mod;roll++){let dmg=(pct?tr(roll*(1+pct/100)):roll)+mod+flat;if(dmg<1)dmg=0;total+=dmg;n++;}
 const expected=n?total/n:0;
 // calculateAttackDamage (formulas.js:597+): skill + proficiency + racial + material*10; then calculateSuccessfulHit:
 // statsToHit (luck, agility vs 50), Critical Strike's expected bonus (floor(crit/10) with chance crit%), clamp 3..97.
 const crit=context.skills?.find(s=>s.name==='Critical Strike')?.display;
 const raw=skillValue+prof.toHit+race+mod*10+tr((a.luck-50)/10)+tr((a.agility-50)/10)+REFERENCE_FOE_TO_HIT;
 const clamp=v=>Math.max(3,Math.min(97,v));
 const hit=fin(crit)?(clamp(raw+Math.floor(crit/10))*Math.min(crit,100)+clamp(raw)*(100-Math.min(crit,100)))/100:clamp(raw);
 return {known:true,skill,skillValue,expectedDamage:expected,hitChance:hit/100,perSwing:expected*hit/100,missing:[]};
}

/** Armour on each body part, in DFU's doll units scaled to hit-chance points: material/shield value *5 plus armour-affix points
 *  (DFO lootRarity.js affixFold: 'armor' points off the chance to land on the piece's own parts). */
export function armorParts(item){
 const parts=new Array(7).fill(0);
 // DFO equip.js updateEquippedArmorValues: clothing Shoes/Tall boots/Boots (147-149, 186-188) count as leather (3) on the
 // feet; sandals (150, 189) and all other clothing give nothing.
 if(FOOTWEAR.has(item?.templateIndex)&&(item.group==='MensClothing'||item.group==='WomensClothing')){parts[6]=3*5;return {known:true,parts};}
 if(item?.group!=='Armor')return {known:true,parts};
 const t=item.templateIndex,shield=SHIELD_VALUES[t];let value=null,covered=null;
 if(shield){value=shield;covered=SHIELD_PARTS[t];}
 else{covered=fin(ARMOR_PART[t])?[ARMOR_PART[t]]:fin(CUSTOM_ARMOR_PART[t])?[CUSTOM_ARMOR_PART[t]]:null;
  // Non-shield armour artifacts are halved (armorMaterials.js itemArmorValue, DFU :1054-1056). The snapshot only says
  // "special" (artifact, legendary, aetheric or sigil), so a special non-shield piece is unknown rather than guessed.
  if(item.special&&typeof item.artifact!=='boolean')return {known:false,parts,missing:['special armour rating (artifacts are halved)']};
  if(t>=515&&t<=526)value=customArmorValue(item);
  else if(fin(item.displayStats?.baseArmour))value=item.displayStats.baseArmour;
  else if(t<512&&fin(item.material)){const m=item.material;value=m===0?3:m===0x100||m===0x103?6:m>=0x200&&m<=0x209?PLATE_ARMOR_VALUES[m-0x200]:null;}
  if(item.artifact&&value!==null&&t<512)value=Math.trunc(value/2);}
 if(!covered||value===null)return {known:false,parts,missing:['armour value or body part']};
 let affix=0;for(const x of item.affixes??[])if(x.id==='armor'){if(!fin(x.value))return {known:false,parts,missing:['armour affix value']};affix+=x.value;}
 for(const p of covered)parts[p]+=value*5+affix;
 return {known:true,parts};
}
/** Average hit-chance points a blow loses to this set (struck-part frequency weighted). */
export const armorProtection=parts=>parts.reduce((n,v,i)=>n+v*STRUCK_WEIGHTS[i],0);

// Enchantment weighting: how much a point of each attribute matters for the build's lean. Unknown ids -> '?'.
const STAT_WEIGHT={combat:{strength:1,agility:1,endurance:1,speed:.7,luck:.5,willpower:.2,intelligence:.1,personality:.1},magic:{intelligence:1,willpower:1,endurance:.5,agility:.4,speed:.4,luck:.5,strength:.2,personality:.2},stealth:{agility:1,speed:1,luck:.8,endurance:.5,strength:.4,intelligence:.3,willpower:.3,personality:.4}};
const KNOWN_AFFIX=new Set(['armor','damage','weight','stat','resist','skill','focus','castSpeed','potency','warmth','dry','leech','thorns','wellspring','elemental','slayer','technique','standing']);
/** Weight of one enchantment line for this build, or null when its effect on the build is unknown. */
export function affixWeight(x,profile){
 if(!KNOWN_AFFIX.has(x?.id))return null;
 if(x.id==='resist'&&!['fire','frost','shock','poison','magic'].includes(x.param))return null;
 if(x.id==='stat'){if(!STAT_WEIGHT.combat[x.param])return null;return profile.mix?Object.entries(profile.mix).reduce((v,[k,w])=>v+w*STAT_WEIGHT[k][x.param],0):STAT_WEIGHT[profile.lean??'combat'][x.param];}
 if(x.id==='skill'){const name=typeof x.param==='number'?SKILL_NAMES[x.param]:x.param;return !SKILL_NAMES.includes(name)?null:profile.preferredWeapons.includes(name)?1:(profile.favouredSkills??[]).includes(name)?.6:.2;}
 const magic=profile.mix?.magic??(profile.lean==='magic'?1:0);
 return {armor:1,damage:1,weight:.3,resist:.4,focus:.1+.9*magic,castSpeed:.1+.7*magic,potency:.1+.9*magic,leech:.6,thorns:.4,wellspring:.1+.5*magic,elemental:.8,slayer:.4,technique:.5,warmth:.1,dry:.1,standing:.2}[x.id]??null;
}
/** Signed enchantment value for this build; drawbacks (negative values) count against. */
export function enchantmentValue(items,profile){
 let value=0;const unknown=[];
 for(const i of items)for(const x of i?.affixes??[]){
  if(x.id==='armor'||x.id==='damage')continue;
  const w=affixWeight(x,profile);
  if(w===null||!fin(x.value)){unknown.push('an enchantment whose effect on this build is unknown');continue;}
  value+=w*x.value;
 }
 return {value,unknown};
}

// MAGIC.DEF enchantment types (DFO formats/magicDef.js:23-28) that phase 1 scores; any other type is "?".
export const ENCHANT={IncreasedWeightAllowance:7,StrengthensArmor:12,WeakensArmor:24};
const HANDLED=new Set(Object.values(ENCHANT));
const has=(i,type)=>(i?.enchantmentTypes??[]).some(e=>e.type===type);
/** Set-level enchantment effects of swapping `incoming` for `removed` within `worn`.
 *  StrengthensArmor: -5 on every body part's armour value, which does not stack (enchantments.js:131-133 keeps the
 *  lowest), so it is worth 5 hit-chance points on every blow only when nothing else worn already has it.
 *  WeakensArmor: inert - its setter (enchantments.js:134-136) only accepts amounts below the zeroed channel, matching
 *  DFU, so it never applies. IncreasedWeightAllowance: +25% (param 0) or +50% (param 1), highest only. */
export function setEnchantments(incoming,removed,worn){
 const rest=worn.filter(i=>!removed.includes(i)),unknown=[],notes=[];
 for(const i of [incoming,...removed]){const list=i?.enchantmentTypes;if(!list)continue;for(const e of list)if(!fin(e.type)||!HANDLED.has(e.type))unknown.push('an enchantment type that is not scored yet');}
 const before=[...rest,...removed].some(i=>has(i,ENCHANT.StrengthensArmor)),after=[...rest,incoming].some(i=>has(i,ENCHANT.StrengthensArmor));
 const armor=(after?5:0)-(before?5:0);
 if(has(incoming,ENCHANT.StrengthensArmor)&&before&&after)notes.push('Strengthens Armor does not stack with the one you already wear.');
 if(has(incoming,ENCHANT.WeakensArmor))notes.push('Weakens Armor has no effect in the game (bug kept from Daggerfall Unity).');
 const allowance=set=>Math.max(0,...set.flatMap(i=>(i?.enchantmentTypes??[]).filter(e=>e.type===ENCHANT.IncreasedWeightAllowance).map(e=>e.param===1?50:25)));
 const carry=allowance([...rest,incoming])-allowance([...rest,...removed]);
 return {armor,carry,unknown,notes};
}
export const isArmourPiece=i=>i?.group==='Armor'||(FOOTWEAR.has(i?.templateIndex)&&(i.group==='MensClothing'||i.group==='WomensClothing'));

// Pure snapshot-only recommendation model. These weights are product preferences,
// not DFO formulas. Mechanics reviewed at Lattymoy/daggerfall-js-source b0765ab2:
// rriItems.js, lootRarity.js affixFold, skills.js, weaponStates.js and handsLaw.js.
// Combat mods/settings, enemy defences and player tactics are intentionally not
// guessed. Scores describe an estimated build fit, never guaranteed live DPS.
export const SKILL_NAMES=['Medical','Etiquette','Streetwise','Jumping','Orcish','Harpy','Giantish','Dragonish','Nymph','Daedric','Spriggan','Centaurian','Impish','Lockpicking','Mercantile','Pickpocket','Stealth','Swimming','Climbing','Backstabbing','Dodging','Running','Destruction','Restoration','Illusion','Alteration','Thaumaturgy','Mysticism','Short Blade','Long Blade','Hand-to-Hand','Axe','Blunt Weapon','Archery','Critical Strike'];

// The live template cache is optional, and template JSON does not own computed
// weaponSkillUsed getters. Static ID mappings must therefore exist independently.
// DFO b0765ab2 characters/{itemTemplates.json,weapons.js,equipRules.js},
// systems/roleplayRealismItems/rriItems.js and systems/{thunderlock,pistolet}.js.
const WEAPON_ROWS=[
 ['ShortBlade',.5,1,6,false],['ShortBlade',.75,1,8,false],['BluntWeapon',2,1,8,true],
 ['ShortBlade',2.5,1,8,false],['ShortBlade',2,1,10,false],['LongBlade',5,1,12,false],
 ['LongBlade',3.75,3,12,false],['LongBlade',4.5,2,16,false],['LongBlade',2.5,3,16,false],
 ['LongBlade',7.5,2,18,true],['LongBlade',3.5,3,21,true],['BluntWeapon',4.5,1,12,false],
 ['BluntWeapon',7,2,14,true],['BluntWeapon',7,3,18,true],['Axe',6,2,12,false],
 ['Axe',7.5,2,16,true],['Archery',1,4,16,true],['Archery',1.5,4,18,true]
];
const EXTRA_WEAPON_ROWS={513:['Axe',3,2,10,false],514:['BluntWeapon',4,3,10,false],560:['Archery',6,7,26,true],562:['Archery',2.5,4,15,false]};
const evenRound=v=>{const f=Math.floor(v);return v-f===.5?(f%2===0?f:f+1):Math.round(v);};

/** Fill only missing display data on a newly projected item, never on DFO data. */
export function completeEquipmentData(item){
 const stats=item.displayStats??{},m=item.material,t=item.templateIndex;
 if(item.group==='Weapons'){
  const row=WEAPON_ROWS[t-113]??EXTRA_WEAPON_ROWS[t];if(!row)return item;
  const [skill,weight,min,max,both]=row,modifier=WEAPON_MATERIAL_MODIFIER[m];
  item.template={...item.template,weaponSkillUsed:item.template?.weaponSkillUsed??skill};
  let damage=stats.damage;
  if((!fin(damage?.min)||!fin(damage?.max))&&fin(modifier))damage={
   min:(fin(item.storedStats?.minDamage)?item.storedStats.minDamage:min)+modifier,
   max:(fin(item.storedStats?.maxDamage)?item.storedStats.maxDamage:max)+modifier};
  const fallbackWeight=fin(modifier)?evenRound(Math.trunc(weight*4)*([4,5,4,4,3,4,4,2,4,5][m])/4)/4:null;
  item.displayStats={...stats,damage,hands:stats.hands??(both?'Two-handed':'One-handed'),perUnitWeightKg:fin(stats.perUnitWeightKg)?stats.perUnitWeightKg:fin(item.perUnitWeightKg)?item.perUnitWeightKg:fallbackWeight};
 }else if(item.group==='Armor'){
  const armor=SHIELD_VALUES[t]??(t>=515&&t<=526?customArmorValue(item):t>=102&&t<=108?(m===0?3:m===256||m===259?6:PLATE_ARMOR_VALUES[m-512]??null):null);
  item.displayStats={...stats,baseArmour:fin(stats.baseArmour)?stats.baseArmour:armor,perUnitWeightKg:stats.perUnitWeightKg??item.perUnitWeightKg??null};
 }
 return item;
}

export function customArmorValue(item){
 const t=item?.templateIndex,m=item?.material;
 if(!Number.isInteger(t)||t<515||t>526||!Number.isInteger(m))return null;
 if(t<=519){if(m===0)return 3;if(m===256||m===259)return 5;return [6,8,8,9,11,13,13,15,17,18][m-512]??null;}
 if(m===0){const message=item.appearance?.message;return message===0?3:message===1?5:null;}
 if(m===256||m===259)return 6;
 return [5,7,7,8,9,11,11,12,13,14][m-512]??null;
}

export function buildProfile(context={},worn=[]){
 const profile=inferProfile({...context,worn}),groups=context.skillGroups??{};
 const priority=new Map;
 for(const [key,weight] of [['primarySkills',3],['majorSkills',2],['minorSkills',1]])for(const id of groups[key]??[]){const name=typeof id==='number'?SKILL_NAMES[id]:id;if(SKILL_NAMES.includes(name))priority.set(name,Math.max(priority.get(name)??0,weight));}
 const totals={combat:0,magic:0,stealth:0};
 for(const s of context.skills??[]){if(!fin(s.permanent??s.display))continue;const value=Math.max(0,s.permanent??s.display),strength=(priority.get(s.name)??0)+value/50;
  if(WEAPON_SKILLS.includes(s.name)||['Dodging','Critical Strike'].includes(s.name))totals.combat+=strength;
  if(MAGIC_SKILLS.has(s.name))totals.magic+=strength;
  if(STEALTH_SKILLS.has(s.name))totals.stealth+=strength;
 }
 const sum=Object.values(totals).reduce((a,b)=>a+b,0);
 profile.mix=sum?Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v/sum])):{combat:1,magic:0,stealth:0};
 profile.lean=Object.keys(totals).sort((a,b)=>totals[b]-totals[a])[0];
 profile.label=Object.entries(profile.mix).filter(([,v])=>v>=.25).map(([k])=>k).join(' / ')||profile.lean;
 return profile;
}

const rolledTiers=new Set(['magic','rare','legendary','exalted']);
function totalsFor(items){
 const totals=new Map,rolled=new Map,own=new Map;
 for(const item of items)for(const x of item.affixes??[]){
  if(!fin(x.value))continue;
  const key=x.id+'|'+String(x.param??''),old=totals.get(key);
  totals.set(key,{...x,value:(old?.value??0)+x.value});
  if(x.id==='resist'){const map=rolledTiers.has(item.rarity)?rolled:own;map.set(key,(map.get(key)??0)+x.value);}
 }
 for(const [key,row]of totals)if(row.id==='resist'){const designed=own.get(key)??0;row.value=designed+Math.min(rolled.get(key)??0,Math.max(0,45-designed));}
 return totals;
}

/** Change only the copied context; never mutate the current snapshot or gear. */
export function contextAfterSwap(context,beforeItems,afterItems){
 const before=totalsFor(beforeItems),after=totalsFor(afterItems),attributes={...context.attributes};
 const difference=(id,param)=>(after.get(id+'|'+param)?.value??0)-(before.get(id+'|'+param)?.value??0);
 for(const key of Object.keys(attributes))if(fin(attributes[key]))attributes[key]=Math.max(0,Math.min(Math.max(100,attributes[key]),attributes[key]+difference('stat',key)));
 const skills=(context.skills??[]).map(s=>{const delta=difference('skill',SKILL_NAMES.indexOf(s.name))+difference('skill',s.name);return {...s,display:fin(s.display)?Math.max(0,s.display+delta):s.display,effective:fin(s.effective)?Math.max(0,s.effective+delta):s.effective};});
 return {...context,attributes,skills};
}

// DFO SWING-LAW's five-frame reference swing, including weight, STR and handling.
// Optional mod clocks/archery draws are not represented as exact DPS.
export function weaponTempo(item,context){
 const speed=context.attributes?.speed,str=context.attributes?.strength,w=item.displayStats?.perUnitWeightKg;
 if(!fin(speed)||!fin(str)||!fin(w)||w<0)return null;
 const kind=skillKey(item),t=item.templateIndex;
 if(kind==='Archery'||![113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,513,514].includes(t))return null;
 const handling=['Short Blade','Hand-to-Hand'].includes(kind)?.9:kind==='Axe'?1.05:kind==='Blunt Weapon'?(t===115?.97:t===124?1.03:t===127?1.05:1.06):1;
 const both=item.displayStats?.hands==='Two-handed';
 const heft=1+Math.min(.35,Math.max(0,(w*(150-Math.max(0,Math.min(100,str)))/100-2.5)*.045));
 const frame=195/980*(1+(50-Math.max(0,Math.min(100,speed)))/100*.8)*heft*handling*(both?1.06:1);
 return 5*Math.max(.09,Math.min(.4,frame));
}

/** A bounded evaluator shared by every carried candidate in one pack snapshot. */
export function createBuildEvaluator(context,worn,profile=buildProfile(context,worn)){
 const beforeTotals=totalsFor(worn);
 const offense=(items,ctx)=>{
  const weapons=items.filter(i=>i.group==='Weapons'&&[19,21].includes(i.equipSlot));
  if(!weapons.length){
   const row=ctx.skills?.find(s=>s.name==='Hand-to-Hand'),skill=row?.effective??row?.display;
   if(!fin(skill))return {value:0,perSwing:0,known:false,tempoKnown:false};
   const fists={group:'Weapons',templateIndex:113,material:1,template:{weaponSkillUsed:'HandToHand'},affixes:[],displayStats:{damage:{min:Math.floor(skill/10)+1,max:Math.floor(skill/5)+1},hands:'One-handed',perUnitWeightKg:0}};
   const score=weaponScore(fists,ctx),tempo=weaponTempo(fists,ctx);
   return {value:score.known?score.perSwing/(tempo??1):0,perSwing:score.perSwing??0,known:score.known,tempoKnown:tempo!==null};
  }
  const scores=weapons.map(i=>{const s=weaponScore(i,ctx),tempo=weaponTempo(i,ctx);return {known:s.known,value:s.known?s.perSwing/(tempo??1):0,perSwing:s.perSwing??0,tempoKnown:tempo!==null};});
  return {known:scores.every(s=>s.known),value:scores.reduce((n,s)=>n+s.value,0)/scores.length,perSwing:scores.reduce((n,s)=>n+s.perSwing,0)/scores.length,tempoKnown:scores.every(s=>s.tempoKnown)};
 };
 const baselineOffense=offense(worn,context);
 return (candidate,removed,slot)=>{
  const after=worn.filter(i=>!removed.includes(i));after.push({...candidate,equipSlot:slot});
  const afterContext=contextAfterSwap(context,worn,after),afterTotals=totalsFor(after),unknown=[],components=[],notes=[];
  let delta=0;const add=(label,value)=>{if(Math.abs(value)>1e-8){components.push({label,delta:value});delta+=value;}};
  const keys=new Set([...beforeTotals.keys(),...afterTotals.keys()]);
  for(const key of keys){const a=afterTotals.get(key),b=beforeTotals.get(key),row=a??b,change=(a?.value??0)-(b?.value??0);if(!change||['armor','damage'].includes(row.id))continue;
   const weight=affixWeight(row,profile);if(weight===null){unknown.push('An affix parameter cannot be evaluated for this build.');continue;}
   let effective=change;
   if(row.id==='stat'){if(fin(context.attributes?.[row.param]))effective=afterContext.attributes[row.param]-context.attributes[row.param];}
   add(row.id+' '+(row.param??''),effective*weight);
  }
  // Re-score retained weapons as well: removing a +STR ring or weapon-skill
  // shield changes the weapon left in hand. The live baseline already has them.
  const changesWeapon=candidate.group==='Weapons'||removed.some(i=>i.group==='Weapons');
  const changesCombatStats=[...keys].some(k=>{const r=afterTotals.get(k)??beforeTotals.get(k);return ['stat','skill'].includes(r.id)&&(afterTotals.get(k)?.value??0)!==(beforeTotals.get(k)?.value??0);});
  let offensiveChange=null;
  if(changesWeapon||changesCombatStats){const next=offense(after,afterContext);if(baselineOffense.known&&next.known){
    const clocksKnown=baselineOffense.tempoKnown&&next.tempoKnown;offensiveChange=clocksKnown?next.value-baselineOffense.value:next.perSwing-baselineOffense.perSwing;
    const sameWeaponBasis=!changesWeapon||removed.some(i=>i.group==='Weapons'&&i.templateIndex===candidate.templateIndex);
    if(!sameWeaponBasis&&!clocksKnown)notes.push('Draw, reload and swing timing are not included: weapon output is compared per attack, not per second.');
    add('reference weapon output',offensiveChange*(1+profile.mix.combat));
   }else if(changesWeapon&&!(removed.length===1&&removed[0].group==='Weapons'&&candidate.templateIndex===removed[0].templateIndex&&candidate.material===removed[0].material))unknown.push('Weapon output cannot be estimated from these item and character stats.');}
  // Compare only changed protection. Unknown retained effects cancel; unknown
  // removed/incoming armour cannot silently become zero.
  const incoming=armorParts(candidate),outgoing=removed.filter(isArmourPiece).map(armorParts);
  if(isArmourPiece(candidate)||outgoing.length){
   if(incoming.known&&outgoing.every(p=>p.known))add('armor protection',armorProtection(incoming.parts)-outgoing.reduce((n,p)=>n+armorProtection(p.parts),0));
   else if(!(removed.length===1&&candidate.group==='Armor'&&removed[0].group==='Armor'&&candidate.templateIndex===removed[0].templateIndex&&candidate.material===removed[0].material&&(candidate.templateIndex<520||candidate.material!==0||Number.isInteger(candidate.appearance?.message)&&candidate.appearance.message===removed[0].appearance?.message)&&!candidate.special&&!removed[0].special))unknown.push('Base armor protection is unavailable for this swap.');
   else add('armor bonus',(candidate.affixes??[]).filter(a=>a.id==='armor').reduce((n,a)=>n+a.value,0)-(removed[0].affixes??[]).filter(a=>a.id==='armor').reduce((n,a)=>n+a.value,0));
  }
  const ench=setEnchantments(candidate,removed,worn);add('Strengthens Armor',ench.armor);add('carry allowance',ench.carry*.3);
  const changesResist=[...keys].some(k=>k.startsWith('resist|')&&(afterTotals.get(k)?.value??0)!==(beforeTotals.get(k)?.value??0));
  if((changesResist||ench.armor||ench.carry)&&worn.some(i=>!removed.includes(i)&&(i.identified!==true||i.magicKnown===false||i.effectsComplete===false)))unknown.push('Stacking and caps are uncertain while other worn magical properties are unknown.');
  unknown.push(...ench.unknown);
  const neededOutput=!(changesWeapon||changesCombatStats)||offensiveChange!==null;
  return {known:unknown.length===0&&profile.known&&neededOutput,delta,components,unknowns:[...new Set(unknown)],notes,offensiveChange,profile:profile.label,model:'Estimated build fit; reference combat and inferred priorities. Enemy, combat mods and tactics can change results.'};
 };
}
