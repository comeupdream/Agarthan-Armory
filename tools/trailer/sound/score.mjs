#!/usr/bin/env node
// score.mjs — the trailer's score, "Beyond the Wall", synthesised in code.
//
//   node tools/trailer/sound/score.mjs          → media/films/score.{wav,m4a,json}
//
// D minor, 116 BPM, 4/4, 24 bars (a bar is 2.069 s). No samples: oscillators, noise and
// filters from dsp.mjs (EVRITHNG's sound library, vendored), every random number seeded,
// so the same script writes the same file. score.json is the beat map trailer.mjs cuts on.
//
// INTRO "transmission from below" bars 1–4: ice wind, a sub on D, a Dm(add9) pad swelling
//   through a closed filter, sonar pings, the carrier keying A A (·— ·—) in Morse, a reverse
//   swell into bar 5.
// BUILD "the realms shift" bars 5–12: half-time kick, 8th bass on the root (filter opening),
//   16th pluck arpeggio; bar 9 four-on-the-floor, claps, offbeat hats, a 4-bar riser; bar 11
//   a supersaw pitch riser; bar 12 a snare roll and the bottom drains out, then a VACUUM on
//   beat 4½.
// DROP "event horizon" bars 13–20 (0:24.8): impact, full kit, 16th octave bass pumping under
//   the kick, wide supersaw chords, the hook; bars 17–20 a Shepard tone falls forever under it.
// OUTRO "the name" bars 21–24: the drums stop, a roll, silence on 4½ — THE FINAL HIT on the
//   bar-22 downbeat (0:43.4): sub drop, noise burst, impact, crash, the pad's chord; then the
//   tail, a last arpeggio echoing away.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { D, newMix, stem, send, put, wind, drone, vacuum, master, save } from './kit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.env.OUT || path.join(HERE, '..', '..', '..', 'media', 'films'));
const BPM = 116, BEAT = 60 / BPM, BAR = 4 * BEAT;
const BARS = 24, TAIL = 2.4;
const T = (bar, beat = 0) => (bar - 1) * BAR + beat * BEAT;     // bar from 1, beat from 0
const DUR = T(BARS + 1) + TAIL;
const mix = newMix(DUR, BPM);

// i – VI – III – VII:  Dm  Bb  F  C
const CH = [
  { root: 38, pad: [50, 53, 57, 64], arp: [62, 65, 69, 74, 76, 74, 69, 65] },
  { root: 34, pad: [46, 50, 53, 57], arp: [58, 62, 65, 69, 70, 69, 65, 62] },
  { root: 41, pad: [53, 57, 60, 67], arp: [65, 69, 72, 77, 79, 77, 72, 69] },
  { root: 36, pad: [48, 55, 62, 64], arp: [60, 64, 67, 72, 74, 72, 67, 64] },
];
const chordAt = (bar) => CH[(bar - 1) % 4];
const SEC = { intro: [1, 5], build: [5, 13], drop: [13, 21], outro: [21, 25] };
const DROP = T(13), HIT = T(22), VAC = [T(12, 3.5), T(13)], VAC2 = [T(21, 3.5), T(22)];

/* ---------- intro ---------- */
wind(mix, 'wind', { t0: 0, t1: DUR, gain: 0.32, lane: (t) => (t < DROP ? 1 : t < HIT ? 0.45 : 0.8) });
drone(mix, 'sub', { t0: 0, t1: T(13), midi: 26, gain: 0.2 });
drone(mix, 'sub', { t0: HIT, t1: DUR, midi: 26, gain: 0.16 });
for (let b = 1; b <= 4; b++) {
  const c = chordAt(b);
  const buf = D.padChord({ notes: c.pad, gate: BAR, a: b === 1 ? 2.2 : 0.6, r: 1.6, cut: 500 + b * 260, voices: 5, cents: 16, seed: 'ipad' + b });
  put(mix, 'pad', buf, T(b), { gain: 0.32 });
}
for (const [b, f] of [[1, 880], [2, 660], [3, 880], [4, 990]]) put(mix, 'ping', D.sonarPing({ f, dur: 2.4, soft: 0.4, seed: 'ping' + b }), T(b), { gain: 0.22, pan: b % 2 ? -0.3 : 0.3 });
{
  const m = D.morse(['A', 'A']);
  const unit = BEAT / 4;
  for (const [u, len] of m.elements) D.carrier(stem(mix, 'beacon'), { t0: T(2, 1) + u * unit, dur: len * unit, f: 1318.5, gain: 0.07, pan: 0.2 });
}
put(mix, 'fx', D.reverseSwell({ dur: 1.6, notes: [50, 57, 62], seed: 'sw1' }), T(5) - 1.6, { gain: 0.5 });

/* ---------- drums ---------- */
const kick = D.makeKick({ seed: 'kick' }), kickBig = D.makeKick({ f0: 260, f1: 48, decay: 0.16, seed: 'kickbig' });
const snare = D.makeSnare({ seed: 'snare' }), clap = D.makeClap('clap');
const hat = D.makeHat({ seed: 'hat' }), ohat = D.makeHat({ decay: 0.16, len: 0.4, seed: 'ohat' });
const kicks = [];
for (let b = 5; b <= 20; b++) {
  const full = b >= 9;
  for (let k = 0; k < 4; k++) {
    if (!full && k % 2) continue;
    const t = T(b, k);
    if (t >= VAC[0] && t < VAC[1]) continue;
    put(mix, 'kick', b >= 13 ? kickBig : kick, t, { gain: b >= 13 ? 0.95 : 0.8 }); kicks.push(t);
  }
  if (b >= 9) {
    for (const k of [1, 3]) { put(mix, 'clap', clap, T(b, k), { gain: b >= 13 ? 0.42 : 0.3 }); if (b >= 13) put(mix, 'snare', snare, T(b, k), { gain: 0.5 }); }
    for (let s = 0; s < 16; s++) {
      const t = T(b, s / 4);
      if (b < 13 && s % 4 !== 2) continue;
      if (t >= VAC[0] && t < VAC[1]) continue;
      put(mix, 'hats', s % 4 === 2 && b >= 13 ? ohat : hat, t, { gain: s % 4 === 2 ? 0.2 : 0.12, pan: (s % 2 ? 0.25 : -0.25), end: t + BEAT / 2 });
    }
  }
}
// snare roll into the drop: 8ths, then 16ths, then 32nds, tuning up
for (let i = 0; i < 28; i++) {
  const step = i < 8 ? 0.5 : i < 20 ? 0.25 : 0.125;
  const at = i < 8 ? i * 0.5 : i < 20 ? 4 + (i - 8) * 0.25 : 7 + (i - 20) * 0.125;
  const t = T(11, at);
  if (t >= VAC[0]) break;
  put(mix, 'snare', D.makeSnare({ tune: i * 0.35, seed: 'roll' }), t, { gain: 0.12 + 0.3 * (i / 28) });
  void step;
}
for (let i = 0; i < 12; i++) { const t = T(21, 2 + i * 0.125); if (t < VAC2[0]) put(mix, 'snare', D.makeSnare({ tune: i * 0.5, seed: 'roll2' }), t, { gain: 0.15 + 0.3 * i / 12 }); }
for (const b of [13, 17]) put(mix, 'crash', D.makeCrash('crash' + b), T(b), { gain: 0.45 });
put(mix, 'fx', D.impact({ size: 1.1, seed: 'drop' }), DROP, { gain: 0.8 });
put(mix, 'fx', D.reverseSwell({ dur: 1.0, notes: [50, 57, 62, 65], seed: 'sw2' }), DROP - 1.0, { gain: 0.6 });

/* ---------- bass, arp, pads ---------- */
for (let b = 5; b <= 21; b++) {
  const c = chordAt(b);
  const drop = b >= 13 && b <= 20;
  const n = drop ? 16 : 8;
  const open = Math.min(1, (b - 5) / 8);
  for (let s = 0; s < n; s++) {
    const t = T(b, (s * 4) / n);
    if ((t >= VAC[0] && t < VAC[1]) || t >= VAC2[0]) continue;
    const midi = drop && s % 4 === 3 ? c.root + 12 : c.root;
    D.bassNote(stem(mix, 'bass'), { t0: t, gate: (BEAT * 4) / n * 0.8, midi, vel: 0.9, cut: drop ? 900 : 160 + 900 * open, envHz: drop ? 1600 : 500 + 700 * open, seed: 'bass' + b + ':' + s });
  }
  if (b <= 20) for (let s = 0; s < 16; s++) {
    const t = T(b, s / 4);
    if (t >= VAC[0] && t < VAC[1]) continue;
    D.pluck(stem(mix, 'arp'), { t0: t, midi: c.arp[s % 8] + (drop && s % 8 > 4 ? 12 : 0), vel: 0.7, cut: drop ? 3200 : 500 + 2200 * open, pan: s % 2 ? 0.35 : -0.35, seed: 'arp' + b + ':' + s });
  }
  if (b >= 5 && b <= 20) {
    if (drop) for (const m of c.pad) D.supersaw(stem(mix, 'saw'), { t0: T(b), gate: BAR * 0.96, midi: m, vel: 0.33, a: 0.02, r: 0.3, seed: 'saw' + b + ':' + m });
    else put(mix, 'pad', D.padChord({ notes: c.pad, gate: BAR, a: 0.3, r: 1.0, cut: 900 + 1600 * open, seed: 'bpad' + b }), T(b), { gain: 0.28 });
  }
}
// risers into the drop
put(mix, 'fx', D.riser({ dur: 4 * BAR - BEAT / 2, f0: 250, f1: 9000, seed: 'rise1' }), T(9), { gain: 0.32 });
D.supersaw(stem(mix, 'rise'), { t0: T(11), gate: 2 * BAR - BEAT / 2, midi: 45, vel: 0.22, a: 0.5, r: 0.05, seed: 'pitchrise', glide: (tn) => 45 + 24 * Math.pow(Math.min(1, tn / (2 * BAR - BEAT / 2)), 1.8), killAt: VAC[0] });
put(mix, 'fx', D.riser({ dur: BAR - BEAT / 2, f0: 600, f1: 11000, seed: 'rise2' }), T(21), { gain: 0.3 });

/* ---------- the hook ---------- */
const HOOK = [
  [13, 0, 1, 74], [13, 1, 0.5, 77], [13, 1.5, 0.5, 76], [13, 2, 2, 69],
  [14, 0, 1, 70], [14, 1, 1, 74], [14, 2, 2, 77],
  [15, 0, 1, 69], [15, 1, 0.5, 72], [15, 1.5, 0.5, 76], [15, 2, 1, 79], [15, 3, 1, 77],
  [16, 0, 1, 76], [16, 1, 1, 72], [16, 2, 2, 74],
];
const line = [];
for (const rep of [0, 4]) for (const [b, beat, len, m] of HOOK) line.push({ t0: T(b + rep, beat), dur: len * BEAT * 0.95, midi: m + (rep && b === 16 && beat === 2 ? 5 : 0) });
D.leadLine(stem(mix, 'lead'), line, { seed: 'lead', gain: 0.8 });
D.leadLine(stem(mix, 'lead8'), line.filter((n) => n.t0 >= T(17)), { transpose: 12, gain: 0.22, cut: 2600, envHz: 1800, spread: 0.85, seed: 'lead8' });
// the black hole under the second half of the drop: a tone that falls forever
put(mix, 'fx', D.shepard({ dur: 4 * BAR, period: 6, dir: -1, base: 45 }), T(17), { gain: 0.1 });

/* ---------- the final hit and the tail ---------- */
put(mix, 'hit', D.subDrop({ f0: 110, f1: 32, dur: 4.6 }), HIT, { gain: 0.9 });
put(mix, 'hit', D.noiseBurst({ dur: 2.6, seed: 'burst' }), HIT, { gain: 0.35 });
put(mix, 'hit', D.impact({ size: 1.4, seed: 'final' }), HIT, { gain: 0.9 });
put(mix, 'crash', D.makeCrash('crashF'), HIT, { gain: 0.5 });
put(mix, 'pad', D.padChord({ notes: [38, 50, 57, 62, 64, 69], gate: 2.2 * BAR, a: 0.01, r: 2.8, cut: 2400, voices: 6, seed: 'finalpad' }), HIT, { gain: 0.4 });
[69, 72, 76, 81, 83, 88].forEach((m, i) => D.pluck(stem(mix, 'arp'), { t0: T(23, i * 0.5), midi: m, vel: 0.6 - i * 0.06, cut: 2600, pan: i % 2 ? 0.4 : -0.4, seed: 'last' + i }));
{
  const m = D.morse(['A', 'R']);
  const unit = BEAT / 4;
  for (const [u, len] of m.elements) D.carrier(stem(mix, 'beacon'), { t0: T(24) + u * unit, dur: len * unit, f: 1318.5, gain: 0.04, pan: -0.3 });
}
vacuum(mix, ...VAC);
vacuum(mix, ...VAC2);
// put back what must cross the vacuums (the swells breathing into each downbeat)
put(mix, 'swell', D.reverseSwell({ dur: BEAT / 2, notes: [50, 57, 62], seed: 'vac1' }), DROP - BEAT / 2, { gain: 0.55 });
put(mix, 'swell', D.reverseSwell({ dur: BEAT / 2, notes: [50, 57, 62], seed: 'vac2' }), HIT - BEAT / 2, { gain: 0.55 });

/* ---------- side-chain, sends, master ---------- */
for (const [k, d, r] of [['bass', 0.85, 0.16], ['saw', 0.55, 0.3], ['pad', 0.4, 0.3], ['arp', 0.3, 0.2], ['wind', 0.3, 0.3]]) if (mix.stems.has(k)) D.duck(stem(mix, k), kicks.filter((t) => t >= DROP), d, r);
send(mix, 'hall', stem(mix, 'pad'), 0.5); send(mix, 'hall', stem(mix, 'ping'), 0.8); send(mix, 'hall', stem(mix, 'fx'), 0.25);
send(mix, 'hall', stem(mix, 'snare'), 0.25); send(mix, 'hall', stem(mix, 'clap'), 0.35); send(mix, 'hall', stem(mix, 'lead'), 0.18);
send(mix, 'hall', stem(mix, 'hit'), 0.3); send(mix, 'hall', stem(mix, 'beacon'), 0.6);
send(mix, 'delay', stem(mix, 'arp'), 0.4); send(mix, 'delay', stem(mix, 'lead'), 0.22); send(mix, 'delay', stem(mix, 'ping'), 0.5); send(mix, 'delay', stem(mix, 'beacon'), 0.5);

const { out, meter } = master(mix, { lufs: -14 });
fs.mkdirSync(OUT, { recursive: true });
save(out, path.join(OUT, 'score'));
const map = {
  title: 'Beyond the Wall', key: 'D minor', bpm: BPM, bar: BAR, beat: BEAT, dur: DUR,
  bars: Array.from({ length: BARS + 1 }, (_, i) => +T(i + 1).toFixed(4)),
  sections: Object.entries(SEC).map(([name, [a]]) => ({ name, start: +T(a).toFixed(4) })),
  drop: +DROP.toFixed(4), hit: +HIT.toFixed(4),
  loudness: { integrated: +meter.integrated.toFixed(2), truePeak: +meter.truePeak.toFixed(2) },
};
fs.writeFileSync(path.join(OUT, 'score.json'), JSON.stringify(map, null, 2) + '\n');
console.log(`score: ${DUR.toFixed(2)} s · drop ${DROP.toFixed(2)} s · hit ${HIT.toFixed(2)} s · ${meter.integrated.toFixed(1)} LUFS, peak ${meter.truePeak.toFixed(1)} dBTP`);
