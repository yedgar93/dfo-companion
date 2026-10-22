import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {configuration,readOnce} from './transport.mjs';

export function connectionDiagnosis(state){
 if(!state?.available)return {reason:'CONNECTION_DIAGNOSIS_UNAVAILABLE',action:'The local process check failed. Inspect the companion launcher log; no game was changed.'};
 if(state.listenerPresent&&!state.listenerOwned)return {reason:'LISTENER_NOT_OWNED_BY_GAME',action:'Port 9223 belongs to another process or is not loopback-only. Do not attach to it.'};
 if(!state.gameRunning)return {reason:'GAME_NOT_RUNNING',action:'Launch the normal game with DFO with Companion, then choose Play/load normally.'};
 if(!state.listenerPresent&&state.updaterRelaunch&&!state.diagnosticFlagsPresent)return {reason:'UPDATER_DROPPED_FLAGS',action:'The official updater reopened DFO without companion flags. When safe, save if appropriate and fully quit DFO once, then launch DFO with Companion. Startup flags cannot be added to this running process.'};
 if(!state.listenerPresent&&!state.diagnosticFlagsPresent)return {reason:'GAME_RUNNING_WITHOUT_FLAGS',action:'This DFO process has no companion startup flags. When safe, fully quit it and launch DFO with Companion once. Do not start a duplicate.'};
 if(!state.listenerPresent)return {reason:'FLAGS_PRESENT_LISTENER_NOT_READY',action:'The flags are present but the listener is not ready. Finish normal startup and retry health; do not restart merely for a loading screen.'};
 return {reason:'CONNECTION_PRESENT',action:'Verify a source-reviewed live player read before reporting ready.'};
}
export function inspectWindowsConnection(run=execFileSync){
 try{
  const code="$ErrorActionPreference='Stop'; $all=@(Get-CimInstance Win32_Process -Filter \"Name='DFO Online.exe'\"); $gamePaths=@($all | Where-Object { $_.ExecutablePath } | ForEach-Object { $_.ExecutablePath } | Select-Object -Unique); $main=@($all | Where-Object { $_.CommandLine -notmatch '--type=' }); $listen=@(Get-NetTCPConnection -LocalPort 9223 -State Listen -ErrorAction SilentlyContinue); $owned=$listen.Count -gt 0; foreach($item in $listen){ $owner=Get-Process -Id $item.OwningProcess -ErrorAction SilentlyContinue; if(-not $owner -or $item.LocalAddress -notin @('127.0.0.1','::1') -or $owner.Path -notin $gamePaths){$owned=$false} }; [pscustomobject]@{available=$true;gameRunning=$all.Count -gt 0;processIds=@($main | ForEach-Object {$_.ProcessId});diagnosticFlagsPresent=@($main | Where-Object {$_.CommandLine -match '--remote-debugging-port(?:=|\\s+)9223(?:\\s|$)' -and $_.CommandLine -match '--remote-debugging-address(?:=|\\s+)127\\.0\\.0\\.1(?:\\s|$)'}).Count -gt 0;updaterRelaunch=@($main | Where-Object {$_.CommandLine -match '(?:^|\\s)--updated(?:\\s|$)'}).Count -gt 0;listenerPresent=$listen.Count -gt 0;listenerOwned=$owned} | ConvertTo-Json -Compress";
  return JSON.parse(run('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8',timeout:8000,windowsHide:true,maxBuffer:65536}).replace(/^\uFEFF/,''));
 }catch{return {available:false};}
}
export function explainConnectionFailure(reason,{port=9223,platform=process.platform,inspect=inspectWindowsConnection}={}){
 if(platform!=='win32'||port!==9223||!['DEBUG_ENDPOINT_UNAVAILABLE','DEBUG_CONNECTION_FAILED','INSPECTION_CONNECT_FAILED'].includes(reason))return null;
 const connection=inspect(),diagnosis=connectionDiagnosis(connection);
 return diagnosis.reason==='CONNECTION_PRESENT'||diagnosis.reason==='CONNECTION_DIAGNOSIS_UNAVAILABLE'?null:{...diagnosis,connection};
}
export async function companionHealth({platform=process.platform,inspect=inspectWindowsConnection,read=readOnce}={}){
 const capturedAt=new Date().toISOString();
 const connection=platform==='win32'?inspect():null;
 if(connection){const diagnosis=connectionDiagnosis(connection);if(diagnosis.reason!=='CONNECTION_PRESENT')return {available:false,readerReady:false,capturedAt,connection,...diagnosis};}
 try{
  const player=await read(configuration({DFO_OBSERVER_ALLOW_ATTACH:'1',DFO_OBSERVER_CACHED_MODULE:'1',DFO_OBSERVER_SAMPLE_MS:'0'}));
  if(!player?.available)return {available:false,readerReady:false,capturedAt,connection,reason:player?.reason??'PLAYER_NOT_AVAILABLE',action:'The connection is present, but a current character is not readable yet. Finish normal Play/load and retry; no restart is implied.'};
  if(!player.identity?.name||!Number.isFinite(player.vitals?.health?.current))return {available:false,readerReady:false,capturedAt,connection,reason:'PLAYER_READ_INCOMPLETE',action:'A response arrived but did not establish the current character and health. Review the current adapter; no restart is implied.'};
  return {available:true,readerReady:true,capturedAt,completedAt:new Date().toISOString(),connection,reason:'LIVE_PLAYER_VERIFIED',player:{name:player.identity.name,level:player.identity.level,vitals:player.vitals},readerProfile:player.readerProfile};
 }catch(e){const reason=e.code??'READER_CHECK_FAILED',waiting=['NO_REVIEWED_EXECUTED_HOST','PLAYER_MODULE_NOT_UNIQUE','GAME_CANVAS_UNAVAILABLE','PLAYER_REFERENCE_UNAVAILABLE'].includes(reason);return {available:false,readerReady:false,capturedAt,connection,reason,action:waiting?'The local connection is present, but a character has not been verified. Finish normal Play/load; readiness will be checked again without restarting.':/REVIEWED|PROOF|BINDING|SOURCE/.test(reason)?'The game connection works, but the updated loaded code needs a compatibility review. Keep the running game open; restarting does not fix this source-review refusal.':'The live player read failed. Retry health and inspect its reason; do not treat an open port as a verified character read.'};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=await companionHealth();process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.available?0:2;}
