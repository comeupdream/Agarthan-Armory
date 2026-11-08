#!/usr/bin/env node
/*
 * trailer.mjs — the trailer: the four films cut on the beats of the score.
 *
 *   node tools/trailer/trailer.mjs            → media/films/trailer-wide.mp4 and trailer-tall.mp4
 *   SHAPE=wide node tools/trailer/trailer.mjs
 *
 * Same method as EVRITHNG's brand kit (frontend/brandkit/trailer.mjs): every cut lands ON a
 * beat of the score (sound/score.mjs writes the beat map beside the audio), a cut names a
 * film, the second of that film that lands on the beat, and how many beats it holds, and
 * transitions are xfades centred on the beat — `fade` reads as a cut with a breath,
 * `fadewhite` is the flash on the drop and the final hit. Nothing here draws a frame: the
 * trailer is the films themselves.
 *
 * The tall cut (1080×1920, Reels / TikTok / Shorts) is the wide trailer over a blurred,
 * darkened copy of itself, with the wordmark above and the address below, kept out of the
 * top 8% and bottom 18% a phone covers with its own buttons.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const FILMS = path.join(ROOT, 'media', 'films');
const CACHE = path.join(ROOT, '.trailer-cache');
const SHAPES = process.env.SHAPE ? [process.env.SHAPE] : ['wide', 'tall'];
const CRF = String(process.env.CRF || 20);

/** The edit, in beats. `at` is the film second that lands on the cut's beat. */
export const CUTS = [
  // intro: the page arrives out of space; the wall shifts and the lens dives through the gate
  { section: 'intro', film: 'realm-shift', at: 0.2, beats: 6, x: null },
  { section: 'intro', film: 'phase-shift', at: 3.9, beats: 10, x: 'fade' },
  // build: the realms, scripts and cursors, the archive, the vaults, the map, the fleet
  { section: 'build', film: 'realm-shift', at: 3.75, beats: 4, x: 'fade' },
  { section: 'build', film: 'realm-shift', at: 6.15, beats: 4, x: 'fade' },
  { section: 'build', film: 'realm-shift', at: 9.75, beats: 4, x: 'fade' },
  { section: 'build', film: 'realm-shift', at: 14.15, beats: 4, x: 'fade' },
  { section: 'build', film: 'event-horizon', at: 1.0, beats: 4, x: 'fade' },
  { section: 'build', film: 'arsenal', at: 0.6, beats: 2, x: 'fade' },
  { section: 'build', film: 'phase-shift', at: 12.2, beats: 2, x: 'fade' },
  { section: 'build', film: 'realm-shift', at: 19.6, beats: 2, x: 'fade' },
  { section: 'build', film: 'realm-shift', at: 21.6, beats: 2, x: 'fade' },
  { section: 'build', film: 'realm-shift', at: 23.2, beats: 2, x: 'fade' },
  { section: 'build', film: 'realm-shift', at: 24.2, beats: 2, x: 'fade' },
  // drop: the mothership takes the name, the black hole, down the pole to Agartha and
  // the client's pieces, the holo arsenal and its mandala
  { section: 'drop', film: 'realm-shift', at: 26.0, beats: 4, x: 'fadewhite' },
  { section: 'drop', film: 'event-horizon', at: 6.2, beats: 4, x: 'fade' },
  { section: 'drop', film: 'event-horizon', at: 10.4, beats: 4, x: 'fade' },
  { section: 'drop', film: 'phase-shift', at: 13.9, beats: 4, x: 'fade' },
  { section: 'drop', film: 'phase-shift', at: 16.8, beats: 4, x: 'fade' },
  { section: 'drop', film: 'arsenal', at: 7.95, beats: 2, x: 'fade' },
  { section: 'drop', film: 'arsenal', at: 13.65, beats: 2, x: 'fade' },
  { section: 'drop', film: 'arsenal', at: 15.9, beats: 4, x: 'fade' },
  { section: 'drop', film: 'phase-shift', at: 23.6, beats: 4, x: 'fade' },
  // outro: everything falls into the hole; the white hole gives the name on the final hit
  { section: 'outro', film: 'event-horizon', at: 13.2, beats: 4, x: 'fade' },
  { section: 'outro', film: 'event-horizon', at: 17.3, beats: null, x: 'fadewhite' },
];
const XLEN = { fade: 0.12, fadewhite: 0.3 };

function plan() {
  const map = JSON.parse(fs.readFileSync(path.join(FILMS, 'score.json'), 'utf8'));
  const beat = map.beat;
  let b = 0;
  const cuts = CUTS.map((c) => { const start = b * beat; if (c.beats) b += c.beats; return { ...c, start }; });
  // the edit must stay on the music: each cut starts inside the section it names
  for (const c of cuts) {
    const sec = [...map.sections].reverse().find((s) => c.start + 1e-6 >= s.start);
    if (sec.name !== c.section) throw new Error(`cut ${c.film}@${c.at} starts at ${c.start.toFixed(2)}s in ${sec.name}, not ${c.section}`);
  }
  const last = cuts[cuts.length - 1];
  if (Math.abs(last.start - map.hit) > 0.01) throw new Error(`the end card lands at ${last.start.toFixed(2)}s, not on the hit at ${map.hit}s`);
  cuts.forEach((c, i) => { c.end = i + 1 < cuts.length ? cuts[i + 1].start : map.dur; c.x0 = c.x ? XLEN[c.x] : 0; c.x1 = i + 1 < cuts.length ? XLEN[cuts[i + 1].x] : 0; });
  return { map, cuts };
}

function wide() {
  const { map, cuts } = plan();
  const args = ['-v', 'error', '-y'];
  const filters = [];
  cuts.forEach((c, i) => {
    const src = path.join(FILMS, c.film + '.mp4');
    const from = c.at - c.x0 / 2;
    const len = c.end - c.start + c.x0 / 2 + c.x1 / 2;
    const filmDur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString());
    const pad = Math.max(0, from + len - filmDur + 0.1);   // the end card holds its last frame
    args.push('-ss', from.toFixed(4), '-t', (len - pad + 0.05).toFixed(4), '-i', src);
    filters.push(`[${i}:v]fps=30,settb=AVTB,setpts=PTS-STARTPTS${pad > 0 ? `,tpad=stop_mode=clone:stop_duration=${pad.toFixed(3)}` : ''},trim=duration=${len.toFixed(4)},format=yuv420p[v${i}]`);
  });
  let prev = 'v0';
  cuts.forEach((c, i) => {
    if (i === 0) return;
    const off = c.start - c.x0 / 2;
    filters.push(`[${prev}][v${i}]xfade=transition=${c.x}:duration=${c.x0}:offset=${off.toFixed(4)}[x${i}]`);
    prev = `x${i}`;
  });
  filters.push(`[${prev}]trim=duration=${map.dur.toFixed(4)},fade=t=out:st=${(map.dur - 1.2).toFixed(3)}:d=1.2[vout]`);
  const n = cuts.length;
  args.push('-i', path.join(FILMS, 'score.m4a'));
  const out = path.join(FILMS, 'trailer-wide.mp4');
  args.push('-filter_complex', filters.join(';'), '-map', '[vout]', '-map', `${n}:a`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-profile:v', 'high', '-level:v', '4.1', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log(`trailer-wide.mp4: ${cuts.length} cuts, ${map.dur.toFixed(2)} s`);
  return { map };
}

function tall() {
  const src = path.join(FILMS, 'trailer-wide.mp4');
  const { map } = plan();
  const wm = path.join(CACHE, 'plates', 'wordmark.png'), url = path.join(CACHE, 'plates', 'url.png');
  for (const f of [wm, url]) if (!fs.existsSync(f)) throw new Error('render the films first (their plates live in .trailer-cache/plates/): ' + f);
  const out = path.join(FILMS, 'trailer-tall.mp4');
  const card = map.hit - 0.2;   // the wide picture carries the wordmark from the hit on
  const fc = [
    '[0:v]split[a][b]',
    '[a]scale=-2:1920,crop=1080:1920,gblur=sigma=38,eq=brightness=-0.16:saturation=1.25[bg]',
    '[b]scale=1080:-2[fg]',
    '[bg][fg]overlay=0:(H-h)/2-80[base]',
    `[1:v]scale=640:-2,format=rgba,fade=t=out:st=${card.toFixed(2)}:d=0.4:alpha=1[w]`,
    `[2:v]scale=560:-2,format=rgba[u]`,
    '[base][w]overlay=(W-w)/2:250[t1]',
    `[t1][u]overlay=(W-w)/2:1420,fade=t=out:st=${(map.dur - 1.2).toFixed(3)}:d=1.2,format=yuv420p[vout]`,
  ];
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-loop', '1', '-i', wm, '-loop', '1', '-i', url,
    '-filter_complex', fc.join(';'), '-map', '[vout]', '-map', '0:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-profile:v', 'high', '-level:v', '4.1', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log(`trailer-tall.mp4: 1080×1920, ${map.dur.toFixed(2)} s`);
}

/* ---------- a poster per film: its best single frame, a JPEG at its own size ---------- */
async function posters() {
  const { pathToFileURL } = await import('node:url');
  const dir = path.join(HERE, 'films');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs')).sort()) {
    const film = (await import(pathToFileURL(path.join(dir, f)))).default;
    const mp4 = path.join(FILMS, film.key + '.mp4');
    if (!fs.existsSync(mp4) || film.poster == null) continue;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(film.poster), '-i', mp4, '-frames:v', '1', '-q:v', '3', path.join(FILMS, film.key + '.jpg')]);
  }
  const map = JSON.parse(fs.readFileSync(path.join(FILMS, 'score.json'), 'utf8'));
  for (const shape of ['wide', 'tall']) {
    const mp4 = path.join(FILMS, `trailer-${shape}.mp4`);
    if (fs.existsSync(mp4)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', (map.hit + 3.5).toFixed(2), '-i', mp4, '-frames:v', '1', '-q:v', '3', path.join(FILMS, `trailer-${shape}.jpg`)]);
  }
}

if (SHAPES.includes('wide')) wide();
if (SHAPES.includes('tall')) tall();
await posters();
