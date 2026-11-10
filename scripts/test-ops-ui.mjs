/* test-ops-ui.mjs — the Ops Console in a real browser, against the real
 * server and a stand-in GitHub / WooCommerce / email provider: unlock, every
 * one of the 14 tabs renders, inventory edits stage, the editor (photo upload,
 * condition, video, search terms), a notice, your own listings, search pins
 * and the log, the Spotlight with its preview, publish → one commit with the
 * photos byte for byte, History, the site check and the theme check, the test
 * email, data gaps, orders and their firearm release, the inbox (hostile
 * names stay text), discard, the guard for photos left in another tab, and no
 * script errors or CSP violations anywhere. Then the storefront: Spotlight,
 * pins, the condition badge, the video, and the header at every width (the
 * phone menu reachable and working). Needs Playwright.
 * Run: node scripts/test-ops-ui.mjs [--shots dir] */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mockGitHub, mockWoo, mockMail } from './lib-mock-github.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log(`✗ ${msg}`); } };

const vm = await import('node:vm');
const fs = await import('node:fs');
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/data/catalog.js'), 'utf8'), ctx);
const sample = ctx.window.AA_CATALOG.items.find((i) => i.dept === 'sidearms' && i.price && i.images && i.images.length);

const gh = await mockGitHub({ 'assets/data/overrides.json': JSON.stringify({ _readme: 'r' }), 'assets/data/site-settings.json': '{}' });
const woo = await mockWoo();
const mail = await mockMail();
const PORT = 4800 + Math.floor(Math.random() * 200);   // below 5060, a port fetch refuses
const srv = spawn(process.execPath, [path.join(ROOT, 'server.mjs')], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: {
  ...process.env, PORT: String(PORT), OPS_PASSWORD: 'ui-test-passcode', DATA_DIR: mkdtempSync(path.join(tmpdir(), 'ops-ui-')),
  GH_TOKEN: gh.token, GH_REPO: gh.repo, GH_API: gh.url, WOO_URL: woo.url, WOO_CK: woo.ck, WOO_CS: woo.cs, RENDER_GIT_COMMIT: 'b'.repeat(40),
  RESEND_API_KEY: mail.key, RESEND_API: mail.url, ALERT_EMAIL: 'store@example.com',
} });
let log = ''; srv.stdout.on('data', (d) => (log += d)); srv.stderr.on('data', (d) => (log += d));
await new Promise((r) => { const i = setInterval(() => { if (log.includes('http://')) { clearInterval(i); r(); } }, 50); });
const BASE = `http://127.0.0.1:${PORT}`;
await fetch(BASE + '/api/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'requisition', name: 'Ada <b>Byrd</b>', contact: '(954) 555-0142', note: 'Hold it please', items: ['1 × Glock 19'] }) });
for (const [q, found] of [['glock 19', 40], ['glock 19', 40], ['hyperborean blaster', 0]]) await fetch(BASE + '/api/hit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p: '/armory.html', q, found }) });
const PHOTO = (() => { const dir = path.join(ROOT, 'assets/img/products'); const f = fs.readdirSync(dir).find((x) => x.endsWith('.webp')); return { name: 'counter-shot.webp', mimeType: 'image/webp', buffer: fs.readFileSync(path.join(dir, f)) }; })();
const pinned = ctx.window.AA_CATALOG.items.filter((i) => /glock/i.test(i.name) && i.id !== sample.id).slice(-1)[0];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|401 \(Unauthorized\)/.test(m.text())) errors.push(m.text()); });
page.on('dialog', (d) => { errors.push(`unexpected dialog: ${d.message()}`); d.dismiss(); });
await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `ops-${n}.png`) }); };

try {
  await page.goto(BASE + '/ops.html', { waitUntil: 'networkidle' });
  ok(await page.isVisible('#gateForm'), 'gate shows the passcode form');
  await page.fill('#gateKey', 'wrong-passcode');
  await page.click('#gateGo');
  await page.waitForSelector('#gateMsg.bad');
  ok(/Wrong passcode/.test(await page.textContent('#gateMsg')), 'a wrong passcode is reported');
  await shot('gate');
  await page.fill('#gateKey', 'ui-test-passcode');
  await page.click('#gateGo');
  await page.waitForSelector('#shell:not([hidden]) .ops-tile', { timeout: 30000 });
  ok(!(await page.evaluate(() => sessionStorage.getItem('aa-ops-token') || '')).includes('ui-test'), 'the passcode is not kept in the browser (a token is)');
  ok(/Products on the site/.test(await page.textContent('#view')), 'Deck renders');
  await page.waitForTimeout(800);
  await shot('deck');

  // inventory: search, feature, price
  await page.click('a[data-tab="inventory"]');
  await page.waitForSelector('#invTable tbody tr');
  await page.fill('#invQ', sample.id);
  await page.waitForFunction(() => document.querySelectorAll('#invTable tbody tr[data-id]').length === 1);
  await page.click('#invTable [data-flag="featured"]');
  ok((await page.getAttribute('#invTable [data-flag="featured"]', 'aria-pressed')) === 'true', 'featured toggles');
  await page.fill('#invTable [data-price]', String(sample.price + 10));
  await page.press('#invTable [data-price]', 'Enter');
  await page.locator('#invTable [data-price]').blur();
  await page.waitForTimeout(200);
  ok(/1 product/.test(await page.textContent('#pendingText')), 'the publish bar counts the staged product');
  // editor
  await page.click('#invTable [data-edit]');
  await page.waitForSelector('#drawer[open]');
  await page.fill('#drawer input[name="lore"]', 'Standard issue below the ice.');
  await page.waitForFunction(() => { const t = document.querySelector('#drawer textarea[name="desc"]'); return t && t.placeholder !== 'Loading the current description…'; });
  await shot('editor');
  await page.click('#edSave');
  ok(!(await page.isVisible('#drawer[open]')), 'the editor closes on save');
  await page.fill('#invQ', '');
  await page.selectOption('#invFlag', 'staged');
  await page.waitForTimeout(300);
  ok((await page.locator('#invTable tbody tr[data-id]').count()) === 1, 'the staged filter shows the edited product');
  await page.selectOption('#invFlag', '');
  await page.waitForTimeout(300);
  await shot('inventory');

  // every tab renders
  const TABS = await page.$$eval('#tabs a[data-tab]', (as) => as.map((a) => a.dataset.tab));
  ok(TABS.length === 14, `14 tabs in the rail (${TABS.join(', ')})`);
  for (const t of TABS) {
    await page.click(`a[data-tab="${t}"]`);
    await page.waitForTimeout(450);
    ok((await page.textContent('#view')).trim().length > 40 && (await page.textContent('#tabTitle')).trim(), `${t} renders`);
    await shot(t);
  }

  // a notice
  await page.click('a[data-tab="store"]');
  await page.click('#noticeAdd');
  await page.fill('#noticeRows [data-n="text"]', 'Closed Thanksgiving Day — open Friday 10 to 6');
  await page.selectOption('#noticeRows [data-n="tone"]', 'alert');
  await page.click('#noticeSave');
  ok(/notices/.test(await page.textContent('#pendingText')), 'the notice is staged');
  await shot('store');

  // publish
  await page.click('#publishBtn');
  await page.fill('#pubBy', 'Test');
  await page.click('#pubGo');
  await page.waitForSelector('#pubProg [data-s="commit"].done', { timeout: 15000 });
  const ov = JSON.parse(gh.files()['assets/data/overrides.json']);
  const settings = JSON.parse(gh.files()['assets/data/site-settings.json']);
  ok(ov[sample.id] && ov[sample.id].featured === true && ov[sample.id].price === sample.price + 10 && ov[sample.id].lore === 'Standard issue below the ice.', 'publish: the product edits are in the commit');
  ok(settings.notices && settings.notices[0].tone === 'alert', 'publish: the notice is in the commit');
  ok(/Ops Console: 1 product\(s\), notices \(Test\)/.test(gh.commits[gh.commits.length - 1]), 'publish: one commit for everything');
  ok(await page.isHidden('#publishBar'), 'the publish bar clears');
  await shot('publish');
  await page.keyboard.press('Escape');

  // inbox: the hostile name stays text
  await page.click('a[data-tab="inbox"]');
  await page.waitForSelector('.ops-msg');
  await page.click('.ops-msg');
  ok((await page.textContent('#ibRead h3')) === 'Ada <b>Byrd</b>' && !(await page.$('#ibRead h3 b')), 'inbox: names are shown as text, never markup');
  await page.click('#ibRead [data-status="holding"]');
  await page.waitForSelector('#ibRead [data-status="holding"].btn-ice');
  ok(true, 'inbox: status changes');
  await shot('inbox');

  // orders: the hostile billing name stays text; the release shows; the detail drawer
  await page.click('a[data-tab="orders"]');
  await page.waitForSelector('#ordList .ops-table tbody tr');
  ok(!(await page.$('#ordList .ops-table img')) && /<img src=x/.test(await page.textContent('#ordList .ops-table')), 'orders: a hostile customer name is text, not an image tag');
  ok(/Ship to an FFL dealer/.test(await page.textContent('#ordList')), 'orders: the firearm column shows the release');
  await page.waitForFunction(() => /\$96\.00|96\.00/.test((document.querySelector('#ordTop') || {}).textContent));
  ok(true, 'orders: the 30-day sales summary renders');
  await page.click('#ordList [data-ord="0"]');
  await page.waitForSelector('#drawer[open]');
  ok(/Gulf Coast Arms/.test(await page.textContent('#drawer')) && /ada@example\.com/.test(await page.textContent('#drawer')), 'orders: the detail shows the receiving FFL and the customer');
  await shot('order-detail');
  await page.keyboard.press('Escape');

  // ---------------- the second round: photos, a listing, pins, spotlight -------------
  // the editor: upload a photo, condition, video, search terms
  await page.click('a[data-tab="inventory"]');
  await page.fill('#invQ', sample.id);
  await page.waitForFunction(() => document.querySelectorAll('#invTable tbody tr[data-id]').length === 1);
  await page.click('#invTable [data-edit]');
  await page.waitForSelector('#drawer[open] #edPhotos');
  const before = await page.locator('#edPhotos .ops-ph').count();
  await page.setInputFiles('#edPhotos input[type=file]', PHOTO);
  await page.waitForFunction((n) => document.querySelectorAll('#edPhotos .ops-ph').length === n + 1, before);
  ok(await page.$('#edPhotos .ops-ph:last-child img[src^="data:image/"]'), 'editor: the upload shows straight away (resized in the browser)');
  await page.click(`#edPhotos [data-ph="left"][data-i="${before}"]`);
  ok(await page.$(`#edPhotos .ops-ph:nth-child(${before}) img[src^="data:image/"]`), 'editor: photos reorder');
  await page.selectOption('#drawer select[name="cond"]', 'Demo');
  await page.fill('#drawer input[name="video"]', 'https://youtu.be/dQw4w9WgXcQ');
  await page.fill('#drawer input[name="keywords"]', 'g19 compact carry');
  await page.click('#edSave');
  ok(!(await page.isVisible('#drawer[open]')), 'editor: saved with a photo');
  ok(/1 product · 1 new photo/.test(await page.textContent('#pendingText')), 'the publish bar counts the new photo');

  // your listings
  await page.click('a[data-tab="listings"]');
  await page.click('#lstAdd');
  await page.waitForSelector('#drawer[open] #lsForm');
  await page.fill('#lsForm input[name="name"]', 'Glock 19 Gen 3 — police trade-in');
  await page.selectOption('#lsForm select[name="dept"]', 'sidearms');
  await page.fill('#lsForm input[name="price"]', '$429.00');
  await page.selectOption('#lsForm select[name="cond"]', 'Consignment');
  await page.fill('#lsForm input[name="sku"]', 'TI-0042');
  await page.fill('#lsForm textarea[name="desc"]', 'Holster wear, two mags.');
  await page.setInputFiles('#lsPhotos input[type=file]', PHOTO);
  await page.waitForSelector('#lsPhotos .ops-ph img[src^="data:image/"]');
  await page.click('#lsSave');
  await page.waitForSelector('#view tr.staged [data-open]');
  ok(/police trade-in/.test(await page.textContent('#view')) && /Consignment/.test(await page.textContent('#view')), 'listings: the new listing is staged with its condition');
  ok(/1 listing/.test(await page.textContent('#pendingText')), 'the publish bar counts the listing');
  await shot('listings');

  // search: the log, a pin
  await page.click('a[data-tab="search"]');
  await page.waitForFunction(() => /glock 19/.test((document.querySelector('#srTop') || {}).textContent));
  ok(/2×/.test(await page.textContent('#srTop')), 'search: top searches with counts');
  ok(/hyperborean blaster/.test(await page.textContent('#srZero')) && !/glock 19/.test(await page.textContent('#srZero')), 'search: dead ends list only searches that found nothing');
  await page.click('#pinAdd');
  await page.fill('#pinRows [data-p="q"]', 'Glock');
  await page.click('#pinRows [data-p="ids"]');
  await page.keyboard.type(pinned.id);
  ok(await page.evaluate(() => document.activeElement && document.activeElement.dataset.p === 'ids'), 'search: typing a pin keeps the cursor in the box');
  ok((await page.textContent('#pinRows')).includes(pinned.name), 'search: a pinned id resolves to its product');
  await page.click('#pinSave');
  ok(/search pins/.test(await page.textContent('#pendingText')), 'search: pins staged');
  await shot('search');

  // spotlight
  await page.click('a[data-tab="spotlight"]');
  await page.click('#spAdd');
  await page.fill('#spRows [data-s="title"]', 'Holiday hours');
  await page.locator('#spRows [data-s="title"]').dispatchEvent('change');
  await page.fill('#spRows [data-s="text"]', 'Open late every Friday in December.');
  await page.locator('#spRows [data-s="text"]').dispatchEvent('change');
  await page.fill('#spRows [data-s="link"]', '/contact.html');
  await page.locator('#spRows [data-s="link"]').dispatchEvent('change');
  await page.setInputFiles('#spRows input[data-sp="up"]', PHOTO);
  await page.waitForSelector('#spRows .ops-thumb img[src^="data:image/"]');
  ok(/Holiday hours/.test(await page.textContent('#spPrev h2')) && await page.$('#spPrev img[src^="data:image/"]'), 'spotlight: the preview shows the slide and its photo');
  await page.click('#spSave');
  ok(/spotlight/.test(await page.textContent('#pendingText')), 'spotlight: staged');
  await shot('spotlight');

  // review lists everything
  await page.click('#reviewBtn');
  const rv = await page.textContent('#modal');
  ok(/Your listings/.test(rv) && /police trade-in/.test(rv) && /New photos/.test(rv) && /Search pins/.test(rv) && /Spotlight/.test(rv), 'review: products, listings, photos and settings listed');
  await page.keyboard.press('Escape');

  // publish round two
  const n0 = gh.commits.length;
  await page.click('#publishBtn');
  await page.click('#pubGo');
  await page.waitForSelector('#pubProg [data-s="commit"].done', { timeout: 20000 });
  ok(gh.commits.length === n0 + 1, 'publish 2: one commit');
  const ov2 = JSON.parse(gh.files()['assets/data/overrides.json'])[sample.id] || {};
  const upl = (ov2.images || []).find((x) => /\/u-/.test(x));
  ok(upl && /^assets\/img\/products\/u-[a-z0-9-]+-[0-9a-f]{8}\.(webp|jpg)$/.test(upl) && ov2.cond === 'Demo' && ov2.video === 'dQw4w9WgXcQ' && ov2.keywords === 'g19 compact carry' && ov2.featured === true, 'publish 2: the product has its uploaded photo, condition, video and terms (earlier edits kept)');
  const bytes = upl && gh.bytes(upl);
  ok(bytes && bytes.length > 500 && ((bytes.slice(0, 4).toString() === 'RIFF' && bytes.slice(8, 12).toString() === 'WEBP') || (bytes[0] === 0xff && bytes[1] === 0xd8)), 'publish 2: the photo file is in the repo as a real image');
  const cust = JSON.parse(gh.files()['assets/data/custom-products.json'] || '[]');
  ok(cust.length === 1 && cust[0].price === 429 && cust[0].cond === 'Consignment' && cust[0].sku === 'TI-0042' && /^c-glock-19-gen-3/.test(cust[0].id) && gh.bytes(cust[0].images[0]), 'publish 2: the listing and its photo are in the repo');
  const st2 = JSON.parse(gh.files()['assets/data/site-settings.json']);
  ok(st2.pins && st2.pins.glock && st2.pins.glock[0] === pinned.id && st2.spotlight.slides[0].title === 'Holiday hours' && gh.bytes(st2.spotlight.slides[0].image) && st2.notices[0].tone === 'alert', 'publish 2: pins and the spotlight (with its photo) saved, the notice kept');
  ok(/1 product\(s\), 1 listing\(s\), 3 photo\(s\), pins \+ spotlight/.test(gh.commits[gh.commits.length - 1]), 'publish 2: the commit message lists it all');
  ok(await page.isHidden('#publishBar') && (await page.evaluate(() => sessionStorage.getItem('aa-ops-uploads'))) === null, 'publish 2: the stage and the held photos clear');
  await page.keyboard.press('Escape');
  await page.click('a[data-tab="listings"]');
  await page.waitForTimeout(300);
  ok(/police trade-in/.test(await page.textContent('#view')) && !(await page.$('#view tr.staged')), 'listings: the published listing stays, no longer staged');

  // history
  await page.click('a[data-tab="history"]');
  await page.waitForFunction(() => document.querySelectorAll('#view .ops-list li a').length >= 2);
  ok(/listings/.test(await page.textContent('#view')) && /Ops Console/.test(await page.textContent('#view')), 'history: both publishes listed with the files they changed');
  await shot('history');

  // tools: the site check and the test email
  await page.click('a[data-tab="tools"]');
  await page.click('#chkGo');
  await page.waitForFunction(() => ((t) => /WooCommerce/.test(t) && !/…/.test(t))((document.querySelector('#chkOut') || {}).textContent || ''), null, { timeout: 60000 });
  const chk = await page.textContent('#chkOut');
  ok(/1\.2\.0/.test(chk), 'site check: sees the Agarthan theme (and its version) on the store');
  ok(/Product photos/i.test(chk) || /photo/i.test(chk), 'site check: samples product photos');
  const fixes = await page.$$eval('#chkOut li', (ls) => ls.filter((l) => /FIX/.test(l.textContent)).map((l) => l.textContent.replace(/\s+/g, ' ').trim()));
  ok(fixes.every((f) => /Published store settings|deploy/i.test(f)), `site check: nothing else to fix (${fixes.join(' | ')})`);
  await shot('site-check');
  const m0 = mail.sent.length;
  await page.click('#mailGo');
  await page.waitForFunction(() => /sent|Sent/.test((document.querySelector('#toast') || {}).textContent));
  ok(mail.sent.length === m0 + 1 && mail.sent[m0].to[0] === 'store@example.com', 'tools: the test email is delivered');

  // data gaps jump to a filtered inventory
  await page.click('a[data-tab="photos"]');
  await page.click('[data-gap]');
  await page.waitForSelector('#invTable');
  ok((await page.evaluate(() => location.hash)) === '#inventory', 'gaps: a tile opens Inventory, filtered');

  // discard clears staged edits and held photos
  for (const sel of ['#invDept', '#invStatus', '#invPhoto', '#invFlag']) await page.selectOption(sel, '');
  await page.fill('#invBrand', ''); await page.locator('#invBrand').dispatchEvent('input');
  await page.fill('#invQ', sample.id);
  await page.waitForFunction(() => document.querySelectorAll('#invTable tbody tr[data-id]').length === 1);
  await page.click('#invTable [data-edit]');
  await page.waitForSelector('#drawer[open] #edPhotos');
  await page.setInputFiles('#edPhotos input[type=file]', PHOTO);
  await page.waitForFunction(() => document.querySelectorAll('#edPhotos img[src^="data:image/"]').length >= 1);
  await page.click('#edSave');
  ok(!!(await page.evaluate(() => sessionStorage.getItem('aa-ops-uploads'))), 'a picked photo is held for the session');
  await page.click('#discardBtn');
  await page.click('#discardYes');
  ok(await page.isHidden('#publishBar') && (await page.evaluate(() => sessionStorage.getItem('aa-ops-uploads'))) === null, 'discard: the stage and the held photos are gone');

  // a staged photo whose upload is not in this browser blocks publishing
  await page.evaluate((id) => localStorage.setItem('aa-ops-stage', JSON.stringify({ products: { [id]: { images: ['assets/img/products/u-ghost-0a1b2c3d.webp'] } }, settings: {}, custom: { upsert: {}, remove: [] } })), sample.id);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#shell:not([hidden]) #publishBar:not([hidden])', { timeout: 30000 });
  const nGuard = gh.commits.length;
  await page.click('#publishBtn');
  await page.waitForSelector('#modal[open]');
  ok(/another tab or browser/.test(await page.textContent('#modal')) && !(await page.$('#pubGo')) && gh.commits.length === nGuard, 'guard: a photo held in another tab is flagged, nothing published');
  await page.keyboard.press('Escape');
  await page.click('#discardBtn'); await page.click('#discardYes');

  // phone width
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('a[data-tab="inventory"]');
  await page.waitForTimeout(400);
  const wide = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 && !e.closest('.ops-tablewrap, .ops-tabs'); }).slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${Math.round(e.getBoundingClientRect().right)}`));
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `phone: no sideways scroll on the page (${wide.join(', ')})`);
  await shot('phone');

  const csp = await page.evaluate(() => window.__csp);
  ok(!csp.length, `no CSP violations (${csp.join('; ')})`);
  ok(!errors.length, `no script errors (${errors.join(' | ')})`);

  // ---------------- the storefront with what was just published -------------
  // the published settings and a product edit, as they will be served after the deploy
  const site = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const siteErr = [];
  site.on('pageerror', (e) => siteErr.push(e.message));
  await site.addInitScript(() => { try { localStorage.setItem('aa-age-ok', String(Date.now())); } catch { /* */ } });
  await site.route('**/assets/js/config.js*', async (route) => {
    const r = await route.fetch(); const body = await r.text();
    const add = { pins: st2.pins, spotlight: { interval: 30, slides: [{ id: 'a', on: true, title: 'Holiday hours', text: 'Open late', link: '/contact.html', cta: 'See hours', image: sample.images[0] }, { id: 'b', on: true, title: 'Range day', video: 'dQw4w9WgXcQ' }, { id: 'c', on: true, title: 'Expired', end: '2020-01-01' }] } };
    route.fulfill({ response: r, body: `${body}\n;Object.assign(window.AA_CONFIG, ${JSON.stringify(add)});` });
  });
  await site.route('**/assets/data/catalog.js*', async (route) => {
    const r = await route.fetch(); const body = await r.text();
    route.fulfill({ response: r, body: `${body}\n;(function(){var it=window.AA_CATALOG.items.find(function(i){return i.id===${JSON.stringify(sample.id)}});it.cond='Demo';it.video='dQw4w9WgXcQ';it.kw='zzqx-unique-term';})();` });
  });
  await site.route(/i\.ytimg\.com|youtube-nocookie\.com/, (route) => route.fulfill({ status: 204, body: '' }));
  await site.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await site.waitForSelector('#spotlight:not([hidden]) .sp-slide', { timeout: 15000 });
  const titles = await site.$$eval('#spotlight .sp-slide h2, #spotlight .sp-slide h3', (h) => h.map((x) => x.textContent.trim()));
  ok(titles.includes('Holiday hours') && titles.includes('Range day') && !titles.includes('Expired'), `storefront: the Spotlight shows the live slides, not the expired one (${titles.join(', ')})`);
  ok((await site.$$('#spotlight [aria-label*="lide"], #spotlight .sp-dots button')).length >= 2, 'storefront: Spotlight has controls for two slides');
  if (SHOTS) await site.locator('#spotlight').screenshot({ path: path.join(SHOTS, 'site-spotlight.png') });
  await site.setViewportSize({ width: 390, height: 844 });
  await site.waitForTimeout(300);
  ok(await site.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'storefront: the Spotlight fits a phone (no sideways scroll)');
  if (SHOTS) await site.locator('#spotlight').screenshot({ path: path.join(SHOTS, 'site-spotlight-phone.png') });
  await site.setViewportSize({ width: 1366, height: 900 });
  await site.goto(BASE + '/armory.html?q=glock', { waitUntil: 'networkidle' });
  await site.waitForSelector('[data-id]');
  const first = await site.$eval('#grid [data-id], .grid [data-id], [data-id]', (e) => e.dataset.id);
  ok(first === pinned.id, `storefront: the pinned product comes first for "glock" (${first})`);
  await site.goto(BASE + '/armory.html?q=zzqx-unique-term', { waitUntil: 'networkidle' });
  await site.waitForSelector('[data-id]');
  ok((await site.$$eval('[data-id]', (e) => [...new Set(e.map((x) => x.dataset.id))])).includes(sample.id), 'storefront: search terms find the product');
  ok(/Demo/.test(await site.textContent('.cond-badge')), 'storefront: the condition badge is on the card');
  await site.click(`[data-id="${sample.id}"] a.card-link`);
  await site.waitForSelector('#detailInner .yt-play', { timeout: 10000 });
  ok(/Demo/.test(await site.textContent('#detailTitle')), 'storefront: the condition badge is in the product view');
  await site.click('#detailInner .yt-play');
  ok(/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test(await site.getAttribute('#detailInner iframe', 'src') || ''), 'storefront: the video plays in place (privacy-enhanced YouTube)');
  if (SHOTS) await site.screenshot({ path: path.join(SHOTS, 'site-detail.png') });
  // the header at every width: nothing runs off the screen, the menu button is reachable on phones,
  // and the closed phone menu neither widens the page nor takes keyboard focus
  const hdrBad = [];
  for (let w = 320; w <= 1440; w += 20) {
    await site.setViewportSize({ width: w, height: 800 });
    const r = await site.evaluate(() => {
      const q = (x) => document.querySelector('.site-header ' + x); const rr = (e) => e.getBoundingClientRect();
      const shown = ['.brand', '.nav-links', '.req-btn', '.prefs-btn', '.menu-btn'].map(q).filter((e) => e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).position !== 'fixed');
      return { sw: document.documentElement.scrollWidth, off: shown.filter((e) => rr(e).right > innerWidth + 0.5).map((e) => e.className.split(' ')[0]) };
    });
    if (r.sw > w || r.off.length) hdrBad.push(`${w}px ${JSON.stringify(r)}`);
  }
  ok(!hdrBad.length, `storefront: the header fits from 320 to 1440px (${hdrBad.slice(0, 3).join(' · ')})`);
  await site.setViewportSize({ width: 390, height: 844 });
  await site.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  ok(await site.evaluate(() => getComputedStyle(document.querySelector('.nav-links')).visibility === 'hidden'), 'phone: the closed menu is hidden (its links cannot be tabbed into)');
  await site.click('.menu-btn');
  await site.waitForTimeout(400);
  ok(await site.isVisible('.nav-links a[href="transfers.html"]') && (await site.getAttribute('.menu-btn', 'aria-expanded')) === 'true', 'phone: the menu button opens the menu');
  const menuBox = await site.evaluate(() => { const r = document.querySelector('.nav-links').getBoundingClientRect(); const hb = document.querySelector('.site-header').getBoundingClientRect().bottom; return { top: r.top - hb, bottom: innerHeight - r.bottom, h: r.height, links: [...document.querySelectorAll('.nav-links a')].every((a) => { const b = a.getBoundingClientRect(); return b.height > 0 && b.bottom <= innerHeight; }) }; });
  ok(Math.abs(menuBox.top) <= 1 && Math.abs(menuBox.bottom) <= 1 && menuBox.links, `phone: the menu fills the screen under the header, every link on screen (${JSON.stringify(menuBox)})`);
  await site.click('.menu-btn'); await site.waitForTimeout(350);
  await site.mouse.wheel(0, 1600); await site.waitForTimeout(300);
  await site.click('.menu-btn'); await site.waitForTimeout(400);
  const scrolledBox = await site.evaluate(() => Math.round(document.querySelector('.nav-links').getBoundingClientRect().top - document.querySelector('.site-header').getBoundingClientRect().bottom));
  ok(Math.abs(scrolledBox) <= 1, `phone: scrolled down, the menu still hangs from the header (${scrolledBox}px)`);
  if (SHOTS) await site.screenshot({ path: path.join(SHOTS, 'site-phone-menu.png') });
  await site.click('.nav-links a[href="transfers.html"]');
  await site.waitForURL(/transfers\.html/);
  ok(true, 'phone: a menu link navigates');
  ok(!siteErr.length, `storefront: no script errors (${siteErr.join(' | ')})`);
} catch (e) {
  fail++; console.log('✗ crashed:', e.message.split('\n')[0]);
  await shot('crash');
  if (SHOTS) for (const pg of browser.contexts().flatMap((c) => c.pages())) if (pg !== page) await pg.screenshot({ path: path.join(SHOTS, 'crash-site.png') }).catch(() => {});
} finally {
  await browser.close(); srv.kill(); gh.close(); woo.close(); mail.close();
}
console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
