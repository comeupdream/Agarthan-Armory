#!/usr/bin/env node
/* apply-ops-edits.mjs — apply edits exported from the Ops Console (Tools →
 * Export staged edits) to the repo's files, for when publishing from the
 * console isn't set up (no GH_TOKEN, or preview mode). Same checks and the
 * same merge as the server, so the result is identical.
 *
 *   node scripts/apply-ops-edits.mjs ops-edits-2026-11-10.json
 *   then: git add assets/data && git commit -m "Ops edits" && git push
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProductPatch, applyProductPatch, validateSettings } from '../server/edits.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file) { console.error('usage: node scripts/apply-ops-edits.mjs <ops-edits.json>'); process.exit(1); }
const read = async (rel, d) => { try { return JSON.parse(await readFile(path.join(ROOT, rel), 'utf8')); } catch { return d; } };

try {
  const edits = JSON.parse(await readFile(path.resolve(file), 'utf8'));
  if (edits.products && Object.keys(edits.products).length) {
    const patch = validateProductPatch(edits.products);
    const doc = await read('assets/data/overrides.json', {});
    const sum = applyProductPatch(doc, patch);
    await writeFile(path.join(ROOT, 'assets/data/overrides.json'), JSON.stringify(doc, null, 2) + '\n');
    console.log(`✓ overrides.json: ${sum.products} product(s), ${sum.set} field(s) set, ${sum.cleared} cleared`);
  }
  if (edits.settings && Object.keys(edits.settings).length) {
    const st = validateSettings(edits.settings);
    const cur = await read('assets/data/site-settings.json', {});
    await writeFile(path.join(ROOT, 'assets/data/site-settings.json'), JSON.stringify({ ...cur, ...st }, null, 2) + '\n');
    console.log(`✓ site-settings.json: ${Object.keys(st).join(', ')}`);
  }
  console.log('next: git add assets/data && git commit -m "Ops edits" && git push   (the deploy rebuilds the catalogue)');
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
