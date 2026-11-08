/*
 * EVENT HORIZON — the Armory falls into a black hole and comes back out as the name.
 *
 * In the Agarthan Crystal realm the saucer pointer types a calibre into the archive's
 * search, and the vault answers with its holo schematics (no store photos, as in every
 * film). The page tips back into space as a deck, a black hole opens over it, and the
 * catalogue is lensed, wound into the accretion disk and swallowed. A beat of dark,
 * then a white hole pours out the brand's seal and name in Runic; the light peaks and
 * settles, and the name falls through a tiny hole and is born again in each script.
 */

function act(t, S) {
  const { seg, keys, ease, at } = S;
  const W = innerWidth, H = innerHeight;
  at('setup', 0, () => { scrollTo(0, 0); });
  const q = document.getElementById('q');
  const [qx, qy] = S.memo('q', () => S.mid('#q'));
  let p = keys(t, [[0, [W * 0.78, H * 1.05]], [1.0, [qx - 180, qy + 4]], [3.0, [qx - 180, qy + 4]], [3.8, [W * 0.55, H * 0.62]]], ease.inOut);
  at('focus', 1.05, () => { S.click(q, p[0], p[1]); q.focus(); });
  const word = 'tactical';
  const n = Math.min(word.length, Math.floor(seg(t, 1.35, 2.6) * word.length + 0.999));
  if (t >= 1.35 && q.value !== word.slice(0, n)) { q.value = word.slice(0, n); q.dispatchEvent(new Event('input', { bubbles: true })); }
  // down through the vault while the pointer reads card after card (real hover: lift + scan)
  const sy = keys(t, [[3.0, 0], [13.0, H * 2.4]], ease.inOut);
  scrollTo(0, sy);
  if (t > 3.8) p = [W * 0.52 + Math.sin((t - 3.8) * 0.9) * W * 0.26, H * 0.58 + Math.sin((t - 3.8) * 1.6) * H * 0.16];
  S.cursor(p[0], p[1]);
  S.mouse = p;
}

function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, p) => a + (b - a) * p;
  const deck = sm(seg(3.0, 6.5));              // the page tips back into space
  const form = sm(seg(5.0, 8.0));              // the hole opens
  const feed = sm(seg(8.0, 14.0));             // it feeds
  const fall = sm(seg(13.6, 16.2));            // and takes everything
  const dark = seg(16.2, 16.4) * (1 - seg(17.25, 17.3));
  const born = seg(17.3, 31);
  const burst = Math.max(0, 1 - (t - 17.3) / 1.1) * (t >= 17.3 ? 1 : 0);
  const rs = t < 17.3 ? lerp(0, 0.075, form) + 0.05 * feed + 0.95 * fall * fall : 0;
  const out = {
    cam: [lerp(1, 0.62, deck) - 0.06 * feed, -6 * deck * Math.sin(t * 0.25), lerp(0, 34, deck) + 6 * feed],
    pan: [0, 0.06 * deck],
    zoom: 1,
    bh: [0.0, lerp(0.02, 0.1, deck), rs, rs * lerp(1.6, 2.4, feed)],
    disk: [(lerp(0, 0.75, form) + 0.35 * feed) * (1 - fall), 0.2, t * (0.9 + 2.2 * feed), 4.6],
    swirl: lerp(0, 1.2, form) + 7 * feed + 10 * fall,
    sky: [0.5, 1.0, 1.0],
    hue: 8 * Math.sin(t * 0.3) * feed,
    chroma: 0.0015 + 0.006 * feed,
    trails: 0.25 + 0.45 * feed,
    warp: 0.006 * feed,
    bloom: 0.45,
    glow: 0.45 + 0.35 * feed,
    page: 1,
    black: dark,
    white: burst * 0.92,
    grain: 0.018,
    accent: [0.78, 0.61, 1.0], accent2: [1.0, 0.82, 0.48],
    plates: [],
  };
  if (t >= 17.3) {
    // the white hole: the name comes out of the light (Runic), the light peaks as a star-burst,
    // comes down, and in the calm the name falls through a tiny hole and is born again in
    // each script — Future, a flash of Old World, Future
    const e = sm(seg(17.3, 19.2));
    const burstK = sm(seg(17.4, 18.2)) * (1 - sm(seg(19.6, 21.6)));
    out.page = 0; out.swirl = 0; out.chroma = 0.002 + 0.003 * burstK;
    out.trails = 0.55 * (1 - seg(20, 23)) + 0.2 * burstK;
    out.kaleido = 0.6 * burstK; out.kalN = 8;
    out.sky = [0.9 * e, 1.0, 1.2]; out.glow = 0.35; out.bloom = 0.2;
    const SWAPS = [[23.6, 0, 1], [26.2, 1, 2], [27.9, 2, 1]];   // [t, from plate, to plate]
    let cur = 0, k = 1, rot = 0, hole = 0;
    for (const [tc, a, b] of SWAPS) {
      if (t >= tc + 1.1) cur = b;
      else if (t >= tc) {
        const p = (t - tc) / 1.1;
        hole = Math.sin(Math.PI * p);
        if (p < 0.5) { cur = a; const q = sm(p / 0.5); k = 1 - q; rot = q * 3.2; }
        else { cur = b; const q = sm((p - 0.5) / 0.5); k = q; rot = -(1 - q) * 3.2; }
      }
    }
    const h = lerp(0.3, 0.62, sm(seg(17.3, 21))) + 0.03 * born;
    const y = 0.04 - 0.02 * born;
    out.bh = hole > 0.001 ? [0, y, 0.024 * hole, 0.07 * hole] : [0, 0, 0, 0];
    out.disk = [0.9 * hole, 0.3, t * 4, 3.4];
    out.plates = [
      { i: cur, x: 0, y, h: h * Math.max(k, 0.001), rot, a: e * Math.min(1, 0.2 + k * 1.2), glow: 0.35 * (1 - 0.5 * born) + 0.4 * hole },
      { i: 3, x: 0, y: -0.36, h: 0.1, a: sm(seg(29.0, 30.0)), glow: 0.15 },
    ];
    out.black = sm(seg(31.2, 32));
  }
  return out;
}

export default {
  key: 'event-horizon',
  poster: 10.6,
  title: 'Event Horizon — the Armory falls into a black hole and comes back out as the name',
  dur: 32,
  url: '/armory.html',
  prefs: { theme: 'crystal', cursor: 'disc', font: 'future' },
  act,
  lens,
  plates: ['wordmark@runic@crystal', 'wordmark@future@crystal', 'wordmark@oldworld@crystal', 'url@future@crystal'],
  cues: [
    { t: 1.05, kind: 'click' }, ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ t: 1.35 + i * 0.156, kind: 'type' })),
    { t: 3.0, kind: 'deck' }, { t: 5.0, kind: 'hole' }, { t: 8.0, kind: 'feed' }, { t: 13.6, kind: 'fall' },
    { t: 16.3, kind: 'silence' }, { t: 17.3, kind: 'white' }, { t: 17.4, kind: 'peak' }, { t: 20.0, kind: 'down' }, { t: 22.6, kind: 'calm' },
    { t: 23.6, kind: 'swap', font: 'future' }, { t: 26.2, kind: 'swap', font: 'oldworld' }, { t: 27.9, kind: 'swap', font: 'future' }, { t: 29.0, kind: 'url' },
  ],
};
