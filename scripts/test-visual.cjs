// Real allowlisted HTTP server + offscreen Electron. Synthetic fixtures only; never attaches to DFO.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
// Use the native graphics backend; no visible window or game connection is created.
const output=path.resolve(process.env.DFO_VISUAL_OUTPUT||'visual-results');
let server,win;let errors=[];
async function run(){
 await app.whenReady();
 const {createDashboardServer}=await import('../src/dashboard-server.mjs');
 const {interiorSceneKey}=await import('../src/dashboard-interior-model.mjs');
 const base=JSON.parse(await fs.readFile(path.join(__dirname,'../src/test/fixtures/snapshots/town-full.json'),'utf8'));
 let fixture=base;const snapshot=()=>{const s=structuredClone(fixture),now=new Date().toISOString();s.serverTime=now;if(!s.stale){s.lastSuccess=s.detailsAt=now;if(s.pose)s.pose.capturedAt=now;}return s;};
 server=createDashboardServer({snapshot,poll:async()=>snapshot()},{port:19261,launchGame:async()=>{throw Error('Game launch forbidden in visual tests');}});
 await new Promise(r=>server.listen(19261,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false}});
 win.webContents.on('console-message',event=>{if(event.level==='error'&&!/404|ERR_FILE_NOT_FOUND/.test(event.message))errors.push(event.message);});
 win.webContents.on('render-process-gone',(_e,d)=>errors.push(d.reason));
 const js=code=>win.webContents.executeJavaScript(code,true).catch(e=>{throw Error('Renderer script: '+code+'\n'+e.message);});
 const settle=()=>js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 async function page(name){await js(`document.querySelector('[data-page="${name}"]').click()`);await settle();assert(await js(`!document.getElementById('${name}').hidden`),'requested page must stay selected');}
 async function capture(name){await settle();const image=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Offscreen paint timeout')),5000);win.webContents.once('paint',(_event,_dirty,image)=>{clearTimeout(timeout);resolve(image);});win.webContents.invalidate();});await fs.writeFile(path.join(output,name+'.png'),image.toPNG());}
 async function load(width,height){win.setContentSize(width,height);await win.loadURL(origin);await win.webContents.insertCSS('*{animation:none!important;transition:none!important}');await js(`localStorage.setItem('dfo-companion-first-run-seen','1');document.querySelector('#first-run')?.close();document.querySelector('.splash')?.remove()`);for(let i=0;i<50;i++){if(await js("!!document.querySelector('#inventory-items .item')"))break;await new Promise(r=>setTimeout(r,50));}await settle();}
 async function fullText(selector){const failures=await js(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).filter(n=>n.getClientRects().length).flatMap(n=>{const c=getComputedStyle(n),r=n.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(n);const t=range.getBoundingClientRect();return n.scrollWidth>n.clientWidth+2||n.scrollHeight>n.clientHeight+2||c.textOverflow==='ellipsis'||t.bottom>r.bottom+2?[{text:n.textContent,width:r.width,height:r.height,scroll:n.scrollHeight,overflow:c.textOverflow}]:[]})`);assert.deepEqual(failures,[],'visible text must fit: '+selector);}
 await fs.mkdir(output,{recursive:true});
 // Many items and a long faction list reproduce the inspected density without private data.
 base.details.items=Array.from({length:130},(_,i)=>({...structuredClone(base.details.items[i%base.details.items.length]),index:i,name:i===129?'A very long named item with multiple magical properties '+i:base.details.items[i%base.details.items.length].name+' '+i}));
 base.details.items[0].name='An extraordinarily lengthy equipped garment with multiple magical properties and an unusually long title';base.details.items[0].equipSlot=17;base.details.items[0].equipped=true;base.details.items.push({...structuredClone(base.details.items[0]),index:131,name:'Another lengthy chest armour name with elaborate magical properties',equipSlot:18});
 base.detailsVersion=10;base.details.characterSheet??={};base.details.characterSheet.factions=Array.from({length:48},(_,i)=>({id:i,name:'Fixture faction '+i,reputation:i-24}));
 await load(1440,1000);await page('character');
 assert.equal(await js("document.querySelectorAll('.character-column').length"),3);
 assert(await js("document.querySelector('.character-skills').getBoundingClientRect().top < 500"),'skills must appear in initial desktop viewport');
 assert(await js("document.querySelector('#game-start-panel').hidden"),'connected startup advice must be hidden');
 await capture('desktop-character');
 await page('pack');await js("document.querySelector('#inventory-layout').value='list';document.querySelector('#inventory-layout').dispatchEvent(new Event('change'))");await settle();
 assert.equal(await js("document.querySelector('#inventory-items').dataset.layout"),'list');await fullText('.item-name,.gear-name');await capture('desktop-pack-list');
 await js("document.querySelector('#inventory-items .item').dispatchEvent(new MouseEvent('mouseenter'));document.querySelector('#inventory-items .item').focus();document.querySelector('#inventory-items .item').click()");await settle();assert(await js("document.querySelector('#item-tooltip').hidden"),'desktop selection must dismiss tooltip');
 await page('connection-page');await capture('desktop-connection');
 for(const width of [375,393]){
  await load(width,852);await page('pack');await js("document.querySelector('[data-mobile-view=inventory]').click()");await settle();
  assert(await js("getComputedStyle(document.querySelector('#categories')).display==='none'"));
  await js("document.querySelector('#item-search').value='very long';document.querySelector('#item-search').dispatchEvent(new Event('input'))");await settle();for(let i=0;i<30;i++){if(await js("document.querySelectorAll('#inventory-items .item').length===1"))break;await new Promise(r=>setTimeout(r,30));}
  assert.equal(await js("document.querySelectorAll('#inventory-items .item').length"),1);
  for(const layout of ['grid','list']){await js(`document.querySelector('#inventory-layout').value='${layout}';document.querySelector('#inventory-layout').dispatchEvent(new Event('change'))`);await settle();await fullText('.item-name');await capture('phone-'+width+'-pack-'+layout);}
  await js("document.querySelector('#inventory-items .item').dispatchEvent(new MouseEvent('mouseenter'));document.querySelector('#inventory-items .item').focus()");
  await js("document.querySelector('#inventory-items .item').click()");await settle();
  assert(await js("document.querySelector('.mobile-item-sheet').open"),'item tap must open the mobile sheet after tile replacement');
  assert(await js("document.querySelector('.mobile-item-sheet #item-detail h3').textContent.includes('very long')"));
  await fullText('.mobile-item-sheet h3');assert(await js("document.querySelector('#item-tooltip').hidden"),'selection must dismiss tooltip');await capture('phone-'+width+'-item');await js("document.querySelector('.mobile-item-sheet-close').click()");await settle();
  assert(await js("!!document.querySelector('.inventory-panel>#item-detail')"));
  await page('character');await fullText('h1,.hud-place>strong,.character-row');await capture('phone-'+width+'-character');
  assert(await js("document.documentElement.scrollWidth <= innerWidth+1"),'phone page must not overflow horizontally');
 }
 const dungeon=JSON.parse(await fs.readFile(path.join(__dirname,'../src/test/fixtures/snapshots/dungeon.json'),'utf8'));
 const loc=dungeon.pose?.location??dungeon.details.location;loc.position={x:0,y:0,z:0};loc.mode='dungeon';
 const part={positions:[-20,0,-10,20,0,-10,20,0,10,-20,0,10,-5,8,-20,5,8,-20,5,8,20,-5,8,20],indices:[0,1,2,0,2,3,4,5,6,4,6,7]};
 dungeon.details.interiorMap={available:true,sceneKey:interiorSceneKey(loc),capturedAt:new Date().toISOString(),geometry:{available:true,parts:[part]},objectives:[],exit:{name:'Exit · entrance',position:{x:-18,y:0,z:0}}};
 dungeon.detailsVersion=20;fixture=dungeon;
 await load(393,852);await page('map');await settle();
 assert(await js("document.querySelector('#map-objective-status').textContent.includes('unavailable')"));
 assert(await js("document.querySelector('#map-stage').getBoundingClientRect().height>=295"),'normal phone map must have useful height');await capture('phone-map');await js("document.querySelector('#map-expand').click()");await settle();
 assert(await js("document.querySelector('#map-stage').getBoundingClientRect().height > 250"),'expanded phone map must gain usable height');
 await js("document.querySelector('#map-dungeon-plan').click()");await settle();assert.equal(await js("document.querySelector('#map-pan-toggle').textContent"),'Drag: pan');
 const stage=await js("(()=>{const r=document.querySelector('#map-stage').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()");
 win.webContents.sendInputEvent({type:'mouseDown',...stage,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseMove',x:stage.x+25,y:stage.y+15,button:'left'});win.webContents.sendInputEvent({type:'mouseUp',x:stage.x+25,y:stage.y+15,button:'left',clickCount:1});await settle();
 assert.equal(await js("document.querySelector('#map-dungeon-plan').textContent"),'3D view','dragging Plan must preserve Plan mode');await capture('phone-map-expanded-plan');
 await js("document.querySelector('#map-expand').click()");
 fixture={...structuredClone(base),stale:true,lastSuccess:'2000-01-01T00:00:00Z',status:{kind:'waiting',title:'Waiting for a fresh reading',message:'Showing last known data'},reason:'READ_FAILED',detailsVersion:30};
 await load(1440,1000);await page('connection-page');
 assert.equal(await js("document.querySelector('#game-start-panel').hidden"),false);
 assert.equal(await js("document.querySelector('#game-start-button').hidden"),true,'read failure must not invite game restart');await capture('desktop-stale');
 fixture=base;await win.loadURL(origin);for(let i=0;i<50;i++){if(await js("document.querySelector('#status-title').textContent==='Live character'"))break;await new Promise(r=>setTimeout(r,50));}
 assert(await js("document.querySelector('#game-start-panel').hidden"),'recovery must remove stale advice');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({visualChecks:'passed',screenshots:output,gameAttached:false}));
}
run().catch(e=>{console.error(e);console.error('Renderer errors:',errors);process.exitCode=1;}).finally(async()=>{win?.destroy();if(server)await new Promise(r=>server.close(r));app.exit(process.exitCode || 0);});
