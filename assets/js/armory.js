/* =============================================================================
 * armory.js — the catalog page: department / caliber / brand / stock
 * filters, free-text query, sort, and the item detail dialog. State lives in
 * the URL (?dept=ammo&q=9mm&item=glock-19-gen5) so every view is linkable.
 * ===========================================================================*/
(function () {
  'use strict';
  const AA = window.AA; if (!AA) return;
  const { $, $$, esc } = AA;
  const items = (AA.catalog.items || []).slice();
  const params = new URLSearchParams(location.search);
  const state = {
    dept: AA.DEPTS[params.get('dept')] ? params.get('dept') : '',
    q: params.get('q') || '',
    cal: params.get('cal') || '',
    brand: params.get('brand') || '',
    stock: params.get('stock') === '1',
    sort: params.get('sort') || 'featured',
  };

  const calOf = (i) => {
    const c = i.specs && i.specs.caliber;
    return c ? String(c).split(/\s*[,/]\s*|\s+\(/)[0].trim() : '';
  };
  const hay = (i) => [i.name, i.brand, i.dept, (AA.DEPTS[i.dept] || {}).name, i.desc, i.sku,
    ...Object.values(i.specs || {})].filter(Boolean).join(' ').toLowerCase();
  items.forEach((i) => { i._hay = hay(i); i._cal = calOf(i); });

  /* ---------- controls ---------- */
  const deptChips = $('#deptChips'), calChips = $('#calChips'), brandSel = $('#brandSel');
  const q = $('#q'), sortSel = $('#sortSel'), inStock = $('#inStock');
  deptChips.innerHTML = [['', 'All']].concat(Object.entries(AA.DEPTS).map(([k, d]) => [k, d.name]))
    .map(([k, n]) => `<button type="button" class="chip" data-dept="${k}" aria-pressed="false">${esc(n)}</button>`).join('');
  const brands = [...new Set(items.map((i) => i.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  brandSel.innerHTML += brands.map((b) => `<option>${esc(b)}</option>`).join('');
  q.value = state.q; sortSel.value = state.sort; inStock.checked = state.stock; brandSel.value = state.brand;

  function renderCalibers() {
    const scope = items.filter((i) => !state.dept || i.dept === state.dept);
    const counts = {};
    scope.forEach((i) => { if (i._cal) counts[i._cal] = (counts[i._cal] || 0) + 1; });
    const cals = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c]) => c);
    if (state.cal && !cals.includes(state.cal)) state.cal = '';
    $('#calSet').hidden = !cals.length;
    calChips.innerHTML = cals.map((c) => `<button type="button" class="chip" data-cal="${esc(c)}" aria-pressed="${c === state.cal}">${esc(c)}</button>`).join('');
  }

  deptChips.addEventListener('click', (e) => { const b = e.target.closest('[data-dept]'); if (!b) return; state.dept = b.dataset.dept; state.cal = ''; update(); });
  calChips.addEventListener('click', (e) => { const b = e.target.closest('[data-cal]'); if (!b) return; state.cal = state.cal === b.dataset.cal ? '' : b.dataset.cal; update(); });
  brandSel.addEventListener('change', () => { state.brand = brandSel.value; update(); });
  inStock.addEventListener('change', () => { state.stock = inStock.checked; update(); });
  sortSel.addEventListener('change', () => { state.sort = sortSel.value; update(); });
  let qt; q.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { state.q = q.value.trim(); update(); }, 120); });
  $('#resetFilters').addEventListener('click', () => {
    Object.assign(state, { dept: '', q: '', cal: '', brand: '', stock: false, sort: 'featured' });
    q.value = ''; brandSel.value = ''; inStock.checked = false; sortSel.value = 'featured';
    update();
  });

  /* ---------- filter + sort + render ---------- */
  const rank = { in: 0, low: 1, order: 2, out: 3 };
  function results() {
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    let r = items.filter((i) =>
      (!state.dept || i.dept === state.dept) &&
      (!state.cal || i._cal === state.cal) &&
      (!state.brand || i.brand === state.brand) &&
      (!state.stock || i.status === 'in' || i.status === 'low') &&
      words.every((w) => i._hay.includes(w)));
    const byPrice = (dir) => (a, b) => (a.price == null) - (b.price == null) || dir * ((a.price || 0) - (b.price || 0));
    const sorters = {
      featured: (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (rank[a.status] || 0) - (rank[b.status] || 0) || (a.rank ?? 1e9) - (b.rank ?? 1e9),
      'price-asc': byPrice(1), 'price-desc': byPrice(-1),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return r.sort(sorters[state.sort] || sorters.featured);
  }
  /* the grid draws a page at a time: 2,000 cards at once would stall a phone */
  const PAGE = 48;
  let current = [], shown = 0;
  const more = document.createElement('div');
  more.className = 'more-wrap';
  more.innerHTML = '<button class="btn btn-ghost" type="button">Load more</button>';
  $('#armoryGrid').after(more);
  function renderMore() {
    const next = current.slice(shown, shown + PAGE);
    $('#armoryGrid').insertAdjacentHTML('beforeend', next.map(AA.card).join(''));
    shown += next.length;
    const left = current.length - shown;
    more.hidden = left <= 0;
    more.querySelector('button').textContent = `Load more · ${left} left`;
  }
  more.querySelector('button').addEventListener('click', renderMore);
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { if (es[0].isIntersecting && !more.hidden) renderMore(); }, { rootMargin: '600px 0px' }).observe(more);

  function update() {
    $$('[data-dept]', deptChips).forEach((b) => b.setAttribute('aria-pressed', b.dataset.dept === state.dept));
    renderCalibers();
    const r = results();
    current = r; shown = 0;
    $('#armoryGrid').innerHTML = '';
    renderMore();
    // a filter change while scrolled down the list jumps back to the top of the results
    const bar = document.querySelector('.results-bar');
    if (bar && bar.getBoundingClientRect().top < 0) bar.scrollIntoView({ block: 'start', behavior: AA.reduced ? 'auto' : 'smooth' });
    $('#emptyState').hidden = r.length > 0;
    $('#resultCount').textContent = `${r.length} ${r.length === 1 ? 'relic' : 'relics'} in range`;
    const d = AA.DEPTS[state.dept];
    $('#armoryTitle').textContent = d ? d.title : 'The Armory';
    document.title = `${d ? d.title : 'The Armory'} — Agarthan Armory`;
    const p = new URLSearchParams();
    if (state.dept) p.set('dept', state.dept);
    if (state.q) p.set('q', state.q);
    if (state.cal) p.set('cal', state.cal);
    if (state.brand) p.set('brand', state.brand);
    if (state.stock) p.set('stock', '1');
    if (state.sort !== 'featured') p.set('sort', state.sort);
    const cur = new URLSearchParams(location.search).get('item');
    if (cur) p.set('item', cur);
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
  }

  /* ---------- detail ---------- */
  const dlg = $('#detail');
  const LABELS = { caliber: 'Caliber / gauge', capacity: 'Capacity', barrel: 'Barrel', action: 'Action', bullet: 'Bullet', count: 'Count',
    magnification: 'Magnification', objective: 'Objective', reticle: 'Reticle', tube: 'Tube', power: 'Power', mount: 'Mount',
    sensor: 'Sensor', detection: 'Detection range', display: 'Display', output: 'Output', battery: 'Battery', fits: 'Fits',
    interior: 'Interior', locks: 'Locks', wheels: 'Wheels', includes: 'Includes', fire: 'Fire rating', lock: 'Lock' };
  function openItem(id, push) {
    const it = AA.items.get(id); if (!it) return;
    const st = AA.STATUS[it.status] || AA.STATUS.in;
    const specs = Object.entries(it.specs || {}).filter(([, v]) => v);
    const shop = AA.cfg.storeUrl && it.url;
    const ask = AA.cfg.email
      ? `mailto:${esc(AA.cfg.email)}?subject=${encodeURIComponent('Question: ' + it.name)}`
      : 'index.html#visit';
    $('#detailInner').innerHTML = `
      <div class="viz-lg${it.images && it.images[0] ? ' photo' : ''}">${AA.viz(it, true)}</div>
      <div class="detail-body">
        <div class="card-top"><span>${esc((AA.DEPTS[it.dept] || {}).title || '')}</span><span class="stock ${st[1]}">${esc(st[0])}</span></div>
        <h2 id="detailTitle">${esc(it.name)}</h2>
        <div class="brandline">${[it.brand ? esc(it.brand) : '', it.sku ? `<span style="color:var(--muted)">SKU ${esc(it.sku)}</span>` : ''].filter(Boolean).join(' · ')}</div>
        <div style="margin:18px 0 4px">${AA.priceHtml(it)}</div>
        ${specs.length ? `<table class="spec-table"><tbody>${specs.map(([k, v]) => `<tr><th scope="row">${esc(LABELS[k] || k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>` : ''}
        ${it.desc ? `<p class="desc">${esc(it.desc)}</p>` : ''}
        ${it.lore ? `<p class="card lore" style="padding:0;display:block">“${esc(it.lore)}”</p>` : ''}
        ${it.firearm ? `<p class="ffl-note">Firearm: completed in person with photo ID, ATF Form 4473 and a background check. ${AA.cfg.ageMin || 21}+ for handguns, 18+ for long guns. Subject to federal, state and local law.</p>` : ''}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
          ${shop ? `<a class="btn btn-ice arrow" href="${esc(it.url)}" target="_blank" rel="noopener">Buy online</a>` : ''}
          <button class="btn ${shop ? 'btn-ghost' : 'btn-ice'}" type="button" data-add="${esc(it.id)}" ${it.status === 'out' ? 'disabled' : ''}>${AA.req.has(it.id) ? '✓ On your list' : '+ Add to requisition'}</button>
          <a class="btn btn-ghost" href="${ask}">Ask about it</a>
        </div>
      </div>`;
    if (!dlg.open) dlg.showModal();
    // full copy + gallery arrive separately (assets/data/items/<id>.json)
    if (it.more) {
      fetch(`assets/data/items/${encodeURIComponent(it.id)}.json`).then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (!d || !dlg.open || $('#detailTitle').textContent !== it.name) return;
        const descEl = $('#detailInner .desc');
        if (descEl && d.desc) descEl.textContent = d.desc;
        const imgs = (d.images || []).filter(Boolean);
        if (imgs.length > 1) {
          const viz = $('#detailInner .viz-lg');
          viz.insertAdjacentHTML('beforeend', `<div class="thumbs">${imgs.map((src, n) => `<button type="button" data-src="${esc(src)}" aria-label="Photo ${n + 1}"${n ? '' : ' aria-pressed="true"'}><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>`);
          viz.querySelector('.thumbs').addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b) return;
            viz.querySelector(':scope > img').src = b.dataset.src;
            viz.querySelectorAll('.thumbs button').forEach((x) => x.setAttribute('aria-pressed', x === b));
          });
        }
      }).catch(() => { /* opened from disk, or offline: the summary stands */ });
    }
    if (push !== false) {
      const p = new URLSearchParams(location.search); p.set('item', id);
      history.pushState({ item: id }, '', location.pathname + '?' + p);
    }
  }
  function closeItem() {
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener('close', () => {
    const p = new URLSearchParams(location.search);
    if (p.has('item')) { p.delete('item'); history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '')); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) closeItem(); });
  document.addEventListener('aa:req', () => {
    const b = $('#detailInner [data-add]'); if (b) b.textContent = AA.req.has(b.dataset.add) ? '✓ On your list' : '+ Add to requisition';
  });
  $('#armoryGrid').addEventListener('click', (e) => {
    const a = e.target.closest('.card-link'); if (!a) return;
    e.preventDefault();
    openItem(a.closest('.card').dataset.id);
  });
  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('item');
    if (id) openItem(id, false); else closeItem();
  });

  const ft = $('.filters-toggle');
  ft && ft.addEventListener('click', () => {
    const open = $('.filters').classList.toggle('open');
    ft.setAttribute('aria-expanded', open); ft.textContent = open ? 'Fewer filters' : 'More filters';
  });

  /* ---------- boot ---------- */
  $('#demoNote').hidden = !AA.catalog.demo;
  update();
  const start = params.get('item');
  if (start && AA.items.has(start)) {
    const go = () => openItem(start, false);
    const g = document.getElementById('gate');
    if (g && !g.hidden && !document.documentElement.classList.contains('age-ok')) document.addEventListener('aa:gate-open', go, { once: true }); else go();
  }
})();
