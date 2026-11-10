/* =============================================================================
 * auth.mjs — the Ops Console's front door.
 *
 * One shared passcode (OPS_PASSWORD, set in Render's dashboard, never in the
 * repo). It is checked once, at unlock, in constant time; the console then
 * carries a signed session token (12 hours) instead of the passcode, so a
 * leaked token expires and the passcode itself never sits in the browser —
 * an improvement on the PAMAX and XAT consoles, which keep the raw key.
 * Rotating OPS_PASSWORD signs everyone out.
 *
 * The token travels in an Authorization header, never a cookie, so a page
 * on another site cannot make the browser send it (no CSRF), and the server
 * sends no CORS headers.
 * ===========================================================================*/
import crypto from 'node:crypto';
import { createLockout } from './lockout.mjs';

const PASS = () => process.env.OPS_PASSWORD || '';
export const opsConfigured = () => PASS().length >= 8;
const TOKEN_MS = 12 * 60 * 60 * 1000;

const secret = () => crypto.createHash('sha256').update(`agarthan-ops|${PASS()}|${process.env.OPS_SECRET || ''}`).digest();
const b64 = (buf) => Buffer.from(buf).toString('base64url');

export function passMatches(given) {
  const want = PASS();
  if (want.length < 8) return false;
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueToken(now = Date.now()) {
  const payload = b64(JSON.stringify({ exp: now + TOKEN_MS, n: crypto.randomBytes(6).toString('hex') }));
  const sig = b64(crypto.createHmac('sha256', secret()).update(payload).digest());
  return { token: `${payload}.${sig}`, expires: new Date(now + TOKEN_MS).toISOString() };
}

export function tokenValid(token, now = Date.now()) {
  if (!opsConfigured() || typeof token !== 'string' || token.length > 400) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const want = crypto.createHmac('sha256', secret()).update(payload).digest();
  let got;
  try { got = Buffer.from(sig, 'base64url'); } catch { return false; }
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp > now; } catch { return false; }
}

export const bearer = (req) => (/^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '') || [])[1] || '';

/** The visitor's address. Render's proxy appends the real client to
 *  X-Forwarded-For, so with TRUST_PROXY=1 (the default) the LAST entry is
 *  trusted — anything earlier can be typed by the client. */
export function clientIp(req) {
  const hops = Math.max(0, parseInt(process.env.TRUST_PROXY ?? '1', 10) || 0);
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (hops && xff.length >= hops) return xff[xff.length - hops];
  return req.socket.remoteAddress || 'unknown';
}

export const lockout = createLockout({ max: 10, windowMs: 15 * 60_000, lockMs: 15 * 60_000 });
export const keyHash = (k) => crypto.createHash('sha256').update(String(k || '')).digest('hex').slice(0, 16);

/** fixed-window rate limits per address and bucket, memory-capped */
const windows = new Map();
export function rateLimited(ip, bucket, max, windowMs, now = Date.now()) {
  const k = `${bucket}|${ip}`;
  let w = windows.get(k);
  if (!w || now - w.start >= windowMs) { w = { start: now, n: 0 }; windows.set(k, w); }
  w.n++;
  if (windows.size > 20000) for (const [key, v] of windows) { if (now - v.start >= 3600_000) windows.delete(key); if (windows.size <= 15000) break; }
  return w.n > max;
}
