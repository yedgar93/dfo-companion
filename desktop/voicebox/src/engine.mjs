import fs from 'node:fs/promises';
import path from 'node:path';
import * as ort from 'onnxruntime-node';
import {phonemize} from '../vendor/phonemize.mjs';
import {trimPadding} from './padding.mjs';
export class KokoroOnnx {
  constructor(modelDir,{threads=2,arena=false,provider='cpu',model='model_quantized.onnx'}={}){if(!Number.isInteger(threads)||threads<1||threads>4)throw Error('Threads must be 1-4');if(!['auto','cpu','webgpu','dml'].includes(provider)||!['model_quantized.onnx','model.onnx','model_fp16.onnx'].includes(model))throw Error('Unsupported backend/model');this.provider=provider;this.model=model;this.modelDir=modelDir;this.threads=threads;this.arena=arena;this.voices=new Map();this.busy=false;}
  async load(){
    this.manifest=JSON.parse(await fs.readFile(path.join(this.modelDir,'manifest.json'),'utf8'));
    this.catalog=new Set(this.manifest.voices.map(v=>v.id));
    const tokenizer=JSON.parse(await fs.readFile(path.join(this.modelDir,'tokenizer.json'),'utf8'));this.vocab=tokenizer.model.vocab;
    if(!this.vocab||this.vocab['$']===undefined)throw Error('Unsupported tokenizer');
    const providers=this.provider==='auto'?(ort.listSupportedBackends().some(p=>p.name==='webgpu')?['webgpu','cpu']:['cpu']):[this.provider];
    for(const provider of providers){try{this.session=await ort.InferenceSession.create(path.join(this.modelDir,'onnx',this.model),{executionProviders:[provider],intraOpNumThreads:this.threads,interOpNumThreads:1,executionMode:'sequential',graphOptimizationLevel:'all',enableCpuMemArena:this.arena,enableMemPattern:false,logSeverityLevel:3});this.provider=provider;return;}catch(error){if(provider===providers.at(-1))throw error;this.fallbackReason=error.message;}}
  }
  async synth(text,voice='af_heart',speed=1){
    if(!this.session||this.busy)throw Error('Engine not ready or busy');
    if(typeof text!=='string'||!text.trim()||text.length>4096||!this.catalog.has(voice)||!Number.isFinite(speed)||speed<.5||speed>2)throw Error('Invalid synthesis request');
    this.busy=true;try{
      const start=performance.now(),phones=await phonemize(text,voice[0]);
      const ids=Array.from(phones).map(c=>this.vocab[c]).filter(Number.isInteger);
      // Reject overlong sentences instead of silently discarding dialogue.
      if(!ids.length||ids.length>510)throw Error('Phoneme length outside 1-510');
      let data=this.voices.get(voice);if(!data){const b=await fs.readFile(path.join(this.modelDir,'voices',voice+'.bin'));data=new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));this.voices.set(voice,data);}
      const offset=Math.min(ids.length,509)*256,style=data.slice(offset,offset+256);if(style.length!==256)throw Error('Invalid voice tensor');
      const inputs={input_ids:new ort.Tensor('int64',BigInt64Array.from([0,...ids,0],BigInt),[1,ids.length+2]),style:new ort.Tensor('float32',style,[1,256]),speed:new ort.Tensor('float32',Float32Array.of(speed),[1])};
      const prepared=performance.now();let outputs,audio,outputType;
      try{outputs=await this.session.run(inputs);const waveform=outputs.waveform??outputs.audio??Object.values(outputs)[0];outputType=waveform.type;audio=Float32Array.from(waveform.data,value=>{if(outputType!=='float16')return value;const sign=value&0x8000?-1:1,exponent=(value>>10)&31,mantissa=value&1023;return exponent===0?sign*2**-14*(mantissa/1024):exponent===31?(mantissa?NaN:sign*Infinity):sign*2**(exponent-15)*(1+mantissa/1024);});}
      finally{for(const t of Object.values(outputs??{}))t.dispose();for(const t of Object.values(inputs))t.dispose();}
      if(!audio.length||audio.length>24000*120||audio.some(x=>!Number.isFinite(x)))throw Error(`Invalid generated audio (${outputType}, ${audio.length} samples)`);
      const trimmed=trimPadding(audio,24000,{tailMs:/[.!?]["”']?$/.test(text.trim())?140:70});
      return {...trimmed,rate:24000,phonemeCount:ids.length,prepareMs:prepared-start,inferenceMs:performance.now()-prepared,totalMs:performance.now()-start};
    }finally{this.busy=false;}
  }
  async close(){if(this.session){await this.session.release();this.session=null;}this.voices.clear();}
}
