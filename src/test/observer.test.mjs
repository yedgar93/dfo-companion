import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {PLAYER_EXPRESSION} from '../reader.mjs';
import {configuration,validateTarget,readOnce,ObserverError,isGameUrl} from '../transport.mjs';
import {Observer} from '../observer.mjs';
import {dispatch,tools} from '../mcp.mjs';

const fixture=()=>({isPlayer:true,health:40,maxHealth:60,magicka:10,maxMagicka:30,fatigue:2000,level:2,race:'High Elf',stats:{strength:50,intelligence:70,willpower:55,agility:55,endurance:40,personality:40,speed:50,luck:50},skills:Array(35).fill(30),items:[{name:'Longsword',stackCount:1,equipSlot:17,currentCondition:10,maxCondition:100,secret:'DO_NOT_COPY'}],activeEffects:[{kind:'fortifyAttribute',stat:'strength',magnitude:10,roundsRemaining:3,caster:{account:'DO_NOT_COPY'}}],password:'DO_NOT_COPY',chat:['DO_NOT_COPY'],foes:[{hidden:true}]});
function read(p){return runInNewContext(PLAYER_EXPRESSION,{window:{__playerEntity:p}},{timeout:200});}
const plain=x=>JSON.parse(JSON.stringify(x));
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};

test('read-only copy and strict field allowlist, including nested redaction',()=>{
 const p=fixture(),before=structuredClone(p);freeze(p);
 const result=read(p);assert.equal(result.available,true);assert.deepEqual(p,before);
 assert.equal(result.vitals.health.current,40);assert.equal(result.attributes.live.strength,60);
 assert.equal(result.vitals.fatigue.max,6400);assert.equal(result.skills.length,35);
 assert.equal(result.inventory.items[0].condition.current,10);
 assert.equal(result.inventory.items[0].equipSlot,17);
 assert.equal(JSON.stringify(result).includes('DO_NOT_COPY'),false);
 assert.equal('password' in result,false);assert.equal('foes' in result,false);
 result.inventory.items[0].name='changed';assert.equal(p.items[0].name,'Longsword');
});
test('absent player and non-player/peer surfaces cannot leak data',()=>{
 assert.equal(read(null).available,false);const p=fixture();p.isPlayer=false;assert.equal(read(p).available,false);
 p.isPlayer=true;p.peer={id:1};assert.equal(read(p).available,false);
});
test('untrusted accessor fields are skipped, missing numbers remain null, text bounded',()=>{
 const p=fixture();p.health=NaN;p.items[0].name='x'.repeat(1000);Object.defineProperty(p.items[0],'shortName',{get(){throw Error('must not run');}});
 Object.defineProperty(p,'password',{get(){throw Error('must not run');}});
 Object.defineProperty(p,'maxHealth',{get(){throw Error('game accessor must not run');}});
 const r=read(p);assert.equal(r.vitals.health.current,null);assert.equal(r.vitals.health.max,null);assert.equal(r.inventory.items[0].name.length,120);assert.equal(r.inventory.items[0].value,null);
});
test('bounded inventory and active effects, no recursive or cyclic copying',()=>{
 const p=fixture();p.items=Array.from({length:501},()=>({name:'A'}));p.activeEffects=Array.from({length:129},()=>({kind:'test'}));p.items[0].caster=p;
 const r=read(p);assert.equal(r.inventory.items.length,500);assert.equal(r.inventory.truncated,true);assert.equal(r.activeEffects.length,128);assert.doesNotThrow(()=>JSON.stringify(r));
});
test('live attribute curse/survival clamps and mentor overlay',()=>{
 const p=fixture();p.activeEffects=[{kind:'racialOverride',statMods:{strength:-100}},{kind:'survival',statMods:{strength:-100}}];
 assert.equal(read(p).attributes.live.strength,1);
 p.activeEffects=[];p._mentor={statCut:{strength:5},skillFactor:.5,skillCeiling:50};p.skills[22]=80;
 const r=read(p);assert.equal(r.attributes.live.strength,45);assert.equal(r.skills[22].display,50);
});
test('configuration is opt-in, loopback only, and forbids arbitrary debug targets',()=>{
 assert.equal(configuration({}).allowAttach,false);assert.throws(()=>configuration({DFO_OBSERVER_PORT:'80'}));
 assert.throws(()=>configuration({DFO_OBSERVER_SAMPLE_MS:'5'}));
 const t={type:'page',url:'dagger://game/play/index.html',webSocketDebuggerUrl:'ws://127.0.0.1:9223/devtools/page/ABC-123'};
 assert.equal(validateTarget(t,9223),t.webSocketDebuggerUrl);
 for(const bad of ['ws://example.com:9223/devtools/page/A','ws://127.0.0.1:9224/devtools/page/A','ws://127.0.0.1:9223/devtools/browser/A','ws://user@127.0.0.1:9223/devtools/page/A'])assert.throws(()=>validateTarget({...t,webSocketDebuggerUrl:bad},9223));
 assert.throws(()=>validateTarget({...t,url:'https://daggerfalljs.dev/play/'},9223));
 assert.equal(isGameUrl('dagger://game/play/index.html?online=1&load=1&realm=opaque&classic=1&world=1'),true);
 assert.equal(isGameUrl('dagger://game/play/index.html.evil?online=1'),false);
 assert.equal(isGameUrl('dagger://game.evil/play/index.html'),false);
});
test('disabled attachment performs zero network operations',async()=>{
 let count=0;await assert.rejects(()=>readOnce({allowAttach:false,port:9223},{fetcher:()=>{count++;}}),/ATTACH_DISABLED/);assert.equal(count,0);
});
test('only fixed guarded evaluation goes over diagnostic transport; socket closes',async()=>{
 const sent=[];let closed=false;
 class Socket extends EventTarget{
  constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
  send(raw){sent.push(JSON.parse(raw));queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:1,result:{result:{value:plain(read(fixture()))}}})})));}
  close(){closed=true;}
 }
 const fetcher=async(url,options)=>{assert.equal(url,'http://127.0.0.1:9223/json/list');assert.equal(options.redirect,'error');return {ok:true,text:async()=>JSON.stringify([{type:'page',url:'dagger://game/play/index.html',webSocketDebuggerUrl:'ws://127.0.0.1:9223/devtools/page/A'}])};};
 const r=await readOnce({allowAttach:true,port:9223},{fetcher,Socket,checkCompatibility:async()=>true});assert.equal(r.available,true);assert.equal(sent.length,1);assert.equal(sent[0].method,'Runtime.evaluate');assert.equal(sent[0].params.expression,PLAYER_EXPRESSION);assert.equal(sent[0].params.throwOnSideEffect,true);assert.equal(sent[0].params.userGesture,false);assert.equal(closed,true);
});
test('version changes stop before any diagnostic access',async()=>{
 let count=0;await assert.rejects(()=>readOnce({allowAttach:true,port:9223},{fetcher:()=>{count++;},checkCompatibility:async()=>false}),/UNSUPPORTED_INSTALLED_VERSION/);assert.equal(count,0);
});
test('raw CDP exceptions are redacted and never echoed',async()=>{
 class Socket extends EventTarget{constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}send(){queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:1,result:{exceptionDetails:{text:'SECRET',stackTrace:'SECRET'}}})})));}close(){}}
 const fetcher=async()=>({ok:true,text:async()=>JSON.stringify([{type:'page',url:'dagger://game/play/index.html?online=1&realm=SECRET',webSocketDebuggerUrl:'ws://127.0.0.1:9223/devtools/page/A'}])});
 await assert.rejects(()=>readOnce({allowAttach:true,port:9223},{fetcher,Socket,checkCompatibility:async()=>true}),e=>e.message==='READ_REFUSED_OR_INCOMPATIBLE'&&!e.message.includes('SECRET'));
});
test('disconnection clears history and never returns stale player values',async()=>{
 let mode=0;const observer=new Observer({},async()=>{if(mode===2)throw new ObserverError('DEBUG_ENDPOINT_UNAVAILABLE');const p=plain(read(fixture()));p.vitals.health.current-=mode;return p;});
 await observer.query('status');mode=1;assert.equal((await observer.query('changes')).observations.length,1);
 mode=2;const r=await observer.query('status');assert.equal(r.available,false);assert.equal('player' in r,false);
 mode=0;assert.equal((await observer.query('changes')).observations.length,0);
});
test('history bounded to 30 observations and timestamps every fresh call',async()=>{
 let n=0;const o=new Observer({},async()=>{const p=plain(read(fixture()));p.vitals.health.current=n++;return p;});
 for(let i=0;i<40;i++)await o.query('status');const r=await o.query('changes');assert.equal(r.observations.length,30);assert.ok(r.capturedAt);
});
test('MCP exposes only empty-argument read tools; arbitrary evaluate/control denied',async()=>{
 const o=new Observer({allowAttach:false});
 const call=(method,params)=>dispatch({jsonrpc:'2.0',id:1,method,params},o);
 const advertised=(await call('tools/list')).result.tools;assert.equal(advertised.length,14);assert.ok(advertised.every(t=>t.annotations.readOnlyHint));
 assert.equal((await call('tools/call',{name:'evaluate',arguments:{expression:'anything'}})).error.code,-32602);
 assert.equal((await call('tools/call',{name:'dfo_status',arguments:{expression:'anything'}})).error.code,-32602);
 const r=await call('tools/call',{name:'dfo_status'});assert.equal(r.result.isError,true);assert.equal(JSON.parse(r.result.content[0].text).reason,'ATTACH_DISABLED');
 assert.equal((await call('Runtime.evaluate')).error.code,-32601);
});
test('CLI disconnected behavior and MCP stdio initialize/list/call work end-to-end',()=>{
 const env={...process.env,DFO_OBSERVER_ALLOW_ATTACH:'0'};
 const cwd=fileURLToPath(new URL('..',import.meta.url));
 const cli=spawnSync(process.execPath,['cli.mjs','status'],{cwd,env,encoding:'utf8'});assert.equal(cli.status,2);assert.equal(JSON.parse(cli.stdout).reason,'ATTACH_DISABLED');
 const requests=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'dfo_status',arguments:{}}}];
 const mcp=spawnSync(process.execPath,['mcp.mjs'],{cwd,env,input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8'});
 assert.equal(mcp.status,0,mcp.stderr);const replies=mcp.stdout.trim().split('\n').map(s=>JSON.parse(s));assert.equal(replies.length,3);assert.equal(replies[0].result.protocolVersion,'2025-06-18');assert.equal(replies[1].result.tools.length,14);assert.equal(replies[2].result.isError,true);
});
