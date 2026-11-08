#!/usr/bin/env node
/* =============================================================================
 * scrape.mjs — pull the Agarthan Armory catalog (names, prices, descriptions,
 * specs, stock, categories, photos) from the live store.
 *
 * Lineage: the house scrapers, merged into one adaptive tool.
 *   PAMAX (WooCommerce original) → the Woo Store API feed
 *   PAMAX (BigCommerce port)     → sitemap discovery + JSON-LD per page
 *   XAT Racing (X-Cart port)     → microdata, og:/meta and DOM fallbacks,
 *                                  quote-safe meta reads, magic-byte image
 *                                  checks, polite pool + backoff
 *   the Shopify scraper          → /products.json feed
 * We don't know what agarthanarmory.com runs yet, so this tries the cheap,
 * exact feeds first and falls back to reading pages:
 *
 *   1. woo      /wp-json/wc/store/v1/products   (public, no key; exact prices)
 *   2. shopify  /products.json                  (public)
 *   3. sitemap  robots.txt / sitemap*.xml → product pages → JSON-LD Product
 *               → microdata → og:/product: meta → DOM heuristics
 *   4. crawl    polite same-site BFS from the home page when there is no sitemap
 *
 * Run `node scripts/probe-site.mjs <site>` first if a run comes back thin —
 * it prints the evidence (platform, page shapes) an adapter is written from.
 *
 * WHY A GITHUB ACTION: the Claude sandbox cannot reach the store (egress
 * proxy). GitHub's runners can — see .github/workflows/scrape-catalog.yml.
 * A store behind bot protection may block datacenter IPs too; then run this
 * same script from a normal connection: `npm run scrape`.
 *
 * WRITES (never on a failed or empty run — a bad run can't clobber good data):
 *   assets/data/scraped/catalog.json   normalized product records
 *   assets/data/scraped/categories.json
 *   assets/data/scraped/report.json    what happened: platform, counts, warnings
 *   assets/img/products/<slug>-<n>.<ext>  photos (magic-byte checked, capped)
 * then `node scripts/build-catalog.mjs` turns that into assets/data/catalog.js.
 *
 * USAGE
 *   node scripts/scrape.mjs --site https://agarthanarmory.com
 *     [--platform auto|woo|shopify|sitemap|crawl]  [--concurrency 3]
 *     [--max-images 6]  [--max-pages 3000]  [--limit 0]  [--delay 250]
 *     [--ignore-robots]  [--allow-shrink]  [--out assets/data/scraped]
 *
 * Node 18+ (built-in fetch). Zero npm dependencies.
 * ===========================================================================*/

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/* ---------- args (free-text workflow inputs arrive verbatim: validate) ---------- */
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const flag = (name) => argv.includes('--' + name);
const num = (name, def, min) => { const v = parseInt(arg(name, String(def)), 10); return Number.isFinite(v) && v >= min ? v : def; };

const SITE = String(arg('site', 'https://agarthanarmory.com')).trim().replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+/i.test(SITE)) { console.error(`✗ --site must be a URL, got "${SITE}"`); process.exit(1); }
const PLATFORM = ['auto', 'woo', 'shopify', 'sitemap', 'crawl'].includes(arg('platform', 'auto')) ? arg('platform', 'auto') : 'auto';
const CONCURRENCY = num('concurrency', 3, 1);
const MAX_IMAGES = num('max-images', 6, 0);
const MAX_PAGES = num('max-pages', 3000, 1);
const LIMIT = num('limit', 0, 0);
const DELAY = num('delay', 250, 0);
const MAX_IMAGE_BYTES = num('max-image-bytes', 4_000_000, 10_000);
const IGNORE_ROBOTS = flag('ignore-robots');
const ALLOW_SHRINK = flag('allow-shrink');
const OUT = path.resolve(arg('out', 'assets/data/scraped'));
const IMG_DIR = path.resolve(arg('img-dir', 'assets/img/products'));
const IMG_REL = path.relative(process.cwd(), IMG_DIR).split(path.sep).join('/');
const ORIGIN = new URL(SITE).origin;
const HOST = new URL(SITE).host.replace(/^www\./, '');

// Browser-like headers: stores behind bot protection 403 obvious bots.
const UA = arg('ua', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
const HTML_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};
const JSON_HEADERS = { 'User-Agent': UA, Accept: 'application/json' };
const WALL_RE = /just a moment|cf-browser-verification|challenge-platform|_cf_chl|turnstile|captcha|access denied|sucuri|incapsula|imperva|datadome|perimeterx|kasada/i;

const report = { site: SITE, startedAt: new Date().toISOString(), platform: null, tried: [], warnings: [], counts: {} };
const warn = (m) => { report.warnings.push(m); console.log('  ! ' + m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- fetch with timeout + backoff ---------- */
async function get(url, { json = false, tries = 3 } = {}) {
  for (let t = 1; ; t++) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 30000);
    let res;
    try { res = await fetch(url, { headers: json ? JSON_HEADERS : HTML_HEADERS, redirect: 'follow', signal: ctl.signal }); }
    catch (e) {
      clearTimeout(timer);
      if (t >= tries) throw new Error(e.name === 'AbortError' ? `timeout for ${url}` : `${e.message} for ${url}`);
      await sleep(1500 * t); continue;
    }
    clearTimeout(timer);
    if (res.ok) {
      const text = await res.text();
      return { status: res.status, url: res.url, text, headers: res.headers };
    }
    if (t >= tries || (res.status < 500 && res.status !== 429)) {
      const err = new Error(`HTTP ${res.status} for ${url}`); err.status = res.status; throw err;
    }
    const ra = +res.headers.get('retry-after');
    await sleep(ra > 0 && ra < 60 ? ra * 1000 : 1500 * t);
  }
}
async function getJson(url) {
  const r = await get(url, { json: true });
  try { return { ...r, data: JSON.parse(r.text) }; }
  catch { const e = new Error(`not JSON at ${url} (starts "${r.text.slice(0, 60).replace(/\s+/g, ' ')}")`); e.body = r.text; throw e; }
}

/** concurrency-capped pool with a per-worker delay (politeness) */
async function pool(items, limit, worker) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await worker(items[idx], idx); } catch (e) { out[idx] = { error: e.message }; }
      if (DELAY) await sleep(DELAY);
    }
  }));
  return out;
}

/* ---------- text helpers ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', reg: '®', trade: '™', copy: '©', deg: '°', frac12: '½', frac14: '¼', frac34: '¾', times: '×' };
const decode = (s) => String(s == null ? '' : s)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));
/** HTML → plain text, keeping paragraph and list breaks */
export const stripHtml = (html) => decode(String(html || '')
  .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n• ')
  .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol|section|table)>/gi, '\n')
  .replace(/<\/t[dh]>/gi, ' | ')
  .replace(/<[^>]+>/g, ' '))
  .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').replace(/ \| \n/g, '\n').trim();
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/%[0-9a-f]{2}/gi, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'item';
export const parsePrice = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  const n = m ? parseFloat(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const abs = (u, base = SITE) => { try { return new URL(decode(String(u)).trim(), base).toString(); } catch { return null; } };
const sameSite = (u) => { try { return new URL(u).host.replace(/^www\./, '') === HOST; } catch { return false; } };
const CALL_RE = /call (?:us )?for (?:price|pricing)|add to cart (?:to|for) (?:see|view)? ?(?:the )?price|see price in cart|price in cart|login (?:to|for) (?:see|view) price|request a quote/i;

/** availability (schema.org URL, Woo/Shopify flags, free text) → in|low|order|out|null */
export function normAvailability(v) {
  const s = String(v || '').toLowerCase();
  if (!s) return null;
  if (/outofstock|out of stock|sold ?out|soldout|discontinued|unavailable/.test(s)) return 'out';
  if (/limited|low stock|only \d+ left|few left/.test(s)) return 'low';
  if (/preorder|pre-order|backorder|back order|special order|on order|presale/.test(s)) return 'order';
  if (/instock|in stock|available/.test(s)) return 'in';
  return null;
}

/* ---------- robots.txt (User-agent: * rules), for HTML pages ---------- */
let robotsRules = [];
const robotsAllowed = (u) => {
  if (IGNORE_ROBOTS || !robotsRules.length) return true;
  const p = new URL(u).pathname + new URL(u).search;
  let best = null;
  for (const r of robotsRules) {
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(p) && (!best || r.path.length > best.path.length)) best = r;
  }
  return !best || best.allow;
};
function parseRobots(txt) {
  const rules = []; let applies = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const [k, ...rest] = line.split(':'); const v = rest.join(':').trim(); const key = k.toLowerCase();
    if (key === 'user-agent') applies = v === '*';
    else if (applies && (key === 'disallow' || key === 'allow') && v) rules.push({ path: v, allow: key === 'allow' });
  }
  return rules;
}

/* =============================================================================
 * ADAPTER 1 — WooCommerce Store API (public; what the shop's own blocks use)
 * ===========================================================================*/
function wooPrice(p) {
  const pr = p.prices || {};
  const k = Math.pow(10, pr.currency_minor_unit ?? 2);
  const n = (v) => (v == null || v === '' ? null : parsePrice(+v / k));
  const range = pr.price_range ? n(pr.price_range.min_amount) : null;
  return { price: n(pr.price) ?? range, regular: n(pr.regular_price), sale: n(pr.sale_price), currency: pr.currency_code || 'USD' };
}
function fromWoo(p) {
  const { price, regular, currency } = wooPrice(p);
  const attributes = {};
  for (const a of p.attributes || []) {
    const vals = (a.terms || []).map((t) => decode(t.name)).filter(Boolean);
    if (vals.length) attributes[decode(a.name)] = vals.join(', ');
  }
  const brands = (p.brands || []).map((b) => decode(b.name)).filter(Boolean);
  const avail = p.stock_availability && (p.stock_availability.class || p.stock_availability.text);
  const html = p.description || p.short_description || '';
  const priceNote = !price && CALL_RE.test(stripHtml(p.price_html || '') + ' ' + stripHtml(html)) ? 'Call for price' : null;
  return {
    source: 'woo-store-api',
    id: slugify(p.slug || p.name),
    name: squash(decode(p.name)),
    brand: brands[0] || attributes.Brand || attributes.Manufacturer || null,
    sku: p.sku || null,
    price, regularPrice: regular && price && regular > price ? regular : null, priceNote, currency,
    availability: p.is_on_backorder ? 'order' : normAvailability(avail) || (p.is_in_stock === false ? 'out' : p.is_in_stock ? (p.low_stock_remaining && p.low_stock_remaining <= 3 ? 'low' : 'in') : null),
    categories: (p.categories || []).map((c) => decode(c.name)).filter(Boolean),
    tags: (p.tags || []).map((t) => decode(t.name)).filter(Boolean),
    attributes,
    shortDescription: stripHtml(p.short_description).slice(0, 1200) || null,
    description: stripHtml(html).slice(0, 8000) || null,
    images: (p.images || []).map((im) => abs(im.src)).filter(Boolean).slice(0, 10),
    permalink: abs(p.permalink) || null,
    type: p.type || null,
  };
}
async function wooAdapter() {
  const first = await getJson(`${SITE}/wp-json/wc/store/v1/products?per_page=100&page=1`);
  if (!Array.isArray(first.data)) throw new Error('Store API answered, but not with a product list');
  const pages = Math.max(1, +first.headers.get('x-wp-totalpages') || 1);
  console.log(`  Woo Store API: ${first.headers.get('x-wp-total') || first.data.length} products over ${pages} page(s)`);
  let raw = first.data;
  for (let pg = 2; pg <= pages && (!LIMIT || raw.length < LIMIT); pg++) {
    await sleep(DELAY);
    const r = await getJson(`${SITE}/wp-json/wc/store/v1/products?per_page=100&page=${pg}`);
    if (!Array.isArray(r.data) || !r.data.length) break;
    raw = raw.concat(r.data);
  }
  const products = raw.map(fromWoo);
  // categories (site IA)
  let categories = [];
  try {
    const c = await getJson(`${SITE}/wp-json/wc/store/v1/products/categories?per_page=100`);
    if (Array.isArray(c.data)) categories = c.data.map((x) => ({ name: decode(x.name), slug: x.slug, count: x.count, url: abs(x.permalink) }));
  } catch (e) { warn(`categories: ${e.message}`); }
  // The Store API's description is the full copy, but some themes put the
  // spec table only on the page: read it for products with no attributes.
  const thin = products.filter((p) => !Object.keys(p.attributes).length && p.permalink);
  if (thin.length && thin.length <= 600) {
    console.log(`  reading ${thin.length} product pages for spec tables…`);
    await pool(thin, CONCURRENCY, async (p) => {
      if (!robotsAllowed(p.permalink)) return;
      const r = await get(p.permalink);
      Object.assign(p.attributes, specTable(r.text));
    });
  }
  return { products, categories };
}

/* =============================================================================
 * ADAPTER 2 — Shopify /products.json
 * ===========================================================================*/
async function shopifyAdapter() {
  let all = [];
  for (let page = 1; page <= 100; page++) {
    const r = await getJson(`${SITE}/products.json?limit=250&page=${page}`);
    const list = r.data && r.data.products;
    if (!Array.isArray(list)) throw new Error('products.json answered, but not with a product list');
    if (!list.length) break;
    all = all.concat(list);
    if (LIMIT && all.length >= LIMIT) break;
    await sleep(DELAY);
  }
  console.log(`  Shopify products.json: ${all.length} products`);
  const products = all.map((p) => {
    const v = (p.variants || [])[0] || {};
    const price = parsePrice(v.price), was = parsePrice(v.compare_at_price);
    const anyAvail = (p.variants || []).some((x) => x.available);
    const attributes = {};
    (p.options || []).forEach((o) => { if (o.name && o.name !== 'Title' && o.values && o.values.length) attributes[o.name] = o.values.join(', '); });
    return {
      source: 'shopify', id: slugify(p.handle || p.title), name: squash(decode(p.title)), brand: p.vendor || null,
      sku: v.sku || null, upc: v.barcode || null,
      price, regularPrice: was && price && was > price ? was : null, priceNote: null, currency: 'USD',
      availability: (p.variants || []).length ? (anyAvail ? 'in' : 'out') : null,
      categories: [p.product_type].filter(Boolean), tags: Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      attributes, description: stripHtml(p.body_html).slice(0, 8000) || null,
      images: (p.images || []).map((im) => abs(im.src)).filter(Boolean).slice(0, 10),
      permalink: `${SITE}/products/${p.handle}`,
    };
  });
  const categories = [...new Set(products.flatMap((p) => p.categories))].map((name) => ({ name }));
  return { products, categories };
}

/* =============================================================================
 * ADAPTER 3/4 — product pages (from the sitemap, or a crawl)
 * ===========================================================================*/
const locsOf = (xml) => [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decode(m[1].trim()));
const isSitemapUrl = (u) => /\.xml(\.gz)?(\?|$)|xmlsitemap\.php|sitemap/i.test(new URL(u).pathname + new URL(u).search) && !/\.(html?|php)$/i.test(new URL(u).pathname.replace(/xmlsitemap\.php$/, ''));
const BORING = /\/(cart|checkout|my-account|account|login|register|wp-admin|wp-login|wp-json|feed|tag|author|search|compare|wishlist|privacy|terms|policies|shipping|returns|refund|contact|about|faq|blog|news|events?|gallery|page\/\d+)(\/|$)|[?&](add-to-cart|orderby|filter_|s=|replytocom)|\.(jpe?g|png|gif|webp|svg|pdf|zip|mp4|css|js)$/i;
const PRODUCTISH = /\/(product|products|shop|p|item|items|firearms?|guns?|ammo|ammunition|optics|catalog|inventory)\/[^/]+|\.html?$|[?&](product_id|productid|pid)=/i;

async function discoverFromSitemaps() {
  const candidates = [...report.sitemapsDeclared, `${SITE}/sitemap_index.xml`, `${SITE}/sitemap.xml`, `${SITE}/wp-sitemap.xml`,
    `${SITE}/product-sitemap.xml`, `${SITE}/xmlsitemap.php`, `${SITE}/sitemap_products_1.xml`];
  const seen = new Set(); const productUrls = new Set(); const otherUrls = new Set();
  const queue = [...new Set(candidates)];
  while (queue.length && seen.size < 60) {
    const sm = queue.shift(); if (seen.has(sm)) continue; seen.add(sm);
    let body; try { body = (await get(sm, { tries: 2 })).text; } catch { continue; }
    if (!/<(urlset|sitemapindex)\b/i.test(body)) continue;
    const locs = locsOf(body);
    const subs = locs.filter((u) => { try { return isSitemapUrl(u); } catch { return false; } });
    const pages = locs.filter((u) => !subs.includes(u) && sameSite(u));
    // a product-typed sitemap (Yoast product-sitemap, WP wp-sitemap-posts-product, BigCommerce type=products, Shopify sitemap_products)
    const typed = /product/i.test(sm);
    console.log(`  ${sm.replace(ORIGIN, '')} → ${pages.length} pages${subs.length ? `, ${subs.length} sub-sitemaps` : ''}${typed ? ' (products)' : ''}`);
    pages.forEach((u) => (typed ? productUrls : otherUrls).add(u));
    // prefer product sub-sitemaps; skip images/video/post/page/category ones unless nothing else exists
    subs.sort((a, b) => /product/i.test(b) - /product/i.test(a)).forEach((u) => { if (!seen.has(u) && !/image|video|news/i.test(u)) queue.push(u); });
    await sleep(DELAY);
  }
  let urls = [...productUrls];
  if (!urls.length) urls = [...otherUrls].filter((u) => !BORING.test(u) && new URL(u).pathname !== '/');
  // product-looking first; the JSON-LD check rejects the rest
  urls.sort((a, b) => PRODUCTISH.test(b) - PRODUCTISH.test(a));
  return urls;
}

async function crawl(home) {
  const queue = [{ url: SITE + '/', html: home }]; const seen = new Set([SITE + '/']); const found = [];
  const pages = [];
  while (queue.length && seen.size <= MAX_PAGES) {
    const { url, html: pre } = queue.shift();
    let html = pre;
    if (!html) { if (!robotsAllowed(url)) continue; try { html = (await get(url, { tries: 2 })).text; } catch { continue; } await sleep(DELAY); }
    pages.push(url);
    if (isProductPage(html)) found.push({ url, html });
    for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
      const u = abs(m[1], url); if (!u || !sameSite(u)) continue;
      const clean = u.split('#')[0];
      if (seen.has(clean) || BORING.test(clean)) continue;
      seen.add(clean);
      // product-looking links jump the queue
      if (PRODUCTISH.test(clean)) queue.unshift({ url: clean }); else queue.push({ url: clean });
    }
    if (LIMIT && found.length >= LIMIT) break;
  }
  console.log(`  crawled ${pages.length} pages, ${found.length} product pages`);
  return found;
}

/* ---------- product page reading ---------- */
function jsonLdBlocks(html) {
  const out = [];
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    out.push(n);
    if (n['@graph']) visit(n['@graph']);
    if (n.hasVariant) visit(n.hasVariant);
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(m[1].trim().replace(/^<!--|-->$/g, ''))); } catch { /* malformed block */ }
  }
  return out;
}
const isType = (b, t) => b && (b['@type'] === t || (Array.isArray(b['@type']) && b['@type'].includes(t)));
function microdata(html) {
  const at = html.search(/itemtype=["'][^"']*schema\.org\/Product["']/i);
  if (at < 0) return null;
  const scope = html.slice(at, at + 40000);
  const prop = (name) => {
    // value lives in content= (meta), href= (link: availability), or the element's text
    const m = scope.match(new RegExp(`itemprop=["']${name}["'][^>]*?(?:(?:content|href)=(["'])([\\s\\S]*?)\\1[^>]*)?>([^<]*)`, 'i'));
    return m ? squash(decode(m[2] || m[3] || '')) || null : null;
  };
  return { name: prop('name'), sku: prop('sku') || prop('mpn'), brand: prop('brand'), price: prop('price'), availability: prop('availability'), description: prop('description') };
}
function isProductPage(html) {
  if (jsonLdBlocks(html).some((b) => isType(b, 'Product') || isType(b, 'ProductGroup'))) return true;
  if (/itemtype=["'][^"']*schema\.org\/Product["']/i.test(html)) return true;
  if (/<meta[^>]+property=["']og:type["'][^>]+content=["'](?:og:)?product["']/i.test(html)) return true;
  // Woo / BigCommerce / generic add-to-cart forms on a single-product page
  return /<body[^>]+class=["'][^"']*\bsingle-product\b/i.test(html) || /<form[^>]+class=["'][^"']*\b(cart|productView-form|product-form)\b[^"']*["'][\s\S]{0,4000}?(add-to-cart|add_to_cart|addToCart)/i.test(html);
}
/** label/value spec rows: Woo attributes table, <dl> lists, BigCommerce productView-info, generic spec tables */
export function specTable(html) {
  const out = {};
  const add = (k, v) => {
    k = squash(stripHtml(k)).replace(/:$/, ''); v = squash(stripHtml(v));
    if (k && v && k.length <= 40 && v.length <= 200 && !/^(qty|quantity|price|share|rating|reviews?)$/i.test(k) && !(k in out)) out[k] = v;
  };
  const scopes = [];
  for (const m of html.matchAll(/<table[^>]*(?:class|id)=["'][^"']*(?:attributes|spec|detail|additional|product-info)[^"']*["'][^>]*>([\s\S]*?)<\/table>/gi)) scopes.push(m[1]);
  for (const s of scopes) for (const r of s.matchAll(/<tr[^>]*>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)) add(r[1], r[2]);
  for (const m of html.matchAll(/<dl[^>]*(?:class|id)=["'][^"']*(?:spec|detail|attribute|productView-info|product-info)[^"']*["'][^>]*>([\s\S]*?)<\/dl>/gi))
    for (const r of m[1].matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) add(r[1], r[2]);
  // "Caliber: 9mm" lines inside the description area (common on gun-store listings)
  const known = /^(caliber|calibre|gauge|capacity|barrel(?: length)?|action|finish|frame|sights?|safety|weight|overall length|length|twist(?: rate)?|magazines? included|chamber|model|mpn|upc|manufacturer|brand|condition)$/i;
  for (const r of stripHtml(html).matchAll(/^\s*([A-Za-z][A-Za-z ]{2,24}):\s*(.{1,80})$/gm)) if (known.test(r[1].trim())) add(r[1], r[2]);
  return out;
}
function descriptionBlock(html) {
  const m = html.match(/<(?:div|section)[^>]+(?:class|id)=["'][^"']*\b(woocommerce-Tabs-panel--description|tab-description|woocommerce-product-details__short-description|product-description|productView-description|product__description|product-single__description|product_description|description-tab|rte|descr)\b[^"']*["'][^>]*>/i)
    || html.match(/<[^>]+itemprop=["']description["'][^>]*>/i);
  if (!m) return '';
  const start = m.index + m[0].length; const win = html.slice(start, start + 60000);
  const stop = win.search(/<(?:footer|nav)\b|class=["'][^"']*(?:related|upsells|reviews|woocommerce-tabs\b(?!-panel)|breadcrumb|footer|newsletter)[^"']*["']/i);
  return stripHtml((stop > 200 ? win.slice(0, stop) : win).replace(/<[^>]*$/, ''));
}
export function readProductPage(html, url) {
  const pick = (re) => { const m = html.match(re); if (!m) return null; for (let i = m.length - 1; i >= 1; i--) if (m[i]) return decode(m[i]).trim(); return null; };
  const blocks = jsonLdBlocks(html);
  const ld = blocks.find((b) => isType(b, 'Product')) || blocks.find((b) => isType(b, 'ProductGroup'));
  const md = microdata(html);
  let offers = ld && ld.offers; if (Array.isArray(offers)) offers = offers[0]; if (offers && offers['@type'] === 'AggregateOffer') offers = { ...offers, price: offers.lowPrice ?? offers.price };
  const meta = (prop) => pick(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=(["'])([\\s\\S]*?)\\1`, 'i')) ||
    pick(new RegExp(`<meta[^>]+content=(["'])([\\s\\S]*?)\\1[^>]+(?:property|name)=["']${prop}["']`, 'i'));
  const name = squash(decode((ld && ld.name) || (md && md.name) || meta('og:title') || pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g, '') || pick(/<title>([^<]+)<\/title>/i) || ''))
    .replace(/\s*[|–—-]\s*Agarthan\s*Armory.*$/i, '');
  // price: structured first; a page-wide "price": regex grabs unrelated JSON — never used
  const domPrice = pick(/<(?:p|span|div)[^>]+class=["'][^"']*\b(?:price|product-price|productView-price|price--withoutTax)\b[^"']*["'][^>]*>[\s\S]{0,300}?(?:<bdi>|<span[^>]*amount[^>]*>)?\s*(?:<span[^>]*currencySymbol[^>]*>[^<]*<\/span>)?\s*\$?\s*([\d,]+\.\d{2})/i);
  const price = parsePrice(offers && offers.price) ?? parsePrice(md && md.price) ?? parsePrice(meta('product:price:amount')) ?? parsePrice(meta('og:price:amount')) ?? parsePrice(domPrice);
  const delPrice = parsePrice(pick(/<del[^>]*>[\s\S]{0,200}?\$\s*([\d,]+\.\d{2})/i));
  const text = stripHtml(html);
  const priceNote = !price && CALL_RE.test(text) ? 'Call for price' : null;
  // images: JSON-LD → og:image → gallery links (Woo data-large_image, zoom attrs)
  let imgs = [];
  if (ld && ld.image) imgs.push(...(Array.isArray(ld.image) ? ld.image : [ld.image]).map((im) => (im && (im.url || im.contentUrl)) || im));
  imgs.push(meta('og:image'));
  for (const m of html.matchAll(/(?:data-large_image|data-zoom-image|data-zoom|data-full|data-src-large|data-image-large)=["']([^"']+)["']/gi)) imgs.push(m[1]);
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+\.(?:jpe?g|png|webp))(?:\?[^"']*)?["'][^>]*>\s*<img/gi)) imgs.push(m[1]);
  imgs = [...new Set(imgs.filter(Boolean).map((u) => abs(u, url)).filter(Boolean))]
    .filter((u) => !/logo|icon|placeholder|spinner|loader|payment|badge|banner|sprite|gravatar|woocommerce-placeholder/i.test(u)).slice(0, 10);
  // categories: BreadcrumbList → breadcrumb DOM → Woo posted_in
  const crumbs = blocks.find((b) => isType(b, 'BreadcrumbList'));
  let categories = ((crumbs && crumbs.itemListElement) || []).map((el) => decode((el.item && el.item.name) || el.name)).filter(Boolean);
  if (!categories.length) {
    const bc = html.match(/class=["'][^"']*breadcrumbs?[^"']*["'][\s\S]{0,3000}?<\/(?:nav|ol|ul|div)>/i);
    if (bc) categories = [...bc[0].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => squash(stripHtml(m[1])));
  }
  if (!categories.length) {
    const pin = html.match(/class=["']posted_in["'][^>]*>([\s\S]*?)<\/span>/i);
    if (pin) categories = [...pin[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map((m) => decode(m[1]));
  }
  categories = [...new Set(categories.map(squash))].filter((c) => c && !/^(home|shop|products?|all products)$/i.test(c) && c !== name).slice(0, 6);
  const block = descriptionBlock(html);
  const teaser = stripHtml((ld && ld.description) || (md && md.description) || meta('description') || meta('og:description') || '');
  const brandRaw = ld && ld.brand ? (ld.brand.name || ld.brand) : (md && md.brand) || null;
  const avail = (offers && offers.availability) || (md && md.availability) ||
    (/\bout of stock\b/i.test(text.slice(0, 20000)) ? 'outofstock' : /\bin stock\b/i.test(text.slice(0, 20000)) ? 'instock' : '');
  return {
    source: ld ? 'jsonld' : md ? 'microdata' : 'dom',
    id: slugify(new URL(url).pathname.replace(/\/+$/, '').split('/').pop().replace(/\.html?$/, '') || name),
    name,
    brand: typeof brandRaw === 'string' ? squash(decode(brandRaw)) : null,
    sku: (ld && (ld.sku || ld.mpn)) || (md && md.sku) || pick(/\bSKU\b\s*:?\s*(?:<[^>]*>\s*)*([A-Za-z0-9][\w.\-/]{1,40})/i) || null,
    upc: (ld && (ld.gtin12 || ld.gtin13 || ld.gtin)) || null,
    price, regularPrice: delPrice && price && delPrice > price ? delPrice : null, priceNote,
    currency: (offers && offers.priceCurrency) || meta('product:price:currency') || 'USD',
    availability: normAvailability(avail),
    categories, tags: [],
    attributes: specTable(html),
    description: (block.length >= 200 || block.length > teaser.length ? block : teaser).slice(0, 8000) || null,
    images: imgs,
    permalink: url,
  };
}
async function pagesAdapter(mode, home) {
  let pages = [];
  if (mode === 'sitemap') {
    let urls = await discoverFromSitemaps();
    if (!urls.length) throw new Error('no sitemap with product URLs');
    urls = urls.filter(robotsAllowed).slice(0, LIMIT || MAX_PAGES);
    console.log(`  reading ${urls.length} candidate pages (concurrency ${CONCURRENCY})…`);
    let done = 0;
    const got = await pool(urls, CONCURRENCY, async (u) => {
      const r = await get(u, { tries: 2 });
      if (++done % 50 === 0) console.log(`    ${done}/${urls.length}`);
      return isProductPage(r.text) ? { url: r.url || u, html: r.text } : null;
    });
    const errs = got.filter((g) => g && g.error).length;
    if (errs) warn(`${errs} pages failed to load`);
    pages = got.filter((g) => g && g.html);
  } else {
    pages = await crawl(home);
  }
  const products = pages.map((p) => readProductPage(p.html, p.url)).filter((p) => p.name);
  const categories = [...new Set(products.flatMap((p) => p.categories))].map((name) => ({ name }));
  return { products, categories };
}

/* ---------- images ---------- */
const extOf = (u, buf) => {
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return '.png';
  if (buf.subarray(0, 4).toString() === 'RIFF') return '.webp';
  if (buf.subarray(0, 4).toString() === 'GIF8') return '.gif';
  return (String(u).split('?')[0].match(/\.(jpe?g|png|webp|gif)$/i) || [, 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg').replace(/^/, '.');
};
async function download(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8', Referer: SITE + '/' }, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) throw new Error(`too large (${(buf.length / 1e6).toFixed(1)} MB)`);
    // magic bytes: a CDN can serve an HTML block page with a 200 — never save one as a photo
    const isImage = (buf[0] === 0xff && buf[1] === 0xd8) || (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ||
      buf.subarray(0, 4).toString() === 'GIF8' || (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP');
    if (!isImage) throw new Error('not an image (bot block page?)');
    return buf;
  } finally { clearTimeout(t); }
}

/* =============================================================================
 * main
 * ===========================================================================*/
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) (async () => {
  console.log(`\n→ ${SITE}  (platform: ${PLATFORM}, concurrency ${CONCURRENCY}, images ${MAX_IMAGES}/product)`);
  report.sitemapsDeclared = [];
  try {
    const robots = await get(`${SITE}/robots.txt`, { tries: 2 });
    robotsRules = parseRobots(robots.text);
    report.sitemapsDeclared = [...robots.text.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]);
    console.log(`  robots.txt: ${robotsRules.length} rules for *${report.sitemapsDeclared.length ? `, sitemaps: ${report.sitemapsDeclared.join(' ')}` : ''}${IGNORE_ROBOTS ? ' (ignored: --ignore-robots)' : ''}`);
  } catch (e) { console.log(`  robots.txt: ${e.message}`); }

  let home = '';
  try {
    const r = await get(`${SITE}/`);
    home = r.text;
    const wall = home.match(WALL_RE);
    if (wall && home.length < 40000) {
      console.error(`\n✗ The store answered with a bot-protection page ("${wall[0]}"). Datacenter IPs (GitHub runners) are often blocked.`);
      console.error('  Run the same command from a normal connection instead:  npm run scrape -- --site ' + SITE);
      process.exit(2);
    }
  } catch (e) {
    console.error(`\n✗ Could not load ${SITE}/ — ${e.message}`); process.exit(1);
  }
  const fp = {
    woo: /woocommerce|wp-content\/plugins\/woocommerce|wc-block/i.test(home),
    wordpress: /wp-content|wp-includes/i.test(home),
    shopify: /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i.test(home),
    bigcommerce: /cdn11\.bigcommerce|bigcommerce\.com|stencil-utils/i.test(home),
  };
  report.fingerprints = fp;
  console.log(`  fingerprints: ${Object.entries(fp).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none recognised'}`);

  // the exact feeds are cheap to ask for (a 404 costs one request), so they go first
  const order = PLATFORM !== 'auto' ? [PLATFORM] : fp.shopify ? ['shopify', 'woo', 'sitemap', 'crawl'] : ['woo', 'shopify', 'sitemap', 'crawl'];
  let result = null;
  for (const mode of [...new Set(order)]) {
    console.log(`\n→ trying ${mode}…`);
    try {
      result = mode === 'woo' ? await wooAdapter() : mode === 'shopify' ? await shopifyAdapter() : await pagesAdapter(mode, home);
      report.tried.push({ mode, products: result.products.length });
      if (result.products.length) { report.platform = mode; break; }
      console.log('  (no products this way)');
    } catch (e) {
      report.tried.push({ mode, error: e.message });
      console.log(`  ✗ ${e.message}`);
    }
  }
  if (!result || !result.products.length) {
    console.error('\n✗ No products found by any method. Nothing was written.');
    console.error('  Next step: node scripts/probe-site.mjs ' + SITE + '   (prints how the store\'s pages are built)');
    process.exit(1);
  }

  /* dedupe + limit */
  const byId = new Map();
  for (const p of result.products) {
    let id = p.id || slugify(p.name), n = 2;
    while (byId.has(id) && byId.get(id).permalink !== p.permalink) id = `${p.id}-${n++}`;
    if (!byId.has(id)) byId.set(id, { ...p, id });
  }
  let products = [...byId.values()];
  if (LIMIT) products = products.slice(0, LIMIT);

  /* safety fuse: a run that finds far fewer products than the last good one
   * is more likely a broken run (bot wall, theme change) than a store that
   * lost half its stock — keep the old data unless told otherwise */
  try {
    const prev = JSON.parse(await readFile(path.join(OUT, 'catalog.json'), 'utf8'));
    if (Array.isArray(prev) && prev.length >= 10 && products.length < prev.length * 0.5 && !ALLOW_SHRINK && !LIMIT) {
      console.error(`\n✗ Found ${products.length} products, the last good run had ${prev.length}. Not overwriting.`);
      console.error('  If the store really shrank, re-run with --allow-shrink.');
      process.exit(1);
    }
  } catch { /* no previous run */ }

  /* images */
  await mkdir(IMG_DIR, { recursive: true });
  const jobs = [];
  for (const p of products) { p.localImages = []; if (MAX_IMAGES) p.images.slice(0, MAX_IMAGES).forEach((src, n) => jobs.push({ p, src, n })); }
  if (jobs.length) {
    console.log(`\n→ downloading ${jobs.length} images (concurrency ${CONCURRENCY})…`);
    let ok = 0, fail = 0;
    await pool(jobs, CONCURRENCY, async (j) => {
      try {
        const buf = await download(j.src);
        const file = `${j.p.id}-${j.n + 1}${extOf(j.src, buf)}`;
        await writeFile(path.join(IMG_DIR, file), buf);
        j.p.localImages[j.n] = `${IMG_REL}/${file}`; ok++;
      } catch (e) { fail++; if (fail <= 20) console.log(`  ✗ ${j.src} — ${e.message}`); }
    });
    products.forEach((p) => { p.localImages = p.localImages.filter(Boolean); });
    console.log(`  ✓ ${ok} saved, ${fail} failed`);
    report.counts.images = ok; report.counts.imageFailures = fail;
  }

  /* write */
  const at = new Date().toISOString();
  products.forEach((p, i) => { p.rank = i; p.scrapedAt = at; });
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'catalog.json'), JSON.stringify(products, null, 2) + '\n');
  await writeFile(path.join(OUT, 'categories.json'), JSON.stringify(result.categories || [], null, 2) + '\n');
  Object.assign(report.counts, {
    products: products.length,
    withPrice: products.filter((p) => p.price != null).length,
    callForPrice: products.filter((p) => p.priceNote).length,
    withDescription: products.filter((p) => p.description).length,
    withSpecs: products.filter((p) => Object.keys(p.attributes || {}).length).length,
    withImages: products.filter((p) => (p.localImages || []).length || p.images.length).length,
  });
  report.finishedAt = at;
  await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const c = report.counts;
  console.log(`\n✓ ${c.products} products via ${report.platform} — ${c.withPrice} priced, ${c.callForPrice} call-for-price, ${c.withDescription} with descriptions, ${c.withSpecs} with spec rows`);
  console.log(`  wrote ${path.relative(process.cwd(), OUT)}/catalog.json · categories.json · report.json`);
  console.log('  next: node scripts/build-catalog.mjs   (→ assets/data/catalog.js, what the site shows)');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Catalog scrape — ${SITE}\n\n| | |\n|---|---|\n| Method | ${report.platform} |\n| Products | ${c.products} |\n| Priced | ${c.withPrice} |\n| Call for price | ${c.callForPrice} |\n| Descriptions | ${c.withDescription} |\n| Spec rows | ${c.withSpecs} |\n| Images saved | ${c.images ?? 0} |\n${report.warnings.length ? '\n**Warnings**\n\n' + report.warnings.map((w) => '- ' + w).join('\n') + '\n' : ''}`);
  }
})().catch((e) => { console.error('\n✗ ' + (e && e.stack || e)); process.exit(1); });
