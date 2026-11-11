#!/usr/bin/env node
/*
 * gen-social-card.mjs — renders the link preview, assets/img/og-card-atom.jpg (1200×630), and the
 * home-screen icon, assets/img/apple-touch-icon.png (180×180), from the site's own art.
 * Needs Playwright (npx playwright install chromium, or a preinstalled one):
 *   node tools/gen-social-card.mjs
 *
 * The card is THE ATOM MACHINE: the Atomium (the Agarthan Crystal realm's relic) switched on, its
 * spheres glowing and arcs jumping between them, the departments' holo schematics orbiting it like
 * electrons, the ice wall along its foot lit in the Crystal realm's violet, and the banner's own
 * logo (the saucer over the pyramid, and the name) on the banner's purple. Scrapers cache a card
 * by its URL with no way to purge it, so a new card is a new file name: the earlier og-card.png
 * stays for the posts already out there.
 */
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const u = (p) => pathToFileURL(path.join(ROOT, p)).href;
const OUT = 'assets/img/og-card-atom.jpg';

const card = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Mono;src:url('${u('assets/fonts/share-tech-mono-latin-400-normal.woff2')}')}
@font-face{font-family:Chakra;src:url('${u('assets/fonts/chakra-petch-latin-400-normal.woff2')}')}
@font-face{font-family:Chakra;font-weight:600;src:url('${u('assets/fonts/chakra-petch-latin-600-normal.woff2')}')}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0b0614}
.c{position:relative;width:1200px;height:630px;overflow:hidden;background:#140a22}
/* the atom machine: the whole Atomium, all five spheres in frame */
.atom{position:absolute;left:310px;top:-38px;width:960px;height:auto;filter:saturate(1.12) contrast(1.06)}
/* the banner's purple, running into the night the photo was taken in */
.panel{position:absolute;inset:0;background:
  linear-gradient(90deg,#5c3d92 0%,#4e3284 300px,rgba(60,36,104,.82) 420px,rgba(30,16,52,.35) 560px,rgba(20,10,34,0) 700px),
  radial-gradient(70% 90% at 0% 40%,rgba(120,80,190,.35),transparent 70%)}
.grain{position:absolute;inset:0;opacity:.08;background-image:radial-gradient(rgba(255,255,255,.6) .6px,transparent .7px);background-size:3px 3px;mix-blend-mode:overlay}
canvas{position:absolute;left:0;top:0;width:1200px;height:630px}
/* the ice wall along the foot, lit violet */
.wallbox{position:absolute;left:0;right:0;bottom:0;height:150px;overflow:hidden;
  -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 45%);mask-image:linear-gradient(180deg,transparent 0,#000 45%)}
.wall{position:absolute;left:0;bottom:-4px;width:1200px;height:auto;transform:scaleY(.42);transform-origin:50% 100%;filter:hue-rotate(78deg) saturate(1.25) brightness(1.05)}
.e{position:absolute;left:64px;top:52px;font:14px Mono;letter-spacing:.36em;color:#ffd27a;text-transform:uppercase}
.logo{position:absolute;left:58px;top:88px;width:400px;height:auto;filter:drop-shadow(0 0 18px rgba(255,190,110,.35)) drop-shadow(0 2px 2px rgba(0,0,0,.35))}
.tag{position:absolute;left:64px;top:342px;width:420px;font:21px/1.38 Chakra;color:#efe4ff;text-shadow:0 1px 10px rgba(20,8,40,.8)}
.url{position:absolute;left:64px;top:424px;font:15px Mono;letter-spacing:.3em;color:#ffd27a;text-transform:uppercase;text-shadow:0 0 14px rgba(255,170,80,.6)}
.ico{position:absolute;width:104px;height:52px;color:#e6d3ff}
.ico svg{width:100%;height:100%;overflow:visible}
.ico svg path,.ico svg rect,.ico svg circle,.ico svg ellipse,.ico svg line,.ico svg polyline,.ico svg polygon{fill:none;stroke:currentColor;stroke-width:1.5;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.ico svg .hf *{fill:currentColor;fill-opacity:.14}
.ico svg .hl *{stroke:#ffd27a;stroke-opacity:.85}
</style><script src="${u('assets/js/icons.js')}"></script></head><body><div class="c">
<img class="atom" src="${u('assets/img/feature/realm/crystal/atomium-1920.webp')}">
<div class="panel"></div>
<canvas id="fx" width="2400" height="1260"></canvas>
<div class="wallbox"><img class="wall" src="${u('assets/img/ice-wall.svg')}"></div>
<div id="orb"></div>
<div class="grain"></div>
<div class="e">Federally licensed · beyond the wall</div>
<img class="logo" src="${u('assets/img/brand/banner-logo.png')}">
<div class="tag">Arms, ammunition &amp; FFL transfers from beyond the ice wall</div>
<div class="url">agarthanarmory.com</div>
</div><script>
(() => {
  // the photo's spheres on the card (the 1920 copy drawn at half size, from 310, -38)
  const at = (x, y, r) => [310 + x * 0.5, -38 + y * 0.5, r * 0.5];
  const P = { TL: at(332, 365, 172), TC: at(962, 430, 255), TR: at(1587, 370, 172), BL: at(427, 1135, 150), BR: at(1485, 1135, 150), C: at(960, 790, 120) };
  const cv = document.getElementById('fx'), g = cv.getContext('2d');
  g.scale(2, 2);
  const fr = (x) => x - Math.floor(x), hash = (n) => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const glow = (x, y, r, rgb, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(0.3, 'rgba(' + rgb + ',' + a * 0.5 + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); };
  g.globalCompositeOperation = 'lighter';
  // the heart behind the tower, and every sphere lit
  glow(P.C[0], P.C[1], 190, '255,180,90', 0.55);
  for (const k of ['TL', 'TC', 'TR', 'BL', 'BR']) {
    const [x, y, r] = P[k];
    glow(x, y, r * 1.9, '255,190,110', 0.42); glow(x, y, r * 2.6, '170,120,255', 0.26);
    for (let j = 0; j < 30; j++) { const a = hash(k.length * 31 + j + x) * 6.283, rr = r * 0.9 * Math.sqrt(hash(j * 7 + y)); glow(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 3 + 4 * hash(j + x), '255,250,240', 0.9); }
  }
  // energy down the tubes
  const B = [['TL', 'TC'], ['TC', 'TR'], ['TL', 'BL'], ['TR', 'BR'], ['TL', 'C'], ['TR', 'C'], ['BL', 'C'], ['BR', 'C'], ['TC', 'C']];
  B.forEach(([a, b], i) => { for (let q = 0; q < 3; q++) { const p = fr(i * 0.37 + q / 3); glow(P[b][0] + (P[a][0] - P[b][0]) * p, P[b][1] + (P[a][1] - P[b][1]) * p, 16, '255,200,120', 0.8 * Math.sin(Math.PI * p)); } });
  // arcs: a lightning bolt from sphere to sphere, built by midpoint displacement, with thinner forks
  const path = (x1, y1, x2, y2, seed, amp) => {
    let pts = [[x1, y1], [x2, y2]], disp = Math.hypot(x2 - x1, y2 - y1) * 0.2 * amp, sd = seed;
    for (let it = 0; it < 7; it++) { const np = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1; sd++; const r = hash(sd) * 2 - 1; np.push([(ax + bx) / 2 + nx / nl * disp * r, (ay + by) / 2 + ny / nl * disp * r], pts[i + 1]); } pts = np; disp *= it < 2 ? 0.5 : 0.6; }
    return pts;
  };
  const stroke = (pts, k) => { for (const [w, c] of [[11, 'rgba(160,110,255,.2)'], [4.2, 'rgba(255,170,90,.6)'], [1.6, 'rgba(255,250,240,.95)']]) { g.lineWidth = w * k; g.strokeStyle = c; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke(); } };
  const bolt = (A, Bn, seed) => {
    const dx = Bn[0] - A[0], dy = Bn[1] - A[1], d = Math.hypot(dx, dy);
    const main = path(A[0] + dx / d * A[2] * 0.85, A[1] + dy / d * A[2] * 0.85, Bn[0] - dx / d * Bn[2] * 0.85, Bn[1] - dy / d * Bn[2] * 0.85, seed, 0.85);
    stroke(main, 1);
    [0.38, 0.66].forEach((q, k) => {
      const o = main[Math.floor(main.length * q)], fa = Math.atan2(dy, dx) + (k ? -0.7 : 0.75), fl = d * (0.16 + 0.08 * hash(seed + 3 + k));
      stroke(path(o[0], o[1], o[0] + Math.cos(fa) * fl, o[1] + Math.sin(fa) * fl, seed * 7 + k, 0.7), 0.5);
    });
  };
  bolt(P.TL, P.TC, 3); bolt(P.TC, P.TR, 11); bolt(P.TR, P.BR, 23); bolt(P.BL, P.C, 41);
  // the orbit the departments ride round the machine
  const O = { x: 830, y: 318, rx: 318, ry: 92, rot: -0.18 };
  const pt = (a) => { const x = Math.cos(a) * O.rx, y = Math.sin(a) * O.ry; return [O.x + x * Math.cos(O.rot) - y * Math.sin(O.rot), O.y + x * Math.sin(O.rot) + y * Math.cos(O.rot)]; };
  g.lineWidth = 1.4;
  for (let i = 0; i < 360; i++) { const a0 = i / 360 * 6.283, a1 = (i + 1) / 360 * 6.283, [x0, y0] = pt(a0), [x1, y1] = pt(a1); const front = Math.sin(a0) > 0; g.strokeStyle = front ? 'rgba(255,214,150,.55)' : 'rgba(190,150,255,.22)'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  const orb = document.getElementById('orb');
  ['pistol', 'ar', 'shotgun', 'ammo', 'scope', 'case'].forEach((k, i) => {
    const a = i / 6 * 6.283 + 0.55, [x, y] = pt(a), front = Math.sin(a), s = 0.78 + 0.32 * (front + 1) / 2;
    const el = document.createElement('div'); el.className = 'ico'; el.innerHTML = window.AA_ICONS[k];
    el.style.left = (x - 52) + 'px'; el.style.top = (y - 26) + 'px';
    el.style.transform = 'scale(' + s.toFixed(3) + ')'; el.style.opacity = (0.55 + 0.45 * (front + 1) / 2).toFixed(3);
    el.style.filter = 'drop-shadow(0 0 ' + (6 + 6 * (front + 1) / 2).toFixed(1) + 'px rgba(199,155,255,.85))';
    orb.appendChild(el);
    glow(x, y, 46, '199,155,255', 0.18);
  });
})();
</script></body></html>`;
// the home-screen icon is the brand's seal, lit in the default realm's colours
const icon = `<!doctype html><html><head><style>body{margin:0;background:#04101d}.seal{position:absolute;left:8px;top:8px;width:164px;height:164px;border-radius:50%;overflow:hidden;isolation:isolate}
.seal img{width:100%;height:100%;display:block}.seal:after{content:'';position:absolute;inset:0;border-radius:50%;mix-blend-mode:multiply;background:linear-gradient(155deg,#ecf9ff 0%,#5de4ff 38%,#5dffb1 100%)}</style></head>
<body><div class="seal"><img src="${u('assets/img/brand/seal-600.png')}"></div></body></html>`;

const b = await chromium.launch();
const dir = mkdtempSync(path.join(tmpdir(), 'aa-card-'));
// the card is drawn at twice its size and brought down, so the schematics and the type stay crisp
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
// a file:// page may load file:// fonts and images; setContent's about:blank may not
const open = async (pg, html) => { const f = path.join(dir, 'p.html'); writeFileSync(f, html); await pg.goto(pathToFileURL(f).href, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready); };
await open(p, card); await p.waitForTimeout(500);
const big = path.join(dir, 'card@2x.png');
await p.screenshot({ path: big });
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', big, '-vf', 'scale=1200:630:flags=lanczos', '-q:v', '2', path.join(ROOT, OUT)]);
if (!process.argv.includes('--card-only')) {
  const q = await b.newPage({ viewport: { width: 180, height: 180 } });
  await open(q, icon); await q.waitForTimeout(200);
  await q.screenshot({ path: path.join(ROOT, 'assets/img/apple-touch-icon.png') });
}
await b.close();
console.log(`wrote ${OUT}` + (process.argv.includes('--card-only') ? '' : ' + assets/img/apple-touch-icon.png'));
