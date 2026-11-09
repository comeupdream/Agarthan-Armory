/*
 * REALM SHIFT — the home page, its display settings, and then the fleet.
 *
 * The pointer flies to the Realm button and clicks through every realm, script and
 * cursor the site ships (the real buttons, so the page repaints itself), closes the
 * panel, and the trip begins: the craft the cursor settings are drawn from arrive at
 * full size and beam the hero up piece by piece, until the saucer pointer grows into
 * the mothership and takes the name, letter by letter. The trip peaks with the name's
 * echoes mirrored round the empty hero, comes down, and the mothership gives the
 * letters back; in the calm the name changes script — Runic, a flash of Old World,
 * Future, Runic — and the page drifts back out into space. No Ancient Tech anywhere.
 */

// the clicks, in film seconds: [t, selector or point]
// the scripts the calm walks through once the name is back: [t, font]
export const OUTRO_FONTS = [[37.4, 'runic'], [38.7, 'oldworld'], [39.3, 'future'], [40.4, 'runic']];

export const CLICKS = [
  [3.0, '.prefs-btn'],
  [3.9, 'theme:inner-earth'], [5.1, 'theme:mono'], [6.3, 'theme:crystal'], [7.5, 'theme:vril'], [8.7, 'theme:polar'],
  [9.9, 'font:future'], [11.1, 'font:oldworld'], [11.75, 'font:runic'], [12.9, 'font:future'],
  [14.3, 'cursor:reticle'], [14.95, 'cursor:disc'], [15.6, 'cursor:tictac'], [16.25, 'cursor:triangle'], [16.9, 'cursor:orb'], [17.55, 'cursor:disc'],
  [18.5, 'sky'],
];

function act(t, S) {
  const { seg, keys, ease, mid, at, click, craft, abduct, letters } = S;
  const W = innerWidth, H = innerHeight;
  at('setup', 0, () => { scrollTo(0, 0); letters('.hero h1'); });

  /* ---------- the pointer and its clicks ---------- */
  const CL = [
    [3.0, '.prefs-btn'],
    [3.9, 'theme:inner-earth'], [5.1, 'theme:mono'], [6.3, 'theme:crystal'], [7.5, 'theme:vril'], [8.7, 'theme:polar'],
    [9.9, 'font:future'], [11.1, 'font:oldworld'], [11.75, 'font:runic'], [12.9, 'font:future'],
    [14.3, 'cursor:reticle'], [14.95, 'cursor:disc'], [15.6, 'cursor:tictac'], [16.25, 'cursor:triangle'], [16.9, 'cursor:orb'], [17.55, 'cursor:disc'],
    [18.5, 'sky'],
  ];
  const sel = (s) => (s.includes(':') ? `.prefs-opt[data-k="${s.split(':')[0]}"][data-v="${s.split(':')[1]}"]` : s);
  const where = (s) => (s === 'sky' ? [W * 0.42, H * 0.3] : mid(sel(s)));
  // waypoints: start off the right edge, then each target just before its click
  const pts = [[0, [W + 60, H * 0.82]], [1.2, [W + 60, H * 0.82]]];
  let prev = 1.2;
  for (const [tc, s] of CL) {
    const p = where(s);
    pts.push([Math.max(prev + 0.1, tc - 0.5), pts[pts.length - 1][1]]);
    pts.push([tc - 0.06, p]);
    prev = tc + 0.12;
  }
  let [cx, cy] = S.keys(t, pts, ease.inOut);
  // after the panel closes the pointer drifts up over the title, then becomes the mothership
  if (t > 18.6) {
    const p0 = [W * 0.42, H * 0.3];
    [cx, cy] = keys(t, [[18.6, p0], [20.4, [W * 0.56, H * 0.16]], [22.4, [W * 0.44, H * 0.13]], [24.0, [W * 0.5, H * 0.14]]], ease.sine);
  }
  const press = CL.reduce((m, [tc]) => Math.max(m, 1 - Math.abs(t - tc) / 0.12), 0);
  const grow = seg(t, 23.6, 24.6);
  S.cursor(cx, cy, { scale: 1.6 * (1 - 0.18 * Math.max(0, press)) * (1 + 7 * ease.in(grow)), show: grow < 1 });
  CL.forEach(([tc, s], i) => at('c' + i, tc, () => { const [x, y] = where(s); click(s === 'sky' ? null : sel(s), x, y); }));

  /* ---------- the fleet ---------- */
  const T = (s) => S.memo('home:' + s, () => mid(s));
  const JOBS = {
    tt: { type: 'tictac', size: 230, enter: [19.4, [-260, H * 0.25]], exit: [26.4, [-300, H * 0.05]],
      jobs: [['.hud-corner.tl', 20.6, 22.0], ['.hero-tag', 22.2, 23.8], ['.hero-runes', 24.0, 25.4]] },
    tri: { type: 'triangle', size: 250, enter: [19.7, [W + 280, H * 0.2]], exit: [26.6, [W + 320, H * 0.04]],
      jobs: [['.hud-corner.tr', 20.9, 22.3], ['.hero-cta .btn-ghost', 22.6, 24.1], ['.hud-corner.br', 24.3, 25.6]] },
    orb: { type: 'orb', size: 190, enter: [20.0, [W * 0.3, -200]], exit: [26.8, [W * 0.2, -260]],
      jobs: [['.hero-content .eyebrow', 21.2, 22.6], ['.hero-cta .btn-ice', 22.9, 24.4], ['.hud-corner.bl', 24.6, 25.9]] },
  };
  const sparks = [];
  for (const [id, c] of Object.entries(JOBS)) {
    if (t < c.enter[0] - 0.01) continue;
    const ks = [[c.enter[0], c.enter[1]]];
    for (const [s, a, b] of c.jobs) {
      const [x, y] = T(s);
      const hover = [x, Math.max(70, y - 190)];
      ks.push([a - 0.15, hover], [b, hover]);
    }
    ks.push([c.exit[0], c.exit[1]]);
    let [x, y] = keys(t, ks, ease.inOut);
    y += Math.sin(t * 2.3 + id.length) * 7;
    let beam = 0;
    for (const [s, a, b] of c.jobs) {
      beam = Math.max(beam, seg(t, a - 0.25, a) * (1 - seg(t, b - 0.15, b + 0.2)));
      abduct(s, seg(t, a, b), id, { spin: id === 'tri' ? -1 : 1 });
      const [tx, ty] = T(s);
      if (t > a - 0.2 && t < b + 0.2) sparks.push({ x, y: y + 30, w: c.size * 0.9, h: Math.max(80, ty - y), n: 34, k: beam, seed: id.length + a });
    }
    craft(id, { type: c.type, x, y, size: c.size, rot: Math.sin(t * 1.7 + id.length) * 4, beam, beamLen: 260 });
  }

  /* ---------- the mothership takes the name, holds it through the peak, gives it back ---------- */
  if (t > 23.6) {
    const L = letters('.hero h1');
    const appear = ease.out(seg(t, 23.9, 24.9));
    const rise = ease.in(seg(t, 36.4, 38.8));
    const mx = W * 0.5, my = H * 0.14 - rise * 560 + Math.sin(t * 1.6) * 8;
    const size = 70 + 520 * appear - 300 * rise;
    // the beam stays lit through the peak (the letters are inside), and through the return
    const beamM = seg(t, 25.0, 25.5) * (1 - seg(t, 36.6, 37.3));
    craft('mom', { type: 'mother', x: mx, y: my, size, beam: beamM, beamLen: 520, beamW: 1.5 + 0.3 * Math.sin(t * 3) * seg(t, 29.6, 30.4) * (1 - seg(t, 32.4, 33)), opacity: Math.min(1, appear * 1.4) * (1 - seg(t, 38.2, 38.9)) });
    L.forEach((el, i) => {
      // outside in on the way up; middle first on the way down
      const order = [0, 13, 7, 1, 12, 8, 2, 11, 9, 3, 10, 4, 6, 5][i] ?? i;
      const a = 25.5 + order * 0.2;
      const r = 33.0 + (13 - order) * 0.13;
      abduct(el, seg(t, a, a + 1.5) * (1 - seg(t, r, r + 1.4)), 'mom', { spin: i % 2 ? -1 : 1, wobble: 1.6 });
    });
    if (beamM > 0) sparks.push({ x: mx, y: my + 40, w: 700, h: 420, n: 70 + 40 * seg(t, 29.6, 31), k: beamM, seed: 7 });
  }

  /* ---------- the calm: the name changes script, and its frame comes back ---------- */
  const FONTS = [[37.4, 'runic'], [38.7, 'oldworld'], [39.3, 'future'], [40.4, 'runic']];
  FONTS.forEach(([tc, f]) => at('font-' + tc, tc, () => { const b = document.querySelector(`.prefs-opt[data-k="font"][data-v="${f}"]`); if (b) b.click(); }));
  if (t > 36.6) {
    // the rune line fades back in under the name
    const el = document.querySelector('.hero-runes');
    if (el) { el.style.transform = ''; el.style.filter = ''; el.style.visibility = ''; el.style.opacity = String(seg(t, 36.8, 38.0)); }
  }
  // the brand's seal: let down out of the mothership's belly as it lifts away, and left above the name
  if (t > 35.4) {
    let s = document.getElementById('__seal');
    if (!s) {
      s = document.createElement('span'); s.id = '__seal'; s.className = 'seal';
      s.innerHTML = '<img src="assets/img/brand/seal-600.png" alt="">';
      s.style.cssText = 'position:fixed;left:0;top:0;width:118px;height:118px;z-index:2147482500;pointer-events:none;transform-origin:50% 50%';
      document.body.appendChild(s);
    }
    const out = ease.out(seg(t, 35.6, 37.2));
    const y = H * 0.14 + 40 * (1 - out) + (H * 0.152 - H * 0.14) * out;
    const k = 0.22 + 0.78 * out;
    s.style.transform = `translate(${W / 2 - 59}px, ${y - 59}px) scale(${k}) rotate(${(1 - out) * -200}deg)`;
    s.style.opacity = String(Math.min(1, seg(t, 35.6, 36.1) * 1.2));
    s.style.filter = `drop-shadow(0 0 ${14 + 30 * (1 - out) + 6 * Math.sin(t * 2.2)}px rgba(var(--accent-rgb), .8))`;
  }
  S.sparks(sparks);
}

/* ---------- Stage B: the trip ---------- */
function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  // the realm and script switches wipe from the frame before the click
  const realm = [3.9, 5.1, 6.3, 7.5, 8.7];
  const script = [9.9, 11.1, 11.75, 12.9];
  let wipe = -1, held = -1, wipeKind = 0;
  for (const tc of realm) if (t >= tc && t < tc + 0.5) { wipe = sm(seg(tc, tc + 0.5)); held = Math.round(tc * 30) - 1; wipeKind = 1; }
  for (const tc of script) if (t >= tc && t < tc + 0.4) { wipe = sm(seg(tc, tc + 0.4)); held = Math.round(tc * 30) - 1; wipeKind = 2; }
  const trip = sm(seg(18.8, 21.5));
  // PEAK 29.6-32.6: the name is inside the mothership and its echoes are everywhere
  const lift = sm(seg(29.6, 31.2));
  // COME DOWN 32.6-35.6: everything unwinds to the plain page
  const down = sm(seg(32.6, 35.6));
  const peak = sm(seg(25.5, 28)) * (1 - down);
  // the hue walks a whole turn by the peak's end (26 deg/s over 13.8 s) and settles on it
  const spin = trip * (Math.min(t, 32.6) - 18.8) * 26;
  const hue = t < 32.6 ? spin + peak * 40 + lift * 25 * Math.sin(t * 1.3) : spin + (360 - spin) * down + peak * 40;
  // CALM: each change of script leaves an echo of the last one (the trip's duplicated words, tamed)
  let echo = 0;
  for (const [tc] of OUTRO_FONTS) if (t >= tc) echo = Math.max(echo, 0.6 * Math.exp(-(t - tc) * 2.6));
  const drift = sm(seg(38.0, 42.0));
  return {
    // the page arrives out of space, tilted, settles flat, and at the end drifts back out
    cam: [sm(seg(0, 2.4)) - 0.16 * drift,
      -14 * (1 - sm(seg(0, 2.4))) + 3 * trip * (1 - down) * Math.sin(t * 0.7) + 7 * drift,
      10 * (1 - sm(seg(0, 2.4))) + 2.5 * trip * (1 - down) * Math.sin(t * 0.53) - 5 * drift],
    zoom: 1 + (0.035 * trip + 0.02 * Math.sin(t * 0.4)) * (1 - down) + 0.05 * lift * (1 - down) * Math.sin(t * 2.1),
    wipe, held, wipeKind,
    hue,
    warp: (0.0025 * trip + 0.006 * peak + 0.008 * lift) * (1 - down),
    chroma: 0.0012 + (0.004 * trip + 0.005 * peak + 0.003 * lift) * (1 - down) + 0.004 * echo,
    trails: (0.55 * trip + 0.25 * peak + 0.12 * lift) * (1 - down) + 0.15 * down + echo,
    kaleido: (0.55 * peak + 0.4 * lift) * (1 - down),
    kalN: 6,
    bloom: 0.35 + 0.35 * trip * (1 - down) + 0.1 * down,
    sky: [0.6, 1, 1],
    black: sm(seg(41.2, 42.0)),
    grain: 0.018,
  };
}

export default {
  key: 'realm-shift',
  poster: 26.9,
  title: 'Realm Shift — every realm, script and cursor, then the fleet takes the page',
  dur: 42,
  url: '/index.html',
  prefs: { font: 'runic' },
  act,
  lens,
  cues: [
    ...CLICKS.map(([t, s]) => ({ t, kind: s.startsWith('theme') ? 'realm' : s.startsWith('font') ? 'script' : s.startsWith('cursor') ? 'cursor' : 'click' })),
    { t: 18.8, kind: 'trip' }, { t: 19.4, kind: 'arrive' }, { t: 23.9, kind: 'mother' }, { t: 25.5, kind: 'beam' },
    { t: 29.6, kind: 'peak' }, { t: 32.6, kind: 'down' }, { t: 33.0, kind: 'return' }, { t: 35.6, kind: 'seal' }, { t: 36.4, kind: 'leave' }, { t: 36.8, kind: 'calm' },
    ...OUTRO_FONTS.map(([t, font]) => ({ t, kind: 'font', font })),
  ],
};
