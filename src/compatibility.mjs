import {openArchive} from './archive-io.mjs';
import {open} from 'node:fs/promises';
import {gameArchivePath} from './portable-startup.mjs';
export const SUPPORTED_VERSION='0.1.10161';
export async function installedVersion(path=gameArchivePath()) {
  const f=await openArchive(path);
  try{
    const prefix=Buffer.alloc(16);const prefixRead=await f.read(prefix,0,16,0);
    if(prefixRead.bytesRead!==16)throw Error('Invalid ASAR');
    const headerSize=prefix.readUInt32LE(4),jsonSize=prefix.readUInt32LE(12);
    if(jsonSize<2||jsonSize>16*1024*1024||headerSize<jsonSize+8||headerSize>jsonSize+16)throw Error('Invalid ASAR header');
    const raw=Buffer.alloc(jsonSize);const r=await f.read(raw,0,jsonSize,16);if(r.bytesRead!==jsonSize)throw Error('Short ASAR header');
    const entry=JSON.parse(raw.toString()).files?.['package.json'];
    const offset=Number(entry?.offset),size=entry?.size;
    if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(size)||size<1||size>65536||entry.unpacked||entry.link)throw Error('Invalid metadata entry');
    const data=Buffer.alloc(size);const body=await f.read(data,0,size,8+headerSize+offset);if(body.bytesRead!==size)throw Error('Short metadata');
    const pkg=JSON.parse(data.toString());
    if(pkg.name!=='daggerfall-js-app'||pkg.productName!=='DFO Online')throw Error('Unexpected app');
    return pkg.version;
  }finally{await f.close();}
}
// This checks packaged compatibility only; it does not attest an already-running
// page or game-store updates. Never use it as proof that a module is cached.
export async function verifyInstalledVersion(){return await installedVersion()===SUPPORTED_VERSION;}
