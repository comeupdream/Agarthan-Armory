#!/usr/bin/env node
/* =============================================================================
 * test-scrape.mjs — proves scrape.mjs + build-catalog.mjs against mock stores
 * on localhost, no network: a WooCommerce store (Store API, paging, minor-unit
 * prices, call-for-price, spec table read from the page, a fake "image" that
 * is really an HTML block page), a Shopify store, a sitemap + JSON-LD /
 * microdata / og-only store with a robots.txt rule, a store with no sitemap
 * (crawl), a bot wall, and the shrink fuse. Then the classifier on names a gun
 * store actually lists.        node scripts/test-scrape.mjs
 * ===========================================================================*/
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildItems, classify, iconFor, specsFor, loadScraped } from './build-catalog.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRAPE = path.join(HERE, 'scrape.mjs');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

/* ---------- mock stores ---------- */
function serve(routes) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      const r = routes[u.pathname + u.search] ?? routes[u.pathname];
      if (r == null) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<h1>404</h1>'); }
      const v = typeof r === 'function' ? r(u) : r;
      const { body, type = 'text/html', headers = {} } = typeof v === 'string' || Buffer.isBuffer(v) ? { body: v } : v;
      res.writeHead(200, { 'Content-Type': type, ...headers });
      res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    }).listen(0, '127.0.0.1', () => resolve({ server: s, url: `http://127.0.0.1:${s.address().port}` }));
  });
}
const page = (head, body) => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

const wooProducts = (base) => [
  { id: 1, name: 'Glock 19 Gen 5 9mm 4.02&quot; 15rd', slug: 'glock-19-gen-5', permalink: `${base}/product/glock-19-gen-5/`, sku: 'PA195S203',
    prices: { price: '54900', regular_price: '59900', sale_price: '54900', currency_code: 'USD', currency_minor_unit: 2 },
    description: '<p>The compact everyone measures against.</p><ul><li>nDLC finish</li><li>Flared magwell</li></ul>', short_description: '',
    images: [{ src: `${base}/img/g19-1.jpg` }, { src: `${base}/img/g19-2.jpg` }], categories: [{ name: 'Handguns', slug: 'handguns' }], tags: [],
    brands: [{ name: 'Glock' }], attributes: [{ name: 'Caliber', terms: [{ name: '9mm Luger' }] }, { name: 'Capacity', terms: [{ name: '15+1' }] }],
    is_in_stock: true, low_stock_remaining: null },
  { id: 2, name: 'Federal Power-Shok 12 ga 2-3/4&quot; 00 Buck 5rd', slug: 'federal-power-shok-00', permalink: `${base}/product/federal-power-shok-00/`,
    sku: '', prices: { price: '799', regular_price: '799', currency_code: 'USD', currency_minor_unit: 2 },
    description: '', short_description: '<p>Proven buckshot.</p>', images: [{ src: `${base}/img/blocked.jpg` }], categories: [{ name: 'Shotgun Ammo' }],
    tags: [], attributes: [], is_in_stock: true, low_stock_remaining: 2 },
];
const wooPage2 = (base) => [
  { id: 3, name: 'Benelli M4 Tactical 12 Gauge', slug: 'benelli-m4-tactical', permalink: `${base}/product/benelli-m4-tactical/`, sku: '11707',
    prices: { price: '', regular_price: '', currency_code: 'USD', currency_minor_unit: 2 }, price_html: '<span>Call for price</span>',
    description: '<p>Semi-auto. Call for price.</p>', images: [], categories: [{ name: 'Shotguns' }], tags: [], attributes: [], is_in_stock: false },
];

/* ---------- run helpers ---------- */
// async on purpose: the mock stores live in THIS process, and a sync spawn
// would block the very event loop that has to answer the scraper
function run(site, extra = [], cwd) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [SCRAPE, '--site', site, '--delay', '0', '--concurrency', '2',
      '--out', path.join(cwd, 'scraped'), '--img-dir', path.join(cwd, 'img'), ...extra], { cwd });
    let out = '';
    c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
    const t = setTimeout(() => c.kill(), 60000);
    c.on('close', (code) => { clearTimeout(t); resolve({ code, out }); });
  });
}
const read = (cwd) => JSON.parse(readFileSync(path.join(cwd, 'scraped', 'catalog.json'), 'utf8'));
const tmp = () => mkdtempSync(path.join(tmpdir(), 'aa-scrape-'));

(async () => {
  /* ---------- 1. WooCommerce ---------- */
  console.log('woo store');
  const woo = await serve({});
  woo.server.removeAllListeners('request');   // routes need the port, so they are attached below
  const wb = woo.url;
  const wooRoutes = {
    '/': page('<link rel="stylesheet" href="/wp-content/plugins/woocommerce/assets/css/woocommerce.css">', '<a href="/shop/">Shop</a>'),
    '/robots.txt': { body: 'User-agent: *\nDisallow: /wp-admin/\n', type: 'text/plain' },
    '/wp-json/wc/store/v1/products?per_page=100&page=1': { body: wooProducts(wb), type: 'application/json', headers: { 'X-WP-Total': '3', 'X-WP-TotalPages': '2' } },
    '/wp-json/wc/store/v1/products?per_page=100&page=2': { body: wooPage2(wb), type: 'application/json', headers: { 'X-WP-Total': '3', 'X-WP-TotalPages': '2' } },
    '/wp-json/wc/store/v1/products/categories?per_page=100': { body: [{ name: 'Handguns', slug: 'handguns', count: 1, permalink: `${wb}/c/handguns/` }], type: 'application/json' },
    '/product/federal-power-shok-00/': page('', '<table class="woocommerce-product-attributes shop_attributes"><tr><th>Gauge</th><td>12 ga</td></tr><tr><th>Rounds</th><td>5</td></tr></table>'),
    '/product/benelli-m4-tactical/': page('', '<table class="woocommerce-product-attributes"><tr><th>Barrel Length</th><td>18.5 in</td></tr></table>'),
    '/img/g19-1.jpg': { body: JPEG, type: 'image/jpeg' },
    '/img/g19-2.jpg': { body: JPEG, type: 'image/jpeg' },
    '/img/blocked.jpg': { body: '<html>Access denied</html>', type: 'image/jpeg' },
  };
  woo.server.on('request', (req, res) => {
    const u = new URL(req.url, 'http://x'); const r = wooRoutes[u.pathname + u.search] ?? wooRoutes[u.pathname];
    if (r == null) { res.writeHead(404); return res.end(); }
    const { body, type = 'text/html', headers = {} } = typeof r === 'string' || Buffer.isBuffer(r) ? { body: r } : r;
    res.writeHead(200, { 'Content-Type': type, ...headers }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  });
  let d = tmp();
  let r = await run(wb, [], d);
  ok(r.code === 0, 'woo run exits 0\n' + r.out);
  if (r.code === 0) {
    const c = read(d);
    eq(c.length, 3, 'woo: both pages read');
    const g = c.find((p) => p.id === 'glock-19-gen-5');
    eq(g && g.price, 549, 'woo: minor-unit price → dollars');
    eq(g && g.regularPrice, 599, 'woo: regular price kept when on sale');
    eq(g && g.brand, 'Glock', 'woo: brand from brands[]');
    eq(g && g.attributes.Caliber, '9mm Luger', 'woo: attributes → specs');
    ok(g && g.description.includes('• Flared magwell'), 'woo: description keeps list items');
    eq(g && g.localImages.length, 2, 'woo: photos saved');
    const f = c.find((p) => p.id === 'federal-power-shok-00');
    eq(f && f.localImages.length, 0, 'woo: an HTML "image" is refused (magic bytes)');
    eq(f && f.availability, 'low', 'woo: low_stock_remaining → low');
    eq(f && f.attributes.Gauge, '12 ga', 'woo: spec table read from the product page');
    eq(f && f.sku, null, 'woo: empty SKU stays null (never invented)');
    const b = c.find((p) => p.id === 'benelli-m4-tactical');
    eq(b && b.price, null, 'woo: empty price → null');
    eq(b && b.priceNote, 'Call for price', 'woo: call-for-price detected');
    eq(b && b.availability, 'out', 'woo: is_in_stock false → out');
    ok(JSON.parse(readFileSync(path.join(d, 'scraped', 'report.json'), 'utf8')).platform === 'woo', 'woo: report names the method');
    // a data-only re-scrape keeps photos added since (find-images / a photo pack) and the store's own earlier photos
    writeFileSync(path.join(d, 'img', 'federal-power-shok-00-web.jpg'), JPEG);
    const withPhoto = c.map((p) => (p.id === 'federal-power-shok-00' ? { ...p, localImages: ['img/federal-power-shok-00-web.jpg'], photoSource: { page: 'https://example.com/x', score: 9 }, photoSearch: { result: 'found' } } : p));
    writeFileSync(path.join(d, 'scraped', 'catalog.json'), JSON.stringify(withPhoto));
    const again = await run(wb, ['--max-images', '0'], d);
    ok(again.code === 0, 'woo: data-only re-run exits 0\n' + again.out);
    const c2 = read(d);
    const f2 = c2.find((p) => p.id === 'federal-power-shok-00'), g2 = c2.find((p) => p.id === 'glock-19-gen-5');
    eq(f2 && f2.localImages, ['img/federal-power-shok-00-web.jpg'], 're-scrape: a searched-for photo is kept');
    eq(f2 && f2.photoSource && f2.photoSource.score, 9, 're-scrape: its source note is kept');
    eq(g2 && g2.localImages.length, 2, 're-scrape: the store photos from the last run are kept');
    // build-catalog on it
    const items = buildItems(c, { 'benelli-m4-tactical': { featured: true, lore: 'The wall’s last line.' } });
    const gi = items.find((i) => i.id === 'glock-19-gen-5');
    eq([gi.dept, gi.type, gi.firearm, gi.specs.caliber, gi.specs.capacity, gi.specs.barrel], ['sidearms', 'pistol', true, '9mm Luger', '15+1', '4.02 in'], 'build: glock');
    eq(gi.images, ['img/glock-19-gen-5-1.jpg', 'img/glock-19-gen-5-2.jpg'].map((x) => path.relative(d, path.join(d, x))), 'build: local photo paths');
    const fi = items.find((i) => i.id === 'federal-power-shok-00');
    eq([fi.dept, fi.type, fi.firearm, fi.status], ['ammo', 'shells', false, 'low'], 'build: buckshot is ammo, not a shotgun');
    const bi = items.find((i) => i.id === 'benelli-m4-tactical');
    eq([bi.dept, bi.type, bi.featured, bi.lore, bi.status, bi.price], ['shotguns', 'semishotgun', true, 'The wall’s last line.', 'out', null], 'build: benelli + overrides');
  }

  /* shrink fuse: a previous good run of 12 must not be replaced by 3 */
  writeFileSync(path.join(d, 'scraped', 'catalog.json'), JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ id: 'x' + i, name: 'x' }))));
  r = await run(wb, [], d);
  ok(r.code === 1 && /Not overwriting/.test(r.out), 'fuse: refuses to shrink the catalog by >50%\n' + r.out);
  eq(read(d).length, 12, 'fuse: previous catalog untouched');
  r = await run(wb, ['--allow-shrink'], d);
  ok(r.code === 0 && read(d).length === 3, '--allow-shrink overrides the fuse');

  /* ---------- 2. sitemap + JSON-LD / microdata / og ---------- */
  console.log('sitemap store');
  const sm = await serve({});
  sm.server.removeAllListeners('request');
  const sb = sm.url;
  const smRoutes = {
    '/': page('<title>Outpost</title>', '<h1>Welcome</h1>'),
    '/robots.txt': { body: `User-agent: *\nDisallow: /private/\nSitemap: ${sb}/sitemap_index.xml\n`, type: 'text/plain' },
    '/sitemap_index.xml': { body: `<?xml version="1.0"?><sitemapindex><sitemap><loc>${sb}/product-sitemap.xml</loc></sitemap><sitemap><loc>${sb}/page-sitemap.xml</loc></sitemap></sitemapindex>`, type: 'application/xml' },
    '/product-sitemap.xml': { body: `<?xml version="1.0"?><urlset><url><loc>${sb}/products/vortex-strike-eagle-1-6x24</loc></url><url><loc>${sb}/products/ruger-gp100</loc></url><url><loc>${sb}/products/sig-p365</loc></url><url><loc>${sb}/products/not-a-product</loc></url><url><loc>${sb}/private/hidden-gun</loc></url></urlset>`, type: 'application/xml' },
    '/page-sitemap.xml': { body: `<?xml version="1.0"?><urlset><url><loc>${sb}/about/</loc></url></urlset>`, type: 'application/xml' },
    '/products/vortex-strike-eagle-1-6x24': page(
      `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [
        { '@type': 'BreadcrumbList', itemListElement: [{ name: 'Home' }, { name: 'Optics' }, { name: 'Riflescopes' }] },
        { '@type': 'Product', name: 'Vortex Strike Eagle 1-6x24', sku: 'SE-1624-2', brand: { '@type': 'Brand', name: 'Vortex' }, description: 'Short teaser.',
          image: ['/media/se-1.jpg'], offers: { '@type': 'Offer', price: '1,299.99', priceCurrency: 'USD', availability: 'https://schema.org/InStock' } }] })}</script>`,
      '<div class="product-description"><p>' + 'A low-power variable optic for fast close shots and confident mid-range hits. '.repeat(4) + '</p><dl class="specs"><dt>Reticle</dt><dd>AR-BDC3</dd><dt>Tube</dt><dd>30 mm</dd></dl></div><footer>x</footer>'),
    '/products/ruger-gp100': page('<meta property="og:title" content="Ruger GP100 .357 Mag 4.2&quot; — Agarthan Armory">',
      '<div itemscope itemtype="https://schema.org/Product"><h1 itemprop="name">Ruger GP100 .357 Mag 4.2"</h1><meta itemprop="price" content="849.00"><link itemprop="availability" href="https://schema.org/PreOrder"><div itemprop="description">Triple-locking cylinder.</div></div><nav class="breadcrumb"><a href="/">Home</a><a href="/c/handguns">Handguns</a></nav>'),
    '/products/sig-p365': page('<meta property="og:type" content="product"><meta property="og:title" content="SIG Sauer P365 9mm"><meta name="description" content="Micro-compact carry.">',
      '<h1>SIG Sauer P365 9mm</h1><p class="price">Call for price</p>'),
    '/products/not-a-product': page('<title>Gift ideas</title>', '<h1>Gift ideas</h1><p>Read our blog.</p>'),
    '/private/hidden-gun': page('<script type="application/ld+json">{"@type":"Product","name":"Hidden"}</script>', ''),
    '/media/se-1.jpg': { body: JPEG, type: 'image/jpeg' },
  };
  sm.server.on('request', (req, res) => {
    const u = new URL(req.url, 'http://x'); const v = smRoutes[u.pathname + u.search] ?? smRoutes[u.pathname];
    if (v == null) { res.writeHead(404); return res.end(); }
    const { body, type = 'text/html' } = typeof v === 'string' || Buffer.isBuffer(v) ? { body: v } : v;
    res.writeHead(200, { 'Content-Type': type }); res.end(body);
  });
  d = tmp();
  r = await run(sb, [], d);
  ok(r.code === 0, 'sitemap run exits 0\n' + r.out);
  if (r.code === 0) {
    const c = read(d);
    eq(c.map((p) => p.id).sort(), ['ruger-gp100', 'sig-p365', 'vortex-strike-eagle-1-6x24'], 'sitemap: products found, non-product and robots-disallowed skipped');
    const v = c.find((p) => p.id === 'vortex-strike-eagle-1-6x24');
    eq([v.price, v.brand, v.sku, v.availability], [1299.99, 'Vortex', 'SE-1624-2', 'in'], 'jsonld: price with comma, brand, sku, stock');
    eq(v.categories, ['Optics', 'Riflescopes'], 'jsonld: breadcrumb categories (Home dropped)');
    ok(v.description.length > 200 && !v.description.includes('Short teaser'), 'jsonld: full page copy preferred over the teaser');
    eq(v.attributes.Reticle, 'AR-BDC3', 'dl spec rows');
    eq(v.localImages.length, 1, 'jsonld: relative image resolved and saved');
    const g = c.find((p) => p.id === 'ruger-gp100');
    eq([g.source, g.price, g.availability, g.categories], ['microdata', 849, 'order', ['Handguns']], 'microdata product');
    const s = c.find((p) => p.id === 'sig-p365');
    eq([s.source, s.price, s.priceNote], ['dom', null, 'Call for price'], 'og-only page: call for price');
    const items = buildItems(c, {});
    const gi = items.find((i) => i.id === 'ruger-gp100');
    eq([gi.dept, gi.type, gi.specs.caliber, gi.specs.barrel], ['sidearms', 'revolver', '.357 Magnum', '4.2 in'], 'build: revolver from breadcrumb + name');
    const vi = items.find((i) => i.id === 'vortex-strike-eagle-1-6x24');
    eq([vi.dept, vi.type, vi.firearm, vi.specs.magnification], ['optics', 'scope', false, '1-6x24'], 'build: optic');
    eq(items.find((i) => i.id === 'sig-p365').status, 'ask', 'build: unknown stock + no price → ask');
  }

  /* ---------- 3. no sitemap → crawl ---------- */
  console.log('crawl store');
  const cr = await serve({
    '/': page('', '<a href="/category/handguns/">Handguns</a><a href="/cart/">Cart</a>'),
    '/category/handguns/': page('', '<a href="/item/glock-17">Glock 17</a><a href="/item/glock-43x">Glock 43X</a>'),
    '/item/glock-17': page(`<script type="application/ld+json">{"@type":"Product","name":"Glock 17 Gen 5","offers":{"price":"599"}}</script>`, ''),
    '/item/glock-43x': page(`<script type="application/ld+json">{"@type":"Product","name":"Glock 43X","offers":[{"price":"479.99"}]}</script>`, ''),
  });
  d = tmp();
  r = await run(cr.url, [], d);
  ok(r.code === 0, 'crawl run exits 0\n' + r.out);
  if (r.code === 0) eq(read(d).map((p) => [p.name, p.price]).sort(), [['Glock 17 Gen 5', 599], ['Glock 43X', 479.99]], 'crawl: products found from category links');

  /* ---------- 4. Shopify ---------- */
  console.log('shopify store');
  const sh = await serve({
    '/': page('<script src="https://cdn.shopify.com/s/files/theme.js"></script>', ''),
    '/products.json?limit=250&page=1': { body: { products: [{ title: 'Magpul PMAG 30 AR/M4 Gen M3', handle: 'pmag-30', vendor: 'Magpul', product_type: 'Magazines', body_html: '<p>Polymer.</p>', tags: ['ar15'], variants: [{ price: '15.95', compare_at_price: '19.95', sku: 'MAG557-BLK', available: true }], images: [] }] }, type: 'application/json' },
    '/products.json?limit=250&page=2': { body: { products: [] }, type: 'application/json' },
  });
  d = tmp();
  r = await run(sh.url, [], d);
  ok(r.code === 0, 'shopify run exits 0\n' + r.out);
  if (r.code === 0) {
    const p = read(d)[0];
    eq([p.name, p.price, p.regularPrice, p.brand, p.sku, p.availability], ['Magpul PMAG 30 AR/M4 Gen M3', 15.95, 19.95, 'Magpul', 'MAG557-BLK', 'in'], 'shopify product');
    const it = buildItems([p])[0];
    eq([it.dept, it.type], ['gear', 'mag'], 'build: magazine is gear');
  }

  /* ---------- 5. bot wall ---------- */
  console.log('bot wall');
  const wall = await serve({ '/': page('<title>Just a moment...</title>', 'Checking your browser — challenge-platform') });
  d = tmp();
  r = await run(wall.url, [], d);
  eq(r.code, 2, 'wall: exits 2 with guidance');
  ok(!existsSync(path.join(d, 'scraped', 'catalog.json')), 'wall: nothing written');

  /* ---------- 6. classifier on real-world listing names ---------- */
  console.log('classifier');
  const cases = [
    [{ name: 'Smith & Wesson M&P15 Sport III 5.56 NATO 16" 30rd' }, 'longarms', 'ar'],
    [{ name: 'Henry Big Boy Classic .44 Magnum Lever Action 20"' }, 'longarms', 'lever'],
    [{ name: 'Ruger 10/22 Carbine .22 LR 18.5" 10rd' }, 'longarms', 'rimfire'],
    [{ name: 'Tikka T3x Lite .308 Win Bolt Action Rifle' }, 'longarms', 'bolt'],
    [{ name: 'Springfield Armory M1A Standard .308 22"' }, 'longarms', 'battle'],
    [{ name: 'Aero Precision M4E1 Stripped Lower Receiver' }, 'longarms', 'ar'],
    [{ name: 'Mossberg 590A1 12 Gauge 20" 8-Shot Pump' }, 'shotguns', 'shotgun'],
    [{ name: 'Hornady Critical Defense 9mm 115gr FTX 25rd Box' }, 'ammo', 'ammo'],
    [{ name: 'Winchester Super-X 20 ga 2-3/4" #6 Shot' }, 'ammo', 'shells'],
    [{ name: 'Holosun HS507C X2 Red Dot' }, 'optics', 'reddot'],
    [{ name: 'Pulsar Axion 2 XQ35 Thermal Monocular' }, 'optics', 'thermal'],
    [{ name: 'Leupold VX-3HD 3.5-10x40 Riflescope' }, 'optics', 'scope'],
    [{ name: 'Vortex Sport Cantilever 30mm Scope Mount' }, 'gear', 'case'],
    [{ name: 'Streamlight TLR-1 HL Weapon Light' }, 'gear', 'light'],
    [{ name: 'Pelican Vault V800 Double Rifle Case' }, 'gear', 'case'],
    [{ name: 'Liberty Centurion 24 Gun Safe' }, 'gear', 'safe'],
    [{ name: 'Otis Elite Cleaning Kit' }, 'gear', 'kit'],
    [{ name: 'Glock 19 Gen 5 MOS 9mm', categories: ['Firearms', 'Handguns'] }, 'sidearms', 'pistol'],
    [{ name: 'Holosun 507K X2', categories: ['Accessories'] }, 'optics', 'reddot'],
    [{ name: 'Magpul MOE Pistol Grip', categories: ['Accessories', 'Parts'] }, 'gear', 'case'],
    [{ name: 'CZ Scorpion 3+ Micro 9mm', categories: ['Pistols'] }, 'sidearms', 'pistol'],
  ];
  for (const [p, dept, icon] of cases) {
    const got = classify(p);
    eq([got, iconFor(got, p)], [dept, icon], `classify "${p.name}"`);
  }
  eq(specsFor('ammo', { name: 'Hornady Critical Defense 9mm 115gr FTX 25rd Box' }), { caliber: '9mm', bullet: '115gr FTX', count: '25 rounds' }, 'ammo specs from the name');
  eq(specsFor('longarms', { name: 'Mossberg 590A1 12 Gauge 20" 8-Shot Pump' }).capacity, '8 rounds', 'capacity "8-Shot"');

  /* ---------- 7. two storefronts merge into one catalog ---------- */
  console.log('merge');
  const md = tmp();
  const { mkdirSync } = await import('node:fs');
  mkdirSync(path.join(md, 'shop'), { recursive: true });
  writeFileSync(path.join(md, 'catalog.json'), JSON.stringify([{ id: 'a', name: 'Main A' }, { id: 'dup', name: 'Main wins' }]));
  writeFileSync(path.join(md, 'shop', 'catalog.json'), JSON.stringify([{ id: 'dup', name: 'Shop loses' }, { id: 'b', name: 'Shop B' }]));
  const merged = await loadScraped(md);
  eq(merged.products.map((p) => [p.id, p.name]), [['a', 'Main A'], ['dup', 'Main wins'], ['b', 'Shop B']], 'merge: main site first, shared id kept once');

  [woo, sm, cr, sh, wall].forEach((s) => s.server.close());
  console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
