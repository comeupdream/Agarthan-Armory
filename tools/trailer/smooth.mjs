#!/usr/bin/env node
// smooth.mjs — a film's `smooth` ranges, blended over time, after it is rendered and before its sound.
//
//   node tools/trailer/smooth.mjs way-down
//
// A film may name stretches that move too fast to be shown frame by frame: `smooth: [[from, to, frames]]`.
// Over each one every frame becomes a weighted blend of the `frames` around it (a triangle, heaviest
// in the middle): motion blur. The Way Down's rush back up the shaft passes eight rings of light and
// dark a second, which is five flashes a second to the flash check; blended over nine frames it is a
// streak, and passes. Run it once, on a fresh render (it would blur a film twice), then films:sound.
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILMS = path.resolve(HERE, '..', '..', 'media', 'films');
const only = process.argv.slice(2);
const dir = path.join(HERE, 'films');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs')).sort()) {
  const film = (await import(pathToFileURL(path.join(dir, f)))).default;
  if (!film.smooth || (only.length && !only.some((o) => film.key.includes(o)))) continue;
  const mp4 = path.join(FILMS, film.key + '.mp4');
  if (!fs.existsSync(mp4)) { console.log(`${film.key}: no film yet`); continue; }
  // the film cut at each range's ends; the ranges blended; the pieces joined again
  const cuts = [0, ...film.smooth.flatMap(([a, b]) => [a, b]), film.dur], parts = [];
  let graph = `[0:v]split=${cuts.length - 1}${cuts.slice(1).map((_, i) => `[s${i}]`).join('')};`;
  for (let i = 0; i < cuts.length - 1; i++) {
    const range = film.smooth.find(([a]) => a === cuts[i]);
    const n = range ? range[2] : 0, w = Array.from({ length: n }, (_, k) => Math.min(k + 1, n - k)).join(' ');
    graph += `[s${i}]trim=${cuts[i]}:${cuts[i + 1]},setpts=PTS-STARTPTS${range ? `,tmix=frames=${n}:weights='${w}'` : ''}[v${i}];`;
    parts.push(`[v${i}]`);
  }
  graph += `${parts.join('')}concat=n=${parts.length}:v=1:a=0,format=yuv420p[v]`;
  const tmp = mp4.replace(/\.mp4$/, '.smooth.mp4');
  const audio = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', mp4]).toString().trim();
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-filter_complex', graph, '-map', '[v]', ...(audio ? ['-map', '0:a', '-c:a', 'copy'] : ['-an']),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-profile:v', 'high', '-level:v', '4.1',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
  fs.renameSync(tmp, mp4);
  console.log(`${film.key}: smoothed ${film.smooth.map(([a, b, n]) => `${a}–${b} s over ${n} frames`).join(', ')}`);
}
