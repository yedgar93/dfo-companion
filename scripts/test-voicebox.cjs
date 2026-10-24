// Native Electron + isolated HTTP fixture. Never discovers/launches/reads DFO.
const {app,BrowserWindow,utilityProcess,ipcMain}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
let win,server,runtime;const directory=path.resolve('.test-cache/voicebox-native');
app.setPath('userData',path.resolve('.test-cache/electron-voicebox'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 await app.whenReady();await fs.mkdir(directory,{recursive:true});
 const {createDashboardServer}=await import('../src/dashboard-server.mjs');
 const desktopRoot=path.resolve(process.env.DFO_VOICEBOX_PACKAGED_ROOT??'desktop');
 const {createVoiceBoxRuntime,utilityWorkerFactory}=await import(require('node:url').pathToFileURL(path.join(desktopRoot,'voicebox/runtime.mjs')).href);
 const fixture=JSON.parse(await fs.readFile(path.join(__dirname,'../src/test/fixtures/snapshots/town-full.json')));
 const origin='http://127.0.0.1:19262',events=[],commands=[];
 server=createDashboardServer({snapshot:()=>fixture,poll:async()=>{}},{port:19262,launchGame:async()=>{throw Error('Forbidden in VoiceBox tests');}});await new Promise(r=>server.listen(19262,'127.0.0.1',r));
 win=new BrowserWindow({show:false,width:1000,height:1000,webPreferences:{preload:path.join(desktopRoot,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 let terminated=0,workers=0,audio=0;
 const realModels=process.env.DFO_VOICEBOX_TEST_MODELS;
 class FixtureWorker{constructor(){workers++;}async enable(){return {provider:'fixture'};}async synth(){return {audio:Float32Array.from({length:2400},(_,i)=>Math.sin(i*.08)*.01),rate:24000};}cancel(){}async disable(){terminated++;}}
 runtime=createVoiceBoxRuntime({directory,send:e=>{events.push(e.type==='audio'?{type:e.type,id:e.id,samples:e.audio.length}:e);if(e.type==='audio')audio++;if(!win.isDestroyed())win.webContents.send('dfo:voicebox-event',e);},service:e=>commands.push(e),...(realModels?{models:async()=>realModels,workerFactory:utilityWorkerFactory(utilityProcess)}:{models:async()=>directory,workerClass:FixtureWorker})});
 ipcMain.handle('dfo:voicebox-control',(event,message)=>{assert.equal(event.sender,win.webContents);assert.equal(event.senderFrame,win.webContents.mainFrame);return runtime.command(message);});ipcMain.handle('dfo:version',()=> require('../package.json').version);
 await win.loadURL(origin+'/');const js=s=>win.webContents.executeJavaScript(s,true);await js("localStorage.setItem('dfo-companion-first-run-seen','1');sessionStorage.setItem('dfo-splash-shown','1');document.querySelector('dialog.first-run[open]')?.close()");for(let i=0;i<100;i++){if(await js("!!document.querySelector('#voicebox-enabled')"))break;await delay(30);}
 assert(await js("(()=>{const v=document.querySelector('.voicebox-settings');return v.previousElementSibling.classList.contains('quiet-settings')&&v.nextElementSibling.querySelector('summary').textContent==='How connection & freshness work'&&v.querySelectorAll('input').length===2&&v.getBoundingClientRect().height<100})()"));
 await js("document.querySelector('[data-page=\"connection-page\"]').click();document.querySelector('#voicebox-volume').value='0';document.querySelector('#voicebox-volume').dispatchEvent(new Event('input'));const c=document.querySelector('#voicebox-enabled');if(!c.checked)c.click()");
 for(let i=0;i<900&&!commands.some(c=>c.type==='enabled'&&c.value);i++)await delay(100);
 assert(commands.some(c=>c.type==='enabled'&&c.value),'worker must warm before capture is enabled');
 runtime.receive({type:'snapshot',snapshot:{version:1,documentId:'native-fixture',type:'talk',visible:true,name:'Uthoryan Kinghouse',entries:[{role:'npc',text:'Welcome, traveller.'}]}});
 for(let i=0;i<150&&!audio;i++)await delay(100);assert(audio>0,'synthetic NPC fixture must synthesize and reach renderer');await delay(500);
 await js("document.querySelector('#voicebox-volume').value='37';document.querySelector('#voicebox-volume').dispatchEvent(new Event('input'))");await delay(100);assert.equal(runtime.status().volume,.37);
 await delay(1400);const output=path.resolve('visual-results');await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'voicebox-desktop.png'),(await win.webContents.capturePage()).toPNG());
 await js("document.querySelector('#voicebox-enabled').click()");await delay(250);assert.equal(runtime.status().enabled,false);assert.equal(commands.at(-1).value,false);if(!realModels)assert.equal(terminated,1);
 const nativeEntry=path.resolve(process.env.DFO_VOICEBOX_PACKAGED_ROOT??'desktop','voicebox/native-check.mjs');
 const child=utilityProcess.fork(nativeEntry,[],{serviceName:'VoiceBox native packaging check',stdio:'pipe'});
 const native=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native packaging check timeout')),15000);child.on('message',m=>{clearTimeout(timer);resolve(m);});child.on('exit',code=>{if(code)reject(Error('Native dependency load failed '+code));});child.stderr.on('data',d=>process.stderr.write(d));});child.kill();assert(native.nativeReady&&native.phonemes>0);
 console.log(JSON.stringify({voiceBoxNative:'passed',engine:realModels?'real cached Kokoro':'synthetic audio fixture',audioPackets:audio,controls:'enable/volume/disable',native,gameAttached:false}));
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await runtime?.close();win?.destroy();if(server)await new Promise(r=>server.close(r));app.exit(process.exitCode||0);});
