import fs from 'node:fs';import {createHash} from 'node:crypto';
const rows=JSON.parse(fs.readFileSync(new URL('./vendor/dfo-formats/paperdoll-templates.json',import.meta.url),'utf8'));
const templates=new Map(rows.map(t=>[t.index,t]));
const RACES=['Breton','Redguard','Nord','DarkElf','HighElf','WoodElf','Khajiit','Argonian'];
const CLOAKS=new Set([154,155,191,192]);
export const DYE_NAMES=['Iron','Steel',null,'Elven','Dwarven','Mithril','Adamantium','Ebony','Orcish','Daedric'];
const dyes=[15,16,18,19,20,21,22,23,24,25];
function armorVariant(index,m,v){const leather=m===0,chain=m===256||m===259,clamp=(a,b)=>Math.max(a,Math.min(b,v));if(index===102)return leather?0:chain?4:clamp(1,3);if(index===104)return leather?clamp(0,1):chain?6:clamp(2,5);if(index===105||index===106)return leather?0:chain?4:clamp(1,3);if(index===103)return leather?0:1;if(index===108)return leather?0:clamp(1,2);return v;}
export function itemLayer(item,identity){const t=templates.get(item.templateIndex);if(!t)return null;const race=identity.race,morph=race==='Argonian'?0:['DarkElf','HighElf','WoodElf'].includes(race)?1:race==='Khajiit'?3:2;const body=(identity.gender==='female'?245:249)+morph,m=Number.isFinite(item.material)?item.material:0,v=item.appearance?.variant??item.storedStats?.variant??0,dye=item.appearance?.dye??item.storedStats?.dye??0,msg=item.appearance?.message??(/\bFur\b/.test(item.name??'')?1:0);let archive=t.playerTextureArchive,record=t.playerTextureRecord,target=1,color=item.group==='Weapons'?(dyes[m]??18):(m>=512?dyes[m-512]??18:18);
 if(item.templateIndex>=515&&item.templateIndex<=519){archive=body;record=({515:m===0?3:7,516:m===0?10:m>=256&&m<514?11:16,517:m===0?17:21,518:m===0?22:26,519:0})[item.templateIndex];}
 else if(item.templateIndex>=520&&item.templateIndex<=526){archive=item.templateIndex;let off=body-245,leather=16;if(item.templateIndex===522){if([1,2,3].includes(off)){off=2;leather=16;}else if([4,6].includes(off)){off=6;leather=17;}else if(off===0){off=1;leather=18;}else if([5,7].includes(off)){off=5;leather=19;}}else{off=off<4?2:6;leather=off<4?16:17;}record=m===0&&msg===1?off:m>=512?8+off:leather;}
 else if(item.group==='MensClothing'||item.group==='WomensClothing'){archive+=morph;record+=(t.variants>0?(CLOAKS.has(item.templateIndex)?1:0)+Math.min(v,t.variants-1):0);target=0;color=dye;}
 else if(item.group==='Armor'){archive=body;record+=(t.variants>0?armorVariant(item.templateIndex,m,v):0);}
 else if(item.group==='Weapons'){if(item.equipSlot===19&&t.isOneHanded)record++;}
 else if(item.group==='Jewellery'&&item.equipSlot>11){target=null;color=null;}
 else return null;
 return {kind:'texture',archive,record,dye:color,target,slot:item.equipSlot,name:item.name??t.name,order:t.drawOrderOrEffect??0};}
export function appearancePlan(player){const identity=player.identity??{},ri=RACES.indexOf(identity.race);if(ri<0||!['male','female'].includes(identity.gender))return {available:false,reason:'CHARACTER_APPEARANCE_UNAVAILABLE'};const code=identity.gender==='female'?`1${ri}`:`0${ri}`,worn=(player.inventory?.items??[]).filter(i=>Number.isInteger(i.equipSlot)&&i.equipSlot>=0),layers=[],missing=[];
 const cloak=worn.find(i=>i.equipSlot===16&&CLOAKS.has(i.templateIndex))??worn.find(i=>i.equipSlot===14&&CLOAKS.has(i.templateIndex));if(cloak){const t=templates.get(cloak.templateIndex),morph=['DarkElf','HighElf','WoodElf'].includes(identity.race)?1:identity.race==='Argonian'?0:identity.race==='Khajiit'?3:2;layers.push({kind:'texture',archive:t.playerTextureArchive+morph,record:t.playerTextureRecord,target:0,dye:cloak.appearance?.dye??cloak.storedStats?.dye??0,name:'Cloak lining',slot:cloak.equipSlot});}
 layers.push({kind:'img',file:`BODY${code}I0.IMG`,name:'Body',body:true});if(!worn.some(i=>[17,18].includes(i.equipSlot)))layers.push({kind:'img',file:`BODY${code}I1.IMG`,rows:[0,40],body:true,name:'Base clothing'});if(!worn.some(i=>i.equipSlot===24))layers.push({kind:'img',file:`BODY${code}I1.IMG`,rows:[40,null],body:true,name:'Base clothing'});
 if(Number.isInteger(identity.faceIndex))layers.push({kind:'cif',file:`FACE${code}I0.CIF`,record:Math.max(0,Math.min(9,identity.faceIndex)),name:'Face',body:true});else missing.push('Face');
 for(const item of worn.filter(i=>i.equipSlot>11).sort((a,b)=>(templates.get(a.templateIndex)?.drawOrderOrEffect??0)-(templates.get(b.templateIndex)?.drawOrderOrEffect??0))){const layer=itemLayer(item,identity);if(layer)layers.push(layer);else missing.push(item.name??'Unsupported item');}
 const background={kind:'img',file:`SCBG0${ri}I0.IMG`,background:true,name:'Background'};
 const key=createHash('sha256').update(JSON.stringify({identity:{race:identity.race,gender:identity.gender,face:identity.faceIndex},layers})).digest('hex').slice(0,24);
 return {available:true,key,width:110,height:184,identity:{race:identity.race,gender:identity.gender,faceIndex:identity.faceIndex},background,layers,missing};}
