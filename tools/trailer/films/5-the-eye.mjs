/*
 * THE EYE — the geode eye in the ice wall, and what it opens onto.
 *
 * The home page arrives out of space. The saucer cursor flies in and swoops round the
 * hero while the eye in the ice wall follows it (the real pointer: the site's own eye
 * reads it), circles the eye, and settles on it: the eye wakes. A click, and the
 * camera falls into its pupil, down a tunnel of light, and comes out of the watching
 * eye on the Forbidden Knowledge page. The cursor drifts down the files lifting their
 * redactions while the page goes stranger and stranger. PEAK: the saucer orbits the
 * watching eye inside a mandala. COME DOWN: it all unwinds. CALM: the brand's seal
 * rises out of the eye's pupil and settles in the giant geode, and the title changes
 * script — Runic, a flash of Old World, Future, Runic — before the dark.
 *
 * The only film that shows the eye (`showEye`): every other film hides it.
 */

// the calm's changes of script, in film seconds: [t, font]
export const OUTRO_FONTS = [[36.8, 'runic'], [38.0, 'oldworld'], [38.6, 'future'], [39.8, 'runic']];
// the redactions the cursor lifts, in film seconds (the hold on each)
export const REVEALS = [19.8, 23.8, 25.4, 27.8];

function act(t, S) {
  const { seg, keys, ease, at } = S;
  const W = innerWidth, H = innerHeight;
  const center = (sel) => { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el) return [W / 2, H / 2]; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  if (S.page() === 'index.html') {
    // (asked for before the guard: a frame lands on 15.2 exactly)
    at('go', 15.2, () => S.go('/forbidden.html'));
    if (t >= 15.2) return;
    scrollTo(0, 0);
    const E = S.memo('eye', () => center('.hero-eye'));
    /* ---------- the saucer swoops round the hero, then circles the eye ---------- */
    let p;
    if (t < 9.0) {
      p = keys(t, [[0, [-140, H * 0.42]], [2.6, [-140, H * 0.42]], [4.2, [W * 0.30, H * 0.28]], [5.6, [W * 0.68, H * 0.22]],
        [6.9, [W * 0.84, H * 0.46]], [8.0, [W * 0.24, H * 0.70]], [9.0, [E[0] - 250, E[1] - 40]]], ease.sine);
    } else if (t < 11.8) {
      const a = Math.PI + (t - 9.0) / 2.8 * Math.PI * 2.3;
      p = [E[0] + 250 * Math.cos(a), E[1] - 40 + 165 * Math.sin(a)];
    } else {
      const a = Math.PI + Math.PI * 2.3, from = [E[0] + 250 * Math.cos(a), E[1] - 40 + 165 * Math.sin(a)];
      const k = ease.inOut(seg(t, 11.8, 12.5));
      p = [S.lerp(from[0], E[0], k) + 6 * Math.sin(t * 3.1) * k, S.lerp(from[1], E[1], k) + 4 * Math.sin(t * 2.3) * k];
    }
    const press = Math.max(0, 1 - Math.abs(t - 14.0) / 0.14);
    const bob = Math.sin(t * 2.2) * 3;
    S.cursor(p[0], p[1] + bob, { scale: 2.4 * (1 - 0.2 * press), show: t > 2.5 });
    S.mouse = [p[0], p[1]];
    at('click', 14.0, () => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: p[0], clientY: p[1], pointerType: 'mouse' })));
    return;
  }

  /* ---------- Forbidden Knowledge ---------- */
  const R = S.$$('.fk-file .redact');
  const sy = keys(t, [[17.4, 0], [19.4, 900], [22.0, 900], [23.6, 1500], [25.8, 1500], [27.2, 1950], [29.2, 1950], [30.6, 0]], ease.inOut);
  scrollTo(0, t < 17.4 ? 0 : sy);
  const eyeC = center('.fk-eye');
  // a redaction can wrap onto two lines: aim at the middle of its first line, not of its box
  // (the box's middle falls between the lines, where nothing is hovered)
  const r = (i) => { const q = R[i] && R[i].getClientRects()[0]; return q ? [q.left + Math.min(q.width / 2, 120), q.top + q.height / 2] : [W / 2, H / 2]; };
  // the redactions in the order the cursor lifts them: the wall, the treaty, Highjump, the eye
  const order = [r(0), r(2), r(1), r(3)];
  const out = [W * 0.55, H * 0.35];
  let p, show = true;
  if (t < 17.4) p = keys(t, [[15.2, eyeC], [17.4, out]], ease.out);
  else if (t < 29.2) {
    const legs = [[17.4, 19.8, out, order[0]], [21.8, 23.8, order[0], order[1]], [24.6, 25.4, order[1], order[2]], [26.6, 27.8, order[2], order[3]]];
    p = order[3];
    for (let i = legs.length - 1; i >= 0; i--) {
      const [a, b, from, to] = legs[i];
      if (t >= a) { const k = ease.inOut(seg(t, a, b)); p = [S.lerp(from[0], to[0], k), S.lerp(from[1], to[1], k)]; break; }
    }
  } else if (t < 33.0) {
    // PEAK: the saucer orbits the watching eye, and the eye turns with it
    const k = ease.inOut(seg(t, 29.2, 30.6));
    const a = (t - 30.6) * 2.6;
    const orb = [eyeC[0] + 230 * Math.cos(a), eyeC[1] + 150 * Math.sin(a) + 40];
    p = [S.lerp(order[3][0], orb[0], k), S.lerp(order[3][1], orb[1], k)];
  } else {
    const a = (33.0 - 30.6) * 2.6, orb = [eyeC[0] + 230 * Math.cos(a), eyeC[1] + 150 * Math.sin(a) + 40];
    p = keys(t, [[33.0, orb], [35.6, [W + 140, H * 0.18]]], ease.in);
    show = t < 35.6;
  }
  S.cursor(p[0], p[1] + Math.sin(t * 2.2) * 3, { scale: 2.2, show });
  S.mouse = [p[0], p[1]];

  /* ---------- CALM: the seal out of the eye's pupil, into the geode; the title changes script ---------- */
  // (the act runs inside the page, so it carries its own copy of OUTRO_FONTS)
  const FONTS = [[36.8, 'runic'], [38.0, 'oldworld'], [38.6, 'future'], [39.8, 'runic']];
  for (const [tc, f] of FONTS) at('font-' + tc, tc, () => { const b = document.querySelector(`.prefs-opt[data-k="font"][data-v="${f}"]`); if (b) b.click(); });
  if (t > 35.9) {
    let el = document.getElementById('__seal');
    if (!el) {
      el = document.createElement('span'); el.id = '__seal'; el.className = 'seal';
      el.innerHTML = '<img src="assets/img/brand/seal-600.png" alt="">';
      el.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;z-index:2147482500;pointer-events:none;transform-origin:50% 50%';
      document.body.appendChild(el);
    }
    const G = S.memo('geode', () => center('.fk-geode'));
    const k = ease.inOut(seg(t, 36.2, 38.8));
    const arc = Math.sin(Math.PI * k) * -120;
    const x = S.lerp(eyeC[0], G[0], k), y = S.lerp(eyeC[1], G[1] - 30, k) + arc + Math.sin(t * 1.5) * 4 * k;
    const size = S.lerp(26, 170, ease.out(seg(t, 36.0, 38.4)));
    el.style.transform = `translate(${x - 100}px, ${y - 100}px) scale(${size / 200}) rotate(${(1 - k) * -300}deg)`;
    el.style.opacity = String(seg(t, 35.9, 36.5));
    el.style.filter = `drop-shadow(0 0 ${14 + 30 * (1 - k) + 6 * Math.sin(t * 2)}px rgba(var(--accent-rgb), .9))`;
    // the eye watches it go (the pointer only the eye hears: the real one rests on the seal)
    S.mouse = [x, y];
  }
}

/* ---------- Stage B: the trip, growing ---------- */
function lens(t) {
  const seg = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const sm = (x) => x * x * (3 - 2 * x);
  const lerp = (a, b, p) => a + (b - a) * p;
  // the hue turns faster and faster as the trip deepens, then unwinds to a whole turn
  const speed = (x) => (x < 3 ? 0 : x < 14 ? 22 * (x - 3) / 11 : x < 17.4 ? 22 + 8 * (x - 14) / 3.4 : x < 29.6 ? 30 + 40 * (x - 17.4) / 12.2 : x < 33 ? 70 + 15 * Math.sin((x - 29.6) * 1.8) : 0);
  let turned = 0;
  for (let x = 0; x < Math.min(t, 33); x += 0.01) turned += speed(x) * 0.01;
  const peakTurn = (() => { let s = 0; for (let x = 0; x < 33; x += 0.01) s += speed(x) * 0.01; return s; })();
  const down = sm(seg(33.0, 36.0));
  const hue = t < 33 ? turned : peakTurn + (Math.ceil(peakTurn / 360) * 360 - peakTurn) * down;

  const u = { sky: [0.6, 1, 1], bloom: 0.35, glow: 0.5, grain: 0.018, hue, chroma: 0.0015, trails: 0.12, cam: [1, 0, 0], zoom: 1, pan: [0, 0] };
  if (t < 15.6) {
    // the page arrives out of space; the trip creeps in while the saucer plays round the eye
    const arrive = sm(seg(0, 2.4)), T = sm(seg(3, 14));
    u.cam = [arrive, -14 * (1 - arrive) + 3 * T * Math.sin(t * 0.6), 10 * (1 - arrive) + 2 * T * Math.sin(t * 0.47)];
    u.trails = 0.12 + 0.35 * T; u.warp = 0.004 * T; u.chroma = 0.0015 + 0.004 * T; u.bloom = 0.35 + 0.2 * T;
    // the push to the eye (it sits at 78% across, 76% down: pan [-0.498, 0.261] centres it)
    const push = sm(seg(11.6, 14.0)), fall = seg(14.0, 15.4);
    const P = [-0.498, 0.261];
    u.pan = [P[0] * push, P[1] * push];
    u.zoom = 1 + 1.4 * push + 14 * fall * fall * fall;
    // the click: the eye opens, a burst of mirrors, and the camera falls into the light of its pupil
    const burst = t >= 14.0 ? Math.exp(-(t - 14.0) * 3) : 0;
    u.kaleido = 0.55 * burst; u.kalN = 8;
    const tun = sm(seg(14.5, 15.0));
    u.tunnel = [tun, (t - 14.0) * 4.5, 0.4, 0.5 + 2.6 * tun];
    u.white = 0.3 * sm(seg(14.9, 15.2)) * (1 - seg(15.2, 15.6));
    u.cam[0] = Math.max(u.cam[0], 0);
  } else if (t < 17.4) {
    // out of the watching eye on the Forbidden Knowledge page (it sits at 23% across, 26% down)
    const out = sm(seg(15.6, 17.2)), tun = 1 - sm(seg(15.6, 16.3));
    const P = [0.4797, -0.237];
    u.tunnel = [tun, (t - 14.0) * 4.5, 0.4, 3.1 * tun];
    u.zoom = 1 + 7 * (1 - out) * (1 - out);
    u.pan = [P[0] * (1 - out), P[1] * (1 - out)];
    u.trails = 0.45; u.warp = 0.006; u.chroma = 0.004; u.bloom = 0.45;
  } else if (t < 29.6) {
    // the files, going stranger: mirrors creep in, the page sways, the light pours
    const T2 = sm(seg(17.4, 29.6));
    u.cam = [1, 5 * T2 * Math.sin(t * 0.5), 3.5 * T2 * Math.sin(t * 0.37)];
    u.zoom = 1.02 + 0.05 * T2 * (0.5 + 0.5 * Math.sin(t * 0.8));
    u.trails = 0.3 + 0.42 * T2; u.warp = 0.004 + 0.012 * T2; u.chroma = 0.002 + 0.006 * T2;
    u.kaleido = 0.32 * T2 * T2; u.kalN = 6;
    u.bloom = 0.4 + 0.2 * T2; u.glow = 0.5 + 0.3 * T2;
    // each redaction lifted sends a ripple through the page
    let rip = 0;
    for (const tc of REVEALS) if (t >= tc) rip = Math.max(rip, Math.exp(-(t - tc) * 3.5));
    u.warp += 0.012 * rip; u.chroma += 0.004 * rip;
  } else {
    // PEAK 29.6-33.0: the saucer orbits the watching eye inside a mandala
    const peak = sm(seg(29.6, 30.6)) * (1 - down);
    // CALM: each change of script sends a slow liquid ripple; at the end the page sinks into the dark
    let rip = 0;
    for (const [tc] of OUTRO_FONTS) if (t >= tc) rip = Math.max(rip, Math.exp(-(t - tc) * 2.4));
    const drift = sm(seg(39.0, 42.0));
    u.kaleido = 0.32 * (1 - sm(seg(29.6, 30.4))) + 0.85 * peak;
    u.kalN = 6 + 2 * sm(seg(29.6, 30.4));
    u.trails = 0.72 * (1 - down) + 0.12 + 0.25 * rip;
    u.warp = 0.016 * (1 - down) + 0.022 * rip;
    u.chroma = 0.008 * (1 - down) + 0.0015 + 0.004 * rip;
    u.bloom = 0.4 + 0.25 * peak; u.glow = 0.5 + 0.3 * peak;
    u.zoom = 1 + 0.06 * peak * (0.5 + 0.5 * Math.sin(t * 2.2)) + 0.05 * drift;
    u.cam = [1 - 0.18 * drift, 5 * (1 - down) * Math.sin(t * 0.5) - 6 * drift, 3.5 * (1 - down) * Math.sin(t * 0.37) + 3 * drift];
    u.black = sm(seg(41.2, 42.0));
  }
  return u;
}

export default {
  key: 'the-eye',
  poster: 31.2,
  title: 'The Eye — the geode eye follows the saucer, opens, and lets you into the Forbidden Knowledge',
  dur: 42,
  url: '/index.html',
  prefs: { cursor: 'disc', font: 'future' },
  showEye: true,
  act,
  lens,
  cues: [
    { t: 2.8, kind: 'swoop' }, { t: 5.6, kind: 'swoop' }, { t: 8.0, kind: 'swoop' }, { t: 9.0, kind: 'orbit' },
    { t: 12.4, kind: 'wake' }, { t: 14.0, kind: 'open' }, { t: 14.5, kind: 'dive' }, { t: 15.6, kind: 'emerge' },
    ...REVEALS.map((t) => ({ t, kind: 'reveal' })),
    { t: 29.6, kind: 'peak' }, { t: 33.0, kind: 'down' }, { t: 36.0, kind: 'calm' }, { t: 36.2, kind: 'seal' },
    ...OUTRO_FONTS.map(([t, font]) => ({ t, kind: 'font', font })),
  ],
};
