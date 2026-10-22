import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
// App icon: original DFO Companion mark (assets/brand/mark.svg), pre-rendered to assets/icons/*.png
// and assets/icon.ico. The Mac .icns is assembled here from the same PNGs (ic07..ic10 = 128..1024).
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const chunks=[];for(const [type,size] of [['ic07',128],['ic08',256],['ic09',512],['ic10',1024]]){const png=await fs.readFile(path.join(root,`assets/icons/icon-${size}.png`));if(png.subarray(1,4).toString()!=='PNG')throw Error('Expected PNG icon-'+size);const h=Buffer.alloc(8);h.write(type);h.writeUInt32BE(8+png.length,4);chunks.push(h,png);}
const body=Buffer.concat(chunks),head=Buffer.alloc(8);head.write('icns');head.writeUInt32BE(8+body.length,4);
await fs.writeFile(path.join(root,'assets/icon.icns'),Buffer.concat([head,body]));
await fs.copyFile(path.join(root,'assets/icon.png'),path.join(root,'desktop/icon.png'));

await fs.copyFile(path.join(root,'assets/update-public-key.json'),path.join(root,'desktop/update-public-key.json'));
