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
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`Agarthan Armory → http://localhost:${PORT}`));
