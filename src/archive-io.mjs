import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
// Electron virtualizes .asar paths; archive headers and sprite offsets need the physical bytes.
export function archiveFileSystem({versions=process.versions,loadOriginal=()=>createRequire(import.meta.url)('original-fs').promises}={}){return versions.electron?loadOriginal():fs;}
export function openArchive(file){return archiveFileSystem().open(file,'r');}
