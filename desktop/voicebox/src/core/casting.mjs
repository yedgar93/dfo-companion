import fs from 'node:fs';
import {businessKey} from './service-identity.mjs';
export {businessKey} from './service-identity.mjs';
const banks=JSON.parse(fs.readFileSync(new URL('../../data/dfo-name-banks.json',import.meta.url),'utf8'));
const key=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
export function speakerFor(event,settings){if(event.source!=='service')return event.speakerName;return Object.entries(settings.serviceSpeakers??{}).find(([business])=>businessKey(business)===businessKey(event.speakerName))?.[1]??event.speakerName;}
const bankNames=['Breton','Redguard','Nord','DarkElf','HighElf','WoodElf','Khajiit','Imperial'];
function matches(parts,text){let calls=0;function walk(index,offset){if(++calls>10000)return false;if(index===parts.length)return offset===text.length;for(const part of parts[index])if(text.startsWith(part,offset)&&walk(index+1,offset+part.length))return true;return false;}return walk(0,0);}
export function generatedGender(name){
  const text=key(name),found=[];if(!text||text.length>256)return {gender:'unknown',source:'none'};
  for(const bankName of bankNames){const sets=banks[bankName].sets.map(s=>s.parts.map(key));
    for(const gender of ['male','female']){
      let choices;
      if(bankName==='Redguard')choices=gender==='male'?[sets[0],sets[1],sets[2],['',...sets[3]]]:[sets[0],sets[1],sets[2],sets[4]];
      else{const first=gender==='male'?[sets[0],sets[1]]:[sets[2],sets[3]];const surname=bankName==='Nord'?[sets[0],sets[1],['sen']]:[sets[4],sets[5]];choices=[...first,[' '],...surname];}
      if(matches(choices,text))found.push({bank:bankName,gender});
    }
  }
  const genders=new Set(found.map(x=>x.gender));return {gender:genders.size===1?[...genders][0]:'unknown',source:found.length?'dfo-name-banks':'none',ambiguous:genders.size>1,banks:found.map(x=>x.bank)};
}
export function crc32(text){let value=0xffffffff;for(const byte of Buffer.from(text)){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;}
export function characterPitch(event,settings){
  const tolerance=Number(settings.pitchVariation??0);
  if(!Number.isFinite(tolerance)||tolerance<0||tolerance>.15)throw Error('Pitch variation must be between 0 and 0.15');
  if(event.source==='notice'||!event.speakerName)return 1;
  return Math.round((1+tolerance*(2*crc32('pitch-v1|'+key(speakerFor(event,settings)))/0xffffffff-1))*1000000)/1000000;
}
export function characterSpeed(event,settings){
  const base=Number(settings.speed??1),variation=Number(settings.speedVariation??0);
  if(!Number.isFinite(base)||base<.5||base>2||!Number.isFinite(variation)||variation<0||variation>.15)throw Error('Invalid speaking speed/variation');
  const factor=event.source==='notice'||!event.speakerName?1:1+variation*(2*crc32('speed-v1|'+key(speakerFor(event,settings)))/0xffffffff-1);
  return Math.round(Math.max(.5,Math.min(2,base*factor))*1000000)/1000000;
}
export function castVoice(event,settings){
  if(event.source==='notice')return {voice:settings.narratorVoice,gender:'narrator',source:'narrator-setting'};
  if(event.source==='service'){
    const explicit=Object.entries(settings.serviceVoices??{}).find(([business])=>businessKey(business)===businessKey(event.speakerName))?.[1];
    if(explicit)return {voice:explicit,gender:'override',source:'service-voice-override'};
    const speaker=speakerFor(event,settings);if(speaker!==event.speakerName)return {...castVoice({...event,source:'talk',speakerName:speaker},settings),source:'linked-service-speaker'};
    return {voice:settings[event.serviceKind+'Voice']??settings.narratorVoice,gender:'configured-service',source:'service-setting'};
  }
  const speaker=key(event.speakerName);
  const override=Object.entries(settings.voicesByName??{}).find(([name])=>key(name)===speaker)?.[1];if(override)return {voice:override,gender:'override',source:'voice-override'};
  if(settings.casting!=='gendered')return {voice:settings.voice,gender:'unknown',source:'fixed-setting'};
  const explicit=Object.entries(settings.gendersByName??{}).find(([name])=>key(name)===speaker)?.[1];
  const proof=['male','female'].includes(explicit)?{gender:explicit,source:'explicit-npc-gender'}:generatedGender(event.speakerName);
  const pool=settings.voicePools?.[proof.gender];
  return {...proof,voice:Array.isArray(pool)&&pool.length?pool[crc32(speaker)%pool.length]:(settings.unknownGender==='ask'?null:settings.voice)};
}
