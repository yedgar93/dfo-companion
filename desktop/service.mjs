import {randomUUID} from 'node:crypto';
import {replaceLegacyHelper} from './legacy-helper.mjs';
process.env.DFO_COMPANION_EMBEDDED='1';
let service;
try{
 if(process.platform==='darwin')await replaceLegacyHelper();
 const {startDashboard}=await import('./DFO-Companion.mjs');
 const instanceToken=randomUUID();
 service=await startDashboard({open:false,instanceToken});
 if(service.reused)throw Error('Another companion helper is already running. Quit the old helper and reopen this app.');
 process.parentPort.postMessage({ready:true,instanceToken});
}catch(error){process.parentPort.postMessage({error:error.message});process.exitCode=1;}
process.parentPort.on('message',event=>{if(event.data==='close'){service?.close();setTimeout(()=>process.exit(0),250).unref();}});
