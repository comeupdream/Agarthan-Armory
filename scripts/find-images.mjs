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
 *   --dept nfa     only these departments (comma list: sidearms, longarms, shotguns, ammo, optics,
 *                  gear, nfa); --sub suppressors narrows to categories the same way
 *   --gallery 4    up to N distinct photos per product (different angles; a picture re-hosted
 *                  on several sites counts once). Products that already have a photo get more
 *                  added after it.
 *   --colors       a gun sold in several colours gets a photo per colour: the colour goes in the
 *                  query (and the UPC searched is that colour's own), and a photo for an FDE/tan
 *                  or green listing must show that colour. Covers variants showing another
 *                  colour's photo, or none; the gun departments unless --dept says otherwise.
 *                  A variant whose same-colour sibling already has the right photo shares it
 *                  without a search.
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
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readCatalog, writeCatalog, catalogExists } from './lib-store.mjs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { upcOf, isImage, extOf } from './match-images.mjs';

/** what to search for: maker + line + what sets the variant apart, then maker + UPC, then maker + part number */
export function queriesFor(p, upc, { color = '' } = {}) {
  // searching for one colourway: the colour goes in the first query (the UPC and part number are that colour's own)
  const variant = color || Object.values(p.variant || {}).filter((v) => !/^\d+$/.test(String(v))).slice(0, 2).join(' ');
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

/* The product's own words: what sets it apart from the rest of its brand ("Anaconda", "TLR-7", "590A1"),
 * not the brand and not words every listing shares ("pistol", "black", "barrel"). A result must show one
 * of them — or the UPC, or the part number — in its title or its address: being on the brand's site is not
 * enough (a Colt revolver once got a Colt lower receiver from a Colt parts shop's home-page banner). */
const GENERIC_WORDS = new Set(('rifle pistol revolver shotgun handgun carbine gun guns firearm black blued stainless matte tactical sporting hunting hunter ' +
  'compact full size series gen round rounds inch barrel model new the and with for edition standard deluxe semi auto automatic action bolt lever pump ' +
  'single shot double sight sights optic optics scope red dot mount mounts kit case bag magazine magazines mag mags ammo ammunition grain grains box ' +
  'pack holster light laser left right hand ambidextrous threaded suppressor ready').split(' '));
export function nameTokens(p) {
  const brand = new Set(String(p.brand || '').toLowerCase().split(/[^a-z0-9]+/));
  return [...new Set(String(p.name || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w) && !brand.has(w)))];
}
export function namesProduct(r, p, upc) {
  const hay = `${r.title || ''} ${r.page || ''} ${r.image || ''}`.toLowerCase();
  const words = hay.replace(/[^a-z0-9]+/g, ' '), joined = words.replace(/ /g, '');
  const toks = nameTokens(p);
  if (!toks.length) return true;                                           // a name with nothing distinctive to look for
  if (toks.some((t) => words.includes(t) || joined.includes(t))) return true;
  if (upc && joined.includes(String(upc).replace(/^0+/, ''))) return true;
  const mpn = String(p.sku || (p.attributes && p.attributes['Manufacturer Part Number']) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return mpn.length >= 4 && joined.includes(mpn);
}
/** a site's home page: its pictures are banners and promotions, never one product's photo */
export const isHomePage = (url) => { try { const u = new URL(url); return u.pathname === '/' || u.pathname === ''; } catch { return false; } };
/** a page listing many products (a category, collection, brand or search page): its photo may be any of them */
export const isListingPage = (url) => {
  let u; try { u = new URL(url); } catch { return false; }
  const p = u.pathname + u.search;
  if (/\/products?\/[^/]+/i.test(u.pathname)) return false;                 // a product's own page
  return /\/(product-category|product-categories|category|categories|collections?|catalog|catalogsearch|search|shop|brands?|manufacturers?|tag|tags|series|departments?|c)\/|[?&](s|q|search|query|keyword|keywords)=|\/search(\b|$)/i.test(p);
};

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
    if (!namesProduct(r, p, upc)) s -= 50;                                  // the brand alone is not this product
    if (r.page && isHomePage(r.page)) s -= 50;                              // a home-page banner
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
/* ------------------------------------------------------------ colourways
 * A gun sold in several colours (a Vector in black, FDE, white…) needs a photo per colour. The variant's
 * colour is in the feed; a downloaded photo is checked against it where a check is reliable: an FDE/tan
 * listing must show tan, a green/OD listing must show some colour (olive reads as tan or green); black,
 * camo, two-tone and the rest are not checked (wood stocks read as tan, camo as anything). Calibrated on
 * the store's own photos: every FDE/green listing it flags shows the black gun. */
export const colorOf = (p) => String((p && ((p.variant || {}).Color || (p.attributes || {}).Color)) || '').trim();
export function colorFamily(c) {
  const s = String(c || '').toLowerCase();
  if (!s || /camo|multicam|black|\band\b|\/|,|two[- ]?tone|&/.test(s)) return null;
  if (/fde|flat dark earth|\btan\b|coyote|sand|desert|earth/.test(s)) return 'tan';
  if (/\b(od|odg|olive|green|foliage)\b/.test(s)) return 'green';
  return null;
}
/** the share of the product's pixels (not the white background) that read dark, tan or green */
export function colorShares(data, w, h, ch = 3) {
  let ink = 0, dark = 0, tan = 0, green = 0;
  for (let i = 0; i < w * h * ch; i += ch) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    if (r > 0.88 && g > 0.88 && b > 0.88) continue;
    ink++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let hue = 0; if (d) { hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hue *= 60; if (hue < 0) hue += 360; }
    if (hue >= 15 && hue <= 55 && s >= 0.10 && l >= 0.15 && l <= 0.85) tan++;
    else if (hue > 55 && hue <= 165 && s >= 0.06 && l >= 0.08 && l <= 0.75) green++;
    else if (l < 0.22) dark++;
  }
  return ink ? { dark: dark / ink, tan: tan / ink, green: green / ink } : { dark: 0, tan: 0, green: 0 };
}
export function colorProblem(family, sh) {
  if (family === 'tan' && sh.tan < 0.10) return 'the photo shows no FDE/tan (the listing is that colour)';
  if (family === 'green' && sh.tan + sh.green < 0.10) return 'the photo shows no green (the listing is that colour)';
  return null;
}
/** a plain black finish (not two-tone, not black-and-FDE, not camo) */
export const isPlainBlack = (c) => /black/i.test(c || '') && !/fde|flat dark earth|\btan\b|coyote|sand|green|\bod\b|olive|camo|multicam|silver|stainless|white|bronze|gr[ae]y|\/|,|&|two/i.test(c || '');
/** does one photo of a gallery fit the listing? Its colour when known (FDE/tan, green, plain black: strongly tan or
 *  green is another colourway), otherwise the gallery's first photo (another colour is another colourway) */
export function galleryFits(color, s, first = null) {
  const fam = colorFamily(color);
  if (fam) return !colorProblem(fam, s);
  if (isPlainBlack(color)) return s.tan < 0.3 && s.green < 0.3;
  return !first || (Math.abs(s.tan - first.tan) <= 0.3 && Math.abs(s.green - first.green) <= 0.3);
}
/** a 64-bit picture fingerprint (difference hash): near-identical photos are a few bits apart */
export async function dhash(sharp, buf) {
  const d = await sharp(buf).flatten({ background: '#ffffff' }).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let h = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) h = (h << 1n) | (d[y * 9 + x] > d[y * 9 + x + 1] ? 1n : 0n);
  return h;
}
export const hamming = (a, b) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };

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
export async function fitPhoto(sharp, buf, size, { strict = false, expect = null } = {}) {
  const flat = await sharp(buf).rotate().flatten({ background: '#ffffff' }).removeAlpha().toBuffer();
  const { data, info } = await sharp(flat).raw().toBuffer({ resolveWithObject: true });
  const f = framing(data, info.width, info.height, info.channels);
  if (f.blank) throw new Error('blank photo');
  if (f.cut.length) throw new Error(`cut off at the ${f.cut.join('/')} edge`);
  if (strict) { const why = qualityProblem(info, f, whiteBorder(data, info.width, info.height, info.channels)); if (why) throw new Error(why); }
  if (expect) { const why = colorProblem(expect, colorShares(data, info.width, info.height, info.channels)); if (why) throw new Error(why); }   // a colourway's own photo
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
  const list = (n) => String(arg(n, '') || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const DEPTS = list('dept'), SUBS = list('sub');                                   // --dept nfa · --sub suppressors
  const GALLERY = Math.min(6, num('gallery', 1, 1));                                 // --gallery 4: up to 4 photos each
  const COLORS = flag('colors');                                                     // --colors: one photo per colourway
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
  // the site's catalog (department, category, stock, merit rank), for --dept/--sub/--colors/--top/--cover
  let siteItems = null, site = new Map();
  if (DEPTS.length || SUBS.length || COLORS || TOP || COVER) {
    const catJs = path.resolve(arg('catalog-js', 'assets/data/catalog.js'));
    try { const w = {}; new Function('window', await readFile(catJs, 'utf8'))(w); siteItems = w.AA_CATALOG.items; site = new Map(siteItems.map((i) => [i.id, i])); }
    catch (e) { console.error(`✗ this run needs the site catalog (${path.relative(process.cwd(), catJs)}): run npm run build:catalog first`); process.exit(1); }
  }
  const all = cats.flatMap((c) => c.list);
  const byId = new Map(all.map((p) => [p.id, p]));
  const lineOf = (p) => p.line || `${p.brand || ''}|${p.name}`;
  // --colors: lines sold in several colours get one search per colour
  const lineColors = new Map();
  for (const p of all) { const c = colorOf(p).toLowerCase(); if (!c) continue; const k = lineOf(p); if (!lineColors.has(k)) lineColors.set(k, new Set()); lineColors.get(k).add(c); }
  const GUNS = new Set(['sidearms', 'longarms', 'shotguns', 'nfa']);
  const byColor = (p) => COLORS && !!colorOf(p) && (lineColors.get(lineOf(p)) || new Set()).size > 1;
  const keyOf = (p) => (PER_VARIANT ? p.id : lineOf(p) + (byColor(p) ? '|' + colorOf(p).toLowerCase() : ''));
  // the colour a product's photo was found for (a variant shares its line's photo unless it got its own)
  const photoColor = (p) => colorOf(p.photoSource && p.photoSource.sharedFrom ? byId.get(p.photoSource.sharedFrom) || p : p).toLowerCase();
  // an FDE/green variant whose photo, looked at, shows no such colour (found for it before colours were searched,
  // the black gun) counts as another colour's photo too — and never lends it to a sibling
  const colourMiss = new Set();
  if (COLORS && sharp) {
    const looked = new Map();
    for (const p of all) {
      const fam = colorFamily(colorOf(p)), f = (p.localImages || [])[0];
      if (!fam || !f || !p.photoSource || !byColor(p) || !GUNS.has((site.get(p.id) || {}).dept)) continue;
      const k = `${fam}|${f}`;
      if (!looked.has(k)) {
        try {
          const { data, info } = await sharp(path.resolve(f)).flatten({ background: '#ffffff' }).removeAlpha().resize(240, 240, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
          looked.set(k, !colorProblem(fam, colorShares(data, info.width, info.height, info.channels)));
        } catch { looked.set(k, true); }
      }
      if (!looked.get(k)) colourMiss.add(p.id);
    }
  }
  const wrongColor = (p) => byColor(p) && (p.localImages || []).length > 0 && !!p.photoSource && (photoColor(p) !== colorOf(p).toLowerCase() || colourMiss.has(p.id));
  const inScope = (p) => {
    if (!siteItems) return true;
    const i = site.get(p.id); if (!i) return false;
    if (DEPTS.length && !DEPTS.includes(i.dept)) return false;
    if (SUBS.length && !SUBS.includes(String(i.sub || '').toLowerCase())) return false;
    if (COLORS && !DEPTS.length && !GUNS.has(i.dept)) return false;          // colourways: the guns, unless --dept says otherwise
    if (COLORS && !TOP && !DEPTS.length && i.status === 'out') return false;  // a broad colour run skips what can't be bought; --dept covers it all
    return true;
  };
  const ps = (p) => p.photoSearch || {};
  const todo = all.filter((p) => {
    if (own(p) || !inScope(p)) return false;
    const n = (p.localImages || []).length;
    if (n && !p.photoSource) return false;                                     // the store's own photo is never touched
    if (!n) return RETRY || ps(p).result !== 'none' || (byColor(p) && !ps(p).colorTried);
    if (colourMiss.has(p.id)) return RETRY || !ps(p).colorChecked;             // its photo shows another colour
    if (wrongColor(p)) return RETRY || !ps(p).colorTried;                      // showing another colour's photo
    if (GALLERY > 1 && n < GALLERY) return RETRY || !((ps(p).gallery || 0) >= GALLERY);
    return false;
  });
  // one search per product LINE (per colour with --colors): its variants share the photos, unless --per-variant
  const groups = new Map();
  for (const p of todo) { const k = keyOf(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  let allGroups = [...groups.values()];
  // the best-ranked variant stands for its group, and the groups go best first (the Armory's merit order)
  if (siteItems && !TOP && !COVER) {
    const rank = (p) => { const i = site.get(p.id); return i ? (i.rank ?? 1e6) + (i.status === 'out' ? 1e7 : 0) : 1e8; };
    allGroups = allGroups.map((g) => g.slice().sort((a, b) => rank(a) - rank(b))).sort((a, b) => rank(a[0]) - rank(b[0]));
  }
  // a sibling of the same line (and colour) that already has the right photos lends them: no search needed
  const usedFiles = new Set(all.flatMap((p) => p.localImages || []));
  const donors = new Map();
  for (const p of all) {
    const n = (p.localImages || []).length;
    if (!n || (byColor(p) && p.photoSource && (photoColor(p) !== colorOf(p).toLowerCase() || colourMiss.has(p.id)))) continue;
    const k = keyOf(p); const cur = donors.get(k);
    if (!cur || n > cur.localImages.length) donors.set(k, p);
  }
  if (DEPTS.length || SUBS.length) console.log(`→ scope: ${[DEPTS.length ? `department ${DEPTS.join(', ')}` : '', SUBS.length ? `category ${SUBS.join(', ')}` : ''].filter(Boolean).join(' · ')}`);
  if (COLORS) console.log(`→ colours: ${allGroups.filter((g) => byColor(g[0])).length} colourways to find (variants showing another colour's photo, or none)`);
  if (GALLERY > 1) console.log(`→ gallery: up to ${GALLERY} distinct photos per product`);
  if (COVER) {
    // the first page of every view, in the Armory's own order (the site's catalog + assets/js/order.js)
    const items = siteItems;
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
    const items = siteItems;
    const order = createRequire(import.meta.url)(arg('order-js', null) ? path.resolve(arg('order-js')) : '../assets/js/order.js');
    const cover = new Set(order.coverIds(items.map((i) => ({ ...i })), { page: 48 }).ids);
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
  console.log(`→ ${todo.length} products to work on, ${allGroups.length} ${PER_VARIANT ? 'searches' : COLORS ? 'product lines and colourways' : 'product lines'} to look up; this run: ${work.length}`);
  console.log(`  about ${work.length}–${Math.min(BUDGET, Math.round(work.length * 1.6))} searches (${est(work.length)}–${est(Math.min(BUDGET, work.length * 1.6))} at $5 per 1,000), never more than ${BUDGET} (--budget)${sharp ? `; photos saved as ${SIZE}px WebP` : ''}`);
  if (!sharp && !DRY && !flag('no-resize') && work.length > 20) {
    console.error('✗ install the photo resizer first, so a couple of thousand full-size photos never land in the repo:\n    npm install sharp\n  then run this again (or add --no-resize to save photos as they come)');
    process.exit(1);
  }

  let calls = 0, found = 0, none = 0, last = 0, looked = 0, skipped = 0, downInARow = 0, extra = 0, recolored = 0, lent = 0;
  // A dropped connection, a timeout, a rate limit or a server error is retried (2s, 4s, 8s), never taken
  // as "no photo": if it keeps failing, the product is skipped this run and searched again next run.
  const NetError = (why) => Object.assign(new Error(why), { network: true });
  const RETRY_MS = Number(process.env.AA_RETRY_MS) || 1000;          // the tests shorten the waits
  const search = async (q) => {
    let why = '';
    for (let attempt = 1; attempt <= 4; attempt++) {
      if (attempt > 1) await sleep(RETRY_MS * 2 ** (attempt - 1));
      const wait = 1000 / RPS - (Date.now() - last); if (wait > 0) await sleep(wait);
      last = Date.now();
      let r;
      try {
        r = await fetch(`${API}/res/v1/images/search?q=${encodeURIComponent(q)}&count=20&safesearch=off`, { headers: { 'X-Subscription-Token': KEY, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      } catch (e) { why = e.name === 'TimeoutError' ? 'timed out' : `connection failed (${(e.cause && e.cause.code) || e.message})`; continue; }
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error(`the API refused the key (HTTP ${r.status})`), { fatal: true });
      if (r.status === 429 || r.status >= 500) { why = `HTTP ${r.status}`; await r.body?.cancel().catch(() => {}); continue; }
      calls++;                                                       // a search the API answered (and bills)
      if (!r.ok) return [];
      let j; try { j = await r.json(); } catch { why = 'a broken answer'; continue; }
      return (j.results || []).map((x) => ({
      image: (x.properties && x.properties.url) || (x.thumbnail && (x.thumbnail.original || x.thumbnail.src)),
      page: x.url, title: x.title || '',
      host: (x.meta_url && (x.meta_url.hostname || x.meta_url.netloc)) || x.source || (() => { try { return new URL(x.url).hostname; } catch { return ''; } })(),
      width: (x.properties && x.properties.width) || 0, height: (x.properties && x.properties.height) || 0,
      })).filter((x) => x.image);
    }
    throw NetError(why || 'no answer');
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
      // the variant the store shows first stands for the line (or the colourway)
      const p = group[0];
      const upc = upcOf(p);
      const colorway = byColor(p) ? colorOf(p) : '';
      const expect = colorway && GUNS.has((site.get(p.id) || {}).dept) ? colorFamily(colorway) : null;
      const queries = queriesFor(p, upc, { color: colorway });
      // photos already right for this group stay (a gallery adds to them); another colour's photo doesn't count
      const keep = wrongColor(p) || !p.photoSource ? [] : (p.localImages || []).slice(0, 6);
      const want = Math.max(1, GALLERY) - keep.length;
      const at = new Date().toISOString();
      const mark = (q, extra) => { q.photoSearch = { ...(q.photoSearch || {}), at, ...extra }; };
      const tried = { ...(colorway ? { colorTried: true } : {}), ...(colorway && expect ? { colorChecked: true } : {}), ...(GALLERY > 1 ? { gallery: GALLERY } : {}) };
      // a sibling of the same line and colour already has the right photos: share them, no search
      const donor = !keep.length ? donors.get(keyOf(p)) : null;
      if (donor && !group.includes(donor) && donor.localImages.length >= (GALLERY > 1 ? GALLERY : 1)) {
        if (!DRY) group.forEach((q) => { q.localImages = donor.localImages.slice(); q.photoSource = { ...(donor.photoSource || {}), sharedFrom: donor.photoSource && donor.photoSource.sharedFrom ? donor.photoSource.sharedFrom : donor.id }; });
        group.forEach((q) => mark(q, { result: 'found', ...tried }));
        found += group.length; lent += group.length;
        if (++looked % 25 === 0) console.log(`    ${looked}/${work.length} looked up · ${found} products with a photo · ${calls} searches`);
        continue;
      }
      const chosen = [];
      const hashes = [];
      const sharesOf = async (buf) => { const { data, info } = await sharp(buf).flatten({ background: '#ffffff' }).removeAlpha().resize(240, 240, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true }); return colorShares(data, info.width, info.height, info.channels); };
      let firstShares = null;                                            // the colour of the gallery's first photo
      if (sharp && GALLERY > 1) for (const f of keep) { try { const buf = await readFile(path.resolve(f)); hashes.push(await dhash(sharp, buf)); if (!firstShares) firstShares = await sharesOf(buf); } catch { /* gone */ } }
      // never a photo taken down before, nor (for more angles) one this product already shows
      const refused = new Set([...group.flatMap((q) => (q.photoSearch && q.photoSearch.refused) || []), ...(keep.length ? group.map((q) => q.photoSource && q.photoSource.image).filter(Boolean) : [])]);
      try {
      for (const q of queries) {
        if (calls >= BUDGET || chosen.length >= want) break;
        const ranked = (await search(q)).map((r) => ({ ...r, score: scoreResult(r, p, upc, { strict: STRICT }) })).filter((r) => r.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
        for (const r of ranked.filter((x) => !refused.has(x.image)).slice(0, want > 1 ? 10 : 5)) {
          if (chosen.length >= want) break;
          refused.add(r.image);                                         // one try per picture
          if (DRY) { chosen.push({ r }); continue; }
          try {
            let b = await download(r.image); let ext = extOf(b);
            if (sharp) { b = await fitPhoto(sharp, b, SIZE, { strict: STRICT, expect }); ext = '.webp'; }   // trimmed; cut-off, cluttered or wrong-colour photos skipped
            if (sharp && GALLERY > 1) {                                  // a gallery shows different angles, not the same picture twice
              const h = await dhash(sharp, b);
              if (hashes.some((x) => hamming(x, h) <= 10)) continue;
              // …of the same gun: an angle in another colour (a white or FDE Vector in a black one's gallery) is not it.
              // Judged by the listing's colour when it is known, else by the gallery's first photo
              const sh = await sharesOf(b);
              if (!galleryFits(colorOf(p), sh, firstShares)) continue;
              if (!firstShares) firstShares = sh;
              hashes.push(h);
            }
            // a new name: never one a product shows (a sibling's photo, another colour's), nor a later angle already on disk
            let k = keep.length + chosen.length + 1, name = `${p.id}-${k}${ext}`;
            while (usedFiles.has(`${IMG_REL}/${name}`) || (k > 1 && existsSync(path.join(IMG_DIR, name)))) name = `${p.id}-${++k}${ext}`;
            await writeFile(path.join(IMG_DIR, name), b);
            usedFiles.add(`${IMG_REL}/${name}`);
            chosen.push({ r, file: `${IMG_REL}/${name}` });
          } catch { /* try the next result */ }
        }
      }
      } catch (e) {
        if (!e.network) throw e;
        // the network let us down: this line is left for the next run (not marked "none"); stop if it stays down
        skipped += group.length;
        if (++downInARow >= 5) { console.log(`  ✗ the search API stopped answering (${e.message}): progress saved — run the same command again to continue`); break; }
        console.log(`    ! skipped ${p.brand || ''} ${p.name}: ${e.message} (searched again next run)`);
        continue;
      }
      downInARow = 0;
      if (chosen.length) {
        found += group.length;
        if (keep.length) extra += chosen.length;
        if (colorway) recolored += group.length;
        // where the photos came from: the first (kept, or new), and the further angles
        const more = chosen.slice(keep.length ? 0 : 1).map((c) => ({ image: c.r.image, page: c.r.page }));
        const base = keep.length
          ? { ...p.photoSource, more: [...((p.photoSource && p.photoSource.more) || []), ...more] }
          : { image: chosen[0].r.image, page: chosen[0].r.page, title: String(chosen[0].r.title || '').slice(0, 160), score: chosen[0].r.score, ...(more.length ? { more } : {}) };
        group.forEach((q, n) => {
          if (!DRY) {
            q.localImages = [...keep, ...chosen.map((c) => c.file)].slice(0, 6);
            q.photoSource = n ? { ...base, sharedFrom: base.sharedFrom || p.id } : base;
          }
          const refusedList = q.photoSearch && q.photoSearch.refused;
          q.photoSearch = { at, result: 'found', ...tried, ...(refusedList ? { refused: refusedList } : {}) };
        });
      } else if (group.some((q) => (q.localImages || []).length)) {
        // nothing new: what they show stays (another colour's photo beats a hologram), and they aren't searched again
        group.forEach((q) => mark(q, tried));
      } else { none += group.length; group.forEach((q) => mark(q, { result: 'none', ...tried })); }
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
    `<div class="c${p.photoSource.score < 6 ? ' lo' : ''}"><img src="${esc(rel + '/' + p.localImages[0])}" loading="lazy" alt=""><div class="n">${esc(p.brand)} — ${esc(p.name)}</div><div class="m">UPC ${esc(upcOf(p) || '—')} · <a href="${esc(p.photoSource.page)}" target="_blank">${esc((() => { try { return new URL(p.photoSource.page).hostname; } catch { return 'source'; } })())}</a> · score ${p.photoSource.score}${p.localImages.length > 1 ? ` · ${p.localImages.length} photos` : ''}${colorOf(p) ? ` · ${esc(colorOf(p))}` : ''}</div></div>`).join('')}</div>`);

  console.log(`\n✓ ${found} products given photos, ${none} not found, ${calls} searches used${skipped ? ` · ${skipped} skipped (the network failed; run again to search them)` : ''}`);
  if (GALLERY > 1 || COLORS || lent) console.log(`  ${extra ? `${extra} more angles added to photos already there · ` : ''}${COLORS ? `${recolored} variants given their own colour's photo · ` : ''}${lent} shared from a sibling (no search)`);
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
    const src = ps.find((p) => p.photoSource && !p.photoSource.sharedFrom) || ps.find((p) => p.photoSource);
    if (src && isHomePage(src.photoSource.page)) { takeDown.push({ file: f, products: ps, why: 'came from a site\'s home page (a banner, not this product\'s page)' }); continue; }
    // from a page listing many products, with nothing saying it is this one: searched again (by the rule that a
    // result must name the product); not refused, so the same picture can come back from the product's own page
    if (src && isListingPage(src.photoSource.page) && !namesProduct({ title: src.photoSource.title || '', page: src.photoSource.page, image: src.photoSource.image }, src, upcOf(src))) {
      takeDown.push({ file: f, products: ps, why: 'came from a listing page that doesn\'t name this product', keepUrl: true }); continue;
    }
    let why = null;
    try {
      const { data, info } = await sharp(path.resolve(root, f)).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      why = recheckProblem(info, framing(data, info.width, info.height, info.channels), whiteBorder(data, info.width, info.height, info.channels));
    } catch (e) { why = `unreadable (${e.message})`; }
    if (why) takeDown.push({ file: f, products: ps, why });
  }
  // galleries: an extra angle in another colour than the first photo (a white or FDE Vector among a black one's
  // photos) comes off; the first photo and the matching angles stay
  const gone = new Set(takeDown.map((t) => t.file));
  const galleries = new Map();
  for (const p of all) {
    const list = p.localImages || [];
    if (list.length < 2 || !p.photoSource || own(p) || gone.has(list[0])) continue;
    const k = list.join('|'); if (!galleries.has(k)) galleries.set(k, { list, products: [] }); galleries.get(k).products.push(p);
  }
  const trims = [];   // { list, drop: [indexes], products }
  const sharesOf = async (f) => { const { data, info } = await sharp(path.resolve(root, f)).flatten({ background: '#ffffff' }).removeAlpha().resize(240, 240, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true }); return colorShares(data, info.width, info.height, info.channels); };
  for (const g of galleries.values()) {
    const color = colorOf(g.products[0]);
    if (g.products.some((q) => colorOf(q).toLowerCase() !== color.toLowerCase())) continue;   // shared across colours: not ours to judge
    try {
      const s = []; for (const f of g.list) s.push(await sharesOf(f));
      const byListing = !!colorFamily(color) || isPlainBlack(color);
      // by the listing's colour every photo is judged, the first too; otherwise the extras against the first
      const ok = s.map((x, i) => (byListing ? galleryFits(color, x) : i === 0 || galleryFits(color, x, s[0])));
      const drop = ok.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      if (drop.length && drop.length < g.list.length) trims.push({ ...g, drop });              // none fits: left for a colour run
    } catch { /* a file gone: leave it */ }
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
        const refused = [...new Set([...((p.photoSearch && p.photoSearch.refused) || []), ...(p.photoSource && p.photoSource.image && !t.keepUrl ? [p.photoSource.image] : [])])].slice(-10);
        delete p.localImages; delete p.photoSource;
        p.photoSearch = { result: 'retake', refused };          // searched again next run (a wrong photo never again)
        if (ov[p.id] && ov[p.id].noPhoto) {                      // the hand-pulled flag goes with the photo
          delete ov[p.id].noPhoto; delete ov[p.id]._photo;
          if (!Object.keys(ov[p.id]).some((k) => !k.startsWith('_'))) delete ov[p.id];
        }
      }
      try { await unlink(path.resolve(root, t.file)); } catch { /* already gone */ }
    }
    for (const t of trims) {
      const dropped = t.drop.map((i) => t.list[i]);
      for (const p of t.products) {
        p.localImages = t.list.filter((_, i) => !t.drop.includes(i));
        // where the photos came from: list[0] is photoSource itself, list[j+1] is more[j]
        const src = [{ image: p.photoSource && p.photoSource.image, page: p.photoSource && p.photoSource.page }, ...((p.photoSource && p.photoSource.more) || [])];
        const kept = src.filter((_, i) => !t.drop.includes(i));
        if (p.photoSource) {
          const head = kept[0] || {};
          p.photoSource = { ...p.photoSource, image: head.image || p.photoSource.image, page: head.page || p.photoSource.page, more: kept.slice(1).filter((m) => m && m.image) };
          if (!p.photoSource.more.length) delete p.photoSource.more;
        }
      }
      const still = new Set(all.flatMap((p) => p.localImages || []));
      for (const f of dropped) if (!still.has(f)) { try { await unlink(path.resolve(root, f)); } catch { /* gone */ } }
    }
    for (const c of cats) await writeCatalog(c.f, c.list);
    if (takeDown.some((t) => t.pulled)) await writeFile(ovFile, JSON.stringify(ov, null, 2) + '\n');
  }
  if (trims.length) console.log(`${DRY ? '→ would take' : '✓ took'} ${trims.reduce((n, t) => n + t.drop.length, 0)} off-colour angles out of ${trims.length} galleries (${trims.reduce((n, t) => n + t.products.length, 0)} products keep their first photo)`);
  const pulled = takeDown.filter((t) => t.pulled).length;
  console.log(`${DRY ? '→ would take down' : '✓ took down'} ${takeDown.length} photos (${takeDown.length - pulled} failing the bar, ${pulled} pulled by hand), ${takeDown.reduce((n, t) => n + t.products.length, 0)} products back on the search list`);
  console.log(`  list: ${path.relative(root, sheet)}${DRY ? ' (open it to look; run again without --dry-run to take them down)' : ''}`);
  if (!DRY) console.log('  then: search again (--top), npm run build:catalog');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main();
