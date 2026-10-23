import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {archiveFileSystem} from '../archive-io.mjs';
test('plain Node uses physical fs without loading Electron modules',()=>{assert.equal(archiveFileSystem({versions:{node:'22'},loadOriginal:()=>{throw Error('must not load');}}),fs);});
test('Electron uses original-fs instead of its virtual ASAR filesystem',()=>{const original={open(){}};assert.equal(archiveFileSystem({versions:{electron:'45'},loadOriginal:()=>original}),original);});
