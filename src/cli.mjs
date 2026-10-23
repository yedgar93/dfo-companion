import {LocalHistory} from './history.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configuration,probeDiagnostic} from './transport.mjs';
import {Observer} from './observer.mjs';
import {companionHealth} from './health.mjs';
const command=process.argv[2]??'status';
try{
  if(process.argv.length>3||!['health','status','inventory','changes','location','map','context','shops','text','dialogue','scene','snapshot','spells','journal','readables','probe'].includes(command))throw Error('Invalid command');
  const config=configuration();
  const observer=new Observer(config,undefined,process.env.DFO_OBSERVER_HISTORY==='0'?null:new LocalHistory(process.env.DFO_OBSERVER_HISTORY_PATH??join(tmpdir(),'dfo-companion','observer-history.json')));
  const result=command==='health'?await companionHealth():command==='probe'?await probeDiagnostic(config):await observer.query(command);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(!result.available)process.exitCode=2;
}catch{process.stderr.write('Invalid configuration or command. Use: node cli.mjs status|inventory|spells|journal|readables|snapshot|changes|location|map|shops|context|scene|text|dialogue|probe\n');process.exitCode=1;}
