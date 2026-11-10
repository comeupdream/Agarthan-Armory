/* =============================================================================
 * github.mjs — where the Ops Console's edits are saved: commits to the
 * site's own GitHub repo. Render redeploys every commit to main, and the
 * boot build (scripts/boot.mjs) applies the new overrides, so a published
 * edit is live in a few minutes, survives every deploy, and leaves a history
 * of who changed what in git — no paid disk needed for it.
 *
 * Needs GH_TOKEN: a fine-grained personal access token limited to this one
 * repository with Contents: Read and write. GH_REPO (owner/name) and GH_BRANCH
 * default to what Render reports for the deploy (RENDER_GIT_REPO_SLUG,
 * RENDER_GIT_BRANCH), else main.
 *
 * Several files go in ONE commit (git data API: tree → commit → move the
 * branch), so one publish = one deploy. If someone else pushed meanwhile, the
 * branch move is refused; the edit is re-applied to the new files and tried
 * again — the console never overwrites a commit it did not see.
 * ===========================================================================*/
const cfg = () => ({
  token: process.env.GH_TOKEN || '',
  repo: process.env.GH_REPO || process.env.RENDER_GIT_REPO_SLUG || '',
  branch: process.env.GH_BRANCH || process.env.RENDER_GIT_BRANCH || 'main',
  api: (process.env.GH_API || 'https://api.github.com').replace(/\/$/, ''),
});
export const githubConfigured = () => { const c = cfg(); return !!(c.token && /^[\w.-]+\/[\w.-]+$/.test(c.repo)); };
export const githubInfo = () => { const c = cfg(); return { repo: c.repo || null, branch: c.branch }; };

class GitHubError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

async function gh(method, path, body, accept) {
  const c = cfg();
  const r = await fetch(`${c.api}/repos/${c.repo}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'agarthan-ops-console',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (r.status === 404 && method === 'GET' && accept) return null;               // a file that is not there yet
  if (!r.ok) {
    let why = '';
    try { why = (await r.json()).message || ''; } catch { /* not json */ }
    const hint = r.status === 401 ? ' — GH_TOKEN is wrong or expired'
      : r.status === 403 || r.status === 404 ? ' — GH_TOKEN needs Contents: Read and write on this repository'
        : '';
    throw new GitHubError(`GitHub ${method} ${path.split('?')[0]} → ${r.status} ${why}${hint}`.trim(), r.status);
  }
  return accept ? r.text() : r.json();
}

/** the branch's latest commit sha */
export async function headSha() {
  const c = cfg();
  return (await gh('GET', `/git/ref/heads/${encodeURIComponent(c.branch)}`)).object.sha;
}

/** a file's text at a commit (null when the file does not exist) */
export async function readAt(sha, path) {
  return gh('GET', `/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${sha}`, null, 'application/vnd.github.raw+json');
}

/**
 * build(read) returns [{ path, content }] from the files as they are at the
 * branch head (read(path) → text|null). Commits them as one commit and moves
 * the branch; retries on a race. Returns { sha, url }.
 */
export async function commitFiles(build, message, { tries = 4 } = {}) {
  const c = cfg();
  for (let attempt = 1; ; attempt++) {
    const head = await headSha();
    const files = await build((p) => readAt(head, p));
    if (!files.length) return { sha: head, url: null, unchanged: true };
    const base = await gh('GET', `/git/commits/${head}`);
    // text goes in as content; photos as base64 blobs first
    const entries = [];
    for (const f of files) {
      if (f.base64 !== undefined) {
        const blob = await gh('POST', '/git/blobs', { content: f.base64, encoding: 'base64' });
        entries.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
      } else entries.push({ path: f.path, mode: '100644', type: 'blob', content: f.content });
    }
    const tree = await gh('POST', '/git/trees', { base_tree: base.tree.sha, tree: entries });
    const commit = await gh('POST', '/git/commits', { message, tree: tree.sha, parents: [head] });
    try {
      await gh('PATCH', `/git/refs/heads/${encodeURIComponent(c.branch)}`, { sha: commit.sha, force: false });
      return { sha: commit.sha, url: commit.html_url || `https://github.com/${c.repo}/commit/${commit.sha}` };
    } catch (e) {
      if (!(e instanceof GitHubError) || e.status !== 422 || attempt >= tries) throw e;   // 422: someone pushed first — redo on top
    }
  }
}

/** recent commits that touched any of these files, newest first */
export async function history(paths, limit = 25) {
  const c = cfg();
  const seen = new Map();
  for (const p of paths) {
    const list = await gh('GET', `/commits?sha=${encodeURIComponent(c.branch)}&path=${encodeURIComponent(p)}&per_page=${limit}`);
    for (const x of list || []) {
      if (seen.has(x.sha)) { seen.get(x.sha).files.push(p); continue; }
      seen.set(x.sha, { sha: x.sha, message: String((x.commit && x.commit.message) || '').split('\n')[0].slice(0, 200), author: (x.commit && x.commit.author && x.commit.author.name) || '', date: (x.commit && x.commit.author && x.commit.author.date) || '', url: x.html_url || '', files: [p] });
    }
  }
  return [...seen.values()].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, limit);
}
