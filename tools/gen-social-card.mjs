#!/usr/bin/env node
/*
 * gen-social-card.mjs — renders the link preview, assets/img/og-card-trio.jpg (1200×630), and the
 * home-screen icon, assets/img/apple-touch-icon.png (180×180), from the site's own art.
 * Needs Playwright (npx playwright install chromium, or a preinstalled one):
 *   node tools/gen-social-card.mjs
 *
 * The card is three of the site's pictures side by side on a slant, in the Agarthan Crystal realm's
 * colours: the main banner's rifle, THE ATOM MACHINE (the Atomium, switched on: its spheres glowing
 * and arcs jumping between them), and the Antarctica money (the twenty over its own map side and
 * the two). The banner's purple runs along the foot with its logo (the saucer over the pyramid)
 * and the name on one line. Scrapers cache a card by its URL with no way to purge it, so a new
 * card is a new file name: the earlier og-card.png and og-card-atom.jpg stay for the posts already
 * out there.
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
const OUT = 'assets/img/og-card-trio.jpg';
const LOGO = u('assets/img/brand/banner-logo.png'), ATOM = u('assets/img/feature/realm/crystal/atomium-1920.webp');

const card = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Mono;src:url('${u('assets/fonts/share-tech-mono-latin-400-normal.woff2')}')}
@font-face{font-family:Chakra;src:url('${u('assets/fonts/chakra-petch-latin-400-normal.woff2')}')}
@font-face{font-family:Chakra;font-weight:600;src:url('${u('assets/fonts/chakra-petch-latin-600-normal.woff2')}')}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0b0614}
.c{position:relative;width:1200px;height:630px;overflow:hidden;background:#0d0618}
.abs{position:absolute}
/* the three panels lean the same way, a thin strip of night between them */
.pan{position:absolute;inset:0;overflow:hidden}
.p1{clip-path:polygon(0 0,452px 0,352px 630px,0 630px);background:#b5800a}
.p2{clip-path:polygon(464px 0,846px 0,746px 630px,364px 630px);background:#1a0c10}
.p3{clip-path:polygon(858px 0,1200px 0,1200px 630px,758px 630px);background:radial-gradient(70% 60% at 62% 36%,#6a48a8 0%,#3a2168 60%,#22113f 100%)}
canvas{position:absolute;left:0;top:0;width:1200px;height:630px}
.sp{position:absolute;background-repeat:no-repeat}
.bill{box-shadow:0 18px 40px rgba(6,2,16,.6),0 2px 6px rgba(6,2,16,.5);border-radius:3px}
/* the banner's purple along the foot */
.band{position:absolute;left:0;right:0;bottom:0;height:176px;background:linear-gradient(180deg,rgba(94,62,146,0) 0,rgba(94,62,146,.94) 26%,#5e3e92 100%)}
.grain{position:absolute;inset:0;opacity:.07;background-image:radial-gradient(rgba(255,255,255,.6) .6px,transparent .7px);background-size:3px 3px;mix-blend-mode:overlay}
.tag{position:absolute;left:188px;top:580px;font:15px Mono;letter-spacing:.2em;color:#ffd27a;text-transform:uppercase}
.url{position:absolute;right:56px;top:532px;font:600 17px Chakra;letter-spacing:.14em;color:#f1e7d2;text-transform:uppercase}
</style></head><body><div class="c">
<div class="pan p1"><img src="${u('assets/img/feature/realm/crystal/manifesto-2400.webp')}" style="position:absolute;left:-36px;top:-40px;height:600px;width:auto"></div>
<div class="pan p2"><img src="${ATOM}" style="position:absolute;left:228px;top:-38px;width:760px;filter:saturate(1.12) contrast(1.06)"><canvas id="fx" width="2400" height="1260"></canvas></div>
<div class="pan p3">
  <div class="sp bill" data-p="b20" data-w="400" style="left:842px;top:14px;transform:rotate(7deg)"></div>
  <div class="sp bill" data-p="f2" data-w="390" style="left:792px;top:262px;transform:rotate(-8deg)"></div>
  <div class="sp bill" data-p="f20" data-w="440" style="left:800px;top:118px;transform:rotate(-3deg)"></div>
</div>
<div class="band"></div>
<div class="grain"></div>
<div class="sp" data-p="emblem" data-w="104" style="left:60px;top:504px"></div>
<div class="sp" data-p="agarthan" data-w="338" style="left:186px;top:516px"></div>
<div class="sp" data-p="armory" data-w="266" style="left:542px;top:516px"></div>
<div class="tag">Arms, ammunition &amp; FFL transfers from beyond the ice wall</div>
<div class="url">agarthanarmory.com</div>
</div><script>
(() => {
  // a piece of a picture, drawn at a given width: [picture, the piece (x, y, w, h), the picture's size]
  const PIECES = {
    emblem: ['${LOGO}', [479, 16, 282, 270], [1201, 705]], agarthan: ['${LOGO}', [13, 312, 1176, 174], [1201, 705]], armory: ['${LOGO}', [158, 511, 925, 174], [1201, 705]],
    f20: ['${u('assets/img/feature/realm/crystal/antarctica-20-front.webp')}', [0, 0, 792, 386], [792, 386]],
    b20: ['${u('assets/img/feature/realm/crystal/antarctica-20-both.webp')}', [12, 412, 768, 366], [792, 792]],
    f2: ['${u('assets/img/feature/realm/crystal/antarctica-dollars-750.webp')}', [2, 0, 747, 370], [750, 750]],
  };
  document.querySelectorAll('[data-p]').forEach((el) => {
    const [src, [sx, sy, sw, sh], [fw, fh]] = PIECES[el.dataset.p], k = Number(el.dataset.w) / sw;
    el.style.width = sw * k + 'px'; el.style.height = sh * k + 'px'; el.style.backgroundImage = 'url(' + src + ')';
    el.style.backgroundSize = fw * k + 'px ' + fh * k + 'px'; el.style.backgroundPosition = (-sx * k) + 'px ' + (-sy * k) + 'px';
  });
  // the machine switched on. The photo's spheres on the card (the 1920 copy drawn 760 wide, from 228, -38)
  const S = 760 / 1920, K = S / 0.5, at = (x, y, r) => [228 + x * S, -38 + y * S, r * S];
  const P = { TL: at(332, 365, 172), TC: at(962, 430, 255), TR: at(1587, 370, 172), BL: at(427, 1135, 150), BR: at(1485, 1135, 150), C: at(960, 790, 120) };
  const cv = document.getElementById('fx'), g = cv.getContext('2d');
  g.scale(2, 2);
  const fr = (x) => x - Math.floor(x), hash = (n) => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const glow = (x, y, r, rgb, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(0.3, 'rgba(' + rgb + ',' + a * 0.5 + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); };
  g.globalCompositeOperation = 'lighter';
  // the heart behind the tower, and every sphere lit
  glow(P.C[0], P.C[1], 190 * K, '255,180,90', 0.55);
  for (const k of ['TL', 'TC', 'TR', 'BL', 'BR']) {
    const [x, y, r] = P[k];
    glow(x, y, r * 1.9, '255,190,110', 0.42); glow(x, y, r * 2.6, '170,120,255', 0.26);
    for (let j = 0; j < 30; j++) { const a = hash(k.length * 31 + j + x) * 6.283, rr = r * 0.9 * Math.sqrt(hash(j * 7 + y)); glow(x + Math.cos(a) * rr, y + Math.sin(a) * rr, (3 + 4 * hash(j + x)) * K, '255,250,240', 0.9); }
  }
  // energy down the tubes
  const B = [['TL', 'TC'], ['TC', 'TR'], ['TL', 'BL'], ['TR', 'BR'], ['TL', 'C'], ['TR', 'C'], ['BL', 'C'], ['BR', 'C'], ['TC', 'C']];
  B.forEach(([a, b], i) => { for (let q = 0; q < 3; q++) { const p = fr(i * 0.37 + q / 3); glow(P[b][0] + (P[a][0] - P[b][0]) * p, P[b][1] + (P[a][1] - P[b][1]) * p, 16 * K, '255,200,120', 0.8 * Math.sin(Math.PI * p)); } });
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
    stroke(main, K);
    [0.38, 0.66].forEach((q, k) => {
      const o = main[Math.floor(main.length * q)], fa = Math.atan2(dy, dx) + (k ? -0.7 : 0.75), fl = d * (0.16 + 0.08 * hash(seed + 3 + k));
      stroke(path(o[0], o[1], o[0] + Math.cos(fa) * fl, o[1] + Math.sin(fa) * fl, seed * 7 + k, 0.7), 0.5 * K);
    });
  };
  bolt(P.TL, P.TC, 3); bolt(P.TC, P.TR, 11); bolt(P.BL, P.C, 41);
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
