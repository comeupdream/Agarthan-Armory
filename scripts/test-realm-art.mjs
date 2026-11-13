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
// Agarthan Crystal (amethyst), Polar Night (fluorite) and Vril (green quartz and geodes); each realm asks only for its
// own tile. Black & White lays the Naica cave photo whole instead, and asks for no tile
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
  // the geode field and the banner's lead slide
  const want = [`${sel} .geode-field`, `${sel} .lead-slide`];
  ok(rules.map(([x]) => x).sort().join() === want.sort().join(),
    `only ${realm} asks for its own geode tile (rules: ${rules.map(([x]) => x).join(' | ')})`);
}
ok(tileRules.every(([, r]) => r in GEODES), `no other realm has a geode tile (${tileRules.map(([, r]) => r)})`);
ok(!tileRules.some(([x]) => x.includes('html[data-theme="mono"]')), 'Black & White asks for no geode tile');
ok(/html\[data-theme="mono"\] \.geode-field \{[^}]*realm\/mono\/naica-2600\.webp[^}]*background-size: auto, cover/.test(css), 'Black & White lays the Naica cave whole behind the geode field');
ok(existsSync(path.join(FEATURE, 'realm', 'mono', 'naica-2600.webp')), 'the Black & White Naica picture (2600) exists');

// Vril: the glowing geodes lie behind the Lasers chapter, and only Vril shows (and downloads) them
const lasersChapter = home.match(/<article class="chapter[^"]*">\s*<div class="ch-backdrop realm-only" data-realms="([^"]+)"[\s\S]*?<\/div>\s*<a class="ch-art"[^>]*sub=Lasers/);
ok(!!lasersChapter && lasersChapter[1] === 'vril', `the Lasers chapter has a Vril-only backdrop (found ${lasersChapter && lasersChapter[1]})`);
if (lasersChapter) ok(/glowing-geodes-1500\.webp/.test(lasersChapter[0]) && /loading="lazy"/.test(lasersChapter[0]), 'the backdrop is the glowing geodes, loaded lazily');

// the banner: the manifesto, then "3–5 day lead times" over the realm's crystal (Black & White: its Naica cave)
const banner = home.match(/<div class="banner-track"[^>]*>([\s\S]*?)\n        <\/div>\n      <\/div>/);
ok(!!banner, 'the home page has a banner track');
if (banner) {
  ok(/class="banner-slide manifesto-frame"[\s\S]*manifesto-1280\.webp/.test(banner[1]), 'slide one is the manifesto');
  ok(/class="banner-slide lead-slide"[\s\S]*3–5 day[\s\S]*lead times/.test(banner[1]), 'slide two says 3–5 day lead times');
}
ok(/html\[data-theme="mono"\] \.lead-slide \{[^}]*realm\/mono\/naica-1600\.webp/.test(css), 'Black & White sets the lead slide over its Naica cave');
ok(existsSync(path.join(FEATURE, 'realm', 'mono', 'naica-1600.webp')), 'the Black & White Naica picture exists');

// backdrop switches, in the corner of a plate's picture, all off until pressed:
// - Backdrop, on the plates beside the map: the realm's picture behind the map (Inner Earth: Petra)
// - Top backdrop and See-through, on the Featured plates: that picture behind the departments, cards see-through
const sectionOf = (id) => (home.match(new RegExp(`<section class="[^"]*" id="${id}">([\\s\\S]*?)</section>`)) || [])[1];
const platesIn = (html) => [...html.matchAll(/<figure class="realm-only realm-plate[^"]*" data-realms="([^"]+)">([\s\S]*?)<\/figure>/g)];
const switchesIn = (body) => [...body.matchAll(/<button[^>]*data-switch="([a-z-]+)"[^>]*>/g)];
const checkPlates = (where, html, want, kinds) => {
  const plates = platesIn(html);
  ok(plates.map(([, rs]) => rs).sort().join() === want.slice().sort().join(), `${where}: one plate each for ${want.join(', ')} (found ${plates.map(([, rs]) => rs).join(', ')})`);
  for (const [, rs, body] of plates) {
    const sws = switchesIn(body);
    ok(sws.map((m) => m[1]).join() === kinds.join(), `${where}: the ${rs} plate has the ${kinds.join(' + ')} switch(es) (found ${sws.map((m) => m[1])})`);
    for (const [tag] of sws) ok(/aria-pressed="false"/.test(tag) && /\bhidden\b/.test(tag) && /type="button"/.test(tag), `${where}: the ${rs} switches start off, hidden until home.js wires them`);
    ok(/^\s*<div class="plate-switches">/.test(body) && body.indexOf('plate-switches') < body.indexOf('<img'), `${where}: the ${rs} switches sit in the picture's corner`);
  }
};
const mapHtml = sectionOf('map'), deptHtml = sectionOf('departments'), featHtml = sectionOf('featured');
ok(!!mapHtml && !!deptHtml && !!featHtml, 'the home page has the map, departments and featured sections');
if (mapHtml) {
  checkPlates('map', mapHtml, ['inner-earth mono', 'polar', 'crystal', 'vril'], ['map']);
  ok(/^\s*<!--[^>]*-->\s*<div class="sec-backdrop map-backdrop" aria-hidden="true"><\/div>/.test(mapHtml), 'the map section opens with its backdrop layer, hidden from screen readers');
}
if (featHtml) checkPlates('featured', featHtml, ['polar', 'inner-earth', 'crystal'], ['top', 'see-through']);
if (deptHtml) ok(/^\s*<!--[^>]*-->\s*<div class="sec-backdrop top-backdrop" aria-hidden="true"><\/div>/.test(deptHtml), 'the departments section opens with its backdrop layer, hidden from screen readers');
const SEL = { polar: 'html:not([data-theme])', 'inner-earth': 'html[data-theme="inner-earth"]', mono: 'html[data-theme="mono"]', crystal: 'html[data-theme="crystal"]', vril: 'html[data-theme="vril"]' };
const BACKDROPS = {
  map: { polar: 'polar/ice-cave-exit-1920.webp', crystal: 'crystal/endurance-dawn-1920.webp', 'inner-earth': 'inner-earth/petra-treasury-1600.webp',
    mono: 'mono/symmes-hole-980.webp', vril: 'vril/aurora-sky-2600.webp' },
  top: { polar: 'polar/fluorite-1920.webp', 'inner-earth': 'inner-earth/petra-treasury-1600.webp', crystal: 'crystal/atomium-1920.webp' },
};
for (const [target, pics] of Object.entries(BACKDROPS)) {
  for (const [realm, sel] of Object.entries(SEL)) {
    const rule = css.match(new RegExp(sel.replace(/[[\]()"]/g, '\\$&') + ` \\.${target}-backdrop \\{[^}]*realm/([a-z-]+/[a-z0-9-]+\\.webp)`));
    const pic = pics[realm];
    if (pic) {
      ok(rule && rule[1] === pic, `${realm} lays ${pic} behind the ${target === 'map' ? 'map' : 'departments'} (found ${rule && rule[1]})`);
      ok(existsSync(path.join(FEATURE, 'realm', pic)), `the ${realm} ${target} backdrop picture exists`);
    } else {
      ok(!rule && new RegExp(sel.replace(/[[\]()"]/g, '\\$&') + `[^{]*\\.${target}-backdrop[^{]*\\{ display: none; \\}`).test(css), `${realm} lays nothing behind the departments`);
    }
  }
}
ok(/\.sec-backdrop \{ display: none;/.test(css) && /\.has-backdrop > \.sec-backdrop \{ display: block; \}/.test(css),
  'a backdrop shows only once switched on (so its picture is not even downloaded before then)');
ok(/#departments\.has-backdrop\.see-through \.dept \{/.test(css), 'See-through turns the department cards see-through only while the picture is behind them');
const homeJs = readFileSync(path.join(ROOT, 'assets/js/home.js'), 'utf8');
for (const k of ['aa-map-backdrop', 'aa-top-backdrop', 'aa-top-see-through']) ok(homeJs.includes(`'${k}'`), `home.js remembers ${k}`);
ok(/AA\.store\.get\(sw\.key, false\) === true/.test(homeJs), 'every switch is off unless this browser turned it on');

// the link preview: every page names the same card, at the address that serves this site, and the card is in the repo
const SITE = 'https://agarthan-armory.onrender.com';
const jpegSize = (file) => { const b = readFileSync(file); for (let i = 2; i < b.length - 9;) { if (b[i] !== 0xff) return null; const m = b[i + 1]; if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + b.readUInt16BE(i + 2); } return null; };
for (const [file, url] of [['index.html', '/'], ['armory.html', '/armory'], ['forbidden.html', '/forbidden'], ['transfers.html', '/transfers']]) {
  const h = readFileSync(path.join(ROOT, file), 'utf8');
  const meta = (k) => (h.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`)) || [])[1];
  const img = meta('og:image') || '';
  ok(img.startsWith(SITE + '/assets/img/'), `${file}: the share card is at ${SITE} (got ${img})`);
  ok(meta('twitter:image') === img, `${file}: twitter:image is the same card as og:image`);
  ok(meta('og:url') === SITE + url, `${file}: og:url is ${SITE + url} (got ${meta('og:url')})`);
  ok(meta('twitter:card') === 'summary_large_image', `${file}: the card is shown large`);
  const local = path.join(ROOT, img.slice(SITE.length + 1));
  ok(existsSync(local), `${file}: ${img.slice(SITE.length + 1)} is in the repo`);
  if (existsSync(local)) ok(JSON.stringify(jpegSize(local)) === JSON.stringify([+meta('og:image:width'), +meta('og:image:height')]) && +meta('og:image:width') === 1200 && +meta('og:image:height') === 630, `${file}: the card is 1200×630, as its tags say`);
}
ok(readFileSync(path.join(ROOT, 'robots.txt'), 'utf8').includes(`Sitemap: ${SITE}/sitemap.xml`), 'robots.txt names the sitemap at the same address');
ok(!/agarthanarmory\.com/.test(readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8')), 'sitemap.xml lists pages at the address that serves them');

console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
