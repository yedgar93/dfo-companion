import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import {join} from 'node:path';
const script=fileURLToPath(new URL('../skills/daggerfall-guide/scripts/observe.mjs',import.meta.url));
test('guide helper rejects action commands and an explicitly invalid observer directory',()=>{
 const action=spawnSync(process.execPath,[script,'cast'],{encoding:'utf8'});assert.equal(action.status,1);assert(action.stderr.includes('No game actions'));
 const invalid=spawnSync(process.execPath,[script,'snapshot','--root',join(process.cwd(),'not-an-observer')],{encoding:'utf8'});assert.equal(invalid.status,2);assert.equal(JSON.parse(invalid.stdout).reason,'OBSERVER_NOT_FOUND');
});
test('guide helper uses a portable explicit path with spaces and only the requested read command',async()=>{
 const base=fileURLToPath(new URL('../../../work/',import.meta.url));await mkdir(base,{recursive:true});const dir=await mkdtemp(join(base,'guide-test-'));const root=join(dir,'observer with spaces');await mkdir(root);
 try{await writeFile(join(root,'package.json'),JSON.stringify({name:'dfo-observer',type:'module'}));await writeFile(join(root,'cli.mjs'),'process.stdout.write(JSON.stringify({available:true,command:process.argv[2],attach:process.env.DFO_OBSERVER_ALLOW_ATTACH,sample:process.env.DFO_OBSERVER_SAMPLE_MS}));');
 const r=spawnSync(process.execPath,[script,'journal','--root',root],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{available:true,command:'journal',attach:'1',sample:'0'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
