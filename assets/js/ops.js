/* =============================================================================
 * ops.js — the Agarthan Armory Ops Console (ops.html).
 *
 * Ported from the PAMAX and XAT consoles, cut to what an FFL store needs:
 *   Deck           counts, setup checklist, what needs attention
 *   Inventory      every product: search, filters, price / featured / photo /
 *                  hidden, a full editor with photo uploads; edits are STAGED
 *                  here, then published
 *   Your listings  used / consignment / one-off products the feed never carries
 *   Photos & gaps  cards without a photo, pulled photos, data-gap worklists
 *   Corrections    everything overrides.json changes, hidden products included
 *   Store          store facts (hours, phone, fees…) and site notices
 *   Spotlight      home-page slides (photo or YouTube), with a preview
 *   Search         what people search for, dead ends, synonyms, pins
 *   Inbox          requisitions (hold requests) and messages from the site
 *   Traffic        page views and searches that found nothing
 *   Orders         WooCommerce orders, detail, firearm release, sales chart
 *   History        every publish: what, who, when
 *   Tools          site check, test email, CSV diff, export / import, backup
 *   Guide          how to do each common job
 *
 * Publishing sends every staged change (and the photos picked for it) to the
 * server in one request; the server commits overrides.json, site-settings.json,
 * custom-products.json and the photos to the repo as one commit, Render
 * redeploys, and the boot build applies them (scripts/boot.mjs).
 * Everything shown is escaped; the page runs under a strict CSP (no inline code).
 * ===========================================================================*/
(function () {
  'use strict';

  /* ---------------------------------------------------------------- helpers */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (n == null || n === '' || isNaN(n) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const num = (n) => Number(n || 0).toLocaleString('en-US');
  const today = () => new Date().toISOString().slice(0, 10);
  const ago = (iso) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 90) return 'just now'; if (s < 5400) return `${Math.round(s / 60)} min ago`;
    if (s < 129600) return `${Math.round(s / 3600)} h ago`; return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } },
    set(k, v) { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* */ } },
  };
  const download = (name, text, type = 'application/json') => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  // spreadsheet-safe CSV: quotes, and no cell that Excel would run as a formula
  const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');
  let toastT;
  const toast = (msg, bad) => { const t = $('#toast'); t.textContent = msg; t.className = 'ops-toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, bad ? 7000 : 4000); };

  const DEPTS = { sidearms: 'Sidearms', longarms: 'Longarms', shotguns: 'Shotguns', ammo: 'Ammunition', optics: 'Optics & Tech', gear: 'Expedition Gear', nfa: 'NFA & Suppressors' };
  const TYPES = ['pistol', 'revolver', 'ar', 'bolt', 'lever', 'rimfire', 'battle', 'shotgun', 'semishotgun', 'ammo', 'shells', 'reddot', 'scope', 'thermal', 'light', 'mag', 'case', 'kit', 'safe', 'can'];
  const STATUS = { in: 'In stock', low: 'Few left', ship: 'Ships', out: 'Out' };
  const BOOLS = ['featured', 'hide', 'noPhoto'];
  const holo = (type) => ((window.AA_ICONS || {})[type] || (window.AA_ICONS || {}).case || '');
  const thumb = (it) => {
    const e = it ? eff(it) : null;
    const img = e && !e.noPhoto && e.images && e.images[0];
    return img ? `<div class="ops-thumb"><img src="${esc(imgSrc(img))}" alt="" loading="lazy" decoding="async"></div>`
      : `<div class="ops-thumb holo" aria-hidden="true">${holo(e && (e.type || it.type))}</div>`;
  };

  /* ------------------------------------------------------------ state + api */
  const S = { token: ss.get('aa-ops-token'), status: null, preview: false };
  const D = {
    items: [], byId: new Map(), overrides: {}, settings: {}, head: null, source: '',
    stage: ls.get('aa-ops-stage', { products: {}, settings: {} }),
    inv: { q: '', dept: '', status: '', photo: '', flag: '', brand: '', sort: '', dir: 1, page: 1, per: 50, sel: new Set() },
    inbox: null, inboxSel: null, inboxFilter: 'open', traffic: null, deploy: null,
  };
  if (!D.stage || typeof D.stage !== 'object') D.stage = { products: {}, settings: {} };
  D.stage.products = D.stage.products || {}; D.stage.settings = D.stage.settings || {};
  D.stage.custom = D.stage.custom || { upsert: {}, remove: [] };
  D.custom = [];
  // photos picked in this browser, waiting for Publish: path → { b64, ext } (kept for the session)
  const UP = new Map(Object.entries((() => { try { return JSON.parse(sessionStorage.getItem('aa-ops-uploads') || '{}'); } catch { return {}; } })()));
  const saveUploads = () => { try { sessionStorage.setItem('aa-ops-uploads', JSON.stringify(Object.fromEntries(UP))); } catch { toast('This browser could not keep the photos for the session — publish before closing the tab.', true); } };
  const imgSrc = (path) => (UP.has(path) ? `data:image/${UP.get(path).ext === 'jpg' ? 'jpeg' : UP.get(path).ext};base64,${UP.get(path).b64}` : path);

  async function api(path, opts = {}) {
    const r = await fetch(path, {
      method: opts.method || 'GET',
      headers: { ...(S.token ? { Authorization: `Bearer ${S.token}` } : {}), ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
    let data = null;
    try { data = await r.json(); } catch { /* empty */ }
    if (r.status === 401 && S.token && path !== '/api/ops/unlock') { lock('Your session ended — unlock again.'); }
    if (!r.ok) { const e = new Error((data && data.error) || `The server answered ${r.status}`); e.status = r.status; e.setup = data && data.setup; throw e; }
    return data;
  }
  const saveStage = () => { ls.set('aa-ops-stage', D.stage); publishBar(); };
  const customStaged = () => Object.keys(D.stage.custom.upsert).length + D.stage.custom.remove.length;
  /** photos the staged edits use that are not uploaded yet */
  const stagedImagePaths = () => {
    const set = new Set();
    for (const st of Object.values(D.stage.products)) for (const p of (st && st.images) || []) set.add(p);
    for (const c of Object.values(D.stage.custom.upsert)) for (const p of c.images || []) set.add(p);
    const sp = D.stage.settings.spotlight; if (sp) for (const x of sp.slides || []) if (x.image) set.add(x.image);
    return [...set].filter((p) => UP.has(p));
  };
  /** staged photos that point at an upload this browser no longer holds (picked in another tab) */
  const missingUploads = () => {
    const set = new Set();
    for (const st of Object.values(D.stage.products)) for (const p of (st && st.images) || []) set.add(p);
    for (const c of Object.values(D.stage.custom.upsert)) for (const p of c.images || []) set.add(p);
    const sp = D.stage.settings.spotlight; if (sp) for (const x of sp.slides || []) if (x.image) set.add(x.image);
    if (!set.size) return [];
    const live = new Set();
    const add = (l) => { for (const p of l || []) live.add(p); };
    for (const it of D.items) add(it.images);
    for (const o of Object.values(D.overrides)) add(o.images);
    for (const c of D.custom) add(c.images);
    for (const x of ((D.settings.spotlight || {}).slides || [])) if (x.image) live.add(x.image);
    return [...set].filter((p) => /\/u-[a-z0-9-]+-[0-9a-f]{8}\.(webp|jpe?g|png)$/.test(p) && !UP.has(p) && !live.has(p));
  };
  /** published listings into the console's item list (the catalogue only has them after the rebuild) */
  function syncCustomItems() {
    const ids = new Set(D.custom.map((c) => c.id));
    D.items = D.items.filter((i) => !i.custom || ids.has(i.id));
    const at = new Map(D.items.map((i, n) => [i.id, n]));
    for (const c of D.custom) {
      const it = { ...c, custom: true, ln: c.id };
      if (at.has(c.id)) D.items[at.get(c.id)] = { ...D.items[at.get(c.id)], ...it };
      else D.items.unshift(it);
    }
    D.byId = new Map(D.items.map((i) => [i.id, i]));
  }
  const SETTING_LABEL = { facts: 'Store facts', notices: 'Notices', synonyms: 'Search synonyms', pins: 'Search pins', spotlight: 'Spotlight' };
  function clearStage() {
    D.stage = { products: {}, settings: {}, custom: { upsert: {}, remove: [] } };
    UP.clear(); try { sessionStorage.removeItem('aa-ops-uploads'); } catch { /* private mode */ }
    saveStage();
  }

  /* ------------------------------------------- what a product looks like now */
  function staged(id) { return Object.prototype.hasOwnProperty.call(D.stage.products, id) ? D.stage.products[id] : undefined; }
  /** the product as it will be after publishing: built values, then staged edits */
  function eff(it) {
    if (it.custom && D.stage.custom.upsert[it.id]) return { ...it, ...D.stage.custom.upsert[it.id], custom: true };
    const o = D.overrides[it.id] || {};
    const st = staged(it.id);
    const out = { ...it, noPhoto: !!o.noPhoto, hide: !!o.hide };
    if (st === null) { out.featured = false; out.noPhoto = false; return out; }
    if (st) for (const [k, v] of Object.entries(st)) {
      if (v === null) continue;
      out[k] = v;
    }
    return out;
  }
  /** stage one field; a value equal to what is already published is no change */
  function stageField(id, field, value) {
    if (value === '' || value === undefined) value = null;
    const base = (D.overrides[id] || {})[field];
    const cur = staged(id) === null ? {} : { ...(staged(id) || {}) };
    const same = BOOLS.includes(field) ? !!value === !!base : JSON.stringify(value ?? null) === JSON.stringify(base ?? null);
    if (same) delete cur[field];
    else cur[field] = BOOLS.includes(field) ? !!value : value;
    if (Object.keys(cur).length) D.stage.products[id] = cur; else delete D.stage.products[id];
  }
  function pendingCount() {
    const p = Object.keys(D.stage.products).length;
    const s = Object.keys(D.stage.settings).length;
    const c = customStaged();
    return { p, s, c, total: p + s + c };
  }
  function publishBar() {
    const { p, s, total } = pendingCount();
    $('#publishBar').hidden = !total;
    const parts = [];
    if (p) parts.push(`${num(p)} product${p === 1 ? '' : 's'}`);
    const c = customStaged(); if (c) parts.push(`${num(c)} listing${c === 1 ? '' : 's'}`);
    const ph = stagedImagePaths().length; if (ph) parts.push(`${num(ph)} new photo${ph === 1 ? '' : 's'}`);
    if (s) parts.push(Object.keys(D.stage.settings).map((k) => (SETTING_LABEL[k] || k).toLowerCase()).join(' + '));
    $('#pendingText').textContent = total ? `Staged, not live yet: ${parts.join(' · ')}` : '';
  }

  /* ================================================================ THE GATE */
  async function gate() {
    try { S.status = await api('/api/ops/status'); } catch { S.status = null; }
    const msg = $('#gateMsg'), fine = $('#gateFine');
    if (!S.status) {
      msg.textContent = 'No console server here — this host only serves the site\'s files.';
      $('#gateForm').hidden = true; $('#gatePreview').hidden = false;
      fine.textContent = 'Preview mode browses the catalogue and stages edits on this computer; export them from Tools.';
    } else if (!S.status.live) {
      msg.textContent = 'The console is not switched on yet.';
      $('#gateForm').hidden = true; $('#gatePreview').hidden = false;
      fine.textContent = 'To switch it on: Render → this service → Environment → add OPS_PASSWORD (8+ characters), then redeploy.';
    }
    if (S.token && S.status && S.status.live) { try { await api('/api/ops/deploy'); return enter(false); } catch { S.token = ''; ss.set('aa-ops-token', ''); } }
    $('#gate').hidden = false; $('#shell').hidden = true;
    if (!$('#gateForm').hidden) $('#gateKey').focus();
  }
  $('#gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#gateMsg');
    msg.className = 'ops-gate-msg'; msg.textContent = 'Checking…';
    try {
      const r = await api('/api/ops/unlock', { method: 'POST', body: { key: $('#gateKey').value } });
      S.token = r.token; ss.set('aa-ops-token', r.token);
      $('#gateKey').value = '';
      enter(false);
    } catch (err) {
      msg.className = 'ops-gate-msg bad';
      msg.textContent = err.message + (err.status === 401 && /left/.test(err.message) ? '' : '');
    }
  });
  $('#gatePreview').addEventListener('click', () => enter(true));
  function lock(why) {
    S.token = ''; ss.set('aa-ops-token', '');
    $('#shell').hidden = true; $('#gate').hidden = false;
    $('#gateForm').hidden = !(S.status && S.status.live);
    $('#gateMsg').className = 'ops-gate-msg' + (why ? ' bad' : ''); $('#gateMsg').textContent = why || 'Locked.';
  }
  $('#lockBtn').addEventListener('click', () => lock(''));

  /* ============================================================== ENTERING */
  function loadCatalog() {
    if (window.AA_CATALOG) return Promise.resolve(window.AA_CATALOG);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'assets/data/catalog.js';
      s.onload = () => resolve(window.AA_CATALOG || { items: [] });
      s.onerror = () => reject(new Error('the catalog did not load'));
      document.head.appendChild(s);
    });
  }
  async function enter(preview) {
    S.preview = preview;
    $('#gate').hidden = true; $('#shell').hidden = false;
    $('#view').innerHTML = '<div class="ops-empty">Loading the catalogue…</div>';
    try {
      const cat = await loadCatalog();
      D.items = cat.items || []; D.byId = new Map(D.items.map((i) => [i.id, i]));
      D.catalogUpdated = cat.updated;
    } catch (e) { toast(e.message, true); }
    if (!preview) {
      try { S.status = await api('/api/ops/status'); } catch { /* keep the gate's answer */ }
      try {
        const r = await api('/api/ops/settings');
        D.overrides = r.overrides || {}; D.settings = r.settings || {}; D.head = r.head; D.source = r.source; D.custom = Array.isArray(r.custom) ? r.custom : [];
        syncCustomItems();
      } catch (e) { toast(`Could not read the current corrections: ${e.message}`, true); }
      refreshDeploy();
    }
    statusChips(); publishBar(); route();
  }

  function statusChips() {
    const st = S.status || {};
    const chip = (ok, label, title, warn) => `<span class="ops-chip ${ok ? 'ok' : warn ? 'warn' : 'bad'}" title="${esc(title || '')}">${esc(label)}</span>`;
    $('#modeChip').className = 'ops-chip ' + (S.preview ? 'warn' : 'ok');
    $('#modeChip').textContent = S.preview ? 'Preview — not saved' : 'Live console';
    if (S.preview) { $('#statusChips').innerHTML = chip(false, 'Preview mode', 'Nothing is saved to the site', true); return; }
    const dep = D.deploy;
    $('#statusChips').innerHTML = [
      chip(st.github, st.github ? 'Publishing on' : 'Publishing off', st.github ? `Commits to ${st.repo}@${st.branch}` : 'Set GH_TOKEN on Render'),
      chip(st.disk, st.disk ? 'Inbox + traffic on' : 'No disk', st.disk ? 'Data kept on the Render disk' : (st.diskWhy || 'Attach a disk, set DATA_DIR'), true),
      chip(st.woo, st.woo ? 'Woo orders on' : 'Woo off', st.woo ? 'Read-only WooCommerce key set' : 'Set WOO_URL, WOO_CK, WOO_CS', true),
      dep && dep.pending ? chip(false, 'Deploy in progress', 'A published change is still being deployed', true) : '',
    ].join('');
  }
  async function refreshDeploy() {
    if (S.preview) return;
    try { D.deploy = await api('/api/ops/deploy'); } catch { D.deploy = null; }
    statusChips();
  }

  /* ================================================================ ROUTER */
  const TABS = {
    deck: ['Outpost command', 'Deck', renderDeck],
    inventory: ['Every product on the site', 'Inventory', renderInventory],
    listings: ['Used, consignment, one-offs', 'Your listings', renderListings],
    photos: ['What shoppers see first', 'Photos & gaps', renderPhotos],
    corrections: ['overrides.json', 'Corrections', renderCorrections],
    store: ['Facts and the notice bar', 'Store & notices', renderStore],
    spotlight: ['The home page slides', 'Spotlight', renderSpotlight],
    search: ['What people look for', 'Search', renderSearch],
    inbox: ['Requisitions and messages', 'Inbox', renderInbox],
    traffic: ['Visitors', 'Traffic', renderTraffic],
    orders: ['WooCommerce, read only', 'Orders', renderOrders],
    history: ['Every published change', 'History', renderHistory],
    tools: ['Checks, diff, export, backup', 'Tools', renderTools],
    guide: ['How to', 'Guide', renderGuide],
  };
  function route() {
    if ($('#shell').hidden) return;
    const tab = TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'deck';
    $$('#tabs a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
    const [eyebrow, title, fn] = TABS[tab];
    $('#tabEyebrow').textContent = eyebrow; $('#tabTitle').textContent = title;
    D.tab = tab;
    fn($('#view'));
  }
  window.addEventListener('hashchange', route);

  const setupPanel = (what, why, steps) => `<section class="ops-panel hud brackets"><h3>${esc(what)} <small>not set up</small></h3>
    <p class="ops-note">${esc(why)}</p><ol class="ops-steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol></section>`;

  /* ================================================================== DECK */
  function counts() {
    const c = { total: D.items.length, in: 0, low: 0, ship: 0, out: 0, photo: 0, featured: 0, priceless: 0 };
    for (const it of D.items) { c[it.status] = (c[it.status] || 0) + 1; const e = eff(it); if (it.images && it.images.length && !e.noPhoto) c.photo++; if (e.featured) c.featured++; if (it.price == null) c.priceless++; }
    return c;
  }
  function coverGaps() {
    if (!window.AA || !AA.order || !D.items.length) return [];
    if (D._cover && D._cover.n === D.items.length) return D._cover.gaps;
    const ids = AA.order.coverIds(D.items.map((i) => ({ ...i }))).ids;
    const gaps = ids.map((id) => D.byId.get(id)).filter((it) => it && !(it.images && it.images.length));
    D._cover = { n: D.items.length, gaps, cards: ids.length };
    return gaps;
  }
  function renderDeck(v) {
    const c = counts();
    const ov = Object.keys(D.overrides).filter((k) => k !== '_readme');
    const hidden = ov.filter((k) => D.overrides[k].hide).length;
    const gaps = coverGaps();
    const st = S.status || {};
    const tile = (label, value, sub, cls = '', tab = '') => `<${tab ? `button type="button" data-go="${tab}"` : 'div'} class="ops-tile hud ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(sub)}</small></${tab ? 'button' : 'div'}>`;
    v.innerHTML = `
      <div class="ops-tiles">
        ${tile('Products on the site', num(c.total), `catalogue of ${D.catalogUpdated || '—'}`, '', 'inventory')}
        ${tile('On the shelf', num(c.in + c.low), `${num(c.low)} with few left`, 'good', 'inventory')}
        ${tile('Ships from the distributor', num(c.ship), 'ready to order', '', 'inventory')}
        ${tile('Out of stock', num(c.out), 'still listed', c.out ? 'warn' : '', 'inventory')}
        ${tile('With a photo', `${Math.round((100 * c.photo) / Math.max(1, c.total))}%`, `${num(c.photo)} products`, '', 'photos')}
        ${tile('First-page gaps', num(gaps.length), 'first-page cards without a photo', gaps.length ? 'warn' : 'good', 'photos')}
        ${tile('Featured on the home page', num(c.featured), 'hand-picked', '', 'inventory')}
        ${tile('Corrections', num(ov.length), `${num(hidden)} hidden from the site`, '', 'corrections')}
      </div>
      <div class="ops-cols">
        <section class="ops-panel hud brackets"><h3>Setup</h3><ol class="ops-steps">
          <li class="${st.live ? 'done' : ''}">Console switched on<small><code>OPS_PASSWORD</code> on the Render service</small></li>
          <li class="${st.github ? 'done' : ''}">Publishing to the site<small><code>GH_TOKEN</code>: a fine-grained GitHub token for this repository only, Contents: Read and write</small></li>
          <li class="${st.disk ? 'done' : ''}">Inbox and traffic<small>A 1 GB Render disk mounted at <code>/var/data</code> and <code>DATA_DIR=/var/data</code></small></li>
          <li class="${st.mail ? 'done' : ''}">Email alerts for new messages<small><code>RESEND_API_KEY</code> (resend.com), <code>ALERT_EMAIL</code> (where alerts go), <code>MAIL_FROM</code> once the domain is verified</small></li>
          <li class="${st.woo ? 'done' : ''}">WooCommerce orders (optional)<small><code>WOO_URL</code>, <code>WOO_CK</code>, <code>WOO_CS</code> — a read-only REST key</small></li>
        </ol>${S.preview ? '<p class="ops-note">Preview mode: edits stay on this computer (Tools → Export).</p>' : ''}</section>
        <section class="ops-panel hud brackets"><h3>Publishing</h3><div id="deckDeploy"><p class="ops-note">Checking…</p></div></section>
        <section class="ops-panel hud brackets"><h3>Latest messages <small><a href="#inbox">open the inbox</a></small></h3><div id="deckInbox"><p class="ops-note">${st.disk ? 'Loading…' : 'The inbox needs a disk — see Setup.'}</p></div></section>
        <section class="ops-panel hud brackets"><h3>Searches that found nothing <small><a href="#traffic">traffic</a></small></h3><div id="deckSearch"><p class="ops-note">${st.disk ? 'Loading…' : 'Needs the disk too.'}</p></div></section>
      </div>`;
    $$('[data-go]', v).forEach((b) => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
    deckDeploy();
    if (st.disk && !S.preview) {
      loadInbox().then(() => {
        const list = (D.inbox || []).slice(0, 4);
        $('#deckInbox').innerHTML = list.length ? `<ul class="ops-list">${list.map((m) => `<li><span><b>${esc(m.name)}</b> · ${esc(m.kind)} · ${esc(ago(m.at))}</span><span class="ops-pill ${esc(m.status)}">${esc(m.status)}</span></li>`).join('')}</ul>` : '<p class="ops-note">No messages yet.</p>';
      }).catch((e) => { $('#deckInbox').innerHTML = `<p class="ops-note">${esc(e.message)}</p>`; });
      loadTraffic().then(() => {
        const s = Object.entries((D.traffic || {}).searches || {}).filter(([, e]) => !(e.found > 0)).sort((a, b) => (b[1].zero || b[1].n) - (a[1].zero || a[1].n)).slice(0, 6);
        $('#deckSearch').innerHTML = s.length ? `<ul class="ops-list">${s.map(([q, e]) => `<li><span>${esc(q)}</span><b>${num(e.n)}×</b></li>`).join('')}</ul>` : '<p class="ops-note">None yet.</p>';
      }).catch((e) => { $('#deckSearch').innerHTML = `<p class="ops-note">${esc(e.message)}</p>`; });
    }
  }
  async function deckDeploy() {
    const el = $('#deckDeploy'); if (!el) return;
    if (S.preview) { el.innerHTML = '<p class="ops-note">Not connected in preview mode.</p>'; return; }
    await refreshDeploy();
    const d = D.deploy || {};
    const short = (s) => (s ? s.slice(0, 7) : '—');
    el.innerHTML = `<p class="ops-note">Live on the site: <b>${esc(short(d.deployed))}</b>${d.head ? ` · repository: <b>${esc(short(d.head))}</b>` : ''}</p>
      <p class="ops-note">${d.pending ? 'A newer commit is deploying — Render usually takes 2–4 minutes.' : 'The site is up to date with the repository.'}</p>
      <p class="ops-note">Catalogue built: <b>${esc(D.catalogUpdated || '—')}</b> · ${num(D.items.length)} products</p>`;
  }

  /* ============================================================= INVENTORY */
  function brandList() {
    if (D._brands && D._brands.n === D.items.length) return D._brands.list;
    const c = new Map(); for (const i of D.items) if (i.brand) c.set(i.brand, (c.get(i.brand) || 0) + 1);
    D._brands = { n: D.items.length, list: [...c.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b) };
    return D._brands.list;
  }
  function invRows() {
    const f = D.inv;
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    let rows = D.items.filter((it) => {
      if (f.dept && it.dept !== f.dept) return false;
      if (f.status && it.status !== f.status) return false;
      const e = eff(it);
      if (f.brand && String(e.brand || '').toLowerCase() !== f.brand.toLowerCase()) return false;
      if (f.flag === 'nobrand' && e.brand) return false;
      if (f.flag === 'featuredout' && !(e.featured && it.status === 'out')) return false;
      if (f.flag === 'custom' && !it.custom) return false;
      if (f.photo === 'with' && !(e.images && e.images.length && !e.noPhoto)) return false;
      if (f.photo === 'without' && e.images && e.images.length && !e.noPhoto) return false;
      if (f.photo === 'pulled' && !e.noPhoto) return false;
      if (f.flag === 'featured' && !e.featured) return false;
      if (f.flag === 'staged' && staged(it.id) === undefined) return false;
      if (f.flag === 'corrected' && !D.overrides[it.id]) return false;
      if (f.flag === 'priceless' && it.price != null) return false;
      if (words.length) {
        const hay = `${e.name} ${e.brand || ''} ${it.sku || ''} ${it.id} ${e.sub || ''} ${e.kw || e.keywords || ''}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    if (f.sort) {
      const key = { name: (i) => String(eff(i).name).toLowerCase(), price: (i) => (eff(i).price ?? Infinity), dept: (i) => `${i.dept}|${i.sub || ''}`, status: (i) => ['in', 'low', 'ship', 'out'].indexOf(i.status) }[f.sort];
      rows = rows.slice().sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * f.dir; });
    }
    return rows;
  }
  function renderInventory(v) {
    const f = D.inv;
    v.innerHTML = `
      <div class="ops-bar">
        <input type="search" id="invQ" placeholder="Search name, brand, SKU or id" value="${esc(f.q)}" aria-label="Search products">
        <select id="invDept" aria-label="Department"><option value="">All departments</option>${Object.entries(DEPTS).map(([k, n]) => `<option value="${k}" ${f.dept === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <select id="invStatus" aria-label="Stock"><option value="">Any stock</option>${Object.entries(STATUS).map(([k, n]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <select id="invPhoto" aria-label="Photo"><option value="">Any photo</option><option value="with" ${f.photo === 'with' ? 'selected' : ''}>With a photo</option><option value="without" ${f.photo === 'without' ? 'selected' : ''}>Hologram (no photo)</option><option value="pulled" ${f.photo === 'pulled' ? 'selected' : ''}>Photo pulled</option></select>
        <select id="invFlag" aria-label="Show"><option value="">Everything</option><option value="featured" ${f.flag === 'featured' ? 'selected' : ''}>Featured</option><option value="corrected" ${f.flag === 'corrected' ? 'selected' : ''}>Has corrections</option><option value="staged" ${f.flag === 'staged' ? 'selected' : ''}>Staged edits</option><option value="priceless" ${f.flag === 'priceless' ? 'selected' : ''}>No price</option><option value="nobrand" ${f.flag === 'nobrand' ? 'selected' : ''}>No brand</option><option value="featuredout" ${f.flag === 'featuredout' ? 'selected' : ''}>Featured but out of stock</option><option value="custom" ${f.flag === 'custom' ? 'selected' : ''}>Your listings</option></select>
        <input type="text" id="invBrand" list="invBrands" placeholder="Brand" value="${esc(f.brand)}" aria-label="Brand"><datalist id="invBrands">${brandList().map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
        <button class="btn btn-ghost btn-sm" type="button" id="invCsv">Export view (CSV)</button>
      </div>
      <div id="invBulk"></div>
      <div class="ops-tablewrap"><table class="ops-table" id="invTable"></table></div>
      <div class="ops-pager" id="invPager"></div>`;
    $('#invTable').addEventListener('change', onInvChange);
    $('#invTable').addEventListener('click', onInvClick);
    let t;
    $('#invQ').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; f.page = 1; invTable(); }, 160); });
    for (const [id, key] of [['invDept', 'dept'], ['invStatus', 'status'], ['invPhoto', 'photo'], ['invFlag', 'flag'], ['invBrand', 'brand']]) $('#' + id).addEventListener('change', (e) => { f[key] = e.target.value.trim(); f.page = 1; invTable(); });
    $('#invCsv').addEventListener('click', () => {
      const rows = invRows();
      download(`agarthan-products-${today()}.csv`, csv([['id', 'name', 'brand', 'department', 'category', 'price', 'stock', 'photo', 'featured', 'sku'],
        ...rows.map((i) => { const e = eff(i); return [i.id, e.name, e.brand, DEPTS[i.dept] || i.dept, i.sub, e.price, STATUS[i.status] || i.status, i.images && i.images.length && !e.noPhoto ? 'yes' : 'no', e.featured ? 'yes' : '', i.sku]; })]), 'text/csv');
    });
    invTable();
  }
  function invTable() {
    const f = D.inv;
    const rows = invRows();
    const pages = Math.max(1, Math.ceil(rows.length / f.per));
    f.page = Math.min(f.page, pages);
    const slice = rows.slice((f.page - 1) * f.per, f.page * f.per);
    const sortBtn = (k, label) => `<button type="button" data-sort="${k}" ${f.sort === k ? `aria-sort="${f.dir > 0 ? 'ascending' : 'descending'}"` : ''}>${label}</button>`;
    const allOn = slice.length && slice.every((i) => f.sel.has(i.id));
    $('#invTable').innerHTML = `<thead><tr>
        <th><input type="checkbox" class="ops-check" id="invAll" aria-label="Select this page" ${allOn ? 'checked' : ''}></th><th></th>
        <th>${sortBtn('name', 'Product')}</th><th>${sortBtn('dept', 'Department')}</th><th>${sortBtn('price', 'Price')}</th><th>${sortBtn('status', 'Stock')}</th><th>Featured · photo · hidden</th></tr></thead>
      <tbody>${slice.map((it) => {
        const e = eff(it);
        const st = staged(it.id);
        return `<tr data-id="${esc(it.id)}" class="${st !== undefined ? 'staged' : ''}">
          <td><input type="checkbox" class="ops-check" data-sel ${f.sel.has(it.id) ? 'checked' : ''} aria-label="Select ${esc(e.name)}"></td>
          <td>${thumb(it)}</td>
          <td><div class="ops-name"><button type="button" data-edit>${e.cond ? `<span class="cond-badge">${esc(e.cond)}</span> ` : ''}${esc(e.name)}</button><small>${it.custom ? 'your listing · ' : ''}${esc(e.brand || '')}${it.sku ? ' · ' + esc(it.sku) : ''}</small></div></td>
          <td><small class="ops-meta">${esc(DEPTS[e.dept] || e.dept)}</small><br><span>${esc(e.sub || '')}</span></td>
          <td><input class="ops-price ${st && st.price !== undefined ? 'changed' : ''}" data-price inputmode="decimal" value="${e.price != null ? esc(e.price) : ''}" placeholder="call" aria-label="Price of ${esc(e.name)}"></td>
          <td><span class="ops-st ${esc(it.status)}">${esc(STATUS[it.status] || it.status)}</span></td>
          <td><div class="ops-flags">
            <button type="button" class="ops-flag" data-flag="featured" aria-pressed="${!!e.featured}" title="Featured on the home page">★</button>
            <button type="button" class="ops-flag amber" data-flag="noPhoto" aria-pressed="${!!e.noPhoto}" title="Photo pulled (shows the hologram)" ${it.images && it.images.length || e.noPhoto ? '' : 'disabled'}>◫</button>
            <button type="button" class="ops-flag danger" data-flag="hide" aria-pressed="${!!e.hide}" title="Hidden from the site">⊘</button>
          </div></td></tr>`;
      }).join('') || '<tr><td colspan="7"><div class="ops-empty">Nothing matches.</div></td></tr>'}</tbody>`;
    const tb = $('#invTable');
    $$('[data-sort]', tb).forEach((b) => b.addEventListener('click', () => { const k = b.dataset.sort; f.dir = f.sort === k ? -f.dir : 1; f.sort = k; invTable(); }));
    $('#invAll', tb).addEventListener('change', (e) => { slice.forEach((i) => (e.target.checked ? f.sel.add(i.id) : f.sel.delete(i.id))); invTable(); });
    $('#invPager').innerHTML = `<span class="ops-meta"><b>${num(rows.length)}</b> products · page ${f.page} of ${num(pages)}</span>
      <span><button class="pg" type="button" data-pg="${f.page - 1}" ${f.page <= 1 ? 'disabled' : ''}>←</button>
      <button class="pg" type="button" aria-current="page">${f.page}</button>
      <button class="pg" type="button" data-pg="${f.page + 1}" ${f.page >= pages ? 'disabled' : ''}>→</button></span>`;
    $$('[data-pg]', $('#invPager')).forEach((b) => b.addEventListener('click', () => { f.page = +b.dataset.pg; invTable(); $('#invTable').scrollIntoView({ block: 'start' }); }));
    invBulk();
  }
  function onInvChange(e) {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const id = tr.dataset.id;
    if (e.target.matches('[data-sel]')) { e.target.checked ? D.inv.sel.add(id) : D.inv.sel.delete(id); invBulk(); return; }
    if (e.target.matches('[data-price]')) {
      const raw = e.target.value.trim().replace(/[$,]/g, '');
      const it = D.byId.get(id);
      if (raw === '') { stageField(id, 'price', null); }
      else {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0 || n > 1e6) { toast('A price is a number, like 649.99', true); e.target.value = eff(it).price ?? ''; return; }
        if (n === it.price && (D.overrides[id] || {}).price === undefined) stageField(id, 'price', null);
        else stageField(id, 'price', Math.round(n * 100) / 100);
      }
      priceWarn();
      saveStage(); invTable();
    }
  }
  function onInvClick(e) {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const id = tr.dataset.id;
    const flag = e.target.closest('[data-flag]');
    if (flag) {
      const k = flag.dataset.flag;
      const it = D.byId.get(id);
      const on = !eff(it)[k];
      stageField(id, k, on);
      const was = D.overrides[id] || {};
      if (k === 'noPhoto' && on && !was.noPhoto) stageField(id, '_photo', `pulled ${today()} from the Ops Console (${eff(it).name})`);
      if (k === 'hide' && on && !was.hide) stageField(id, '_name', eff(it).name);
      saveStage(); invTable();
      return;
    }
    if (e.target.closest('[data-edit]')) { const it = D.byId.get(id); if (it && it.custom) openListing(id); else openEditor(id); }
  }
  let warned = false;
  function priceWarn() { if (!warned) { warned = true; toast('Price edits change what THIS site shows. The checkout price is set in the shop (Gearfire / WooCommerce).'); } }
  function invBulk() {
    const sel = D.inv.sel;
    const el = $('#invBulk'); if (!el) return;
    if (!sel.size) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="ops-bulk"><span class="ops-meta"><b>${num(sel.size)}</b> selected</span>
      <button class="btn btn-ghost btn-sm" type="button" data-bulk="feature">Feature</button>
      <button class="btn btn-ghost btn-sm" type="button" data-bulk="unfeature">Unfeature</button>
      <button class="btn btn-ghost btn-sm" type="button" data-bulk="pull">Pull photos</button>
      <button class="btn btn-ghost btn-sm" type="button" data-bulk="restore">Restore photos</button>
      <button class="btn btn-ghost btn-sm" type="button" data-bulk="hide">Hide</button>
      <button class="btn btn-ghost btn-sm" type="button" data-bulk="clear">Clear selection</button></div>`;
    $$('[data-bulk]', el).forEach((b) => b.addEventListener('click', () => { bulk([...sel], b.dataset.bulk); }));
  }
  function bulk(ids, action) {
    if (action === 'clear') { D.inv.sel.clear(); invTable(); return; }
    let n = 0;
    for (const id of ids) {
      const it = D.byId.get(id); if (!it) continue;
      n++;
      if (action === 'feature') stageField(id, 'featured', true);
      if (action === 'unfeature') stageField(id, 'featured', false);
      const was = D.overrides[id] || {};
      if (action === 'pull') { stageField(id, 'noPhoto', true); if (!was.noPhoto) stageField(id, '_photo', `pulled ${today()} from the Ops Console (${eff(it).name})`); }
      if (action === 'restore') stageField(id, 'noPhoto', false);
      if (action === 'hide') { stageField(id, 'hide', true); if (!was.hide) stageField(id, '_name', eff(it).name); }
    }
    saveStage();
    toast(`Staged for ${num(n)} product${n === 1 ? '' : 's'} — publish when ready.`);
    if (D.tab === 'inventory') invTable(); else route();
    return n;
  }

  /* ------------------------------------------------------------ photos */
  const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i += 7) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
  const slugId = (id) => String(id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'p';
  /** a picked file → resized (longest side 1200px) WebP (JPEG where the browser can't), base64 */
  async function toWebp(file) {
    if (!/^image\//.test(file.type)) throw new Error(`${file.name} is not an image`);
    if (file.size > 25e6) throw new Error(`${file.name} is over 25 MB`);
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.86)); let ext = 'webp';
    if (!blob || blob.type !== 'image/webp') { blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88)); ext = 'jpg'; }
    for (let q = 0.78; blob.size > 1_400_000 && q > 0.4; q -= 0.12) blob = await new Promise((r) => c.toBlob(r, ext === 'webp' ? 'image/webp' : 'image/jpeg', q));
    const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
    return { b64, ext };
  }
  /** files → paths of staged uploads (assets/img/<folder>/<name>-<hash>.<ext>) */
  async function addUploads(files, name, folder = 'products') {
    const out = [];
    for (const f of [...files].slice(0, 6)) {
      try {
        const { b64, ext } = await toWebp(f);
        const path = `assets/img/${folder}/u-${slugId(name)}-${fnv(b64)}.${ext}`;
        UP.set(path, { b64, ext }); out.push(path);
      } catch (e) { toast(e.message, true); }
    }
    saveUploads();
    return out;
  }
  /** a YouTube link or id → the 11-character id ('' when it isn't one) */
  const ytId = (v) => { const t = String(v || '').trim(); if (!t) return ''; if (/^[\w-]{11}$/.test(t)) return t; const m = t.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : null; };
  /** the photo strip in an editor: reorder, remove, upload */
  function photoStrip(host, list, name, onChange) {
    const draw = () => {
      host.innerHTML = `<div class="ops-photos">${list.map((pth, i) => `<div class="ops-ph"><img src="${esc(imgSrc(pth))}" alt="Photo ${i + 1}"><span class="ops-ph-act">
        <button type="button" data-ph="left" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Move left">‹</button><button type="button" data-ph="del" data-i="${i}" aria-label="Remove">×</button><button type="button" data-ph="right" data-i="${i}" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Move right">›</button></span>${i ? '' : '<b>Cover</b>'}</div>`).join('') || '<p class="ops-note">No photo — the hologram shows.</p>'}</div>
        <label class="btn btn-ghost btn-sm ops-upload">Upload photos<input type="file" accept="image/*" multiple hidden></label>`;
      host.querySelector('input[type=file]').addEventListener('change', async (e) => {
        const add = await addUploads(e.target.files, name);
        list.push(...add); list.splice(6); draw(); onChange(list);
      });
    };
    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ph]'); if (!b) return;
      const i = +b.dataset.i;
      if (b.dataset.ph === 'del') list.splice(i, 1);
      if (b.dataset.ph === 'left' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
      if (b.dataset.ph === 'right' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
      draw(); onChange(list);
    });
    draw();
  }

  /* ------------------------------------------------------------ the editor */
  async function openEditor(id) {
    const it = D.byId.get(id);
    const o = D.overrides[id] || {};
    const st = staged(id) || {};
    const val = (k) => (st[k] !== undefined ? st[k] : o[k]);
    const dlg = $('#drawer');
    const tri = (k) => { const x = val(k); return x === true ? 'yes' : x === false ? 'no' : ''; };
    const specs = { ...(val('specs') || {}) };
    dlg.innerHTML = `
      <div class="ops-dhead"><div><span class="eyebrow">${esc(DEPTS[it ? it.dept : ''] || 'Product')}</span><h3 id="drawerTitle">${esc(it ? eff(it).name : id)}</h3><small class="ops-meta">${esc(id)}</small></div><button class="ops-x" type="button" data-close aria-label="Close">×</button></div>
      <form class="ops-dbody" id="edForm">
        <div class="ops-preview">${thumb(it)}<div><div class="ops-meta">On the site now</div><div><b>${esc(it ? it.name : '')}</b></div><div class="ops-meta">${esc(it && it.brand)} · ${esc(money(it && it.price))} · ${esc(STATUS[it && it.status] || '')}</div></div></div>
        <p class="ops-note">Blank fields keep what the store's feed says (shown greyed). Anything you type here overrides the feed, survives every new scrape, and goes live when you publish.</p>
        <div class="ops-form">
          <label class="ops-f" data-k="name"><span>Name</span><input class="ops-input" name="name" maxlength="200" value="${esc(val('name') || '')}" placeholder="${esc(it && it.name)}"></label>
          <div class="ops-row2">
            <label class="ops-f" data-k="brand"><span>Brand</span><input class="ops-input" name="brand" maxlength="80" value="${esc(val('brand') || '')}" placeholder="${esc(it && it.brand)}"></label>
            <label class="ops-f" data-k="price"><span>Price <em>(this site only)</em></span><input class="ops-input" name="price" inputmode="decimal" value="${val('price') != null ? esc(val('price')) : ''}" placeholder="${esc(it && it.price != null ? it.price : 'call for price')}"></label>
          </div>
          <div class="ops-row2">
            <label class="ops-f" data-k="priceNote"><span>Price note</span><input class="ops-input" name="priceNote" maxlength="60" value="${esc(val('priceNote') || '')}" placeholder="e.g. Call for price · In-store only"></label>
            <label class="ops-f" data-k="lore"><span>Lore line</span><input class="ops-input" name="lore" maxlength="200" value="${esc(val('lore') || '')}" placeholder="one line of flavor text"></label>
          </div>
          <div class="ops-row3">
            <label class="ops-f" data-k="cond"><span>Condition</span><select class="ops-select" name="cond"><option value="">— new / not shown</option>${['Used', 'Consignment', 'Demo'].map((c) => `<option ${val('cond') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
            <label class="ops-f" data-k="keywords"><span>Search terms <em>(extra words that find it)</em></span><input class="ops-input" name="keywords" maxlength="200" value="${esc(val('keywords') || '')}" placeholder="g19 duty police trade-in"></label>
            <label class="ops-f" data-k="video"><span>YouTube video</span><input class="ops-input" name="video" maxlength="120" value="${esc(val('video') || '')}" placeholder="https://youtu.be/…"></label>
          </div>
          <div class="ops-f" data-k="images"><span>Photos <em>(the first is the cover; uploads go live when you publish)</em></span><div id="edPhotos"></div></div>
          <div class="ops-row3">
            <label class="ops-f" data-k="dept"><span>Department</span><select class="ops-select" name="dept"><option value="">— as the feed says (${esc(DEPTS[it && it.dept] || '')})</option>${Object.entries(DEPTS).map(([k, n]) => `<option value="${k}" ${val('dept') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
            <label class="ops-f" data-k="sub"><span>Category</span><input class="ops-input" name="sub" maxlength="80" value="${esc(val('sub') || '')}" placeholder="${esc(it && it.sub)}"></label>
            <label class="ops-f" data-k="type"><span>Hologram</span><select class="ops-select" name="type"><option value="">— automatic (${esc(it && it.type)})</option>${TYPES.map((t) => `<option ${val('type') === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          </div>
          <div class="ops-row2">
            <label class="ops-f" data-k="firearm"><span>Firearm (4473 at pickup)</span><select class="ops-select" name="firearm"><option value="">— automatic (${it && it.firearm ? 'yes' : 'no'})</option><option value="yes" ${tri('firearm') === 'yes' ? 'selected' : ''}>Yes</option><option value="no" ${tri('firearm') === 'no' ? 'selected' : ''}>No</option></select></label>
            <label class="ops-f" data-k="nfa"><span>NFA item</span><select class="ops-select" name="nfa"><option value="">— automatic (${it && it.nfa ? 'yes' : 'no'})</option><option value="yes" ${tri('nfa') === 'yes' ? 'selected' : ''}>Yes</option><option value="no" ${tri('nfa') === 'no' ? 'selected' : ''}>No</option></select></label>
          </div>
          <div class="ops-toggles">
            <label><input type="checkbox" class="ops-check" name="featured" ${val('featured') ? 'checked' : ''}> Featured on the home page</label>
            <label><input type="checkbox" class="ops-check" name="noPhoto" ${val('noPhoto') ? 'checked' : ''}> Pull its photo <small class="ops-meta">(also from products sharing it)</small></label>
            <label><input type="checkbox" class="ops-check" name="hide" ${val('hide') ? 'checked' : ''}> Hide from the site</label>
          </div>
          <div class="ops-f" data-k="specs"><span>Spec rows <em>(added to / replacing the feed's)</em></span><div class="ops-specs" id="edSpecs"></div><button class="ops-link" type="button" id="edAddSpec">+ add a row</button></div>
          <label class="ops-f" data-k="desc"><span>Description <em>(plain text)</em></span><textarea class="ops-textarea" name="desc" maxlength="6000" rows="7" placeholder="Loading the current description…"></textarea></label>
        </div>
      </form>
      <div class="ops-dfoot"><button class="btn btn-ghost btn-sm" type="button" id="edClear" ${D.overrides[id] || st ? '' : 'disabled'}>Clear every correction</button>
        <span><button class="btn btn-ghost btn-sm" type="button" data-close>Cancel</button> <button class="btn btn-ice btn-sm" type="button" id="edSave">Stage changes</button></span></div>`;
    const startPhotos = (val('images') || (it && it.images) || []).slice();
    const photos = startPhotos.slice();
    photoStrip($('#edPhotos', dlg), photos, id, () => {});
    const specRows = $('#edSpecs', dlg);
    const addSpec = (k = '', v = '') => {
      const r = document.createElement('div'); r.className = 'r';
      r.innerHTML = `<input class="ops-input" data-sk placeholder="caliber" maxlength="40" value="${esc(k)}" aria-label="Spec name"><input class="ops-input" data-sv placeholder="9mm Luger" maxlength="120" value="${esc(v)}" aria-label="Spec value"><button class="ops-flag" type="button" aria-label="Remove row">×</button>`;
      r.querySelector('button').addEventListener('click', () => r.remove());
      specRows.appendChild(r);
    };
    Object.entries(specs).forEach(([k, v]) => addSpec(k, v));
    $('#edAddSpec', dlg).addEventListener('click', () => addSpec());
    // the current description lives in the product's detail file
    const ta = $('textarea[name="desc"]', dlg);
    let descStart = null;                                   // what the box held when it loaded
    fetch(`assets/data/items/${encodeURIComponent(id)}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => {
      const currentDesc = (d && d.desc) || '';
      ta.placeholder = currentDesc ? '' : 'No description in the feed';
      ta.value = val('desc') != null ? val('desc') : currentDesc;
      descStart = ta.value.trim();
    });
    $('#edClear', dlg).addEventListener('click', () => {
      if (D.overrides[id]) D.stage.products[id] = null; else delete D.stage.products[id];
      saveStage(); dlg.close(); toast('Every correction for this product is staged for removal.'); if (D.tab === 'inventory') invTable(); else route();
    });
    $('#edSave', dlg).addEventListener('click', () => {
      const fd = new FormData($('#edForm', dlg));
      const text = (k) => String(fd.get(k) || '').trim();
      try {
        for (const k of ['name', 'brand', 'priceNote', 'lore', 'sub', 'dept', 'type', 'cond', 'keywords']) stageField(id, k, text(k) || null);
        const vid = ytId(text('video'));
        if (vid === null) throw new Error('That is not a YouTube link');
        stageField(id, 'video', vid || null);
        if (JSON.stringify(photos) !== JSON.stringify(startPhotos)) {
          if (photos.length) { stageField(id, 'images', photos.slice()); stageField(id, 'noPhoto', false); }
          else { stageField(id, 'images', null); if ((it && it.images && it.images.length) || (D.overrides[id] || {}).images) { stageField(id, 'noPhoto', true); stageField(id, '_photo', `removed ${today()} in the Ops Console (${it ? it.name : id})`); } }
        }
        const pr = text('price').replace(/[$,]/g, '');
        if (pr) { const n = Number(pr); if (!Number.isFinite(n) || n < 0 || n > 1e6) throw new Error('A price is a number, like 649.99'); stageField(id, 'price', Math.round(n * 100) / 100); priceWarn(); } else stageField(id, 'price', null);
        for (const k of ['firearm', 'nfa']) { const x = text(k); stageField(id, k, x === 'yes' ? true : x === 'no' ? false : null); }
        for (const k of BOOLS) if (!(k === 'noPhoto' && JSON.stringify(photos) !== JSON.stringify(startPhotos))) stageField(id, k, fd.get(k) === 'on');
        if (fd.get('noPhoto') === 'on') stageField(id, '_photo', (D.overrides[id] || {})._photo || `pulled ${today()} from the Ops Console (${it ? it.name : id})`);
        if (fd.get('hide') === 'on') stageField(id, '_name', it ? it.name : id);
        const sp = {};
        $$('.r', specRows).forEach((r) => { const k = r.querySelector('[data-sk]').value.trim(); const v2 = r.querySelector('[data-sv]').value.trim(); if (k && v2) { if (!/^[a-zA-Z][\w -]*$/.test(k)) throw new Error(`"${k}" is not a usable spec name`); sp[k] = v2; } });
        stageField(id, 'specs', Object.keys(sp).length ? sp : null);
        const desc = ta.value.trim();
        if (descStart !== null && desc !== descStart) stageField(id, 'desc', desc || null);   // emptied = back to the feed's text
      } catch (err) { toast(err.message, true); return; }
      saveStage(); dlg.close();
      toast(staged(id) !== undefined ? 'Staged — publish when ready.' : 'No changes.');
      if (D.tab === 'inventory') invTable(); else route();
    });
    dlg.showModal();
  }

  /* ================================================================ PHOTOS */
  function renderPhotos(v) {
    const c = counts();
    const gaps = coverGaps();
    const pulled = Object.entries(D.overrides).filter(([k, o]) => k !== '_readme' && o && o.noPhoto);
    v.innerHTML = `
      <div class="ops-tiles">
        <div class="ops-tile hud"><span>With a photo</span><b>${num(c.photo)}</b><small>of ${num(c.total)} products</small></div>
        <div class="ops-tile hud ${gaps.length ? 'warn' : 'good'}"><span>First-page gaps</span><b>${num(gaps.length)}</b><small>of ${num((D._cover || {}).cards || 0)} first-page cards</small></div>
        <div class="ops-tile hud"><span>Photos pulled</span><b>${num(pulled.length)}</b><small>showing the hologram</small></div>
      </div>
      <section class="ops-panel hud brackets"><h3>Data gaps <small>what makes a listing weaker</small></h3>
        <div class="ops-tiles">${[
          ['No photo (hologram)', D.items.filter((i) => !(eff(i).images || []).length || eff(i).noPhoto).length, { photo: 'without' }],
          ['No price', D.items.filter((i) => eff(i).price == null).length, { flag: 'priceless' }],
          ['No brand', D.items.filter((i) => !eff(i).brand).length, { flag: 'nobrand' }],
          ['Featured but out of stock', D.items.filter((i) => eff(i).featured && i.status === 'out').length, { flag: 'featuredout' }],
        ].map(([l, n, f]) => `<button type="button" class="ops-tile hud ${n ? 'warn' : 'good'}" data-gap='${esc(JSON.stringify(f))}'><span>${esc(l)}</span><b>${num(n)}</b><small>show them in Inventory</small></button>`).join('')}</div>
      </section>
      <section class="ops-panel hud brackets"><h3>First-page cards without a photo <small>${num(gaps.length)}</small></h3>
        <p class="ops-note">These are the cards on the first page of a department or category that still show a hologram. On your PC run <b>node scripts/find-images.mjs --cover</b> (Brave key set) to fetch them, then push.</p>
        ${gaps.length ? `<div class="ops-tablewrap"><table class="ops-table"><thead><tr><th></th><th>Product</th><th>Department</th><th></th></tr></thead><tbody>${gaps.slice(0, 200).map((it) => `<tr data-id="${esc(it.id)}"><td>${thumb(it)}</td><td><div class="ops-name"><button type="button" data-edit>${esc(it.name)}</button><small>${esc(it.brand || '')}</small></div></td><td>${esc(DEPTS[it.dept])} · ${esc(it.sub || '')}</td><td><button class="ops-link" type="button" data-edit>Edit</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="ops-note">Every first-page card has a photo.</p>'}
      </section>
      <section class="ops-panel hud brackets"><h3>Pulled photos <small>${num(pulled.length)}</small></h3>
        <p class="ops-note">Photos taken off the site (cut off, wrong item, another dealer's mark…). Restoring puts the photo back on every product that shares it.</p>
        <div class="ops-bar"><input type="search" id="pullQ" placeholder="Filter by name or reason" aria-label="Filter pulled photos"></div>
        <ul class="ops-list" id="pullList"></ul>
      </section>`;
    $$('[data-edit]', v).forEach((b) => b.addEventListener('click', () => openEditor(b.closest('[data-id]').dataset.id)));
    $$('[data-gap]', v).forEach((b) => b.addEventListener('click', () => { Object.assign(D.inv, { q: '', dept: '', status: '', photo: '', flag: '', brand: '', page: 1 }, JSON.parse(b.dataset.gap)); location.hash = 'inventory'; }));
    const draw = () => {
      const q = ($('#pullQ').value || '').toLowerCase();
      const rows = pulled.filter(([id, o]) => !q || `${o._photo || ''} ${(D.byId.get(id) || {}).name || ''}`.toLowerCase().includes(q));
      $('#pullList').innerHTML = rows.slice(0, 300).map(([id, o]) => {
        const st = staged(id); const restoring = st && st.noPhoto === false;
        const it = D.byId.get(id);
        return `<li data-id="${esc(id)}"><span title="${esc(o._photo || '')}">${esc(it ? it.name : id)} <small class="ops-meta">· ${esc((o._photo || '').replace(/\s*\(.*\)\s*$/, ''))}</small></span>
          <span class="act">${restoring ? '<span class="ops-pill holding">restore staged</span>' : ''}<button class="ops-link" type="button" data-restore>${restoring ? 'Undo' : 'Restore'}</button></span></li>`;
      }).join('') || '<li><span>None.</span></li>';
      $$('[data-restore]', $('#pullList')).forEach((b) => b.addEventListener('click', () => {
        const id = b.closest('[data-id]').dataset.id;
        const st = staged(id);
        if (st && st.noPhoto === false) stageField(id, 'noPhoto', true); else stageField(id, 'noPhoto', false);
        saveStage(); draw();
      }));
    };
    $('#pullQ').addEventListener('input', draw);
    draw();
  }

  /* =========================================================== CORRECTIONS */
  const describe = (o) => {
    const bits = [];
    if (!o) return ['every correction removed'];
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith('_')) continue;
      if (k === 'featured') bits.push(v ? 'featured' : 'not featured');
      else if (k === 'hide') bits.push(v ? 'hidden' : 'shown');
      else if (k === 'noPhoto') bits.push(v ? 'photo pulled' : 'photo restored');
      else if (k === 'price') bits.push(v == null ? 'store price' : `price ${money(v)}`);
      else if (k === 'specs') bits.push(v ? `${Object.keys(v).length} spec rows` : 'feed specs');
      else if (k === 'desc') bits.push(v ? 'description' : 'feed description');
      else if (typeof v === 'boolean') bits.push(`${k}: ${v ? 'yes' : 'no'}`);
      else bits.push(v == null ? `${k}: feed` : `${k}: ${String(v).slice(0, 40)}`);
    }
    return bits;
  };
  function renderCorrections(v) {
    const ids = [...new Set([...Object.keys(D.overrides).filter((k) => k !== '_readme'), ...Object.keys(D.stage.products)])];
    v.innerHTML = `<section class="ops-panel hud brackets"><h3>Corrections <small>${num(ids.length)} products</small></h3>
      <p class="ops-note">Everything the store changes on top of the scraped feed: names, prices, featured picks, pulled photos, hidden products. Hidden products are not in the catalogue, so this is where they come back.</p>
      <div class="ops-bar"><input type="search" id="corQ" placeholder="Filter" aria-label="Filter corrections">
        <select id="corKind" aria-label="Kind"><option value="">All</option><option value="hide">Hidden</option><option value="featured">Featured</option><option value="noPhoto">Photo pulled</option><option value="price">Price</option><option value="staged">Staged</option></select></div>
      <ul class="ops-list" id="corList"></ul></section>`;
    const draw = () => {
      const q = $('#corQ').value.toLowerCase(), kind = $('#corKind').value;
      const rows = ids.filter((id) => {
        const o = D.overrides[id] || {}, st = staged(id);
        const name = (D.byId.get(id) || {}).name || o._name || o._photo || id;
        if (q && !`${name} ${id}`.toLowerCase().includes(q)) return false;
        if (kind === 'staged') return st !== undefined;
        if (kind) return !!(o[kind] || (st && st[kind]));
        return true;
      });
      $('#corList').innerHTML = rows.slice(0, 400).map((id) => {
        const o = D.overrides[id] || {}, st = staged(id), it = D.byId.get(id);
        const name = it ? it.name : (o._name || (o._photo || '').replace(/^.*\((.*)\)\s*$/, '$1') || id);
        return `<li data-id="${esc(id)}"><span>${esc(name)} <small class="ops-meta">· ${esc(describe(o).join(' · ') || '—')}${st !== undefined ? ` → <b>${esc(describe(st).join(' · '))}</b>` : ''}</small></span>
          <span class="act">${it ? '<button class="ops-link" type="button" data-edit>Edit</button>' : ''}${o.hide && !(st && st.hide === false) ? '<button class="ops-link" type="button" data-unhide>Show again</button>' : ''}${st !== undefined ? '<button class="ops-link" type="button" data-unstage>Unstage</button>' : '<button class="ops-link" type="button" data-clearall>Clear</button>'}</span></li>`;
      }).join('') || '<li><span>None.</span></li>';
    };
    $('#corList').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]'); if (!li) return;
      const id = li.dataset.id;
      if (e.target.closest('[data-edit]')) return openEditor(id);
      if (e.target.closest('[data-unhide]')) stageField(id, 'hide', false);
      else if (e.target.closest('[data-unstage]')) delete D.stage.products[id];
      else if (e.target.closest('[data-clearall]')) D.stage.products[id] = null;
      else return;
      saveStage(); draw();
    });
    $('#corQ').addEventListener('input', draw); $('#corKind').addEventListener('change', draw);
    draw();
  }

  /* ========================================================= STORE SETTINGS */
  const baseFacts = () => ({ ...(window.AA_CONFIG || {}), ...((D.settings || {}).facts || {}) });
  const curFacts = () => ({ ...baseFacts(), ...(D.stage.settings.facts || {}) });
  const curList = (k) => (D.stage.settings[k] !== undefined ? D.stage.settings[k] : ((D.settings || {})[k] || (window.AA_CONFIG || {})[k] || []));
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const STARTER_SYNONYMS = [['ar15', 'ar-15', 'ar 15'], ['ar10', 'ar-10'], ['9mm', '9x19', '9mm luger'], ['.223', '223', '5.56', '556', '223 rem'], ['.308', '308', '7.62x51', '308 win'],
    ['7.62x39', '762x39'], ['.22lr', '22lr', '22 lr', '.22 lr'], ['12ga', '12 gauge', '12 ga'], ['20ga', '20 gauge'], ['g19', 'glock 19'], ['g17', 'glock 17'], ['g43x', 'glock 43x'],
    ['p365', 'sig p365'], ['nv', 'night vision', 'nvg'], ['suppressor', 'silencer', 'can'], ['sbr', 'short barreled rifle'], ['red dot', 'reflex sight'], ['mag', 'magazine'], ['lpvo', 'low power variable']];
  function renderStore(v) {
    const f = curFacts();
    const a = f.address || {}, ffl = f.ffl || {}, fees = f.fees || {}, soc = f.social || {}, nl = f.nfaLabels || {};
    const hours = DAYS.map((d) => ((f.hours || []).find((h) => h[0] === d) || [d, null])[1]);
    const inp = (name, value, ph = '', extra = '') => `<input class="ops-input" name="${name}" value="${esc(value == null ? '' : value)}" placeholder="${esc(ph)}" ${extra}>`;
    v.innerHTML = `
      <section class="ops-panel hud brackets"><h3>Store facts <small>shown across the site</small></h3>
        <p class="ops-note">These fill the footer, Visit section, transfer fees, age gate and search results. The WooCommerce theme keeps its own copy in its functions.php.</p>
        <form class="ops-form" id="factsForm">
          <div class="ops-row2"><label class="ops-f"><span>Store name</span>${inp('name', f.name)}</label><label class="ops-f"><span>Legal name</span>${inp('legalName', f.legalName)}</label></div>
          <div class="ops-row2"><label class="ops-f"><span>Phone</span>${inp('phone', f.phone, '(561) 830-3366')}</label><label class="ops-f"><span>Email</span>${inp('email', f.email, 'info@agarthanarmory.com', 'type="email"')}</label></div>
          <div class="ops-row2"><label class="ops-f"><span>Street</span>${inp('street', a.street)}</label><label class="ops-f"><span>City</span>${inp('city', a.city)}</label></div>
          <div class="ops-row2"><label class="ops-f"><span>State</span>${inp('state', a.state)}</label><label class="ops-f"><span>ZIP</span>${inp('zip', a.zip)}</label></div>
          <div class="ops-f"><span>Hours <em>(blank = closed)</em></span><div class="ops-hours">${DAYS.map((d, i) => `<label class="ops-f"><span>${d}</span>${inp('h_' + d, hours[i], 'Closed')}</label>`).join('')}</div></div>
          <div class="ops-row3"><label class="ops-f"><span>FFL number</span>${inp('fflNumber', ffl.number)}</label><label class="ops-f"><span>FFL type</span>${inp('fflType', ffl.type)}</label>
            <label class="ops-f"><span>Age gate</span><select class="ops-select" name="ageMin"><option value="21" ${f.ageMin !== 18 ? 'selected' : ''}>21+</option><option value="18" ${f.ageMin === 18 ? 'selected' : ''}>18+</option></select></label></div>
          <div class="ops-toggles"><label><input type="checkbox" class="ops-check" name="sot" ${ffl.sot ? 'checked' : ''}> Class 3 SOT (shows the NFA transfer fee)</label></div>
          <div class="ops-f"><span>Transfer fees <em>(USD; blank = "Call")</em></span><div class="ops-hours">${[['longGun', 'Long gun'], ['handgun', 'Handgun'], ['additional', 'Each additional'], ['privateParty', 'Private party'], ['nfa', 'NFA']].map(([k, l]) => `<label class="ops-f"><span>${l}</span>${inp('fee_' + k, fees[k], 'Call', 'inputmode="decimal"')}</label>`).join('')}</div></div>
          <div class="ops-f"><span>NFA label on product covers</span><div class="ops-toggles">${[['suppressor', 'Suppressors'], ['sbr', 'Short-barreled rifles'], ['sbs', 'Short-barreled shotguns']].map(([k, l]) => `<label><input type="checkbox" class="ops-check" name="nfa_${k}" ${nl[k] !== false ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
          <div class="ops-row2">${['instagram', 'facebook', 'x', 'youtube', 'tiktok'].map((k) => `<label class="ops-f"><span>${k}</span>${inp('soc_' + k, soc[k], 'https://…')}</label>`).join('')}</div>
          <div class="ops-row2"><label class="ops-f"><span>Form endpoint <em>(blank = this console's inbox)</em></span>${inp('formEndpoint', f.formEndpoint, 'https://…')}</label><label class="ops-f"><span>Online store URL</span>${inp('storeUrl', f.storeUrl, 'https://shop.agarthanarmory.com')}</label></div>
          <div><button class="btn btn-ice btn-sm" type="submit">Stage store facts</button></div>
        </form>
      </section>
      <section class="ops-panel hud brackets"><h3>Notices <small>a bar above the ticker on every page</small></h3>
        <p class="ops-note">Closures, delivery delays, new stock. Visitors can dismiss each one; dates are inclusive.</p>
        <div id="noticeRows" class="ops-form"></div>
        <div class="ops-bar"><button class="btn btn-ghost btn-sm" type="button" id="noticeAdd">+ Add a notice</button><button class="btn btn-ice btn-sm" type="button" id="noticeSave">Stage notices</button></div>
      </section>`;

    $('#factsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const t = (k) => String(fd.get(k) || '').trim();
      const feeV = (k) => { const x = t('fee_' + k).replace(/[$,]/g, ''); if (!x) return null; const n = Number(x); if (!Number.isFinite(n) || n < 0) throw new Error(`The ${k} fee must be a number`); return n; };
      const urlV = (k) => { const x = t(k); if (!x) return null; if (!/^https:\/\//.test(x)) throw new Error(`${k} must start with https://`); return x; };
      try {
        const next = {
          name: t('name'), legalName: t('legalName'), phone: t('phone'), email: t('email') || null,
          address: { street: t('street'), city: t('city'), state: t('state'), zip: t('zip') },
          hours: DAYS.map((d) => [d, t('h_' + d) || null]),
          ageMin: Number(fd.get('ageMin')) === 18 ? 18 : 21,
          ffl: { number: t('fflNumber'), type: t('fflType'), sot: fd.get('sot') === 'on' },
          fees: { longGun: feeV('longGun'), handgun: feeV('handgun'), additional: feeV('additional'), privateParty: feeV('privateParty'), nfa: feeV('nfa') },
          nfaLabels: { suppressor: fd.get('nfa_suppressor') === 'on', sbr: fd.get('nfa_sbr') === 'on', sbs: fd.get('nfa_sbs') === 'on' },
          social: Object.fromEntries(['instagram', 'facebook', 'x', 'youtube', 'tiktok'].map((k) => [k, urlV('soc_' + k)])),
          formEndpoint: urlV('formEndpoint'), storeUrl: urlV('storeUrl'),
        };
        if (!next.name) throw new Error('The store needs a name');
        const base = baseFacts();
        const changed = Object.keys(next).some((k) => JSON.stringify(next[k]) !== JSON.stringify(base[k] ?? (typeof next[k] === 'object' ? next[k] : null)));
        if (changed) D.stage.settings.facts = next; else delete D.stage.settings.facts;
        saveStage(); toast(changed ? 'Store facts staged — publish when ready.' : 'No changes to the store facts.');
      } catch (err) { toast(err.message, true); }
    });

    // notices
    let notices = curList('notices').map((n) => ({ ...n }));
    const nRows = $('#noticeRows');
    const drawN = () => {
      nRows.innerHTML = notices.map((n, i) => `<div class="ops-notice-row" data-i="${i}">
        <label class="ops-f"><span>Text</span><input class="ops-input" data-n="text" maxlength="160" value="${esc(n.text || '')}" placeholder="Closed Thanksgiving Day — open Friday 10 to 6"></label>
        <label class="ops-f"><span>Tone</span><select class="ops-select" data-n="tone">${['info', 'alert', 'aurora'].map((t) => `<option ${n.tone === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="ops-f"><span>Link <em>(optional: /armory?q=glock or https://…)</em></span><input class="ops-input" data-n="link" maxlength="300" value="${esc(n.link || '')}"></label>
        <div class="ops-row2"><label class="ops-f"><span>From</span><input class="ops-input" type="date" data-n="start" value="${esc(n.start || '')}"></label><label class="ops-f"><span>Until</span><input class="ops-input" type="date" data-n="end" value="${esc(n.end || '')}"></label></div>
        <div class="ops-toggles wide"><label><input type="checkbox" class="ops-check" data-n="on" ${n.on !== false ? 'checked' : ''}> Showing</label><button class="ops-link" type="button" data-nrm>Remove</button></div></div>`).join('') || '<p class="ops-note">No notices.</p>';
    };
    nRows.addEventListener('input', (e) => { const row = e.target.closest('[data-i]'); if (!row) return; const n = notices[+row.dataset.i]; const k = e.target.dataset.n; n[k] = k === 'on' ? e.target.checked : e.target.value; });
    nRows.addEventListener('change', (e) => { const row = e.target.closest('[data-i]'); if (!row) return; const n = notices[+row.dataset.i]; const k = e.target.dataset.n; if (k) n[k] = k === 'on' ? e.target.checked : e.target.value; });
    nRows.addEventListener('click', (e) => { if (e.target.closest('[data-nrm]')) { notices.splice(+e.target.closest('[data-i]').dataset.i, 1); drawN(); } });
    $('#noticeAdd').addEventListener('click', () => { if (notices.length >= 8) return toast('At most 8 notices.', true); notices.push({ id: 'n' + Date.now().toString(36), text: '', tone: 'info', on: true }); drawN(); });
    $('#noticeSave').addEventListener('click', () => {
      const clean = notices.filter((n) => (n.text || '').trim()).map((n) => ({ id: n.id || 'n' + Date.now().toString(36), text: n.text.trim(), tone: n.tone || 'info', on: n.on !== false, ...(n.link ? { link: n.link.trim() } : {}), ...(n.start ? { start: n.start } : {}), ...(n.end ? { end: n.end } : {}) }));
      if (clean.some((n) => n.link && !/^(\/(?!\/)|https:\/\/)/.test(n.link))) return toast('A notice link starts with / (a page here) or https://', true);
      const base = (D.settings || {}).notices || (window.AA_CONFIG || {}).notices || [];
      if (JSON.stringify(clean) === JSON.stringify(base)) delete D.stage.settings.notices; else D.stage.settings.notices = clean;
      saveStage(); toast('Notices staged — publish when ready.');
    });
    drawN();

  }

  /* ================================================================= INBOX */
  async function loadInbox() { const r = await api('/api/ops/inbox'); D.inbox = r.messages || []; inboxBadge(); return D.inbox; }
  const inboxBadge = () => { const n = (D.inbox || []).filter((m) => m.status === 'new').length; const b = $('#inboxBadge'); b.hidden = !n; b.textContent = n; };
  async function renderInbox(v) {
    if (S.preview) { v.innerHTML = setupPanel('Inbox', 'Requisitions and contact messages from the site land here once the console is live.', ['Switch the console on (OPS_PASSWORD).', 'Attach a 1 GB disk on Render at <code>/var/data</code> and set <code>DATA_DIR=/var/data</code>.']); return; }
    v.innerHTML = '<div class="ops-empty">Loading…</div>';
    try { await loadInbox(); } catch (e) {
      v.innerHTML = setupPanel('Inbox', e.message, [e.setup ? esc(e.setup) : 'Attach a disk at <code>/var/data</code> and set <code>DATA_DIR=/var/data</code> on the Render service, then redeploy.', 'Until then the site\'s forms open the visitor\'s mail app (set the store email in Store & notices).']);
      return;
    }
    v.innerHTML = `<div class="ops-bar"><select id="ibFilter" aria-label="Show"><option value="open">Open (new, contacted, holding)</option><option value="new">New</option><option value="holding">Holding</option><option value="done">Done</option><option value="spam">Spam</option><option value="all">Everything</option></select>
      <input type="search" id="ibQ" placeholder="Search names, contacts, messages" aria-label="Search messages"><button class="btn btn-ghost btn-sm" type="button" id="ibCsv">Export CSV</button><button class="btn btn-ghost btn-sm" type="button" id="ibReload">Refresh</button></div>
      <div class="ops-inbox"><div class="ops-msgs" id="ibList"></div><div class="ops-read hud brackets" id="ibRead"><p class="ops-note">Pick a message.</p></div></div>`;
    $('#ibFilter').value = D.inboxFilter;
    const draw = () => {
      const f = $('#ibFilter').value, q = $('#ibQ').value.toLowerCase();
      D.inboxFilter = f;
      const list = D.inbox.filter((m) => (f === 'all' || (f === 'open' ? ['new', 'contacted', 'holding'].includes(m.status) : m.status === f)) && (!q || `${m.name} ${m.contact} ${m.message} ${m.items.join(' ')}`.toLowerCase().includes(q)));
      $('#ibList').innerHTML = list.map((m) => `<button type="button" class="ops-msg" data-id="${esc(m.id)}" aria-current="${D.inboxSel === m.id}"><span class="top"><b>${esc(m.name)}</b><span class="ops-pill ${esc(m.status)}">${esc(m.status)}</span></span><small>${esc(m.kind)} · ${esc(ago(m.at))}${m.items.length ? ` · ${m.items.length} item(s)` : ''}</small><small>${esc((m.message || m.items[0] || '').slice(0, 90))}</small></button>`).join('') || '<p class="ops-note">Nothing here.</p>';
    };
    const read = (id) => {
      D.inboxSel = id;
      const m = D.inbox.find((x) => x.id === id); if (!m) return;
      const tel = /^[+\d][\d\s().-]{6,}$/.test(m.contact) ? `tel:${m.contact.replace(/[^\d+]/g, '')}` : '';
      const mail = /@/.test(m.contact) ? `mailto:${m.contact}` : '';
      $('#ibRead').innerHTML = `<span class="eyebrow">${esc(m.kind)} · ${esc(new Date(m.at).toLocaleString())}</span><h3>${esc(m.name)}</h3>
        <p class="ops-note">${esc(m.contact)} ${tel ? `· <a href="${esc(tel)}">Call</a>` : ''} ${mail ? `· <a href="${esc(mail)}">Email</a>` : ''}${m.topic ? ` · ${esc(m.topic)}` : ''}</p>
        ${m.items.length ? `<div class="ops-h">Requisition</div><ul class="items">${m.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${m.message ? `<div class="msg">${esc(m.message)}</div>` : ''}
        <div class="ops-bar">${['new', 'contacted', 'holding', 'done', 'spam'].map((s) => `<button class="btn ${m.status === s ? 'btn-ice' : 'btn-ghost'} btn-sm" type="button" data-status="${s}">${s}</button>`).join('')}</div>
        <div class="notes">${m.notes.map((n) => `<div><small>${esc(new Date(n.at).toLocaleString())}</small>${esc(n.text)}</div>`).join('')}</div>
        <div class="ops-synrow"><input class="ops-input" id="ibNote" maxlength="1000" placeholder="Add a note (called, holding until Friday…)"><button class="ops-flag" type="button" id="ibNoteGo" aria-label="Add note">+</button></div>
        <p class="ops-meta">${m.page ? `from ${esc(m.page)}` : ''}</p>`;
      draw();
    };
    const upd = async (body) => {
      try { const r = await api('/api/ops/inbox/update', { method: 'POST', body: { id: D.inboxSel, ...body } }); const i = D.inbox.findIndex((x) => x.id === D.inboxSel); if (i >= 0) D.inbox[i] = r.message; inboxBadge(); read(D.inboxSel); }
      catch (e) { toast(e.message, true); }
    };
    $('#ibList').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) read(b.dataset.id); });
    $('#ibRead').addEventListener('click', (e) => {
      const s = e.target.closest('[data-status]'); if (s) upd({ status: s.dataset.status });
      if (e.target.closest('#ibNoteGo')) { const t = $('#ibNote').value.trim(); if (t) upd({ note: t }); }
    });
    $('#ibFilter').addEventListener('change', draw); $('#ibQ').addEventListener('input', draw);
    $('#ibReload').addEventListener('click', async () => { await loadInbox(); draw(); });
    $('#ibCsv').addEventListener('click', () => download(`agarthan-inbox-${today()}.csv`, csv([['received', 'kind', 'status', 'name', 'contact', 'topic', 'message', 'items', 'notes'], ...D.inbox.map((m) => [m.at, m.kind, m.status, m.name, m.contact, m.topic, m.message, m.items.join(' | '), m.notes.map((n) => n.text).join(' | ')])]), 'text/csv'));
    draw();
    if (D.inboxSel) read(D.inboxSel);
  }

  /* =============================================================== TRAFFIC */
  async function loadTraffic() { D.traffic = await api('/api/ops/traffic'); return D.traffic; }
  async function renderTraffic(v) {
    if (S.preview) { v.innerHTML = setupPanel('Traffic', 'Anonymous page views and searches that found nothing, counted by the site\'s own server — no cookies, no IP addresses kept.', ['Switch the console on.', 'Attach the disk (same as the inbox).']); return; }
    v.innerHTML = '<div class="ops-empty">Loading…</div>';
    try { await loadTraffic(); } catch (e) { v.innerHTML = setupPanel('Traffic', e.message, [e.setup ? esc(e.setup) : 'Attach a disk at <code>/var/data</code> and set <code>DATA_DIR</code>.']); return; }
    const days = D.traffic.days || {};
    const keys = [];
    for (let i = 29; i >= 0; i--) keys.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
    const vals = keys.map((k) => (days[k] || {}).views || 0);
    const sum = (n) => vals.slice(-n).reduce((a, b) => a + b, 0);
    const max = Math.max(1, ...vals);
    const W = 600, H = 160, bw = W / keys.length;
    const bars = vals.map((x, i) => { const h = Math.round((x / max) * (H - 24)); return `<rect class="bar" x="${(i * bw + 1).toFixed(1)}" y="${H - 16 - h}" width="${(bw - 2).toFixed(1)}" height="${h}"><title>${keys[i]}: ${x} views</title></rect>`; }).join('');
    const pages = {};
    for (const k of keys) for (const [p, n] of Object.entries((days[k] || {}).pages || {})) pages[p] = (pages[p] || 0) + n;
    const top = Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const searches = Object.entries(D.traffic.searches || {}).filter(([, e]) => !(e.found > 0)).sort((a, b) => (b[1].zero || b[1].n) - (a[1].zero || a[1].n)).slice(0, 40);
    v.innerHTML = `<div class="ops-tiles">
        <div class="ops-tile hud"><span>Today</span><b>${num(vals[vals.length - 1])}</b><small>page views</small></div>
        <div class="ops-tile hud"><span>Last 7 days</span><b>${num(sum(7))}</b><small>page views</small></div>
        <div class="ops-tile hud"><span>Last 30 days</span><b>${num(sum(30))}</b><small>page views</small></div>
        <div class="ops-tile hud ${searches.length ? 'warn' : ''}"><span>Dead-end searches</span><b>${num(searches.length)}</b><small>found nothing</small></div></div>
      <section class="ops-panel hud brackets"><h3>Page views, 30 days</h3>
        <svg class="ops-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Page views per day for the last 30 days"><line class="grid" x1="0" x2="${W}" y1="${H - 16}" y2="${H - 16}"/>${bars}
          <text class="axis" x="0" y="${H - 2}">${keys[0].slice(5)}</text><text class="axis" x="${W}" y="${H - 2}" text-anchor="end">${keys[keys.length - 1].slice(5)}</text><text class="axis" x="2" y="10">${num(max)}</text></svg></section>
      <div class="ops-cols">
        <section class="ops-panel hud brackets"><h3>Top pages <small>30 days</small></h3><ul class="ops-list">${top.map(([p, n]) => `<li><span>${esc(p)}</span><b>${num(n)}</b></li>`).join('') || '<li><span>No views yet.</span></li>'}</ul></section>
        <section class="ops-panel hud brackets"><h3>Searches that found nothing</h3><p class="ops-note">Add a synonym (Store & notices) when it's something you stock under another name.</p>
          <ul class="ops-list">${searches.map(([q, e]) => `<li><span>${esc(q)} <small class="ops-meta">· last ${esc(e.last)}</small></span><span class="act"><b>${num(e.n)}×</b><button class="ops-link" type="button" data-syn="${esc(q)}">Add synonym</button></span></li>`).join('') || '<li><span>None yet.</span></li>'}</ul></section></div>`;
    $$('[data-syn]', v).forEach((b) => b.addEventListener('click', () => {
      const other = window.prompt(`"${b.dataset.syn}" should also find… (the word the catalogue uses)`);
      if (!other || !other.trim()) return;
      const cur = curList('synonyms').map((g) => g.slice());
      cur.push([b.dataset.syn.toLowerCase(), other.trim().toLowerCase()]);
      D.stage.settings.synonyms = cur; saveStage(); toast('Synonym staged — publish when ready.');
    }));
  }

  /* ================================================================ ORDERS */
  async function renderOrders(v) {
    const st = S.status || {};
    if (S.preview || !st.woo) {
      v.innerHTML = setupPanel('WooCommerce orders', 'Recent orders, their firearm release (pickup or the buyer\'s FFL), and 30-day sales from the store\'s WooCommerce site — read only: the console can never change an order.',
        ['WordPress → WooCommerce → Settings → Advanced → REST API → Add key, permissions <b>Read</b>.', 'On the Render service set <code>WOO_URL</code> (https://agarthanarmory.com), <code>WOO_CK</code> and <code>WOO_CS</code>, then redeploy.']);
      return;
    }
    v.innerHTML = `<div id="ordTop"><div class="ops-empty">Loading…</div></div>
      <section class="ops-panel hud brackets"><h3>Orders</h3><div class="ops-bar"><select id="ordStatus" aria-label="Status"><option value="any">Every status</option>${['processing', 'on-hold', 'pending', 'completed', 'cancelled', 'refunded'].map((x) => `<option>${x}</option>`).join('')}</select></div><div id="ordList"><div class="ops-empty">Loading…</div></div></section>`;
    api('/api/ops/woo/reports/sales?period=month').then((sales) => {
      const s0 = Array.isArray(sales) ? sales[0] || {} : sales || {};
      const days = Object.entries(s0.totals || {}).sort(([a], [b]) => a.localeCompare(b));
      const vals = days.map(([, t]) => Number(t.sales) || 0);
      const max = Math.max(1, ...vals), W = 600, H = 150, bw = W / Math.max(1, vals.length);
      $('#ordTop').innerHTML = `<div class="ops-tiles"><div class="ops-tile hud good"><span>Sales, 30 days</span><b>${esc(money(s0.total_sales))}</b><small>${num(s0.total_orders)} orders</small></div>
        <div class="ops-tile hud"><span>Average per day</span><b>${esc(money(s0.average_sales))}</b><small>last 30 days</small></div></div>
        ${vals.length ? `<section class="ops-panel hud brackets"><h3>Sales per day</h3><svg class="ops-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Sales per day"><line class="grid" x1="0" x2="${W}" y1="${H - 14}" y2="${H - 14}"/>${vals.map((x, i) => { const h = Math.round((x / max) * (H - 22)); return `<rect class="bar" x="${(i * bw + 1).toFixed(1)}" y="${H - 14 - h}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${h}"><title>${esc(days[i][0])}: ${esc(money(x))}</title></rect>`; }).join('')}<text class="axis" x="0" y="${H - 2}">${esc(days[0][0].slice(5))}</text><text class="axis" x="${W}" y="${H - 2}" text-anchor="end">${esc(days[days.length - 1][0].slice(5))}</text></svg></section>` : ''}`;
    }).catch(() => { $('#ordTop').innerHTML = ''; });
    const load = async () => {
      const status = $('#ordStatus').value;
      try {
        const orders = await api(`/api/ops/woo/orders?per_page=40${status !== 'any' ? `&status=${encodeURIComponent(status)}` : ''}`);
        D.orders = orders || [];
        $('#ordList').innerHTML = `<div class="ops-tablewrap"><table class="ops-table"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Customer</th><th>Items</th><th>Firearm</th><th>Total</th></tr></thead>
          <tbody>${D.orders.map((o, i) => `<tr data-o="${i}"><td><button class="ops-link" type="button" data-ord="${i}">#${esc(o.number || o.id)}</button></td><td>${esc(new Date(o.date_created).toLocaleDateString())}</td><td><span class="ops-pill ${o.status === 'processing' ? 'new' : o.status === 'on-hold' ? 'holding' : ''}">${esc(o.status)}</span></td><td>${esc(((o.billing || {}).first_name || '') + ' ' + ((o.billing || {}).last_name || ''))}</td><td>${esc((o.line_items || []).map((l) => `${l.quantity} × ${l.name}`).join(', ').slice(0, 100))}</td><td>${o.agarthan_release ? esc(Object.values(o.agarthan_release)[0].split('—')[0].trim()) : ''}</td><td>${esc(money(o.total))}</td></tr>`).join('') || '<tr><td colspan="7"><div class="ops-empty">No orders.</div></td></tr>'}</tbody></table></div>`;
        $$('[data-ord]', $('#ordList')).forEach((b) => b.addEventListener('click', () => orderDetail(D.orders[+b.dataset.ord])));
      } catch (e) { $('#ordList').innerHTML = `<p class="ops-note">${esc(e.message)}</p>`; }
    };
    $('#ordStatus').addEventListener('change', load);
    load();
  }
  function orderDetail(o) {
    const b = o.billing || {}, sh = o.shipping || {};
    const addr = (a) => [a.address_1, a.address_2, [a.city, a.state, a.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const dlg = $('#drawer');
    dlg.innerHTML = `<div class="ops-dhead"><div><span class="eyebrow">Order · ${esc(o.status)}</span><h3 id="drawerTitle">#${esc(o.number || o.id)} — ${esc(money(o.total))}</h3><small class="ops-meta">${esc(new Date(o.date_created).toLocaleString())}</small></div><button class="ops-x" type="button" data-close aria-label="Close">×</button></div>
      <div class="ops-dbody">
        ${o.agarthan_release ? `<section class="ops-panel hud"><h3>Firearm release</h3>${Object.entries(o.agarthan_release).map(([k, val]) => `<p class="ops-note"><b>${esc(k)}:</b> ${esc(val)}</p>`).join('')}</section>` : ''}
        <section class="ops-panel hud"><h3>Items</h3><ul class="ops-list">${(o.line_items || []).map((l) => `<li><span>${esc(l.quantity)} × ${esc(l.name)}${l.sku ? ` <small class="ops-meta">· ${esc(l.sku)}</small>` : ''}</span><b>${esc(money(l.total))}</b></li>`).join('')}</ul>
          <p class="ops-note">Shipping ${esc(money(o.shipping_total))} · tax ${esc(money(o.total_tax))} · paid by ${esc(o.payment_method_title || '—')}</p></section>
        <section class="ops-panel hud"><h3>Customer</h3><p class="ops-note"><b>${esc(`${b.first_name || ''} ${b.last_name || ''}`)}</b>${b.phone ? ` · <a href="tel:${esc(String(b.phone).replace(/[^\d+]/g, ''))}">${esc(b.phone)}</a>` : ''}${b.email ? ` · <a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : ''}</p>
          <p class="ops-note">Billing: ${esc(addr(b) || '—')}</p><p class="ops-note">Shipping: ${esc(addr(sh) || '—')}</p>${o.customer_note ? `<p class="ops-note"><b>Note:</b> ${esc(o.customer_note)}</p>` : ''}</section>
        <p class="ops-meta">Read only — change the order in WooCommerce.</p></div>`;
    dlg.showModal();
  }

  /* ================================================================= TOOLS */
  function renderTools(v) {
    v.innerHTML = `
      <section class="ops-panel hud brackets"><h3>Site check <small>is everything answering?</small></h3>
        <p class="ops-note">Pages, the sitemap and robots, the catalogue, a sample of product photos, the published settings, and whether the WooCommerce store shows this theme.</p>
        <div class="ops-bar"><button class="btn btn-ice btn-sm" type="button" id="chkGo">Run the site check</button>${S.preview ? '' : '<button class="btn btn-ghost btn-sm" type="button" id="mailGo">Send a test email alert</button>'}</div>
        <ul class="ops-list" id="chkOut"></ul></section>
      <section class="ops-panel hud brackets"><h3>CSV diff <small>what changed between two exports</small></h3>
        <p class="ops-note">Drop two CSV files — last week's and this week's product export, or a distributor price list against yours. Rows are matched on a key column (SKU, id, UPC…); you get what's only in each and what changed. Nothing leaves this computer.</p>
        <div class="ops-row2"><label class="ops-drop" id="dropA"><span><b>Older file (A)</b><br>drop or choose a .csv</span><input type="file" accept=".csv,text/csv" hidden></label><label class="ops-drop" id="dropB"><span><b>Newer file (B)</b><br>drop or choose a .csv</span><input type="file" accept=".csv,text/csv" hidden></label></div>
        <div id="diffOut"></div></section>
      <section class="ops-panel hud brackets"><h3>Apply to a list</h3>
        <p class="ops-note">Paste product ids or SKUs (one per line, or comma-separated) and act on all of them at once.</p>
        <textarea class="ops-textarea" id="listIds" placeholder="glock-19-gen-5&#10;PA195S20301"></textarea>
        <div class="ops-bar"><select id="listAct" aria-label="Action"><option value="feature">Feature</option><option value="unfeature">Unfeature</option><option value="pull">Pull photos</option><option value="restore">Restore photos</option><option value="hide">Hide</option></select><button class="btn btn-ghost btn-sm" type="button" id="listGo">Stage</button><span class="ops-meta" id="listMsg"></span></div></section>
      <section class="ops-panel hud brackets"><h3>Export and import</h3>
        <p class="ops-note">Without publishing set up (or in preview), export your staged edits and commit them with <b>node scripts/apply-ops-edits.mjs ops-edits.json</b>.</p>
        <div class="ops-bar">
          <button class="btn btn-ghost btn-sm" type="button" id="expStage">Export staged edits</button>
          <button class="btn btn-ghost btn-sm" type="button" id="expOv" ${S.preview ? 'disabled' : ''}>Export overrides.json</button>
          <label class="btn btn-ghost btn-sm">Import edits<input type="file" id="impStage" accept=".json,application/json" hidden></label>
          <button class="btn btn-ghost btn-sm" type="button" id="expCat">Export the whole catalogue (CSV)</button>
          <button class="btn btn-ghost btn-sm" type="button" id="backup" ${S.preview ? 'disabled' : ''}>Download a backup</button>
        </div></section>`;
    $('#chkGo').addEventListener('click', siteCheck);
    const mg = $('#mailGo');
    mg && mg.addEventListener('click', async () => {
      try { const r = await api('/api/ops/mail/test', { method: 'POST' }); toast(`Test alert sent to ${r.to} — check the inbox (and spam).`); }
      catch (e) { toast(e.setup ? `${e.message}. ${e.setup}` : e.message, true); }
    });
    // csv diff
    const files = {};
    const take = (slot, file) => {
      if (!file) return;
      const r = new FileReader();
      r.onload = () => { files[slot] = { name: file.name, rows: parseCsv(String(r.result)) }; $(`#drop${slot} span`).innerHTML = `<b>${esc(file.name)}</b><br>${num(Math.max(0, files[slot].rows.length - 1))} rows`; if (files.A && files.B) diff(files.A, files.B); };
      r.readAsText(file);
    };
    for (const slot of ['A', 'B']) {
      const z = $('#drop' + slot);
      z.querySelector('input').addEventListener('change', (e) => take(slot, e.target.files[0]));
      z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('over'); });
      z.addEventListener('dragleave', () => z.classList.remove('over'));
      z.addEventListener('drop', (e) => { e.preventDefault(); z.classList.remove('over'); take(slot, e.dataTransfer.files[0]); });
    }
    // list
    $('#listGo').addEventListener('click', () => {
      const raw = $('#listIds').value.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
      const bySku = new Map(D.items.filter((i) => i.sku).map((i) => [String(i.sku).toLowerCase(), i.id]));
      const ids = [...new Set(raw.map((s) => (D.byId.has(s) ? s : bySku.get(s.toLowerCase()))).filter(Boolean))];
      const n = bulk(ids, $('#listAct').value) || 0;
      $('#listMsg').textContent = `${num(n)} matched · ${num(raw.length - n)} not found`;
    });
    // export / import
    $('#expStage').addEventListener('click', () => {
      const custom = { upsert: Object.values(D.stage.custom.upsert), remove: D.stage.custom.remove };
      const uploads = stagedImagePaths().map((p) => ({ path: p, data: UP.get(p).b64 }));
      download(`ops-edits-${today()}.json`, JSON.stringify({ products: D.stage.products, settings: D.stage.settings, custom, uploads }, null, 2));
    });
    $('#expOv').addEventListener('click', () => download('overrides.json', JSON.stringify(D.overrides, null, 2) + '\n'));
    $('#impStage').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then((t) => {
        const d = JSON.parse(t);
        if (!d || typeof d !== 'object') throw new Error('not an edits file');
        Object.assign(D.stage.products, d.products || {});
        Object.assign(D.stage.settings, d.settings || {});
        const cu = d.custom || {};
        for (const c of Array.isArray(cu.upsert) ? cu.upsert : []) if (c && c.id) D.stage.custom.upsert[c.id] = c;
        for (const id of Array.isArray(cu.remove) ? cu.remove : []) if (!D.stage.custom.remove.includes(id)) D.stage.custom.remove.push(id);
        for (const u of Array.isArray(d.uploads) ? d.uploads : []) if (u && u.path && u.data) UP.set(u.path, { b64: u.data, ext: u.path.split('.').pop() });
        if (Array.isArray(d.uploads) && d.uploads.length) saveUploads();
        saveStage(); toast(`Imported ${num(Object.keys(d.products || {}).length)} product edits${(cu.upsert || []).length ? `, ${num(cu.upsert.length)} listings` : ''}${(d.uploads || []).length ? `, ${num(d.uploads.length)} photos` : ''}.`);
      }).catch((err) => toast(`Could not import: ${err.message}`, true));
    });
    $('#expCat').addEventListener('click', () => download(`agarthan-catalogue-${today()}.csv`, csv([['id', 'name', 'brand', 'department', 'category', 'price', 'stock', 'photo', 'sku'], ...D.items.map((i) => [i.id, i.name, i.brand, i.dept, i.sub, i.price, i.status, i.images && i.images.length ? 'yes' : 'no', i.sku])]), 'text/csv'));
    $('#backup').addEventListener('click', async () => {
      try { const b = await api('/api/ops/backup'); download(`agarthan-ops-backup-${today()}.json`, JSON.stringify(b, null, 2)); } catch (err) { toast(err.message, true); }
    });
  }

  /* ------------------------------------------------------------ site check */
  async function siteCheck() {
    const out = $('#chkOut');
    const row = (ok, label, detail) => `<li><span>${ok === true ? '✓' : ok === false ? '✕' : '…'} ${esc(label)} <small class="ops-meta">${esc(detail || '')}</small></span><b class="${ok === false ? 'bad' : ''}">${ok === true ? 'OK' : ok === false ? 'FIX' : ''}</b></li>`;
    const lines = [];
    const show = () => { out.innerHTML = lines.join(''); };
    const head = async (u) => { try { const r = await fetch(u, { method: 'GET', cache: 'no-store' }); return { status: r.status, text: /\.(xml|txt|json)$|version/.test(u) ? await r.text() : '' }; } catch { return { status: 0, text: '' }; } };
    out.innerHTML = '<li><span>Checking…</span></li>';
    const ver = await head('/version');
    let vj = {}; try { vj = JSON.parse(ver.text); } catch { /* */ }
    lines.push(row(ver.status === 200, 'Deployed version', ver.status === 200 ? `commit ${vj.commit} · ${num((vj.catalog || {}).items)} products · catalogue ${(vj.catalog || {}).updated}` : `HTTP ${ver.status}`));
    for (const [u, want] of [['/', 200], ['/armory', 200], ['/transfers', 200], ['/ops', 200], ['/this-page-is-not-here', 404]]) {
      const r = await head(u); lines.push(row(r.status === want, `${u}`, `answered ${r.status}${want === 404 ? ' (a missing page must say 404)' : ''}`)); show();
    }
    const sm = await head('/sitemap.xml');
    const locs = (sm.text.match(/<loc>/g) || []).length;
    lines.push(row(sm.status === 200 && locs > 0, 'sitemap.xml', `${locs} pages listed`));
    const rb = await head('/robots.txt');
    lines.push(row(/Sitemap:/i.test(rb.text) && /Disallow:\s*\/ops/.test(rb.text), 'robots.txt', /Disallow:\s*\/ops/.test(rb.text) ? 'points at the sitemap, keeps crawlers out of the console' : 'should list the sitemap and Disallow /ops'));
    const sample = D.items.filter((i) => i.images && i.images[0]).sort(() => Math.random() - 0.5).slice(0, 30);
    let broken = 0;
    await Promise.all(sample.map(async (i) => { const r = await fetch(i.images[0], { method: 'HEAD', cache: 'no-store' }).catch(() => ({ status: 0 })); if (r.status !== 200) broken++; }));
    lines.push(row(broken === 0, 'Product photos (30 at random)', broken ? `${broken} missing` : 'all there'));
    const pub = (D.settings || {});
    if (pub.facts || pub.notices || pub.spotlight || pub.synonyms || pub.pins) {
      const cfgJs = await (await fetch('/assets/js/config.js', { cache: 'no-store' })).text().catch(() => '');
      lines.push(row(/published from the Ops Console/.test(cfgJs), 'Published store settings', /published from the Ops Console/.test(cfgJs) ? 'riding on config.js' : 'not live yet (deploying?)'));
    }
    show();
    if (!S.preview && (S.status || {}).woo) {
      try { const w = await api('/api/ops/check/woo'); lines.push(row(!!w.theme, 'WooCommerce store theme', w.theme ? `Agarthan theme ${w.version || ''} is live` : w.error || `the store answered ${w.status} without the Agarthan theme`)); }
      catch (e) { lines.push(row(false, 'WooCommerce store theme', e.message)); }
    }
    const st = S.status || {};
    if (!S.preview) lines.push(row(!!st.mail, 'Email alerts', st.mail ? `to ${st.mailTo}` : 'off — set RESEND_API_KEY and ALERT_EMAIL'));
    show();
  }
  /** RFC 4180 CSV → rows of cells (quotes, doubled quotes, newlines inside quotes) */
  function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  function diff(A, B) {
    const ha = A.rows[0] || [], hb = B.rows[0] || [];
    const norm = (h) => h.map((x) => x.trim().toLowerCase());
    const na = norm(ha), nb = norm(hb);
    const pick = ['sku', 'id', 'upc', 'mpn', 'item', 'item number', 'part number', 'name'];
    const key = pick.find((k) => na.includes(k) && nb.includes(k)) || na.find((k) => nb.includes(k));
    if (!key) { $('#diffOut').innerHTML = '<p class="ops-note">The two files share no column to match rows on.</p>'; return; }
    const ka = na.indexOf(key), kb = nb.indexOf(key);
    const shared = na.filter((h) => nb.includes(h) && h !== key);
    const mapOf = (rows, k) => new Map(rows.slice(1).map((r) => [String(r[k] || '').trim().toLowerCase(), r]));
    const ma = mapOf(A.rows, ka), mb = mapOf(B.rows, kb);
    const onlyA = [...ma.keys()].filter((k) => k && !mb.has(k)), onlyB = [...mb.keys()].filter((k) => k && !ma.has(k));
    const changed = [];
    for (const [k, ra] of ma) {
      const rb = mb.get(k); if (!rb) continue;
      const cols = shared.filter((h) => String(ra[na.indexOf(h)] || '').trim() !== String(rb[nb.indexOf(h)] || '').trim());
      if (cols.length) changed.push([k, cols.map((h) => `${h}: ${ra[na.indexOf(h)] || '∅'} → ${rb[nb.indexOf(h)] || '∅'}`).join(' · ')]);
    }
    const list = (title, items, fmt) => `<div class="ops-h">${esc(title)} <small>${num(items.length)}</small></div><div class="ops-diff">${items.slice(0, 300).map(fmt).join('<br>') || '—'}</div>`;
    $('#diffOut').innerHTML = `<p class="ops-note">Matched on <b>${esc(key)}</b> · comparing ${num(shared.length)} shared columns.</p>
      ${list(`Only in A (${A.name}) — dropped`, onlyA, (k) => esc(k))}
      ${list(`Only in B (${B.name}) — new`, onlyB, (k) => esc(k))}
      ${list('Changed', changed, ([k, d]) => `<span class="k">${esc(k)}</span> ${esc(d)}`)}
      <div class="ops-bar"><button class="btn btn-ghost btn-sm" type="button" id="diffCsv">Download the differences (CSV)</button></div>`;
    $('#diffCsv').addEventListener('click', () => download(`diff-${today()}.csv`, csv([['change', key, 'details'], ...onlyA.map((k) => ['dropped', k, '']), ...onlyB.map((k) => ['new', k, '']), ...changed.map(([k, d]) => ['changed', k, d])]), 'text/csv'));
  }

  /* ========================================================= YOUR LISTINGS */
  const STATUS_OPTS = [['in', 'In stock'], ['low', 'Few left'], ['ship', 'Ships'], ['out', 'Out of stock']];
  function listings() {
    const map = new Map(D.custom.map((c) => [c.id, c]));
    for (const [id, c] of Object.entries(D.stage.custom.upsert)) map.set(id, { ...c, _staged: true });
    return [...map.values()].map((c) => ({ ...c, _removing: D.stage.custom.remove.includes(c.id) }));
  }
  function renderListings(v) {
    const list = listings();
    v.innerHTML = `<section class="ops-panel hud brackets"><h3>Your listings <small>${num(list.length)}</small></h3>
      <p class="ops-note">Products the distributor feed never carries — used and consignment guns, trade-ins, one-offs. They show in the Armory like everything else, survive every new scrape, and appear in Inventory too.</p>
      <div class="ops-bar"><button class="btn btn-ice btn-sm" type="button" id="lstAdd">+ Add a listing</button></div>
      <div class="ops-tablewrap"><table class="ops-table"><thead><tr><th></th><th>Listing</th><th>Department</th><th>Price</th><th>Stock</th><th></th></tr></thead><tbody>
      ${list.map((c) => `<tr data-id="${esc(c.id)}" class="${c._staged || c._removing ? 'staged' : ''}"><td>${c.images && c.images[0] ? `<div class="ops-thumb"><img src="${esc(imgSrc(c.images[0]))}" alt=""></div>` : `<div class="ops-thumb holo" aria-hidden="true">${holo(c.type || 'case')}</div>`}</td>
        <td><div class="ops-name"><button type="button" data-open>${c.cond ? `<span class="cond-badge">${esc(c.cond)}</span> ` : ''}${esc(c.name)}</button><small>${esc(c.brand || '')}${c._removing ? ' · removing on publish' : c._staged ? ' · staged' : ''}</small></div></td>
        <td>${esc(DEPTS[c.dept] || c.dept)}<br><small class="ops-meta">${esc(c.sub || '')}</small></td><td>${esc(money(c.price))}</td><td><span class="ops-st ${esc(c.status)}">${esc(STATUS[c.status] || c.status)}</span></td>
        <td><button class="ops-link" type="button" data-open>Edit</button></td></tr>`).join('') || '<tr><td colspan="6"><div class="ops-empty">No listings yet — add the first used or consignment gun.</div></td></tr>'}</tbody></table></div></section>`;
    $('#lstAdd').addEventListener('click', () => openListing(null));
    $$('[data-open]', v).forEach((b) => b.addEventListener('click', () => openListing(b.closest('[data-id]').dataset.id)));
  }
  function openListing(id) {
    const cur = id ? listings().find((c) => c.id === id) || {} : {};
    const isNew = !id;
    const dlg = $('#drawer');
    const v = (k) => cur[k] ?? '';
    const photos = (cur.images || []).slice();
    dlg.innerHTML = `<div class="ops-dhead"><div><span class="eyebrow">${isNew ? 'New listing' : 'Your listing'}</span><h3 id="drawerTitle">${esc(cur.name || 'A used or consignment item')}</h3>${id ? `<small class="ops-meta">${esc(id)}</small>` : ''}</div><button class="ops-x" type="button" data-close aria-label="Close">×</button></div>
      <form class="ops-dbody" id="lsForm"><div class="ops-form">
        <label class="ops-f"><span>Name *</span><input class="ops-input" name="name" maxlength="200" required value="${esc(v('name'))}" placeholder="Glock 19 Gen 3 — police trade-in"></label>
        <div class="ops-row3"><label class="ops-f"><span>Brand</span><input class="ops-input" name="brand" maxlength="80" value="${esc(v('brand'))}"></label>
          <label class="ops-f"><span>Department *</span><select class="ops-select" name="dept" required>${Object.entries(DEPTS).map(([k, n]) => `<option value="${k}" ${v('dept') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          <label class="ops-f"><span>Category</span><input class="ops-input" name="sub" maxlength="80" value="${esc(v('sub'))}" placeholder="Striker-Fired Pistols"></label></div>
        <div class="ops-row3"><label class="ops-f"><span>Price</span><input class="ops-input" name="price" inputmode="decimal" value="${esc(v('price'))}" placeholder="call for price"></label>
          <label class="ops-f"><span>Stock</span><select class="ops-select" name="status">${STATUS_OPTS.map(([k, n]) => `<option value="${k}" ${(v('status') || 'in') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="ops-f"><span>Condition</span><select class="ops-select" name="cond"><option value="">New</option>${['Used', 'Consignment', 'Demo'].map((c) => `<option ${v('cond') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
        <div class="ops-row3"><label class="ops-f"><span>Hologram</span><select class="ops-select" name="type"><option value="">— automatic</option>${TYPES.map((t) => `<option ${v('type') === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="ops-f"><span>Firearm</span><select class="ops-select" name="firearm"><option value="">— by department</option><option value="yes" ${cur.firearm === true ? 'selected' : ''}>Yes</option><option value="no" ${cur.firearm === false ? 'selected' : ''}>No</option></select></label>
          <label class="ops-f"><span>SKU / serial ref</span><input class="ops-input" name="sku" maxlength="60" value="${esc(v('sku'))}" placeholder="internal reference"></label></div>
        <div class="ops-row2"><label class="ops-f"><span>Price note</span><input class="ops-input" name="priceNote" maxlength="60" value="${esc(v('priceNote'))}" placeholder="Includes two magazines"></label>
          <label class="ops-f"><span>Search terms</span><input class="ops-input" name="keywords" maxlength="200" value="${esc(v('keywords'))}"></label></div>
        <label class="ops-f"><span>YouTube video</span><input class="ops-input" name="video" maxlength="120" value="${esc(v('video'))}" placeholder="https://youtu.be/…"></label>
        <div class="ops-toggles"><label><input type="checkbox" class="ops-check" name="featured" ${cur.featured ? 'checked' : ''}> Featured on the home page</label><label><input type="checkbox" class="ops-check" name="nfa" ${cur.nfa ? 'checked' : ''}> NFA item</label></div>
        <div class="ops-f"><span>Photos</span><div id="lsPhotos"></div></div>
        <div class="ops-f"><span>Spec rows</span><div class="ops-specs" id="lsSpecs"></div><button class="ops-link" type="button" id="lsAddSpec">+ add a row</button></div>
        <label class="ops-f"><span>Description</span><textarea class="ops-textarea" name="desc" maxlength="6000" rows="6" placeholder="Condition, round count, what's included…">${esc(v('desc'))}</textarea></label>
      </div></form>
      <div class="ops-dfoot">${isNew ? '<span></span>' : `<button class="btn btn-ghost btn-sm" type="button" id="lsDel">${cur._removing ? 'Keep it' : 'Remove the listing'}</button>`}
        <span><button class="btn btn-ghost btn-sm" type="button" data-close>Cancel</button> <button class="btn btn-ice btn-sm" type="button" id="lsSave">Stage listing</button></span></div>`;
    photoStrip($('#lsPhotos', dlg), photos, cur.name || 'listing', () => {});
    const specRows = $('#lsSpecs', dlg);
    const addSpec = (k = '', val = '') => {
      const r = document.createElement('div'); r.className = 'r';
      r.innerHTML = `<input class="ops-input" data-sk placeholder="caliber" maxlength="40" value="${esc(k)}" aria-label="Spec name"><input class="ops-input" data-sv placeholder="9mm Luger" maxlength="120" value="${esc(val)}" aria-label="Spec value"><button class="ops-flag" type="button" aria-label="Remove row">×</button>`;
      r.querySelector('button').addEventListener('click', () => r.remove()); specRows.appendChild(r);
    };
    Object.entries(cur.specs || {}).forEach(([k, val]) => addSpec(k, val));
    $('#lsAddSpec', dlg).addEventListener('click', () => addSpec());
    const del = $('#lsDel', dlg);
    del && del.addEventListener('click', () => {
      const st = D.stage.custom;
      if (cur._removing) st.remove = st.remove.filter((x) => x !== id);
      else if (D.custom.some((c) => c.id === id)) { st.remove.push(id); delete st.upsert[id]; }
      else delete st.upsert[id];
      saveStage(); dlg.close(); route();
    });
    $('#lsSave', dlg).addEventListener('click', () => {
      const fd = new FormData($('#lsForm', dlg));
      const t = (k) => String(fd.get(k) || '').trim();
      try {
        if (!t('name')) throw new Error('A listing needs a name');
        const price = t('price').replace(/[$,]/g, '');
        if (price && !(Number(price) >= 0 && Number(price) <= 1e6)) throw new Error('A price is a number, like 449.99');
        const vid = ytId(t('video')); if (vid === null) throw new Error('That is not a YouTube link');
        const specs = {};
        $$('.r', specRows).forEach((r) => { const k = r.querySelector('[data-sk]').value.trim(); const val = r.querySelector('[data-sv]').value.trim(); if (k && val) { if (!/^[a-zA-Z][\w -]*$/.test(k)) throw new Error(`"${k}" is not a usable spec name`); specs[k] = val; } });
        const newId = id || `c-${slugId(t('name')).slice(0, 60)}-${Math.random().toString(16).slice(2, 6)}`;
        const entry = { id: newId, name: t('name'), dept: t('dept'), status: t('status') || 'in' };
        for (const k of ['brand', 'sub', 'cond', 'type', 'sku', 'priceNote', 'keywords', 'desc']) if (t(k)) entry[k] = t(k);
        if (price) entry.price = Math.round(Number(price) * 100) / 100;
        if (vid) entry.video = vid;
        if (t('firearm')) entry.firearm = t('firearm') === 'yes';
        if (fd.get('featured') === 'on') entry.featured = true;
        if (fd.get('nfa') === 'on') entry.nfa = true;
        if (Object.keys(specs).length) entry.specs = specs;
        if (photos.length) entry.images = photos.slice();
        D.stage.custom.upsert[newId] = entry;
        D.stage.custom.remove = D.stage.custom.remove.filter((x) => x !== newId);
      } catch (err) { toast(err.message, true); return; }
      saveStage(); dlg.close(); toast('Listing staged — publish when ready.'); route();
    });
    dlg.showModal();
  }

  /* ================================================================= SEARCH */
  function renderSearch(v) {
    v.innerHTML = `<div class="ops-cols"><section class="ops-panel hud brackets"><h3>Top searches <small>what people type</small></h3><div id="srTop"><p class="ops-note">${S.preview ? 'The search log needs the live console and its disk.' : 'Loading…'}</p></div></section>
        <section class="ops-panel hud brackets"><h3>Searches that found nothing</h3><p class="ops-note">Add a synonym when it's something you stock under another name.</p><div id="srZero"><p class="ops-note">${S.preview ? '—' : 'Loading…'}</p></div></section></div>
      <section class="ops-panel hud brackets"><h3>Synonyms <small>words that mean the same thing</small></h3>
        <p class="ops-note">One group per line, words separated by commas: a search for any of them finds all of them.</p>
        <div id="synRows" class="ops-form"></div>
        <div class="ops-bar"><button class="btn btn-ghost btn-sm" type="button" id="synAdd">+ Add a group</button><button class="btn btn-ghost btn-sm" type="button" id="synStarter">Add the gun-store starter set</button><button class="btn btn-ice btn-sm" type="button" id="synSave">Stage synonyms</button></div></section>
      <section class="ops-panel hud brackets"><h3>Pins <small>products first for a search</small></h3>
        <p class="ops-note">For a search word, these products come first, in this order. A pin only promotes: the product must still match the search.</p>
        <div id="pinRows" class="ops-form"></div>
        <div class="ops-bar"><button class="btn btn-ghost btn-sm" type="button" id="pinAdd">+ Add a pin</button><button class="btn btn-ice btn-sm" type="button" id="pinSave">Stage pins</button></div></section>`;
    // the log
    if (!S.preview) loadTraffic().then(() => {
      const all = Object.entries((D.traffic || {}).searches || {});
      const top = all.slice().sort((a, b) => b[1].n - a[1].n).slice(0, 25);
      const zero = all.filter(([, e]) => (e.zero || 0) > 0 && !(e.found > 0)).sort((a, b) => (b[1].zero || 0) - (a[1].zero || 0)).slice(0, 25);
      $('#srTop').innerHTML = top.length ? `<ul class="ops-list">${top.map(([q, e]) => `<li><span>${esc(q)} <small class="ops-meta">· ${e.found != null ? `${num(e.found)} found` : ''} · last ${esc(e.last)}</small></span><b>${num(e.n)}×</b></li>`).join('')}</ul>` : '<p class="ops-note">No searches yet.</p>';
      $('#srZero').innerHTML = zero.length ? `<ul class="ops-list">${zero.map(([q, e]) => `<li><span>${esc(q)}</span><span class="act"><b>${num(e.zero || e.n)}×</b><button class="ops-link" type="button" data-syn="${esc(q)}">Add synonym</button></span></li>`).join('')}</ul>` : '<p class="ops-note">None — every search found something.</p>';
      $$('[data-syn]', v).forEach((b) => b.addEventListener('click', () => { syn.push(`${b.dataset.syn}, `); drawS(); const inp = $$('input', $('#synRows')).pop(); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }));
    }).catch((e) => { $('#srTop').innerHTML = `<p class="ops-note">${esc(e.message)}</p>`; $('#srZero').innerHTML = ''; });
    // synonyms
    let syn = curList('synonyms').map((g) => g.join(', '));
    const sRows = $('#synRows');
    const drawS = () => { sRows.innerHTML = syn.map((g, i) => `<div class="ops-synrow" data-i="${i}"><input class="ops-input" value="${esc(g)}" placeholder="ar15, ar-15, ar 15" aria-label="Synonym group ${i + 1}"><button class="ops-flag" type="button" data-srm aria-label="Remove">×</button></div>`).join('') || '<p class="ops-note">No synonyms yet.</p>'; };
    sRows.addEventListener('input', (e) => { const row = e.target.closest('[data-i]'); if (row) syn[+row.dataset.i] = e.target.value; });
    sRows.addEventListener('click', (e) => { if (e.target.closest('[data-srm]')) { syn.splice(+e.target.closest('[data-i]').dataset.i, 1); drawS(); } });
    $('#synAdd').addEventListener('click', () => { syn.push(''); drawS(); $$('input', sRows).pop().focus(); });
    $('#synStarter').addEventListener('click', () => { const have = new Set(syn.flatMap((g) => g.split(',').map((w) => w.trim().toLowerCase()))); for (const g of STARTER_SYNONYMS) if (!g.some((w) => have.has(w))) syn.push(g.join(', ')); drawS(); });
    $('#synSave').addEventListener('click', () => {
      const groups = syn.map((g) => [...new Set(g.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean))]).filter((g) => g.length);
      const bad = groups.find((g) => g.length < 2 || g.length > 12);
      if (bad) return toast(`"${bad.join(', ')}" needs 2 to 12 words.`, true);
      const base = (D.settings || {}).synonyms || (window.AA_CONFIG || {}).synonyms || [];
      if (JSON.stringify(groups) === JSON.stringify(base)) delete D.stage.settings.synonyms; else D.stage.settings.synonyms = groups;
      saveStage(); toast('Synonyms staged — publish when ready.');
    });
    drawS();
    // pins
    const pinsNow = D.stage.settings.pins || (D.settings || {}).pins || (window.AA_CONFIG || {}).pins || {};
    let pins = Object.entries(pinsNow).map(([q, ids]) => ({ q, ids: ids.join('\n') }));
    const bySku = new Map(D.items.filter((i) => i.sku).map((i) => [String(i.sku).toLowerCase(), i.id]));
    const resolve = (txt) => txt.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean).map((x) => (D.byId.has(x) ? x : bySku.get(x.toLowerCase()) || null));
    const pRows = $('#pinRows');
    const named = (txt) => resolve(txt).map((id, n) => (id ? `${n + 1}. ${esc((D.byId.get(id) || {}).name || id)}` : `<span class="bad">${n + 1}. not found</span>`)).join(' · ') || 'no products yet';
    const drawP = () => {
      pRows.innerHTML = pins.map((pn, i) => `<div class="ops-notice-row" data-i="${i}"><label class="ops-f"><span>Search word(s)</span><input class="ops-input" data-p="q" maxlength="40" value="${esc(pn.q)}" placeholder="glock"></label>
          <label class="ops-f"><span>Products <em>(ids or SKUs, one per line)</em></span><textarea class="ops-textarea" data-p="ids" rows="3">${esc(pn.ids)}</textarea></label>
          <div class="wide ops-meta" data-named>${named(pn.ids)}</div>
          <div class="wide"><button class="ops-link" type="button" data-prm>Remove</button></div></div>`).join('') || '<p class="ops-note">No pins.</p>';
    };
    // typing updates the row's product names in place, so the cursor never leaves the box
    pRows.addEventListener('input', (e) => {
      const row = e.target.closest('[data-i]'); if (!row || !e.target.dataset.p) return;
      pins[+row.dataset.i][e.target.dataset.p] = e.target.value;
      if (e.target.dataset.p === 'ids') row.querySelector('[data-named]').innerHTML = named(e.target.value);
    });
    pRows.addEventListener('click', (e) => { if (e.target.closest('[data-prm]')) { pins.splice(+e.target.closest('[data-i]').dataset.i, 1); drawP(); } });
    $('#pinAdd').addEventListener('click', () => { pins.push({ q: '', ids: '' }); drawP(); });
    $('#pinSave').addEventListener('click', () => {
      const out = {};
      for (const pn of pins) {
        const q = pn.q.trim().toLowerCase(); if (!q) continue;
        const ids = resolve(pn.ids);
        if (ids.includes(null)) return toast(`"${q}": a product id or SKU was not found.`, true);
        if (!ids.length || ids.length > 12) return toast(`"${q}" needs 1 to 12 products.`, true);
        out[q] = [...new Set(ids)];
      }
      const base = (D.settings || {}).pins || {};
      if (JSON.stringify(out) === JSON.stringify(base)) delete D.stage.settings.pins; else D.stage.settings.pins = out;
      saveStage(); toast('Pins staged — publish when ready.');
    });
    drawP();
  }

  /* ============================================================= SPOTLIGHT */
  function renderSpotlight(v) {
    const now = D.stage.settings.spotlight || (D.settings || {}).spotlight || (window.AA_CONFIG || {}).spotlight || { interval: 7, slides: [] };
    let slides = (now.slides || []).map((x) => ({ ...x }));
    let interval = now.interval || 7;
    v.innerHTML = `<section class="ops-panel hud brackets"><h3>Spotlight <small>slides on the home page, under the hero</small></h3>
        <p class="ops-note">Promotions: a new shipment, a used gun just in, holiday hours, a video. Each slide can point at a page here (/armory?q=glock) or a full https link. Slides with dates show only between them. No slides: the section stays hidden.</p>
        <div class="ops-bar"><label class="ops-meta">Seconds per slide <input class="ops-input" type="number" id="spInt" min="4" max="30" value="${esc(interval)}"></label><button class="btn btn-ghost btn-sm" type="button" id="spAdd">+ Add a slide</button><button class="btn btn-ice btn-sm" type="button" id="spSave">Stage spotlight</button></div>
        <div id="spRows" class="ops-form"></div></section>
      <section class="ops-panel hud brackets"><h3>Preview <small>first showing slide</small></h3><div id="spPrev"></div></section>`;
    const rows = $('#spRows');
    const productImage = (ref) => { const t = String(ref || '').trim(); const id = D.byId.has(t) ? t : (D.items.find((i) => i.sku && String(i.sku).toLowerCase() === t.toLowerCase()) || {}).id; const it = id && D.byId.get(id); return it && it.images && it.images[0] ? it.images[0] : null; };
    const preview = () => {
      const x = slides.find((sl) => sl.on !== false && sl.title);
      $('#spPrev').innerHTML = x ? `<div class="sp-slide hud brackets">${x.video ? `<div class="sp-media sp-video"><img src="${esc(x.image ? imgSrc(x.image) : '')}" alt=""><span aria-hidden="true">▶</span></div>` : x.image ? `<div class="sp-media${/^assets\/img\/(products|uploads)\//.test(x.image) ? ' sp-plate' : ''}"><img src="${esc(imgSrc(x.image))}" alt=""></div>` : `<div class="sp-media sp-holo">${holo('case')}</div>`}
        <div class="sp-text">${x.eyebrow ? `<span class="eyebrow">${esc(x.eyebrow)}</span>` : ''}<h2>${esc(x.title)}</h2>${x.text ? `<p>${esc(x.text)}</p>` : ''}${x.link ? `<span class="btn btn-ice arrow">${esc(x.cta || 'Take a look')}</span>` : ''}</div></div>` : '<p class="ops-note">No slide is showing.</p>';
    };
    const draw = () => {
      rows.innerHTML = slides.map((x, i) => `<div class="ops-notice-row" data-i="${i}">
        <label class="ops-f"><span>Headline *</span><input class="ops-input" data-s="title" maxlength="90" value="${esc(x.title || '')}" placeholder="Fresh Glock shipment on the shelf"></label>
        <label class="ops-f"><span>Eyebrow</span><input class="ops-input" data-s="eyebrow" maxlength="40" value="${esc(x.eyebrow || '')}" placeholder="New this week"></label>
        <label class="ops-f wide"><span>Line</span><input class="ops-input" data-s="text" maxlength="220" value="${esc(x.text || '')}"></label>
        <label class="ops-f"><span>Button text</span><input class="ops-input" data-s="cta" maxlength="30" value="${esc(x.cta || '')}" placeholder="See them"></label>
        <label class="ops-f"><span>Link</span><input class="ops-input" data-s="link" maxlength="300" value="${esc(x.link || '')}" placeholder="/armory?q=glock"></label>
        <label class="ops-f"><span>Photo from a product <em>(id or SKU)</em></span><input class="ops-input" data-s="product" placeholder="paste a product id or SKU"></label>
        <label class="ops-f"><span>YouTube video</span><input class="ops-input" data-s="video" maxlength="120" value="${esc(x.video || '')}" placeholder="https://youtu.be/…"></label>
        <div class="wide ops-bar">${x.image ? `<span class="ops-thumb"><img src="${esc(imgSrc(x.image))}" alt=""></span><button class="ops-link" type="button" data-sp="noimg">Remove photo</button>` : '<span class="ops-meta">No photo</span>'}
          <label class="btn btn-ghost btn-sm ops-upload">Upload a photo<input type="file" accept="image/*" hidden data-sp="up"></label></div>
        <div class="ops-row2"><label class="ops-f"><span>From</span><input class="ops-input" type="date" data-s="start" value="${esc(x.start || '')}"></label><label class="ops-f"><span>Until</span><input class="ops-input" type="date" data-s="end" value="${esc(x.end || '')}"></label></div>
        <div class="ops-toggles wide"><label><input type="checkbox" class="ops-check" data-s="on" ${x.on !== false ? 'checked' : ''}> Showing</label>
          <button class="ops-link" type="button" data-sp="up1" ${i ? '' : 'disabled'}>Move up</button><button class="ops-link" type="button" data-sp="down1" ${i < slides.length - 1 ? '' : 'disabled'}>Move down</button><button class="ops-link" type="button" data-sp="rm">Remove</button></div></div>`).join('') || '<p class="ops-note">No slides.</p>';
      preview();
    };
    rows.addEventListener('change', async (e) => {
      const row = e.target.closest('[data-i]'); if (!row) return;
      const x = slides[+row.dataset.i];
      const k = e.target.dataset.s;
      if (e.target.dataset.sp === 'up') { const [path] = await addUploads(e.target.files, x.title || 'spotlight', 'uploads'); if (path) x.image = path; draw(); return; }
      if (k === 'product') { const img = productImage(e.target.value); if (img) { x.image = img; draw(); } else toast('That product has no photo (or was not found).', true); return; }
      if (k === 'on') x.on = e.target.checked; else if (k) x[k] = e.target.value;
      preview();
    });
    rows.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sp]'); if (!b || b.dataset.sp === 'up') return;
      const i = +b.closest('[data-i]').dataset.i;
      if (b.dataset.sp === 'rm') slides.splice(i, 1);
      if (b.dataset.sp === 'noimg') delete slides[i].image;
      if (b.dataset.sp === 'up1' && i > 0) [slides[i - 1], slides[i]] = [slides[i], slides[i - 1]];
      if (b.dataset.sp === 'down1' && i < slides.length - 1) [slides[i + 1], slides[i]] = [slides[i], slides[i + 1]];
      draw();
    });
    $('#spAdd').addEventListener('click', () => { if (slides.length >= 8) return toast('At most 8 slides.', true); slides.push({ id: 's' + Date.now().toString(36), title: '', on: true }); draw(); });
    $('#spSave').addEventListener('click', () => {
      try {
        interval = Math.max(4, Math.min(30, Number($('#spInt').value) || 7));
        const clean = slides.map((x) => {
          if (!String(x.title || '').trim()) throw new Error('Every slide needs a headline');
          const vid = ytId(x.video); if (vid === null) throw new Error(`"${x.title}": that is not a YouTube link`);
          if (x.link && !/^(\/(?!\/)|https:\/\/)/.test(x.link.trim())) throw new Error(`"${x.title}": a link starts with / (a page here) or https://`);
          const o = { id: x.id || 's' + Date.now().toString(36), on: x.on !== false, title: x.title.trim() };
          for (const k of ['eyebrow', 'text', 'cta', 'link', 'start', 'end', 'image']) if (x[k] && String(x[k]).trim()) o[k] = String(x[k]).trim();
          if (vid) o.video = vid;
          return o;
        });
        D.stage.settings.spotlight = { interval, slides: clean };
        saveStage(); toast('Spotlight staged — publish when ready.');
      } catch (err) { toast(err.message, true); }
    });
    draw();
  }

  /* =============================================================== HISTORY */
  async function renderHistory(v) {
    if (S.preview || !(S.status || {}).github) { v.innerHTML = setupPanel('History', 'Every change published from this console is a commit in the site\'s repository, with who made it and when.', ['Connect publishing: <code>GH_TOKEN</code> on the Render service.']); return; }
    v.innerHTML = '<div class="ops-empty">Loading…</div>';
    try {
      const { commits } = await api('/api/ops/history');
      const label = (f) => ({ 'assets/data/overrides.json': 'corrections', 'assets/data/site-settings.json': 'store settings', 'assets/data/custom-products.json': 'listings' }[f] || f);
      v.innerHTML = `<section class="ops-panel hud brackets"><h3>Published changes <small>newest first</small></h3>
        <p class="ops-note">To undo a change, edit it back here and publish again — every version stays in git.</p>
        <ul class="ops-list">${commits.map((c) => `<li><span><b>${esc(c.message)}</b> <small class="ops-meta">· ${esc(c.author)} · ${esc(c.date ? new Date(c.date).toLocaleString() : '')} · ${esc(c.files.map(label).join(', '))}</small></span><span class="act">${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.sha.slice(0, 7))}</a>` : ''}</span></li>`).join('') || '<li><span>Nothing published yet.</span></li>'}</ul></section>`;
    } catch (e) { v.innerHTML = setupPanel('History', e.message, ['Check <code>GH_TOKEN</code>.']); }
  }

  /* ================================================================= GUIDE */
  function renderGuide(v) {
    const how = [
      ['Publish anything', 'Every change is staged first (the amber bar at the bottom counts them). Review, then Publish to the site: one commit, and the site rebuilds in about three minutes. Nothing changes on the site before that.'],
      ['Feature a product on the home page', 'Inventory → find it → ★. Or open it and tick Featured. Publish.'],
      ['Take down a bad photo', 'Inventory → ◫ on the row (the hologram shows instead). Photos & gaps lists every pulled photo with a Restore button.'],
      ['Put up your own photo', 'Open the product → Photos → Upload photos. The first photo is the cover; ‹ › reorder, × removes. Publish.'],
      ['List a used or consignment gun', 'Your listings → Add a listing: name, department, price, condition, photos, description. It shows in the Armory with a Used / Consignment badge.'],
      ['Hide a product', 'Inventory → ⊘. Hidden products leave the catalogue; Corrections → Show again brings one back.'],
      ['Change hours, phone or transfer fees', 'Store & notices → Store facts → Stage → Publish.'],
      ['Post a closure or announcement', 'Store & notices → Notices → Add a notice (dates optional). It shows above the ticker on every page.'],
      ['Promote something on the home page', 'Spotlight → Add a slide: headline, line, button, a product photo or an upload, or a YouTube video.'],
      ['Help people find things', 'Search → see what people type and what found nothing; add Synonyms (g19 = glock 19) and Pins (what comes first for a word).'],
      ['Answer a hold request', 'Inbox → open it → Call / Email → set Contacted or Holding, add a note. With email alerts on, each one also lands in your mailbox.'],
      ['Compare two price lists', 'Tools → CSV diff: drop last week\'s and this week\'s file.'],
      ['Check the site is healthy', 'Tools → Run the site check.'],
    ];
    v.innerHTML = `<section class="ops-panel hud brackets"><h3>How to</h3><ol class="ops-steps">${how.map(([t, d]) => `<li class="done"><b>${esc(t)}</b><small>${esc(d)}</small></li>`).join('')}</ol></section>`;
  }

  /* ============================================================= PUBLISHING */
  function reviewHtml() {
    const items = Object.entries(D.stage.products).map(([id, st]) => {
      const it = D.byId.get(id); const o = D.overrides[id] || {};
      const name = it ? it.name : (o._name || id);
      return `<li><b>${esc(name)}</b> <small>· ${esc(describe(st).join(' · '))}</small></li>`;
    });
    const sets = Object.keys(D.stage.settings).map((k) => `<li><b>${esc(SETTING_LABEL[k] || k)}</b> <small>· replaced with the staged version</small></li>`);
    const known = new Map(D.custom.map((c) => [c.id, c]));
    const lists = [
      ...Object.values(D.stage.custom.upsert).map((c) => `<li><b>${esc(c.name)}</b> <small>· ${known.has(c.id) ? 'updated' : 'new listing'}${c.price ? ` · ${esc(money(c.price))}` : ''}${c.cond ? ` · ${esc(c.cond)}` : ''} · ${num((c.images || []).length)} photo${(c.images || []).length === 1 ? '' : 's'}</small></li>`),
      ...D.stage.custom.remove.map((id) => `<li><b>${esc((known.get(id) || {}).name || id)}</b> <small>· removed</small></li>`),
    ];
    const photos = stagedImagePaths();
    const missing = missingUploads();
    return `${missing.length ? `<p class="ops-note bad">${num(missing.length)} photo${missing.length === 1 ? ' was' : 's were'} picked in another tab or browser and ${missing.length === 1 ? 'is' : 'are'} not here: ${esc(missing.join(', '))}. Upload ${missing.length === 1 ? 'it' : 'them'} again or remove ${missing.length === 1 ? 'it' : 'them'} before publishing.</p>` : ''}
      ${items.length ? `<div class="ops-h">Products <small>${num(items.length)}</small></div><div class="ops-diff"><ul>${items.slice(0, 400).join('')}</ul>${items.length > 400 ? `<p class="ops-note">…and ${num(items.length - 400)} more</p>` : ''}</div>` : ''}
      ${lists.length ? `<div class="ops-h">Your listings <small>${num(lists.length)}</small></div><ul>${lists.join('')}</ul>` : ''}
      ${photos.length ? `<div class="ops-h">New photos <small>${num(photos.length)}</small></div><div class="ops-photos">${photos.slice(0, 24).map((p) => `<div class="ops-ph"><img src="${esc(imgSrc(p))}" alt="" loading="lazy"></div>`).join('')}</div>` : ''}
      ${sets.length ? `<div class="ops-h">Settings</div><ul>${sets.join('')}</ul>` : ''}
      ${!items.length && !lists.length && !photos.length && !sets.length ? '<p class="ops-note">Nothing is staged.</p>' : ''}`;
  }
  function modal(html) { const m = $('#modal'); m.innerHTML = html; m.showModal(); return m; }
  for (const d of [$('#drawer'), $('#modal')]) d.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === d) d.close(); });
  $('#reviewBtn').addEventListener('click', () => modal(`<div class="ops-dhead"><div><span class="eyebrow">Staged, not live yet</span><h3 id="modalTitle">Review</h3></div><button class="ops-x" type="button" data-close aria-label="Close">×</button></div><div class="ops-mbody">${reviewHtml()}</div>`));
  $('#discardBtn').addEventListener('click', () => {
    const m = modal(`<div class="ops-dhead"><div><span class="eyebrow">Discard</span><h3 id="modalTitle">Throw away every staged edit?</h3></div><button class="ops-x" type="button" data-close aria-label="Close">×</button></div>
      <div class="ops-mbody"><p class="ops-note">Nothing on the site changes. This only clears what is staged on this computer.</p><div class="ops-bar"><button class="btn btn-ghost btn-sm" type="button" data-close>Keep them</button><button class="btn btn-ice btn-sm" type="button" id="discardYes">Discard</button></div></div>`);
    $('#discardYes', m).addEventListener('click', () => { clearStage(); m.close(); route(); toast('Staged edits discarded.'); });
  });
  $('#publishBtn').addEventListener('click', () => {
    if (S.preview || !(S.status || {}).github) {
      modal(`<div class="ops-dhead"><div><span class="eyebrow">Publishing</span><h3 id="modalTitle">Publishing isn't connected</h3></div><button class="ops-x" type="button" data-close aria-label="Close">×</button></div>
        <div class="ops-mbody"><p class="ops-note">${S.preview ? 'This is preview mode.' : 'The server has no GH_TOKEN.'} To publish from here, add a fine-grained GitHub token for this repository (Contents: Read and write) as <b>GH_TOKEN</b> on the Render service.</p>
        <p class="ops-note">Meanwhile: Tools → Export staged edits, then on your PC <b>node scripts/apply-ops-edits.mjs ops-edits.json</b> and push.</p></div>`);
      return;
    }
    if (missingUploads().length) { $('#reviewBtn').click(); toast('Some staged photos are not in this browser — see Review.', true); return; }
    const m = modal(`<div class="ops-dhead"><div><span class="eyebrow">One commit, one deploy</span><h3 id="modalTitle">Publish to the site</h3></div><button class="ops-x" type="button" data-close aria-label="Close">×</button></div>
      <div class="ops-mbody">${reviewHtml()}
        <div class="ops-row2"><label class="ops-f"><span>Your name <em>(for the change log)</em></span><input class="ops-input" id="pubBy" maxlength="40" value="${esc(ls.get('aa-ops-by', ''))}"></label><label class="ops-f"><span>Note <em>(optional)</em></span><input class="ops-input" id="pubNote" maxlength="500" placeholder="Holiday hours, pulled two bad photos…"></label></div>
        <div class="ops-progress" id="pubProg" hidden><div data-s="commit">Saving the change to the repository</div><div data-s="deploy">Render rebuilds and deploys (2–4 minutes)</div><div data-s="live">Live on the site</div></div>
        <div class="ops-bar"><button class="btn btn-ghost btn-sm" type="button" data-close>Cancel</button><button class="btn btn-ice btn-sm" type="button" id="pubGo">Publish</button></div></div>`);
    $('#pubGo', m).addEventListener('click', async () => {
      const by = $('#pubBy', m).value.trim(); ls.set('aa-ops-by', by);
      const prog = $('#pubProg', m); prog.hidden = false;
      const step = (s, cls) => { const el = prog.querySelector(`[data-s="${s}"]`); if (el) el.className = cls; };
      $('#pubGo', m).disabled = true;
      step('commit', 'on');
      const sent = JSON.parse(JSON.stringify(D.stage));
      const custom = { upsert: Object.values(sent.custom.upsert), remove: sent.custom.remove };
      const uploads = stagedImagePaths().map((p) => ({ path: p, data: UP.get(p).b64 }));
      let r;
      try {
        r = await api('/api/ops/publish', { method: 'POST', body: {
          products: Object.keys(sent.products).length ? sent.products : undefined,
          settings: Object.keys(sent.settings).length ? sent.settings : undefined,
          custom: custom.upsert.length || custom.remove.length ? custom : undefined,
          uploads: uploads.length ? uploads : undefined,
          by, note: $('#pubNote', m).value.trim(),
        } });
      } catch (e) { step('commit', 'fail'); toast(e.message, true); $('#pubGo', m).disabled = false; return; }
      // the edits are in the repo now: fold them into what the console knows, clear the stage
      for (const [id, st] of Object.entries(sent.products)) {
        if (st === null) { delete D.overrides[id]; continue; }
        const cur = { ...(D.overrides[id] || {}) };
        for (const [k, val] of Object.entries(st)) { if (val === null || (val === false && BOOLS.includes(k))) delete cur[k]; else cur[k] = val; }
        if (!cur.noPhoto) delete cur._photo;
        if (Object.keys(cur).some((k) => !k.startsWith('_'))) D.overrides[id] = cur; else delete D.overrides[id];
      }
      D.settings = { ...D.settings, ...sent.settings };
      if (custom.upsert.length || custom.remove.length) {
        const map = new Map(D.custom.map((c) => [c.id, c]));
        for (const c of custom.upsert) map.set(c.id, c);
        for (const id of custom.remove) map.delete(id);
        D.custom = [...map.values()];
        syncCustomItems();
      }
      clearStage();
      step('commit', 'done');
      const link = prog.querySelector('[data-s="commit"]'); if (r.url) link.innerHTML = `Saved — <a href="${esc(r.url)}" target="_blank" rel="noopener">commit ${esc(String(r.commit).slice(0, 7))}</a>`;
      step('deploy', 'on');
      const t0 = Date.now();
      const poll = async () => {
        try {
          const d = await api('/api/ops/deploy');
          D.deploy = d; statusChips();
          if (d.deployed && r.commit && d.deployed.startsWith(String(r.commit).slice(0, 7)) || (d.deployed && d.head && d.deployed === d.head && Date.now() - t0 > 60000)) {
            step('deploy', 'done'); step('live', 'done'); toast('Live on the site.'); return;
          }
        } catch { /* the server restarts during a deploy: keep waiting */ }
        if (Date.now() - t0 > 15 * 60000) { step('deploy', 'fail'); prog.querySelector('[data-s="deploy"]').textContent = 'Still deploying after 15 minutes — check the Render dashboard.'; return; }
        setTimeout(poll, 12000);
      };
      setTimeout(poll, 15000);
      route();
    });
  });

  /* ================================================================== BOOT */
  gate();
})();
