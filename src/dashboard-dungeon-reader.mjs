// Copies only the current automap's already revealed rows, in small idle slices.
// The model reference is resolved once per stable dungeon transition, never per movement.
export function startIdleDungeonMap(state,bindingName){
 const emit=globalThis[bindingName],own=(o,k)=>Object.getOwnPropertyDescriptor(o??{},k)?.value;
 if(typeof emit!=='function'||typeof requestIdleCallback!=='function')return;
 let scene=null,record=null,model=null,iterator=null,seen=new Set,part=null,serial=0,total=0,lastMarks=0,marksInterval=1000;
 const alive=()=>globalThis[bindingName]===emit&&state.canvas?.isConnected;
 const schedule=delay=>{if(alive())setTimeout(()=>{if(alive())requestIdleCallback(run);},delay);};
 function run(deadline){if(!alive())return;if(deadline.timeRemaining()<.75){schedule(50);return;}
  try{const started=performance.now(),loc=state.currentLocation,view=state.dungeonModel,rec=own(view,'rec'),map=own(view,'model'),revealed=own(rec,'revealed'),byKey=own(map,'byKey');
   const key=loc?.mode==='dungeon'?[loc.mode,loc.mapPixel?.x,loc.mapPixel?.y,loc.place?.buildingKey,loc.place?.buildingName,loc.place?.dungeonName??loc.place?.name].join('|'):null;
   if(key&&typeof state.mapRecord==='function'&&typeof state.mapAccessor==='function'&&state.mapRecord(state.mapAccessor())!==rec){state.dungeonNeedsReference=true;schedule(500);return;}
   if(!key||state.dungeonModelScene!==key||!(revealed instanceof Set)||!(byKey instanceof Map)){schedule(500);return;}
   if(scene!==key||record!==rec||model!==map){scene=key;record=rec;model=map;iterator=revealed.values();seen=new Set;part=null;total=0;serial++;emit(JSON.stringify({mapEvent:'dungeon-reset',sceneKey:key,serial,location:loc}));}
   if(performance.now()-lastMarks>=marksInterval&&deadline.timeRemaining()>=1){const markStart=performance.now(),source=typeof state.dungeonMarks==='function'?state.dungeonMarks():null,marks=[];const entry=state.modes?.dungeonCtx?own(state.modes.dungeonCtx,'startMarker'):null;const exit=own(rec,'entranceDiscovered')===true&&entry&&[own(entry,'x'),own(entry,'y'),own(entry,'z')].every(Number.isFinite)?{name:'Exit · entrance',position:{x:own(entry,'x'),y:own(entry,'y'),z:own(entry,'z')}}:null;if(Array.isArray(source))for(const m of source.slice(0,24)){const at=own(m,'at'),name=own(m,'name');if(Array.isArray(at)&&at.length===3&&at.every(Number.isFinite)&&typeof name==='string')marks.push({name:name.slice(0,120),position:{x:at[0],y:at[1],z:at[2]},followed:own(m,'followed')===true});}emit(JSON.stringify({mapEvent:'dungeon-objectives',sceneKey:scene,serial,marks,exit}));lastMarks=performance.now();if(lastMarks-markStart>1)marksInterval=Math.min(8000,marksInterval*2);schedule(50);return;}
   if(part){const source=part.field==='positions'?part.positions:part.indices,end=Math.min(source.length,part.offset+1024),values=[];
    for(let i=part.offset;i<end;i++){const n=source[i];if(!Number.isFinite(n))throw Error('Invalid automap number');values.push(n);}total+=values.length;if(total>1000000)throw Error('Explored map budget reached');
    emit(JSON.stringify({mapEvent:'dungeon-chunk',sceneKey:scene,serial,key:part.key,field:part.field,values}));part.offset=end;
    if(end===source.length){if(part.field==='positions'){part.field='indices';part.offset=0;}else {emit(JSON.stringify({mapEvent:'dungeon-part-end',sceneKey:scene,serial,key:part.key}));part=null;}}
   }else {let entry;for(let n=0;n<16;n++){entry=iterator.next();if(entry.done)break;if(!seen.has(entry.value))break;entry=null;}
    if(entry?.done){iterator=revealed.values();schedule(500);return;}
    if(entry){const k=entry.value;seen.add(k);const row=Map.prototype.get.call(byKey,k),positions=own(row,'positions'),indices=own(row,'indices'),matrix=own(row,'matrix');
     if((Array.isArray(positions)||ArrayBuffer.isView(positions))&&(Array.isArray(indices)||ArrayBuffer.isView(indices))&&positions.length%3===0&&indices.length%3===0&&positions.length<=120000&&indices.length<=180000){const m=matrix&&matrix.length===16?Array.from(matrix):null;if(positions.length+indices.length<=1024){const ps=Array.from(positions),ix=Array.from(indices);if(ps.every(Number.isFinite)&&ix.every(Number.isFinite)){total+=ps.length+ix.length;emit(JSON.stringify({mapEvent:'dungeon-part',sceneKey:scene,serial,key:String(k).slice(0,160),positions:ps,indices:ix,matrix:m}));state.dungeonDiagnostics={scene,parts:seen.size,total,copyMs:performance.now()-started};schedule(16);return;}}part={key:String(k).slice(0,160),positions,indices,field:'positions',offset:0};emit(JSON.stringify({mapEvent:'dungeon-part-start',sceneKey:scene,serial,key:part.key,matrix:m}));}
    }
   }
   state.dungeonDiagnostics={scene,parts:seen.size,total,copyMs:performance.now()-started};
  }catch(error){state.dungeonDiagnostics={error:String(error?.message??error).slice(0,120)};part=null;}
  schedule(part?16:32);
 }
 schedule(100);
}
