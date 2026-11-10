/* test-ops.mjs — the Ops Console's server: what may be edited, the merge,
 * sign-in, lockout, publishing (against a stand-in GitHub, including a race
 * with another push), the inbox, traffic, the read-only WooCommerce proxy and
 * its path check, headers, and config.js carrying the published settings.
 * Run: node scripts/test-ops.mjs */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockGitHub, mockWoo } from './lib-mock-github.mjs';

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
  writeFileSync(path.join(dir, 'assets/data/site-settings.json'), JSON.stringify({ facts: { phone: '2', address: { city: 'C' } }, notices: [{ id: 'n', text: '</script><b>' }], synonyms: [['a', 'b']] }));
  const js = await O.configScript();
  const win = {}; new Function('window', js)(win);
  eq([win.AA_CONFIG.phone, win.AA_CONFIG.address, win.AA_CONFIG.synonyms], ['2', { street: 'A', city: 'C' }, [['a', 'b']]], 'config.js: published facts merge over the file (nested groups field by field)');
  ok(!js.includes('</script>'), 'config.js: settings cannot close the script tag');
  O.setRoot(ROOT);
}

/* -------------------------------------------------------------- HTTP */
const gh = await mockGitHub({
  'assets/data/overrides.json': JSON.stringify({ _readme: 'r', existing: { noPhoto: true, _photo: 'cut off' } }, null, 2),
  'assets/data/site-settings.json': '{}',
  'README.md': 'hello',
});
const woo = await mockWoo();
const data = mkdtempSync(path.join(tmpdir(), 'ops-data-'));
const PORT = 4300 + Math.floor(Math.random() * 500);
const env = {
  ...process.env, PORT: String(PORT), OPS_PASSWORD: 'correct-horse-9', DATA_DIR: data,
  GH_TOKEN: gh.token, GH_REPO: gh.repo, GH_BRANCH: 'main', GH_API: gh.url,
  WOO_URL: woo.url, WOO_CK: woo.ck, WOO_CS: woo.cs, RENDER_GIT_COMMIT: 'a'.repeat(40),
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
  eq([r.status, r.body.live, r.body.github, r.body.disk, r.body.woo], [200, true, true, true, true], 'status: everything switched on');
  eq(r.headers.get('cache-control'), 'no-store', 'status: never cached');
  eq([r.body.repo, r.body.diskWhy, r.body.deployed], [undefined, undefined, undefined], 'status: says nothing about the repo or disk to the public');

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
  eq(r.body.repo, gh.repo, 'status: a signed-in console sees the details');
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

  // inbox
  r = await call('POST', '/api/inbox', { body: { type: 'requisition', name: 'Ada Byrd', contact: '(954) 555-0142', note: 'Hold until Friday', items: ['1 × Glock 19 Gen5 — $549.00'] }, ip: '192.0.2.10' });
  eq(r.status, 200, 'inbox: a requisition is accepted');
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
  await call('POST', '/api/hit', { body: { p: 'javascript:alert(1)' } });
  r = await call('GET', '/api/ops/traffic', { token: T });
  const day = Object.values(r.body.days)[0];
  eq([day.views, day.pages['/armory.html'], r.body.searches['hyperborean blaster'].n], [1, 1, 1], 'traffic: views and dead-end searches counted, junk paths not');

  // woo
  r = await call('GET', '/api/ops/woo/orders?per_page=5&consumer_secret=steal', { token: T });
  eq([r.status, r.body.length], [200, 2], 'woo: orders read through the proxy');
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
  ok(r.status === 200 && Array.isArray(r.body.inbox) && /attachment/.test(r.headers.get('content-disposition')), 'backup: a download with the inbox');
  r = await fetch(BASE + '/ops.html');
  ok(/default-src 'self'/.test(r.headers.get('content-security-policy') || '') && /noindex/.test(r.headers.get('x-robots-tag') || ''), 'ops.html: strict CSP, never indexed');
  ok((await fetch(BASE + '/server/ops.mjs')).status === 404 && (await fetch(BASE + '/assets/data/overrides.json')).status === 404, 'private: server code and raw data are not served');
  ok(/Disallow: \/ops/.test(await (await fetch(BASE + '/robots.txt')).text()), 'robots.txt keeps crawlers out of the console');
  r = await call('POST', '/api/ops/publish', { token: T, body: 'x'.repeat(2_100_000), raw: true });
  eq(r.status, 413, 'publish: oversized bodies refused');
} catch (e) {
  fail++; console.log('✗ crashed:', e.stack, '\n', srvLog);
} finally {
  srv.kill(); gh.close(); woo.close();
}
console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
