import test from 'node:test';
import assert from 'node:assert/strict';
import {guardedSpellCosts} from '../cached-module.mjs';

function mock(refuse=false){
 const sent=[],c={async send(method,p){sent.push({method,...p});
  if(method==='Runtime.getProperties'){
   if(p.objectId==='calculate')return {internalProperties:[{name:'[[Scopes]]',value:{objectId:'scope-list'}}]};
   if(p.objectId==='scope-list')return {result:[{name:'0',value:{objectId:'scope',description:'Module'}}]};
   if(p.objectId==='scope')return {result:['Jp','Xp'].map(name=>({name,value:{objectId:name}}))};
   const ids=p.objectId==='Jp-array'?['modifier-a','modifier-b']:['free'];return {result:[...ids.map((id,i)=>({name:String(i),value:{objectId:id}})),{name:'length',value:{value:ids.length}}]};
  }
  if(p.objectId==='Jp'||p.objectId==='Xp')return {result:{objectId:p.objectId+'-array'}};
  assert.equal(p.objectId,'player');assert.equal(p.throwOnSideEffect,true);
  const [fn,index,cost]=p.arguments;
  if(fn.objectId==='calculate')return refuse?{exceptionDetails:{exception:{description:'EvalError: possible side-effect'}}}:{result:{value:11}};
  if(fn.objectId==='modifier-a')return {result:{value:cost.value+1.3}};
  if(fn.objectId==='modifier-b')return {result:{value:cost.value/2+.1}};
  return {result:{value:index.value===1}};
 }};return {c,sent};
}

test('separate guarded cost stages preserve modifier order, rounding and free-cast semantics',async()=>{
 const {c,sent}=mock(),r=await guardedSpellCosts(c,'player','calculate',2);assert.deepEqual(r.map(({baselineSource,...v})=>v),[{arrayIndex:0,cost:6},{arrayIndex:1,cost:0}]);assert.equal(r[0].baselineSource,'GUARDED_NATIVE');
 const calls=sent.filter(v=>v.objectId==='player');assert(calls.every(v=>v.throwOnSideEffect===true));assert.deepEqual(calls.slice(0,4).map(v=>v.arguments[0].objectId),['calculate','modifier-a','modifier-b','free']);assert.equal(calls[2].arguments[2].value,12);
});

test('a refused native baseline remains unknown and invokes no modifier or free-cast hook',async()=>{
 const {c,sent}=mock(true),r=await guardedSpellCosts(c,'player','calculate',1);assert.equal(r[0].cost,null);assert.equal(r[0].reason,'BASE_CURRENT_COST_SIDE_EFFECT_GUARD');assert.equal(sent.filter(v=>v.objectId==='player').length,1);
});

test('a reviewed copied baseline can replace a refused native baseline while every modifier remains guarded',async()=>{
 const {c,sent}=mock(true),r=await guardedSpellCosts(c,'player','calculate',1,[{complete:true,cost:11}]);assert.equal(r[0].cost,6);assert.equal(r[0].baselineSource,'COPIED_REVIEWED_BASELINE');assert(sent.filter(v=>v.objectId==='player').every(v=>v.throwOnSideEffect));
});

test('only a reviewed complete copied modifier replaces a refused callback',async()=>{
 const {c}=mock();const send=c.send.bind(c);c.send=async(method,p)=>p.objectId==='player'&&p.arguments?.[0]?.objectId?.startsWith('modifier')?{exceptionDetails:{exception:{description:'possible side-effect'}}}:send(method,p);
 const good=await guardedSpellCosts(c,'player','calculate',1,[],async()=>[{modifiers:[{known:true,scale:1.1},{known:true,less:50}],free:{known:true,value:false}}]);assert.equal(good[0].cost,6);
 const unknown=await guardedSpellCosts(c,'player','calculate',1,[],async()=>[{modifiers:[{known:false}],free:{known:true,value:false}}]);assert.equal(unknown[0].cost,null);assert.equal(unknown[0].reason,'CURRENT_COST_MODIFIER_SIDE_EFFECT_GUARD');
});
