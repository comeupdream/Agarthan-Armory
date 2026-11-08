/*
 * PHASE SHIFT — the ice wall, the map, and the way down to Agartha.
 *
 * The hero's wall phase-shifts through every realm, the lens dives through the gate
 * and comes out over the polar map, which zooms to the pole, and the camera falls
 * down the pole into the inner sun. Agartha is the Agarthan Crystal realm: the code
 * section, where the client's static piece plays once on its pedestal; then a last
 * shift to the gate in the wall, where the client's looping piece runs on the
 * checkpoint monitor, and the lens goes into it.
 */

function act(t, S) {
  const { at } = S;
  const realm = (v) => { const b = document.querySelector(`.prefs-opt[data-k="theme"][data-v="${v}"]`); if (b) b.click(); };
  if (S.page() === 'index.html') {
    at('r1', 1.2, () => realm('crystal'));
    at('r2', 2.6, () => realm('inner-earth'));
    at('r3', 4.0, () => realm('vril'));
    at('r4', 5.4, () => realm('mono'));
    at('r5', 6.8, () => realm('polar'));
    if (t < 8.0) scrollTo(0, 0);
    at('map', 8.0, () => document.querySelector('#iceMap').scrollIntoView({ block: 'center' }));
    for (const [i, tz] of [[1, 9.4], [2, 10.8], [3, 12.2]].map(([i, tz]) => [i, tz])) at('zoom' + i, tz, () => document.getElementById('mapZoomIn').click());
    if (t >= 8.0 && t < 15.2) { const [mx, my] = S.memo('pole', () => S.mid('#iceMap')); S.mouse = [mx, my]; }
    at('agartha', 15.2, () => { realm('crystal'); document.querySelector('#code .relic').scrollIntoView({ block: 'center' }); });
    if (t >= 15.2) { S.mouse = [innerWidth - 4, innerHeight - 4]; S.video('#code video', Math.max(0, t - 16.0)); }
    at('go', 21.8, () => S.go('/transfers.html'));
  } else {
    if (t < 21.9) return;
    scrollTo(0, 0);
    S.mouse = [4, innerHeight - 4];
    S.video('.feed video', t - 21.8);
  }
}

function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, p) => a + (b - a) * p;
  const shifts = [1.2, 2.6, 4.0, 5.4, 6.8];
  const u = { sky: [0.5, 1, 1], bloom: 0.45, glow: 0.6, grain: 0.018, cam: [1, 0, 0], zoom: 1, pan: [0, 0], trails: 0.2, chroma: 0.0015 };
  // the wall phase-shifts: each realm comes in on glitch slices, with a jolt of split light
  let jolt = 0;
  for (const tc of shifts) {
    if (t >= tc && t < tc + 0.55) { u.wipe = sm(seg(tc, tc + 0.55)); u.held = Math.round(tc * 30) - 1; u.wipeKind = 2; }
    jolt = Math.max(jolt, Math.exp(-Math.max(0, t - tc) * 4) * (t >= tc ? 1 : 0));
  }
  if (t < 8.0) {
    const push = sm(seg(0, 7.4)), dive = sm(seg(7.2, 8.0));
    u.zoom = lerp(1, 1.22, push) + 2.2 * dive * dive;
    u.pan = [0, lerp(0, 0.26, push) + 0.06 * dive];
    u.chroma = 0.0015 + 0.008 * jolt; u.warp = 0.012 * jolt;
    u.tunnel = [0.85 * sm(seg(7.5, 8.0)), t * 2.2, 0.15, 0.5];
    u.hue = 0;
    u.trails = 0.25 + 0.3 * jolt;
  } else if (t < 15.2) {
    // out of the gate over the map; the globe turns under a slow kaleidoscope, then the fall
    const out = 1 - sm(seg(8.0, 8.8)), fall = sm(seg(13.6, 15.0));
    u.tunnel = [Math.max(0.85 * out, fall), (t - 8) * 1.6 + fall * fall * 6, 0.2 + 0.4 * fall, 0.5 + 1.6 * fall];
    u.cam = [1, 6 * Math.sin(t * 0.4), 8 * Math.sin(t * 0.33)];
    u.zoom = 1.04 + 0.1 * sm(seg(9, 14));
    u.kaleido = 0.22 * sm(seg(10, 12)) * (1 - fall);
    u.kalN = 8;
    u.hue = 12 * Math.sin(t * 0.5);
    u.trails = 0.35;
    u.chroma = 0.002 + 0.004 * fall;
  } else if (t < 21.8) {
    // Agartha: the tunnel opens on the inner realm and the pedestal
    const open = sm(seg(15.2, 16.6));
    u.tunnel = [1 - open, 12 + (t - 15.2) * 2.5, 0.6, 2.1 * (1 - open)];
    u.white = 0.35 * (1 - open) * seg(15.0, 15.4);
    u.cam = [1, -4 * Math.sin(t * 0.3), 3 * Math.sin(t * 0.25)];
    u.zoom = lerp(1.0, 1.1, sm(seg(16, 21.5)));
    u.warp = 0.004; u.trails = 0.3; u.hue = 0;
    u.accent = [0.78, 0.61, 1.0]; u.accent2 = [1.0, 0.82, 0.48];
  } else {
    // the last shift, to the checkpoint monitor, and into the loop
    const cut = Math.round(21.8 * 30) - 1;
    if (t < 22.35) { u.wipe = sm(seg(21.8, 22.35)); u.held = cut; u.wipeKind = 2; }
    const push = sm(seg(22.6, 27.4));
    // the checkpoint monitor sits right of the heading, a little above centre
    u.pan = [-lerp(0, 0.425, push), -lerp(0, 0.106, push)];
    u.zoom = lerp(1, 3.0, push * push);
    u.kaleido = 0.5 * sm(seg(26.0, 27.6)); u.kalN = 6;
    u.trails = 0.35 + 0.3 * push; u.warp = 0.004 + 0.006 * push; u.chroma = 0.002 + 0.004 * push;
    u.hue = 20 * push * Math.sin(t * 0.7);
    u.white = sm(seg(27.3, 28.0));
    u.accent = [0.78, 0.61, 1.0]; u.accent2 = [1.0, 0.82, 0.48];
  }
  return u;
}

export default {
  key: 'phase-shift',
  poster: 17.6,
  title: 'Phase Shift — the ice wall through every realm, down the pole to Agartha and its transmissions',
  dur: 28,
  url: '/index.html',
  prefs: {},
  act,
  lens,
  cues: [
    { t: 1.2, kind: 'shift' }, { t: 2.6, kind: 'shift' }, { t: 4.0, kind: 'shift' }, { t: 5.4, kind: 'shift' }, { t: 6.8, kind: 'shift' },
    { t: 7.4, kind: 'dive' }, { t: 8.0, kind: 'emerge' }, { t: 9.4, kind: 'zoom' }, { t: 10.8, kind: 'zoom' }, { t: 12.2, kind: 'zoom' },
    { t: 13.6, kind: 'fall' }, { t: 15.2, kind: 'sun' }, { t: 16.0, kind: 'relic' }, { t: 21.8, kind: 'shift' }, { t: 22.6, kind: 'push' }, { t: 27.3, kind: 'white' },
  ],
};
