// Independent phone-browser checks. Fixtures use the real allowlisted server;
// --live uses only the installed Companion's paired, read-only cached endpoints.
// Never connects to DFO's inspector, requests a full refresh, or starts a game.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {webkit,chromium,devices} from 'playwright';
import {createDashboardServer} from '../src/dashboard-server.mjs';
import {interiorSceneKey} from '../src/dashboard-interior-model.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const live=process.argv.includes('--live');
const engineArg=process.argv.find(a=>a.startsWith('--browser='))?.split('=')[1]??'both';
assert(['webkit','chromium','both'].includes(engineArg),'Use --browser=webkit, chromium or both');
const engines=engineArg==='both'?['webkit','chromium']:[engineArg];
const output=path.join(root,'visual-results/mobile');
const profiles=[{name:'compact-phone',width:375,height:667},{name:'iphone-size',width:393,height:852},{name:'large-phone',width:430,height:932}];
const report={mode:live?'installed-read-only':'fixtures',startedAt:new Date().toISOString(),cases:[],passed:false};
let server,browser,fixture,base,dungeon,origin;

function snapshot(){
 const s=structuredClone(fixture),now=new Date().toISOString();s.serverTime=now;
 if(!s.stale){s.lastSuccess=s.detailsAt=now;if(s.pose)s.pose.capturedAt=now;}
 return s;
}
async function prepareFixtures(){
 const load=async name=>JSON.parse(await readFile(path.join(root,'src/test/fixtures/snapshots',name+'.json'),'utf8'));
 base=await load('town-full');dungeon=await load('dungeon');
 base.details.items=Array.from({length:130},(_,i)=>({...structuredClone(base.details.items[i%base.details.items.length]),index:i,name:i===129?'An extraordinarily long named item with several magical properties':base.details.items[i%base.details.items.length].name+' '+i}));
 base.details.items[0].name='An exceptionally long equipped garment name with multiple magical properties';
 base.detailsVersion=100;
 const loc=dungeon.pose?.location??dungeon.details.location;loc.position={x:0,y:0,z:0};loc.mode='dungeon';
 dungeon.details.interiorMap={available:true,sceneKey:interiorSceneKey(loc),geometry:{available:true,parts:[{positions:[-20,0,-10,20,0,-10,20,0,10,-20,0,10,-5,8,-20,5,8,-20,5,8,20,-5,8,20],indices:[0,1,2,0,2,3,4,5,6,4,6,7]}]},objectives:[],exit:{name:'Exit · entrance',position:{x:-18,y:0,z:0}}};
 dungeon.detailsVersion=200;fixture=base;
 const port=Number(process.env.DFO_MOBILE_TEST_PORT??19627);
 assert(Number.isInteger(port)&&port>1024&&port<65536,'Invalid fixture port');
 server=createDashboardServer({snapshot,poll:async()=>{throw Error('Mobile tests must never request a game refresh');}},{port,launchGame:async()=>{throw Error('Game launch forbidden in mobile tests');}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 origin='http://127.0.0.1:'+port;
}
async function pairing(){
 const r=await fetch('http://127.0.0.1:9234/api/phone/status',{signal:AbortSignal.timeout(5000)});
 assert(r.ok,'Installed Companion phone status unavailable');const status=await r.json();
 assert(status.enabled&&status.url,'Enable pairing in the installed Companion first');
 const u=new URL(status.url),parts=u.hostname.split('.').map(Number);
 const privateHost=parts.length===4&&parts.every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&(parts[0]===10||parts[0]===192&&parts[1]===168||parts[0]===172&&parts[1]>=16&&parts[1]<=31);
 assert(privateHost&&u.protocol==='http:'&&u.port==='9235'&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/pair\/[\w-]{43}$/.test(u.pathname),'Invalid local pairing address');
 return u;
}
async function noClipping(page,selector){
 const failures=await page.locator(selector).evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&(!n.closest('details:not([open])')||n.closest('summary'))).flatMap(n=>{
  const r=n.getBoundingClientRect(),c=getComputedStyle(n),range=document.createRange();range.selectNodeContents(n);const t=range.getBoundingClientRect();
  const own=n.scrollWidth>n.clientWidth+2||n.scrollHeight>n.clientHeight+2||c.textOverflow==='ellipsis'||t.left<r.left-2||t.right>r.right+2||t.top<r.top-2||t.bottom>r.bottom+2;
  let clipped=false,x=true,y=true;
  for(let a=n.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect();if(['auto','scroll'].includes(s.overflowX))x=false;if(['auto','scroll'].includes(s.overflowY))y=false;if(x&&['hidden','clip'].includes(s.overflowX)&&(t.left<b.left-2||t.right>b.right+2)||y&&['hidden','clip'].includes(s.overflowY)&&(t.top<b.top-2||t.bottom>b.bottom+2)){clipped=true;break;}}
  return own||clipped?[n.textContent]:[];
 }));
 assert.deepEqual(failures,[],'Text clipped: '+selector);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal page overflow');
}
async function runCase(engine,profile){
 const entry={engine,profile:profile.name,viewport:{width:profile.width,height:profile.height},checks:[],passed:false};report.cases.push(entry);
 const context=await browser.newContext({...devices['iPhone 13'],viewport:entry.viewport,screen:entry.viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{try{localStorage.setItem('dfo-companion-first-run-seen','1');}catch{}});
 const page=await context.newPage(),errors=[],forbidden=[];
 page.on('pageerror',error=>errors.push(error.message));
 const prefix=engine+'-'+profile.name;
 const capture=async name=>{await page.screenshot({path:path.join(output,prefix+'-'+name+'.png'),animations:'disabled'});};
 const tab=async id=>{await page.locator('[data-page="'+id+'"]').tap();await page.locator('#'+id).waitFor({state:'visible'});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
 try{
  let target;
  if(live){target=await pairing();origin=target.origin;}
  else{fixture=base;target=new URL('http://mobile.example.test/');}
  // The reserved fixture origin makes the UI behave like a paired phone. Every
  // fixture request is fulfilled from loopback; no DNS or internet request runs.
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(req.method()!=='GET'||u.origin!==target.origin||/^\/api\/(refresh|game|identity|phone)(?:\/|$)/.test(u.pathname)||u.port==='9223'){
    forbidden.push(u.pathname);await route.abort();return;
   }
   if(live)await route.continue();
   else{const upstream=await fetch(origin+u.pathname+u.search,{headers:{Host:new URL(origin).host},signal:AbortSignal.timeout(10000)});const headers=Object.fromEntries(upstream.headers);for(const h of ['connection','transfer-encoding','content-encoding','content-length'])delete headers[h];await route.fulfill({status:upstream.status,headers,body:Buffer.from(await upstream.arrayBuffer())});}
  });
  await page.goto(target.href);
  await page.locator('#inventory-items .item').first().waitFor({state:'attached',timeout:20000});
  entry.capabilities=await page.evaluate(()=>({maxTouchPoints:navigator.maxTouchPoints,coarsePointer:matchMedia('(pointer:coarse)').matches,touchStart:'ontouchstart' in window}));
  await page.evaluate(()=>{window.__mobileTestTouch=false;document.addEventListener('touchstart',event=>{if(event.isTrusted)window.__mobileTestTouch=true;},{once:true});});
  await tab('pack');assert(await page.locator('.gear').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect();return r.top>=document.querySelector('.hud').getBoundingClientRect().bottom-1&&r.bottom<=document.querySelector('.tabs').getBoundingClientRect().top+1;})),'Main gear must be visible with the portrait');assert(await page.evaluate(()=>window.__mobileTestTouch),'Phone tap did not deliver a trusted touch event');entry.checks.push('trusted touch interaction');
  await page.locator('[data-mobile-view="inventory"]').tap();
  assert.equal(await page.locator('.equipment-panel').isVisible(),false,'Inventory must replace Equipment');
  for(const fraction of [0,.5,1]){await page.evaluate(f=>scrollTo(0,f*(document.documentElement.scrollHeight-innerHeight)),fraction);await page.waitForTimeout(80);assert(await page.locator('.tabs').evaluate(n=>Math.abs(n.getBoundingClientRect().bottom-innerHeight)<2),'Navigation detached from viewport bottom');}entry.checks.push('bottom navigation at all scroll positions');
  await noClipping(page,'.item-name');await capture('inventory');entry.checks.push('inventory replaces equipment; full names');
  const name=await page.locator('#inventory-items .item .item-name').first().innerText();
  await page.locator('#item-search').fill(name);await page.waitForTimeout(200);
  assert(await page.locator('#inventory-items .item').count()>0,'Search lost the selected item');
  await page.locator('#inventory-items .item').first().tap();
  await page.locator('.mobile-item-sheet[open]').waitFor();await noClipping(page,'.mobile-item-sheet h3');
  await capture('item-sheet');await page.locator('.mobile-item-sheet-close').tap();
  assert.equal(await page.locator('.mobile-item-sheet').isVisible(),false);entry.checks.push('search; touch item sheet; close');
  await tab('character');await noClipping(page,'.character-row');
  await page.getByRole('button',{name:'Skills',exact:true}).tap();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert(await page.evaluate(()=>{const t=document.querySelector('.character-skills').getBoundingClientRect().top;const expected=document.querySelector('.hud').getBoundingClientRect().bottom+8;return Math.abs(t-expected)<4||Math.abs(scrollY-(document.documentElement.scrollHeight-innerHeight))<4;}),'Skills shortcut must clear the compact top bar');
  await capture('skills');entry.checks.push('Character names; section jump');
  await page.getByRole('button',{name:'Overview',exact:true}).tap();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await tab('pack');
  assert(await page.locator('.mobile-pack-nav').evaluate(n=>n.getBoundingClientRect().top>=document.querySelector('.hud').getBoundingClientRect().bottom-1),'Pack navigation must not hide under the top bar after a section jump');entry.checks.push('persistent compact header; page landing');
  if(!live){fixture=dungeon;await page.reload();await page.locator('#inventory-items .item').first().waitFor({state:'attached'});}
  await tab('map');
  assert(await page.locator('#dungeon-map').evaluate(c=>{if(c.hidden)return true;const r=c.getBoundingClientRect(),v=document.querySelector('#map-markers').viewBox.baseVal;return Math.abs(c.width/c.height-r.width/r.height)<.01&&Math.abs(v.width/v.height-r.width/r.height)<.01;}),'Dungeon canvas/markers must fill the frame aspect');
  assert(await page.locator('#map-stage').evaluate(n=>n.getBoundingClientRect().height>=295),'Map too short');await capture('map');
  await page.locator('#map-expand').tap();assert(await page.locator('body').evaluate(n=>n.classList.contains('map-expanded')));
  if(!await page.locator('#map-dungeon-plan').evaluate(n=>n.hidden)){
   await page.locator('.map-floor-menu>summary').tap();await page.locator('#map-dungeon-plan').tap();
   assert.equal(await page.locator('#map-dungeon-plan').innerText(),'3D view','Plan toggle did not enter plan view');
   await page.locator('.map-floor-menu>summary').tap();entry.checks.push('Plan control through More menu');
  }
  await capture('expanded-map');await page.locator('#map-expand').tap();entry.checks.push('map; expanded mode');
  if(!live){fixture={...structuredClone(dungeon),stale:true,lastSuccess:'2000-01-01T00:00:00Z',detailsAt:'2000-01-01T00:00:00Z',detailsVersion:201};await page.reload();await page.locator('#inventory-items .item').first().waitFor({state:'attached'});await tab('map');
   assert.match(await page.locator('#map-callouts').innerText(),/Last known position/);assert.equal(await page.locator('.hud .vitals>.stale-age-tag').count(),0);await capture('stale-map');entry.checks.push('single freshness label; stale map marker');}
  await tab('connection-page');assert.equal(await page.locator('#game-start-panel').isVisible(),false,'Phone must not offer computer launch');await capture('connection');entry.checks.push('computer actions hidden');
  assert.deepEqual(errors,[],'Browser script errors');assert.deepEqual(forbidden,[],'Unexpected mutation/computer-only request');entry.passed=true;
 }catch(error){entry.error=error.message;await capture('FAILED').catch(()=>{});throw error;}
 finally{await context.close();}
}
try{
 await mkdir(output,{recursive:true});if(!live)await prepareFixtures();
 for(const engine of engines){browser=await({webkit,chromium}[engine]).launch({headless:true});try{for(const profile of profiles)await runCase(engine,profile);}finally{await browser.close();browser=null;}}
 report.passed=true;
}catch(error){report.error=error.message;process.exitCode=1;}
finally{
 if(browser)await browser.close().catch(()=>{});if(server)await new Promise(resolve=>server.close(resolve));
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({mode:report.mode,passed:report.passed,cases:report.cases.length,output,error:report.error}));
}
