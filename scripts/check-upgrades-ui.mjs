// Synthetic equipment/browser check through the real allowlisted dashboard.
// Never starts the application, contacts DFO, or requests a reader refresh.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createDashboardServer} from '../src/dashboard-server.mjs';
import {SKILL_NAMES} from '../src/upgrade-scoring.mjs';

const fixture=JSON.parse(await readFile(new URL('../src/test/fixtures/snapshots/town-full.json',import.meta.url),'utf8'));
const item=(index,name,value,equipSlot=null)=>({index,name,equipSlot,group:'Jewellery',templateIndex:135,material:1,identified:true,magicKnown:true,enchantmentCount:0,special:false,effectsComplete:true,condition:{current:100,max:100},affixes:[{id:'stat',param:'intelligence',value}]});
fixture.details.items=[item(0,'Worn strong ring',8,4),item(1,'Worn weak ring',1,5),item(2,'Small improvement',3),item(3,'Best intelligence ring',9)];
fixture.details.comparisonContext={inventoryComplete:true,restrictionEvidenceKnown:true,careerFlags:0,forbiddenMaterials:0,skills:SKILL_NAMES.map(name=>({name,permanent:30,display:30,effective:30})),skillGroups:{primarySkills:[22,23,24],majorSkills:[25,26,27]},attributes:{strength:50,intelligence:50,willpower:50,agility:50,endurance:50,personality:50,speed:50,luck:50},level:5,race:'Breton'};
let version=1;const port=Number(process.env.DFO_UPGRADE_TEST_PORT??19639);
const snapshot=()=>({...fixture,lastSuccess:new Date().toISOString(),detailsAt:new Date().toISOString(),serverTime:new Date().toISOString(),detailsVersion:version});
const server=createDashboardServer({snapshot},{port,launchGame:async()=>{throw Error('Game launch forbidden');},onManualRefresh:()=>{throw Error('Game reads forbidden');}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.DFO_TEST_BROWSER?{executablePath:process.env.DFO_TEST_BROWSER}:{})});
 for(const viewport of [{width:1440,height:900},{width:393,height:852}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.addInitScript(()=>localStorage.setItem('dfo-companion-first-run-seen','1'));
  await page.goto(origin);await page.locator('.splash').waitFor({state:'detached'});await page.locator('[data-page="pack"]').click();
  await page.waitForFunction(()=>document.querySelector('#inventory-items .upgrade-indicator.upgrade'));
  // Inventory is a separate section on phones. Use its real control.
  const inventoryTab=page.getByRole('button',{name:'Inventory',exact:true});if(await inventoryTab.count())await inventoryTab.click();
  const options=page.locator('.inventory-options summary');if(await options.isVisible())await options.click();
  await page.locator('#inventory-sort').selectOption('upgrades');
  assert.match(await page.locator('#inventory-items .item').first().innerText(),/Best intelligence ring/);
  await page.locator('#inventory-items .item').filter({hasText:'Best intelligence ring'}).click();
  const detail=page.locator('#item-detail');await detail.waitFor({state:'visible'});
  assert.match(await detail.innerText(),/Recommended for your.*build/);
  assert.match(await detail.innerText(),/estimated score/);
  const target=detail.locator('.comparison-target select');await target.selectOption('4');
  assert.match(await detail.innerText(),/Replacing Worn strong ring/);
  // Character/snapshot replacement must clear the previous generation's result.
  if(viewport.width>800){fixture.details.items=fixture.details.items.map(i=>i.index===3?{...i,identified:false,magicKnown:false}:i);version++;await page.waitForFunction(()=>!document.querySelector('#inventory-items .item[title^="Best intelligence ring"] .upgrade-indicator.upgrade'));}
  assert.deepEqual(errors,[]);await page.close();
  fixture.details.items[3]={...fixture.details.items[3],identified:true,magicKnown:true};version++;
 }
 console.log(JSON.stringify({passed:true,viewports:2,gameReads:0,checks:['score sorting','recommendation reason','explicit ring target','snapshot invalidation','no browser script errors']}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
