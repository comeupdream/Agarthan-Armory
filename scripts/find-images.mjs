#!/usr/bin/env node
/* =============================================================================
 * find-images.mjs — find product photos on the web by brand + name + UPC.
 *
 * For every product without a photo it runs an image search through the
 * Brave Search API (an official search API; Google's equivalent is closed to
 * new customers and ends 2027-01-01), scores the results, downloads the best
 * one and saves it as the product's photo:
 *   +   the manufacturer's own site (e.g. hornady.com for Hornady) — the
 *       cleanest packshots, and the right item
 *   +   result title mentions the UPC or the product's name words
 *   +   larger images
 *   −   marketplaces, tiny images, logos/banners
 * If the best image won't download, the next one is tried.
 *
 * Writes assets/img/products/<id>-1.jpg, records where each photo came from
 * (photoSource: image + page) in the scraped catalog, and a contact sheet to
 * check by eye before publishing: assets/data/scraped/photo-review.html
 * (open it in a browser; it is never served by the site). Products with no
 * acceptable result are marked and skipped next run (--retry to search again).
 *
 * SETUP: a Brave Search API key — sign up at api-dashboard.search.brave.com,
 * add a card, subscribe to the Search plan, then API Keys → Add. Billed per
 * search (about $5 per 1,000, with a $5 monthly credit, so ~1,000 free a
 * month); the whole shop is roughly 3,000–5,000 searches. Keep the key out
 * of the repo — set it for the terminal session only:
 *   PowerShell:  $env:BRAVE_API_KEY="…"      macOS/Linux:  export BRAVE_API_KEY=…
 *
 * USAGE  node scripts/find-images.mjs --limit 20          (try 20 first, then check the review page)
 *        node scripts/find-images.mjs --budget 6000       (the rest; ~1–2 searches per product)
 *   --budget N     max searches this run (default 300) — the API bills per search
 *   --limit N      max products this run
 *   --rps N        searches per second (default 1, the basic plan's limit)
 *   --size 1000    resize longest side (needs `npm i sharp`; otherwise saved as-is)
 *   --retry        search again for products marked "none" earlier
 *   --dry-run      search and score, download nothing
 * ===========================================================================*/
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { upcOf, isImage, extOf } from './match-images.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.lastIndexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = (n) => argv.includes('--' + n);
const num = (n, d, min) => { const v = Number(arg(n, String(d))); return Number.isFinite(v) && v >= min ? v : d; };

/* the brand's own site, where we know it; otherwise any host containing the brand's first word */
const BRAND_SITES = {
  'winchester ammunition': 'winchester.com', winchester: 'winchester.com', federal: 'federalpremium.com', hornady: 'hornady.com',
  trijicon: 'trijicon.com', remington: 'remington.com', warne: 'warnescopemounts.com', burris: 'burrisoptics.com',
  'fiocchi ammunition': 'fiocchiusa.com', weaver: 'weaveroptics.com', ppu: 'ppu-usa.com', barnes: 'barnesbullets.com',
  cci: 'cci-ammunition.com', eotech: 'eotechinc.com', 'aguila ammunition': 'aguilaammo.com', 'sellier & bellot': 'sellier-bellot.cz',
  bushnell: 'bushnell.com', reptilia: 'reptiliacorp.com', nosler: 'nosler.com', 'riton optics': 'ritonoptics.com', weatherby: 'weatherby.com',
  'talley manufacturing': 'talleymanufacturing.com', viridian: 'viridianweapontech.com', speer: 'speer.com', atn: 'atncorp.com', ruger: 'ruger.com',
  truglo: 'truglo.com', 'ammo inc': 'ammoinc.com', 'primary arms': 'primaryarms.com', 'hevi-shot': 'hevishot.com', 'unity tactical': 'unitytactical.com',
  corbon: 'corbon.com', armscor: 'armscor.com', 'midwest industries': 'midwestindustriesinc.com', steiner: 'steiner-optics.com',
  'badger ordnance': 'badgerordnance.com', magtech: 'magtechammunition.com', hsm: 'hsmammunition.com', 'calculated kinetics': 'calculatedkinetics.com',
  ncstar: 'ncstar.com', pmc: 'pmcammo.com', 'seekins precision': 'seekinsprecision.com', 'agm global vision': 'agmglobalvision.com',
  'berger bullets': 'bergerbullets.com', sightmark: 'sightmark.com', leapers: 'leapers.com', norma: 'norma-ammunition.com', nocpix: 'nocpix.com',
  athlon: 'athlonoptics.com', simmons: 'simmonsoptics.com', meprolight: 'meprolight.com', 'xs sights': 'xssights.com', magpul: 'magpul.com',
  pulsar: 'pulsarnv.com', 'geissele automatics': 'geissele.com', browning: 'browning.com', 'heckler & koch': 'hk-usa.com', 'sig sauer': 'sigsauer.com',
  holosun: 'holosun.com', vortex: 'vortexoptics.com', leupold: 'leupold.com', aimpoint: 'aimpoint.us', nightforce: 'nightforceoptics.com',
  swampfox: 'swampfoxoptics.com', 'ops-core': 'gentexcorp.com', 'team wendy': 'teamwendy.com', l3harris: 'l3harris.com',
};
const MARKETPLACES = /(^|\.)(amazon|ebay|walmart|gunbroker|pinterest|facebook|instagram|reddit|alibaba|aliexpress|etsy|temu|wish)\./i;
const JUNK = /logo|banner|icon|sprite|placeholder|avatar|favicon|thumb_?nail_?small/i;

export function scoreResult(r, p, upc) {
  const host = String(r.host || '').toLowerCase();
  const brand = String(p.brand || '').toLowerCase();
  const site = BRAND_SITES[brand];
  const first = brand.split(/[^a-z0-9]+/).find((w) => w.length >= 4);
  let s = 0;
  if ((site && host.endsWith(site)) || (first && host.replace(/[^a-z0-9.]/g, '').includes(first))) s += 6;
  if (MARKETPLACES.test(host)) s -= 3;
  const title = String(r.title || '').toLowerCase();
  if (upc && title.replace(/\D/g, '').includes(upc)) s += 4;
  const words = String(p.name || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  s += Math.min(3, words.filter((w) => title.includes(w)).length);
  if (first && title.includes(first)) s += 1;
  const w = r.width || 0, h = r.height || 0;
  if (w && h) { if (Math.min(w, h) < 250) s -= 6; else if (Math.max(w, h) >= 800) s += 1; }
  if (JUNK.test(r.image)) s -= 5;
  if (/gearfire\.com/i.test(r.image)) s -= 20;               // its image server refuses downloads
  return s;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const KEY = process.env.BRAVE_API_KEY;
  const API = process.env.BRAVE_API_BASE || 'https://api.search.brave.com';
  if (!KEY) { console.error('✗ set BRAVE_API_KEY first (PowerShell: $env:BRAVE_API_KEY="…") — see the header of this file'); process.exit(1); }
  const BUDGET = num('budget', 300, 1), LIMIT = num('limit', 0, 0), RPS = num('rps', 1, 0.1), SIZE = num('size', 1000, 200);
  const RETRY = flag('retry'), DRY = flag('dry-run');
  const CAT_DIR = path.resolve(arg('catalog-dir', 'assets/data/scraped'));
  const IMG_DIR = path.resolve(arg('img-dir', 'assets/img/products'));
  const IMG_REL = path.relative(process.cwd(), IMG_DIR).split(path.sep).join('/');
  let sharp = null; try { sharp = (await import('sharp')).default; } catch { /* optional */ }

  const files = [path.join(CAT_DIR, 'catalog.json')];
  try { for (const e of await readdir(CAT_DIR, { withFileTypes: true })) if (e.isDirectory()) files.push(path.join(CAT_DIR, e.name, 'catalog.json')); } catch { /* none */ }
  const cats = [];
  for (const f of files) { try { cats.push({ f, list: JSON.parse(await readFile(f, 'utf8')) }); } catch { /* missing */ } }
  const todo = cats.flatMap((c) => c.list).filter((p) => !(p.localImages || []).length && (RETRY || !(p.photoSearch && p.photoSearch.result === 'none')));
  const work = LIMIT ? todo.slice(0, LIMIT) : todo;
  console.log(`→ ${work.length} products to find photos for (budget ${BUDGET} searches${sharp ? `, resizing to ${SIZE}px` : ', sharp not installed: saving as-is'})`);

  let calls = 0, found = 0, none = 0, last = 0;
  const search = async (q) => {
    const wait = 1000 / RPS - (Date.now() - last); if (wait > 0) await sleep(wait);
    last = Date.now(); calls++;
    const r = await fetch(`${API}/res/v1/images/search?q=${encodeURIComponent(q)}&count=20&safesearch=off`, { headers: { 'X-Subscription-Token': KEY, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error(`the API refused the key (HTTP ${r.status})`), { fatal: true });
    if (r.status === 429) { await sleep(2000); return []; }
    if (!r.ok) return [];
    const j = await r.json();
    return (j.results || []).map((x) => ({
      image: (x.properties && x.properties.url) || (x.thumbnail && (x.thumbnail.original || x.thumbnail.src)),
      page: x.url, title: x.title || '',
      host: (x.meta_url && (x.meta_url.hostname || x.meta_url.netloc)) || x.source || (() => { try { return new URL(x.url).hostname; } catch { return ''; } })(),
      width: (x.properties && x.properties.width) || 0, height: (x.properties && x.properties.height) || 0,
    })).filter((x) => x.image);
  };
  const download = async (url) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'AgarthanArmory-catalog/1.0', Accept: 'image/*' }, signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length > 15e6 || !isImage(b)) throw new Error('not a usable image');
      return b;
    } finally { clearTimeout(t); }
  };

  await mkdir(IMG_DIR, { recursive: true });
  try {
    for (const p of work) {
      if (calls >= BUDGET) { console.log(`  budget of ${BUDGET} searches reached — run again to continue`); break; }
      const upc = upcOf(p);
      const queries = [[p.brand, p.name, upc].filter(Boolean).join(' '), upc ? `${p.brand || ''} ${upc}`.trim() : null].filter(Boolean);
      let chosen = null;
      for (const q of queries) {
        if (calls >= BUDGET) break;
        const ranked = (await search(q)).map((r) => ({ ...r, score: scoreResult(r, p, upc) })).filter((r) => r.score >= 2).sort((a, b) => b.score - a.score);
        for (const r of ranked.slice(0, 5)) {
          if (DRY) { chosen = { r }; break; }
          try {
            let b = await download(r.image); let ext = extOf(b);
            if (sharp) { b = await sharp(b).rotate().flatten({ background: '#ffffff' }).resize({ width: SIZE, height: SIZE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer(); ext = '.jpg'; }
            const name = `${p.id}-1${ext}`;
            await writeFile(path.join(IMG_DIR, name), b);
            chosen = { r, file: `${IMG_REL}/${name}` };
            break;
          } catch { /* try the next result */ }
        }
        if (chosen) break;
      }
      if (chosen) {
        found++;
        if (!DRY) { p.localImages = [chosen.file]; p.photoSource = { image: chosen.r.image, page: chosen.r.page, score: chosen.r.score }; }
        p.photoSearch = { at: new Date().toISOString(), result: 'found' };
      } else { none++; p.photoSearch = { at: new Date().toISOString(), result: 'none' }; }
      if ((found + none) % 25 === 0) console.log(`    ${found + none}/${work.length} · ${found} found · ${calls} searches`);
    }
  } catch (e) {
    console.error('✗ ' + e.message); if (!e.fatal) console.error(e.stack);
  }
  for (const c of cats) await writeFile(c.f, JSON.stringify(c.list, null, 2) + '\n');

  // contact sheet for checking by eye
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const withSrc = cats.flatMap((c) => c.list).filter((p) => p.photoSource && (p.localImages || []).length);
  const rel = path.relative(CAT_DIR, process.cwd()).split(path.sep).join('/') || '.';
  await writeFile(path.join(CAT_DIR, 'photo-review.html'), `<!doctype html><meta charset="utf-8"><title>Photo review — ${withSrc.length} products</title>
<style>body{font:14px system-ui;margin:20px;background:#f4f4f4}h1{font-size:18px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.c{background:#fff;padding:10px;border:1px solid #ddd}.c img{width:100%;height:180px;object-fit:contain}.n{font-weight:600;margin:6px 0 2px}.m{color:#666;font-size:12px;word-break:break-all}.lo{outline:3px solid #f0a}</style>
<h1>Photo review — ${withSrc.length} products found online. Pink outline = weaker match; check those first.</h1><div class="g">${withSrc.map((p) =>
    `<div class="c${p.photoSource.score < 6 ? ' lo' : ''}"><img src="${esc(rel + '/' + p.localImages[0])}" loading="lazy" alt=""><div class="n">${esc(p.brand)} — ${esc(p.name)}</div><div class="m">UPC ${esc(upcOf(p) || '—')} · <a href="${esc(p.photoSource.page)}" target="_blank">${esc((() => { try { return new URL(p.photoSource.page).hostname; } catch { return 'source'; } })())}</a> · score ${p.photoSource.score}</div></div>`).join('')}</div>`);

  console.log(`\n✓ ${found} photos found, ${none} not found, ${calls} searches used`);
  console.log(`  check: ${path.relative(process.cwd(), path.join(CAT_DIR, 'photo-review.html'))} (open in a browser)`);
  console.log('  then: npm run build:catalog');
}
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main();
