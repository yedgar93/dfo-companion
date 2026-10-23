export function plainHudText(html) {
 if(typeof html!=='string'||html.length>16384)return null;
 const decoded=html.replace(/<[^>]*>/g,'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>=0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[s]);
 return decoded.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240)||null;
}

// These selectors refer only to reviewed rendered HUD elements, never entities,
// chat, map internals, inventory, or arbitrary caller-selected DOM paths.
export async function readVisibleHud(send,rootId) {
 async function find(selector,parent=rootId){const {nodeId}=await send('DOM.querySelector',{nodeId:parent,selector});return nodeId||null;}
 async function visible(id){
  if(!id)return false;
  try{
   const {model}=await send('DOM.getBoxModel',{nodeId:id});if(!(model?.width>0&&model?.height>0))return false;
   const {computedStyle=[]}=await send('CSS.getComputedStyleForNode',{nodeId:id});const style=new Map(computedStyle.map(s=>[s.name,s.value]));
   return style.get('display')!=='none'&&style.get('visibility')!=='hidden'&&Number(style.get('opacity')??1)>0;
  }catch{return false;}
 }
 async function text(id){if(!await visible(id))return null;const {outerHTML}=await send('DOM.getOuterHTML',{nodeId:id});return plainHudText(outerHTML);}
 let currentFoe=null;
 const foe=await find('.hud-foe.on');
 if(await visible(foe)){
  const name=await text(await find('.hud-foename',foe));
  if(name){const fill=await find('.hud-foetrack .hud-fill',foe);let healthPercent=null;if(fill){const {attributes=[]}=await send('DOM.getAttributes',{nodeId:fill});const attrs=new Map;for(let i=0;i<attributes.length;i+=2)attrs.set(attributes[i],attributes[i+1]);const m=attrs.get('style')?.match(/(?:^|;)\s*width\s*:\s*([\d.]+)%/);if(m){const n=Number(m[1]);if(Number.isFinite(n)&&n>=0&&n<=100)healthPercent=n;}}
   currentFoe={name,healthPercent,source:'currently rendered foe HUD bar',limitations:'This is the displayed foe, not a list of attackers or nearby enemies.'};
  }
 }
 return {available:true,currentFoe,currentMessage:await text(await find('#enhanced-midtext')),currentHorseTooltip:await text(await find('#enhanced-horse-tooltip')),scope:'Only currently rendered non-hidden HUD labels; no scene/entity scan.'};
}
