import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
export const RESOURCE_ROOT=dirname(fileURLToPath(import.meta.url));
export const CACHE_ROOT=join(process.env.DFO_COMPANION_CACHE??(process.platform==='win32'?process.env.LOCALAPPDATA??join(homedir(),'AppData','Local'):process.platform==='darwin'?join(homedir(),'Library','Caches'):process.env.XDG_CACHE_HOME??join(homedir(),'.cache')),'DFOCompanion');
function resourcePath(name){if(typeof name!=='string'||name.includes('..')||name.startsWith('/')||name.includes('\\'))throw Error('RESOURCE_PATH_REFUSED');return join(RESOURCE_ROOT,name);}
export function readResourceSync(name,encoding){return readFileSync(resourcePath(name),encoding);}
export function readResource(name,encoding){return readFile(resourcePath(name),encoding);}
