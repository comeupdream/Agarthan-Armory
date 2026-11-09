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
  [/\.45\s?(?:colt|lc|long colt|\(long\) colt)\b/, '.45 Colt'],
  [/\.357\s?sig\b/, '.357 SIG'],
  [/\.357\s?(?:mag(?:num)?)?\b|\b357\s?mag/, '.357 Magnum'],
  [/\.38\s?super\b/, '.38 Super'],
  [/\.38\s?(?:special|spl|spcl|spec)\b|\b38\s?spl\b/, '.38 Special'],
  [/\.44\s?(?:special|spl)\b/, '.44 Special'],
  [/\.44\s?(?:rem\s?)?mag(?:num)?\b|\b44\s?mag\b/, '.44 Magnum'],
  [/\.32\s?(?:acp|auto)\b/, '.32 ACP'], [/\.25\s?acp\b/, '.25 ACP'], [/\.327\s?fed/, '.327 Federal Magnum'],
  [/\.460\s?s&w/, '.460 S&W Magnum'], [/\.500\s?s&w/, '.500 S&W Magnum'],
  [/\.22\s?(?:wmr|mag(?:num)?|win(?:chester)? mag(?:num)?)\b|\b22\s?wmr\b/, '.22 WMR'],
  [/\.17\s?hornady mag/, '.17 HMR'],
  [/\.22\s?(?:lr|long rifle)\b|\b22\s?lr\b/, '.22 LR'],
  [/\.17\s?hmr\b/, '.17 HMR'], [/\.17\s?wsm\b/, '.17 WSM'],
  [/\.22-250\b|\b22-250\b/, '.22-250 Rem'], [/\.204\s?ruger/, '.204 Ruger'], [/\.224\s?valk/, '.224 Valkyrie'],
  [/\b5\.56(?:\s?x\s?45)?(?:\s?(?:mm|nato))*\b/, '5.56 NATO'],
  [/\.223\s?wylde/, '.223 Wylde'], [/\.223\b|\b223\s?rem/, '.223 Rem'],
  [/\b6mm\s?arc\b/, '6mm ARC'], [/\b6mm\s?creedmoor\b/, '6mm Creedmoor'], [/\.243\b|\b243\s?win/, '.243 Win'],
  [/\b6\.5\s?(?:creedmoor|cm|creed)\b/, '6.5 Creedmoor'], [/\b6\.5\s?prc\b/, '6.5 PRC'], [/\b6\.5\s?grendel\b/, '6.5 Grendel'],
  [/\.25-06\b/, '.25-06 Rem'], [/\.270\s?wsm\b/, '.270 WSM'], [/\.270\b|\b270\s?win/, '.270 Win'],
  [/\b7mm-08\b/, '7mm-08 Rem'], [/\b7mm\s?prc\b/, '7mm PRC'], [/\b7mm\s?(?:rem(?:ington)?\s?)?mag(?:num)?\b/, '7mm Rem Mag'],
  [/\b7\.62\s?x\s?39\b/, '7.62x39'], [/\b7\.62\s?x\s?54r?\b/, '7.62x54R'], [/\b7\.62\s?x\s?51\b|\b7\.62\s?(?:mm)?\s?nato\b/, '7.62x51 NATO'],
  [/\b(?:\.)?300\s?(?:blk|blackout|aac)\b/, '.300 Blackout'], [/\.300\s?(?:win\s?mag|winchester magnum)\b/, '.300 Win Mag'],
  [/\.300\s?wsm\b/, '.300 WSM'], [/\.300\s?prc\b/, '.300 PRC'], [/\.300\s?wby\b|\.300 weatherby/, '.300 Wby Mag'],
  [/\.308\b|\b308\s?win/, '.308 Win'], [/\.30-06\b|\b30-06\b/, '.30-06 Springfield'], [/\.30-30\b|\b30-30\b/, '.30-30 Win'],
  [/\.338\s?lapua\b/, '.338 Lapua Mag'], [/\.350\s?legend\b/, '.350 Legend'], [/\.360\s?buckhammer/, '.360 Buckhammer'],
  [/\.450\s?bushmaster\b/, '.450 Bushmaster'], [/\.45-70\b/, '.45-70 Govt'], [/\.458\s?socom\b/, '.458 SOCOM'],
  [/\.50\s?bmg\b/, '.50 BMG'],
];
/** a rifle cartridge (not a handgun round): a pistol chambered in one is shelved with the AR pistols */
const RIFLE_CARTRIDGE = /5\.56|\.223|\.22-250|\.204|\.224|\b6mm|\.243|6\.5|\.25-06|\.270|\b7mm|7\.62|5\.45|6\.8|8\.6|\.30[08]\b|\.300|\.30-06|\.30-30|\.338|\.350|\.360|\.400 legend|\.450|\.45-70|\.458|\.50 bmg/i;
export const isRifleCartridge = (cal) => !!cal && RIFLE_CARTRIDGE.test(String(cal));

export function caliberOf(text) {
  const t = T(text).replace(/(\d)\s?x\s?(\d+)\s?mm\b/g, '$1x$2');   // 7.62x39mm → 7.62x39
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
// the store's categories, renamed where its words are vague ("Semi-Automatic" under Handguns)
const GF_GEAR = { 'cleaning equipment': 'Cleaning', 'gun storage': 'Safes & Cases', 'holster & magazine pouches': 'Holsters & Pouches',
  'black powder guns & accessories': 'Black Powder', 'parts & gunsmithing': 'Parts & Gunsmithing', 'knives & tools': 'Knives & Tools',
  'gear & accessories': 'Gear & Accessories', magazines: 'Magazines', 'agarthan merch': 'Agarthan Merch' };
const GF_GUN = { sidearms: 'Pistols', longarms: 'Rifles', shotguns: 'Shotguns' };
export function subOf(dept, p) {
  const cats = (p.categories || []).map(T);
  const leaf = cats[cats.length - 1] || '';
  const all = cats.join(' / ') + ' ' + T(p.name);
  const sp = storePath(p);
  if (sp) {
    const cat = T(sp.cat), sub = sp.sub || '';
    if (dept === 'nfa') return /package/i.test(sub) ? 'Suppressor Packages' : sub || 'NFA';
    if (cat === 'black powder guns & accessories' && dept !== 'gear') return 'Black Powder';
    if (cat === 'receivers & frames') return 'Receivers & Frames';
    if (GF_GUN[dept] && sub) return /^semi-?automatic$/i.test(sub) ? `Semi-Auto ${GF_GUN[dept]}` : sub;
    if (dept === 'ammo' && cat === 'reloading supplies') return 'Reloading';
    if (dept === 'gear') return GF_GEAR[cat] || sp.cat;
  }
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
  if (dept === 'nfa') return /suppressor|silencer/.test(all) ? 'Suppressors' : /short barrel+ed rifle|\bsbr\b/.test(all) ? 'Short Barreled Rifles' : 'NFA';
  if (dept === 'sidearms') return /revolver/.test(all) ? 'Revolvers' : 'Pistols';
  if (dept === 'shotguns') return /semi|auto/.test(all) ? 'Semi-Auto Shotguns' : 'Pump & Break-Action';
  if (dept === 'longarms') return /lever/.test(all) ? 'Lever Action' : /bolt/.test(all) ? 'Bolt Action' : /rimfire|\.22/.test(all) ? 'Rimfire Rifles' : 'Semi-Auto Rifles';
  return null;
}

/* ---------- facets ---------- */
const attr = (p, re) => { for (const [k, v] of Object.entries(p.attributes || {})) if (re.test(k)) return String(v).trim(); return null; };
/** a store spec row by label (anywhere in the label), skipping placeholders like "Other" */
const A = (p, re) => {
  for (const [k, v] of Object.entries(p.attributes || {})) {
    const s = String(v ?? '').trim();
    if (re.test(k) && s && !/^(other|n\/?a|none|-|unknown|see description)$/i.test(s)) return s;
  }
  return null;
};
/** a caliber as a spec row gives it ("45-70 Government", "22 Long Rifle", "7.62x39mm") → one canonical name */
export function normCaliber(v) {
  if (!v) return null;
  const s = String(v).trim().replace(/\s+/g, ' ');
  // bare inch calibers get their dot back: 45-70 → .45-70, 22 Long Rifle → .22 Long Rifle (not 12 Gauge, 10mm, 410 Bore)
  const dotted = /^\d{2,3}(?=[\s-]|$)/.test(s) && !/^\d+\s?(?:ga\b|gauge|bore|mm)/i.test(s) ? '.' + s : s;
  return caliberOf(dotted) || dotted.replace(/\b(acp|nato|s&w|blk|hmr|wmr|lr|prc|wsm)\b/gi, (m) => m.toUpperCase());
}
/** "Fits Glock 17/19/26, Polymer…" → "Glock 17/19/26" */
const fitsFromTitle = (t) => { const m = /\b(?:fits|for)\s+([^,]{2,40})/i.exec(String(t || '')); return m ? m[1].trim() : null; };
/** "Glock 17/19/26" → Glock 17, Glock 19, Glock 26 (so a Glock 19 owner finds it); "Ruger 10/22" is one model */
export function splitFits(v) {
  const s = String(v).trim().replace(/\b([A-Z])([A-Z]{3,})\b/g, (m, a, b) => a + b.toLowerCase());   // GLOCK → Glock
  const out = [];
  for (const part of s.split(/\s*[;,]\s*|\s+(?:and|&)\s+(?=[A-Z])/)) {
    // "Glock 17/19/26" or "Glock 17 19": one maker, several model numbers
    const m = /^(.*?[A-Za-z][A-Za-z&.\- ]*?)\s?(\d+[A-Za-z]{0,3})((?:[\/ ]\d+[A-Za-z]{0,3})+)$/.exec(part);
    if (m && !/\b10\/22\b|\b15\/22\b/.test(part)) out.push(`${m[1]} ${m[2]}`, ...m[3].split(/[\/ ]/).filter(Boolean).map((n) => `${m[1]} ${n}`));
    else if (part) out.push(part);
  }
  const AR = (x) => (/^ar[- ]?15s?(?: rifles?)?$|^ar rifles?$|^ar[- ]platform$/i.test(x) ? 'AR-15' : x);
  return [...new Set(out.map((x) => AR(x.replace(/\s+/g, ' ').trim())))].slice(0, 8);
}
// the store's ~40 holster styles → what a buyer picks by
const STYLES = [
  [/mag(?:azine)? pouch|shell holder|light holder|^pouch/i, 'Mag & gear pouches'], [/inside (?:the )?waistband|\biwb\b|appendix/i, 'Inside the waistband (IWB)'],
  [/pocket/i, 'Pocket'], [/ankle/i, 'Ankle'], [/belly band/i, 'Belly band'], [/chest/i, 'Chest'], [/shoulder/i, 'Shoulder'],
  [/retention|duty|level-?i|als|sls/i, 'Duty & retention'], [/paddle/i, 'Paddle'],
  [/outside (?:the )?waistband|\bowb\b|belt holster|hip|leg holster|tactical/i, 'Outside the waistband (OWB)'], [/concealment/i, 'Concealment'],
  [/adapter|mount|fork|plate|clip|buckle|insert|kit|accessor|attachment|shroud|qas|qls|mls|vest|rig/i, 'Parts & adapters'],
];
const holsterStyle = (v) => { for (const [re, name] of STYLES) if (re.test(v)) return name; return v; };
const yes = (v) => /^(y|yes|true|1)$/i.test(String(v || '').trim());
const num0 = (v) => { const m = String(v || '').match(/\d+(?:\.\d+)?/); return m ? +m[0] : null; };
const bulletName = (v) => { const t = T(v); const hit = BULLETS.find(([re]) => re.test(t)); return hit ? hit[1] : String(v).trim(); };
// the store's own subcategory (Gearfire: Shooting Sports › Category › Subcategory)
export const storePath = (p) => { const c = p.categories || []; return T(c[0]) === 'shooting sports' && c.length >= 2 ? { cat: c[1], sub: c[2] || null } : null; };
const uniq = (a) => [...new Set(a.filter(Boolean))];

export function facetsOf(dept, sub, p) {
  const variant = `${p.name || ''} ${Object.entries(p.attributes || {}).filter(([k]) => !/^(upc|gtin|ean|sku|mpn|manufacturer part number|gfid)$/i.test(k)).map(([k, v]) => `${k} ${v}`).join(' ')}`;
  const line = `${variant} ${p.description || p.shortDescription || ''}`;
  const tv = T(variant), tl = T(line);
  const f = {};
  const GUNS = ['sidearms', 'longarms', 'shotguns', 'nfa'];
  const sp = storePath(p);
  if (dept === 'ammo' || GUNS.includes(dept) || (dept === 'gear' && /magazine/i.test(sub || ''))) {
    const cal = normCaliber(A(p, /caliber|calibre|gauge|cartridge|chamber/i)) || caliberOf(variant);
    if (cal) f.caliber = cal;
  }
  if (dept === 'ammo') {
    const gr = num0(A(p, /grain|bullet weight/i)) || (tv.match(/\b(\d{2,3})\s?(?:gr|grain)s?\b/) || [])[1];
    if (gr) f.grain = `${+gr} gr`;
    // a box count, not a turkey load's "3 in" shell or a "3-round" feature: boxes hold 5 or more
    const ct = num0(A(p, /rounds per box|^rounds?$|^count$|box (?:count|quantity)|quantity per box/i)) || [...tv.matchAll(/\b(\d{1,4})\s?(?:rd|rds|rounds?|ct|count)\b/g)].map((m) => m[1]).find((n) => +n >= 5) || (tv.match(/box of (\d{1,4})/) || [])[1];
    if (ct) f.count = `${parseInt(ct, 10)} rds`;
    // the spec row names this variant's bullet; the copy may list the whole line's
    const rowBullet = A(p, /bullet type|projectile type|shot type|load type/i);
    const bullets = rowBullet ? [bulletName(rowBullet)] : uniq(BULLETS.filter(([re]) => re.test(tl)).map(([, n]) => n)).slice(0, 2);
    if (bullets.length) f.bullet = bullets;
    const uses = uniq(USES.filter(([re]) => re.test(tl)).map(([, n]) => n));
    if (uses.length) f.use = uses;
    const cs = A(p, /case type|case material|casing/i); if (cs) f.casing = cs;
    if (sub === 'Shotgun') {
      const rowShot = A(p, /shot size/i);
      const shot = !rowShot && (tv.match(/\b(000|00|0|bbb|bb|t|f)\s?buck(?:shot)?\b/) || tv.match(/(?:#|no\.?\s?)(\d{1,2}(?:\.5)?)\b/));
      if (rowShot) f.shot = rowShot;
      else if (shot) f.shot = /buck/.test(shot[0]) ? `${shot[1].toUpperCase()} Buck` : `#${shot[1]}`;
      const sl = A(p, /shell length/i) || (tv.match(/\b(2-3\/4|2 3\/4|2\.75|3-1\/2|3 1\/2|3\.5|3)\s?(?:"|”|in\b|inch)/) || [])[1];
      if (sl) { const k = String(sl).replace(/["”]|\s?(?:in|inch(?:es)?)$/gi, '').trim(); f.shell = ({ '2 3/4': '2-3/4"', '2.75': '2-3/4"', '3 1/2': '3-1/2"', '3.5': '3-1/2"' }[k] || `${k}"`); }
    }
    if (sub === 'Reloading' && sp && sp.sub) f.kind = sp.sub;
  }
  if (GUNS.includes(dept)) {
    const bar = num0(A(p, /barrel length|^barrel$/i)) || (tv.match(/\b(\d{1,2}(?:\.\d{1,2})?)\s?(?:"|”|''|in\b|inch(?:es)?\b|-inch)/) || [])[1];
    if (bar && +bar >= 2) f.barrel = `${+bar}"`;
    // the store's subcategory already says the action (Semi-Automatic, Bolt Action…): only a spec row adds one
    const act = A(p, /^action/i) || (sp ? null : /bolt[- ]action/.test(tl) ? 'Bolt action' : /lever[- ]action/.test(tl) ? 'Lever action' : /pump[- ]action/.test(tl) ? 'Pump action' : /semi[- ]auto/.test(tl) ? 'Semi-auto' : /revolver|double[- ]action/.test(tl) ? 'Revolver' : null);
    if (act) f.action = act;
    const cap = num0(A(p, /capacity/i)) || (tv.match(/\b(\d{1,3})[\s-]?(?:\+\s?1\s?)?(?:rd|rds|round|shot)s?\b/) || [])[1];
    if (cap) f.capacity = `${parseInt(cap, 10)} rounds`;
    const col = A(p, /^colou?r$|^finish$/i); if (col) f.color = col;
  }
  if (dept === 'gear') {
    if (sp && sp.sub && sp.sub !== sub) f.kind = sp.sub;
    if (/magazine/i.test(sub || '')) { const cap = num0(A(p, /capacity/i)) || (tv.match(/\b(\d{1,3})[\s-]?(?:rd|rds|round)s?\b/) || [])[1]; if (cap) f.capacity = `${parseInt(cap, 10)} rounds`; }
    // what gun it fits: the store's row (holsters), else the variant title ("Fits Glock 17/19/26", "For GLOCK 17")
    const fitRow = A(p, /fit \/ used for|^fits?$|compatib|^model fit|firearm fit/i) || fitsFromTitle(p.subtitle);
    if (fitRow) f.fits = splitFits(fitRow);
    const hand = A(p, /^hand(?:ed(?:ness)?)?$/i); if (hand) f.hand = /amb/i.test(hand) ? 'Ambidextrous' : /left/i.test(hand) ? 'Left hand' : /right/i.test(hand) ? 'Right hand' : hand;
    const style = A(p, /^(?:holster )?style$|^carry (?:style|position)$/i); if (style && /holster/i.test(sub || '')) f.style = holsterStyle(style);
    const col = A(p, /^colou?r$|^finish$/i); if (col) f.color = col;
  }
  if (dept === 'optics') {
    const rowMag = A(p, /^magnification/i), rowObj = num0(A(p, /objective/i));
    if (rowMag && /\d/.test(rowMag)) f.mag = rowMag.toLowerCase().replace(/\s+/g, '').replace(/x?$/, 'x');
    if (rowObj) f.objective = `${rowObj} mm`;
    const rowTube = A(p, /tube (?:size|diameter)|ring (?:size|diameter)/i);
    if (rowTube) f.tube = /\b1\b|inch|"/i.test(rowTube) && !/mm/i.test(rowTube) ? '1"' : `${num0(rowTube)} mm`;
    const rowFocal = A(p, /focal plane/i);
    if (rowFocal) { if (/first|ffp/i.test(rowFocal)) f.focal = 'First focal plane'; else if (/second|sfp/i.test(rowFocal)) f.focal = 'Second focal plane'; }
    const rowIllum = A(p, /illuminat/i); if (rowIllum) f.illum = yes(rowIllum) ? 'Illuminated' : 'Non-illuminated';
    const ret = A(p, /^reticle(?: type)?$/i); if (ret) f.reticle = ret;
    const dot = A(p, /dot size/i); if (dot) f.dot = dot.replace(/\s?moa/i, ' MOA');
    const col = A(p, /^colou?r$|^finish$/i); if (col) f.color = col;
    const ht = A(p, /^height$|ring height/i); if (ht && sub === 'Scope Mounts & Rings') f.height = ht;
    const fa = A(p, /firearm application|platform/i); if (fa) f.platform = fa;
    const lc = A(p, /laser colou?r/i); if (lc) f.laser = [lc];
    if (yes(A(p, /^infrared$|^ir$/i))) f.laser = uniq([...(f.laser || []), 'IR']);
    const res = A(p, /sensor resolution|thermal resolution|^resolution$/i);
    if (res && ['Thermal', 'Night Vision'].includes(sub)) f.sensor = res.replace(/\s?[x×]\s?/i, '×');
    const fitRow = A(p, /footprint|fit \/ used for|mount type|compatib/i);
    if (fitRow && ['Red Dots & Holographic', 'Red Dot Mounts', 'Scope Mounts & Rings', 'Bases', 'Optic Accessories', 'Lasers'].includes(sub)) {
      const t = T(fitRow);
      f.footprint = uniq([/picatinny|1913/.test(t) && 'Picatinny', /weaver/.test(t) && 'Weaver', /m-?lok/.test(t) && 'M-LOK',
        !/picatinny|weaver|m-?lok/.test(t) && fitRow]);
    }
    const mag = tv.match(/\b(\d{1,2}(?:\.\d)?)\s?-\s?(\d{1,2}(?:\.\d)?)\s?x\s?(\d{2})?\b/) || tv.match(/\b(\d{1,2}(?:\.\d)?)\s?x\s?(\d{2})\b/);
    if (mag && !f.mag) {
      if (mag[3] !== undefined || /-/.test(mag[0])) { f.mag = `${mag[1]}-${mag[2]}x`; if (mag[3] && !f.objective) f.objective = `${mag[3]} mm`; }
      else { f.mag = `${mag[1]}x`; if (!f.objective) f.objective = `${mag[2]} mm`; }
    }
    const obj = tv.match(/\b(\d{2})\s?mm\s?objective/); if (obj && !f.objective) f.objective = `${obj[1]} mm`;
    const tube = A(p, /^(tube|ring)/i) || (tl.match(/\b(30|34|35|36)\s?mm\s?(?:main\s?|one-piece\s?)?(?:tube|rings?)\b/) || [])[1] ||
      (/one[- ]inch|1["”]\s?(?:tube|rings?)|1-inch/.test(tl) ? '1"' : null);
    if (tube && !f.tube && ['Riflescopes', 'Scope Mounts & Rings', 'Optics'].includes(sub)) f.tube = /"$/.test(tube) ? tube : `${String(tube).replace(/\D/g, '')} mm`;
    if (f.focal) { /* from the spec row */ } else if (/first focal plane|\bffp\b/.test(tl)) f.focal = 'First focal plane';
    else if (/second focal plane|\bsfp\b/.test(tl)) f.focal = 'Second focal plane';
    if (!f.illum && ['Riflescopes', 'Red Dots & Holographic', 'Magnifiers', 'Optics'].includes(sub)) {
      if (/non[- ]?illuminated/.test(tl)) f.illum = 'Non-illuminated';
      else if (/illuminat/.test(tl)) f.illum = 'Illuminated';
    }
    const fp = uniq([
      /\brmr\b/.test(tl) && 'Trijicon RMR', /\bacro\b/.test(tl) && 'Aimpoint ACRO', /\bt-?1\b|\bt-?2\b|aimpoint micro|micro footprint/.test(tl) && 'Aimpoint Micro',
      /\brmsc?\b|shield/.test(tl) && 'Shield RMSc', /deltapoint|\bdpp\b|docter/.test(tl) && 'Docter / DeltaPoint', /\b(?:407|507|508)k\b|\bepsk?\b|holosun k/.test(tl) && 'Holosun K',
      /picatinny|1913|stanag/.test(tl) && 'Picatinny', /\bweaver\b/.test(tl) && 'Weaver', /\bmrds\b/.test(tl) && 'MRDS', /dovetail/.test(tl) && 'Dovetail',
    ]);
    if (fp.length && ['Red Dots & Holographic', 'Red Dot Mounts', 'Scope Mounts & Rings', 'Bases', 'Optic Accessories', 'Lasers'].includes(sub)) f.footprint = uniq([...(f.footprint || []), ...fp]);
    // a thermal core is 4:3 or 5:4 and at most 1280 wide; a display resolution (1920×1080) is not a sensor
    const sensor = [...tl.matchAll(/\b(\d{3,4})\s?[x×]\s?(\d{3,4})\b/g)].map((m) => [+m[1], +m[2]]).find(([w, h]) => w <= 1280 && w / h >= 1.2 && w / h <= 1.4);
    if (sensor && !f.sensor && ['Thermal', 'Night Vision'].includes(sub)) f.sensor = `${sensor[0]}×${sensor[1]}`;
    if (sub === 'Night Vision') {
      if (/white phosphor/.test(tl)) f.phosphor = 'White phosphor'; else if (/green phosphor/.test(tl)) f.phosphor = 'Green phosphor';
    }
    if (sub === 'Lasers' && !f.laser) {
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
  sensor: 'Sensor', phosphor: 'Phosphor', laser: 'Laser', casing: 'Case', reticle: 'Reticle', dot: 'Dot size', color: 'Color',
  height: 'Ring height', platform: 'Made for', kind: 'Type', fits: 'Fits', hand: 'Hand', style: 'Style',
};
