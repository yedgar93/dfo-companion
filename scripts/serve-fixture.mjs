// Serve a fake dashboard snapshot at the real dashboard routes, with no game connection.
// Usage: node scripts/serve-fixture.mjs <fixture-name|path.json> [--port=9235] [--frozen]
// Timestamps are shifted so the fixture's serverTime is "now" (stale fixtures stay stale);
// pass --frozen to serve them verbatim.
import {readFileSync,readdirSync} from 'node:fs';
import {createDashboardServer} from '../src/dashboard-server.mjs';
const dir=new URL('../src/test/fixtures/snapshots/',import.meta.url);
const arg=process.argv.slice(2),name=arg.find(a=>!a.startsWith('--'));
const port=Number(arg.find(a=>a.startsWith('--port='))?.slice(7)??9235),frozen=arg.includes('--frozen');
const names=readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='phone-brief.json').map(f=>f.slice(0,-5));
if(!name){console.error('Fixtures: '+names.join(', '));process.exit(2);}
const fixture=JSON.parse(readFileSync(name.endsWith('.json')?name:new URL(name+'.json',dir),'utf8'));
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/;
function shift(v,d){if(typeof v==='string'&&ISO.test(v))return new Date(Date.parse(v)+d).toISOString();if(Array.isArray(v))return v.map(x=>shift(x,d));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,shift(x,d)]));return v;}
const snapshot=()=>frozen?fixture:shift(fixture,Date.now()-Date.parse(fixture.serverTime));
const server=createDashboardServer({snapshot,poll:async()=>snapshot()},{port,launchGame:async()=>({ok:false,reason:'FIXTURE_SERVER'}),onManualRefresh:()=>{}});
server.listen(port,'127.0.0.1',()=>console.log(`Fixture "${name}" at http://127.0.0.1:${port}/  (routes: /api/live /api/state /api/brief /api/since)`));
