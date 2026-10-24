import {Conversations} from './core/conversations.mjs';
import {readCurrentOpinion} from './core/opinion-core.mjs';
import {PortableSpeech} from './speech.mjs';
export function createVoiceBox({worker,player,settings,onStatus=()=>{},onSettingsChanged=()=>{},readOpinion=null}){
  player.setVolume(settings.volume??1);const speech=new PortableSpeech({worker,player,settings,onStatus});let opinionSession=null,lastNotice=null;
  const machine=new Conversations(event=>{
    if(event.type==='cancel')speech.cancel(event.sessionId);
    if(event.type==='utterance')speech.enqueue(event);
    if(event.type==='notice-update'){lastNotice=event;if(settings.notices==='auto')speech.enqueue(event);}
    if(event.type==='service-speaker-link'){settings.serviceSpeakers??={};settings.serviceSpeakers[event.business]=event.speakerName;onSettingsChanged(settings);}
  },settings);
  return {
    enable:()=>speech.enable(),disable:()=>speech.disable(),stop:()=>speech.cancel(),
    replay(){if(speech.last){speech.cancel();speech.enqueue(speech.last);}},
    readNotice(){if(lastNotice){speech.cancel();speech.enqueue(lastNotice);}},
    volume(value){player.setVolume(value);settings.volume=value;onSettingsChanged(settings);},
    pace(speed,variation){if(!Number.isFinite(speed)||speed<.5||speed>2||!Number.isFinite(variation)||variation<0||variation>.15)throw Error('Invalid speed/variation');settings.speed=speed;settings.speedVariation=variation;speech.warmFarewell(machine.planFarewell());onSettingsChanged(settings);},
    accept(snapshot){const accepted=machine.accept(snapshot);if(accepted&&snapshot.type==='talk'&&snapshot.visible&&machine.talk){speech.warmFarewell(machine.planFarewell());if(readOpinion&&opinionSession!==machine.talk.id){const sessionId=machine.talk.id;opinionSession=sessionId;Promise.resolve(readOpinion(snapshot.name)).then(opinion=>{if(machine.setOpinion(snapshot.documentId,sessionId,snapshot.name,opinion))speech.warmFarewell(machine.planFarewell());}).catch(error=>onStatus({state:'opinion-unavailable',message:error.message}));}}return accepted;},
    reset(){lastNotice=null;machine.reset();},
    // Caller supplies Companion's already-verified CDP connection. No OS port probes.
    readOpinionFromConnection:readCurrentOpinion,
  };
}
