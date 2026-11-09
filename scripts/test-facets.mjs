#!/usr/bin/env node
/* test-facets.mjs — categories and filter values from lib-facets.mjs, and the
 * maker names build-catalog.mjs merges.   node scripts/test-facets.mjs */
import { caliberOf, subOf, facetsOf, normCaliber, splitFits, caseName } from './lib-facets.mjs';
import { normBrand, classify, displayName, buildItems } from './build-catalog.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log(`  ✗ ${m}`); } };
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) pass++; else { fail++; console.log(`  ✗ ${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); } };
const P = (name, extra = {}) => ({ name, attributes: {}, categories: [], ...extra });

/* calibers: one name per cartridge, however it is written */
eq(caliberOf('Federal HST 9mm Luger 147gr'), '9mm Luger', '9mm');
eq(caliberOf('9x19 FMJ'), '9mm Luger', '9x19 is 9mm Luger');
eq(caliberOf('.223 Rem 55gr'), '.223 Rem', '.223');
eq(caliberOf('5.56x45mm NATO M193'), '5.56 NATO', '5.56');
eq(caliberOf('300 BLK 110gr'), '.300 Blackout', '300 BLK');
eq(caliberOf('6.5 Creedmoor ELD Match'), '6.5 Creedmoor', '6.5 CM');
eq(caliberOf('12 ga 2-3/4" 00 Buck'), '12 Gauge', '12 ga');
eq(caliberOf('.410 Bore'), '.410 Bore', '.410');
eq(caliberOf('.22 LR 40gr'), '.22 LR', '.22 LR');
eq(caliberOf('30-30 Win 160gr FTX'), '.30-30 Win', '30-30');
eq(caliberOf('LEVERevolution'), null, 'a line name has no caliber');

/* categories from the store's breadcrumb, then the name */
const ammo = (cat, name = 'X') => subOf('ammo', P(name, { categories: ['Shooting Sports', 'Ammunition', cat] }));
eq(ammo('Rifle Ammo'), 'Rifle', 'rifle ammo');
eq(ammo('Handgun Ammo'), 'Handgun', 'handgun ammo');
eq(ammo('Shotgun Ammo'), 'Shotgun', 'shotgun ammo');
eq(ammo('Rimfire Ammo'), 'Rimfire', 'rimfire ammo');
eq(ammo('', 'Super-X .22 LR'), 'Rimfire', '.22 LR is rimfire even without a category');
const optic = (cat, name = 'X') => subOf('optics', P(name, { categories: ['Shooting Sports', 'Optics', cat] }));
eq(optic('Scope Mounts'), 'Scope Mounts & Rings', 'scope mounts');
eq(optic('Red Dot Mounts'), 'Red Dot Mounts', 'red dot mounts are not red dots');
eq(optic('Red Dots & Holographic'), 'Red Dots & Holographic', 'red dots');
eq(optic('Thermal Optics'), 'Thermal', 'thermal');
eq(optic('Night Vision Optics'), 'Night Vision', 'night vision');
eq(optic('Scopes'), 'Riflescopes', 'scopes');
eq(optic('Sights'), 'Iron & Night Sights', 'sights');
eq(optic('Optical Accessories'), 'Optic Accessories', 'accessories');
eq(subOf('gear', P('Team Wendy EXFIL Ballistic Helmet')), 'Helmets', 'helmet');
eq(subOf('gear', P('Wilcox L4 G24 NVG Mount')), 'Helmet & NVG Accessories', 'NVG mount');
eq(subOf('longarms', P('Henry Big Boy Lever Action .357')), 'Lever Action', 'lever action rifle');

/* ammo facets: variant facts from the name/specs only, line facts may use the copy */
let f = facetsOf('ammo', 'Handgun', P('Personal Defense HST 9mm 147gr 20rd', { description: 'Built for law enforcement and self-defense. Available in .40 S&W and .45 ACP.' }));
eq(f.caliber, '9mm Luger', 'caliber from the name, not the copy listing other calibers');
eq(f.grain, '147 gr', 'grain');
eq(f.count, '20 rds', 'round count');
eq(f.bullet, ['HST'], 'bullet type');
eq(f.use, ['Defense'], 'use');
f = facetsOf('ammo', 'Handgun', P('Personal Defense HST', { description: 'Available in 9mm, .40 S&W and .45 ACP, 124 to 230 grain.' }));
eq([f.caliber, f.grain], [undefined, undefined], 'a line with many calibers gets none from its copy');
f = facetsOf('ammo', 'Rifle', P('Match', { attributes: { Caliber: '6.5 Creedmoor', 'Bullet Weight': '140 Grain', Rounds: '20' } }));
eq([f.caliber, f.grain, f.count], ['6.5 Creedmoor', '140 gr', '20 rds'], 'spec rows win');
f = facetsOf('ammo', 'Shotgun', P('Turkey 12 ga 3 in #5 TSS 5 Rounds'));
eq([f.caliber, f.shell, f.shot, f.count], ['12 Gauge', '3"', '#5', '5 rds'], 'shotshell: gauge, length, shot size, count');
f = facetsOf('ammo', 'Shotgun', P('Buckshot 12 ga 2-3/4" 00 Buck 3-round feature'));
eq([f.shot, f.count], ['00 Buck', undefined], '00 buck; a 3-round feature is not a box count');

/* optics facets */
f = facetsOf('optics', 'Riflescopes', P('Pro Hunter Riflescope 3-9x40', { description: '1 inch tube, second focal plane, illuminated reticle.' }));
eq([f.mag, f.objective, f.focal, f.illum], ['3-9x', '40 mm', 'Second focal plane', 'Illuminated'], 'scope: mag, objective, focal plane, illumination');
f = facetsOf('optics', 'Riflescopes', P('ACOG 2x20'));
eq([f.mag, f.objective], ['2x', '20 mm'], 'fixed power');
f = facetsOf('optics', 'Red Dot Mounts', P('DOGTAG Optic Plate', { description: 'Fits Trijicon RMR and Holosun 507K footprints on Picatinny rails.' }));
eq(f.footprint, ['Trijicon RMR', 'Holosun K', 'Picatinny'], 'mount footprints');
f = facetsOf('optics', 'Thermal', P('Thermal scope', { description: '640x512 sensor, 1920x1080 display' }));
eq(f.sensor, '640×512', 'thermal core, not the display');
f = facetsOf('optics', 'Lasers', P('HS1 Hand Stop Laser', { description: 'Green laser' }));
eq(f.laser, ['Green'], 'laser color');

/* maker names */
eq(normBrand('Winchester Ammunition'), 'Winchester', 'Winchester Ammunition');
eq(normBrand('L3 Harris'), 'L3Harris', 'L3 Harris');
eq(normBrand('Fiocchi Ammunition'), 'Fiocchi', 'Fiocchi');
eq(normBrand('Trijicon'), 'Trijicon', 'unlisted makers pass through');

/* Gearfire spec rows (values as the shop's pages give them) */
eq(normCaliber('45-70 Government'), '.45-70 Govt', 'bare 45-70 gets its dot');
eq(normCaliber('22 Long Rifle'), '.22 LR', '22 Long Rifle');
eq(normCaliber('7.62x39mm'), '7.62x39', '7.62x39mm');
eq(normCaliber('30-30 Winchester'), '.30-30 Win', '30-30 Winchester');
eq(normCaliber('12 Gauge'), '12 Gauge', 'gauges keep no dot');
eq(normCaliber('9mm'), '9mm Luger', '9mm');
eq(normCaliber('35 Remington'), '.35 Remington', 'an unlisted cartridge keeps the store\'s words, dotted');
const GF = (cat, sub, name, attributes, extra = {}) => ({ source: 'gearfire', name, attributes, categories: ['Shooting Sports', cat, sub], ...extra });
const lever = GF('Ammunition', 'Rifle Ammo', 'LEVERevolution', { UPC: '090255827415', 'Manufacturer Part Number': '82741', 'Bullet Grain Weight': '250 Grains', 'Bullet Type': 'MonoFlex', 'Rifle Caliber': '45-70 Government', 'Rounds Per Box': '20', 'Case Type': 'Brass', 'Muzzle Velocity': '2025 FPS' }, { description: 'Available in 30-30, 308 Win and more. FTX and MonoFlex bullets.' });
f = facetsOf('ammo', 'Rifle', lever);
eq([f.caliber, f.grain, f.count, f.bullet, f.casing], ['.45-70 Govt', '250 gr', '20 rds', ['MonoFlex'], 'Brass'], 'gearfire ammo: caliber, grain, count, bullet, case from spec rows');
eq(displayName(lever, 'ammo', f), 'LEVERevolution .45-70 Govt 250 gr MonoFlex', 'gearfire ammo: a name that says the variant');
const shells = GF('Ammunition', 'Shotgun Ammo', 'AA Shotshell', { 'Shell Length': '2-3/4"', 'Shot Type': 'Bird Shot', 'Rounds Per Box': '25', Cartridge: '12 Gauge', 'Shot Size': '#8-1/2' });
f = facetsOf('ammo', 'Shotgun', shells);
eq([f.caliber, f.shell, f.shot, f.bullet, f.count], ['12 Gauge', '2-3/4"', '#8-1/2', ['Birdshot'], '25 rds'], 'gearfire shotshells');
f = facetsOf('optics', 'Riflescopes', GF('Optics', 'Scopes', 'ACOG 2x20', { 'Illuminated Reticle': 'Yes', Magnification: '2x', 'Optics Focal Plane': 'Fixed', 'Objective Lens Size': '20mm', 'Reticle Type': 'BDC', 'Tube Size': 'Other' }));
eq([f.mag, f.objective, f.illum, f.reticle, f.tube, f.focal], ['2x', '20 mm', 'Illuminated', 'BDC', undefined, undefined], 'gearfire scope: "Other" and "Fixed" are not filter values');
f = facetsOf('optics', 'Red Dot Mounts', GF('Optics', 'Red Dot Mounts', 'DOGTAG Optic Plate', { 'Fit / Used For': 'Holosun EPS', Color: 'Black' }));
ok(f.footprint.includes('Holosun EPS'), 'gearfire mount: the footprint it fits');
f = facetsOf('sidearms', 'Semi-Auto Pistols', GF('Handguns', 'Semi-Automatic', 'G19 Gen6', { 'Handgun Caliber': '9mm', 'Barrel Length': '4.02"', Capacity: '15 Rounds', Finish: 'Black' }));
eq([f.caliber, f.barrel, f.capacity, f.action, f.color], ['9mm Luger', '4.02"', '15 rounds', undefined, 'Black'], 'gearfire pistol: caliber, barrel, capacity (the action is the category)');

/* Gearfire departments and categories */
const C = (cat, sub) => classify({ name: 'x', categories: ['Shooting Sports', cat, sub] });
eq([C('Handguns', 'Semi-Automatic'), C('Rifles', 'Bolt Action'), C('Shotguns', 'Pump Action'), C('NFA/Suppressors', 'Suppressors'), C('Magazines', 'Rifle'),
  C('Reloading Supplies', 'Primers'), C('Black Powder Guns & Accessories', 'Rifles'), C('Black Powder Guns & Accessories', 'Black Powder Accessories'), C('Agarthan Merch', 'Agarthan Merch')],
  ['sidearms', 'longarms', 'shotguns', 'nfa', 'gear', 'ammo', 'longarms', 'gear', 'gear'], 'gearfire: departments from the store\'s categories');
const S = (dept, cat, sub) => subOf(dept, { name: 'x', categories: ['Shooting Sports', cat, sub] });
eq([S('sidearms', 'Handguns', 'Semi-Automatic'), S('sidearms', 'Handguns', 'Revolvers'), S('nfa', 'NFA/Suppressors', 'Firearms / Suppressor Packages'), S('gear', 'Holster & Magazine Pouches', 'Holsters'), S('ammo', 'Reloading Supplies', 'Primers')],
  ['Semi-Auto Pistols', 'Revolvers', 'Suppressor Packages', 'Holsters & Pouches', 'Reloading'], 'gearfire: categories');
eq(facetsOf('gear', 'Holsters & Pouches', GF('Holster & Magazine Pouches', 'Holsters', 'X', {})).kind, 'Holsters', 'gearfire gear: the store subcategory is a Type filter');
f = facetsOf('gear', 'Holsters & Pouches', GF('Holster & Magazine Pouches', 'Holsters', 'Schema', { 'Firearm Fit': 'Glock 17 19', Style: 'Inside Waistband Holster', Hand: 'Right Hand' }));
eq([f.fits, f.style, f.hand], [['Glock 17', 'Glock 19'], 'Inside the waistband (IWB)', 'Right hand'], 'holster: fits each model, style grouped, hand');
f = facetsOf('gear', 'Magazines', GF('Magazines', 'Handgun', 'Glock 17, 19, 26 Magazines', { Caliber: '9MM', Capacity: '20' }, { subtitle: 'ProMag, Magazine, 9MM, 20 Rounds, Fits Glock 17/19/26, Polymer' }));
eq([f.fits, f.caliber, f.capacity], [['Glock 17', 'Glock 19', 'Glock 26'], '9mm Luger', '20 rounds'], 'magazine: fits read from the variant title');
eq(splitFits('Ruger 10/22'), ['Ruger 10/22'], 'a model name with a slash stays whole');
eq(splitFits('AR Rifles'), ['AR-15'], 'AR naming merged');

/* the smaller gaps */
eq([caseName('Nickel-Plated'), caseName('Nickel'), caseName('Nickel Alloy Steel'), caseName('Brass'), caseName('aluminum')], ['Nickel-plated', 'Nickel-plated', 'Steel', 'Brass', 'Aluminum'], 'case: one name per material');
eq(facetsOf('ammo', 'Rifle', GF('Ammunition', 'Rifle Ammo', 'Rifle', { 'Rifle Caliber': '7.62x39mm' }, { subtitle: 'Tula, 7.62x39, 122 Grain, Hollow Point, Steel Case, 20 Round Box' })).casing, 'Steel', 'case: "Steel Case" in the title when there is no row');
eq(facetsOf('ammo', 'Shotgun', GF('Ammunition', 'Shotgun Ammo', 'Target', { Cartridge: '12 Gauge' })).casing, undefined, 'case: never guessed');
eq(facetsOf('sidearms', 'Revolvers', GF('Handguns', 'Revolvers', 'Pug', { 'Barrel Length': '1"', Caliber: '22 WMR' })).barrel, '1"', 'barrel: a 1" pocket revolver from its spec row');
f = facetsOf('nfa', 'Suppressors', GF('NFA/Suppressors', 'Suppressors', 'Tisha', { Caliber: '5.56 mm NATO', 'Mount Style': 'Quick Detach', Material: '17-4PH Stainless Steel', 'Suppressor Type': '5.56 Rifle', 'Suppressor Modular': 'No' }));
eq([f.kind, f.mount, f.material, f.modular, f.caliber], ['5.56 Rifle', 'Quick Detach', 'Stainless steel', 'Fixed length', '5.56 NATO'], 'suppressor: type, mount, material, modular');
f = facetsOf('longarms', 'Receivers & Frames', GF('Receivers & Frames', 'Upper', 'Upper', { 'Receiver Size': 'AR-15', Stripped: 'No', 'Barrel Length': '16"' }));
eq([f.kind, f.platform, f.build, f.barrel], ['Upper', 'AR-15', 'Complete', '16"'], 'receiver: type, platform, build, barrel');
const thor = GF('Optics', 'Thermal Optics', 'Thor 5', { Monocular: 'Yes' }, { subtitle: 'ATN, Thor 5, 640, 4-32X, Smart HD Thermal Scope, 30mm', id: 'thor', price: 3000, variant: { Cameras: 'No', Magnification: '4-32x' } });
f = facetsOf('optics', 'Thermal', thor);
eq([f.vision, f.form], [['Thermal'], 'Rifle scope'], 'thermal rifle scope: vision and type (the title wins over a Monocular row)');
const [thorItem] = buildItems([thor]);
eq([thorItem.sub, thorItem.also, thorItem.name], ['Thermal', ['Riflescopes'], 'Thor 5 — 4-32x'], 'a thermal rifle scope also shows with the riflescopes; a "No" spec stays out of its name');
eq(facetsOf('optics', 'Night Vision', GF('Optics', 'Night Vision Optics', 'PVS-14', {}, { subtitle: 'PVS-14' })).vision, ['Night vision (tube)'], 'a PVS-14 is tube night vision');
eq(facetsOf('optics', 'Night Vision', GF('Optics', 'Night Vision Optics', 'X-Sight 5', {}, { subtitle: 'ATN, X-Sight 5, Night Vision Rifle Scope, 3-15x' })).vision, ['Digital night vision'], 'an X-Sight is digital night vision');
const dot = (brand, name) => facetsOf('optics', 'Red Dots & Holographic', GF('Optics', 'Red Dots / Holographic', name, {}, { brand })).footprint;
eq([dot('Trijicon', 'SRO'), dot('Shield Sights', 'SMS2'), dot('Steiner', 'MPS 2.0'), dot('Steiner', 'MPS-C'), dot('EOTech', 'EXPS3'), dot('EOTech', 'EFLX')],
  [['Trijicon RMR'], ['Shield RMSc'], ['Aimpoint ACRO'], undefined, ['Picatinny'], ['Docter / DeltaPoint']], 'red dot footprints by model (unsure models left out)');
const [bp] = buildItems([GF('Black Powder Guns & Accessories', 'Rifles', 'Hawken', {}, { id: 'bp', price: 400, firearm: false, nfa: false })]);
eq([bp.dept, bp.firearm], ['longarms', false], 'gearfire: black powder is shelved with rifles but is not a firearm (the store says so)');
const [can] = buildItems([GF('NFA/Suppressors', 'Suppressors', 'Obsidian 45', {}, { id: 'can', price: 900, firearm: false, nfa: true })]);
eq([can.dept, can.firearm, can.type], ['nfa', true, 'can'], 'gearfire: a suppressor goes through the FFL, with its own icon');
/* NFA items are flagged (cards draw a red NFA plate on the cover): the NFA department, the store's
   own flag, or a firearm whose name says so; things named after suppressors or short barrels are not */
const [nCan, nUnflagged, nSbr, nCover, nSight, nAmmo, nPistol] = buildItems([
  GF('NFA/Suppressors', 'Suppressors', 'Obsidian 45', {}, { id: 'n1', price: 900, firearm: false, nfa: true }),
  GF('NFA/Suppressors', 'Suppressors', 'TISHA 9MM TITANIUM', {}, { id: 'n2', price: 900, firearm: true, nfa: false }),
  GF('Rifles', 'Semi-Automatic', 'HK MR762 A4 13" Bbl Short Barrel Rifle w/(1) 20rd Mag', {}, { id: 'n3', price: 4000, firearm: true, nfa: false }),
  GF('Gear & Accessories', 'Gear & Accessories', 'High Temp Suppressor Cover', {}, { id: 'n4', price: 60, firearm: false, nfa: false }),
  GF('Optics', 'Iron & Night Sights', 'Tall Suppressor Height Sight', {}, { id: 'n5', price: 90, firearm: false, nfa: false }),
  GF('Ammunition', 'Rimfire Ammo', 'Gold Dot Short Barrel Rimfire .22 WMR 40 gr Hollow Point', {}, { id: 'n6', price: 20, firearm: false, nfa: false }),
  GF('Handguns', 'Semi-Automatic', 'VP9A1 X — Suppressor Height', {}, { id: 'n7', price: 900, firearm: true, nfa: false }),
]);
eq([nCan.nfa, nUnflagged.nfa, nSbr.nfa], [true, true, true], 'NFA: the store\'s flag, the NFA department, a short-barreled rifle filed with the rifles');
eq([nCover.nfa, nSight.nfa, nAmmo.nfa, nPistol.nfa], [undefined, undefined, undefined, undefined], 'not NFA: a suppressor cover, a suppressor-height sight, short-barrel ammo, a suppressor-height pistol');
/* a pistol in a rifle round goes to its own category with the rifles; one in a handgun round stays a handgun */
const pistol = (id, sub, cal, extra = {}) => GF('Handguns', sub, `Pistol ${id}`, { 'Handgun Caliber': cal, ...extra }, { id, price: 1000, firearm: true });
const [mk18, bfr, pcc, g19] = buildItems([pistol('mk18', 'Large Format Pistols', '5.56 mm NATO'), pistol('bfr', 'Revolvers', '45-70 Government'),
  pistol('pcc', 'Large Format Pistols', '9mm'), pistol('g19', 'Semi-Automatic', '9mm')]);
eq([mk18.dept, mk18.sub, mk18.f.action, mk18.type, mk18.firearm], ['longarms', 'AR & Rifle-Caliber Pistols', 'Semi-Auto', 'ar', true], 'a 5.56 pistol is an AR pistol, with the rifles');
eq([bfr.dept, bfr.sub, bfr.f.action, bfr.type], ['longarms', 'AR & Rifle-Caliber Pistols', 'Revolver', 'revolver'], 'a .45-70 revolver joins it, its action kept');
eq([pcc.dept, g19.dept], ['sidearms', 'sidearms'], 'a 9mm pistol of any size stays a handgun');
const [ar16, mk18b] = buildItems([GF('Rifles', 'Semi-Automatic', 'AR', { 'Rifle Caliber': '5.56 NATO', 'Barrel Length': '16.1"' }, { id: 'ar16', price: 900, firearm: true }),
  pistol('mk18b', 'Large Format Pistols', '5.56 NATO', { 'Barrel Length': '10.3"' })]);
eq([ar16.f.barrel, ar16.specs.barrel, mk18b.f.barrel], ['16–18"', '16.1"', '8–10.5"'], 'barrel filter by range, the exact length kept on the card');
eq([normCaliber('7.62 mm NATO'), normCaliber('.45 (Long) Colt'), normCaliber('.32 Auto (ACP)')], ['7.62x51 NATO', '.45 Colt', '.32 ACP'], 'more caliber spellings');
/* photos: a web photo never stands for the store's own product; a photo pulled by hand goes from every variant sharing it */
const webPhoto = (id, extra = {}) => ({ ...GF('Agarthan Merch', 'Agarthan Merch', 'Thule Shirt', {}, { id, price: 27, brand: 'Agarthan Armory', localImages: ['img/products/x.webp'], photoSource: { page: 'https://example.com', score: 2 } }), ...extra });
const [shirt] = buildItems([webPhoto('shirt')]);
eq(shirt.images, [], 'the store\'s own merch never shows a photo found on the web');
const [ownSite] = buildItems([webPhoto('own', { photoSource: undefined, localImages: ['img/products/own-1.jpg'] })]);
eq(ownSite.images, ['img/products/own-1.jpg'], '…but keeps a photo from the store\'s own site');
const vA = GF('Optics', 'Scopes', 'Tru-Brite', {}, { id: 'va', price: 200, brand: 'TRUGLO', localImages: ['img/products/va-1.webp'], photoSource: { page: 'x', score: 3 } });
const vB = { ...vA, id: 'vb', photoSource: { page: 'x', score: 3, sharedFrom: 'va' } };
const [pa, pb] = buildItems([vA, vB], { vb: { noPhoto: true } });
eq([pa.images, pb.images], [[], []], 'noPhoto on one variant takes the shared photo off the whole line');
const [box] = buildItems([{ ...lever, id: 'lv', price: 58.99 }]);
eq(box.cpr, 2.95, 'price per round');
const [bad] = buildItems([GF('Ammunition', 'Rifle Ammo', 'Rifle Ammo', { 'Rifle Caliber': '7.62x39mm', 'Rounds Per Box': '1000' }, { id: 'tula', price: 9.99 })]);
eq(bad.cpr, undefined, 'no price per round when the listing contradicts itself');

console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
