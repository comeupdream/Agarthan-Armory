/*
 * EVERY REALM — the whole home page, in every realm, and the trip that grows under it.
 *
 * Five passes down the real home page, one per realm, each thirteen and a half seconds:
 * the saucer pointer works the real Realm button in the header, the camera stops on the banner
 * and the pointer turns it from the manifesto to "3–5 day lead times" over the realm's own
 * crystal, then the whole page goes by, lingering on what that realm shows (the departments,
 * the lasers, the way down, the map, the relics, the geode field behind the Silent Vault and
 * the gate) to the footer, and a rush back up to the top for the next realm. POLAR NIGHT (blue
 * fluorite), VRIL (green quartz and glowing geodes), INNER EARTH (rhodochrosite, the way down),
 * BLACK & WHITE (the Naica cave), AGARTHAN CRYSTAL (amethyst).
 *
 * The trip grows the whole way: trails from the first pass, then tracers (the page's own edges
 * echoing outward in colour), breathing and bubble print, a little more each realm. The last
 * pass ends on the banner, the lead time over the amethyst, and the trip is made of the site's
 * own crystals: the camera pushes into the amethyst geode; the giga-geode's amethyst pillars
 * become a looping ring (the tunnel wraps whatever is on screen); the rhodochrosite and the
 * green geode halves orbit the seal over the amethyst bed, trailing tracers; every realm's
 * crystal (fluorite, green quartz, rhodochrosite, amethyst) becomes the ring in turn; and only
 * a moment of mirrors, on the glowing geodes. On the way down, back on the banner, the page's
 * script changes under it (Runic, Old World, Future). CALM: the name walks the scripts.
 *
 * Future font throughout until the end. No space: the sky behind the page is aurora only.
 */

// the realm passes: the first starts at START, each lasts LEN; the realm clicks, in film seconds
export const START = 2.4, LEN = 13.6;
export const SWITCHES = [[16.6, 'vril', 1], [30.2, 'inner-earth', 2], [43.8, 'mono', 1], [57.4, 'crystal', 2]];
export const TRIP = START + 5 * LEN;   // 70.4
// the page's script on the way down from the trip, the banner back in view: [t, font]
export const FONTS = [[83.3, 'runic'], [84.0, 'oldworld'], [84.7, 'future']];
// the calm's changes of script on the name: [t, font] (the plates' order below)
export const OUTRO = [[85.9, 'future'], [87.2, 'runic'], [88.1, 'oldworld'], [88.6, 'future']];
const FPS = 30;

function act(t, S) {
  const { seg, ease, at, lerp } = S;
  const W = innerWidth, H = innerHeight;
  // (the act runs inside the page, so it carries its own copies of the timings)
  const START = 2.4, LEN = 13.6, TRIP = START + 5 * LEN;
  const SW = [[16.6, 'vril'], [30.2, 'inner-earth'], [43.8, 'mono'], [57.4, 'crystal']];
  const FONTS = [[83.3, 'runic'], [84.0, 'oldworld'], [84.7, 'future']];
  const LABEL = {
    polar: ['01', 'Polar Night', 'blue fluorite · the ice cave'],
    vril: ['02', 'Vril', 'green quartz · glowing geodes'],
    'inner-earth': ['03', 'Inner Earth', 'rhodochrosite · the way down opens'],
    mono: ['04', 'Black & White', 'silver · the Naica cave'],
    crystal: ['05', 'Agarthan Crystal', 'amethyst · the ice-wall money'],
  };
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  const sm = (x) => x * x * (3 - 2 * x);

  /* ---------- once: the banner moved by the film, not by its own timer or snap; every realm's crystal preloaded ---------- */
  at('setup', 0, () => {
    const st = document.createElement('style');
    st.textContent = `.banner-track{scroll-snap-type:none!important;scroll-behavior:auto!important}
      .prefs-btn{background:rgba(var(--accent-rgb),.16)}`;
    document.head.appendChild(st);
    for (const r of ['inner-earth', 'crystal', 'vril', 'mono', 'polar']) { const i = new Image(); i.src = `assets/img/feature/realm/${r}/geode-tile.webp`; }
    for (const r of ['inner-earth', 'crystal', 'vril', 'mono']) { const i = new Image(); i.src = `assets/img/feature/realm/${r}/manifesto-1280.webp`; }
    // THE TRIP's stage: the realms' own crystals, laid over the page and shown in turn
    const R = 'assets/img/feature/realm/';
    // (max-width:none: the site caps every image at its parent's width, and the ring has none)
    const stone = (src, k) => `<img class="__st" src="${src}" style="position:absolute;left:0;top:0;width:230px;height:auto;max-width:none;filter:drop-shadow(0 18px 30px rgba(0,0,0,.75))" data-k="${k}">`;
    const ring = [];
    for (let k = 0; k < 9; k++) ring.push(stone(['assets/img/feature/realm/inner-earth/rhodochrosite-760.webp', 'assets/img/realm-src/green-geode-left.png', 'assets/img/realm-src/green-geode-right.png'][k % 3], k));
    const T = document.createElement('div'); T.id = '__trip';
    T.style.cssText = 'position:fixed;inset:0;z-index:2147482200;pointer-events:none;opacity:0;background:#05020c;overflow:hidden';
    T.innerHTML = `<div id="__am" style="position:absolute;inset:0;background:url('${R}crystal/amethyst-geode-1600.webp') 50% 50%/cover no-repeat;opacity:0"></div>
      <div id="__pil" style="position:absolute;inset:0;display:flex;justify-content:center;align-items:stretch;opacity:0">
        <img src="assets/img/eye/giga-geode.webp" style="height:100%;width:auto;transform:scaleX(-1)"><img src="assets/img/eye/giga-geode.webp" style="height:100%;width:auto"><img src="assets/img/eye/giga-geode.webp" style="height:100%;width:auto;transform:scaleX(-1)"></div>
      <div id="__bed" style="position:absolute;inset:-45%;background-size:520px;background-position:50% 50%;opacity:0"></div>
      <div id="__ring" style="position:absolute;left:50%;top:50%;width:0;height:0;opacity:0">${ring.join('')}</div>
      <img id="__seal" src="assets/img/brand/seal-600.png" style="position:absolute;left:50%;top:50%;width:250px;height:250px;margin:-125px 0 0 -125px;opacity:0;filter:drop-shadow(0 0 46px rgba(199,155,255,.85))">
      <div id="__glow" style="position:absolute;inset:0;background:#000 url('${R}vril/glowing-geodes-1500.webp') 50% 50%/cover no-repeat;opacity:0"></div>`;
    document.body.appendChild(T);
    for (const r of ['polar', 'vril', 'inner-earth', 'crystal']) { const i = new Image(); i.src = `${R}${r}/geode-tile.webp`; }
  });
  // the banner moves on by itself every 8 s unless somebody is on it: the film is always on it
  const man = document.querySelector('.manifesto');
  if (man) man.dispatchEvent(new PointerEvent('pointerenter'));

  /* ---------- where things are, in this realm's layout ---------- */
  const NAV = (document.querySelector('.site-header') || { offsetHeight: 68 }).offsetHeight;
  const box = (sel) => { const e = [...document.querySelectorAll(sel)].find((x) => x.offsetParent); if (!e) return null; const r = e.getBoundingClientRect(); return r.height ? { top: r.top + scrollY, h: r.height } : null; };
  const aim = (sel) => { const b = box(sel); return b ? Math.max(0, b.top - NAV - Math.max(0, H - NAV - b.h) / 2) : null; };
  const bottom = () => document.documentElement.scrollHeight - H;

  /* ---------- the scroll: top, the banner, then the whole page lingering on each exhibit, and back ---------- */
  const i = t < START ? -1 : Math.min(4, Math.floor((t - START) / LEN));
  const s = START + i * LEN, r = t - s, last = i === 4;
  // the long run down: time is spent unevenly, slowing near each exhibit (a Gaussian of "slowness" per stop)
  const run = (u) => {
    const tbl = S.memo('run' + i, () => {
      const a = aim('.banner') || 0, b = bottom();
      const stops = ['#departments', '#into-the-dark article.chapter', '.realm-vista', '#map', '#featured', '#silent-vault', '#gate-in-the-wall']
        .map(aim).filter((v) => v != null && v > a + 200 && v < b - 100);
      const N = 400, ys = [], cum = [0];
      for (let k = 0; k <= N; k++) ys.push(a + (b - a) * k / N);
      for (let k = 1; k <= N; k++) {
        const y = (ys[k] + ys[k - 1]) / 2;
        let slow = 1;
        for (const p of stops) slow += 2.6 * Math.exp(-(((y - p) / 300) ** 2));
        cum.push(cum[k - 1] + slow);
      }
      return { ys, cum: cum.map((c) => c / cum[N]) };
    });
    let lo = 0, hi = tbl.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tbl.cum[m] <= u) lo = m; else hi = m; }
    const f = (u - tbl.cum[lo]) / Math.max(1e-9, tbl.cum[hi] - tbl.cum[lo]);
    return lerp(tbl.ys[lo], tbl.ys[hi], f);
  };
  let y = 0, slide = 0;
  if (i >= 0) {
    const aB = aim('.banner') || 0;
    if (t >= TRIP) y = S.memo('trip-y', () => aB);
    else if (r < 1.2) y = 0;
    else if (r < 2.6) y = lerp(0, aB, ease.inOut(seg(r, 1.2, 2.6)));
    else if (r < 4.4) y = aB;
    else if (r < 12.0) {
      // ease in and out of the run, a steady pace between
      const u = seg(r, 4.4, 12.0), k = 0.12;
      const v = u < k ? (u * u) / (2 * k * (1 - k)) : u > 1 - k ? 1 - ((1 - u) * (1 - u)) / (2 * k * (1 - k)) : (u - k / 2) / (1 - k);
      y = run(v);
    } else if (r < 12.3) y = bottom();
    else y = lerp(S.memo('bot' + i, bottom), last ? aB : 0, ease.inOut(seg(r, 12.3, 13.6)));
    slide = sm(seg(r, 3.3, 3.9));
    if (!last && r > 12.9) slide = 0;   // back to the manifesto, out of sight, for the next realm
    if (t >= TRIP) slide = 1;
  }
  scrollTo(0, y);
  const track = document.querySelector('.banner-track');
  if (track) {
    track.scrollLeft = slide * track.clientWidth;
    document.querySelectorAll('.banner-nav .sp-dot').forEach((d, k) => d.setAttribute('aria-pressed', String(k === Math.round(slide))));
  }

  /* ---------- the pointer: idles; works the Realm button at each switch; presses the banner's arrow each pass ---------- */
  const btn = () => S.mid('.prefs-btn');
  const optSel = (v) => `.prefs-opt[data-k="theme"][data-v="${v}"]`;
  const opt = (v) => { const e = document.querySelector(optSel(v)); const rr = e && e.getBoundingClientRect(); return rr && rr.width ? [rr.left + rr.width / 2, rr.top + rr.height / 2] : btn(); };
  const arrow = () => S.mid('.banner-nav .sp-arrow[data-d="1"]');
  const idle = (tt) => [W * 0.62 + 170 * Math.sin(tt * 0.5), H * 0.6 + 90 * Math.sin(tt * 0.37 + 1)];
  let p = idle(t), press = 0;
  for (const [tc, v] of SW) {
    if (t < tc - 1.3 || t >= tc + 1.6) continue;
    const o = tc - 0.55, c = tc + 0.6;
    if (t < o) p = mix(idle(tc - 1.3), btn(), ease.inOut(seg(t, tc - 1.3, o - 0.05)));
    else if (t < tc) p = mix(btn(), opt(v), ease.inOut(seg(t, o + 0.08, tc - 0.08)));
    else if (t < c) p = mix(opt(v), btn(), ease.inOut(seg(t, tc + 0.1, c - 0.05)));
    else p = mix(btn(), idle(tc + 1.6), ease.inOut(seg(t, c, tc + 1.6)));
    at('open-' + tc, o, () => S.click('.prefs-btn', ...btn()));
    at('pick-' + tc, tc, () => S.click(optSel(v), ...opt(v)));
    at('close-' + tc, c, () => S.click('.prefs-btn', ...btn()));
    for (const x of [o, tc, c]) press = Math.max(press, 1 - Math.abs(t - x) / 0.12);
  }
  if (i >= 0 && r >= 2.5 && r < 4.4) {
    const ta = s + 3.3;
    if (r < 3.2) p = mix(idle(s + 2.5), arrow(), ease.inOut(seg(r, 2.5, 3.2)));
    else if (r < 3.5) p = arrow();
    else p = mix(arrow(), idle(s + 4.4), ease.inOut(seg(r, 3.5, 4.4)));
    press = Math.max(press, 1 - Math.abs(t - ta) / 0.12);
  }
  S.cursor(p[0], p[1] + Math.sin(t * 2.2) * 3, { scale: 1.8 * (1 - 0.18 * Math.max(0, press)), show: t > 1.2 && t < TRIP - 0.4 });

  /* ---------- the realm, named at the corner of the frame after each click ---------- */
  let lab = document.getElementById('__realm');
  if (!lab) {
    lab = document.createElement('div'); lab.id = '__realm';
    lab.style.cssText = 'position:fixed;left:64px;bottom:58px;z-index:2147482000;pointer-events:none;font:400 13px/1.6 var(--f-mono);letter-spacing:.3em;text-transform:uppercase;color:var(--cyan);text-shadow:0 2px 14px rgba(0,0,0,.85)';
    document.body.appendChild(lab);
  }
  const done = SW.filter(([tc]) => t >= tc), cur = done.length ? done[done.length - 1][1] : 'polar';
  const since = done.length ? t - done[done.length - 1][0] : t - 2.6;
  const L = LABEL[cur];
  if (lab.dataset.k !== cur) {
    lab.dataset.k = cur;
    lab.innerHTML = `Realm ${L[0]}<br><b style="display:block;margin:6px 0 4px;font:700 30px/1.15 var(--f-display);letter-spacing:.1em;color:var(--frost);text-shadow:0 0 22px rgba(var(--accent-rgb),.55)">${L[1]}</b><span style="font-size:12px;letter-spacing:.24em;color:var(--sub,#cfe3f0)">${L[2]}</span>`;
  }
  lab.style.opacity = String(Math.max(0, Math.min(seg(since, 0.2, 0.7), 1 - seg(since, 3.4, 3.9))));
  lab.style.transform = `translateY(${(1 - seg(since, 0.2, 0.7)) * 14}px)`;

  /* ---------- THE TRIP: the realms' own crystals ---------- */
  const T = document.getElementById('__trip');
  if (T && t >= TRIP - 0.5) {
    const op = (el, v) => { el.style.opacity = Math.max(0, Math.min(1, v)).toFixed(3); };
    op(T, sm(seg(t, 71.0, 71.8)) * (1 - sm(seg(t, 82.4, 83.2))));
    // 1. into the amethyst geode, as if the push into the banner went on into the crystal
    const am = document.getElementById('__am');
    op(am, 1 - sm(seg(t, 72.2, 72.8)));
    am.style.transform = `scale(${lerp(1.3, 1.0, ease.out(seg(t, 71.0, 72.8)))})`;
    // 2. the giga-geode's amethyst pillars, wrapped into a looping ring by the lens
    const pil = document.getElementById('__pil');
    op(pil, sm(seg(t, 72.2, 72.8)) * (1 - sm(seg(t, 76.0, 76.6))));
    pil.style.transform = `translateY(${-30 * Math.sin(t * 0.6)}px)`;
    // 3. the stones orbit the seal over the amethyst bed; 4. every realm's crystal in turn
    const bed = document.getElementById('__bed');
    op(bed, sm(seg(t, 76.0, 76.6)) * (1 - sm(seg(t, 81.0, 81.6))));
    const tiles = ['polar', 'vril', 'inner-earth', 'crystal'];
    const which = t < 79.4 ? 'crystal' : tiles[Math.min(3, Math.floor((t - 79.4) / 0.5))];
    const url = `url("assets/img/feature/realm/${which}/geode-tile.webp")`;
    if (bed.dataset.k !== which) { bed.dataset.k = which; bed.style.backgroundImage = url; }
    bed.style.filter = `brightness(${t < 79.4 ? 0.45 : 1})`;
    bed.style.transform = `rotate(${(t - 76) * 4}deg) scale(${1 + 0.04 * Math.sin(t * Math.PI)})`;
    const ring = document.getElementById('__ring'), seal = document.getElementById('__seal');
    const rv = sm(seg(t, 76.4, 77.0)) * (1 - sm(seg(t, 79.2, 79.6)));
    op(ring, rv); op(seal, rv);
    const breath = 0.5 + 0.5 * Math.sin(t * Math.PI);
    seal.style.transform = `scale(${0.9 + 0.12 * breath}) rotate(${(t - 76.4) * -12}deg)`;
    ring.querySelectorAll('.__st').forEach((el, k) => {
      const a = k * 2 * Math.PI / 9 + (t - 76.4) * 0.9, R0 = 380 + 40 * breath;
      const pop = ease.out(seg(t, 76.4 + k * 0.05, 76.9 + k * 0.05));
      el.style.transform = `translate(${R0 * Math.cos(a) - 115}px, ${R0 * 0.62 * Math.sin(a) - 100}px) rotate(${(t - 76.4) * (k % 2 ? 40 : -30) + k * 40}deg) scale(${pop * (0.85 + 0.25 * (0.5 + 0.5 * Math.sin(a)))})`;
      el.style.zIndex = String(Math.round(100 + 100 * Math.sin(a)));
    });
    // 5. a moment of mirrors, on the geodes glowing under ultraviolet
    op(document.getElementById('__glow'), sm(seg(t, 81.0, 81.5)) * (1 - sm(seg(t, 82.3, 82.9))));
  }

  /* ---------- the way down: the page changes script under the trip ---------- */
  for (const [tc, f] of FONTS) at('font-' + tc, tc, () => S.click(`.prefs-opt[data-k="font"][data-v="${f}"]`, W / 2, H / 2));

  /* ---------- CALM: a veil over the page for the name ---------- */
  let veil = document.getElementById('__veil');
  if (!veil) {
    veil = document.createElement('div'); veil.id = '__veil';
    veil.style.cssText = 'position:fixed;inset:0;z-index:2147482300;pointer-events:none;background:radial-gradient(ellipse 80% 70% at 50% 50%, rgba(10,4,22,.72), rgba(4,2,10,.92));opacity:0';
    document.body.appendChild(veil);
  }
  veil.style.opacity = sm(seg(t, 85.0, 86.2)).toFixed(3);
  document.querySelector('.site-header').style.opacity = String(1 - sm(seg(t, TRIP + 0.4, TRIP + 1.6)));
}

/* ---------- Stage B: the trip ---------- */
function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  const beat = (tt) => Math.exp(-(((tt % 0.5) + 0.5) % 0.5) * 7);
  const B = t * Math.PI;   // one breath every two seconds, on the bar (120 BPM)

  // aurora only behind the page: no stars, no nebula
  const u = { sky: [0.32, 0, 0], bloom: 0.22, glow: 0.36, grain: 0.016, hue: 0, chroma: 0.001, trails: 0.06, cam: [1, 0, 0], zoom: 1, pan: [0, 0], warp: 0.001 };
  const ACC = { polar: [[0.365, 0.894, 1], [0.365, 1, 0.694]], 'inner-earth': [[1, 0.70, 0.28], [1, 0.48, 0.27]], mono: [[0.95, 0.95, 0.95], [0.7, 0.7, 0.7]], vril: [[0.365, 1, 0.61], [0.84, 1, 0.365]], crystal: [[0.78, 0.61, 1], [1, 0.82, 0.48]] };
  const realm = SWITCHES.filter(([tc]) => t >= tc).map(([, r]) => r).pop() || 'polar';
  [u.accent, u.accent2] = ACC[realm];
  // Black & White stays black and white: the trip's colours are drained with the page's
  if (realm === 'mono') u.sat = 0.1;

  // THE BUILD: the trip grows a little every realm (I goes 0 → 1 over the five passes)
  const I = sm(seg(3, TRIP));
  const tr = sm(seg(12, 30));   // tracers creep in from the second realm
  u.trails = 0.06 + 0.12 * I;
  u.warp = 0.001 + 0.003 * I;
  u.chroma = 0.001 + 0.0025 * I;
  u.edge = [(0.14 + 0.5 * I) * tr, 2 + 5 * I, 0.005 + 0.006 * I, B];
  u.edgeTint = 0.35;   // through the tour the tracers lean to the page's own colours
  u.breathe = [0.55 * I * I * tr, B];
  u.bubble = [0.2 * sm(seg(48, TRIP)), 44, 1];
  u.bloom = 0.22 + 0.06 * I; u.glow = 0.36 + 0.08 * I;
  u.cam = [1, 1.6 * I * Math.sin(t * 0.31), 1.1 * I * Math.sin(t * 0.23)];

  if (t < 2.6) {
    // the page arrives out of the dark
    const arr = sm(seg(0, 2.4));
    u.cam = [arr, -10 * (1 - arr), 6 * (1 - arr)];
    u.black = 1 - sm(seg(0, 0.7));
  }
  // each pass: the swoop to the banner, the run down the page, the rush back up
  for (let i = 0; i < 5 && t < TRIP + 0.1; i++) {
    const s = START + i * LEN;
    const swoop = Math.sin(Math.PI * seg(s + 1.2, s + 2.6));
    const run = Math.sin(Math.PI * seg(s + 4.4, s + 12.0));
    const rush = Math.sin(Math.PI * seg(s + 12.3, s + 13.6));
    u.trails = Math.max(u.trails, 0.08 + (0.18 + 0.12 * I) * Math.max(swoop, 0.7 * run), 0.1 + (0.32 + 0.12 * I) * rush);
    u.zoom += 0.02 * swoop + 0.05 * rush;
    u.warp += 0.002 * swoop + 0.006 * rush;
    u.chroma += 0.0025 * rush;
    // the banner's turn to the lead time: a small kick
    const kick = t >= s + 3.3 ? Math.exp(-(t - s - 3.3) * 5) : 0;
    u.chroma += 0.003 * kick;
  }
  // each realm click repaints the page from the frame before it, on a scan line or in glitch slices
  for (const [tc, , kind] of SWITCHES) {
    if (t >= tc && t < tc + 0.6) { u.wipe = seg(tc, tc + 0.55); u.held = Math.round(tc * FPS) - 1; u.wipeKind = kind; }
    const kick = t >= tc ? Math.exp(-(t - tc) * 4) : 0;
    u.chroma += 0.004 * kick; u.warp += 0.004 * kick;
  }

  // THE TRIP, made of the realms' own crystals (act): into the amethyst; the giga-geode's pillars as a
  // looping ring (the tunnel wraps whatever is on screen); the stones' orbit, trailing; every realm's
  // crystal as the ring in turn; a moment of mirrors on the glowing geodes; the way down
  if (t >= TRIP && t < 85.4) {
    const on = sm(seg(TRIP, 72.0)) * (1 - sm(seg(82.6, 85.4)));
    u.edge = [0.75 * on, 3 + 5 * on, 0.009, B];
    u.edgeTint = 0.85 * on;   // the tracers echo each crystal in its own colour
    u.breathe = [0.8 * on, B];
    u.bubble = [Math.max(u.bubble[0] * (1 - on), 0.12 * on), 40, 1];
    u.trails = 0.18 + 0.16 * on;
    u.warp = 0.002 + 0.004 * on; u.chroma = 0.0015 + 0.003 * on;
    u.bloom = 0.24 + 0.06 * on; u.glow = 0.4 + 0.08 * on;
    u.cam = [1, 2.2 * on * Math.sin(t * 0.5), 1.6 * on * Math.sin(t * 0.37)];
    // into the crystal: the push into the banner carries on into the amethyst
    const push = sm(seg(TRIP, 71.8)) * (1 - sm(seg(71.8, 72.6)));
    u.zoom = 1 + 0.35 * push;
    // the amethyst ring
    const tb = sm(seg(72.5, 73.1)) * (1 - sm(seg(75.8, 76.4)));
    // every realm's crystal as the ring
    const td = sm(seg(79.5, 79.9)) * (1 - sm(seg(81.0, 81.4)));
    if (tb > 0) u.tunnel = [0.92 * tb, (t - 72.5) * 1.5, 0.22, 0.3 * tb];
    if (td > 0) u.tunnel = [0.9 * td, (t - 79.5) * 2.2, 0.35, 0.3 * td];
    u.zoom += 0.04 * Math.max(tb, td) * beat(t);
    // the stones' orbit leaves its trail
    const tc = sm(seg(76.4, 77.0)) * (1 - sm(seg(79.2, 79.6)));
    u.trails = Math.max(u.trails, 0.42 * tc);
    // only a moment of mirrors
    const te = sm(seg(81.5, 81.9)) * (1 - sm(seg(82.3, 82.7)));
    u.kaleido = 0.5 * te; u.kalN = 6;
    // each change of script glitches the page from the frame before it
    for (const [tc2] of FONTS) if (t >= tc2 && t < tc2 + 0.45) { u.wipe = seg(tc2, tc2 + 0.4); u.held = Math.round(tc2 * FPS) - 1; u.wipeKind = 2; }
  } else if (t >= 85.4) {
    // CALM: the name over the veiled page, walking the scripts; a slow ripple at each change; the dark
    let rip = 0;
    for (const [tc] of OUTRO) if (t >= tc) rip = Math.max(rip, Math.exp(-(t - tc) * 2.6));
    u.trails = 0.12 + 0.25 * rip; u.warp = 0.0015 + 0.02 * rip; u.chroma = 0.0015 + 0.004 * rip;
    u.edge = [0, 0, 0, 0]; u.breathe = [0, 0]; u.bubble = [0, 40, 1];
    u.bloom = 0.26; u.glow = 0.45; u.cam = [1, 0, 0];
    const e = sm(seg(85.6, 86.6));
    let cur = 0;
    OUTRO.forEach(([tc], k) => { if (t >= tc) cur = k; });
    const ix = { future: 0, runic: 1, oldworld: 2 };
    const idx = ix[OUTRO[cur][1]], prev = cur > 0 ? ix[OUTRO[cur - 1][1]] : null;
    const k = sm(Math.min(1, (t - OUTRO[cur][0]) / 0.3));
    u.plates = [{ i: idx, x: 0, y: 0.01, h: 0.6 + 0.012 * sm(seg(85.6, 89.4)), a: e * (cur === 0 ? 1 : k), glow: 0.35 + 0.3 * rip }];
    if (prev != null && k < 1) u.plates.unshift({ i: prev, x: 0, y: 0.01, h: 0.6, a: e * (1 - k), glow: 0.35 });
    u.zoom = 1 + 0.03 * sm(seg(86, 89.8));
    u.page = 1 - 0.94 * sm(seg(85.0, 86.2));   // the page fades away under the name
    u.black = sm(seg(89.0, 89.95));
  }
  return u;
}

export default {
  key: 'every-realm',
  poster: 74.6,
  title: 'Every Realm — the whole home page in every realm, the banner turning to the lead time, and a trip made of the realms’ own crystals',
  dur: 90,
  url: '/index.html',
  prefs: { cursor: 'disc', font: 'future' },
  act,
  lens,
  plates: ['wordmark@future@crystal', 'wordmark@runic@crystal', 'wordmark@oldworld@crystal'],
  cues: [
    { t: 0.3, kind: 'arrive' },
    ...[0, 1, 2, 3, 4].flatMap((i) => {
      const s = START + i * LEN;
      return [{ t: s + 1.2, kind: 'swoop' }, { t: s + 3.3, kind: 'click' }, { t: s + 3.3, kind: 'shift' }, { t: s + 4.4, kind: 'swoop' },
        ...(i < 4 ? [{ t: s + 12.3, kind: 'zoom' }] : [{ t: s + 12.3, kind: 'relic' }])];
    }),
    ...SWITCHES.flatMap(([tc]) => [{ t: tc - 0.55, kind: 'click' }, { t: tc, kind: 'realm' }, { t: tc + 0.6, kind: 'click' }]),
    { t: TRIP, kind: 'trip' }, { t: 72.5, kind: 'tunnel' }, { t: 76.4, kind: 'orbit' }, { t: 76.4, kind: 'peak' },
    { t: 79.5, kind: 'tunnel' }, { t: 81.5, kind: 'mandala' }, { t: 82.6, kind: 'down' },
    ...FONTS.map(([t, font]) => ({ t, kind: 'font', font })),
    { t: 85.4, kind: 'calm' }, { t: 85.8, kind: 'seal' },
    ...OUTRO.map(([t, font]) => ({ t, kind: 'font', font })),
  ],
};
