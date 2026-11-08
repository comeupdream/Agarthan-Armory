#!/usr/bin/env node
/*
 * stamp-partials.mjs — copies partials/*.html into every page between
 *   <!-- partial:NAME --> … <!-- /partial:NAME -->
 * so the header, footer and age gate live in one place while the pages stay
 * plain static HTML (no build needed to serve them). Run after editing a
 * partial:  node tools/stamp-partials.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  fs.writeFileSync(file, html);
  console.log(`${page}: ${n} partial(s)`);
}
