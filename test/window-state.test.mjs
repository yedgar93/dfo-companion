import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {restorePlan,restoreBounds,captureState,readHandoff,normalizeState,findDisplay,HANDOFF_MAX_AGE_MS}=require('../desktop/window-state.cjs');

const builtin={id:1,bounds:{x:0,y:0,width:1800,height:1169},workArea:{x:0,y:39,width:1800,height:1130}};
const external={id:7,bounds:{x:1800,y:-200,width:2560,height:1440},workArea:{x:1800,y:-175,width:2560,height:1415}};
const displays=[builtin,external];
const NOW=1_800_000_000_000;

test('normal launch with no handoff uses default placement on primary',()=>{
  const p=restorePlan(null,displays,builtin);
  assert.equal(p.maximized,false);
  assert.ok(p.bounds.x>=0&&p.bounds.x+p.bounds.width<=1800);
  assert.deepEqual(p.frame,p.bounds);
});

test('stale or undated handoff is ignored',()=>{
  const s={bounds:{x:2000,y:0,width:900,height:700},displayId:7,savedAt:NOW-HANDOFF_MAX_AGE_MS-1};
  assert.equal(readHandoff(s,NOW),null);
  assert.equal(readHandoff({bounds:s.bounds},NOW),null);
  assert.equal(readHandoff({...s,savedAt:NOW+120000},NOW),null);
  assert.ok(readHandoff({...s,savedAt:NOW-1000},NOW));
});

test('update handoff on external monitor restores there',()=>{
  const state=captureState({normalBounds:{x:2100,y:0,width:1000,height:800},maximized:false,fullScreen:false,minimized:false,display:external,previous:null,now:NOW});
  const p=restorePlan(readHandoff(state,NOW+5000),displays,builtin);
  assert.deepEqual(p.bounds,{x:2100,y:0,width:1000,height:800});
  assert.equal(findDisplay(normalizeState(state),displays,builtin).id,7);
});

test('maximized on external restores as external work area, never primary',()=>{
  const state=captureState({normalBounds:{...external.workArea},maximized:true,fullScreen:false,minimized:false,display:external,previous:null,now:NOW});
  const p=restorePlan(readHandoff(state,NOW),displays,builtin);
  assert.equal(p.maximized,true);
  assert.deepEqual(p.frame,external.workArea);
});

test('fullscreen keeps previous bounds and display',()=>{
  const prev={bounds:{x:2100,y:0,width:1000,height:800},displayId:7,displayBounds:external.bounds,savedAt:NOW-1};
  const s=captureState({normalBounds:{...external.bounds},maximized:false,fullScreen:true,minimized:false,display:external,previous:prev,now:NOW});
  assert.deepEqual(s.bounds,prev.bounds);assert.equal(s.displayId,7);
});

test('minimized and -32000 positions keep previous',()=>{
  const prev={bounds:{x:2100,y:0,width:1000,height:800},displayId:7,savedAt:1};
  assert.deepEqual(captureState({normalBounds:{x:-32000,y:-32000,width:160,height:28},maximized:false,fullScreen:false,minimized:true,display:builtin,previous:prev,now:NOW}).bounds,prev.bounds);
  assert.deepEqual(captureState({normalBounds:{x:-32000,y:-32000,width:160,height:28},maximized:false,fullScreen:false,minimized:false,display:builtin,previous:prev,now:NOW}).bounds,prev.bounds);
});

test('display id changed but bounds match',()=>{
  const s={bounds:{x:2100,y:0,width:1000,height:800},displayId:99,displayBounds:external.bounds,savedAt:NOW};
  assert.equal(findDisplay(normalizeState(s),displays,builtin).id,7);
});

test('display moved keeps relative position',()=>{
  const moved={...external,bounds:{...external.bounds,x:-2560},workArea:{...external.workArea,x:-2560}};
  const s={bounds:{x:2100,y:0,width:1000,height:800},displayId:7,displayBounds:external.bounds,savedAt:NOW};
  assert.equal(restorePlan(s,[builtin,moved],builtin).bounds.x,-2560+300);
});

test('real user file replays onto display 1 work area',()=>{
  const real={bounds:{x:511,y:39,width:1289,height:1089},maximized:true,fullScreen:false,displayId:1,savedAt:NOW};
  const p=restorePlan(readHandoff(real,NOW),displays,builtin);
  assert.deepEqual(p.frame,builtin.workArea);
});

test('old formats still load',()=>{
  assert.deepEqual(normalizeState({x:1,y:2,width:900,height:700}).bounds,{x:1,y:2,width:900,height:700});
  assert.equal(normalizeState('nope'),null);
  assert.ok(restoreBounds({x:2100,y:0,width:1000,height:800},displays,builtin));
});

test('no displays falls back without throwing',()=>{
  assert.ok(restorePlan(null,[],null).bounds);
});

test('maximizing on another monitor after a restore follows the new monitor',()=>{
  const prev={bounds:{x:200,y:100,width:1000,height:800},maximized:true,displayId:1,displayBounds:builtin.bounds,savedAt:NOW-1};
  const s=captureState({normalBounds:{...external.workArea},maximized:true,fullScreen:false,minimized:false,display:external,previous:prev,now:NOW});
  assert.equal(s.displayId,7);
  assert.deepEqual(restorePlan(readHandoff(s,NOW),displays,builtin).frame,external.workArea);
});
