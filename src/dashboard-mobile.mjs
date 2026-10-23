let phoneRevealUntil=0,phoneRevealCompact=true;
function phoneHasContentOverflow(){
 const main=document.querySelector('main'),space=document.querySelector('.mobile-hud-space'),hud=document.querySelector('.hud');if(!main||!space||!hud)return false;
 const full=Number(space.dataset.fullHeight)||hud.getBoundingClientRect().height;
 return main.getBoundingClientRect().height-space.getBoundingClientRect().height+full>innerHeight+2;
}
function revealPhoneSection(target){
 if(!target)return;
 if(matchMedia('(max-width:800px)').matches){
  phoneRevealUntil=Date.now()+250;phoneRevealCompact=phoneHasContentOverflow();document.body.classList.toggle('mobile-hud-compact',phoneRevealCompact);
  const align=()=>{
   const hud=document.querySelector('.hud'),space=document.querySelector('.mobile-hud-space');let top=hud?.getBoundingClientRect().bottom??0;
   if(space)space.style.height=top+'px';
   let at=Math.max(0,scrollY+target.getBoundingClientRect().top-top-8);
   // A short page may have no scroll range. Keep its full header rather than
   // leaving an expanded-height hole beneath a compact bar.
   if(at<=1){phoneRevealCompact=false;document.body.classList.remove('mobile-hud-compact');top=hud?.getBoundingClientRect().bottom??0;if(space)space.style.height=top+'px';at=Math.max(0,scrollY+target.getBoundingClientRect().top-top-8);}
   document.documentElement.style.setProperty('--hud-h',top+'px');window.scrollTo({top:at,behavior:'instant'});
  };
  requestAnimationFrame(()=>{align();requestAnimationFrame(align);});
 }
 else target.scrollIntoView({block:'start'});
}
document.addEventListener('dfo-reveal-section',event=>revealPhoneSection(event.detail?.target));
// Presentation-only enhancement: no network, game, reader, or settings access.
const pack = document.getElementById('pack');
const sourceDetail = document.getElementById('item-detail');
const mobile = matchMedia('(max-width:800px)');
// Keep fixed phone navigation outside the scrolling page's containing block.
// Restore its original position when a desktop window becomes wide again.
const pageTabs = document.querySelector('.tabs');
if (pageTabs) {
  const home = document.createComment('Companion page navigation');
  pageTabs.before(home);
  const placeTabs = () => {
    if (mobile.matches) document.body.append(pageTabs);
    else home.after(pageTabs);
  };
  mobile.addEventListener('change', placeTabs);
  placeTabs();
}
if (pack && sourceDetail) {
  const nav = document.createElement('nav');
  nav.className = 'mobile-pack-nav';
  nav.setAttribute('aria-label', 'Pack sections');
  let view = 'character';
  for (const [value, label, target] of [['character', 'Equipment', '.equipment-panel'], ['inventory', 'Inventory', '.inventory-panel']]) {
    const panel = pack.querySelector(target);
    panel.id ||= `mobile-${value}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.mobileView = value;
    button.setAttribute('aria-controls', panel.id);
    button.addEventListener('click', () => {
      view = value;
      updateView();
      revealPhoneSection(nav);
    });
    nav.append(button);
  }
  pack.prepend(nav);
  // A phone page can be several screens long. Switching sections should reveal
  // the new section's beginning instead of inheriting the old page's scroll.
  document.querySelector('.tabs')?.addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!mobile.matches || !button) return;
    queueMicrotask(() => revealPhoneSection(document.getElementById(button.dataset.page)));
  });
  document.getElementById('map')?.addEventListener('click', event => {
    const service = event.target.closest('.service-key-row');
    if (!mobile.matches || !service) return;
    // Explicit focus also preserves the pin highlight on touch Safari.
    service.focus({preventScroll:true});
    document.getElementById('map-stage')?.scrollIntoView({block:'start'});
  });
  function updateView() {
    if (mobile.matches) pack.dataset.mobileView = view;
    else delete pack.dataset.mobileView;
    for (const button of nav.children) button.setAttribute('aria-pressed', String(button.dataset.mobileView === view));
  }
  const sheet = document.createElement('dialog');
  sheet.className = 'mobile-item-sheet';
  sheet.setAttribute('aria-labelledby', 'mobile-inspect-title');
  const header = document.createElement('div');
  header.className = 'mobile-item-sheet-header';
  const title = document.createElement('h2');
  title.id = 'mobile-inspect-title';
  title.textContent = 'Item details & comparison';
  const close = document.createElement('button');
  close.className = 'mobile-item-sheet-close';
  close.type = 'button';
  close.textContent = 'Done';
  close.autofocus = true;
  close.addEventListener('click', () => sheet.close());
  header.append(title, close);
  const content = document.createElement('div');
  content.className = 'mobile-item-sheet-content';
  sheet.append(header, content);
  document.body.append(sheet);
  sheet.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...sheet.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(node => node.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  });
  const detailHome = sourceDetail.parentNode;
  let originLabel = null;
  // The UI emits after replacing tiles and rendering details; no detached click target.
  document.addEventListener('dfo-item-selected', () => {
    if (!mobile.matches) return;
    originLabel = pack.querySelector('.item.selected,.gear.selected,.accessory.selected')?.getAttribute('aria-label');
    content.append(sourceDetail);
    if (!sheet.open) sheet.showModal();
    sheet.scrollTop = 0;
  });
  sheet.addEventListener('close', () => {
    detailHome.append(sourceDetail);
    const matching = [...pack.querySelectorAll('.gear,.accessory,.item')].filter(node => node.getAttribute('aria-label') === originLabel);
    const target = matching.find(node => node.getClientRects().length);
    target?.focus({preventScroll:true});
  });
  mobile.addEventListener('change', () => { updateView(); if (!mobile.matches && sheet.open) sheet.close(); });
  const hud=document.querySelector('.hud');
  if(hud)new ResizeObserver(()=>document.documentElement.style.setProperty('--hud-h',hud.getBoundingClientRect().height+'px')).observe(hud);
  updateView();
}

// The phone HUD is a separate top bar. Reserve its expanded height so changing
// density never shifts the page or oscillates around the scroll threshold.
const phoneHud=document.querySelector('.hud');
if(phoneHud){
 const about=document.getElementById('about-button'),aboutHome=document.createComment('About action');if(about)about.before(aboutHome);
 const home=document.createComment('Character top bar'),space=document.createElement('div');
 space.className='mobile-hud-space';space.setAttribute('aria-hidden','true');phoneHud.before(home,space);
 let queued=false,lastY=scrollY,travel=0;
 function density(){
  queued=false;const y=Math.max(0,scrollY),delta=y-lastY;lastY=y;
  if(!mobile.matches){document.body.classList.remove('mobile-hud-compact');return;}
  if(!phoneHasContentOverflow()){travel=0;phoneRevealCompact=false;document.body.classList.remove('mobile-hud-compact');space.style.height=(space.dataset.fullHeight||phoneHud.getBoundingClientRect().height)+'px';return;}
  if(Date.now()<phoneRevealUntil){travel=0;document.body.classList.toggle('mobile-hud-compact',phoneRevealCompact);return;}
  if(y<=1){travel=0;document.body.classList.remove('mobile-hud-compact');return;}
  if(delta>0)travel=Math.max(0,travel)+delta;else if(delta<0)travel=Math.min(0,travel)+delta;
  if(travel>=24)document.body.classList.add('mobile-hud-compact');
  else if(travel<=-48)document.body.classList.remove('mobile-hud-compact');
 }

 function place(){if(mobile.matches){document.body.append(phoneHud);const tools=document.querySelector('#connection-page>.panel-heading');if(about&&tools)tools.append(about);document.body.classList.remove('mobile-hud-compact');space.dataset.fullHeight=phoneHud.getBoundingClientRect().height;space.style.height=space.dataset.fullHeight+'px';density();}else{document.body.classList.remove('mobile-hud-compact');home.after(phoneHud);if(about)aboutHome.after(about);}}
 function measure(){if(mobile.matches&&!document.body.classList.contains('mobile-hud-compact')){space.dataset.fullHeight=phoneHud.getBoundingClientRect().height;space.style.height=space.dataset.fullHeight+'px';}document.documentElement.style.setProperty('--hud-h',phoneHud.getBoundingClientRect().height+'px');}
 new ResizeObserver(measure).observe(phoneHud);new ResizeObserver(()=>{if(!queued){queued=true;requestAnimationFrame(density);}}).observe(document.querySelector('main'));window.addEventListener('resize',()=>{place();measure();});mobile.addEventListener('change',()=>{place();measure();});
 window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(density);}},{passive:true});
 place();measure();
}
