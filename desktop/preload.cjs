const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('dfoCompanion',Object.freeze({
 version:()=>ipcRenderer.invoke('dfo:version'),
 checkForUpdates:()=>ipcRenderer.invoke('dfo:check-for-updates'),
 voiceBox:Object.freeze({command:message=>ipcRenderer.invoke('dfo:voicebox-control',message),subscribe:callback=>{const listener=(_event,message)=>callback(message);ipcRenderer.on('dfo:voicebox-event',listener);return()=>ipcRenderer.removeListener('dfo:voicebox-event',listener);}})
}));
