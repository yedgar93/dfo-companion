// Presentation-only enhancement: no network, game, reader, or settings access.
const pack = document.getElementById('pack');
const sourceDetail = document.getElementById('item-detail');
const mobile = matchMedia('(max-width:800px)');
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
      nav.scrollIntoView({block:'start'});
    });
    nav.append(button);
  }
  pack.prepend(nav);
  // A phone page can be several screens long. Switching sections should reveal
  // the new section's beginning instead of inheriting the old page's scroll.
  document.querySelector('.tabs')?.addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!mobile.matches || !button) return;
    queueMicrotask(() => document.getElementById(button.dataset.page)?.scrollIntoView({block:'start'}));
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
