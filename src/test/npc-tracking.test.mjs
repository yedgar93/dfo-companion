import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {copyLoadedNpcs,NpcMemory} from '../npc-tracking.mjs';

test('loaded NPC positions include active offscreen records without generating names or copying private state',()=>{
 let calls=0;const npc={x:1,y:2,z:3,active:true,nameNPC:'Shopkeeper',health:999,questBehaviour:{secret:'FUTURE QUEST'}};Object.defineProperty(npc,'displayName',{get(){calls++;return 'UNSAFE';}});
 const r=copyLoadedNpcs([npc,{x:4,y:5,z:6,active:false,nameNPC:'INACTIVE'},{x:7,y:8,z:9,active:true,lamp:true}], 'interior');
 assert.equal(r.npcs.length,1);assert.deepEqual(r.npcs[0].position,{x:1,y:2,z:3,frame:'current interior/dungeon local',units:'game metres'});assert.equal(calls,0);assert(!JSON.stringify(r).includes('999'));assert(!JSON.stringify(r).includes('FUTURE QUEST'));assert.equal(r.complete,false);
});

test('NPC memory replaces location snapshots and marks all other locations stale',async()=>{
 const root=fileURLToPath(new URL('../../../work/',import.meta.url));await mkdir(root,{recursive:true});
 const dir=await mkdtemp(join(root,'dfo-npc-test-'));
 try{const memory=new NpcMemory(join(dir,'history.json'));
 const nav=key=>({location:{mode:'interior',place:{buildingKey:key,buildingName:null},mapPixel:{x:1,y:1}},scene:{loadedNpcs:{available:true,npcs:[{sourceSlot:0,name:null,position:{x:key,y:0,z:0}}]}}});
 await memory.observe(nav(1),'2026-10-20T00:00:00Z');const second=await memory.observe(nav(2),'2026-10-20T00:00:01Z');assert.equal(second.lastObservedLocations.length,1);assert.equal(second.lastObservedLocations[0].stale,true);
 const back=await memory.observe(nav(1),'2026-10-20T00:00:02Z');assert.equal(back.lastObservedLocations.length,1);assert.equal(back.current.lastObservedAt,'2026-10-20T00:00:02Z');assert.equal(back.current.npcs.length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
