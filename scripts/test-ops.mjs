/* test-ops.mjs — the Ops Console's server: what may be edited, the merge,
 * sign-in, lockout, publishing (against a stand-in GitHub, including a race
 * with another push), photo uploads checked by their bytes, the store's own
 * listings, search pins, the Spotlight, the change history, email alerts
 * (against a stand-in provider), the inbox, traffic and the search log, the
 * read-only WooCommerce proxy and its path check, the theme check, headers,
 * config.js carrying the published settings, and the catalogue build taking
 * the listings and photo edits.
 * Run: node scripts/test-ops.mjs */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockGitHub, mockWoo, mockMail } from './lib-mock-github.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
let pass = 0, fail = 0;
const eq = (got, want, msg) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++; else { fail++; console.log(`✗ ${msg}\n    got  ${g}\n    want ${w}`); }
};
const ok = (cond, msg) => eq(!!cond, true, msg);

/* ------------------------------------------------------------- units */
const E = await import('../server/edits.mjs');
const bad = (fn) => { try { fn(); return null; } catch (e) { return E.isEditError(e) ? e.message : `not an edit error: ${e.message}`; } };
eq(E.validateProductPatch({ 'glock-19': { featured: true, price: 549.999 } }), { 'glock-19': { featured: true, price: 550 } }, 'patch: values cleaned, price rounded to cents');
ok(/not a field/.test(bad(() => E.validateProductPatch({ x: { evil: 1 } }))), 'patch: unknown field refused');
ok(/not a product id/.test(bad(() => E.validateProductPatch({ '../etc': { hide: true } }))), 'patch: odd id refused');
ok(/number from 0/.test(bad(() => E.validateProductPatch({ x: { price: -5 } }))), 'patch: negative price refused');
ok(/one of/.test(bad(() => E.validateProductPatch({ x: { dept: 'snacks' } }))), 'patch: unknown department refused');
ok(/too long/.test(bad(() => E.validateProductPatch({ x: { name: 'x'.repeat(201) } }))), 'patch: overlong name refused');
eq(E.validateProductPatch({ x: { name: 'A\u0000B' } }).x.name, 'AB', 'patch: control characters stripped');
{
  const doc = { _readme: 'keep', a: { noPhoto: true, _photo: 'cut off' }, b: { featured: true }, c: { price: 10 } };
  const sum = E.applyProductPatch(doc, E.validateProductPatch({ a: { noPhoto: false }, b: { featured: false, lore: 'cold' }, c: null, d: { hide: true, _name: 'Gone' } }));
  eq(doc, { _readme: 'keep', b: { lore: 'cold' }, d: { hide: true, _name: 'Gone' } }, 'merge: restore drops the photo note, false clears, null drops the product, others untouched');
  eq(sum.products, 4, 'merge: summary counts products');
}
{
  const doc = { a: { _name: 'x', hide: true } };
  E.applyProductPatch(doc, { a: { hide: false } });
  eq(doc, {}, 'merge: only notes left → the entry goes');
}
eq(E.validateFacts({ phone: '(561) 830-3366', fees: { longGun: 20, nfa: null }, ageMin: 21 }), { phone: '(561) 830-3366', fees: { longGun: 20, nfa: null }, ageMin: 21 }, 'facts: valid ones pass');
ok(/https/.test(bad(() => E.validateFacts({ formEndpoint: 'http://evil.example' }))), 'facts: form endpoint must be https');
ok(/not a store fact/.test(bad(() => E.validateFacts({ ffl: { number: '1' }, adminPassword: 'x' }))), 'facts: unknown key refused');
ok(/seven days/.test(bad(() => E.validateFacts({ hours: [['Mon', '9-5']] }))), 'facts: hours need all 7 days');
ok(/18, 21/.test(bad(() => E.validateFacts({ ageMin: 16 }))), 'facts: age is 18 or 21');
eq(E.validateNotices([{ id: 'a', text: 'Closed', link: '/armory?q=glock', tone: 'alert', start: '2026-11-26', end: '2026-11-26' }])[0].link, '/armory?q=glock', 'notices: a page on this site is a valid link');
ok(/https/.test(bad(() => E.validateNotices([{ text: 'x', link: 'javascript:alert(1)' }]))), 'notices: javascript: links refused');
ok(/https/.test(bad(() => E.validateNotices([{ text: 'x', link: '//evil.example' }]))), 'notices: protocol-relative links refused');
ok(/ends before/.test(bad(() => E.validateNotices([{ text: 'x', start: '2026-12-02', end: '2026-12-01' }]))), 'notices: end before start refused');
eq(E.validateSynonyms([['AR15', 'ar-15', 'ar15']]), [['ar15', 'ar-15']], 'synonyms: lowercased, de-duplicated');
ok(/2 to 12/.test(bad(() => E.validateSynonyms([['solo']]))), 'synonyms: a group needs two words');

// photos, video, condition, search terms on a product
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(24, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(24, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(24, 2)]);
eq(E.validateProductPatch({ x: { images: ['assets/img/products/u-glock-19-0a1b2c3d.webp'], video: 'dQw4w9WgXcQ', cond: 'Used', keywords: 'g19 trade-in' } }).x,
  { images: ['assets/img/products/u-glock-19-0a1b2c3d.webp'], video: 'dQw4w9WgXcQ', cond: 'Used', keywords: 'g19 trade-in' }, 'patch: photos, a video, condition and search terms');
ok(/not a photo on this site/.test(bad(() => E.validateProductPatch({ x: { images: ['https://evil.example/x.webp'] } }))), 'patch: a photo from another site refused');
ok(/not a photo on this site/.test(bad(() => E.validateProductPatch({ x: { images: ['assets/img/products/../../server.mjs'] } }))), 'patch: a ../ photo path refused');
ok(/up to 6/.test(bad(() => E.validateProductPatch({ x: { images: Array(7).fill('assets/img/products/abc.webp') } }))), 'patch: at most six photos');
ok(/YouTube/.test(bad(() => E.validateProductPatch({ x: { video: '<script>' } }))), 'patch: a video is an 11-character YouTube id');
ok(/one of/.test(bad(() => E.validateProductPatch({ x: { cond: 'Stolen' } }))), 'patch: unknown condition refused');
eq(E.validateUploads([{ path: 'assets/img/products/u-a-0a1b2c3d.webp', data: WEBP.toString('base64') }, { path: 'assets/img/uploads/u-b-0a1b2c3d.png', data: PNG.toString('base64') }, { path: 'assets/img/uploads/u-c-0a1b2c3d.jpg', data: JPG.toString('base64') }]).map((u) => u.path),
  ['assets/img/products/u-a-0a1b2c3d.webp', 'assets/img/uploads/u-b-0a1b2c3d.png', 'assets/img/uploads/u-c-0a1b2c3d.jpg'], 'uploads: WebP, PNG and JPEG pass');
ok(/not a WebP, JPEG or PNG/.test(bad(() => E.validateUploads([{ path: 'assets/img/products/u-a-0a1b2c3d.webp', data: PNG.toString('base64') }]))), 'uploads: a PNG named .webp refused (checked by its bytes)');
ok(/not a WebP, JPEG or PNG/.test(bad(() => E.validateUploads([{ path: 'assets/img/uploads/u-a-0a1b2c3d.png', data: Buffer.from('<svg onload=alert(1)>').toString('base64') }]))), 'uploads: markup posing as a photo refused');
ok(/never replace a store photo/.test(bad(() => E.validateUploads([{ path: 'assets/img/products/000c9c4e-ec05-4333-858c-7b2c65298e7a-1.webp', data: WEBP.toString('base64') }]))), 'uploads: cannot overwrite a scraped photo');
ok(/not an allowed photo path/.test(bad(() => E.validateUploads([{ path: 'assets/js/u-site.js', data: WEBP.toString('base64') }]))), 'uploads: only into the photo folders');
ok(/not an allowed photo path/.test(bad(() => E.validateUploads([{ path: 'assets/img/uploads/../../../server.mjs', data: WEBP.toString('base64') }]))), 'uploads: no ../ paths');
ok(/too large/.test(bad(() => E.validateUploads([{ path: 'assets/img/uploads/u-big-0a1b2c3d.webp', data: Buffer.concat([WEBP, Buffer.alloc(1_700_000)]).toString('base64') }]))), 'uploads: over 1.6 MB refused');
ok(/at most 24/.test(bad(() => E.validateUploads(Array(25).fill({ path: 'assets/img/uploads/u-a-0a1b2c3d.webp', data: WEBP.toString('base64') })))), 'uploads: at most 24 per publish');

// the store's own listings
{
  const c = E.validateCustom({ id: 'c-glock-19-gen3-ab12', name: 'Glock 19 Gen 3 — trade-in', dept: 'sidearms', price: 429.999, cond: 'Used', sku: 'TI-0042', _junk: 'dropped', noPhoto: true });
  eq(c, { id: 'c-glock-19-gen3-ab12', name: 'Glock 19 Gen 3 — trade-in', dept: 'sidearms', price: 430, cond: 'Used', sku: 'TI-0042', status: 'in' }, 'listing: cleaned, notes dropped, in stock by default');
  ok(/not a listing id/.test(bad(() => E.validateCustom({ id: 'glock-19', name: 'x', dept: 'sidearms' }))), 'listing: ids start with c- (never a store product)');
  ok(/needs a name/.test(bad(() => E.validateCustom({ id: 'c-ab', dept: 'sidearms' }))), 'listing: needs a name');
  ok(/needs a department/.test(bad(() => E.validateCustom({ id: 'c-ab', name: 'x' }))), 'listing: needs a department');
  ok(/not a listing field/.test(bad(() => E.validateCustom({ id: 'c-ab', name: 'x', dept: 'gear', admin: true }))), 'listing: unknown field refused');
  ok(/one of in, low/.test(bad(() => E.validateCustom({ id: 'c-ab', name: 'x', dept: 'gear', status: 'gone' }))), 'listing: unknown stock state refused');
  const list = [{ id: 'c-old', name: 'Old', dept: 'gear', status: 'in' }, { id: 'c-keep', name: 'Keep', dept: 'gear', status: 'in' }];
  const out = E.applyCustomChange(list, E.validateCustomChange({ upsert: [{ id: 'c-new', name: 'New', dept: 'gear' }, { id: 'c-keep', name: 'Kept, renamed', dept: 'gear' }], remove: ['c-old'] }));
  eq(out.map((x) => [x.id, x.name]), [['c-new', 'New'], ['c-keep', 'Kept, renamed']], 'listings: new first, edits in place, removals gone');
  ok(/not a listing id/.test(bad(() => E.validateCustomChange({ remove: ['../x'] }))), 'listings: odd remove id refused');
}
// pins and the spotlight
eq(E.validatePins({ 'Glock': ['glock-19', 'glock-17'] }), { glock: ['glock-19', 'glock-17'] }, 'pins: a word → products first');
ok(bad(() => E.validatePins({ glock: [] })), 'pins: a pin needs products');
ok(bad(() => E.validatePins({ glock: ['../x'] })), 'pins: odd product id refused');
{
  const sp = E.validateSpotlight({ interval: 7, slides: [{ title: 'Holiday hours', text: 'Open late', cta: 'See hours', link: '/contact.html', image: 'assets/img/uploads/u-holiday-0a1b2c3d.webp', start: '2026-12-01', end: '2026-12-31', on: true }, { title: 'Range day', video: 'dQw4w9WgXcQ', link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }] });
  eq([sp.interval, sp.slides.length, sp.slides[0].image, sp.slides[1].video], [7, 2, 'assets/img/uploads/u-holiday-0a1b2c3d.webp', 'dQw4w9WgXcQ'], 'spotlight: slides with a photo or a video');
  ok(bad(() => E.validateSpotlight({ slides: [{ title: 'x', link: 'javascript:alert(1)' }] })), 'spotlight: javascript: links refused');
  ok(bad(() => E.validateSpotlight({ slides: [{ text: 'no headline' }] })), 'spotlight: a slide needs a headline');
  ok(bad(() => E.validateSpotlight({ interval: 1, slides: [] })), 'spotlight: interval from 4 to 30 seconds');
  ok(bad(() => E.validateSpotlight({ slides: Array(9).fill({ title: 'x' }) })), 'spotlight: at most 8 slides');
  ok(bad(() => E.validateSpotlight({ slides: [{ title: 'x', image: 'https://evil.example/a.webp' }] })), 'spotlight: photos only from this site');
}
eq(E.photosIn({ patch: { a: { images: ['assets/img/products/a.webp'] }, b: null }, custom: { upsert: [{ images: ['assets/img/uploads/u-b-0a1b2c3d.webp'] }] }, settings: { spotlight: { slides: [{ image: 'assets/img/uploads/u-c-0a1b2c3d.webp' }, { title: 'x' }] } } }),
  ['assets/img/products/a.webp', 'assets/img/uploads/u-b-0a1b2c3d.webp', 'assets/img/uploads/u-c-0a1b2c3d.webp'], 'publish: every photo a change points at is found');

// email: without a key the alert is logged, never lost or thrown
{
  const M = await import('../server/mail.mjs');
  const keep = process.env.RESEND_API_KEY; delete process.env.RESEND_API_KEY;
  const log = console.log; let said = ''; console.log = (x) => { said += x; };
  const r = await M.send({ to: 'store@example.com', subject: 'Test', text: 'hello' });
  console.log = log; if (keep) process.env.RESEND_API_KEY = keep;
  eq([r.delivered, r.logged, /store@example\.com/.test(said)], [false, true, true], 'mail: no key → written to the server log');
  eq((await M.send({ to: 'not an address', subject: 'x' })).delivered, false, 'mail: a bad address is not sent');
  const a = M.inboxAlert({ kind: 'requisition', name: 'Ada', contact: 'ada@example.com', items: ['1 × Glock 19'], message: '', at: '2026-11-10T15:00:00Z' }, 'https://agarthan.test');
  ok(/Requisition/.test(a.subject) && /Glock 19/.test(a.text) && /ops#inbox/.test(a.text) && a.replyTo === 'ada@example.com', 'mail: the alert says who, what and links the inbox; replies go to the customer');
  eq(M.inboxAlert({ kind: 'contact', name: 'Bo', contact: '(954) 555-0100', items: [], at: '2026-11-10T15:00:00Z' }).replyTo, '', 'mail: a phone number is not a reply address');
}

// the catalogue build: listings and photo edits reach the site
{
  const B = await import('./build-catalog.mjs');
  const items = B.customItems([{ id: 'c-g19-ab12', name: 'Glock 19 Gen 3', dept: 'sidearms', price: 429, cond: 'Used', status: 'in', images: ['assets/img/products/u-g19-0a1b2c3d.webp'], keywords: 'trade-in', video: 'dQw4w9WgXcQ' }, { id: 'c-hidden-ab12', name: 'Gone', dept: 'gear' }, { name: 'no id' }], { 'c-hidden-ab12': { hide: true }, 'c-g19-ab12': { price: 399 } });
  eq(items.length, 1, 'build: hidden and broken listings are left out');
  const g = items[0];
  eq([g.custom, g.firearm, g.price, g.cond, g.kw, g.video, g.images[0], g.shelf, g.type], [true, true, 399, 'Used', 'trade-in', 'dQw4w9WgXcQ', 'assets/img/products/u-g19-0a1b2c3d.webp', true, 'pistol'], 'build: a listing becomes a product (a corrected price, firearm by department, its photo, video and terms)');
  const scraped = [{ id: 'sx-1', name: 'Vortex Crossfire II 3-9x40', brand: 'Vortex', price: 149.99, stock: 'instock', categories: ['Optics', 'Riflescopes'], images: ['https://cdn.example/a.jpg'], local: ['assets/img/products/sx-1-1.webp'] }];
  const built = B.buildItems(scraped, { 'sx-1': { images: ['assets/img/products/u-crossfire-0a1b2c3d.webp', 'assets/img/products/sx-1-1.webp'], keywords: 'scope deal', cond: 'Demo', video: 'dQw4w9WgXcQ' } });
  if (built.length) eq([built[0].images[0], built[0].kw, built[0].cond, built[0].video], ['assets/img/products/u-crossfire-0a1b2c3d.webp', 'scope deal', 'Demo', 'dQw4w9WgXcQ'], 'build: a product\'s uploaded photo, terms, condition and video win');
  else { fail++; console.log('✗ build: the sample product was not built'); }
}

process.env.OPS_PASSWORD = 'unit-test-passcode';
const A = await import('../server/auth.mjs');
ok(A.passMatches('unit-test-passcode') && !A.passMatches('unit-test-passcod') && !A.passMatches(''), 'auth: passcode compare');
{
  const { token } = A.issueToken();
  ok(A.tokenValid(token), 'auth: a fresh token is valid');
  ok(!A.tokenValid(token.slice(0, -2) + (token.endsWith('A') ? 'BB' : 'AA')), 'auth: a tampered token is not');
  ok(!A.tokenValid(A.issueToken(Date.now() - 13 * 3600e3).token), 'auth: a 13-hour-old token has expired');
  process.env.OPS_PASSWORD = 'rotated-passcode-2';
  ok(!A.tokenValid(token), 'auth: rotating the passcode signs everyone out');
}
eq(A.clientIp({ headers: { 'x-forwarded-for': '6.6.6.6, 10.0.0.1, 203.0.113.9' }, socket: {} }), '203.0.113.9', 'auth: the address Render appended is trusted, not what the client typed');

{
  const O = await import('../server/ops.mjs');
  const dir = mkdtempSync(path.join(tmpdir(), 'ops-cfg-'));
  mkdirSync(path.join(dir, 'assets/js'), { recursive: true }); mkdirSync(path.join(dir, 'assets/data'), { recursive: true });
  writeFileSync(path.join(dir, 'assets/js/config.js'), "window.AA_CONFIG = { phone: '1', address: { street: 'A', city: 'B' } };\n");
  O.setRoot(dir);
  eq(await O.configScript(), "window.AA_CONFIG = { phone: '1', address: { street: 'A', city: 'B' } };\n", 'config.js: unchanged without published settings');
  writeFileSync(path.join(dir, 'assets/data/site-settings.json'), JSON.stringify({ facts: { phone: '2', address: { city: 'C' } }, notices: [{ id: 'n', text: '</script><b>' }], synonyms: [['a', 'b']], pins: { glock: ['glock-19'] }, spotlight: { interval: 6, slides: [{ title: 'Hi' }] } }));
  const js = await O.configScript();
  const win = {}; new Function('window', js)(win);
  eq([win.AA_CONFIG.phone, win.AA_CONFIG.address, win.AA_CONFIG.synonyms], ['2', { street: 'A', city: 'C' }, [['a', 'b']]], 'config.js: published facts merge over the file (nested groups field by field)');
  eq([win.AA_CONFIG.pins, win.AA_CONFIG.spotlight.slides[0].title], [{ glock: ['glock-19'] }, 'Hi'], 'config.js: pins and the spotlight reach the site');
  ok(!js.includes('</script>'), 'config.js: settings cannot close the script tag');
  O.setRoot(ROOT);
}

// a Windows checkout (CRLF) and Render (LF) fingerprint the catalog's inputs the same, so a build made on
// either is recognised by the other (a mismatch rebuilt the catalog on every deploy)
{
  const { inputsHash } = await import('./lib-inputs.mjs');
  const fp = (eol) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ops-eol-'));
    mkdirSync(path.join(dir, 'assets/data/scraped'), { recursive: true }); mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    writeFileSync(path.join(dir, 'assets/data/overrides.json'), ['{', '  "a": { "hide": true }', '}', ''].join(eol));
    writeFileSync(path.join(dir, 'scripts/build-catalog.mjs'), ['// build', 'export const x = 1;', ''].join(eol));
    writeFileSync(path.join(dir, 'assets/data/scraped/catalog.json'), '[]');
    return inputsHash(dir);
  };
  eq(fp('\r\n'), fp('\n'), 'fingerprint: Windows and Unix line endings give the same catalog fingerprint');
}

/* -------------------------------------------------------------- HTTP */
const gh = await mockGitHub({
  'assets/data/overrides.json': JSON.stringify({ _readme: 'r', existing: { noPhoto: true, _photo: 'cut off' } }, null, 2),
  'assets/data/site-settings.json': '{}',
  'README.md': 'hello',
});
const woo = await mockWoo();
const mail = await mockMail();
const data = mkdtempSync(path.join(tmpdir(), 'ops-data-'));
const PORT = 4300 + Math.floor(Math.random() * 500);
const env = {
  ...process.env, PORT: String(PORT), OPS_PASSWORD: 'correct-horse-9', DATA_DIR: data,
  GH_TOKEN: gh.token, GH_REPO: gh.repo, GH_BRANCH: 'main', GH_API: gh.url,
  WOO_URL: woo.url, WOO_CK: woo.ck, WOO_CS: woo.cs, RENDER_GIT_COMMIT: 'a'.repeat(40),
  RESEND_API_KEY: mail.key, RESEND_API: mail.url, ALERT_EMAIL: 'store@example.com', MAIL_FROM: 'Agarthan Armory <alerts@example.com>', SITE_URL: 'https://agarthan.test',
};
const srv = spawn(process.execPath, [path.join(ROOT, 'server.mjs')], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
let srvLog = ''; srv.stdout.on('data', (d) => (srvLog += d)); srv.stderr.on('data', (d) => (srvLog += d));
await new Promise((r, j) => { const t = setTimeout(() => j(new Error('server did not start\n' + srvLog)), 8000); srv.stdout.on('data', () => { if (srvLog.includes('http://')) { clearTimeout(t); r(); } }); });
const BASE = `http://127.0.0.1:${PORT}`;
let ipN = 0;
const call = async (method, p, { body, token, ip, raw } = {}) => {
  const r = await fetch(BASE + p, { method, headers: { 'X-Forwarded-For': ip || `198.51.100.${++ipN % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body !== undefined ? (raw ? body : JSON.stringify(body)) : undefined });
  let j = null; const text = await r.text(); try { j = JSON.parse(text); } catch { j = text; }
  return { status: r.status, body: j, headers: r.headers };
};

try {
  let r = await call('GET', '/api/ops/status');
  eq([r.status, r.body.live, r.body.github, r.body.disk, r.body.woo, r.body.mail], [200, true, true, true, true, true], 'status: everything switched on');
  eq(r.headers.get('cache-control'), 'no-store', 'status: never cached');
  eq([r.body.repo, r.body.diskWhy, r.body.deployed, r.body.mailTo], [undefined, undefined, undefined, undefined], 'status: says nothing about the repo, disk or alert address to the public');

  r = await call('POST', '/api/ops/unlock', { body: { key: 'nope' }, ip: '203.0.113.1' });
  eq([r.status, r.body.left], [401, 9], 'unlock: wrong passcode, 9 tries left');
  for (let i = 0; i < 5; i++) await call('POST', '/api/ops/unlock', { body: { key: 'nope' }, ip: '203.0.113.1' });
  r = await call('POST', '/api/ops/unlock', { body: { key: 'nope' }, ip: '203.0.113.1' });
  eq(r.body.left, 9, 'unlock: the same wrong key again is not a new guess (a stale tab)');
  for (let i = 0; i < 10; i++) r = await call('POST', '/api/ops/unlock', { body: { key: `guess-${i}` }, ip: '203.0.113.2' });
  eq(r.status, 429, 'lockout: ten different wrong keys lock the address');
  r = await call('POST', '/api/ops/unlock', { body: { key: 'correct-horse-9' }, ip: '203.0.113.2' });
  eq(r.status, 429, 'lockout: even the right key waits out the lock');
  r = await call('POST', '/api/ops/unlock', { body: { key: 'correct-horse-9' } });
  ok(r.status === 200 && r.body.token, 'unlock: the right key gets a session token');
  const T = r.body.token;
  ok(!JSON.stringify(r.body).includes('correct-horse-9'), 'unlock: the passcode is never sent back');

  r = await call('GET', '/api/ops/settings');
  eq(r.status, 401, 'settings: no token, no access');
  r = await call('GET', '/api/ops/settings', { token: T.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')) });
  eq(r.status, 401, 'settings: a forged token is refused');
  r = await call('GET', '/api/ops/status', { token: T });
  eq([r.body.repo, r.body.mailTo, r.body.mailKey], [gh.repo, 'store@example.com', true], 'status: a signed-in console sees the details');
  r = await call('GET', '/api/ops/settings', { token: T });
  eq([r.status, r.body.source, r.body.overrides.existing.noPhoto], [200, 'github', true], 'settings: read from the repo head');

  r = await call('POST', '/api/ops/publish', { token: T, body: { products: { 'glock-19': { evil: true } } } });
  eq([r.status, /not a field/.test(r.body.error)], [400, true], 'publish: an invalid edit is refused, nothing committed');
  eq(gh.commits.length, 0, 'publish: no commit for a refused edit');

  gh.raceNext();
  r = await call('POST', '/api/ops/publish', { token: T, body: { products: { 'glock-19': { featured: true, price: 549 }, existing: { noPhoto: false } }, by: 'Zach', note: 'Holiday picks' } });
  eq(r.status, 200, 'publish: products committed');
  const ov = JSON.parse(gh.files()['assets/data/overrides.json']);
  eq([ov._readme, ov['glock-19'], ov.existing], ['r', { featured: true, price: 549 }, undefined], 'publish: merged into the file (readme kept, photo restored)');
  ok(gh.files()['README.md'].startsWith('pushed by someone else'), 'publish: another push that landed first is kept (retried on top of it)');
  ok(/^Ops Console: 2 product\(s\) \(Zach\)\n\nHoliday picks/.test(gh.commits[gh.commits.length - 1]), 'publish: commit message names the change and who made it');

  r = await call('POST', '/api/ops/publish', { token: T, body: { settings: { facts: { phone: '(561) 555-0100' }, notices: [{ text: 'Closed Thursday', tone: 'alert' }], synonyms: [['g19', 'glock 19']] } } });
  const st = JSON.parse(gh.files()['assets/data/site-settings.json']);
  eq([r.status, st.facts.phone, st.notices[0].text, st.synonyms[0]], [200, '(561) 555-0100', 'Closed Thursday', ['g19', 'glock 19']], 'publish: settings committed');
  r = await call('GET', '/api/ops/deploy', { token: T });
  eq([r.body.pending, r.body.head === gh.head()], [true, true], 'deploy: knows a newer commit is waiting to go live');

  // photos, a listing, pins and the spotlight in one publish
  const up1 = 'assets/img/products/u-glock-19-0a1b2c3d.webp', up2 = 'assets/img/uploads/u-holiday-1a2b3c4d.jpg';
  const localPhoto = 'assets/img/products/' + (await import('node:fs')).readdirSync(path.join(ROOT, 'assets/img/products')).find((f) => f.endsWith('.webp'));
  let before = gh.commits.length;
  r = await call('POST', '/api/ops/publish', { token: T, body: { products: { 'glock-19': { images: [up1, 'assets/img/products/nowhere-1.webp'] } }, uploads: [{ path: up1, data: WEBP.toString('base64') }] } });
  eq([r.status, /not on the site: assets\/img\/products\/nowhere-1\.webp/.test(r.body.error), gh.commits.length], [400, true, before], 'publish: a photo that is nowhere is refused, nothing committed');
  r = await call('POST', '/api/ops/publish', { token: T, body: { uploads: [{ path: up1, data: PNG.toString('base64') }] } });
  eq([r.status, gh.commits.length], [400, before], 'publish: a photo whose bytes are not what its name says is refused');
  r = await call('POST', '/api/ops/publish', { token: T, by: 'Zach', body: {
    by: 'Zach',
    products: { 'glock-19': { images: [up1, localPhoto], cond: 'Demo', keywords: 'g19' } },
    custom: { upsert: [{ id: 'c-g19-trade-ab12', name: 'Glock 19 Gen 3 — trade-in', dept: 'sidearms', price: 429, cond: 'Used', images: [up1] }], remove: [] },
    settings: { pins: { glock: ['glock-19'] }, spotlight: { interval: 6, slides: [{ title: 'Holiday hours', image: up2, link: '/contact.html' }] } },
    uploads: [{ path: up1, data: WEBP.toString('base64') }, { path: up2, data: JPG.toString('base64') }],
  } });
  eq(r.status, 200, 'publish: photos, a listing, pins and the spotlight together');
  eq(gh.commits.length, before + 1, 'publish: …as one commit (one deploy)');
  ok(gh.bytes(up1) && gh.bytes(up1).equals(WEBP) && gh.bytes(up2).equals(JPG), 'publish: the photos are in the repo byte for byte');
  const cust = JSON.parse(gh.files()['assets/data/custom-products.json']);
  eq([cust.length, cust[0].id, cust[0].price, cust[0].images], [1, 'c-g19-trade-ab12', 429, [up1]], 'publish: the listing is saved');
  const ov2 = JSON.parse(gh.files()['assets/data/overrides.json']);
  eq([ov2['glock-19'].images, ov2['glock-19'].cond, ov2['glock-19'].featured], [[up1, localPhoto], 'Demo', true], 'publish: the product gets its photos, earlier edits kept');
  const st2 = JSON.parse(gh.files()['assets/data/site-settings.json']);
  eq([st2.pins, st2.spotlight.slides[0].image, st2.facts.phone], [{ glock: ['glock-19'] }, up2, '(561) 555-0100'], 'publish: pins and spotlight saved, the store facts kept');
  ok(/^Ops Console: 1 product\(s\), 1 listing\(s\), 2 photo\(s\), pins \+ spotlight \(Zach\)/.test(gh.commits[gh.commits.length - 1]), 'publish: the commit message lists what changed');
  r = await call('POST', '/api/ops/publish', { token: T, body: { products: { 'sig-p365': { images: [up1] } } } });
  eq(r.status, 200, 'publish: a photo published earlier (in the repo, not on this server yet) can be reused');
  r = await call('POST', '/api/ops/publish', { token: T, body: { custom: { upsert: [], remove: ['c-g19-trade-ab12'] } } });
  eq([r.status, JSON.parse(gh.files()['assets/data/custom-products.json']).length], [200, 0], 'publish: a listing removed');
  r = await call('POST', '/api/ops/publish', { token: T, body: { custom: { upsert: [{ id: 'not-custom', name: 'x', dept: 'gear' }] } } });
  eq(r.status, 400, 'publish: a listing that could collide with a store product is refused');
  r = await call('GET', '/api/ops/settings', { token: T });
  eq([Array.isArray(r.body.custom), r.body.settings.pins.glock[0]], [true, 'glock-19'], 'settings: the console reads listings and pins back');

  // the change history
  r = await call('GET', '/api/ops/history', { token: T });
  const hist = r.body.commits;
  ok(r.status === 200 && hist.length >= 5, 'history: the console\'s commits are listed');
  ok(hist.every((c) => /^(Ops Console|initial)/.test(c.message) && c.url && c.sha.length === 40) && !hist.some((c) => c.message === 'someone else'), 'history: only commits touching the console\'s files (not the README push)');
  ok(hist.every((c, i) => !i || hist[i - 1].date >= c.date), 'history: newest first');
  ok(hist.some((c) => c.files.includes('assets/data/custom-products.json') && c.files.includes('assets/data/site-settings.json')), 'history: says which files each commit changed');
  r = await call('GET', '/api/ops/history');
  eq(r.status, 401, 'history: needs the console');

  // email
  r = await call('POST', '/api/ops/mail/test', { token: T });
  eq([r.status, r.body.to, mail.sent.length && mail.sent[mail.sent.length - 1].to[0], mail.sent.length && mail.sent[mail.sent.length - 1].from], [200, 'store@example.com', 'store@example.com', 'Agarthan Armory <alerts@example.com>'], 'mail: the test alert is delivered');
  r = await call('POST', '/api/ops/mail/test');
  eq(r.status, 401, 'mail: the test needs the console');

  // theme check
  r = await call('GET', '/api/ops/check/woo', { token: T });
  eq([r.body.status, r.body.theme, r.body.version, r.body.storefront, r.body.gate], [200, true, '1.2.0', true, true], 'woo check: the store runs the Agarthan theme (and which version)');

  // inbox
  r = await call('POST', '/api/inbox', { body: { type: 'requisition', name: 'Ada Byrd', contact: '(954) 555-0142', note: 'Hold until Friday', items: ['1 × Glock 19 Gen5 — $549.00'] }, ip: '192.0.2.10' });
  eq(r.status, 200, 'inbox: a requisition is accepted');
  r = await call('POST', '/api/inbox', { body: { type: 'contact', name: 'Cy Ward', contact: 'cy@example.com', message: 'Do you have 5.7x28 in stock?' }, ip: '192.0.2.12' });
  const cy = () => mail.sent.find((m) => /Cy Ward/.test(m.subject));      // alerts go out in the background
  for (let i = 0; i < 60 && !cy(); i++) await new Promise((res) => setTimeout(res, 50));
  const alert = cy() || {};
  ok(r.status === 200 && /Cy Ward/.test(alert.subject || '') && /5\.7x28/.test(alert.text || '') && alert.reply_to === 'cy@example.com' && /agarthan\.test\/ops#inbox/.test(alert.text || ''), 'inbox: a message is emailed to the store, replies go to the customer');
  ok(mail.sent.some((m) => /Requisition/.test(m.subject) && /Glock 19 Gen5/.test(m.text)), 'inbox: the requisition was emailed too');
  r = await call('POST', '/api/inbox', { body: { type: 'contact', name: 'Bot', contact: 'x', message: 'buy now', website: 'http://spam' }, ip: '192.0.2.10' });
  eq(r.status, 200, 'inbox: the honeypot answers OK…');
  r = await call('POST', '/api/inbox', { body: { type: 'contact', name: 'No contact', message: 'hi' }, ip: '192.0.2.10' });
  eq(r.status, 400, 'inbox: a phone number or email is required');
  for (let i = 0; i < 4; i++) r = await call('POST', '/api/inbox', { body: { name: 'Flood', contact: 'f@x.co', message: String(i) }, ip: '192.0.2.10' });
  eq(r.status, 429, 'inbox: one address can send 6 per 10 minutes');
  r = await call('POST', '/api/inbox', { body: '{not json', raw: true, ip: '192.0.2.11' });
  eq(r.status, 400, 'inbox: junk is refused');
  r = await call('GET', '/api/ops/inbox', { token: T });
  const msgs = r.body.messages;
  eq([msgs.some((m) => m.name === 'Bot'), msgs[msgs.length - 1].name, msgs[msgs.length - 1].items.length], [false, 'Ada Byrd', 1], 'inbox: …but keeps nothing from it; the requisition is there');
  r = await call('POST', '/api/ops/inbox/update', { token: T, body: { id: msgs[msgs.length - 1].id, status: 'holding', note: 'Called — holding till Fri' } });
  eq([r.body.message.status, r.body.message.notes[0].text], ['holding', 'Called — holding till Fri'], 'inbox: status and note saved');
  r = await call('POST', '/api/ops/inbox/update', { token: T, body: { id: msgs[0].id, status: 'deleted-everything' } });
  eq(r.status, 400, 'inbox: unknown status refused');
  r = await call('GET', '/api/ops/inbox');
  eq(r.status, 401, 'inbox: reading needs the console');

  // traffic
  await call('POST', '/api/hit', { body: { p: '/armory.html' } });
  await call('POST', '/api/hit', { body: { p: '/armory.html', q: 'Hyperborean Blaster' } });
  await call('POST', '/api/hit', { body: { p: '/armory.html', q: 'Glock 19', found: 42 } });
  await call('POST', '/api/hit', { body: { p: '/armory.html', q: 'glock 19', found: 40 } });
  await call('POST', '/api/hit', { body: { p: '/armory.html', q: 'g19', found: 0 } });
  await call('POST', '/api/hit', { body: { p: 'javascript:alert(1)' } });
  r = await call('GET', '/api/ops/traffic', { token: T });
  const day = Object.values(r.body.days)[0];
  eq([day.views, day.pages['/armory.html'], r.body.searches['hyperborean blaster'].n], [1, 1, 1], 'traffic: views and dead-end searches counted, junk paths not');
  eq([r.body.searches['glock 19'].n, r.body.searches['glock 19'].zero, r.body.searches['glock 19'].found, r.body.searches.g19.zero], [2, 0, 40, 1], 'search log: every search counted (case folded), with what it found');

  // woo
  r = await call('GET', '/api/ops/woo/orders?per_page=5&consumer_secret=steal', { token: T });
  eq([r.status, r.body.length], [200, 2], 'woo: orders read through the proxy');
  eq(r.body[0].agarthan_release['Receiving FFL'], 'Gulf Coast Arms · (954) 555-0199', 'woo: an order carries its firearm release');
  r = await call('GET', '/api/ops/woo/reports/sales?period=month', { token: T });
  eq(Object.keys(r.body[0].totals).length, 2, 'woo: the sales report with daily totals (the chart)');
  ok(woo.seen.some((s) => s === 'GET /wp-json/wc/v3/orders?per_page=5'), 'woo: only allowed query parameters are passed on');
  r = await call('GET', '/api/ops/woo/products/%2e%2e/settings/general', { token: T });
  eq(r.status, 403, 'woo: a ../ path is normalised before the allowlist (the PAMAX bypass)');
  r = await call('GET', '/api/ops/woo/customers', { token: T });
  eq(r.status, 403, 'woo: customers are not readable');
  r = await call('DELETE', '/api/ops/woo/orders/41', { token: T });
  eq(r.status, 405, 'woo: read only — DELETE refused');
  ok(!woo.seen.some((s) => /settings|customers|DELETE/.test(s)), 'woo: none of those reached the store');

  // backup, headers, static
  r = await call('GET', '/api/ops/backup', { token: T });
  ok(r.status === 200 && Array.isArray(r.body.inbox) && Array.isArray(r.body.custom) && /attachment/.test(r.headers.get('content-disposition')), 'backup: a download with the inbox and listings');
  r = await fetch(BASE + '/ops.html');
  ok(/default-src 'self'/.test(r.headers.get('content-security-policy') || '') && /noindex/.test(r.headers.get('x-robots-tag') || ''), 'ops.html: strict CSP, never indexed');
  ok((await fetch(BASE + '/server/ops.mjs')).status === 404 && (await fetch(BASE + '/assets/data/overrides.json')).status === 404 && (await fetch(BASE + '/assets/data/custom-products.json')).status === 404, 'private: server code and raw data are not served');
  ok(/Disallow: \/ops/.test(await (await fetch(BASE + '/robots.txt')).text()), 'robots.txt keeps crawlers out of the console');
  r = await call('POST', '/api/ops/publish', { token: T, body: 'x'.repeat(21_000_000), raw: true });
  eq(r.status, 413, 'publish: oversized bodies refused');
} catch (e) {
  fail++; console.log('✗ crashed:', e.stack, '\n', srvLog);
} finally {
  srv.kill(); gh.close(); woo.close(); mail.close();
}
console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
