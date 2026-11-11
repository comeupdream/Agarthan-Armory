/*
 * THE HARVEST — the fleet takes the Armory, piece by piece, and what happens aboard.
 *
 * ACT 1, THE SITE (0–21 s). The home page arrives out of the dark. The saucer pointer works the
 * real UI: Realm → Agarthan Crystal (the page repaints on a scan line), the banner's arrow (the
 * manifesto slides over to "3–5 day lead times" and back), down to the Featured plate where it
 * presses the Atomium's two switches, Top backdrop and See-through, and back up to the departments:
 * six glass vaults over the atom machine, each lifting under the pointer.
 *
 * ACT 2, THE FLEET (21–56 s). They come for it. The Tic Tac and the Black Triangle beam up the six
 * vaults; a saucer takes the banner whole; two Foo Fighters take the Tiny Cans poster and its words;
 * the Triangle comes back for the Antarctica $20. The page is stripped. Then the mothership: it
 * takes the heading letter by letter, and the Atomium itself goes up the beam. White.
 *
 * ACT 3, ABOARD (56–102 s). The hoard, a trip made of everything they took. THE HOLD: the cargo
 * turning in a great ring round the beam (the banner, the notes, the cans, the vaults, the crystals).
 * THE MONEY: the $20 and the $2 multiplied into a storm, in every realm's colours, spiralling up
 * the light. THE GALLERY: a flight down an endless hall hung with the posters in every realm.
 * THE RING: the banner wrapped into a looping tunnel. THE LATTICE: the atom machine's crystal,
 * its atoms now the Atomium's spheres and the realm's stones, the fleet patrolling it. THE PEAK:
 * stones, notes and spheres in orbit round the seal, and a moment of mirrors. White.
 *
 * ACT 4, THE RETURN (102–110 s). The mothership gives it back: the Atomium, the heading, the six
 * vaults down the beam, and the saucer brings the banner home. CALM: the name walks the scripts.
 *
 * 120 BPM: a bar is two seconds, and every scene starts on one.
 */

export const REALM_AT = 3.8;
// every time the camera travels the page: [from, to]
export const SCROLLS = [[5.0, 6.6], [9.8, 12.4], [15.0, 17.4], [27.0, 28.6], [32.4, 34.4], [38.4, 40.0], [44.0, 46.4], [106.0, 107.6]];
export const CLICKS = [3.0, 3.8, 4.6, 7.2, 8.8, 13.2, 14.2];
// each abduction's start, and each thing given back
export const TAKES = [22.6, 23.0, 23.4, 23.8, 24.2, 24.6, 29.2, 35.2, 35.8, 40.9];
export const GIVES = [103.4, 103.9, 104.4, 107.6];
export const MOTHER = 46.8;
export const SC = { hold: 56, money: 64, hall: 72, ring: 80, lattice: 86, peak: 96, back: 102, calm: 110 };
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
  const REALMS = ['crystal', 'polar', 'inner-earth', 'vril', 'mono'];
  const SC = { hold: 56, money: 64, hall: 72, ring: 80, lattice: 86, peak: 96, back: 102, calm: 110 };
  const breath = 0.5 + 0.5 * Math.sin(Math.PI * t);   // one breath a bar
  const kick = Math.exp(-fr(t / 0.5) * 3.2);          // the beat

  /* ================= once: the page readied, the hold built, the cargo loaded ================= */
  at('setup', 0, () => {
    const st = document.createElement('style');
    st.textContent = `.banner-track{scroll-snap-type:none!important;scroll-behavior:auto!important}
      .prefs-btn{background:rgba(var(--accent-rgb),.16)}
      #__hold .__p{position:absolute;left:0;top:0;border:1px solid rgba(255,214,150,.6);border-radius:4px;overflow:hidden;
        box-shadow:0 0 44px rgba(170,120,255,.5);background-color:#0c0618;background-repeat:no-repeat;background-position:50% 50%}
      #__hold .__wp{position:absolute;left:0;top:0;transform-origin:0 0;border:2px solid rgba(255,214,150,.7);
        box-shadow:inset 0 0 70px rgba(120,80,200,.4);background-color:#0b0616;background-repeat:no-repeat;background-position:50% 50%;background-size:contain}`;
    document.head.appendChild(st);
    // the stage pins every .reveal's transform; these have to be free to leave
    for (const s of ['#deptGrid .dept', '.banner', '.vault-art', '.vault-text', '#departments .section-head']) document.querySelectorAll(s).forEach((e) => e.classList.remove('reveal'));
    const cards = [...document.querySelectorAll('#deptGrid .dept')];
    // the photo stands a little brighter for the film than the site's reading wash allows
    const bd0 = document.querySelector('#departments .top-backdrop'); if (bd0) bd0.style.setProperty('--bd-wash', '0.2');

    const hold = document.createElement('div'); hold.id = '__hold';
    hold.style.cssText = 'position:fixed;inset:0;z-index:2147482200;pointer-events:none;opacity:0;overflow:hidden;background:radial-gradient(ellipse 70% 60% at 50% 42%,#2c1650 0%,#130924 55%,#05020c 100%)';
    // S1, the hold: the cargo in a ring round the beam
    const half = (realm, file, top) => `background-image:url('${art(realm, file)}');background-size:100% 200%;background-position:0 ${top ? '0%' : '100%'}`;
    const cover = (src) => `background-image:url('${src}');background-size:cover`;
    const items = [
      { w: 620, h: 349, css: cover(art('crystal', 'manifesto-1280.webp')) },
      { w: 560, h: 273, css: half('crystal', 'antarctica-20-both.webp', true) },
      { w: 330, h: 412, css: cover(art('crystal', 'tiny-cans-640.webp')) },
      { card: 0 },
      { w: 500, h: 402, css: cover(F + 'realm/crystal/atomium-980.webp') },
      { w: 540, h: 270, css: half('crystal', 'antarctica-dollars-750.webp', true) },
      { card: 1 },
      { w: 560, h: 373, css: cover(F + 'realm/crystal/amethyst-geode-1600.webp') },
      { w: 560, h: 273, css: half('crystal', 'antarctica-20-both.webp', false) },
      { card: 4 },
      { w: 470, h: 392, css: `background-image:url('${F}realm/inner-earth/rhodochrosite-760.webp');background-size:contain;border-color:transparent;box-shadow:none;background-color:transparent` },
      { w: 540, h: 270, css: half('crystal', 'antarctica-dollars-750.webp', false) },
    ];
    const s1 = document.createElement('div'); s1.id = '__s1';
    s1.style.cssText = 'position:absolute;inset:0;perspective:1700px;perspective-origin:50% 42%;opacity:0';
    s1.innerHTML = `<div style="position:absolute;left:50%;top:-10%;width:520px;height:120%;margin-left:-260px;background:linear-gradient(90deg,rgba(255,214,150,0),rgba(255,226,180,.34) 38%,rgba(255,255,255,.5) 50%,rgba(255,226,180,.34) 62%,rgba(255,214,150,0));filter:blur(18px)"></div>
      <img id="__s1seal" src="assets/img/brand/seal-600.png" style="position:absolute;left:50%;top:15%;width:230px;height:230px;margin-left:-115px;max-width:none;filter:drop-shadow(0 0 40px rgba(255,214,150,.9))">
      <div id="__r1" style="position:absolute;left:50%;top:56%;width:0;height:0;transform-style:preserve-3d"></div>`;
    hold.appendChild(s1);
    const r1 = s1.querySelector('#__r1');
    items.forEach((it, i) => {
      let el;
      if (it.card != null) {
        el = cards[it.card].cloneNode(true); el.removeAttribute('href'); el.classList.add('__p');
        it.w = 400; it.h = 300;
        el.style.cssText = `width:400px;height:300px;min-height:0;background:rgba(26,14,44,.94);-webkit-backdrop-filter:none;backdrop-filter:none;transition:none`;
      } else { el = document.createElement('div'); el.className = '__p'; el.style.cssText = `width:${it.w}px;height:${it.h}px;${it.css}`; }
      el.style.margin = `${-it.h / 2}px 0 0 ${-it.w / 2}px`;
      el.dataset.i = i; r1.appendChild(el);
    });
    // the canvas the storm, the lattice and the peak are drawn on
    const cv = document.createElement('canvas'); cv.id = '__cv'; cv.width = W; cv.height = H;
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0';
    hold.appendChild(cv);
    // S3, the gallery: an endless hall hung with the posters in every realm's colours
    const PW = 760, PH = 520, HW = 430, M = 10;
    const hang = [['crystal', 'tiny-cans-640.webp'], ['crystal', 'manifesto-1280.webp'], ['crystal', 'antarctica-20-both.webp'], ['inner-earth', 'tiny-cans-640.webp'], ['vril', 'manifesto-1280.webp'],
      ['crystal', 'antarctica-dollars-750.webp'], ['polar', 'tiny-cans-640.webp'], ['inner-earth', 'manifesto-1280.webp'], ['vril', 'antarctica-20-both.webp'], ['mono', 'tiny-cans-640.webp'],
      ['polar', 'manifesto-1280.webp'], ['inner-earth', 'antarctica-dollars-750.webp'], ['vril', 'tiny-cans-640.webp'], ['crystal', 'manifesto-1280.webp'], ['polar', 'antarctica-20-both.webp'],
      ['crystal', 'tiny-cans-640.webp'], ['mono', 'manifesto-1280.webp'], ['vril', 'antarctica-dollars-750.webp'], ['inner-earth', 'antarctica-20-both.webp'], ['polar', 'antarctica-dollars-750.webp']];
    const s3 = document.createElement('div'); s3.id = '__s3';
    s3.style.cssText = 'position:absolute;inset:0;perspective:700px;perspective-origin:50% 50%;opacity:0;background:#06030d;overflow:hidden';
    let walls = '';
    for (let k = 0; k < 2 * M; k++) walls += `<div class="__wp" data-k="${k}" style="width:${PW}px;height:${PH}px;background-image:url('${art(hang[k][0], hang[k][1])}')"></div>`;
    s3.innerHTML = `<div id="__hall" style="position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d">
        <div id="__floor" style="position:absolute;left:0;top:0;width:${2 * HW}px;height:8200px;transform-origin:0 0;background-image:linear-gradient(180deg,rgba(6,3,13,0) 0%,rgba(6,3,13,.55) 30%,rgba(6,3,13,.98) 78%),url('${F}realm/crystal/geode-tile.webp');background-size:auto,430px 430px"></div>
        <div id="__ceil" style="position:absolute;left:0;top:0;width:${2 * HW}px;height:8200px;transform-origin:0 0;background-image:linear-gradient(180deg,rgba(6,3,13,0) 0%,rgba(6,3,13,.6) 30%,rgba(6,3,13,.98) 78%),repeating-linear-gradient(180deg,rgba(255,214,150,.0) 0 150px,rgba(255,226,180,.85) 150px 170px,rgba(255,214,150,0) 170px 410px),linear-gradient(#1a0e2e,#1a0e2e)"></div>
        <div id="__door" style="position:absolute;left:-500px;top:-500px;width:1000px;height:1000px;background:radial-gradient(circle,rgba(255,250,235,1) 0%,rgba(255,206,130,.8) 18%,rgba(170,120,255,.35) 42%,rgba(170,120,255,0) 70%)"></div>
        ${walls}</div>`;
    hold.appendChild(s3);
    // S4, the ring: the banner in every realm's colours, for the lens to wrap into a tunnel
    const s4 = document.createElement('div'); s4.id = '__s4';
    s4.style.cssText = 'position:absolute;inset:0;opacity:0';
    s4.innerHTML = REALMS.map((r, i) => `<div class="__bn" style="position:absolute;inset:0;background:url('${art(r, 'manifesto-1280.webp')}') 0 0/640px 360px;opacity:${i ? 0 : 1}"></div>`).join('');
    hold.appendChild(s4);
    document.body.appendChild(hold);

    // the caption at the corner of the frame, and the veil for the calm
    const lab = document.createElement('div'); lab.id = '__lab';
    lab.style.cssText = 'position:fixed;left:64px;bottom:58px;z-index:2147482600;pointer-events:none;opacity:0;font:400 13px/1.6 var(--f-mono);letter-spacing:.3em;text-transform:uppercase;color:#ffd27a;text-shadow:0 2px 14px rgba(0,0,0,.9)';
    document.body.appendChild(lab);
    const veil = document.createElement('div'); veil.id = '__veil';
    veil.style.cssText = 'position:fixed;inset:0;z-index:2147482700;pointer-events:none;background:radial-gradient(ellipse 80% 70% at 50% 50%, rgba(18,8,30,.74), rgba(6,3,12,.94));opacity:0';
    document.body.appendChild(veil);

    // what the canvas scenes are drawn from
    const V = (window.__hv = { img: {}, list: [], ready: false });
    const load = (key, src) => { const i = new Image(); i.src = src; V.img[key] = i; V.list.push(i); };
    for (const r of REALMS) { load('20:' + r, art(r, 'antarctica-20-both.webp')); load('2:' + r, art(r, 'antarctica-dollars-750.webp')); }
    load('atom', F + 'realm/crystal/atomium-1920.webp');
    load('rhodo', F + 'realm/inner-earth/rhodochrosite-760.webp');
    load('gl', 'assets/img/realm-src/green-geode-left.png'); load('gr', 'assets/img/realm-src/green-geode-right.png');
    load('seal', 'assets/img/brand/seal-600.png');
    load('bed', F + 'realm/crystal/geode-tile.webp');
    for (const r of REALMS) { const i = new Image(); i.src = art(r, 'manifesto-1280.webp'); const j = new Image(); j.src = art(r, 'tiny-cans-640.webp'); }
  });
  // the banner moves on by itself every 8 s unless somebody is on it: the film is always on it
  const man = document.querySelector('.manifesto');
  if (man) man.dispatchEvent(new PointerEvent('pointerenter'));

  /* ---------- the sprites, cut once everything has loaded ---------- */
  const V = window.__hv;
  if (V && !V.ready && V.list.every((i) => i.complete && i.naturalWidth)) {
    V.ready = true;
    const cut = (img, sx, sy, sw, sh, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, w, h); return c; };
    // a note's four faces: the 20's front and back, the 2's front and back
    V.bills = REALMS.map((r) => {
      const a = V.img['20:' + r], b = V.img['2:' + r], aw = a.naturalWidth, ah = a.naturalHeight / 2, bw = b.naturalWidth, bh = b.naturalHeight / 2;
      return [cut(a, 0, 0, aw, ah, 256, 126), cut(a, 0, ah, aw, ah, 256, 126), cut(b, 0, 0, bw, bh, 256, 128), cut(b, 0, bh, bw, bh, 256, 128)];
    });
    // the Atomium's spheres, cut round out of the photo
    V.spheres = [[962, 430, 255], [332, 365, 172], [1587, 370, 172], [427, 1135, 150], [1485, 1135, 150]].map(([cx, cy, r]) => {
      const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
      g.save(); g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 1, 0, Math.PI * 2); g.clip();
      g.drawImage(V.img.atom, cx - r * 0.97, cy - r * 0.97, r * 1.94, r * 1.94, 0, 0, N, N); g.restore();
      g.globalCompositeOperation = 'destination-in';
      const gr = g.createRadialGradient(N / 2, N / 2, N * 0.38, N / 2, N / 2, N / 2);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N);
      return c;
    });
    // the stones, each in a square of its own
    V.stones = ['rhodo', 'gl', 'gr'].map((k) => { const im = V.img[k], N = 256, c = document.createElement('canvas'); c.width = c.height = N; const s = Math.min(N / im.naturalWidth, N / im.naturalHeight); c.getContext('2d').drawImage(im, (N - im.naturalWidth * s) / 2, (N - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s); return c; });
    const glow = (rgb, size = 128) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.25, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c; };
    V.gl = { warm: glow('255,190,110'), white: glow('255,250,240'), violet: glow('170,120,255') };
  }
  const stamp = (g, img, x, y, size, a) => { if (a <= 0.003 || size < 0.5) return; g.globalAlpha = Math.min(1, a); g.drawImage(img, x - size / 2, y - size / 2, size, size); };
  const bolt = (g, x1, y1, x2, y2, seed, width, a) => {
    let pts = [[x1, y1], [x2, y2]], disp = Math.hypot(x2 - x1, y2 - y1) * 0.17, sd = seed * 13.7;
    for (let it = 0; it < 6; it++) { const np = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1; sd += 1; const r = hash(sd) * 2 - 1; np.push([(ax + bx) / 2 + (nx / nl) * disp * r, (ay + by) / 2 + (ny / nl) * disp * r], pts[i + 1]); } pts = np; disp *= 0.55; }
    for (const [w, c] of [[width * 7, `rgba(160,110,255,${0.16 * a})`], [width * 2.6, `rgba(255,170,90,${0.55 * a})`], [width, `rgba(255,250,240,${0.95 * a})`]]) { g.lineWidth = w; g.strokeStyle = c; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke(); }
  };

  /* ================= where things are; the camera's path down and up the page ================= */
  const NAV = (document.querySelector('.site-header') || { offsetHeight: 68 }).offsetHeight;
  const vis = (sel) => [...document.querySelectorAll(sel)].find((x) => x.offsetParent);
  const centre = (sel) => { const e = vis(sel); if (!e) return 0; const r = e.getBoundingClientRect(); return Math.max(0, r.top + scrollY - NAV - Math.max(0, H - NAV - r.height) / 2); };
  const sec = document.getElementById('departments');
  const Y = {
    top: () => 0,
    ban: () => S.memo('y:ban', () => centre('.banner')),
    feat: () => S.memo('y:feat', () => centre('#featured .realm-plate')),
    dep: () => S.memo('y:dep', () => { const r = sec.getBoundingClientRect(); return r.top + scrollY + Math.max(0, (r.height - H) / 2) + 10; }),
    vault: () => S.memo('y:vault', () => centre('.vault-split')),
    gate: () => S.memo('y:gate', () => centre('.gate-money picture')),
  };
  const PATH = [[0, 'top'], [5.0, 'top'], [6.6, 'ban'], [9.8, 'ban'], [12.4, 'feat'], [15.0, 'feat'], [17.4, 'dep'], [27.0, 'dep'], [28.6, 'ban'], [32.4, 'ban'], [34.4, 'vault'],
    [38.4, 'vault'], [40.0, 'gate'], [44.0, 'gate'], [46.4, 'dep'], [106.0, 'dep'], [107.6, 'ban'], [999, 'ban']];
  let y = 0;
  for (let i = 1; i < PATH.length; i++) if (t <= PATH[i][0]) { const [t0, a] = PATH[i - 1], [t1, b] = PATH[i]; y = a === b ? Y[a]() : lerp(Y[a](), Y[b](), ease.inOut(seg(t, t0, t1))); break; }
  scrollTo(0, y);
  // the banner's turn to the lead time, and back
  const track = document.querySelector('.banner-track');
  const slide = sm(seg(t, 7.2, 7.8)) - sm(seg(t, 8.8, 9.4));
  if (track && t < 12) {
    track.scrollLeft = slide * track.clientWidth;
    document.querySelectorAll('.banner-nav .sp-dot').forEach((d, k) => d.setAttribute('aria-pressed', String(k === Math.round(slide))));
  }

  /* ================= ACT 1: the pointer works the real UI ================= */
  const idle = [W * 0.64 + 150 * Math.sin(t * 0.5), H * 0.62 + 80 * Math.sin(t * 0.37 + 1)];
  const mid = (sel) => { const e = typeof sel === 'string' ? vis(sel) : sel; if (!e) return idle; const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : idle; };
  const cards = [...document.querySelectorAll('#deptGrid .dept')];
  const PRESS = [
    [3.0, '.prefs-btn', true], [3.8, '.prefs-opt[data-k="theme"][data-v="crystal"]', true], [4.6, '.prefs-btn', true],
    [7.2, '.banner-nav .sp-arrow[data-d="1"]', false], [8.8, '.banner-nav .sp-arrow[data-d="-1"]', false],
    [13.2, '[data-switch="top"]', true], [14.2, '[data-switch="see-through"]', true],
  ];
  let p = idle.slice(), press = 0;
  if (t < 22) {
    let tot = 0; const acc = [0, 0];
    for (const [tc, sel, real] of PRESS) {
      const w = sm(clamp(1 - Math.abs(t - tc) / 0.75));
      if (w > 0) { const m = mid(sel); acc[0] += w * m[0]; acc[1] += w * m[1]; tot += w; }
      press = Math.max(press, 1 - Math.abs(t - tc) / 0.12);
      if (real) at('press-' + tc, tc, () => { const e = vis(sel) || document.querySelector(sel); if (e) S.click(e, ...mid(sel)); });
    }
    const k = Math.min(1, tot), n = Math.max(1, tot);
    p = [idle[0] * (1 - k) + acc[0] / n, idle[1] * (1 - k) + acc[1] / n];
    // the sweep over the six vaults: each lifts and scans under the pointer (the site's own hover)
    const sw = win(17.5, 21.5, 0.5, 0.4);
    if (sw > 0) {
      const ks = cards.map((c, i) => [17.9 + i * 0.6, mid(c)]);
      const q = keys(t, ks, ease.inOut);
      p = [lerp(p[0], q[0], sw), lerp(p[1], q[1] + 20, sw)];
    }
  }
  S.cursor(p[0], p[1] + Math.sin(t * 2.2) * 3, { scale: 1.8 * (1 - 0.18 * Math.max(0, press)), show: t > 1.2 && t < 21.7 });
  S.mouse = t > 17.4 && t < 21.6 ? p : [4, H - 4];
  const hdr = document.querySelector('.site-header');
  if (hdr) hdr.style.opacity = String(1 - sm(seg(t, 15.4, 16.6)));

  /* ---------- the caption at the corner of the frame ---------- */
  const CAPS = [[2.6, 5.2, 'Display settings', 'Realm · Agarthan Crystal'], [6.6, 9.8, 'The banner', '3–5 day lead times'], [12.6, 15.2, 'Featured · the Atomium', 'Top backdrop · See-through'],
    [17.4, 21.4, 'The departments', 'Six vaults on the atom machine'], [21.8, 26.6, 'Taken', 'The six vaults'], [28.6, 32.2, 'Taken', 'The banner'], [34.6, 38.2, 'Taken', 'Tiny guns, tiny cans'],
    [40.2, 43.8, 'Taken', 'The Antarctica twenty'], [47.2, 55.0, 'The mothership', 'The atom machine'], [56.6, 63.6, 'Aboard', 'The hold'], [64.4, 71.6, 'Aboard', 'The money'],
    [72.4, 79.4, 'Aboard', 'The gallery'], [86.6, 95.4, 'Aboard', 'The crystal'], [102.8, 109.6, 'Returned', 'Everything, by the book']];
  const lab = document.getElementById('__lab');
  if (lab) {
    const c = CAPS.find(([a, b]) => t >= a && t < b);
    if (c) {
      if (lab.dataset.k !== c[2] + c[3]) { lab.dataset.k = c[2] + c[3]; lab.innerHTML = `${c[2]}<br><b style="display:block;margin:6px 0 0;font:700 30px/1.15 var(--f-display);letter-spacing:.1em;color:#fff7ec;text-shadow:0 0 22px rgba(255,170,80,.6),0 2px 14px rgba(0,0,0,.9)">${c[3]}</b>`; }
      lab.style.opacity = String(Math.min(seg(t, c[0], c[0] + 0.4), 1 - seg(t, c[1] - 0.4, c[1])));
      lab.style.transform = `translateY(${(1 - seg(t, c[0], c[0] + 0.4)) * 14}px)`;
    } else lab.style.opacity = '0';
  }

  /* ================= ACT 2: the fleet ================= */
  const docPos = (key, e) => S.memo('doc:' + key, () => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + scrollY + r.height / 2]; });
  const hover = (key, e) => { const [x, yy] = docPos(key, e); return [x, Math.max(96, yy - scrollY - 250)]; };
  const q1 = (s) => document.querySelector(s);
  const FLEET = [
    { id: 'tt', type: 'tictac', size: 230, a: 21.6, from: [-280, H * 0.2], z: 27.4, to: [-320, H * 0.05], jobs: [[cards[0], 22.6, 24.1], [cards[1], 23.4, 24.9], [cards[2], 24.2, 25.7]] },
    { id: 'tri', type: 'triangle', size: 250, a: 22.0, from: [W + 300, H * 0.16], z: 27.6, to: [W + 340, H * 0.04], jobs: [[cards[5], 23.0, 24.5], [cards[4], 23.8, 25.3], [cards[3], 24.6, 26.1]] },
    { id: 'disc', type: 'disc', size: 400, a: 28.0, from: [W * 0.5, -240], z: 32.8, to: [W * 0.86, -280], jobs: [[q1('.banner'), 29.2, 31.8]] },
    { id: 'orb', type: 'orb', size: 210, a: 34.0, from: [-240, H * 0.3], z: 38.8, to: [W * 0.3, -260], jobs: [[q1('.vault-art'), 35.2, 37.6]] },
    { id: 'orb2', type: 'orb', size: 180, a: 34.4, from: [W + 240, H * 0.4], z: 39.0, to: [W * 0.72, -260], jobs: [[q1('.vault-text'), 35.8, 38.0]] },
    { id: 'tri2', type: 'triangle', size: 330, a: 39.8, from: [W + 340, H * 0.1], z: 44.6, to: [-360, H * 0.06], jobs: [[q1('.gate-money picture'), 40.9, 43.4]] },
  ];
  const sparks = [];
  for (const c of FLEET) {
    if (t < c.a - 0.05 || t > c.z + 0.3) continue;
    const first = c.jobs[0], lastJ = c.jobs[c.jobs.length - 1];
    const ks = [[c.a, c.from], [first[1] - 0.2, hover(c.id + 0, first[0])]];
    if (c.jobs.length > 1) ks.push([lastJ[1] + 0.3, hover(c.id + (c.jobs.length - 1), lastJ[0])]);
    ks.push([lastJ[2], hover(c.id + (c.jobs.length - 1), lastJ[0])], [c.z, c.to]);
    let [x, yy] = keys(t, ks, ease.inOut);
    yy += Math.sin(t * 2.3 + c.id.length) * 7;
    let beam = 0;
    S.craft(c.id, { type: c.type, x, y: yy, size: c.size, rot: Math.sin(t * 1.7 + c.id.length) * 4, beam: 0, beamLen: 300 });
    c.jobs.forEach(([e, a, b], i) => {
      if (!e) return;
      beam = Math.max(beam, seg(t, a - 0.3, a) * (1 - seg(t, b - 0.15, b + 0.2)));
      if (t >= a - 0.3) S.abduct(e, seg(t, a, b), c.id, { spin: i % 2 ? -1 : 1, wobble: 1.3 });
    });
    S.craft(c.id, { type: c.type, x, y: yy, size: c.size, rot: Math.sin(t * 1.7 + c.id.length) * 4, beam, beamLen: c.size > 300 ? 520 : 340, beamW: c.size > 300 ? 1.5 : 1 });
    if (beam > 0) sparks.push({ x, y: yy + 30, w: c.size * 0.9, h: 300, n: 34, k: beam, seed: c.id.length + c.a });
  }

  /* ---------- the mothership: the heading, letter by letter, and the atom machine itself ---------- */
  const bd = sec && sec.querySelector('.top-backdrop');
  const head = '#departments .section-head';
  if (t > 46.4 && t < 108) {
    const taking = t < 60;
    const appear = taking ? ease.out(seg(t, 46.8, 48.8)) : 1;
    const mx = W / 2, my = H * 0.12 + Math.sin(t * 1.6) * 6;
    const size = taking ? 80 + 860 * appear + 700 * ease.in(seg(t, 53.6, 56.0)) : 940 - 700 * ease.in(seg(t, 105.2, 106.8));
    const beamM = taking ? seg(t, 48.6, 49.2) : seg(t, 102.2, 102.6) * (1 - seg(t, 105.0, 105.5));
    const op = taking ? Math.min(1, appear * 1.4) * (1 - seg(t, 55.6, 56.2)) : seg(t, 101.9, 102.4) * (1 - seg(t, 106.2, 106.9));
    S.craft('mom', { type: 'mother', x: mx, y: my - (taking ? 0 : 500 * ease.in(seg(t, 105.4, 106.9))), size, beam: beamM, beamLen: 1000, beamW: 1.5 + 0.2 * Math.sin(t * 3), opacity: op });
    if (beamM > 0) sparks.push({ x: mx, y: my + 40, w: 900, h: 760, n: 90, k: beamM, seed: 7 });
    // the heading: up the beam letter by letter, and back down the same way
    const L = S.letters(head + ' h2');
    L.forEach((e, i) => S.abduct(e, taking ? seg(t, 49.2 + i * 0.07, 50.7 + i * 0.07) : 1 - seg(t, 103.0 + i * 0.05, 104.3 + i * 0.05), 'mom', { spin: i % 2 ? -1 : 1, wobble: 1.5 }));
    for (const [s, a, r] of [[head + ' .eyebrow', 49.0, 102.9], [head + ' p', 50.2, 103.2]]) S.abduct(q1(s), taking ? seg(t, a, a + 1.4) : 1 - seg(t, r, r + 1.2), 'mom');
    // the Atomium: the whole machine drawn up into the ship, and let back down
    if (bd) {
      const up = taking ? ease.in(seg(t, 51.4, 55.8)) : 1 - ease.out(seg(t, 102.2, 104.4));
      const r = sec.getBoundingClientRect();
      bd.style.transformOrigin = `${mx - r.left}px ${my + 40 - r.top}px`;
      bd.style.transform = up > 0 ? `scale(${(1 - 0.93 * up).toFixed(4)}) rotate(${(up * up * 40).toFixed(2)}deg)` : '';
      bd.style.filter = `brightness(${(1.04 + 0.5 * seg(t, 48.8, 51.4) * (taking ? 1 : 0) + 1.2 * up).toFixed(3)}) saturate(${(1 + 0.3 * up).toFixed(3)})`;
      bd.style.opacity = String(1 - seg(up, 0.9, 1));
    }
    // the six vaults come home down the beam
    if (!taking) cards.forEach((e, i) => S.abduct(e, 1 - seg(t, 103.4 + i * 0.25, 104.8 + i * 0.25), 'mom', { spin: i % 2 ? -1 : 1, wobble: 1.3 }));
  }
  // and the saucer brings the banner back; what was taken out of sight is simply back where it was
  if (t > 106.6 && t < 111) {
    const e = q1('.banner');
    const hv = hover('disc0', e);
    const [x, yy] = keys(t, [[107.0, [W * 0.86, -280]], [107.6, hv], [109.4, hv], [110.4, [W * 0.14, -300]]], ease.inOut);
    const beam = seg(t, 107.4, 107.7) * (1 - seg(t, 109.3, 109.6));
    S.craft('disc', { type: 'disc', x, y: yy + Math.sin(t * 2.3) * 7, size: 400, beam, beamLen: 520, beamW: 1.5 });
    S.abduct(e, 1 - seg(t, 107.7, 109.4), 'disc', { wobble: 1.3 });
    if (beam > 0) sparks.push({ x, y: yy + 30, w: 360, h: 300, n: 34, k: beam, seed: 3 });
  }
  at('restore', 103.0, () => { for (const s of ['.vault-art', '.vault-text', '.gate-money picture']) S.abduct(q1(s), 0, 'mom'); });
  S.sparks(sparks);

  /* ================= ACT 3: aboard ================= */
  const hold = document.getElementById('__hold');
  const aboard = t >= 55.4 && t < 103.2;
  if (hold) hold.style.opacity = (sm(seg(t, 55.5, 56.1)) * (1 - sm(seg(t, 102.2, 102.9)))).toFixed(3);
  if (hold && aboard && V && V.ready) {
    const GL = V.gl;
    /* ----- S1, THE HOLD: the cargo in a ring round the beam ----- */
    const s1 = document.getElementById('__s1'), v1 = win(55.6, 64.3, 0.5, 0.5);
    s1.style.opacity = v1.toFixed(3);
    if (v1 > 0) {
      const tau = t - SC.hold, spin = 14 + tau * 34 + 10 * Math.sin(tau * 0.8);
      const r1 = document.getElementById('__r1');
      r1.style.transform = `translateZ(-950px) rotateX(-9deg) rotateY(${spin.toFixed(2)}deg)`;
      r1.querySelectorAll('.__p').forEach((el, i) => {
        const a = i * 30, face = Math.cos(((a + spin) * Math.PI) / 180);
        const come = ease.out(seg(tau, -0.4 + i * 0.07, 1.0 + i * 0.07)), go = ease.in(seg(tau, 7.3 + i * 0.03, 8.3));
        el.style.transform = `rotateY(${a}deg) translateZ(1080px) translateY(${(Math.sin(t * 1.3 + i * 1.7) * 16 + (1 - come) * 900 - go * 1100).toFixed(1)}px) rotateZ(${(Math.sin(t * 0.9 + i) * 2.5).toFixed(2)}deg)`;
        el.style.filter = `brightness(${(0.3 + 0.8 * Math.max(0, face)).toFixed(3)})`;
        el.style.opacity = (face > 0 ? 1 : 0.5).toFixed(2);
      });
      const seal = document.getElementById('__s1seal');
      seal.style.transform = `translateY(${(Math.sin(t * 1.1) * 10).toFixed(1)}px) scale(${(0.92 + 0.1 * kick).toFixed(3)})`;
      seal.style.opacity = (0.55 + 0.45 * breath).toFixed(3);
    }

    /* ----- the canvas: the storm, the lattice, the peak ----- */
    const cv = document.getElementById('__cv');
    const vStorm = win(63.7, 72.3, 0.5, 0.5), vLat = win(85.7, 96.0, 0.5, 0.05), vPeak = t >= 96 ? 1 - sm(seg(t, 102.2, 102.8)) : 0;
    const vc = Math.max(vStorm, vLat, vPeak);
    cv.style.opacity = vc.toFixed(3);
    if (vc > 0) {
      const g = cv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const bg = g.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.7);
      bg.addColorStop(0, '#2c1650'); bg.addColorStop(0.55, '#130924'); bg.addColorStop(1, '#05020c');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);

      if (vStorm > 0) {
        /* ----- S2, THE MONEY: the 20 and the 2, a storm of them, spiralling up the light ----- */
        const tau = t - SC.money, f = 1100, N = 260, list = [];
        g.globalCompositeOperation = 'lighter';
        stamp(g, GL.warm, W / 2, H * 0.02, 1500, 0.5 + 0.2 * breath); stamp(g, GL.white, W / 2, -H * 0.05, 700, 0.6);
        const col = g.createLinearGradient(W / 2 - 260, 0, W / 2 + 260, 0);
        col.addColorStop(0, 'rgba(255,214,150,0)'); col.addColorStop(0.5, `rgba(255,236,200,${0.2 + 0.08 * breath})`); col.addColorStop(1, 'rgba(255,214,150,0)');
        g.globalAlpha = 1; g.fillStyle = col; g.fillRect(W / 2 - 260, 0, 520, H);
        g.globalCompositeOperation = 'source-over';
        for (let i = 0; i < N; i++) {
          const h1 = hash(i * 1.37 + 1), h2 = hash(i * 2.11 + 7), h3 = hash(i * 3.71 + 3), h4 = hash(i * 5.3 + 11);
          const r0 = 230 + 1180 * Math.pow(h1, 0.8);
          const yf = fr(h3 + tau * (0.075 + 0.09 * (1 - h1)));            // 0 at the floor, 1 at the ship
          const r = r0 * (0.3 + 0.7 * Math.pow(1 - yf, 0.7));
          const th = h2 * 6.283 + tau * (2.8 / (0.5 + r0 / 420)) + yf * 2.4;
          const x = r * Math.cos(th), z = r * Math.sin(th), s = f / (f + z + 900);
          list.push({ i, x: W / 2 + x * s, y: H * 0.5 + (H * (1.14 - 1.32 * yf) - H * 0.5) * s + z * 0.1 * s, s, z, th, yf, h2, h4 });
        }
        list.sort((a, b) => b.z - a.z);
        for (const b of list) {
          const phi = b.h4 * 6.283 + tau * (2.4 + 3 * b.h2), c = Math.cos(phi), two = b.i % 3 === 0;
          // one realm's notes at first, then every realm's
          const realm = Math.floor(hash(b.i * 9.1) * clamp(1 + (tau - 1.6) * 1.3, 1, 5));
          const spr = V.bills[realm][(two ? 2 : 0) + (c < 0 ? 1 : 0)];
          const w = 215 * b.s, h = w * 0.5 * Math.max(0.08, Math.abs(c));
          g.globalAlpha = clamp(0.25 + 0.8 * b.s) * Math.min(1, b.yf * 6) * Math.min(1, (1 - b.yf) * 5);
          g.setTransform(1, 0, 0, 1, b.x, b.y); g.rotate(Math.sin(b.th) * 0.5 + 0.25 * Math.sin(phi * 0.5));
          g.drawImage(spr, -w / 2, -h / 2, w, h);
        }
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
      }

      if (vLat > 0) {
        /* ----- S5, THE LATTICE: the atom machine's crystal, its atoms the spheres and the stones ----- */
        const tau = t - SC.lattice;
        const n3 = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const D = n3([0.31, 0.47, 0.83]);
        const up0 = n3([1, 1, 1].map((c, i) => c - D[i] * dot([1, 1, 1], D))), rt0 = cross(D, up0);
        const roll = 0.24 * tau + 0.5 * Math.sin(tau * 0.45);
        const rt = rt0.map((c, i) => c * Math.cos(roll) + up0[i] * Math.sin(roll)), up = up0.map((c, i) => c * Math.cos(roll) - rt0[i] * Math.sin(roll));
        const dist = 0.7 * tau + 0.055 * tau * tau;   // it gathers speed all the way
        const Cm = [0.5, 0.5, 0.5].map((c, i) => c + D[i] * dist), f = W * 0.62;
        const proj = (p) => { const v = [p[0] - Cm[0], p[1] - Cm[1], p[2] - Cm[2]], z = dot(v, D); return [W / 2 + (f * dot(v, rt)) / z, H / 2 - (f * dot(v, up)) / z, z]; };
        const nodes = [], bonds = [], seen = new Map(), N = 3, c0 = Cm.map((c) => Math.floor(c));
        const add = (p, body) => { const k = p.map((c) => Math.round(c * 2)).join(','); if (seen.has(k)) return seen.get(k); const q = proj(p); const nd = { p, x: q[0], y: q[1], z: q[2], body }; seen.set(k, nd); nodes.push(nd); return nd; };
        for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) for (let k = -N; k <= N; k++) {
          const c = [c0[0] + i, c0[1] + j, c0[2] + k], a = add(c, false);
          for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) bonds.push([a, add([c[0] + d[0], c[1] + d[1], c[2] + d[2]], false)]);
          const m = add([c[0] + 0.5, c[1] + 0.5, c[2] + 0.5], true);
          for (const d of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]]) bonds.push([m, add([c[0] + d[0], c[1] + d[1], c[2] + d[2]], false)]);
        }
        const wr = fr(tau / 2) * 5.5;
        const fog = (z) => (z < 0.08 || z > 4.4 ? 0 : Math.exp(-z * 0.62) * Math.min(1, (z - 0.08) * 4) * Math.min(1, (4.4 - z) * 1.5));
        g.lineCap = 'round';
        for (const [a, b] of bonds) {
          if (a.z < 0.1 || b.z < 0.1) continue;
          const fa = Math.min(fog(a.z), fog(b.z)); if (fa < 0.01) continue;
          const zz = (a.z + b.z) / 2;
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          g.lineWidth = Math.min(30, (0.05 * f) / zz); g.strokeStyle = `rgba(150,140,176,${(0.5 * fa).toFixed(3)})`;
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
          g.globalCompositeOperation = 'lighter';
          g.lineWidth = Math.min(8, (0.012 * f) / zz); g.strokeStyle = `rgba(255,176,96,${(0.22 * fa * (0.4 + 0.6 * breath)).toFixed(3)})`;
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        }
        g.globalCompositeOperation = 'lighter';
        bonds.forEach(([a, b], i) => {
          if (a.z < 0.15 || b.z < 0.15 || hash(i * 3.1 + a.p[0] * 7 + b.p[2]) > 0.35) return;
          const fa = Math.min(fog(a.z), fog(b.z)); if (fa < 0.02) return;
          const q = fr(t * 0.9 + hash(i * 1.7));
          stamp(g, GL.warm, lerp(a.x, b.x, q), lerp(a.y, b.y, q), Math.min(120, (0.22 * f) / lerp(a.z, b.z, q)), 0.8 * fa * Math.sin(Math.PI * q));
        });
        nodes.sort((a, b) => b.z - a.z);
        for (const nd of nodes) {
          const a = fog(nd.z); if (a < 0.01) continue;
          const d3 = Math.hypot(nd.p[0] - Cm[0], nd.p[1] - Cm[1], nd.p[2] - Cm[2]), w = Math.exp(-((d3 - wr) ** 2) * 2.2);
          const r = ((nd.body ? 0.27 : 0.2) + 0.025 * breath) * f / nd.z;
          if (r > H * 1.6 || nd.x < -r || nd.x > W + r || nd.y < -r || nd.y > H + r) continue;
          g.globalCompositeOperation = 'lighter';
          stamp(g, GL.violet, nd.x, nd.y, r * 3.6, 0.14 * a * (0.5 + 0.5 * breath) + 0.32 * a * w);
          stamp(g, GL.warm, nd.x, nd.y, r * 2.5, 0.16 * a + 0.45 * a * w);
          g.globalCompositeOperation = 'source-over';
          // the body of each cell is one of the Atomium's spheres; its corners are the stones
          const h = hash(nd.p[0] * 3 + nd.p[1] * 5 + nd.p[2] * 7);
          const spr = nd.body ? V.spheres[Math.floor(h * V.spheres.length)] : V.stones[Math.floor(h * V.stones.length)];
          g.globalAlpha = Math.min(1, a * 1.15);
          g.drawImage(spr, nd.x - r, nd.y - r, 2 * r, 2 * r);
          if (w > 0.05) { g.globalCompositeOperation = 'lighter'; stamp(g, GL.white, nd.x, nd.y, r * 1.6, 0.35 * a * w); }
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'lighter';
        const kb = Math.floor(tau / 0.5), ta = SC.lattice + kb * 0.5;
        if (tau > 0.6 && t - ta < 0.24) for (let m = 0; m < 2; m++) {
          const near = bonds.filter(([a, b]) => a.z > 0.4 && b.z > 0.4 && a.z < 2.6 && b.z < 2.6 && a.x > 0 && a.x < W && b.x > 0 && b.x < W && a.y > 0 && a.y < H && b.y > 0 && b.y < H);
          if (!near.length) break;
          const [a, b] = near[Math.floor(hash(kb * 11 + m * 5) * near.length)];
          bolt(g, a.x, a.y, b.x, b.y, kb * 100 + m * 7 + Math.floor((t - ta) * 15), Math.max(1.2, 4 / ((a.z + b.z) / 2)), 1 - (t - ta) / 0.24);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }

      if (vPeak > 0) {
        /* ----- S6, THE PEAK: stones, notes and spheres in orbit round the seal ----- */
        const tau = t - SC.peak, cx = W / 2, cy = H / 2;
        // the amethyst bed, turning under everything
        if (!V.pat) V.pat = g.createPattern(V.img.bed, 'repeat');
        g.save(); g.translate(cx, cy); g.rotate(tau * 0.12); g.scale(0.42 + 0.02 * breath, 0.42 + 0.02 * breath);
        g.globalAlpha = 0.5; g.fillStyle = V.pat; g.fillRect(-W * 3, -W * 3, W * 6, W * 6); g.restore();
        g.globalAlpha = 1;
        const vg = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.62);
        vg.addColorStop(0, 'rgba(8,4,18,.25)'); vg.addColorStop(1, 'rgba(5,2,12,.92)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'lighter';
        stamp(g, GL.warm, cx, cy, 900 * (0.9 + 0.2 * kick), 0.55); stamp(g, GL.violet, cx, cy, 1500, 0.4 * (0.6 + 0.4 * breath));
        g.globalCompositeOperation = 'source-over';
        // three rings, each turning its own way; what is behind the seal is drawn first
        const obj = [];
        for (let k = 0; k < 6; k++) { const a = k * 1.0472 + tau * 1.5; obj.push({ z: Math.sin(a), x: cx + 250 * Math.cos(a), y: cy + 250 * 0.5 * Math.sin(a), kind: 0, k, a }); }
        for (let k = 0; k < 9; k++) { const a = k * 0.6981 - tau * 0.9; obj.push({ z: Math.sin(a), x: cx + (455 + 30 * breath) * Math.cos(a), y: cy + 455 * 0.6 * Math.sin(a), kind: 1, k, a }); }
        for (let k = 0; k < 12; k++) { const a = k * 0.5236 + tau * 0.6; obj.push({ z: Math.sin(a), x: cx + 760 * Math.cos(a), y: cy + 760 * 0.52 * Math.sin(a), kind: 2, k, a }); }
        obj.sort((a, b) => a.z - b.z);
        const pop = ease.out(seg(tau, 0, 0.7));
        let sealDrawn = false;
        const drawSeal = () => { const s = 300 * (0.94 + 0.12 * kick) * pop; g.globalAlpha = 1; g.setTransform(1, 0, 0, 1, cx, cy); g.rotate(-tau * 0.2); g.drawImage(V.img.seal, -s / 2, -s / 2, s, s); g.setTransform(1, 0, 0, 1, 0, 0); sealDrawn = true; };
        for (const o of obj) {
          if (!sealDrawn && o.z > 0) drawSeal();
          const depth = 0.8 + 0.3 * (o.z + 1) / 2;
          g.globalAlpha = (0.6 + 0.4 * (o.z + 1) / 2) * pop;
          if (o.kind === 0) { const s = 150 * depth * pop; g.drawImage(V.spheres[o.k % V.spheres.length], o.x - s / 2, o.y - s / 2, s, s); }
          else if (o.kind === 1) { const s = 230 * depth * pop; g.setTransform(1, 0, 0, 1, o.x, o.y); g.rotate(tau * (o.k % 2 ? 0.7 : -0.5) + o.k); g.drawImage(V.stones[o.k % 3], -s / 2, -s / 2, s, s); g.setTransform(1, 0, 0, 1, 0, 0); }
          else {
            const phi = tau * 3 + o.k * 0.9, c = Math.cos(phi), two = o.k % 2 === 0;
            const w = 250 * depth * pop, h = w * 0.5 * Math.max(0.08, Math.abs(c));
            g.setTransform(1, 0, 0, 1, o.x, o.y); g.rotate(o.a + Math.PI / 2);
            g.drawImage(V.bills[o.k % 5][(two ? 2 : 0) + (c < 0 ? 1 : 0)], -w / 2, -h / 2, w, h); g.setTransform(1, 0, 0, 1, 0, 0);
          }
        }
        if (!sealDrawn) drawSeal();
        g.globalAlpha = 1;
      }
    }

    /* ----- S3, THE GALLERY: down an endless hall hung with the posters ----- */
    const s3 = document.getElementById('__s3'), v3 = win(71.7, 80.3, 0.5, 0.5);
    s3.style.opacity = v3.toFixed(3);
    if (v3 > 0) {
      const tau = t - SC.hall, PW = 760, PH = 520, HW = 430, D = 820, M = 10, P = 700;
      const dist = 700 * tau + 85 * tau * tau;   // faster and faster
      const hall = document.getElementById('__hall');
      hall.style.transform = `rotateZ(${(Math.sin(tau * 0.8) * 3).toFixed(2)}deg) translateY(${(Math.sin(tau * 2.1) * 10).toFixed(1)}px)`;
      hall.querySelectorAll('.__wp').forEach((el) => {
        const k = +el.dataset.k, left = k < M, j = left ? k : k - M;
        // how far ahead this panel's near edge is; it comes round again when it has gone by
        const d = ((((j * D + (left ? 0 : D / 2) - dist + D) % (M * D)) + M * D) % (M * D)) - D;
        const o = clamp((d + 420) / 320) * clamp(1.2 - d / (7.2 * D));
        el.style.opacity = o.toFixed(3);
        if (o <= 0) { el.style.visibility = 'hidden'; return; }
        el.style.visibility = '';
        el.style.transform = left ? `translate3d(${-HW}px, ${-PH / 2}px, ${(P - d).toFixed(1)}px) rotateY(90deg)` : `translate3d(${HW}px, ${-PH / 2}px, ${(P - d - PW).toFixed(1)}px) rotateY(-90deg)`;
      });
      const fl = document.getElementById('__floor'), ce = document.getElementById('__ceil');
      fl.style.transform = `translate3d(${-HW}px, ${PH / 2 + 4}px, ${P - 60}px) rotateX(-90deg)`;
      fl.style.backgroundPosition = `0 0, 0 ${(-(dist % 430)).toFixed(1)}px`;
      ce.style.transform = `translate3d(${-HW}px, ${-PH / 2 - 4}px, ${P - 60}px) rotateX(-90deg)`;
      ce.style.backgroundPosition = `0 0, 0 ${(-(dist % 410)).toFixed(1)}px, 0 0`;
      document.getElementById('__door').style.transform = `translateZ(-6200px) scale(${(1.6 + 0.3 * kick).toFixed(3)})`;
    }

    /* ----- S4, THE RING: the banner, a realm's colours a bar, for the lens to wrap into a tunnel ----- */
    const s4 = document.getElementById('__s4'), v4 = win(79.7, 86.3, 0.5, 0.5);
    s4.style.opacity = v4.toFixed(3);
    if (v4 > 0) {
      const tau = t - SC.ring, bar = tau / 2;
      s4.querySelectorAll('.__bn').forEach((el, i) => {
        // each realm's banner cross-fades in over the last on the bar
        el.style.opacity = (i === 0 ? 1 : sm(clamp((bar - (i - 1)) * 4 - 3))).toFixed(3);
        el.style.backgroundPosition = `${(-tau * 30).toFixed(1)}px ${(Math.sin(tau * 0.6) * 20).toFixed(1)}px`;
      });
    }
  }
  // the fleet patrols the crystal
  if (t > 87 && t < 96.5) {
    for (const [id, type, a, b, y0, dir, size] of [['f1', 'disc', 87.6, 90.2, 0.3, 1, 190], ['f2', 'tictac', 90.4, 92.6, 0.68, -1, 170], ['f3', 'triangle', 92.8, 95.6, 0.4, 1, 210]]) {
      const q = seg(t, a, b);
      S.craft(id, { type, x: dir > 0 ? lerp(-260, W + 260, q) : lerp(W + 260, -260, q), y: H * y0 + Math.sin(q * 9) * 40, size: size * (0.7 + 0.6 * Math.sin(Math.PI * q)), rot: dir * 8, opacity: q > 0 && q < 1 ? 1 : 0 });
    }
  }

  /* ================= CALM: a veil over the page for the name ================= */
  const veil = document.getElementById('__veil');
  if (veil) veil.style.opacity = sm(seg(t, 109.6, 110.8)).toFixed(3);
}

/* ================= Stage B: the trip ================= */
function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  const win = (a, b, fi = 0.4, fo = 0.4) => sm(seg(a, a + fi)) * (1 - sm(seg(b - fo, b)));
  const beat = Math.exp(-((((t % 0.5) + 0.5) % 0.5)) * 6);
  const B = t * Math.PI;   // one breath every two seconds, on the bar
  const u = { sky: [0.3, 0, 0], bloom: 0.22, glow: 0.36, grain: 0.016, hue: 0, chroma: 0.001, trails: 0.06, cam: [1, 0, 0], zoom: 1, pan: [0, 0], warp: 0.001,
    accent: t < REALM_AT ? [0.365, 0.894, 1] : [0.78, 0.61, 1], accent2: t < REALM_AT ? [0.365, 1, 0.694] : [1, 0.68, 0.32] };

  // the page arrives out of the dark
  if (t < 2.6) { const arr = sm(seg(0, 2.4)); u.cam = [arr, -10 * (1 - arr), 6 * (1 - arr)]; u.black = 1 - sm(seg(0, 0.7)); }
  // the realm click repaints the page on a scan line
  if (t >= REALM_AT && t < REALM_AT + 0.6) { u.wipe = seg(REALM_AT, REALM_AT + 0.55); u.held = Math.round(REALM_AT * FPS) - 1; u.wipeKind = 1; }
  for (const tc of CLICKS) { const k = t >= tc ? Math.exp(-(t - tc) * 5) : 0; u.chroma += 0.003 * k; u.warp += 0.002 * k; }
  // every journey down or up the page streaks
  for (const [a, b] of SCROLLS) { const k = Math.sin(Math.PI * seg(a, b)); u.trails = Math.max(u.trails, 0.08 + 0.3 * k); u.zoom += 0.035 * k; u.warp += 0.004 * k; u.chroma += 0.002 * k; }

  // THE FLEET: the trip comes in with them and grows until the mothership has everything
  const I = sm(seg(17.4, 55));
  if (t >= 17.4 && t < 56.2) {
    u.edge = [0.1 + 0.42 * I, 2 + 3 * I, 0.004 + 0.004 * I, B]; u.edgeTint = 0.85;
    u.breathe = [0.3 * I, B];
    u.trails = Math.max(u.trails, 0.08 + 0.2 * I);
    u.chroma += 0.002 * I; u.warp += 0.002 * I; u.bloom = 0.24 + 0.08 * I; u.glow = 0.38 + 0.08 * I;
    u.cam = [1, 1.4 * I * Math.sin(t * 0.31), 1.0 * I * Math.sin(t * 0.23)];
    for (const ta of TAKES) { const k = t >= ta ? Math.exp(-(t - ta) * 3.5) : 0; u.chroma += 0.003 * k; u.zoom += 0.012 * k; }
    // the mothership: the frame is drawn up its beam, and goes white
    const m = sm(seg(51.4, 56.0));
    u.trails = Math.max(u.trails, 0.5 * m); u.zoom += 0.55 * m * m; u.pan = [0, -0.16 * m]; u.bloom += 0.16 * m;
    u.white = sm(seg(55.0, 56.0));
  }

  // ABOARD
  if (t >= 56.0 && t < 102.9) {
    u.sky = [0, 0, 0];
    u.white = 1 - sm(seg(56.0, 56.9));
    u.cam = [1, 1.2 * Math.sin(t * 0.37), 0.9 * Math.sin(t * 0.29)];
    u.edgeTint = 0.9; u.bloom = 0.3; u.glow = 0.46;
    // the hold: the cargo turns, leaving a little of itself behind
    u.edge = [0.3, 3, 0.006, B]; u.breathe = [0.3, B]; u.trails = 0.22; u.chroma = 0.0018; u.warp = 0.002;
    const sMoney = win(SC.money - 0.3, SC.hall + 0.3), sHall = win(SC.hall - 0.3, SC.ring + 0.3), sRing = win(SC.ring - 0.3, SC.lattice + 0.3, 0.5, 0.5);
    const sLat = win(SC.lattice - 0.3, SC.peak + 0.2), sPeak = t >= SC.peak ? 1 : 0;
    // the money: every note leaves a tracer
    u.trails += 0.26 * sMoney; u.edge[0] += 0.2 * sMoney; u.zoom += 0.03 * beat * sMoney; u.breathe[0] += 0.2 * sMoney;
    // the gallery: speed; the walls smear as the hall quickens, and a moment of mirrors at its end
    const fast = sm(seg(SC.hall + 3, SC.ring));
    u.trails += (0.1 + 0.26 * fast) * sHall; u.chroma += 0.004 * fast * sHall; u.zoom += (0.02 * beat + 0.06 * fast) * sHall; u.edge[0] -= 0.12 * sHall; u.breathe[0] -= 0.2 * sHall;
    u.kaleido = 0.55 * win(78.9, 80.2, 0.35, 0.35); u.kalN = 6;
    // the ring: the banner wrapped into a looping tunnel
    if (sRing > 0) { u.tunnel = [0.92 * sRing, (t - SC.ring) * 1.7, 0.24, 0.3 * sRing]; u.zoom += 0.04 * beat * sRing; u.trails += 0.1 * sRing; }
    // the lattice: its outlines echo, it breathes, and the realms' colours pass over it
    u.edge[0] += 0.12 * sLat; u.breathe[0] += 0.15 * sLat; u.trails += (0.08 + 0.16 * sm(seg(SC.lattice + 4, SC.peak))) * sLat;
    u.hue = 46 * Math.sin((t - SC.lattice) * 0.62) * sLat;
    u.zoom += 0.035 * beat * sLat; u.chroma += 0.003 * sm(seg(SC.lattice + 4, SC.peak)) * sLat;
    // the peak: everything in orbit, trailing; a moment of mirrors; white
    if (sPeak) {
      u.trails = 0.5; u.edge = [0.62, 6, 0.009, B]; u.breathe = [0.7, B]; u.bubble = [0.12, 40, 1]; u.chroma = 0.004; u.warp = 0.005;
      u.zoom = 1 + 0.05 * beat; u.bloom = 0.36; u.glow = 0.52;
      u.kaleido = Math.max(u.kaleido || 0, 0.5 * win(99.4, 101.2, 0.4, 0.4)); u.kalN = 8;
      u.white = Math.max(u.white || 0, sm(seg(101.3, 102.2)));
    }
    if (t < SC.peak) { const cut = Math.exp(-Math.max(0, t - SC.lattice) * 4) * (t >= SC.lattice ? 1 : 0); u.chroma += 0.004 * cut; }
  }

  // THE RETURN: the white clears on the page, and the trip lets go as each thing comes home
  if (t >= 102.2 && t < 110.2) {
    const out = 1 - sm(seg(102.6, 109.6));
    u.white = Math.max(u.white || 0, 1 - sm(seg(102.2, 103.2)));
    if (t >= 102.9) {
      u.edge = [0.4 * out, 3, 0.005, B]; u.edgeTint = 0.85; u.breathe = [0.28 * out, B];
      u.trails = Math.max(u.trails, 0.1 + 0.22 * out); u.bloom = 0.24 + 0.08 * out; u.glow = 0.38 + 0.08 * out;
      for (const ta of GIVES) { const k = t >= ta ? Math.exp(-(t - ta) * 3.5) : 0; u.chroma += 0.003 * k; }
    }
  }

  if (t >= 110.2) {
    // CALM: the name over the veiled page, walking the scripts; a slow ripple at each change; the dark
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

export default {
  key: 'harvest',
  poster: 68.4,
  title: 'The Harvest — the fleet takes the Armory piece by piece, the hoard aboard the mothership, and everything given back',
  dur: 120,
  url: '/index.html',
  prefs: { cursor: 'disc', font: 'future' },
  act,
  lens,
  plates: ['wordmark@future@crystal', 'wordmark@runic@crystal', 'wordmark@oldworld@crystal'],
  cues: [
    { t: 0.3, kind: 'arrive' },
    { t: 3.0, kind: 'click' }, { t: 3.8, kind: 'realm' }, { t: 4.6, kind: 'click' },
    { t: 7.2, kind: 'click' }, { t: 7.2, kind: 'shift' }, { t: 8.8, kind: 'click' }, { t: 8.8, kind: 'shift' },
    { t: 13.2, kind: 'click' }, { t: 13.2, kind: 'holo' }, { t: 14.2, kind: 'click' }, { t: 14.2, kind: 'holo' },
    ...SCROLLS.map(([a]) => ({ t: a, kind: 'swoop' })),
    ...[17.9, 18.5, 19.1, 19.7, 20.3, 20.9].map((t) => ({ t, kind: 'hover' })),
    { t: 21.6, kind: 'deck' },
    ...TAKES.map((t) => ({ t, kind: 'take' })),
    { t: MOTHER, kind: 'mother' }, { t: 48.6, kind: 'beam' }, { t: 51.4, kind: 'feed' },
    { t: 55.4, kind: 'white' },
    { t: SC.hold, kind: 'orbit' }, { t: SC.money, kind: 'trip' }, { t: SC.money, kind: 'emerge' },
    { t: SC.hall, kind: 'dive' }, { t: SC.hall, kind: 'emerge' }, { t: 78.9, kind: 'mandala' },
    { t: SC.ring, kind: 'tunnel' }, { t: SC.lattice, kind: 'peak' }, { t: SC.lattice + 4, kind: 'push' },
    { t: SC.peak, kind: 'line' }, { t: 99.4, kind: 'mandala' }, { t: 100.7, kind: 'white' },
    { t: SC.back, kind: 'down' },
    ...GIVES.map((t) => ({ t, kind: 'give' })),
    { t: SC.calm, kind: 'calm' }, { t: SC.calm + 0.4, kind: 'seal' },
    ...OUTRO.map(([t, font]) => ({ t, kind: 'font', font })),
  ],
};
