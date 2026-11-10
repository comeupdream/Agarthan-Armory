/* =============================================================================
 * ops.mjs — the Ops Console's API (everything under /api/), mounted by
 * server.mjs. Zero dependencies.
 *
 * Public (the storefront calls these):
 *   GET  /api/ops/status      is the console live, and which parts are set up
 *   POST /api/ops/unlock      passcode → 12-hour session token (lockout + rate limit)
 *   POST /api/inbox           a requisition (hold request) or contact message
 *   POST /api/hit             anonymous page view / search with no results
 * Console (Authorization: Bearer <token>):
 *   GET  /api/ops/settings    overrides.json + site-settings.json at the repo's head
 *   POST /api/ops/publish     product patch and/or settings → one commit to the repo
 *   GET  /api/ops/deploy      deployed commit vs the repo's head
 *   GET  /api/ops/inbox       messages;  POST /api/ops/inbox/update  status / note
 *   GET  /api/ops/traffic     page views and searches that found nothing
 *   GET  /api/ops/woo/...     read-only WooCommerce orders / sales / products
 *   GET  /api/ops/backup      everything the console keeps, as one JSON download
 * ===========================================================================*/
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { opsConfigured, passMatches, issueToken, tokenValid, bearer, clientIp, lockout, keyHash, rateLimited } from './auth.mjs';
import { githubConfigured, githubInfo, commitFiles, headSha, readAt } from './github.mjs';
import { diskStatus, readJson, update } from './store.mjs';
import { validateProductPatch, applyProductPatch, validateSettings, isEditError } from './edits.mjs';

const OVERRIDES = 'assets/data/overrides.json';
const SETTINGS = 'assets/data/site-settings.json';

let ROOT = process.cwd();
export const setRoot = (r) => { ROOT = r; };

/* ------------------------------------------------------------- plumbing */
const send = (res, status, body, extra = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(JSON.stringify(body));
};
const LIMIT = { '/api/ops/publish': 2_000_000, default: 64_000 };
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0, over = false; const chunks = [];
    req.on('data', (c) => {
      if (over) return;                                             // drain the rest without keeping it
      size += c.length;
      if (size > max) { over = true; chunks.length = 0; reject(Object.assign(new Error('That is too much to send at once.'), { status: 413 })); }
      else chunks.push(c);
    });
    req.on('end', () => {
      if (over) return;
      if (!size) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('not JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
const wooConfigured = () => !!(process.env.WOO_URL && process.env.WOO_CK && process.env.WOO_CS);
const deployed = () => (process.env.RENDER_GIT_COMMIT || '').slice(0, 40) || null;

async function localText(rel) { try { return await fs.readFile(path.join(ROOT, rel), 'utf8'); } catch { return null; } }
const parse = (t, fallback) => { try { return t ? JSON.parse(t) : fallback; } catch { return fallback; } };

/* ------------------------------------------------------------ the inbox */
const KINDS = ['requisition', 'contact', 'transfer', 'special-order'];
const STATUSES = ['new', 'contacted', 'holding', 'done', 'spam'];
const s = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);

function inboxRecord(b) {
  if (b.website) return null;                                       // honeypot: a bot filled the hidden field
  const kind = KINDS.includes(b.type) ? b.type : 'contact';
  const rec = {
    id: `m${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`,
    at: new Date().toISOString(), kind, status: 'new',
    name: s(b.name, 80), contact: s(b.contact || b.email || b.phone, 120), topic: s(b.topic, 80),
    message: s(b.message || b.note, 4000),
    items: Array.isArray(b.items) ? b.items.slice(0, 40).map((x) => s(typeof x === 'string' ? x : x && x.name, 200)).filter(Boolean) : [],
    page: s(b.page, 300), notes: [],
  };
  if (!rec.name || !rec.contact) throw Object.assign(new Error('name and a phone number or email are required'), { status: 400 });
  if (!rec.message && !rec.items.length) throw Object.assign(new Error('the message is empty'), { status: 400 });
  return rec;
}

/* ----------------------------------------------------------- traffic */
const DAY = () => new Date().toISOString().slice(0, 10);
function countHit(doc, b) {
  doc.days = doc.days || {}; doc.searches = doc.searches || {};
  const p = s(b.p, 120).replace(/[?#].*$/, '') || '/';
  if (!/^\/[\w\-./]*$/.test(p)) return;
  const d = (doc.days[DAY()] = doc.days[DAY()] || { views: 0, pages: {} });
  if (b.q !== undefined) {                                          // a search that found nothing
    const q = s(b.q, 60).toLowerCase();
    if (q) { const e = (doc.searches[q] = doc.searches[q] || { n: 0, last: '' }); e.n++; e.last = DAY(); }
    const keys = Object.keys(doc.searches);
    if (keys.length > 600) keys.sort((a, c) => doc.searches[a].n - doc.searches[c].n).slice(0, keys.length - 500).forEach((k) => delete doc.searches[k]);
    return;
  }
  d.views++;
  d.pages[p] = (d.pages[p] || 0) + 1;
  const days = Object.keys(doc.days).sort();
  for (const old of days.slice(0, Math.max(0, days.length - 180))) delete doc.days[old];
}

/* ------------------------------------------------- WooCommerce, read only */
const WOO_ALLOW = /^(orders|orders\/\d+|products|products\/\d+|reports\/sales|reports\/totals|reports\/orders\/totals|reports\/top_sellers)$/;
const WOO_PARAMS = ['per_page', 'page', 'status', 'period', 'date_min', 'date_max', 'after', 'before', 'orderby', 'order', 'search', 'sku', 'stock_status'];
async function wooProxy(res, sub, query) {
  if (!wooConfigured()) return send(res, 503, { error: 'WooCommerce is not connected', setup: 'Set WOO_URL, WOO_CK and WOO_CS (a READ-only REST key: WooCommerce → Settings → Advanced → REST API) on the Render service.' });
  // decode and normalise BEFORE the allowlist, so /products/%2e%2e/settings cannot slip past it (the PAMAX console's bug)
  let p;
  try { p = path.posix.normalize(decodeURIComponent(sub)).replace(/^\/+|\/+$/g, ''); } catch { return send(res, 400, { error: 'bad path' }); }
  if (p.includes('..') || !WOO_ALLOW.test(p)) return send(res, 403, { error: 'not an allowed WooCommerce read' });
  const qs = new URLSearchParams();
  for (const k of WOO_PARAMS) if (query.has(k)) qs.set(k, s(query.get(k), 40));
  const base = process.env.WOO_URL.replace(/\/$/, '');
  try {
    const r = await fetch(`${base}/wp-json/wc/v3/${p}${qs.size ? '?' + qs : ''}`, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${process.env.WOO_CK}:${process.env.WOO_CS}`).toString('base64'), Accept: 'application/json', 'User-Agent': 'agarthan-ops-console' },
      signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    res.writeHead(r.ok ? 200 : 502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-WP-Total': r.headers.get('x-wp-total') || '' });
    return res.end(r.ok ? text : JSON.stringify({ error: `WooCommerce answered ${r.status}` }));
  } catch (e) { return send(res, 502, { error: `WooCommerce did not answer (${e.name === 'TimeoutError' ? 'timeout' : 'network'})` }); }
}

/* ------------------------------------------------------------------ routes */
export async function handleApi(req, res, url) {
  const p = url.pathname;
  const ip = clientIp(req);
  try {
    // --- public -----------------------------------------------------------
    if (p === '/api/ops/status' && req.method === 'GET') {
      const disk = await diskStatus();
      const out = { live: opsConfigured(), github: githubConfigured(), disk: disk.ok, woo: wooConfigured() };
      // the repository and the disk's path only for a signed-in console
      if (tokenValid(bearer(req))) Object.assign(out, githubInfo(), { diskWhy: disk.ok ? undefined : disk.why, deployed: deployed() });
      return send(res, 200, out);
    }
    if (p === '/api/ops/unlock' && req.method === 'POST') {
      if (!opsConfigured()) return send(res, 503, { error: 'The console is not switched on', setup: 'Set OPS_PASSWORD (8+ characters) on the Render service, then redeploy.' });
      if (rateLimited(ip, 'unlock', 20, 60_000)) return send(res, 429, { error: 'Too many tries — wait a minute.' }, { 'Retry-After': '60' });
      const wait = lockout.locked(ip);
      if (wait) return send(res, 429, { error: `Locked for ${Math.ceil(wait / 60000)} more minute(s) after too many wrong passcodes.` }, { 'Retry-After': String(Math.ceil(wait / 1000)) });
      const body = await readBody(req, 4000);
      if (!passMatches(body.key)) {
        const locked = lockout.fail(ip, keyHash(body.key));
        return send(res, locked ? 429 : 401, { error: locked ? 'Too many wrong passcodes — locked for 15 minutes.' : 'Wrong passcode.', left: Math.max(0, lockout.max - lockout.count(ip)) });
      }
      lockout.clear(ip);
      return send(res, 200, issueToken());
    }
    if (p === '/api/inbox' && req.method === 'POST') {
      const disk = await diskStatus();
      if (!disk.ok) return send(res, 503, { error: 'inbox off', why: disk.why });
      if (rateLimited(ip, 'inbox', 6, 10 * 60_000)) return send(res, 429, { error: 'Too many messages — please call us instead.' });
      const rec = inboxRecord(await readBody(req, 24_000));
      if (rec) await update('inbox.json', [], (list) => { list.unshift(rec); if (list.length > 5000) list.length = 5000; });
      return send(res, 200, { ok: true });
    }
    if (p === '/api/hit' && req.method === 'POST') {
      const disk = await diskStatus();
      if (!disk.ok || rateLimited(ip, 'hit', 120, 60_000)) { res.writeHead(204); return res.end(); }
      const b = await readBody(req, 2000);
      await update('traffic.json', {}, (doc) => countHit(doc, b));
      res.writeHead(204); return res.end();
    }

    // --- console ----------------------------------------------------------
    if (!p.startsWith('/api/ops/')) return send(res, 404, { error: 'no such route' });
    if (!opsConfigured()) return send(res, 503, { error: 'The console is not switched on', setup: 'Set OPS_PASSWORD on the Render service.' });
    if (!tokenValid(bearer(req))) return send(res, 401, { error: 'Signed out — unlock again.' });
    if (rateLimited(ip, 'ops', 600, 60_000)) return send(res, 429, { error: 'Slow down a little.' });

    if (p === '/api/ops/settings' && req.method === 'GET') {
      if (githubConfigured()) {
        const head = await headSha();
        const [o, st] = await Promise.all([readAt(head, OVERRIDES), readAt(head, SETTINGS)]);
        return send(res, 200, { source: 'github', head, overrides: parse(o, {}), settings: parse(st, {}) });
      }
      return send(res, 200, { source: 'local', head: deployed(), overrides: parse(await localText(OVERRIDES), {}), settings: parse(await localText(SETTINGS), {}) });
    }
    if (p === '/api/ops/publish' && req.method === 'POST') {
      if (!githubConfigured()) return send(res, 503, { error: 'Publishing is not connected', setup: 'Set GH_TOKEN (fine-grained token, this repository only, Contents: Read and write) on the Render service. Until then use Export in Tools and commit the file.' });
      const body = await readBody(req, LIMIT['/api/ops/publish']);
      const patch = body.products ? validateProductPatch(body.products) : null;
      const settings = body.settings ? validateSettings(body.settings) : null;
      if (!patch && !settings) return send(res, 400, { error: 'nothing to publish' });
      const who = s(body.by, 40);
      let summary = null;
      const lines = [];
      const result = await commitFiles(async (read) => {
        const files = [];
        if (patch) {
          const doc = parse(await read(OVERRIDES), {});
          summary = applyProductPatch(doc, patch);
          files.push({ path: OVERRIDES, content: JSON.stringify(doc, null, 2) + '\n' });
        }
        if (settings) {
          const cur = parse(await read(SETTINGS), {});
          files.push({ path: SETTINGS, content: JSON.stringify({ ...cur, ...settings }, null, 2) + '\n' });
        }
        return files;
      }, (() => {
        if (patch) lines.push(`${Object.keys(patch).length} product(s)`);
        if (settings) lines.push(Object.keys(settings).join(' + '));
        return `Ops Console: ${lines.join(', ')}${who ? ` (${who})` : ''}\n\n${s(body.note, 500) || 'Published from the Ops Console.'}`;
      })());
      return send(res, 200, { ok: true, commit: result.sha, url: result.url, summary });
    }
    if (p === '/api/ops/deploy' && req.method === 'GET') {
      const head = githubConfigured() ? await headSha() : null;
      const dep = deployed();
      return send(res, 200, { deployed: dep, head, pending: !!(head && dep && head !== dep) });
    }
    if (p === '/api/ops/inbox' && req.method === 'GET') {
      const disk = await diskStatus();
      if (!disk.ok) return send(res, 503, { error: 'The inbox needs a disk', setup: `Attach a 1 GB disk to the Render service at /var/data and set DATA_DIR=/var/data. (${disk.why})` });
      return send(res, 200, { messages: await readJson('inbox.json', []) });
    }
    if (p === '/api/ops/inbox/update' && req.method === 'POST') {
      const disk = await diskStatus();
      if (!disk.ok) return send(res, 503, { error: 'The inbox needs a disk' });
      const b = await readBody(req, 8000);
      const found = await update('inbox.json', [], (list) => {
        const m = list.find((x) => x.id === b.id);
        if (!m) return null;
        if (b.status) { if (!STATUSES.includes(b.status)) throw Object.assign(new Error('unknown status'), { status: 400 }); m.status = b.status; }
        if (b.note) m.notes.push({ at: new Date().toISOString(), text: s(b.note, 1000) });
        if (b.remove === true) list.splice(list.indexOf(m), 1);
        return m;
      });
      return found ? send(res, 200, { ok: true, message: found }) : send(res, 404, { error: 'no such message' });
    }
    if (p === '/api/ops/traffic' && req.method === 'GET') {
      const disk = await diskStatus();
      if (!disk.ok) return send(res, 503, { error: 'Traffic needs a disk', setup: 'Attach a disk at /var/data and set DATA_DIR=/var/data.' });
      return send(res, 200, await readJson('traffic.json', {}));
    }
    if (p.startsWith('/api/ops/woo/')) {
      if (req.method !== 'GET') return send(res, 405, { error: 'read only' }, { Allow: 'GET' });
      return wooProxy(res, p.slice('/api/ops/woo/'.length), url.searchParams);
    }
    if (p === '/api/ops/backup' && req.method === 'GET') {
      const disk = await diskStatus();
      const out = {
        at: new Date().toISOString(), deployed: deployed(),
        overrides: parse(await localText(OVERRIDES), {}), settings: parse(await localText(SETTINGS), {}),
        inbox: disk.ok ? await readJson('inbox.json', []) : null, traffic: disk.ok ? await readJson('traffic.json', {}) : null,
      };
      return send(res, 200, out, { 'Content-Disposition': `attachment; filename="agarthan-ops-backup-${DAY()}.json"` });
    }
    return send(res, 404, { error: 'no such route' });
  } catch (e) {
    if (isEditError(e)) return send(res, 400, { error: e.message });
    if (e.status) return send(res, e.status, { error: e.message }, e.status === 413 ? { Connection: 'close' } : {});
    if (/^GitHub /.test(e.message || '')) return send(res, 502, { error: e.message });
    console.error('ops error', e);
    return send(res, 500, { error: 'something went wrong on the server' });
  }
}

/* ---------------------------------------------- config.js + site settings */
/** config.js as served: the file, then the console's published settings on top */
export async function configScript(root = ROOT) {
  const [cfg, settings] = await Promise.all([localText('assets/js/config.js'), localText(SETTINGS)]);
  const st = parse(settings, {});
  if (!st.facts && !st.notices && !st.synonyms) return cfg;
  const json = JSON.stringify({ facts: st.facts || {}, notices: st.notices || [], synonyms: st.synonyms || [] }).replace(/</g, '\\u003c');
  return `${cfg}
/* published from the Ops Console (assets/data/site-settings.json) */
(function (s) {
  var c = window.AA_CONFIG = window.AA_CONFIG || {};
  Object.keys(s.facts).forEach(function (k) {
    var v = s.facts[k];
    c[k] = v && typeof v === 'object' && !Array.isArray(v) && c[k] && typeof c[k] === 'object' ? Object.assign({}, c[k], v) : v;
  });
  c.notices = s.notices; c.synonyms = s.synonyms;
})(${json});
`;
}
