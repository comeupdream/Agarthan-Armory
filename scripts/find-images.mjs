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
 * USAGE  node scripts/find-images.mjs --top 20            (try 20 first, then check the review page)
 *        node scripts/find-images.mjs --top 1500 --budget 2500   (the products worth a photo most)
 *        node scripts/find-images.mjs --cover            (only what shoppers see first — below)
 *        node scripts/find-images.mjs --budget 6000       (the rest; ~1–2 searches per product)
 *   --top N        the N product lines most worth a photo: first the cards on a first page
 *                  that still show a hologram, then the rest by the Armory's merit rank
 *                  (premium for its category, deep distributor stock, a maker people ask
 *                  for, on the store's shelf); out-of-stock products are skipped.
 *                  Default budget 2500 searches unless --budget.
 *   --cover [N]    only the products on the first page (N cards, default 48) of every view
 *                  a shopper lands on — All, each department, each category — in the
 *                  Armory's own order (assets/js/order.js), most visible first; the
 *                  rest can wait. Default budget 2500 searches (~$12.50) unless --budget.
 *   --budget N     max searches this run (default 300) — the API bills per search
 *   --limit N      max products this run
 *   --rps N        searches per second (default 1, the basic plan's limit)
 *   --size 800     longest side in px, saved as WebP (~40 KB). Needs the resizer once:
 *                  npm install sharp   (runs over 20 products refuse to start without it,
 *                  so full-size photos never bloat the repo; --no-resize to override).
 *                  With it, each photo is also trimmed to the product plus a small
 *                  white margin, and one cut off by its frame (a stock or barrel
 *                  running into one edge) is skipped for the next result.
 *   --retry        search again for products marked "none" earlier
 *   --lenient      the looser checks of earlier runs. By default a photo must be a clean
 *                  packshot: a strong match (score 5+: the maker's site, or the product's
 *                  name/UPC in the title), on a plain white or light-grey background (no
 *                  lifestyle shots, dark backdrops, banners or full-bleed boxes), never from
 *                  a stock-photo or video site (watermarks), and not cut off by its frame.
 *                  Size is no bar: bigger results rank first, and a small one is enlarged to
 *                  --size with a sharp resampler.
 *   --recheck      no searches: check the photos already found online against that bar.
 *                  One that is plainly wrong (blank, or not a product shot: a busy or dark
 *                  background, a banner, a listing screenshot) is taken off, and the product
 *                  goes back on the list for the next search — as do the products whose photo
 *                  was pulled by hand in overrides.json. The store's own products are never
 *                  touched. Add --dry-run to see the list (photo-recheck.html) first.
 *   --per-variant  search each variant on its own (default: one search per product
 *                  line, shared by its variants — several times fewer searches)
 *   --dry-run      search and score, download nothing
 * ===========================================================================*/
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { readCatalog, writeCatalog, catalogExists } from './lib-store.mjs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { upcOf, isImage, extOf } from './match-images.mjs';

/** what to search for: maker + line + what sets the variant apart, then maker + UPC, then maker + part number */
export function queriesFor(p, upc) {
  const variant = Object.values(p.variant || {}).filter((v) => !/^\d+$/.test(String(v))).slice(0, 2).join(' ');
  const mpn = p.sku && p.sku !== upc ? p.sku : (p.attributes && p.attributes['Manufacturer Part Number']) || null;
  return [...new Set([
    [p.brand, p.name, variant].filter(Boolean).join(' ').trim(),
    upc ? `${p.brand || ''} ${upc}`.trim() : null,
    mpn ? `${p.brand || ''} ${mpn}`.trim() : null,
  ].filter(Boolean))];
}

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
// stock-photo, video and social image hosts: watermarks, screenshots and thumbnails, never a packshot
const WATERMARKED = /(^|\.)(alamy|shutterstock|istockphoto|gettyimages|dreamstime|123rf|depositphotos|adobestock|stock\.adobe|youtube|ytimg|vimeo|tiktok|twitter|x|flickr|imgur|tumblr)\./i;

export function scoreResult(r, p, upc, { strict = false } = {}) {
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
  if (strict) {
    if (WATERMARKED.test(host) || WATERMARKED.test((() => { try { return new URL(r.image).hostname; } catch { return ''; } })())) s -= 20;
    if (w && h) { if (Math.max(w, h) >= 1000) s += 2; else if (Math.max(w, h) >= 800) s += 1; }   // bigger wins; a small one is enlarged, not refused
  } else if (w && h) { if (Math.min(w, h) < 250) s -= 6; else if (Math.max(w, h) >= 800) s += 1; }
  if (JUNK.test(r.image)) s -= 5;
  if (/gearfire\.com/i.test(r.image)) s -= 20;               // its image server refuses downloads
  return s;
}

// Where the product sits in a photo on white (raw RGB pixels): its box, and whether
// the frame cuts it off. A product crossing 3–40% of an edge touches it (more is a
// full-bleed box or mat, which is fine). Touching is not being cut: a photo cropped
// tight to a whole product touches the frame with a thin tip — a muzzle, a magazine
// base, a bullet's point. A cut-off one is sliced through a thick part: the stock or
// the receiver meets the edge at much of the product's full thickness. So an edge is
// cut when the product is at least 45% of its thickest there, with white space at the
// opposite edge; both opposite edges are cut (a close-up of the receiver) when the
// product is at least 40% of its thickest at each.
export function framing(data, w, h, ch = 3) {
  const ink = (x, y) => { const i = (y * w + x) * ch; return data[i] < 225 || data[i + 1] < 225 || data[i + 2] < 225; };
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  const colN = new Uint32Array(w), rowN = new Uint32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink(x, y)) { colN[x]++; rowN[y]++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { blank: true, cut: [] };
  const run = (n, f) => { let best = 0, cur = 0; for (let k = 0; k < n; k++) { cur = f(k) ? cur + 1 : 0; if (cur > best) best = cur; } return best; };
  const contact = { left: run(h, (y) => ink(0, y)) / h, right: run(h, (y) => ink(w - 1, y)) / h, top: run(w, (x) => ink(x, 0)) / w, bottom: run(w, (x) => ink(x, h - 1)) / w };
  const margin = { left: x0 / w, right: (w - 1 - x1) / w, top: y0 / h, bottom: (h - 1 - y1) / h };
  // how thick the product is where it meets each edge, against its thickest cross-section that way
  const maxCol = Math.max(1, ...colN), maxRow = Math.max(1, ...rowN);
  const thick = { left: colN[0] / maxCol, right: colN[w - 1] / maxCol, top: rowN[0] / maxRow, bottom: rowN[h - 1] / maxRow };
  const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
  const narrow = (s) => contact[s] >= 0.03 && contact[s] < 0.4;
  const cut = Object.keys(contact).filter((s) => narrow(s) && thick[s] >= 0.45 && margin[opposite[s]] >= 0.004);
  for (const [a, b] of [['left', 'right'], ['top', 'bottom']]) if (narrow(a) && narrow(b) && thick[a] >= 0.4 && thick[b] >= 0.4) cut.push(`${a}+${b}`);
  return { box: { x0, x1, y0, y1 }, cut, contact, margin, thick, fill: Math.max((x1 - x0 + 1) / w, (y1 - y0 + 1) / h) };
}

// How much of the photo's outer ring (1.5% deep, 2px at least) is a clean studio background —
// white or a light neutral grey: a packshot is ~1; a lifestyle shot, a dark backdrop or a
// full-bleed box is far lower
export function whiteBorder(data, w, h, ch = 3) {
  const d = Math.max(2, Math.round(Math.min(w, h) * 0.015));
  let white = 0, all = 0;
  const at = (x, y) => {
    const i = (y * w + x) * ch; all++;
    const lo = Math.min(data[i], data[i + 1], data[i + 2]), hi = Math.max(data[i], data[i + 1], data[i + 2]);
    if (lo >= 215 && hi - lo <= 30) white++;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < d || y < d || x >= w - d || y >= h - d) at(x, y);
  return all ? white / all : 0;
}
// the stricter bar for a photo (unless --lenient): a clean packshot on a plain studio background.
// Size is no bar: bigger results rank first, and a small one is enlarged to the standard size.
export function qualityProblem(info, f, border) {
  if (border < 0.8) return `not a clean packshot (${Math.round(border * 100)}% of the edge is plain background)`;
  return null;
}
// A photo already on the site is only taken down when it is plainly wrong: blank, or not a product
// shot at all (a busy or dark background: a lifestyle photo, a banner, a listing screenshot).
// A clean packshot stays, whatever its size (the site enlarges it to fit).
export function recheckProblem(info, f, border) {
  if (f.blank) return 'blank';
  if (border < 0.5) return `not a product shot (${Math.round(border * 100)}% plain background)`;
  return null;
}

// Crop to the product plus a 4% white margin, so it fills its card; refuse a cut-off photo
// (and, strict, one that is not a clean packshot); strict enlarges a small one to the standard size
export async function fitPhoto(sharp, buf, size, { strict = false } = {}) {
  const flat = await sharp(buf).rotate().flatten({ background: '#ffffff' }).removeAlpha().toBuffer();
  const { data, info } = await sharp(flat).raw().toBuffer({ resolveWithObject: true });
  const f = framing(data, info.width, info.height, info.channels);
  if (f.blank) throw new Error('blank photo');
  if (f.cut.length) throw new Error(`cut off at the ${f.cut.join('/')} edge`);
  if (strict) { const why = qualityProblem(info, f, whiteBorder(data, info.width, info.height, info.channels)); if (why) throw new Error(why); }
  let img = sharp(flat);
  if (f.fill < 0.92) {
    const { x0, x1, y0, y1 } = f.box;
    const pad = Math.round(0.04 * Math.max(x1 - x0 + 1, y1 - y0 + 1));
    const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
    const width = Math.min(info.width, x1 + pad + 1) - left, height = Math.min(info.height, y1 + pad + 1) - top;
    if (width >= 40 && height >= 20) img = img.extract({ left, top, width, height });
  }
  return img.resize({ width: size, height: size, fit: 'inside', withoutEnlargement: !strict, kernel: 'lanczos3' }).webp({ quality: 80 }).toBuffer();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** width × height from the file header (PNG, JPEG, WebP), without decoding; null when unknown */
export function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const k = b.toString('latin1', 12, 16);
    if (k === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (k === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (k === 'VP8L') { const n = b.readUInt32LE(21); return { w: 1 + (n & 0x3fff), h: 1 + ((n >> 14) & 0x3fff) }; }
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

async function main() {
  const KEY = process.env.BRAVE_API_KEY;
  const API = process.env.BRAVE_API_BASE || 'https://api.search.brave.com';
  const RECHECK = flag('recheck');
  if (!KEY && !RECHECK) { console.error('✗ set BRAVE_API_KEY first (PowerShell: $env:BRAVE_API_KEY="…") — see the header of this file'); process.exit(1); }
  const COVER = flag('cover') ? num('cover', 48, 1) : 0;
  const TOP = flag('top') ? num('top', 500, 1) : 0;
  const STRICT = !flag('lenient'), MIN_SCORE = num('min-score', STRICT ? 5 : 2, -99);
  const BUDGET = num('budget', COVER || TOP ? 2500 : 300, 1), LIMIT = num('limit', 0, 0), RPS = num('rps', 1, 0.1), SIZE = num('size', 800, 200);
  const RETRY = flag('retry'), DRY = flag('dry-run'), PER_VARIANT = flag('per-variant');
  const CAT_DIR = path.resolve(arg('catalog-dir', 'assets/data/scraped'));
  const IMG_DIR = path.resolve(arg('img-dir', 'assets/img/products'));
  const IMG_REL = path.relative(process.cwd(), IMG_DIR).split(path.sep).join('/');
  let sharp = null; if (!process.env.AA_NO_SHARP) try { sharp = (await import('sharp')).default; } catch { /* optional */ }

  const files = [path.join(CAT_DIR, 'catalog.json')];
  try { for (const e of await readdir(CAT_DIR, { withFileTypes: true })) if (e.isDirectory()) files.push(path.join(CAT_DIR, e.name, 'catalog.json')); } catch { /* none */ }
  const cats = [];
  for (const f of files) { try { if (catalogExists(f)) cats.push({ f, list: await readCatalog(f) }); } catch { /* unreadable */ } }
  // the store's own products (merch, gift cards, its own listings) are never searched for: the web has only others' to offer
  const own = (p) => /agarthan/i.test(String(p.brand || '')) || /agarthan merch/i.test((p.categories || []).join(' '));
  if (RECHECK) return recheck({ cats, own, sharp, DRY, CAT_DIR });
  const todo = cats.flatMap((c) => c.list).filter((p) => !own(p) && !(p.localImages || []).length && (RETRY || !(p.photoSearch && p.photoSearch.result === 'none')));
  // one search per product LINE: the variants of a line (calibers, colors) share its photo unless --per-variant
  const groups = new Map();
  for (const p of todo) { const k = PER_VARIANT ? p.id : (p.line || `${p.brand || ''}|${p.name}`); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  let allGroups = [...groups.values()];
  if (COVER) {
    // the first page of every view, in the Armory's own order (the site's catalog + assets/js/order.js)
    const catJs = path.resolve(arg('catalog-js', 'assets/data/catalog.js'));
    let items;
    try { const w = {}; new Function('window', await readFile(catJs, 'utf8'))(w); items = w.AA_CATALOG.items; }
    catch (e) { console.error(`✗ --cover needs the site catalog (${path.relative(process.cwd(), catJs)}): run npm run build:catalog first`); process.exit(1); }
    const order = createRequire(import.meta.url)(arg('order-js', null) ? path.resolve(arg('order-js')) : '../assets/js/order.js');
    const { ids, views } = order.coverIds(items, { page: COVER });
    const at = new Map(ids.map((id, n) => [id, n]));
    allGroups = allGroups.filter((g) => g.some((p) => at.has(p.id)))
      .map((g) => g.slice().sort((a, b) => (at.get(a.id) ?? 1e9) - (at.get(b.id) ?? 1e9)))   // the card shoppers see stands for its line
      .sort((a, b) => at.get(a[0].id) - at.get(b[0].id));
    console.log(`→ cover: the first ${COVER} cards of ${views} views (All, each department, each category) = ${ids.length} products`);
  }
  if (TOP) {
    // the lines most worth a photo: a hologram on a first page first, then by the Armory's merit rank; never out of stock
    const catJs = path.resolve(arg('catalog-js', 'assets/data/catalog.js'));
    let items;
    try { const w = {}; new Function('window', await readFile(catJs, 'utf8'))(w); items = w.AA_CATALOG.items; }
    catch (e) { console.error(`✗ --top needs the site catalog (${path.relative(process.cwd(), catJs)}): run npm run build:catalog first`); process.exit(1); }
    const order = createRequire(import.meta.url)(arg('order-js', null) ? path.resolve(arg('order-js')) : '../assets/js/order.js');
    const cover = new Set(order.coverIds(items.map((i) => ({ ...i })), { page: 48 }).ids);
    const site = new Map(items.map((i) => [i.id, i]));
    const worth = (p) => { const i = site.get(p.id); return i && i.status !== 'out' ? (cover.has(p.id) ? 0 : 1e7) + (i.rank ?? 1e6) : Infinity; };
    allGroups = allGroups.map((g) => g.slice().sort((a, b) => worth(a) - worth(b)))
      .filter((g) => worth(g[0]) < Infinity)
      .sort((a, b) => worth(a[0]) - worth(b[0]))
      .slice(0, TOP);
    console.log(`→ top: the ${allGroups.length} product lines most worth a photo (${allGroups.filter((g) => cover.has(g[0].id)).length} of them show a hologram on a first page)`);
  }
  console.log(STRICT ? `  photo bar: match score ${MIN_SCORE}+, clean packshots only, small ones enlarged to ${SIZE}px (--lenient for the old bar)` : '  photo bar: lenient');
  const work = LIMIT ? allGroups.slice(0, LIMIT) : allGroups;
  const est = (n) => `$${(n * 0.005).toFixed(2)}`;
  console.log(`→ ${todo.length} products without a photo, ${allGroups.length} ${PER_VARIANT ? 'searches' : 'product lines'} to look up; this run: ${work.length}`);
  console.log(`  about ${work.length}–${Math.min(BUDGET, Math.round(work.length * 1.6))} searches (${est(work.length)}–${est(Math.min(BUDGET, work.length * 1.6))} at $5 per 1,000), never more than ${BUDGET} (--budget)${sharp ? `; photos saved as ${SIZE}px WebP` : ''}`);
  if (!sharp && !DRY && !flag('no-resize') && work.length > 20) {
    console.error('✗ install the photo resizer first, so a couple of thousand full-size photos never land in the repo:\n    npm install sharp\n  then run this again (or add --no-resize to save photos as they come)');
    process.exit(1);
  }

  let calls = 0, found = 0, none = 0, last = 0, looked = 0;
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
    for (const group of work) {
      if (calls >= BUDGET) { console.log(`  budget of ${BUDGET} searches reached — run again to continue`); break; }
      // the variant the store shows first stands for the line
      const p = group[0];
      const upc = upcOf(p);
      const queries = queriesFor(p, upc);
      let chosen = null;
      for (const q of queries) {
        if (calls >= BUDGET) break;
        const ranked = (await search(q)).map((r) => ({ ...r, score: scoreResult(r, p, upc, { strict: STRICT }) })).filter((r) => r.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
        const refused = new Set(group.flatMap((q) => (q.photoSearch && q.photoSearch.refused) || []));
        for (const r of ranked.filter((x) => !refused.has(x.image)).slice(0, 5)) {   // never a photo taken down before
          if (DRY) { chosen = { r }; break; }
          try {
            let b = await download(r.image); let ext = extOf(b);
            if (sharp) { b = await fitPhoto(sharp, b, SIZE, { strict: STRICT }); ext = '.webp'; }   // trimmed to the product; cut-off or cluttered photos skipped
            const name = `${p.id}-1${ext}`;
            await writeFile(path.join(IMG_DIR, name), b);
            chosen = { r, file: `${IMG_REL}/${name}` };
            break;
          } catch { /* try the next result */ }
        }
        if (chosen) break;
      }
      const at = new Date().toISOString();
      if (chosen) {
        found += group.length;
        group.forEach((q, n) => {
          if (!DRY) { q.localImages = [chosen.file]; q.photoSource = { image: chosen.r.image, page: chosen.r.page, score: chosen.r.score, ...(n ? { sharedFrom: p.id } : {}) }; }
          q.photoSearch = { at, result: 'found', ...(q.photoSearch && q.photoSearch.refused ? { refused: q.photoSearch.refused } : {}) };
        });
      } else { none += group.length; group.forEach((q) => { q.photoSearch = { at, result: 'none', ...(q.photoSearch && q.photoSearch.refused ? { refused: q.photoSearch.refused } : {}) }; }); }
      if (++looked % 25 === 0) console.log(`    ${looked}/${work.length} looked up · ${found} products with a photo · ${calls} searches`);
    }
  } catch (e) {
    console.error('✗ ' + e.message); if (!e.fatal) console.error(e.stack);
  }
  for (const c of cats) await writeCatalog(c.f, c.list);

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
/* --recheck: the photos already found online, against the stricter bar — no searches */
async function recheck({ cats, own, sharp, DRY, CAT_DIR }) {
  if (!sharp) { console.error('✗ --recheck looks at the photos themselves: npm install sharp --no-save, then run it again'); process.exit(1); }
  const root = process.cwd();
  const ovFile = path.resolve(arg('overrides', 'assets/data/overrides.json'));
  let ov = {}; try { ov = JSON.parse(await readFile(ovFile, 'utf8')); } catch { /* none */ }
  const all = cats.flatMap((c) => c.list);
  // every photo file, with the products showing it
  const byFile = new Map();
  for (const p of all) for (const f of p.localImages || []) { if (!byFile.has(f)) byFile.set(f, []); byFile.get(f).push(p); }
  const takeDown = [];   // { file, products, why }
  for (const [f, ps] of byFile) {
    if (!ps.some((p) => p.photoSource) || ps.some(own)) continue;          // found online, never the store's own
    const pulled = ps.find((p) => ov[p.id] && ov[p.id].noPhoto);
    if (pulled) { takeDown.push({ file: f, products: ps, why: `pulled by hand: ${String(ov[pulled.id]._photo || '').replace(/^pulled [\d-]+: /, '')}`, pulled: true }); continue; }
    let why = null;
    try {
      const { data, info } = await sharp(path.resolve(root, f)).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      why = recheckProblem(info, framing(data, info.width, info.height, info.channels), whiteBorder(data, info.width, info.height, info.channels));
    } catch (e) { why = `unreadable (${e.message})`; }
    if (why) takeDown.push({ file: f, products: ps, why });
  }
  const esc = (x) => String(x || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sheet = path.join(CAT_DIR, 'photo-recheck.html');
  const rel = path.relative(CAT_DIR, root).split(path.sep).join('/') || '.';
  await writeFile(sheet, `<!doctype html><meta charset="utf-8"><title>Photo recheck — ${takeDown.length}</title><style>body{font:14px system-ui;margin:20px;background:#f4f4f4}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}.c{background:#fff;padding:8px;border:1px solid #ddd}.c img{width:100%;height:150px;object-fit:contain}.m{color:#666;font-size:12px}</style>
<h1>${DRY ? 'Would take down' : 'Taken down'}: ${takeDown.length} photos (${takeDown.reduce((n, t) => n + t.products.length, 0)} products). They go back on the list for the next search.</h1><div class="g">${takeDown.map((t) =>
    `<div class="c">${DRY ? `<img src="${esc(rel + '/' + t.file)}" loading="lazy" alt="">` : ''}<div><b>${esc(t.products[0].brand)} — ${esc(t.products[0].name)}</b></div><div class="m">${esc(t.why)}</div></div>`).join('')}</div>`);
  if (!DRY) {
    const { unlink } = await import('node:fs/promises');
    for (const t of takeDown) {
      for (const p of t.products) {
        const refused = [...new Set([...((p.photoSearch && p.photoSearch.refused) || []), ...(p.photoSource && p.photoSource.image ? [p.photoSource.image] : [])])].slice(-10);
        delete p.localImages; delete p.photoSource;
        p.photoSearch = { result: 'retake', refused };          // searched again next run, never this photo again
        if (ov[p.id] && ov[p.id].noPhoto) {                      // the hand-pulled flag goes with the photo
          delete ov[p.id].noPhoto; delete ov[p.id]._photo;
          if (!Object.keys(ov[p.id]).some((k) => !k.startsWith('_'))) delete ov[p.id];
        }
      }
      try { await unlink(path.resolve(root, t.file)); } catch { /* already gone */ }
    }
    for (const c of cats) await writeCatalog(c.f, c.list);
    if (takeDown.some((t) => t.pulled)) await writeFile(ovFile, JSON.stringify(ov, null, 2) + '\n');
  }
  const pulled = takeDown.filter((t) => t.pulled).length;
  console.log(`${DRY ? '→ would take down' : '✓ took down'} ${takeDown.length} photos (${takeDown.length - pulled} failing the bar, ${pulled} pulled by hand), ${takeDown.reduce((n, t) => n + t.products.length, 0)} products back on the search list`);
  console.log(`  list: ${path.relative(root, sheet)}${DRY ? ' (open it to look; run again without --dry-run to take them down)' : ''}`);
  if (!DRY) console.log('  then: search again (--top), npm run build:catalog');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main();
