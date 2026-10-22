import {execFileSync} from 'node:child_process';
import {realpathSync} from 'node:fs';
import {homedir} from 'node:os';
import {posix} from 'node:path';
export async function replaceLegacyHelper({fetcher=fetch,run=(file,args)=>execFileSync(file,args,{encoding:'utf8',timeout:3000,maxBuffer:65536}).trim(),kill=process.kill.bind(process),uid=process.getuid?.(),home=homedir(),realpath=realpathSync,delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 let response;try{response=await fetcher('http://127.0.0.1:9234/api/identity',{signal:AbortSignal.timeout(1500),redirect:'error'});}catch(error){if(error.cause?.code==='ECONNREFUSED')return {replaced:false};throw Error('Cannot verify the existing companion. Close the old helper and try again.');}
 const identity=await response.json();if(!response.ok||identity.appId!=='dfo-companion-dashboard-v1')throw Error('The companion port is occupied by another application.');
 const pids=[...new Set(run('/usr/sbin/lsof',['-nP','-iTCP:9234','-sTCP:LISTEN','-t']).split(/\s+/))];if(pids.length!==1||!/^\d+$/.test(pids[0]))throw Error('Cannot identify one old companion helper.');
 const pid=Number(pids[0]),owner=Number(run('/bin/ps',['-p',String(pid),'-o','uid='])),exe=run('/bin/ps',['-ww','-p',String(pid),'-o','comm=']),command=run('/bin/ps',['-ww','-p',String(pid),'-o','command=']);
 const runtime=posix.join(home,'Library/Caches/DFOCompanion/launcher/DFO-Companion.mjs'),suffix=' '+runtime+' --open',prefix=command.endsWith(suffix)?command.slice(0,-suffix.length):'';
 if(owner!==uid||!prefix.startsWith('/')||posix.basename(exe)!=='node'||realpath(prefix)!==realpath(exe))throw Error('An older helper is running outside the standard companion launcher. Quit that helper before opening this app.');
 kill(pid,'SIGTERM');for(let i=0;i<40;i++){await delay(100);try{kill(pid,0);}catch(error){if(error.code==='ESRCH')return {replaced:true};throw error;}}
 throw Error('The old companion did not stop. No second reader was started.');
}
