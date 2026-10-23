// Presentation only: reuse existing DOM and snapshots. No reader or network access.
export function installLayout() {
  const $ = id => document.getElementById(id);
  // Attributes are available on Character; keep the equipment overview compact.
  document.querySelector('.character-stats')?.removeAttribute('open');
  const make = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
  const disclosure = (title, nodes, cls='') => {
    const d = make('details', 'ui-disclosure '+cls); d.append(make('summary','',title));
    const body=make('div','disclosure-body'); body.append(...nodes.filter(Boolean)); d.append(body); return d;
  };
  // Keep one objective summary, with explicit expansion on narrow screens.
  const quest=$('current-quest'), toggle=make('button','quest-toggle','Quest details');
  toggle.type='button'; toggle.setAttribute('aria-expanded','false');
  toggle.addEventListener('click',()=>{const open=quest.classList.toggle('quest-expanded');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Less detail':'Quest details';});
  quest.append(toggle);
  const pageChanged=()=>{document.body.dataset.activePage=document.querySelector('.tabs .active')?.dataset.page??'connection-page';};
  document.querySelector('.tabs').addEventListener('click',()=>queueMicrotask(pageChanged)); pageChanged();

  const switcher=document.querySelector('.map-switch'), toolbar=make('div','map-toolbar');
  const camera=make('div','map-camera-controls');camera.setAttribute('aria-label','Map camera');
  for(const id of ['map-focus','map-follow','map-zoom-in','map-zoom-out'])camera.append($(id));
  const floors=make('div','map-floor-controls');floors.setAttribute('aria-label','Dungeon floors and orientation');
  for(const id of ['map-height','map-floor-down','map-floor-up','map-face-objective'])floors.append($(id));
  const expand=make('button','map-expand','Expand map');expand.textContent='⛶';expand.title='Expand map';expand.setAttribute('aria-label','Expand map');expand.id='map-expand';expand.type='button';expand.setAttribute('aria-pressed','false');
  const setExpanded=value=>{if(document.body.classList.contains('map-expanded')===value)return;document.body.classList.toggle('map-expanded',value);expand.textContent=value?'↙':'⛶';expand.setAttribute('aria-label',value?'Close expanded map':'Expand map');expand.title=value?'Close expanded map':'Expand map';expand.setAttribute('aria-pressed',String(value));requestAnimationFrame(()=>document.dispatchEvent(new CustomEvent('dfo-map-resize')));};
  expand.addEventListener('click',()=>setExpanded(!document.body.classList.contains('map-expanded')));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(floorMenu.open){floorMenu.open=false;floorMenu.querySelector('summary').focus();}else setExpanded(false);}});
  document.querySelector('.tabs').addEventListener('click',()=>setExpanded(false));floors.prepend($('map-dungeon-plan'));camera.append(expand);
  const floorMenu=disclosure('More',[floors],'map-floor-menu');floorMenu.open=false;toolbar.append(camera,floorMenu);document.querySelector('.map-main').prepend(toolbar);document.addEventListener('pointerdown',event=>{if(!floorMenu.contains(event.target))floorMenu.open=false;});
  const area=disclosure('Area maps & services',[switcher,document.querySelector('.service-finder')],'map-area-controls');
  floorMenu.querySelector('.disclosure-body').append(area);
  const side=document.querySelector('.map-quest'), sidebar=disclosure('Quest & steps',[side],'map-quest-disclosure');sidebar.open=!matchMedia('(max-width:800px)').matches;document.querySelector('.map-layout').append(sidebar);
  const status=make('p','map-objective-status');status.id='map-objective-status';status.setAttribute('role','status');toolbar.after(status);
  const compass=make('div','map-compass');compass.id='map-compass';compass.setAttribute('aria-label','Map north');compass.textContent='↑ N';$('map-stage').append(compass);
  const gestures=make('p','map-gestures','Drag to rotate · Shift/right-drag to pan · Scroll or +/− to zoom');gestures.id='map-gestures';const help=disclosure('Map help',[gestures,document.querySelector('.map-legend')],'map-help');floorMenu.querySelector('.disclosure-body').append(help);
  const pan=make('button','map-pan-toggle','Drag: rotate');pan.id='map-pan-toggle';pan.type='button';pan.setAttribute('aria-pressed','false');floors.append(pan);

  const jump=make('nav','character-jump');jump.setAttribute('aria-label','Character sections');for(const [name,label] of [['overview','Overview'],['skills','Skills'],['standing','Standing']]){const b=make('button','',label);b.type='button';b.addEventListener('click',()=>{const target=document.querySelector('.character-'+name);if(matchMedia('(max-width:800px)').matches)document.dispatchEvent(new CustomEvent('dfo-reveal-section',{detail:{target}}));else target?.scrollIntoView({block:'start'});});jump.append(b);}document.querySelector('#character>.panel-heading').after(jump);
  const connection=document.querySelector('#connection-page>.scroll-area');
  const diagnostics=disclosure('How connection & freshness work',[$('schedule'),$('schedule').nextElementSibling,document.querySelector('.connection-health').nextElementSibling,document.querySelector('.reason-code')]);
  const artHeading=[...connection.querySelectorAll('h3')].find(n=>n.textContent==='Artwork');
  const artwork=disclosure('Artwork coverage & setup',[artHeading?.nextElementSibling]);artHeading?.remove();
  const statusCard=make('div','connection-status-card');statusCard.append($('last-success'),$('game-start-panel'),document.querySelector('.connection-health'));
  const top=make('div','connection-overview');top.append(statusCard,$('phone-panel'));connection.prepend(top);connection.append(diagnostics,artwork);
  const quiet=document.querySelector('.quiet-settings'),quietHelp=quiet.querySelector('p');quiet.append(disclosure('Alert thresholds',[quietHelp]));
  const note=make('p','coverage-note','Unavailable values and missing artwork mean the current snapshot or local assets are incomplete. They are not zero stats.');connection.append(note);
}
