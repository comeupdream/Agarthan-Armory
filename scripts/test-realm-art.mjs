#!/usr/bin/env node
/* test-realm-art.mjs — the owner's art has a recoloured copy for every realm.
 * Every realm prefs.js offers (except Polar Night, which shows the art as
 * delivered) must be one site.js swaps to, and must have a copy of every
 * picture site.js swaps, at the same size as the original.
 *   node scripts/test-realm-art.mjs */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FEATURE = path.join(ROOT, 'assets/img/feature');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log(`  ✗ ${msg}`); } };

const site = readFileSync(path.join(ROOT, 'assets/js/site.js'), 'utf8');
const prefs = readFileSync(path.join(ROOT, 'assets/js/prefs.js'), 'utf8');
const realms = JSON.parse(site.match(/const REALMS = new Set\((\[[^\]]*\])\)/)[1].replace(/'/g, '"'));
const art = new RegExp(site.match(/const REALM_ART = \/(.+)\/g;/)[1]);
const themes = [...prefs.matchAll(/\{ id: '([a-z-]+)', name: '[^']+', sw:/g)].map((m) => m[1]);

// the realms on offer and the realms with art are the same list
ok(themes.includes('polar'), 'prefs.js still offers Polar Night');
ok(JSON.stringify(themes.filter((t) => t !== 'polar').sort()) === JSON.stringify([...realms].sort()),
  `site.js recolours ${[...realms]} but prefs.js offers ${themes}`);

// webp width × height, from the VP8 / VP8L / VP8X header
function size(file) {
  const b = readFileSync(file);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

const originals = readdirSync(FEATURE).filter((f) => art.test(`assets/img/feature/${f}`));
ok(originals.length === 7, `seven pictures of the owner's art are swapped (found ${originals.length}: ${originals})`);
for (const realm of realms) {
  for (const f of originals) {
    const copy = path.join(FEATURE, 'realm', realm, f);
    ok(existsSync(copy), `${realm}/${f} exists`);
    if (existsSync(copy)) ok(String(size(copy)) === String(size(path.join(FEATURE, f))), `${realm}/${f} is the size of the original`);
  }
}

// every page that shows the owner's art loads site.js, which does the swap
for (const page of ['index.html', 'armory.html', 'forbidden.html']) {
  const html = readFileSync(path.join(ROOT, page), 'utf8');
  ok(/assets\/js\/site\.js/.test(html), `${page} loads site.js`);
}

console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
