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
  return segs[0] === 'assets' && segs[1] !== 'data' || (segs[0] === 'assets' && segs[1] === 'data' && segs.length === 3 && segs[2].endsWith('.js'));
};

http.createServer((req, res) => {
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
    const head = {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    };
    // byte ranges: Safari and iOS will not play a video without them
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
