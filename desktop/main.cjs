const {app,BrowserWindow,utilityProcess,dialog,Menu,nativeImage}=require('electron');
const path=require('node:path');
const {autoUpdater}=require('electron-updater');
const {setupUpdates}=require('./updates.cjs');
const build=require('./build.json');
app.setName('DFO Companion');
let window,helper,updates,quitting=false;
const origin='http://127.0.0.1:9234';
function createWindow(){
 window=new BrowserWindow({width:1050,height:820,minWidth:420,minHeight:480,title:'DFO Companion · '+build.label,backgroundColor:'#191e17',show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:true}});
 window.on('page-title-updated',event=>{event.preventDefault();window.setTitle('DFO Companion · '+build.label);});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(url!==origin+'/')event.preventDefault();});
 window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 window.once('ready-to-show',()=>window.show());
 window.on('closed',()=>{window=null;app.quit();});
 return window.webContents.session.clearCache().then(()=>window.loadURL(origin+'/')); 
}
if(!app.requestSingleInstanceLock({build:build.id}))app.quit();
else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(()=>{
  if(app.dock)app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname,'icon.png')));
  const updateMenu=()=>{const state=updates?.state;Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'DFO Companion',submenu:[{label:'About DFO Companion',click:()=>dialog.showMessageBox({type:'info',title:'DFO Companion',message:build.label,detail:'Build '+build.id})},{type:'separator'},{label:state==='ready'?'Install downloaded update…':state==='available'?'Download update…':state==='downloading'?'Downloading update…':'Check for updates…',enabled:state!=='checking'&&state!=='downloading',click:()=>state==='ready'?updates.install():state==='available'?void updates.download():void updates.check(true)},{role:'quit'}]},{role:'editMenu'},{label:'View',submenu:[{role:'reload'},{role:'togglefullscreen'}]},{role:'windowMenu'}]));};
  updates=setupUpdates({app,updater:autoUpdater,dialog,shell:require('electron').shell,build,onStatus:updateMenu});updateMenu();
  helper=utilityProcess.fork(path.join(__dirname,'service.mjs'),[],{serviceName:'DFO Companion data service',stdio:'pipe'});
  let ready=false;const deadline=setTimeout(()=>fail('The companion helper took too long to start.'),20000);
  helper.on('message',async message=>{if(message.error)fail(message.error);else if(message.ready&&!ready){ready=true;clearTimeout(deadline);try{const response=await fetch(origin+'/api/identity',{signal:AbortSignal.timeout(3000),redirect:'error'});const identity=await response.json();if(!response.ok||!message.instanceToken||identity.instanceToken!==message.instanceToken)throw Error('The window reached a different companion helper. The old dashboard will not be opened.');await createWindow();}catch(error){fail(error.message);}}});
  helper.on('exit',code=>{clearTimeout(deadline);if(!quitting)fail('The companion data service stopped'+(code?' unexpectedly.':'.'));});
  helper.stderr?.on('data',data=>console.error(data.toString()));
  function fail(message){if(quitting)return;quitting=true;clearTimeout(deadline);dialog.showErrorBox('DFO Companion could not start',message);app.quit();}
 }).catch(error=>{dialog.showErrorBox('DFO Companion could not start',error.message);app.quit();});
 app.on('before-quit',()=>{quitting=true;updates?.dispose();helper?.kill();});
 app.on('window-all-closed',()=>app.quit());
}
