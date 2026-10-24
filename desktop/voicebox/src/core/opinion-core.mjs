import {randomUUID} from 'node:crypto';
const normalize=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
const id=value=>value?.type==='object'||value?.type==='function'?value.objectId:null;
const field=(properties,name)=>properties.find(p=>p.name===name)?.value;

// Follow the visible Ask handler's reviewed model/engine closure chain. Never
// inspect Global, enumerate saves, invoke getters or call any game method.
export async function readCurrentOpinion(cdp,expectedName,{budgetMs=800}={}){
  const started=performance.now(),group='dfo-voicebox-opinion-'+randomUUID();let calls=0;
  const call=async(method,args)=>{if(++calls>28||performance.now()-started>budgetMs)throw Error('opinion-read-budget');return cdp.call(method,args);};
  const properties=async objectId=>{if(!objectId)throw Error('opinion-reference-missing');const result=await call('Runtime.getProperties',{objectId,ownProperties:true,generatePreview:false});if(!Array.isArray(result.result)||result.result.length>256)throw Error('opinion-properties-bound');return result;};
  const scopes=async fn=>{const p=await properties(id(fn)),list=await properties(p.internalProperties?.find(p=>p.name==='[[Scopes]]')?.value?.objectId);return list.result.filter(p=>p.value?.subtype==='internal#scope'&&p.value.description!=='Global').slice(0,4);};
  const captured=async(fn,alias)=>{for(const scope of await scopes(fn)){const p=await properties(id(scope.value)),value=field(p.result,alias);if(id(value))return value;}throw Error('opinion-captured-reference-missing');};
  try{
    const handler=(await call('Runtime.evaluate',{expression:"document.querySelector('.talk-panel .door-ask')?.onclick",objectGroup:group,returnByValue:false,generatePreview:false,silent:true,disableBreaks:true})).result;
    const modelAlias=handler?.description?.length<8192?handler.description.match(/([A-Za-z_$][\w$]*)\.press\(/)?.[1]:null;
    if(handler?.type!=='function'||!modelAlias)throw Error('opinion-dialogue-handler-unsupported');
    const model=await captured(handler,modelAlias),modelProperties=await properties(id(model));
    if(field(modelProperties.result,'conversation')?.subtype!=='array'||field(modelProperties.result,'done')?.value!==false)throw Error('opinion-model-not-active');
    const hooks=await properties(id(field(modelProperties.result,'hooks')));
    if(normalize(field(hooks.result,'npcName')?.value)!==normalize(expectedName))throw Error('opinion-speaker-changed');
    const answer=field(hooks.result,'answer'),engineAlias=answer?.description?.length<16384?answer.description.match(/([A-Za-z_$][\w$]*)\.pipeline\./)?.[1]:null;
    if(answer?.type!=='function'||!engineAlias)throw Error('opinion-answer-handler-unsupported');
    const engine=await properties(id(await captured(answer,engineAlias)));
    const sessionRef=id(field(engine.result,'session')),pipelineRef=id(field(engine.result,'pipeline'));
    if(!sessionRef||!pipelineRef)throw Error('opinion-engine-shape-unsupported');
    const session=await properties(sessionRef),reaction=field(session.result,'reactionToPlayer');
    if(normalize(field(session.result,'nameNPC')?.value)!==normalize(expectedName))throw Error('opinion-session-speaker-changed');
    if(reaction?.type!=='number'||!Number.isFinite(reaction.value)||Math.abs(reaction.value)>10000)throw Error('opinion-reaction-invalid');
    const pipeline=await properties(pipelineRef),lastTone=field(pipeline.result,'lastToneIndex')?.value,tier=field(pipeline.result,'reactionToPlayer012')?.value;
    // lastToneIndex=-1 means the tier is not initialized for this conversation.
    const answerTier=Number.isInteger(lastTone)&&lastTone>=0&&lastTone<=2&&[0,1,2].includes(tier)?tier:null;
    const active=(await call('Runtime.evaluate',{expression:"document.querySelector('.talk-panel .talk-named h2')?.textContent??null",returnByValue:true,objectGroup:group,silent:true,disableBreaks:true})).result?.value;
    const check=await properties(sessionRef);
    if(normalize(active)!==normalize(expectedName)||normalize(field(check.result,'nameNPC')?.value)!==normalize(expectedName))throw Error('opinion-stale-result');
    return {source:'game-npc-session',reactionToPlayer:reaction.value,answerTier,npcType:field(session.result,'currentNPCType')?.value,readMs:Math.round((performance.now()-started)*100)/100};
  }finally{await cdp.call('Runtime.releaseObjectGroup',{objectGroup:group}).catch(()=>{});}
}

