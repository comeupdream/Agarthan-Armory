#!/usr/bin/env node
/*
 * stamp-partials.mjs — copies partials/*.html into every page between
 *   <!-- partial:NAME --> … <!-- /partial:NAME -->
 * so the header, footer and age gate live in one place while the pages stay
 * plain static HTML (no build needed to serve them). Also stamps every local
 * stylesheet/script link (the catalog included) with ?v=<content hash>. Run after editing a partial,
 * a stylesheet or a script:  node tools/stamp-partials.mjs  (npm run stamp)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const partials = Object.fromEntries(fs.readdirSync(path.join(ROOT, 'partials'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => [f.replace(/\.html$/, ''), fs.readFileSync(path.join(ROOT, 'partials', f), 'utf8').trim()]));
for (const page of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  const file = path.join(ROOT, page);
  let html = fs.readFileSync(file, 'utf8');
  let n = 0;
  html = html.replace(/<!-- partial:([a-z-]+) -->[\s\S]*?<!-- \/partial:\1 -->/g, (m, name) => {
    if (!partials[name]) { console.warn(`  ${page}: no partials/${name}.html`); return m; }
    n++;
    return `<!-- partial:${name} -->\n${partials[name]}\n<!-- /partial:${name} -->`;
  });
  // version every local stylesheet/script link by its content, so a changed
  // file is a new URL and no browser can keep serving a stale copy
  let v = 0;
  // the catalog too: browsers that kept an old copy (an earlier server allowed a day) fetch the new one at once
  html = html.replace(/((?:href|src)=")(\/?assets\/(?:css|js|data)\/[\w.-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g, (m, attr, ref) => {
    const f = path.join(ROOT, ref.replace(/^\//, ''));
    if (!fs.existsSync(f)) return m;
    v++;
    return `${attr}${ref}?v=${crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10)}"`;
  });
  fs.writeFileSync(file, html);
  console.log(`${page}: ${n} partial(s), ${v} versioned link(s)`);
}
