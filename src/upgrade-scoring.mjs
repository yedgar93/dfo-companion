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
 const favoured=new Set([...(groups.primarySkills??[]),...(groups.majorSkills??[])].map(s=>typeof s==='number'?skills[s]?.name:s).filter(Boolean));
 const flags=context.careerFlags;
 const forbidden=n=>fin(flags)&&!!(flags&(1<<WEAPON_SKILLS.indexOf(n)));
 const weapons=WEAPON_SKILLS.filter(n=>fin(value(n))&&!forbidden(n)).map(n=>({name:n,value:value(n),favoured:favoured.has(n),expert:fin(flags)&&!!((flags>>>16)&(1<<WEAPON_SKILLS.indexOf(n)))}))
  .sort((a,b)=>Number(b.favoured)-Number(a.favoured)||b.value-a.value);
 const preferredWeapons=weapons.length?weapons.filter(w=>w.favoured).slice(0,2).map(w=>w.name):[];
 if(!preferredWeapons.length&&weapons.length)preferredWeapons.push(weapons[0].name);
 const armorClasses=['Leather','Chain','Plate'];
 const allowedArmor=fin(flags)?armorClasses.filter((_,i)=>!(flags&(1<<(6+i)))):null;
 const worn=(context.worn??[]).filter(i=>i.group==='Armor'&&!SHIELD_VALUES[i.templateIndex]&&fin(i.material));
 const wornClass=worn.length?armorClasses[Math.max(...worn.map(i=>i.material>=0x200?2:i.material>=0x100?1:0))]:null;
 const count=set=>[...favoured].filter(n=>set.has(n)).length;
 const magic=count(MAGIC_SKILLS),stealth=count(STEALTH_SKILLS),combat=[...favoured].filter(n=>WEAPON_SKILLS.includes(n)||n==='Critical Strike'||n==='Dodging').length;
 const lean=!favoured.size?null:magic>combat&&magic>=stealth?'magic':stealth>combat&&stealth>magic?'stealth':'combat';
 return {skillNames:skills.map(s=>s.name),favouredSkills:[...favoured],className:context.className??null,preferredWeapons,weaponSkills:weapons,armorClass:allowedArmor?(wornClass&&allowedArmor.includes(wornClass)?wornClass:allowedArmor.at(-1)??null):wornClass,allowedArmor,lean,known:!!favoured.size&&fin(flags)};
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
 if(!skill)missing.push('weapon skill');
 const skillValue=skill?context.skills?.find(s=>s.name===skill)?.display:null;if(skill&&!fin(skillValue))missing.push(skill+' skill value');
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
 const parts=new Array(7).fill(0);if(item?.group!=='Armor')return {known:true,parts};
 const t=item.templateIndex,shield=SHIELD_VALUES[t];let value=null,covered=null;
 if(shield){value=shield;covered=SHIELD_PARTS[t];}
 else{covered=fin(ARMOR_PART[t])?[ARMOR_PART[t]]:fin(CUSTOM_ARMOR_PART[t])?[CUSTOM_ARMOR_PART[t]]:null;
  if(fin(item.displayStats?.baseArmour))value=item.displayStats.baseArmour;
  else if(t<512&&fin(item.material)&&!item.special){const m=item.material;value=m===0?3:m===0x100||m===0x103?6:m>=0x200&&m<=0x209?PLATE_ARMOR_VALUES[m-0x200]:null;}}
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
 if(x.id==='stat')return STAT_WEIGHT[profile.lean??'combat'][x.param]??null;
 if(x.id==='skill'){const name=typeof x.param==='number'?(profile.skillNames?.[x.param]??null):x.param;return name==null?null:profile.preferredWeapons.includes(name)?1:(profile.favouredSkills??[]).includes(name)?.6:.2;}
 const magic=profile.lean==='magic';
 return {armor:1,damage:1,weight:.3,resist:.4,focus:magic?1:.1,castSpeed:magic?.8:.1,potency:magic?1:.1,leech:.6,thorns:.4,wellspring:magic?.6:.1,elemental:.8,slayer:.4,technique:.5,warmth:.1,dry:.1,standing:.2}[x.id]??null;
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
