/*
 * EVERY REALM — the whole home page, in every realm, and the trip that grows under it.
 *
 * Five passes down the real home page, one per realm, each about fourteen and a half seconds:
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
 * pass ends on the banner, the lead time over the amethyst, and it goes all the way: mirrors,
 * a tunnel, the hue turning, and the page's script changing under it (Runic, Old World,
 * Future). CALM: the name walks the scripts, and the dark.
 *
 * Future font throughout until the end. No space: the sky behind the page is aurora only.
 */

// the realm passes: the first starts at START, each lasts LEN; the realm clicks, in film seconds
export const START = 2.4, LEN = 14.6;
export const SWITCHES = [[17.6, 'vril', 1], [32.2, 'inner-earth', 2], [46.8, 'mono', 1], [61.4, 'crystal', 2]];
export const TRIP = START + 5 * LEN;   // 75.4
// the page's script during the trip: [t, font]
export const FONTS = [[78.2, 'runic'], [79.8, 'oldworld'], [81.4, 'future']];
// the calm's changes of script on the name: [t, font] (the plates' order below)
export const OUTRO = [[85.6, 'future'], [87.0, 'runic'], [88.0, 'oldworld'], [88.5, 'future']];
const FPS = 30;

function act(t, S) {
  const { seg, ease, at, lerp } = S;
  const W = innerWidth, H = innerHeight;
  // (the act runs inside the page, so it carries its own copies of the timings)
  const START = 2.4, LEN = 14.6, TRIP = START + 5 * LEN;
  const SW = [[17.6, 'vril'], [32.2, 'inner-earth'], [46.8, 'mono'], [61.4, 'crystal']];
  const FONTS = [[78.2, 'runic'], [79.8, 'oldworld'], [81.4, 'future']];
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
    else if (r < 13.0) {
      // ease in and out of the run, a steady pace between
      const u = seg(r, 4.4, 13.0), k = 0.12;
      const v = u < k ? (u * u) / (2 * k * (1 - k)) : u > 1 - k ? 1 - ((1 - u) * (1 - u)) / (2 * k * (1 - k)) : (u - k / 2) / (1 - k);
      y = run(v);
    } else if (r < 13.3) y = bottom();
    else y = lerp(S.memo('bot' + i, bottom), last ? aB : 0, ease.inOut(seg(r, 13.3, 14.6)));
    slide = sm(seg(r, 3.3, 3.9));
    if (!last && r > 13.9) slide = 0;   // back to the manifesto, out of sight, for the next realm
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

  /* ---------- the trip: the page changes script under it ---------- */
  for (const [tc, f] of FONTS) at('font-' + tc, tc, () => S.click(`.prefs-opt[data-k="font"][data-v="${f}"]`, W / 2, H / 2));

  /* ---------- CALM: a veil over the page for the name ---------- */
  let veil = document.getElementById('__veil');
  if (!veil) {
    veil = document.createElement('div'); veil.id = '__veil';
    veil.style.cssText = 'position:fixed;inset:0;z-index:2147482300;pointer-events:none;background:radial-gradient(ellipse 80% 70% at 50% 50%, rgba(10,4,22,.72), rgba(4,2,10,.92));opacity:0';
    document.body.appendChild(veil);
  }
  veil.style.opacity = sm(seg(t, 84.6, 85.8)).toFixed(3);
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

  // THE BUILD: the trip grows a little every realm (I goes 0 → 1 over the five passes)
  const I = sm(seg(3, TRIP));
  const tr = sm(seg(12, 30));   // tracers creep in from the second realm
  u.trails = 0.06 + 0.12 * I;
  u.warp = 0.001 + 0.003 * I;
  u.chroma = 0.001 + 0.0025 * I;
  u.edge = [(0.14 + 0.5 * I) * tr, 2 + 5 * I, 0.005 + 0.006 * I, B];
  u.breathe = [0.55 * I * I * tr, B];
  u.bubble = [0.2 * sm(seg(52, TRIP)), 44, 1];
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
    const run = Math.sin(Math.PI * seg(s + 4.4, s + 13.0));
    const rush = Math.sin(Math.PI * seg(s + 13.3, s + 14.6));
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

  // THE TRIP, on the lead time over the amethyst: build, PEAK (mirrors, the tunnel, the hue turning,
  // the page's script changing), come down
  if (t >= TRIP && t < 85.0) {
    const build = sm(seg(TRIP, TRIP + 2.0)), peak = sm(seg(77.4, 78.2)) * (1 - sm(seg(83.0, 84.6)));
    const down = sm(seg(83.0, 85.0)), on = build * (1 - down);
    // the hue: still through the tour, turning faster into the peak, home to a whole turn on the way down
    const speed = (x) => (x < 76 ? 0 : x < 79 ? 60 * (x - 76) / 3 : x < 83 ? 60 + 50 * sm((x - 79) / 4) : 0);
    let turned = 0;
    for (let x = 76; x < Math.min(t, 83); x += 0.01) turned += speed(x) * 0.01;
    const peakTurn = (() => { let s = 0; for (let x = 76; x < 83; x += 0.01) s += speed(x) * 0.01; return s; })();
    u.hue = t < 83 ? turned : peakTurn + (Math.ceil(peakTurn / 360) * 360 - peakTurn) * down;
    u.breathe = [Math.max(u.breathe[0], on), B];
    u.edge = [Math.max(u.edge[0], 0.95 * on), 3 + 6 * on, 0.011 + 0.005 * peak, B];
    u.bubble = [Math.max(u.bubble[0] * (1 - down), 0.32 * on + 0.36 * peak), 40 - 10 * peak, 1 + 0.8 * peak];
    u.trails = 0.16 + 0.16 * on + 0.1 * peak;
    u.warp = 0.003 + 0.007 * on + 0.006 * peak; u.chroma = 0.002 + 0.004 * on + 0.004 * peak;
    u.kaleido = 0.88 * peak; u.kalN = 6 + 2 * sm(seg(79.0, 79.6));
    const tun = sm(seg(80.8, 81.5)) * (1 - sm(seg(82.4, 83.1)));
    u.tunnel = [0.55 * tun, (t - 80.8) * 2.6, 0.35, 0.4 * tun];
    u.zoom = 1 + 0.05 * on + 0.04 * peak * beat(t);
    u.cam = [1, 3 * on * Math.sin(t * 0.5), 2.2 * on * Math.sin(t * 0.37)];
    u.bloom = 0.2 + 0.06 * peak; u.glow = 0.34 + 0.08 * peak;
    // each change of script glitches the page from the frame before it
    for (const [tc] of FONTS) if (t >= tc && t < tc + 0.45) { u.wipe = seg(tc, tc + 0.4); u.held = Math.round(tc * FPS) - 1; u.wipeKind = 2; }
  } else if (t >= 85.0) {
    // CALM: the name over the veiled page, walking the scripts; a slow ripple at each change; the dark
    let rip = 0;
    for (const [tc] of OUTRO) if (t >= tc) rip = Math.max(rip, Math.exp(-(t - tc) * 2.6));
    u.trails = 0.12 + 0.25 * rip; u.warp = 0.0015 + 0.02 * rip; u.chroma = 0.0015 + 0.004 * rip;
    u.edge = [0, 0, 0, 0]; u.breathe = [0, 0]; u.bubble = [0, 40, 1];
    u.bloom = 0.26; u.glow = 0.45; u.cam = [1, 0, 0];
    const e = sm(seg(85.4, 86.4));
    let cur = 0;
    OUTRO.forEach(([tc], k) => { if (t >= tc) cur = k; });
    const ix = { future: 0, runic: 1, oldworld: 2 };
    const idx = ix[OUTRO[cur][1]], prev = cur > 0 ? ix[OUTRO[cur - 1][1]] : null;
    const k = sm(Math.min(1, (t - OUTRO[cur][0]) / 0.3));
    u.plates = [{ i: idx, x: 0, y: 0.01, h: 0.6 + 0.012 * sm(seg(85.4, 89.4)), a: e * (cur === 0 ? 1 : k), glow: 0.35 + 0.3 * rip }];
    if (prev != null && k < 1) u.plates.unshift({ i: prev, x: 0, y: 0.01, h: 0.6, a: e * (1 - k), glow: 0.35 });
    u.zoom = 1 + 0.03 * sm(seg(86, 89.8));
    u.black = sm(seg(88.9, 89.95));
  }
  return u;
}

export default {
  key: 'every-realm',
  poster: 79.2,
  title: 'Every Realm — the whole home page in every realm, the banner turning to the lead time, and the trip that grows under it',
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
        ...(i < 4 ? [{ t: s + 13.3, kind: 'zoom' }] : [{ t: s + 13.3, kind: 'relic' }])];
    }),
    ...SWITCHES.flatMap(([tc]) => [{ t: tc - 0.55, kind: 'click' }, { t: tc, kind: 'realm' }, { t: tc + 0.6, kind: 'click' }]),
    { t: TRIP, kind: 'trip' }, { t: 77.4, kind: 'peak' }, { t: 77.4, kind: 'mandala' }, { t: 80.8, kind: 'tunnel' },
    ...FONTS.map(([t, font]) => ({ t, kind: 'font', font })),
    { t: 83.0, kind: 'down' }, { t: 85.0, kind: 'calm' }, { t: 85.4, kind: 'seal' },
    ...OUTRO.map(([t, font]) => ({ t, kind: 'font', font })),
  ],
};
