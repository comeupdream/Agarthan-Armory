#!/usr/bin/env node
/*
 * build-wall.mjs — draws assets/img/ice-wall.svg, the hero's horizon: the
 * lands and spire glowing beyond, the wall itself (a sheer ice cliff with a
 * lit fissure — "the gate"), the polar sea and its floes. Deterministic
 * (seeded), zero dependencies:  node tools/build-wall.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let seed = 1947;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const r1 = (n) => Math.round(n * 10) / 10;
const W = 1600, H = 516, SEA = 432, GX = 800;

// wall top: higher toward the edges (the wall curving round toward you)
const topAt = (x) => 214 - 64 * Math.pow((x - GX) / GX, 2);
const top = [];
for (let x = -10; x <= W + 10; x += 10 + rnd() * 10) {
  let y = topAt(x) + (rnd() - 0.5) * 7;
  if (rnd() < 0.07) y += 6 + rnd() * 8;             // the odd notch
  top.push([r1(x), r1(y)]);
}
const wallPath = `M${top.map((p) => p.join(' ')).join('L')}L${W + 10} ${SEA}L-10 ${SEA}Z`;
const topLine = `M${top.map((p) => p.join(' ')).join('L')}`;
const yTop = (x) => { for (let i = 1; i < top.length; i++) if (top[i][0] >= x) { const [x0, y0] = top[i - 1], [x1, y1] = top[i]; return y0 + (y1 - y0) * ((x - x0) / (x1 - x0)); } return topAt(x); };

// crevasses
let crevL = '', crevD = '';
for (let x = 0; x < W; x += 5 + rnd() * 22) {
  if (Math.abs(x - GX) < 26) continue;
  const y0 = yTop(x) + 2 + rnd() * 24, y1 = SEA - rnd() * 90, lean = (rnd() - 0.5) * 8;
  const seg = `M${r1(x)} ${r1(y0)}L${r1(x + lean * 0.5)} ${r1((y0 + y1) / 2)}L${r1(x + lean)} ${r1(y1)}`;
  if (rnd() < 0.55) crevD += seg; else crevL += seg;
}
// strata
let strata = '';
for (let i = 0; i < 6; i++) {
  const y = 250 + i * 30 + rnd() * 10;
  let d = `M-10 ${r1(y)}`;
  for (let x = 0; x <= W + 10; x += 80) d += `Q${x + 40} ${r1(y + (rnd() - 0.5) * 8)} ${x + 80} ${r1(y + (rnd() - 0.5) * 4)}`;
  strata += d;
}
// mountains beyond the wall
let mtn = `M-10 230`;
for (let x = -10; x <= W + 10;) {
  const peak = Math.abs(x - GX) < 160 ? 120 + rnd() * 30 : 140 + rnd() * 50;
  const w = 40 + rnd() * 70;
  mtn += `L${r1(x + w / 2)} ${r1(peak)}L${r1(x + w)} ${r1(185 + rnd() * 25)}`;
  x += w;
}
mtn += `L${W + 10} 240Z`;
// the gate fissure
const gL = [], gR = [];
for (let y = yTop(GX) + 1, i = 0; y <= SEA; y += 14, i++) {
  const k = (y - yTop(GX)) / (SEA - yTop(GX));
  gL.push([r1(GX - 2.5 - k * 12 - rnd() * 3), r1(y)]);
  gR.push([r1(GX + 2.5 + k * 12 + rnd() * 3), r1(y)]);
}
const gate = `M${gL.map((p) => p.join(' ')).join('L')}L${gR.reverse().map((p) => p.join(' ')).join('L')}Z`;
// sea shimmer
let shimmer = '';
for (let i = 0; i < 90; i++) {
  const y = SEA + 6 + Math.pow(rnd(), 0.8) * (H - SEA - 8), x = rnd() * W, l = 8 + rnd() * 40 * ((y - SEA) / (H - SEA) + 0.3);
  shimmer += `<path d="M${r1(x)} ${r1(y)}h${r1(l)}" stroke-opacity="${(0.08 + rnd() * 0.25).toFixed(2)}"/>`;
}
let reflect = '';
for (let y = SEA + 4; y < H; y += 5 + rnd() * 4) {
  const w = 10 + rnd() * 26 + (y - SEA) * 0.12;
  reflect += `<path d="M${r1(GX - w / 2 + (rnd() - 0.5) * 10)} ${r1(y)}h${r1(w)}" stroke-opacity="${(0.25 + 0.5 * (1 - (y - SEA) / (H - SEA))).toFixed(2)}"/>`;
}
// floes
let floes = '';
const spots = [[180, 450, 0.7], [420, 470, 0.95], [610, 444, 0.55], [1010, 446, 0.6], [1220, 466, 0.9], [1450, 452, 0.7], [70, 494, 1.3], [1520, 496, 1.35], [330, 502, 1.05], [1290, 503, 1.1]];
for (const [cx, cy, s] of spots) {
  const w = (60 + rnd() * 50) * s, h = (7 + rnd() * 4) * s, d = (6 + rnd() * 5) * s;
  const pts = [[-w / 2, 0], [-w * 0.32, -h], [w * 0.1, -h * 1.2], [w * 0.42, -h * 0.7], [w / 2, 0]];
  const topP = pts.map(([x, y]) => `${r1(cx + x)} ${r1(cy + y)}`).join('L');
  floes += `<path d="M${r1(cx - w / 2)} ${r1(cy)}L${r1(cx + w / 2)} ${r1(cy)}L${r1(cx + w * 0.46)} ${r1(cy + d)}L${r1(cx - w * 0.44)} ${r1(cy + d)}Z" fill="#2f6f99"/>`;
  floes += `<path d="M${topP}Z" fill="url(#floeTop)"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" role="img" aria-label="The ice wall at night, with light shining through a gate in the ice">
<style>
  .gg{animation:g 6s ease-in-out infinite;transform-origin:${GX}px 320px}
  @keyframes g{0%,100%{opacity:.7}50%{opacity:1}}
  .tip{animation:b 3.2s ease-in-out infinite}
  @keyframes b{0%,100%{opacity:.35}50%{opacity:1}}
  @media (prefers-reduced-motion:reduce){.gg,.tip{animation:none}}
</style>
<defs>
  <radialGradient id="beyond" cx="50%" cy="100%" r="60%"><stop offset="0" stop-color="#5dffb1" stop-opacity=".28"/><stop offset=".45" stop-color="#5de4ff" stop-opacity=".1"/><stop offset="1" stop-color="#5de4ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3478" stop-opacity=".75"/><stop offset="1" stop-color="#0d1630" stop-opacity=".9"/></linearGradient>
  <linearGradient id="spire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaffff"/><stop offset=".4" stop-color="#7fd6f5"/><stop offset="1" stop-color="#1b3c66"/></linearGradient>
  <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f4fdff"/><stop offset=".08" stop-color="#b9e6f7"/><stop offset=".3" stop-color="#5aa3cc"/>
    <stop offset=".65" stop-color="#1a4670"/><stop offset="1" stop-color="#0a1d33"/>
  </linearGradient>
  <linearGradient id="side" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#02070e" stop-opacity=".78"/><stop offset=".32" stop-color="#02070e" stop-opacity=".18"/>
    <stop offset=".5" stop-color="#02070e" stop-opacity="0"/><stop offset=".68" stop-color="#02070e" stop-opacity=".18"/><stop offset="1" stop-color="#02070e" stop-opacity=".78"/>
  </linearGradient>
  <radialGradient id="gateGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e6ffff" stop-opacity=".95"/><stop offset=".25" stop-color="#8ff0ff" stop-opacity=".5"/><stop offset="1" stop-color="#5de4ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c2a46"/><stop offset="1" stop-color="#02060c"/></linearGradient>
  <linearGradient id="floeTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2fcff"/><stop offset="1" stop-color="#a9d9ef"/></linearGradient>
  <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfefff" stop-opacity="0"/><stop offset="1" stop-color="#cfefff" stop-opacity=".16"/></linearGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
  <clipPath id="wallClip"><path d="${wallPath}"/></clipPath>
</defs>
<ellipse cx="${GX}" cy="240" rx="620" ry="190" fill="url(#beyond)"/>
<path d="${mtn}" fill="url(#mtn)" stroke="#a98bff" stroke-opacity=".25"/>
<path d="M${GX - 7} 222L${GX} 74L${GX + 7} 222Z" fill="url(#spire)" opacity=".9"/>
<path d="M${GX - 44} 222L${GX - 34} 150L${GX - 24} 222Z M${GX + 24} 222L${GX + 34} 160L${GX + 44} 222Z" fill="url(#spire)" opacity=".55"/>
<circle class="tip" cx="${GX}" cy="76" r="9" fill="#bff6ff" filter="url(#soft)"/>
<circle cx="${GX}" cy="76" r="2.2" fill="#ffffff"/>
<path d="${wallPath}" fill="url(#face)"/>
<g clip-path="url(#wallClip)">
  <path d="${strata}" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="2"/>
  <path d="${crevD}" fill="none" stroke="#04101e" stroke-opacity=".38" stroke-width="1.6"/>
  <path d="${crevL}" fill="none" stroke="#ffffff" stroke-opacity=".2" stroke-width="1"/>
  <rect x="-10" y="0" width="${W + 20}" height="${SEA}" fill="url(#side)"/>
  <rect x="-10" y="370" width="${W + 20}" height="${SEA - 370}" fill="url(#mist)"/>
  <ellipse class="gg" cx="${GX}" cy="330" rx="120" ry="230" fill="url(#gateGlow)"/>
</g>
<path d="${topLine}" fill="none" stroke="#ffffff" stroke-opacity=".9" stroke-width="1.4"/>
<path d="${topLine}" fill="none" stroke="#5de4ff" stroke-opacity=".5" stroke-width="5" filter="url(#soft)"/>
<path d="${gate}" fill="#effeff"/>
<path d="${gate}" fill="#9ff3ff" filter="url(#soft)" opacity=".9"/>
<rect x="0" y="${SEA}" width="${W}" height="${H - SEA}" fill="url(#sea)"/>
<g stroke="#7fe3ff" stroke-width="1.4" stroke-linecap="round">${shimmer}</g>
<g stroke="#dffcff" stroke-width="2" stroke-linecap="round">${reflect}</g>
<path d="M0 ${SEA}H${W}" stroke="#bff0ff" stroke-opacity=".35"/>
${floes}
</svg>
`;
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'img', 'ice-wall.svg');
fs.writeFileSync(out, svg);
console.log('wrote', out, (svg.length / 1024).toFixed(1) + ' KB');
