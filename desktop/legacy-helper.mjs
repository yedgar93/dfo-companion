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
export async function replaceLegacyWindowsHelper({fetcher=fetch,run=(script)=>execFileSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:8000,maxBuffer:65536}).trim(),kill=process.kill.bind(process),delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 let response;try{response=await fetcher('http://127.0.0.1:9234/api/identity',{signal:AbortSignal.timeout(1500),redirect:'error'});}catch(error){if(error.cause?.code==='ECONNREFUSED')return {replaced:false};throw Error('Cannot verify the existing companion helper.');}
 const identity=await response.json();if(!response.ok||identity.appId!=='dfo-companion-dashboard-v1')throw Error('Another application is using the companion port.');
 const script="$ErrorActionPreference='Stop'; $ids=@(Get-NetTCPConnection -LocalPort 9234 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique); if($ids.Count -ne 1){throw 'Ambiguous listener'}; $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$ids[0]); $owner=Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid; [pscustomobject]@{pid=$p.ProcessId;exe=$p.ExecutablePath;command=$p.CommandLine;sameUser=($owner.ReturnValue -eq 0 -and $owner.Sid -eq [Security.Principal.WindowsIdentity]::GetCurrent().User.Value)} | ConvertTo-Json -Compress";
 const data=JSON.parse(run(script).replace(/^\uFEFF/,'')),pid=Number(data.pid),exe=data.exe;
 if(!Number.isSafeInteger(pid)||pid<1||!data.sameUser||typeof exe!=='string'||!/(?:^|[\\/])DFO Companion\.exe$/i.test(exe)||!['"'+exe+'" --background','"'+exe+'" --open',exe+' --background',exe+' --open'].includes(data.command))throw Error('Quit the older companion app before opening this version.');
 kill(pid,'SIGTERM');for(let i=0;i<40;i++){await delay(100);try{kill(pid,0);}catch(error){if(error.code==='ESRCH')return {replaced:true};throw error;}}throw Error('The old companion reader did not stop.');
}
