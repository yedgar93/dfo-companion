// Presentation-only enhancement: no network, game, reader, or settings access.
const pack = document.getElementById('pack');
const sourceDetail = document.getElementById('item-detail');
const mobile = matchMedia('(max-width:800px)');
if (pack && sourceDetail) {
  const nav = document.createElement('nav');
  nav.className = 'mobile-pack-nav';
  nav.setAttribute('aria-label', 'Pack sections');
  let view = 'character';
  for (const [value, label, target] of [['character', 'Character', '.equipment-panel'], ['inventory', 'Inventory', '.inventory-panel']]) {
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
  const copyDetail = () => content.replaceChildren(...[...sourceDetail.childNodes].map(node => node.cloneNode(true)));
  // Existing item handlers render the full comparison first. Delegation survives
  // their button replacement, and the original desktop interaction is untouched.
  let originLabel = null;
  pack.addEventListener('click', event => {
    const item = event.target.closest('.gear,.accessory,.item');
    if (!mobile.matches || !item || item.disabled) return;
    originLabel = item.getAttribute('aria-label');
    queueMicrotask(() => {
      if (!mobile.matches) return;
      copyDetail();
      if (!sheet.open) sheet.showModal();
      sheet.scrollTop = 0;
    });
  });
  sheet.addEventListener('close', () => {
    const matching = [...pack.querySelectorAll('.gear,.accessory,.item')].filter(node => node.getAttribute('aria-label') === originLabel);
    const target = matching.find(node => node.getClientRects().length);
    target?.focus({preventScroll:true});
  });
  // Keep an open inspection current when the existing dashboard updates its data.
  new MutationObserver(() => { if (sheet.open) copyDetail(); }).observe(sourceDetail, {childList:true, subtree:true, characterData:true});
  mobile.addEventListener('change', () => { updateView(); if (!mobile.matches && sheet.open) sheet.close(); });
  updateView();
}

// Slim phone view: shows only the brief and the quest card. Presentation only.
{
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'phone-brief-toggle';
  let brief = true;
  try { brief = localStorage.getItem('dfo-phone-brief') !== '0'; } catch {}
  const apply = () => {
    document.body.classList.toggle('phone-brief', brief && mobile.matches);
    toggle.textContent = brief ? 'Full view' : 'Brief view';
    toggle.setAttribute('aria-pressed', String(brief));
  };
  toggle.addEventListener('click', () => { brief = !brief; try { localStorage.setItem('dfo-phone-brief', brief ? '1' : '0'); } catch {} apply(); });
  document.body.append(toggle);
  mobile.addEventListener('change', apply);
  apply();
}
