/*
 * THE WAY DOWN — through the hole at the pole, down through every realm's world, to the machine
 * at the centre of the earth.
 *
 * ACT 1, THE MAP (0–22 s). The home page arrives and the camera goes to the map beyond the ice
 * wall. The saucer pointer presses the plate's Backdrop switch (the glacier cave comes up behind
 * the map), then works the real Realm button: Vril (the aurora), Inner Earth (Petra), Black & White
 * (Symmes Hole), Agarthan Crystal (the Endurance). Each click repaints the map and lays that realm's
 * picture behind it. It scans three outposts, and goes to the pole.
 *
 * ACT 2, THE FALL (22–86 s). A click on Agartha, and the map opens: the camera goes down the hole
 * at the pole. The shaft is made of the realms' own pictures, ring inside ring, each world six rings
 * deep and the next one always visible below as the light at the bottom: POLAR NIGHT (the glacier
 * cave, fluorite), VRIL (the aurora, the geodes glowing green), INNER EARTH (Petra, the Cave of
 * Crystals), BLACK & WHITE (Symmes Hole, the crystals in silver), AGARTHAN CRYSTAL (the Endurance,
 * amethyst). Falling with the camera, in each world's colours: the Antarctica notes, the banner,
 * the Tiny Cans poster, the stones; a craft of the fleet leads the way down.
 *
 * ACT 3, THE CORE (86–104 s). At the bottom, the atom machine: the Atomium, lit and arcing, and
 * everything that fell in orbit round its heart, the banner in every realm's colours, the notes,
 * the stones. Then the heart collapses: a black hole opens in it and takes the lot.
 *
 * ACT 4, THE WAY BACK (104–110 s). Out again, up the whole shaft in four seconds, every world
 * going by, and out of the pole onto the map. CALM: the name walks the scripts.
 *
 * 120 BPM: a bar is two seconds; a world is six bars.
 */

export const REALMS_AT = [[8.4, 'vril'], [10.8, 'inner-earth'], [13.2, 'mono'], [15.6, 'crystal']];
export const CLICKS = [5.8, 7.6, 8.4, 10.8, 13.2, 15.6, 16.4, 21.6];
export const DIVE = 21.6, SHAFT = 26, CORE = 86, UP = 104.2, HOME = 108, CALM = 110;
export const WORLDS = ['polar', 'vril', 'inner-earth', 'mono', 'crystal'];
// the calm's changes of script on the name: [t, font] (the plates' order below)
export const OUTRO = [[111.4, 'future'], [113.6, 'runic'], [115.2, 'oldworld'], [116.0, 'future']];
const FPS = 30;

function act(t, S) {
  const { seg, ease, at, lerp, keys } = S;
  const W = innerWidth, H = innerHeight;
  const sm = (x) => x * x * (3 - 2 * x);
  const fr = (x) => x - Math.floor(x);
  const hash = (n) => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const win = (a, b, fi = 0.4, fo = 0.4) => sm(seg(t, a, a + fi)) * (1 - sm(seg(t, b - fo, b)));
  const F = 'assets/img/feature/';
  const art = (realm, file) => (realm === 'polar' ? F : F + 'realm/' + realm + '/') + file;
  const WORLDS = ['polar', 'vril', 'inner-earth', 'mono', 'crystal'];
  const breath = 0.5 + 0.5 * Math.sin(Math.PI * t);   // one breath a bar
  const kick = Math.exp(-fr(t / 0.5) * 3.2);          // the beat
  const UP = 104.2, HOME = 108;

  /* ================= once ================= */
  at('setup', 0, () => {
    const st = document.createElement('style');
    st.textContent = `.prefs-btn{background:rgba(var(--accent-rgb),.16)}`;
    document.head.appendChild(st);
    const cv = document.createElement('canvas'); cv.id = '__down'; cv.width = W; cv.height = H;
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147482200;pointer-events:none;opacity:0;background:#05020c';
    document.body.appendChild(cv);
    const lab = document.createElement('div'); lab.id = '__lab';
    lab.style.cssText = 'position:fixed;left:64px;bottom:58px;z-index:2147482600;pointer-events:none;opacity:0;font:400 13px/1.6 var(--f-mono);letter-spacing:.3em;text-transform:uppercase;color:#ffd27a;text-shadow:0 2px 14px rgba(0,0,0,.9)';
    document.body.appendChild(lab);
    const veil = document.createElement('div'); veil.id = '__veil';
    veil.style.cssText = 'position:fixed;inset:0;z-index:2147482700;pointer-events:none;background:radial-gradient(ellipse 80% 70% at 50% 50%, rgba(18,8,30,.74), rgba(6,3,12,.94));opacity:0';
    document.body.appendChild(veil);
    const V = (window.__wd = { img: {}, list: [], ready: false });
    const load = (key, src) => { const i = new Image(); i.src = src; V.img[key] = i; V.list.push(i); };
    const R = F + 'realm/';
    load('polar0', R + 'polar/ice-cave-1600.webp'); load('polar1', R + 'polar/fluorite-1920.webp');
    load('vril0', R + 'vril/aurora-sky-2600.webp'); load('vril1', R + 'vril/glowing-geodes-1500.webp');
    load('inner-earth0', R + 'inner-earth/petra-treasury-1600.webp'); load('inner-earth1', R + 'inner-earth/naica-1600.webp');
    load('mono0', R + 'mono/symmes-hole-980.webp'); load('mono1', R + 'mono/naica-1600.webp');
    load('crystal0', R + 'crystal/endurance-dawn-1920.webp'); load('crystal1', R + 'crystal/amethyst-geode-1600.webp');
    load('atom', R + 'crystal/atomium-1920.webp');
    for (const r of WORLDS) { load('20:' + r, art(r, 'antarctica-20-both.webp')); load('2:' + r, art(r, 'antarctica-dollars-750.webp')); load('ban:' + r, art(r, 'manifesto-1280.webp')); load('can:' + r, art(r, 'tiny-cans-640.webp')); }
    load('rhodo', R + 'inner-earth/rhodochrosite-760.webp');
    load('gl', 'assets/img/realm-src/green-geode-left.png'); load('gr', 'assets/img/realm-src/green-geode-right.png');
    load('seal', 'assets/img/brand/seal-600.png');
  });

  /* ---------- the textures and sprites, cut once everything has loaded ---------- */
  const V = window.__wd;
  if (V && !V.ready && V.list.every((i) => i.complete && i.naturalWidth)) {
    V.ready = true;
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    // a square of each picture, for the rings of the shaft
    const sq = (img, fx = 0.5, fy = 0.5) => { const N = 1024, c = mk(N, N), s = Math.max(N / img.naturalWidth, N / img.naturalHeight); c.getContext('2d').drawImage(img, (N - img.naturalWidth * s) * fx, (N - img.naturalHeight * s) * fy, img.naturalWidth * s, img.naturalHeight * s); return c; };
    V.tex = {};
    for (const r of WORLDS) V.tex[r] = [sq(V.img[r + '0'], 0.5, r === 'inner-earth' ? 0.3 : 0.5), sq(V.img[r + '1'])];
    V.core = sq(V.img.atom, 0.5, 0.5);
    const cut = (img, sx, sy, sw, sh, w, h) => { const c = mk(w, h); c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, w, h); return c; };
    V.bills = {}; V.ban = {}; V.can = {};
    for (const r of WORLDS) {
      const a = V.img['20:' + r], b = V.img['2:' + r], aw = a.naturalWidth, ah = a.naturalHeight / 2, bw = b.naturalWidth, bh = b.naturalHeight / 2;
      V.bills[r] = [cut(a, 0, 0, aw, ah, 256, 126), cut(a, 0, ah, aw, ah, 256, 126), cut(b, 0, 0, bw, bh, 256, 128), cut(b, 0, bh, bw, bh, 256, 128)];
      const m = V.img['ban:' + r]; V.ban[r] = cut(m, 0, 0, m.naturalWidth, m.naturalHeight, 320, 180);
      const k = V.img['can:' + r]; V.can[r] = cut(k, 0, 0, k.naturalWidth, k.naturalHeight, 200, 250);
    }
    V.spheres = [[962, 430, 255], [332, 365, 172], [1587, 370, 172], [427, 1135, 150], [1485, 1135, 150]].map(([cx, cy, r]) => {
      const N = 256, c = mk(N, N), g = c.getContext('2d');
      g.save(); g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 1, 0, Math.PI * 2); g.clip();
      g.drawImage(V.img.atom, cx - r * 0.97, cy - r * 0.97, r * 1.94, r * 1.94, 0, 0, N, N); g.restore();
      g.globalCompositeOperation = 'destination-in';
      const gr = g.createRadialGradient(N / 2, N / 2, N * 0.38, N / 2, N / 2, N / 2);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N);
      return c;
    });
    V.stones = ['rhodo', 'gl', 'gr'].map((k) => { const im = V.img[k], N = 256, c = mk(N, N), s = Math.min(N / im.naturalWidth, N / im.naturalHeight); c.getContext('2d').drawImage(im, (N - im.naturalWidth * s) / 2, (N - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s); return c; });
    const glow = (rgb, size = 128) => { const c = mk(size, size), g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.25, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c; };
    V.gl = { warm: glow('255,190,110'), white: glow('255,250,240'), violet: glow('170,120,255') };
  }
  const stamp = (g, img, x, y, size, a) => { if (a <= 0.003 || size < 0.5) return; g.globalAlpha = Math.min(1, a); g.drawImage(img, x - size / 2, y - size / 2, size, size); };
  const bolt = (g, x1, y1, x2, y2, seed, width, a) => {
    let pts = [[x1, y1], [x2, y2]], disp = Math.hypot(x2 - x1, y2 - y1) * 0.17, sd = seed * 13.7;
    for (let it = 0; it < 6; it++) { const np = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1; sd += 1; const r = hash(sd) * 2 - 1; np.push([(ax + bx) / 2 + (nx / nl) * disp * r, (ay + by) / 2 + (ny / nl) * disp * r], pts[i + 1]); } pts = np; disp *= 0.55; }
    for (const [w, c] of [[width * 7, `rgba(160,110,255,${0.16 * a})`], [width * 2.6, `rgba(255,170,90,${0.55 * a})`], [width, `rgba(255,250,240,${0.95 * a})`]]) { g.lineWidth = w; g.strokeStyle = c; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke(); }
  };

  /* ================= ACT 1: the map, the Backdrop switch, every realm ================= */
  const NAV = (document.querySelector('.site-header') || { offsetHeight: 68 }).offsetHeight;
  const vis = (sel) => [...document.querySelectorAll(sel)].find((x) => x.offsetParent);
  const mapSec = document.getElementById('map'), stage = document.getElementById('iceMap');
  const docTop = (el) => el.getBoundingClientRect().top + scrollY;
  // (the page's height changes with the realm, so where the map is is asked every frame)
  const yPlate = Math.max(0, docTop(mapSec) - NAV + 6);
  // (once the realms are done the map's place is fixed: the map itself is about to be scaled, and would report nonsense)
  const yMapNow = () => Math.max(0, docTop(stage) - NAV - Math.max(0, H - NAV - stage.offsetHeight) / 2);
  const yMap = t >= 16.8 ? S.memo('yMap', yMapNow) : 0;
  const dive = t >= 21.6 && t < HOME ? 1 : 0;
  let y = lerp(0, yPlate, ease.inOut(seg(t, 2.6, 4.8)));
  if (t >= 16.8) y = lerp(yPlate, yMap, ease.inOut(seg(t, 16.8, 18.2)));
  scrollTo(0, y);

  const idle = [W * 0.6 + 150 * Math.sin(t * 0.5), H * 0.66 + 70 * Math.sin(t * 0.37 + 1)];
  const mid = (sel) => { const e = typeof sel === 'string' ? vis(sel) : sel; if (!e) return idle; const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : idle; };
  const opt = (v) => `.prefs-opt[data-k="theme"][data-v="${v}"]`;
  const pole = () => { const r = stage.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const PRESS = [[5.8, '#map [data-switch="map"]'], [7.6, '.prefs-btn'], [8.4, opt('vril')], [10.8, opt('inner-earth')], [13.2, opt('mono')], [15.6, opt('crystal')], [16.4, '.prefs-btn']];
  let p = idle.slice(), press = 0;
  if (t < 22.2) {
    let tot = 0; const acc = [0, 0];
    for (const [tc, sel] of PRESS) {
      const w = sm(clamp(1 - Math.abs(t - tc) / 0.8));
      if (w > 0) { const m = mid(sel); acc[0] += w * m[0]; acc[1] += w * m[1]; tot += w; }
      press = Math.max(press, 1 - Math.abs(t - tc) / 0.12);
      at('press-' + tc, tc, () => { const e = vis(sel) || document.querySelector(sel); if (e) S.click(e, ...mid(sel)); });
    }
    const k = Math.min(1, tot), n = Math.max(1, tot);
    p = [idle[0] * (1 - k) + acc[0] / n, idle[1] * (1 - k) + acc[1] / n];
    // three outposts scanned (the map's own hover), then the pole
    const sw = sm(seg(t, 18.0, 18.6));
    if (sw > 0) {
      const nodes = [...stage.querySelectorAll('.m-node')];
      const pick = [nodes[1], nodes[4], nodes[6]].filter(Boolean).map((n) => mid(n));
      const ks = pick.map((q, i) => [18.6 + i * 0.75, q]); ks.push([21.3, pole()], [30, pole()]);
      const q = keys(t, ks, ease.inOut);
      p = [lerp(p[0], q[0], sw), lerp(p[1], q[1], sw)];
    }
    press = Math.max(press, 1 - Math.abs(t - 21.6) / 0.12);
  }
  S.cursor(p[0], p[1] + Math.sin(t * 2.2) * 3, { scale: 1.8 * (1 - 0.18 * Math.max(0, press)), show: t > 1.2 && t < 22.0 });
  S.mouse = t > 18.2 && t < 21.6 ? p : [4, H - 4];

  /* ---------- the caption at the corner of the frame ---------- */
  const CAPS = [[5.0, 7.4, 'The map · Backdrop', 'Polar Night · the glacier cave'], [8.6, 10.6, 'Realm · Backdrop', 'Vril · the aurora'], [11.0, 13.0, 'Realm · Backdrop', 'Inner Earth · Petra'],
    [13.4, 15.4, 'Realm · Backdrop', 'Black & White · Symmes Hole'], [15.8, 18.0, 'Realm · Backdrop', 'Agarthan Crystal · the Endurance'], [18.6, 21.4, 'The outposts', 'Agartha · 90°00′N'],
    [26.6, 36.6, 'The way down · I', 'Polar Night'], [38.6, 48.6, 'The way down · II', 'Vril'], [50.6, 60.6, 'The way down · III', 'Inner Earth'],
    [62.6, 72.6, 'The way down · IV', 'Black & White'], [74.6, 84.0, 'The way down · V', 'Agarthan Crystal'], [87.0, 97.0, 'The core', 'The atom machine'], [104.6, 108.0, 'The way back', 'Up, and out at the pole']];
  const lab = document.getElementById('__lab');
  if (lab) {
    const c = CAPS.find(([a, b]) => t >= a && t < b);
    if (c) {
      if (lab.dataset.k !== c[2] + c[3]) { lab.dataset.k = c[2] + c[3]; lab.innerHTML = `${c[2]}<br><b style="display:block;margin:6px 0 0;font:700 30px/1.15 var(--f-display);letter-spacing:.1em;color:#fff7ec;text-shadow:0 0 22px rgba(255,170,80,.6),0 2px 14px rgba(0,0,0,.9)">${c[3]}</b>`; }
      lab.style.opacity = String(Math.min(seg(t, c[0], c[0] + 0.4), 1 - seg(t, c[1] - 0.4, c[1])));
      lab.style.transform = `translateY(${(1 - seg(t, c[0], c[0] + 0.4)) * 14}px)`;
    } else lab.style.opacity = '0';
  }

  /* ================= ACT 2: the map opens at the pole ================= */
  if (stage) {
    // into the pole on the way down; out of it on the way back
    const zi = t < 60 ? ease.in(seg(t, 21.6, 25.6)) : 1 - ease.out(seg(t, HOME - 0.6, HOME + 1.4));
    if (zi > 0) {
      const r = stage.getBoundingClientRect(), bx = stage.offsetWidth / 2, by = stage.offsetHeight / 2;
      const [px, py] = S.memo('pole', pole);
      stage.style.transformOrigin = `${bx}px ${by}px`;
      stage.style.transform = `translate(${((W / 2 - px) * Math.min(1, zi * 3)).toFixed(1)}px, ${((H / 2 - py) * Math.min(1, zi * 3)).toFixed(1)}px) scale(${(1 + 38 * zi * zi).toFixed(3)}) rotate(${(zi * 70).toFixed(2)}deg)`;
      stage.style.zIndex = '5'; void r;
    } else stage.style.transform = '';
    // nothing of the map is drawn while the shaft covers the frame
    stage.style.visibility = t >= 25.9 && t < HOME - 0.55 ? 'hidden' : '';
    const hdr = document.querySelector('.site-header');
    if (hdr) hdr.style.opacity = String(t < 60 ? 1 - sm(seg(t, 21.8, 23.0)) : sm(seg(t, HOME + 0.6, HOME + 1.6)));
  }

  /* ---------- how deep the camera is: one ring of the shaft every two seconds ---------- */
  const depth = (tt) => {
    if (tt < 26) return -1.4 + 1.4 * ease.in(seg(tt, 23.6, 26));
    if (tt < 84) return 0.5 * (tt - 26);
    if (tt < UP) return 29 + 0.8 * ease.out(seg(tt, 84, 87));
    return lerp(29.8, -1.4, ease.inOut(seg(tt, UP, HOME)));
  };
  const d = depth(t);
  const cv = document.getElementById('__down');
  const vShaft = sm(seg(t, 24.6, 25.8)) * (1 - sm(seg(t, HOME - 0.5, HOME + 0.4)));
  if (cv) cv.style.opacity = vShaft.toFixed(3);
  if (cv && vShaft > 0 && V && V.ready) {
    const g = cv.getContext('2d'), GL = V.gl, cx = W / 2, cy = H / 2, BASE = 2.2, RS = 1180;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#05020c'; g.fillRect(0, 0, W, H);
    const atCore = t >= 84 && t < UP + 0.4;
    /* ----- the shaft: ring inside ring, the deepest first ----- */
    const n0 = Math.floor(d) - 1, twist = 0.25 * Math.sin(t * 0.3);
    for (let n = Math.min(30, n0 + 5); n >= n0; n--) {
      const r = RS * Math.pow(BASE, d - n);
      if (r < 5) continue;
      const core = n >= 30, wi = clamp(Math.floor(n / 6), 0, 4), last = n === Math.min(30, n0 + 5);
      const tex = core ? V.core : V.tex[WORLDS[wi]][((n % 2) + 2) % 2];
      g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
      if (!core && !last) g.arc(cx, cy, r / BASE - 0.5, 0, Math.PI * 2, true);
      g.clip();
      g.translate(cx, cy); g.rotate(core ? 0 : n * 0.7 + twist * (n % 2 ? 1 : -1) + (t - 26) * 0.03 * (n % 2 ? 1 : -1));
      g.drawImage(tex, -r, -r, 2 * r, 2 * r);
      g.setTransform(1, 0, 0, 1, 0, 0);
      // the deep is dark; each ledge shades the ring below it
      if (!core) {
        g.fillStyle = `rgba(5,2,12,${(0.62 * (1 - Math.min(1, r / 700))).toFixed(3)})`; g.fillRect(0, 0, W, H);
        const sh = g.createRadialGradient(cx, cy, r / BASE, cx, cy, Math.min(r, (r / BASE) * 1.55));
        sh.addColorStop(0, 'rgba(0,0,0,.78)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
      }
      g.restore();
      // a rim of light on each ledge
      g.globalCompositeOperation = 'lighter'; g.lineWidth = Math.max(1, r * 0.006);
      g.strokeStyle = `rgba(255,214,160,${(0.5 * Math.min(1, r / 300) * (0.6 + 0.4 * breath)).toFixed(3)})`;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    // the light at the bottom
    g.globalCompositeOperation = 'lighter';
    if (!atCore) stamp(g, GL.warm, cx, cy, 300 + 60 * kick, 0.5); stamp(g, GL.violet, cx, cy, 620, 0.25 * (0.6 + 0.4 * breath));
    g.globalCompositeOperation = 'source-over';

    /* ----- what falls with the camera: the notes, the banner, the cans, the stones, in this world's colours ----- */
    const falling = t < 85 || t >= UP;
    if (falling) {
      const world = WORLDS[clamp(Math.floor((d + 0.4) / 6), 0, 4)], out = t < 85 ? 1 - sm(seg(t, 83, 85)) : 1;
      for (let i = 0; i < 38; i++) {
        const h1 = hash(i * 1.37 + 1), h2 = hash(i * 2.11 + 7), h3 = hash(i * 3.71 + 3);
        const zf = fr(h2 + d * 0.36);
        const al = h1 * 6.283 + 0.25 * Math.sin(t * 0.4 + i), rad = 50 + 1280 * Math.pow(zf, 1.8);
        const x = cx + rad * Math.cos(al), yy = cy + rad * Math.sin(al) * 0.82, sz = (26 + 250 * Math.pow(zf, 1.5)) * (0.6 + 0.8 * h3);
        const a = Math.min(1, zf * 5) * Math.min(1, (1 - zf) * 4) * out; if (a < 0.02) continue;
        const kind = i % 6, phi = t * (1.6 + 2 * h3) + i;
        g.globalAlpha = a; g.setTransform(1, 0, 0, 1, x, yy); g.rotate(al + Math.PI / 2 + 0.4 * Math.sin(phi * 0.5));
        if (kind < 2) { const c = Math.cos(phi), w = sz * 1.5, hh = w * 0.5 * Math.max(0.08, Math.abs(c)); g.drawImage(V.bills[world][(kind ? 2 : 0) + (c < 0 ? 1 : 0)], -w / 2, -hh / 2, w, hh); }
        else if (kind === 2) g.drawImage(V.ban[world], -sz * 0.9, -sz * 0.5, sz * 1.8, sz * 1.0);
        else if (kind === 3) g.drawImage(V.can[world], -sz * 0.5, -sz * 0.62, sz, sz * 1.25);
        else if (kind === 4) g.drawImage(world === 'vril' ? V.stones[1 + (i % 2)] : world === 'inner-earth' || world === 'crystal' ? V.stones[0] : V.spheres[1 + (i % 4)], -sz * 0.55, -sz * 0.55, sz * 1.1, sz * 1.1);
        else g.drawImage(V.spheres[i % 5], -sz * 0.5, -sz * 0.5, sz, sz);
      }
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    }

    /* ----- ACT 3, THE CORE: the atom machine, and everything that fell in orbit round its heart ----- */
    if (atCore) {
      const tau = t - 86, on = sm(seg(t, 85, 87.4)), r30 = RS * Math.pow(BASE, d - 30), k = r30 / 512;
      // where the photo's spheres are on screen (the core's square is the photo scaled by 0.6624, cut 124 px at each side)
      const P = {}; for (const [key, sx, sy, sr] of [['TL', 332, 365, 172], ['TC', 962, 430, 255], ['TR', 1587, 370, 172], ['BL', 427, 1135, 150], ['BR', 1485, 1135, 150], ['C', 960, 790, 120]]) P[key] = [cx + (sx * 0.6624 - 123.9 - 512) * k, cy + (sy * 0.6624 - 512) * k, sr * 0.6624 * k];
      const BONDS = [['TL', 'TC'], ['TC', 'TR'], ['TL', 'BL'], ['TR', 'BR'], ['TL', 'C'], ['TR', 'C'], ['BL', 'C'], ['BR', 'C'], ['TC', 'C']];
      g.globalCompositeOperation = 'lighter';
      stamp(g, GL.warm, P.C[0], P.C[1], 760 * (0.8 + 0.4 * breath), 0.6 * on); stamp(g, GL.white, P.C[0], P.C[1], 240 * (0.8 + 0.5 * kick), 0.5 * on);
      for (const key of ['TL', 'TC', 'TR', 'BL', 'BR']) { const [x, yy, r] = P[key]; stamp(g, GL.warm, x, yy, r * 3.2, 0.3 * on * (0.6 + 0.4 * breath)); stamp(g, GL.violet, x, yy, r * 4.4, 0.16 * on); }
      BONDS.forEach(([a, b], i) => { for (let q = 0; q < 3; q++) { const pp = fr(t * 0.6 + i * 0.137 + q / 3); stamp(g, GL.warm, lerp(P[b][0], P[a][0], pp), lerp(P[b][1], P[a][1], pp), 60, 0.7 * on * Math.sin(Math.PI * pp)); } });
      const kb = Math.floor(tau / 0.5), ta = 86 + kb * 0.5;
      if (tau > 1.5 && t - ta < 0.26) for (let m = 0; m < 2; m++) {
        const [a, b] = BONDS[(kb * 3 + m * 4) % 8], A = P[a], Bp = P[b], dx = Bp[0] - A[0], dy = Bp[1] - A[1], dd = Math.hypot(dx, dy) || 1;
        bolt(g, A[0] + (dx / dd) * A[2] * 0.85, A[1] + (dy / dd) * A[2] * 0.85, Bp[0] - (dx / dd) * Bp[2] * 0.85, Bp[1] - (dy / dd) * Bp[2] * 0.85, kb * 100 + m * 7 + Math.floor((t - ta) * 15), 3.4, 1 - (t - ta) / 0.26);
      }
      g.globalCompositeOperation = 'source-over';
      // the orbit: the banner in every realm's colours, the notes, the stones; what is behind the heart first
      const pop = ease.out(seg(tau, 1.0, 2.6)), obj = [];
      for (let q = 0; q < 5; q++) { const a = q * 1.2566 + tau * 0.7; obj.push({ z: Math.sin(a), x: cx + 690 * Math.cos(a), y: cy + 40 + 690 * 0.42 * Math.sin(a), kind: 0, q, a }); }
      for (let q = 0; q < 10; q++) { const a = q * 0.6283 - tau * 1.0; obj.push({ z: Math.sin(a), x: cx + (430 + 30 * breath) * Math.cos(a), y: cy + 40 + 430 * 0.5 * Math.sin(a), kind: 1, q, a }); }
      for (let q = 0; q < 6; q++) { const a = q * 1.0472 + tau * 1.5; obj.push({ z: Math.sin(a), x: cx + 235 * Math.cos(a), y: cy + 40 + 235 * 0.55 * Math.sin(a), kind: 2, q, a }); }
      obj.sort((a, b) => a.z - b.z);
      for (const o of obj) {
        const dp = 0.78 + 0.34 * (o.z + 1) / 2; g.globalAlpha = (0.55 + 0.45 * (o.z + 1) / 2) * pop;
        g.setTransform(1, 0, 0, 1, o.x, o.y);
        if (o.kind === 0) { const w = 330 * dp * pop; g.rotate(0.12 * Math.sin(tau + o.q)); g.drawImage(V.ban[WORLDS[o.q]], -w / 2, -w * 0.28, w, w * 0.5625); }
        else if (o.kind === 1) { const phi = tau * 3 + o.q * 0.9, c = Math.cos(phi), w = 210 * dp * pop, hh = w * 0.5 * Math.max(0.08, Math.abs(c)); g.rotate(o.a + Math.PI / 2); g.drawImage(V.bills[WORLDS[o.q % 5]][(o.q % 2 ? 2 : 0) + (c < 0 ? 1 : 0)], -w / 2, -hh / 2, w, hh); }
        else { const s2 = 150 * dp * pop; g.rotate(tau * (o.q % 2 ? 0.7 : -0.5) + o.q); g.drawImage(V.stones[o.q % 3], -s2 / 2, -s2 / 2, s2, s2); }
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
      g.globalAlpha = 1;
    }
  }
  // a craft of the fleet leads the way down, a different one in each world
  if (t > 25 && t < 85.5) {
    const wi = clamp(Math.floor((t - 26) / 12), 0, 4), type = ['disc', 'tictac', 'triangle', 'orb', 'disc'][wi];
    const inW = (t - 26) - wi * 12, show = t < 26 ? seg(t, 25.2, 26) : Math.min(seg(inW, 0, 0.8), 1 - seg(inW, 11.2, 12));
    for (let j = 0; j < 5; j++) S.craft('esc' + j, { type: ['disc', 'tictac', 'triangle', 'orb', 'disc'][j], x: W / 2 + 190 * Math.sin(t * 0.9), y: H / 2 - 40 + 110 * Math.sin(t * 1.3 + 1), size: 150 + 30 * Math.sin(t * 0.7), rot: 10 * Math.sin(t * 0.9 + 0.6), opacity: j === wi ? show : 0 });
    void type;
  } else if (t >= 85.5 && t < 86.5) for (let j = 0; j < 5; j++) S.craft('esc' + j, { type: ['disc', 'tictac', 'triangle', 'orb', 'disc'][j], x: -400, y: -400, size: 100, opacity: 0 });

  /* ================= CALM: a veil over the page for the name ================= */
  const veil = document.getElementById('__veil');
  if (veil) veil.style.opacity = sm(seg(t, 109.6, 110.8)).toFixed(3);
  void dive; void win;
}

/* ================= Stage B: the trip ================= */
function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  const win = (a, b, fi = 0.4, fo = 0.4) => sm(seg(a, a + fi)) * (1 - sm(seg(b - fo, b)));
  const beat = Math.exp(-((((t % 0.5) + 0.5) % 0.5)) * 6);
  const B = t * Math.PI;
  const ACC = { polar: [[0.365, 0.894, 1], [0.365, 1, 0.694]], 'inner-earth': [[1, 0.70, 0.28], [1, 0.48, 0.27]], mono: [[0.95, 0.95, 0.95], [0.7, 0.7, 0.7]], vril: [[0.365, 1, 0.61], [0.84, 1, 0.365]], crystal: [[0.78, 0.61, 1], [1, 0.82, 0.48]] };
  const realm = REALMS_AT.filter(([tc]) => t >= tc).map(([, r]) => r).pop() || 'polar';
  const u = { sky: [0.3, 0, 0], bloom: 0.22, glow: 0.36, grain: 0.016, hue: 0, chroma: 0.001, trails: 0.06, cam: [1, 0, 0], zoom: 1, pan: [0, 0], warp: 0.001, accent: ACC[realm][0], accent2: ACC[realm][1] };

  // the page arrives out of the dark, and goes down to the map
  if (t < 2.6) { const arr = sm(seg(0, 2.4)); u.cam = [arr, -10 * (1 - arr), 6 * (1 - arr)]; u.black = 1 - sm(seg(0, 0.7)); }
  for (const [a, b] of [[2.6, 4.8], [16.8, 18.2]]) { const k = Math.sin(Math.PI * seg(a, b)); u.trails = Math.max(u.trails, 0.08 + 0.28 * k); u.zoom += 0.03 * k; u.warp += 0.004 * k; }
  // each realm click repaints the map, and its picture behind it, on a scan line or in glitch slices
  REALMS_AT.forEach(([tc], i) => { if (t >= tc && t < tc + 0.6) { u.wipe = seg(tc, tc + 0.55); u.held = Math.round(tc * FPS) - 1; u.wipeKind = i % 2 ? 2 : 1; } });
  for (const tc of CLICKS) { const k = t >= tc ? Math.exp(-(t - tc) * 5) : 0; u.chroma += 0.003 * k; u.warp += 0.002 * k; }
  if (realm === 'mono' && t < 15.6) u.sat = 0.1;
  // the trip creeps in over the map
  const I = sm(seg(6, 21));
  if (t >= 5 && t < 26) {
    u.edge = [0.32 * I, 2 + 2 * I, 0.004 + 0.002 * I, B]; u.edgeTint = 0.85; u.breathe = [0.22 * I, B];
    u.trails = Math.max(u.trails, 0.07 + 0.12 * I);
    // the map opens: the fall into the pole
    const dv = sm(seg(DIVE, 25.8));
    u.trails = Math.max(u.trails, 0.5 * dv); u.chroma += 0.005 * dv; u.warp += 0.008 * dv; u.zoom += 0.12 * dv; u.bloom += 0.1 * dv;
    u.cam = [1, 2 * dv * Math.sin(t * 1.3), 1.4 * dv * Math.sin(t * 1.1)];
  }

  // THE FALL: every world's own colours echo off its rings; each world a little further gone than the last
  if (t >= 26 && t < CORE) {
    const wi = Math.min(4, Math.floor((t - 26) / 12)), inW = (t - 26) - wi * 12, G = (wi + inW / 12) / 5;
    [u.accent, u.accent2] = ACC[WORLDS[wi]];
    u.sky = [0, 0, 0];
    // Black & White stays black and white (the world below shows in its own colours as it comes up)
    if (wi === 3) u.sat = 0.1 + 0.9 * sm(seg(26 + 4 * 12 - 1.2, 26 + 4 * 12)); else if (wi === 2) u.sat = 1 - 0.9 * sm(seg(26 + 3 * 12 - 0.4, 26 + 3 * 12 + 0.4));
    u.edge = [0.3 + 0.36 * G, 3 + 4 * G, 0.006 + 0.004 * G, B]; u.edgeTint = 0.9;
    u.breathe = [0.3 + 0.4 * G, B]; u.bubble = [0.14 * sm(seg(62, 84)), 42, 1];
    u.trails = 0.3 + 0.22 * G; u.chroma = 0.002 + 0.003 * G; u.warp = 0.003 + 0.004 * G;
    u.bloom = 0.28 + 0.08 * G; u.glow = 0.44 + 0.08 * G;
    u.cam = [1, 1.6 * Math.sin(t * 0.37), 1.2 * Math.sin(t * 0.29)];
    u.zoom = 1 + 0.03 * beat;
    // arriving in a world: a kick; and a moment of mirrors at the bottom of the last one
    const k = Math.exp(-inW * 2.6); u.chroma += 0.005 * k; u.zoom += 0.04 * k;
    u.kaleido = 0.5 * win(82.6, 84.4, 0.4, 0.4); u.kalN = 6;
  }

  // THE CORE: the machine breathing; then its heart collapses
  if (t >= CORE && t < UP) {
    u.sky = [0, 0, 0]; [u.accent, u.accent2] = ACC.crystal;
    const form = sm(seg(96.4, 98.6)), feed = sm(seg(98.6, 102.4)), fall = sm(seg(102.2, 103.8));
    const rs = 0.06 * form + 0.05 * feed + 0.95 * fall * fall;
    u.edge = [0.5, 5, 0.008, B]; u.edgeTint = 0.9; u.breathe = [0.55, B];
    u.trails = 0.4 + 0.2 * feed; u.chroma = 0.003 + 0.005 * feed; u.warp = 0.004 + 0.005 * feed;
    u.bloom = 0.34; u.glow = 0.5 + 0.2 * feed; u.zoom = 1 + 0.04 * beat;
    u.cam = [1, 1.2 * Math.sin(t * 0.37), 0.9 * Math.sin(t * 0.29)];
    u.bh = [0, 0.03, rs, rs * (1.7 + 0.7 * feed)];
    u.disk = [(0.7 * form + 0.35 * feed) * (1 - fall), 0.22, t * (0.9 + 2.2 * feed), 4.6];
    u.swirl = 1.2 * form + 7 * feed + 10 * fall;
    u.black = sm(seg(103.5, 104.0));
  }

  // THE WAY BACK: out of the dark, up the shaft with every world streaking by, and out at the pole
  if (t >= UP && t < CALM + 0.2) {
    const up = win(UP, HOME + 0.2, 0.5, 0.8), wi = Math.max(0, Math.min(4, Math.floor(lerp(4.99, 0, seg(UP, HOME)))));
    [u.accent, u.accent2] = ACC[t < HOME ? WORLDS[wi] : 'crystal'];
    if (t < HOME + 0.4) u.sky = [0, 0, 0];
    u.black = Math.max(0, 1 - sm(seg(UP - 0.2, UP + 0.7)));
    u.edge = [0.5 * up, 4, 0.007, B]; u.edgeTint = 0.9; u.breathe = [0.4 * up, B];
    u.trails = 0.12 + 0.45 * up; u.chroma = 0.0015 + 0.005 * up; u.warp = 0.002 + 0.006 * up; u.zoom = 1 + 0.1 * up;
    u.bloom = 0.26 + 0.1 * up; u.glow = 0.4 + 0.1 * up;
  }

  if (t >= CALM + 0.2) {
    // CALM: the name over the veiled page, walking the scripts; a slow ripple at each change; the dark
    [u.accent, u.accent2] = ACC.crystal;
    let rip = 0;
    for (const [tc] of OUTRO) if (t >= tc) rip = Math.max(rip, Math.exp(-(t - tc) * 2.6));
    u.trails = 0.12 + 0.25 * rip; u.warp = 0.0015 + 0.02 * rip; u.chroma = 0.0015 + 0.004 * rip;
    u.edge = [0, 0, 0, 0]; u.breathe = [0, 0]; u.bloom = 0.26; u.glow = 0.45; u.cam = [1, 0, 0]; u.zoom = 1;
    const e = sm(seg(110.4, 111.4));
    let cur = 0;
    OUTRO.forEach(([tc], k) => { if (t >= tc) cur = k; });
    const ix = { future: 0, runic: 1, oldworld: 2 };
    const idx = ix[OUTRO[cur][1]], prev = cur > 0 ? ix[OUTRO[cur - 1][1]] : null;
    const k = sm(Math.min(1, (t - OUTRO[cur][0]) / 0.3));
    u.plates = [{ i: idx, x: 0, y: 0.01, h: 0.6 + 0.012 * sm(seg(110.4, 119.4)), a: e * (cur === 0 ? 1 : k), glow: 0.35 + 0.3 * rip }];
    if (prev != null && k < 1) u.plates.unshift({ i: prev, x: 0, y: 0.01, h: 0.6, a: e * (1 - k), glow: 0.35 });
    u.zoom = 1 + 0.03 * sm(seg(110.4, 119.8));
    u.page = 1 - 0.94 * sm(seg(109.8, 111.0));
    u.black = sm(seg(119.0, 119.95));
  }
  return u;
}
function lerp(a, b, p) { return a + (b - a) * p; }

export default {
  key: 'way-down',
  poster: 55.0,
  title: 'The Way Down — through the hole at the pole, down through every realm’s world, to the atom machine at the centre of the earth',
  dur: 120,
  url: '/index.html',
  prefs: { cursor: 'disc', font: 'future' },
  act,
  lens,
  // the way back passes eight rings of light and dark a second: blended over nine frames it is a streak,
  // not a flicker (tools/trailer/smooth.mjs, after the render and before the sound)
  smooth: [[104.0, 108.7, 9]],
  plates: ['wordmark@future@crystal', 'wordmark@runic@crystal', 'wordmark@oldworld@crystal'],
  cues: [
    { t: 0.3, kind: 'arrive' }, { t: 2.6, kind: 'swoop' },
    { t: 5.8, kind: 'click' }, { t: 5.8, kind: 'holo' }, { t: 7.6, kind: 'click' },
    ...REALMS_AT.map(([t]) => ({ t, kind: 'realm' })), { t: 16.4, kind: 'click' }, { t: 16.8, kind: 'swoop' },
    ...[18.6, 19.35, 20.1].map((t) => ({ t, kind: 'zoom' })),
    { t: DIVE, kind: 'open' }, { t: DIVE, kind: 'fall' },
    ...[0, 1, 2, 3, 4].map((i) => ({ t: SHAFT + i * 12, kind: 'world' })),
    ...[32, 44, 56, 68, 80].map((t) => ({ t, kind: 'swoop' })),
    { t: 82.6, kind: 'mandala' },
    { t: CORE, kind: 'peak' }, { t: CORE, kind: 'machine', until: 103.6 },
    ...[88, 89, 90.5, 92, 93, 94.5, 96].map((t) => ({ t, kind: 'arc', soft: true })),
    { t: 96.4, kind: 'hole' }, { t: 98.6, kind: 'feed' }, { t: 103.0, kind: 'silence' },
    { t: UP, kind: 'emerge' }, { t: UP, kind: 'ascend' }, { t: HOME - 0.4, kind: 'return' },
    { t: CALM, kind: 'calm' }, { t: CALM + 0.4, kind: 'seal' },
    ...OUTRO.map(([t, font]) => ({ t, kind: 'font', font })),
  ],
};
