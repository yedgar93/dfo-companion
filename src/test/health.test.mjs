import test from 'node:test';import assert from 'node:assert/strict';
import {companionHealth,connectionDiagnosis,explainConnectionFailure} from '../health.mjs';
const present={available:true,gameRunning:true,diagnosticFlagsPresent:true,updaterRelaunch:false,listenerPresent:true,listenerOwned:true};
test('updater flag loss is explicit and never tries a player read or launch',async()=>{
 const result=await companionHealth({platform:'win32',inspect:()=>({...present,diagnosticFlagsPresent:false,updaterRelaunch:true,listenerPresent:false}),read:()=>{throw Error('must not read');}});assert.equal(result.reason,'UPDATER_DROPPED_FLAGS');assert.equal(result.readerReady,false);assert.match(result.action,/When safe/);
});
test('an open endpoint alone cannot pass health',async()=>{const r=await companionHealth({platform:'win32',inspect:()=>present,read:async()=>({available:false})});assert.equal(r.readerReady,false);assert.equal(r.reason,'PLAYER_NOT_AVAILABLE');});
test('source incompatibility requires review rather than another restart',async()=>{const r=await companionHealth({platform:'win32',inspect:()=>present,read:async()=>{throw Object.assign(Error(),{code:'PLAYER_SOURCE_NOT_REVIEWED'});}});assert.equal(r.reason,'PLAYER_SOURCE_NOT_REVIEWED');assert.match(r.action,/Keep the running game open/);});
test('title menu without an executed character host waits instead of falsely demanding compatibility repair',async()=>{const r=await companionHealth({platform:'win32',inspect:()=>present,read:async()=>{throw Object.assign(Error(),{code:'NO_REVIEWED_EXECUTED_HOST'});}});assert.equal(r.readerReady,false);assert.match(r.action,/Finish normal Play\/load/);assert.doesNotMatch(r.action,/needs a compatibility review/);});
test('ready requires current character identity and health',async()=>{const r=await companionHealth({platform:'win32',inspect:()=>present,read:async()=>({available:true,identity:{name:'Current',level:2},vitals:{health:{current:83,max:83}},readerProfile:{playerSha256:'reviewed'}})});assert.equal(r.reason,'LIVE_PLAYER_VERIFIED');assert.equal(r.readerReady,true);assert.equal(r.player.name,'Current');});
test('wrong listener and missing process have distinct recovery paths',()=>{assert.equal(connectionDiagnosis({...present,listenerOwned:false}).reason,'LISTENER_NOT_OWNED_BY_GAME');assert.equal(connectionDiagnosis({...present,gameRunning:false,listenerPresent:false}).reason,'GAME_NOT_RUNNING');assert.equal(connectionDiagnosis({...present,listenerPresent:false}).reason,'FLAGS_PRESENT_LISTENER_NOT_READY');});
test('ordinary failed reads diagnose flag loss without turning source refusals into restart advice',()=>{
 const inspect=()=>({...present,listenerPresent:false,updaterRelaunch:true,diagnosticFlagsPresent:false});
 assert.equal(explainConnectionFailure('DEBUG_ENDPOINT_UNAVAILABLE',{platform:'win32',inspect}).reason,'UPDATER_DROPPED_FLAGS');
 assert.equal(explainConnectionFailure('PLAYER_SOURCE_NOT_REVIEWED',{platform:'win32',inspect:()=>{throw Error('must not inspect');}}),null);
 assert.equal(explainConnectionFailure('DEBUG_ENDPOINT_UNAVAILABLE',{platform:'win32',port:9333,inspect:()=>{throw Error('wrong port');}}),null);
});
