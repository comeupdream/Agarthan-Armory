/* lib-mock-github.mjs — a stand-in for the parts of the GitHub API the Ops
 * Console uses (refs, raw file contents, blobs, trees, commits, moving the
 * branch, the commit list for a path), plus a stand-in WooCommerce store and
 * a stand-in email provider. In memory; for the tests only.
 *   const gh = await mockGitHub({ 'assets/data/overrides.json': '{…}' });
 *   gh.url, gh.files(), gh.bytes(path), gh.commits, gh.raceNext()   // next branch move loses a race once
 */
import http from 'node:http';
import crypto from 'node:crypto';

const sha = () => crypto.randomBytes(20).toString('hex');

export async function mockGitHub(initial = {}, { repo = 'test/repo', branch = 'main', token = 'gh-test-token' } = {}) {
  const trees = new Map(); const commits = new Map(); const blobs = new Map(); const changed = new Map();
  const rootTree = sha(); trees.set(rootTree, { ...initial });
  let head = sha(); commits.set(head, { tree: rootTree, parents: [], message: 'initial', changed: Object.keys(initial), date: '2026-01-01T00:00:00Z' });
  let clock = Date.parse('2026-11-10T12:00:00Z');
  const log = []; let race = 0; const calls = [];
  const filesAt = (c) => trees.get(commits.get(c).tree);

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const body = await new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b ? JSON.parse(b) : null)); });
    calls.push(`${req.method} ${u.pathname}`);
    const json = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.headers.authorization !== `Bearer ${token}`) return json(401, { message: 'Bad credentials' });
    const base = `/repos/${repo}`;
    if (!u.pathname.startsWith(base)) return json(404, { message: 'Not Found' });
    const p = u.pathname.slice(base.length);
    if (req.method === 'GET' && p === `/git/ref/heads/${branch}`) return json(200, { object: { sha: head } });
    if (req.method === 'GET' && p.startsWith('/contents/')) {
      const file = decodeURIComponent(p.slice('/contents/'.length));
      const at = u.searchParams.get('ref');
      const files = commits.has(at) ? filesAt(at) : null;
      if (!files || !(file in files)) return json(404, { message: 'Not Found' });
      const v = files[file];
      res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(typeof v === 'string' ? v : blobs.get(v.blob));
    }
    if (req.method === 'GET' && p.startsWith('/git/commits/')) {
      const c = commits.get(p.slice('/git/commits/'.length));
      return c ? json(200, { sha: p.slice(13), tree: { sha: c.tree } }) : json(404, { message: 'Not Found' });
    }
    if (req.method === 'POST' && p === '/git/blobs') {
      if (body.encoding !== 'base64' || typeof body.content !== 'string') return json(422, { message: 'Invalid blob' });
      const b = sha(); blobs.set(b, Buffer.from(body.content, 'base64')); return json(201, { sha: b });
    }
    if (req.method === 'POST' && p === '/git/trees') {
      const t = sha(); const files = { ...(trees.get(body.base_tree) || {}) };
      for (const e of body.tree) {
        if (e.sha) { if (!blobs.has(e.sha)) return json(422, { message: 'Invalid tree: unknown blob' }); files[e.path] = { blob: e.sha }; }
        else files[e.path] = e.content;
      }
      trees.set(t, files); changed.set(t, body.tree.map((e) => e.path)); return json(201, { sha: t });
    }
    if (req.method === 'GET' && p === '/commits') {
      const path = u.searchParams.get('path'); const per = +u.searchParams.get('per_page') || 30;
      if (u.searchParams.get('sha') !== branch) return json(404, { message: 'No commit found' });
      const out = [];
      for (let c = head; c && out.length < per; c = commits.get(c).parents[0]) {
        const x = commits.get(c);
        if (!path || (x.changed || []).includes(path)) out.push({ sha: c, html_url: `https://github.com/${repo}/commit/${c}`, commit: { message: x.message, author: { name: x.author || 'Ops Console', date: x.date } } });
      }
      return json(200, out);
    }
    if (req.method === 'POST' && p === '/git/commits') {
      clock += 60000;
      const c = sha(); commits.set(c, { tree: body.tree, parents: body.parents, message: body.message, changed: changed.get(body.tree) || [], date: new Date(clock).toISOString() });
      return json(201, { sha: c, html_url: `https://github.com/${repo}/commit/${c}` });
    }
    if (req.method === 'PATCH' && p === `/git/refs/heads/${branch}`) {
      if (race > 0) {                                   // someone else pushed first: a commit touching another file
        race--;
        const t = sha(); trees.set(t, { ...filesAt(head), 'README.md': `pushed by someone else ${Date.now()}` });
        clock += 60000;
        const c = sha(); commits.set(c, { tree: t, parents: [head], message: 'someone else', changed: ['README.md'], author: 'Someone', date: new Date(clock).toISOString() }); head = c; log.push('someone else');
      }
      const c = commits.get(body.sha);
      if (!c || c.parents[0] !== head) return json(422, { message: 'Update is not a fast forward' });
      head = body.sha; log.push(c.message);
      return json(200, { object: { sha: head } });
    }
    return json(404, { message: 'Not Found' });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${server.address().port}`, repo, branch, token,
    files: () => filesAt(head), head: () => head, commits: log, calls,
    bytes: (file) => { const v = filesAt(head)[file]; return v === undefined ? null : typeof v === 'string' ? Buffer.from(v) : blobs.get(v.blob); },
    raceNext: (n = 1) => { race = n; },
    close: () => server.close(),
  };
}

export async function mockWoo({ ck = 'ck_test', cs = 'cs_test' } = {}) {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    if (req.url === '/') {                                  // the shop's home page, as the theme check fetches it
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`<html><head><link rel='stylesheet' id='storefront-style-css' href='/wp-content/themes/storefront/style.css?ver=4.6.1'><link rel='stylesheet' id='agarthan-skin-css' href='/wp-content/themes/agarthan-armory/style.css?ver=1.2.0' media='all'></head><body><div id="aa-gate" hidden></div></body></html>`);
    }
    const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64');
    if (req.headers.authorization !== auth) { res.writeHead(401); return res.end('{}'); }
    const u = new URL(req.url, 'http://x');
    res.writeHead(200, { 'Content-Type': 'application/json', 'X-WP-Total': '2' });
    if (u.pathname === '/wp-json/wc/v3/orders') return res.end(JSON.stringify([
      { id: 41, number: '41', date_created: '2026-11-09T15:00:00', status: 'processing', total: '32.00', billing: { first_name: 'Ada', last_name: 'Byrd', email: 'ada@example.com', phone: '(954) 555-0142' }, line_items: [{ quantity: 1, name: 'Expedition Tee', total: '32.00' }], agarthan_release: { 'Release method': 'Ship to an FFL dealer', 'Receiving FFL': 'Gulf Coast Arms · (954) 555-0199' } },
      { id: 40, number: '40', date_created: '2026-11-08T11:00:00', status: 'completed', total: '64.00', billing: { first_name: '<img src=x onerror=alert(1)>', last_name: '' }, line_items: [] },
    ]));
    if (u.pathname === '/wp-json/wc/v3/reports/sales') return res.end(JSON.stringify([{ total_sales: '96.00', total_orders: 2, average_sales: '3.20', totals: { '2026-11-08': { sales: '64.00', orders: 1 }, '2026-11-09': { sales: '32.00', orders: 1 } } }]));
    res.end('[]');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, ck, cs, seen, close: () => server.close() };
}

/** a stand-in for Resend: POST /emails with the key; what was sent is in .sent */
export async function mockMail({ key = 're_test_key' } = {}) {
  const sent = [];
  const server = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c));
    req.on('end', () => {
      const json = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.method !== 'POST' || req.url !== '/emails') return json(404, { message: 'Not Found' });
      if (req.headers.authorization !== `Bearer ${key}`) return json(401, { message: 'API key is invalid' });
      const m = JSON.parse(b || '{}');
      if (!Array.isArray(m.to) || !m.from || !m.subject) return json(422, { message: 'Missing fields' });
      sent.push(m); json(200, { id: `mail-${sent.length}` });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, key, sent, close: () => server.close() };
}
