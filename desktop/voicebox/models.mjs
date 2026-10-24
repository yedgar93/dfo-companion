import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('./data/model-manifest.json',import.meta.url),'utf8'));
async function valid(file,entry){try{if((await fs.stat(file)).size!==entry.bytes)return false;const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex')===entry.sha256;}catch{return false;}}
// All destinations, hashes and download URLs come from the pinned shipped list.
// Models never live in app.asar, the repository, or the game profile.
export async function ensureModels(directory,{signal,onProgress=()=>{},fetcher=fetch}={}){
  await fs.mkdir(directory,{recursive:true});
  for(const entry of manifest.files){
    signal?.throwIfAborted();
    if(!/^(?:onnx\/model\.onnx|tokenizer\.json|voices\/[ab][fm]_[a-z]+\.bin)$/.test(entry.path)||!Number.isSafeInteger(entry.bytes)||entry.bytes<=0||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Invalid pinned voice asset');
    const file=path.join(directory,entry.path);
    if(await valid(file,entry))continue;
    onProgress('Downloading voices once; speech stays local afterwards.');
    const url=`https://huggingface.co/${manifest.repo}/resolve/${manifest.revision}/${entry.path}`;
    const response=await fetcher(url,{signal:AbortSignal.any([signal??new AbortController().signal,AbortSignal.timeout(600000)])});
    if(!response.ok||!response.body)throw Error('Voice download unavailable; enable again to retry.');
    const length=response.headers.get('content-length');if(length&&Number(length)!==entry.bytes)throw Error('Voice download size mismatch');
    await fs.mkdir(path.dirname(file),{recursive:true});const partial=file+'.partial',hash=createHash('sha256');let bytes=0;
    try{
      const bounded=new Transform({transform(chunk,_encoding,done){bytes+=chunk.length;if(bytes>entry.bytes)return done(Error('Voice download exceeds pinned size'));hash.update(chunk);done(null,chunk);}});
      await pipeline(Readable.fromWeb(response.body),bounded,createWriteStream(partial),{signal});
      if(bytes!==entry.bytes||hash.digest('hex')!==entry.sha256)throw Error('Voice download verification failed');
      await fs.rename(partial,file);
    }finally{await fs.rm(partial,{force:true}).catch(()=>{});}
  }
  signal?.throwIfAborted();await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(manifest));
  return directory;
}
