#!/usr/bin/env node
/* test-gate.mjs — the password over the whole site (server/site-gate.mjs), against a real server.
 * Without the password: / is the gate (200, for Render's health check), every old link goes to /,
 * the API refuses, and only the gate's own files and the link-preview card are open. With it: the
 * site as before. Wrong passwords lock an address out; SITE_PASSWORD and SITE_GATE=off work.
 * The repo is public, so the real password is written nowhere in it, here included: these run on
 * a test password (SITE_PASSWORD). GATE_PASSWORD=<the real one> also checks the built-in value.
 *   node scripts/test-gate.mjs */
const PW = 'Test-Gate-Passphrase';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log(`  ✗ ${msg}`); } };

const running = new Set();
process.on('exit', () => { for (const c of running) c.kill(); });
const freePort = () => new Promise((r) => { const t = net.createServer().listen(0, '127.0.0.1', () => { const { port } = t.address(); t.close(() => r(port)); }); });
async function server(env = {}) {
  const PORT = await freePort();
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.mjs')], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, SITE_GATE: '', SITE_PASSWORD: '', OPS_PASSWORD: '', ...env, PORT: String(PORT) } });
  let log = ''; srv.stdout.on('data', (d) => (log += d)); srv.stderr.on('data', (d) => (log += d));
  await new Promise((r, j) => { const t = setTimeout(() => j(new Error('server did not start\n' + log)), 8000); const i = setInterval(() => { if (log.includes('http://')) { clearInterval(i); clearTimeout(t); r(); } }, 40); });
  const base = `http://127.0.0.1:${PORT}`;
  const get = (p, o = {}) => fetch(base + p, { redirect: 'manual', ...o });
  const login = (pw, ip = '203.0.113.7') => get('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': ip }, body: new URLSearchParams({ password: pw }) });
  running.add(srv);
  return { srv, get, login, stop: () => { srv.kill(); running.delete(srv); } };
}
const cookieOf = (r) => (r.headers.get('set-cookie') || '').split(';')[0];

{
  const s = await server({ SITE_PASSWORD: PW });
  // the gate at /
  let r = await s.get('/');
  const html = await r.text();
  ok(r.status === 200, `/ answers 200 without the password (Render's health check), got ${r.status}`);
  ok(/<form method="post" action="\/">/.test(html) && /type="password"/.test(html), '/ is the password form');
  ok(!/The gate in the wall|id="main"/.test(html), '/ shows none of the site without the password');
  ok(/og:image" content="https:\/\/agarthan-armory\.onrender\.com\/assets\/img\/og-card-trio\.jpg"/.test(html) && /twitter:card/.test(html), 'the gate carries the home page\'s link-preview tags');
  ok(/name="robots" content="noindex/.test(html), 'the gate asks search engines not to index it');
  ok(r.headers.get('cache-control') === 'no-store', 'the gate is never cached');
  ok((await s.get('/', { method: 'HEAD' })).status === 200, 'HEAD / answers 200');
  // every old link lands on the gate, whatever it named
  for (const p of ['/index.html', '/armory.html', '/armory', '/armory.html?dept=sidearms', '/transfers', '/forbidden.html', '/ops', '/version', '/sitemap.xml',
    '/assets/js/site.js', '/assets/css/site.css', '/assets/data/catalog.js', '/assets/img/feature/antarctica-20-front.webp', '/no-such-page', '/assets/fonts/../js/site.js']) {
    r = await s.get(p);
    ok(r.status === 302 && r.headers.get('location') === '/', `${p} goes to the gate without the password (got ${r.status} ${r.headers.get('location')})`);
  }
  r = await s.get('/api/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  ok(r.status === 401, `the API refuses without the password (got ${r.status})`);
  r = await s.get('/api/ops/status');
  ok(r.status === 302, 'an API read goes to the gate too');
  // what the gate page and a link preview need stays open
  for (const p of ['/robots.txt', '/assets/img/og-card-trio.jpg', '/assets/img/og-card-atom.jpg', '/assets/img/brand/seal-160.png', '/assets/img/brand/seal-64.png',
    '/assets/img/apple-touch-icon.png', '/assets/fonts/orbitron-latin-900-normal.woff2', '/assets/fonts/exo-2-latin-400-normal.woff2', '/assets/fonts/share-tech-mono-latin-400-normal.woff2']) {
    r = await s.get(p);
    ok(r.status === 200, `${p} is open (the gate page or a link preview needs it), got ${r.status}`);
  }
  // wrong passwords
  r = await s.login(PW.toLowerCase());
  ok(r.status === 303 && r.headers.get('location') === '/?denied=1' && !r.headers.get('set-cookie'), 'a wrong password (wrong case) is refused, no cookie');
  ok(/does not open the gate/.test(await (await s.get('/?denied=1')).text()), 'the gate says the password was wrong');
  r = await s.login('');
  ok(r.headers.get('location') === '/?denied=1' && !r.headers.get('set-cookie'), 'an empty password is refused');
  // the right one, with stray spaces from a phone keyboard
  r = await s.login(` ${PW} `);
  const c = cookieOf(r);
  ok(r.status === 303 && r.headers.get('location') === '/', 'the right password goes to the home page');
  ok(/^aa_gate=[A-Za-z0-9_-]{43}$/.test(c), 'and sets the gate cookie');
  ok(/HttpOnly/.test(r.headers.get('set-cookie')) && /SameSite=Lax/.test(r.headers.get('set-cookie')) && /Max-Age=2592000/.test(r.headers.get('set-cookie')), 'the cookie is HttpOnly, SameSite=Lax, 30 days');
  ok(!/Secure/.test(r.headers.get('set-cookie')), 'no Secure flag over plain http (local preview)');
  ok(/; Secure/.test((await s.login(PW, '203.0.113.8')).headers.get('set-cookie') || '') === false, 'still no Secure without https');
  r = await s.get('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-Proto': 'https' }, body: new URLSearchParams({ password: PW }) });
  ok(/; Secure/.test(r.headers.get('set-cookie') || ''), 'Secure behind Render\'s https');
  // with the cookie: the site as before
  const H = { headers: { Cookie: `theme=x; ${c}` } };
  r = await s.get('/', H);
  ok(r.status === 200 && /The gate in the wall/.test(await r.text()), 'with the cookie, / is the home page');
  for (const p of ['/armory.html', '/armory', '/transfers', '/forbidden.html', '/assets/js/site.js', '/assets/data/catalog.js', '/version', '/sitemap.xml']) {
    r = await s.get(p, H);
    ok(r.status === 200, `with the cookie, ${p} is served (got ${r.status})`);
  }
  r = await s.get('/assets/img/feature/antarctica-20-front.webp', H);
  ok(/^private, max-age=86400$/.test(r.headers.get('cache-control') || ''), 'photos behind the gate are cached privately, never by a shared cache');
  r = await s.get('/no-such-page', H);
  ok(r.status === 404, 'with the cookie, a missing page is the site\'s own 404');
  // a forged or stale cookie is no cookie
  for (const bad of ['aa_gate=' + 'A'.repeat(43), 'aa_gate=' + c.slice(8, -2) + 'xx', 'aa_gate=', 'aa_gate=' + c.slice(8) + 'A']) {
    r = await s.get('/armory.html', { headers: { Cookie: bad } });
    ok(r.status === 302, `a forged cookie does not open the gate (${bad.slice(0, 20)}…)`);
  }
  // eight different wrong passwords from one address lock it out, even for the right one; others are unaffected
  for (let i = 0; i < 8; i++) r = await s.login('guess-' + i, '198.51.100.9');
  ok(/^\/\?wait=\d+$/.test(r.headers.get('location') || ''), `the eighth wrong password locks the address (got ${r.headers.get('location')})`);
  r = await s.login(PW, '198.51.100.9');
  ok(/^\/\?wait=/.test(r.headers.get('location') || '') && !r.headers.get('set-cookie'), 'a locked address cannot pass even with the right password');
  ok(/Try again in 10 minutes/.test(await (await s.get('/?wait=10')).text()), 'the gate says how long the lock lasts');
  r = await s.login(PW, '198.51.100.10');
  ok(!!cookieOf(r), 'another address still passes');
  // the same wrong password repeated counts once (a re-submitted form is not a new guess)
  for (let i = 0; i < 12; i++) r = await s.login('same-typo', '198.51.100.11');
  ok(r.headers.get('location') === '/?denied=1', 'the same wrong password repeated does not lock the address');
  // a body too large is refused without hashing it
  r = await s.get('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'password=' + 'x'.repeat(9000) });
  ok(r.status === 303 && !r.headers.get('set-cookie'), 'an oversized form is refused');
  s.stop();
}

{ // the built-in password: no SITE_PASSWORD, the gate still stands, and a test password does not open it
  const s = await server();
  ok((await s.get('/armory.html')).status === 302, 'with no SITE_PASSWORD the gate stands on the built-in password');
  ok(!cookieOf(await s.login(PW)), 'a password that is not the built-in one is refused');
  if (process.env.GATE_PASSWORD) {
    const c = cookieOf(await s.login(process.env.GATE_PASSWORD));
    ok(!!c, 'GATE_PASSWORD (the real one) opens the built-in gate');
    ok((await s.get('/armory.html', { headers: { Cookie: c } })).status === 200, 'and its cookie opens the site');
  }
  s.stop();
}

{ // a cookie made under one password does not open a gate on another
  const a = await server({ SITE_PASSWORD: PW });
  const c = cookieOf(await a.login(PW));
  a.stop();
  const b = await server({ SITE_PASSWORD: 'a different, much longer passphrase' });
  ok((await b.get('/armory.html', { headers: { Cookie: c } })).status === 302, 'changing SITE_PASSWORD signs everyone out');
  ok(!!cookieOf(await b.login('a different, much longer passphrase')), 'and the new password opens it');
  b.stop();
}

{ // SITE_GATE=off: no gate at all
  const s = await server({ SITE_GATE: 'off' });
  const r = await s.get('/armory.html');
  ok(r.status === 200, 'SITE_GATE=off serves the site with no password');
  ok(/The gate in the wall/.test(await (await s.get('/')).text()), 'SITE_GATE=off: / is the home page');
  s.stop();
}

console.log(`${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
