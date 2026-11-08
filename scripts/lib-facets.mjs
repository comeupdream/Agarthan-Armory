/* =============================================================================
 * lib-facets.mjs — subcategory + filter values ("facets") for each product.
 *
 * The Armory's filters are built from these: every facet value a product has
 * becomes a checkbox with a live count (the Myrl's Country pattern: options
 * come from what is actually in the catalog, never a hand-typed list).
 *
 * Where a value comes from matters. Gearfire names products by LINE
 * ("LEVERevolution", "Personal Defense HST") and its copy describes the line,
 * so:
 *   variant facts (caliber, grain, round count, magnification, barrel…) are
 *     read only from the name, the spec rows and the categories — never the
 *     marketing copy, which lists every caliber the line comes in;
 *   line facts (use, bullet type, illumination, focal plane, footprint…) may
 *     also come from the copy, because they hold for the whole line.
 * ===========================================================================*/

const T = (s) => String(s || '').toLowerCase();

/* ---------- calibers: one canonical name per cartridge ---------- */
export const CALIBERS = [
  [/\b(12|16|20|28|10)\s?(?:ga|gauge)\b/, (m) => `${m[1]} Gauge`],
  [/\.410\b|\b410\s?(?:bore|ga|gauge)\b/, '.410 Bore'],
  [/\b5\.7\s?x\s?28\b/, '5.7x28mm'],
  [/\b9\s?mm(?:\s?(?:luger|para(?:bellum)?|\+p))?\b|\b9\s?x\s?19\b/, '9mm Luger'],
  [/\.380\b|\b380\s?acp\b/, '.380 ACP'],
  [/\.40\s?(?:s&w|sw|cal)\b|\b40\s?s&w\b/, '.40 S&W'],
  [/\b10\s?mm(?:\s?auto)?\b/, '10mm Auto'],
  [/\.45\s?(?:acp|auto)\b|\b45\s?acp\b/, '.45 ACP'],
  [/\.45\s?(?:colt|lc|long colt)\b/, '.45 Colt'],
  [/\.357\s?sig\b/, '.357 SIG'],
  [/\.357\s?(?:mag(?:num)?)?\b|\b357\s?mag/, '.357 Magnum'],
  [/\.38\s?super\b/, '.38 Super'],
  [/\.38\s?(?:special|spl|spcl|spec)\b|\b38\s?spl\b/, '.38 Special'],
  [/\.44\s?(?:special|spl)\b/, '.44 Special'],
  [/\.44\s?(?:rem\s?)?mag(?:num)?\b|\b44\s?mag\b/, '.44 Magnum'],
  [/\.32\s?acp\b/, '.32 ACP'], [/\.25\s?acp\b/, '.25 ACP'], [/\.327\s?fed/, '.327 Federal Magnum'],
  [/\.460\s?s&w/, '.460 S&W Magnum'], [/\.500\s?s&w/, '.500 S&W Magnum'],
  [/\.22\s?(?:wmr|mag(?:num)?)\b|\b22\s?wmr\b/, '.22 WMR'],
  [/\.22\s?(?:lr|long rifle)\b|\b22\s?lr\b/, '.22 LR'],
  [/\.17\s?hmr\b/, '.17 HMR'], [/\.17\s?wsm\b/, '.17 WSM'],
  [/\.22-250\b|\b22-250\b/, '.22-250 Rem'], [/\.204\s?ruger/, '.204 Ruger'], [/\.224\s?valk/, '.224 Valkyrie'],
  [/\b5\.56(?:\s?x\s?45)?(?:\s?(?:mm|nato))*\b/, '5.56 NATO'],
  [/\.223\s?wylde/, '.223 Wylde'], [/\.223\b|\b223\s?rem/, '.223 Rem'],
  [/\b6mm\s?arc\b/, '6mm ARC'], [/\b6mm\s?creedmoor\b/, '6mm Creedmoor'], [/\.243\b|\b243\s?win/, '.243 Win'],
  [/\b6\.5\s?(?:creedmoor|cm|creed)\b/, '6.5 Creedmoor'], [/\b6\.5\s?prc\b/, '6.5 PRC'], [/\b6\.5\s?grendel\b/, '6.5 Grendel'],
  [/\.25-06\b/, '.25-06 Rem'], [/\.270\s?wsm\b/, '.270 WSM'], [/\.270\b|\b270\s?win/, '.270 Win'],
  [/\b7mm-08\b/, '7mm-08 Rem'], [/\b7mm\s?prc\b/, '7mm PRC'], [/\b7mm\s?(?:rem(?:ington)?\s?)?mag(?:num)?\b/, '7mm Rem Mag'],
  [/\b7\.62\s?x\s?39\b/, '7.62x39'], [/\b7\.62\s?x\s?54r?\b/, '7.62x54R'], [/\b7\.62\s?x\s?51\b/, '7.62x51 NATO'],
  [/\b(?:\.)?300\s?(?:blk|blackout|aac)\b/, '.300 Blackout'], [/\.300\s?(?:win\s?mag|winchester magnum)\b/, '.300 Win Mag'],
  [/\.300\s?wsm\b/, '.300 WSM'], [/\.300\s?prc\b/, '.300 PRC'], [/\.300\s?wby\b|\.300 weatherby/, '.300 Wby Mag'],
  [/\.308\b|\b308\s?win/, '.308 Win'], [/\.30-06\b|\b30-06\b/, '.30-06 Springfield'], [/\.30-30\b|\b30-30\b/, '.30-30 Win'],
  [/\.338\s?lapua\b/, '.338 Lapua Mag'], [/\.350\s?legend\b/, '.350 Legend'], [/\.360\s?buckhammer/, '.360 Buckhammer'],
  [/\.450\s?bushmaster\b/, '.450 Bushmaster'], [/\.45-70\b/, '.45-70 Govt'], [/\.458\s?socom\b/, '.458 SOCOM'],
  [/\.50\s?bmg\b/, '.50 BMG'],
];
export function caliberOf(text) {
  const t = T(text);
  for (const [re, name] of CALIBERS) { const m = t.match(re); if (m) return typeof name === 'function' ? name(m) : name; }
  return null;
}

const BULLETS = [
  [/eld[- ]?x\b/, 'ELD-X'], [/eld match|\beld-m\b/, 'ELD Match'], [/eld[- ]?vt/, 'ELD-VT'], [/\bftx\b/, 'FTX'], [/monoflex/, 'MonoFlex'],
  [/v-?max\b/, 'V-MAX'], [/\bsst\b/, 'SST'], [/\bxtp\b/, 'XTP'], [/\bttsx\b/, 'TTSX'], [/\btsx\b/, 'TSX'], [/\blrx\b/, 'LRX'],
  [/accubond/, 'AccuBond'], [/partition/, 'Partition'], [/ballistic tip/, 'Ballistic Tip'], [/hydra[- ]?shok/, 'Hydra-Shok'],
  [/\bhst\b/, 'HST'], [/gold dot/, 'Gold Dot'], [/golden saber/, 'Golden Saber'], [/core[- ]?lokt/, 'Core-Lokt'], [/power[- ]?point/, 'Power-Point'],
  [/gamechanger|game changer/, 'Sierra GameChanger'], [/matchking|\bsmk\b/, 'MatchKing'], [/\btss\b|tungsten super shot/, 'TSS'],
  [/\bbthp\b|boat[- ]tail hollow/, 'BTHP'], [/\botm\b|open tip match/, 'OTM'], [/\bjhp\b|jacketed hollow/, 'JHP'],
  [/\bfmj\b|full metal jacket/, 'FMJ'], [/\btmj\b|total metal jacket/, 'TMJ'], [/\bpsp\b|pointed soft point/, 'PSP'],
  [/\bsp\b|soft point/, 'Soft Point'], [/hollow point|\bhp\b/, 'Hollow Point'], [/\blrn\b|lead round nose/, 'Lead Round Nose'],
  [/\bcprn\b|copper[- ]plated round nose/, 'CPRN'], [/buckshot|\bbuck\b/, 'Buckshot'], [/birdshot|bird shot/, 'Birdshot'],
  [/rifled slug|foster slug|sabot slug|\bslugs?\b/, 'Slug'], [/bismuth/, 'Bismuth'], [/\bsteel shot\b|\bsteel\b(?= (?:shot|waterfowl))/, 'Steel Shot'],
  [/polymer tip|polymer-tipped|tipped/, 'Polymer Tip'], [/frangible/, 'Frangible'], [/solid copper|monolithic/, 'Solid Copper'],
];
const USES = [
  [/self[- ]defen[cs]e|personal (?:defen[cs]e|protection)|home defen[cs]e|\bduty\b|law enforcement|concealed carry|critical defen[cs]e|critical duty/, 'Defense'],
  [/\bhunt|deer|elk|whitetail|big game|varmint|predator|turkey|waterfowl|pheasant|upland|\bdove\b|\bduck|goose|hog\b|game\b/, 'Hunting'],
  [/\bmatch\b|precision|long[- ]range|benchrest|competition/, 'Match & Precision'],
  [/target|range|practice|training|plink|clay|\btrap\b|skeet|sporting clays/, 'Target & Training'],
];

/* ---------- subcategory ---------- */
const OPTIC_SUBS = [
  [/scope mounts?|scope rings?|\brings?\b/, 'Scope Mounts & Rings'], [/red dot mounts?|optic mounts?|riser/, 'Red Dot Mounts'],
  [/\bbases?\b/, 'Bases'], [/red dots?|holographic|reflex|prism/, 'Red Dots & Holographic'], [/thermal/, 'Thermal'],
  [/night vision|\bnvg?\b|pvs-?\d|bnvd|gpnvg|cnvd|rnvg/, 'Night Vision'], [/laser|ngal|atpial|peq/, 'Lasers'],
  [/magnifier/, 'Magnifiers'], [/spotting scope/, 'Spotting Scopes'], [/rangefinder/, 'Rangefinders'], [/binocular/, 'Binoculars'],
  [/\bsights?\b|night sights|iron sights/, 'Iron & Night Sights'], [/riflescope|\bscopes?\b|lpvo|acog/, 'Riflescopes'],
  [/accessor|cover|cap|kill ?flash|sunshade|battery|mount kit/, 'Optic Accessories'],
];
export function subOf(dept, p) {
  const cats = (p.categories || []).map(T);
  const leaf = cats[cats.length - 1] || '';
  const all = cats.join(' / ') + ' ' + T(p.name);
  if (dept === 'ammo') {
    if (/rimfire/.test(all) || /^\.(22|17) /.test(caliberOf(p.name) || '')) return 'Rimfire';
    if (/shotgun|shotshell|buckshot|birdshot|\bslug/.test(all)) return 'Shotgun';
    if (/handgun|pistol|revolver/.test(all)) return 'Handgun';
    if (/rifle/.test(all)) return 'Rifle';
    return 'Ammunition';
  }
  if (dept === 'optics') {
    for (const [re, name] of OPTIC_SUBS) if (re.test(leaf)) return name;
    for (const [re, name] of OPTIC_SUBS) if (re.test(all)) return name;
    return 'Optics';
  }
  if (dept === 'gear') {
    if (/helmet cover|counterweight|shroud|nvg mount|helmet mount/.test(all)) return 'Helmet & NVG Accessories';
    if (/helmet/.test(all)) return 'Helmets';
    if (/magazine|\bmags?\b|pmag/.test(all)) return 'Magazines';
    if (/case|bag|backpack/.test(all)) return 'Cases & Bags';
    if (/safe|vault/.test(all)) return 'Safes';
    if (/clean/.test(all)) return 'Cleaning';
    return 'Gear';
  }
  if (dept === 'sidearms') return /revolver/.test(all) ? 'Revolvers' : 'Pistols';
  if (dept === 'shotguns') return /semi|auto/.test(all) ? 'Semi-Auto Shotguns' : 'Pump & Break-Action';
  if (dept === 'longarms') return /lever/.test(all) ? 'Lever Action' : /bolt/.test(all) ? 'Bolt Action' : /rimfire|\.22/.test(all) ? 'Rimfire Rifles' : 'Semi-Auto Rifles';
  return null;
}

/* ---------- facets ---------- */
const attr = (p, re) => { for (const [k, v] of Object.entries(p.attributes || {})) if (re.test(k)) return String(v).trim(); return null; };
const uniq = (a) => [...new Set(a.filter(Boolean))];

export function facetsOf(dept, sub, p) {
  const variant = `${p.name || ''} ${Object.entries(p.attributes || {}).filter(([k]) => !/^(upc|gtin|ean|sku|mpn)$/i.test(k)).map(([k, v]) => `${k} ${v}`).join(' ')}`;
  const line = `${variant} ${p.description || p.shortDescription || ''}`;
  const tv = T(variant), tl = T(line);
  const f = {};
  if (dept === 'ammo' || ['sidearms', 'longarms', 'shotguns'].includes(dept)) {
    const cal = caliberOf(attr(p, /^(caliber|calibre|gauge|cartridge|chamber)/i) || variant);
    if (cal) f.caliber = cal;
  }
  if (dept === 'ammo') {
    const gr = attr(p, /^(grain|bullet weight)/i) || (tv.match(/\b(\d{2,3})\s?(?:gr|grain)s?\b/) || [])[1];
    if (gr) f.grain = `${String(gr).replace(/\D+$/, '').replace(/\s*gr.*$/i, '')} gr`;
    // a box count, not a turkey load's "3 in" shell or a "3-round" feature: boxes hold 5 or more
    const ct = attr(p, /^(rounds?|count|quantity|rounds per box)/i) || [...tv.matchAll(/\b(\d{1,4})\s?(?:rd|rds|rounds?|ct|count)\b/g)].map((m) => m[1]).find((n) => +n >= 5) || (tv.match(/box of (\d{1,4})/) || [])[1];
    if (ct) f.count = `${parseInt(ct, 10)} rds`;
    const bullets = uniq(BULLETS.filter(([re]) => re.test(tl)).map(([, n]) => n)).slice(0, 2);
    if (bullets.length) f.bullet = bullets;
    const uses = uniq(USES.filter(([re]) => re.test(tl)).map(([, n]) => n));
    if (uses.length) f.use = uses;
    if (sub === 'Shotgun') {
      const shot = tv.match(/\b(000|00|0|bbb|bb|t|f)\s?buck(?:shot)?\b/) || tv.match(/(?:#|no\.?\s?)(\d{1,2}(?:\.5)?)\b/);
      if (shot) f.shot = /buck/.test(shot[0]) ? `${shot[1].toUpperCase()} Buck` : `#${shot[1]}`;
      const sl = tv.match(/\b(2-3\/4|2 3\/4|2\.75|3-1\/2|3 1\/2|3\.5|3)\s?(?:"|”|in\b|inch)/);
      if (sl) f.shell = ({ '2 3/4': '2-3/4"', '2.75': '2-3/4"', '3 1/2': '3-1/2"', '3.5': '3-1/2"' }[sl[1]] || `${sl[1]}"`);
    }
  }
  if (['sidearms', 'longarms', 'shotguns'].includes(dept)) {
    const bar = attr(p, /^barrel/i) || (tv.match(/\b(\d{1,2}(?:\.\d{1,2})?)\s?(?:"|”|''|in\b|inch(?:es)?\b|-inch)/) || [])[1];
    if (bar && +String(bar).replace(/[^\d.]/g, '') >= 2) f.barrel = `${String(bar).replace(/[^\d.]/g, '')}"`;
    const act = attr(p, /^action/i) || (/bolt[- ]action/.test(tl) ? 'Bolt action' : /lever[- ]action/.test(tl) ? 'Lever action' : /pump[- ]action/.test(tl) ? 'Pump action' : /semi[- ]auto/.test(tl) ? 'Semi-auto' : /revolver|double[- ]action/.test(tl) ? 'Revolver' : null);
    if (act) f.action = act;
    const cap = attr(p, /^(capacity|magazine capacity)/i) || (tv.match(/\b(\d{1,3})[\s-]?(?:\+\s?1\s?)?(?:rd|rds|round|shot)s?\b/) || [])[1];
    if (cap) f.capacity = `${parseInt(cap, 10)} rounds`;
  }
  if (dept === 'optics') {
    const mag = tv.match(/\b(\d{1,2}(?:\.\d)?)\s?-\s?(\d{1,2}(?:\.\d)?)\s?x\s?(\d{2})?\b/) || tv.match(/\b(\d{1,2}(?:\.\d)?)\s?x\s?(\d{2})\b/);
    if (mag) {
      if (mag[3] !== undefined || /-/.test(mag[0])) { f.mag = `${mag[1]}-${mag[2]}x`; if (mag[3]) f.objective = `${mag[3]} mm`; }
      else { f.mag = `${mag[1]}x`; f.objective = `${mag[2]} mm`; }
    }
    const obj = tv.match(/\b(\d{2})\s?mm\s?objective/); if (obj) f.objective = `${obj[1]} mm`;
    const tube = attr(p, /^(tube|ring)/i) || (tl.match(/\b(30|34|35|36)\s?mm\s?(?:main\s?|one-piece\s?)?(?:tube|rings?)\b/) || [])[1] ||
      (/one[- ]inch|1["”]\s?(?:tube|rings?)|1-inch/.test(tl) ? '1"' : null);
    if (tube && ['Riflescopes', 'Scope Mounts & Rings', 'Optics'].includes(sub)) f.tube = /"$/.test(tube) ? tube : `${String(tube).replace(/\D/g, '')} mm`;
    if (/first focal plane|\bffp\b/.test(tl)) f.focal = 'First focal plane';
    else if (/second focal plane|\bsfp\b/.test(tl)) f.focal = 'Second focal plane';
    if (['Riflescopes', 'Red Dots & Holographic', 'Magnifiers', 'Optics'].includes(sub)) {
      if (/non[- ]?illuminated/.test(tl)) f.illum = 'Non-illuminated';
      else if (/illuminat/.test(tl)) f.illum = 'Illuminated';
    }
    const fp = uniq([
      /\brmr\b/.test(tl) && 'Trijicon RMR', /\bacro\b/.test(tl) && 'Aimpoint ACRO', /\bt-?1\b|\bt-?2\b|aimpoint micro|micro footprint/.test(tl) && 'Aimpoint Micro',
      /\brmsc?\b|shield/.test(tl) && 'Shield RMSc', /deltapoint|\bdpp\b|docter/.test(tl) && 'Docter / DeltaPoint', /\b(?:407|507|508)k\b|\bepsk?\b|holosun k/.test(tl) && 'Holosun K',
      /picatinny|1913|stanag/.test(tl) && 'Picatinny', /\bweaver\b/.test(tl) && 'Weaver', /\bmrds\b/.test(tl) && 'MRDS', /dovetail/.test(tl) && 'Dovetail',
    ]);
    if (fp.length && ['Red Dots & Holographic', 'Red Dot Mounts', 'Scope Mounts & Rings', 'Bases', 'Optic Accessories', 'Lasers'].includes(sub)) f.footprint = fp;
    // a thermal core is 4:3 or 5:4 and at most 1280 wide; a display resolution (1920×1080) is not a sensor
    const sensor = [...tl.matchAll(/\b(\d{3,4})\s?[x×]\s?(\d{3,4})\b/g)].map((m) => [+m[1], +m[2]]).find(([w, h]) => w <= 1280 && w / h >= 1.2 && w / h <= 1.4);
    if (sensor && ['Thermal', 'Night Vision'].includes(sub)) f.sensor = `${sensor[0]}×${sensor[1]}`;
    if (sub === 'Night Vision') {
      if (/white phosphor/.test(tl)) f.phosphor = 'White phosphor'; else if (/green phosphor/.test(tl)) f.phosphor = 'Green phosphor';
    }
    if (sub === 'Lasers') {
      const lc = uniq([/green/.test(tl) && 'Green', /\bred\b/.test(tl) && 'Red', /\bir\b|infrared/.test(tl) && 'IR']);
      if (lc.length) f.laser = lc;
    }
  }
  return f;
}

export const FACET_LABELS = {
  caliber: 'Caliber / gauge', use: 'Use', bullet: 'Bullet type', grain: 'Bullet weight', count: 'Rounds', shot: 'Shot size', shell: 'Shell length',
  barrel: 'Barrel length', action: 'Action', capacity: 'Capacity',
  mag: 'Magnification', objective: 'Objective', tube: 'Tube / ring size', focal: 'Focal plane', illum: 'Illumination', footprint: 'Mount / footprint',
  sensor: 'Sensor', phosphor: 'Phosphor', laser: 'Laser',
};
