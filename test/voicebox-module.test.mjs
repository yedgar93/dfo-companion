import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {createVoiceBoxRuntime} from '../desktop/voicebox/runtime.mjs';
import {createServiceCapture} from '../desktop/voicebox/service-capture.mjs';
import {ensureModels} from '../desktop/voicebox/models.mjs';
import {installVoiceBox} from '../src/voicebox-ui.mjs';
import {publishGameConnection,subscribeGameConnection} from '../src/game-connection-events.mjs';
const settle=()=>new Promise(r=>setTimeout(r,20));
async function temporary(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'dfo-voicebox-module-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return directory;}
test('disabled module performs no download, worker creation, capture or audio work; settings survive close',async t=>{
 const directory=await temporary(t),sent=[],commands=[];let downloads=0,workers=0,disables=0;
 const runtime=createVoiceBoxRuntime({directory,send:e=>sent.push(e),service:e=>commands.push(e),models:async()=>{downloads++;return directory;},workerClass:class{constructor(){workers++;}},boxFactory:()=>({async enable(){},async disable(){disables++;},reset(){},volume(){},accept(){}})});
 await runtime.ready;await runtime.command({type:'renderer-ready'});assert.equal(downloads,0);assert.equal(workers,0);assert.equal(commands.length,0);
 await runtime.command({type:'enabled',value:true});await settle();assert.equal(downloads,1);assert.equal(workers,1);assert.ok(commands.some(e=>e.type==='enabled'&&e.value===true));
 await runtime.command({type:'volume',value:.37});await runtime.command({type:'volume',value:9});assert.equal(runtime.status().volume,.37);
 await runtime.close();assert.equal(disables,1);assert.equal(commands.at(-1).value,false);const saved=JSON.parse(await fs.readFile(path.join(directory,'settings.json')));assert.equal(saved.enabled,true);assert.equal(saved.volume,.37);
});
test('disable during model preparation prevents worker creation and capture, aborts download',async t=>{
 const directory=await temporary(t);let finish,signal,workers=0;const commands=[];
 const runtime=createVoiceBoxRuntime({directory,send(){},service:e=>commands.push(e),models:(_d,o)=>{signal=o.signal;return new Promise(r=>finish=r);},workerClass:class{constructor(){workers++;}}});
 await runtime.command({type:'enabled',value:true});await settle();await runtime.command({type:'enabled',value:false});assert.equal(signal.aborted,true);finish(directory);await settle();assert.equal(workers,0);assert.equal(runtime.status().enabled,false);assert.ok(!commands.some(e=>e.value===true));await runtime.close();
});
test('shared connection capture stays inert while off, tears down old connection before reconnect, never closes host',async()=>{
 let listener,created=0;const calls=[],events=[];const capture=createServiceCapture({subscribe:fn=>{listener=fn;fn(null);return()=>{listener=null;};},send:e=>events.push(e),captureFactory:(c,o)=>{created++;return {async attach(){await c.call('attach');o.onSnapshot({type:'talk'});},async close(){await c.call('teardown');}};}});
 const connection=name=>({send:method=>{calls.push(name+':'+method);},on(){},off(){},closed:false});
 listener(connection('first'));await settle();assert.equal(created,0);await capture.setEnabled(true);assert.deepEqual(calls,['first:attach']);
 listener(connection('second'));await settle();assert.deepEqual(calls,['first:attach','first:teardown','second:attach']);
 await capture.setEnabled(false);assert.equal(calls.at(-1),'second:teardown');assert.equal(created,2);await capture.close();assert.equal(listener,null);assert.equal(events.filter(e=>e.type==='snapshot').length,2);
});
test('connection subscriptions publish changes without starting game reads',()=>{const seen=[];publishGameConnection(null);const unsubscribe=subscribeGameConnection(c=>seen.push(c));const c={};publishGameConnection(c);publishGameConnection(c);publishGameConnection(null);unsubscribe();assert.deepEqual(seen,[null,c,null]);});
test('compact controls sit immediately after Quiet alerts and before connection help; volume and disable reach module',async()=>{
 const dom=new JSDOM('<div><section class="quiet-settings"></section><details><summary>How connection &amp; freshness work</summary></details></div>'),commands=[];let emit;
 const bridge={subscribe:fn=>{emit=fn;return()=>{};},async command(m){commands.push(m);return {enabled:m.type==='enabled'?m.value:false,volume:.8,state:'disabled'};}};
 const context={currentTime:0,destination:{},createGain:()=>({connect(){},disconnect(){},gain:{setValueAtTime(){}}}),async resume(){},async close(){}};
 const ui=installVoiceBox({document:dom.window.document,bridge,Audio:class{constructor(){return context;}}});await settle();const panel=ui.panel;
 assert.equal(panel.previousElementSibling.className,'quiet-settings');assert.equal(panel.nextElementSibling.tagName,'DETAILS');assert.equal(panel.querySelectorAll('input[type=checkbox]').length,1);assert.equal(panel.querySelectorAll('input[type=range]').length,1);assert.equal(panel.querySelectorAll('button,select').length,0);
 panel.querySelector('input[type=range]').value='45';panel.querySelector('input[type=range]').dispatchEvent(new dom.window.Event('input'));assert.ok(commands.some(c=>c.type==='volume'&&c.value===.45));
 const checkbox=panel.querySelector('input[type=checkbox]');checkbox.checked=true;checkbox.dispatchEvent(new dom.window.Event('change'));await settle();assert.ok(commands.some(c=>c.type==='enabled'&&c.value===true));emit({type:'status',enabled:true,volume:.45,state:'listening'});assert.match(panel.textContent,/ready for dialogue/);ui.dispose();dom.window.close();
});
test('phone/browser without native bridge creates no controls or audio context',()=>{const dom=new JSDOM('<section class="quiet-settings"></section>');let created=0;assert.equal(installVoiceBox({document:dom.window.document,bridge:null,Audio:class{constructor(){created++;}}}),null);assert.equal(created,0);dom.window.close();});
test('model preparation honours cancellation before fetching and rejects oversized downloads',async t=>{const directory=await temporary(t),controller=new AbortController();controller.abort();let fetched=0;await assert.rejects(ensureModels(directory,{signal:controller.signal,fetcher:async()=>{fetched++;}}));assert.equal(fetched,0);await assert.rejects(ensureModels(directory,{fetcher:async()=>new Response('x',{headers:{'content-length':'1'}})}),/size mismatch/);assert.deepEqual(await fs.readdir(directory),[]);});
test('packaging keeps speech module and native dependencies app-relative, with no models or Python',async()=>{const text=await fs.readFile(new URL('../electron-builder.cjs',import.meta.url),'utf8');assert.match(text,/desktop\/\*\*\/\*/);assert.match(text,/asarUnpack/);assert.match(text,/onnxruntime-node/);const pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url)));assert.equal(pkg.dependencies['onnxruntime-node'],'1.30.0');assert.equal(pkg.dependencies.phonemizer,'1.2.1');const main=await fs.readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8');assert.match(main,/senderFrame!==window\?\.webContents.mainFrame/);assert.ok(!main.includes('dfo-voicebox-windows'));});
