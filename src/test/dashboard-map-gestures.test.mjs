import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
test('map pointers orbit, pinch, pan and rebase without a jump',()=>{
const src=fs.readFileSync(new URL('../dashboard-map-ui.mjs',import.meta.url),'utf8');
const events=new Map(),calls={orbit:[],pan:[],zoom:[],draw:0},classes=new Set();
const stage={addEventListener:(n,f)=>events.set(n,f),setPointerCapture(){},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)}};
const nodes={'map-stage':stage,'map-markers':{viewBox:{baseVal:{width:320,height:160}},getBoundingClientRect:()=>({width:640,height:320})},'map-dungeon-plan':{textContent:'Plan view'},'map-pan-toggle':{setAttribute(){},textContent:''},'map-gestures':{textContent:''}};
const ctx=vm.createContext({$:id=>nodes[id],matchMedia:()=>({matches:false}),Map,Math,queueMicrotask:f=>f(),document:{hidden:false,addEventListener(){},querySelector:()=>({addEventListener(){}})},window:{addEventListener(){}},overviewActive:false,interiorViewActive:true,townViewActive:false,currentBounds:{minX:0,maxX:100,minZ:0,maxZ:50},manualBounds:null,focusedBounds:null,objectiveFocus:false,zoomCamera:v=>calls.zoom.push(v),panInteriorMap:(x,z)=>calls.pan.push([x,z]),panTownBounds(){},orbitInteriorMap:(x,y)=>calls.orbit.push([x,y]),cameraDraw:()=>calls.draw++});
vm.runInContext(src.slice(src.indexOf("const mapStage=$('map-stage')"),src.indexOf('queueMicrotask(syncGestureHelp);')+'queueMicrotask(syncGestureHelp);'.length),ctx);
const event=(name,id,x,y)=>events.get(name)({pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y,target:{closest:()=>null},shiftKey:false,preventDefault(){}});
event('pointerdown',1,100,100);event('pointermove',1,120,110);assert.deepEqual(calls.orbit,[[20,10]]);
event('pointerdown',2,200,110);event('pointermove',2,220,110);assert.equal(calls.zoom.at(-1),.8);assert.equal(calls.pan.length,1);assert.deepEqual(calls.pan[0],[-1.5625,-0]);
event('pointerup',2,220,110);event('pointermove',1,121,111);assert.equal(calls.orbit.length,1);assert.deepEqual(calls.pan.at(-1),[-.15625,-.15625]);
event('pointercancel',1,121,111);assert(!classes.has('map-dragging'));event('pointerdown',3,50,50);event('pointermove',3,51,50);assert.deepEqual(calls.orbit.at(-1),[1,0]);
nodes['map-dungeon-plan'].textContent='3D view';event('pointerup',3,51,50);event('pointerdown',4,10,10);event('pointermove',4,12,12);assert.deepEqual(calls.orbit.at(-1),[1,0]);assert.deepEqual(calls.pan.at(-1),[-.3125,-.3125]);

});
