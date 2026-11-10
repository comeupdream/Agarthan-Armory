/* lib-inputs.mjs — one fingerprint for everything the site catalog is built
 * from: every scraped store, the hand corrections (overrides.json) and the
 * build code itself. build-catalog.mjs stamps it into catalog.js; boot.mjs
 * compares it at start-up and rebuilds only when something changed — so an
 * edit published from the Ops Console (a commit to overrides.json) is applied
 * on the deploy it triggers, without anyone running the build by hand. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

export function inputFiles(root) {
  const files = [];
  const scraped = path.join(root, 'assets/data/scraped');
  const add = (dir) => { for (const f of ['catalog.json', 'catalog.json.gz']) if (existsSync(path.join(dir, f))) files.push(path.join(dir, f)); };
  if (existsSync(scraped)) {
    add(scraped);
    for (const d of readdirSync(scraped).sort()) if (statSync(path.join(scraped, d)).isDirectory()) add(path.join(scraped, d));
  }
  for (const f of ['assets/data/overrides.json', 'assets/data/custom-products.json', 'scripts/build-catalog.mjs', 'scripts/lib-facets.mjs', 'scripts/lib-store.mjs']) {
    if (existsSync(path.join(root, f))) files.push(path.join(root, f));
  }
  return files;
}

export function inputsHash(root) {
  const h = createHash('sha1');
  for (const f of inputFiles(root)) h.update(path.relative(root, f).split(path.sep).join('/')).update('\0').update(readFileSync(f)).update('\0');
  return h.digest('hex').slice(0, 16);
}

/** the fingerprint stamped into an existing catalog.js, or null */
export function builtHash(root) {
  try {
    const head = readFileSync(path.join(root, 'assets/data/catalog.js'), 'utf8').slice(0, 800);
    return (head.match(/"inputs":"([0-9a-f]+)"/) || [])[1] || null;
  } catch { return null; }
}
