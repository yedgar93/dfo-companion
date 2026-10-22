const path=require('node:path');
// Small local About window: fonts and markup ship inside the app; nothing is fetched at runtime.
const ABOUT_HTML=path.join(__dirname,'about.html');
function aboutWindowOptions(parent){return {parent:parent??undefined,modal:!!parent,width:360,height:260,resizable:false,minimizable:false,maximizable:false,fullscreenable:false,title:'About DFO Companion',backgroundColor:'#191e17',autoHideMenuBar:true,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}};}
function aboutQuery(build){return {label:String(build?.label??''),id:String(build?.id??'')};}
let open=null;
function showAbout(BrowserWindow,build,parent){if(open&&!open.isDestroyed()){open.focus();return open;}const win=new BrowserWindow(aboutWindowOptions(parent));open=win;win.removeMenu?.();win.once('ready-to-show',()=>win.show());win.on('closed',()=>{if(open===win)open=null;});win.webContents.setWindowOpenHandler?.(()=>({action:'deny'}));void win.loadFile(ABOUT_HTML,{query:aboutQuery(build)});return win;}
module.exports={ABOUT_HTML,aboutWindowOptions,aboutQuery,showAbout};
