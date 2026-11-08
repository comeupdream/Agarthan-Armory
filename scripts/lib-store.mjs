/* =============================================================================
 * lib-store.mjs — reading and writing a scraped catalog.
 *
 * A store with tens of thousands of variants does not fit the plain,
 * indented catalog.json GitHub accepts (100 MB a file). So a catalog is
 * written one product per line, and gzipped (catalog.json.gz) once it is
 * big. Every script reads either form through readCatalog().
 * ===========================================================================*/
import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';

const GZIP_OVER = 20e6;   // bytes of JSON before it is stored gzipped

/** the products in <file> or <file>.gz; [] when neither exists */
export async function readCatalog(file) {
  if (existsSync(file + '.gz')) return JSON.parse(gunzipSync(await readFile(file + '.gz')).toString('utf8'));
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  return [];
}
export const catalogExists = (file) => existsSync(file) || existsSync(file + '.gz');

/** write atomically: one product per line (small, diff-friendly), gzipped when big */
export async function writeCatalog(file, list) {
  const body = '[\n' + list.map((p) => JSON.stringify(p)).join(',\n') + '\n]\n';
  const gz = Buffer.byteLength(body) > GZIP_OVER;
  const out = gz ? file + '.gz' : file;
  await writeFile(out + '.tmp', gz ? gzipSync(body, { level: 9 }) : body);
  await rename(out + '.tmp', out);
  await rm(gz ? file : file + '.gz', { force: true });   // never both forms
  return out;
}
