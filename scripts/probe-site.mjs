#!/usr/bin/env node
/* =============================================================================
 * probe-site.mjs — what is this store built on, and how are its pages shaped?
 *
 * Ported from the XAT Racing prober. Run it first against a new store: a cart
 * (WooCommerce, Shopify, BigCommerce, a gun-store platform) names its
 * products, prices, images and categories differently, and guessing costs a
 * wasted scrape. Added here: the exact product feeds scrape.mjs prefers (Woo
 * Store API, Shopify products.json) and gun-store platform fingerprints.
 * This reads, politely:
 *   robots.txt and the usual sitemap paths — how many product URLs exist
 *   the home page — platform fingerprints, navigation, link shapes
 *   one category page — how product links are formed
 *   one product page — JSON-LD, microdata, og:, the price, the cart form,
 *     the option selects, the description container candidates, images
 * and prints it all as evidence for the scraper's adapter. Report only.
 *
 * USAGE  node scripts/probe-site.mjs https://agarthanarmory.com/ [--chars 500]
 *            [--category <url>] [--product <url>]
 * The first run guesses a category and a product from the navigation; on a
 * store whose category pages carry the whole site menu (Yahoo Store does)
 * the guess lands on the home page, so the second run names them.
 * Runs from the probe-site workflow (the sandbox has no route to the store).
 * ===========================================================================*/
const args = process.argv.slice(2);
const val = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const CAT_URL = val('--category', ''), PROD_URL = val('--product', '');
const site = (args.find((a, i) => /^https?:/.test(a) && args[i - 1] !== '--category' && args[i - 1] !== '--product') || '').replace(/\/+$/, '');
const CHARS = parseInt(val('--chars', '500'), 10) || 500;
if (!site) { console.error('usage: node scripts/probe-site.mjs <https://store> [--chars N] [--category <url>] [--product <url>]'); process.exit(1); }

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const lines = [];
const say = (s = '') => { console.log(s); lines.push(s); };

async function get(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: ctl.signal });
    const text = await r.text();
    const h = {}; for (const k of ['server', 'x-powered-by', 'cf-ray', 'content-type', 'x-generator', 'via', 'x-cache', 'set-cookie', 'x-wp-total', 'x-wp-totalpages']) { const v = r.headers.get(k); if (v) h[k] = v.slice(0, 80); }
    return { status: r.status, text, headers: h, url: r.url };
  } catch (e) { return { status: 0, text: '', headers: {}, err: e.name === 'AbortError' ? 'timeout' : e.message }; }
  finally { clearTimeout(t); }
}

const origin = new URL(site).origin;
function links(html, base) {
  const out = []; const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html))) { try { const u = new URL(m[1], base); if (u.origin !== origin) continue; u.hash = ''; out.push({ href: u.toString(), text: squash(m[2].replace(/<[^>]*>/g, ' ')).slice(0, 60) }); } catch { /* skip */ } }
  return out;
}
const shapes = (urls) => { const c = {}; for (const u of urls) { const p = new URL(u).pathname; const s = p.replace(/[0-9]+/g, 'N').replace(/[a-z]+/gi, 'w'); c[s] = (c[s] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 12); };

say(`probe ${site}\n`);
/* platform + sitemap */
const robots = await get(`${site}/robots.txt`);
say(`robots.txt → ${robots.status}${robots.err ? ' ' + robots.err : ''} ${JSON.stringify(robots.headers)}`);
const declared = [...robots.text.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]);
say(`  declares: ${declared.join(', ') || '—'}`);
say(`  body: ${squash(robots.text).slice(0, 300)}`);
/* the exact feeds (what scrape.mjs tries first) */
for (const [label, url] of [['Woo Store API', `${site}/wp-json/wc/store/v1/products?per_page=2`], ['Shopify products.json', `${site}/products.json?limit=2`]]) {
  await sleep(400);
  const r = await get(url);
  let note = '';
  try { const j = JSON.parse(r.text); const list = Array.isArray(j) ? j : j.products; note = Array.isArray(list) ? `JSON list · ${list.length} item(s) · total header ${r.headers['x-wp-total'] || '—'} · first: ${squash(list[0] && (list[0].name || list[0].title)).slice(0, 80)}` : 'JSON, not a product list'; }
  catch { note = `not JSON (${squash(r.text).slice(0, 80)})`; }
  say(`${label} → ${r.status} ${note}`);
}
const sitemapCandidates = [...declared, `${site}/sitemap.xml`, `${site}/sitemap_index.xml`, `${site}/wp-sitemap.xml`, `${site}/product-sitemap.xml`, `${site}/xmlsitemap.php`, `${site}/sitemap.txt`, `${site}/sitemap1.xml`];
let productUrls = [];
for (const c of [...new Set(sitemapCandidates)]) {
  await sleep(400);
  const r = await get(c);
  const locs = [...r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
  say(`sitemap ${c} → ${r.status} ${r.text.length} bytes, ${locs.length} <loc>`);
  if (locs.length) {
    const subs = locs.filter((u) => /\.xml(\?|$)/i.test(u));
    say(`  sub-sitemaps: ${subs.length} ${subs.slice(0, 5).join(' ')}`);
    let all = locs.filter((u) => !/\.xml(\?|$)/i.test(u));
    for (const sm of subs.slice(0, 6)) { await sleep(400); const s = await get(sm); const inner = [...s.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]); say(`  ${sm} → ${s.status} ${inner.length} <loc>`); all = all.concat(inner.filter((u) => !/\.xml(\?|$)/i.test(u))); }
    productUrls = all;
    say(`  URL shapes (path with digits→N, words→w): ${JSON.stringify(shapes(all))}`);
    say(`  samples: ${all.slice(0, 8).join('\n           ')}`);
    break;
  }
}

/* home page */
await sleep(400);
const home = await get(`${site}/`);
say(`\nhome → ${home.status} ${home.text.length} bytes ${JSON.stringify(home.headers)} final ${home.url}`);
const title = squash((home.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]);
say(`  title: ${title}`);
const gen = home.text.match(/<meta[^>]+name=["']generator["'][^>]*content=["']([^"']+)/i);
say(`  generator: ${gen ? gen[1] : '—'}`);
const fp = {
  yahooTurbify: /turbify|yahoo\.net|ystore|sep\.turbifycdn|order\.store\.turbify|store\.yahoo/i.test(home.text),
  shopify: /cdn\.shopify\.com|Shopify\.theme|myshopify/i.test(home.text),
  bigcommerce: /bigcommerce|cdn11\.bigcommerce/i.test(home.text),
  woocommerce: /woocommerce|wp-content/i.test(home.text),
  xcart: /target=product|xcart|XLite/i.test(home.text),
  magento: /Magento|mage\/|static\/version/i.test(home.text),
  squarespace: /squarespace/i.test(home.text), wix: /wix\.com|wixstatic/i.test(home.text),
  // gun-store platforms and distributor-feed storefronts
  ammoready: /ammoready/i.test(home.text), gearfire: /gearfire/i.test(home.text),
  rapidGunSystems: /rapidgunsystems|rgs-/i.test(home.text), gunbrokerStore: /gunbroker\.com\/(?:store|item)/i.test(home.text),
  squareOnline: /square\.site|editmysite|weebly/i.test(home.text), godaddy: /godaddy|img1\.wsimg\.com/i.test(home.text),
  duda: /dudaone|multiscreensite|irp\.cdn-website/i.test(home.text), webflow: /webflow/i.test(home.text),
};
say(`  fingerprints: ${JSON.stringify(fp)}`);
// is the page built in the browser (an app shell) rather than served as HTML?
const fw = {
  next: /__NEXT_DATA__|\/_next\/static/.test(home.text), nuxt: /__NUXT__|\/_nuxt\//.test(home.text),
  react: /id=["'](root|app|__next)["']/.test(home.text), angular: /ng-version=|ng-app/.test(home.text),
  vue: /data-v-[0-9a-f]{6,}/.test(home.text), gatsby: /___gatsby/.test(home.text),
};
const textLen = squash(home.text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).length;
say(`  framework hints: ${JSON.stringify(fw)} · visible text ${textLen} chars of ${home.text.length}`);
const nd = home.text.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
if (nd) say(`  __NEXT_DATA__ (first ${CHARS}): ${squash(nd[1]).slice(0, CHARS)}`);
// API endpoints the page's own code mentions — an app shell loads products from one of these
const apis = [...new Set([...home.text.matchAll(/["'`]((?:https?:\/\/[^"'`\s]+)?\/(?:api|graphql|v1|v2|v3|rest|services|catalog|search)[^"'`\s]{0,80})["'`]/gi)].map((m) => m[1]))].slice(0, 15);
say(`  API endpoints mentioned: ${apis.length ? '\n    ' + apis.join('\n    ') : '—'}`);
const scripts = [...home.text.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
say(`  script hosts: ${[...new Set(scripts.map((s) => { try { return new URL(s, site).host; } catch { return s.slice(0, 30); } }))].slice(0, 10).join(', ')}`);
say(`  script files: ${scripts.slice(0, 8).map((s) => s.slice(0, 100)).join(' · ') || '—'}`);
const imgs = [...home.text.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
say(`  image hosts: ${[...new Set(imgs.map((s) => { try { return new URL(s, site).host; } catch { return s.slice(0, 30); } }))].slice(0, 8).join(', ')} · ${imgs.length} images`);
const hl = links(home.text, home.url || site);
const uniq = [...new Map(hl.map((l) => [l.href, l])).values()];
say(`  internal links: ${uniq.length} · shapes: ${JSON.stringify(shapes(uniq.map((l) => l.href)))}`);
say(`  nav sample:\n    ${uniq.slice(0, 40).map((l) => `${l.text || '(img)'} → ${l.href.replace(origin, '')}`).join('\n    ')}`);
// links that leave the site: where "Shop" really goes when the store lives
// on another platform or domain (a Gearfire store, a gunbroker page…)
const ext = {};
for (const m of home.text.matchAll(/<a\b[^>]*href=["'](https?:[^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
  let u; try { u = new URL(m[1]); } catch { continue; }
  if (u.origin === origin) continue;
  const e = (ext[u.host] = ext[u.host] || { n: 0, samples: [] });
  e.n++; if (e.samples.length < 3) e.samples.push(`${squash(m[2].replace(/<[^>]*>/g, ' ')).slice(0, 40) || '(img)'} → ${u.href.slice(0, 90)}`);
}
say(`  external link hosts: ${Object.keys(ext).length ? '' : '—'}${Object.entries(ext).sort((a, b) => b[1].n - a[1].n).slice(0, 12).map(([h, e]) => `\n    ${h} (${e.n}): ${e.samples.join(' | ')}`).join('')}`);

/* a category page: the first internal link that is not the home page and
 * looks like a section, then the product links on it */
const catLink = CAT_URL ? { href: CAT_URL, text: '(given)' } : uniq.find((l) => /\/[a-z0-9-]+\.html$/i.test(l.href) && !/index|home|cart|search|login|about|contact|privacy|terms|ship|return|faq/i.test(l.href)) || uniq.find((l) => l.href !== site + '/');
// links the home page carries too are the site menu, not the category's own
// products (a Yahoo Store repeats the whole menu on every page)
const menu = new Set(uniq.map((l) => l.href));
let productLink = null;
if (catLink) {
  await sleep(500);
  const cat = await get(catLink.href);
  say(`\ncategory ${catLink.href} → ${cat.status} ${cat.text.length} bytes`);
  say(`  title: ${squash((cat.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1])}`);
  const cl = [...new Map(links(cat.text, cat.url || catLink.href).map((l) => [l.href, l])).values()];
  const own = cl.filter((l) => !menu.has(l.href) && l.href !== catLink.href);
  say(`  links: ${cl.length} (${own.length} not on the home page) · shapes: ${JSON.stringify(shapes(cl.map((l) => l.href)))}`);
  // product-looking: not part of the site menu, and has a price near it or ends in a code-like .html
  const priced = own.filter((l) => /\$\s?\d/.test(l.text) || /\/[A-Za-z0-9-]{3,}\.html$/.test(l.href));
  say(`  product-looking links: ${priced.length}\n    ${priced.slice(0, 16).map((l) => `${l.text} → ${l.href.replace(origin, '')}`).join('\n    ')}`);
  // how a product is presented on the category page: the markup around the first product link
  if (priced[0]) { const at = cat.text.indexOf(priced[0].href.replace(origin, '')); if (at > 0) say(`  around the first product link: ${squash(cat.text.slice(Math.max(0, at - CHARS), at + CHARS))}`); }
  // what the category page says about the listing count and paging
  const pager = [...cat.text.matchAll(/<a\b[^>]*href=["']([^"']*(?:page|pg|start|offset|p)=\d+[^"']*)["']/gi)].map((m) => m[1]).slice(0, 4);
  say(`  paging links: ${pager.join(' ') || '—'}`);
  productLink = priced.find((l) => /\$\s?\d/.test(l.text)) || priced[0] || null;
}
if (PROD_URL) productLink = { href: PROD_URL };
if (!productLink && productUrls.length) productLink = { href: productUrls.find((u) => /\.html?$/.test(u)) || productUrls[0] };

/* the product page */
if (productLink) {
  await sleep(500);
  const p = await get(productLink.href);
  const html = p.text;
  say(`\nproduct ${productLink.href} → ${p.status} ${html.length} bytes`);
  say(`  title: ${squash((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1])}`);
  const metaD = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
  say(`  meta description: ${metaD ? squash(metaD[1]).slice(0, CHARS) : '—'}`);
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => squash(m[1].replace(/<[^>]*>/g, ' ')).slice(0, 120));
  say(`  h1: ${h1s.join(' | ') || '—'}`);
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => squash(m[1]).slice(0, CHARS));
  say(`  JSON-LD blocks: ${ld.length}\n    ${ld.join('\n    ')}`);
  const og = [...html.matchAll(/<meta[^>]+property=["'](og:[a-z:_]+|product:[a-z:_]+)["'][^>]*content=["']([^"']*)["']/gi)].map((m) => `${m[1]}=${m[2].slice(0, 100)}`);
  say(`  og/product meta: ${og.join(' | ') || '—'}`);
  const ip = [...html.matchAll(/itemprop=["']([a-z]+)["']/gi)].map((m) => m[1]);
  say(`  itemprops: ${[...new Set(ip)].join(', ') || '—'}`);
  const prices = [...html.matchAll(/\$\s?\d[\d,]*\.?\d{0,2}/g)].map((m) => m[0]).slice(0, 8);
  say(`  price strings: ${prices.join(' ') || '—'}`);
  // the markup around the first price: where the price lives and what labels it
  const firstPrice = html.search(/\$\s?\d[\d,]*\.\d{2}/);
  if (firstPrice > 0) say(`  around the first price: ${squash(html.slice(Math.max(0, firstPrice - CHARS), firstPrice + Math.floor(CHARS / 2)))}`);
  // "Code: XYZ" / "Part #" style label rows — Yahoo Store writes the item code this way
  const labels = [...html.replace(/<[^>]+>/g, ' ').matchAll(/\b(Code|Part\s*(?:No|Number|#)|SKU|Item\s*(?:No|#)|Brand|Manufacturer|Availability|Condition|Weight|Ships?)\s*:\s*([^\n]{1,60}?)(?=\s{2,}|\s[A-Z][a-z]+\s*:|$)/gm)].map((m) => `${m[1]}: ${squash(m[2])}`).slice(0, 10);
  say(`  label rows: ${[...new Set(labels)].join(' | ') || '—'}`);
  const forms = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].map((m) => {
    const action = (m[1].match(/action=["']([^"']+)["']/i) || [, '?'])[1].slice(0, 100);
    const hidden = [...m[2].matchAll(/<input[^>]+type=["']hidden["'][^>]*>/gi)].map((h) => { const n = (h[0].match(/name=["']([^"']+)["']/i) || [, '?'])[1]; const v = (h[0].match(/value=["']([^"']*)["']/i) || [, ''])[1]; return `${n}=${v.slice(0, 40)}`; });
    const buttons = [...m[2].matchAll(/<(?:input|button)[^>]+type=["'](?:submit|image)["'][^>]*>/gi)].map((b) => (b[0].match(/(?:value|alt|aria-label)=["']([^"']+)["']/i) || [, '(submit)'])[1]).slice(0, 3);
    return `${action} [${hidden.slice(0, 8).join(', ')}] → ${buttons.join('/')}`;
  });
  say(`  forms: ${forms.join('\n         ') || '—'}`);
  const selects = [...html.matchAll(/<select[^>]+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi)].map((m) => `${m[1]}: ${[...m[2].matchAll(/<option[^>]*>([^<]*)/gi)].map((o) => squash(o[1])).slice(0, 6).join(' / ')}`);
  say(`  selects (options): ${selects.join(' || ') || '—'}`);
  const pimgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]).filter((s) => !/\.(gif|svg)$/i.test(s)).slice(0, 8);
  say(`  images: ${pimgs.join(' ')}`);
  // the big picture: an <a> that wraps an image and points at an image file, or a lightbox/zoom hint
  const bigs = [...html.matchAll(/<a\b[^>]+href=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)].map((m) => m[1]).slice(0, 6);
  say(`  image links (full-size candidates): ${bigs.join(' ') || '—'}`);
  const zoom = html.match(/(?:data-zoom(?:-image)?|data-large|data-full|data-src|largeimage)=["']([^"']+)["']/i);
  say(`  zoom attribute: ${zoom ? zoom[0].slice(0, 160) : '—'}`);
  // the page's own structure: the first classes/ids of the body, in order, so the copy and option containers can be named
  const bodyAt = html.search(/<body\b/i);
  const skel = [...html.slice(bodyAt > 0 ? bodyAt : 0).matchAll(/<(div|table|td|section|form|span|ul|h[1-4])\b[^>]*?(?:id|class)=["']([^"']{1,40})["']/gi)].map((m) => `${m[1]}.${m[2].trim().split(/\s+/)[0]}`);
  const seen = new Set(); const skelU = skel.filter((s) => !seen.has(s) && seen.add(s)).slice(0, 60);
  say(`  body skeleton (first distinct classed elements): ${skelU.join(' ')}`);
  const tds = [...html.matchAll(/<table\b[^>]*?(?:id|class)=["']([^"']+)["']/gi)].map((m) => m[1].slice(0, 40));
  say(`  tables with id/class: ${[...new Set(tds)].slice(0, 12).join(' · ') || '—'}`);
  // embedded media: iframes and any YouTube id the page names (the scrape kept neither)
  const iframes = [...html.matchAll(/<iframe\b[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1].slice(0, 120));
  say(`  iframes: ${iframes.join(' ') || '—'}`);
  const yt = [...new Set([...html.matchAll(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{6,})/g)].map((m) => m[1]))];
  say(`  youtube ids: ${yt.join(' ') || '—'}`);
  // option controls that are not <select>: radio/checkbox groups the option parser would miss
  const radios = [...html.matchAll(/<input\b[^>]+type=["'](?:radio|checkbox)["'][^>]*>/gi)].map((m) => (m[0].match(/name=["']([^"']+)["']/i) || [, '?'])[1]);
  say(`  radio/checkbox inputs by name: ${JSON.stringify(Object.entries(radios.reduce((a, n) => { a[n] = (a[n] || 0) + 1; return a; }, {})).slice(0, 10))}`);
  const attrBlocks = [...html.matchAll(/<(?:div|ul|table|li)\b[^>]*(?:class|id)=["'][^"']*(?:attribute|product-option|variant|option-list|options|modifier)[^"']*["'][^>]*>/gi)].map((m) => m[0].slice(0, 100));
  say(`  option-ish containers: ${[...new Set(attrBlocks)].slice(0, 8).join(' · ') || '—'}`);
  // …and what is INSIDE them. A page can carry the option wrapper with no
  // <select> at all (a text field, a checkbox pair, a widget filled by
  // script, or nothing), and the wrapper's name alone cannot tell those
  // apart. The first attribute block's markup, scripts dropped, decides it.
  const attrOpen = html.match(/<(div|ul)\b[^>]*class=["'][^"']*\battribute-values\b[^"']*["'][^>]*>/i)
    || html.match(/<(div|ul)\b[^>]*class=["'][^"']*\beditable-attributes\b[^"']*["'][^>]*>/i);
  if (attrOpen) {
    const inner = html.slice(attrOpen.index + attrOpen[0].length).replace(/<script\b[\s\S]*?<\/script>/gi, '');
    say(`  inside the first attribute block: ${squash(inner).slice(0, Math.max(CHARS * 3, 1500))}`);
  }
  // every text/number field the cart form carries (an option typed in, not picked)
  const textInputs = [...html.matchAll(/<input\b[^>]+type=["'](?:text|number|tel)["'][^>]*>/gi)].map((m) => m[0].match(/name=["']([^"']+)["']/i)?.[1]).filter((n) => n && !/substring|search|zip|postal|qty|amount/i.test(n));
  say(`  text inputs by name: ${[...new Set(textInputs)].slice(0, 12).join(' · ') || '—'}`);
  const crumbs = html.match(/<(?:div|nav|ul|ol)[^>]+(?:class|id)=["'][^"']*(?:breadcrumb|crumb)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|nav|ul|ol)>/i);
  say(`  breadcrumb: ${crumbs ? squash(crumbs[1].replace(/<[^>]*>/g, ' ')).slice(0, 200) : '—'}`);
  const descs = [...html.matchAll(/<(div|span|td|p|section)[^>]+(?:class|id)=["']([^"']*(?:desc|caption|info|detail|overview|summary)[^"']*)["'][^>]*>/gi)].map((m) => `<${m[1]} ${m[2].slice(0, 50)}>`);
  say(`  description-ish containers: ${[...new Set(descs)].slice(0, 12).join(' · ') || '—'}`);
  // the biggest text block on the page — where the copy probably is
  const blocks = [...html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').matchAll(/<(div|td|p|section)\b[^>]*>([^<]{120,})/gi)].map((m) => squash(m[2])).sort((a, b) => b.length - a.length).slice(0, 3);
  say(`  longest text blocks:\n    ${blocks.map((b) => b.slice(0, CHARS)).join('\n    ')}`);
  say(`  head (first ${CHARS}): ${squash(html.slice(0, CHARS * 2)).slice(0, CHARS)}`);
}
if (process.env.GITHUB_STEP_SUMMARY) { const { appendFileSync } = await import('node:fs'); appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Site probe — ${site}\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`); }
