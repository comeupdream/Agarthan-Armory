/* lib-mock-github.mjs — a stand-in for the parts of the GitHub API the Ops
 * Console uses (refs, raw file contents, trees, commits, moving the branch),
 * plus a stand-in WooCommerce REST API. In memory; for the tests only.
 *   const gh = await mockGitHub({ 'assets/data/overrides.json': '{…}' });
 *   gh.url, gh.files(), gh.commits, gh.raceNext()   // next branch move loses a race once
 */
import http from 'node:http';
import crypto from 'node:crypto';

const sha = () => crypto.randomBytes(20).toString('hex');

export async function mockGitHub(initial = {}, { repo = 'test/repo', branch = 'main', token = 'gh-test-token' } = {}) {
  const trees = new Map(); const commits = new Map();
  const rootTree = sha(); trees.set(rootTree, { ...initial });
  let head = sha(); commits.set(head, { tree: rootTree, parents: [], message: 'initial' });
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
      res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(files[file]);
    }
    if (req.method === 'GET' && p.startsWith('/git/commits/')) {
      const c = commits.get(p.slice('/git/commits/'.length));
      return c ? json(200, { sha: p.slice(13), tree: { sha: c.tree } }) : json(404, { message: 'Not Found' });
    }
    if (req.method === 'POST' && p === '/git/trees') {
      const t = sha(); const files = { ...(trees.get(body.base_tree) || {}) };
      for (const e of body.tree) files[e.path] = e.content;
      trees.set(t, files); return json(201, { sha: t });
    }
    if (req.method === 'POST' && p === '/git/commits') {
      const c = sha(); commits.set(c, { tree: body.tree, parents: body.parents, message: body.message });
      return json(201, { sha: c, html_url: `https://github.com/${repo}/commit/${c}` });
    }
    if (req.method === 'PATCH' && p === `/git/refs/heads/${branch}`) {
      if (race > 0) {                                   // someone else pushed first: a commit touching another file
        race--;
        const t = sha(); trees.set(t, { ...filesAt(head), 'README.md': `pushed by someone else ${Date.now()}` });
        const c = sha(); commits.set(c, { tree: t, parents: [head], message: 'someone else' }); head = c; log.push('someone else');
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
    raceNext: (n = 1) => { race = n; },
    close: () => server.close(),
  };
}

export async function mockWoo({ ck = 'ck_test', cs = 'cs_test' } = {}) {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64');
    if (req.headers.authorization !== auth) { res.writeHead(401); return res.end('{}'); }
    const u = new URL(req.url, 'http://x');
    res.writeHead(200, { 'Content-Type': 'application/json', 'X-WP-Total': '2' });
    if (u.pathname === '/wp-json/wc/v3/orders') return res.end(JSON.stringify([
      { id: 41, number: '41', date_created: '2026-11-09T15:00:00', status: 'processing', total: '32.00', billing: { first_name: 'Ada', last_name: 'Byrd' }, line_items: [{ quantity: 1, name: 'Expedition Tee' }] },
      { id: 40, number: '40', date_created: '2026-11-08T11:00:00', status: 'completed', total: '64.00', billing: { first_name: '<img src=x onerror=alert(1)>', last_name: '' }, line_items: [] },
    ]));
    if (u.pathname === '/wp-json/wc/v3/reports/sales') return res.end(JSON.stringify([{ total_sales: '96.00', total_orders: 2, average_sales: '3.20' }]));
    res.end('[]');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, ck, cs, seen, close: () => server.close() };
}
