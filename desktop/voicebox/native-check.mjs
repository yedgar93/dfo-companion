// Packaging smoke test only. No game, model download, microphone or playback.
import * as ort from 'onnxruntime-node';
import {phonemize} from './vendor/phonemize.mjs';
const phones=await phonemize('VoiceBox ready.','a');
const result={nativeReady:true,platform:process.platform,arch:process.arch,backends:ort.listSupportedBackends().map(p=>p.name),phonemes:phones.length};
process.parentPort?.postMessage(result);
