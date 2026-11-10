/* =============================================================================
 * armory.js — the catalog page: department and category chips, faceted
 * filters (caliber, use, bullet, magnification, footprint, manufacturer…,
 * each with live counts), price range, stock, free-text query, sort, and the
 * item detail dialog. State lives in the URL
 * (?dept=ammo&sub=Rifle&f.use=Hunting&f.brand=Hornady|Federal) so every view
 * is linkable.
 * ===========================================================================*/
(function () {
  'use strict';
  const AA = window.AA; if (!AA) return;
  const { $, $$, esc } = AA;
  const items = (AA.catalog.items || []).slice();
  const params = new URLSearchParams(location.search);

  /* ---------- facets: which filters each department shows, in order ---------- */
  const FACETS = {
    '': ['brand'],
    ammo: ['caliber', 'use', 'bullet', 'grain', 'count', 'casing', 'shot', 'shell', 'kind', 'brand'],
    optics: ['vision', 'form', 'footprint', 'mag', 'objective', 'tube', 'height', 'focal', 'illum', 'reticle', 'dot', 'sensor', 'phosphor', 'laser', 'platform', 'color', 'brand'],
    sidearms: ['caliber', 'barrel', 'action', 'capacity', 'color', 'brand'],
    longarms: ['caliber', 'barrel', 'action', 'capacity', 'kind', 'platform', 'build', 'color', 'brand'],
    shotguns: ['caliber', 'chamber', 'barrel', 'action', 'capacity', 'color', 'brand'],
    gear: ['kind', 'fits', 'caliber', 'capacity', 'barrel', 'style', 'hand', 'color', 'brand'],
    nfa: ['kind', 'caliber', 'mount', 'material', 'modular', 'barrel', 'capacity', 'color', 'brand'],
  };
  const LABEL = {
    brand: 'Manufacturer', caliber: 'Caliber / gauge', use: 'Use', bullet: 'Bullet type', grain: 'Bullet weight', count: 'Rounds per box',
    shot: 'Shot size', shell: 'Shell length', barrel: 'Barrel length', action: 'Action', capacity: 'Capacity', mag: 'Magnification',
    objective: 'Objective', tube: 'Tube / ring size', focal: 'Focal plane', illum: 'Illumination', footprint: 'Mount / footprint',
    sensor: 'Sensor', phosphor: 'Phosphor', laser: 'Laser', casing: 'Case', reticle: 'Reticle', dot: 'Dot size', color: 'Color / finish',
    height: 'Ring height', platform: 'Made for', kind: 'Type', fits: 'Fits', hand: 'Hand', style: 'Style',
    vision: 'Vision', form: 'Type', build: 'Build', mount: 'Mount', material: 'Material', modular: 'Modular', chamber: 'Chamber',
  };
  const NUMERIC = new Set(['grain', 'count', 'barrel', 'capacity', 'objective', 'mag', 'chamber']);
  const valsOf = (i, k) => (k === 'brand' ? (i.brand ? [i.brand] : []) : [].concat((i.f || {})[k] || []));
  // numbers in a filter value sort as numbers; "Under 16\"" comes before "16–18\""
  const numOf = (v) => (parseFloat(String(v).replace(/^[^\d]*/, '')) || 0) - (/^under\b/i.test(String(v)) ? 0.5 : 0);

  const state = {
    dept: AA.DEPTS[params.get('dept')] ? params.get('dept') : '',
    sub: params.get('sub') || '',
    q: params.get('q') || '',
    stock: params.get('stock') === '1',
    sort: params.get('sort') || 'featured',
    pmin: params.get('pmin') || '', pmax: params.get('pmax') || '',
    // how many cards a page shows: the link's choice, else this visitor's last, else 48
    per: [24, 48, 96, 192].includes(+params.get('per')) ? +params.get('per') : (() => { try { const v = +localStorage.getItem('aa-per'); return [24, 48, 96, 192].includes(v) ? v : 48; } catch { return 48; } })(),
    page: Math.max(1, parseInt(params.get('page'), 10) || 1),
    f: {},
  };
  for (const [k, v] of params) if (k.startsWith('f.') && LABEL[k.slice(2)]) state.f[k.slice(2)] = new Set(v.split('|').filter(Boolean));
  if (params.get('brand')) state.f.brand = new Set([params.get('brand')]);         // older links

  const hay = (i) => [i.name, i.brand, i.sub, (AA.DEPTS[i.dept] || {}).name, i.desc, i.sku,
    ...Object.values(i.specs || {}), ...Object.values(i.f || {}).flat()].filter(Boolean).join(' ').toLowerCase();
  items.forEach((i) => { i._hay = hay(i) + (i.sub === 'AR & Rifle-Caliber Pistols' ? ' arp ar pistol' : ''); });
  // the default order (assets/js/order.js, shared with the photo tool): the store's own shelf first,
  // then what ships, then the rest; departments take turns; photos lead
  AA.order.prepare(items, Object.keys(AA.DEPTS));

  /* ---------- controls ---------- */
  const deptChips = $('#deptChips'), subChips = $('#subChips'), facetsBox = $('#facets');
  const q = $('#q'), sortSel = $('#sortSel'), inStock = $('#inStock'), pmin = $('#pmin'), pmax = $('#pmax');
  // empty departments stay out of the chips (unless a link asked for one)
  deptChips.innerHTML = [['', 'All', items.length]].concat(Object.entries(AA.DEPTS).map(([k, d]) => [k, d.name, items.filter((i) => i.dept === k).length]))
    .filter(([k, , n]) => !k || n || k === state.dept)
    .map(([k, name, n]) => `<button type="button" class="chip" data-dept="${k}" aria-pressed="false">${esc(name)}<small>${n}</small></button>`).join('');
  q.value = state.q; sortSel.value = state.sort; inStock.checked = state.stock; pmin.value = state.pmin; pmax.value = state.pmax;

  deptChips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dept]'); if (!b) return;
    state.dept = b.dataset.dept; state.sub = ''; state.f = {}; update();
  });
  subChips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sub]'); if (!b) return;
    state.sub = state.sub === b.dataset.sub ? '' : b.dataset.sub; update();
  });
  facetsBox.addEventListener('change', (e) => {
    const c = e.target.closest('input[type="checkbox"][data-k]'); if (!c) return;
    const set = state.f[c.dataset.k] || (state.f[c.dataset.k] = new Set());
    if (c.checked) set.add(c.value); else set.delete(c.value);
    if (!set.size) delete state.f[c.dataset.k];
    update();
  });
  facetsBox.addEventListener('click', (e) => {
    const more = e.target.closest('[data-more]');
    if (more) { const fs = more.closest('.facet'); fs.classList.toggle('all'); more.textContent = fs.classList.contains('all') ? 'Show fewer' : more.dataset.more; return; }
    const clr = e.target.closest('[data-clear]');
    if (clr) { delete state.f[clr.dataset.clear]; update(); }
  });
  facetsBox.addEventListener('input', (e) => {
    const s = e.target.closest('[data-find]'); if (!s) return;
    const w = s.value.toLowerCase();
    s.closest('.facet').classList.toggle('all', !!w);
    $$('.fopt', s.closest('.facet')).forEach((l) => { l.hidden = !!w && !l.dataset.v.toLowerCase().includes(w); });
  });
  inStock.addEventListener('change', () => { state.stock = inStock.checked; update(); });
  sortSel.addEventListener('change', () => { state.sort = sortSel.value; update(); });
  let pt; [pmin, pmax].forEach((el) => el.addEventListener('input', () => { clearTimeout(pt); pt = setTimeout(() => { state.pmin = pmin.value; state.pmax = pmax.value; update(); }, 250); }));
  let qt; q.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { state.q = q.value.trim(); update(); }, 120); });
  $('#resetFilters').addEventListener('click', () => {
    Object.assign(state, { dept: '', sub: '', q: '', stock: false, sort: 'featured', pmin: '', pmax: '', f: {} });
    q.value = ''; inStock.checked = false; sortSel.value = 'featured'; pmin.value = ''; pmax.value = '';
    update();
  });

  /* ---------- filter: everything but one facet (for that facet's counts), or everything ---------- */
  // a short word matches the start of a word ("arp" finds ARP, not .21 Sharp); a longer one matches anywhere
  let qCache = [null, []];
  // search words, each with the synonyms the store set in the Ops Console (ar15 = ar-15 = ar 15, g19 = glock 19…)
  const SYN = (AA.cfg.synonyms || []).map((g) => g.map((w) => String(w).toLowerCase()));
  const groupsOf = (q) => {
    let rest = ` ${q} `;
    const out = [];
    for (const g of SYN) for (const w of g) if (w.includes(' ') && rest.includes(` ${w} `)) { out.push(g); rest = rest.replace(` ${w} `, ' '); }
    for (const t of rest.split(/\s+/).filter(Boolean)) out.push(SYN.find((g) => g.includes(t)) || [t]);
    return out;
  };
  const wordMatcher = (w) => (w.length <= 3 && /^[a-z]+$/.test(w)
    ? ((re) => (h) => re.test(h))(new RegExp(`(?:^|[^a-z0-9])${w}`))
    : (h) => h.includes(w));
  const matchers = () => {
    if (qCache[0] === state.q) return qCache[1];
    const ms = groupsOf(state.q.toLowerCase()).map((alts) => {
      const each = alts.map(wordMatcher);
      return each.length === 1 ? each[0] : (h) => each.some((m) => m(h));
    });
    qCache = [state.q, ms];
    return ms;
  };
  function passes(i, skip) {
    if (state.dept && i.dept !== state.dept) return false;
    if (state.sub && i.sub !== state.sub && !(i.also && i.also.includes(state.sub)) && skip !== 'sub') return false;
    if (state.stock && !(i.status === 'in' || i.status === 'low' || i.status === 'ship')) return false;
    const lo = parseFloat(state.pmin), hi = parseFloat(state.pmax);
    if (!isNaN(lo) && !(i.price >= lo)) return false;
    if (!isNaN(hi) && !(i.price != null && i.price <= hi)) return false;
    for (const [k, set] of Object.entries(state.f)) {
      if (k === skip || !set.size) continue;
      if (!valsOf(i, k).some((v) => set.has(v))) return false;
    }
    return matchers().every((m) => m(i._hay));
  }

  function renderSubs() {
    const scope = items.filter((i) => passes(i, 'sub'));
    const counts = {};
    scope.forEach((i) => { for (const s of [i.sub, ...(i.also || [])]) if (s) counts[s] = (counts[s] || 0) + 1; });
    const subs = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    $('#subSet').hidden = !state.dept || subs.length < 2;
    subChips.innerHTML = subs.map(([s, n]) => `<button type="button" class="chip" data-sub="${esc(s)}" aria-pressed="${s === state.sub}">${esc(s)}<small>${n}</small></button>`).join('');
  }

  function renderFacets() {
    const keys = FACETS[state.dept] || FACETS[''];
    const open = new Set($$('.facet.all', facetsBox).map((f) => f.dataset.k));
    facetsBox.innerHTML = keys.map((k) => {
      const counts = new Map();
      for (const i of items) if (passes(i, k)) for (const v of valsOf(i, k)) counts.set(v, (counts.get(v) || 0) + 1);
      const chosen = state.f[k] || new Set();
      chosen.forEach((v) => { if (!counts.has(v)) counts.set(v, 0); });
      if (counts.size < 1 || (counts.size < 2 && !chosen.size && k !== 'brand')) return '';
      let vals = [...counts.entries()];
      vals.sort(NUMERIC.has(k) ? (a, b) => numOf(a[0]) - numOf(b[0]) : (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
      const LIMIT = 8, many = vals.length > LIMIT;
      return `<fieldset class="facet${open.has(k) ? ' all' : ''}" data-k="${k}">
        <legend>${esc(LABEL[k])}${chosen.size ? ` <button type="button" class="facet-clear" data-clear="${k}">clear</button>` : ''}</legend>
        ${vals.length > 14 ? `<input class="facet-find" type="search" data-find placeholder="Find ${esc(LABEL[k].toLowerCase())}…" aria-label="Find ${esc(LABEL[k])}">` : ''}
        <div class="facet-opts">${vals.map(([v, n], idx) => `<label class="fopt${idx >= LIMIT && !chosen.has(v) ? ' extra' : ''}" data-v="${esc(v)}">
          <input type="checkbox" data-k="${k}" value="${esc(v)}"${chosen.has(v) ? ' checked' : ''}${n === 0 && !chosen.has(v) ? ' disabled' : ''}>
          <span>${esc(v)}</span><i>${n}</i></label>`).join('')}</div>
        ${many ? `<button type="button" class="facet-more" data-more="Show all ${vals.length}">${open.has(k) ? 'Show fewer' : `Show all ${vals.length}`}</button>` : ''}
      </fieldset>`;
    }).join('');
    $('#facetsNote').hidden = !(state.dept === 'ammo' && !items.some((i) => i.dept === 'ammo' && (i.f || {}).caliber));
  }

  /* ---------- sort ---------- */
  const rank = { in: 0, low: 1, ship: 2, order: 3, ask: 3, out: 4 };
  function results() {
    const r = items.filter((i) => passes(i));
    const byPrice = (dir) => (a, b) => (a.price == null) - (b.price == null) || dir * ((a.price || 0) - (b.price || 0));
    const sorters = {
      featured: AA.order.featured,
      'price-asc': byPrice(1), 'price-desc': byPrice(-1),
      name: (a, b) => a.name.localeCompare(b.name),
      // ammo by price per round; anything without one after
      cpr: (a, b) => (a.cpr ?? Infinity) - (b.cpr ?? Infinity) || (a.price ?? Infinity) - (b.price ?? Infinity),
    };
    return r.sort(sorters[state.sort] || sorters.featured);
  }
  /* the grid shows one page at a time (Show: 24 / 48 / 96 / 192), with numbered pages below it:
     an endless scroll grew the page without end and left the footer out of reach */
  const perSel = $('#perSel');
  if (perSel) {
    perSel.value = String(state.per);
    perSel.addEventListener('change', () => { state.per = +perSel.value; try { localStorage.setItem('aa-per', perSel.value); } catch { /* private mode */ } update(); });
  }
  const pager = document.createElement('nav');
  pager.className = 'pager'; pager.setAttribute('aria-label', 'Pages');
  $('#armoryGrid').after(pager);
  pager.addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]'); if (!b || b.disabled) return;
    state.page = +b.dataset.page; update(true);
  });
  /** 1 … 4 5 [6] 7 8 … 193 */
  function pageList(page, pages) {
    const keep = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((n) => n >= 1 && n <= pages));
    const out = []; let last = 0;
    for (const n of [...keep].sort((a, b) => a - b)) { if (n - last > 1) out.push('…'); out.push(n); last = n; }
    return out;
  }
  function renderPager(page, pages) {
    pager.hidden = pages <= 1;
    if (pages <= 1) { pager.innerHTML = ''; return; }
    const btn = (n, label, cls = '') => `<button type="button" class="pg${cls}" data-page="${n}"${n < 1 || n > pages ? ' disabled' : ''}${n === page && !cls ? ' aria-current="page"' : ''}>${label}</button>`;
    pager.innerHTML = btn(page - 1, '‹ Prev', ' pg-step') +
      pageList(page, pages).map((n) => (n === '…' ? '<span class="pg-gap">…</span>' : btn(n, n))).join('') +
      btn(page + 1, 'Next ›', ' pg-step') + `<span class="pg-of">Page ${page} of ${pages.toLocaleString()}</span>`;
  }

  // keepPage: a page button (the filters stay); anything else starts again at page 1
  let missT, lastMiss = '';
  function update(keepPage) {
    if (!keepPage) state.page = 1;
    $$('[data-dept]', deptChips).forEach((b) => b.setAttribute('aria-pressed', b.dataset.dept === state.dept));
    renderSubs();
    renderFacets();
    const r = results();
    const pages = Math.max(1, Math.ceil(r.length / state.per));
    state.page = Math.min(Math.max(1, state.page), pages);
    const from = (state.page - 1) * state.per;
    $('#armoryGrid').innerHTML = r.slice(from, from + state.per).map(AA.card).join('');
    renderPager(state.page, pages);
    // a filter change or a new page while scrolled down the list jumps back to the top of the results
    const bar = document.querySelector('.results-bar');
    if (bar && bar.getBoundingClientRect().top < 0) bar.scrollIntoView({ block: 'start', behavior: AA.reduced ? 'auto' : 'smooth' });
    $('#emptyState').hidden = r.length > 0;
    // a search that found nothing tells the Ops Console (anonymously), so the store sees what people look for
    clearTimeout(missT);
    if (state.q && !r.length) { const q0 = state.q; missT = setTimeout(() => { if (state.q === q0 && q0 !== lastMiss) { lastMiss = q0; AA.beacon({ p: location.pathname, q: q0 }); } }, 1500); }
    $('#resultCount').textContent = `${r.length.toLocaleString()} ${r.length === 1 ? 'relic' : 'relics'} in range` +
      (pages > 1 ? ` · ${(from + 1).toLocaleString()}–${Math.min(from + state.per, r.length).toLocaleString()}` : '');
    const d = AA.DEPTS[state.dept];
    $('#armoryTitle').textContent = state.sub || (d ? d.title : 'The Armory');
    showArt();
    document.title = `${state.sub || (d ? d.title : 'The Armory')} — Agarthan Armory`;
    const n = Object.values(state.f).reduce((a, s2) => a + s2.size, 0) + (state.sub ? 1 : 0) + (state.stock ? 1 : 0) + (state.pmin || state.pmax ? 1 : 0);
    const ft2 = $('.filters-toggle'); if (ft2 && !$('.filters').classList.contains('open')) ft2.textContent = n ? `More filters · ${n} on` : 'More filters';
    const p = new URLSearchParams();
    if (state.dept) p.set('dept', state.dept);
    if (state.sub) p.set('sub', state.sub);
    if (state.q) p.set('q', state.q);
    for (const [k, set] of Object.entries(state.f)) if (set.size) p.set('f.' + k, [...set].join('|'));
    if (state.pmin) p.set('pmin', state.pmin);
    if (state.pmax) p.set('pmax', state.pmax);
    if (state.stock) p.set('stock', '1');
    if (state.sort !== 'featured') p.set('sort', state.sort);
    if (state.per !== 48) p.set('per', String(state.per));
    if (state.page > 1) p.set('page', String(state.page));
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
  const DETAILS = new Map();   // id → { desc, images, specs, url } from assets/data/items/<id>.json
  // a picture beside the title for the departments and categories that have one
  const ART_DIR = 'assets/img/feature/';
  const ART = {
    '': ['manifesto-1280.webp', 'Agarthan Armory: for those who seek what lies beyond the known world'],
    nfa: ['tiny-cans-640.webp', 'Tiny guns, tiny cans: a compact pistol wearing a short Stealth Additive Works suppressor'],
    optics: ['holo-laser-900.webp', 'A rifle in blue light with a holographic sight and a laser unit'],
    'optics/Lasers': ['lasers-900.webp', 'A rifle firing a green laser, under the word Lasers'],
    'optics/Red Dots & Holographic': ['holo-laser-900.webp', 'A rifle in blue light with a holographic sight and a laser unit'],
    'optics/Night Vision': ['night-vision-416.webp', 'Seen through night vision: a shooter firing in green light'],
  };
  function showArt() {
    const fig = $('#armoryArt'); if (!fig) return;
    const art = ART[state.dept + '/' + state.sub] || (state.sub ? null : ART[state.dept]) || null;
    fig.hidden = !art;
    fig.closest('.page-hero').classList.toggle('has-art', !!art);
    if (!art) return;
    const img = fig.querySelector('img');
    const src = AA.realmSrc(ART_DIR + art[0]);   // the owner's art follows the realm's colours
    if (img.getAttribute('src') !== src) { img.src = src; img.alt = art[1]; }
  }

  function openItem(id, push) {
    const base = AA.items.get(id); if (!base) return;
    const it = { ...base, ...(DETAILS.get(id) || {}) };
    const st = AA.STATUS[it.status] || AA.STATUS.in;
    const specs = Object.entries(it.specs || {}).filter(([, v]) => v);
    const shown = new Set(specs.map(([k]) => k));
    // a store spec sheet already says it all; only what was read from the copy (use, footprint) is added
    for (const [k, v] of Object.entries(it.f || {})) if (!shown.has(k) && LABEL[k] && (!it.sheet || k === 'use' || k === 'footprint')) specs.push([k, [].concat(v).join(', ')]);
    const shop = AA.cfg.storeUrl && it.url;
    const ask = AA.cfg.email
      ? `mailto:${esc(AA.cfg.email)}?subject=${encodeURIComponent('Question: ' + it.name)}`
      : 'index.html#visit';
    $('#detailInner').innerHTML = `
      <div class="viz-lg${it.images && it.images[0] ? ' photo' : ''}">${AA.viz(it, true)}${AA.nfaTag(it)}</div>
      <div class="detail-body">
        <div class="card-top"><span>${esc([(AA.DEPTS[it.dept] || {}).title, it.sub].filter(Boolean).join(' › '))}</span><span class="stock ${st[1]}">${esc(st[0])}</span></div>
        <h2 id="detailTitle">${esc(it.name)}</h2>
        <div class="brandline">${[it.brand ? esc(it.brand) : '', it.sku ? `<span style="color:var(--muted)">SKU ${esc(it.sku)}</span>` : ''].filter(Boolean).join(' · ')}</div>
        <div style="margin:18px 0 4px">${AA.priceHtml(it)}</div>
        ${specs.length ? `<table class="spec-table"><tbody>${specs.map(([k, v]) => `<tr><th scope="row">${esc(LABELS[k] || LABEL[k] || k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>` : ''}
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
    // full copy, gallery, spec sheet and store link arrive separately (assets/data/items/<id>.json)
    const imgs = (it.images || []).filter(Boolean);
    if (imgs.length > 1) {
      const viz = $('#detailInner .viz-lg');
      viz.insertAdjacentHTML('beforeend', `<div class="thumbs">${imgs.map((src, n) => `<button type="button" data-src="${esc(src)}" aria-label="Photo ${n + 1}"${n ? '' : ' aria-pressed="true"'}><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>`);
      viz.querySelector('.thumbs').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        viz.querySelector(':scope > img').src = b.dataset.src;
        viz.querySelectorAll('.thumbs button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      });
    }
    if (it.more && !DETAILS.has(id)) {
      fetch(`assets/data/items/${encodeURIComponent(id)}.json`).then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (!d) return;
        DETAILS.set(id, d);
        if (dlg.open && $('#detailTitle') && $('#detailTitle').textContent === it.name) openItem(id, false);
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
  update(true);   // the first draw keeps the page the link asked for
  const start = params.get('item');
  if (start && AA.items.has(start)) {
    const go = () => openItem(start, false);
    const g = document.getElementById('gate');
    if (g && !g.hidden && !document.documentElement.classList.contains('age-ok')) document.addEventListener('aa:gate-open', go, { once: true }); else go();
  }
})();
