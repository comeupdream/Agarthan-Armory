#!/usr/bin/env node
/* test-images.mjs — match-images.mjs against fake image packs and feeds:
 * files named by UPC (leading zeros optional, _2 extra angles), files named by
 * a distributor stock number mapped through a semicolon feed, image links in a
 * CSV served from localhost, a fake "image" that must be refused, dry run.
 *   node scripts/test-images.mjs */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { upcKey, stemOf, parseCsv } from './match-images.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) pass++; else { fail++; console.log(`  ✗ ${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); } };
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(40)]);

// units
eq(upcKey('090255827415'), '90255827415', 'upcKey drops leading zeros');
eq(upcKey('0090255827415'), '90255827415', 'EAN-13 and UPC-A agree');
eq(upcKey('12'), null, 'too short is not a UPC');
eq(stemOf('/x/090255827415_2.jpg'), { base: '090255827415', n: 2 }, 'stem _2');
eq(stemOf('GLPA175S203 (3).png'), { base: 'GLPA175S203', n: 3 }, 'stem (3)');
eq(stemOf('SW12345-main.jpg'), { base: 'SW12345', n: 0 }, 'stem -main');
eq(parseCsv('a;"b;c";d\n1;2;3\n'), [['a', 'b;c', 'd'], ['1', '2', '3']], 'csv: semicolons + quoted delimiter');

const run = (args, cwd) => new Promise((res) => {
  const c = spawn(process.execPath, [path.join(HERE, 'match-images.mjs'), ...args], { cwd, env: { ...process.env, AA_NO_SHARP: '1' } });
  let out = ''; c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (out += d));
  c.on('close', (code) => res({ code, out }));
});

const srv = await new Promise((r) => { const s = http.createServer((q, w) => { if (q.url === '/img/c.jpg') { w.writeHead(200, { 'Content-Type': 'image/jpeg' }); return w.end(JPEG); } w.writeHead(404); w.end(); }).listen(0, '127.0.0.1', () => r(s)); });
const base = `http://127.0.0.1:${srv.address().port}`;

const d = mkdtempSync(path.join(tmpdir(), 'aa-img-'));
mkdirSync(path.join(d, 'scraped', 'shop'), { recursive: true });
mkdirSync(path.join(d, 'pack', 'sub'), { recursive: true });
const catalog = [
  { id: 'hornady-lever', name: 'LEVERevolution', attributes: { UPC: '090255827415' }, images: [] },
  { id: 'glock-19', name: 'G19', upc: '0012345678905', attributes: {}, images: [] },
  { id: 'magpul-pmag', name: 'PMAG', sku: '811111111112', attributes: {}, images: [] },
  { id: 'no-upc', name: 'Mystery', attributes: {}, images: [] },
];
writeFileSync(path.join(d, 'scraped', 'shop', 'catalog.json'), JSON.stringify(catalog));
writeFileSync(path.join(d, 'pack', '90255827415.jpg'), JPEG);           // leading zero dropped
writeFileSync(path.join(d, 'pack', 'sub', '090255827415_2.png'), PNG);  // second angle, nested
writeFileSync(path.join(d, 'pack', 'GLPA175S203.jpg'), JPEG);           // distributor stock number
writeFileSync(path.join(d, 'pack', '811111111112.jpg'), Buffer.from('<html>not an image</html>')); // must be refused
writeFileSync(path.join(d, 'feed.txt'), 'Stock;UPC;Desc\nGLPA175S203;012345678905;Glock 19\n');
writeFileSync(path.join(d, 'links.csv'), `upc,image_url\n811111111112,${base}/img/c.jpg\n`);

const common = ['--catalog-dir', path.join(d, 'scraped'), '--img-dir', path.join(d, 'img')];
let r = await run(['--folder', path.join(d, 'pack'), '--csv', path.join(d, 'feed.txt'), '--key-col', 'Stock', '--dry-run', ...common], d);
eq(r.code, 0, 'dry run exits 0\n' + r.out);
eq(existsSync(path.join(d, 'img')), false, 'dry run writes no photos');

r = await run(['--folder', path.join(d, 'pack'), '--csv', path.join(d, 'feed.txt'), '--key-col', 'Stock', '--max', '2', ...common], d);
eq(r.code, 0, 'pack + feed run exits 0\n' + r.out);
let c = JSON.parse(readFileSync(path.join(d, 'scraped', 'shop', 'catalog.json'), 'utf8'));
const imgs = (id) => (c.find((p) => p.id === id).localImages || []).map((x) => path.basename(x));
eq(imgs('hornady-lever'), ['hornady-lever-1.jpg', 'hornady-lever-2.png'], 'UPC-named files, both angles, in order');
eq(imgs('glock-19'), ['glock-19-1.jpg'], 'stock-number file mapped through the feed');
eq(imgs('magpul-pmag'), [], 'a fake image is refused');
eq(imgs('no-upc'), [], 'no UPC, no match');

r = await run(['--csv', path.join(d, 'links.csv'), ...common], d);
eq(r.code, 0, 'links run exits 0\n' + r.out);
c = JSON.parse(readFileSync(path.join(d, 'scraped', 'shop', 'catalog.json'), 'utf8'));
eq(imgs('magpul-pmag'), ['magpul-pmag-1.jpg'], 'image link downloaded for its UPC');
eq(imgs('hornady-lever').length, 2, 'products that already have photos are left alone');
eq(readdirSync(path.join(d, 'img')).length, 4, 'four photo files written');

/* ---------- find-images.mjs against a mock image-search API ---------- */
const { scoreResult, queriesFor, framing } = await import('./find-images.mjs');
// a white 100×50 frame with dark rectangles painted in (RGB)
const frame = (...rects) => { const px = Buffer.alloc(100 * 50 * 3, 255); for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px.fill(40, (y * 100 + x) * 3, (y * 100 + x) * 3 + 3); return framing(px, 100, 50); };
eq(frame([10, 20, 89, 30]).cut, [], 'framing: a rifle floating in white is not cut off');
eq(frame([0, 20, 79, 30]).cut, ['left'], 'framing: a stock running into the left edge, white on the right, is cut off');
eq(frame([0, 20, 99, 30]).cut, ['left+right'], 'framing: a gun running off both ends is a cut-off close-up');
eq(frame([0, 5, 99, 44]).cut, [], 'framing: a mat filling the width edge to edge is full-bleed, not a cut');
eq(frame([0, 0, 60, 49]).cut, [], 'framing: a box covering the whole left edge is full-bleed, not a cut');
eq(frame([25, 10, 74, 39]).fill, 0.6, 'framing: how much of the frame the product spans');
eq(frame().blank, true, 'framing: an all-white photo is blank');
eq(queriesFor({ brand: 'Hornady', name: 'LEVERevolution', sku: '82741', variant: { 'Rifle Caliber': '45-70 Government', 'Rounds Per Box': '20' } }, '090255827415'),
  ['Hornady LEVERevolution 45-70 Government', 'Hornady 090255827415', 'Hornady 82741'], 'queries: line + variant, then UPC, then part number');
eq(scoreResult({ host: 'www.hornady.com', title: 'LEVERevolution 30-30', image: 'x.jpg', width: 1200, height: 900 }, { brand: 'Hornady', name: 'LEVERevolution' }, '90255827415') >
   scoreResult({ host: 'www.amazon.com', title: 'LEVERevolution 30-30', image: 'x.jpg', width: 1200, height: 900 }, { brand: 'Hornady', name: 'LEVERevolution' }, '90255827415'), true, 'manufacturer site outranks a marketplace');
let searches = 0;
const api = await new Promise((res) => { const s2 = http.createServer((q, w) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/res/v1/images/search') {
    searches++;
    if (q.headers['x-subscription-token'] !== 'test-key') { w.writeHead(401); return w.end(); }
    const term = u.searchParams.get('q');
    const self = `http://127.0.0.1:${s2.address().port}`;
    const results = /Federal/.test(term) ? [
      { title: 'Federal HST 9mm', url: 'https://www.federalpremium.com/hst', meta_url: { hostname: 'www.federalpremium.com' }, properties: { url: self + '/broken.jpg', width: 1200, height: 1200 } },
      { title: 'Federal HST 9mm 147gr', url: 'https://www.federalpremium.com/hst2', meta_url: { hostname: 'www.federalpremium.com' }, properties: { url: self + '/good.jpg', width: 1000, height: 1000 } },
      { title: 'HST on sale', url: 'https://www.amazon.com/x', meta_url: { hostname: 'www.amazon.com' }, properties: { url: self + '/amazon.jpg', width: 1500, height: 1500 } },
    ] : [{ title: 'unrelated logo', url: 'https://example.com', meta_url: { hostname: 'example.com' }, properties: { url: self + '/logo.png', width: 64, height: 64 } }];
    w.writeHead(200, { 'Content-Type': 'application/json' }); return w.end(JSON.stringify({ results }));
  }
  if (u.pathname === '/good.jpg' || u.pathname === '/amazon.jpg') { w.writeHead(200, { 'Content-Type': 'image/jpeg' }); return w.end(JPEG); }
  if (u.pathname === '/broken.jpg') { w.writeHead(403); return w.end(); }
  w.writeHead(404); w.end();
}).listen(0, '127.0.0.1', () => res(s2)); });
const fd = mkdtempSync(path.join(tmpdir(), 'aa-find-'));
mkdirSync(path.join(fd, 'scraped'), { recursive: true });
writeFileSync(path.join(fd, 'scraped', 'catalog.json'), JSON.stringify([
  { id: 'federal-hst-9', line: 'hst', name: 'HST 9mm 147gr', brand: 'Federal', attributes: { UPC: '029465064549' } },
  { id: 'federal-hst-40', line: 'hst', name: 'HST 9mm 147gr', brand: 'Federal', attributes: { UPC: '029465064550' } },
  { id: 'nothing-found', name: 'Obscure Widget', brand: 'Acme', attributes: { UPC: '012345678912' } },
  { id: 'has-photo', name: 'Already', brand: 'Federal', attributes: { UPC: '029465000000' }, localImages: ['x.jpg'] },
]));
const runFind = (args, env) => new Promise((res) => {
  const c = spawn(process.execPath, [path.join(HERE, 'find-images.mjs'), '--catalog-dir', path.join(fd, 'scraped'), '--img-dir', path.join(fd, 'img'), '--rps', '50', '--lenient', ...args],
    { cwd: fd, env: { ...process.env, AA_NO_SHARP: '1', BRAVE_API_BASE: `http://127.0.0.1:${api.address().port}`, ...env } });
  let out = ''; c.stdout.on('data', (x) => (out += x)); c.stderr.on('data', (x) => (out += x)); c.on('close', (code) => res({ code, out }));
});
let fr = await runFind([], { BRAVE_API_KEY: '' });
eq(fr.code, 1, 'no API key: exits with instructions');
fr = await runFind([], { BRAVE_API_KEY: 'test-key' });
eq(fr.code, 0, 'find run exits 0\n' + fr.out);
let fc = JSON.parse(readFileSync(path.join(fd, 'scraped', 'catalog.json'), 'utf8'));
const byId = (id) => fc.find((p) => p.id === id);
eq(byId('federal-hst-9').localImages, ['img/federal-hst-9-1.jpg'], 'photo saved for the product');
eq(byId('federal-hst-9').photoSource && byId('federal-hst-9').photoSource.page, 'https://www.federalpremium.com/hst2', 'blocked best result skipped; next manufacturer image used (not the marketplace)');
eq(byId('federal-hst-40').localImages, ['img/federal-hst-9-1.jpg'], 'a variant of the same line shares the photo (one search)');
eq(byId('federal-hst-40').photoSource && byId('federal-hst-40').photoSource.sharedFrom, 'federal-hst-9', '…and says where it came from');
eq(byId('nothing-found').photoSearch.result, 'none', 'no acceptable result is marked none');
eq(byId('has-photo').localImages, ['x.jpg'], 'products with photos are left alone');
eq(existsSync(path.join(fd, 'scraped', 'photo-review.html')), true, 'review sheet written');
const before = searches;
fr = await runFind([], { BRAVE_API_KEY: 'test-key' });
eq(searches, before, 'second run searches nothing (found + marked none are skipped)');
fr = await runFind(['--retry', '--budget', '1'], { BRAVE_API_KEY: 'test-key' });
eq(searches - before, 1, '--retry searches again, within --budget');
// --cover: only the lines behind the first page of each view, in the Armory's order
const cd = mkdtempSync(path.join(tmpdir(), 'aa-cover-'));
mkdirSync(path.join(cd, 'scraped'), { recursive: true });
writeFileSync(path.join(cd, 'scraped', 'catalog.json'), JSON.stringify([
  { id: 'hst-a', line: 'hst', name: 'HST 9mm 147gr', brand: 'Federal', attributes: { UPC: '029465064549' } },
  { id: 'hst-b', line: 'hst', name: 'HST 9mm 147gr', brand: 'Federal', attributes: { UPC: '029465064550' } },
  { id: 'deep', line: 'deep', name: 'Federal Deep Page Load', brand: 'Federal', attributes: { UPC: '029465000001' } },
]));
writeFileSync(path.join(cd, 'catalog.js'), 'window.AA_CATALOG = ' + JSON.stringify({ items: [
  { id: 'hst-a', ln: 'hst', dept: 'ammo', sub: 'Handgun', status: 'ship', rank: 0 },
  { id: 'hst-b', ln: 'hst', dept: 'ammo', sub: 'Handgun', status: 'ship', rank: 1 },
  { id: 'deep', ln: 'deep', dept: 'ammo', sub: 'Handgun', status: 'ship', rank: 2 },
] }) + ';');
const before2 = searches;
const cov = await new Promise((res) => {
  const c = spawn(process.execPath, [path.join(HERE, 'find-images.mjs'), '--cover', '1', '--catalog-dir', path.join(cd, 'scraped'), '--catalog-js', path.join(cd, 'catalog.js'), '--img-dir', path.join(cd, 'img'), '--rps', '50', '--lenient'],
    { cwd: cd, env: { ...process.env, AA_NO_SHARP: '1', BRAVE_API_KEY: 'test-key', BRAVE_API_BASE: `http://127.0.0.1:${api.address().port}` } });
  let out = ''; c.stdout.on('data', (x) => (out += x)); c.stderr.on('data', (x) => (out += x)); c.on('close', (code) => res({ code, out }));
});
eq(cov.code, 0, 'cover run exits 0\n' + cov.out);
const cc = JSON.parse(readFileSync(path.join(cd, 'scraped', 'catalog.json'), 'utf8'));
const cby = (id) => cc.find((p) => p.id === id);
eq([cby('hst-a').localImages, cby('hst-b').localImages], [['img/hst-a-1.jpg'], ['img/hst-a-1.jpg']], 'cover: the first card\'s line gets a photo, shared by its variant');
eq(cby('deep').photoSearch, undefined, 'cover: a product past the first page is not searched');
eq(searches - before2, 1, 'cover: one search for the one line on the cover');
api.close();

/* ---- the Featured order: buyable with a photo first, then merit (assets/js/order.js + meritRank) ---- */
{
  const { createRequire } = await import('node:module');
  const order = createRequire(import.meta.url)('../assets/js/order.js');
  const { meritRank } = await import('./build-catalog.mjs');
  const P = ['assets/img/products/x.webp'];
  const firstIds = (items, n = 99) => order.prepare(items).slice().sort(order.featured).slice(0, n).map((i) => i.id);
  // merit inside one category: premium price, deep distributor stock, a maker people ask for, the store's shelf
  const ranked = meritRank([
    { id: 'cheap-obscure', dept: 'sidearms', sub: 'Semi-Auto Pistols', brand: 'Nobody Arms', price: 199, _qty: 2 },
    { id: 'glock', dept: 'sidearms', sub: 'Semi-Auto Pistols', brand: 'Glock', price: 549, _qty: 900 },
    { id: 'premium', dept: 'sidearms', sub: 'Semi-Auto Pistols', brand: 'Wilson Combat', price: 3899, _qty: 40 },
    { id: 'shelf', dept: 'sidearms', sub: 'Semi-Auto Pistols', brand: 'Nobody Arms', price: 199, _qty: 3, shelf: true },
  ]);
  const r = Object.fromEntries(ranked.map((i) => [i.id, i.rank]));
  eq(r.glock < r['cheap-obscure'] && r.premium < r['cheap-obscure'], true, 'merit: a staple (Glock) and a premium pistol outrank a cheap unknown');
  eq(r.shelf < r['cheap-obscure'], true, 'merit: on the store\'s shelf beats the same item from a distributor');
  eq(ranked.some((i) => '_qty' in i), false, 'merit: the stock count is not shipped to the site');
  const ammo = meritRank([
    { id: 'bulk', dept: 'ammo', sub: 'Handgun', brand: 'Federal', price: 399, cpr: 0.4, _qty: 50 },
    { id: 'defense', dept: 'ammo', sub: 'Handgun', brand: 'Federal', price: 32, cpr: 1.6, _qty: 50 },
  ]);
  eq(ammo.find((i) => i.id === 'defense').rank < ammo.find((i) => i.id === 'bulk').rank, true, 'merit: ammo is judged per round (defensive loads before bulk cases)');
  // availability, then photos, then merit
  eq(firstIds([
    { id: 'shelf-nophoto', dept: 'sidearms', sub: 'Semi-Auto Pistols', status: 'in', shelf: true, rank: 1 },
    { id: 'ship-photo', dept: 'sidearms', sub: 'Semi-Auto Pistols', status: 'ship', images: P, rank: 5 },
    { id: 'out-photo', dept: 'sidearms', sub: 'Semi-Auto Pistols', status: 'out', images: P, rank: 0 },
    { id: 'ship-photo-2', dept: 'sidearms', sub: 'Semi-Auto Pistols', status: 'ship', images: P, rank: 3 },
  ]), ['ship-photo-2', 'ship-photo', 'shelf-nophoto', 'out-photo'], 'order: buyable with a photo (best first), then without, out of stock last');
  eq(firstIds([
    { id: 'line-a-nophoto', ln: 'a', dept: 'sidearms', sub: 'Semi-Auto Pistols', status: 'ship', rank: 1 },
    { id: 'line-a-photo', ln: 'a', dept: 'sidearms', sub: 'Semi-Auto Pistols', status: 'ship', images: P, rank: 2 },
    { id: 'line-a-photo-2', ln: 'a', dept: 'sidearms', sub: 'Semi-Auto Pistols', status: 'ship', images: P, rank: 3 },
    { id: 'line-b-photo', ln: 'b', dept: 'sidearms', sub: 'Semi-Auto Pistols', status: 'ship', images: P, rank: 4 },
  ], 2), ['line-a-photo', 'line-b-photo'], 'order: one variant per product line first, the best one with a photo');
  const subs = firstIds([
    ...[1, 2, 3, 4, 5].map((n) => ({ id: `rl${n}`, dept: 'ammo', sub: 'Reloading', status: 'ship', images: P, rank: n })),
    ...[1, 2, 3, 4, 5].map((n) => ({ id: `rf${n}`, dept: 'ammo', sub: 'Rifle', status: 'ship', images: P, rank: 10 + n })),
    ...[1, 2, 3, 4, 5].map((n) => ({ id: `hg${n}`, dept: 'ammo', sub: 'Handgun', status: 'ship', images: P, rank: 20 + n })),
  ], 8);
  eq(subs, ['rf1', 'hg1', 'rf2', 'hg2', 'rf3', 'hg3', 'rf4', 'hg4'], 'order: categories take turns; add-ons (reloading) sit out the first rounds');
}

/* ---- a flaky network: retried, never taken as "no photo", the run carries on ---- */
{
  const tries = new Map();
  const net = await new Promise((res) => { const s4 = http.createServer((q, w) => {
    const u = new URL(q.url, 'http://x'); const self = `http://127.0.0.1:${s4.address().port}`;
    if (u.pathname !== '/res/v1/images/search') { w.writeHead(200, { 'Content-Type': 'image/jpeg' }); return w.end(JPEG); }
    const term = u.searchParams.get('q'); const n = (tries.get(term) || 0) + 1; tries.set(term, n);
    const hit = () => { w.writeHead(200, { 'Content-Type': 'application/json' }); w.end(JSON.stringify({ results: [{ title: term, url: 'https://www.federalpremium.com/p', meta_url: { hostname: 'www.federalpremium.com' }, properties: { url: self + '/x.jpg', width: 1000, height: 1000 } }] })); };
    if (/Drop Once/.test(term) && n === 1) return q.socket.destroy();               // the connection drops once
    if (/Busy Once/.test(term) && n === 1) { w.writeHead(429); return w.end(); }     // rate limited once
    if (/Always Down/.test(term)) return q.socket.destroy();                         // never answers
    hit();
  }).listen(0, '127.0.0.1', () => res(s4)); });
  const nd = mkdtempSync(path.join(tmpdir(), 'aa-net-'));
  mkdirSync(path.join(nd, 'scraped'), { recursive: true });
  writeFileSync(path.join(nd, 'scraped', 'catalog.json'), JSON.stringify([
    { id: 'drop', line: 'drop', name: 'Drop Once', brand: 'Federal' },
    { id: 'busy', line: 'busy', name: 'Busy Once', brand: 'Federal' },
    { id: 'down', line: 'down', name: 'Always Down', brand: 'Federal' },
    { id: 'after', line: 'after', name: 'After The Outage', brand: 'Federal' },
  ]));
  const nr = await new Promise((res) => {
    const c = spawn(process.execPath, [path.join(HERE, 'find-images.mjs'), '--catalog-dir', path.join(nd, 'scraped'), '--img-dir', path.join(nd, 'img'), '--rps', '50', '--lenient'],
      { cwd: nd, env: { ...process.env, AA_NO_SHARP: '1', AA_RETRY_MS: '5', BRAVE_API_KEY: 'test-key', BRAVE_API_BASE: `http://127.0.0.1:${net.address().port}` } });
    let out = ''; c.stdout.on('data', (x) => (out += x)); c.stderr.on('data', (x) => (out += x)); c.on('close', (code) => res({ code, out }));
  });
  const nc = JSON.parse(readFileSync(path.join(nd, 'scraped', 'catalog.json'), 'utf8'));
  const nb = (id) => nc.find((p) => p.id === id);
  eq(nr.code, 0, 'network: the run finishes\n' + nr.out);
  eq([nb('drop').photoSearch.result, nb('busy').photoSearch.result], ['found', 'found'], 'network: a dropped connection and a rate limit are retried, and the photo found');
  eq([nb('down').photoSearch, /skipped .*Always Down/.test(nr.out), /1 skipped/.test(nr.out)], [undefined, true, true], 'network: a product the API never answers for is skipped, not marked "no photo" (searched next run)');
  eq(nb('after').photoSearch.result, 'found', 'network: the run carries on past it');
  // the API down for good: stop after five in a row, progress saved, nothing marked "no photo"
  writeFileSync(path.join(nd, 'scraped', 'catalog.json'), JSON.stringify([...Array(8)].map((_, n) => ({ id: `d${n}`, line: `d${n}`, name: `Always Down ${n}`, brand: 'Federal' }))));
  const dr = await new Promise((res) => {
    const c = spawn(process.execPath, [path.join(HERE, 'find-images.mjs'), '--catalog-dir', path.join(nd, 'scraped'), '--img-dir', path.join(nd, 'img'), '--rps', '50', '--lenient'],
      { cwd: nd, env: { ...process.env, AA_NO_SHARP: '1', AA_RETRY_MS: '5', BRAVE_API_KEY: 'test-key', BRAVE_API_BASE: `http://127.0.0.1:${net.address().port}` } });
    let out = ''; c.stdout.on('data', (x) => (out += x)); c.stderr.on('data', (x) => (out += x)); c.on('close', (code) => res({ code, out }));
  });
  const dc = JSON.parse(readFileSync(path.join(nd, 'scraped', 'catalog.json'), 'utf8'));
  eq([dr.code, /stopped answering/.test(dr.out), /5 skipped/.test(dr.out), dc.every((p) => !p.photoSearch)], [0, true, true, true], 'network: the API down for good stops the run after five, progress saved, nothing marked "no photo"');
  net.close();
}

/* ---- the stricter photo bar, --top and --recheck ---- */
{
  const F = await import('./find-images.mjs');
  const zlib = await import('node:zlib');
  // a real PNG, drawn pixel by pixel (no image library needed)
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const png = (w, h, px) => {
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 3 + 1) + 1 + x * 3);
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  };
  const inBox = (x, y, [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const packshot = (w, h, box, bg = [255, 255, 255]) => png(w, h, (x, y) => (inBox(x, y, box) ? [40, 40, 45] : bg));
  const GOOD = packshot(900, 600, [150, 200, 750, 400]);
  const GREY = packshot(900, 600, [150, 200, 750, 400], [232, 232, 234]);
  const BUSY = png(900, 600, (x, y) => [(x * 7 + y * 3) % 200, (x * y) % 180, (y * 11) % 160]);
  const SMALL = packshot(220, 130, [30, 40, 190, 90]);
  eq(F.imageSize(GOOD), { w: 900, h: 600 }, 'imageSize: read from the PNG header');

  // units: the background, the cut-off rule, the scores
  const rawOf = (w, h, box, bg = 255) => { const b = Buffer.alloc(w * h * 3, bg); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inBox(x, y, box)) b.fill(40, (y * w + x) * 3, (y * w + x) * 3 + 3); return b; };
  eq(F.whiteBorder(rawOf(100, 60, [20, 20, 80, 40]), 100, 60) > 0.99, true, 'background: a packshot on white is clean');
  eq(F.whiteBorder(rawOf(100, 60, [20, 20, 80, 40], 230), 100, 60) > 0.99, true, 'background: a light grey studio backdrop counts as clean');
  eq(F.whiteBorder(rawOf(100, 60, [20, 20, 80, 40], 90), 100, 60), 0, 'background: a dark backdrop is not');
  const body = (extra) => { const w = 100, h = 50, b = Buffer.alloc(w * h * 3, 255); for (const [x0, y0, x1, y1] of extra) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) b.fill(40, (y * w + x) * 3, (y * w + x) * 3 + 3); return F.framing(b, w, h); };
  eq(body([[20, 10, 80, 40], [0, 24, 20, 26]]).cut, [], 'cut-off: a whole gun cropped tight, only its thin muzzle at the edge, is not cut');
  eq(body([[0, 15, 70, 30]]).cut, ['left'], 'cut-off: a gun sliced through its thick part at one edge is cut');
  eq(body([[0, 15, 99, 30]]).cut, ['left+right'], 'cut-off: sliced at both ends (a receiver close-up) is cut');
  eq(body([[0, 22, 99, 26], [30, 10, 70, 40]]).cut, [], 'cut-off: a long thin rail touching both ends is whole');
  eq(F.qualityProblem({ width: 900, height: 600 }, {}, 0.95), null, 'bar: a clean packshot passes, whatever its size');
  eq(/packshot/.test(F.qualityProblem({ width: 900, height: 600 }, {}, 0.4)), true, 'bar: a busy background fails');
  eq(F.recheckProblem({ width: 300, height: 200 }, { box: { x0: 0, x1: 10, y0: 0, y1: 10 } }, 0.7), null, 'recheck: a small clean photo already on the site stays');
  eq(/product shot/.test(F.recheckProblem({ width: 900, height: 600 }, { box: { x0: 0, x1: 800, y0: 0, y1: 500 } }, 0.2)), true, 'recheck: a lifestyle or dark shot is taken down');
  const P0 = { brand: 'Federal', name: 'HST 9mm' };
  eq(F.scoreResult({ host: 'www.shutterstock.com', title: 'Federal HST 9mm', image: 'https://www.shutterstock.com/x.jpg', width: 2000, height: 2000 }, P0, null, { strict: true }) < 0, true, 'score: stock-photo sites (watermarks) are out');
  eq(F.scoreResult({ host: 'shop.example', title: 'Federal HST 9mm', image: 'x.jpg', width: 300, height: 200 }, P0, null, { strict: true }),
     F.scoreResult({ host: 'shop.example', title: 'Federal HST 9mm', image: 'x.jpg' }, P0, null, { strict: true }), 'score: a small image is not marked down (it is enlarged)');
  eq(F.scoreResult({ host: 'shop.example', title: 'Federal HST 9mm', image: 'x.jpg', width: 1600, height: 1200 }, P0, null, { strict: true }) >
     F.scoreResult({ host: 'shop.example', title: 'Federal HST 9mm', image: 'x.jpg', width: 300, height: 200 }, P0, null, { strict: true }), true, 'score: …but a bigger one ranks first');

  // end to end, with the resizer when this machine has it
  let hasSharp = true; try { await import('sharp'); } catch { hasSharp = false; }
  if (!hasSharp) console.log('  (sharp not installed: the strict download and --recheck runs are skipped — npm install sharp --no-save to run them)');
  else {
    let hits = 0;
    const img = { '/good.png': GOOD, '/good2.png': GREY, '/busy.png': BUSY, '/small.png': SMALL };
    const api2 = await new Promise((res) => { const s3 = http.createServer((q, w) => {
      const u = new URL(q.url, 'http://x'); const self = `http://127.0.0.1:${s3.address().port}`;
      if (u.pathname === '/res/v1/images/search') {
        hits++;
        const term = u.searchParams.get('q');
        const r = (file, host, wd, ht) => ({ title: term, url: `https://${host}/p`, meta_url: { hostname: host }, properties: { url: self + file, width: wd, height: ht } });
        const results = /Lifestyle/.test(term) ? [r('/busy.png', 'www.federalpremium.com', 2000, 1400), r('/good.png', 'www.federalpremium.com', 900, 600)]
          : /Tiny/.test(term) ? [r('/small.png', 'www.federalpremium.com', 220, 130)]
          : /Pulled/.test(term) ? [r('/good.png', 'www.federalpremium.com', 900, 600), r('/good2.png', 'www.federalpremium.com', 900, 600)]
          : [r('/good.png', 'www.federalpremium.com', 900, 600)];
        w.writeHead(200, { 'Content-Type': 'application/json' }); return w.end(JSON.stringify({ results }));
      }
      if (img[u.pathname]) { w.writeHead(200, { 'Content-Type': 'image/png' }); return w.end(img[u.pathname]); }
      w.writeHead(404); w.end();
    }).listen(0, '127.0.0.1', () => res(s3)); });
    const base = `http://127.0.0.1:${api2.address().port}`;
    const sd = mkdtempSync(path.join(tmpdir(), 'aa-strict-'));
    mkdirSync(path.join(sd, 'scraped'), { recursive: true }); mkdirSync(path.join(sd, 'img'), { recursive: true });
    const run = (args) => new Promise((res) => {
      const c = spawn(process.execPath, [path.join(HERE, 'find-images.mjs'), '--catalog-dir', path.join(sd, 'scraped'), '--img-dir', path.join(sd, 'img'), '--catalog-js', path.join(sd, 'catalog.js'), '--overrides', path.join(sd, 'overrides.json'), '--rps', '50', ...args],
        { cwd: sd, env: { ...process.env, BRAVE_API_KEY: 'test-key', BRAVE_API_BASE: base } });
      let out = ''; c.stdout.on('data', (x) => (out += x)); c.stderr.on('data', (x) => (out += x)); c.on('close', (code) => res({ code, out }));
    });
    const cat = (list) => writeFileSync(path.join(sd, 'scraped', 'catalog.json'), JSON.stringify(list));
    const read = () => JSON.parse(readFileSync(path.join(sd, 'scraped', 'catalog.json'), 'utf8'));
    const byId2 = (id) => read().find((p) => p.id === id);
    cat([
      { id: 'life', line: 'life', name: 'Lifestyle Load', brand: 'Federal' },
      { id: 'tiny', line: 'tiny', name: 'Tiny Load', brand: 'Federal' },
      { id: 'top1', line: 'top1', name: 'Best Seller', brand: 'Federal' },
      { id: 'top2', line: 'top2', name: 'Second Best', brand: 'Federal' },
      { id: 'gone', line: 'gone', name: 'Out Of Stock', brand: 'Federal' },
    ]);
    writeFileSync(path.join(sd, 'catalog.js'), 'window.AA_CATALOG = ' + JSON.stringify({ items: [
      { id: 'life', dept: 'ammo', sub: 'Handgun', status: 'ship', rank: 1 }, { id: 'tiny', dept: 'ammo', sub: 'Handgun', status: 'ship', rank: 2 },
      { id: 'top1', dept: 'ammo', sub: 'Handgun', status: 'ship', rank: 3 }, { id: 'top2', dept: 'ammo', sub: 'Handgun', status: 'ship', rank: 4 },
      { id: 'gone', dept: 'ammo', sub: 'Handgun', status: 'out', rank: 0 },
    ] }) + ';');
    let rr = await run(['--top', '3']);
    eq(rr.code, 0, 'strict --top run exits 0\n' + rr.out);
    eq(/→ top: the 3 product lines/.test(rr.out), true, '--top: takes the N lines most worth a photo');
    eq([byId2('life').photoSource && byId2('life').photoSource.image.endsWith('/good.png'), byId2('tiny').localImages, byId2('top1').localImages && byId2('top1').localImages.length, byId2('top2').photoSearch, byId2('gone').photoSearch],
      [true, ['img/tiny-1.webp'], 1, undefined, undefined], '--top: best first, out of stock skipped, the 4th not reached; a busy photo passed over for the clean one');
    const sharp = (await import('sharp')).default;
    const meta = await sharp(path.join(sd, 'img', 'tiny-1.webp')).metadata();
    eq(Math.max(meta.width, meta.height), 800, 'a small clean photo is enlarged to the standard size, not refused');
    // --recheck: a busy photo already on the site, one pulled by hand, the store's own, a good one
    writeFileSync(path.join(sd, 'img', 'busy-1.png'), BUSY); writeFileSync(path.join(sd, 'img', 'own-1.png'), BUSY);
    writeFileSync(path.join(sd, 'img', 'pulled-1.png'), GOOD); writeFileSync(path.join(sd, 'img', 'fine-1.png'), GOOD);
    cat([
      { id: 'busy', name: 'Busy', brand: 'Federal', localImages: ['img/busy-1.png'], photoSource: { image: 'https://x.example/busy.png' } },
      { id: 'busy-v2', name: 'Busy', brand: 'Federal', localImages: ['img/busy-1.png'], photoSource: { image: 'https://x.example/busy.png', sharedFrom: 'busy' } },
      { id: 'pulled', line: 'pulled', name: 'Pulled Load', brand: 'Federal', localImages: ['img/pulled-1.png'], photoSource: { image: `${base}/good.png` } },
      { id: 'own', name: 'Shirt', brand: 'Agarthan Armory', localImages: ['img/own-1.png'], photoSource: { image: 'https://x.example/own.png' } },
      { id: 'fine', name: 'Fine', brand: 'Federal', localImages: ['img/fine-1.png'], photoSource: { image: 'https://x.example/fine.png' } },
    ]);
    writeFileSync(path.join(sd, 'overrides.json'), JSON.stringify({ _readme: 'r', pulled: { noPhoto: true, _photo: 'pulled 2026-11-09: cut through the product', price: 30 } }));
    rr = await run(['--recheck', '--dry-run']);
    eq([rr.code, /would take down 2 photos/.test(rr.out), existsSync(path.join(sd, 'img', 'busy-1.png'))], [0, true, true], '--recheck --dry-run: lists, changes nothing');
    const h0 = hits;
    rr = await run(['--recheck']);
    eq([rr.code, hits - h0], [0, 0], '--recheck: no API key needed, no searches');
    eq([existsSync(path.join(sd, 'img', 'busy-1.png')), byId2('busy').localImages, byId2('busy-v2').photoSearch.result, byId2('busy').photoSearch.refused], [false, undefined, 'retake', ['https://x.example/busy.png']], '--recheck: a busy photo is taken down from every variant, and remembered as refused');
    eq([byId2('own').localImages, byId2('fine').localImages], [['img/own-1.png'], ['img/fine-1.png']], '--recheck: the store\'s own and good photos stay');
    const ov2 = JSON.parse(readFileSync(path.join(sd, 'overrides.json'), 'utf8'));
    eq([byId2('pulled').localImages, ov2.pulled], [undefined, { price: 30 }], '--recheck: a hand-pulled photo goes back on the list, its pull flag cleared, other corrections kept');
    writeFileSync(path.join(sd, 'catalog.js'), 'window.AA_CATALOG = ' + JSON.stringify({ items: [{ id: 'pulled', dept: 'ammo', sub: 'Handgun', status: 'ship', rank: 1 }, { id: 'busy', dept: 'ammo', sub: 'Handgun', status: 'ship', rank: 2 }] }) + ';');
    rr = await run(['--top', '1']);
    eq(byId2('pulled').photoSource && byId2('pulled').photoSource.image, `${base}/good2.png`, 'a photo taken down is never chosen again (the next clean one is)');
    api2.close();
  }
}

srv.close();
console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
