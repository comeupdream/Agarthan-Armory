#!/usr/bin/env node
// soundtrack.mjs — each film's own score, written to its cues, and muxed into its MP4.
//
//   node tools/trailer/sound/soundtrack.mjs              every film in media/films/
//   node tools/trailer/sound/soundtrack.mjs realm-shift  one
//
// Every film has its own music (MUSIC below): its own key, tempo, groove and chords, a
// melody for its peak, a softer harmony for its calm, and its own voice for the brand's
// moment at the end. Realm Shift is E minor, four on the floor; Event Horizon is C sharp
// minor at a heartbeat; Phase Shift is A Dorian on a breakbeat with a warm Agartha
// section; Hyperborean Arsenal is G minor on march toms. A film's `cues` (its moments,
// in tools/trailer/films/*.mjs) are scored in the film's key. Each one ends on a fade,
// never a cut. Mastered to -16 LUFS with a -1 dBTP ceiling.
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { D, newMix, stem, send, put, wind, drone, hum, vacuum, master, save } from './kit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const FILMS = path.join(ROOT, 'media', 'films');

// a bell: a struck sine with inharmonic partials
const BELL = [[1, 1], [2.76, 0.34], [5.4, 0.12], [8.93, 0.05]];
const bell = (midi, { len = 2.2, vel = 1 } = {}) => D.tone({ f: D.mtof(midi), gate: 0.01, a: 0.002, d: len, s: 0, r: len * 0.4, partials: BELL, vel });
// a harp: a plucked string
const harp = (midi, { len = 2.4, vel = 0.9, bright = 0.55, seed }) => D.ksPluck({ f: D.mtof(midi), dur: len, t60: len * 0.8, bright, vel, seed });
const beats = (t0, beat, list) => { let t = t0; return list.map(([midi, b]) => { const n = { t0: t, dur: b * beat, midi }; t += b * beat; return n; }); };

/* ---------- the four scores ---------- */
// chords: [bass root, [pad notes]], a bar each; `calm` takes over from `calmAt`.
// sections: { a, z, groove, lvl, arp } — the groove runs on the film's grid from `grid`.
const MUSIC = {
  'realm-shift': {
    key: 'E minor', bpm: 124, grid: 3.0, sub: 28, wind: 0.26,
    chords: [[40, [52, 55, 59, 64]], [36, [52, 55, 60, 64]], [43, [50, 55, 59, 62]], [38, [50, 54, 57, 62]]],
    calmAt: 35.6, calm: [[36, [48, 55, 59, 64]], [40, [52, 56, 59, 66]]],
    steps: [64, 67, 71, 74, 76, 79],
    fontPitch: { runic: 76, oldworld: 71, future: 83 },
    arp: [0, 1, 2, 3, 4, 3, 2, 1],
    sections: [
      { a: 3.0, z: 18.8, groove: 'four', lvl: 0.45, half: true },
      { a: 18.8, z: 29.6, groove: 'four', lvl: 1, arp: 'pluck' },
      { a: 29.6, z: 32.6, groove: 'four', lvl: 1.1, arp: 'pluck', clap: true, stabs: true },
      { a: 32.6, z: 35.6, groove: 'drift', lvl: 0.6, arp: 'slow' },
    ],
    lead: (B) => beats(29.6, B, [[71, 1], [76, 1], [79, 0.5], [78, 0.5], [76, 1], [74, 1], [71, 1.2]]),
    kick: { f0: 240, f1: 52, decay: 0.11 }, fade: [40.0, 41.95],
  },
  'event-horizon': {
    key: 'C sharp minor', bpm: 84, grid: 3.0, sub: 25, wind: 0.34,
    chords: [[37, [49, 52, 56, 61]], [33, [49, 52, 57, 61]], [30, [49, 54, 57, 61]], [32, [51, 56, 60, 63]]],
    calmAt: 22.6, calm: [[37, [49, 53, 56, 63]], [37, [49, 56, 61, 65]]],
    steps: [61, 64, 68, 73, 76, 80],
    sections: [
      { a: 3.0, z: 13.6, groove: 'heart', lvl: 0.8 },
      { a: 13.6, z: 16.2, groove: 'heart', lvl: 1, fast: true },
      { a: 23.2, z: 30.6, groove: 'heart', lvl: 0.22, soft: true },
    ],
    lead: (B) => beats(17.6, B, [[80, 1], [85, 1.5], [83, 0.5], [80, 1]]),
    kick: { f0: 160, f1: 42, decay: 0.16, click: 0.1 }, fade: [30.2, 31.95],
  },
  'phase-shift': {
    key: 'A Dorian', bpm: 132, grid: 1.2, sub: 33, wind: 0.3,
    chords: [[45, [52, 57, 60, 64]], [38, [54, 57, 62, 66]], [43, [55, 59, 62, 67]], [40, [52, 55, 59, 62]]],
    // Agartha, warm: A major, F sharp minor, D major
    warm: { a: 15.2, z: 21.8, chords: [[45, [57, 61, 64, 69]], [42, [54, 57, 61, 66]], [38, [54, 57, 62, 66]], [45, [56, 61, 64, 68]]] },
    calmAt: 31.0, calm: [[45, [52, 57, 59, 64]], [38, [54, 57, 62, 64]]],
    steps: [69, 72, 76, 79, 81, 84],
    fontPitch: { runic: 69, oldworld: 64, future: 76 },
    arp: [0, 2, 1, 3, 2, 4, 3, 1],
    sections: [
      { a: 1.2, z: 7.4, groove: 'break', lvl: 0.7 },
      { a: 8.0, z: 13.6, groove: 'break', lvl: 0.85, arp: 'pluck' },
      { a: 15.4, z: 21.8, groove: 'warm', lvl: 0.55, arp: 'harp' },
      { a: 21.8, z: 27.6, groove: 'break', lvl: 1, arp: 'pluck' },
      { a: 27.6, z: 28.8, groove: 'roll', lvl: 1 },
    ],
    lead: (B) => beats(26.0, B, [[76, 0.5], [79, 0.5], [81, 1], [78, 0.5], [76, 1]]),
    kick: { f0: 220, f1: 50, decay: 0.12 }, fade: [35.3, 36.95],
  },
  'arsenal': {
    key: 'G minor', bpm: 100, grid: 0.4, sub: 31, wind: 0.24,
    chords: [[43, [55, 58, 62, 67]], [39, [55, 58, 63, 67]], [46, [53, 58, 62, 65]], [41, [53, 57, 60, 65]]],
    calmAt: 24.0, calm: [[39, [51, 55, 58, 62]], [43, [50, 55, 59, 62]]],
    steps: [67, 70, 74, 79, 82, 86],
    arp: [0, 2, 1, 3],
    sections: [
      { a: 0.4, z: 5.6, groove: 'march', lvl: 0.55, light: true },
      { a: 6.0, z: 17.6, groove: 'march', lvl: 1, arp: 'pluck8' },
      { a: 19.6, z: 21.2, groove: 'roll', lvl: 0.9 },
    ],
    lead: (B) => beats(21.2, B, [[74, 0.5], [79, 0.5], [82, 0.75], [81, 0.25], [79, 1.25]]),
    kick: { f0: 200, f1: 46, decay: 0.13 }, fade: [30.2, 31.95],
  },
  'the-eye': {
    key: 'D Phrygian', bpm: 96, grid: 3.0, sub: 26, wind: 0.28,
    chords: [[38, [50, 53, 57, 62]], [39, [51, 55, 58, 63]], [38, [50, 53, 57, 62]], [36, [48, 52, 55, 60]]],
    calmAt: 36.0, calm: [[38, [50, 57, 62, 64]], [34, [50, 53, 58, 62]]],
    steps: [62, 63, 65, 67, 69, 70, 72, 74],
    fontPitch: { runic: 74, oldworld: 69, future: 76 },
    arp: [0, 1, 2, 3, 2, 4, 3, 1],
    sections: [
      { a: 3.0, z: 11.6, groove: 'ritual', lvl: 0.5, arp: 'slow8' },
      { a: 11.6, z: 14.0, groove: 'ritual', lvl: 0.85, arp: 'pluck16' },
      { a: 14.0, z: 15.6, groove: 'roll', lvl: 0.9 },
      { a: 16.4, z: 23.0, groove: 'four', lvl: 0.75, arp: 'pluck' },
      { a: 23.0, z: 29.6, groove: 'four', lvl: 1, arp: 'pluck' },
      { a: 29.6, z: 33.0, groove: 'four', lvl: 1.1, arp: 'pluck', clap: true, stabs: true },
      { a: 33.0, z: 36.0, groove: 'drift', lvl: 0.6, arp: 'slow' },
    ],
    lead: (B) => beats(29.6, B, [[69, 0.5], [70, 0.5], [69, 0.5], [65, 0.5], [74, 1], [75, 0.5], [74, 1.5]]),
    kick: { f0: 210, f1: 48, decay: 0.12 }, fade: [40.2, 41.95],
  },
  // the realms and the living money: F Lydian (the raised fourth floats), a breakbeat under
  // the realm tour, then four on the floor as the money comes alive; bars land on 30, 34, 38
  'living-money': {
    key: 'F Lydian', bpm: 120, grid: 0.0, sub: 29, wind: 0.26,
    chords: [[41, [53, 57, 60, 64]], [43, [55, 59, 62, 65]], [45, [57, 60, 64, 67]], [43, [55, 59, 62, 67]]],
    calmAt: 41.2, calm: [[41, [53, 57, 60, 64]], [38, [50, 57, 60, 65]]],
    steps: [65, 67, 69, 71, 72, 74, 76, 77],
    fontPitch: { runic: 77, oldworld: 72, future: 81 },
    arp: [0, 1, 2, 3, 4, 3, 2, 1],
    sections: [
      { a: 2.4, z: 26.0, groove: 'break', lvl: 0.55, arp: 'pluck8' },
      { a: 26.0, z: 30.0, groove: 'drift', lvl: 0.6, arp: 'slow' },
      { a: 30.0, z: 34.0, groove: 'four', lvl: 0.9, arp: 'pluck16' },
      { a: 34.0, z: 38.0, groove: 'four', lvl: 1.1, arp: 'pluck', clap: true, stabs: true },
      { a: 38.0, z: 41.2, groove: 'drift', lvl: 0.55, arp: 'slow' },
    ],
    lead: (B) => beats(34.0, B, [[77, 0.5], [76, 0.5], [72, 1], [71, 0.5], [72, 0.5], [74, 1], [76, 1], [77, 1]]),
    kick: { f0: 220, f1: 48, decay: 0.12 }, fade: [47.4, 48.95],
  },
  // the edge of the world: B minor, i-VI-III-VII, hand drums for the flight along the wall,
  // four on the floor at the hole in the pole (bar 11 lands on 30.0), resolving to B major below
  'edge-of-the-world': {
    key: 'B minor', bpm: 88, grid: 0.0, sub: 35, wind: 0.32,
    chords: [[35, [47, 50, 54, 59]], [31, [47, 50, 55, 59]], [38, [50, 54, 57, 62]], [33, [49, 52, 57, 61]]],
    calmAt: 42.6, calm: [[35, [47, 51, 54, 59]], [40, [52, 56, 59, 64]]],
    steps: [71, 73, 74, 76, 78, 79, 81, 83],
    fontPitch: { runic: 83, oldworld: 78, future: 86 },
    arp: [0, 2, 1, 3, 2, 4, 3, 1],
    sections: [
      { a: 1.6, z: 7.6, groove: 'drift', lvl: 0.45, arp: 'slow' },
      { a: 7.6, z: 13.6, groove: 'drift', lvl: 0.55, arp: 'slow' },
      { a: 13.6, z: 21.8, groove: 'ritual', lvl: 0.55, arp: 'slow8' },
      { a: 21.8, z: 29.7, groove: 'ritual', lvl: 0.8, arp: 'pluck8' },
      { a: 29.7, z: 32.7, groove: 'roll', lvl: 0.9 },
      { a: 32.7, z: 36.7, groove: 'four', lvl: 1.1, arp: 'pluck16', clap: true, stabs: true },
      { a: 36.7, z: 38.1, groove: 'roll', lvl: 0.9 },
      { a: 38.1, z: 42.6, groove: 'drift', lvl: 0.5, arp: 'slow' },
    ],
    lead: (B) => beats(32.73, B, [[78, 1], [83, 1], [81, 0.5], [78, 0.5], [76, 1], [78, 2]]),
    kick: { f0: 200, f1: 44, decay: 0.14 }, fade: [47.6, 48.95],
  },
  // every realm: G Mixolydian, I-bVII-IV-I at 120 BPM (a bar every two seconds, a realm a little under
  // seven bars). Each realm's pass comes in a little harder than the last, as the trip grows under
  // the page; four on the floor for the trip, the lead over the stones' orbit (76.4 s)
  'every-realm': {
    key: 'G Mixolydian', bpm: 120, grid: 0.0, sub: 31, wind: 0.24,
    chords: [[43, [55, 59, 62, 67]], [41, [53, 57, 60, 65]], [48, [55, 60, 64, 67]], [43, [55, 59, 62, 65]]],
    calmAt: 85.4, calm: [[43, [55, 59, 62, 67]], [48, [55, 60, 64, 67]]],
    steps: [67, 69, 71, 72, 74, 76, 77, 79],
    fontPitch: { runic: 79, oldworld: 74, future: 83 },
    arp: [0, 2, 1, 3, 2, 4, 3, 1],
    sections: [
      { a: 0.4, z: 2.4, groove: 'drift', lvl: 0.35, arp: 'slow' },
      { a: 2.4, z: 16.0, groove: 'drift', lvl: 0.45, arp: 'slow8' },
      { a: 16.0, z: 29.6, groove: 'break', lvl: 0.55, arp: 'pluck8' },
      { a: 29.6, z: 43.2, groove: 'break', lvl: 0.65, arp: 'pluck8' },
      { a: 43.2, z: 56.8, groove: 'four', lvl: 0.7, arp: 'pluck16' },
      { a: 56.8, z: 70.4, groove: 'four', lvl: 0.8, arp: 'pluck16' },
      { a: 70.4, z: 72.4, groove: 'four', lvl: 0.9, arp: 'pluck16' },
      { a: 72.4, z: 82.6, groove: 'four', lvl: 1.1, arp: 'pluck', clap: true, stabs: true },
      { a: 82.6, z: 85.4, groove: 'drift', lvl: 0.55, arp: 'slow' },
    ],
    lead: (B) => beats(76.4, B, [[79, 1], [77, 0.5], [74, 0.5], [76, 1], [79, 1], [81, 1], [79, 0.5], [77, 0.5], [74, 2], [79, 1], [83, 2]]),
    kick: { f0: 210, f1: 46, decay: 0.13 }, fade: [88.4, 89.95],
  },
};

function score(film) {
  const M = MUSIC[film.key];
  if (!M) throw new Error('no music for ' + film.key);
  const BEAT = 60 / M.bpm, BAR = 4 * BEAT, SIX = BEAT / 4;
  const mix = newMix(film.dur, M.bpm);
  const seed = (s) => film.key + ':' + s;
  const barOf = (t) => Math.floor((t - M.grid + 1e-6) / BAR);
  const chordAt = (t) => {
    if (M.warm && t >= M.warm.a && t < M.warm.z) { const b = Math.floor((t - M.warm.a + 1e-6) / BAR); return M.warm.chords[((b % 4) + 4) % 4]; }
    if (t >= M.calmAt) { const b = Math.floor((t - M.calmAt + 1e-6) / (2 * BAR)); return M.calm[Math.min(M.calm.length - 1, b)]; }
    const b = barOf(t); return M.chords[((b % 4) + 4) % 4];
  };
  const tonic = M.chords[0][1];
  const step = (() => { const n = {}; return (kind) => { n[kind] = (n[kind] || 0) + 1; return M.steps[(n[kind] - 1) % M.steps.length]; }; })();

  /* ---------- the bed: wind, the sub, the chords as a pad ---------- */
  wind(mix, 'wind', { gain: M.wind, seed: seed('wind') });
  drone(mix, 'sub', { midi: M.sub, gain: 0.16 });
  // the pad changes on the grid's bars; the warm section and the calm keep their own bars
  const inWarm = (t) => M.warm && t > M.warm.a + 1e-3 && t < M.warm.z - 1e-3;
  const cutSet = new Set([0]);
  for (let n = -8; M.grid + n * BAR < film.dur; n++) { const t = M.grid + n * BAR; if (t > 0 && t < M.calmAt && !inWarm(t)) cutSet.add(+t.toFixed(4)); }
  if (M.warm) { for (let t = M.warm.a; t < M.warm.z - 1e-3; t += BAR) cutSet.add(+t.toFixed(4)); cutSet.add(M.warm.z); }
  for (let t = M.calmAt; t < film.dur; t += 2 * BAR) cutSet.add(+t.toFixed(4));
  const cuts = [...cutSet].sort((a, b) => a - b);
  cuts.forEach((t, i) => {
    const next = cuts[i + 1] ?? film.dur;
    const [, notes] = chordAt(t);
    const warm = M.warm && t >= M.warm.a && t < M.warm.z, calm = t >= M.calmAt;
    put(mix, 'pad', D.padChord({ notes, gate: Math.max(0.3, next - t), a: calm ? 1.2 : 0.7, r: 1.4, cut: warm ? 2400 : calm ? 1500 : 1100, voices: 4, cents: calm ? 9 : 14, seed: seed('pad' + i) }), t, { gain: warm ? 0.26 : calm ? 0.24 : 0.2 });
  });

  /* ---------- the grooves ---------- */
  const kicks = [];
  const K = D.makeKick({ seed: seed('kick'), ...M.kick });
  const SN = D.makeSnare({ seed: seed('snare') }), CL = D.makeClap(seed('clap'));
  const HAT = D.makeHat({ seed: seed('hat') }), OH = D.makeHat({ decay: 0.12, len: 0.4, seed: seed('oh') });
  const TL = D.makeTom(82, seed('toml')), TM = D.makeTom(124, seed('tomm')), TH = D.makeTom(176, seed('tomh'));
  const kick = (t, g) => { put(mix, 'kick', K, t, { gain: g }); kicks.push(t); };
  const bass = (t, gate, root, vel, cut) => D.bassNote(stem(mix, 'bass'), { t0: t, gate, midi: root, vel, cut, envHz: 500 + 900 * vel, seed: seed('b' + t.toFixed(3)) });
  const arpNote = (sec, t, k) => {
    const [, notes] = chordAt(t);
    const tones = [...notes, notes[0] + 12, notes[1] + 12];
    const m = tones[M.arp[k % M.arp.length] % tones.length] + 12;
    const lvl = sec.lvl;
    if (sec.arp === 'harp') put(mix, 'harp', harp(m, { len: 2.2, vel: 0.5, seed: seed('h' + t.toFixed(3)) }), t, { gain: 0.5, pan: k % 2 ? 0.35 : -0.35 });
    else D.pluck(stem(mix, 'arp'), { t0: t, midi: m, vel: 0.42 * Math.min(1, lvl), cut: 900 + 2200 * Math.min(1, lvl), pan: k % 2 ? 0.3 : -0.3, seed: seed('a' + t.toFixed(3)) });
  };
  for (const sec of M.sections) {
    // the groove starts on the first grid step at or after the section's own start
    const k0 = Math.ceil((sec.a - M.grid) / SIX - 1e-6);
    for (let k = k0; ; k++) {
      const t = M.grid + k * SIX;
      if (t >= sec.z - 1e-6) break;
      if (t < 0) continue;
      const s = ((k % 16) + 16) % 16, lvl = sec.lvl;
      const [root] = chordAt(t);
      switch (sec.groove) {
        case 'four': {
          if (s % 4 === 0 && (!sec.half || s % 8 === 0)) kick(t, 0.78 * Math.min(1, lvl));
          if (!sec.half && s % 4 === 2) put(mix, 'hats', OH, t, { gain: 0.1 * lvl, pan: 0.15 });
          if (!sec.half && s % 2 === 1) put(mix, 'hats', HAT, t, { gain: 0.05 * lvl, pan: s % 4 === 1 ? -0.25 : 0.25 });
          if (sec.clap && (s === 4 || s === 12)) put(mix, 'snare', CL, t, { gain: 0.36 });
          if (sec.half) { if (s % 4 === 2) bass(t, BEAT * 0.4, root, 0.55 * lvl + 0.2, 260 + 500 * lvl); }
          else if (s % 4 === 2) bass(t, BEAT * 0.42, root, 0.8, 520 + 600 * Math.min(1, lvl));
          if (sec.arp && s % 1 === 0) arpNote(sec, t, k);
          if (sec.stabs && s === 0) for (const m of chordAt(t)[1]) D.supersaw(stem(mix, 'saw'), { t0: t, gate: BAR * 0.9, midi: m + 12, vel: 0.2, a: 0.02, r: 0.4, seed: seed('st' + k + ':' + m) });
          break;
        }
        case 'drift': {
          // the come-down: no drums; the bass holds a bar, the arp slows and darkens
          const fall = 1 - (t - sec.a) / (sec.z - sec.a);
          if (s === 0) bass(t, BAR * 0.9, root, 0.5 * fall + 0.15, 200 + 300 * fall);
          if (s % 4 === 0) arpNote({ ...sec, lvl: 0.25 + 0.5 * fall }, t, k / 2);
          break;
        }
        case 'heart': {
          // lub-dub on every beat (twice a beat as the fall quickens), the bass a held low note
          const every = sec.fast ? 2 : 4;
          if (s % every === 0) {
            if (sec.soft) put(mix, 'kick', K, t, { gain: 0.32 * lvl }); else kick(t, 0.82 * lvl);
            put(mix, 'kick', K, t + 0.17 * (sec.fast ? 0.7 : 1), { gain: (sec.soft ? 0.2 : 0.5) * lvl });
          }
          if (s === 0) bass(t, BAR * 0.92, root, (sec.soft ? 0.3 : 0.55) * lvl + 0.1, sec.soft ? 160 : 220 + 260 * lvl);
          break;
        }
        case 'break': {
          // a breakbeat: kick 1, 2-and, 3-and-a-half; snare 2 and 4 with ghosts; hats on the 8ths
          if (s === 0 || s === 6 || s === 10 || (s === 11 && k % 32 >= 16)) kick(t, 0.74 * lvl);
          if (s === 4 || s === 12) put(mix, 'snare', SN, t, { gain: 0.42 * lvl });
          if (s === 7 || s === 15 || s === 9) put(mix, 'snare', SN, t, { gain: 0.1 * lvl });
          if (s % 2 === 0) put(mix, 'hats', HAT, t, { gain: (s % 4 === 2 ? 0.1 : 0.06) * lvl, pan: s % 8 < 4 ? -0.2 : 0.2 });
          if (s === 14 && lvl > 0.9) put(mix, 'hats', OH, t, { gain: 0.08 });
          if (s === 0 || s === 6 || s === 10) bass(t, SIX * 2.6, root, 0.75 * lvl, 420 + 700 * lvl);
          if (sec.arp && s % 2 === 0) arpNote(sec, t, k / 2);
          break;
        }
        case 'warm': {
          // Agartha: no drums, a harp walking the chord in eighths and the bass on the bar
          if (s === 0) bass(t, BAR * 0.95, root, 0.35, 240);
          if (s % 2 === 0) arpNote(sec, t, k / 2);
          break;
        }
        case 'march': {
          // toms on the beat, a snare on two and four, a roll into every other bar
          if (s === 0 || s === 8) { put(mix, 'toms', TL, t, { gain: 0.62 * lvl }); kick(t, 0.5 * lvl); }
          if (s === 4 || s === 12) put(mix, 'toms', TM, t, { gain: 0.42 * lvl, pan: 0.2 });
          if (s === 10) put(mix, 'toms', TH, t, { gain: 0.3 * lvl, pan: -0.25 });
          if (!sec.light && (s === 4 || s === 12)) put(mix, 'snare', SN, t, { gain: 0.34 * lvl });
          if (!sec.light && k % 32 >= 16 && s >= 13) put(mix, 'snare', SN, t, { gain: (0.1 + 0.05 * (s - 13)) * lvl });
          if (s % 4 === 2) put(mix, 'hats', HAT, t, { gain: 0.05 * lvl });
          if (!sec.light && (s === 0 || s === 8 || s === 14)) bass(t, s === 14 ? SIX * 1.6 : BEAT * 1.6, root, 0.7 * lvl, 380 + 500 * lvl);
          if (sec.arp === 'pluck8' && s % 2 === 0) arpNote(sec, t, k / 2);
          break;
        }
        case 'ritual': {
          // hand drums round a fire: low toms on one and the and-of-two, a mid tom on two and
          // four, a shaker on every sixteenth; the kick joins once it builds
          if (s === 0 || s === 6 || s === 10) put(mix, 'toms', TL, t, { gain: (0.45 + 0.1 * (s === 0)) * lvl, pan: s === 6 ? -0.2 : 0 });
          if (s === 4 || s === 12) put(mix, 'toms', TM, t, { gain: 0.38 * lvl, pan: 0.25 });
          if (s === 15 && k % 32 >= 16) put(mix, 'toms', TH, t, { gain: 0.26 * lvl, pan: -0.3 });
          put(mix, 'hats', HAT, t, { gain: (s % 4 === 2 ? 0.06 : 0.03) * lvl, pan: s % 2 ? 0.3 : -0.3 });
          if (lvl > 0.7 && (s === 0 || s === 8)) kick(t, 0.6 * lvl);
          if (s === 0) bass(t, BAR * 0.9, root, 0.35 + 0.3 * lvl, 200 + 260 * lvl);
          if (sec.arp && s % (sec.arp === 'pluck16' ? 1 : 2) === 0) arpNote(sec, t, sec.arp === 'pluck16' ? k : k / 2);
          break;
        }
        case 'roll': {
          // a snare roll that doubles and swells into the next moment
          const p = (t - sec.a) / (sec.z - sec.a);
          const sub = p > 0.6 ? 2 : 1;
          for (let j = 0; j < sub; j++) put(mix, 'snare', SN, t + j * SIX / sub, { gain: (0.08 + 0.32 * p * p) * lvl });
          if (s % 4 === 0 && film.key === 'arsenal') put(mix, 'toms', TL, t, { gain: 0.3 + 0.3 * p });
          break;
        }
        default: break;
      }
    }
  }

  /* ---------- the peak's melody ---------- */
  if (M.lead) {
    const line = M.lead(BEAT);
    D.leadLine(stem(mix, 'lead'), line, { seed: seed('lead'), gain: 0.62, cut: film.key === 'event-horizon' ? 2600 : 3400 });
    D.leadLine(stem(mix, 'lead8'), line, { transpose: 12, gain: 0.14, cut: 2400, envHz: 1600, spread: 0.85, seed: seed('lead8') });
  }

  /* ---------- the moments ---------- */
  const silences = [];
  const T3 = tonic.slice(0, 3);
  for (const c of film.cues || []) {
    const t = c.t, s = seed(c.kind + t);
    switch (c.kind) {
      // the settings, the vaults, the realms: in the film's key, walking up its scale
      case 'realm': put(mix, 'fx', D.whoosh({ dur: 0.8, f0: 300, fPeak: 3600, f1: 500, panFrom: -0.7, panTo: 0.7, seed: s }), t - 0.3, { gain: 0.4 });
        D.pluck(stem(mix, 'arp'), { t0: t, midi: step('realm'), vel: 0.5, cut: 2600, seed: s }); break;
      case 'script': put(mix, 'fx', D.glitch({ dur: 0.32, f: 1600, seed: s }), t, { gain: 0.28 });
        put(mix, 'ping', bell(step('script') + 12, { len: 0.8, vel: 0.5 }), t, { gain: 0.12 }); break;
      case 'cursor': put(mix, 'ui', D.blip({ f: D.mtof(step('cursor') + 12), len: 0.08 }), t, { gain: 0.2 }); break;
      case 'click': case 'hover': put(mix, 'ui', D.blip({ f: D.mtof(c.kind === 'hover' ? step('hover') + 12 : tonic[0] + 12), len: 0.06 }), t, { gain: 0.17 }); break;
      case 'type': put(mix, 'ui', D.typingClick({ seed: s }), t, { gain: 0.35 }); break;
      case 'trip': put(mix, 'fx', D.riser({ dur: 2.6, f0: 300, f1: 8000, seed: s }), t, { gain: 0.35 }); break;
      case 'arrive': put(mix, 'fx', D.whoosh({ dur: 1.8, f0: 180, fPeak: 2600, f1: 300, panFrom: -0.9, panTo: 0.9, seed: s }), t, { gain: 0.48 }); break;
      case 'mother': put(mix, 'fx', D.impact({ size: 0.7, seed: s }), t, { gain: 0.55 }); break;
      case 'beam': {
        // the mothership's hum, on the key's root and fifth, held through the peak
        const f = D.mtof(tonic[0] - 12);
        hum(mix, 'hum', { t0: t, t1: Math.min(film.dur, t + 11.4), f, gain: 0.06 });
        hum(mix, 'hum', { t0: t + 0.3, t1: Math.min(film.dur, t + 11.2), f: f * 1.5, gain: 0.035, pan: 0.4 }); break;
      }
      case 'leave': put(mix, 'fx', D.whoosh({ dur: 2.2, f0: 220, fPeak: 3000, f1: 1200, panFrom: -0.2, panTo: 0.2, seed: s }), t, { gain: 0.36 });
        put(mix, 'fx', D.riser({ dur: 1.8, f0: 500, f1: 6000, seed: s + 'r' }), t, { gain: 0.16 }); break;
      case 'white': put(mix, 'fx', D.reverseSwell({ dur: 1.0, notes: T3, seed: s }), t - 0.4, { gain: 0.55 });
        put(mix, 'hit', D.impact({ size: 0.9, seed: s + 'i' }), t + 0.6, { gain: 0.6 }); break;
      case 'deck': put(mix, 'fx', D.whoosh({ dur: 2.2, f0: 120, fPeak: 1000, f1: 200, panFrom: 0.3, panTo: -0.3, seed: s }), t, { gain: 0.45 }); break;
      case 'hole': put(mix, 'hit', D.subDrop({ f0: 90, f1: 30, dur: 4.2 }), t, { gain: 0.6 });
        put(mix, 'fx', D.shepard({ dur: Math.min(11, film.dur - t), period: 5, dir: -1, base: 40 }), t, { gain: 0.11 }); break;
      case 'feed': put(mix, 'fx', D.riser({ dur: 5.6, f0: 120, f1: 5000, curve: 1.6, seed: s }), t, { gain: 0.32 }); break;
      case 'fall': put(mix, 'fx', D.downlifter({ dur: 2.6, f0: 6000, f1: 80, seed: s }), t, { gain: 0.5 });
        put(mix, 'hit', D.subDrop({ f0: 70, f1: 24, dur: 3.2 }), t + 0.8, { gain: 0.5 }); break;
      case 'silence': silences.push([t, t + 0.95]); break;
      case 'shift': put(mix, 'fx', D.glitch({ dur: 0.4, f: 2200, seed: s }), t, { gain: 0.32 });
        put(mix, 'fx', D.whoosh({ dur: 0.6, f0: 500, fPeak: 5000, f1: 800, seed: s + 'w' }), t - 0.2, { gain: 0.28 });
        put(mix, 'harp', harp(step('shift'), { len: 1.4, vel: 0.6, seed: s + 'h' }), t, { gain: 0.3 }); break;
      case 'dive': put(mix, 'fx', D.riser({ dur: 0.75, f0: 400, f1: 12000, seed: s }), t, { gain: 0.42 }); break;
      case 'emerge': put(mix, 'hit', D.impact({ size: 0.5, seed: s }), t, { gain: 0.4 }); break;
      case 'zoom': case 'relic': put(mix, 'ping', D.sonarPing({ f: D.mtof(c.kind === 'zoom' ? step('zoom') + 12 : tonic[0] + 12), dur: 2.4, soft: 0.5, seed: s }), t, { gain: 0.22 }); break;
      case 'sun': put(mix, 'pad', D.padChord({ notes: M.warm ? M.warm.chords[0][1] : tonic, gate: 4.5, a: 1.2, r: 2.4, cut: 2600, voices: 5, seed: s }), t - 0.6, { gain: 0.36 });
        put(mix, 'fx', D.reverseSwell({ dur: 1.4, notes: (M.warm ? M.warm.chords[0][1] : tonic).slice(1), seed: s + 'r' }), t - 1.4, { gain: 0.42 }); break;
      case 'push': put(mix, 'fx', D.riser({ dur: 3.4, f0: 200, f1: 7000, seed: s }), t, { gain: 0.26 }); break;
      case 'dim': put(mix, 'fx', D.downlifter({ dur: 1.2, seed: s }), t, { gain: 0.35 }); break;
      case 'holo': put(mix, 'ping', D.sonarPing({ f: D.mtof(step('holo') + 12), dur: 1.8, soft: 0.6, seed: s }), t, { gain: 0.16 });
        T3.concat(tonic[0] + 12).forEach((m, i) => D.pluck(stem(mix, 'arp'), { t0: t + i * BEAT / 4, midi: m + 12, vel: 0.5, cut: 3000, pan: i % 2 ? 0.4 : -0.4, seed: s + i })); break;
      case 'mandala': put(mix, 'fx', D.reverseSwell({ dur: 1.9, notes: tonic, seed: s }), t, { gain: 0.48 }); break;
      case 'tunnel': put(mix, 'fx', D.whoosh({ dur: 1.6, seed: s }), t, { gain: 0.4 }); put(mix, 'fx', D.riser({ dur: 3.6, f0: 300, f1: 10000, seed: s + 'r' }), t, { gain: 0.3 }); break;
      case 'line': put(mix, 'hit', D.impact({ size: 1.0, seed: s }), t, { gain: 0.62 }); put(mix, 'hit', D.makeCrash(s + 'c'), t, { gain: 0.3 }); break;

      /* the eye: the saucer's passes, the eye waking, the click, a redaction lifting */
      case 'swoop': put(mix, 'fx', D.whoosh({ dur: 1.4, f0: 260, fPeak: 3400, f1: 420, panFrom: -0.85, panTo: 0.85, seed: s }), t - 0.3, { gain: 0.34 });
        put(mix, 'ui', D.blip({ f: D.mtof(step('swoop') + 12), len: 0.07 }), t, { gain: 0.08 }); break;
      case 'orbit': hum(mix, 'hum', { t0: t, t1: t + 3.4, f: D.mtof(tonic[0] - 12), gain: 0.05, pan: -0.3 });
        hum(mix, 'hum', { t0: t + 0.2, t1: t + 3.2, f: D.mtof(tonic[0] - 12) * 1.498, gain: 0.03, pan: 0.3 });
        put(mix, 'ping', D.sonarPing({ f: D.mtof(tonic[0] + 12), dur: 2.4, soft: 0.5, seed: s }), t, { gain: 0.18 }); break;
      case 'wake': put(mix, 'fx', D.reverseSwell({ dur: 1.2, notes: [51, 55, 58, 63], seed: s }), t - 0.9, { gain: 0.4 });
        put(mix, 'ping', bell(75, { len: 2.8, vel: 0.7 }), t + 0.3, { gain: 0.16 });
        put(mix, 'hit', D.subDrop({ f0: 70, f1: 36, dur: 1.6 }), t + 0.3, { gain: 0.26 }); break;
      case 'open': put(mix, 'hit', D.impact({ size: 0.8, seed: s }), t, { gain: 0.5 });
        put(mix, 'hit', D.makeCrash(s + 'c'), t, { gain: 0.24 });
        put(mix, 'fx', D.riser({ dur: 1.4, f0: 400, f1: 12000, seed: s + 'r' }), t, { gain: 0.34 }); break;
      case 'reveal': put(mix, 'fx', D.glitch({ dur: 0.22, f: 3200, seed: s }), t, { gain: 0.16 });
        put(mix, 'ping', bell(step('reveal') + 12, { len: 2.2, vel: 0.6 }), t + 0.05, { gain: 0.14 }); break;

      /* the peak, the come-down, the calm, and the brand */
      case 'peak': {
        // (where the film already hits — the white hole, the line — the chord alone)
        if (!(film.cues || []).some((x) => (x.kind === 'white' || x.kind === 'line') && Math.abs(x.t - t) < 0.7)) {
          put(mix, 'hit', D.impact({ size: 0.85, seed: s }), t, { gain: 0.5 });
          put(mix, 'hit', D.makeCrash(s + 'c'), t, { gain: 0.28 });
        }
        // a wide chord over the peak, in the film's own key
        const notes = film.key === 'event-horizon' ? [49, 53, 56, 61, 65] : chordAt(t)[1];
        const len = film.key === 'event-horizon' ? 2.8 : film.key === 'arsenal' ? 1.4 : 2.0;
        for (const m of notes) D.supersaw(stem(mix, 'saw'), { t0: t, gate: len, midi: m + (film.key === 'event-horizon' ? 0 : 12), vel: 0.2, a: film.key === 'event-horizon' ? 0.5 : 0.03, r: 1.2, seed: s + m });
        break;
      }
      case 'down': put(mix, 'fx', D.downlifter({ dur: 2.4, f0: 7000, f1: 160, m0: tonic[0] + 24, m1: tonic[0], seed: s }), t, { gain: 0.36 }); break;
      case 'return': put(mix, 'fx', D.whoosh({ dur: 1.6, f0: 2400, fPeak: 900, f1: 300, panFrom: 0.6, panTo: -0.6, seed: s }), t, { gain: 0.3 }); break;
      case 'ascend': put(mix, 'fx', D.riser({ dur: 1.3, f0: 600, f1: 14000, seed: s }), t, { gain: 0.4 });
        put(mix, 'fx', D.reverseSwell({ dur: 1.2, notes: tonic.slice(1), seed: s + 'r' }), t, { gain: 0.36 }); break;
      case 'calm': put(mix, 'fx', D.reverseSwell({ dur: 1.6, notes: chordAt(t + 0.1)[1], seed: s }), t - 1.4, { gain: 0.22 }); break;
      case 'seal': {
        if (film.key === 'the-eye') {
          // the seal rises out of the eye's pupil: a glass arpeggio, up and up, and a low bell when it lands
          [62, 65, 69, 74, 77, 81, 86].forEach((m, i) => put(mix, 'ping', bell(m, { len: 2.4, vel: 0.55 }), t + i * 0.16, { gain: 0.1, pan: Math.sin(i) * 0.5 }));
          put(mix, 'harp', harp(50, { len: 3.4, vel: 0.7, seed: s + 'h' }), t + 2.6, { gain: 0.4 });
          put(mix, 'ping', bell(74, { len: 3.6, vel: 0.8 }), t + 2.6, { gain: 0.16 });
        } else if (film.key === 'phase-shift') {
          // the seal climbs the gate's light: a harp up the Dorian scale, an octave and a half
          const scale = [57, 59, 60, 62, 64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81];
          scale.forEach((m, i) => put(mix, 'harp', harp(m, { len: 2.6, vel: 0.55 + 0.02 * i, bright: 0.5 + 0.02 * i, seed: s + i }), t + i * 0.23, { gain: 0.42, pan: Math.sin(i * 0.9) * 0.4 }));
          put(mix, 'ping', bell(81, { len: 3.2, vel: 0.7 }), t + 3.4, { gain: 0.16 });
        } else {
          // the seal let down out of the mothership: a swell, then a bell on the tonic
          put(mix, 'fx', D.reverseSwell({ dur: 1.6, notes: chordAt(t + 1)[1], seed: s }), t - 0.2, { gain: 0.42 });
          put(mix, 'ping', bell(76, { len: 3.4, vel: 0.8 }), t + 1.4, { gain: 0.18 });
          put(mix, 'ping', bell(83, { len: 3.0, vel: 0.5 }), t + 1.45, { gain: 0.1 });
        }
        break;
      }
      case 'font': {
        // each change of script struck as a bell (Realm Shift) or a harp chord (Phase Shift)
        const pitch = (M.fontPitch || {})[c.font] ?? tonic[0] + 12;
        if (film.key === 'phase-shift') {
          put(mix, 'fx', D.glitch({ dur: 0.3, f: 2600, seed: s }), t, { gain: 0.24 });
          [pitch - 12, pitch - 5, pitch].forEach((m, i) => put(mix, 'harp', harp(m, { len: 2.2, vel: 0.6, seed: s + i }), t + i * 0.035, { gain: 0.36 }));
        } else {
          put(mix, 'ping', bell(pitch, { len: 2.6, vel: 0.8 }), t, { gain: 0.2 });
          put(mix, 'ping', bell(pitch + 7, { len: 2.0, vel: 0.4 }), t + 0.02, { gain: 0.08 });
          put(mix, 'fx', D.whoosh({ dur: 0.5, f0: 1200, fPeak: 6000, f1: 2000, seed: s + 'w' }), t - 0.15, { gain: 0.12 });
        }
        break;
      }
      case 'swap': {
        // the name falls through a tiny hole and comes back in another script
        put(mix, 'hit', D.subDrop({ f0: 80, f1: 34, dur: 1.2 }), t, { gain: 0.32 });
        put(mix, 'fx', D.reverseSwell({ dur: 0.55, notes: [61, 68, 73], seed: s }), t, { gain: 0.32 });
        const pitch = { future: 80, oldworld: 75, runic: 73 }[c.font] ?? 73;
        put(mix, 'ping', bell(pitch, { len: 2.8, vel: 0.8 }), t + 0.55, { gain: 0.2 });
        put(mix, 'ping', bell(pitch - 12, { len: 2.8, vel: 0.5 }), t + 0.56, { gain: 0.1 });
        break;
      }
      case 'url': put(mix, 'ui', D.blip({ f: 1760, len: 0.12 }), t, { gain: 0.16 });
        [61, 65, 68, 73].forEach((m, i) => put(mix, 'ping', bell(m + 12, { len: 2.4, vel: 0.5 }), t + 0.1 + i * 0.09, { gain: 0.09 })); break;
      case 'logo': {
        // the hologram projected up out of the pedestal, then the room's chord when it is whole
        put(mix, 'fx', D.riser({ dur: 1.4, f0: 300, f1: 9000, seed: s }), t, { gain: 0.3 });
        for (let i = 0; i < 10; i++) put(mix, 'ui', D.blip({ f: D.mtof(67 + [0, 3, 7, 10, 12, 15, 19, 22, 24, 27][i]), len: 0.05 }), t + i * 0.13, { gain: 0.07, pan: i % 2 ? 0.4 : -0.4 });
        put(mix, 'hit', D.impact({ size: 0.45, seed: s + 'i' }), t + 1.4, { gain: 0.36 });
        put(mix, 'ping', bell(79, { len: 3.4, vel: 0.7 }), t + 1.4, { gain: 0.14 });
        break;
      }
      case 'rescan': {
        // a scan line sweeps the name: a bright filtered sweep and three blips in the new script's pitch
        const pitch = { runic: 70, oldworld: 74, future: 79 }[c.font] ?? 79;
        put(mix, 'fx', D.whoosh({ dur: 0.55, f0: 6000, fPeak: 2200, f1: 900, panFrom: 0, panTo: 0, seed: s }), t, { gain: 0.2 });
        [0, 7, 12].forEach((d, i) => put(mix, 'ui', D.blip({ f: D.mtof(pitch + d), len: 0.07 }), t + 0.06 + i * 0.12, { gain: 0.09 }));
        put(mix, 'ping', bell(pitch + 12, { len: 1.8, vel: 0.5 }), t + 0.5, { gain: 0.08 });
        if (c.font === 'future' && t > 28) {
          // the last scan lands as the calm turns to G major: the march resolves on a low tom
          put(mix, 'toms', TL, t + 0.5, { gain: 0.5 });
          put(mix, 'toms', TL, t + 0.5 + BEAT, { gain: 0.32 });
          put(mix, 'ping', bell(67, { len: 3.6, vel: 0.7 }), t + 0.5, { gain: 0.14 });
        }
        break;
      }
      default: break;
    }
  }
  for (const [a, z] of silences) vacuum(mix, a, z);
  for (const [k, d, r] of [['bass', 0.8, 0.16], ['pad', 0.3, 0.3], ['arp', 0.2, 0.2], ['harp', 0.15, 0.2], ['wind', 0.25, 0.3], ['saw', 0.25, 0.2]]) if (mix.stems.has(k)) D.duck(stem(mix, k), kicks, d, r);
  send(mix, 'hall', stem(mix, 'pad'), 0.45); send(mix, 'hall', stem(mix, 'fx'), 0.3);
  for (const [k, h, d] of [['ping', 0.8, 0.4], ['hit', 0.3, 0], ['hum', 0.4, 0], ['harp', 0.6, 0.25], ['lead', 0.3, 0.35], ['lead8', 0.4, 0.3], ['saw', 0.3, 0], ['arp', 0, 0.4], ['ui', 0, 0.3], ['toms', 0.25, 0]]) {
    if (!mix.stems.has(k)) continue;
    if (h) send(mix, 'hall', stem(mix, k), h);
    if (d) send(mix, 'delay', stem(mix, k), d);
  }
  return master(mix, { lufs: -16, fade: M.fade });
}

const only = process.argv.slice(2);
const dir = path.join(HERE, '..', 'films');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mjs')).sort()) {
  const film = (await import(pathToFileURL(path.join(dir, f)))).default;
  if (only.length && !only.some((o) => film.key.includes(o))) continue;
  const { out, meter } = score(film);
  const base = path.join(FILMS, film.key + '.sound');
  save(out, base);
  if (!process.env.KEEP_WAV) fs.rmSync(base + '.wav');
  const mp4 = path.join(FILMS, film.key + '.mp4');
  if (fs.existsSync(mp4)) {
    const tmp = mp4.replace(/\.mp4$/, '.tmp.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-i', base + '.m4a', '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-shortest', '-movflags', '+faststart', tmp]);
    fs.renameSync(tmp, mp4);
  }
  console.log(`${film.key} (${MUSIC[film.key].key}, ${MUSIC[film.key].bpm} BPM): ${meter.integrated.toFixed(1)} LUFS, peak ${meter.truePeak.toFixed(1)} dBTP${fs.existsSync(mp4) ? ' → muxed into ' + path.relative(ROOT, mp4) : ' (no film yet)'}`);
}
