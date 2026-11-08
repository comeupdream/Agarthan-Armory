/*
 * REALM SHIFT — the home page, its display settings, and then the fleet.
 *
 * The pointer flies to the Realm button and clicks through every realm, script and
 * cursor the site ships (the real buttons, so the page repaints itself), closes the
 * panel, and the trip begins: the craft the cursor settings are drawn from arrive at
 * full size and beam the hero up piece by piece, until the saucer pointer grows into
 * the mothership and takes the name, letter by letter. The empty hero is left to the
 * aurora and the wall, and the light comes up white.
 */

// the clicks, in film seconds: [t, selector or point]
export const CLICKS = [
  [3.0, '.prefs-btn'],
  [3.9, 'theme:inner-earth'], [5.1, 'theme:mono'], [6.3, 'theme:crystal'], [7.5, 'theme:vril'], [8.7, 'theme:polar'],
  [9.9, 'font:future'], [11.0, 'font:oldworld'], [12.1, 'font:runic'], [13.2, 'font:ancient'],
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
    [9.9, 'font:future'], [11.0, 'font:oldworld'], [12.1, 'font:runic'], [13.2, 'font:ancient'],
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

  /* ---------- the mothership takes the name ---------- */
  if (t > 23.6) {
    const L = letters('.hero h1');
    const appear = ease.out(seg(t, 23.9, 24.9));
    const rise = ease.in(seg(t, 30.0, 31.6));
    const mx = W * 0.5, my = H * 0.14 - rise * 520 + Math.sin(t * 1.6) * 8;
    const size = 70 + 520 * appear - 260 * rise;
    const beamM = seg(t, 25.0, 25.5) * (1 - seg(t, 29.6, 30.2));
    craft('mom', { type: 'mother', x: mx, y: my, size, beam: beamM, beamLen: 520, beamW: 1.5, opacity: Math.min(1, appear * 1.4) });
    L.forEach((el, i) => {
      // outside in: the ends of each word leave first, the middle last
      const order = [0, 13, 7, 1, 12, 8, 2, 11, 9, 3, 10, 4, 6, 5][i] ?? i;
      const a = 25.5 + order * 0.2;
      abduct(el, seg(t, a, a + 1.5), 'mom', { spin: i % 2 ? -1 : 1, wobble: 1.6 });
    });
    if (beamM > 0) sparks.push({ x: mx, y: my + 40, w: 700, h: 420, n: 70, k: beamM, seed: 7 });
  }
  S.sparks(sparks);
}

/* ---------- Stage B: the trip ---------- */
function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  // the realm and script switches wipe from the frame before the click
  const realm = [3.9, 5.1, 6.3, 7.5, 8.7];
  const script = [9.9, 11.0, 12.1, 13.2];
  let wipe = -1, held = -1, wipeKind = 0;
  for (const tc of realm) if (t >= tc && t < tc + 0.5) { wipe = sm(seg(tc, tc + 0.5)); held = Math.round(tc * 30) - 1; wipeKind = 1; }
  for (const tc of script) if (t >= tc && t < tc + 0.4) { wipe = sm(seg(tc, tc + 0.4)); held = Math.round(tc * 30) - 1; wipeKind = 2; }
  const trip = sm(seg(18.8, 21.5));
  const peak = sm(seg(25.5, 28)) * (1 - sm(seg(30.2, 31.4)));
  return {
    // the page arrives out of space, tilted, and settles flat
    cam: [sm(seg(0, 2.4)), -14 * (1 - sm(seg(0, 2.4))) + 3 * trip * Math.sin(t * 0.7), 10 * (1 - sm(seg(0, 2.4))) + 2.5 * trip * Math.sin(t * 0.53)],
    zoom: 1 + 0.035 * trip + 0.02 * Math.sin(t * 0.4),
    wipe, held, wipeKind,
    hue: trip * (t - 18.8) * 26 + peak * 40,
    warp: 0.0025 * trip + 0.006 * peak,
    chroma: 0.0012 + 0.004 * trip + 0.005 * peak,
    trails: 0.55 * trip + 0.25 * peak,
    kaleido: 0.55 * peak,
    bloom: 0.35 + 0.35 * trip,
    white: sm(seg(31.3, 32.0)),
    grain: 0.018,
  };
}

export default {
  key: 'realm-shift',
  poster: 26.9,
  title: 'Realm Shift — every realm, script and cursor, then the fleet takes the page',
  dur: 32,
  url: '/index.html',
  prefs: {},
  act,
  lens,
  cues: [
    ...CLICKS.map(([t, s]) => ({ t, kind: s.startsWith('theme') ? 'realm' : s.startsWith('font') ? 'script' : s.startsWith('cursor') ? 'cursor' : 'click' })),
    { t: 18.8, kind: 'trip' }, { t: 19.4, kind: 'arrive' }, { t: 23.9, kind: 'mother' }, { t: 25.5, kind: 'beam' }, { t: 30.0, kind: 'leave' }, { t: 31.4, kind: 'white' },
  ],
};
