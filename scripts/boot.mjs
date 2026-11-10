#!/usr/bin/env node
/* boot.mjs — what `npm start` runs (and so what Render runs on every deploy).
 *
 * 1. If the catalog's inputs changed since catalog.js was built — a new scrape
 *    pushed without a build, or product edits published from the Ops Console
 *    (overrides.json) — rebuild it now (scripts/build-catalog.mjs, ~10–30 s).
 * 2. Start the web server.
 *
 * A failed rebuild never keeps the site down: the server starts on the
 * catalog.js already in the repo and the error is logged. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inputsHash, builtHash } from './lib-inputs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const want = inputsHash(ROOT), have = builtHash(ROOT);
if (want !== have && process.env.BOOT_BUILD !== '0') {
  console.log(`catalog inputs changed (${have || 'none'} → ${want}): rebuilding the catalog…`);
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/build-catalog.mjs')], { cwd: ROOT, stdio: 'inherit' });
  console.log(r.status === 0 ? `catalog rebuilt in ${((Date.now() - t) / 1000).toFixed(1)} s` : '! catalog rebuild failed — serving the catalog already in the repo');
} else {
  console.log(`catalog up to date (${want})`);
}
await import(path.join(ROOT, 'server.mjs'));
