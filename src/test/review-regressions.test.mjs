import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerGuidance} from '../guidance.mjs';
import {describeSpells} from '../spells.mjs';
import {copyOwnCostInputs,copyCourtCostContext} from '../cost-context.mjs';
import {summarizeOwner,ownerDifferences} from '../history.mjs';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('unknown vitals, condition and partial burden cannot produce zero-valued advice',()=>{
 const p={vitals:{health:{current:null,max:100}},inventory:{available:true,truncated:true,items:[{name:'Sword',group:'Weapons',condition:{current:null,max:100},perUnitWeightKg:2,count:1}]},resources:{goldPieces:0},attributes:{live:{strength:50}}};ownerGuidance(p);
 assert.equal(p.guidance.advice.emergency.healthState,'UNKNOWN');assert.equal(p.guidance.vitalFractions.health,null);assert.equal(p.inventory.items[0].condition.percent,null);assert.equal(p.guidance.repairReview.length,0);assert.equal(p.resources.encumbrance.complete,false);assert.equal(p.resources.encumbrance.remainingKg,null);assert.equal(p.resources.encumbrance.sheetCarriedKg,null);
});
test('missing equipment and out-of-range Court focus cannot prove complete cost context',()=>{
 assert.equal(copyOwnCostInputs.call({}).available,false);const p={};assert.equal(copyCourtCostContext.call(p,{entity:p,vs:[[2,99]],b:1},{focus:{id:2,v:[.1]}},{},1,0).available,false);
});
test('incomplete spell metadata and a colliding spell index do not acquire a current cost',()=>{
 const p={skills:[],spells:{known:[{name:'Custom A',index:-1,effects:[],rangeType:null}],readied:{available:true,spell:{name:'Custom B',index:-1},cost:10}}};describeSpells(p);assert.equal(p.spells.known[0].castingCost.copiedBaseline.complete,false);assert.equal(p.spells.known[0].castingCost.current,null);
});
test('history skips unavailable/truncated sections without inventing removals',()=>{
 const p={inventory:{available:true,items:[{name:'Sword',count:1}],storage:{wagon:{available:true,items:[]}}},activeEffects:[{kind:'buff'}],spells:{known:[{name:'Heal',index:1}]},journal:{available:true,active:[],finished:[]}};
 const before=summarizeOwner(p);const after=summarizeOwner({inventory:{available:false,items:[]},activeEffects:[],activeEffectsTruncated:true,spells:{known:[],truncated:true},journal:{available:false}});assert.deepEqual(ownerDifferences(before,after),[]);assert.deepEqual(ownerDifferences(after,before),[]);
});
test('history storage moves identify the location on both deltas',()=>{
 const item={name:'Sword',count:1};const p={inventory:{items:[item],storage:{wagon:{available:true,items:[]}}}};const before=summarizeOwner(p);p.inventory.items=[];p.inventory.storage.wagon.items=[item];const r=ownerDifferences(before,summarizeOwner(p)).filter(x=>x.kind==='inventoryCount');assert.deepEqual(r.map(x=>[x.location,x.delta]).sort(),[['pack',-1],['wagon',1]]);
});
test('cache checker requires the active hash and accepts the matching current profile',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),script=fileURLToPath(new URL('../skills/daggerfall-guide/scripts/check-cache.mjs',import.meta.url)),m=JSON.parse(readFileSync(new URL('../reviewed-bundles.json',import.meta.url)));const run=hash=>JSON.parse(spawnSync(process.execPath,[script,root,...hash?[hash]:[]],{encoding:'utf8'}).stdout);
 assert(run().entries.filter(e=>e.activeProfileMatch!==null).every(e=>e.recheck));assert(run(m.profiles[1].player.sha256).entries.filter(e=>e.activeProfileMatch!==null).every(e=>e.activeProfileMatch));
});
import {attestMacListeners,macEndpointReady} from '../mac-endpoint.mjs';

test('Mac readiness requires an owned loopback listener and an actual game target',async()=>{
 const exe='/Applications/DFO Online.app/Contents/MacOS/DFO Online',own=()=>`p42\nn${exe}\n`;
 assert.equal(attestMacListeners('p42\nn127.0.0.1:9223\n',exe,own),true);assert.equal(attestMacListeners('p42\nn*:9223\n',exe,own),false);assert.equal(attestMacListeners('p42\nn127.0.0.1:9223\n',exe,()=> 'n/other/app'),false);
 const run=(cmd,args)=>args.includes('-Fpn')?'p42\nn127.0.0.1:9223\n':own();const fetcher=async()=>({ok:true,text:async()=>JSON.stringify([{type:'page',url:'dagger://game/play/index.html',webSocketDebuggerUrl:'ws://127.0.0.1:9223/devtools/page/abc'}])});assert.equal(await macEndpointReady('/Applications/DFO Online.app',{run,fetcher}),true);
 assert.equal(await macEndpointReady('/Applications/DFO Online.app',{run,fetcher:async()=>({ok:true,text:async()=>JSON.stringify([{webSocketDebuggerUrl:'ws://127.0.0.1:9223/devtools/browser/abc'}])})}),false);
});
