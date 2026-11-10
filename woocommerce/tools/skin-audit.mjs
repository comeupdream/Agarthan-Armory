// skin-audit.mjs — renders every store page type under Storefront + the
// Agarthan theme, on a desktop and a phone, screenshots each, and checks:
//   - the canvas behind the content is dark (the PAMAX v2.0.0 white-page bug)
//   - no large light surfaces slipped through (Storefront's white tables, boxes…)
//   - text is readable against what it sits on (contrast 3:1 or better)
//   - phones never scroll sideways
//   - the theme's fonts loaded
// Run: node woocommerce/tools/skin-audit.mjs [--out dir] [--only shop,cart]
// Exits non-zero when a check fails.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PAGES } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(arg('out', path.join(ROOT, '.skin-audit')));
const ONLY = arg('only', '') ? new Set(arg('only').split(',')) : null;
fs.mkdirSync(OUT, { recursive: true });

const STOREFRONT = fs.readFileSync(path.join(HERE, 'storefront-base.css'), 'utf8');
const doc = (p) => `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style id="storefront-style">${STOREFRONT}</style>
<link rel="stylesheet" id="agarthan-skin-css" href="/woocommerce/theme/agarthan-armory/style.css">
</head><body class="${p.bodyClass}">${p.html}<script src="/woocommerce/theme/agarthan-armory/assets/js/agarthan.js"></script></body></html>`;

const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html' };
const server = http.createServer((q, w) => {
  const u = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (u.startsWith('/__page/')) {
    const p = PAGES[u.slice(8)];
    if (!p) { w.writeHead(404); return w.end(); }
    w.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return w.end(doc(p));
  }
  const f = path.join(ROOT, path.normalize(u).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { w.writeHead(404); return w.end(); }
  w.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(w);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// runs in the page: returns the problems it finds
const inspect = () => {
  const rgba = (s) => { const m = String(s).match(/[\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const desc = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const firstStop = (img) => {
    // a gradient's first colour — skipping the one-colour gradients that draw HUD brackets
    const grads = img.match(/(linear|radial)-gradient\((?:[^()]|\([^()]*\))*\)/g) || [];
    for (const g of grads) {
      const cols = g.match(/rgba?\([^)]*\)/g) || [];
      if (cols.length >= 2 && cols.every((c) => c === cols[0])) continue;
      if (cols.length) return rgba(cols[0]);
    }
    return null;
  };
  const canvas = rgba(getComputedStyle(document.documentElement).backgroundColor);
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const c = rgba(cs.backgroundColor);
      if (c && c.a > 0.5) return c;
      if (cs.backgroundImage && cs.backgroundImage !== 'none') { const s = firstStop(cs.backgroundImage); if (s) return s; }
    }
    return canvas;
  };
  const problems = [];
  // 1. canvas
  const html = getComputedStyle(document.documentElement);
  if (!/gradient/.test(html.backgroundImage) || lum(canvas) > 0.05) problems.push(`canvas is not the dark gradient (${html.backgroundColor})`);
  for (const sel of ['body', '#page', '.site-content', '#content', '.content-area', '.site-main', 'div.woocommerce']) {
    const el = document.querySelector(sel); if (!el) continue;
    const c = rgba(getComputedStyle(el).backgroundColor);
    if (c && c.a > 0.05) problems.push(`${sel} paints a background (${getComputedStyle(el).backgroundColor}) over the canvas`);
  }
  // 2. light surfaces
  const allowed = (el) => el.closest('img, svg, .aa-cards, option, .select2-hidden-accessible, .screen-reader-text, .woocommerce-store-notice');
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(); if (r.width * r.height < 1500 || allowed(el)) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const c = rgba(cs.backgroundColor);
    if (c && c.a > 0.5 && lum(c) > 0.5) problems.push(`light surface ${desc(el)} (${cs.backgroundColor}, ${Math.round(r.width)}×${Math.round(r.height)})`);
  }
  // 3. text contrast
  const seen = new Set(); let bad = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (el.closest('.screen-reader-text, script, style, noscript, .select2-hidden-accessible, select, option, [hidden], .aa-gate')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const fg = rgba(cs.webkitTextFillColor && !/rgba?\(0, 0, 0, 0\)/.test(cs.webkitTextFillColor) ? cs.webkitTextFillColor : cs.color);
    if (!fg || fg.a < 0.1) continue;                         // gradient-clipped titles paint their own
    const ratio = contrast(fg, bgOf(el));
    if (ratio < 3) { bad++; if (bad <= 12) problems.push(`low contrast ${ratio.toFixed(2)}:1 ${desc(el)} “${t.textContent.trim().slice(0, 40)}” (${cs.color} on ${JSON.stringify(bgOf(el))})`); }
  }
  if (bad > 12) problems.push(`…and ${bad - 12} more low-contrast texts`);
  // 4. sideways scroll
  if (document.documentElement.scrollWidth > window.innerWidth + 1) problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px wide at ${window.innerWidth}px`);
  // 5. fonts
  for (const f of ['900 20px Orbitron', '400 16px "Exo 2"', '400 12px "Share Tech Mono"']) if (!document.fonts.check(f)) problems.push(`font not loaded: ${f}`);
  return problems;
};

const browser = await chromium.launch();
const VIEWPORTS = [['desktop', { viewport: { width: 1366, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]];
let failures = 0;
const lines = [];
for (const [vpName, opts] of VIEWPORTS) {
  const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('aa-age', '1'); } catch (e) { /* */ } document.documentElement.classList.add('aa-age-ok'); });
  const page = await ctx.newPage();
  for (const [key, p] of Object.entries(PAGES)) {
    if (ONLY && !ONLY.has(key)) continue;
    await page.goto(`${BASE}/__page/${key}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const problems = await page.evaluate(inspect);
    await page.screenshot({ path: path.join(OUT, `${key}-${vpName}.png`), fullPage: true });
    failures += problems.length;
    lines.push(`${problems.length ? '✗' : '✓'} ${vpName.padEnd(7)} ${p.label}${problems.length ? '\n      ' + problems.join('\n      ') : ''}`);
  }
  await ctx.close();
}
// the age gate, as a first-time visitor sees it
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/__page/shop`, { waitUntil: 'networkidle' });
  const shown = await page.evaluate(() => getComputedStyle(document.getElementById('aa-gate')).display !== 'none');
  await page.screenshot({ path: path.join(OUT, 'gate-desktop.png') });
  await page.click('[data-aa-gate="yes"]');
  const hidden = await page.evaluate(() => getComputedStyle(document.getElementById('aa-gate')).display === 'none' && localStorage.getItem('aa-age') === '1');
  const ok = shown && hidden;
  if (!ok) failures++;
  lines.push(`${ok ? '✓' : '✗'} desktop age gate shows on the first visit and opens on "I'm 21"`);
  await ctx.close();
}
// the theme's preview image (Appearance → Themes shows it): 1200×900, the shop
if (argv.includes('--theme-shot')) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('aa-age', '1'); } catch (e) { /* */ } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/__page/shop`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ROOT, 'woocommerce/theme/agarthan-armory/screenshot.png') });
  lines.push('✓ theme preview → woocommerce/theme/agarthan-armory/screenshot.png');
  await ctx.close();
}
await browser.close();
server.close();
console.log(lines.join('\n'));
console.log(`\n${failures ? '✗' : '✓'} ${failures} problem(s) · screenshots in ${path.relative(process.cwd(), OUT) || OUT}`);
process.exit(failures ? 1 : 0);
