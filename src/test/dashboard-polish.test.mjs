import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {connectionToast} from '../dashboard-extras.mjs';
const css=fs.readFileSync(new URL('../dashboard.css',import.meta.url),'utf8');
test('connection toast fires once per real drop and return, never on first load',()=>{
 let r=connectionToast(null,false);assert.equal(r.toast,null);
 r=connectionToast(r.state,true);assert.equal(r.toast,null,'first connection is not a "return"');
 r=connectionToast(r.state,true);assert.equal(r.toast,null);
 r=connectionToast(r.state,false);assert.equal(r.toast.kind,'lost');
 r=connectionToast(r.state,false);assert.equal(r.toast,null);
 r=connectionToast(r.state,true);assert.equal(r.toast.kind,'restored');
 r=connectionToast(r.state,true);assert.equal(r.toast,null);
});
test('quiet state changes animate only opacity/transform and stop under reduced motion',()=>{
 for(const m of css.matchAll(/@keyframes dfo-[\w-]+\{(.*?\})\}/g))for(const p of m[1].matchAll(/([a-z-]+):/g))assert.match(p[1],/^(opacity|transform)$/,'keyframe property '+p[1]);
 const block=css.slice(css.lastIndexOf('@media (prefers-reduced-motion:reduce)'));assert.match(block,/animation:none!important/);assert.match(block,/transition:none!important/);
});
test('design tokens: type scale never goes below 9px',()=>{
 const root=css.match(/--fs-2xs:(\d+)px/);assert(root&&+root[1]>=9);
});
