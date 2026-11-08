/*
 * PHASE SHIFT — the ice wall, the map, and the way down to Agartha.
 *
 * The hero's wall phase-shifts through every realm, the lens dives through the gate
 * and comes out over the polar map, which zooms to the pole, and the camera falls
 * down the pole into the inner sun. Agartha is the Agarthan Crystal realm: the code
 * section, where the client's static piece plays once on its pedestal; then a last
 * shift to the gate in the wall, where the client's looping piece runs on the
 * checkpoint monitor, and the lens goes into it.
 *
 * The peak is the loop mirrored into a kaleidoscope; a tunnel of light carries the
 * camera back up out of the earth, and the come-down is the camera pulling out of the
 * eye in the ice wall, back on the home page in Polar. In the calm the seal rises out
 * of the eye's pupil, up the gate's light, and settles as the hero's star, the eye
 * watching it go; the name phase-shifts its script on glitch slices — Future, a flash
 * of Old World, Runic — and the page turns away into the dark. No Ancient Tech.
 */

// the calm's changes of script, in film seconds: [t, font]
export const OUTRO_FONTS = [[31.8, 'future'], [33.2, 'oldworld'], [33.9, 'runic']];

function act(t, S) {
  const { at } = S;
  const realm = (v) => { const b = document.querySelector(`.prefs-opt[data-k="theme"][data-v="${v}"]`); if (b) b.click(); };
  if (S.page() === 'index.html' && t >= 28.3) {
    /* ---------- the outro: back on the home page, out of the eye ---------- */
    at('home', 28.3, () => { realm('polar'); scrollTo(0, 0); });
    scrollTo(0, 0);
    // (the act runs inside the page, so it carries its own copy of OUTRO_FONTS)
    const FONTS = [[31.8, 'future'], [33.2, 'oldworld'], [33.9, 'runic']];
    for (const [tc, f] of FONTS) at('font-' + tc, tc, () => { const b = document.querySelector(`.prefs-opt[data-k="font"][data-v="${f}"]`); if (b) b.click(); });
    const W = innerWidth, H = innerHeight;
    const [ex, ey] = S.memo('eye', () => S.mid('.hero-eye'));
    // the seal comes up out of the pupil and climbs the gate's light to the hero's star
    const rise = S.ease.inOut(S.seg(t, 31.2, 34.6));
    const sx = ex, sy = S.lerp(ey, H * 0.137, rise) + Math.sin(t * 1.4) * 3 * rise;
    const size = S.lerp(30, 84, S.ease.out(S.seg(t, 31.2, 32.6)));
    if (t > 31.0) {
      let el = document.getElementById('__seal');
      if (!el) {
        el = document.createElement('span'); el.id = '__seal'; el.className = 'seal';
        el.innerHTML = '<img src="assets/img/brand/seal-600.png" alt="">';
        el.style.cssText = 'position:fixed;left:0;top:0;width:100px;height:100px;z-index:2147482500;pointer-events:none;transform-origin:50% 50%';
        document.body.appendChild(el);
      }
      el.style.transform = `translate(${sx - 50}px, ${sy - 50}px) scale(${size / 100}) rotate(${(1 - rise) * 360}deg)`;
      el.style.opacity = String(S.seg(t, 31.0, 31.6));
      el.style.filter = `drop-shadow(0 0 ${12 + 26 * (1 - rise) + 5 * Math.sin(t * 2.4)}px rgba(var(--accent-rgb), .85))`;
    }
    // the eye looks up after it, and then back out at us (a pointer only the eye hears:
    // the real mouse would light the buttons the seal climbs past)
    const look = S.seg(t, 31.0, 31.6) * (1 - S.seg(t, 35.0, 35.8));
    const py = Math.min(sy, ey - 150);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: S.lerp(W * 0.5, sx, look), clientY: S.lerp(ey - 40, py, look) }));
    S.mouse = [W - 4, 4];
    return;
  }
  if (S.page() === 'index.html') {
    // (the jump to the checkpoint is asked for before the guard: a frame lands on 21.8 exactly)
    at('go', 21.8, () => S.go('/transfers.html'));
    if (t >= 21.8) return;
    at('r1', 1.2, () => realm('crystal'));
    at('r2', 2.6, () => realm('inner-earth'));
    at('r3', 4.0, () => realm('vril'));
    at('r4', 5.4, () => realm('mono'));
    at('r5', 6.8, () => realm('polar'));
    if (t < 8.0) scrollTo(0, 0);
    at('map', 8.0, () => document.querySelector('#iceMap').scrollIntoView({ block: 'center' }));
    for (const [i, tz] of [[1, 9.4], [2, 10.8], [3, 12.2]]) at('zoom' + i, tz, () => document.getElementById('mapZoomIn').click());
    if (t >= 8.0 && t < 15.2) { const [mx, my] = S.memo('pole', () => S.mid('#iceMap')); S.mouse = [mx, my]; }
    at('agartha', 15.2, () => { realm('crystal'); document.querySelector('#code .relic').scrollIntoView({ block: 'center' }); });
    if (t >= 15.2) { S.mouse = [innerWidth - 4, innerHeight - 4]; S.video('#code video', Math.max(0, t - 16.0)); }
  } else {
    if (t < 21.9) return;
    scrollTo(0, 0);
    S.mouse = [4, innerHeight - 4];
    S.video('.feed video', t - 21.8);
    at('up', 28.3, () => S.go('/index.html'));
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
    // the client's piece is a light image: keep the glow off it so it reads
    u.bloom = 0.08; u.glow = 0.22 + 0.4 * (1 - open);
    u.accent = [0.78, 0.61, 1.0]; u.accent2 = [1.0, 0.82, 0.48];
  } else if (t < 28.8) {
    // the last shift, to the checkpoint monitor, and into the loop
    const cut = Math.round(21.8 * 30) - 1;
    if (t < 22.35) { u.wipe = sm(seg(21.8, 22.35)); u.held = cut; u.wipeKind = 2; }
    const push = sm(seg(22.6, 27.4));
    // the checkpoint monitor sits right of the heading, a little above centre
    u.pan = [-lerp(0, 0.425, push), -lerp(0, 0.106, push)];
    u.zoom = lerp(1, 3.0, push * push);
    // PEAK 26.0-28.2: the loop folds into a kaleidoscope, and the hue runs
    const peak = sm(seg(26.0, 27.4));
    u.kaleido = 0.5 * sm(seg(26.0, 27.0)) + 0.4 * peak; u.kalN = 6 + 2 * peak;
    u.trails = 0.35 + 0.3 * push + 0.2 * peak; u.warp = 0.004 + 0.006 * push + 0.01 * peak; u.chroma = 0.002 + 0.004 * push + 0.004 * peak;
    u.hue = 20 * push * Math.sin(t * 0.7) + 140 * peak * sm(seg(26.4, 28.6));
    u.bloom = 0.08 + 0.2 * peak; u.glow = 0.22 + 0.5 * sm(seg(26.0, 27.6));
    u.accent = [0.78, 0.61, 1.0]; u.accent2 = [1.0, 0.82, 0.48];
    // ASCENT 27.6-28.9: a tunnel of light carries the camera up and out (the page changes under it)
    const up = sm(seg(27.6, 28.2));
    u.tunnel = [up, (t - 27.6) * 5.0, -0.5, 0.5 + 1.8 * up];
  } else {
    // COME DOWN 28.8-31.0: the tunnel lets go and the camera pulls back out of the eye in the wall
    const out = sm(seg(28.8, 31.0));
    const tun = 1 - sm(seg(28.8, 29.6));
    u.tunnel = [tun, (t - 27.6) * 5.0 * (1 - 0.5 * out), -0.5, 2.3 * tun];
    // the eye sits at the page's centre line, 79% of the way down: pan [0, 0.294] centres it
    u.zoom = 1 + 3.2 * (1 - out) * (1 - out);
    u.pan = [0, 0.294 * (1 - out)];
    // the hue keeps turning the way it was going and comes round to where it started
    u.hue = 140 + 220 * out;
    u.kaleido = 0.5 * (1 - sm(seg(28.8, 30.2)));
    u.kalN = 8;
    u.trails = 0.55 * (1 - out) + 0.12;
    u.warp = 0.012 * (1 - out); u.chroma = 0.0015 + 0.008 * (1 - out);
    u.bloom = 0.28 + 0.2 * (1 - out); u.glow = 0.5;
    u.white = 0.25 * tun * seg(28.6, 28.9);
    // CALM: each change of script phase-shifts in on glitch slices, with a jolt of split light
    let jolt2 = 0;
    for (const [tc] of OUTRO_FONTS) {
      if (t >= tc && t < tc + 0.45) { u.wipe = sm(seg(tc, tc + 0.45)); u.held = Math.round(tc * 30) - 1; u.wipeKind = 2; }
      if (t >= tc) jolt2 = Math.max(jolt2, Math.exp(-(t - tc) * 5));
    }
    u.chroma += 0.007 * jolt2; u.warp += 0.006 * jolt2;
    // and at the end the page turns away into the dark
    const drift = sm(seg(34.4, 37.0));
    u.cam = [1 - 0.22 * drift, -9 * drift, 4 * drift];
    u.zoom *= 1 + 0.015 * (1 - Math.cos(t * 0.6)) * out;
    u.black = sm(seg(36.2, 37.0));
  }
  return u;
}

export default {
  key: 'phase-shift',
  poster: 17.6,
  title: 'Phase Shift — the ice wall through every realm, down the pole to Agartha and its transmissions',
  dur: 37,
  url: '/index.html',
  prefs: { font: 'runic' },
  act,
  lens,
  cues: [
    { t: 1.2, kind: 'shift' }, { t: 2.6, kind: 'shift' }, { t: 4.0, kind: 'shift' }, { t: 5.4, kind: 'shift' }, { t: 6.8, kind: 'shift' },
    { t: 7.4, kind: 'dive' }, { t: 8.0, kind: 'emerge' }, { t: 9.4, kind: 'zoom' }, { t: 10.8, kind: 'zoom' }, { t: 12.2, kind: 'zoom' },
    { t: 13.6, kind: 'fall' }, { t: 15.2, kind: 'sun' }, { t: 16.0, kind: 'relic' }, { t: 21.8, kind: 'shift' }, { t: 22.6, kind: 'push' },
    { t: 26.0, kind: 'peak' }, { t: 27.6, kind: 'ascend' }, { t: 28.8, kind: 'down' }, { t: 31.0, kind: 'calm' }, { t: 31.2, kind: 'seal' },
    ...OUTRO_FONTS.map(([t, font]) => ({ t, kind: 'font', font })),
  ],
};
