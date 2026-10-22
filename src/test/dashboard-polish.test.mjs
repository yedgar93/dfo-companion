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
const brand=fs.readFileSync(new URL('../dashboard-brand.mjs',import.meta.url),'utf8');
test('first-run guide: three steps, phone pairing by QR only, shown once via a local flag',()=>{
 const steps=brand.slice(brand.indexOf('FIRST_RUN_STEPS=['),brand.indexOf('];',brand.indexOf('FIRST_RUN_STEPS=[')));
 assert.equal((steps.match(/\{title:/g)||[]).length,3);assert.match(steps,/QR/);assert.doesNotMatch(steps,/\bPIN\b|\bcode entry\b/i);
 assert.match(brand,/localStorage,FIRST_RUN_KEY\),isLocal\(\)/);assert.match(brand,/addEventListener\('close',\(\)=>store\(localStorage,FIRST_RUN_KEY,'1'\)\)/);
 assert.doesNotMatch(brand,/fetch\(|\/api\//,'branding makes no requests');
});
test('About says fan-made and not affiliated with Bethesda',()=>{assert.match(brand,/Fan-made and unofficial/);assert.match(brand,/Not affiliated with[^.]*Bethesda/);});
test('app icon: original mark wired for Windows .ico (256 last) and Mac .icns sizes',async()=>{
 const ico=fs.readFileSync(new URL('../../assets/icon.ico',import.meta.url)),count=ico.readUInt16LE(4),last=6+16*(count-1);assert(count>=5);assert.equal(ico[last],0,'last entry is 256px');
 for(const n of [128,256,512,1024])assert(fs.existsSync(new URL(`../../assets/icons/icon-${n}.png`,import.meta.url)));
 const cfg=fs.readFileSync(new URL('../../electron-builder.cjs',import.meta.url),'utf8');assert.match(cfg,/icon:'assets\/icon\.ico'/);assert.match(cfg,/icon:'assets\/icon\.icns'/);
 assert.match(fs.readFileSync(new URL('../../assets/brand/mark.svg',import.meta.url),'utf8'),/original artwork/);
});
