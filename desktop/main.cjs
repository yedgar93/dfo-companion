const {app,BrowserWindow,utilityProcess,dialog,Menu,nativeImage,screen}=require('electron');
const path=require('node:path');
const {autoUpdater}=require('electron-updater');
const {MacReleaseUpdater}=require('./mac-updater.cjs');
const {publicKey}=require('./update-public-key.json');
const fileSystem=require('node:fs');
const {setupUpdates}=require('./updates.cjs');
const build=require('./build.json');
app.setName('DFO Companion');
let window,helper,updates,quitting=false,shutdownStarted=false,shutdownDone=false;
const restartFlag=path.join(app.getPath('userData'),'restart-in-background');
const quietRestart=fileSystem.existsSync(restartFlag);if(quietRestart)try{fileSystem.unlinkSync(restartFlag);}catch{}
const {restoreBounds}=require('./window-state.cjs');
const artworkConfig=path.join(app.getPath('userData'),'artwork.json');
async function locateArtwork(){const pick=await dialog.showOpenDialog(window,{title:'Locate Daggerfall ARENA2 artwork folder',properties:['openDirectory']});if(pick.canceled)return;const folder=pick.filePaths[0];try{const names=fileSystem.readdirSync(folder).map(n=>n.toUpperCase());if(!names.includes('ART_PAL.COL')||!names.includes('TEXTURE.216'))throw Error('Choose the ARENA2 folder containing ART_PAL.COL and TEXTURE.216.');fileSystem.mkdirSync(path.dirname(artworkConfig),{recursive:true});fileSystem.writeFileSync(artworkConfig,JSON.stringify({arena2Path:folder}));await dialog.showMessageBox(window,{message:'Artwork folder saved',detail:'Missing item images will retry automatically within 30 seconds. The game does not need to restart.'});}catch(error){await dialog.showMessageBox(window,{type:'error',message:'Artwork folder could not be used',detail:error.message});}}
const windowStateFile=path.join(app.getPath('userData'),'window-state.json');
let updateStatus={state:'idle'};
function saveWindow(){if(!window||window.isDestroyed())return;try{fileSystem.mkdirSync(path.dirname(windowStateFile),{recursive:true});fileSystem.writeFileSync(windowStateFile,JSON.stringify({bounds:window.getNormalBounds(),maximized:window.isMaximized()}));}catch{}}
function showUpdateStatus(){if(!window||window.isDestroyed()||window.webContents.isLoading())return;const {state,version,percent}=updateStatus;const message=state==='checking'?'Checking for companion updates…':state==='downloading'?'Downloading newest version'+(version?' '+version:'')+(Number.isFinite(percent)?' · '+Math.floor(percent)+'%':'')+'…':state==='ready'?'Update downloaded. Installing in 5 seconds—companion will close and reopen. Your game stays open.':state==='installing'?'Installing update—reopening companion…':state==='error'?'Update unavailable · will retry automatically':'';window.setProgressBar(state==='downloading'?(Number.isFinite(percent)?percent/100:2):-1);void window.webContents.executeJavaScript('('+function(message){let node=document.getElementById('desktop-update-status');if(!node){node=document.createElement('div');node.id='desktop-update-status';node.setAttribute('role','status');node.style.cssText='position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:99999;background:#252b1f;color:#edce79;border:1px solid #b2a46a;padding:10px 16px;max-width:90%;font:13px var(--game-font, monospace);line-height:1.5;text-align:center;pointer-events:none';document.body.append(node);}node.textContent=message;node.hidden=!message;}.toString()+')('+JSON.stringify(message)+')').catch(()=>{});}
const origin='http://127.0.0.1:9234';
function createWindow(){
 let saved;try{saved=JSON.parse(fileSystem.readFileSync(windowStateFile,'utf8'));}catch{}
 const bounds=restoreBounds(saved?.bounds,screen.getAllDisplays());
 window=new BrowserWindow({...bounds,minWidth:420,minHeight:480,title:'DFO Companion · '+build.label,backgroundColor:'#191e17',show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:true}});
 window.on('page-title-updated',event=>{event.preventDefault();window.setTitle('DFO Companion · '+build.label);});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(url!==origin+'/')event.preventDefault();});
 window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 window.once('ready-to-show',()=>{if(saved?.maximized)window.maximize();quietRestart?window.showInactive():window.show();showUpdateStatus();});
 let boundsTimer;for(const event of ['move','resize'])window.on(event,()=>{clearTimeout(boundsTimer);boundsTimer=setTimeout(saveWindow,250);});window.on('close',()=>{clearTimeout(boundsTimer);saveWindow();});window.webContents.on('did-finish-load',showUpdateStatus);
 window.on('closed',()=>{window=null;app.quit();});
 return window.webContents.session.clearCache().then(()=>window.loadURL(origin+'/')); 
}
if(!app.requestSingleInstanceLock({build:build.id}))app.quit();
else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(()=>{
  if(app.dock)app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname,'icon.png')));
  const updateMenu=()=>{const state=updates?.state;Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'DFO Companion',submenu:[{label:'About DFO Companion',click:()=>dialog.showMessageBox({type:'info',title:'DFO Companion',message:build.label,detail:'Build '+build.id})},{type:'separator'},{label:state==='ready'?'Install downloaded update…':state==='available'?'Download update…':state==='downloading'?'Downloading update…':'Check for updates…',enabled:state!=='checking'&&state!=='downloading',click:()=>state==='ready'?updates.install():state==='available'?void updates.download():void updates.check(true)},{label:'Locate game artwork…',click:()=>void locateArtwork()},{role:'quit'}]},{role:'editMenu'},{label:'View',submenu:[{role:'reload'},{role:'togglefullscreen'}]},{role:'windowMenu'}]));};
  updates=setupUpdates({app,updater:process.platform==='darwin'?new MacReleaseUpdater({app,publicKey}):autoUpdater,beforeRestart:()=>{saveWindow();fileSystem.mkdirSync(path.dirname(restartFlag),{recursive:true});fileSystem.writeFileSync(restartFlag,'1');},dialog,shell:require('electron').shell,build,onStatus:status=>{updateStatus=status;updateMenu();showUpdateStatus();}});updateMenu();
  helper=utilityProcess.fork(path.join(__dirname,'service.mjs'),[],{serviceName:'DFO Companion data service',stdio:'pipe',env:{...process.env,DFO_COMPANION_ART_CONFIG:artworkConfig}});
  let ready=false;const deadline=setTimeout(()=>fail('The companion helper took too long to start.'),20000);
  helper.on('message',async message=>{if(message.error)fail(message.error);else if(message.ready&&!ready){ready=true;clearTimeout(deadline);try{const response=await fetch(origin+'/api/identity',{signal:AbortSignal.timeout(3000),redirect:'error'});const identity=await response.json();if(!response.ok||!message.instanceToken||identity.instanceToken!==message.instanceToken)throw Error('The window reached a different companion helper. The old dashboard will not be opened.');await createWindow();}catch(error){fail(error.message);}}});
  helper.on('exit',code=>{clearTimeout(deadline);if(!quitting)fail('The companion data service stopped'+(code?' unexpectedly.':'.'));});
  helper.stderr?.on('data',data=>console.error(data.toString()));
  function fail(message){if(quitting)return;quitting=true;clearTimeout(deadline);dialog.showErrorBox('DFO Companion could not start',message);app.quit();}
 }).catch(error=>{dialog.showErrorBox('DFO Companion could not start',error.message);app.quit();});
 app.on('before-quit',event=>{if(shutdownDone)return;event.preventDefault();if(shutdownStarted)return;shutdownStarted=true;quitting=true;updates?.dispose();let killTimer,forceTimer;const finish=()=>{if(shutdownDone)return;shutdownDone=true;clearTimeout(killTimer);clearTimeout(forceTimer);app.quit();};if(!helper?.pid){finish();return;}helper.once('exit',finish);try{helper.postMessage('close');}catch{}killTimer=setTimeout(()=>helper?.kill(),1500);forceTimer=setTimeout(()=>{if(helper?.pid)try{process.kill(helper.pid,'SIGKILL');}catch{}finish();},3000);});
 app.on('window-all-closed',()=>app.quit());
}
