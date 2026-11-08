/* =============================================================================
 * site.js — shared behaviour for every Agarthan Armory page.
 *
 *   AA.cfg            the store facts (config.js), rendered into [data-cfg]
 *   age gate          #gate; remembered 30 days on this device
 *   header            mobile menu, current page, requisition count
 *   AA.req            the requisition list (a reservation request, not a sale)
 *   AA.card(item)     product card markup, shared by home + armory
 *   sky(canvas)       stars + aurora curtains + the odd shooting star
 *   ufo               the visitor that crosses the hero
 *   reveal            fade-in on scroll
 * Everything degrades: no storage, no canvas, reduced motion — the page still
 * reads and works.
 * ===========================================================================*/
(function () {
  'use strict';
  const AA = (window.AA = window.AA || {});
  const cfg = (AA.cfg = window.AA_CONFIG || {});
  const catalog = (AA.catalog = window.AA_CATALOG || { items: [] });
  AA.items = new Map((catalog.items || []).map((i) => [i.id, i]));
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  AA.reduced = reduced;

  /* ---------- tiny helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  AA.$ = $; AA.$$ = $$;
  const esc = (AA.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  AA.store = store;
  const tbd = (AA.tbd = (label) => `<span class="tbd" title="Not filled in yet — set it in assets/js/config.js">${esc(label)}</span>`);
  AA.money = (n) => (n == null || isNaN(n) ? null :
    '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }));
  const deepGet = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

  /* ---------- runes: Latin → Elder Futhark ----------
   * TH → ᚦ, NG → ᛜ; doubled letters are written once, as in the old
   * inscriptions; words split by ᛫ and phrases by ᛬. */
  const FUTHARK = { a: 'ᚨ', b: 'ᛒ', c: 'ᚲ', d: 'ᛞ', e: 'ᛖ', f: 'ᚠ', g: 'ᚷ', h: 'ᚺ', i: 'ᛁ', j: 'ᛃ', k: 'ᚲ', l: 'ᛚ', m: 'ᛗ',
    n: 'ᚾ', o: 'ᛟ', p: 'ᛈ', q: 'ᚲ', r: 'ᚱ', s: 'ᛊ', t: 'ᛏ', u: 'ᚢ', v: 'ᚹ', w: 'ᚹ', x: 'ᚲᛊ', y: 'ᛃ', z: 'ᛉ' };
  AA.runes = (str) => String(str || '').toLowerCase().replace(/([a-z])\1+/g, '$1').split(/\s*·\s*/).map((phrase) =>
    phrase.trim().split(/\s+/).map((w) => w.replace(/th/g, 'ᚦ').replace(/ng/g, 'ᛜ').replace(/[a-z]/g, (c) => FUTHARK[c]).replace(/[^\u16A0-\u16FF]/g, '')).join('᛫')).join(' ᛬ ');

  /* ---------- store facts → page ---------- */
  function addressLines() {
    const a = cfg.address || {};
    const l2 = [a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return [a.street, l2].filter(Boolean);
  }
  AA.addressLines = addressLines;
  function fillConfig(root = document) {
    for (const el of $$('[data-cfg]', root)) {
      const key = el.dataset.cfg;
      const label = el.dataset.tbd || '[ ' + key.split('.').pop().replace(/([A-Z])/g, ' $1').toUpperCase() + ' ]';
      let v = deepGet(cfg, key), html = null;
      if (key === 'phone' && v) html = `<a href="tel:${esc(String(v).replace(/[^\d+]/g, ''))}">${esc(v)}</a>`;
      else if (key === 'email' && v) html = `<a href="mailto:${esc(v)}">${esc(v)}</a>`;
      else if (key === 'address') { const ls = addressLines(); html = ls.length ? ls.map(esc).join('<br>') : null; }
      else if (key.startsWith('fees.')) html = v == null ? 'Call' : esc(AA.money(v));
      else if (v != null && v !== '') html = esc(v);
      el.innerHTML = html == null ? (el.hasAttribute('data-quiet') ? '' : tbd(label)) : html;
    }
    for (const el of $$('[data-hours]', root)) {
      const days = cfg.hours || [];
      const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
      el.innerHTML = `<tbody>${days.map(([d, h]) =>
        `<tr${d === today ? ' class="today"' : ''}><td>${esc(d)}${d === today ? ' · today' : ''}</td><td>${h ? esc(h) : tbd('[ HOURS ]')}</td></tr>`).join('')}</tbody>`;
    }
    for (const el of $$('[data-social]', root)) {
      const s = cfg.social || {};
      const names = { instagram: 'Instagram', facebook: 'Facebook', x: 'X', youtube: 'YouTube', tiktok: 'TikTok' };
      const links = Object.entries(names).filter(([k]) => s[k]).map(([k, n]) =>
        `<li><a href="${esc(s[k])}" target="_blank" rel="noopener">${n}</a></li>`);
      el.innerHTML = links.length ? links.join('') : `<li>${tbd('[ SOCIAL LINKS ]')}</li>`;
    }
    for (const el of $$('[data-year]', root)) el.textContent = new Date().getFullYear();
    for (const el of $$('[data-runes]', root)) { el.textContent = AA.runes(el.dataset.runes); el.setAttribute('lang', 'und-Runr'); el.title = el.dataset.runes; }
    for (const el of $$('[data-sot]', root)) el.hidden = !(cfg.ffl && cfg.ffl.sot);
  }
  AA.fillConfig = fillConfig;

  /* ---------- age gate ---------- */
  const AGE_KEY = 'aa-age-ok';
  function gate() {
    const g = $('#gate');
    if (!g) return;
    const min = cfg.ageMin || 21;
    $$('[data-age]', g).forEach((el) => { el.textContent = min; });
    const ok = store.get(AGE_KEY, 0);
    if (ok && Date.now() - ok < 30 * 864e5) { g.hidden = true; return; }
    g.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    const yes = $('#gateYes', g), no = $('#gateNo', g);
    setTimeout(() => yes && yes.focus(), 60);
    yes && yes.addEventListener('click', () => {
      store.set(AGE_KEY, Date.now());
      g.classList.add('opening');
      g.hidden = true;
      document.documentElement.style.overflow = '';
      document.dispatchEvent(new CustomEvent('aa:gate-open'));
    });
    no && no.addEventListener('click', () => {
      const msg = $('.gate-msg', g);
      if (msg) msg.innerHTML = '<p class="denied">ACCESS DENIED</p><p>Come back when you come of age, traveler. Under federal law you must be 18 to buy long guns and ammunition and 21 to buy a handgun from a dealer.</p>';
      $$('.gate-actions', g).forEach((a) => { a.hidden = true; });
    });
    // keep focus inside the gate
    g.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = $$('button:not([hidden]), a[href]', g).filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
  }

  /* ---------- header ---------- */
  function header() {
    const h = $('.site-header');
    if (!h) return;
    const btn = $('.menu-btn', h);
    btn && btn.addEventListener('click', () => {
      const open = h.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
      document.documentElement.style.overflow = open ? 'hidden' : '';
    });
    $$('.nav-links a', h).forEach((a) => a.addEventListener('click', () => {
      h.classList.remove('open'); btn && btn.setAttribute('aria-expanded', 'false');
      document.documentElement.style.overflow = '';
    }));
    // current page: same file and same ?dept (so "Ammo" and "The Armory" don't both light up)
    const here = location.pathname.split('/').pop() || 'index.html';
    const hereDept = new URLSearchParams(location.search).get('dept') || '';
    $$('.nav-links a', h).forEach((a) => {
      const href = a.getAttribute('href');
      if (href.includes('#')) return;
      const u = new URL(href, location.href);
      const file = u.pathname.split('/').pop() || 'index.html';
      if (file === here && (u.searchParams.get('dept') || '') === hereDept) a.setAttribute('aria-current', 'page');
    });
  }

  /* ---------- clocks ---------- */
  function clocks() {
    const els = $$('[data-clock]');
    const dates = $$('[data-date]');
    const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const tickc = () => {
      const d = new Date();
      const t = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
      els.forEach((e) => { e.textContent = t; });
      dates.forEach((e) => { e.textContent = `${String(d.getDate()).padStart(2, '0')}.${mon[d.getMonth()]}.${d.getFullYear()}`; });
    };
    if (els.length || dates.length) { tickc(); setInterval(tickc, 1000); }
  }

  /* ---------- toasts ---------- */
  AA.toast = function (html, ms = 3800) {
    let box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast'; t.innerHTML = html;
    box.appendChild(t);
    setTimeout(() => t.remove(), ms);
  };

  /* ---------- product card ---------- */
  const DEPTS = (AA.DEPTS = {
    sidearms: { name: 'Sidearms', code: 'DEPT 01', title: 'Agarthan Sidearms' },
    longarms: { name: 'Longarms', code: 'DEPT 02', title: 'Hyperborean Longarms' },
    shotguns: { name: 'Shotguns', code: 'DEPT 03', title: 'Ice Wall Breachers' },
    ammo: { name: 'Ammunition', code: 'DEPT 04', title: 'Ammunition Caches' },
    optics: { name: 'Optics & Tech', code: 'DEPT 05', title: 'Optics & Advanced Tech' },
    gear: { name: 'Gear', code: 'DEPT 06', title: 'Expedition Gear' },
    nfa: { name: 'NFA & Suppressors', code: 'DEPT 07', title: 'The Silent Vault' },
  });
  const STATUS = (AA.STATUS = {
    in: ['In the vault', ''], low: ['Few left', 'low'], ship: ['Ready to ship', ''], order: ['Special order', 'order'], out: ['Out of stock', 'order'],
    ask: ['Call for availability', 'order'],
  });
  AA.icon = (type) => (window.AA_ICONS && (window.AA_ICONS[type] || window.AA_ICONS.case)) || '';
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.closest('.viz, .viz-lg') || img.dataset.failed) return;
    img.dataset.failed = '1';
    const box = img.closest('.viz, .viz-lg'); const card = img.closest('[data-id]');
    const item = card && AA.items && AA.items.get(card.dataset.id);
    box.classList.remove('photo');
    img.outerHTML = `<span class="holo-glow" style="display:contents">${AA.icon((item && item.type) || box.dataset.type || 'case')}</span>`;
  }, true);
  AA.viz = (item, big) => {
    const img = item.images && item.images[0];
    if (img) return `<img src="${esc(img)}" alt="${esc(item.name)}" loading="lazy" decoding="async">`;
    return `<span class="holo-glow" style="display:contents">${AA.icon(item.type)}</span>`;
  };
  AA.priceHtml = (item) => {
    const p = AA.money(item.price);
    if (p == null) return `<span class="price">${esc(item.priceNote || 'Call for price')}</span>`;
    const was = item.was && item.was > item.price ? ` <s style="color:var(--muted);font-size:.6em">${esc(AA.money(item.was))}</s>` : '';
    const per = item.cpr ? `${AA.money(item.cpr < 1 ? Math.round(item.cpr * 100) / 100 : item.cpr)}/rd · ` : '';
    return `<span class="price">${esc(p)}${was}<small>${esc(per + (item.priceNote || (item.firearm ? 'Transfer in store' : 'Pickup or ship')))}</small></span>`;
  };
  AA.specLine = (item) => {
    const s = item.specs || {};
    return [s.caliber, s.capacity, s.barrel || s.count || s.magnification || s.reticle].filter(Boolean).map(esc).join(' · ');
  };
  AA.card = (item) => {
    const st = STATUS[item.status] || STATUS.in;
    const inReq = AA.req.has(item.id);
    const sold = item.status === 'out';
    return `<article class="card hud brackets" data-id="${esc(item.id)}">
      <div class="card-top"><span>${esc(item.sub || (DEPTS[item.dept] || {}).name || '')}</span><span class="stock ${st[1]}">${esc(st[0])}</span></div>
      <div class="viz scan${item.images && item.images[0] ? ' photo' : ''}">${AA.viz(item)}</div>
      <div class="brandline">${esc(item.brand || '')}</div>
      <h3>${esc(item.name)}</h3>
      ${AA.specLine(item) ? `<p class="specs">${AA.specLine(item)}</p>` : ''}
      <div class="card-foot">
        ${AA.priceHtml(item)}
        <button class="icon-btn add${inReq ? ' added' : ''}" type="button" data-add="${esc(item.id)}" ${sold ? 'disabled' : ''}
          aria-label="${inReq ? 'On your requisition list' : 'Add to requisition list'}: ${esc(item.name)}">${inReq ? '✓' : '+'}</button>
      </div>
      <a class="card-link" href="armory.html?item=${encodeURIComponent(item.id)}" aria-label="${esc(item.name)} — details"></a>
    </article>`;
  };

  /* ---------- requisition list ---------- */
  const REQ_KEY = 'aa-req';
  AA.req = {
    list() { return store.get(REQ_KEY, []).filter((l) => AA.items.has(l.id)); },
    has(id) { return this.list().some((l) => l.id === id); },
    save(list) { store.set(REQ_KEY, list); document.dispatchEvent(new CustomEvent('aa:req')); },
    add(id, qty = 1) {
      const list = this.list(); const l = list.find((x) => x.id === id);
      if (l) l.qty = Math.min(99, l.qty + qty); else list.push({ id, qty });
      this.save(list);
    },
    setQty(id, qty) { this.save(this.list().map((l) => (l.id === id ? { ...l, qty: Math.max(1, Math.min(99, qty)) } : l))); },
    remove(id) { this.save(this.list().filter((l) => l.id !== id)); },
    count() { return this.list().reduce((a, l) => a + l.qty, 0); },
    clear() { this.save([]); },
  };
  function reqCount() {
    $$('.req-count').forEach((el) => { const n = AA.req.count(); el.textContent = n; el.dataset.n = n; });
    $$('.icon-btn[data-add]').forEach((b) => {
      const on = AA.req.has(b.dataset.add);
      b.classList.toggle('added', on); b.textContent = on ? '✓' : '+';
    });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const item = AA.items.get(b.dataset.add);
    if (!item) return;
    if (AA.req.has(item.id)) { openDrawer(); return; }
    AA.req.add(item.id);
    AA.toast(`<b>+ LOGGED</b> · ${esc(item.name)} added to your requisition list.`);
  });

  function drawer() {
    const d = document.createElement('dialog');
    d.className = 'drawer'; d.id = 'reqDrawer'; d.setAttribute('aria-labelledby', 'reqTitle');
    d.innerHTML = `<div class="drawer-inner">
      <header>
        <button class="close-x" type="button" data-close aria-label="Close">×</button>
        <span class="eyebrow">Requisition manifest</span>
        <h2 id="reqTitle">Your pull list</h2>
        <p class="form-note" style="margin:10px 0 0">A reservation request, not a sale. We confirm availability and the final price, then hold it for you. Firearms are completed in person with ATF Form 4473 and a background check.</p>
      </header>
      <div class="lines" id="reqLines"></div>
      <footer>
        <div class="total-row"><span>Estimated total</span><b id="reqTotal">$0</b></div>
        <form class="form" id="reqForm">
          <div class="row">
            <div class="field"><label for="rqName">Name</label><input id="rqName" name="name" autocomplete="name" required></div>
            <div class="field"><label for="rqContact">Phone or email</label><input id="rqContact" name="contact" autocomplete="email" required></div>
          </div>
          <div class="field"><label for="rqNote">Note (optional)</label><input id="rqNote" name="note" placeholder="Pickup day, questions, trade-ins…"></div>
          <button class="btn btn-ice arrow" type="submit">Transmit requisition</button>
        </form>
      </footer>
    </div>`;
    document.body.appendChild(d);
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
      const q = e.target.closest('[data-q]');
      if (q) { const [id, delta] = q.dataset.q.split('|'); const l = AA.req.list().find((x) => x.id === id); if (l) AA.req.setQty(id, l.qty + +delta); }
      const rm = e.target.closest('[data-rm]');
      if (rm) AA.req.remove(rm.dataset.rm);
    });
    $('#reqForm', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      const list = AA.req.list();
      if (!list.length) { AA.toast('Your list is empty — add something from the Armory first.'); return; }
      const f = new FormData(e.target);
      const lines = list.map((l) => { const it = AA.items.get(l.id); return `${l.qty} × ${it.name}${it.price != null ? ' — ' + AA.money(it.price) : ''}`; });
      const payload = { type: 'requisition', name: f.get('name'), contact: f.get('contact'), note: f.get('note'), items: lines, page: location.href };
      const ok = await AA.send(payload, `Requisition from ${f.get('name')}`,
        `Name: ${payload.name}\nContact: ${payload.contact}\n\nItems:\n${lines.join('\n')}\n\nNote: ${payload.note || '—'}`);
      if (ok) { AA.req.clear(); e.target.reset(); d.close(); }
    });
    document.addEventListener('aa:req', renderDrawer);
    renderDrawer();
  }
  function renderDrawer() {
    const box = $('#reqLines'); if (!box) return;
    const list = AA.req.list();
    if (!list.length) {
      box.innerHTML = '<p class="empty">Nothing logged yet.<br><br><a href="armory.html">Enter the Armory →</a></p>';
    } else {
      box.innerHTML = list.map((l) => {
        const it = AA.items.get(l.id);
        return `<div class="line">
          <div><h3>${esc(it.name)}</h3><div class="meta">${esc(it.brand || '')}${it.firearm ? ' · FFL transfer in store' : ''}</div></div>
          <div class="lp">${it.price != null ? esc(AA.money(it.price * l.qty)) : 'Call'}</div>
          <div class="qty" role="group" aria-label="Quantity"><button type="button" data-q="${esc(it.id)}|-1" aria-label="Fewer">−</button><span>${l.qty}</span><button type="button" data-q="${esc(it.id)}|1" aria-label="More">+</button></div>
          <button class="rm" type="button" data-rm="${esc(it.id)}">Remove</button>
        </div>`;
      }).join('');
    }
    const total = list.reduce((a, l) => { const it = AA.items.get(l.id); return a + (it.price || 0) * l.qty; }, 0);
    const t = $('#reqTotal'); if (t) t.textContent = AA.money(total) || '$0';
  }
  function openDrawer() { const d = $('#reqDrawer'); if (d && !d.open) { renderDrawer(); d.showModal(); } }
  AA.openDrawer = openDrawer;

  /* Deliver a form: POST JSON to cfg.formEndpoint, else open the mail app. */
  AA.send = async function (payload, subject, body) {
    if (cfg.formEndpoint) {
      try {
        const r = await fetch(cfg.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error(r.status);
        AA.toast('<b>TRANSMISSION RECEIVED</b> · We’ll be in touch shortly.', 5000);
        return true;
      } catch {
        AA.toast('Transmission failed. Please call us instead.', 5000);
        return false;
      }
    }
    if (!cfg.email) { AA.toast('The store’s email isn’t set up yet (config.js → email).', 5000); return false; }
    location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    AA.toast('<b>OPENING MAIL</b> · Your message is ready to send.', 5000);
    return true;
  };

  /* ---------- the sky: stars + aurora ---------- */
  AA.sky = function (canvas, opts = {}) {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const buf = document.createElement('canvas');
    const bctx = buf.getContext('2d');
    const curtains = (opts.curtains || [
      { rgb: [93, 255, 177], y: 0.30, amp: 0.07, len: 0.34, speed: 0.00011, freq: 0.0062, phase: 0 },
      { rgb: [93, 228, 255], y: 0.20, amp: 0.05, len: 0.26, speed: -0.00008, freq: 0.0081, phase: 2.1 },
      { rgb: [169, 139, 255], y: 0.13, amp: 0.04, len: 0.22, speed: 0.00006, freq: 0.0049, phase: 4.2 },
    ]);
    const strips = curtains.map(({ rgb }) => {
      const c = document.createElement('canvas'); c.width = 1; c.height = 256;
      const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
      const [r, gg, b] = rgb;
      gr.addColorStop(0, `rgba(${r},${gg},${b},0)`);
      gr.addColorStop(0.55, `rgba(${r},${gg},${b},.22)`);
      gr.addColorStop(0.9, `rgba(${Math.min(255, r + 60)},${Math.min(255, gg + 30)},${Math.min(255, b + 30)},.85)`);
      gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 1, 256); return c;
    });
    let w = 0, h = 0, dpr = 1, stars = [], shoot = null, visible = true, last = 0, raf = 0;
    const DOWN = 3; // aurora buffer resolution divisor
    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      buf.width = Math.ceil(w / DOWN); buf.height = Math.ceil(h / DOWN);
      const n = Math.round((w * h) / (opts.density || 2300));
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      stars = Array.from({ length: n }, () => ({
        x: rnd() * w, y: Math.pow(rnd(), 1.35) * h * (opts.starFloor || 0.78),
        r: rnd() < 0.06 ? 1.3 + rnd() * 0.8 : 0.35 + rnd() * 0.75,
        a: 0.25 + rnd() * 0.75, s: 0.0006 + rnd() * 0.0025, p: rnd() * 6.28,
        c: rnd() < 0.1 ? '190,225,255' : rnd() < 0.04 ? '255,230,200' : '255,255,255',
      }));
    }
    function frame(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // stars
      for (const s of stars) {
        const a = s.a * (0.55 + 0.45 * Math.sin(t * s.s + s.p));
        ctx.fillStyle = `rgba(${s.c},${a.toFixed(3)})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      // the pole star
      if (opts.pole !== false) {
        const px = w * 0.5, py = h * 0.075, pa = 0.75 + 0.25 * Math.sin(t * 0.0012);
        const g = ctx.createRadialGradient(px, py, 0, px, py, 14);
        g.addColorStop(0, `rgba(235,250,255,${pa})`); g.addColorStop(1, 'rgba(93,228,255,0)');
        ctx.fillStyle = g; ctx.fillRect(px - 14, py - 14, 28, 28);
        ctx.fillStyle = `rgba(220,245,255,${0.5 * pa})`;
        ctx.fillRect(px - 9, py - 0.4, 18, 0.8); ctx.fillRect(px - 0.4, py - 9, 0.8, 18);
      }
      // aurora — drawn small into the buffer, upscaled (free blur), added
      const bw = buf.width, bh = buf.height;
      bctx.clearRect(0, 0, bw, bh);
      bctx.globalCompositeOperation = 'lighter';
      curtains.forEach((c, ci) => {
        for (let x = 0; x < bw; x += 1) {
          const X = x * DOWN;
          const yb = bh * (c.y + c.amp * Math.sin(X * c.freq * 0.35 + t * c.speed * 6 + c.phase) + c.amp * 0.45 * Math.sin(X * c.freq * 0.9 - t * c.speed * 9));
          let k = 0.5 + 0.5 * Math.sin(X * 0.011 + t * 0.00035 + c.phase) * Math.sin(X * 0.0031 - t * 0.00021 + ci);
          k = Math.max(0, k); k = k * k;
          const len = bh * c.len * (0.55 + 0.45 * k);
          bctx.globalAlpha = Math.min(1, k * (opts.intensity || 0.9));
          bctx.drawImage(strips[ci], x, yb - len * 0.85, 1.4, len);
        }
      });
      bctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buf, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      // shooting star
      if (!shoot && Math.random() < 0.0025) shoot = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.3, vx: 6 + Math.random() * 4, vy: 2 + Math.random() * 2, life: 1 };
      if (shoot) {
        const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 12, shoot.y - shoot.vy * 12);
        g.addColorStop(0, `rgba(255,255,255,${shoot.life})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 12, shoot.y - shoot.vy * 12); ctx.stroke();
        shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.life -= 0.02;
        if (shoot.life <= 0) shoot = null;
      }
    }
    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      if (t - last < 33) return; // ~30 fps is plenty for the sky
      last = t; frame(t);
    }
    resize();
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); frame(performance.now()); }, 120); });
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
    frame(performance.now());
    if (!reduced) raf = requestAnimationFrame(loop);
    return { stop() { cancelAnimationFrame(raf); } };
  };

  /* ---------- the visitor ---------- */
  function ufo() {
    const u = $('.ufo'); const hero = u && u.closest('.hero');
    if (!u || !hero || reduced) { if (u) u.style.display = 'none'; return; }
    let sightings = store.get('aa-ufo', 0);
    /* the craft registry — a different visitor each pass */
    const CRAFT = [
      { name: 'Disc', record: 'over the Antarctic coast, Operation Highjump, February 1947', svg: u.innerHTML },
      { name: 'Tic Tac', record: 'USS Nimitz carrier strike group, November 2004', svg: `
        <defs><linearGradient id="ttHull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#a9d9ef"/></linearGradient>
        <radialGradient id="ttAura"><stop offset="0" stop-color="#bff6ff" stop-opacity=".55"/><stop offset="1" stop-color="#5de4ff" stop-opacity="0"/></radialGradient></defs>
        <ellipse cx="80" cy="56" rx="70" ry="30" fill="url(#ttAura)"/>
        <rect x="40" y="45" width="80" height="22" rx="11" fill="url(#ttHull)"/>
        <path d="M50 52h60" stroke="#ffffff" stroke-opacity=".9" stroke-width="2" stroke-linecap="round"/>` },
      { name: 'Black triangle', record: 'the Phoenix Lights, Arizona, March 1997', svg: `
        <defs><linearGradient id="btBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d6" stop-opacity=".5"/><stop offset="1" stop-color="#fff3d6" stop-opacity="0"/></linearGradient></defs>
        <path class="beam" d="M72 62h16l30 88H42z" fill="url(#btBeam)"/>
        <path d="M80 26L138 70H22z" fill="#070b12" stroke="#4a5d74" stroke-width="1.2"/>
        <path d="M80 34L126 66H34z" fill="none" stroke="#1c2a3a"/>
        <g fill="#fff3d6"><circle cx="80" cy="32" r="3.6"/><circle cx="30" cy="66" r="3.6"/><circle cx="130" cy="66" r="3.6"/></g>
        <circle cx="80" cy="56" r="3.4" fill="#ff5f73"/>` },
      { name: 'Foo fighter', record: 'reported by Allied night-fighter crews, 1944', svg: `
        <defs><radialGradient id="ffOrb"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#ffe2a8"/><stop offset=".65" stop-color="#ff9d4a" stop-opacity=".45"/><stop offset="1" stop-color="#ff9d4a" stop-opacity="0"/></radialGradient></defs>
        <circle cx="80" cy="56" r="34" fill="url(#ffOrb)"/><circle cx="80" cy="56" r="7" fill="#ffffff"/>` },
    ];
    let craft = CRAFT[0], pass = 0;
    u.addEventListener('click', () => {
      sightings++; store.set('aa-ufo', sightings);
      AA.toast(`<b>CONTACT LOGGED</b> · ${craft.name}, ${craft.record}. Sighting #${sightings} on this device.`, 5200);
      u.classList.add('beaming'); setTimeout(() => u.classList.remove('beaming'), 1500);
    });
    const fly = () => {
      craft = CRAFT[pass++ % CRAFT.length];
      u.innerHTML = craft.svg;
      u.setAttribute('aria-label', `Unidentified craft: ${craft.name}`);
      const W = hero.clientWidth, H = hero.clientHeight;
      const uw = u.getBoundingClientRect().width || 150;
      const y0 = H * (0.12 + Math.random() * 0.16);
      const hover = Math.random() < 0.55;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const xs = dir > 0 ? -uw - 40 : W + 40, xe = dir > 0 ? W + 40 : -uw - 40;
      const xm = W * 0.5 - uw / 2, ym = H * 0.38;
      const D = 7000 + Math.random() * 3000;
      const t0 = performance.now();
      const step = (t) => {
        if (document.hidden) { requestAnimationFrame(step); return; }
        const k = (t - t0) / D;
        let x, y, tilt = Math.sin(t / 380) * 4 * dir;
        if (!hover) { x = xs + (xe - xs) * k; y = y0 + Math.sin(t / 600) * 10; }
        else if (k < 0.38) { const q = k / 0.38, e = 1 - Math.pow(1 - q, 3); x = xs + (xm - xs) * e; y = y0 + (ym - y0) * e; }
        else if (k < 0.66) { x = xm + Math.sin(t / 520) * 6; y = ym + Math.sin(t / 340) * 4; tilt = Math.sin(t / 500) * 2; u.classList.add('beaming'); }
        else { u.classList.remove('beaming'); const q = (k - 0.66) / 0.34, e = q * q * q; x = xm + (xe - xm) * e; y = ym - (ym + 160) * e * 0.9; tilt = 12 * dir; }
        u.style.transform = `translate(${x}px, ${y}px) rotate(${tilt}deg)`;
        if (k < 1) requestAnimationFrame(step);
        else { u.classList.remove('beaming'); setTimeout(fly, 9000 + Math.random() * 14000); }
      };
      requestAnimationFrame(step);
    };
    const start = () => setTimeout(fly, 2600);
    if ($('#gate') && !$('#gate').hidden) document.addEventListener('aa:gate-open', start, { once: true }); else start();
  }

  /* ---------- reveal on scroll ---------- */
  function reveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window) || reduced) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((e) => io.observe(e));
  }

  /* ---------- Agartha transmissions: the client's art videos ----------
   * Play only while on screen and the tab is visible. A video with `loop`
   * runs on; one without plays once and rests on its last frame (Replay runs
   * it again). Reduced motion starts them held, the static piece on its
   * resting frame (data-still). Hold / Play lets anyone stop the motion. */
  function transmissions() {
    $$('video[data-art]').forEach((v) => {
      v.muted = true;                       // iOS needs the property, not only the attribute
      const frame = v.closest('[data-art-frame]');
      const btn = frame && $('[data-art-hold]', frame);
      const state = frame && $('[data-art-state]', frame);
      let held = reduced, done = false, onScreen = !('IntersectionObserver' in window);
      if (reduced && !v.loop && v.dataset.still) v.poster = v.dataset.still;
      const sync = () => {
        if (!held && !done && onScreen && !document.hidden) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
        if (frame) { frame.classList.toggle('held', held && !done); frame.classList.toggle('still', done); }
        if (state) state.textContent = done ? 'Still' : held ? 'Held' : 'Live';
        if (btn) {
          btn.textContent = done ? 'Replay' : held ? 'Play' : 'Hold';
          btn.setAttribute('aria-label', done ? 'Replay the animation' : held ? 'Play the animation' : 'Pause the animation');
        }
      };
      v.addEventListener('ended', () => { done = true; sync(); });
      if (btn) btn.addEventListener('click', () => {
        if (done) { done = false; held = false; v.currentTime = 0; } else held = !held;
        sync();
      });
      if (!onScreen) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }, { rootMargin: '160px 0px' }).observe(v);
      document.addEventListener('visibilitychange', sync);
      sync();
    });
  }

  /* ---------- structured data: only once the real facts are filled in ---------- */
  function jsonLd() {
    const a = cfg.address || {};
    if (!a.street || !a.city) return;
    const days = { Mon: 'Mo', Tue: 'Tu', Wed: 'We', Thu: 'Th', Fri: 'Fr', Sat: 'Sa', Sun: 'Su' };
    const hours = (cfg.hours || []).filter(([, h]) => h && /\d/.test(h)).map(([d, h]) => {
      const m = String(h).match(/(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*[–-]\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i);
      if (!m) return null;
      const t = (v, ap) => { let [hh, mm = '00'] = v.split(':'); hh = +hh; if (/pm/i.test(ap || '') && hh < 12) hh += 12; if (/am/i.test(ap || '') && hh === 12) hh = 0; return `${String(hh).padStart(2, '0')}:${mm}`; };
      return `${days[d] || d} ${t(m[1], m[2])}-${t(m[3], m[4])}`;
    }).filter(Boolean);
    const data = {
      '@context': 'https://schema.org', '@type': 'SportingGoodsStore', name: cfg.name, url: 'https://' + (cfg.domain || location.host) + '/',
      telephone: cfg.phone || undefined, email: cfg.email || undefined,
      address: { '@type': 'PostalAddress', streetAddress: a.street, addressLocality: a.city, addressRegion: a.state || undefined, postalCode: a.zip || undefined, addressCountry: 'US' },
      geo: cfg.geo ? { '@type': 'GeoCoordinates', latitude: cfg.geo.lat, longitude: cfg.geo.lon } : undefined,
      openingHours: hours.length ? hours : undefined,
      sameAs: Object.values(cfg.social || {}).filter(Boolean),
    };
    const el = document.createElement('script'); el.type = 'application/ld+json'; el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
  }

  /* ---------- boot ---------- */
  function boot() {
    fillConfig();
    jsonLd();
    gate();
    header();
    clocks();
    drawer();
    reqCount();
    document.addEventListener('aa:req', reqCount);
    $$('[data-open-req]').forEach((b) => b.addEventListener('click', openDrawer));
    $$('canvas[data-sky]').forEach((c) => AA.sky(c, c.dataset.sky === 'lite' ? { intensity: 0.7, density: 3200, pole: false } : {}));
    ufo();
    transmissions();
    reveal();
    document.dispatchEvent(new CustomEvent('aa:ready'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
