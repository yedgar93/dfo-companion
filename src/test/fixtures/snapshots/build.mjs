// Regenerates the fake dashboard snapshots in this folder by feeding invented raw
// own-player reads through the real DashboardSampler/projectDetails, so the JSON
// matches exactly what /api/state serves. No game connection; no game reads.
// Run: node src/test/fixtures/snapshots/build.mjs
import {writeFileSync,readFileSync} from 'node:fs';
// Town geometry reused from the existing dense-town-pins fixture (same source the design audit harness uses).
const DENSE_TOWN=JSON.parse(readFileSync(new URL('../dense-town-pins.json',import.meta.url),'utf8'));
import {DashboardSampler} from '../../../dashboard-model.mjs';
import {projectDetails} from '../../../dashboard-model.mjs';

const NOW=Date.parse('2026-10-22T18:00:00.000Z'),iso=ms=>new Date(ms).toISOString();
const SKILLS=['Medical','Etiquette','Streetwise','Jumping','Orcish','Harpy','Giantish','Dragonish','Nymph','Daedric','Spriggan','Centaurian','Impish','Lockpicking','Mercantile','Pickpocket','Stealth','Swimming','Climbing','Backstabbing','Dodging','Running','Destruction','Restoration','Illusion','Alteration','Thaumaturgy','Mysticism','Short Blade','Long Blade','Hand-to-Hand','Axe','Blunt Weapon','Archery','Critical Strike'];
const skills=base=>SKILLS.map((name,i)=>({name,display:base+((i*7)%23),permanent:base+((i*7)%23)-(i%5===0?2:0)}));
const attrs=(p,l=p)=>({permanent:p,live:l});
const A={strength:62,intelligence:48,willpower:51,agility:58,endurance:60,personality:44,speed:55,luck:50};
const item=(o)=>({template:{weaponSkillUsed:null,art:null,hasNoEncumbrance:false},identified:true,affixes:[],enchantments:[],customEnchantments:[],count:1,condition:{current:100,max:100},...o});
const fullInventory=[
 item({index:0,name:'Dwarven Long Sword',templateIndex:116,material:4,group:'Weapons',equipSlot:19,template:{weaponSkillUsed:'LongBlade',art:null,hasNoEncumbrance:false},condition:{current:612,max:900},displayStats:{baseArmour:null,damage:{min:5,max:14},hands:1,perUnitWeightKg:2.5},storedStats:{minDamage:5,maxDamage:14},perUnitWeightKg:2.5,totalStoredStackWeightKg:2.5,value:1240,rarity:'Uncommon',description:'A well balanced dwarven blade.'}),
 item({index:1,name:'Steel Kite Shield',templateIndex:110,material:1,group:'Armor',equipSlot:21,condition:{current:210,max:400},displayStats:{baseArmour:4,damage:null,hands:null,perUnitWeightKg:8},perUnitWeightKg:8,totalStoredStackWeightKg:8,value:420}),
 item({index:2,name:'Elven Chain Cuirass',templateIndex:102,material:3,group:'Armor',equipSlot:18,condition:{current:180,max:700},displayStats:{baseArmour:6,damage:null,hands:null,perUnitWeightKg:9},perUnitWeightKg:9,totalStoredStackWeightKg:9,value:2100,enchantments:[{type:2,param:1}],rarity:'Rare'}),
 item({index:3,name:'Iron Plate Helm',templateIndex:103,material:0,group:'Armor',equipSlot:12,condition:{current:95,max:250},displayStats:{baseArmour:3,damage:null,hands:null,perUnitWeightKg:3},perUnitWeightKg:3,totalStoredStackWeightKg:3,value:90}),
 item({index:4,name:'Leather Boots',templateIndex:108,material:0,group:'Armor',equipSlot:26,condition:{current:40,max:100},displayStats:{baseArmour:1,damage:null,hands:null,perUnitWeightKg:1},perUnitWeightKg:1,totalStoredStackWeightKg:1,value:25}),
 item({index:5,name:'Mithril Dagger',templateIndex:113,material:5,group:'Weapons',template:{weaponSkillUsed:'ShortBlade',art:null,hasNoEncumbrance:false},displayStats:{baseArmour:null,damage:{min:4,max:9},hands:1,perUnitWeightKg:1},storedStats:{minDamage:4,maxDamage:9},perUnitWeightKg:1,totalStoredStackWeightKg:1,value:800}),
 item({index:6,name:'Unidentified Ring',templateIndex:0,group:'Jewellery',identified:false,perUnitWeightKg:.1,totalStoredStackWeightKg:.1,value:null}),
 item({index:7,name:'Potion of Healing',templateIndex:0,group:'Potions',count:3,perUnitWeightKg:.5,totalStoredStackWeightKg:1.5,value:60}),
 item({index:8,name:'Arrow',templateIndex:131,material:0,group:'Weapons',count:42,perUnitWeightKg:.02,totalStoredStackWeightKg:.84,value:1}),
 item({index:9,name:'Parcel for Lady Doryn',templateIndex:0,group:'Quest items',questItem:true,perUnitWeightKg:.5,totalStoredStackWeightKg:.5,value:0}),
 item({index:10,name:'Plain Robes',templateIndex:0,group:'Men\'s Clothing',equipSlot:17,perUnitWeightKg:1,totalStoredStackWeightKg:1,value:15}),
 item({index:11,name:'Silver Amulet',templateIndex:0,group:'Jewellery',equipSlot:0,material:2,perUnitWeightKg:.1,totalStoredStackWeightKg:.1,value:300}),
];
const career={primarySkills:[28,20,14],majorSkills:[0,16,21],minorSkills:[2,13,22,23,29,33],weaponArmorShieldsBitfield:0,forbiddenMaterialsFlags:0,abilityFlagsAndSpellPointsBitfield:0,resistanceFlags:0,attackModifierFlags:0};
const sheet=(o={})=>({factions:[{id:201,name:'Fighters Guild',reputation:14},{id:142,name:'The Order of Arkay',reputation:6},{id:1,name:'Daggerfall Court',reputation:-3}],factionsTruncated:false,socialReputations:[5,12,0,-2,3],legalReputation:{'17':4,'20':-8},guildMemberships:{mortal:{fightersGuild:{guild:'Fighters Guild',rank:2,probation:false},templeArkay:{guild:'The Order of Arkay',rank:0,probation:true}},vampire:{}},career,armor:41,armorValues:null,currentBreath:120,reflexes:2,weightAllowanceMultiplier:0,...o});
const journal={available:true,active:[
 {id:'q-courier',name:'Courier to Lady Doryn',complete:false,entries:[{resolved:false,variants:['Deliver the parcel to Lady Doryn at Castle Daggerfall within 2 days.']}],disclosedLocations:[{buildingName:'Castle Daggerfall',locationName:'Daggerfall',regionName:'Daggerfall'}]},
 {id:'q-rats',name:'Rats in the Cellar',complete:false,entries:[{resolved:false,variants:['Clear the rats from the Merry Mermaid cellar.']}],disclosedLocations:[{buildingName:'The Merry Mermaid',locationName:'Daggerfall',regionName:'Daggerfall'}]},
 {id:'q-relic',name:'The Lost Relic',complete:false,entries:[{resolved:true,variants:['Recover the relic from Castle Wolfspire.']}],disclosedLocations:[{buildingName:null,locationName:'Castle Wolfspire',regionName:'Daggerfall'}]},
]};
const tracker={available:true,pinned:'q-courier',journalFocus:'q-courier',source:'Public on-screen tracker and current objective values',views:[
 {id:'q-courier',updatedAt:NOW-60000,title:'Courier to Lady Doryn',objective:'Deliver the parcel to Lady Doryn in Castle Daggerfall',completed:['Collect the parcel'],clockSeconds:41400,destination:{locationName:'Daggerfall',regionName:'Daggerfall',buildingName:'Castle Daggerfall',mapId:null,regionIndex:17}},
 {id:'q-rats',updatedAt:NOW-3600000,title:'Rats in the Cellar',objective:'Clear the rats from the cellar',completed:[],clockSeconds:259200,destination:null},
 {id:'q-relic',updatedAt:NOW-7200000,title:'The Lost Relic',objective:'Search Castle Wolfspire for the relic',completed:['Speak to the sage','Find the map'],clockSeconds:null,destination:null},
]};
const townLoc={available:true,mode:'exterior',place:{name:'Daggerfall',regionName:'Daggerfall',regionIndex:17},position:{x:1234.5,y:0,z:-987.2},mapPixel:{x:207,y:213},orientation:{headingDegrees:90}};
const dungeonLoc={available:true,mode:'dungeon',place:{name:'Castle Wolfspire',regionName:'Daggerfall',regionIndex:17},position:{x:12.5,y:-4,z:33.1},mapPixel:{x:210,y:215},orientation:{headingDegrees:180}};
const raw=(o={})=>({identity:{name:'Aldric Venn',level:8,className:'Spellsword',race:'Breton'},vitals:{health:{current:61,max:84},magicka:{current:40,max:96},fatigue:{current:7360,max:9600,units:'raw x64'}},resources:{goldPieces:1872},attributes:attrs(A,{...A,strength:60}),skills:skills(28),characterSheet:sheet(),inventory:{available:true,truncated:false,items:fullInventory},journal,questTracker:tracker,...o});
const fresh={identity:{name:'Mira',level:1,className:'Warrior',race:'Nord'},vitals:{health:{current:30,max:30},magicka:{current:10,max:10},fatigue:{current:5120,max:5120,units:'raw x64'}},resources:{goldPieces:0},attributes:attrs({strength:55,intelligence:30,willpower:40,agility:45,endurance:55,personality:35,speed:45,luck:45}),skills:skills(5),characterSheet:sheet({factions:[],socialReputations:[0,0,0,0,0],legalReputation:{},guildMemberships:{mortal:{},vampire:{}},armor:0}),inventory:{available:true,truncated:false,items:[]},journal:{available:true,active:[]},questTracker:{available:true,pinned:null,journalFocus:null,views:[],source:'Public on-screen tracker and current objective values'}};

// result = one sampleDashboard() result, built the way dashboard-worker.mjs builds it.
const result=(p,loc,{capturedAt=NOW,detailsAt=capturedAt,deferred=null,interiorMap=null,townMap=null,town=null}={})=>({available:true,reason:null,capturedAt:iso(capturedAt),player:{identity:p.identity,vitals:p.vitals,resources:{goldPieces:p.resources.goldPieces}},pose:{capturedAt:iso(capturedAt),location:loc,town},details:{...projectDetails(p,loc),appearance:null,map:null,townMap,interiorMap},detailsAt:iso(detailsAt),detailsVersion:'fixture|'+iso(detailsAt),assetsKey:loc.mapPixel.x+','+loc.mapPixel.y,timings:{ownReadMs:3,rendererCopyMs:.4,guard:{mode:'idle slices',intervalMs:500,detailsIntervalMs:4000,copyMs:.4,lane:'details'},dungeonCopyMs:null,deferred,lanes:{own:.3,pose:.05,tracker:.04,journal:.02},journalReused:true,totalMs:4}});
async function sequence(list,{nowAt=NOW}={}){let t=nowAt,i=0;const s=new DashboardSampler(async()=>list[i++],{now:()=>t});for(let k=0;k<list.length;k++)await s.poll();return s.snapshot();}

const dungeonMap={available:true,sceneKey:'dungeon|210,215',mode:'dungeon',name:'Castle Wolfspire',capturedAt:iso(NOW),geometry:{available:true,parts:[],truncated:false},trail:[],notes:[],objectives:[],exit:null,objectivesAt:null,scope:'Already explored geometry only; no inferred routes or hidden rooms.'};
const out={
 'town-full':await sequence([result(raw(),townLoc,{townMap:{available:true,pixelKey:'207,213',townName:'Daggerfall',region:17,...DENSE_TOWN},town:{pixelKey:'207,213',origin:[0,0,0],headingDegrees:90,position:{x:240,z:220,frame:'town local'}}})]),
 'dungeon':await sequence([result(raw({vitals:{health:{current:22,max:84},magicka:{current:12,max:96},fatigue:{current:3200,max:9600,units:'raw x64'}}}),dungeonLoc,{interiorMap:dungeonMap})]),
 'new-character':await sequence([result(fresh,{...townLoc,place:{name:'Privateer\'s Hold',regionName:'Daggerfall',regionIndex:17},mode:'dungeon'})]),
 'loading':(()=>new DashboardSampler(async()=>null,{now:()=>NOW}).snapshot())(),
 'stale':await sequence([result(raw(),townLoc,{capturedAt:NOW-15*60000,detailsAt:NOW-20*60000}),{available:false,reason:'READ_FAILED'}]),
 'location-changed':await sequence([result(raw(),townLoc,{capturedAt:NOW-5000}),result(raw(),{...townLoc,mode:'interior',place:{...townLoc.place,buildingKey:9}},{detailsAt:NOW-5000,deferred:{until:iso(NOW+2000),panels:['details','quests']}})]),
 'error-page-changed':await sequence([{available:false,reason:'PAGE_CHANGED'}]),
 'error-canvas-unavailable':await sequence([{available:false,reason:'GAME_CANVAS_UNAVAILABLE'}]),
 'error-game-not-running':await sequence([{available:false,reason:'GAME_NOT_RUNNING'}]),
};
for(const [name,value] of Object.entries(out))writeFileSync(new URL(name+'.json',import.meta.url),JSON.stringify(value,null,1)+'\n');
// Phone brief: exactly what /api/brief derives from the town-full snapshot (see dashboard-server.mjs).
const s=out['town-full'],tr=s.details.questTracker,q=tr.views.find(v=>v.id===tr.pinned);
writeFileSync(new URL('phone-brief.json',import.meta.url),JSON.stringify({status:s.status,stale:s.stale,capturedAt:s.lastSuccess,detailsAt:s.detailsAt,player:s.player,location:s.pose?.location??null,quest:{title:q.title,objective:q.objective,destination:q.destination,completed:q.completed},attributes:s.details.attributes,inventoryCount:s.details.items.length,readOnly:true},null,1)+'\n');
console.log('wrote',Object.keys(out).length+1,'fixtures');
