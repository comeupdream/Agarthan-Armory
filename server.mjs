#!/usr/bin/env node
/*
 * server.mjs — zero-dependency static server for local preview (npm start)
 * or a Render/railway-style web service. The site itself is plain static
 * files; any static host (Netlify, Cloudflare Pages, Render Static) works
 * with the repo root as the publish directory and no build command.
 *
 * Serves only the public tree: pages, assets/, favicon, robots, sitemap.
 * tools/, scripts/, partials/ and dotfiles are never served.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.PORT || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const PUBLIC = (p) => {
  const segs = p.split('/').filter(Boolean);
  if (segs.some((s) => s.startsWith('.') || s.startsWith('_'))) return false;
  if (segs.length === 1) return /\.(html|svg|ico|txt|xml|png)$/.test(segs[0]);
  if (segs[0] !== 'assets') return false;
  if (segs[1] !== 'data') return true;
  // assets/data: the catalog script and the per-item detail files only (never scraped/ or overrides)
  return (segs.length === 3 && segs[2].endsWith('.js')) || (segs.length === 4 && segs[2] === 'items' && segs[3].endsWith('.json'));
};

// /version: what is deployed — the commit Render built (RENDER_GIT_COMMIT) and the catalog it serves
const STARTED = new Date().toISOString();
const versionInfo = () => {
  let items = null, updated = null, source = null;
  try {
    const cat = fs.readFileSync(path.join(ROOT, 'assets', 'data', 'catalog.js'), 'utf8');
    items = (cat.match(/^\{"id":/gm) || []).length;
    const head = cat.slice(0, 600);
    updated = (head.match(/"updated":"([^"]+)"/) || [])[1] || null;
    source = (head.match(/"source":"([^"]+)"/) || [])[1] || null;
  } catch { /* no catalog */ }
  return { commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || 'local', branch: process.env.RENDER_GIT_BRANCH || null, started: STARTED, catalog: { items, updated, source } };
};

http.createServer((req, res) => {
  if (req.url === '/version' || req.url === '/version.json') {
    res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(versionInfo(), null, 2));
  }
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (p.includes('\0')) { res.writeHead(400); return res.end(); }
  p = path.posix.normalize(p);
  if (p === '/') p = '/index.html';
  if (!path.extname(p) && fs.existsSync(path.join(ROOT, p + '.html'))) p += '.html';   // clean URLs
  const file = path.join(ROOT, p);
  const send404 = () => {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    fs.createReadStream(path.join(ROOT, '404.html')).on('error', () => res.end('Not found')).pipe(res);
  };
  if (!file.startsWith(ROOT + path.sep) || !PUBLIC(p)) return send404();
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send404();
    const ext = path.extname(file).toLowerCase();
    // text compresses ~4:1 — the catalog script is the one that matters
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /\.(html|css|js|json|svg|txt|xml)$/.test(ext);
    // pages, styles, scripts and data are re-checked on every visit (a cheap
    // 304 when unchanged), so an update reaches everyone at once; a day-long
    // cache once left visitors with new pages on an old stylesheet. Photos,
    // fonts and video keep the day-long cache.
    const longCache = /\.(woff2|png|jpe?g|webp|gif|avif|ico|mp4)$/.test(ext);
    const modified = st.mtime.toUTCString();
    if (!longCache && req.headers['if-modified-since'] === modified) {
      res.writeHead(304, { 'Last-Modified': modified, 'Cache-Control': 'no-cache' });
      return res.end();
    }
    const head = {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': longCache ? 'public, max-age=86400' : 'no-cache',
      'Last-Modified': modified,
      'X-Content-Type-Options': 'nosniff',
    };
    if (gzip) {
      res.writeHead(200, { ...head, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      return fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
    }
    // byte ranges, for files sent as-is: Safari and iOS will not play a video without them
    head['Accept-Ranges'] = 'bytes';
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      const start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]);
      const end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
        return res.end();
      }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...head, 'Content-Length': st.size });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`Agarthan Armory → http://localhost:${PORT}`));
