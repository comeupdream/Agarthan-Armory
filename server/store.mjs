/* =============================================================================
 * store.mjs — the console's private data on the server's disk (DATA_DIR):
 * the inbox (requisitions, messages) and the traffic counter.
 *
 * Read-modify-write is serialised per file (withLock) and every save is
 * temp-then-rename (writeAtomic), so two requests in the same tick never
 * lose each other's write and a crash never leaves half a file.
 * (withLock / writeAtomic / describeFsError ported from the XAT console.)
 *
 * On Render the app folder is wiped by every deploy; DATA_DIR must be a
 * persistent disk (service → Disks, mount at /var/data, DATA_DIR=/var/data).
 * Without it the inbox and traffic say so and stay off.
 * ===========================================================================*/
import { writeFile, rename, readFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.DATA_DIR || '';

export function describeFsError(e, filePath) {
  const dir = filePath ? path.dirname(String(filePath)) : '';
  const code = e && e.code;
  if (code === 'ENOENT') return `the data folder ${dir || '(unknown)'} does not exist — on Render, attach a disk at that mount path (service → Disks), then redeploy`;
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') return `the data folder ${dir || '(unknown)'} is not writable (${code})`;
  if (code === 'ENOSPC') return 'the disk is full';
  return String((e && e.message) || 'write failed').slice(0, 200);
}

const chains = new Map();
/** run fn() after every earlier withLock(key) call has settled */
export async function withLock(key, fn) {
  const prev = chains.get(key) || Promise.resolve();
  let release;
  const gate = new Promise((r) => { release = r; });
  chains.set(key, prev.then(() => gate));
  try { await prev; return await fn(); } finally { release(); if (chains.get(key) === gate) chains.delete(key); }
}

export async function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, typeof data === 'string' ? data : JSON.stringify(data));
  await rename(tmp, file);
}

let probed = null;
/** { ok, why } — can this host keep data? cached after the first answer */
export async function diskStatus() {
  if (probed) return probed;
  if (!DATA_DIR) return (probed = { ok: false, why: 'DATA_DIR is not set' });
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await access(DATA_DIR, constants.W_OK);
    probed = { ok: true, why: '' };
  } catch (e) { probed = { ok: false, why: describeFsError(e, path.join(DATA_DIR, 'x')) }; }
  return probed;
}

export const dataFile = (name) => path.join(DATA_DIR, name);

export async function readJson(name, fallback) {
  try { return JSON.parse(await readFile(dataFile(name), 'utf8')); } catch { return fallback; }
}

/** load → mutate → save, serialised; mutate may return a value passed back to the caller */
export async function update(name, fallback, mutate) {
  return withLock(name, async () => {
    const doc = await readJson(name, fallback);
    const out = await mutate(doc);
    await writeAtomic(dataFile(name), doc);
    return out;
  });
}
