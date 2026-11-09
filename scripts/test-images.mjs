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
  const c = spawn(process.execPath, [path.join(HERE, 'match-images.mjs'), ...args], { cwd });
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
const { scoreResult, queriesFor } = await import('./find-images.mjs');
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
  const c = spawn(process.execPath, [path.join(HERE, 'find-images.mjs'), '--catalog-dir', path.join(fd, 'scraped'), '--img-dir', path.join(fd, 'img'), '--rps', '50', ...args],
    { cwd: fd, env: { ...process.env, BRAVE_API_BASE: `http://127.0.0.1:${api.address().port}`, ...env } });
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
  const c = spawn(process.execPath, [path.join(HERE, 'find-images.mjs'), '--cover', '1', '--catalog-dir', path.join(cd, 'scraped'), '--catalog-js', path.join(cd, 'catalog.js'), '--img-dir', path.join(cd, 'img'), '--rps', '50'],
    { cwd: cd, env: { ...process.env, BRAVE_API_KEY: 'test-key', BRAVE_API_BASE: `http://127.0.0.1:${api.address().port}` } });
  let out = ''; c.stdout.on('data', (x) => (out += x)); c.stderr.on('data', (x) => (out += x)); c.on('close', (code) => res({ code, out }));
});
eq(cov.code, 0, 'cover run exits 0\n' + cov.out);
const cc = JSON.parse(readFileSync(path.join(cd, 'scraped', 'catalog.json'), 'utf8'));
const cby = (id) => cc.find((p) => p.id === id);
eq([cby('hst-a').localImages, cby('hst-b').localImages], [['img/hst-a-1.jpg'], ['img/hst-a-1.jpg']], 'cover: the first card\'s line gets a photo, shared by its variant');
eq(cby('deep').photoSearch, undefined, 'cover: a product past the first page is not searched');
eq(searches - before2, 1, 'cover: one search for the one line on the cover');
api.close();

srv.close();
console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
