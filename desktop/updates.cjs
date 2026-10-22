const RELEASES='https://github.com/yedgar93/dfo-companion/releases/latest';
function setupUpdates({app,updater,dialog,shell,build,platform=process.platform,beforeRestart=()=>{},onStatus=()=>{},schedule=setTimeout,repeat=setInterval}){
 let state='idle',version=null,percent=null,manual=false,busy=false,restartTimer=null;const supported=true;
 updater.autoDownload=false;updater.autoInstallOnAppQuit=supported;updater.autoRunAppAfterInstall=true;
 const status=next=>{state=next;onStatus({state,version,percent,supported});};
 updater.on('error',error=>{busy=false;status('error');if(manual){manual=false;dialog.showMessageBox({type:'info',message:'Update check unavailable',detail:'Try again later or download the latest release from GitHub.'});}});
 updater.on('update-not-available',()=>{busy=false;status('current');if(manual){manual=false;dialog.showMessageBox({type:'info',message:'You have the latest release.'});}});
 updater.on('update-available',info=>{busy=false;version=info.version;status('available');manual=false;void download(true);});
 updater.on('download-progress',progress=>{percent=Math.max(0,Math.min(100,Number(progress.percent)||0));status('downloading');});
 updater.on('update-downloaded',()=>{busy=false;status('ready');if(!restartTimer)restartTimer=schedule(()=>{restartTimer=null;install();},5000);});
 async function check(showResult=false){if(!app.isPackaged||busy)return;manual=showResult;busy=true;status('checking');try{await updater.checkForUpdates();}catch{busy=false;status('error');if(manual){manual=false;await dialog.showMessageBox({type:'info',message:'Update check unavailable',detail:'Try again later.'});}}}
 async function download(automatic=false){if(state!=='available'||busy)return;if(!supported){await shell.openExternal(RELEASES);return;}const choice=automatic?{response:0}:await dialog.showMessageBox({type:'question',buttons:['Download update','Later'],defaultId:0,cancelId:1,message:'Download DFO Companion '+version+'?',detail:'It installs when you quit the companion. DFO will not be restarted.'});if(choice.response!==0)return;busy=true;percent=null;status('downloading');try{await updater.downloadUpdate();}catch{busy=false;status('error');}}
 function install(){if(state==='ready'&&supported){clearTimeout(restartTimer);restartTimer=null;status('installing');beforeRestart();updater.quitAndInstall(true,true);};}
 let initial,timer;if(app.isPackaged){initial=schedule(()=>void check(),1000);timer=repeat(()=>void check(),5*60*1000);initial?.unref?.();timer?.unref?.();}
 return {check,download,install,get state(){return state;},dispose(){clearTimeout(restartTimer);clearTimeout(initial);clearInterval(timer);}};
}
module.exports={setupUpdates};
