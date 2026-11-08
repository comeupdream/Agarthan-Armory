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

srv.close();
console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
