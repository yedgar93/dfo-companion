import {createHash} from 'node:crypto';
import {launchOfficialGame} from './portable-startup.mjs';
import {startDynamicPhoneServer} from './dashboard-phone.mjs';
import {readResource,RESOURCE_ROOT,CACHE_ROOT} from './dashboard-resources.mjs';
import {sampleDashboard,closeDashboardReader,requestDashboardRefresh} from './dashboard-worker.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
import {existsSync} from 'node:fs';
import {DashboardSampler,CORE_INTERVAL} from './dashboard-model.mjs';
const root=RESOURCE_ROOT;
export const PORT=9234,ORIGIN=`http://127.0.0.1:${PORT}`,APP_ID='dfo-companion-dashboard-v1';
export function runSample(options){return sampleDashboard(options);}
export function createDashboardServer(sampler,{port=PORT,instanceToken=null,onView=()=>{},phoneStatus=()=>({enabled:false}),launchGame=launchOfficialGame,onManualRefresh=requestDashboardRefresh}={}){
 const uiVersion=Promise.all(['dashboard.html','dashboard.css','dashboard-ui.mjs','dashboard-character.mjs','dashboard-map-ui.mjs','dashboard-interior-ui.mjs','dashboard-interior-model.mjs','dashboard-dungeon-route.mjs'].map(name=>readResource(name))).then(parts=>{const hash=createHash('sha256');for(const part of parts)hash.update(part);return hash.digest('hex').slice(0,16);});
 const origin=`http://127.0.0.1:${port}`;let gameStartPending=false,lastManualRefresh=0;
 return http.createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
  const send=(code,type,body,extra={})=>{res.writeHead(code,{...headers,...extra,'Content-Type':type});res.end(body);};
  if(req.headers.host!==`127.0.0.1:${port}`||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')return send(403,'text/plain','Local dashboard only');
  if(req.url==='/api/refresh'){
 if(req.method!=='POST')return send(405,'text/plain','Use Refresh all');
 if(req.headers.origin!==origin)return send(403,'text/plain','Local dashboard only');
 if((req.headers['content-type']??'').split(';')[0]!=='application/json')return send(415,'text/plain','JSON required');
 let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size<=64)body+=chunk.toString();}if(size>64||body.trim()!=='{}')return send(400,'text/plain','Empty request required');
 if(Date.now()-lastManualRefresh<10000)return send(429,'text/plain','Please wait before refreshing again');
 lastManualRefresh=Date.now();onView();onManualRefresh();void sampler.poll();return send(202,'application/json',JSON.stringify({queued:true}));
 }
 if(req.url==='/api/game/start'){

   const json=(code,data)=>send(code,'application/json',JSON.stringify(data));
   if(req.method!=='POST')return json(405,{started:false,message:'Use the Start game button in Connection.'});
   if(req.headers.origin!==origin)return json(403,{started:false,message:'Start the game from Connection on this computer.'});
   if((req.headers['content-type']??'').split(';')[0].trim().toLowerCase()!=='application/json')return json(415,{started:false,message:'A JSON request is required.'});
   if(Number(req.headers['content-length']??0)>64)return json(413,{started:false,message:'The start request is too large.'});
   let raw='',size=0;try{for await(const chunk of req){size+=chunk.length;if(size<=64)raw+=chunk.toString('utf8');}if(size>64)return json(413,{started:false,message:'The start request is too large.'});const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)return json(400,{started:false,message:'The start request takes no game paths or arguments.'});}catch{return json(400,{started:false,message:'Invalid start request.'});}
   if(gameStartPending)return json(409,{started:false,message:'A game start is already in progress. Please wait.'});
   gameStartPending=true;try{await launchGame();return json(200,{started:true,message:'DFO is starting. Choose Play and load your character normally.'});}catch(error){return json(/already running/i.test(error.message)?409:503,{started:false,message:error.message??'DFO could not be started.'});}finally{gameStartPending=false;}
  }

  if(req.method!=='GET')return send(405,'text/plain','Read only');
  if(req.url==='/api/phone/status')return send(200,'application/json',JSON.stringify(phoneStatus()));
  if(req.url==='/api/identity')return send(200,'application/json',JSON.stringify({appId:APP_ID,root,uiVersion:await uiVersion,instanceToken}));
  if(req.url==='/api/live'){onView();const s=sampler.snapshot();const {details,...live}=s;return send(200,'application/json',JSON.stringify({...live,uiVersion:await uiVersion}));}
  if(req.url==='/api/brief'){onView();const s=sampler.snapshot(),tracker=s.details?.questTracker,quests=tracker?.views??[],quest=quests.find(q=>q.id===tracker?.pinned)??quests.find(q=>q.id===tracker?.journalFocus)??null;return send(200,'application/json',JSON.stringify({status:s.status,stale:s.stale,capturedAt:s.lastSuccess,detailsAt:s.detailsAt,player:s.player,location:s.pose?.location??null,quest:quest?{title:quest.title,objective:quest.objective,destination:quest.destination,completed:quest.completed}:null,attributes:s.details?.attributes??null,inventoryCount:s.details?.items?.length??null,readOnly:true}));}
  if(req.url==='/api/state'){
onView();return send(200,'application/json',JSON.stringify(sampler.snapshot()));}
  const art=/^\/api\/art\/([a-f0-9]{64}\.(?:json|png))$/.exec(req.url);if(art){try{return send(200,art[1].endsWith('.png')?'image/png':'application/json',await readFile(join(CACHE_ROOT,'paperdoll',art[1])),{'Cache-Control':'private, max-age=31536000, immutable'});}catch{return send(404,'text/plain','Artwork unavailable');}}
  const asset={'/service-catalog.json':['service-catalog.json','application/json'],'/':['dashboard.html','text/html; charset=utf-8'],'/dashboard.css':['dashboard.css','text/css; charset=utf-8'],'/dashboard-mobile.css':['dashboard-mobile.css','text/css; charset=utf-8'],'/dashboard-mobile.mjs':['dashboard-mobile.mjs','text/javascript; charset=utf-8'],'/dashboard-ui.mjs':['dashboard-ui.mjs','text/javascript; charset=utf-8'],'/dashboard-character.mjs':['dashboard-character.mjs','text/javascript; charset=utf-8'],'/dashboard-qr.mjs':['dashboard-qr.mjs','text/javascript; charset=utf-8'],'/dashboard-alerts.mjs':['dashboard-alerts.mjs','text/javascript; charset=utf-8'],'/dashboard-items.mjs':['dashboard-items.mjs','text/javascript; charset=utf-8'],'/dashboard-fonts/pixelify-sans.woff2':['dashboard-fonts/pixelify-sans.woff2','font/woff2'],'/dashboard-fonts/pixelify-five.woff2':['dashboard-fonts/pixelify-five.woff2','font/woff2'],'/dashboard-fonts/pixelify-glyphs.woff2':['dashboard-fonts/pixelify-glyphs.woff2','font/woff2'],'/dashboard-art/game-frame.svg':['dashboard-art/game-frame.svg','image/svg+xml'],'/dashboard-art/game-grain.svg':['dashboard-art/game-grain.svg','image/svg+xml'],'/dashboard-dungeon-route.mjs':['dashboard-dungeon-route.mjs','text/javascript; charset=utf-8'],'/dashboard-interior-ui.mjs':['dashboard-interior-ui.mjs','text/javascript; charset=utf-8'],'/dashboard-interior-model.mjs':['dashboard-interior-model.mjs','text/javascript; charset=utf-8'],'/dashboard-map-ui.mjs':['dashboard-map-ui.mjs','text/javascript; charset=utf-8'],'/dashboard-map-model.mjs':['dashboard-map-model.mjs','text/javascript; charset=utf-8'],'/paperdoll-preview.mjs':['paperdoll-preview.mjs','text/javascript; charset=utf-8'],'/paperdoll-composite.mjs':['paperdoll-composite.mjs','text/javascript; charset=utf-8'],'/vendor/dfo-formats/dyes.js':['vendor/dfo-formats/dyes.js','text/javascript; charset=utf-8']}[req.url] ?? (/^\/dashboard-art\/[a-z]+\.png$/.test(req.url)?[req.url.slice(1),'image/png']:null);
  if(!asset)return send(404,'text/plain','Not found');
  try{send(200,asset[1],await readResource(asset[0]),req.url.startsWith('/dashboard-art/')?{'Cache-Control':'private, max-age=86400'}:{});}catch{send(500,'text/plain','Dashboard file unavailable');}
 });
}
export async function existingDashboard(){try{const r=await fetch(ORIGIN+'/api/identity',{signal:AbortSignal.timeout(1500),redirect:'error'});const data=await r.json();return r.ok&&data.appId===APP_ID;}catch{return false;}}
export async function openWindow({platform=process.platform,run=execFile}={}){
 if(platform==='darwin'){await new Promise((resolve,reject)=>run('/usr/bin/open',[ORIGIN+'/'],{windowsHide:true,timeout:5000},error=>error?reject(Error('The dashboard browser could not be opened.')):resolve()));return;}
 // Reuse our existing app window. This never activates or controls DFO.
 if(platform==='win32'){
  const focused=await new Promise(resolve=>execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',"$w=New-Object -ComObject WScript.Shell; if($w.AppActivate('DFO Companion')){'FOUND'}"],{windowsHide:true,timeout:4000},(e,out)=>resolve(!e&&out.trim()==='FOUND')));
  if(focused)return;
 }
 const candidates=[join(process.env['ProgramFiles(x86)']??'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),join(process.env.ProgramFiles??'C:/Program Files','Google/Chrome/Application/chrome.exe')];
 const browser=candidates.find(existsSync);if(!browser)throw Error('Edge or Chrome is required for the dashboard window.');
 const child=spawn(browser,[`--app=${ORIGIN}/`],{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>{});child.unref();
}
export async function startDashboard({open=false,instanceToken=null}={}){
 if(await existingDashboard()){if(open)await openWindow();return {reused:true};}
 let viewerSeen=Date.now(),phone=null;
 const sampler=new DashboardSampler(runSample),server=createDashboardServer(sampler,{instanceToken,onView:()=>{viewerSeen=Date.now();},phoneStatus:()=>phone?.status()??{enabled:false}});
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(PORT,'127.0.0.1',resolve);});}catch(e){if(e.code==='EADDRINUSE'&&await existingDashboard()){if(open)await openWindow();return {reused:true};}throw e;}
 phone=await startDynamicPhoneServer();
 let stopped=false,timer;const tick=async()=>{const started=Date.now();if(Date.now()-viewerSeen<15000)await sampler.poll();if(!stopped)timer=setTimeout(tick,Math.max(250,CORE_INTERVAL-(Date.now()-started)));};void tick();
 if(open)await openWindow();
 return {server,sampler,close:()=>{stopped=true;clearTimeout(timer);closeDashboardReader();phone?.close();server.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){startDashboard({open:process.argv.includes('--open')}).catch(e=>{process.stderr.write('Dashboard could not start: '+e.message+'\n');process.exitCode=1;});}
