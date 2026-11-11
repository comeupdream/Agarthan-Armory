/*
 * THE ATOM MACHINE — the Atomium behind the departments, switched on.
 *
 * Agarthan Crystal, in Future, with the Featured plate's Top backdrop and See-through switches on:
 * the Atomium (one crystal of iron, magnified 165 billion times) stands behind the department
 * cards. The film comes down off the banner onto it and the machine starts: it hums, it breathes
 * in its own light once a bar, the lights on its spheres shimmer, energy runs down its tubes from
 * the sphere hidden at its heart, arcs jump between the spheres, and the vaults charge one by one.
 * It builds to an overload — a storm of arcs — and the camera dives into the great top sphere.
 *
 * Inside: the crystal it is a model of. A flight through the endless iron lattice (body-centred
 * cubic, standing on its corner as the Atomium does), built from the Atomium's own spheres and
 * tubes: energy running the tubes, a wave of light out through the lattice every bar, arcs between
 * neighbours, the whole of it breathing; ONE CRYSTAL OF IRON · MAGNIFIED 165 BILLION TIMES. At the
 * peak it races. Then it rewinds: the lattice falls away until one cell is left — one Atomium —
 * and the camera comes back out through the sphere to the page, where the machine hums down.
 * CALM: the name walks the scripts.
 *
 * 100 BPM: one bar (2.4 s) is one breath of the machine.
 */

export const BAR = 2.4;
// the arcs between the spheres while the machine charges, and the storm at the overload
export const ARCS = [8.4, 9.6, 10.8, 11.7, 12.3, 12.9, 13.5, 13.95, 14.25];
export const STORM = Array.from({ length: 11 }, (_, i) => +(14.4 + i * 0.2).toFixed(2));
// arcs inside the lattice that the score marks (the picture arcs on every beat)
export const LAT_ARCS = [18.0, 20.4, 22.8, 25.2, 27.6, 30.0];
// the calm's changes of script on the name: [t, font] (the plates' order below)
export const OUTRO = [[36.2, 'future'], [38.0, 'runic'], [39.2, 'oldworld'], [39.9, 'future']];

function act(t, S) {
  const { seg, ease, at, lerp } = S;
  const W = innerWidth, H = innerHeight;
  // (the act runs inside the page, so it carries its own copies of the timings)
  const BAR = 2.4, BEAT = 0.6;
  const ARCS = [8.4, 9.6, 10.8, 11.7, 12.3, 12.9, 13.5, 13.95, 14.25];
  const STORM = Array.from({ length: 11 }, (_, i) => 14.4 + i * 0.2);
  const sm = (x) => x * x * (3 - 2 * x);
  const fr = (x) => x - Math.floor(x);
  const hash = (n) => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const breath = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / BAR);   // one breath a bar
  const R = 'assets/img/feature/realm/crystal/atomium-1920.webp';

  /* ---------- once: the switches on, the overlays laid, the sphere sprites cut from the photo ---------- */
  at('setup', 0, () => {
    const st = document.createElement('style');
    st.textContent = `.banner-track{scroll-snap-type:none!important;scroll-behavior:auto!important}
      .dept{transition:none!important} .site-header{transition:none!important}`;
    document.head.appendChild(st);
    const sec = document.getElementById('departments');
    sec.classList.add('has-backdrop', 'see-through');
    const bd = sec.querySelector('.top-backdrop');
    // the arcs and the glows live between the photo and the cards
    const cv = document.createElement('canvas'); cv.id = '__arc';
    cv.style.cssText = 'position:absolute;left:0;top:0;z-index:-1;pointer-events:none';
    bd.after(cv);
    // the arcs cross over the glass cards, added as light
    const zc = document.createElement('canvas'); zc.id = '__zap';
    zc.style.cssText = 'position:absolute;left:0;top:0;z-index:3;pointer-events:none;mix-blend-mode:screen';
    sec.appendChild(zc);
    // the photo stands brighter for the film than the site's reading wash allows
    bd.style.setProperty('--bd-wash', '0.16');
    // the lattice: a full-frame canvas over everything
    const L = document.createElement('canvas'); L.id = '__lat'; L.width = W; L.height = H;
    L.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147482200;pointer-events:none;opacity:0';
    document.body.appendChild(L);
    const cap = document.createElement('div'); cap.id = '__cap';
    cap.style.cssText = 'position:fixed;left:50%;bottom:92px;width:1400px;margin-left:-700px;padding:34px 0 30px;z-index:2147482250;pointer-events:none;text-align:center;opacity:0;background:radial-gradient(ellipse 50% 50% at 50% 50%,rgba(10,4,20,.82),rgba(10,4,20,0) 100%)';
    cap.innerHTML = `<div id="__c1" style="font:700 64px/1.1 var(--f-display);letter-spacing:.14em;text-transform:uppercase;color:#fff7ec;text-shadow:0 0 28px rgba(255,170,80,.75),0 0 60px rgba(160,110,255,.6)">One crystal of iron</div>
      <div id="__c2" style="margin-top:18px;font:400 20px/1.4 var(--f-mono);letter-spacing:.42em;text-transform:uppercase;color:#e9dcff;text-shadow:0 0 18px rgba(160,110,255,.9)">magnified 165 billion times</div>`;
    document.body.appendChild(cap);
    const veil = document.createElement('div'); veil.id = '__veil';
    veil.style.cssText = 'position:fixed;inset:0;z-index:2147482300;pointer-events:none;background:radial-gradient(ellipse 80% 70% at 50% 50%, rgba(18,8,30,.74), rgba(6,3,12,.94));opacity:0';
    document.body.appendChild(veil);
    // a soft glow, drawn once and stamped everywhere (radial gradients per point would cost a frame each)
    const glow = (rgb, size = 128) => {
      const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
      const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.25, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
    };
    window.__gl = { warm: glow('255,190,110'), white: glow('255,250,240'), violet: glow('170,120,255') };
    const img = new Image(); img.src = R; window.__atom = img;
  });

  /* ---------- the Atomium's spheres, where the photo puts them (the 1920 copy, cover, 50% 30%) ---------- */
  const SPH = { TL: [332, 365, 172], TC: [962, 430, 255], TR: [1587, 370, 172], BL: [427, 1135, 150], BR: [1485, 1135, 150], C: [960, 790, 120] };
  const BONDS = [['TL', 'TC'], ['TC', 'TR'], ['TL', 'BL'], ['TR', 'BR'], ['TL', 'C'], ['TR', 'C'], ['BL', 'C'], ['BR', 'C'], ['TC', 'C']];
  // the arcs walk the long tubes round the machine (the short one down to the heart hides behind a card)
  const WALK = [0, 3, 6, 1, 2, 7, 4, 5];
  const sec = document.getElementById('departments');
  const bd = sec && sec.querySelector('.top-backdrop');
  const geo = () => {
    const w = sec.offsetWidth, h = sec.offsetHeight;
    const s = Math.max(w / 1920, h / 1546);
    const ox = (w - 1920 * s) * 0.5, oy = (h - 1546 * s) * 0.3;
    const P = {}; for (const k in SPH) P[k] = [ox + SPH[k][0] * s, oy + SPH[k][1] * s, SPH[k][2] * s];
    return { w, h, s, P };
  };

  // the sprites: each sphere of the photo, cut round, for the lattice
  if (!window.__spr && window.__atom && window.__atom.complete && window.__atom.naturalWidth) {
    window.__spr = ['TC', 'TL', 'TR', 'BL', 'BR'].map((k) => {
      const [cx, cy, r] = SPH[k], N = 256, c = document.createElement('canvas'); c.width = c.height = N;
      const g = c.getContext('2d');
      g.save(); g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 1, 0, Math.PI * 2); g.clip();
      g.drawImage(window.__atom, cx - r * 0.97, cy - r * 0.97, r * 1.94, r * 1.94, 0, 0, N, N); g.restore();
      // a soft rim, so a sphere sits in the dark rather than being punched out of it
      g.globalCompositeOperation = 'destination-in';
      const gr = g.createRadialGradient(N / 2, N / 2, N * 0.38, N / 2, N / 2, N / 2);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, N, N);
      return c;
    });
  }

  /* ---------- a lightning bolt, the same for the same seed ---------- */
  const bolt = (g, x1, y1, x2, y2, seed, amp, width, a) => {
    let pts = [[x1, y1], [x2, y2]];
    let disp = Math.hypot(x2 - x1, y2 - y1) * 0.16 * amp, sd = seed * 13.7;
    for (let it = 0; it < 6; it++) {
      const np = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
        sd += 1; const r = hash(sd) * 2 - 1;
        np.push([(ax + bx) / 2 + (nx / nl) * disp * r, (ay + by) / 2 + (ny / nl) * disp * r], pts[i + 1]);
      }
      pts = np; disp *= 0.55;
    }
    const fork = pts[Math.floor(pts.length * (0.3 + 0.4 * hash(seed + 5)))];
    const fa = Math.atan2(y2 - y1, x2 - x1) + (hash(seed + 9) - 0.5) * 2.2;
    const fl = Math.hypot(x2 - x1, y2 - y1) * 0.25;
    const fpts = [fork]; for (let i = 1; i <= 8; i++) fpts.push([fork[0] + Math.cos(fa) * fl * i / 8 + (hash(seed + i * 3) - 0.5) * fl * 0.25, fork[1] + Math.sin(fa) * fl * i / 8 + (hash(seed + i * 7) - 0.5) * fl * 0.25]);
    for (const [w, c] of [[width * 7, `rgba(160,110,255,${0.16 * a})`], [width * 2.6, `rgba(255,170,90,${0.55 * a})`], [width, `rgba(255,250,240,${0.95 * a})`]]) {
      g.lineWidth = w; g.strokeStyle = c; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke();
      g.lineWidth = w * 0.6; g.beginPath(); g.moveTo(fpts[0][0], fpts[0][1]); for (const p of fpts) g.lineTo(p[0], p[1]); g.stroke();
    }
  };
  const stamp = (g, img, x, y, size, a) => { if (a <= 0.003 || size < 0.5) return; g.globalAlpha = Math.min(1, a); g.drawImage(img, x - size / 2, y - size / 2, size, size); };

  /* ---------- where the film stands: the banner, then the machine ---------- */
  const NAV = (document.querySelector('.site-header') || { offsetHeight: 68 }).offsetHeight;
  const ban = S.memo('ban', () => { const b = document.querySelector('.banner'); const r = b.getBoundingClientRect(); return Math.max(0, r.top + scrollY - NAV - Math.max(0, H - NAV - r.height) / 2); });
  const hold = S.memo('hold', () => { const r = sec.getBoundingClientRect(); return r.top + scrollY + Math.max(0, (r.height - H) / 2) + 10; });
  const G = geo();
  const secTop = S.memo('secTop', () => sec.getBoundingClientRect().top + scrollY);
  // the dive puts the great top sphere in the middle of the frame, and the camera goes into it
  const tcY = secTop + G.P.TC[1] - H / 2;
  const dive = ease.inOut(seg(t, 14.6, 16.4)), back = 1 - ease.inOut(seg(t, 33.0, 34.4));
  const inside = t >= 16.4 && t < 33.0;
  let y = ban;
  if (t >= 2.4) y = lerp(ban, hold, ease.inOut(seg(t, 2.4, 4.8)));
  if (t >= 4.8) y = hold + 14 * Math.sin((t - 4.8) * 0.5);
  if (t >= 14.6 && t < 33.0) y = lerp(hold, tcY, dive);
  if (t >= 33.0) y = lerp(hold + 14 * Math.sin((t - 4.8) * 0.5), tcY, back);
  scrollTo(0, y);
  const hdr = document.querySelector('.site-header');
  if (hdr) hdr.style.opacity = String(1 - sm(seg(t, 3.4, 4.6)));

  /* ---------- THE MACHINE: its charge, from the first hum to the overload and back down ---------- */
  const E = clamp(0.25 * sm(seg(t, 4.8, 6.0)) + 0.75 * sm(seg(t, 6.0, 14.4)) + 0.4 * sm(seg(t, 14.4, 16.0)), 0, 1.4)
    * (1 - 0.65 * sm(seg(t, 34.4, 35.8)));
  const zoom = 1 + 2.4 * Math.max(t < 33 ? dive : 0, t >= 33 ? back : 0);
  if (bd) {
    const b = 1.04 + (0.22 + 0.16 * E) * E * breath, sat = 1 + 0.25 * E;
    bd.style.filter = `brightness(${b.toFixed(3)}) saturate(${sat.toFixed(3)})`;
    bd.style.transformOrigin = `${G.P.TC[0]}px ${G.P.TC[1]}px`;
    bd.style.transform = `scale(${(zoom * (1 + 0.006 * E * breath)).toFixed(4)})`;
  }
  const wrap = sec.querySelector('.wrap');
  wrap.style.opacity = String(1 - Math.max(t < 33 ? sm(seg(t, 14.8, 15.8)) : 0, t >= 33 ? 1 - sm(seg(t, 33.8, 34.8)) : 0));

  // the vaults charge one by one with the beat, then all together as it builds
  const cards = [...sec.querySelectorAll('.dept')];
  const order = [0, 1, 2, 5, 4, 3];
  const kb = Math.floor((t - 7.2) / BEAT);
  cards.forEach((el, i) => {
    let ch = 0.3 * E * breath;
    if (t >= 7.2 && t < 14.4 && order[((kb % 6) + 6) % 6] === i) ch += Math.exp(-(t - (7.2 + kb * BEAT)) * 3.2);
    if (t >= 14.4 && t < 16.8) ch += 0.6 + 0.4 * hash(Math.floor(t * 15) + i * 7);
    ch = clamp(ch, 0, 1.3);
    el.style.boxShadow = `0 0 ${(26 * ch).toFixed(1)}px rgba(255,170,80,${(0.45 * ch).toFixed(3)}), inset 0 0 ${(34 * ch).toFixed(1)}px rgba(170,120,255,${(0.35 * ch).toFixed(3)})`;
    el.style.borderColor = `rgba(255,196,130,${(0.18 + 0.6 * clamp(ch)).toFixed(3)})`;
    el.style.transform = `translateY(${(-5 * clamp(ch)).toFixed(2)}px)`;
    const svg = el.querySelector('.holo-wrap svg');
    if (svg) svg.style.filter = `drop-shadow(0 0 ${(4 + 14 * ch).toFixed(1)}px rgba(255,190,120,${(0.35 + 0.5 * clamp(ch)).toFixed(3)}))`;
  });

  // the arcs, the glows and the shimmer, between the photo and the cards
  const cv = document.getElementById('__arc'), zc = document.getElementById('__zap');
  if (cv && zc) {
    for (const c of [cv, zc]) {
      if (c.width !== G.w || c.height !== G.h) { c.width = G.w; c.height = G.h; c.style.width = G.w + 'px'; c.style.height = G.h + 'px'; }
      c.style.transformOrigin = `${G.P.TC[0]}px ${G.P.TC[1]}px`;
      c.style.transform = `scale(${zoom.toFixed(4)})`;
      const cg = c.getContext('2d'); cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalAlpha = 1; cg.globalCompositeOperation = 'source-over'; cg.clearRect(0, 0, c.width, c.height);
    }
    const g = cv.getContext('2d'), gz = zc.getContext('2d');
    const show = !inside || t < 16.8 || t > 32.6;
    if (show && E > 0.01 && window.__gl) {
      g.globalCompositeOperation = 'lighter';
      const GL = window.__gl, P = G.P;
      // the heart: the sphere hidden behind the tower, where the tubes meet
      stamp(g, GL.warm, P.C[0], P.C[1], 520 * G.s * (0.8 + 0.4 * breath), 0.5 * E * (0.6 + 0.4 * breath));
      // each sphere glows in turn round the frame, and all of them with the breath
      const ring = ['TC', 'TR', 'BR', 'BL', 'TL'];
      ring.forEach((k, i) => {
        const [x, yy, r] = P[k];
        const turn = Math.exp(-((fr(t / BAR - i / 5) * 5) ** 2) * 0.6);
        stamp(g, GL.warm, x, yy, r * 3.2, (0.18 + 0.3 * turn) * E * (0.7 + 0.3 * breath));
        stamp(g, GL.violet, x, yy, r * 4.4, 0.12 * E * breath);
        // the lights on the sphere shimmer
        for (let j = 0; j < 34; j++) {
          const h1 = hash(i * 100 + j), h2 = hash(i * 100 + j + 50), a = h1 * Math.PI * 2, rr = r * 0.92 * Math.sqrt(h2);
          const tw = 0.5 + 0.5 * Math.sin(t * (5 + 6 * h1) + h2 * 40);
          stamp(g, GL.white, x + Math.cos(a) * rr, yy + Math.sin(a) * rr, (7 + 9 * h2) * (0.6 + 0.6 * tw), E * tw * (0.35 + 0.4 * turn));
        }
      });
      // energy running the tubes, out from the heart
      BONDS.forEach(([a, b], i) => {
        const A = P[a], B = P[b];
        for (let q = 0; q < 3; q++) {
          const p = fr(t * 0.55 + i * 0.137 + q / 3);
          const x = lerp(B[0], A[0], p), yy = lerp(B[1], A[1], p);
          stamp(g, GL.warm, x, yy, 34 * G.s * (1 + E), 0.6 * E * Math.sin(Math.PI * p));
        }
      });
      // the arcs: one bond at a beat while it charges, two at a time in the storm
      gz.globalCompositeOperation = 'lighter';
      const fire = (ta, life, n, w0) => {
        if (t < ta || t > ta + life) return;
        const a = 1 - (t - ta) / life;
        for (let m = 0; m < n; m++) {
          const [p, q] = BONDS[WALK[(w0 + m * 3) % WALK.length]];
          const A = P[p], B = P[q];
          const dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1;
          // from sphere surface to sphere surface; the shape flickers every two frames
          const seed = ta * 100 + m * 7 + Math.floor((t - ta) * 15);
          const x1 = A[0] + (dx / d) * A[2] * 0.85, y1 = A[1] + (dy / d) * A[2] * 0.85, x2 = B[0] - (dx / d) * B[2] * 0.85, y2 = B[1] - (dy / d) * B[2] * 0.85;
          bolt(gz, x1, y1, x2, y2, seed, 1.1, 3.2, a);
          // where it lands, the sphere flares
          stamp(g, GL.white, x2, y2, B[2] * 1.6, 0.5 * a); stamp(g, GL.warm, x1, y1, A[2] * 1.4, 0.4 * a);
        }
      };
      ARCS.forEach((ta, i) => fire(ta, 0.32, i >= 5 ? 2 : 1, i));
      STORM.forEach((ta, i) => fire(ta, 0.24, 2, i * 2 + 1));
      fire(34.8, 0.36, 1, 5);
      gz.globalAlpha = 1; gz.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  /* ---------- INSIDE: the iron lattice, made of the Atomium's own spheres ---------- */
  const L = document.getElementById('__lat');
  const lv = sm(seg(t, 16.2, 17.0)) * (1 - sm(seg(t, 33.0, 33.6)));
  if (L) L.style.opacity = lv.toFixed(3);
  if (L && lv > 0 && window.__spr) {
    const g = L.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // the sky the photo was taken under: violet overhead, the city's orange glow below
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d0618'); bg.addColorStop(0.55, '#1b0c2a'); bg.addColorStop(1, '#3a1d0c');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // the flight: out along a line through the crystal that meets no row of atoms head on
    const n3 = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const D = n3([0.31, 0.47, 0.83]);
    const up0 = n3([1, 1, 1].map((c, i) => c - D[i] * dot([1, 1, 1], D)));   // the crystal stands on its corner
    const rt0 = cross(D, up0);
    const roll = 0.16 * (t - 16.8) + 0.6 * sm(seg(t, 24.0, 28.8)) + 0.35 * Math.sin((t - 16.8) * 0.4);
    const rt = rt0.map((c, i) => c * Math.cos(roll) + up0[i] * Math.sin(roll));
    const up = up0.map((c, i) => c * Math.cos(roll) - rt0[i] * Math.sin(roll));
    // speed (cells a second): it gathers, races over the peak, eases, and then the rewind
    const speed = (tt) => 0.5 + 0.35 * sm(seg(tt, 18.0, 21.6)) + 1.05 * sm(seg(tt, 24.0, 25.2)) - 1.0 * sm(seg(tt, 28.8, 30.6));
    let dist = 0; for (let tt = 16.8; tt < Math.min(t, 31.2); tt += 1 / 120) dist += speed(tt) / 120;
    const home = [0.5, 0.5, 0.5];
    const far = home.map((c, i) => c + D[i] * dist);
    // the rewind: back down the line and out past the first cell, which is left alone in the dark
    const rew = ease.inOut(seg(t, 31.2, 32.8));
    const out = home.map((c, i) => c - D[i] * 1.95);
    const Cm = t < 31.2 ? far : far.map((c, i) => lerp(c, out[i], rew));
    const only = sm(seg(t, 31.6, 32.6));   // how far everything but the first cell has gone
    const f = W * 0.62;
    const proj = (p) => {
      const v = [p[0] - Cm[0], p[1] - Cm[1], p[2] - Cm[2]];
      const z = dot(v, D);
      return [W / 2 + (f * dot(v, rt)) / z, H / 2 - (f * dot(v, up)) / z, z];
    };
    const inHome = (p) => p.every((c) => c >= -0.01 && c <= 1.01);
    const nodes = [], bonds = [];
    const N = 3, c0 = Cm.map((c) => Math.floor(c));
    const key = (p) => p.map((c) => Math.round(c * 2)).join(',');
    const seen = new Map();
    const add = (p) => { const k = key(p); if (seen.has(k)) return seen.get(k); const q = proj(p); const nd = { p, x: q[0], y: q[1], z: q[2], home: inHome(p), k }; seen.set(k, nd); nodes.push(nd); return nd; };
    for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) for (let k = -N; k <= N; k++) {
      const c = [c0[0] + i, c0[1] + j, c0[2] + k];
      const a = add(c);
      for (const d of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) bonds.push([a, add([c[0] + d[0], c[1] + d[1], c[2] + d[2]])]);
      const m = add([c[0] + 0.5, c[1] + 0.5, c[2] + 0.5]);
      for (const d of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]]) bonds.push([m, add([c[0] + d[0], c[1] + d[1], c[2] + d[2]])]);
    }
    // the wave of light out from the camera, once a bar
    const wr = fr((t - 16.8) / BAR) * 5.5;
    const fog = (z, home) => (z < 0.08 || z > 4.4 ? 0 : Math.exp(-z * 0.62) * Math.min(1, (z - 0.08) * 4) * Math.min(1, (4.4 - z) * 1.5)) * (home ? 1 : 1 - only);
    const lit = (nd) => { const d3 = Math.hypot(nd.p[0] - Cm[0], nd.p[1] - Cm[1], nd.p[2] - Cm[2]); return Math.exp(-((d3 - wr) ** 2) * 2.2); };
    // the tubes: silver, lit from inside by what runs through them
    g.lineCap = 'round';
    for (const [a, b] of bonds) {
      if (a.z < 0.1 || b.z < 0.1) continue;
      const fa = Math.min(fog(a.z, a.home), fog(b.z, b.home)); if (fa < 0.01) continue;
      const zz = (a.z + b.z) / 2;
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.lineWidth = Math.min(30, (0.05 * f) / zz);
      g.strokeStyle = `rgba(150,140,176,${(0.5 * fa).toFixed(3)})`;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.lineWidth = Math.min(8, (0.012 * f) / zz);
      g.strokeStyle = `rgba(255,176,96,${(0.22 * fa * (0.4 + 0.6 * breath)).toFixed(3)})`;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    g.globalCompositeOperation = 'lighter';
    const GL = window.__gl;
    // energy running the tubes
    bonds.forEach(([a, b], i) => {
      if (a.z < 0.15 || b.z < 0.15 || hash(i * 3.1 + a.p[0] * 7 + b.p[2]) > 0.35) return;
      const fa = Math.min(fog(a.z, a.home), fog(b.z, b.home)); if (fa < 0.02) return;
      const p = fr(t * 0.9 + hash(i * 1.7));
      const x = lerp(a.x, b.x, p), yy = lerp(a.y, b.y, p), z = lerp(a.z, b.z, p);
      stamp(g, GL.warm, x, yy, Math.min(120, (0.22 * f) / z), 0.8 * fa * Math.sin(Math.PI * p));
    });
    // the spheres, far to near, breathing; the wave lights them as it passes
    nodes.sort((a, b) => b.z - a.z);
    g.globalCompositeOperation = 'source-over';
    for (const nd of nodes) {
      const a = fog(nd.z, nd.home); if (a < 0.01) continue;
      const w = lit(nd);
      const r = ((0.26 + 0.025 * breath) * f) / nd.z;
      if (r > H * 1.6 || nd.x < -r || nd.x > W + r || nd.y < -r || nd.y > H + r) continue;
      g.globalCompositeOperation = 'lighter';
      stamp(g, GL.violet, nd.x, nd.y, r * 3.6, 0.14 * a * (0.5 + 0.5 * breath) + 0.32 * a * w);
      stamp(g, GL.warm, nd.x, nd.y, r * 2.5, 0.16 * a + 0.45 * a * w);
      g.globalCompositeOperation = 'source-over';
      const spr = window.__spr[Math.floor(hash(nd.k.length * 13 + nd.p[0] * 3 + nd.p[1] * 5 + nd.p[2] * 7) * window.__spr.length)];
      g.globalAlpha = Math.min(1, a * 1.15);
      g.drawImage(spr, nd.x - r, nd.y - r, 2 * r, 2 * r);
      if (w > 0.05) { g.globalCompositeOperation = 'lighter'; stamp(g, GL.white, nd.x, nd.y, r * 1.6, 0.35 * a * w); }
    }
    g.globalAlpha = 1;
    // arcs between neighbours, on the beat
    g.globalCompositeOperation = 'lighter';
    const kb2 = Math.floor((t - 16.8) / BEAT);
    for (let m = 0; m < 2 && t >= 17.4 && t < 31.6; m++) {
      const ta = 16.8 + kb2 * BEAT, life = 0.24;
      if (t - ta > life) continue;
      const near = bonds.filter(([a, b]) => a.z > 0.4 && b.z > 0.4 && a.z < 2.6 && b.z < 2.6 && a.x > 0 && a.x < W && b.x > 0 && b.x < W && a.y > 0 && a.y < H && b.y > 0 && b.y < H);
      if (!near.length) continue;
      const [a, b] = near[Math.floor(hash(kb2 * 11 + m * 5) * near.length)];
      bolt(g, a.x, a.y, b.x, b.y, kb2 * 100 + m * 7 + Math.floor((t - ta) * 15), 1, Math.max(1.2, 4 / ((a.z + b.z) / 2)), 1 - (t - ta) / life);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  /* ---------- the words, from the Atomium's own plate ---------- */
  const cap = document.getElementById('__cap');
  if (cap) {
    cap.style.opacity = String(sm(seg(t, 19.2, 20.2)) * (1 - sm(seg(t, 25.4, 26.4))));
    document.getElementById('__c2').style.opacity = String(sm(seg(t, 21.0, 22.0)));
    cap.style.transform = `translateY(${(8 * (1 - sm(seg(t, 19.2, 20.4)))).toFixed(2)}px) scale(${(1 + 0.012 * breath).toFixed(4)})`;
  }

  /* ---------- CALM: a veil over the page for the name ---------- */
  const veil = document.getElementById('__veil');
  if (veil) veil.style.opacity = sm(seg(t, 35.4, 36.4)).toFixed(3);
}

/* ---------- Stage B: the trip ---------- */
function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  const BEAT = 0.6;
  const B = (t * 2 * Math.PI) / BAR;   // one breath a bar, with the machine
  const beat = (tt) => Math.exp(-((((tt % BEAT) + BEAT) % BEAT)) * 6);
  const u = { sky: [0, 0, 0], bloom: 0.24, glow: 0.38, grain: 0.016, hue: 0, chroma: 0.001, trails: 0.06, cam: [1, 0, 0], zoom: 1, pan: [0, 0], warp: 0.001,
    accent: [0.78, 0.61, 1], accent2: [1, 0.68, 0.32] };

  // the page arrives out of the dark, on the banner
  if (t < 2.4) {
    const arr = sm(seg(0, 2.2));
    u.cam = [arr, -8 * (1 - arr), 5 * (1 - arr)];
    u.black = 1 - sm(seg(0, 0.6));
  }
  // down onto the machine
  const sw = Math.sin(Math.PI * seg(2.4, 4.8));
  u.trails = Math.max(u.trails, 0.06 + 0.2 * sw); u.zoom += 0.02 * sw;

  // THE MACHINE: tracers round the art in its own colours, breathing with it, rising with the charge
  const E = Math.min(1.4, 0.25 * sm(seg(4.8, 6.0)) + 0.75 * sm(seg(6.0, 14.4)) + 0.4 * sm(seg(14.4, 16.0))) * (1 - 0.7 * sm(seg(34.4, 35.8)));
  if (t < 16.6 || (t >= 33.2 && t < 35.6)) {
    u.edge = [0.08 + 0.34 * E, 2 + 2 * E, 0.004 + 0.002 * E, B];
    u.edgeTint = 0.85;
    u.breathe = [0.26 * E, B];
    u.trails = Math.max(u.trails, 0.08 + 0.18 * E);
    u.chroma = 0.001 + 0.0018 * E; u.warp = 0.001 + 0.0018 * E;
    u.bloom = 0.24 + 0.1 * E; u.glow = 0.38 + 0.1 * E;
    for (const ta of [...ARCS, ...STORM, 34.8]) {
      const k = t >= ta ? Math.exp(-(t - ta) * 9) : 0;
      u.chroma += 0.004 * k; u.warp += 0.003 * k;
    }
    // the dive into the great sphere, and the way back out (the page zooms itself; this adds the rush)
    const dv = sm(seg(15.0, 16.6)), bk = 1 - sm(seg(33.2, 34.4));
    const z = t < 33 ? dv : bk;
    u.zoom = 1 + 0.7 * z * z;
    u.trails = Math.max(u.trails, 0.45 * z);
    u.bloom += 0.14 * z;
  }

  // INSIDE THE CRYSTAL: the lattice breathes, its outlines echo in its own colours, the flight streaks
  if (t >= 16.6 && t < 33.2) {
    const on = sm(seg(16.6, 17.4)) * (1 - sm(seg(32.6, 33.2)));
    const peak = sm(seg(24.0, 24.6)) * (1 - sm(seg(28.8, 29.8)));
    const rew = Math.sin(Math.PI * seg(31.2, 32.8));
    u.edge = [0.32 * on + 0.15 * peak, 3 + 2 * peak, 0.006 + 0.003 * peak, B];
    u.edgeTint = 0.9;
    u.breathe = [0.45 * on, B];
    u.trails = 0.26 + 0.2 * peak + 0.25 * rew;
    u.bloom = 0.32 + 0.06 * peak; u.glow = 0.48 + 0.06 * peak;
    u.chroma = 0.0018 + 0.004 * peak + 0.004 * rew; u.warp = 0.0025 + 0.004 * peak + 0.004 * rew;
    u.cam = [1, 1.4 * Math.sin(t * 0.37), 1.0 * Math.sin(t * 0.29)];
    u.zoom = 1 + 0.035 * beat(t) * (0.4 + peak);
    // coming out of the sphere: the rush carries on through the cross-fade
    const em = 1 - sm(seg(16.6, 17.6));
    u.zoom += 0.5 * em; u.trails = Math.max(u.trails, 0.45 * em);
  }

  if (t >= 35.6) {
    // CALM: the name over the veiled page, walking the scripts; a slow ripple at each change; the dark
    let rip = 0;
    for (const [tc] of OUTRO) if (t >= tc) rip = Math.max(rip, Math.exp(-(t - tc) * 2.6));
    u.trails = 0.12 + 0.25 * rip; u.warp = 0.0015 + 0.02 * rip; u.chroma = 0.0015 + 0.004 * rip;
    u.edge = [0, 0, 0, 0]; u.breathe = [0, 0]; u.bloom = 0.26; u.glow = 0.45; u.cam = [1, 0, 0];
    const e = sm(seg(35.8, 36.8));
    let cur = 0;
    OUTRO.forEach(([tc], k) => { if (t >= tc) cur = k; });
    const ix = { future: 0, runic: 1, oldworld: 2 };
    const idx = ix[OUTRO[cur][1]], prev = cur > 0 ? ix[OUTRO[cur - 1][1]] : null;
    const k = sm(Math.min(1, (t - OUTRO[cur][0]) / 0.3));
    u.plates = [{ i: idx, x: 0, y: 0.01, h: 0.6 + 0.012 * sm(seg(35.8, 41.4)), a: e * (cur === 0 ? 1 : k), glow: 0.35 + 0.3 * rip }];
    if (prev != null && k < 1) u.plates.unshift({ i: prev, x: 0, y: 0.01, h: 0.6, a: e * (1 - k), glow: 0.35 });
    u.zoom = 1 + 0.03 * sm(seg(36, 41.8));
    u.page = 1 - 0.94 * sm(seg(35.4, 36.4));   // the page fades away under the name
    u.black = sm(seg(41.0, 41.95));
  }
  return u;
}

export default {
  key: 'atom-machine',
  poster: 24.8,
  title: 'The Atom Machine — the Atomium behind the departments hums, breathes and arcs, and the camera dives into the iron crystal it is a model of',
  dur: 42,
  url: '/index.html',
  prefs: { theme: 'crystal', cursor: 'disc', font: 'future' },
  act,
  lens,
  plates: ['wordmark@future@crystal', 'wordmark@runic@crystal', 'wordmark@oldworld@crystal'],
  cues: [
    { t: 0.3, kind: 'arrive' },
    { t: 2.4, kind: 'swoop' },
    { t: 4.8, kind: 'machine', until: 35.8 },
    ...ARCS.map((t) => ({ t, kind: 'arc' })),
    { t: 14.4, kind: 'push' },
    ...STORM.map((t) => ({ t, kind: 'arc', soft: true })),
    { t: 16.2, kind: 'dive' }, { t: 16.8, kind: 'emerge' }, { t: 16.8, kind: 'tunnel' },
    ...[19.2, 21.6, 26.4, 28.8].map((t) => ({ t, kind: 'zoom' })),
    ...LAT_ARCS.map((t) => ({ t, kind: 'arc', soft: true })),
    { t: 24.0, kind: 'peak' },
    { t: 31.2, kind: 'down' }, { t: 33.2, kind: 'return' },
    { t: 34.8, kind: 'arc' },
    { t: 35.6, kind: 'calm' }, { t: 36.0, kind: 'seal' },
    ...OUTRO.map(([t, font]) => ({ t, kind: 'font', font })),
  ],
};
