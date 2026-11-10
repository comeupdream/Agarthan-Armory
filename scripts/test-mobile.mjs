/* test-mobile.mjs — the Armory and the site on phones and tablets (the PAMAX
 * mobile fixes, ported): products on the first screen, departments in one
 * swipeable row, the filters as a bottom sheet behind a button that names
 * them (Clear beside it, a "Show N" button inside), two products per row with
 * prices aligned, back to top, and filter or page changes landing on the
 * results below the sticky header. Desktop keeps its sidebar. No sideways
 * scroll on any page, no script errors. Needs Playwright.
 * Run: node scripts/test-mobile.mjs [--shots dir] */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log(`✗ ${msg}`); } };

const PORT = 4600 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, [path.join(ROOT, 'server.mjs')], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(PORT), OPS_PASSWORD: '' } });
let log = ''; srv.stdout.on('data', (d) => (log += d)); srv.stderr.on('data', (d) => (log += d));
await new Promise((r) => { const i = setInterval(() => { if (log.includes('http://')) { clearInterval(i); r(); } }, 50); });
const BASE = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch();
const errors = [];
const page = async (w, h) => {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => errors.push(`${w}px: ${e.message}`));
  await p.addInitScript(() => { try { localStorage.setItem('aa-age-ok', String(Date.now())); localStorage.removeItem('aa-per'); } catch { /* */ } });
  return p;
};
const settle = (p, ms = 450) => p.waitForTimeout(ms);
const headerBottom = (p) => p.evaluate(() => document.querySelector('.site-header').getBoundingClientRect().bottom);
const top = (p, sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);

try {
  for (const [w, h] of [[390, 844], [360, 740]]) {
    const p = await page(w, h);
    // no sideways scroll anywhere
    for (const pg of ['index.html', 'armory.html', 'transfers.html', '404.html']) {
      await p.goto(`${BASE}/${pg}`, { waitUntil: 'networkidle' }); await settle(p, 300);
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}px ${pg}: no sideways scroll`);
    }
    await p.goto(`${BASE}/armory.html`, { waitUntil: 'networkidle' }); await settle(p);
    const m = await p.evaluate(() => {
      const cards = [...document.querySelectorAll('#armoryGrid .card')];
      const row = document.querySelector('#deptRow');
      return { cols: getComputedStyle(document.querySelector('#armoryGrid')).gridTemplateColumns.split(' ').length,
        firstTop: cards[0].getBoundingClientRect().top, fullInView: cards.filter((c) => c.getBoundingClientRect().bottom <= innerHeight).length,
        rowH: row.getBoundingClientRect().height, rowSwipes: row.scrollWidth > row.clientWidth,
        panelHidden: getComputedStyle(document.querySelector('#filtersPanel')).visibility === 'hidden', fbar: getComputedStyle(document.querySelector('.fbar')).display !== 'none' };
    });
    ok(m.cols === 2, `${w}px: two products per row (${m.cols})`);
    ok(m.firstTop < h * 0.7 && m.fullInView >= 2, `${w}px: products on the first screen (first at ${Math.round(m.firstTop)}px, ${m.fullInView} whole)`);
    ok(m.rowH < 60 && m.rowSwipes, `${w}px: departments in one swipeable row (${Math.round(m.rowH)}px tall)`);
    ok(m.panelHidden && m.fbar, `${w}px: the filters wait behind the Filters button`);
    // a row of cards: names clamped, prices on one line
    const rows = await p.evaluate(() => {
      const cards = [...document.querySelectorAll('#armoryGrid .card')].slice(0, 16);
      const byRow = new Map();
      for (const c of cards) { const t = Math.round(c.getBoundingClientRect().top); if (!byRow.has(t)) byRow.set(t, []); byRow.get(t).push(Math.round(c.querySelector('.card-foot').getBoundingClientRect().bottom)); }
      const lh = parseFloat(getComputedStyle(cards[0].querySelector('h3')).lineHeight);
      return { aligned: [...byRow.values()].every((f) => Math.max(...f) - Math.min(...f) <= 1), clamped: cards.every((c) => c.querySelector('h3').getBoundingClientRect().height <= lh * 3 + 2) };
    });
    ok(rows.aligned && rows.clamped, `${w}px: names clamp to three lines and prices line up across each row`);
    if (SHOTS && w === 390) await p.screenshot({ path: path.join(SHOTS, 'mobile-armory.png') });

    // the sheet
    await p.click('#deptRow [data-dept="sidearms"]'); await settle(p);
    ok((await p.textContent('#fNow')) === 'Sidearms' && await p.isVisible('#fClear'), `${w}px: the Filters button names the department; Clear appears`);
    await p.click('#fOpen'); await settle(p);
    const open = await p.evaluate(() => ({ vis: getComputedStyle(document.querySelector('#filtersPanel')).visibility, locked: document.body.classList.contains('sheet-open'),
      scrim: !document.querySelector('#fScrim').hidden, toTop: getComputedStyle(document.querySelector('.to-top')).display,
      subCols: getComputedStyle(document.querySelector('#subChips')).gridTemplateColumns.split(' ').length, expanded: document.querySelector('#fOpen').getAttribute('aria-expanded'),
      footIn: document.querySelector('#fApply').getBoundingClientRect().bottom <= innerHeight }));
    ok(open.vis === 'visible' && open.locked && open.scrim && open.expanded === 'true', `${w}px: Filters opens the sheet over a dimmed page`);
    ok(open.subCols === 2 && open.footIn, `${w}px: categories two to a row; the Show button stays on screen`);
    ok(open.toTop === 'none', `${w}px: back-to-top steps aside while the sheet is open`);
    if (SHOTS && w === 390) await p.screenshot({ path: path.join(SHOTS, 'mobile-sheet.png') });
    await p.click('#subChips [data-sub="Revolvers"]'); await settle(p, 250);
    ok(/^Show [\d,]+ relics$/.test(await p.textContent('#fApply')), `${w}px: the sheet's button says how many will show`);
    await p.click('#fApply'); await settle(p);
    ok((await p.textContent('#fNow')) === 'Sidearms · Revolvers' && !(await p.evaluate(() => document.body.classList.contains('sheet-open'))), `${w}px: Show closes the sheet; the button names the category`);
    ok((await p.$$eval('#armoryGrid .card', (cs) => cs.every((c) => /revolver/i.test(c.querySelector('.card-top').textContent)))), `${w}px: the grid shows the category picked in the sheet`);
    // Escape and the scrim close it too
    await p.click('#fOpen'); await settle(p, 350); await p.keyboard.press('Escape'); await settle(p, 350);
    ok(!(await p.evaluate(() => document.body.classList.contains('sheet-open'))), `${w}px: Escape closes the sheet`);
    await p.click('#fOpen'); await settle(p, 350); await p.mouse.click(w / 2, 40); await settle(p, 350);
    ok(!(await p.evaluate(() => document.body.classList.contains('sheet-open'))), `${w}px: a tap on the dimmed page closes it`);
    // filtering from deep down lands on the results, under the sticky header
    await p.click('#fClear'); await settle(p);
    ok((await p.textContent('#fNow')) === 'Everything' && !(await p.isVisible('#fClear')), `${w}px: Clear resets to everything`);
    // (pressed in the page: a test click would first scroll the button into view)
    await p.evaluate(() => scrollTo(0, 3200)); await settle(p, 300);
    await p.evaluate(() => document.querySelector('#fOpen').click()); await settle(p, 350);
    ok(await p.evaluate(() => scrollY > 3000), `${w}px: opening the sheet keeps the page where it was`);
    await p.evaluate(() => document.querySelector('#inStock').click()); await settle(p, 250);
    await p.evaluate(() => document.querySelector('#fApply').click()); await settle(p, 1200);
    let hb = await headerBottom(p), t = await top(p, '.fbar');
    ok(t >= hb - 1 && t <= hb + 40, `${w}px: a filter set from deep down lands on the results under the header (bar at ${Math.round(t)}, header ends ${Math.round(hb)})`);
    // back to top
    await p.evaluate(() => scrollTo(0, 0)); await settle(p, 300);
    ok(!(await p.isVisible('.to-top.show')), `${w}px: no back-to-top at the top`);
    await p.evaluate(() => scrollTo(0, innerHeight * 2.2)); await settle(p, 400);
    ok(await p.isVisible('.to-top.show'), `${w}px: back-to-top appears after a screen and a half`);
    if (SHOTS && w === 390) await p.screenshot({ path: path.join(SHOTS, 'mobile-totop.png') });
    // a new page from the pager at the bottom lands on the top of the results
    await p.evaluate(() => document.querySelector('.pager').scrollIntoView({ block: 'end' })); await settle(p, 300);
    await p.evaluate(() => [...document.querySelectorAll('.pager .pg-step')].pop().click()); await settle(p, 1200);
    hb = await headerBottom(p); t = await top(p, '.fbar');
    ok(t >= hb - 1 && t <= hb + 40 && /page=2/.test(p.url()), `${w}px: the next page lands on the top of the results (bar at ${Math.round(t)}, header ends ${Math.round(hb)})`);
    await p.evaluate(() => scrollTo(0, innerHeight * 2.2)); await settle(p, 400);
    await p.click('.to-top'); await p.waitForFunction(() => scrollY < 2, null, { timeout: 4000 }).catch(() => {});
    ok(await p.evaluate(() => scrollY < 2), `${w}px: back-to-top goes to the top`);
    // the home page has it too
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' }); await p.evaluate(() => scrollTo(0, innerHeight * 3)); await settle(p, 400);
    ok(await p.isVisible('.to-top.show'), `${w}px: back-to-top on the home page too`);
    await p.close();
  }

  // a tablet: the phone navigation, products on the first screen
  {
    const p = await page(768, 1024);
    await p.goto(`${BASE}/armory.html`, { waitUntil: 'networkidle' }); await settle(p);
    const m = await p.evaluate(() => ({ first: document.querySelector('#armoryGrid .card').getBoundingClientRect().top, fbar: getComputedStyle(document.querySelector('.fbar')).display, sw: document.documentElement.scrollWidth }));
    ok(m.first < 1024 * 0.7 && m.fbar !== 'none' && m.sw <= 768, `tablet: products on the first screen, filters behind the button (first at ${Math.round(m.first)}px)`);
    await p.close();
  }
  // desktop is untouched: the sidebar, no sheet furniture, no floating button
  {
    const p = await page(1440, 900);
    await p.goto(`${BASE}/armory.html`, { waitUntil: 'networkidle' }); await settle(p);
    const m = await p.evaluate(() => ({ pos: getComputedStyle(document.querySelector('#filtersPanel')).position, vis: getComputedStyle(document.querySelector('#filtersPanel')).visibility,
      fbar: getComputedStyle(document.querySelector('.fbar')).display, row: getComputedStyle(document.querySelector('#deptRow')).display, head: getComputedStyle(document.querySelector('.fsheet-head')).display,
      cols: getComputedStyle(document.querySelector('#armoryGrid')).gridTemplateColumns.split(' ').length, toTop: getComputedStyle(document.querySelector('.to-top')).display,
      deptsInSidebar: document.querySelectorAll('#deptChips .chip').length }));
    ok(m.pos === 'sticky' && m.vis === 'visible' && m.deptsInSidebar > 3, 'desktop: the filter sidebar as before');
    ok(m.fbar === 'none' && m.row === 'none' && m.head === 'none' && m.toTop === 'none', 'desktop: no phone furniture');
    ok(m.cols >= 3, `desktop: ${m.cols} columns`);
    await p.click('#deptChips [data-dept="optics"]'); await settle(p);
    ok((await p.$$eval('#armoryGrid .card', (cs) => cs.length)) > 0 && /Optics/i.test(await p.textContent('#armoryTitle')), 'desktop: the sidebar departments still filter');
    await p.close();
  }
  ok(!errors.length, `no script errors (${errors.join(' | ')})`);
} catch (e) {
  fail++; console.log('✗ crashed:', e.message.split('\n')[0]);
} finally {
  await browser.close(); srv.kill();
}
console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
