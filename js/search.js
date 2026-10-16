/* Brand search for the home page and the brands directory. Loads the small
   index built by tools/build-site.js and matches as you type, on the brand
   name and on its sub-brands ("Maggi" finds Nestle, "Dettol" finds Reckitt).
   No network calls beyond fetching the index from this site. */
(function () {
  'use strict';
  const box = document.querySelector('.search');
  if (!box) return;
  const up = box.getAttribute('data-up') || '';
  const input = box.querySelector('input');
  const list = box.querySelector('ul');
  let rows = null;
  let active = -1;

  const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  function load() {
    if (rows) return Promise.resolve(rows);
    return fetch(up + 'data/brands-index.json').then((r) => r.json()).then((d) => {
      rows = d.map((x) => Object.assign(x, { k: norm(x.n), ak: (x.a || []).map(norm) }));
      return rows;
    });
  }

  /* Exact name, then name prefix, then sub-brand prefix, then anywhere. */
  function rank(q) {
    const k = norm(q);
    if (!k) return [];
    const scored = [];
    rows.forEach((x) => {
      let s = 0;
      let via = null;
      if (x.k === k) s = 100;
      else if (x.k.indexOf(k) === 0) s = 80;
      else {
        const i = x.ak.findIndex((a) => a === k || a.indexOf(k) === 0);
        if (i !== -1) { s = x.ak[i] === k ? 90 : 60; via = x.a[i]; }
        else if (x.k.indexOf(k) !== -1) s = 40;
        else if (k.length >= 4 && x.ak.some((a) => a.indexOf(k) !== -1)) { s = 20; via = x.a[x.ak.findIndex((a) => a.indexOf(k) !== -1)]; }
      }
      if (s) scored.push({ x: x, s: s, via: via });
    });
    return scored.sort((a, b) => b.s - a.s || a.x.n.length - b.x.n.length).slice(0, 8);
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render(q) {
    const hits = rank(q);
    list.textContent = '';
    active = -1;
    if (!q.trim()) { list.hidden = true; return; }
    if (!hits.length) {
      const li = el('li', 'none');
      li.append('We have not scored "' + q.trim() + '" yet. ');
      const a = el('a', null, 'Suggest it');
      a.href = 'mailto:contact@vaibhavarora.net?subject=' + encodeURIComponent('Kitna Indian: please add ' + q.trim());
      li.appendChild(a);
      list.appendChild(li);
      list.hidden = false;
      return;
    }
    hits.forEach((h, i) => {
      const li = el('li');
      li.setAttribute('role', 'option');
      li.id = 'opt-' + i;
      const a = el('a');
      a.href = up + 'brands/' + h.x.s + '/';
      const chip = el('span', 'chip', String(h.x.sc));
      chip.style.background = h.x.c;
      const name = el('span', 'rn', h.x.n);
      const meta = el('span', 'rm', h.x.b + (h.via ? ' · includes ' + h.via : ''));
      a.append(chip, name, meta);
      li.appendChild(a);
      list.appendChild(li);
    });
    list.hidden = false;
  }

  // Keep the combobox state in step with the list for screen readers.
  new MutationObserver(() => input.setAttribute('aria-expanded', String(!list.hidden))).observe(list, { attributes: true, attributeFilter: ['hidden'] });

  function move(d) {
    const items = list.querySelectorAll('li[role=option]');
    if (!items.length) return;
    active = (active + d + items.length) % items.length;
    items.forEach((li, i) => li.classList.toggle('on', i === active));
    input.setAttribute('aria-activedescendant', items[active].id);
  }

  input.addEventListener('focus', load, { once: true });
  input.addEventListener('input', () => { load().then(() => render(input.value)); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      const items = list.querySelectorAll('li[role=option] a');
      const pick = items[active >= 0 ? active : 0];
      if (pick) { e.preventDefault(); location.href = pick.href; }
    } else if (e.key === 'Escape') { list.hidden = true; }
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) list.hidden = true; });

  // Deep link: /?q=boat fills the box, so search results can be shared.
  const q = new URLSearchParams(location.search).get('q');
  if (q) { input.value = q; load().then(() => render(q)); }
})();
