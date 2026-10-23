// Reassembles bounded companion messages outside the game's renderer.
export function acceptDungeonMapEvent(connection,event){
 if(typeof event.sceneKey!=='string')return;
 if(event.mapEvent==='dungeon-reset'){connection.dashboardDungeon={sceneKey:event.sceneKey,serial:event.serial,parts:[],capturedAt:new Date().toISOString(),revision:Date.now()};connection.dashboardDungeonPending=new Map;return;}
 const map=connection.dashboardDungeon,pending=connection.dashboardDungeonPending;
 if(!map||map.sceneKey!==event.sceneKey||map.serial!==event.serial||!pending)return;
 if(event.mapEvent==='dungeon-objectives'){map.objectives=Array.isArray(event.marks)?event.marks.slice(0,24):[];map.exit=event.exit??null;map.objectivesAt=new Date().toISOString();map.objectivesVersion=JSON.stringify({objectives:map.objectives,exit:map.exit});}
 if(event.mapEvent==='dungeon-part'&&map.parts.length<2048&&Array.isArray(event.positions)&&Array.isArray(event.indices)&&event.positions.length+event.indices.length<=1024&&event.positions.every(Number.isFinite)&&event.indices.every(Number.isFinite)){map.parts.push({key:event.key,positions:event.positions,indices:event.indices,matrix:event.matrix});map.capturedAt=new Date().toISOString();map.revision++;}
 if(event.mapEvent==='dungeon-part-start'){if(pending.size>1)pending.clear();pending.set(event.key,{key:event.key,positions:[],indices:[],matrix:event.matrix});}
 if(event.mapEvent==='dungeon-chunk'){const part=pending.get(event.key),field=event.field;if(part&&['positions','indices'].includes(field)&&Array.isArray(event.values)&&event.values.length<=1024&&event.values.every(Number.isFinite)&&part[field].length+event.values.length<=(field==='positions'?120000:180000))part[field].push(...event.values);}
 if(event.mapEvent==='dungeon-part-end'){const part=pending.get(event.key);if(part&&map.parts.length<2048&&part.positions.length&&part.indices.length){map.parts.push(part);map.capturedAt=new Date().toISOString();map.revision++;}pending.delete(event.key);}
}
