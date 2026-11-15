/* =============================================================================
 * site-gate.mjs — a password over the whole site.
 *
 * Every request needs the gate cookie, except the password page and the few
 * files it and a link preview need (the share card, the seal, the fonts,
 * robots.txt). Without the cookie:
 *   GET /                the password page, 200 (Render's health check asks for /)
 *   any other GET/HEAD   302 to /: an old link lands on the gate, never on what it named
 *   anything else        401
 * POST / with the right password sets the cookie (30 days) and sends the
 * visitor to the home page. With the cookie the site is exactly as before.
 *
 * The password is not in the repo, which is public: only a check value is,
 * sha256(scrypt(password)). The cookie carries scrypt(password), so the
 * server keeps no secret of its own, a deploy signs nobody out, and changing
 * the password signs everyone out.
 *   SITE_PASSWORD   (Render dashboard) replaces the built-in password
 *   SITE_GATE=off   no gate (the test suites that are not about it)
 * A short word can be found from the check value by anyone who tries a list
 * of words; for a gate that has to hold, set SITE_PASSWORD to something long.
 * Wrong passwords count per address (lockout.mjs): eight different wrong ones
 * in ten minutes shut that address out for ten minutes.
 * ===========================================================================*/
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createLockout } from './lockout.mjs';
import { clientIp } from './auth.mjs';

const COOKIE = 'aa_gate';
const MAX_AGE = 30 * 24 * 3600;
const SALT = 'agarthan-armory/site-gate/v1';
const KDF = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
// sha256(scrypt("…the password the owner gave…", SALT)). Built in so the gate works with no setup.
const BUILT_IN = 'c47a6fe260454e4af2e09abf243cfb4c1bb2d78e3da6ee84578eec9061d6e5c7';

export const gateOn = () => String(process.env.SITE_GATE || '').toLowerCase() !== 'off';
const sha = (b) => crypto.createHash('sha256').update(b).digest();
const derive = (pw) => new Promise((ok, no) => crypto.scrypt(pw, SALT, 32, KDF, (e, k) => (e ? no(e) : ok(k))));
let check = null, checkFor = null;
async function checkValue() {
  const pw = process.env.SITE_PASSWORD || '';
  if (checkFor !== pw) { check = pw ? sha(await derive(pw)) : Buffer.from(BUILT_IN, 'hex'); checkFor = pw; }
  return check;
}
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);

function cookieValue(req) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
  }
  return '';
}
async function hasPass(req) {
  const v = cookieValue(req);
  if (!/^[A-Za-z0-9_-]{43}$/.test(v)) return false;
  return same(sha(Buffer.from(v, 'base64url')), await checkValue());
}

// what the password page and a link preview need, open to everyone
const OPEN = [
  /^\/robots\.txt$/,
  /^\/favicon\.(?:ico|svg)$/,
  /^\/assets\/fonts\/[a-z0-9-]+\.woff2$/,
  /^\/assets\/img\/brand\/seal-\d+\.png$/,
  /^\/assets\/img\/apple-touch-icon\.png$/,
  /^\/assets\/img\/og-card(?:-[a-z]+)?\.(?:jpg|png)$/,
];

const lockout = createLockout({ max: 8, windowMs: 10 * 60_000, lockMs: 10 * 60_000 });
let deriving = 0;                                     // scrypt takes 16 MB each: a few at once, no more

function readForm(req, limit = 4096) {
  return new Promise((ok) => {
    let size = 0; const chunks = [];
    // past the limit the rest is read and thrown away, so the visitor still gets an answer
    req.on('data', (c) => { size += c.length; if (size <= limit) chunks.push(c); });
    req.on('end', () => ok(size > limit ? null : new URLSearchParams(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', () => ok(null));
  });
}

const secure = (req) => String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || !!req.socket.encrypted;
const go = (res, to, extra = {}) => { res.writeHead(303, { Location: to, 'Cache-Control': 'no-store', ...extra }); res.end(); };

async function unlock(req, res) {
  const ip = clientIp(req);
  const wait = lockout.locked(ip);
  if (wait) return go(res, `/?wait=${Math.ceil(wait / 60_000)}`);
  const form = await readForm(req);
  const given = form ? String(form.get('password') || '').trim() : '';
  if (!given || given.length > 200) return go(res, '/?denied=1');
  if (deriving >= 4) return go(res, '/?busy=1');
  deriving++;
  let key;
  try { key = await derive(given); } finally { deriving--; }
  if (same(sha(key), await checkValue())) {
    lockout.clear(ip);
    const cookie = `${COOKIE}=${key.toString('base64url')}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure(req) ? '; Secure' : ''}`;
    return go(res, '/', { 'Set-Cookie': cookie });
  }
  const locked = lockout.fail(ip, sha(given).toString('hex').slice(0, 16));
  return go(res, locked ? `/?wait=${Math.ceil(locked / 60_000)}` : '/?denied=1');
}

/* ---------- the password page: the home page's own link-preview tags, the age checkpoint's look ---------- */
let HEAD = '';
export function setRoot(root) {
  try {
    const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const head = home.slice(0, home.indexOf('</head>'));
    HEAD = (head.match(/^<(?:meta (?:property="og:|name="twitter:|name="description"|name="theme-color")|link rel="(?:icon|apple-touch-icon)")[^\n]*$/gm) || [])
      .map((l) => l.replace(/href="assets\//, 'href="/assets/')).join('\n');
  } catch { HEAD = ''; }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function page(note) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Agarthan Armory</title>
<meta name="robots" content="noindex, nofollow">
${HEAD}
<style>
@font-face { font-family: Orbitron; font-weight: 900; font-display: swap; src: url(/assets/fonts/orbitron-latin-900-normal.woff2) format("woff2"); }
@font-face { font-family: "Exo 2"; font-weight: 400; font-display: swap; src: url(/assets/fonts/exo-2-latin-400-normal.woff2) format("woff2"); }
@font-face { font-family: "Exo 2"; font-weight: 600; font-display: swap; src: url(/assets/fonts/exo-2-latin-600-normal.woff2) format("woff2"); }
@font-face { font-family: "Share Tech Mono"; font-display: swap; src: url(/assets/fonts/share-tech-mono-latin-400-normal.woff2) format("woff2"); }
:root { color-scheme: dark; --cyan: #5de4ff; --frost: #ecf9ff; --text: #c7dbea; --muted: #7f98ad; --line: rgba(140, 215, 255, .15); --line-strong: rgba(140, 215, 255, .36); }
* { box-sizing: border-box; }
html { background: #03060c; }
body { margin: 0; min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 20px;
  background: radial-gradient(70% 60% at 50% 40%, #0b1f3a, rgba(3, 7, 14, .97)) fixed, #03060c;
  color: var(--text); font: 400 16px/1.6 "Exo 2", "Chakra Petch", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.card { position: relative; width: min(470px, 100%); padding: clamp(26px, 6vw, 44px); text-align: center; border: 1px solid var(--line);
  --b: var(--cyan); --bl: 14px;
  background-image: linear-gradient(var(--b), var(--b)), linear-gradient(var(--b), var(--b)), linear-gradient(var(--b), var(--b)), linear-gradient(var(--b), var(--b)),
    linear-gradient(var(--b), var(--b)), linear-gradient(var(--b), var(--b)), linear-gradient(var(--b), var(--b)), linear-gradient(var(--b), var(--b));
  background-size: var(--bl) 1px, 1px var(--bl), var(--bl) 1px, 1px var(--bl), var(--bl) 1px, 1px var(--bl), var(--bl) 1px, 1px var(--bl);
  background-position: 0 0, 0 0, 100% 0, 100% 0, 0 100%, 0 100%, 100% 100%, 100% 100%; background-repeat: no-repeat;
  background-color: rgba(9, 22, 40, .72); }
.scan { width: 116px; height: 116px; margin: 0 auto 22px; position: relative; color: var(--cyan); }
.scan svg { width: 100%; height: 100%; }
.scan .spin { transform-origin: 60px 60px; animation: sweep 6s linear infinite; }
.scan .spin2 { transform-origin: 60px 60px; animation: sweep 9s linear infinite reverse; }
.scan img { position: absolute; left: 50%; top: 50%; width: 62px; height: 62px; margin: -31px 0 0 -31px; border-radius: 50%; filter: drop-shadow(0 0 10px rgba(93, 228, 255, .6)); }
@keyframes sweep { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .scan .spin, .scan .spin2 { animation: none; } }
.eyebrow { display: inline-flex; align-items: center; gap: 10px; font: 400 12px/1 "Share Tech Mono", ui-monospace, monospace; letter-spacing: .28em; text-transform: uppercase; color: var(--cyan); }
.eyebrow::before { content: ""; width: 26px; height: 1px; background: currentColor; box-shadow: 0 0 18px rgba(93, 228, 255, .45); }
h1 { margin: 12px 0 0; font: 900 clamp(24px, 6vw, 32px)/1.08 Orbitron, "Chakra Petch", sans-serif; letter-spacing: .04em; color: var(--frost); text-transform: uppercase; }
p { margin: 14px 0 0; color: var(--muted); }
form { display: grid; gap: 12px; margin-top: 26px; text-align: left; }
label { font: 400 11px/1 "Share Tech Mono", ui-monospace, monospace; letter-spacing: .24em; text-transform: uppercase; color: var(--muted); }
input { width: 100%; height: 52px; padding: 0 16px; border: 1px solid var(--line-strong); border-radius: 0; background: rgba(3, 10, 20, .85);
  color: var(--frost); font: 400 18px/1 "Share Tech Mono", ui-monospace, monospace; letter-spacing: .12em; }
input:focus { outline: 2px solid var(--cyan); outline-offset: 2px; border-color: var(--cyan); }
button { --cut: 10px; min-height: 52px; padding: 0 26px; border: 0; cursor: pointer; color: #03121f; font: 600 14px/1 "Exo 2", system-ui, sans-serif; letter-spacing: .18em; text-transform: uppercase;
  background: linear-gradient(180deg, #e9fbff 0%, #8fe6ff 55%, #4fcdf3 100%);
  clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut)); }
button:hover, button:focus-visible { filter: brightness(1.08) drop-shadow(0 0 14px rgba(93, 228, 255, .7)); }
button:focus-visible { outline: 2px solid var(--frost); outline-offset: 3px; }
.note { margin: 2px 0 0; color: #ff8a98; font: 400 13px/1.5 "Share Tech Mono", ui-monospace, monospace; letter-spacing: .06em; }
.fine { font-size: 12px; margin-top: 22px; color: #5f788c; }
</style>
</head>
<body>
<main class="card">
  <div class="scan" aria-hidden="true">
    <svg viewBox="0 0 120 120" fill="none" stroke="currentColor">
      <circle cx="60" cy="60" r="56" stroke-opacity=".25"/>
      <g class="spin"><path d="M60 4a56 56 0 0 1 48.5 28" stroke-width="2"/><path d="M60 116a56 56 0 0 1-48.5-28" stroke-width="2"/></g>
      <g class="spin2" stroke-dasharray="3 7" stroke-opacity=".6"><circle cx="60" cy="60" r="44"/></g>
    </svg>
    <img src="/assets/img/brand/seal-160.png" alt="">
  </div>
  <span class="eyebrow">Restricted outpost</span>
  <h1>The gate is sealed</h1>
  <p>Agarthan Armory is closed to visitors for now. Enter the password to pass.</p>
  <form method="post" action="/">
    <label for="pw">Password</label>
    <input id="pw" name="password" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="200" required autofocus${note ? ' aria-describedby="note" aria-invalid="true"' : ''}>
    ${note ? `<p class="note" id="note" role="alert">${esc(note)}</p>` : ''}
    <button type="submit">Open the gate</button>
  </form>
  <p class="fine">Agarthan Armory · federally licensed firearms dealer</p>
</main>
</body>
</html>`;
}

const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

/** Answers the request when the visitor has not passed the gate (or is passing it now).
 *  Returns true when it answered, false when the site should serve the request as usual. */
export async function gate(req, res) {
  if (!gateOn()) return false;
  let p, q;
  try { const u = new URL(req.url, 'http://x'); p = path.posix.normalize(decodeURIComponent(u.pathname)); q = u.searchParams; }
  catch { res.writeHead(400); res.end(); return true; }
  if (p === '/' && req.method === 'POST') { await unlock(req, res); return true; }
  if (await hasPass(req)) return false;
  const read = req.method === 'GET' || req.method === 'HEAD';
  if (read && OPEN.some((re) => re.test(p))) return false;
  if (read && p === '/') {
    const note = q.get('wait') ? `Too many wrong passwords from here. Try again in ${Math.min(60, +q.get('wait') || 10)} minutes.`
      : q.get('busy') ? 'The gate is busy. Try again in a moment.'
      : q.get('denied') ? 'That password does not open the gate.' : '';
    const html = page(note);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': PAGE_CSP, 'Content-Length': Buffer.byteLength(html) });
    res.end(req.method === 'HEAD' ? undefined : html);
    return true;
  }
  if (read) { res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }); res.end(); return true; }
  res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ error: 'the site is password protected' }));
  return true;
}
