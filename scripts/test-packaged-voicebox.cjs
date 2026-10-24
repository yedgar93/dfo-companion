const {spawnSync}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs');
const resources=process.platform==='darwin'?path.resolve('dist/mac-arm64/DFO Companion.app/Contents/Resources'):path.resolve('dist/win-unpacked/resources');
const root=path.join(resources,'app.asar','desktop');
if(!fs.existsSync(path.join(resources,'app.asar')))throw Error('Build the native app before the packaged VoiceBox check');
const result=spawnSync(require('electron'),['scripts/test-voicebox.cjs'],{stdio:'inherit',windowsHide:true,env:{...process.env,DFO_VOICEBOX_PACKAGED_ROOT:root}});process.exitCode=result.status??1;
