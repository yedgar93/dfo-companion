import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/dashboard-ui.mjs',import.meta.url),'utf8');
const start=source.indexOf('function renderLaunchState(');
const end=source.indexOf('const categoryLabel=',start);
function harness(local=true){
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:''});return nodes.get(id);};
 const context=vm.createContext({$:get,text:(id,value)=>{get(id).textContent=value;},isLocalDashboard:()=>local});
 vm.runInContext(source.slice(start,end),context);
 return {get,render:context.renderLaunchState};
}
test('desktop Connection keeps explicit startup through every reader state',()=>{
 const h=harness();
 for(const state of [
  {status:{kind:'starting'},reason:'STARTING'},
  {status:{kind:'stopped'},reason:'GAME_NOT_RUNNING'},
  {status:{kind:'reconnect'},reason:'GAME_RUNNING_WITHOUT_FLAGS'},
  {status:{kind:'reconnect'},reason:'UPDATER_DROPPED_FLAGS'},
  {status:{kind:'error'},reason:'READ_FAILED',stale:true},
  {status:{kind:'live'},reason:null,stale:false}
 ]){
  h.render(null,state);
  for(const id of ['game-start-panel','game-start-button','game-start-result'])assert.equal(h.get(id).hidden,false,state.reason??'live');
  assert.match(h.get('game-start-advice').textContent,/fully quit it yourself/);
  assert.doesNotMatch(h.get('game-start-advice').textContent,/last known|Can’t read/);
 }
});
test('phone never exposes the computer-only launch panel',()=>{
 const h=harness(false);h.render(null,{status:{kind:'stopped'},reason:'GAME_NOT_RUNNING'});
 assert.equal(h.get('game-start-panel').hidden,true);
});
