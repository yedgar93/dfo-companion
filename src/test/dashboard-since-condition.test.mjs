import test from 'node:test';import assert from 'node:assert/strict';import {describeChange} from '../dashboard-since.mjs';
const c=(before,after,max=100)=>describeChange({kind:'condition',name:'Iron Helm',before,after,beforeMax:max,afterMax:max});
test('condition changes inside one 10% step stay quiet',()=>{assert.equal(c(68,61),null);assert.equal(c(340,310,500),null);});
test('condition crossing a 10% step is reported in percent',()=>{assert.equal(c(68,59),'Iron Helm condition 68% → 59%');assert.equal(c(250,175,500),'Iron Helm condition 50% → 35%');});
test('condition dropping below 25% is flagged low',()=>{assert.equal(c(26,24),'Iron Helm condition 26% → 24% · low');});
test('a broken item is reported once it reaches 0%',()=>{assert.equal(c(3,0),'Iron Helm broke (0%)');});
test('unknown maximum reports nothing',()=>{assert.equal(describeChange({kind:'condition',name:'X',before:5,after:1,beforeMax:0,afterMax:0}),null);});
