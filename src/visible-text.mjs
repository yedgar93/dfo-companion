// Fixed DOM-only reader. No game methods, event dispatch, focus, input, selection,
// storage, canvas pixels, or DOM writes. Style/layout reads require guard=false
// in Chromium; all operations here are inspection APIs.
export function readVisibleText() {
 const excluded='input,textarea,[contenteditable="true"],[role="log"],[data-private],script,style,noscript,template,head,[id*="chat" i],[class*="chat" i],[aria-label*="chat" i],.dfsocial,[id*="account" i],[class*="account" i],[id*="login" i],[class*="login" i],[id*="auth" i],[class*="auth" i]';
 const start=performance.now(),cache=new Map,lines=[];let chars=0,visited=0,truncated=false;
 const clean=s=>String(s??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,600);
 const style=el=>{let v=cache.get(el);if(!v){v=getComputedStyle(el);cache.set(el,v);}return v;};
 function visible(el,rect){
  if(!el||el.closest(excluded)||!(rect.width>0&&rect.height>0))return false;
  let left=Math.max(0,rect.left),top=Math.max(0,rect.top),right=Math.min(innerWidth,rect.right),bottom=Math.min(innerHeight,rect.bottom);
  if(right<=left||bottom<=top)return false;
  for(let p=el;p&&p!==document.documentElement;p=p.parentElement){
   const s=style(p);if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0||p.hidden)return false;
   if(s.overflowX!=='visible'||s.overflowY!=='visible'){
    const box=p.getBoundingClientRect();
    if(s.overflowX!=='visible'){left=Math.max(left,box.left);right=Math.min(right,box.right);}
    if(s.overflowY!=='visible'){top=Math.max(top,box.top);bottom=Math.min(bottom,box.bottom);}
    if(right<=left||bottom<=top)return false;
   }
  }
  if(style(el).pointerEvents!=='none'){
   const hit=document.elementsFromPoint((left+right)/2,(top+bottom)/2)[0];
   if(hit&&hit!==el&&!el.contains(hit)&&!hit.contains(el))return false;
  }
  return true;
 }
 // Enhanced notebooks/menus can be appended after a large hidden DOM. Inspect
 // visible modal roots first so a traversal budget cannot hide the open panel.
 const panels=[];
 for(const el of document.querySelectorAll?.('dialog[open],[role="dialog"],.px-home.px-over,.px-over')??[]){
  const rect=el.getBoundingClientRect();if(visible(el,rect)&&!panels.some(p=>p.contains(el)))panels.push(el);
 }
 const sceneCovered=panels.some(el=>{const r=el.getBoundingClientRect();return Math.min(innerWidth,r.width)*Math.min(innerHeight,r.height)>innerWidth*innerHeight*.25;});
 const roots=panels.length?panels:[document.body],seenNodes=new Set;
 for(const root of roots){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  if(++visited>6000||lines.length>=120||chars>=12000||performance.now()-start>100){truncated=true;break;}
  if(seenNodes.has(node))continue;seenNodes.add(node);const el=node.parentElement;if(!el||el.closest(excluded))continue;
  const range=document.createRange();range.selectNodeContents(node);
  const rects=range.getClientRects();let shown=false;for(const r of rects)if(visible(el,r)){shown=true;break;}
  if(!shown)continue;
  const text=clean(node.nodeValue);if(!text||lines.at(-1)?.text===text)continue;
  const control=el.closest('button,[role="button"],[role="option"],a,dialog,[role="dialog"]');
  const role=control?(control.getAttribute('role')??control.tagName.toLowerCase()):'text';
  lines.push({text,role});chars+=text.length;
 }}
 return {available:true,lines,truncated,sceneCovered,coverage:{visibleModalRoots:panels.length,visitedTextNodes:visited,canvasText:'UNSUPPORTED',interpretEmptyAsNoUi:false},scope:'Currently visible DOM text and menu/dialogue labels only. Player chat, account/login UI, input values and hidden/clipped text are excluded.',limitations:['Canvas-only words and scene geometry are not read.','This is visible UI text, not an NPC/entity list.','A notebook/settings panel with canvas-only words can be visible despite no readable DOM labels.']};
}
