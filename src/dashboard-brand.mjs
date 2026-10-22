// Presentation-only branding: splash, About and the first-run guide.
// No network, game, reader or settings access; the only state is two local flags.
const FIRST_RUN_KEY='dfo-companion-first-run-seen',SPLASH_KEY='dfo-splash-shown';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const store=(area,key,value)=>{try{if(value===undefined)return area.getItem(key);area.setItem(key,value);}catch{return null;}};
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const isLocal=()=>['127.0.0.1','localhost','[::1]','::1'].includes(location.hostname);
const mark=size=>{const img=make('img','brand-mark');img.src='/dashboard-art/companion.png';img.alt='';img.width=size;img.height=size;return img;};

export const FIRST_RUN_STEPS=[
 {title:'Connect the game',body:'Start DFO with the companion connection from the Connection page, or just keep playing if it is already linked. The companion only reads your own character in idle moments; it never controls the game.',action:'Open Connection',page:'connection-page',target:'game-start-panel'},
 {title:'Pair your phone',body:'On the Connection page, scan the QR code with your phone camera while it is on the same private network. Pairing is by QR only and the code rotates on its own.',action:'Show the QR code',page:'connection-page',target:'phone-panel'},
 {title:'You are ready',body:'Pack shows worn gear and upgrades, Character is your sheet and standing, Map follows you and your quest. Everything updates by itself.',action:null}
];
export const shouldShowFirstRun=(seen,local)=>local&&seen!=='1';

function splash(){
 if(store(sessionStorage,SPLASH_KEY)==='1')return;store(sessionStorage,SPLASH_KEY,'1');
 const node=make('div','splash');node.setAttribute('role','presentation');node.setAttribute('aria-hidden','true');
 const card=make('div','splash-card');card.append(mark(96),make('strong','splash-title','DFO Companion'),make('span','splash-sub','A fan-made companion for Daggerfall Online'));node.append(card);document.body.append(node);
 const hold=reduced.matches?600:900;setTimeout(()=>{node.classList.add('leaving');setTimeout(()=>node.remove(),reduced.matches?0:450);},hold);
}

function dialogShell(id,label){const d=make('dialog','brand-dialog');d.id=id;d.setAttribute('aria-labelledby',id+'-title');document.body.append(d);return d;}

function about(){
 const d=dialogShell('about-dialog');
 const head=make('div','about-head'),title=make('h2',null,'DFO Companion');title.id='about-dialog-title';
 const version=make('p','about-version');head.append(mark(64),make('div'));head.lastChild.append(title,version);
 const body=make('div','about-body');
 for(const t of ['A second-monitor dashboard for your Daggerfall Online character: worn gear, pack, character sheet, map and quests.','Fan-made and unofficial. Not affiliated with, endorsed or sponsored by Bethesda Softworks, ZeniMax Media or the makers of Daggerfall Online. The Elder Scrolls and Daggerfall are trademarks of their respective owners.','Read-only: it never equips, trades, moves or controls anything in the game. Game artwork shown in the dashboard is loaded from your own installed game at runtime and is not bundled with the companion.','Companion code is MIT licensed; bundled third-party components are listed in THIRD-PARTY-NOTICES.txt.'])body.append(make('p',null,t));
 const actions=make('div','brand-actions'),guide=make('button',null,'Show the first-run guide'),close=make('button','primary','Close');guide.type=close.type='button';
 guide.addEventListener('click',()=>{d.close();firstRun(true);});close.addEventListener('click',()=>d.close());actions.append(guide,close);
 d.append(head,body,actions);
 const open=()=>{version.textContent=document.getElementById('app-version')?.textContent?.trim()||'Development build';d.showModal();};
 const button=document.getElementById('about-button');button?.addEventListener('click',open);
 return open;
}

let guideDialog=null;
function firstRun(force=false){
 if(!force&&!shouldShowFirstRun(store(localStorage,FIRST_RUN_KEY),isLocal()))return;
 if(!guideDialog){
  guideDialog=dialogShell('first-run');guideDialog.classList.add('first-run');
  guideDialog.addEventListener('close',()=>store(localStorage,FIRST_RUN_KEY,'1'));
 }
 const d=guideDialog;let step=0;
 const draw=()=>{const s=FIRST_RUN_STEPS[step];d.replaceChildren();
  const top=make('div','first-run-top');top.append(mark(40));const h=make('h2',null,'Welcome to DFO Companion');h.id='first-run-title';top.append(h);
  const dots=make('ol','first-run-steps');FIRST_RUN_STEPS.forEach((x,i)=>{const li=make('li',i===step?'current':i<step?'done':'',x.title);if(i===step)li.setAttribute('aria-current','step');dots.append(li);});
  const card=make('section','first-run-card');card.append(make('span','first-run-count',`Step ${step+1} of ${FIRST_RUN_STEPS.length}`),make('h3',null,s.title),make('p',null,s.body));
  if(s.action){const go=make('button','first-run-go',s.action+' ▸');go.type='button';go.addEventListener('click',()=>{document.querySelector(`.tabs [data-page="${s.page}"]`)?.click();d.close();requestAnimationFrame(()=>document.getElementById(s.target)?.scrollIntoView({block:'center',behavior:reduced.matches?'auto':'smooth'}));});card.append(go);}
  const nav=make('div','brand-actions'),skip=make('button','quiet','Skip guide'),back=make('button',null,'Back'),next=make('button','primary',step===FIRST_RUN_STEPS.length-1?'Done':'Next');
  for(const b of [skip,back,next])b.type='button';back.disabled=step===0;
  skip.addEventListener('click',()=>d.close());back.addEventListener('click',()=>{step--;draw();});next.addEventListener('click',()=>{if(step===FIRST_RUN_STEPS.length-1)d.close();else{step++;draw();}});
  nav.append(skip,back,next);d.append(top,dots,card,nav);next.focus();};
 draw();if(!d.open)d.showModal();
}

splash();about();
setTimeout(()=>firstRun(),reduced.matches?650:1000);
