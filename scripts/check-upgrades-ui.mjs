// Synthetic equipment/browser check through the real allowlisted dashboard.
// Never starts the application, contacts DFO, or requests a reader refresh.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createDashboardServer} from '../src/dashboard-server.mjs';
import {SKILL_NAMES} from '../src/upgrade-scoring.mjs';
import {projectDetails} from '../src/dashboard-model.mjs';

const fixture=JSON.parse(await readFile(new URL('../src/test/fixtures/snapshots/town-full.json',import.meta.url),'utf8'));
const item=(index,name,value,equipSlot=null)=>({index,name,equipSlot,group:'Jewellery',templateIndex:135,material:1,identified:true,magicKnown:true,enchantmentCount:0,special:false,effectsComplete:true,condition:{current:100,max:100},affixes:[{id:'stat',param:'intelligence',value}]});
fixture.details.items=[item(0,'Worn strong ring',8,4),item(1,'Worn weak ring',1,5),item(2,'Small improvement',3),item(3,'Best intelligence ring',9)];
fixture.details.items[3].affixes.push({id:'skill',param:29,value:2});
fixture.details.comparisonContext={inventoryComplete:true,restrictionEvidenceKnown:true,careerFlags:0,forbiddenMaterials:0,skills:SKILL_NAMES.map(name=>({name,permanent:30,display:30,effective:30})),skillGroups:{primarySkills:[22,23,24],majorSkills:[25,26,27]},attributes:{strength:50,intelligence:50,willpower:50,agility:50,endurance:50,personality:50,speed:50,luck:50},level:5,race:'Breton'};
const ringDetails=structuredClone(fixture.details);
const rawItem=(name,templateIndex,extra={})=>({name,templateIndex,group:'Weapons',material:1,identified:true,affixes:[],enchantments:[],customEnchantments:[],condition:{current:100,max:100},...extra});
const rawDetails=projectDetails({identity:{level:5,race:'Breton'},attributes:{live:ringDetails.comparisonContext.attributes},skills:ringDetails.comparisonContext.skills,characterSheet:{career:{weaponArmorShieldsBitfield:0,forbiddenMaterialsFlags:0,primarySkills:[29],majorSkills:[31],minorSkills:[28]}},inventory:{available:true,items:[
 rawItem('Worn longsword',120,{equipSlot:19,storedStats:{minDamage:2,maxDamage:15}}),rawItem('Worn shield',110,{group:'Armor',equipSlot:21}),
 rawItem('Identified claymore',122,{storedStats:{minDamage:2,maxDamage:19}}),rawItem('Identified bow',129),rawItem('Identified Thunderlock',560,{material:4}),
 rawItem('Unidentified Staff',115,{identified:false,affixes:null,enchantments:null,customEnchantments:null})]}},null);
const possibleDetails=structuredClone(rawDetails);possibleDetails.items=[{...structuredClone(rawDetails.items[0]),name:'Known better longsword',equipSlot:null},{...structuredClone(rawDetails.items.at(-1)),equipSlot:19,displayStats:{...rawDetails.items.at(-1).displayStats,damage:{min:1,max:2}}}];
const boundedDetails=structuredClone(ringDetails);boundedDetails.comparisonContext.attributes.intelligence=100;boundedDetails.items=[item(0,'Capped strong ring',10,4),item(1,'Capped other ring',10,5),item(2,'Unboosted ring',0)];
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
  const bestRing=page.locator('#inventory-items .item').filter({hasText:'Best intelligence ring'}),smallRing=page.locator('#inventory-items .item').filter({hasText:'Small improvement'});
  assert.equal(await bestRing.locator('.best-in-pack-tag').count(),1);assert.match(await bestRing.getAttribute('title'),/Best in pack for Ring/);
  assert.equal(await bestRing.evaluate(card=>{const name=card.querySelector('.item-name').getBoundingClientRect(),tag=card.querySelector('.best-in-pack-tag').getBoundingClientRect();return name.bottom<=tag.top||tag.right<=name.left||tag.left>=name.right;}),true,'Best-in-pack label must not overlap the item name');
  assert.equal(await smallRing.locator('.upgrade-indicator.upgrade').count(),1);assert.equal(await smallRing.locator('.best-in-pack-tag').count(),0);
  await page.locator('#inventory-items .item').filter({hasText:'Best intelligence ring'}).click();
  const detail=page.locator('#item-detail');await detail.waitFor({state:'visible'});
  assert.match(await detail.innerText(),/Recommended for your.*build/);
  assert.match(await detail.innerText(),/estimated score/);
  await detail.locator('.score-breakdown > summary').click();
  const breakdown=detail.getByRole('table',{name:'Score components',exact:true});assert.equal(await breakdown.isVisible(),true);
  assert.match(await breakdown.innerText(),/intelligence/i);assert.match(await breakdown.innerText(),/\+8 ×/);assert.match(await breakdown.innerText(),/Conservative score change/);
  await detail.locator('.score-scale > summary').click();
  assert.match(await breakdown.innerText(),/Intelligence attribute/);assert.match(await breakdown.innerText(),/Long Blade skill/);assert.doesNotMatch(await breakdown.innerText(),/skill 29|stat intelligence/);
  assert.equal(await detail.getByRole('table',{name:'Automatic build priorities',exact:true}).isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'Expanded score tables must fit the viewport');
  assert.match(await detail.locator('.score-scale').innerText(),/intelligence/i);assert.match(await detail.locator('.score-breakdown').innerText(),/heuristic.*not DPS/);
  const target=detail.locator('.comparison-target select');await target.selectOption('4');
  assert.match(await detail.innerText(),/Replacing Worn strong ring/);
  // Character/snapshot replacement must clear the previous generation's result.
  if(viewport.width>800){fixture.details.items=fixture.details.items.map(i=>i.index===3?{...i,identified:false,magicKnown:false}:i);version++;await page.waitForFunction(()=>!document.querySelector('#inventory-items .item[title^="Best intelligence ring"] .upgrade-indicator.upgrade'));assert.equal(await bestRing.locator('.best-in-pack-tag').count(),0);}
  const sheet=page.locator('dialog.mobile-item-sheet');if(await sheet.isVisible())await page.keyboard.press('Escape');
  // Real reader-shaped input: no optional template/display enrichment at all.
  fixture.details=rawDetails;version++;
  for(const name of ['Identified claymore','Identified bow','Identified Thunderlock']){
   const card=page.locator('#inventory-items .item').filter({hasText:name});await card.waitFor({state:'visible'});
   await page.waitForFunction(name=>{const card=[...document.querySelectorAll('#inventory-items .item')].find(e=>e.textContent.includes(name));return card?.querySelector('.upgrade-indicator:not(.pending):not(.unknown)');},name);
   assert.equal(await card.locator('.upgrade-indicator.unknown').count(),0);
  }
  const unidentified=page.locator('#inventory-items .item').filter({hasText:'Unidentified Staff'});
  assert.equal(await unidentified.locator('.upgrade-indicator.provisional').count(),1);
  assert.equal(await unidentified.locator('.upgrade-indicator.upgrade').count(),0);
  assert.match(await unidentified.getAttribute('title'),/Known stats only/);
  await page.locator('#inventory-view').selectOption('unknown');
  assert.equal(await unidentified.count(),1);assert.equal(await page.locator('#inventory-items .item').filter({hasText:'Identified claymore'}).count(),0);
  await page.locator('#inventory-view').selectOption('upgrades');assert.equal(await unidentified.count(),0);
  await page.locator('#inventory-view').selectOption('all');
  await unidentified.click();assert.match(await detail.innerText(),/Provisional build estimate/);assert.match(await detail.innerText(),/hidden bonuses can change/);assert.doesNotMatch(await detail.innerText(),/Can't judge yet/);
  if(await sheet.isVisible())await sheet.getByRole('button',{name:'Done',exact:true}).click();
  await page.locator('#inventory-items .item').filter({hasText:'Identified bow'}).click();
  assert.match(await detail.innerText(),/timing|reload/);assert.doesNotMatch(await detail.innerText(),/Can't judge yet/);
  // A new snapshot rebuilt the content above. Its nodes must appear immediately,
  // rather than replaying entry fades on every normal reader update.
  const refreshAnimations=await page.evaluate(()=>[...document.querySelectorAll('#inventory-items>*,#gear-left>*,#gear-right>*,#accessories>*,#item-detail>*,#categories>*')].map(e=>getComputedStyle(e).animationName).filter(name=>name!=='none'));
  assert.deepEqual(refreshAnimations,[]);
  if(await sheet.isVisible())await sheet.getByRole('button',{name:'Done',exact:true}).click();
  // A known weapon can be a useful possible upgrade over unidentified worn gear.
  // It must be discoverable from the worn slot while retaining amber certainty.
  fixture.details=possibleDetails;version++;
  await page.waitForFunction(()=>[...document.querySelectorAll('#gear-right .gear')].some(e=>e.textContent.includes('Unidentified Staff')&&e.dataset.upgradeCertainty==='provisional'));
  const wornGear=page.locator('#gear-right .gear').filter({hasText:'Unidentified Staff'});
  assert.equal(await wornGear.locator('.upgrade-indicator.provisional').count(),1);assert.equal(await wornGear.locator('.upgrade-indicator.upgrade').count(),0);
  assert.match(await wornGear.getAttribute('title'),/Possible upgrade in pack/);
  assert.match(await page.locator('#upgrade-summary').textContent(),/Possible upgrades in pack/);
  assert.equal(await page.locator('#inventory-items .item').filter({hasText:'Known better longsword'}).locator('.best-in-pack-tag').count(),0);
  const equipmentTab=page.getByRole('button',{name:'Equipment',exact:true});if(await equipmentTab.count())await equipmentTab.click();
  await wornGear.click();assert.match(await detail.innerText(),/Possible upgrade: Known better longsword/);assert.match(await detail.innerText(),/hidden bonuses can change/);
  assert.equal(await detail.locator('.better-in-pack.provisional').count(),1);assert.equal(await detail.locator('.better-in-pack.upgrade').count(),0);
  if(await sheet.isVisible())await sheet.getByRole('button',{name:'Done',exact:true}).click();
  if(await inventoryTab.count())await inventoryTab.click();
  fixture.details=boundedDetails;version++;
  const boundedRing=page.locator('#inventory-items .item').filter({hasText:'Unboosted ring'});await boundedRing.waitFor({state:'visible'});await boundedRing.click();
  await detail.locator('.score-breakdown > summary').click();const boundedTable=detail.getByRole('table',{name:'Score components',exact:true});
  assert.match(await boundedTable.locator('tbody').innerText(),/ to /);assert.match(await boundedTable.locator('tfoot').innerText(),/Possible range/);assert.match(await boundedTable.locator('tfoot').innerText(),/ to /);
  assert.deepEqual(errors,[]);await page.close();
  fixture.details=structuredClone(ringDetails);version++;
 }
 console.log(JSON.stringify({passed:true,viewports:2,gameReads:0,checks:['score sorting','recommendation reason','score component breakdown','bounded score ranges','automatic scale weights','top confirmed best-in-pack tag','explicit ring target','snapshot invalidation','raw equipment without template cache','provisional unidentified weapon estimates','positive provisional worn-slot suggestions','ranged timing explanation','no repeated refresh fades','no browser script errors']}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
