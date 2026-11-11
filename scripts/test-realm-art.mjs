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
ok(originals.length === 9, `nine pictures of the owner's art are swapped (found ${originals.length}: ${originals})`);
for (const realm of realms) {
  for (const f of originals) {
    const copy = path.join(FEATURE, 'realm', realm, f);
    ok(existsSync(copy), `${realm}/${f} exists`);
    if (existsSync(copy)) ok(String(size(copy)) === String(size(path.join(FEATURE, f))), `${realm}/${f} is the size of the original`);
  }
}

// every page that shows the owner's art loads site.js, which does the swap,
// and every picture a page names (src or srcset, realm-only copies included) is on disk
for (const page of ['index.html', 'armory.html', 'forbidden.html', 'transfers.html', '404.html']) {
  const html = readFileSync(path.join(ROOT, page), 'utf8');
  ok(/assets\/js\/site\.js/.test(html), `${page} loads site.js`);
  for (const [, ref] of html.matchAll(/(assets\/img\/[^\s"',?]+\.(?:webp|jpe?g|png|svg|gif))/g))
    ok(existsSync(path.join(ROOT, ref)), `${page} names ${ref}, which exists`);
}

// a realm-only piece has a copy for each realm it is shown in
const home = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const [, realmsAttr, body] of home.matchAll(/class="realm-only[^"]*" data-realms="([^"]+)"([\s\S]*?)<\/(?:figure|section)>/g)) {
  for (const realm of realmsAttr.split(/\s+/))
    ok(new RegExp(`data-realm="${realm}"`).test(body), `a realm-only piece shown in ${realm} has a ${realm} picture`);
}

// the green pictures (lasers, night vision) sit out Inner Earth and Agarthan Crystal, on the home page and in the Armory
const NO_GREEN = ['inner-earth', 'crystal'];
const css = readFileSync(path.join(ROOT, 'assets/css/site.css'), 'utf8');
for (const r of NO_GREEN)
  ok(css.includes(`html[data-theme="${r}"] [data-sits-out~="${r}"]`), `site.css hides data-sits-out art in ${r}`);
for (const [sub, files] of [['Lasers', ['green-laser-rifle', 'laser-cave']], ['Night%20Vision', ['night-vision-416']]]) {
  const m = home.match(new RegExp(`<a class="ch-art[^"]*" data-sits-out="([^"]+)" href="armory\\.html\\?dept=optics&amp;sub=${sub}"[\\s\\S]*?<\\/a>`));
  ok(!!m, `the ${sub} chapter's art names the realms it sits out`);
  if (!m) continue;
  const out = m[1].split(/\s+/);
  ok(JSON.stringify([...out].sort()) === JSON.stringify([...NO_GREEN].sort()), `the ${sub} chapter's art sits out ${NO_GREEN} only (found "${m[1]}")`);
  for (const f of files) ok(m[0].includes(f), `the ${sub} chapter still carries ${f} for the other realms`);
}
const armory = readFileSync(path.join(ROOT, 'assets/js/armory.js'), 'utf8');
const sitsOut = (armory.match(/const NO_GREEN = (\[[^\]]*\])/) || [])[1];
ok(sitsOut && JSON.stringify(JSON.parse(sitsOut.replace(/'/g, '"')).sort()) === JSON.stringify([...NO_GREEN].sort()),
  `the Armory's green headers sit out ${NO_GREEN} (found ${sitsOut})`);
for (const [key, file] of [['optics/Lasers', 'lasers-900'], ['optics/Night Vision', 'night-vision-416']])
  ok(new RegExp(`'${key}': \\['${file}\\.webp', '[^']*', NO_GREEN\\]`).test(armory), `the Armory ${key} header is marked to sit out those realms`);
ok(/art\[2\]\.includes\(document\.documentElement\.dataset\.theme\)/.test(armory), 'showArt honours a header\'s sit-out realms');

// the geode field: the Silent Vault and the gate share one bed of crystal in Inner Earth (rhodochrosite),
// Agarthan Crystal (amethyst), Polar Night (fluorite) and Vril (green quartz and druzy); each realm asks only for its
// own tile, and Black & White for none
const GEODES = { 'inner-earth': 'html[data-theme="inner-earth"]', crystal: 'html[data-theme="crystal"]', vril: 'html[data-theme="vril"]', polar: 'html:not([data-theme])' };
const field = home.match(/<div class="geode-field">([\s\S]*?)\n  <\/div>\n/);
ok(!!field, 'the home page has a geode field');
if (field) for (const id of ['silent-vault', 'gate-in-the-wall']) ok(field[1].includes(`id="${id}"`), `the geode field holds #${id}`);
const tileRules = [...css.matchAll(/([^{}]+)\{[^{}]*realm\/([a-z-]+)\/geode-tile\.webp[^{}]*\}/g)].map((m) => [m[1].trim().split('\n').pop().trim(), m[2]]);
for (const [realm, sel] of Object.entries(GEODES)) {
  const tile = path.join(FEATURE, 'realm', realm, 'geode-tile.webp');
  ok(existsSync(tile), `${realm} has a geode tile (tools/realm-art.py --geodes)`);
  if (existsSync(tile)) { const [w, h] = size(tile); ok(w === h && w >= 800, `the ${realm} geode tile is a square of at least 800 px (${w}×${h})`); }
  const rules = tileRules.filter(([, r]) => r === realm);
  ok(rules.length === 1 && rules[0][0] === `${sel} .geode-field`, `only ${realm} asks for its own geode tile (rules: ${rules.map(([x]) => x).join(' | ')})`);
}
ok(tileRules.every(([, r]) => r in GEODES), `no other realm has a geode tile (${tileRules.map(([, r]) => r)})`);
for (const sel of ['html[data-theme="mono"]'])
  ok(!tileRules.some(([x]) => x.includes(sel)), `${sel} asks for no geode tile`);

// Vril: the glowing geodes lie behind the Lasers chapter, and only Vril shows (and downloads) them
const lasersChapter = home.match(/<article class="chapter[^"]*">\s*<div class="ch-backdrop realm-only" data-realms="([^"]+)"[\s\S]*?<\/div>\s*<a class="ch-art"[^>]*sub=Lasers/);
ok(!!lasersChapter && lasersChapter[1] === 'vril', `the Lasers chapter has a Vril-only backdrop (found ${lasersChapter && lasersChapter[1]})`);
if (lasersChapter) ok(/glowing-geodes-1500\.webp/.test(lasersChapter[0]) && /loading="lazy"/.test(lasersChapter[0]), 'the backdrop is the glowing geodes, loaded lazily');

console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
