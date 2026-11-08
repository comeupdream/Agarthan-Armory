#!/usr/bin/env node
/*
 * render.mjs — the Agarthan Armory films, rendered frame by frame from the real site.
 *
 *   node tools/trailer/render.mjs                       every film → media/films/
 *   node tools/trailer/render.mjs realm-shift           one film (key or part of one)
 *   STAGE=a  …   film the site only (frames into .trailer-cache/<key>/a/)
 *   STAGE=b  …   re-run the trip pass on frames already filmed
 *   PREVIEW_T=0,4.2,19 …   stills only (JPEGs in .trailer-cache/<key>/preview/)
 *   FROM=12 TO=18 …        a slice of a film, for looking at
 *   FPS=30 CRF=18 OUT=dir  …
 *
 * Two passes, the same shape as EVRITHNG's brand kit (frontend/brandkit/motion-render.cjs):
 * every frame is a function of its time t, so a slow machine costs time and never
 * drops a frame, and the same source renders the same film twice.
 *
 *   Stage A films the SITE: the real pages, in headless Chromium, on a frozen clock
 *   (Playwright's clock). Each frame runs the film's act(t, S) in the page (stage.js:
 *   the drawn cursor, real clicks on the realm / script / cursor settings, scroll,
 *   the UFOs and their abductions), pins every CSS animation and video to t, and
 *   saves a JPEG.
 *
 *   Stage B is the TRIP: lens.html, a WebGL2 shader that takes those frames and puts
 *   the page in space, wipes between realms, warps, trails, mirrors, lenses it round
 *   a black hole and dives through the pole. Its frames are piped into ffmpeg →
 *   H.264 High@4.1, yuv420p, BT.709-tagged, faststart (plays on phones, X, Instagram,
 *   every editor).
 *
 * The store's real product photos never appear: stage.js strips them from the
 * catalog before the page draws, so every card shows its holo schematic.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CACHE = path.join(ROOT, '.trailer-cache');
const OUT = path.resolve(process.env.OUT || path.join(ROOT, 'media', 'films'));
const FPS = Number(process.env.FPS || 30);
const CRF = String(process.env.CRF || 20);
const STAGE = process.env.STAGE || 'ab';
const PREVIEW = process.env.PREVIEW_T ? process.env.PREVIEW_T.split(',').map(Number) : null;
const FROM = process.env.FROM != null ? Number(process.env.FROM) : null;
const TO = process.env.TO != null ? Number(process.env.TO) : null;
const T0 = Date.parse('2026-12-21T22:47:00Z'); // the outpost clock reads polar night, midwinter

/* ---------- a static server for the repo (site + this folder + the frame cache) ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
function serve() {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.join(ROOT, p === '/' ? 'index.html' : p);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.stat(f, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); return res.end(); }
      const head = { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m && (m[1] || m[2])) {
        const s = m[1] ? +m[1] : Math.max(0, st.size - +m[2]);
        const e = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
        res.writeHead(206, { ...head, 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Content-Length': e - s + 1 });
        return fs.createReadStream(f, { start: s, end: e }).pipe(res);
      }
      res.writeHead(200, { ...head, 'Content-Length': st.size });
      fs.createReadStream(f).pipe(res);
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

/* ---------- the films ---------- */
async function loadFilms() {
  const dir = path.join(HERE, 'films');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
  const films = [];
  for (const f of files) films.push((await import(pathToFileURL(path.join(dir, f)))).default);
  return films;
}

function frameList(film) {
  const n = Math.round(film.dur * FPS);
  if (PREVIEW) return PREVIEW.map((t) => Math.min(n - 1, Math.round(t * FPS)));
  const a = FROM != null ? Math.round(FROM * FPS) : 0;
  const b = TO != null ? Math.round(TO * FPS) : n;
  return Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);
}

/* ---------- Stage A: film the site ---------- */
async function stageA(_, base, film, frames) {
  // the site is filmed by a browser on plain CPU raster; forcing software WebGL (which
  // only the trip pass needs) makes every composite of the page several times slower
  const browser = browserA || (browserA = await chromium.launch({ args: ['--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required'] }));
  const dir = path.join(CACHE, film.key, 'a');
  fs.mkdirSync(dir, { recursive: true });
  const [w, h] = film.size || [1920, 1080];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await ctx.addInitScript({ path: path.join(HERE, 'stage.js') });
  // the age gate remembers a visitor for 30 days by the page's clock, which is the film's
  await ctx.addInitScript(([prefs, now]) => {
    // once per film: a page the act navigates to keeps whatever the act chose since
    try { if (!sessionStorage.getItem('__film')) { sessionStorage.setItem('__film', '1'); localStorage.setItem('aa-age-ok', JSON.stringify(now)); localStorage.setItem('aa-prefs', JSON.stringify(prefs)); } } catch {}
  }, [film.prefs || {}, T0]);
  await ctx.clock.install({ time: T0 });
  await ctx.clock.pauseAt(T0 + 1000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`  [${film.key}] page error: ${e.message}`));
  const open = async (url) => {
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__stage.ready());
    await page.addStyleTag({ content: 'html{scroll-behavior:auto!important} ::-webkit-scrollbar{display:none} .reveal{opacity:1!important;transform:none!important}' });
    await page.evaluate((src) => { window.__act = (0, eval)('(' + src + ')'); }, film.act.toString());
  };
  await open(film.url);

  // every frame from 0 is run (an act may set state once and rely on it), but only
  // the requested ones are saved
  const want = new Set(frames);
  const last = Math.max(...frames);
  const stepMs = (k) => Math.round(((k + 1) * 1000) / FPS) - Math.round((k * 1000) / FPS);
  const t0 = Date.now();
  for (let f = 0; f <= last; f++) {
    if (f > 0) await page.clock.runFor(stepMs(f - 1));
    let res = await page.evaluate(([t, dt]) => window.__stage.frame(t, dt), [f / FPS, 1 / FPS]);
    if (res.go) { await open(res.go); res = await page.evaluate(([t, dt]) => window.__stage.frame(t, dt), [f / FPS, 1 / FPS]); }
    if (res.mouse) await page.mouse.move(res.mouse[0], res.mouse[1]);
    if (!want.has(f)) continue;
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    fs.writeFileSync(path.join(dir, `${String(f).padStart(5, '0')}.jpg`), buf);
    if (f % 30 === 0) process.stdout.write(`\r  A ${film.key}  ${(f / FPS).toFixed(1)}s / ${film.dur}s  (${((Date.now() - t0) / (f + 1)).toFixed(0)} ms/frame)   `);
  }
  process.stdout.write('\n');
  await ctx.close();
}

/* ---------- Stage B: the trip ---------- */
async function stageB(browser, base, film, frames) {
  const [w, h] = film.out || [1920, 1080];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`  [${film.key}] lens error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') console.error(`  [${film.key}] lens: ${m.text()}`); });
  const plateUrls = [];
  for (const name of film.plates || []) plateUrls.push(await plate(browser, base, name));
  await page.goto(`${base}/tools/trailer/lens.html?film=${film.key}&w=${w}&h=${h}`);
  await page.evaluate((plates) => window.__lens.init(plates), plateUrls);

  const preview = !!PREVIEW;
  let ff, dirP;
  if (preview) { dirP = path.join(CACHE, film.key, 'preview'); fs.mkdirSync(dirP, { recursive: true }); }
  else {
    fs.mkdirSync(OUT, { recursive: true });
    const name = FROM != null || TO != null ? `${film.key}-slice.mp4` : `${film.key}.mp4`;
    ff = encoder(path.join(OUT, name));
  }
  const t0 = Date.now();
  // feedback trails depend on the previous frame, so B always runs from the slice start
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const t = f / FPS;
    const u = film.lens ? film.lens(t) : {};
    await page.evaluate(([f, t, u, fresh]) => window.__lens.frame(f, t, u, fresh), [f, t, u, preview || i === 0]);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (preview) fs.writeFileSync(path.join(dirP, `${film.key}-${t.toFixed(2)}s.jpg`), buf);
    else if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 30 === 0) process.stdout.write(`\r  B ${film.key}  ${t.toFixed(1)}s / ${film.dur}s  (${((Date.now() - t0) / (i + 1)).toFixed(0)} ms/frame)   `);
  }
  process.stdout.write('\n');
  if (ff) { ff.stdin.end(); await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg ' + c))))); }
  await ctx.close();
}

/* ---------- plates: lockups set in the site's own type, as transparent PNGs ---------- */
async function plate(browser, base, name) {
  const file = path.join(CACHE, 'plates', name + '.png');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const p = await browser.newPage({ viewport: { width: 2400, height: 1400 }, deviceScaleFactor: 1 });
    await p.goto(`${base}/tools/trailer/plates.html#${encodeURIComponent(name)}`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.locator(`#${name.split('@')[0]}`).screenshot({ path: file, omitBackground: true });
    await p.close();
  }
  return `/.trailer-cache/plates/${name}.png`;
}

function encoder(mp4) {
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0',
    '-vf', 'scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-profile:v', 'high', '-level:v', '4.1',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
  return ff;
}

/* ---------- main ---------- */
const only = process.argv.slice(2);
const films = (await loadFilms()).filter((f) => !only.length || only.some((o) => f.key.includes(o)));
if (!films.length) { console.error('no film matches', only.join(' ')); process.exit(2); }
let browserA = null;
const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required'] });
try {
  for (const film of films) {
    const frames = frameList(film);
    console.log(`${film.key}: ${film.title} — ${frames.length} frame(s)`);
    if (STAGE.includes('a')) await stageA(browser, base, film, frames);
    if (STAGE.includes('b')) await stageB(browser, base, film, frames);
  }
} finally {
  await browser.close();
  if (browserA) await browserA.close();
  srv.close();
}
