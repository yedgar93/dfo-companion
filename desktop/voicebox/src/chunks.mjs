import {sentences} from './core/wav.mjs';
// Keep grammatical sentences intact. Arbitrary short chunks sounded broken.
export function speechChunks(text){return sentences(text,{maxWords:Infinity});}
