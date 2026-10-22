import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('dashboard exposes the packaged version as a manual update control',()=>{
 const html=fs.readFileSync(new URL('../src/dashboard.html',import.meta.url),'utf8');
 const ui=fs.readFileSync(new URL('../src/dashboard-ui.mjs',import.meta.url),'utf8');
 const preload=fs.readFileSync(new URL('../desktop/preload.cjs',import.meta.url),'utf8');
 assert.match(html,/DAGGERFALL ONLINE COMPANION/);
 assert.match(html,/id="app-version"/);
 assert.match(ui,/checkForUpdates/);
 assert.match(preload,/dfo:check-for-updates/);
});
