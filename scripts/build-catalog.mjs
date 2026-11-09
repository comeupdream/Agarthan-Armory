#!/usr/bin/env node
/* =============================================================================
 * build-catalog.mjs — scraped store data → assets/data/catalog.js (what the
 * site renders). Seconds, no network; re-run any time the rules or the
 * overrides change.
 *
 *   in   assets/data/scraped/catalog.json   (scripts/scrape.mjs)
 *        assets/data/overrides.json         (optional hand corrections, below)
 *   out  assets/data/catalog.js             (demo: false)
 *
 * Per product it decides: the department (sidearms, longarms, shotguns, ammo,
 * optics, gear), whether it is a FIREARM (drives the FFL note), the hologram
 * icon, the spec rows (caliber, capacity, barrel, action, …), the stock state
 * and the price. Rules are keyword heuristics over the store's own categories
 * first and the product name second; whatever they get wrong, overrides fix.
 *
 * Nothing is invented: no SKU, price or spec that the store did not publish.
 *
 * overrides.json — keyed by product id (the slug in catalog.js):
 *   { "glock-19-gen5": { "dept": "sidearms", "type": "pistol", "featured": true,
 *                        "lore": "Standard issue below the ice.", "hide": false,
 *                        "firearm": true, "name": "…", "specs": { "barrel": "4.02 in" } } }
 *   "noPhoto": true on any product takes its photo off the site — and off every
 *   product sharing that photo (the variants of its line): how a wrong web photo goes.
 *
 * USAGE  node scripts/build-catalog.mjs [--in path] [--overrides path] [--out path] [--remote-images]
 *   (no --in: merges every store scraped under assets/data/scraped/, e.g. the
 *    main site plus `--out assets/data/scraped/shop` for a second storefront)
 *   --remote-images  fall back to the store's own photo URLs when a product
 *                    has no downloaded photo (hotlinks: break if that host moves)
 * ===========================================================================*/
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { readCatalog, catalogExists } from './lib-store.mjs';
import { pathToFileURL } from 'node:url';
import { subOf, facetsOf, storePath, isRifleCartridge } from './lib-facets.mjs';

/* ---------- classification ---------- */
const T = (s) => String(s || '').toLowerCase();
const has = (re, ...parts) => parts.some((p) => re.test(T(p)));

const RE = {
  ammoCat: /\b(ammo|ammunition|cartridges?|shotshells?|reloading|bulk ammo)\b/,
  ammoName: /\b(ammo|ammunition|shotshells?|buckshot|birdshot|slugs?|bulk pack)\b|\b(00|000|#?[1-9])\s?buck\b|\b\d{2,3}\s?(gr|grain)\b|\b\d{1,4}\s?(rd|rds|rounds?|ct)\s*(box|case|pack|bag|can)\b|\bbox of \d+|\b(2-3\/4|2 3\/4|2\.75|3-1\/2)\s?("|in\b|inch)/,
  optics: /\b(optics?|scopes?|riflescopes?|red ?dots?|reflex|holographic|prism|magnifiers?|lpvo|thermal|night vision|nvg|monoculars?|binoculars?|rangefinders?|sights?|lasers?|holosun|vortex|trijicon|eotech|aimpoint|leupold|burris|nightforce|swampfox|primary arms|pulsar|steiner)\b|\b\d+(\.\d+)?-\d+(\.\d+)?x\d*\b/,
  gearName: /\b(magazines?|mags?|pmags?|holsters?|cases?|bags?|backpacks?|safes?|vaults?|lock ?box|slings?|cleaning|solvent|lube|oil|bore ?snake|brush(es)?|kits?|grips?|stocks?|handguards?|rails?|mounts?|rings|bipods?|targets?|ear pro|hearing|eye pro|glasses|apparel|shirts?|hats?|hoodies?|patches?|knives|knife|lights?|flashlights?|lumens?|triggers?|buffers?|springs?|parts|gift cards?|stickers?|muzzle brakes?|compensators?|flash hiders?)\b/,
  receiver: /\b(stripped|complete|billet|forged)?\s?lower receivers?\b|\bstripped lower\b|\bcomplete lower\b/,
  shotgun: /\bshotguns?\b|\b(12|16|20|28)\s?(ga|gauge)\b|\.?410\s?(bore|ga)?\b/,
  handgun: /\b(pistols?|handguns?|revolvers?|sidearms?|semi-?auto pistol)\b/,
  rifle: /\b(rifles?|carbines?|ar-?15s?|ar-?10s?|ak-?47s?|lever[- ]action|bolt[- ]action|pcc|msr|sbr|long ?guns?|m&p ?15|m4|m4a1|mini-14|m1a|m14|garand|sks)\b/,
  rifleCal: /\b5\.56|\.223|\.308|\b6\.5 ?(creedmoor|cm|prc|grendel)|\b7\.62|\b300 ?(blk|blackout|aac|win|prc)|\.30-06|\b30-06|\.270|\.243|\.350 legend|\.450 bushmaster|\.45-70|\.30-30|\b6mm/,
  pistolCal: /\b9 ?mm|\.380|\.40 ?(s&w|sw)|\b10 ?mm|\.45 ?(acp|auto)|\.357|\.38 ?(spl|special)|\.44 ?(mag|special)|\.22 ?lr|\b22 ?lr|5\.7 ?x ?28/,
  firearmCat: /\b(firearms?|guns?|handguns?|pistols?|revolvers?|rifles?|shotguns?|long ?guns?|used guns?|consignment guns?)\b/,
  // a firearm whose own name says it is regulated by the National Firearms Act
  nfa: /\bsbr\b|\bsbs\b|short[- ]?barrel(?:l?ed)? (?:rifle|shotgun)|\baow\b|any other weapon/,
};
// Gearfire's own departments (Shooting Sports › Category › Subcategory) say exactly where a product goes
const GF_DEPT = { handguns: 'sidearms', rifles: 'longarms', shotguns: 'shotguns', ammunition: 'ammo', 'reloading supplies': 'ammo',
  optics: 'optics', 'nfa/suppressors': 'nfa', 'receivers & frames': 'longarms' };
export function classify(p) {
  const sp = storePath(p);
  if (sp) {
    const c = T(sp.cat), sc = T(sp.sub);
    if (c === 'black powder guns & accessories') return /handgun/.test(sc) ? 'sidearms' : /rifle/.test(sc) ? 'longarms' : 'gear';
    if (c === 'gear & accessories' && /suppressor/.test(sc)) return 'gear';
    return GF_DEPT[c] || 'gear';
  }
  const cats = (p.categories || []).join(' / ');
  const tags = (p.tags || []).join(' ');
  const name = p.name || '';
  const attrs = Object.keys(p.attributes || {}).join(' ');
  // categories are the store's own words — trust them before the name
  if (has(RE.ammoCat, cats)) return 'ammo';
  if (has(RE.optics, cats) && !has(RE.firearmCat, cats)) return 'optics';
  const firearmCat = has(RE.firearmCat, cats);
  if (firearmCat || !cats) {
    if (has(RE.shotgun, cats)) return 'shotguns';
    if (has(RE.handgun, cats)) return 'sidearms';
    if (has(RE.rifle, cats)) return 'longarms';
  }
  if (has(/\b(accessor|parts?|gear|apparel|merch|cleaning|storage|holsters?|magazines?|cases?|safes?)\b/, cats)) {
    return has(RE.optics, name) && !has(RE.gearName, name.replace(/\b(scope|sight) mounts?\b/i, '')) ? 'optics' : 'gear';
  }
  // the name: ammo and optics before guns ("12 ga shotshell", "rifle scope")
  if (has(RE.ammoName, name, tags)) return 'ammo';
  if (has(RE.optics, name) && !has(/\b(mounts?|rings|covers?|caps?)\b/, name) && !has(RE.handgun, name) && !has(/\brifle\b(?! ?scope)/, name)) return 'optics';
  if (has(RE.gearName, name) && !has(/\b(pistol|rifle|shotgun|revolver)\b(?!\s?(grip|case|bag|mag|magazine|sling|stock|light|safe|rest))/, name)) return 'gear';
  if (has(RE.receiver, name)) return 'longarms';
  if (has(RE.shotgun, name, tags, attrs)) return 'shotguns';
  if (has(RE.handgun, name, tags)) return 'sidearms';
  if (has(RE.rifle, name, tags)) return 'longarms';
  // listed by model only ("M&P15 Sport III 5.56 16\""): read it the way a person
  // would — a cartridge plus a barrel length means a gun; the length says which
  const barrel = barrelIn(name);
  if (barrel && (has(RE.rifleCal, name) || has(RE.pistolCal, name))) return barrel >= 10 ? 'longarms' : 'sidearms';
  if (firearmCat) return 'longarms';
  return 'gear';
}
const FIREARM_DEPTS = new Set(['sidearms', 'longarms', 'shotguns', 'nfa']);
export const ARP = 'AR & Rifle-Caliber Pistols';
export const OWN_BRAND = /agarthan/i;   // the store's own products
/** the barrel-length filter's ranges, by what a buyer compares: handguns by the inch; rifles fine below the
 *  16" line (AR pistols, SBR lengths) and by 2" above it; shotguns from home-defense to bird-gun lengths */
const RANGES = {
  sidearms: [3, 4, 5, 6], longarms: [8, 10.5, 12.5, 14.5, 16, 18, 20, 22, 24], nfa: [8, 10.5, 12.5, 14.5, 16], shotguns: [18.5, 20, 24, 26, 28],
  gear: [4, 6, 8, 10.5, 12.5, 14.5, 16, 18, 20, 22, 24],   // barrels and uppers sold as parts
};
export function barrelRange(dept, sub, inches) {
  if (!(inches > 0)) return null;
  const cuts = RANGES[dept];   // one scale per department, so its filter never shows overlapping ranges
  if (!cuts) return null;
  const fmt = (n) => String(+n.toFixed(2));
  if (inches < cuts[0]) return `Under ${fmt(cuts[0])}"`;
  for (let k = 1; k < cuts.length; k++) if (inches < cuts[k]) return `${fmt(cuts[k - 1])}–${fmt(cuts[k])}"`;
  return `${fmt(cuts[cuts.length - 1])}"+`;
}
const BARREL_RE = /\b(\d{1,2}(?:\.\d{1,3})?)\s?(?:"|”|''|in\b|inch(?:es)?\b|-inch)/i;
/** barrel length in inches from a listing name, or null */
export const barrelIn = (s) => { const m = String(s || '').match(BARREL_RE); const n = m ? parseFloat(m[1]) : NaN; return n >= 2 && n <= 34 ? n : null; };
export function iconFor(dept, p) {
  const n = T(`${p.name} ${(p.categories || []).join(' ')}`);
  switch (dept) {
    case 'sidearms': return /revolver|wheel ?gun|single action army|\bsaa\b|\b(gp100|sp101|lcr|redhawk|blackhawk|model 686|model 629|python|anaconda|king cobra)\b/.test(n) ? 'revolver' : 'pistol';
    case 'longarms':
      if (/lever/.test(n)) return 'lever';
      if (/\b(m1a|m14|garand|sks|fal|g3|m1 carbine|battle rifle)\b/.test(n)) return 'battle';
      if (/\.22\s?(lr|wmr)?\b|\b22\s?lr\b|rimfire|10\/22|\.17\s?hmr/.test(n)) return 'rimfire';
      if (/receiver|ar-?15|ar-?10|\bm4|5\.56|\.223|300 ?blk|blackout|m&p ?15|carbine/.test(n)) return 'ar';
      if (/bolt|precision rifle|hunting rifle|\b(tikka|remington 700|ruger american|savage|bergara|howa|weatherby|browning x-bolt|mossberg patriot)\b/.test(n)) return 'bolt';
      return 'ar';
    case 'shotguns': return /semi|auto(loader)?\b|\b(benelli|m4|m2|a300|a400|1301|sbe|1100|11-87|sa-08|930|940|vr80)\b/.test(n) ? 'semishotgun' : 'shotgun';
    case 'ammo': return /\b(12|16|20|28)\s?(ga|gauge)\b|\.410|shotshell|buckshot|birdshot|slug/.test(n) ? 'shells' : 'ammo';
    case 'nfa': return /short barrel+ed shotgun|\bsbs\b/.test(n) ? 'shotgun' : /short barrel+ed rifle|\bsbr\b|package/.test(n) ? 'ar' : /\baow\b|any other weapon/.test(n) ? 'pistol' : 'can';
    case 'optics':
      if (/thermal|night vision|nvg|monocular|binocular/.test(n)) return 'thermal';
      if (/\b(light|lumen|flashlight|tlr|surefire|streamlight|lasers?|peq|ngal|atpial|dbal)\b/.test(n)) return 'light';
      if (/red ?dot|reflex|holographic|rmr|\brds\b|micro dot|enclosed emitter|eotech|aimpoint|holosun/.test(n) && !/scope|lpvo|\d+-\d+x/.test(n)) return 'reddot';
      return 'scope';
    default:
      if (/magazine|\bmags?\b|pmag/.test(n)) return 'mag';
      if (/\bcases?\b|\bbags?\b|backpack/.test(n)) return 'case';
      if (/\bsafe\b|vault|lock ?box/.test(n)) return 'safe';
      if (/clean|solvent|lube|oil|bore|brush|kit/.test(n)) return 'kit';
      if (/\b(light|lumen|flashlight|tlr|surefire|streamlight|olight)\b/.test(n)) return 'light';
      return 'case';
  }
}

/* ---------- specs ---------- */
const CALIBERS = [
  /\b9\s?mm(?:\s?(?:luger|parabellum|\+p))?\b|\b9x19\b/, /\.380(?:\s?acp|\s?auto)?\b/, /\.40\s?(?:s&w|sw|cal)\b/, /\b10\s?mm(?:\s?auto)?\b/, /\.45\s?(?:acp|auto|colt|long colt|lc)\b/,
  /\.357\s?(?:mag(?:num)?|sig)\b/, /\.38\s?(?:special|spl|spcl)\b/, /\.44\s?(?:mag(?:num)?|special|spl)\b/, /\.22\s?(?:lr|long rifle|wmr|mag(?:num)?)\b|\b22\s?lr\b/, /\.17\s?(?:hmr|wsm)\b/,
  /\b5\.56(?:\s?x\s?45)?(?:\s?(?:mm|nato))*\b/, /\.223(?:\s?(?:rem(?:ington)?|wylde))?\b/, /\b(?:\.)?300\s?(?:blk|blackout|aac|win mag|wsm|prc)\b/, /\b6\.5\s?(?:creedmoor|cm|prc|grendel)\b/,
  /\.308(?:\s?win(?:chester)?)?\b/, /\b7\.62\s?x\s?(?:39|51|54r?)\b/, /\.30-06(?:\s?springfield)?\b|\b30-06\b/, /\.270(?:\s?win)?\b/, /\.243(?:\s?win)?\b/, /\b6mm\s?(?:arc|creedmoor)\b/,
  /\.350\s?legend\b/, /\.450\s?bushmaster\b/, /\.45-70\b/, /\.30-30\b/, /\b5\.7\s?x\s?28\b/, /\.25\s?acp\b/, /\.32\s?acp\b/,
  /\b(?:12|16|20|28)\s?(?:ga|gauge)\b/, /\.410(?:\s?bore)?\b/,
];
const titleCal = (s) => s.replace(/\b(acp|lr|wmr|hmr|nato|s&w|blk|cm|prc|ga)\b/gi, (m) => m.toUpperCase()).replace(/\bluger\b/i, 'Luger').replace(/\bmag(num)?\b/i, 'Magnum').replace(/\b(win|rem|special|creedmoor|blackout|legend|bushmaster|springfield|auto)\b/gi, (m) => m[0].toUpperCase() + m.slice(1).toLowerCase());
const attr = (p, re) => { for (const [k, v] of Object.entries(p.attributes || {})) if (re.test(k)) return String(v).trim(); return null; };
export function specsFor(dept, p) {
  const firearm = FIREARM_DEPTS.has(dept);
  const text = `${p.name} ${p.shortDescription || ''}`;
  const s = {};
  const cal = attr(p, /caliber|calibre|gauge|cartridge|chamber(ing)?/i) || (() => { for (const re of CALIBERS) { const m = text.match(new RegExp(re.source, 'i')); if (m) return titleCal(m[0].trim()); } return null; })();
  if (cal && (firearm || dept === 'ammo' || dept === 'gear')) s.caliber = cal;
  if (firearm) {
    const cap = attr(p, /capacity|^rounds?$/i) || (text.match(/\b(\d{1,3})[\s-]?(?:\+\s?1\s?)?(?:rd|rds|round|shot)s?\b/i) || [])[1];
    if (cap) s.capacity = /^\d+$/.test(cap) ? `${cap} rounds` : cap;
    const bar = attr(p, /^barrel( length)?$|barrel length/i) || (barrelIn(text) && `${barrelIn(text)} in`);
    if (bar) s.barrel = bar;
    const act = attr(p, /^(action|action type|operation)$/i);
    if (act) s.action = act;
  }
  if (dept === 'ammo') {
    const b = (attr(p, /grain|bullet weight/i) && [attr(p, /grain|bullet weight/i), attr(p, /bullet type/i)].filter(Boolean).join(' ')) || attr(p, /^(bullet( weight| type)?|grain|load|projectile)$/i) || (text.match(/\b(\d{2,3})\s?(?:gr|grain)\b\.?\s*([A-Za-z][\w-]{1,14}(?:\s[A-Z]{2,4})?)?/i) || [])[0];
    if (b) s.bullet = b.replace(/\bgrain\b/i, 'gr');
    const c = attr(p, /^(rounds?|count|quantity|rounds per box|box (count|quantity))$/i) || (text.match(/\b(\d{1,4})\s?(?:rd|rds|rounds?|ct|count)\b/i) || [])[1];
    if (c) s.count = /^\d+$/.test(c) ? `${c} rounds` : c;
  }
  if (dept === 'optics') {
    const mag = attr(p, /^magnification$/i) || (text.match(/\b(\d+(?:\.\d+)?-\d+(?:\.\d+)?x(?:\d+)?|\d+x\d{2})\b/i) || [])[1];
    if (mag) s.magnification = mag;
    const ret = attr(p, /^reticle$/i) || (text.match(/\b(\d+(?:\.\d+)?\s?moa(?:\s(?:dot|circle))?)\b/i) || [])[1];
    if (ret) s.reticle = ret.replace(/moa/i, 'MOA');
  }
  // anything else the store labelled, up to a sane number of rows
  const keep = /^(finish|frame|sights?|safety|weight|overall length|twist( rate)?|magazines? included|model|condition|color|colour|material|fits|compatibility|mount|battery|output|lumens)$/i;
  for (const [k, v] of Object.entries(p.attributes || {})) {
    if (Object.keys(s).length >= 9) break;
    if (keep.test(k) && v) s[k.toLowerCase().replace(/\s+/g, '_')] = String(v);
  }
  return s;
}

/* ---------- build ---------- */
const BRANDS = ['Licentia Arms Co.', 'Team Wendy', 'Ops-Core', 'L3Harris', 'B.E. Meyers', 'Crye Precision', 'Gentex', 'Wilcox', 'Smith & Wesson', 'Springfield Armory', 'Sig Sauer', 'SIG Sauer', 'Daniel Defense', 'Heckler & Koch', 'Palmetto State Armory', 'Sellier & Bellot', 'Primary Arms', 'Shadow Systems', 'Aero Precision', 'Kel-Tec', 'Glock', 'Ruger', 'CZ', 'Taurus', 'Beretta', 'Mossberg', 'Remington', 'Winchester', 'Benelli', 'Henry', 'Savage', 'Tikka', 'Browning', 'Colt', 'Kimber', 'Walther', 'HK', 'FN', 'BCM', 'Canik', 'Staccato', 'Stoeger', 'Marlin', 'Bergara', 'Howa', 'Federal', 'Hornady', 'CCI', 'PMC', 'Fiocchi', 'Magtech', 'Aguila', 'Speer', 'Barnes', 'Nosler', 'Blazer', 'Holosun', 'Vortex', 'Trijicon', 'EOTech', 'Aimpoint', 'Leupold', 'Burris', 'Bushnell', 'Swampfox', 'Streamlight', 'SureFire', 'Olight', 'Magpul', 'Pelican', 'Liberty', 'Hoppe’s', "Hoppe's", 'Otis', 'Pulsar', 'AGM', 'ATN', 'Steiner', 'Nightforce', 'Zeiss', 'Swarovski'];
// one name per maker in the Manufacturer filter ("Winchester Ammunition" and "Winchester" are the same shelf)
const BRAND_ALIAS = [
  [/^winchester(?: ammunition| ammo)?$/i, 'Winchester'], [/^fiocchi(?: ammunition| usa)?$/i, 'Fiocchi'],
  [/^aguila(?: ammunition)?$/i, 'Aguila'], [/^l3 ?harris(?: technologies)?$/i, 'L3Harris'],
  [/^talley(?: manufacturing)?$/i, 'Talley'], [/^federal(?: premium)?(?: ammunition)?$/i, 'Federal'],
  [/^remington(?: ammunition| arms)?$/i, 'Remington'], [/^hornady(?: manufacturing)?$/i, 'Hornady'],
  [/^cor-?bon$/i, 'CorBon'], [/^truglo$/i, 'TRUGLO'], [/^eotech$/i, 'EOTech'],
];
export const normBrand = (b) => {
  if (!b) return b;
  const t = String(b).replace(/\s+/g, ' ').trim();
  for (const [re, name] of BRAND_ALIAS) if (re.test(t)) return name;
  return t;
};
const brandOf = (p) => normBrand(brandOf0(p));
const brandOf0 = (p) => {
  if (p.brand) return p.brand;
  const a = attr(p, /^(brand|manufacturer|make|mfg)$/i); if (a) return a;
  const n = p.name || '';
  // (?!\w) rather than \b: a brand can end in punctuation ("Licentia Arms Co.")
  for (const b of BRANDS) if (new RegExp(`^${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\w)`, 'i').test(n)) return b;
  if (/^LAC-/i.test(n)) return 'Licentia Arms Co.';
  return null;
};
const clip = (s, n) => { s = String(s || '').trim(); if (s.length <= n) return s; const cut = s.slice(0, n); const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n')); return (end > n * 0.6 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…').trim(); };

// price per round, unless the listing contradicts itself ("1000 Round Box" at $9.99)
const cprOf = (price, rounds) => { if (!price || !rounds) return undefined; const c = price / rounds; return c >= 0.04 && c <= 25 ? Math.round(c * 1000) / 1000 : undefined; };
/** a Gearfire listing's rows are the distributor's spec sheet: shown as given in the detail view */
export function sheetOf(p) {
  if (p.source !== 'gearfire') return null;
  const s = {};
  for (const [k, v] of Object.entries(p.attributes || {})) if (v && !/^gfid$/i.test(k) && Object.keys(s).length < 18) s[k] = String(v);
  if (p.noShipTo) s['Does not ship to'] = [].concat(p.noShipTo).join(', ');
  return s;
}
/** a Gearfire line name ("LEVERevolution", "Custom") plus what sets this variant apart */
export function displayName(p, dept, f) {
  const base = String(p.name || '').trim();
  if (p.source !== 'gearfire') return base;
  const low = base.toLowerCase(); const bits = [];
  const add = (v) => { v = v && String(v).trim(); if (v && !low.includes(v.toLowerCase()) && !bits.includes(v)) bits.push(v); };
  if (dept === 'ammo') {
    add(f.caliber); add(f.grain); add([].concat(f.bullet || [])[0]); add(f.shot); add(f.shell);
    return bits.length ? `${base} ${bits.join(' ')}` : base;
  }
  // a yes/no spec says its name when yes ("Laser Rangefinder") and nothing when no
  for (const [k, v] of Object.entries(p.variant || {})) {
    if (/^no$/i.test(v)) continue;
    add(/^yes$/i.test(v) ? k : /capacity|rounds/i.test(k) && /^\d+$/.test(v) ? `${v} rounds` : v);
  }
  return bits.length ? `${base} — ${bits.join(', ')}` : base;
}

export function buildItems(scraped, overrides = {}, { remoteImages = false } = {}) {
  const items = [];
  // a photo pulled by hand ({ "<any variant id>": { "noPhoto": true } }) goes from every product that shares it
  const rejected = new Set();
  for (const p of scraped) if (p && overrides[p.id] && overrides[p.id].noPhoto) for (const f of p.localImages || []) rejected.add(f);
  for (const p of scraped) {
    if (!p || !p.name) continue;
    const o = overrides[p.id] || {};
    if (o.hide) continue;
    let dept = o.dept || classify(p);
    // the store's own flag when it has one (Gearfire: isFirearm / isNfa — black powder is neither)
    const firearm = o.firearm ?? (typeof p.firearm === 'boolean' ? p.firearm || !!p.nfa : FIREARM_DEPTS.has(dept) || RE.receiver.test(T(p.name)));
    // a National Firearms Act item: the NFA department (suppressors, short-barreled rifles), the
    // store's own flag, or a firearm whose name says so (a short-barreled rifle filed with the rifles)
    const nfa = o.nfa ?? (dept === 'nfa' || !!p.nfa || (firearm && RE.nfa.test(T(p.name))));
    // a photo found on the web (find-images) never stands for the store's own products — merch, gift cards,
    // its own listings: the web only has other people's shirts and cards to offer
    const own = OWN_BRAND.test(String(p.brand || '')) || /agarthan merch/i.test((p.categories || []).join(' '));
    let images = (p.localImages && p.localImages.length) ? p.localImages : remoteImages ? (p.images || []) : [];
    if ((own && p.photoSource) || o.noPhoto) images = [];
    images = images.filter((f) => !rejected.has(f));
    const status = p.availability || (p.price != null ? 'in' : 'ask');
    let sub = o.sub || subOf(dept, p);
    const f = { ...facetsOf(dept, sub, p), ...(o.f || {}) };
    let type = o.type || null;
    // a pistol in a rifle round (5.56, .300 BLK, 7.62, .308, .45-70…) is not shopped with the handguns:
    // it goes to its own category with the rifles; its action stays a filter
    if (dept === 'sidearms' && !o.dept && !o.sub && isRifleCartridge(f.caliber)) {
      const was = sub;
      dept = 'longarms'; sub = ARP;
      if (!f.action) f.action = /semi|large format/i.test(was) ? 'Semi-Auto' : /^revolvers?$/i.test(was) ? 'Revolver' : was;
      type = type || (/revolver/i.test(was) ? 'revolver' : /bolt|single shot|break/i.test(was) ? 'bolt' : /lever/i.test(was) ? 'lever' : 'ar');
    }
    // barrel length filters by range (16–18"); the exact length stays on the card and in the spec sheet
    const exactBarrel = f.barrel;
    if (f.barrel && RANGES[dept]) f.barrel = barrelRange(dept, sub, parseFloat(f.barrel)) || f.barrel;
    // a night vision or thermal rifle scope also belongs with the riflescopes
    const also = f.form === 'Rifle scope' && (sub === 'Night Vision' || sub === 'Thermal') ? ['Riflescopes'] : undefined;
    const price = o.price !== undefined ? o.price : p.price ?? null;
    const rounds = dept === 'ammo' && f.count ? parseInt(f.count, 10) : 0;
    items.push({
      id: p.id,
      dept,
      sub,
      f,
      type: type || iconFor(dept, p),
      name: o.name || displayName(p, dept, f),
      brand: o.brand || brandOf(p),
      price,
      cpr: cprOf(price, rounds),   // ammo: price per round
      was: p.regularPrice ?? null,
      priceNote: o.priceNote || p.priceNote || null,
      status,
      firearm,
      nfa: nfa || undefined,   // labelled NFA, in red, on the item's cover
      // cards read a few canonical rows; a store spec sheet (Gearfire) rides along for the detail view
      specs: p.source === 'gearfire'
        ? Object.fromEntries(Object.entries({ caliber: f.caliber, capacity: f.capacity, barrel: exactBarrel, count: f.count, magnification: f.mag, reticle: f.reticle, ...(o.specs || {}) }).filter(([, v]) => v))
        : { ...specsFor(dept, p), ...(o.specs || {}) },
      sheet: sheetOf(p) || undefined,
      desc: clip(o.desc || p.description || p.shortDescription || '', 6000),
      lore: o.lore || null,
      images: images.slice(0, 6),
      url: p.permalink || null,
      sku: p.sku || null,
      shelf: p.storeStock || undefined,   // on the store's own shelf (not a distributor's)
      ln: p.line ? String(p.line).slice(0, 8) : undefined,
      also,   // other categories it shows under   // its product line (variants share one), for the default order
      featured: Boolean(o.featured),
      rank: p.rank ?? items.length,
    });
  }
  return items;
}

/** Every scraped store: assets/data/scraped/catalog.json (the main site) plus
 *  one level of sub-folders (scrape.mjs --out assets/data/scraped/shop for a
 *  second storefront). The main site comes first, so on a shared id it wins. */
export async function loadScraped(dir) {
  const { readdir } = await import('node:fs/promises');
  const files = [path.join(dir, 'catalog.json')];
  try {
    for (const e of await readdir(dir, { withFileTypes: true })) if (e.isDirectory()) files.push(path.join(dir, e.name, 'catalog.json'));
  } catch { /* no folder */ }
  const seen = new Set(); const out = []; const sources = []; const reports = [];
  for (const f of files) {
    let list; try { if (!catalogExists(f)) continue; list = await readCatalog(f); } catch { continue; }
    if (!Array.isArray(list)) continue;
    sources.push(path.relative(process.cwd(), f));
    try { reports.push(JSON.parse(await readFile(path.join(path.dirname(f), 'report.json'), 'utf8'))); } catch { /* optional */ }
    const base = out.length;
    list.forEach((p, i) => { if (p && p.id && !seen.has(p.id)) { seen.add(p.id); out.push({ ...p, rank: base + (p.rank ?? i) }); } });
  }
  return { products: out, sources, reports };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const IN = arg('in', null) ? path.resolve(arg('in')) : null;
  const OV = path.resolve(arg('overrides', 'assets/data/overrides.json'));
  const OUTF = path.resolve(arg('out', 'assets/data/catalog.js'));
  // every page loads catalog.js, so it carries a short summary and the lead
  // photo; the full copy and gallery live in assets/data/items/<id>.json and
  // load when a product is opened
  const DETAILS = path.resolve(arg('details-dir', path.join(path.dirname(OUTF), 'items')));
  const SUMMARY = 280;
  // --in names one scraped catalog; by default every store under assets/data/scraped/ is merged
  let scraped, reports = [];
  if (IN) {
    try { scraped = IN.endsWith('.gz') ? await readCatalog(IN.slice(0, -3)) : JSON.parse(await readFile(IN, 'utf8')); }
    catch (e) { console.error(`✗ can't read ${IN} — run scripts/scrape.mjs first (${e.message})`); process.exit(1); }
    try { reports = [JSON.parse(await readFile(path.join(path.dirname(IN), 'report.json'), 'utf8'))]; } catch { /* optional */ }
  } else {
    const got = await loadScraped(path.resolve('assets/data/scraped'));
    scraped = got.products; reports = got.reports;
    if (got.sources.length) console.log('  sources: ' + got.sources.join(', '));
  }
  if (!Array.isArray(scraped) || !scraped.length) { console.error('✗ scraped catalog is empty — nothing written (run scripts/scrape.mjs first)'); process.exit(1); }
  let overrides = {};
  try { overrides = JSON.parse(await readFile(OV, 'utf8')); delete overrides._readme; } catch { /* optional */ }
  const report = {
    site: reports.map((r) => r.site).filter(Boolean).join(' + ') || null,
    finishedAt: reports.map((r) => r.finishedAt).filter(Boolean).sort().pop() || null,
  };
  const items = buildItems(scraped, overrides, { remoteImages: argv.includes('--remote-images') });
  const byDept = items.reduce((a, i) => ((a[i.dept] = (a[i.dept] || 0) + 1), a), {});
  // fresh details folder each build, so removed products leave no stale files
  if (path.basename(DETAILS) === 'items' && DETAILS.startsWith(process.cwd() + path.sep)) await rm(DETAILS, { recursive: true, force: true });
  await mkdir(DETAILS, { recursive: true });
  let detailFiles = 0;
  // the grid needs little per product; the full copy, photos, spec sheet and store link load when one is opened
  const CARD_SPECS = ['caliber', 'capacity', 'barrel', 'count', 'magnification', 'reticle'];
  for (const it of items) {
    const extraSpecs = Object.keys(it.specs).some((k) => !CARD_SPECS.includes(k));
    if (it.desc.length > SUMMARY || it.images.length > 1 || extraSpecs || it.url || it.sheet) {
      // the store's sheet replaces the derived rows in the detail view (sheet: true says so)
      await writeFile(path.join(DETAILS, `${it.id}.json`), JSON.stringify({ desc: it.desc, images: it.images, specs: it.sheet || it.specs, sheet: !!it.sheet || undefined, url: it.url || undefined }));
      detailFiles++;
      it.desc = clip(it.desc, SUMMARY);
      it.images = it.images.slice(0, 1);
      it.specs = Object.fromEntries(Object.entries(it.specs).filter(([k]) => CARD_SPECS.includes(k)));
      delete it.url; delete it.sheet;
      it.more = true;
    }
  }
  const head = { demo: false, source: report.site || 'store', updated: (report.finishedAt || new Date().toISOString()).slice(0, 10) };
  // one item per line: small, and diffs read cleanly
  const body = JSON.stringify(head).slice(0, -1) + ',"items":[\n' + items.map((i) => JSON.stringify(i)).join(',\n') + '\n]}';
  await writeFile(OUTF, `/* generated by scripts/build-catalog.mjs from the store scrape — edit assets/data/overrides.json, not this file */\nwindow.AA_CATALOG = ${body};\n`);
  console.log(`  ${detailFiles} detail files → ${path.relative(process.cwd(), DETAILS)}/ · catalog.js ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB`);
  console.log(`✓ ${items.length} items → ${path.relative(process.cwd(), OUTF)}`);
  // the pages link the catalog by content hash, so a new catalog reaches every visitor on their next page load
  if (OUTF === path.resolve('assets/data/catalog.js')) {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, [path.resolve('tools/stamp-partials.mjs')], { encoding: 'utf8' });
    console.log(r.status === 0 ? '  pages re-stamped with the new catalog version' : `  ! could not re-stamp the pages: ${r.stderr || r.stdout}`);
  }
  console.log('  by department: ' + Object.entries(byDept).map(([k, v]) => `${k} ${v}`).join(' · '));
  const unpriced = items.filter((i) => i.price == null).length;
  if (unpriced) console.log(`  ${unpriced} without a price (shown as "${'Call for price'}")`);
}
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main();
