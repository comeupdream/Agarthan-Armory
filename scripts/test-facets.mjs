#!/usr/bin/env node
/* test-facets.mjs — categories and filter values from lib-facets.mjs, and the
 * maker names build-catalog.mjs merges.   node scripts/test-facets.mjs */
import { caliberOf, subOf, facetsOf } from './lib-facets.mjs';
import { normBrand } from './build-catalog.mjs';

let pass = 0, fail = 0;
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

console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
