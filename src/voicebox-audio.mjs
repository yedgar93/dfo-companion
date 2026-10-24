// Runs in Companion's existing renderer. No extra browser window or OS player.
export class WebAudioPlayer {
  constructor(context){this.context=context;this.gain=context.createGain();this.gain.connect(context.destination);this.current=null;}
  setVolume(value){if(!Number.isFinite(value)||value<0||value>1)throw Error('Invalid volume');this.gain.gain.setValueAtTime(value,this.context.currentTime);}
  async play(audio,rate,onStarted=()=>{}){this.stop();const token={};this.current=token;await this.context.resume();if(this.current!==token)return;
    const buffer=this.context.createBuffer(1,audio.length,rate);buffer.copyToChannel(audio,0);const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.gain);token.source=source;
    return new Promise(resolve=>{token.resolve=resolve;source.onended=()=>{if(this.current===token)this.current=null;source.disconnect();resolve();};source.start();onStarted();});
  }
  stop(){const old=this.current;this.current=null;if(!old)return;if(old.source){old.source.onended=null;old.source.stop();old.source.disconnect();}old.resolve?.();}
  async close(){this.stop();this.gain.disconnect();}
}
