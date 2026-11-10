/* test-ops-ui.mjs — the Ops Console in a real browser, against the real
 * server and a stand-in GitHub / WooCommerce: unlock, every tab renders,
 * inventory edits stage, the editor, a notice, publish → the commit lands,
 * the inbox, orders (a hostile customer name stays text), and no script
 * errors or CSP violations anywhere. Needs Playwright.
 * Run: node scripts/test-ops-ui.mjs [--shots dir] */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mockGitHub, mockWoo } from './lib-mock-github.mjs';

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
const PORT = 4800 + Math.floor(Math.random() * 400);
const srv = spawn(process.execPath, [path.join(ROOT, 'server.mjs')], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: {
  ...process.env, PORT: String(PORT), OPS_PASSWORD: 'ui-test-passcode', DATA_DIR: mkdtempSync(path.join(tmpdir(), 'ops-ui-')),
  GH_TOKEN: gh.token, GH_REPO: gh.repo, GH_API: gh.url, WOO_URL: woo.url, WOO_CK: woo.ck, WOO_CS: woo.cs, RENDER_GIT_COMMIT: 'b'.repeat(40),
} });
let log = ''; srv.stdout.on('data', (d) => (log += d)); srv.stderr.on('data', (d) => (log += d));
await new Promise((r) => { const i = setInterval(() => { if (log.includes('http://')) { clearInterval(i); r(); } }, 50); });
const BASE = `http://127.0.0.1:${PORT}`;
await fetch(BASE + '/api/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'requisition', name: 'Ada <b>Byrd</b>', contact: '(954) 555-0142', note: 'Hold it please', items: ['1 × Glock 19'] }) });

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

  // the other tabs render
  for (const t of ['photos', 'corrections', 'traffic', 'tools']) {
    await page.click(`a[data-tab="${t}"]`);
    await page.waitForTimeout(500);
    ok((await page.textContent('#view')).trim().length > 40, `${t} renders`);
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

  // orders: the hostile billing name stays text
  await page.click('a[data-tab="orders"]');
  await page.waitForSelector('.ops-table tbody tr');
  ok(!(await page.$('.ops-table img')) && /<img src=x/.test(await page.textContent('.ops-table')), 'orders: a hostile customer name is text, not an image tag');
  await shot('orders');

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
} catch (e) {
  fail++; console.log('✗ crashed:', e.message.split('\n')[0]);
  await shot('crash');
} finally {
  await browser.close(); srv.kill(); gh.close(); woo.close();
}
console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
