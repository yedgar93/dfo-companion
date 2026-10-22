const {app,BrowserWindow,utilityProcess,dialog,Menu,nativeImage}=require('electron');
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
const origin='http://127.0.0.1:9234';
function createWindow(){
 window=new BrowserWindow({width:1050,height:820,minWidth:420,minHeight:480,title:'DFO Companion · '+build.label,backgroundColor:'#191e17',show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:true}});
 window.on('page-title-updated',event=>{event.preventDefault();window.setTitle('DFO Companion · '+build.label);});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(url!==origin+'/')event.preventDefault();});
 window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 window.once('ready-to-show',()=>quietRestart?window.showInactive():window.show());
 window.on('closed',()=>{window=null;app.quit();});
 return window.webContents.session.clearCache().then(()=>window.loadURL(origin+'/')); 
}
if(!app.requestSingleInstanceLock({build:build.id}))app.quit();
else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(()=>{
  if(app.dock)app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname,'icon.png')));
  const updateMenu=()=>{const state=updates?.state;Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'DFO Companion',submenu:[{label:'About DFO Companion',click:()=>dialog.showMessageBox({type:'info',title:'DFO Companion',message:build.label,detail:'Build '+build.id})},{type:'separator'},{label:state==='ready'?'Install downloaded update…':state==='available'?'Download update…':state==='downloading'?'Downloading update…':'Check for updates…',enabled:state!=='checking'&&state!=='downloading',click:()=>state==='ready'?updates.install():state==='available'?void updates.download():void updates.check(true)},{role:'quit'}]},{role:'editMenu'},{label:'View',submenu:[{role:'reload'},{role:'togglefullscreen'}]},{role:'windowMenu'}]));};
  updates=setupUpdates({app,updater:process.platform==='darwin'?new MacReleaseUpdater({app,publicKey}):autoUpdater,beforeRestart:()=>{fileSystem.mkdirSync(path.dirname(restartFlag),{recursive:true});fileSystem.writeFileSync(restartFlag,'1');},dialog,shell:require('electron').shell,build,onStatus:updateMenu});updateMenu();
  helper=utilityProcess.fork(path.join(__dirname,'service.mjs'),[],{serviceName:'DFO Companion data service',stdio:'pipe'});
  let ready=false;const deadline=setTimeout(()=>fail('The companion helper took too long to start.'),20000);
  helper.on('message',async message=>{if(message.error)fail(message.error);else if(message.ready&&!ready){ready=true;clearTimeout(deadline);try{const response=await fetch(origin+'/api/identity',{signal:AbortSignal.timeout(3000),redirect:'error'});const identity=await response.json();if(!response.ok||!message.instanceToken||identity.instanceToken!==message.instanceToken)throw Error('The window reached a different companion helper. The old dashboard will not be opened.');await createWindow();}catch(error){fail(error.message);}}});
  helper.on('exit',code=>{clearTimeout(deadline);if(!quitting)fail('The companion data service stopped'+(code?' unexpectedly.':'.'));});
  helper.stderr?.on('data',data=>console.error(data.toString()));
  function fail(message){if(quitting)return;quitting=true;clearTimeout(deadline);dialog.showErrorBox('DFO Companion could not start',message);app.quit();}
 }).catch(error=>{dialog.showErrorBox('DFO Companion could not start',error.message);app.quit();});
 app.on('before-quit',event=>{if(shutdownDone)return;event.preventDefault();if(shutdownStarted)return;shutdownStarted=true;quitting=true;updates?.dispose();let killTimer,forceTimer;const finish=()=>{if(shutdownDone)return;shutdownDone=true;clearTimeout(killTimer);clearTimeout(forceTimer);app.quit();};if(!helper?.pid){finish();return;}helper.once('exit',finish);try{helper.postMessage('close');}catch{}killTimer=setTimeout(()=>helper?.kill(),1500);forceTimer=setTimeout(()=>{if(helper?.pid)try{process.kill(helper.pid,'SIGKILL');}catch{}finish();},3000);});
 app.on('window-all-closed',()=>app.quit());
}
