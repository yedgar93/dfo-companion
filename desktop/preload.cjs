const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('dfoCompanion',Object.freeze({
 version:()=>ipcRenderer.invoke('dfo:version'),
 checkForUpdates:()=>ipcRenderer.invoke('dfo:check-for-updates')
}));
