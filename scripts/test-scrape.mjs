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

  /* ---------- 6. Gearfire (SvelteKit storefront, data inline in each page) ---------- */
  console.log('gearfire store');
  const { parseLiteral, productsFromPage } = await import('./lib-gearfire.mjs');
  eq(parseLiteral('{a:1,"b c":[1,,"x\\u003Cy"],d:void 0,e:new Date("2020"),f:__sk.defer(1),g:-2.5e3}').value,
    { a: 1, 'b c': [1, null, 'x<y'], d: null, e: '2020', f: null, g: -2500 }, 'gearfire: JS literal read without eval');
  const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  // devalue-style literal: bare keys, like the real pages
  const lit = (v) => v === null ? 'null' : Array.isArray(v) ? `[${v.map(lit).join(',')}]` : typeof v === 'object'
    ? `{${Object.entries(v).map(([k, x]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}:${x && x.raw ? x.raw : lit(x)}`).join(',')}}` : JSON.stringify(v);
  const NAV = { navList: [{ departmentId: U(1), departmentName: 'Shooting Sports', categories: [
    { categoryId: U(2), categoryName: 'Handguns', subCategories: [{ subCategoryId: U(3), subCategoryName: 'Semi-Automatic' }] },
    { categoryId: U(4), categoryName: 'Ammunition', subCategories: [{ subCategoryId: U(5), subCategoryName: 'Rifle Ammo' }] }] }] };
  const kitPage = (route, links = '') => page('<link href="./_app/immutable/assets/0.css" rel="stylesheet">',
    `${links}<script>{ __sveltekit_t3st = { base: "" }; const element = document.currentScript.parentElement;
      Promise.all([import("./_app/immutable/entry/start.js")]).then(([kit, app]) => { kit.start(app, element, {
        node_ids: [0, 4], data: [${lit({ type: 'data', data: { isPreview: false, initData: NAV }, uses: {} })},${route ? lit({ type: 'data', data: route }) : 'null'}], form: null, error: null }); }); }</script>`);
  const vm = (o) => ({ storeId: U(99), fullPrice: o.full, salePrice: o.sale, addToCartToSeePrice: !!o.hidden, quantityOnHand: o.qty, isStoreInventory: !!o.store, doNotShipToStates: o.noship || [] });
  const sub = (id, o) => ({ isFirearm: !!o.gun, isNfa: false, subProductId: U(id), description: o.desc, imageUrls: [`https://img.example/${id}`], upc: o.upc, manufacturerPartNumber: o.mpn,
    attributes: Object.entries(o.attrs || {}).map(([attributeName, valueName]) => ({ attributeName, valueName })), optionalAttributes: [],
    storeSubProductDataVms: o.vm ? [vm(o.vm)] : [] });
  const LINES = {
    [U(10)]: { name: 'G19 Gen6', brand: 'Glock', cat: ['Handguns', 'Semi-Automatic'], subs: [
      sub(11, { gun: true, desc: 'Glock, G19 Gen6, 9mm, 4.02", 15 Rounds', upc: '764503000011', mpn: 'PA1950203', attrs: { 'Handgun Caliber': '9mm', 'Barrel Length': '4.02"', Capacity: '15 Rounds' }, vm: { full: 620, sale: 620, qty: 3, store: true } }),
      sub(12, { gun: true, desc: 'Glock, G19 Gen6, 9mm, 4.02", 10 Rounds', upc: '764503000012', mpn: 'PA1950201', attrs: { 'Handgun Caliber': '9mm', 'Barrel Length': '4.02"', Capacity: '10 Rounds' }, vm: { full: 620, sale: 620, qty: 0, store: true } })] },
    [U(20)]: { name: 'P365', brand: 'SIG Sauer', cat: ['Handguns', 'Semi-Automatic'], subs: [sub(21, { gun: true, desc: 'SIG, P365', upc: '798681000021', attrs: { 'Handgun Caliber': '9mm' }, vm: { full: 499, sale: 499, qty: 1, store: true } })] },
    [U(30)]: { name: 'LEVERevolution', brand: 'Hornady', cat: ['Ammunition', 'Rifle Ammo'], subs: [
      sub(31, { desc: 'Hornady, LeverEvolution, 30-30 Win, 160 Grain', upc: '090255000031', attrs: { 'Rifle Caliber': '30-30 Winchester', 'Bullet Grain Weight': '160 Grains', 'Rounds Per Box': '20' }, vm: { full: 24.99, sale: 20.99, qty: 50, noship: ['CA'] } }),
      sub(32, { desc: 'Hornady, LeverEvolution, 45-70, 325 Grain', upc: '090255000032', attrs: { 'Rifle Caliber': '45-70 Government', 'Bullet Grain Weight': '325 Grains', 'Rounds Per Box': '20' }, vm: { full: 40, sale: 40, qty: 10, hidden: true } }),
      sub(33, { desc: 'not sold here', upc: '090255000033', attrs: { 'Rifle Caliber': '308 Winchester' } })] },
    [U(40)]: { name: 'Home Only', brand: 'Acme', cat: ['Ammunition', 'Rifle Ammo'], subs: [sub(41, { desc: 'x', upc: '000000000041', vm: { full: 5, sale: 5, qty: 5 } })] },
    [U(50)]: { name: 'Sitemap Only', brand: 'Acme', cat: ['Ammunition', 'Rifle Ammo'], subs: [sub(51, { desc: 'y', upc: '000000000051', vm: { full: 6, sale: 6, qty: 0 } })] },
  };
  const productRoute = (pid, sid) => { const L = LINES[pid]; return { product: { productId: pid, modelName: L.name, modelDescription: `<p>The ${L.name}.</p>`, manufacturerName: L.brand, subProducts: L.subs,
    departmentInfos: [{ departmentName: 'Shooting Sports', isPrimary: true, categoryName: L.cat[0], subCategoryName: L.cat[1] }] },
    recommendedProducts: { raw: '__sveltekit_t3st.defer(1)' }, selectedSubProductId: sid, dealerProfiles: [{ storeId: U(99) }], inStockOnly: true }; };
  const href = (pid, sid, slugs = 'shooting-sports/handguns/semi-automatic') => `<a href="/${slugs}/x/detail/${pid}/${sid}">p</a>`;
  const gfRoutes = {
    '/': kitPage(null, href(U(40), U(41), 'shooting-sports/ammunition/rifle-ammo')),
    '/robots.txt': { body: 'User-agent: *\nDisallow: /cart\nSitemap: SITE/sitemap.xml\n', type: 'text/plain' },
  };
  const gfState = { block: 0, gone: new Set(), hits: 0 };
  const gf = await serve({});
  gf.server.removeAllListeners('request');
  const gb = gf.url;
  const L1 = `/shooting-sports/handguns/semi-automatic/${U(1)}/${U(2)}/${U(3)}`, L2 = `/shooting-sports/ammunition/rifle-ammo/${U(1)}/${U(4)}/${U(5)}`;
  gf.server.on('request', (req, res) => {
    const u = new URL(req.url, 'http://x'); const send = (body, type = 'text/html') => { res.writeHead(200, { 'Content-Type': type }); res.end(body); };
    if (u.pathname === '/robots.txt') return send(gfRoutes['/robots.txt'].body.replace('SITE', gb), 'text/plain');
    if (u.pathname === '/sitemap.xml') return send(`<?xml version="1.0"?><urlset><url><loc>${gb}/shooting-sports/ammunition/rifle-ammo/a/detail/${U(30)}/${U(31)}</loc></url><url><loc>${gb}/shooting-sports/ammunition/rifle-ammo/b/detail/${U(50)}/${U(51)}</loc></url></urlset>`, 'application/xml');
    if (u.pathname === '/') return send(gfRoutes['/']);
    const pg = +(u.searchParams.get('page') || 1);
    if (u.pathname === L1) return send(pg === 2 ? kitPage({ items: [{ productId: U(20), modelName: 'P365', subProductId: U(21) }] }) : kitPage({ items: [] }, href(U(10), U(11))));
    if (u.pathname === L2) return send(kitPage({}, href(U(30), U(32), 'shooting-sports/ammunition/rifle-ammo')));
    const d = u.pathname.match(/\/detail\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/);
    if (d) gfState.hits++;
    if (d && gfState.block > 0) { gfState.block--; res.writeHead(403, { 'Content-Type': 'text/html' }); return res.end('<h1>403 ERROR</h1>The request could not be satisfied. Request blocked.'); }
    if (d && gfState.gone.has(d[1])) { res.writeHead(404); return res.end('gone'); }
    if (d && LINES[d[1]]) return send(kitPage(productRoute(d[1], d[2])));
    res.writeHead(404); res.end('nope');
  });
  d = tmp();
  r = await run(gb, ['--max-images', '0', '--save-html', path.join(d, 'pages')], d);
  ok(r.code === 0, 'gearfire run exits 0\n' + r.out);
  if (r.code === 0) {
    const c = read(d); const by = (n) => c.find((p) => p.id === U(n));
    eq(JSON.parse(readFileSync(path.join(d, 'scraped', 'report.json'), 'utf8')).platform, 'gearfire', 'gearfire: recognised and used');
    eq(c.map((p) => p.id).sort(), [11, 12, 21, 31, 32, 41, 51].map(U).sort(), 'gearfire: every line (listings, page 2, home, sitemap), every variant sold here');
    eq(by(11) && [by(11).name, by(11).brand, by(11).attributes['Handgun Caliber'], by(11).attributes.UPC], ['G19 Gen6', 'Glock', '9mm', '764503000011'], 'gearfire: name, maker, attributes, UPC');
    eq(by(11) && by(11).variant, { Capacity: '15 Rounds' }, 'gearfire: the attribute that tells variants apart');
    eq(by(11) && [by(11).availability, by(11).firearm, by(11).storeStock], ['in', true, true], 'gearfire: own shelf stock, firearm flag');
    eq(by(12) && by(12).availability, 'out', 'gearfire: none on hand → out');
    eq(by(11) && by(11).categories, ['Shooting Sports', 'Handguns', 'Semi-Automatic'], 'gearfire: categories');
    eq(by(31) && [by(31).price, by(31).regularPrice, by(31).availability, by(31).noShipTo], [20.99, 24.99, 'ship', ['CA']], 'gearfire: sale price, distributor stock ships, ship limits');
    eq(by(32) && [by(32).price, by(32).priceNote], [null, 'Call for price'], 'gearfire: add-to-cart-for-price is never shown');
    eq(by(31) && by(31).description, 'The LEVERevolution.', 'gearfire: description as text');
    ok(by(31) && /\/detail\/0+-0000-4000-8000-000000000030\/0+-0000-4000-8000-000000000031$/.test(by(31).permalink), 'gearfire: each variant has its own link');
    ok(existsSync(path.join(d, 'pages', 'list-handguns-semi-automatic-p1.html')) && existsSync(path.join(d, 'pages', 'list-handguns-semi-automatic-p2-page.html')), 'gearfire: --save-html keeps listing pages');
  }
  // a trial on some listings writes to .scrape-trial/, never over the catalog
  const trial = await new Promise((resolve) => {
    const c = spawn(process.execPath, [SCRAPE, '--site', gb, '--delay', '0', '--out', path.join(d, 'scraped'), '--only', 'Semi', '--img-dir', path.join(d, 'img')], { cwd: d });
    let out = ''; c.stdout.on('data', (x) => { out += x; }); c.stderr.on('data', (x) => { out += x; });
    c.on('close', (code) => resolve({ code, out }));
  });
  ok(trial.code === 0, 'gearfire trial exits 0\n' + trial.out);
  const tc = existsSync(path.join(d, '.scrape-trial', 'catalog.json')) ? JSON.parse(readFileSync(path.join(d, '.scrape-trial', 'catalog.json'), 'utf8')) : [];
  eq(tc.map((p) => p.id).sort(), [11, 12, 21].map(U).sort(), 'gearfire: --only reads just those listings');
  eq(read(d).length, 7, 'gearfire: a trial leaves the real catalog alone');
  // the firewall refuses for a while: pause, slow down, carry on — nothing lost
  d = tmp(); gfState.block = 3;
  r = await run(gb, ['--max-images', '0', '--block-pause', '50'], d);
  ok(r.code === 0 && /pausing/.test(r.out), 'gearfire: refusals pause and retry\n' + r.out);
  eq(r.code === 0 && read(d).length, 7, 'gearfire: every product read after the store lets up');
  // a page that fails is reported by cause; --resume then reads only what is missing
  d = tmp(); gfState.gone = new Set([U(50)]);
  r = await run(gb, ['--max-images', '0'], d);
  ok(/HTTP 404 × 1/.test(r.out), 'gearfire: failures counted by cause\n' + r.out);
  eq(read(d).length, 6, 'gearfire: the rest is written');
  gfState.gone = new Set(); gfState.hits = 0;
  r = await run(gb, ['--max-images', '0', '--resume'], d);
  eq([r.code, gfState.hits, read(d).length], [0, 1, 7], 'gearfire: --resume fetches only the missing line, keeps the rest');
  ok(/reusing the 5 product lines/.test(r.out), 'gearfire: --resume reuses the list of lines\n' + r.out);
  // a store that never lets up: stop, keep what was read
  d = tmp(); gfState.block = 1e9;
  r = await run(gb, ['--max-images', '0', '--block-pause', '20', '--max-blocked-ms', '300'], d);
  ok(/kept refusing|still to read/.test(r.out) || r.code !== 0, 'gearfire: gives up cleanly when the store never lets up\n' + r.out.slice(-600));
  gfState.block = 0;
  // a real page saved from the shop (npm run save-pages): the parser must keep reading it
  const realPage = path.join(HERE, '..', 'assets', 'data', 'scraped', 'shop', 'pages', '000c9c4e-ec05-4333-858c-7b2c65298e7a.html');
  if (existsSync(realPage)) {
    const rp = productsFromPage(readFileSync(realPage, 'utf8'), 'https://shop.agarthanarmory.com/shooting-sports/ammunition/rifle-ammo/leverevolution/detail/80b377ef-064a-4a13-8acc-1fe1ba42e283/000c9c4e-ec05-4333-858c-7b2c65298e7a');
    const lv = rp && rp.find((p) => p.id === '000c9c4e-ec05-4333-858c-7b2c65298e7a');
    eq(rp && rp.length, 11, 'real Gearfire page: every variant the store sells');
    eq(lv && [lv.attributes['Rifle Caliber'], lv.attributes['Bullet Grain Weight'], lv.attributes['Rounds Per Box'], lv.price, lv.brand], ['45-70 Government', '250 Grains', '20', 58.99, 'Hornady'], 'real Gearfire page: the variant\'s own rows and price');
  }
  // a page with no inline data → null (the scraper falls back to the page text)
  eq(productsFromPage(page('', '<h1>x</h1>'), gb + '/x'), null, 'gearfire: no inline data → null');
  gf.server.close();

  [woo, sm, cr, sh, wall].forEach((s) => s.server.close());
  console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
