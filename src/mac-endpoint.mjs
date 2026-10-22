import {execFileSync} from 'node:child_process';
import {posix} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isGameUrl,validateTarget} from './transport.mjs';
// macOS readiness attestation only; no launch, signals, or game methods.
export function attestMacListeners(raw,executable,inspect){
 const pids=[];let current=null,addresses=0;for(const line of raw.split('\n')){if(line.startsWith('p')){current=line.slice(1);if(!/^\d+$/.test(current))return false;pids.push(current);}else if(line.startsWith('n')){addresses++;if(!current||!['127.0.0.1:9223','[::1]:9223'].includes(line.slice(1)))return false;}}
 return pids.length>0&&addresses>=pids.length&&pids.every(pid=>inspect(pid).split('\n').includes('n'+executable));
}
export async function macEndpointReady(appPath,{fetcher=fetch,run=execFileSync}={}){
 try{
  const executable=posix.join(posix.resolve(appPath),'Contents','MacOS','DFO Online');
  const listeners=run('/usr/sbin/lsof',['-nP','-iTCP:9223','-sTCP:LISTEN','-Fpn'],{encoding:'utf8',timeout:2000});
  if(!attestMacListeners(listeners,executable,pid=>run('/usr/sbin/lsof',['-a','-p',pid,'-d','txt','-Fn'],{encoding:'utf8',timeout:2000})))return false;
  const r=await fetcher('http://127.0.0.1:9223/json/list',{signal:AbortSignal.timeout(1500),redirect:'error'});if(!r.ok)return false;const raw=await r.text();if(raw.length>262144)return false;const rows=JSON.parse(raw);if(!Array.isArray(rows)||rows.length>32)return false;const matches=rows.filter(t=>t.type==='page'&&isGameUrl(t.url));if(matches.length!==1)return false;validateTarget(matches[0],9223);return true;
 }catch{return false;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=process.platform==='darwin'&&process.argv.length===3&&await macEndpointReady(process.argv[2])?0:1;
