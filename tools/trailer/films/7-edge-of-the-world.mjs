/*
 * EDGE OF THE WORLD — the eye in the ice wall, a low flight along the wall, and down the
 * hole at the pole. Polar Night (the aurora realm) and Agarthan Crystal (the purple one) only.
 *
 * The home page in Polar Night: the saucer pointer comes to the eye in the ice wall and
 * rests its beam on it, and the eye opens wide (the site's own hover), then closes as it
 * leaves. Down to the navigation map, which grows to fill the screen; the camera spirals
 * down to the wall at the Gate, Highjump, and tips to a grazing angle: the flat world runs
 * away to the ice wall on the horizon, aurora rising beyond it. A slow flight along the
 * wall, the map's own readout ticking AT THE ICE WALL, a saucer skimming ahead, the realm
 * turning between aurora and purple. The camera rises until the whole disc spins below.
 * PEAK: the hole at the pole tears open and the continents swirl into it. The camera falls
 * through, down a tunnel of light, and comes out of the eye in the ice wall, in Crystal.
 * The saucer rests on it once more and it opens again. CALM: the name walks the scripts.
 *
 * The map is vector, so Stage A films it big (2560 wide) and drives its own viewBox: the
 * camera stays sharp however low it flies. No space: aurora only, no stars, no nebula.
 * One of the two films that show the eye (`showEye`).
 */

// the realm the world turns to along the wall: [t, realm]
export const REALMS = [[18.6, 'crystal'], [23.6, 'polar'], [27.6, 'crystal']];
// the eye opens: when the saucer's beam comes to rest on it
export const EYE = [3.6, 40.9];
export const PEAK = 32.73;   // bar 12 at 88 BPM
// the calm's changes of script: [t, font]
export const OUTRO = [[43.0, 'runic'], [44.6, 'oldworld'], [45.2, 'future'], [46.6, 'runic']];
const FPS = 30;

function act(t, S) {
  const { seg, ease, at, lerp } = S;
  const W = innerWidth, H = innerHeight;
  const sm = (x) => x * x * (3 - 2 * x);
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  const C = 500, RIM = 470, RCAM = 300, L0 = -156, SPEED = 7.2;
  // (the act runs inside the page, so it carries its own copies of the timings)
  const RL = [[18.6, 'crystal'], [23.6, 'polar'], [27.6, 'crystal']];
  const FONTS = [[43.0, 'runic'], [44.6, 'oldworld'], [45.2, 'future'], [46.6, 'runic']];
  const DIVE = 37.9;
  const root = document.documentElement;
  const stage = document.getElementById('iceMap');
  const svg = stage && stage.querySelector('svg');

  /* ---------- once: the map's layers in one group the camera can turn; the film's own styles; the scripts loaded ---------- */
  at('setup', 0, () => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = '__rot';
    while (svg.firstChild) g.appendChild(svg.firstChild);
    svg.appendChild(g);
    const st = document.createElement('style');
    st.textContent = `#iceMap.__full{position:fixed!important;z-index:2147482300;max-width:none!important;margin:0!important;aspect-ratio:auto!important;
        background:radial-gradient(ellipse 70% 60% at 50% 50%, var(--map-1) 0%, var(--void) 78%)}
      #iceMap.__full .map-zoom{display:none}
      #iceMap.__full .map-readout{left:50%!important;right:auto!important;bottom:7%!important;top:auto!important;transform:translateX(-50%) scale(2.2);transform-origin:50% 100%;white-space:nowrap}`;
    document.head.appendChild(st);
    for (const f of ['700 60px "Cinzel Decorative"', '400 60px "Uncial Antiqua"', '900 60px Orbitron']) document.fonts.load(f);
  });

  /* ---------- the realm the world turns to (a real click on the Realm setting, so the choice is saved and
     the script changes in the calm keep it) ---------- */
  const realm = (r) => { const b = document.querySelector(`.prefs-opt[data-k="theme"][data-v="${r}"]`); if (b) b.click(); };
  for (const [tc, r] of RL) at('realm-' + tc, tc, () => realm(r));

  /* ---------- the saucer pointer comes to rest on the eye in the ice wall (the site's own hover opens it wide) ---------- */
  const visit = (t0, t1, t2, t3, from, to) => {
    if (t < t0 || t > t3) return false;
    const E = S.mid('.hero-eye');
    let p;
    if (t < t1) p = mix(from, E, ease.inOut(seg(t, t0, t1)));
    else if (t < t2) p = [E[0] + 10 * Math.sin(t * 3.1), E[1] + 6 * Math.sin(t * 2.3)];
    else p = mix(E, to, ease.in(seg(t, t2, t3)));
    S.cursor(p[0], p[1] + Math.sin(t * 2.2) * 3, { scale: 3.0 });
    S.mouse = p;
    return true;
  };
  const away = [W * 0.18, H * 0.25];

  if (t < DIVE) {
    const mapY = S.memo('mapY', () => stage.getBoundingClientRect().top + scrollY - (H - stage.offsetHeight) / 2);
    if (t < 7.6) {
      scrollTo(0, lerp(0, mapY, ease.inOut(seg(t, 5.6, 7.6))));
      if (!visit(1.6, 3.6, 5.0, 5.8, [-160, H * 0.45], [W * 0.62, -160])) { S.cursor(0, 0, { show: false }); S.mouse = away; }
      return;
    }
    S.cursor(0, 0, { show: false });
    scrollTo(0, mapY);
    /* the map fills the screen */
    const r0 = S.memo('stage0', () => { const r = stage.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    stage.classList.add('__full');
    const k = ease.inOut(seg(t, 7.6, 9.6));
    stage.style.left = lerp(r0[0], 0, k) + 'px'; stage.style.top = lerp(r0[1], 0, k) + 'px';
    stage.style.width = lerp(r0[2], W, k) + 'px'; stage.style.height = lerp(r0[3], H, k) + 'px';

    /* the camera on the map: centre, view width, where the centre sits down the frame, and the turn */
    const A = H / W;
    const P = (L) => [C + RCAM * Math.sin(L * Math.PI / 180), C + RCAM * Math.cos(L * Math.PI / 180)];
    const lonAt = (tt) => {
      if (tt < 13.6) return L0;
      if (tt < 29.7) return L0 + SPEED * (tt - 13.6);
      // rising: the turn speeds up into a spin, then holds it
      const x = tt - 29.7, base = L0 + SPEED * 16.1 + SPEED * x;
      return base + (x < 3 ? 22 * x * x : 198 + 132 * (x - 3));
    };
    const FULL = 1240 / A, NEAR = 430;
    let cx, cy, w, frac, turn;
    const L = lonAt(t);
    if (t < 9.6) { cx = C; cy = C; w = FULL; frac = 0.5; turn = 0; }
    else if (t < 13.6) {
      const k2 = ease.inOut(seg(t, 9.6, 13.6)), p = P(L0);
      cx = lerp(C, p[0], k2); cy = lerp(C, p[1], k2);
      w = Math.exp(lerp(Math.log(FULL), Math.log(NEAR), k2)); frac = lerp(0.5, 0.86, k2); turn = (L0 - 180) * k2;
    } else if (t < 29.7) { const p = P(L); cx = p[0]; cy = p[1]; w = NEAR * (1 + 0.04 * Math.sin(t * 0.4)); frac = 0.86; turn = L - 180; }
    else {
      const k3 = ease.inOut(seg(t, 29.7, 32.7)), p = P(L);
      cx = lerp(p[0], C, k3); cy = lerp(p[1], C, k3);
      w = Math.exp(lerp(Math.log(NEAR), Math.log(FULL * 1.02), k3)); frac = lerp(0.86, 0.5, k3); turn = L - 180;
    }
    const h = w * A;
    svg.setAttribute('viewBox', `${(cx - w / 2).toFixed(2)} ${(cy - frac * h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    document.getElementById('__rot').setAttribute('transform', `rotate(${turn.toFixed(3)} ${cx.toFixed(2)} ${cy.toFixed(2)})`);

    // the real pointer rests on the wall just ahead, so the map's own readout reads AT THE ICE WALL
    if (t >= 13.6 && t < 29.7) {
      const q = svg.createSVGPoint(), a = (L + 3) * Math.PI / 180;
      q.x = C + (RIM - 30) * Math.sin(a); q.y = C + (RIM - 30) * Math.cos(a);
      const m = document.getElementById('__rot').getScreenCTM();
      if (m) { const s = q.matrixTransform(m); S.mouse = [s.x, s.y]; }
    } else S.mouse = [W * 0.5, H * 0.5];
    return;
  }

  /* ---------- out of the tunnel: the eye in the ice wall again, in Crystal ---------- */
  at('dive', DIVE, () => {
    stage.classList.remove('__full'); stage.style.cssText = ''; stage.style.display = 'none';
    realm('crystal');
  });
  scrollTo(0, 0);
  if (!visit(40.2, 40.9, 42.0, 42.8, [W + 160, H * 0.32], [W * 0.5, -160])) { S.cursor(0, 0, { show: false }); S.mouse = away; }

  /* ---------- CALM: the name walks the scripts (real clicks on the Script settings) ---------- */
  for (const [tc, f] of FONTS) at('font-' + tc, tc, () => { const b = document.querySelector(`.prefs-opt[data-k="font"][data-v="${f}"]`); if (b) b.click(); });
}

/* ---------- Stage B: the eye, the edge, the hole, the fall ---------- */
function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  const ACC = { polar: [[0.365, 0.894, 1], [0.365, 1, 0.694]], crystal: [[0.78, 0.61, 1], [1, 0.82, 0.48]] };
  const realm = t >= 37.9 ? 'crystal' : REALMS.filter(([tc]) => t >= tc).map(([, r]) => r).pop() || 'polar';
  // aurora only behind the page: no stars, no nebula
  const u = { sky: [0.5, 0, 0], bloom: 0.26, glow: 0.42, grain: 0.016, hue: 0, chroma: 0.0012, trails: 0.08, cam: [1, 0, 0], zoom: 1, pan: [0, 0] };
  [u.accent, u.accent2] = ACC[realm];
  const EYEP = [-0.498, 0.261];   // pan that centres the eye in the ice wall (78% across, 76% down)

  // the realm changes along the wall: each repaints from the frame before it, on a scan line
  for (const [tc] of REALMS) {
    if (t >= tc && t < tc + 0.7) { u.wipe = seg(tc, tc + 0.65); u.held = Math.round(tc * FPS) - 1; u.wipeKind = 1; }
    const kick = t >= tc ? Math.exp(-(t - tc) * 3.5) : 0;
    u.chroma += 0.004 * kick; u.warp = (u.warp || 0) + 0.003 * kick;
  }

  const TILT = 63;
  const down = sm(seg(9.6, 13.6)), up = sm(seg(29.7, 32.7));
  const tilt = TILT * down * (1 - up);
  if (t < 7.6) {
    // arrive; push in on the eye while the saucer rests on it; pull back and away down the page
    const arr = sm(seg(0, 2.4));
    const push = sm(seg(2.8, 4.2)) * (1 - sm(seg(5.0, 5.9)));
    u.cam = [arr, -10 * (1 - arr), 8 * (1 - arr)];
    u.black = 1 - sm(seg(0, 0.8));
    u.zoom = 1 + 0.75 * push; u.pan = [EYEP[0] * push, EYEP[1] * push];
    u.bloom = 0.26 + 0.1 * push; u.glow = 0.42 + 0.15 * push;
    const fly = Math.sin(Math.PI * seg(5.6, 7.6));
    u.trails = 0.08 + 0.12 * push + 0.3 * fly; u.zoom += 0.03 * fly;
  } else if (t < 36.7) {
    const sway = sm(seg(13.6, 15.1)) * (1 - up);
    u.cam = [1, 2.4 * sway * Math.sin(t * 0.33), tilt + 1.6 * sway * Math.sin(t * 0.27)];
    // pulled down the frame as it tilts, so the wall sits a third of the way up with the aurora above it
    u.pan = [0, -0.2 * down * (1 - up)];
    u.zoom = 1 + 0.32 * down * (1 - up) + 0.06 * sm(seg(7.6, 9.6)) * (1 - down);
    u.sky = [0.5 + 0.55 * down * (1 - up), 0, 0];
    u.trails = 0.08 + 0.18 * sway; u.warp = (u.warp || 0) + 0.0025 * sway;
    u.bloom = 0.26 + 0.06 * sway;
  }

  // the saucer skims along the wall ahead of the camera, then climbs away as the camera rises
  const sau = sm(seg(14.2, 15.6)) * (1 - sm(seg(30.0, 31.8)));
  if (sau > 0.001) {
    const climb = sm(seg(29.7, 31.8));
    u.plates = [{ i: 0, x: 0.42 * Math.sin((t - 14.2) * 0.31) + 0.05 * Math.sin(t * 1.3), y: 0.17 + 0.012 * Math.sin(t * 1.9) + 0.5 * climb, h: 0.085 * (1 - 0.5 * climb), rot: 0.06 * Math.cos((t - 14.2) * 0.31), a: sau, glow: 0.55 }];
  }

  if (t >= PEAK - 0.03 && t < 38.1) {
    // PEAK: the hole at the pole tears open, the disc swirling into it; then the fall
    const open = sm(seg(PEAK, 35.0)), fall = seg(36.7, 37.9);
    u.bh = [0, 0, 0.075 * open, 0.17 * open];
    u.disk = [0.95 * open, 0.32, t * 3.2, 3.6];
    u.swirl = 2.6 * open + 6 * fall;
    u.trails = 0.3 + 0.32 * open; u.warp = 0.004 + 0.008 * open; u.chroma = 0.002 + 0.006 * open;
    u.bloom = 0.32 + 0.12 * open; u.glow = 0.45 + 0.2 * open;
    u.kaleido = 0.2 * open * (1 - fall); u.kalN = 8;
    u.zoom = 1 + 13 * fall * fall * fall;
    const tun = sm(seg(37.2, 37.8));
    u.tunnel = [tun, (t - 36.7) * 4.2, 0.45, 0.5 + 2.2 * tun];
    u.white = 0.22 * sm(seg(37.7, 37.95)) * (1 - seg(37.95, 38.1));
  } else if (t >= 38.1 && t < 42.6) {
    // out of the eye in the ice wall, then pushed in again as the saucer rests on it
    const out = sm(seg(38.1, 39.9)), tun = 1 - sm(seg(38.1, 38.8));
    const push = sm(seg(40.5, 41.4)) * (1 - sm(seg(42.0, 42.7)));
    u.tunnel = [tun, (t - 36.7) * 4.2, 0.45, 2.7 * tun];
    u.zoom = 1 + 7 * (1 - out) * (1 - out) + 0.6 * push;
    const pk = Math.max(1 - out, push);
    u.pan = [EYEP[0] * pk, EYEP[1] * pk];
    u.trails = 0.45 * (1 - out) + 0.12 + 0.1 * push; u.warp = 0.006 * (1 - out) + 0.0015; u.chroma = 0.004 * (1 - out) + 0.0015;
    u.bloom = 0.3 + 0.08 * push; u.glow = 0.45 + 0.12 * push;
  } else if (t >= 42.6) {
    // CALM: the name walks the scripts; a slow ripple at each change; the dark
    let rip = 0;
    for (const [tc] of OUTRO) if (t >= tc) rip = Math.max(rip, Math.exp(-(t - tc) * 2.6));
    const drift = sm(seg(46.0, 49.0));
    u.trails = 0.12 + 0.25 * rip; u.warp = 0.0015 + 0.02 * rip; u.chroma = 0.0015 + 0.004 * rip;
    u.bloom = 0.3; u.glow = 0.5;
    u.zoom = 1 + 0.04 * drift;
    u.cam = [1 - 0.15 * drift, -5 * drift, 3 * drift];
    u.black = sm(seg(47.8, 49.0));
  }
  return u;
}

export default {
  key: 'edge-of-the-world',
  poster: 34.4,
  title: 'Edge of the World — the eye in the ice wall, a low flight along the wall, and down the hole at the pole',
  dur: 49,
  size: [2560, 1440],
  url: '/index.html',
  prefs: { cursor: 'disc', font: 'future' },
  showEye: true,
  act,
  lens,
  plates: ['craft'],
  cues: [
    { t: 0.3, kind: 'arrive' }, { t: 1.6, kind: 'swoop' }, { t: EYE[0], kind: 'wake' }, { t: 5.6, kind: 'swoop' },
    { t: 7.6, kind: 'push' }, { t: 9.6, kind: 'swoop' }, { t: 13.2, kind: 'sun' }, { t: 14.2, kind: 'beam' },
    ...REALMS.map(([t]) => ({ t, kind: 'realm' })),
    { t: 29.7, kind: 'leave' }, { t: PEAK, kind: 'peak' }, { t: PEAK, kind: 'hole' }, { t: 36.7, kind: 'fall' },
    { t: 37.2, kind: 'tunnel' }, { t: 38.1, kind: 'emerge' }, { t: EYE[1], kind: 'wake' }, { t: 42.6, kind: 'calm' },
    ...OUTRO.map(([t, font]) => ({ t, kind: 'font', font })),
  ],
};
