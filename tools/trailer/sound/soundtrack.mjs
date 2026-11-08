#!/usr/bin/env node
// soundtrack.mjs — each film's own sound, scored to its cues, and muxed into its MP4.
//
//   node tools/trailer/sound/soundtrack.mjs              every film in media/films/
//   node tools/trailer/sound/soundtrack.mjs realm-shift  one
//
// A film's `cues` (in tools/trailer/films/*.mjs) are its moments — a realm switch, a beam,
// the hole opening — and each kind has a sound below. Under them: the ice wind, a sub on D,
// the score's chords as a slow pad, and the score's pulse (116 BPM) where the film has
// energy (PULSE). Same library and the same key as the trailer's score (score.mjs), so a
// film cut into the trailer sits in its world. Mastered to -16 LUFS, a little under the
// trailer, with a -1 dBTP ceiling.
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { D, newMix, stem, send, put, wind, drone, hum, vacuum, master, save } from './kit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const FILMS = path.join(ROOT, 'media', 'films');
const BPM = 116, BEAT = 60 / BPM, BAR = 4 * BEAT;

// where each film's pulse runs: [from, to, level 0–1, full kick?]
const PULSE = {
  'realm-shift': [[3.0, 18.8, 0.45, false], [18.8, 30.0, 1, true]],
  'event-horizon': [[3.0, 13.6, 0.8, true]],
  'phase-shift': [[1.2, 7.4, 0.7, false], [8.0, 13.6, 0.8, true], [16.4, 21.8, 0.4, false], [22.6, 27.3, 1, true]],
  'arsenal': [[0.4, 5.6, 0.6, false], [6.0, 17.6, 1, true]],
};
const CH = [[38, [50, 53, 57, 64]], [34, [46, 50, 53, 57]], [41, [53, 57, 60, 67]], [36, [48, 55, 62, 64]]];

function score(film) {
  const mix = newMix(film.dur, BPM);
  const seed = (s) => film.key + ':' + s;
  wind(mix, 'wind', { gain: 0.3, seed: seed('wind') });
  drone(mix, 'sub', { midi: 26, gain: 0.17 });
  // the chords, a bar each, as a soft pad
  for (let b = 0; b * BAR < film.dur; b++) {
    const [, notes] = CH[b % 4];
    put(mix, 'pad', D.padChord({ notes, gate: BAR, a: 0.7, r: 1.4, cut: 1100, voices: 4, cents: 14, seed: seed('pad' + b) }), b * BAR, { gain: 0.2 });
  }
  // the pulse
  const kicks = [];
  const kick = D.makeKick({ seed: 'fk' }), hat = D.makeHat({ seed: 'fh' });
  for (const [a, z, lvl, full] of PULSE[film.key] || []) {
    for (let t = a; t < z - 1e-6; t += BEAT / 2) {
      const k = Math.round((t - a) / (BEAT / 2));
      const bar = Math.floor((t + 1e-6) / BAR);
      const [root] = CH[bar % 4];
      if (k % 2 === 0 && (full || k % 4 === 0)) { put(mix, 'kick', kick, t, { gain: 0.75 * lvl }); kicks.push(t); }
      if (full && k % 2 === 1) put(mix, 'hats', hat, t, { gain: 0.12 * lvl, pan: k % 4 === 1 ? -0.2 : 0.2 });
      D.bassNote(stem(mix, 'bass'), { t0: t, gate: BEAT * 0.4, midi: root, vel: 0.8 * lvl, cut: 260 + 700 * lvl, envHz: 600 + 900 * lvl, seed: seed('b' + t.toFixed(3)) });
      if (lvl > 0.6) for (let s = 0; s < 2; s++) D.pluck(stem(mix, 'arp'), { t0: t + s * BEAT / 4, midi: [62, 65, 69, 74, 76, 74, 69, 65][(k * 2 + s) % 8], vel: 0.45 * lvl, cut: 900 + 2000 * lvl, pan: s ? 0.3 : -0.3, seed: seed('a' + t.toFixed(3) + s) });
    }
  }
  // the moments
  const silences = [];
  for (const c of film.cues || []) {
    const t = c.t, s = seed(c.kind + t);
    switch (c.kind) {
      case 'realm': put(mix, 'fx', D.whoosh({ dur: 0.8, f0: 300, fPeak: 3600, f1: 500, panFrom: -0.7, panTo: 0.7, seed: s }), t - 0.3, { gain: 0.42 });
        D.pluck(stem(mix, 'arp'), { t0: t, midi: 74, vel: 0.5, cut: 2600, seed: s }); break;
      case 'script': put(mix, 'fx', D.glitch({ dur: 0.32, f: 1600, seed: s }), t, { gain: 0.3 }); break;
      case 'cursor': put(mix, 'ui', D.blip({ f: 1318, len: 0.08 }), t, { gain: 0.22 }); break;
      case 'click': case 'hover': put(mix, 'ui', D.blip({ f: c.kind === 'hover' ? 990 : 660, len: 0.06 }), t, { gain: 0.18 }); break;
      case 'type': put(mix, 'ui', D.typingClick({ seed: s }), t, { gain: 0.35 }); break;
      case 'url': put(mix, 'ui', D.blip({ f: 1760, len: 0.12 }), t, { gain: 0.2 }); break;
      case 'trip': put(mix, 'fx', D.riser({ dur: 2.6, f0: 300, f1: 8000, seed: s }), t, { gain: 0.35 }); break;
      case 'arrive': put(mix, 'fx', D.whoosh({ dur: 1.8, f0: 180, fPeak: 2600, f1: 300, panFrom: -0.9, panTo: 0.9, seed: s }), t, { gain: 0.5 }); break;
      case 'mother': put(mix, 'fx', D.impact({ size: 0.7, seed: s }), t, { gain: 0.55 }); break;
      case 'beam': hum(mix, 'hum', { t0: t, t1: t + 4.6, f: 110, gain: 0.07 }); hum(mix, 'hum', { t0: t + 0.3, t1: t + 4.4, f: 164.8, gain: 0.04, pan: 0.4 }); break;
      case 'leave': put(mix, 'fx', D.downlifter({ dur: 1.8, seed: s }), t, { gain: 0.4 }); break;
      case 'white': put(mix, 'fx', D.reverseSwell({ dur: 1.0, notes: [50, 57, 62], seed: s }), t - 0.4, { gain: 0.55 });
        put(mix, 'hit', D.impact({ size: 0.9, seed: s + 'i' }), t + 0.6, { gain: 0.6 }); break;
      case 'deck': put(mix, 'fx', D.whoosh({ dur: 2.2, f0: 120, fPeak: 1000, f1: 200, panFrom: 0.3, panTo: -0.3, seed: s }), t, { gain: 0.45 }); break;
      case 'hole': put(mix, 'hit', D.subDrop({ f0: 90, f1: 30, dur: 4.2 }), t, { gain: 0.6 });
        put(mix, 'fx', D.shepard({ dur: Math.min(11, film.dur - t), period: 5, dir: -1, base: 40 }), t, { gain: 0.11 }); break;
      case 'feed': put(mix, 'fx', D.riser({ dur: 5.6, f0: 120, f1: 5000, curve: 1.6, seed: s }), t, { gain: 0.32 }); break;
      case 'fall': put(mix, 'fx', D.downlifter({ dur: 2.6, f0: 6000, f1: 80, seed: s }), t, { gain: 0.5 });
        put(mix, 'hit', D.subDrop({ f0: 70, f1: 24, dur: 3.2 }), t + 0.8, { gain: 0.5 }); break;
      case 'silence': silences.push([t, t + 0.95]); break;
      case 'shift': put(mix, 'fx', D.glitch({ dur: 0.4, f: 2200, seed: s }), t, { gain: 0.34 });
        put(mix, 'fx', D.whoosh({ dur: 0.6, f0: 500, fPeak: 5000, f1: 800, seed: s + 'w' }), t - 0.2, { gain: 0.3 }); break;
      case 'dive': put(mix, 'fx', D.riser({ dur: 0.75, f0: 400, f1: 12000, seed: s }), t, { gain: 0.42 }); break;
      case 'emerge': put(mix, 'hit', D.impact({ size: 0.5, seed: s }), t, { gain: 0.4 }); break;
      case 'zoom': case 'relic': put(mix, 'ping', D.sonarPing({ f: c.kind === 'zoom' ? 1200 : 660, dur: 2.4, soft: 0.5, seed: s }), t, { gain: 0.24 }); break;
      case 'sun': put(mix, 'pad', D.padChord({ notes: [50, 54, 57, 62, 66, 69], gate: 4.5, a: 1.2, r: 2.4, cut: 2600, voices: 5, seed: s }), t - 0.6, { gain: 0.4 });
        put(mix, 'fx', D.reverseSwell({ dur: 1.4, notes: [62, 66, 69], seed: s + 'r' }), t - 1.4, { gain: 0.45 }); break;
      case 'push': put(mix, 'fx', D.riser({ dur: 4.7, f0: 200, f1: 9000, seed: s }), t, { gain: 0.3 }); break;
      case 'dim': put(mix, 'fx', D.downlifter({ dur: 1.2, seed: s }), t, { gain: 0.35 }); break;
      case 'holo': put(mix, 'ping', D.sonarPing({ f: 1480, dur: 1.8, soft: 0.6, seed: s }), t, { gain: 0.18 });
        [62, 69, 74, 77].forEach((m, i) => D.pluck(stem(mix, 'arp'), { t0: t + i * BEAT / 4, midi: m, vel: 0.5, cut: 3000, pan: i % 2 ? 0.4 : -0.4, seed: s + i })); break;
      case 'mandala': put(mix, 'fx', D.reverseSwell({ dur: 1.9, notes: [50, 57, 62, 64], seed: s }), t, { gain: 0.5 }); break;
      case 'tunnel': put(mix, 'fx', D.whoosh({ dur: 1.6, seed: s }), t, { gain: 0.4 }); put(mix, 'fx', D.riser({ dur: 3.6, f0: 300, f1: 10000, seed: s + 'r' }), t, { gain: 0.32 }); break;
      case 'line': put(mix, 'hit', D.impact({ size: 1.0, seed: s }), t, { gain: 0.65 });
        put(mix, 'pad', D.padChord({ notes: [38, 50, 57, 62, 64], gate: Math.max(1, film.dur - t - 1.5), a: 0.01, r: 1.4, cut: 2200, seed: s + 'p' }), t, { gain: 0.38 }); break;
      default: break;
    }
  }
  for (const [a, z] of silences) vacuum(mix, a, z);
  for (const [k, d, r] of [['bass', 0.8, 0.16], ['pad', 0.35, 0.3], ['arp', 0.25, 0.2], ['wind', 0.25, 0.3]]) if (mix.stems.has(k)) D.duck(stem(mix, k), kicks, d, r);
  send(mix, 'hall', stem(mix, 'pad'), 0.45); send(mix, 'hall', stem(mix, 'fx'), 0.3); send(mix, 'hall', stem(mix, 'ping'), 0.8);
  send(mix, 'hall', stem(mix, 'hit'), 0.3); if (mix.stems.has('hum')) send(mix, 'hall', stem(mix, 'hum'), 0.4);
  send(mix, 'delay', stem(mix, 'arp'), 0.4); send(mix, 'delay', stem(mix, 'ui'), 0.3); send(mix, 'delay', stem(mix, 'ping'), 0.4);
  return master(mix, { lufs: -16 });
}

const only = process.argv.slice(2);
const dir = path.join(HERE, '..', 'films');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs')).sort()) {
  const film = (await import(pathToFileURL(path.join(dir, f)))).default;
  if (only.length && !only.some((o) => film.key.includes(o))) continue;
  const { out, meter } = score(film);
  const base = path.join(FILMS, film.key + '.sound');
  save(out, base);
  fs.rmSync(base + '.wav');
  const mp4 = path.join(FILMS, film.key + '.mp4');
  if (fs.existsSync(mp4)) {
    const tmp = mp4.replace(/\.mp4$/, '.tmp.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-i', base + '.m4a', '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-shortest', '-movflags', '+faststart', tmp]);
    fs.renameSync(tmp, mp4);
  }
  console.log(`${film.key}: ${meter.integrated.toFixed(1)} LUFS, peak ${meter.truePeak.toFixed(1)} dBTP${fs.existsSync(mp4) ? ' → muxed into ' + path.relative(ROOT, mp4) : ' (no film yet)'}`);
}
