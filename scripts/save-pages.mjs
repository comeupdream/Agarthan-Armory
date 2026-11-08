#!/usr/bin/env node
/* =============================================================================
 * save-pages.mjs — save a few of the store's product pages and print what is
 * on them, so the scraper can be taught where a store keeps its variant
 * details (caliber, grain, round count, barrel length…).
 *
 * Reads the last scrape (assets/data/scraped/<folder>/catalog.json), takes
 * --per products from each category, fetches each page once (one at a time,
 * --delay ms apart), saves the HTML to --out and prints a digest: the
 * structured data, dropdowns, spec rows, the visible text under the title,
 * and the markup around any "caliber / grain / rounds" mention. Also lists
 * the store's menu, so missing departments (firearms?) show up.
 *
 *   node scripts/save-pages.mjs                         # shop, 1 per category
 *   node scripts/save-pages.mjs --folder shop --per 2 --out pages
 *   node scripts/save-pages.mjs --ids <id>,<id>         # particular products
 *
 * shop.agarthanarmory.com sits behind a CloudFront firewall that refuses
 * cloud servers (GitHub Actions included): run this from a home connection.
 * ===========================================================================*/
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripHtml, specTable } from './scrape.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.lastIndexOf('--' + n); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const FOLDER = arg('folder', 'shop').replace(/[^a-z0-9-]/gi, '');
const SRC = path.resolve(arg('catalog', path.join('assets/data/scraped', FOLDER, 'catalog.json')));
const OUT = path.resolve(arg('out', path.join('assets/data/scraped', FOLDER, 'pages')));
const PER = Math.max(1, parseInt(arg('per', '1'), 10) || 1);
const DELAY = Math.max(0, parseInt(arg('delay', '1500'), 10) || 0);
const IDS = (arg('ids', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cut = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; };

async function get(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' }, signal: ctl.signal });
    return { status: r.status, url: r.url, text: await r.text() };
  } catch (e) { return { status: 0, error: e.message, text: '' }; } finally { clearTimeout(t); }
}

/** a compact picture of one product page */
export function digest(html) {
  const out = [];
  // structured data, as the page gives it (long copy trimmed)
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].trim());
      const trim = (o) => (Array.isArray(o) ? o.slice(0, 6).map(trim) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? cut(v, 90) : trim(v)])) : o);
      out.push('  JSON-LD ' + cut(JSON.stringify(trim(j)), 1500));
    } catch { out.push('  JSON-LD (unparsable)'); }
  }
  // dropdowns and radio groups: where variant pickers live
  for (const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const name = (m[1].match(/(?:name|id|aria-label)=["']([^"']+)/i) || [])[1] || '?';
    const opts = [...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((o) => (/selected/i.test(o[1]) ? '*' : '') + stripHtml(o[2]).trim());
    out.push(`  SELECT ${name}: ${cut(opts.slice(0, 12).join(' | '), 400)}`);
  }
  const radios = {};
  for (const m of html.matchAll(/<input\b[^>]*type=["'](?:radio|checkbox)["'][^>]*>/gi)) {
    const n = (m[0].match(/name=["']([^"']+)/i) || [])[1]; const v = (m[0].match(/value=["']([^"']*)/i) || [])[1];
    if (n) (radios[n] = radios[n] || []).push((/checked/i.test(m[0]) ? '*' : '') + v);
  }
  for (const [n, v] of Object.entries(radios)) out.push(`  RADIO ${n}: ${cut(v.slice(0, 12).join(' | '), 300)}`);
  const spec = specTable(html);
  out.push('  SPEC ROWS ' + JSON.stringify(spec));
  // app state embedded in the page (Next/Nuxt/Angular/etc.)
  const states = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .map((m) => ({ attrs: m[1], body: m[2] }))
    .filter((s) => /__NEXT_DATA__|__NUXT__|ng-state|serverApp-state|application\/json/i.test(s.attrs) || /window\.__\w+\s*=|window\.\w+State\s*=|dataLayer\.push\(/.test(s.body));
  for (const s of states.slice(0, 4)) out.push(`  STATE ${cut(s.attrs.trim(), 80)} ${s.body.length}b: ${cut(s.body.trim().replace(/\s+/g, ' '), 700)}`);
  out.push('  SCRIPTS ' + cut([...html.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, '').split('?')[0]).slice(0, 12).join(' '), 600));
  // the visible text under the title
  const text = stripHtml(html).split('\n').map((l) => l.trim()).filter(Boolean);
  const h1 = stripHtml((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').trim();
  let at = h1 ? text.findIndex((l) => l.includes(h1)) : -1; if (at < 0) at = 0;
  out.push(`  TEXT (from "${cut(h1, 60)}", line ${at}):`);
  for (const l of text.slice(at, at + 70)) out.push('    ' + cut(l, 140));
  // the markup around the words that matter
  const seen = new Set(); let n = 0;
  for (const m of html.matchAll(/caliber|calibre|gauge|grain|\brounds?\b|bullet|barrel|magnification|reticle|\bupc\b/gi)) {
    const i = m.index; const key = Math.floor(i / 400); if (seen.has(key)) continue; seen.add(key);
    const win = html.slice(Math.max(0, i - 220), i + 260);
    if (/<script/i.test(win) && !/json/i.test(win)) continue;
    out.push('  HTML …' + win.replace(/\s+/g, ' ') + '…');
    if (++n >= 10) break;
  }
  return out.join('\n');
}

async function main() {
  const cat = JSON.parse(await readFile(SRC, 'utf8'));
  let pick;
  if (IDS.length) pick = cat.filter((p) => IDS.includes(p.id));
  else {
    const byCat = new Map();
    for (const p of cat) {
      if (!p.permalink) continue;
      const k = (p.categories || []).join(' > ') || '(none)';
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k).push(p);
    }
    // a product line with several variants (same name twice) shows how variants differ
    pick = [...byCat.values()].flatMap((list) => {
      const dupes = list.filter((p) => list.some((q) => q !== p && q.name === p.name));
      return [...dupes.slice(0, Math.min(PER, 2)), ...list].filter((p, i, a) => a.indexOf(p) === i).slice(0, PER);
    });
  }
  await mkdir(OUT, { recursive: true });
  const origin = new URL(pick[0] ? pick[0].permalink : 'https://example.com').origin;
  console.log(`saving ${pick.length} pages from ${origin} → ${path.relative(process.cwd(), OUT)}/\n`);

  // the store's own menu: which departments exist at all
  const home = await get(origin + '/');
  console.log(`HOME ${home.status} ${home.text.length}b${isBlocked(home) ? ' (blocked)' : ''}`);
  if (!isBlocked(home)) {
    await writeFile(path.join(OUT, '_home.html'), home.text);
    const links = [...new Set([...home.text.matchAll(/<a\b[^>]*href=["']([^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => `${m[1].replace(origin, '')} = ${stripHtml(m[2]).replace(/\s+/g, ' ').trim()}`)
      .filter((l) => /^\/[a-z0-9-]+(?:\/[a-z0-9-]+){0,2}\/? = .+/i.test(l)))];
    console.log('  MENU ' + links.slice(0, 120).join('\n  MENU '));
  }
  let i = 0, saved = 0, blocked = 0;
  for (const p of pick) {
    if (i++) await sleep(DELAY);
    const r = await get(p.permalink);
    const file = `${String(p.id).replace(/[^a-z0-9-]/gi, '').slice(0, 60) || i}.html`;
    console.log(`\n=== ${i}/${pick.length} ${(p.categories || []).slice(-1)[0] || ''} · ${p.brand || ''} ${p.name} · UPC ${(p.attributes || {}).UPC || p.sku || ''}`);
    if (isBlocked(r)) { blocked++; console.log(`  ✗ ${r.status || 'no answer'} — blocked or failed${r.error ? ': ' + r.error : ''} (${p.permalink})`); continue; }
    await writeFile(path.join(OUT, file), r.text); saved++;
    console.log(`  ${r.status} ${r.text.length}b ${p.permalink} → ${file}`);
    console.log(digest(r.text));
  }
  console.log(`\n${saved ? '✓' : '✗'} ${saved} of ${pick.length} pages saved in ${path.relative(process.cwd(), OUT)}/${blocked ? ` · ${blocked} blocked` : ''}`);
  if (!saved) {
    console.log('  The store refused this machine (its firewall blocks data-center and cloud addresses).\n  Run it from a home or office connection: npm run save-pages');
    process.exit(2);
  }
}
// a firewall page (CloudFront "Request blocked", Cloudflare challenge…) is not a product page
const isBlocked = (r) => !r.text || r.status < 200 || r.status >= 300 ||
  /request blocked|the request could not be satisfied|just a moment|cf-browser-verification|captcha|access denied/i.test(r.text.slice(0, 4000));

// file URLs, not paths: on Windows a path is C:\\… while a URL path is /C:/…
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
