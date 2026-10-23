import test from 'node:test';
import assert from 'node:assert/strict';
import {existingDashboard} from '../dashboard-server.mjs';
test('portable copy reuses same companion from another directory',async()=>{const original=globalThis.fetch;try{globalThis.fetch=async()=>({ok:true,json:async()=>({appId:'dfo-companion-dashboard-v1',root:'C:/different/folder'})});assert.equal(await existingDashboard(),true);}finally{globalThis.fetch=original;}});
test('unrelated listener is never accepted as the companion',async()=>{const original=globalThis.fetch;try{globalThis.fetch=async()=>({ok:true,json:async()=>({appId:'other-app',root:'C:/different/folder'})});assert.equal(await existingDashboard(),false);}finally{globalThis.fetch=original;}});
