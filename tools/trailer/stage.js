/* =============================================================================
 * stage.js — the in-page runtime for filming the real site (Stage A).
 *
 * Injected into a site page by render.mjs before any site script runs. Time is
 * virtual: render.mjs freezes the page clock (Playwright's clock), and every
 * frame calls __stage.frame(t), which runs the film's act(t, S), drives every
 * CSS animation and transition to that time, and seeks videos to it. So a frame
 * is a function of t, and a slow machine never drops one.
 *
 * S (the helpers an act gets):
 *   S.seg(t, a, b)          0→1 progress of t across [a, b], clamped
 *   S.ease.*                inOut, out, in, back, expo
 *   S.keys(t, [[t,v]…])     piecewise-linear (or eased) value along keyframes
 *   S.at(id, t0, fn)        run fn once when the film first reaches t0
 *   S.rect(el) / S.mid(el)  viewport rect / centre of an element (or selector)
 *   S.cursor(x, y, opts)    the drawn pointer (the site's own --cursor SVG)
 *   S.click(el, x, y)       a real click, with the pointerdown the site listens for
 *   S.craft(id, opts)       a UFO overlay: disc, tictac, triangle, orb, mother
 *   S.abduct(el, p, craft)  lift an element up a craft's beam (p 0→1)
 *   S.sparks(...)           particles rising in a beam
 * ===========================================================================*/
(function () {
  'use strict';
  /* ---------- determinism: a seeded Math.random before any site script ---------- */
  let seed = 0x5eed1e;
  Math.random = function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* ---------- the films never show the store's few real product photos ---------- */
  let catalog;
  Object.defineProperty(window, 'AA_CATALOG', {
    configurable: true,
    get() { return catalog; },
    set(v) { if (v && v.items) v.items.forEach((i) => { i.images = []; }); catalog = v; },
  });

  const S = {};
  const clamp = (S.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x));
  const lerp = (S.lerp = (a, b, p) => a + (b - a) * p);
  S.seg = (t, a, b) => clamp((t - a) / (b - a));
  S.ease = {
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    out: (p) => 1 - Math.pow(1 - p, 3),
    in: (p) => p * p * p,
    expo: (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2),
    back: (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    sine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  };
  S.keys = (t, ks, ease = S.ease.inOut) => {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) {
        const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
        const p = ease((t - t0) / (t1 - t0));
        return Array.isArray(v0) ? v0.map((v, k) => lerp(v, v1[k], p)) : lerp(v0, v1, p);
      }
    }
    return ks[ks.length - 1][1];
  };
  const fired = new Set();
  S.at = (id, t0, fn) => { if (S.t >= t0 && !fired.has(id)) { fired.add(id); fn(); } };
  const $ = (S.$ = (s) => (typeof s === 'string' ? document.querySelector(s) : s));
  S.$$ = (s) => [...document.querySelectorAll(s)];
  S.rect = (el) => $(el).getBoundingClientRect();
  S.mid = (el) => { const r = S.rect(el); return [r.left + r.width / 2, r.top + r.height / 2]; };
  // remember a value the first time it is asked for (e.g. where an element started)
  const memo = new Map();
  S.memo = (key, fn) => { if (!memo.has(key)) memo.set(key, fn()); return memo.get(key); };

  /* ---------- overlay: everything the film draws over the page ---------- */
  let ov;
  function overlay() {
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = '__ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden';
    document.body.appendChild(ov);
    return ov;
  }

  /* ---------- the pointer: whatever the site's cursor setting draws ---------- */
  const ARROW = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M6 3l19 11.5-8.4 1.9L12.6 25z" fill="#fff" stroke="#03101c" stroke-width="1.6" stroke-linejoin="round"/></svg>');
  let cur;
  S.cursor = (x, y, { scale = 1.6, show = true, img = null } = {}) => {
    if (!cur) {
      cur = document.createElement('img');
      cur.style.cssText = 'position:absolute;left:0;top:0;width:32px;height:32px;transform-origin:0 0;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))';
      overlay().appendChild(cur);
    }
    let src = ARROW, hx = 6, hy = 3;
    const v = getComputedStyle(document.documentElement).getPropertyValue('--cursor').trim();
    const m = /url\("?(.*?)"?\)\s+(\d+)\s+(\d+)/.exec(v);
    if (img) src = img; else if (m) { src = m[1].replace(/\\"/g, '"'); hx = +m[2]; hy = +m[3]; }
    if (cur.getAttribute('src') !== src) cur.setAttribute('src', src);
    cur.style.display = show ? 'block' : 'none';
    cur.style.transform = `translate(${x - hx * scale}px, ${y - hy * scale}px) scale(${scale})`;
    return [x, y];
  };
  S.click = (el, x, y) => {
    el = $(el);
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerType: 'mouse' }));
    if (el) el.click(); else document.body.click();
  };

  /* ---------- craft: the site's own fleet, at mothership scale ---------- */
  const CRAFT = {
    disc: `<defs><linearGradient id="h_ID" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2fcff"/><stop offset=".55" stop-color="#7fb3d1"/><stop offset="1" stop-color="#1c3550"/></linearGradient>
        <linearGradient id="d_ID" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8ffff" stop-opacity=".95"/><stop offset="1" stop-color="var(--cyan,#5de4ff)" stop-opacity=".35"/></linearGradient></defs>
      <path d="M54 48Q80 16 106 48z" fill="url(#d_ID)" stroke="#bff6ff" stroke-width="1"/>
      <ellipse cx="80" cy="52" rx="64" ry="13" fill="url(#h_ID)"/><ellipse cx="80" cy="57" rx="52" ry="5" fill="#0b2238"/>
      <g class="lt"><circle cx="38" cy="54" r="3"/><circle cx="59" cy="57" r="3"/><circle cx="80" cy="58" r="3"/><circle cx="101" cy="57" r="3"/><circle cx="122" cy="54" r="3"/></g>
      <ellipse cx="80" cy="64" rx="22" ry="4" fill="#9ff3ff" opacity=".8"/>`,
    tictac: `<defs><linearGradient id="h_ID" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#cfe6f2"/><stop offset="1" stop-color="#6d8ea3"/></linearGradient></defs>
      <rect x="22" y="38" width="116" height="30" rx="15" fill="url(#h_ID)" stroke="#03101c" stroke-width="1.2"/>
      <path d="M40 50h80" stroke="var(--cyan,#5de4ff)" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
      <ellipse cx="80" cy="70" rx="18" ry="3" fill="#9ff3ff" opacity=".7"/>`,
    triangle: `<path d="M80 22L138 66H22z" fill="#0a0f18" stroke="var(--cyan,#5de4ff)" stroke-width="1.6"/>
      <path d="M80 34L118 62H42z" fill="none" stroke="var(--cyan,#5de4ff)" stroke-opacity=".35" stroke-width="1"/>
      <g class="lt"><circle cx="80" cy="30" r="4"/><circle cx="32" cy="62" r="4"/><circle cx="128" cy="62" r="4"/></g><circle cx="80" cy="52" r="3.6" fill="#ff5f73"/>`,
    orb: `<defs><radialGradient id="o_ID"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#ecf9ff"/><stop offset="1" stop-color="var(--cyan,#5de4ff)" stop-opacity="0"/></radialGradient></defs>
      <circle cx="80" cy="46" r="34" fill="url(#o_ID)"/><circle cx="80" cy="46" r="11" fill="#fff"/>`,
  };
  CRAFT.mother = CRAFT.disc;
  const crafts = {};
  S.craft = (id, { type = 'disc', x = 0, y = 0, size = 220, rot = 0, beam = 0, beamLen = 420, beamW = 1, opacity = 1, spin = 0 } = {}) => {
    let c = crafts[id];
    if (!c) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;transform-origin:50% 0';
      el.innerHTML = `<svg class="beam" viewBox="0 0 160 400" preserveAspectRatio="none" style="position:absolute;left:0;overflow:visible;max-width:none;max-height:none">
          <defs><linearGradient id="bm_${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8ffff" stop-opacity=".85"/><stop offset=".25" stop-color="var(--aurora,#5dffb1)" stop-opacity=".45"/><stop offset="1" stop-color="var(--cyan,#5de4ff)" stop-opacity="0"/></linearGradient></defs>
          <path d="M62 0h36l58 400H4z" fill="url(#bm_${id})"/>
          <g class="rings" fill="none" stroke="#dffaff"></g></svg>
        <svg class="hull" viewBox="0 0 160 100" style="position:absolute;left:0;top:0;overflow:visible;max-width:none;max-height:none;filter:drop-shadow(0 0 18px var(--cyan,#5de4ff)) drop-shadow(0 0 4px #fff)">${CRAFT[type].replace(/_ID/g, '_' + id)}</svg>`;
      overlay().appendChild(el);
      c = crafts[id] = { el, hull: el.querySelector('.hull'), beam: el.querySelector('.beam'), rings: el.querySelector('.rings'), type };
      c.hull.querySelectorAll('.lt circle').forEach((l) => l.setAttribute('fill', '#5de4ff'));
    }
    const w = size, h = size * 100 / 160;
    c.x = x; c.y = y; c.size = size; c.w = w; c.h = h;
    c.el.style.opacity = opacity;
    c.el.style.width = w + 'px'; c.el.style.height = h + 'px';
    c.el.style.transform = `translate(${x - w / 2}px, ${y - h * 0.55}px) rotate(${rot}deg)`;
    c.hull.style.width = w + 'px'; c.hull.style.height = h + 'px';
    // lights chase with time
    c.hull.querySelectorAll('.lt circle').forEach((l, i) => l.setAttribute('fill', (Math.floor(S.t * 8 + i) % 2) ? '#5dffb1' : '#5de4ff'));
    const bw = w * 1.15 * beamW;
    c.beam.style.width = bw + 'px'; c.beam.style.height = beamLen + 'px';
    c.beam.style.left = (w - bw) / 2 + 'px'; c.beam.style.top = h * 0.6 + 'px';
    c.beam.style.opacity = beam;
    c.beam.style.transformOrigin = '50% 0';
    c.beam.style.transform = `scaleY(${0.2 + 0.8 * beam})`;
    // rings rising up the beam
    let rings = '';
    for (let i = 0; i < 4; i++) {
      const p = ((S.t * 0.7 + i / 4) % 1); const yy = 400 * (1 - p); const rx = 18 + 62 * (1 - p);
      rings += `<ellipse cx="80" cy="${yy}" rx="${rx}" ry="${rx * 0.12}" stroke-opacity="${0.5 * Math.sin(Math.PI * p)}" stroke-width="1.5"/>`;
    }
    c.rings.innerHTML = rings;
    return c;
  };
  S.craftPos = (id) => { const c = crafts[id]; return c ? [c.x, c.y + c.h * 0.1] : [0, 0]; };

  /* ---------- abduction: an element rises up a beam into a craft ---------- */
  const home = new Map();
  S.abduct = (el, p, craftId, { spin = 1, wobble = 1 } = {}) => {
    el = $(el); if (!el) return;
    if (!home.has(el)) {
      el.style.transform = ''; el.style.transition = 'none';
      const r = el.getBoundingClientRect();
      home.set(el, { x: r.left + r.width / 2, y: r.top + r.height / 2, sy: scrollY, ws: el.style.willChange });
    }
    const h0 = home.get(el);
    if (p <= 0) { el.style.transform = ''; el.style.filter = ''; el.style.opacity = ''; el.style.visibility = ''; return; }
    const [tx, ty] = S.craftPos(craftId);
    const hx = h0.x, hy = h0.y - (scrollY - h0.sy);
    const lift = S.ease.inOut(p);
    const sway = Math.sin(p * Math.PI * 3) * 26 * wobble * (1 - p);
    const dx = (tx - hx) * S.ease.in(Math.min(1, p * 1.2)) + sway;
    const dy = (ty - hy) * lift;
    const s = 1 - 0.94 * S.ease.in(p);
    el.style.transformOrigin = '50% 50%';
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${spin * 540 * S.ease.in(p)}deg) scale(${s})`;
    el.style.filter = `brightness(${1 + 1.6 * p}) drop-shadow(0 0 ${8 + 30 * p}px var(--cyan, #5de4ff))`;
    el.style.opacity = String(1 - S.seg(p, 0.85, 1));
    el.style.visibility = p >= 1 ? 'hidden' : '';
  };

  /* ---------- sparks: motes of light rising up beams ---------- */
  let cv, g;
  S.sparks = (list) => {
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = innerWidth; cv.height = innerHeight;
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      overlay().prepend(cv); g = cv.getContext('2d');
    }
    g.clearRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'lighter';
    for (const { x, y, w, h, n = 40, k = 1, seed: sd = 1 } of list) {
      if (k <= 0) continue;
      for (let i = 0; i < n; i++) {
        const r1 = fract(Math.sin((i + 1) * 12.9898 * sd) * 43758.5453);
        const r2 = fract(Math.sin((i + 1) * 78.233 * sd) * 12345.678);
        const p = fract(S.t * (0.35 + 0.5 * r2) + r1);
        const px = x + (r1 - 0.5) * w * (1 - p * 0.75);
        const py = y + h - p * h;
        const a = Math.sin(Math.PI * p) * k;
        const rad = 1.2 + 2.6 * r2;
        const gr = g.createRadialGradient(px, py, 0, px, py, rad * 4);
        gr.addColorStop(0, `rgba(235,255,255,${a})`); gr.addColorStop(0.4, `rgba(93,255,177,${a * 0.5})`); gr.addColorStop(1, 'rgba(93,228,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, rad * 4, 0, Math.PI * 2); g.fill();
      }
    }
  };
  const fract = (x) => x - Math.floor(x);

  /* ---------- split a heading into letters, so they can leave one by one ---------- */
  S.letters = (el) => {
    el = $(el); if (!el || el.dataset.split) return [...el.querySelectorAll('.__l')];
    el.dataset.split = '1';
    const walk = (node) => {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const ch of n.textContent) {
            const s = document.createElement('span'); s.className = '__l'; s.textContent = ch;
            s.style.display = 'inline-block'; if (ch === ' ') s.style.width = '.3em';
            frag.appendChild(s);
          }
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      }
    };
    walk(el);
    // a frosted heading paints one gradient clipped to all its text; give each letter
    // its own copy, so a letter that leaves takes its frost with it
    const cs = getComputedStyle(el);
    const grad = cs.backgroundImage;
    const out = [...el.querySelectorAll('.__l')];
    if (grad && grad !== 'none' && /text/.test(cs.webkitBackgroundClip || cs.backgroundClip)) {
      el.style.background = 'none';
      out.forEach((s) => { s.style.backgroundImage = grad; s.style.webkitBackgroundClip = 'text'; s.style.backgroundClip = 'text'; s.style.color = 'transparent'; });
    }
    return out;
  };

  /* ---------- the frame: act, then pin every animation and video to t ---------- */
  const born = new WeakMap();
  async function frame(t, dt) {
    S.t = t; S.dt = dt;
    if (window.__act) window.__act(t, S);
    for (const a of document.getAnimations()) {
      if (!born.has(a)) born.set(a, t);
      a.pause();
      const ct = (t - born.get(a)) * 1000;
      if (a.currentTime !== ct) a.currentTime = ct;
    }
    const seeks = [];
    for (const v of document.querySelectorAll('video')) {
      if (v.__t == null) continue;
      const want = v.loop ? v.__t % v.duration : Math.min(v.__t, v.duration - 0.001);
      if (!isFinite(want) || Math.abs(v.currentTime - want) < 0.001) continue;
      seeks.push(new Promise((res) => { v.addEventListener('seeked', res, { once: true }); realDelay(res, 1500); v.currentTime = want; }));
    }
    await Promise.all(seeks);
    // what the act asked of the browser itself: the real mouse (for :hover) and navigation
    const out = { mouse: S.mouse || null, go: S.goTo || null };
    S.goTo = null;
    return out;
  }
  // a real timer for seek timeouts: the page's own timers are frozen with the clock,
  // and scheduler.postTask is not one of the functions the fake clock replaces
  const realDelay = (fn, ms) => (window.scheduler && scheduler.postTask ? scheduler.postTask(fn, { delay: ms }).catch(() => {}) : fn());
  // videos: the film owns their time; the site's player must not run them
  S.video = (el, time) => {
    el = $(el); if (!el) return;
    if (el.__t == null) { el.preload = 'auto'; el.muted = true; el.pause(); el.play = () => Promise.resolve(); if (el.readyState === 0) el.load(); }
    el.__t = time;
  };

  // go to another page of the site between frames (the act keeps running there)
  S.go = (url) => { S.goTo = url; };
  S.page = () => location.pathname.replace(/^\//, '') || 'index.html';

  window.__stage = { S, frame, ready: () => document.fonts.ready.then(() => true) };
})();
