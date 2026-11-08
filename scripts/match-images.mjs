#!/usr/bin/env node
/* =============================================================================
 * match-images.mjs — put product photos on the catalog by UPC.
 *
 * Every scraped product carries a UPC. Distributors (RSR, Davidson's,
 * Lipsey's, Sports South, Zanders, Chattanooga…) and manufacturers' dealer
 * portals hand their dealers product images for exactly this use — as image
 * packs (a folder or zip of files) or as image links in the dealer feed. This
 * matches those to the catalog and saves them as the products' photos.
 *
 * SOURCES (combine as many as you have):
 *   --folder <dir>   image files, searched recursively. A file name that is a
 *                    UPC matches directly ("090255827415.jpg", "…_2.jpg",
 *                    "… (3).png" for extra angles; leading zeros optional).
 *                    Any other name is looked up through --csv --key-col
 *                    (e.g. RSR names images by RSR stock number).
 *   --csv <file>     a feed / spreadsheet (comma, semicolon, tab or pipe):
 *                    --upc-col   the UPC column  (header name or 1-based number;
 *                                default: a header like UPC / GTIN / EAN / Barcode)
 *                    --key-col   column that names the image files in --folder
 *                    --image-cols columns holding image links, comma-separated
 *                                (default: headers containing image / img / photo / picture)
 *                    --no-header the file has no header row (use column numbers)
 *
 * OUTPUT: assets/img/products/<id>-<n>.jpg, and each scraped catalog's
 * localImages updated (assets/data/scraped/**). Then: npm run build:catalog
 *
 * SIZE: with `sharp` installed (npm i sharp) photos are resized to --size px
 * (default 1000) as JPEG — about 60–120 KB each. Without it files are copied
 * as they are. --max sets photos per product (default 1 — a 3,000-product
 * catalog at 4 photos each is thousands of files in the repo).
 *
 * OTHER: --replace  redo products that already have photos
 *        --dry-run  report matches, write nothing
 *        --catalog-dir assets/data/scraped   --img-dir assets/img/products
 * ===========================================================================*/
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const all = (n) => argv.flatMap((a, i) => (a === '--' + n && argv[i + 1] && !argv[i + 1].startsWith('--') ? [argv[i + 1]] : []));
const arg = (n, d) => { const v = all(n); return v.length ? v[v.length - 1] : d; };
const flag = (n) => argv.includes('--' + n);
const num = (n, d, min) => { const v = parseInt(arg(n, String(d)), 10); return Number.isFinite(v) && v >= min ? v : d; };

/** UPC/EAN/GTIN → comparison key: digits only, leading zeros dropped (UPC-A 12 and EAN-13 agree) */
export const upcKey = (v) => { const d = String(v || '').replace(/\D/g, '').replace(/^0+/, ''); return d.length >= 8 && d.length <= 14 ? d : null; };
export const upcOf = (p) => {
  if (p.upc) return upcKey(p.upc);
  for (const [k, v] of Object.entries(p.attributes || {})) if (/^(upc|gtin|ean|barcode)/i.test(k)) { const u = upcKey(v); if (u) return u; }
  return /^\d{11,14}$/.test(String(p.sku || '')) ? upcKey(p.sku) : null;
};
const IMG_EXT = /\.(jpe?g|png|webp|gif)$/i;
/** "090255827415_2" → { base: "090255827415", n: 2 } ; "GLPA175S203 (3)" → { base: "GLPA175S203", n: 3 } */
export function stemOf(file) {
  let s = path.basename(file).replace(IMG_EXT, '');
  let n = 0;
  const m = s.match(/^(.+?)(?:[ _-]+(?:alt|view|angle|img|image)?[ _-]*(\d{1,2})|\s*\((\d{1,2})\)|[ _-](main|front|hr|hi|lg|large|xl))$/i);
  if (m) { s = m[1]; n = m[2] ? +m[2] : m[3] ? +m[3] : 0; }
  return { base: s.trim(), n };
}

/* ---------- tiny CSV reader: quotes, embedded delimiters/newlines, delimiter sniffing ---------- */
export function parseCsv(text, delim) {
  text = text.replace(/^﻿/, '');
  if (!delim) {
    const first = text.split(/\r?\n/, 1)[0];
    delim = [',', ';', '\t', '|'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  }
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"' && cell === '') { q = true; continue; }
    if (c === delim) { row.push(cell); cell = ''; continue; }
    if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
const colIndex = (spec, header) => {
  if (spec == null) return -1;
  if (/^\d+$/.test(spec)) return +spec - 1;
  return header ? header.findIndex((h) => h.trim().toLowerCase() === String(spec).trim().toLowerCase()) : -1;
};

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) await walk(f, out); else if (IMG_EXT.test(e.name)) out.push(f);
  }
  return out;
}
const isImage = (b) => (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ||
  b.subarray(0, 4).toString() === 'GIF8' || (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP');
const extOf = (b) => (b[0] === 0xff ? '.jpg' : b[0] === 0x89 ? '.png' : b.subarray(0, 4).toString() === 'GIF8' ? '.gif' : '.webp');

async function main() {
  const FOLDERS = all('folder'), CSVS = all('csv');
  if (!FOLDERS.length && !CSVS.length) { console.error('usage: node scripts/match-images.mjs --folder <images> [--csv <feed> --key-col <col>] | --csv <feed with image links>'); process.exit(1); }
  const MAX = num('max', 1, 1), SIZE = num('size', 1000, 200), QUALITY = num('quality', 80, 30), CONC = num('concurrency', 4, 1);
  const CAT_DIR = path.resolve(arg('catalog-dir', 'assets/data/scraped'));
  const IMG_DIR = path.resolve(arg('img-dir', 'assets/img/products'));
  const IMG_REL = path.relative(process.cwd(), IMG_DIR).split(path.sep).join('/');
  const DRY = flag('dry-run'), REPLACE = flag('replace');
  let sharp = null;
  try { sharp = (await import('sharp')).default; } catch { /* optional */ }
  console.log(sharp ? `→ resizing to ${SIZE}px JPEG (sharp)` : '→ sharp not installed: copying files as they are (npm i sharp to resize)');

  /* catalogs */
  const files = [path.join(CAT_DIR, 'catalog.json')];
  try { for (const e of await readdir(CAT_DIR, { withFileTypes: true })) if (e.isDirectory()) files.push(path.join(CAT_DIR, e.name, 'catalog.json')); } catch { /* none */ }
  const cats = [];
  for (const f of files) { try { cats.push({ f, list: JSON.parse(await readFile(f, 'utf8')) }); } catch { /* missing */ } }
  const byUpc = new Map(); let total = 0, noUpc = 0;
  for (const c of cats) for (const p of c.list) { total++; const u = upcOf(p); if (!u) { noUpc++; continue; } (byUpc.get(u) || byUpc.set(u, []).get(u)).push(p); }
  console.log(`  ${total} products in ${cats.length} catalog(s), ${byUpc.size} distinct UPCs${noUpc ? `, ${noUpc} without a UPC` : ''}`);

  /* sources → candidates per UPC: [{ kind: 'file'|'url', src, n }] */
  const cand = new Map();
  const add = (u, c) => { if (!byUpc.has(u)) return false; (cand.get(u) || cand.set(u, []).get(u)).push(c); return true; };
  const keyToUpc = new Map();
  for (const csv of CSVS) {
    const rows = parseCsv(await readFile(csv, 'utf8'), arg('delimiter'));
    const header = flag('no-header') ? null : rows.shift();
    let uc = colIndex(arg('upc-col'), header);
    if (uc < 0 && header) uc = header.findIndex((h) => /\b(upc|gtin|ean|barcode)\b/i.test(h));
    const kc = colIndex(arg('key-col'), header);
    let ics = (arg('image-cols') ? arg('image-cols').split(',').map((s) => colIndex(s.trim(), header)) : []).filter((i) => i >= 0);
    if (!ics.length && header) ics = header.map((h, i) => (/image|img|photo|picture/i.test(h) ? i : -1)).filter((i) => i >= 0);
    if (uc < 0) { console.error(`✗ ${csv}: no UPC column found — pass --upc-col`); process.exit(1); }
    let urls = 0;
    for (const r of rows) {
      const u = upcKey(r[uc]); if (!u) continue;
      if (kc >= 0 && r[kc]) keyToUpc.set(r[kc].trim().toLowerCase(), u);
      ics.forEach((ic, k) => String(r[ic] || '').split(/[\s,;|]+/).filter((x) => /^https?:\/\//i.test(x)).forEach((src, j) => { if (add(u, { kind: 'url', src, n: k * 10 + j })) urls++; }));
    }
    console.log(`  ${csv}: ${rows.length} rows · ${keyToUpc.size} item keys · ${urls} image links for catalog products`);
  }
  let fileMatches = 0, fileCount = 0;
  for (const dir of FOLDERS) {
    const list = await walk(path.resolve(dir)); fileCount += list.length;
    for (const f of list) {
      const { base, n } = stemOf(f);
      const u = upcKey(base) && byUpc.has(upcKey(base)) ? upcKey(base) : keyToUpc.get(base.toLowerCase()) || keyToUpc.get(path.basename(f).replace(IMG_EXT, '').toLowerCase());
      if (u && add(u, { kind: 'file', src: f, n })) fileMatches++;
    }
  }
  if (FOLDERS.length) console.log(`  ${fileCount} image files · ${fileMatches} matched to catalog products`);

  /* work list */
  const jobs = [];
  for (const [u, list] of cand) {
    const pick = list.sort((a, b) => a.n - b.n).slice(0, MAX);
    for (const p of byUpc.get(u)) if (REPLACE || !(p.localImages || []).length) jobs.push({ p, pick });
  }
  const covered = new Set(jobs.map((j) => j.p)).size;
  console.log(`  → ${covered} products to photograph (${byUpc.size - cand.size} UPCs had no source)`);
  if (DRY) { console.log('  dry run — nothing written'); return; }

  await mkdir(IMG_DIR, { recursive: true });
  let saved = 0, failed = 0, bytes = 0, i = 0;
  const work = async () => {
    while (i < jobs.length) {
      const { p, pick } = jobs[i++];
      const out = [];
      for (const [k, c] of pick.entries()) {
        try {
          let buf = c.kind === 'file' ? await readFile(c.src) : Buffer.from(await (async () => {
            const r = await fetch(c.src, { headers: { 'User-Agent': 'AgarthanArmory-catalog/1.0', Accept: 'image/*' } });
            if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer();
          })());
          if (!isImage(buf)) throw new Error('not an image');
          let ext = extOf(buf);
          if (sharp) { buf = await sharp(buf).rotate().flatten({ background: '#ffffff' }).resize({ width: SIZE, height: SIZE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer(); ext = '.jpg'; }
          const name = `${p.id}-${k + 1}${ext}`;
          await writeFile(path.join(IMG_DIR, name), buf);
          out.push(`${IMG_REL}/${name}`); saved++; bytes += buf.length;
        } catch (e) { failed++; if (failed <= 15) console.log(`  ✗ ${p.id}: ${c.src} — ${e.message}`); }
      }
      if (out.length) p.localImages = out;
      if ((saved + failed) % 250 === 0) console.log(`    ${saved} saved…`);
    }
  };
  await Promise.all(Array.from({ length: CONC }, work));
  for (const c of cats) await writeFile(c.f, JSON.stringify(c.list, null, 2) + '\n');
  const withPhotos = cats.reduce((a, c) => a + c.list.filter((p) => (p.localImages || []).length).length, 0);
  console.log(`\n✓ ${saved} photos saved (${(bytes / 1e6).toFixed(1)} MB), ${failed} failed · ${withPhotos} of ${total} products now have photos`);
  console.log('  next: npm run build:catalog');
}
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main().catch((e) => { console.error('✗ ' + (e.stack || e)); process.exit(1); });
