(() => {
  const key='__dfoVoiceBoxPortableV1';
  globalThis[key]?.teardown();
  const documentId=crypto.randomUUID();
  let dead=false,scheduled=false,lastTalk='',lastNotice='',lastService='',currentService=null,closeTimer=null,noticeTimer=null,serviceTimer=null;
  const send=o=>{if(!dead){const raw=JSON.stringify({version:1,documentId,...o});globalThis.__dfoVoiceBoxPortableBindingV1(raw.length<=60000?raw:JSON.stringify({version:1,documentId,type:'status',status:'dialogue-snapshot-too-large-skipped'}));}};
  const visible=el=>{if(!el||!el.isConnected)return false;for(let p=el;p && p.nodeType===1;p=p.parentElement){const c=getComputedStyle(p);if(p.hidden||c.display==='none'||c.visibility==='hidden'||c.visibility==='collapse'||Number(c.opacity)===0)return false;}return el.getClientRects().length>0;};
  const norm=s=>s.replace(/\s+/g,' ').trim();
  const direct=el=>norm([...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent??'').join(''));
  const readable=el=>{if(!visible(el)||el.matches('.notice-hint'))return '';return [...el.childNodes].map(n=>n.nodeType===Node.TEXT_NODE?n.textContent:n.nodeType===Node.ELEMENT_NODE?readable(n):'').join(' ');};
  function talk(){
    const panel=[...document.querySelectorAll('.talk-panel')].find(visible);
    if(!panel){if(!closeTimer && lastTalk!=='closed')closeTimer=setTimeout(()=>{closeTimer=null;if(![...document.querySelectorAll('.talk-panel')].some(visible)){lastTalk='closed';send({type:'talk',visible:false,suppressFarewell:!!currentService?.text});}},120);return;}
    clearTimeout(closeTimer);closeTimer=null;
    const s={type:'talk',visible:true,name:norm(panel.querySelector('.talk-named h2')?.textContent??''),entries:[...panel.querySelectorAll('.talk-log .talk-entry')].filter(visible).map(el=>({role:el.classList.contains('q')?'player':'npc',text:direct(el)}))};
    const badge=panel.querySelector('.talk-regard'),standing=badge&&['hostile','enemy','friend','neutral'].find(value=>badge.classList.contains(value));
    const regardNumber=badge&&(badge.getAttribute('aria-label')??badge.textContent??'').replace(/−/g,'-').match(/[+-]?\d+/);
    const regardValue=regardNumber?Number(regardNumber[0]):null;
    s.regard=standing?{standing,value:Number.isFinite(regardValue)&&Math.abs(regardValue)<=100?regardValue:null}:null;
    const hash=JSON.stringify(s);if(hash!==lastTalk){lastTalk=hash;send(s);}
  }
  function notice(){
    const nodes=[...document.querySelectorAll('#enhanced-notice .notice, #enhanced-notice.notice')].filter(el=>!el.matches('.notice-toast,.notice-out')&&visible(el));
    // Top stacking order first, then last DOM sibling. No claims about canvas windows.
    const z=el=>{let n=0;for(let p=el;p;p=p.parentElement)n+=parseInt(getComputedStyle(p).zIndex)||0;return n;};
    nodes.sort((a,b)=>z(a)-z(b));const panel=nodes.at(-1);
    if(!panel){clearTimeout(noticeTimer);noticeTimer=null;if(lastNotice!=='closed'){lastNotice='closed';send({type:'notice',visible:false});}return;}
    const rows=[...panel.querySelectorAll('.notice-body .notice-row')].filter(visible);
    const text=norm(rows.map(row=>{const cells=[...row.querySelectorAll('.notice-cell')];return cells.length?cells.filter(visible).map(readable).join(' '):readable(row);}).join('\n'));
    const s={type:'notice',visible:true,owner:panel.dataset.owner??panel.closest('[data-owner]')?.dataset.owner??'unknown',text};
    const hash=JSON.stringify(s);if(hash===lastNotice)return;
    clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{noticeTimer=null;if(visible(panel)&&!panel.matches('.notice-out')){lastNotice=hash;send(s);}},140);
  }
  function service(){
    const panels=[...document.querySelectorAll('.tavern-win,.trade-win')].filter(visible),base=panels.at(-1);
    if(!base){currentService=null;if(lastService!=='closed'&&!serviceTimer)serviceTimer=setTimeout(()=>{serviceTimer=null;if(![...document.querySelectorAll('.tavern-win,.trade-win')].some(visible)){lastService='closed';send({type:'service',visible:false});}},120);return;}
    clearTimeout(serviceTimer);serviceTimer=null;
    const serviceKind=base.matches('.trade-win')?'merchant':'innkeeper',title=norm(base.querySelector('.sb-who h2,.sb-who,.sb-top')?.textContent??serviceKind);
    const modal=[...document.querySelectorAll('.sb-ask,.yesnobox,.dlg-win')].filter(visible).at(-1),scope=modal??base;
    const rows=[...scope.querySelectorAll(modal?'.px-note,.dlg-row,.notice-row':'.px-note')].filter(visible).filter(el=>!el.closest('.trade-detail,.pack-list,.trade-footer'));
    const lines=rows.map(readable).map(norm).filter(Boolean),quote=lines.findIndex(line=>/^["“]/.test(line));
    const text=norm((quote>=0?lines.slice(quote):lines).join(' ')).replace(/^["“]|["”]$/g,'');
    currentService={type:'service',visible:true,owner:(serviceKind+':'+title).slice(0,256),speakerName:title,serviceKind,talkAvailable:[...base.querySelectorAll('button.tavern-act')].some(el=>visible(el)&&norm(el.textContent).toLowerCase()==='talk'),text};
    const hash=JSON.stringify(currentService);if(hash!==lastService){lastService=hash;send(currentService);}
  }
  const roots=new Map();
  const selector='.talk-panel,#enhanced-notice,.tavern-win,.trade-win,.sb-ask,.yesnobox,.dlg-win';
  const queue=()=>{if(!scheduled&&!dead){scheduled=true;requestAnimationFrame(()=>{scheduled=false;if(!dead){service();talk();notice();}});}};
  const discover=()=>{
    for(const [el,ob] of roots)if(!el.isConnected){ob.disconnect();roots.delete(el);}
    for(const el of document.querySelectorAll(selector))if(!roots.has(el)){const ob=new MutationObserver(queue);ob.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','data-owner']});roots.set(el,ob);}
    queue();
  };
  // Discover root replacements only; no whole-body attributes or text scans.
  const discovery=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches?.(selector)||n.querySelector?.(selector)))))discover();});
  if(document.body)discovery.observe(document.body,{childList:true,subtree:true});
  const interval=setInterval(discover,1000);discover();
  send({type:'status',status:'observer-installed-enhanced-only'});
  globalThis[key]={documentId,teardown(){dead=true;discovery.disconnect();for(const ob of roots.values())ob.disconnect();clearInterval(interval);clearTimeout(closeTimer);clearTimeout(noticeTimer);clearTimeout(serviceTimer);delete globalThis[key];}};
  return documentId;
})()
