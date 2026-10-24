import {randomUUID} from 'node:crypto';
import {replaceLegacyHelper,replaceLegacyWindowsHelper} from './legacy-helper.mjs';
process.env.DFO_COMPANION_EMBEDDED='1';
import {createServiceCapture} from './voicebox/service-capture.mjs';
let service,capture;
try{
 if(process.platform==='darwin')await replaceLegacyHelper();
 if(process.platform==='win32')await replaceLegacyWindowsHelper();
 const {startDashboard,subscribeGameConnection}=await import('./DFO-Companion.mjs');
 const instanceToken=randomUUID();
 service=await startDashboard({open:false,instanceToken});
 if(service.reused)throw Error('Another companion helper is already running. Quit the old helper and reopen this app.');
 capture=createServiceCapture({subscribe:subscribeGameConnection,send:message=>process.parentPort.postMessage({voiceBox:message})});
 process.parentPort.postMessage({ready:true,instanceToken});
}catch(error){process.parentPort.postMessage({error:error.message});process.exitCode=1;}
process.parentPort.on('message',async event=>{const message=event.data;if(message==='close'){await capture?.close();service?.close();setTimeout(()=>process.exit(0),250).unref();}else if(message?.voiceBox){const command=message.voiceBox;if(command.type==='enabled')void capture?.setEnabled(command.value);if(command.type==='opinion'){let value=null;try{value=await capture?.opinion(command.name);}catch{}process.parentPort.postMessage({voiceBox:{type:'opinion',id:command.id,value}});}}});
