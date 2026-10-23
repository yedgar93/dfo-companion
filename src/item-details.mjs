export function copyOwnedTemplates(custom,extra,indices){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 return indices.slice(0,500).map(index=>{const t=(custom instanceof Map?custom.get(index):null)??own(this,String(index))??(extra instanceof Map?extra.get(index):null);return {index,name:own(t,'name')??null,baseWeight:own(t,'baseWeight')??null,basePrice:own(t,'basePrice')??null,isOneHanded:own(t,'isOneHanded')??null,hasNoEncumbrance:own(t,'hasNoEncumbrance')??false,weaponSkillUsed:own(t,'weaponSkillUsed')??null,enchantmentPoints:own(t,'enchantmentPoints')??null,worldTextureArchive:own(t,'worldTextureArchive')??null,worldTextureRecord:own(t,'worldTextureRecord')??null,playerTextureArchive:own(t,'playerTextureArchive')??null,playerTextureRecord:own(t,'playerTextureRecord')??null,variants:own(t,'variants')??0,isIngredient:own(t,'isIngredient')===true};});
}

export function enrichInventory(items,templates){
 const table=new Map(templates.map(t=>[t.index,t])),factors=[4,5,4,4,3,4,4,2,4,5],materialNames=['Iron','Steel','Silver','Elven','Dwarven','Mithril','Adamantium','Ebony','Orcish','Daedric'];
 const evenRound=v=>{const floor=Math.floor(v);return v-floor===.5?floor%2===0?floor:floor+1:Math.round(v);};
 for(const item of items){const t=table.get(item.templateIndex);if(!t)continue;
  const skillNames=['Medical','Etiquette','Streetwise','Jumping','Orcish','Harpy','Giantish','Dragonish','Nymph','Daedric','Spriggan','Centaurian','Impish','Lockpicking','Mercantile','Pickpocket','Stealth','Swimming','Climbing','Backstabbing','Dodging','Running','Destruction','Restoration','Illusion','Alteration','Thaumaturgy','Mysticism','Short Blade','Long Blade','Hand-to-Hand','Axe','Blunt Weapon','Archery','Critical Strike'];
  for(const a of item.affixes??[]){const v=a.value,p=a.param;const labels={damage:`+${v}% damage`,armor:`+${v} armor`,weight:`+${v}% carrying capacity`,stat:`+${v} ${p}`,resist:`+${v}% ${p} resistance`,skill:`+${v} ${skillNames[p]??'Skill'}`,elemental:`+${v} ${p} damage`,leech:`${v}% life leech on this weapon's own blows`,thorns:`${v} thorns`,focus:`-${v}% spell cost`,slayer:`+${v}% damage vs ${p}`,standing:`+${v} standing with ${p}`,warmth:`+${v} warmth`,dry:`${v}% weatherproof`,castSpeed:`+${v}% casting speed`,potency:`+${v}% spell damage`,wellspring:`${v}% magicka on a kill`,technique:`${p??'Technique'} +${v}%`};a.description=labels[a.id]??null;}
  let weight=item.perUnitWeightKg??t.baseWeight;const material=item.material,water=item.storedStats.water??0;
  if(Number.isFinite(weight)){weight+=water>0?water:0;if(item.perUnitWeightKg===null){
   if(item.group==='Weapons'&&item.templateIndex!==131&&material!==null)weight=evenRound(Math.trunc(weight*4)*(factors[material]??4)/4)/4;
   if(item.group==='Armor'&&material!==null){if(material===0)weight=Math.trunc(Math.trunc(weight*4)/2)/4;else if(material>=512&&material<=521)weight=evenRound(Math.trunc(weight*4)*(factors[material-512]??4)/4)/4;}
  }}else weight=null;
  const metal=item.group==='Armor'?material>=512?material-512:null:item.group==='Weapons'?material:null,modifier=[-1,0,0,1,2,3,3,4,5,6][metal]??0;
  const baseArmor=item.group!=='Armor'?null:[109,110,111,112].includes(item.templateIndex)?item.templateIndex-108:material===0?3:material===256||material===259?6:material>=512&&material<=521?[7,9,9,11,13,15,15,17,19,21][material-512]:null;
  item.displayStats={perUnitWeightKg:weight,stackWeightKg:weight===null?null:Number((weight*item.count).toFixed(6)),materialName:item.group==='Armor'&&material===0?'Leather':item.group==='Armor'&&(material===256||material===259)?'Chain':materialNames[metal]??null,damage:item.group==='Weapons'&&item.storedStats.minDamage!==null&&item.storedStats.maxDamage!==null?{min:item.storedStats.minDamage+modifier,max:item.storedStats.maxDamage+modifier,scope:'Stored base damage plus material modifier; conditional affix/combat bonuses separate'}:null,baseArmour:baseArmor,hands:item.group==='Weapons'&&item.templateIndex!==131&&typeof t.isOneHanded==='boolean'?t.isOneHanded?'One-handed':'Two-handed':null,baseValue:t.basePrice,source:'Copied static template data and reviewed weight/material formulas; no game calculation methods called'};
  item.perUnitWeightKg=weight;item.weight=weight;item.totalStoredStackWeightKg=weight===null?null:weight*item.count;
  item.template={name:t.name,weaponSkillUsed:t.weaponSkillUsed,enchantmentPoints:t.enchantmentPoints,hasNoEncumbrance:t.hasNoEncumbrance,art:{worldTextureArchive:t.worldTextureArchive,worldTextureRecord:t.worldTextureRecord,playerTextureArchive:t.playerTextureArchive,playerTextureRecord:t.playerTextureRecord,variants:t.variants,isIngredient:t.isIngredient}};
 }
}

// Read only a quest Item owned by the player, and only its used-message text.
// Never calls getMessage (which localizes in place), item use, quest hooks,
// random selectors, logs, save functions, or quest update methods.
export function copyOwnLetters(manager){
 const own=(o,k)=>{const d=o&&typeof o==='object'?Object.getOwnPropertyDescriptor(o,k):null;return d&&'value'in d?d.value:undefined;};
 const items=own(this,'items'),quests=own(own(manager,'machine'),'quests');
 if(!Array.isArray(items)||!(quests instanceof Map))return [];
 const out=[];
 for(let index=0;index<Math.min(items.length,500);index++){
  const item=items[index];if(own(item,'group')!=='UselessItems2'||own(item,'templateIndex')!==279||!own(item,'questItem'))continue;
  const quest=quests.get(own(item,'questUID')),resources=own(quest,'resources'),messages=own(quest,'messages'),symbol=own(item,'questSymbol');
  if(!(resources instanceof Map)||!(messages instanceof Map))continue;
  const resource=resources.get(typeof symbol==='string'?symbol:own(symbol,'name')),id=own(resource,'usedMessageID'),message=messages.get(id),variants=own(message,'variants');
  if(!Array.isArray(variants))continue;
  const locations=[];
  const expand=text=>String(text).replace(/(_{1,4})([A-Za-z0-9.]+)_/g,(match,prefix,name)=>{
   const r=resources.get(name);if(!r)return match;
   const associated=own(r,'assignedPlaceSymbol')??own(r,'homePlaceSymbol');
   const place=own(r,'siteDetails')?r:associated?resources.get(typeof associated==='string'?associated:own(associated,'name')):null;
   const site=own(place,'siteDetails');let value;
   if(prefix.length===1)value=own(r,'displayName')??own(site,'buildingName');
   else if(prefix.length===2)value=own(r,'displayName')?own(site,'buildingName'):own(site,'locationName');
   else if(prefix.length===3)value=own(site,'locationName');else value=own(site,'regionName');
   if(typeof value!=='string'||!value)return match;
   if(site){const row={buildingName:own(site,'buildingName')??null,locationName:own(site,'locationName')??null,regionName:own(site,'regionName')??null};if(!locations.some(l=>JSON.stringify(l)===JSON.stringify(row)))locations.push(row);}
   return value;
  }).replaceAll('%pcn',own(this,'name')??'%pcn').replaceAll('%pcf',(own(this,'name')??'%pcf').split(' ')[0]);
  const texts=variants.slice(0,16).map(v=>expand((own(v,'tokens')??[]).slice(0,1024).map(t=>own(t,'text')||(['nothing','center','newline',0].includes(own(t,'formatting'))?'\n':'')).join('')).slice(0,32000));
  out.push({index,kind:'letter',variants:texts,disclosedLocations:locations,resolved:!texts.some(t=>/%\w+|_{1,4}[A-Za-z0-9.]+_/.test(t)),reason:'Stored own-letter variants, with copied name/place macros only. No game expansion hooks, random choice or journal updates.'});
 }
 return out;
}

// Isolated native read transaction. Does not call the game's asset loader or
// open an item UI. Aborts database creation/upgrades and never uses readwrite.
export async function readOwnedBookAsset(filename){
 if(!/^BOK\d{5}\.TXT$/.test(filename))return null;
 const databases=await indexedDB.databases();if(!databases.some(d=>d.name==='project-dagger'))return null;
 const db=await new Promise(resolve=>{let done=false;const finish=db=>{if(done){db?.close();return;}done=true;resolve(db);};const r=indexedDB.open('project-dagger');r.onupgradeneeded=()=>{r.transaction.abort();finish(null);};r.onsuccess=()=>finish(r.result);r.onerror=()=>finish(null);r.onblocked=()=>finish(null);});
 if(!db)return null;
 try{if(!db.objectStoreNames.contains('arena2'))return null;
  const data=await new Promise(resolve=>{const r=db.transaction('arena2','readonly').objectStore('arena2').get(filename);r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>resolve(null);});
  const bytes=data instanceof ArrayBuffer?new Uint8Array(data):ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):null;
  if(!bytes||bytes.length>262144)return null;
  let binary='';for(let n=0;n<bytes.length;n+=8192)binary+=String.fromCharCode(...bytes.subarray(n,n+8192));return btoa(binary);
 }finally{db.close();}
}

// Copied file header/text-token format from reviewed BookFile/TextRsc sources.
// Does not import or execute game code, including BookFile.load's RNG side effect.
export function decodeBookFile(bytes){
 const b=Buffer.from(bytes);if(b.length<236||b.length>262144)throw Error('INVALID_BOOK_DATA');
 const zero=(at,n)=>b.subarray(at,at+n).toString('latin1').split('\0')[0];
 const count=b.readUInt16LE(234);if(count>256||236+count*4>b.length)throw Error('INVALID_BOOK_PAGES');
 const pages=[];let total=0;
 for(let page=0;page<count;page++){const start=b.readUInt32LE(236+page*4);if(start>=b.length)throw Error('INVALID_BOOK_OFFSET');let text='';
  for(let i=start;i<b.length;i++){const ch=b[i];if(ch===246||ch===254)break;if(ch>=32&&ch<=127)text+=String.fromCharCode(ch);else if(ch===0)text+='\n';else if(ch===249||ch===251)i++;if(++total>200000)throw Error('BOOK_TEXT_LIMIT');}
  pages.push(text.trim());
 }
 return {kind:'book',title:zero(0,64),author:zero(64,64),pages,resolved:true,source:'Owned book asset; copied header/text-token decoder; no item opened or marked read.'};
}
