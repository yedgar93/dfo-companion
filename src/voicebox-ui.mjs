import {WebAudioPlayer} from './voicebox-audio.mjs';
// Desktop-only module. No HTTP controls, phone audio, or independent game reads.
export function installVoiceBox({document:doc=document,bridge=globalThis.dfoCompanion?.voiceBox,Audio=globalThis.AudioContext}={}){
  if(!bridge||!Audio)return null;
  const panel=doc.createElement('section');panel.className='voicebox-settings';panel.setAttribute('aria-label','VoiceBox');
  panel.innerHTML='<div class="voicebox-controls"><label><input type="checkbox" id="voicebox-enabled"> Enable VoiceBox</label><label class="voicebox-volume" for="voicebox-volume">Volume <input type="range" id="voicebox-volume" min="0" max="100" value="80" step="1"></label></div><p id="voicebox-help" role="status">Local NPC voices. Downloads once, stays ready while enabled.</p>';
  const quiet=doc.querySelector('.quiet-settings');if(!quiet)return null;quiet.after(panel);
  const checkbox=panel.querySelector('#voicebox-enabled'),volume=panel.querySelector('#voicebox-volume'),help=panel.querySelector('p');let player=null,context=null,disposed=false;
  const messages={disabled:'Local NPC voices. Downloads once, stays ready while enabled.',preparing:'Preparing local voices…',downloading:'Downloading voices once; speech stays local afterwards.',waiting:'Voices ready. Launch DFO from Companion to connect.',listening:'Local NPC voices, ready for dialogue. Disable to free speech memory.',unsupported:'This game’s dialogue UI is unavailable. Companion still works normally.',unavailable:'Voices unavailable. Enable again to retry the download or model.', 'speech-error':'A voice could not play. Listening for the next line.'};
  const status=state=>{if(disposed)return;checkbox.checked=state.enabled===true;if(Number.isFinite(state.volume)){volume.value=String(Math.round(state.volume*100));volume.setAttribute('aria-valuetext',`${volume.value}%`);player?.setVolume(state.volume);}help.textContent=messages[state.state]??messages.disabled;};
  const audio=()=>{if(!player){context=new Audio();player=new WebAudioPlayer(context);player.setVolume(Number(volume.value)/100);}return player;};
  const unsubscribe=bridge.subscribe(async event=>{
    if(disposed)return;
    if(event.type==='status')status(event);
    if(event.type==='volume'){volume.value=String(Math.round(event.value*100));player?.setVolume(event.value);}
    if(event.type==='stop')player?.stop();
    if(event.type==='audio')try{if(!checkbox.checked)throw Error('Disabled');const samples=event.audio instanceof Float32Array?event.audio:Float32Array.from(event.audio);if(samples.length>2880000||samples.some(v=>!Number.isFinite(v)))throw Error('Invalid audio');await audio().play(samples,event.rate,()=>void bridge.command({type:'audio-started',id:event.id}));await bridge.command({type:'audio-ended',id:event.id});}catch{void bridge.command({type:'audio-error',id:event.id});}
  });
  checkbox.addEventListener('change',async()=>{const value=checkbox.checked;if(value)try{audio();await context.resume();}catch{checkbox.checked=false;help.textContent='Audio could not start. Enable again to retry.';return;}else player?.stop();try{status(await bridge.command({type:'enabled',value}));}catch{help.textContent='VoiceBox is unavailable.';}});
  volume.addEventListener('input',()=>{const value=Number(volume.value)/100;volume.setAttribute('aria-valuetext',`${volume.value}%`);player?.setVolume(value);void bridge.command({type:'volume',value}).catch(()=>{});});
  void bridge.command({type:'renderer-ready'}).then(status).catch(()=>{help.textContent='VoiceBox is unavailable.';});
  const dispose=()=>{disposed=true;unsubscribe();void player?.close();void context?.close();};
  globalThis.addEventListener?.('pagehide',dispose,{once:true});return {panel,dispose};
}
