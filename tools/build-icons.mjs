// build-icons.mjs — generates assets/js/icons.js (the hologram product schematics).
// Run: node tools/build-icons.mjs [out-path]
// Each icon is authored in its own natural units (inches for firearms,
// design px for accessories), absolute SVG commands only. The generator
// fits each drawing into its box, centered in the 240x120 viewBox, and
// bakes the transform into the coordinates.
import fs from 'node:fs';

const OUT = process.argv[2] || new URL('../assets/js/icons.js', import.meta.url).pathname;
const r = (v) => {
  const n = Math.round(v * 10) / 10;
  return Object.is(n, -0) ? '0' : String(n);
};

// ---------- path transform ----------
function tokenize(d) {
  const re = /([MLHVQCSTAZ])|(-?\d*\.?\d+(?:e-?\d+)?)/gi;
  const out = [];
  let m;
  while ((m = re.exec(d))) out.push(m[1] ? { c: m[1] } : { n: parseFloat(m[2]) });
  return out;
}
function xformPath(d, T) {
  const t = tokenize(d);
  let i = 0, out = [], cmd = null;
  const num = () => { const v = t[i++]; if (!v || v.n === undefined) throw new Error('bad path near ' + i + ' in ' + d); return v.n; };
  while (i < t.length) {
    if (t[i].c) {
      cmd = t[i++].c;
      if (cmd !== cmd.toUpperCase()) throw new Error('relative cmd in ' + d);
      out.push(cmd);
      if (cmd === 'Z') continue;
    }
    switch (cmd) {
      case 'M': case 'L': case 'T': { const x = num(), y = num(); out.push(T.p(x, y)); break; }
      case 'H': out.push(T.X(num())); break;
      case 'V': out.push(T.Y(num())); break;
      case 'Q': case 'S': { const a = T.p(num(), num()); const b = T.p(num(), num()); out.push(a, b); break; }
      case 'C': { const a = T.p(num(), num()); const b = T.p(num(), num()); const c = T.p(num(), num()); out.push(a, b, c); break; }
      case 'A': { const rx = num(), ry = num(), rot = num(), la = num(), sw = num(); const p = T.p(num(), num()); out.push(T.d(rx), T.d(ry), r(rot), la, sw, p); break; }
      default: throw new Error('unexpected ' + cmd);
    }
  }
  return out.join(' ').replace(/ ([MLHVQCSTAZ]) /g, '$1').replace(/^M /, 'M').replace(/ Z/g, 'Z');
}
function makeT(s, tx, ty, bb) {
  const track = (x, y) => {
    if (!bb) return;
    if (x !== null) { bb.x0 = Math.min(bb.x0, x); bb.x1 = Math.max(bb.x1, x); }
    if (y !== null) { bb.y0 = Math.min(bb.y0, y); bb.y1 = Math.max(bb.y1, y); }
  };
  const T = {
    p: (x, y) => { track(x, y); return r(tx + s * x) + ' ' + r(ty + s * y); },
    X: (x) => { track(x, null); return r(tx + s * x); },
    Y: (y) => { track(null, y); return r(ty + s * y); },
    d: (v) => r(s * v),
  };
  // element builders
  T.path = (d, extra = '') => `<path d="${xformPath(d, T)}"${extra}/>`;
  T.rect = (x, y, w, h, rx = 0) => {
    track(x, y); track(x + w, y + h);
    return `<rect x="${r(tx + s * x)}" y="${r(ty + s * y)}" width="${r(s * w)}" height="${r(s * h)}"${rx ? ` rx="${r(s * rx)}"` : ''}/>`;
  };
  T.circle = (cx, cy, rad) => { track(cx - rad, cy - rad); track(cx + rad, cy + rad); return `<circle cx="${r(tx + s * cx)}" cy="${r(ty + s * cy)}" r="${r(s * rad)}"/>`; };
  T.ellipse = (cx, cy, rx, ry) => { track(cx - rx, cy - ry); track(cx + rx, cy + ry); return `<ellipse cx="${r(tx + s * cx)}" cy="${r(ty + s * cy)}" rx="${r(s * rx)}" ry="${r(s * ry)}"/>`; };
  T.line = (x1, y1, x2, y2) => T.path(`M${x1} ${y1} L${x2} ${y2}`);
  return T;
}
function icon(draw, boxW, boxH, cx = 120, cy = 60) {
  const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  draw(makeT(1, 0, 0, bb));
  const w = bb.x1 - bb.x0, h = bb.y1 - bb.y0;
  const s = Math.min(boxW / w, boxH / h);
  const tx = cx - s * (bb.x0 + bb.x1) / 2, ty = cy - s * (bb.y0 + bb.y1) / 2;
  const { hf, hl } = draw(makeT(s, tx, ty, null));
  return `<svg viewBox="0 0 240 120" class="holo" aria-hidden="true" focusable="false"><g class="hf">${hf.join('')}</g><g class="hl">${hl.join('')}</g></svg>`;
}

// ---------- geometry helpers (local units) ----------
const qpt = (p0, c, p2, t) => [
  (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p2[0],
  (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p2[1],
];
// t on a quadratic where y == target (monotonic in y assumed)
function qAtY(p0, c, p2, y) {
  let lo = 0, hi = 1;
  const inc = p2[1] > p0[1];
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    const yy = qpt(p0, c, p2, mid)[1];
    if ((yy < y) === inc) lo = mid; else hi = mid;
  }
  return qpt(p0, c, p2, (lo + hi) / 2);
}
const range = (a, b, step) => { const o = []; for (let v = a; v <= b + 1e-9; v += step) o.push(+v.toFixed(4)); return o; };
const f = (v) => +v.toFixed(3);

const ICONS = {};

// =====================================================================
// PISTOL — striker-fired compact (Glock 19 proportions, inches)
// origin: slide rear top. 7.28" x 5.04"
// =====================================================================
ICONS.pistol = icon((T) => {
  const hf = [
    // frame: dust cover, squared trigger guard, undercut, grip, tang
    T.path('M0.12 1.08 H6.35 V1.62 H4.62 Q4.5 1.62 4.5 1.75 L4.47 2.5 Q4.45 2.68 4.25 2.68 L3.2 2.66 Q2.85 2.62 2.68 2.3 L1.68 4.75 Q1.62 4.86 1.48 4.86 H-0.14 Q-0.33 4.86 -0.3 4.7 L0.6 1.6 Q0.45 1.3 0.0 1.22 Z'),
    // slide
    T.path('M0.05 0 H6.95 Q7.15 0 7.15 0.2 V0.86 Q7.15 1.08 6.92 1.08 H0.05 Z'),
    // sights
    T.path('M0.25 0 V-0.22 H0.45 V-0.12 H0.58 V-0.22 H0.78 V0 Z'),
    T.path('M6.55 0 V-0.2 H6.78 V0 Z'),
  ];
  const hl = [
    // trigger guard opening
    T.path('M4.3 1.62 L4.28 2.36 Q4.26 2.5 4.1 2.5 L3.22 2.48 Q2.96 2.45 2.86 2.2 V1.62'),
    // trigger
    T.path('M3.5 1.63 Q3.3 1.96 3.52 2.3'),
    // rear slide serrations
    ...range(0.32, 1.1, 0.13).map((x) => T.line(x, 0.2, x, 0.9)),
    // slide top bevel
    T.line(1.3, 0.18, 6.9, 0.18),
    // slide stop + takedown lever
    T.path('M2.3 1.16 H3.35 Q3.42 1.2 3.35 1.26 H2.3'),
    T.line(3.62, 1.22, 3.98, 1.22),
    // accessory rail slot
    T.line(4.8, 1.42, 6.2, 1.42),
    // grip texture panel
    T.path('M2.33 2.78 L1.66 4.45 H-0.06 L0.42 2.78 Z'),
    // magazine floorplate seam
    T.line(-0.27, 4.62, 1.73, 4.62),
  ];
  return { hf, hl };
}, 150, 86);

// =====================================================================
// REVOLVER — double-action, full-underlug 4.2" barrel (GP100 proportions)
// origin: top strap top at frame rear
// =====================================================================
ICONS.revolver = icon((T) => {
  const hf = [
    // frame + grip silhouette
    T.path('M0.55 0.35 Q0.6 0 0.95 0 H3.75 V2.4 Q3.75 2.55 3.6 2.55 H2.45 Q2.5 3.38 1.85 3.38 Q1.35 3.38 1.2 2.85 Q1.12 3.3 0.95 3.55 Q1.05 3.85 0.88 4.25 Q0.98 4.55 0.82 4.9 Q0.72 5.2 0.6 5.45 H-0.95 Q-1.15 5.45 -1.12 5.2 C-0.95 4.0 -0.35 2.2 0.15 1.05 Q0.4 0.6 0.55 0.35 Z'),
    // barrel with full underlug
    T.path('M3.75 0.1 H7.8 Q7.88 0.1 7.88 0.18 V1.5 Q7.88 1.58 7.8 1.58 H4.0 Q3.75 1.58 3.75 1.36 Z'),
    // cylinder
    T.rect(1.55, 0.52, 1.85, 1.55, 0.14),
    // hammer
    T.path('M0.62 0.38 L0.5 -0.08 Q0.45 -0.24 0.28 -0.25 L-0.24 -0.2 Q-0.36 -0.17 -0.3 -0.06 L-0.16 0.03 Q0.08 0.06 0.22 0.45 Z'),
    // front sight ramp
    T.path('M7.2 0.1 L7.36 -0.2 H7.72 V0.1 Z'),
  ];
  const hl = [
    // cylinder flutes
    T.rect(1.85, 0.72, 1.25, 0.25, 0.12),
    T.rect(1.85, 1.17, 1.25, 0.25, 0.12),
    T.rect(1.85, 1.62, 1.25, 0.25, 0.12),
    // cylinder face / forcing cone gap
    T.line(3.55, 0.25, 3.55, 2.4),
    // barrel / underlug seam + ejector rod
    T.line(3.85, 1.02, 7.88, 1.02),
    T.line(3.6, 1.32, 4.3, 1.32),
    // top rib
    T.line(3.85, 0.32, 7.0, 0.32),
    // rear sight
    T.path('M0.95 0 V-0.18 H1.12 V-0.08 H1.28 V-0.18 H1.45 V0'),
    // trigger + guard opening
    T.path('M2.25 2.55 Q2.28 3.18 1.85 3.2 Q1.52 3.2 1.4 2.85'),
    T.path('M2.02 2.55 Q1.82 2.85 1.98 3.12'),
    // cylinder latch
    T.rect(1.02, 1.5, 0.34, 0.32, 0.05),
    // grip insert + screw
    T.path('M0.25 2.6 C-0.2 3.5 -0.55 4.4 -0.62 5.18 H0.32 C0.45 4.4 0.72 3.55 0.95 3.0 Q0.65 2.5 0.25 2.6 Z'),
    T.circle(0.08, 3.95, 0.07),
  ];
  return { hf, hl };
}, 150, 86);

// =====================================================================
// AR — AR-15 carbine, 16" barrel, free-float M-LOK handguard (inches)
// origin: stock rear, y=0 top of rail
// =====================================================================
ICONS.ar = icon((T) => {
  const magP0 = [12.95, 4.05], magC = [13.25, 6.6], magP2 = [14.2, 8.75];
  const magF0 = [15.25, 4.05], magFC = [15.6, 5.9], magF2 = [16.6, 8.15];
  const ribs = [6.9, 7.3, 7.7].map((y) => {
    const a = qAtY(magP0, magC, magP2, y);
    const b = qAtY(magF0, magFC, magF2, y - 0.18);
    return T.line(f(a[0] + 0.12), f(a[1]), f(b[0] - 0.12), f(b[1]));
  });
  const hf = [
    // M4-style stock
    T.path('M0 0.35 L6.6 0.5 V1.75 L5.2 1.85 Q4.6 1.9 4.2 2.3 L1.2 4.3 H0 Z'),
    // buffer tube
    T.rect(6.6, 0.52, 2.6, 1.13),
    // upper receiver
    T.path('M9.2 0.35 H16.1 V1.9 H15.4 L15.2 1.6 H9.2 Z'),
    // charging handle latch
    T.path('M9.2 0.45 L8.85 0.5 V0.85 H9.2 Z'),
    // lower receiver
    T.path('M9.2 1.6 H15.2 L15.9 1.95 V2.35 L15.35 2.55 V4.05 H12.85 V2.95 H10.0 Q9.45 2.85 9.2 2.35 Z'),
    // pistol grip
    T.path('M11.35 2.95 L9.95 6.3 Q9.8 6.62 9.45 6.62 L8.45 6.56 Q8.15 6.5 8.25 6.2 L9.8 2.95 Z'),
    // 30-round magazine
    T.path(`M${magP0} Q${magC} ${magP2} L${magF2} Q${magFC} ${magF0} Z`.replace(/,/g, ' ')),
    // handguard (13" free float) with top rail
    T.path('M16.1 0 H29.0 V1.85 Q29.0 2.0 28.85 2.0 H16.3 Q16.1 2.0 16.1 1.85 Z'),
    // upper rail
    T.rect(9.4, 0, 6.7, 0.35),
    // barrel + muzzle device
    T.rect(29.0, 0.72, 3.0, 0.66),
    T.rect(32.0, 0.6, 2.0, 0.9, 0.1),
    // folded BUIS
    T.path('M9.65 0 V-0.3 H10.55 L10.8 0 Z'),
    T.path('M27.9 0 L28.0 -0.3 H28.75 L28.9 0 Z'),
  ];
  const hl = [
    // stock inner contour + butt pad
    T.path('M1.0 0.85 L5.8 0.95 V1.5 L3.9 1.62 L1.0 3.3 Z'),
    T.line(0.35, 0.4, 0.35, 4.25),
    // castle nut / end plate
    T.rect(8.85, 0.45, 0.35, 1.25),
    // rail slots
    ...range(9.8, 28.6, 0.8).map((x) => T.line(x, 0.06, x, 0.3)),
    T.line(16.1, 0.35, 29.0, 0.35),
    // M-LOK slots
    ...range(16.9, 26.5, 1.6).map((x) => T.rect(x, 0.88, 1.15, 0.3, 0.15)),
    // trigger guard + trigger
    T.path('M12.85 2.95 V3.58 Q12.85 3.75 12.68 3.75 H11.42 Q11.2 3.75 11.18 3.5'),
    T.path('M11.95 2.95 Q11.75 3.25 11.97 3.52'),
    // selector, takedown + pivot pins, bolt catch
    T.circle(10.6, 2.15, 0.22),
    T.line(10.6, 2.15, 11.05, 2.1),
    T.circle(9.55, 1.95, 0.1),
    T.circle(15.62, 2.12, 0.1),
    T.rect(13.05, 1.85, 0.32, 0.55, 0.05),
    // upper / lower parting line detail
    T.line(9.6, 1.25, 14.9, 1.25),
    // grip texture
    T.line(10.6, 3.5, 9.3, 6.1),
    // mag ribs + baseplate
    ...ribs,
    T.path(`M${f(qAtY(magP0, magC, magP2, 8.45)[0] + 0.05)} 8.45 L16.45 7.88`),
    // muzzle device ports
    T.line(32.45, 0.85, 33.65, 0.85),
    T.line(32.45, 1.25, 33.65, 1.25),
  ];
  return { hf, hl };
}, 216, 90);

// =====================================================================
// BOLT — bolt-action hunting rifle with 3-9x40 scope (inches)
// =====================================================================
ICONS.bolt = icon((T) => {
  const hf = [
    // sporter stock
    T.path('M0 3.25 L0.05 8.3 Q0.1 8.45 0.5 8.4 L10.0 5.35 Q10.6 5.25 11.0 5.9 L11.3 6.4 L12.4 6.3 Q12.7 5.3 13.5 4.85 L19.4 4.8 L31.0 3.95 Q31.45 3.9 31.4 3.45 L31.2 3.35 L21.0 3.42 H12.8 Q11.0 3.0 9.8 3.05 L0.4 3.2 Z'),
    // barrel
    T.path('M21.0 2.4 L43.0 2.62 V3.18 L21.0 3.42 Z'),
    // receiver + bolt shroud
    T.path('M12.3 2.35 H21.0 V3.42 H12.3 Z'),
    T.path('M11.9 2.55 H12.3 V3.25 H11.9 Q11.7 2.9 11.9 2.55 Z'),
    // bolt knob
    T.circle(13.1, 4.3, 0.32),
    // scope: eyepiece, power ring, tube, saddle, turret, objective
    T.path('M10.6 0.25 L12.4 0.4 L12.6 0.55 V1.55 L12.4 1.7 L10.6 1.85 Q10.45 1.05 10.6 0.25 Z'),
    T.rect(12.6, 0.45, 1.1, 1.2),
    T.rect(13.7, 0.55, 6.0, 1.0),
    T.rect(15.5, 0.38, 1.8, 1.34, 0.3),
    T.rect(15.95, -0.25, 0.9, 0.7, 0.06),
    T.path('M19.7 0.55 L21.3 0.15 H23.4 V1.95 H21.3 L19.7 1.55 Z'),
    // rings
    T.rect(14.3, 0.48, 0.55, 1.9),
    T.rect(18.8, 0.48, 0.55, 1.9),
  ];
  const hl = [
    T.line(0.45, 3.22, 0.5, 8.35),
    // bolt stem
    T.path('M13.95 3.0 L13.25 4.06'),
    // trigger guard + trigger + magazine
    T.path('M13.5 4.85 Q13.4 5.5 14.0 5.55 H15.3 Q15.8 5.5 15.8 4.82'),
    T.path('M14.55 4.82 Q14.38 5.1 14.62 5.36'),
    T.path('M16.1 4.8 V5.18 H19.1 V4.78'),
        // receiver details
    T.line(12.6, 2.9, 20.8, 2.9),
    // scope details
    T.path('M10.75 0.35 Q10.6 1.05 10.75 1.75'),
    T.path('M23.25 0.3 Q23.55 1.05 23.25 1.8'),
    ...[12.9, 13.15, 13.4].map((x) => T.line(x, 0.5, x, 1.6)),
    ...[16.15, 16.4, 16.65].map((x) => T.line(x, -0.2, x, 0.4)),
    T.circle(16.4, 1.05, 0.38),
    T.line(14.3, 1.55, 14.85, 1.55),
    T.line(18.8, 1.55, 19.35, 1.55),
  ];
  return { hf, hl };
}, 216, 90);

// =====================================================================
// LEVER — lever-action, 20" octagon barrel, full tube magazine (inches)
// =====================================================================
ICONS.lever = icon((T) => {
  const hf = [
    // straight-grip buttstock
    T.path('M0 1.95 L0.1 6.45 Q0.2 6.6 0.6 6.55 L9.5 4.35 Q10.8 3.75 12.0 3.65 V2.25 Q10.6 2.35 9.2 2.15 L0.45 1.85 Z'),
    // receiver
    T.path('M12.0 1.55 Q12.2 1.3 12.6 1.3 H18.6 V3.55 L17.8 3.75 H12.3 Q12.0 3.7 12.0 3.5 Z'),
    // hammer
    T.path('M12.5 1.35 L12.15 0.8 Q12.05 0.65 11.85 0.66 L11.35 0.75 Q11.2 0.8 11.3 0.92 L11.7 1.05 L12.05 1.6 Z'),
    // lever loop (band)
    T.path('M17.7 3.75 L17.45 4.35 L14.9 4.5 Q13.3 6.55 11.2 5.75 Q10.1 5.25 10.45 4.3 L11.05 4.25 Q11.0 4.95 11.6 5.15 Q12.9 5.65 14.2 4.25 L14.4 3.75 Z'),
    // octagon barrel + tube magazine
    T.rect(18.6, 1.55, 20.0, 0.9),
    T.rect(18.6, 2.55, 19.3, 0.65, 0.12),
    // forend
    T.path('M18.6 2.3 H26.6 Q27.2 2.3 27.2 2.9 Q27.2 3.5 26.6 3.5 L18.6 3.62 Z'),
    // barrel band + sights
    T.rect(37.0, 1.48, 0.6, 1.8, 0.08),
    T.path('M38.05 1.55 V1.15 H38.35 V1.55 Z'),
    T.path('M21.8 1.55 L21.85 1.2 Q22.1 1.32 22.35 1.2 L22.4 1.55 Z'),
  ];
  const hl = [
    T.line(0.4, 1.88, 0.5, 6.5),
    // octagon flats
    T.line(18.6, 1.78, 38.6, 1.78),
    T.line(18.6, 2.22, 38.6, 2.22),
    // trigger
    T.path('M14.15 3.75 Q13.95 4.0 14.15 4.25'),
    // receiver: screws, side plate line, loading gate
    T.circle(13.2, 2.45, 0.14),
    T.circle(17.0, 2.65, 0.14),
    T.path('M12.6 3.2 H18.2'),
    T.rect(16.4, 2.85, 1.6, 0.3, 0.1),
    // forend tip line
    T.line(26.0, 2.32, 26.0, 3.5),
  ];
  return { hf, hl };
}, 216, 90);

// =====================================================================
// RIMFIRE — 10/22-style carbine (inches)
// =====================================================================
ICONS.rimfire = icon((T) => {
  const hf = [
    T.path('M0 1.75 L0.1 5.5 Q0.2 5.7 0.6 5.65 L8.7 3.95 Q9.6 3.75 10.4 4.4 L10.9 4.85 L11.7 4.75 Q11.7 4.0 12.2 3.45 L27.4 2.95 Q27.8 2.9 27.8 2.6 L27.7 2.3 H11.5 Q10.4 2.4 9.7 2.1 Q8.8 1.75 8.0 1.75 L0.4 1.6 Z'),
    // receiver
    T.path('M11.3 2.35 V1.6 Q11.3 1.2 11.8 1.2 H16.8 Q17.0 1.25 17.0 1.5 V2.35 Z'),
    // barrel
    T.rect(17.0, 1.6, 18.5, 0.6),
    // barrel band
    T.rect(24.0, 1.5, 0.55, 1.5, 0.06),
    // rotary magazine, protruding slightly
    T.rect(14.35, 3.2, 1.25, 0.5, 0.12),
    // sights
    T.path('M34.75 1.6 V1.32 H35.05 V1.6 Z'),
    T.path('M19.8 1.6 V1.35 H20.4 V1.6 Z'),
  ];
  const hl = [
    T.line(0.35, 1.65, 0.45, 5.6),
    T.path('M12.25 3.45 Q12.3 4.05 12.9 4.1 H13.7 Q14.1 4.05 14.1 3.42'),
    T.path('M13.05 3.42 Q12.9 3.7 13.1 3.95'),
    T.circle(12.1, 1.85, 0.11),
    T.circle(16.35, 1.85, 0.11),
    T.line(11.6, 1.45, 16.7, 1.45),
    // bolt hold-open / receiver lower edge
    T.line(11.5, 2.35, 17.0, 2.35),
  ];
  return { hf, hl };
}, 216, 90);

// =====================================================================
// BATTLE — M1A-style battle rifle, wood stock (inches)
// =====================================================================
ICONS.battle = icon((T) => {
  const hf = [
    // stock
    T.path('M0 1.9 L0.1 6.35 Q0.2 6.5 0.6 6.45 L9.6 4.15 Q10.5 4.05 11.1 4.75 L11.5 5.05 L12.3 4.95 Q12.2 4.2 12.6 3.75 H18.6 L33.0 3.1 Q33.3 3.05 33.3 2.8 V2.2 H20.0 L12.6 2.35 Q11.4 2.5 10.2 2.25 L0.45 1.8 Z'),
    // receiver
    T.path('M12.6 2.4 V1.3 Q12.6 0.95 13.0 0.95 H20.2 V2.4 Z'),
    // aperture rear sight with ears
    T.path('M12.9 0.95 L13.1 0.2 H13.4 L13.5 0.5 H13.8 L13.9 0.2 H14.2 L14.4 0.95 Z'),
    // barrel
    T.path('M20.2 1.4 L38.2 1.5 V2.1 L20.2 2.2 Z'),
    // upper handguard
    T.path('M20.2 1.0 H29.2 Q29.5 1.05 29.5 1.35 V1.45 H20.2 Z'),
    // gas cylinder / front band
    T.path('M33.3 1.3 H38.2 V2.85 H33.6 Q33.3 2.85 33.3 2.55 Z'),
    // flash suppressor + front sight
    T.path('M38.2 1.3 L41.6 1.36 L44.3 1.45 V2.15 L41.6 2.24 L38.2 2.3 Z'),
    T.path('M42.4 1.42 L42.55 0.62 H42.9 L43.05 1.42 Z'),
    // 20-round box magazine
    T.path('M15.3 3.75 L15.6 6.45 L18.7 6.25 L18.4 3.75 Z'),
  ];
  const hl = [
    T.line(0.4, 1.85, 0.5, 6.45),
    T.circle(13.65, 0.55, 0.12),
    // trigger guard + trigger + safety
    T.path('M12.7 3.8 Q12.7 4.55 13.4 4.6 H14.5 Q15.0 4.55 15.0 3.8'),
    T.path('M13.65 3.77 Q13.5 4.05 13.7 4.35'),
    T.line(14.85, 3.85, 14.85, 4.15),
    // receiver details: stripper guide, bolt lock line
    T.line(14.7, 1.35, 19.9, 1.35),
    T.line(15.2, 1.85, 19.9, 1.85),
    // gas cylinder detail
    T.line(33.3, 2.15, 38.2, 2.15),
    T.line(37.4, 1.3, 37.4, 2.85),
    // flash suppressor slots
    T.line(41.9, 1.6, 43.9, 1.62),
    T.line(41.9, 2.0, 43.9, 1.98),
    // magazine ribs + base
    T.line(15.48, 5.1, 18.53, 4.95),
    T.line(15.53, 5.55, 18.58, 5.4),
    T.line(15.58, 6.1, 18.66, 5.9),
    // stock: ferrule, sling swivel
    T.line(32.3, 2.2, 32.3, 3.15),
    T.circle(29.0, 3.55, 0.14),
  ];
  return { hf, hl };
}, 216, 90);

// =====================================================================
// SHOTGUN — pump action, 20" barrel, full tube magazine (inches)
// =====================================================================
ICONS.shotgun = icon((T) => {
  const hf = [
    // stock
    T.path('M0 1.25 L0.1 5.6 Q0.2 5.75 0.6 5.7 L9.2 3.85 Q10.4 3.55 11.4 3.6 L12.65 3.05 V1.0 Q11.0 1.3 9.9 1.55 Q9.0 1.3 8.4 1.25 L0.4 1.15 Z'),
    // receiver
    T.path('M12.65 1.0 Q12.8 0.65 13.3 0.65 H20.0 Q20.25 0.7 20.25 1.0 V2.95 H12.65 Z'),
    // tang safety
    T.rect(12.95, 0.45, 0.55, 0.22, 0.06),
    // barrel
    T.rect(20.25, 1.28, 20.0, 0.84),
    // magazine tube + cap
    T.path('M20.25 2.2 H38.6 Q38.95 2.2 38.95 2.575 Q38.95 2.95 38.6 2.95 H20.25 Z'),
    // pump forend
    T.rect(21.8, 1.95, 7.8, 1.5, 0.45),
    // bead
    T.circle(39.95, 1.15, 0.13),
  ];
  const hl = [
    // recoil pad
    T.line(0.6, 1.15, 0.7, 5.68),
    // trigger guard + trigger + action release
    T.path('M13.0 2.95 Q13.0 3.72 13.7 3.75 H14.8 Q15.4 3.72 15.4 2.95'),
    T.path('M14.1 2.95 Q13.95 3.25 14.15 3.55'),
    T.line(15.75, 2.98, 15.75, 3.35),
    // receiver: loading port edge, ejection-side line
    T.line(13.1, 1.15, 19.8, 1.15),
    // forend grooves
    ...range(22.6, 28.9, 0.7).map((x) => T.line(x, 2.3, x, 3.1)),
    // action bar + mag tube clamp
    T.line(20.25, 2.45, 21.8, 2.45),
    T.rect(37.6, 1.25, 0.5, 1.75, 0.06),
  ];
  return { hf, hl };
}, 216, 90);

// =====================================================================
// SEMISHOTGUN — semi-auto tactical (Benelli M4 style), pistol-grip stock
// =====================================================================
ICONS.semishotgun = icon((T) => {
  const hf = [
    // skeleton stock + pistol grip
    T.path('M0 0.55 L10.4 0.8 V2.35 L11.8 2.4 L10.65 5.85 Q10.55 6.1 10.25 6.1 L9.45 6.05 Q9.15 6.0 9.25 5.75 L10.3 3.0 Q9.9 2.75 9.1 2.75 L1.4 4.45 L0.1 4.5 Z'),
    // receiver
    T.path('M10.4 0.55 Q10.4 0.3 10.8 0.3 H19.2 Q19.4 0.32 19.4 0.6 V2.4 H10.4 Z'),
    // rail + ghost-ring rear sight
    T.rect(11.1, 0, 7.9, 0.3),
    T.path('M11.2 0 L11.3 -0.65 H11.6 L11.75 -0.35 H12.25 L12.4 -0.65 H12.7 L12.8 0 Z'),
    // barrel
    T.rect(19.4, 1.24, 18.5, 0.83),
    // magazine tube
    T.path('M19.4 2.15 H35.8 Q36.15 2.15 36.15 2.5 Q36.15 2.85 35.8 2.85 H19.4 Z'),
    // handguard
    T.path('M19.4 1.05 H27.4 Q28.0 1.05 28.0 1.6 V2.75 Q28.0 3.25 27.4 3.25 H19.4 Z'),
    // gas block
    T.rect(28.0, 1.1, 1.3, 1.85, 0.1),
    // front sight with wings
    T.path('M37.0 1.24 L37.1 0.55 H37.3 L37.4 0.85 H37.7 L37.8 0.55 H38.0 L38.1 1.24 Z'),
  ];
  const hl = [
    T.path('M1.3 1.2 L9.0 1.4 V2.05 L2.6 3.6 L1.3 3.65 Z'),
    T.line(0.45, 0.58, 0.55, 4.45),
    ...range(11.5, 18.7, 0.8).map((x) => T.line(x, 0.05, x, 0.26)),
    T.circle(12.0, -0.35, 0.12),
    // trigger guard + trigger
    T.path('M11.8 2.4 Q11.75 3.3 12.5 3.35 H13.7 Q14.35 3.3 14.4 2.4'),
    T.path('M12.85 2.4 Q12.7 2.7 12.9 3.05'),
    // receiver panel + bolt release
    T.rect(13.4, 0.95, 5.2, 0.9, 0.12),
    T.circle(15.0, 2.1, 0.12),
    // handguard grooves
    T.line(19.9, 1.7, 27.4, 1.7),
    T.line(19.9, 2.5, 27.4, 2.5),
    // barrel / tube clamp
    T.rect(35.0, 1.18, 0.5, 1.75, 0.06),
    T.line(37.55, 0.85, 37.55, 0.6),
  ];
  return { hf, hl };
}, 216, 90);

// =====================================================================
// AMMO — open box of cartridges + loose rounds (design px)
// =====================================================================
ICONS.ammo = icon((T) => {
  const tips = [];
  for (let row = 2; row >= 0; row--) {
    for (let c = 0; c < 7; c++) {
      const x = 48 + c * 13.2 + row * 6.6, y = 48.5 - row * 5.1;
      tips.push(T.ellipse(x, y, 4.6, 2.5));
    }
  }
  const noses = [];
  for (let c = 0; c < 7; c++) {
    const x = 48 + c * 13.2;
    noses.push(T.path(`M${x - 4.6} 48.5 Q${x - 4.2} 43.5 ${x} 42.6 Q${x + 4.2} 43.5 ${x + 4.6} 48.5`));
  }
  const hf = [
    // open lid flap
    T.path('M60 36 L68 13 H168 L160 36 Z'),
    // box: front, top rim, side
    T.path('M40 52 H140 V100 H40 Z'),
    T.path('M140 52 L160 36 V84 L140 100 Z'),
    // loose upright pistol cartridge
    T.path('M180 92 V90 H181 V88.5 H180.3 V70 H189.7 V88.5 H189 V90 H190 V92 Z'),
    T.path('M180.6 70 C180.6 62 182.5 57 185 57 C187.5 57 189.4 62 189.4 70 Z'),
    // loose rifle cartridge, lying
    T.path('M166 94 H168 V95 H170 V94.2 L199 94.5 L202 95.9 H206 C214 96 222 98 226 99 C222 100 214 102 206 102.1 H202 L199 103.5 L170 103.8 V103 H168 V104 H166 Z'),
  ];
  const hl = [
    // opening (top face) + rows of cartridge noses
    T.path('M40 52 L60 36 H160 L140 52'),
    ...tips,
    ...noses,
    // label
    T.rect(50, 61, 80, 30, 2),
    T.line(58, 69, 104, 69),
    T.line(58, 75.5, 120, 75.5),
    T.line(58, 82, 92, 82),
    // lid inner crease
    T.line(64, 26, 164, 26),
    // cartridge details
    T.line(180.3, 75, 189.7, 75),
    T.line(206, 95.9, 206, 102.1),
    T.line(199, 94.5, 199, 103.5),
  ];
  return { hf, hl };
}, 204, 92);

// =====================================================================
// SHELLS — three standing 12-gauge shotshells (design px)
// =====================================================================
ICONS.shells = icon((T) => {
  const hf = [], hl = [];
  const xs = [72, 107.5, 143];
  const lift = [0, -5, 0];
  xs.forEach((x, i) => {
    const o = lift[i];
    hf.push(T.path(`M${x} ${98 + o} V${27 + o} Q${x} ${22 + o} ${x + 5} ${22 + o} H${x + 20} Q${x + 25} ${22 + o} ${x + 25} ${27 + o} V${98 + o} H${x + 26.2} V${104 + o} H${x - 1.2} V${98 + o} Z`));
    hl.push(T.line(x, 80 + o, x + 25, 80 + o));            // brass head
    hl.push(T.line(x, 88 + o, x + 25, 88 + o));            // brass ring
    hl.push(T.line(x, 98 + o, x + 25, 98 + o));            // rim
    // crimp folds
    hl.push(T.path(`M${x + 5} ${22.5 + o} L${x + 7.5} ${28.5 + o}`));
    hl.push(T.path(`M${x + 12.5} ${22.5 + o} V${29 + o}`));
    hl.push(T.path(`M${x + 20} ${22.5 + o} L${x + 17.5} ${28.5 + o}`));
    // hull ribs
    hl.push(T.line(x + 6, 36 + o, x + 6, 74 + o));
    hl.push(T.line(x + 19, 36 + o, x + 19, 74 + o));
  });
  return { hf, hl };
}, 130, 92);

// =====================================================================
// REDDOT — open reflex sight, shooter's view, on a riser (design px)
// =====================================================================
ICONS.reddot = icon((T) => {
  const hf = [
    // extruded housing (near face + far face hull), then the near face
    T.path('M70 84 L75 44 Q77 28 94 26 L110 16 H162 Q179 18 181 34 L186 74 L170 84 Z'),
    T.path('M70 84 L75 44 Q77 28 94 26 H146 Q163 28 165 44 L170 84 Z'),
    // base plate + its side
    T.path('M66 84 H174 V92 H66 Z'),
    T.path('M174 84 L190 74 V82 L174 92 Z'),
    // rail clamp (end profile) + thumbscrew
    T.path('M82 92 H158 L163 97 L158 102 H82 L77 97 Z'),
    T.circle(184, 94, 5),
    // emitter dot
    T.circle(120, 57, 2.6),
  ];
  const hl = [
    // lens window
    T.path('M84 78 L88 47 Q90 37 101 36 H139 Q150 37 152 47 L156 78 Z'),
    T.circle(120, 57, 11.5),
    T.path('M93 48 Q95 42 102 41'),
    // emitter
    T.rect(113, 78, 14, 6, 1.5),
    // depth edges
    T.line(157, 31, 173, 21),
    T.line(170, 84, 186, 74),
    // top adjuster + right-side buttons
    T.ellipse(130, 21, 5, 2.4),
    T.path('M173 52 L178 49 V58 L173 61 Z'),
    T.path('M174 66 L179 63 V70 L174 73 Z'),
    // base screws, clamp detail
    T.circle(76, 88, 1.6), T.circle(164, 88, 1.6),
    T.line(88, 97, 152, 97),
    T.line(181, 94, 187, 94),
  ];
  return { hf, hl };
}, 140, 92);

// =====================================================================
// SCOPE — 3-9x40 riflescope with turrets, rings and base (inches)
// =====================================================================
ICONS.scope = icon((T) => {
  const hf = [
    T.path('M0 -0.78 L2.4 -0.72 Q2.7 -0.7 2.8 -0.55 V0.55 Q2.7 0.7 2.4 0.72 L0 0.78 Q-0.12 0 0 -0.78 Z'),
    T.rect(2.8, -0.62, 1.1, 1.24, 0.05),
    T.rect(3.3, -0.85, 0.35, 0.25, 0.04),
    T.rect(3.9, -0.5, 4.5, 1.0),
    T.rect(5.3, -0.72, 1.8, 1.44, 0.3),
    T.rect(5.72, -1.55, 0.96, 0.85, 0.06),
    T.path('M8.4 -0.5 L9.7 -0.95 H12.2 Q12.3 -0.95 12.3 -0.85 V0.85 Q12.3 0.95 12.2 0.95 H9.7 L8.4 0.5 Z'),
    // rings
    T.rect(4.25, -0.62, 0.7, 1.95, 0.06),
    T.rect(7.6, -0.62, 0.7, 1.95, 0.06),
    // picatinny base
    T.rect(3.6, 1.33, 5.3, 0.38, 0.04),
  ];
  const hl = [
    T.path('M0.12 -0.7 Q-0.05 0 0.12 0.7'),
    T.path('M12.15 -0.85 Q12.45 0 12.15 0.85'),
    ...[3.05, 3.3, 3.55].map((x) => T.line(x, -0.58, x, 0.58)),
    ...[5.88, 6.08, 6.28, 6.48].map((x) => T.line(x, -1.5, x, -0.82)),
    T.line(5.72, -1.33, 6.68, -1.33),
    T.circle(6.2, 0, 0.45),
    T.line(4.25, 0.04, 4.95, 0.04),
    T.line(7.6, 0.04, 8.3, 0.04),
    T.line(4.25, 0.72, 4.95, 0.72),
    T.line(7.6, 0.72, 8.3, 0.72),
    ...range(3.85, 8.7, 0.4).map((x) => T.line(x, 1.4, x, 1.64)),
    T.line(9.9, -0.95, 9.9, 0.95),
  ];
  return { hf, hl };
}, 212, 80);

// =====================================================================
// THERMAL — handheld thermal monocular (design px)
// =====================================================================
ICONS.thermal = icon((T) => {
  const hf = [
    // eyecup
    T.path('M58 45 L41 48 Q36 49 36 53 V73 Q36 77 41 78 L58 81 Z'),
    // body
    T.rect(58, 36, 110, 54, 11),
    // control buttons
    T.rect(84, 30.5, 13, 6, 2),
    T.rect(103, 30.5, 13, 6, 2),
    T.rect(122, 30.5, 13, 6, 2),
    // objective housing + lens face
    T.path('M168 41 H180 Q183 41 183 44 V82 Q183 85 180 85 H168 Z'),
    T.ellipse(184, 63, 6, 20),
  ];
  const hl = [
    T.line(45, 47.5, 45, 78.5),
    T.line(51, 46.3, 51, 79.7),
    T.rect(70, 47, 82, 32, 7),
    ...[171, 174.5, 178].map((x) => T.line(x, 43, x, 83)),
    T.ellipse(184.5, 63, 3.6, 14),
    T.path('M182.8 54 Q184 50 185.8 49.5'),
    // strap lug
    T.path('M64 90 V95 Q64 97 66 97 H72 Q74 97 74 95 V90'),
    // status LED + logo panel
    T.circle(160, 46, 1.6),
    T.line(82, 63, 140, 63),
  ];
  return { hf, hl };
}, 196, 84);

// =====================================================================
// LIGHT — rail-mounted weapon light with beam (design px)
// =====================================================================
ICONS.light = icon((T) => {
  const hf = [
    T.rect(40, 50, 112, 34, 6),
    T.path('M150 50 L156 42 H180 Q184 42 184 46 V88 Q184 92 180 92 H156 L150 84 Z'),
    T.path('M62 50 L66 41 H126 L130 50 Z'),
    // ambi paddle switch
    T.path('M40 58 L29 54 Q26 54 26 57 V62 Q26 64 29 64.5 L40 66 Z'),
    T.ellipse(184, 67, 4, 22),
  ];
  const hl = [
    // host rail segment
    T.rect(48, 33, 96, 8, 1),
    ...range(56, 136, 8).map((x) => T.line(x, 33, x, 41)),
    // clamp screw
    T.circle(96, 45.5, 2.6),
    // bezel fins
    ...[160, 166, 172].map((x) => T.line(x, 45, x, 89)),
    // body seam + grip lines
    T.line(48, 67, 146, 67),
    T.line(60, 74, 140, 74),
    // reflector
    T.ellipse(184.5, 67, 2.4, 14),
    // beam
    T.path('M190 47 L232 33'),
    T.path('M190 87 L232 101'),
  ];
  return { hf, hl };
}, 214, 84);

// =====================================================================
// MAG — AR-style 30-round polymer magazine, portrait (design px)
// =====================================================================
ICONS.mag = icon((T) => {
  const R0 = [104, 18], RC = [106, 62], R2 = [121, 100];
  const F0 = [134, 18], FC = [138, 58], F2 = [154, 95];
  const rib = (y) => {
    const a = qAtY(R0, RC, R2, y), b = qAtY(F0, FC, F2, y - 1.5);
    return T.line(f(a[0] + 2.5), f(a[1]), f(b[0] - 2.5), f(b[1]));
  };
  const hf = [
    T.path(`M104 18 L110 16 H130 L134 18 Q138 58 154 95 L121 100 Q106 62 104 18 Z`),
    // baseplate
    T.path('M119 98 L156 92.5 L158 99 L121.5 105 Z'),
    // top round in feed lips
    T.path('M108 10.5 H126 L128.5 11.5 H131 C135 11.5 139 12.6 142 13.2 C139 13.8 135 14.9 131 14.9 H128.5 L126 16 H108 Z'),
  ];
  const hl = [
    ...[28, 33, 38, 43].map(rib),
    ...[78, 83, 88].map(rib),
    // texture panel
    T.path(`M${f(qAtY(R0, RC, R2, 50)[0] + 4)} 50 L${f(qAtY(F0, FC, F2, 48.5)[0] - 4)} 48.5 L${f(qAtY(F0, FC, F2, 70)[0] - 4)} 70 L${f(qAtY(R0, RC, R2, 71.5)[0] + 4)} 71.5 Z`),
    T.line(126, 10.5, 126, 16),
  ];
  return { hf, hl };
}, 76, 96);

// =====================================================================
// CASE — hard rifle case: latches, handle, wheels (design px)
// =====================================================================
ICONS.case = icon((T) => {
  const hf = [
    T.rect(16, 40, 208, 60, 9),
    T.path('M100 40 V30 Q100 22 108 22 H132 Q140 22 140 30 V40 H134 V31 Q134 28 131 28 H109 Q106 28 106 31 V40 Z'),
    ...[44, 84, 150, 190].map((x) => T.rect(x, 47, 18, 18, 2)),
    T.circle(208, 100, 6),
    T.circle(32, 101, 2.5),
  ];
  const hl = [
    T.line(16, 55, 44, 55), T.line(62, 55, 84, 55), T.line(102, 55, 150, 55), T.line(168, 55, 190, 55), T.line(208, 55, 224, 55),
    T.line(16, 58, 44, 58), T.line(62, 58, 84, 58), T.line(102, 58, 150, 58), T.line(168, 58, 190, 58), T.line(208, 58, 224, 58),
    ...[44, 84, 150, 190].map((x) => T.line(x + 4, 60, x + 14, 60)),
    T.rect(30, 68, 180, 24, 4),
    T.rect(112, 74, 16, 12, 3),
    T.circle(120, 80, 2.5),
    T.circle(208, 100, 2),
  ];
  return { hf, hl };
}, 214, 90);

// =====================================================================
// KIT — open cleaning kit: rod, brushes, mop, solvent, patches (design px)
// =====================================================================
ICONS.kit = icon((T) => {
  const hf = [
    // lid (open, tilted back) + box
    T.path('M22 40 L30 14 H210 L218 40 Z'),
    T.rect(18, 40, 204, 64, 6),
    // T-handle + rod sections
    T.rect(30, 49, 6, 14, 1.5),
    T.rect(36, 54.5, 160, 3, 1.5),
    // bore brush bristles
    T.rect(64, 67.5, 24, 8, 1),
    T.rect(104, 66.5, 30, 10, 1.5),
    // mop
    T.rect(150, 67, 20, 9, 4.5),
    // solvent bottle
    T.rect(186, 72, 22, 24, 3),
    T.rect(192.5, 66, 9, 6),
    T.rect(191, 61.5, 12, 4.5, 1),
  ];
  const hl = [
    T.rect(26, 47, 188, 50, 3),
    T.line(34, 20, 206, 20),
    // rod joints
    ...[80, 120, 160].map((x) => T.line(x, 53.5, x, 58.5)),
    // brush stems + bristle hatching
    T.line(46, 71.5, 64, 71.5),
    ...range(66, 86, 2.5).map((x) => T.line(x, 68, x, 75)),
    T.line(92, 71.5, 104, 71.5),
    ...range(107, 131, 3).map((x) => T.line(x, 67, x, 76)),
    T.line(140, 71.5, 150, 71.5),
    // patches
    T.rect(40, 82, 16, 10, 1), T.rect(44, 80, 16, 10, 1),
    T.rect(70, 82, 34, 8, 1),
    // bottle label
    T.rect(189, 78, 16, 12, 1),
  ];
  return { hf, hl };
}, 206, 94);

// =====================================================================
// SAFE — gun safe front: door, 3-spoke handle, keypad, hinges (design px)
// =====================================================================
ICONS.safe = icon((T) => {
  const hc = [120, 68];
  const spokes = [-90, 30, 150].map((a) => {
    const rad = (a * Math.PI) / 180;
    return [f(hc[0] + 15 * Math.cos(rad)), f(hc[1] + 15 * Math.sin(rad))];
  });
  const hf = [
    T.rect(72, 10, 96, 98, 4),
    // hinges
    T.rect(68, 24, 4, 14, 1),
    T.rect(68, 80, 4, 14, 1),
    // keypad
    T.rect(108, 24, 24, 22, 2),
    // handle hub + ball ends
    T.circle(hc[0], hc[1], 5.5),
    ...spokes.map(([x, y]) => T.circle(x, y, 2.6)),
    // feet
    T.rect(78, 108, 12, 4, 1),
    T.rect(150, 108, 12, 4, 1),
  ];
  const hl = [
    // door gap
    T.rect(78, 16, 84, 86, 3),
    // keypad screen + keys
    T.rect(111, 26.5, 18, 4.5, 0.8),
    ...[34.5, 38.5, 42.5].flatMap((y) => [113.5, 120, 126.5].map((x) => T.circle(x, y, 1.1))),
    // spokes
    ...spokes.map(([x, y]) => T.line(hc[0], hc[1], x, y)),
    T.circle(hc[0], hc[1], 2),
    // badge
    T.rect(104, 88, 32, 6, 1),
  ];
  return { hf, hl };
}, 104, 100);

// ---------- emit ----------
const ORDER = ['pistol', 'revolver', 'ar', 'bolt', 'lever', 'rimfire', 'battle', 'shotgun', 'semishotgun', 'ammo', 'shells', 'reddot', 'scope', 'thermal', 'light', 'mag', 'case', 'kit', 'safe'];
let js = `/* Agarthan Armory — hologram product schematics.
 * window.AA_ICONS[type] -> inline SVG string (viewBox 0 0 240 120).
 * Styling is all CSS via currentColor: .hf = body silhouettes (filled
 * faintly + stroked), .hl = detail line work (stroke only).
 * Firearms are side profiles, muzzle right, drawn from real proportions.
 */
window.AA_ICONS = {
`;
for (const k of ORDER) {
  const s = ICONS[k];
  if (!s) throw new Error('missing ' + k);
  if (s.includes("'")) throw new Error('quote in ' + k);
  js += `  ${/^[a-z]+$/.test(k) ? k : `'${k}'`}: '${s}',\n`;
}
js += '};\n';
fs.writeFileSync(OUT, js);
console.log('wrote', OUT, js.length, 'bytes');
