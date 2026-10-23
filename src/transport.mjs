import {PLAYER_EXPRESSION} from './reader.mjs';
import {verifyInstalledVersion} from './compatibility.mjs';
import {inspectCached} from './cached-module.mjs';

export class ObserverError extends Error { constructor(code) {super(code);this.code=code;} }
export function isGameUrl(value) {
  try {const u=new URL(value);return u.protocol==='dagger:'&&u.hostname==='game'&&!u.port&&!u.username&&!u.password&&u.pathname==='/play/index.html'&&!u.hash;}
  catch{return false;}
}
export function configuration(env=process.env) {
  const port=Number(env.DFO_OBSERVER_PORT??9223);
  const sampleMs=Number(env.DFO_OBSERVER_SAMPLE_MS??0);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new ObserverError('INVALID_PORT');
  if(sampleMs!==0&&(!Number.isInteger(sampleMs)||sampleMs<2000||sampleMs>60000))throw new ObserverError('INVALID_SAMPLE_INTERVAL');
  return {port,allowAttach:env.DFO_OBSERVER_ALLOW_ATTACH==='1',sampleMs,cachedModule:env.DFO_OBSERVER_CACHED_MODULE==='1',captureSource:env.DFO_OBSERVER_CAPTURE_SOURCE==='1'};
}
export function validateTarget(target,port) {
  if(target?.type!=='page'||!isGameUrl(target.url))throw new ObserverError('WRONG_GAME_TARGET');
  let ws;try{ws=new URL(target.webSocketDebuggerUrl);}catch{throw new ObserverError('INVALID_DEBUG_ADDRESS');}
  if(ws.protocol!=='ws:'||ws.hostname!=='127.0.0.1'||Number(ws.port)!==port||ws.username||ws.password||ws.search||ws.hash||!/^\/devtools\/page\/[a-zA-Z0-9-]+$/.test(ws.pathname))throw new ObserverError('INVALID_DEBUG_ADDRESS');
  return ws.href;
}
async function targets(port,fetcher) {
  const r=await fetcher(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1500),redirect:'error'});
  if(!r.ok)throw new ObserverError('DEBUG_DISCOVERY_FAILED');
  const raw=await r.text();if(raw.length>262144)throw new ObserverError('DISCOVERY_TOO_LARGE');
  const list=JSON.parse(raw);if(!Array.isArray(list)||list.length>32)throw new ObserverError('INVALID_DISCOVERY');
  const matches=list.filter(t=>t.type==='page'&&isGameUrl(t.url));
  if(matches.length!==1)throw new ObserverError(matches.length?'AMBIGUOUS_GAME_TARGET':'GAME_TARGET_UNAVAILABLE');
  return validateTarget(matches[0],port);
}

// Private implementation: the sole outbound CDP method is Runtime.evaluate with
// this source-controlled expression and V8's side-effect guard. No public send().
export async function readOnce(config,{fetcher=fetch,Socket=WebSocket,checkCompatibility=verifyInstalledVersion}={}) {
  if(!config.allowAttach)throw new ObserverError('ATTACH_DISABLED');
  if(!config.cachedModule)try{if(!await checkCompatibility())throw new ObserverError('UNSUPPORTED_INSTALLED_VERSION');}catch(e){if(e instanceof ObserverError)throw e;throw new ObserverError('INSTALLED_VERSION_UNVERIFIED');}
  let address;try{const session=config.inspectionSession;address=config.dashboardLive&&session?.lowImpact&&session?.sources&&session.connection&&!session.connection.closed?session.address:await targets(config.port,fetcher);}catch(e){if(e instanceof ObserverError)throw e;throw new ObserverError('DEBUG_ENDPOINT_UNAVAILABLE');}
  if(config.cachedModule){try{return await inspectCached(address,{read:true,capture:config.captureSource===true,navigationOnly:config.navigationOnly===true,navigationCommand:config.navigationCommand??'location',documentOnly:config.documentOnly===true,dashboardCore:config.dashboardCore===true,dashboardLive:config.dashboardLive===true,session:config.inspectionSession??null,townGeometryKeys:config.townGeometryKeys??[],Socket});}catch(e){throw new ObserverError(e.code??'CACHED_READ_FAILED');}}
  return new Promise((resolve,reject)=>{
    let ws,settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);try{ws?.close();}catch{};error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(new ObserverError('READ_TIMEOUT')),2500);
    try {ws=new Socket(address);}catch{finish(new ObserverError('DEBUG_CONNECTION_FAILED'));return;}
    ws.addEventListener('error',()=>finish(new ObserverError('DEBUG_CONNECTION_FAILED')));
    ws.addEventListener('close',()=>finish(new ObserverError('DEBUG_CONNECTION_CLOSED')));
    ws.addEventListener('open',()=>{
      try{ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:PLAYER_EXPRESSION,returnByValue:true,throwOnSideEffect:true,timeout:250,disableBreaks:true,includeCommandLineAPI:false,silent:true,generatePreview:false,userGesture:false,awaitPromise:false}}));}
      catch{finish(new ObserverError('DEBUG_CONNECTION_FAILED'));}
    });
    ws.addEventListener('message',e=>{
      if(typeof e.data!=='string'||e.data.length>524288){finish(new ObserverError('INVALID_DEBUG_RESPONSE'));return;}
      let reply;try{reply=JSON.parse(e.data);}catch{finish(new ObserverError('INVALID_DEBUG_RESPONSE'));return;}
      if(reply.id!==1)return;
      // Never echo exception descriptions/stacks, URLs, or arbitrary response fields.
      if(reply.error||reply.result?.exceptionDetails){finish(new ObserverError('READ_REFUSED_OR_INCOMPATIBLE'));return;}
      const value=reply.result?.result?.value;
      if(typeof value?.available!=='boolean'){finish(new ObserverError('INVALID_PLAYER_RESPONSE'));return;}
      finish(null,value);
    });
  });
}

export async function probeDiagnostic(config,{fetcher=fetch,Socket=WebSocket}={}){
  const capturedAt=new Date().toISOString();
  try{
    if(!config.allowAttach)throw new ObserverError('ATTACH_DISABLED');
    const address=await targets(config.port,fetcher);
    const diagnostics=await inspectCached(address,{capture:config.captureSource,Socket});
    return {schemaVersion:1,capturedAt,connected:true,available:diagnostics.ready,diagnostics};
  }catch(e){return {schemaVersion:1,capturedAt,connected:false,available:false,reason:e.code??'DEBUG_ENDPOINT_UNAVAILABLE'};}
}
