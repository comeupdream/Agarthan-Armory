#!/usr/bin/env node
/*
 * gen-social-card.mjs — renders assets/img/og-card.png (1200×630 link
 * preview) and assets/img/apple-touch-icon.png (180×180) from the site's own
 * art. Needs Playwright (npx playwright install chromium, or a preinstalled
 * one):  node tools/gen-social-card.mjs
 */
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const u = (p) => pathToFileURL(path.join(ROOT, p)).href;

const card = `<!doctype html><html><head><style>
@font-face{font-family:Cinzel;font-weight:800;src:url('${u('assets/fonts/cinzel-latin-800-normal.woff2')}')}
@font-face{font-family:Mono;src:url('${u('assets/fonts/share-tech-mono-latin-400-normal.woff2')}')}
@font-face{font-family:Chakra;src:url('${u('assets/fonts/chakra-petch-latin-400-normal.woff2')}')}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#03060c}
.c{position:relative;width:1200px;height:630px;background:radial-gradient(90% 80% at 50% 0%,#123a5c 0%,#071426 50%,#02050b 100%)}
.aur{position:absolute;inset:0;background:radial-gradient(60% 22% at 30% 22%,rgba(93,255,177,.35),transparent 70%),radial-gradient(50% 18% at 72% 16%,rgba(169,139,255,.35),transparent 70%),radial-gradient(70% 20% at 55% 30%,rgba(93,228,255,.22),transparent 70%);filter:blur(8px)}
img{position:absolute;left:0;bottom:0;width:1200px;height:auto}
.t{position:absolute;left:0;right:0;top:150px;text-align:center}
.seal{position:absolute;left:540px;top:22px;width:120px;height:120px;border-radius:50%;overflow:hidden;isolation:isolate;filter:drop-shadow(0 0 18px rgba(93,228,255,.55))}
.seal img{position:static;width:100%;height:100%;display:block}
.seal:after{content:'';position:absolute;inset:0;border-radius:50%;mix-blend-mode:multiply;background:linear-gradient(155deg,#ecf9ff 0%,#5de4ff 38%,#5dffb1 100%)}
.e{font:15px Mono;letter-spacing:.34em;color:#5de4ff;text-transform:uppercase}
h1{margin:12px 0 0;font:800 90px/0.95 Cinzel;letter-spacing:.08em;background:linear-gradient(180deg,#fff,#cdf2ff 50%,#7fd6f5);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0 24px rgba(93,228,255,.4))}
h1 span{display:block;font-size:45px;letter-spacing:.5em;margin-top:10px;padding-left:.5em}
p{font:21px Chakra;color:#b8d4e6;margin:16px 0 0}
</style></head><body><div class="c"><div class="aur"></div><img src="${u('assets/img/ice-wall.svg')}">
<div class="seal"><img src="${u('assets/img/brand/seal-600.png')}"></div>
<div class="t"><div class="e">Federally licensed firearms dealer</div><h1>Agarthan<span>Armory</span></h1><p>Arms, ammunition &amp; FFL transfers from beyond the ice wall</p></div></div></body></html>`;
// the home-screen icon is the brand's seal, lit in the default realm's colours
const icon = `<!doctype html><html><head><style>body{margin:0;background:#04101d}.seal{position:absolute;left:8px;top:8px;width:164px;height:164px;border-radius:50%;overflow:hidden;isolation:isolate}
.seal img{width:100%;height:100%;display:block}.seal:after{content:'';position:absolute;inset:0;border-radius:50%;mix-blend-mode:multiply;background:linear-gradient(155deg,#ecf9ff 0%,#5de4ff 38%,#5dffb1 100%)}</style></head>
<body><div class="seal"><img src="${u('assets/img/brand/seal-600.png')}"></div></body></html>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
// a file:// page may load file:// fonts and images; setContent's about:blank may not
const dir = mkdtempSync(path.join(tmpdir(), 'aa-card-'));
const open = async (html) => { const f = path.join(dir, 'p.html'); writeFileSync(f, html); await p.goto(pathToFileURL(f).href, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); };
await open(card); await p.waitForTimeout(400);
await p.screenshot({ path: path.join(ROOT, 'assets/img/og-card.png') });
await p.setViewportSize({ width: 180, height: 180 });
await open(icon); await p.waitForTimeout(200);
await p.screenshot({ path: path.join(ROOT, 'assets/img/apple-touch-icon.png') });
await b.close();
console.log('wrote assets/img/og-card.png + apple-touch-icon.png');
