// dsp.mjs — EVRITHNG's sound library: every building block a film's score is made of.
//
// Plain ESM, Node 22, no dependencies (ffmpeg on the PATH only for AAC in and out and the
// independent loudness cross-check). Every sound is an oscillator, a noise generator or a
// filter written here; every random number comes from a seeded generator (`rngFor(name)`),
// so the same call writes the same samples, bit for bit, on every run. Nothing reads a clock
// and nothing calls Math.random.
//
// The trailer score (../score.mjs) was the first user of these and imports them. Its
// building blocks moved here VERBATIM — the arithmetic, the order of operations and the
// rounding are the ones that wrote brand/motion/evrithng-score.wav, and that WAV is proved
// byte-identical before and after the move. What changed is only where three things come
// from: the sample rate (an `sr` argument, default 48 kHz), the moment a voice must be gone
// by (a `killAt` time, the trailer's vacuums, default never) and the pitch wow (an optional
// per-sample array). A function marked "the trailer's" below is one of those; change its
// arithmetic and the trailer changes with it.
//
// Conventions
//   - Time is in seconds, sample index = Math.round(t * sr) (`idx`).
//   - A stem or a stereo buffer is { L: Float32Array, R: Float32Array }; a mono one-shot is a
//     bare Float32Array. Voices that write into a stem ADD into it.
//   - Pan is -1 (left) … +1 (right), equal power, unity on both sides at the centre.
//   - Levels are linear amplitude; `db`/`undb` convert. Loudness is LUFS (BS.1770-4).
//
// Contents (search for the ══ headers)
//   units · random · envelopes · oscillators · filters · lanes · buffers · drums
//   the trailer's voices · more voices · fx voices · effects · dynamics · meters · files

import { writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

export const SR = 48000;

// ═══════════════════════════════════════════════════════════════════ units ══

/** MIDI note → Hz (A4 = 69 = 440 Hz). */
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
/** Linear amplitude → dB (silence is -Infinity). */
export const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
/** dB → linear amplitude. */
export const undb = (d) => Math.pow(10, d / 20);
export const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
/** Seconds → sample index. */
export const idx = (sec, sr = SR) => Math.round(sec * sr);
/** A new silent stereo buffer of n samples. */
export const stereo = (n) => ({ L: new Float32Array(n), R: new Float32Array(n) });

// ═══════════════════════════════════════════════════════════════════ random ══

/** Tommy Ettinger's mulberry32: a 32-bit seed → a stream of floats in [0, 1). */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** One independent stream per name (FNV-1a of the name), so changing one part never reshuffles another's noise. */
export function rngFor(name) {
  let h = 2166136261;
  for (let k = 0; k < name.length; k++) {
    h ^= name.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  return mulberry32(h >>> 0);
}
/** White noise in [-1, 1) from a stream. */
export const white = (rng) => rng() * 2 - 1;

/**
 * Pink noise, Paul Kellet's economy filter (three poles, within ±0.5 dB of -3 dB/oct over
 * the audio band). `next()` returns the unscaled sum; it peaks near ±3, so scale it.
 */
export class Pink {
  constructor(rng) {
    this.rng = rng;
    this.b0 = 0;
    this.b1 = 0;
    this.b2 = 0;
    /** the last white sample, for a caller that wants both */
    this.w = 0;
  }
  next() {
    const w = this.rng() * 2 - 1;
    this.w = w;
    this.b0 = 0.99765 * this.b0 + w * 0.099046;
    this.b1 = 0.963 * this.b1 + w * 0.2965164;
    this.b2 = 0.57 * this.b2 + w * 1.0526913;
    return this.b0 + this.b1 + this.b2 + w * 0.1848;
  }
}

// ═══════════════════════════════════════════════════════════════════ envelopes ══

/** Equal-power pan, normalised so the centre is unity on both sides. */
export function panGains(p) {
  const a = ((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4;
  return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2];
}

/** Raised-cosine attack: zero slope at both ends. */
export function att(tn, a) {
  if (tn >= a) return 1;
  if (tn <= 0) return 0;
  return 0.5 - 0.5 * Math.cos((Math.PI * tn) / a);
}
/** Release after the gate: (1-x)^pow reaches zero with zero slope (pow >= 2). */
export function rel(tn, gate, r, pow = 2) {
  if (tn <= gate) return 1;
  const x = (tn - gate) / r;
  return x >= 1 ? 0 : Math.pow(1 - x, pow);
}

/**
 * ADSR at `tn` seconds into a note held for `gate` seconds, declicked: the attack is a
 * raised cosine (never shorter than 1.5 ms), the decay a raised cosine from 1 down to the
 * sustain, and the release falls from wherever the note was when the gate closed to zero
 * with zero slope (never shorter than 3 ms). Returns 0..1. A note is silent after
 * gate + r, so a voice may stop rendering there.
 */
export function adsr(tn, gate, { a = 0.005, d = 0.1, s = 0.7, r = 0.2, pow = 2 } = {}) {
  const A = Math.max(0.0015, a);
  const R = Math.max(0.003, r);
  const pre = (x) => {
    if (x <= 0) return 0;
    if (x < A) return att(x, A);
    if (x < A + d) return s + (1 - s) * (0.5 + 0.5 * Math.cos((Math.PI * (x - A)) / d));
    return s;
  };
  if (tn <= gate) return pre(tn);
  return pre(gate) * rel(tn, gate, R, pow);
}

/** An exponential decay that reaches exactly zero (with zero slope) at `len`: no click at a voice's end. */
export function decayTo(tn, tau, len) {
  if (tn < 0 || tn >= len) return 0;
  const k = 1 - tn / len;
  return Math.exp(-tn / tau) * k * k;
}

// ═══════════════════════════════════════════════════════════════════ oscillators ══

/** Band-limited step correction (polyBLEP) for saws and pulses. */
export function blep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}
/**
 * Band-limited ramp correction (polyBLAMP, the integral of the polyBLEP residual) for a
 * slope change of one unit per sample — what rounds a triangle's corners.
 */
export function blamp(t, dt) {
  if (t < dt) {
    const x = 1 - t / dt;
    return (x * x * x) / 6;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt + 1;
    return (x * x * x) / 6;
  }
  return 0;
}

/**
 * A phase-accumulator oscillator with band-limited shapes. One object is one voice: call
 * ONE shape per sample (each advances the phase). Frequencies may change every sample.
 */
export class Osc {
  constructor(phase = 0, sr = SR) {
    this.p = phase - Math.floor(phase);
    this.sr = sr;
  }
  _step(f) {
    const dt = f / this.sr;
    let p = this.p + dt;
    if (p >= 1 || p < 0) p -= Math.floor(p);
    this.p = p;
    return dt;
  }
  sine(f) {
    this._step(f);
    return Math.sin(2 * Math.PI * this.p);
  }
  saw(f) {
    const dt = this._step(f);
    return 2 * this.p - 1 - blep(this.p, dt);
  }
  square(f) {
    return this.pulse(f, 0.5);
  }
  /** A pulse of width w (0..1). */
  pulse(f, w = 0.5) {
    const dt = this._step(f);
    const p = this.p;
    return (p < w ? 1 : -1) + blep(p, dt) - blep((p + 1 - w) % 1, dt);
  }
  /** A triangle, its two corners rounded by polyBLAMP. */
  tri(f) {
    const dt = this._step(f);
    const p = this.p;
    let v = 1 - 4 * Math.abs(p - 0.5);
    v += 8 * dt * (blamp(p, dt) - blamp((p + 0.5) % 1, dt));
    return v;
  }
}

/**
 * Two-operator phase modulation (the DX7's basic pair): a sine carrier at f whose phase is
 * pushed by a sine modulator at f·ratio, `index` radians deep, with optional modulator
 * self-feedback. Bright and bell-like at integer ratios, clangorous at odd ones.
 */
export class FMPair {
  constructor({ ratio = 2, index = 1, feedback = 0, phase = 0, sr = SR } = {}) {
    this.ratio = ratio;
    this.index = index;
    this.feedback = feedback;
    this.pc = phase;
    this.pm = 0;
    this.last = 0;
    this.sr = sr;
  }
  next(f, index = this.index) {
    this.pm += (f * this.ratio) / this.sr;
    this.pm -= Math.floor(this.pm);
    this.pc += f / this.sr;
    this.pc -= Math.floor(this.pc);
    const m = Math.sin(2 * Math.PI * this.pm + this.feedback * this.last);
    this.last = m;
    return Math.sin(2 * Math.PI * this.pc + index * m);
  }
}

/** A triangle wavefolder: x·drive reflected back into [-1, 1] as often as it overshoots. */
export function fold(x, drive = 1) {
  const u = x * drive + 1;
  const m = u - 4 * Math.floor(u / 4);
  return 1 - Math.abs(m - 2);
}
/** A sine wavefolder: smoother than `fold` (rounded peaks, less aliasing). */
export const sinFold = (x, drive = 1) => Math.sin((Math.PI / 2) * x * drive);

/**
 * Bitcrusher and decimator: sample-and-hold at `rate` Hz, quantised to `bits` bits. The
 * chiptune sound — and, at a few kHz, the aliasing is the point.
 */
export class Crusher {
  constructor({ bits = 8, rate = 11025, sr = SR } = {}) {
    this.levels = Math.pow(2, bits - 1);
    this.step = rate / sr;
    this.ph = 1;
    this.held = 0;
  }
  tick(x) {
    this.ph += this.step;
    if (this.ph >= 1) {
      this.ph -= 1;
      this.held = Math.round(x * this.levels) / this.levels;
    }
    return this.held;
  }
}

/**
 * Karplus–Strong plucked string: a noise burst circulating in a delay line one period long,
 * through a one-zero loss filter. Tuned with a first-order all-pass for the fractional part
 * of the period, and the loop gain set so the string falls 60 dB in `t60` seconds. `bright`
 * (0..1) shapes both the burst and the loop filter. Mono, `dur` seconds, declicked.
 */
export function ksPluck({ f, dur = 2, t60 = 1.6, bright = 0.5, vel = 1, seed = "ks", sr = SR } = {}) {
  const rng = rngFor(seed);
  const n = idx(dur, sr);
  const out = new Float32Array(n);
  const s = 0.5 * (0.35 + 0.65 * (1 - clamp01(bright))); // loop filter: y = (1-s)x + s·x[-1], delay s
  const period = sr / f;
  const total = period - s;
  const D = Math.max(2, Math.floor(total - 0.1));
  const frac = total - D;
  const c = (1 - frac) / (1 + frac);
  const g = Math.pow(10, -3 / (t60 * f));
  const buf = new Float32Array(D);
  // the burst: noise smoothed by brightness, DC removed
  const lp = new OnePole(800 + 9000 * clamp01(bright), sr);
  let mean = 0;
  for (let k = 0; k < D; k++) {
    buf[k] = lp.lp(rng() * 2 - 1);
    mean += buf[k];
  }
  mean /= D;
  for (let k = 0; k < D; k++) buf[k] -= mean;
  let w = 0;
  let prev = 0;
  let apX = 0;
  let apY = 0;
  for (let i = 0; i < n; i++) {
    const x = buf[w];
    const y = (1 - s) * x + s * prev;
    prev = x;
    const ap = c * y + apX - c * apY;
    apX = y;
    apY = ap;
    buf[w] = ap * g;
    if (++w >= D) w = 0;
    out[i] = x * vel * att(i / sr, 0.0008) * clamp01((n - 1 - i) / (0.004 * sr));
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════ filters ══

/** Andrew Simper's trapezoidal state-variable filter: stable under fast modulation. */
export class SVF {
  constructor(fc = 1000, q = 0.707, sr = SR) {
    this.sr = sr;
    this.ic1 = 0;
    this.ic2 = 0;
    this.set(fc, q);
  }
  set(fc, q = this.q) {
    this.q = q;
    const f = Math.min(Math.max(fc, 8), this.sr * 0.46);
    const g = Math.tan((Math.PI * f) / this.sr);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  tick(x) {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.band = v1;
    this.low = v2;
    this.high = x - this.k * v1 - v2;
  }
  lp(x) {
    this.tick(x);
    return this.low;
  }
  bp(x) {
    this.tick(x);
    return this.band;
  }
  hp(x) {
    this.tick(x);
    return this.high;
  }
}

/** One-pole low-pass (6 dB/oct) and its complementary high-pass. */
export class OnePole {
  constructor(fc = 1000, sr = SR) {
    this.sr = sr;
    this.y = 0;
    this.set(fc);
  }
  set(fc) {
    this.a = 1 - Math.exp((-2 * Math.PI * fc) / this.sr);
  }
  lp(x) {
    this.y += this.a * (x - this.y);
    return this.y;
  }
  hp(x) {
    this.y += this.a * (x - this.y);
    return x - this.y;
  }
}

// ═══════════════════════════════════════════════════════════════════ lanes ══

/**
 * An automation lane over [time, value] points (seconds). "exp" interpolates geometrically
 * (for Hz), "lin" linearly (for dB). Before the first point it holds the first value, after
 * the last the last.
 */
export function lane(points, mode = "exp") {
  const P = points.map(([t, v]) => [t, v]);
  return (t) => {
    if (t <= P[0][0]) return P[0][1];
    const last = P[P.length - 1];
    if (t >= last[0]) return last[1];
    let lo = 0;
    let hi = P.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (P[m][0] <= t) lo = m;
      else hi = m;
    }
    const [t0, v0] = P[lo];
    const [t1, v1] = P[hi];
    const x = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
    return mode === "exp" ? v0 * Math.pow(v1 / v0, x) : v0 + (v1 - v0) * x;
  };
}

// ═══════════════════════════════════════════════════════════════════ buffers ══

/**
 * Lay a one-shot (mono Float32Array or {L,R}) into a stem at t0 seconds, panned, faded out
 * over `fade` seconds before `end` (a choke, or the moment everything must be silent).
 */
export function place(st, buf, t0, { gain = 1, pan = 0, end = Infinity, fade = 0.006, sr = SR } = {}) {
  const N = st.L.length;
  const i0 = idx(t0, sr);
  const mono = buf instanceof Float32Array;
  const len = mono ? buf.length : buf.L.length;
  const [gl, gr] = panGains(pan);
  for (let n = 0; n < len; n++) {
    const i = i0 + n;
    if (i >= N) break;
    if (i < 0) continue;
    const t = i / sr;
    let g = gain;
    if (end - t < fade) {
      if (t >= end) break;
      g *= (end - t) / fade;
    }
    if (mono) {
      const v = buf[n] * g;
      st.L[i] += v * gl;
      st.R[i] += v * gr;
    } else {
      st.L[i] += buf.L[n] * g * gl;
      st.R[i] += buf.R[n] * g * gr;
    }
  }
}

/** Add a one-shot into a stem at a sample index (which may be negative: the head is dropped). */
export function mixAt(st, buf, i0, { gain = 1, pan = 0 } = {}) {
  const N = st.L.length;
  const mono = buf instanceof Float32Array;
  const len = mono ? buf.length : buf.L.length;
  const [gl, gr] = panGains(pan);
  const a = Math.max(0, -i0);
  const b = Math.min(len, N - i0);
  for (let n = a; n < b; n++) {
    const i = i0 + n;
    if (mono) {
      const v = buf[n] * gain;
      st.L[i] += v * gl;
      st.R[i] += v * gr;
    } else {
      st.L[i] += buf.L[n] * gain * gl;
      st.R[i] += buf.R[n] * gain * gr;
    }
  }
}

/** Stereo filter pass over a whole stem, cutoff from a lane of time, updated every 16 samples. */
export function filterStem(st, kind, cutLane, q = 0.707, sr = SR) {
  const N = st.L.length;
  const fl = new SVF(cutLane(0), q, sr);
  const fr = new SVF(cutLane(0), q, sr);
  for (let i = 0; i < N; i++) {
    if ((i & 15) === 0) {
      const c = cutLane(i / sr);
      fl.set(c, q);
      fr.set(c, q);
    }
    st.L[i] = fl[kind](st.L[i]);
    st.R[i] = fr[kind](st.R[i]);
  }
}
/** Gain over a whole stem from a lane of dB over time. */
export function gainStem(st, dbLane, sr = SR) {
  const N = st.L.length;
  for (let i = 0; i < N; i++) {
    const g = undb(dbLane(i / sr));
    st.L[i] *= g;
    st.R[i] *= g;
  }
}
export function scaleStem(st, g) {
  const N = st.L.length;
  for (let i = 0; i < N; i++) {
    st.L[i] *= g;
    st.R[i] *= g;
  }
}
/** Reverse a buffer (mono or stereo), returning a new one. */
export function reverse(buf) {
  if (buf instanceof Float32Array) return buf.slice().reverse();
  return { L: buf.L.slice().reverse(), R: buf.R.slice().reverse() };
}
/** Fade a stereo buffer's edges: `a` seconds in, `b` seconds out (raised cosine). */
export function fadeEdges(buf, a = 0.002, b = 0.006, sr = SR) {
  const chans = buf instanceof Float32Array ? [buf] : [buf.L, buf.R];
  for (const ch of chans) {
    const n = ch.length;
    const na = Math.min(n, Math.round(a * sr));
    const nb = Math.min(n, Math.round(b * sr));
    for (let i = 0; i < na; i++) ch[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / na);
    for (let i = 0; i < nb; i++) ch[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / nb);
  }
  return buf;
}

// ═══════════════════════════════════════════════════════════════════ drums ══
// All the trailer's, returned as one-shots to `place`.

/** Kick: a sine swept f0 → f1 (tau seconds), held then decayed, a noise click and a 2.4 kHz blip, saturated. */
export function makeKick({ f0 = 230, f1 = 55, tau = 0.022, hold = 0.025, decay = 0.105, len = 0.45, click = 0.35, seed = "kick", sr = SR } = {}) {
  const rng = rngFor(seed);
  const n = idx(len, sr);
  const out = new Float32Array(n);
  const hp = new SVF(3200, 0.7, sr);
  let ph = 0;
  const sat = Math.tanh(1.7);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (f1 + (f0 - f1) * Math.exp(-t / tau)) / sr;
    const body = Math.sin(2 * Math.PI * ph) * att(t, 0.0006) * (t < hold ? 1 : Math.exp(-(t - hold) / decay));
    const nz = hp.hp(rng() * 2 - 1) * Math.exp(-t / 0.0016) * click;
    const blip = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t / 0.0025) * click * 0.6;
    const tail = clamp01((len - t) / 0.03);
    out[i] = (Math.tanh(1.7 * (body + nz + blip)) / sat) * tail;
  }
  return out;
}

/** Snare: two tones (one swept) and band-passed noise, saturated. `tune` in semitones. */
export function makeSnare({ tune = 0, len = 0.42, seed = "snare", sr = SR } = {}) {
  const rng = rngFor(`${seed}:${tune.toFixed(2)}`);
  const k = Math.pow(2, tune / 12);
  const n = idx(len, sr);
  const out = new Float32Array(n);
  const hp = new SVF(1500 * k, 0.6, sr);
  const lp = new SVF(9500, 0.7, sr);
  let p1 = 0;
  let p2 = 0;
  const sat = Math.tanh(2.2);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    p1 += (185 * k + 95 * k * Math.exp(-t / 0.012)) / sr;
    p2 += (330 * k) / sr;
    const tone = Math.sin(2 * Math.PI * p1) * Math.exp(-t / 0.075) + 0.45 * Math.sin(2 * Math.PI * p2) * Math.exp(-t / 0.05);
    const nz = lp.lp(hp.hp(rng() * 2 - 1)) * (0.9 * Math.exp(-t / 0.16) + 0.4 * Math.exp(-t / 0.012));
    const v = (0.6 * tone + 0.95 * nz) * att(t, 0.0012) * clamp01((len - t) / 0.04);
    out[i] = Math.tanh(2.2 * v) / sat;
  }
  return out;
}

/** Clap: four noise bursts ~10 ms apart through a band-pass, decorrelated left and right. Stereo. */
export function makeClap(seed = "clap", sr = SR) {
  const len = 0.32;
  const n = idx(len, sr);
  const out = { L: new Float32Array(n), R: new Float32Array(n) };
  for (const [ch, s] of [["L", 1], ["R", 2]]) {
    const rng = rngFor(`${seed}${s}`);
    const bp = new SVF(1150, 1.4, sr);
    const hp = new SVF(600, 0.7, sr);
    const bursts = [0, 0.0095, 0.019, 0.029];
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let env = 0;
      for (let b = 0; b < bursts.length; b++) {
        const d = t - bursts[b];
        if (d >= 0) env = Math.max(env, b === bursts.length - 1 ? Math.exp(-d / 0.085) : Math.exp(-d / 0.0055));
      }
      out[ch][i] = hp.hp(bp.bp(rng() * 2 - 1)) * env * att(t, 0.0004) * clamp01((len - t) / 0.03) * 2.2;
    }
  }
  return out;
}

/** The six square-wave partials of the 808's metal, raised 1.62x (hats and the crash's shimmer). */
export const HAT_F = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 1.62);
/** Hi-hat: six band-limited squares and noise, band- and high-passed. Long decay = open. */
export function makeHat({ decay = 0.03, len = 0.12, seed = "hat", sr = SR } = {}) {
  const rng = rngFor(seed);
  const n = idx(len, sr);
  const out = new Float32Array(n);
  const bp = new SVF(10500, 1.0, sr);
  const hp = new SVF(7200, 0.7, sr);
  const hp2 = new SVF(8500, 0.7, sr);
  const ph = HAT_F.map(() => rng());
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let m = 0;
    for (let k = 0; k < HAT_F.length; k++) {
      const dt = HAT_F[k] / sr;
      let p = ph[k] + dt;
      if (p >= 1) p -= 1;
      ph[k] = p;
      m += (p < 0.5 ? 1 : -1) + blep(p, dt) - blep((p + 0.5) % 1, dt);
    }
    const metal = hp.hp(bp.bp(m / 6));
    const nz = hp2.hp(rng() * 2 - 1) * 0.55;
    out[i] = (metal * 1.6 + nz) * att(t, 0.0003) * Math.exp(-t / decay) * clamp01((len - t) / 0.01);
  }
  return out;
}

/** Crash: noise plus the metal partials raised ~3x, a closing low-pass, 3.4 s. Stereo. */
export function makeCrash(seed = "crash", sr = SR) {
  const len = 3.4;
  const n = idx(len, sr);
  const out = { L: new Float32Array(n), R: new Float32Array(n) };
  for (const [ch, s] of [["L", 1], ["R", 2]]) {
    const rng = rngFor(`${seed}${s}`);
    const hpA = new SVF(3800, 0.7, sr);
    const hpB = new SVF(3800, 0.7, sr);
    const lp = new SVF(16000, 0.6, sr);
    const fr = HAT_F.map((f, k) => f * (2.9 + 0.07 * k + 0.03 * s));
    const ph = fr.map(() => rng());
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if ((i & 15) === 0) lp.set(5500 + 10500 * Math.exp(-t / 0.7));
      let m = 0;
      for (let k = 0; k < fr.length; k++) {
        const dt = fr[k] / sr;
        let p = ph[k] + dt;
        if (p >= 1) p -= 1;
        ph[k] = p;
        m += (p < 0.5 ? 1 : -1) + blep(p, dt) - blep((p + 0.5) % 1, dt);
      }
      const v = hpB.hp(hpA.hp(rng() * 2 - 1 + m * 0.09));
      const env = att(t, 0.0012) * (0.72 * Math.exp(-t / 0.85) + 0.28 * Math.exp(-t / 0.1));
      out[ch][i] = lp.lp(v) * env * clamp01((len - t) / 0.25) * 1.3;
    }
  }
  return out;
}

/** Tom: a sine falling to 58% of f, with a band-passed noise skin. */
export function makeTom(f, seed, sr = SR) {
  const rng = rngFor(seed);
  const len = 0.6;
  const n = idx(len, sr);
  const out = new Float32Array(n);
  const bp = new SVF(f * 4, 1.2, sr);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (f * (0.58 + 0.42 * Math.exp(-t / 0.09))) / sr;
    const tone = Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.2);
    const nz = bp.bp(rng() * 2 - 1) * Math.exp(-t / 0.03) * 0.5;
    out[i] = Math.tanh(1.4 * (tone + nz)) * att(t, 0.0008) * clamp01((len - t) / 0.06);
  }
  return out;
}

/**
 * Sub drop: a sine (with a touch of second harmonic) gliding f0 → f1, decaying, gently
 * saturated — the low half of an impact. Mono, `dur` seconds, ends at zero.
 */
export function subDrop({ f0 = 110, f1 = 36, glide = 0.28, decay = 1.25, dur = 4.6, drive = 1.3, sr = SR } = {}) {
  const n = idx(dur, sr);
  const out = new Float32Array(n);
  const sat = Math.tanh(drive);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const tn = i / sr;
    ph += (f1 + (f0 - f1) * Math.exp(-tn / glide)) / sr;
    const amp = att(tn, 0.002) * Math.exp(-tn / decay) * rel(tn, dur * 0.7, dur * 0.3, 3);
    out[i] = (Math.tanh(drive * (Math.sin(2 * Math.PI * ph) + 0.22 * Math.sin(4 * Math.PI * ph))) / sat) * amp;
  }
  return out;
}

/** A noise burst: white noise through a closing low-pass, a fast and a slow decay. Stereo. */
export function noiseBurst({ dur = 2.4, f0 = 14000, f1 = 1400, close = 0.25, fast = 0.2, slow = 0.85, seed = "burst", sr = SR } = {}) {
  const n = idx(dur, sr);
  const out = stereo(n);
  for (const [ch, s] of [["L", 1], ["R", 2]]) {
    const rng = rngFor(`${seed}${s}`);
    const lp = new SVF(f0, 0.8, sr);
    for (let i = 0; i < n; i++) {
      const tn = i / sr;
      if ((i & 15) === 0) lp.set(f1 + (f0 - f1) * Math.exp(-tn / close), 0.8);
      const amp = att(tn, 0.0015) * (0.75 * Math.exp(-tn / fast) + 0.25 * Math.exp(-tn / slow)) * clamp01((dur - tn) / 0.3);
      out[ch][i] = lp.lp(rng() * 2 - 1) * amp;
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════ the trailer's voices ══
// Each writes into a stem from t0 (seconds), stops by `killAt` (fading over `fade` before
// it), and draws its randomness from `seed`. `wow`, when given, is a per-sample pitch
// multiplier (tape wow and flutter).

/** The supersaw: seven saws spread ±21 cents and across the stereo field. */
export const SUPER = {
  cents: [-21, -13, -6, 0, 6, 13, 21],
  pans: [-0.95, 0.7, -0.45, 0, 0.45, -0.7, 0.95],
  gains: [0.8, 0.9, 1, 1.1, 1, 0.9, 0.8],
};

/** Supersaw note (the trailer's pad and pitch riser): `glide(tn)`, when given, sets the MIDI pitch every 16 samples. */
export function supersaw(st, { t0, gate, midi, vel = 1, a = 0.05, r = 0.6, rpow = 2, spread = 1, detune = 1, seed, glide = null, killAt = Infinity, wow = null, fade = 0.006, sr = SR }) {
  const N = st.L.length;
  const rng = rngFor(seed);
  const i0 = idx(t0, sr);
  const iEnd = Math.min(N, idx(t0 + gate + r, sr), killAt === Infinity ? N : Math.ceil(killAt * sr));
  const V = SUPER.cents.length;
  const ph = new Float64Array(V);
  const ratio = new Float64Array(V);
  const gl = new Float64Array(V);
  const gr = new Float64Array(V);
  for (let v = 0; v < V; v++) {
    ph[v] = rng();
    ratio[v] = Math.pow(2, (SUPER.cents[v] * detune) / 1200);
    const [l, r2] = panGains(SUPER.pans[v] * spread);
    gl[v] = (l * SUPER.gains[v]) / Math.sqrt(V);
    gr[v] = (r2 * SUPER.gains[v]) / Math.sqrt(V);
  }
  let f = mtof(midi);
  for (let i = i0; i < iEnd; i++) {
    const t = i / sr;
    const tn = t - t0;
    if (glide && (i & 15) === 0) f = mtof(glide(tn));
    let env = att(tn, a) * rel(tn, gate, r, rpow) * vel;
    if (killAt - t < fade) env *= Math.max(0, (killAt - t) / fade);
    const base = wow ? (f * wow[i]) / sr : f / sr;
    let L = 0;
    let R = 0;
    for (let v = 0; v < V; v++) {
      const dt = base * ratio[v];
      let p = ph[v] + dt;
      if (p >= 1) p -= 1;
      ph[v] = p;
      const s = 2 * p - 1 - blep(p, dt);
      L += s * gl[v];
      R += s * gr[v];
    }
    st.L[i] += L * env;
    st.R[i] += R * env;
  }
}

/** Pluck (the trailer's arpeggio): 42% pulse + saw through a resonant low-pass with a snap envelope. */
export function pluck(st, { t0, gate = 0.11, midi, vel = 1, cut, env = 2.6, decay = 0.12, q = 1.7, pan = 0, killAt = Infinity, seed, fade = 0.006, sr = SR }) {
  const N = st.L.length;
  const rng = rngFor(seed);
  const r = 0.05;
  const i0 = idx(t0, sr);
  const iEnd = Math.min(N, idx(t0 + gate + r, sr), killAt === Infinity ? N : Math.ceil(killAt * sr));
  const f = mtof(midi);
  const dt = f / sr;
  const lp = new SVF(cut, q, sr);
  const [gl, gr] = panGains(pan);
  let p = rng();
  for (let i = i0; i < iEnd; i++) {
    const t = i / sr;
    const tn = t - t0;
    if (((i - i0) & 7) === 0) lp.set(Math.min(cut * (1 + env * Math.exp(-tn / 0.055)), 16000));
    p += dt;
    if (p >= 1) p -= 1;
    const saw = 2 * p - 1 - blep(p, dt);
    const sq = (p < 0.42 ? 1 : -1) + blep(p, dt) - blep((p + 0.58) % 1, dt);
    let amp = att(tn, 0.0015) * Math.exp(-tn / decay) * rel(tn, gate, r) * vel;
    if (killAt - t < fade) amp *= Math.max(0, (killAt - t) / fade);
    const v = lp.lp(0.55 * sq + 0.45 * saw) * amp;
    st.L[i] += v * gl;
    st.R[i] += v * gr;
  }
}

/** Bass note (the trailer's): two saws ±6 cents and a sine sub, 24 dB low-pass with an envelope, driven. Mono into both sides. */
export function bassNote(st, { t0, gate, midi, vel = 1, cut, envHz, q = 1.05, drive = 1.7, sus = 0.72, killAt = Infinity, seed, fade = 0.006, sr = SR }) {
  const N = st.L.length;
  const rng = rngFor(seed);
  const r = 0.025;
  const i0 = idx(t0, sr);
  const iEnd = Math.min(N, idx(t0 + gate + r, sr), killAt === Infinity ? N : Math.ceil(killAt * sr));
  const f = mtof(midi);
  const d1 = (f * Math.pow(2, -6 / 1200)) / sr;
  const d2 = (f * Math.pow(2, 6 / 1200)) / sr;
  const ds = f / sr;
  const lpA = new SVF(cut, q, sr);
  const lpB = new SVF(cut, 0.7, sr);
  const sat = Math.tanh(drive);
  let p1 = 0.5 + rng() * 0.1;
  let p2 = 0.5 + rng() * 0.1;
  let ps = 0;
  for (let i = i0; i < iEnd; i++) {
    const t = i / sr;
    const tn = t - t0;
    if (((i - i0) & 7) === 0) {
      const c = cut + envHz * vel * Math.exp(-tn / 0.075);
      lpA.set(c);
      lpB.set(c);
    }
    p1 += d1;
    if (p1 >= 1) p1 -= 1;
    p2 += d2;
    if (p2 >= 1) p2 -= 1;
    ps += ds;
    if (ps >= 1) ps -= 1;
    const saws = 0.5 * (2 * p1 - 1 - blep(p1, d1)) + 0.5 * (2 * p2 - 1 - blep(p2, d2));
    const filtered = lpB.lp(lpA.lp(saws));
    const sub = Math.sin(2 * Math.PI * ps) * 0.62;
    let amp = att(tn, 0.0025) * (sus + (1 - sus) * Math.exp(-tn / 0.09)) * rel(tn, gate, r) * vel;
    if (killAt - t < fade) amp *= Math.max(0, (killAt - t) / fade);
    const v = (Math.tanh(drive * (filtered + sub)) / sat) * amp;
    st.L[i] += v;
    st.R[i] += v;
  }
}

/**
 * The lead (the trailer's): monophonic, three saws (-7, 0, +7 cents, spread L–C–R) and a
 * square an octave down; glides between notes, re-articulates each one with a soft
 * amplitude dip and a filter snap, and lets vibrato in only once a note has been held.
 * `notes` are [{ t0, dur, midi }]; notes that touch form one phrase. `killFor(t)` gives the
 * time a phrase starting at t must be gone by.
 */
export function leadLine(st, notes, { transpose = 0, gain = 1, cut = 3400, envHz = 2600, glide = 0.036, vib = 0.0105, spread = 0.55, r = 0.24, seed, killFor = () => Infinity, fade = 0.006, sr = SR }) {
  const N = st.L.length;
  const rng = rngFor(seed);
  const phrases = [];
  for (const n of notes) {
    const prev = phrases.at(-1)?.at(-1);
    if (prev && Math.abs(n.t0 - (prev.t0 + prev.dur)) < 0.001) phrases.at(-1).push(n);
    else phrases.push([n]);
  }
  const cents = [-7, 0, 7];
  const pans = [-spread, 0, spread];
  const ogain = [0.8, 1, 0.8];
  const gc = 1 - Math.exp(-1 / (glide * sr));
  for (const ph of phrases) {
    const tStart = ph[0].t0;
    const tEnd = ph.at(-1).t0 + ph.at(-1).dur;
    const killAt = killFor(tStart);
    const i0 = idx(tStart, sr);
    const iEnd = Math.min(N, idx(tEnd + r, sr), killAt === Infinity ? N : Math.ceil(killAt * sr));
    const p = cents.map(() => rng());
    let ps = rng();
    const lpL = new SVF(cut, 0.85, sr);
    const lpR = new SVF(cut, 0.85, sr);
    const pg = pans.map((x, k) => panGains(x).map((g) => (g * ogain[k]) / 2.4));
    let k = 0;
    let semi = ph[0].midi + transpose;
    for (let i = i0; i < iEnd; i++) {
      const t = i / sr;
      while (k + 1 < ph.length && t >= ph[k + 1].t0) k++;
      const note = ph[k];
      const tn = t - note.t0;
      semi += (note.midi + transpose - semi) * gc;
      const vibD = vib * clamp01((tn - 0.2) / 0.35);
      const f = 440 * Math.pow(2, (semi - 69) / 12) * (1 + vibD * Math.sin(2 * Math.PI * 5.6 * t));
      if (((i - i0) & 3) === 0) {
        const c = cut + envHz * Math.exp(-tn / 0.22) + f * 0.6;
        lpL.set(c);
        lpR.set(c);
      }
      let L = 0;
      let R = 0;
      for (let v = 0; v < 3; v++) {
        const dt = (f * (1 + cents[v] / 1731)) / sr;
        let q = p[v] + dt;
        if (q >= 1) q -= 1;
        p[v] = q;
        const s = 2 * q - 1 - blep(q, dt);
        L += s * pg[v][0];
        R += s * pg[v][1];
      }
      const ds = f / 2 / sr;
      ps += ds;
      if (ps >= 1) ps -= 1;
      const sq = ((ps < 0.5 ? 1 : -1) + blep(ps, ds) - blep((ps + 0.5) % 1, ds)) * 0.14;
      L += sq;
      R += sq;
      const dip = k > 0 ? 1 - 0.32 * (tn < 0.004 ? tn / 0.004 : Math.exp(-(tn - 0.004) / 0.035)) : 1;
      let amp = att(t - tStart, 0.006) * rel(t - tStart, tEnd - tStart, r) * dip * gain;
      if (killAt - t < fade) amp *= Math.max(0, (killAt - t) / fade);
      st.L[i] += Math.tanh(1.25 * lpL.lp(L)) * amp;
      st.R[i] += Math.tanh(1.25 * lpR.lp(R)) * amp;
    }
  }
}

/** A sine tone burst with two harmonics and a 6.3 Hz shimmer (the trailer's transmission carrier). */
export function carrier(st, { t0, dur, f, gain, pan = 0, ramp = 0.004, killAt = Infinity, fade = 0.006, sr = SR }) {
  const N = st.L.length;
  const i0 = idx(t0, sr);
  const iEnd = Math.min(N, idx(t0 + dur + ramp, sr));
  const [gl, gr] = panGains(pan);
  for (let i = i0; i < iEnd; i++) {
    const t = i / sr;
    const tn = t - t0;
    let amp = att(tn, ramp) * (tn <= dur ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (tn - dur)) / ramp)) * gain;
    if (killAt - t < fade) amp *= Math.max(0, (killAt - t) / fade);
    const w = 2 * Math.PI * f * t;
    const v = (Math.sin(w) + 0.22 * Math.sin(2 * w) + 0.08 * Math.sin(3 * w)) * (1 + 0.12 * Math.sin(2 * Math.PI * 6.3 * t)) * amp;
    st.L[i] += v * gl;
    st.R[i] += v * gr;
  }
}

/** Morse code for the letters the films key: elements in units, [start, length]. */
export const MORSE = { A: ".-", E: ".", G: "--.", H: "....", I: "..", N: "-.", R: ".-.", T: "-", V: "...-", AR: ".-.-." };
export function morse(words) {
  const out = [];
  let u = 0;
  words.forEach((w, wi) => {
    if (wi) u += 3; // three units of silence between letters
    [...MORSE[w]].forEach((sym, si) => {
      if (si) u += 1;
      const len = sym === "." ? 1 : 3;
      out.push([u, len]);
      u += len;
    });
  });
  return { elements: out, units: u };
}

// ═══════════════════════════════════════════════════════════════════ more voices ══

/**
 * A bank of detuned oscillators (unison): `voices` copies spread ±`cents` and across the
 * stereo field by `width`, equal-loudness normalised. `next(f)` returns [L, R].
 */
export class Unison {
  constructor({ voices = 7, cents = 21, width = 1, wave = "saw", seed = "unison", sr = SR } = {}) {
    const rng = rngFor(seed);
    this.wave = wave;
    this.osc = [];
    this.ratio = [];
    this.gl = [];
    this.gr = [];
    for (let v = 0; v < voices; v++) {
      const x = voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1;
      this.osc.push(new Osc(rng(), sr));
      this.ratio.push(Math.pow(2, (x * cents) / 1200));
      const [l, r] = panGains(x * width * (v % 2 ? -1 : 1));
      this.gl.push(l / Math.sqrt(voices));
      this.gr.push(r / Math.sqrt(voices));
    }
  }
  next(f) {
    let L = 0;
    let R = 0;
    for (let v = 0; v < this.osc.length; v++) {
      const s = this.osc[v][this.wave](f * this.ratio[v]);
      L += s * this.gl[v];
      R += s * this.gr[v];
    }
    return [L, R];
  }
}

/**
 * A pad chord as a one-shot: each MIDI note a unison stack through a low-pass, the whole
 * under an ADSR. Stereo, `gate + r` seconds long.
 */
export function padChord({ notes, gate, a = 0.4, d = 0.3, s = 0.85, r = 1.2, cut = 1800, q = 0.7, voices = 5, cents = 14, width = 0.9, wave = "saw", vel = 1, seed = "pad", sr = SR }) {
  const len = gate + Math.max(0.003, r);
  const n = idx(len, sr);
  const out = stereo(n);
  notes.forEach((m, k) => {
    const u = new Unison({ voices, cents, width, wave, seed: `${seed}:${k}`, sr });
    const fl = new SVF(cut, q, sr);
    const fr = new SVF(cut, q, sr);
    const f = mtof(m);
    const g = vel / Math.sqrt(notes.length);
    for (let i = 0; i < n; i++) {
      const tn = i / sr;
      const e = adsr(tn, gate, { a, d, s, r }) * g;
      const [l, rr] = u.next(f);
      out.L[i] += fl.lp(l) * e;
      out.R[i] += fr.lp(rr) * e;
    }
  });
  return out;
}

/** A plain sine (with optional partials, [ratio, gain]) under an ADSR — bells, beeps, sub notes. Mono. */
export function tone({ f, gate = 0.2, a = 0.003, d = 0.05, s = 0.8, r = 0.1, partials = [[1, 1]], vel = 1, glideFrom = null, glide = 0.02, sr = SR }) {
  const len = gate + Math.max(0.003, r);
  const n = idx(len, sr);
  const out = new Float32Array(n);
  const ph = partials.map(() => 0);
  for (let i = 0; i < n; i++) {
    const tn = i / sr;
    const ff = glideFrom ? f + (glideFrom - f) * Math.exp(-tn / glide) : f;
    let v = 0;
    partials.forEach(([ratio, g], k) => {
      ph[k] += (ff * ratio) / sr;
      ph[k] -= Math.floor(ph[k]);
      v += Math.sin(2 * Math.PI * ph[k]) * g;
    });
    out[i] = v * adsr(tn, gate, { a, d, s, r }) * vel;
  }
  return out;
}

/** A chiptune blip: a band-limited pulse through the bitcrusher, a pitch step for the "bl-ip". Mono. */
export function blip({ f, len = 0.09, width = 0.25, bits = 6, rate = 16000, slide = 1.5, vel = 1, sr = SR }) {
  const n = idx(len, sr);
  const out = new Float32Array(n);
  const o = new Osc(0, sr);
  const cr = new Crusher({ bits, rate, sr });
  const lp = new SVF(9000, 0.7, sr);
  for (let i = 0; i < n; i++) {
    const tn = i / sr;
    const ff = tn < len * 0.3 ? f : f * slide;
    const v = cr.tick(o.pulse(ff, width)) * decayTo(tn, len * 0.6, len) * att(tn, 0.0015);
    out[i] = lp.lp(v) * vel * 0.5;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════ fx voices ══
// One-shots: each returns a buffer starting at its own zero, to be placed. Every one
// starts and ends at zero.

/** Riser: band-passed noise sweeping f0 → f1 and swelling to its end (x^curve), plus an optional rising sine. Stereo. */
export function riser({ dur = 2, f0 = 300, f1 = 9000, q = 1.3, curve = 2.2, tone = null, seed = "riser", sr = SR } = {}) {
  const n = idx(dur, sr);
  const out = stereo(n);
  for (const [ch, s] of [["L", 1], ["R", 2]]) {
    const rng = rngFor(`${seed}${s}`);
    const bp = new SVF(f0, q, sr);
    const hp = new SVF(200, 0.7, sr);
    for (let i = 0; i < n; i++) {
      const x = i / n;
      if ((i & 15) === 0) bp.set(f0 * Math.pow(f1 / f0, x), q);
      const amp = Math.pow(x, curve) * clamp01((n - 1 - i) / (0.006 * sr));
      out[ch][i] = hp.hp(bp.bp(rng() * 2 - 1)) * amp;
    }
  }
  if (tone) {
    // a sine gliding tone.m0 → tone.m1 (MIDI), the same swell
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const x = i / n;
      ph += mtof(tone.m0 + (tone.m1 - tone.m0) * Math.pow(x, 1.5)) / sr;
      const v = Math.sin(2 * Math.PI * ph) * Math.pow(x, curve) * clamp01((n - 1 - i) / (0.006 * sr)) * (tone.gain ?? 0.3);
      out.L[i] += v;
      out.R[i] += v;
    }
  }
  return out;
}

/** Downlifter: the riser backwards in spirit — noise falling f0 → f1 and decaying, with a sine falling an octave. Stereo. */
export function downlifter({ dur = 2, f0 = 9000, f1 = 250, q = 1.1, m0 = 72, m1 = 48, toneGain = 0.25, seed = "down", sr = SR } = {}) {
  const n = idx(dur, sr);
  const out = stereo(n);
  for (const [ch, s] of [["L", 1], ["R", 2]]) {
    const rng = rngFor(`${seed}${s}`);
    const bp = new SVF(f0, q, sr);
    for (let i = 0; i < n; i++) {
      const x = i / n;
      if ((i & 15) === 0) bp.set(f0 * Math.pow(f1 / f0, Math.sqrt(x)), q);
      const amp = att(i / sr, 0.004) * Math.pow(1 - x, 2);
      out[ch][i] = bp.bp(rng() * 2 - 1) * amp;
    }
  }
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    ph += mtof(m0 + (m1 - m0) * Math.sqrt(x)) / sr;
    const v = Math.sin(2 * Math.PI * ph) * att(i / sr, 0.004) * Math.pow(1 - x, 2.5) * toneGain;
    out.L[i] += v;
    out.R[i] += v;
  }
  return out;
}

/** Whoosh: noise through a band-pass that sweeps up to fPeak and back, a bell of loudness, panned from → to. Stereo. */
export function whoosh({ dur = 1.2, f0 = 400, fPeak = 4000, f1 = 600, q = 0.9, panFrom = -0.8, panTo = 0.8, seed = "whoosh", sr = SR } = {}) {
  const n = idx(dur, sr);
  const out = stereo(n);
  const rng = rngFor(seed);
  const bp = new SVF(f0, q, sr);
  const bp2 = new SVF(f0, q, sr);
  for (let i = 0; i < n; i++) {
    const x = i / n;
    if ((i & 15) === 0) {
      const f = x < 0.5 ? f0 * Math.pow(fPeak / f0, x * 2) : fPeak * Math.pow(f1 / fPeak, (x - 0.5) * 2);
      bp.set(f, q);
      bp2.set(f * 1.5, q);
    }
    const bell = Math.pow(Math.sin(Math.PI * x), 2);
    const w = rng() * 2 - 1;
    const v = (bp.bp(w) + 0.5 * bp2.bp(w)) * bell;
    const [gl, gr] = panGains(panFrom + (panTo - panFrom) * x);
    out.L[i] = v * gl;
    out.R[i] = v * gr;
  }
  return out;
}

/**
 * Reverse swell: a struck chord (and a little noise) through a long hall, played
 * backwards, so it breathes in towards its end — the suck into a downbeat. Ends with a
 * 3 ms fade at full level: place it so its end lands ON the hit. Stereo.
 */
export function reverseSwell({ dur = 1.5, notes = [57, 64, 69], noise = 0.3, room = 0.88, seed = "swell", sr = SR } = {}) {
  const n = idx(dur, sr);
  const dry = new Float32Array(n);
  const hit = idx(0.25, sr);
  const rng = rngFor(seed);
  notes.forEach((m, k) => {
    const o = new Osc(rng(), sr);
    for (let i = 0; i < hit; i++) dry[i] += o.saw(mtof(m)) * decayTo(i / sr, 0.08, 0.25) * (0.4 / notes.length) * (1 + 0.1 * k);
  });
  for (let i = 0; i < hit; i++) dry[i] += (rng() * 2 - 1) * noise * decayTo(i / sr, 0.03, 0.25);
  const wet = new Freeverb({ room, damp: 0.3, size: 1.2, predelay: 0, hp: 200, lp: 9000, sr }).run(dry, 0, n);
  const out = stereo(n);
  for (let i = 0; i < n; i++) {
    out.L[i] = wet.L[n - 1 - i] * 30;
    out.R[i] = wet.R[n - 1 - i] * 30;
  }
  return fadeEdges(out, 0.01, 0.003, sr);
}

/**
 * Impact: a boom (a deep kick), a sub drop, a noise burst and a crash — the moment
 * something lands or detonates. `size` scales the low end's length. Stereo.
 */
export function impact({ size = 1, seed = "impact", sr = SR } = {}) {
  const dur = 2.6 * size + 0.8;
  const n = idx(dur, sr);
  const out = stereo(n);
  const boom = makeKick({ f0: 170, f1: 41, tau: 0.05, hold: 0.05, decay: 0.5 * size, len: 1.8 * size, click: 0.55, seed: `${seed}:boom`, sr });
  const sub = subDrop({ dur: Math.min(dur, 2.6 * size), decay: 0.9 * size, sr });
  const burst = noiseBurst({ dur: 1.6, seed: `${seed}:burst`, sr });
  const crash = makeCrash(`${seed}:crash`, sr);
  mixAt(out, boom, 0, { gain: 0.8 });
  mixAt(out, sub, 0, { gain: 0.7 });
  mixAt(out, burst, 0, { gain: 0.45 });
  mixAt(out, crash, 0, { gain: 0.35 });
  return fadeEdges(out, 0.0005, 0.2, sr);
}

/**
 * Glitch stutter: the first `slice` seconds of a buffer repeated `repeats` times, each
 * repeat shorter by `shrink` and optionally crushed — the tape catching. Every slice is
 * declicked (1.5 ms edges). Returns a new buffer (mono in, mono out; stereo in, stereo out).
 */
export function stutter(buf, { slice = 0.06, repeats = 6, shrink = 0.82, decay = 0.9, crush = 0, sr = SR } = {}) {
  const mono = buf instanceof Float32Array;
  const src = mono ? [buf] : [buf.L, buf.R];
  const lens = [];
  let s = slice;
  for (let k = 0; k < repeats; k++) {
    lens.push(Math.max(0.004, s));
    s *= shrink;
  }
  const total = idx(lens.reduce((a, b) => a + b, 0), sr) + 4;
  const outs = src.map(() => new Float32Array(total));
  const edge = Math.round(0.0015 * sr);
  src.forEach((ch, c) => {
    let o = 0;
    lens.forEach((L, k) => {
      const m = idx(L, sr);
      const g = Math.pow(decay, k);
      const cr = crush ? new Crusher({ bits: Math.max(3, 10 - k * crush), rate: 16000 / (1 + k * 0.4 * crush), sr }) : null;
      for (let i = 0; i < m && o + i < total; i++) {
        const e = Math.min(1, i / edge, (m - 1 - i) / edge);
        let v = (ch[i] ?? 0) * g * Math.max(0, e);
        if (cr) v = cr.tick(v);
        outs[c][o + i] += v;
      }
      o += m;
    });
  });
  return mono ? outs[0] : { L: outs[0], R: outs[1] };
}

/** A generated glitch: a crushed noise-and-sine grain, stuttered. Stereo. */
export function glitch({ dur = 0.35, f = 1800, seed = "glitch", sr = SR } = {}) {
  const rng = rngFor(seed);
  const g = new Float32Array(idx(0.05, sr));
  const o = new Osc(0, sr);
  for (let i = 0; i < g.length; i++) g[i] = (0.6 * o.square(f * (1 + 0.5 * rng())) + 0.4 * (rng() * 2 - 1)) * 0.5;
  const repeats = Math.max(2, Math.round(dur / 0.045));
  const st = stutter(g, { slice: 0.05, repeats, shrink: 0.9, decay: 0.92, crush: 1, sr });
  const out = stereo(st.length);
  for (let i = 0; i < st.length; i++) {
    const p = Math.sin(i * 0.0007) * 0.6;
    const [gl, gr] = panGains(p);
    out.L[i] = st[i] * gl;
    out.R[i] = st[i] * gr;
  }
  return out;
}

/**
 * Sonar ping: a sine with a fast attack, a slight downward chirp and a long exponential
 * decay, a quieter inharmonic partial at 2.76x (the hull's ring) that dies sooner, and a
 * 3 ms band-passed click at the strike. Mono; put it through a hall and a delay. `soft`
 * (0..1) trades the click and the partial for a rounder, quieter ping.
 */
export function sonarPing({ f = 1200, dur = 2.4, tau = 0.45, chirp = 0.025, soft = 0, seed = "ping", sr = SR } = {}) {
  const n = idx(dur, sr);
  const out = new Float32Array(n);
  const rng = rngFor(seed);
  const bp = new SVF(f * 2, 1.5, sr);
  let p1 = 0;
  let p2 = 0;
  const hard = 1 - clamp01(soft);
  for (let i = 0; i < n; i++) {
    const tn = i / sr;
    const ff = f * (1 + chirp * Math.exp(-tn / 0.06));
    p1 += ff / sr;
    p2 += (ff * 2.76) / sr;
    p1 -= Math.floor(p1);
    p2 -= Math.floor(p2);
    const body = Math.sin(2 * Math.PI * p1) * decayTo(tn, tau, dur);
    const ring = Math.sin(2 * Math.PI * p2) * decayTo(tn, tau * 0.25, dur) * 0.22 * hard;
    const click = bp.bp(rng() * 2 - 1) * Math.exp(-tn / 0.0012) * 0.5 * hard;
    out[i] = (body + ring + click) * att(tn, 0.002 + 0.006 * (1 - hard));
  }
  return out;
}

/** Typing click: a short bright noise tick, a small body resonance and a bottoming-out thud. Mono, 45 ms. */
export function typingClick({ tone = 1, seed = "key", sr = SR } = {}) {
  const len = 0.045;
  const n = idx(len, sr);
  const out = new Float32Array(n);
  const rng = rngFor(seed);
  const bp = new SVF(3600 * tone, 1.2, sr);
  const body = new SVF(320 * tone, 4, sr);
  for (let i = 0; i < n; i++) {
    const tn = i / sr;
    const w = rng() * 2 - 1;
    const tick = bp.bp(w) * Math.exp(-tn / 0.0018);
    const thud = body.bp(w) * Math.exp(-tn / 0.008) * 0.9;
    out[i] = (tick + thud) * att(tn, 0.0004) * clamp01((n - 1 - i) / (0.004 * sr));
  }
  return out;
}

/**
 * CRT whine and hum, a continuous bed: mains hum with its odd-harmonic buzz, and the
 * flyback whine (15.734 kHz is NTSC's line rate) wobbling a little. Give `period` (the
 * loop's length) and every frequency and wobble is rounded to a whole number of cycles in
 * it, so the bed loops without a seam. Stereo, `dur` seconds.
 */
export function crtHum({ dur, mains = 60, whine = 15734, hum = 1, whineLevel = 0.12, period = null, seed = "crt", sr = SR }) {
  const q = (f) => (period ? Math.max(1, Math.round(f * period)) / period : f);
  const n = idx(dur, sr);
  const out = stereo(n);
  const rng = rngFor(seed);
  const fm = q(mains);
  const fw = q(whine);
  const wob = q(0.37);
  const ph0 = rng();
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const w = 2 * Math.PI * fm * t;
    const h = (Math.sin(w) + 0.5 * Math.sin(3 * w) + 0.25 * Math.sin(5 * w) + 0.12 * Math.sin(7 * w)) * hum * 0.3;
    const wh = Math.sin(2 * Math.PI * (fw * t + ph0) + 0.6 * Math.sin(2 * Math.PI * wob * t)) * whineLevel;
    out.L[i] = h + wh;
    out.R[i] = h * 0.96 + wh;
  }
  return out;
}

/**
 * Modem chirps: a stylised dial-up handshake, all generated — dial digits (two sines), an
 * answer tone with phase reversals, an FSK warble at 300 baud, and a scrambled noise band.
 * Not a recording and not a protocol trace; it is shorter and prettier than either. Stereo.
 */
export function modemChirps({ dur = 2.4, seed = "modem", sr = SR } = {}) {
  const n = idx(dur, sr);
  const out = stereo(n);
  const rng = rngFor(seed);
  const DTMF = [[697, 1209], [770, 1336], [852, 1477], [697, 1336], [941, 1336]];
  const x = (a, b) => [idx(a * dur, sr), idx(b * dur, sr)];
  // dial: five digits in the first 22%
  const [d0, d1] = x(0, 0.22);
  const per = (d1 - d0) / DTMF.length;
  for (let k = 0; k < DTMF.length; k++) {
    const a = d0 + Math.round(k * per);
    const m = Math.round(per * 0.6);
    for (let i = 0; i < m; i++) {
      const t = i / sr;
      const v = (Math.sin(2 * Math.PI * DTMF[k][0] * t) + Math.sin(2 * Math.PI * DTMF[k][1] * t)) * 0.25 * att(t, 0.003) * clamp01((m - 1 - i) / (0.003 * sr));
      out.L[a + i] += v;
      out.R[a + i] += v;
    }
  }
  // answer tone 2100 Hz with a phase reversal every 0.15 s (declicked by an amplitude dip)
  const [a0, a1] = x(0.27, 0.5);
  for (let i = a0; i < a1; i++) {
    const t = (i - a0) / sr;
    const seg = Math.floor(t / 0.15);
    const within = t - seg * 0.15;
    const dip = Math.min(1, within / 0.004, (0.15 - within) / 0.004);
    const v = Math.sin(2 * Math.PI * 2100 * t + (seg % 2) * Math.PI) * 0.22 * dip * clamp01((a1 - 1 - i) / (0.004 * sr));
    out.L[i] += v * 0.9;
    out.R[i] += v;
  }
  // FSK warble: 1650 / 1850 Hz at 300 baud, phase-continuous
  const [f0, f1] = x(0.52, 0.74);
  let ph = 0;
  let bit = 0;
  const baud = Math.round(sr / 300);
  for (let i = f0; i < f1; i++) {
    if ((i - f0) % baud === 0) bit = rng() < 0.5 ? 0 : 1;
    ph += (bit ? 1850 : 1650) / sr;
    const v = Math.sin(2 * Math.PI * ph) * 0.2 * att((i - f0) / sr, 0.004) * clamp01((f1 - 1 - i) / (0.004 * sr));
    out.L[i] += v;
    out.R[i] += v * 0.9;
  }
  // scrambled band: noise 600–3000 Hz, gated at the baud rate
  const [s0, s1] = x(0.76, 1);
  const bpL = new SVF(1600, 0.6, sr);
  const bpR = new SVF(1700, 0.6, sr);
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / sr;
    const am = 0.65 + 0.35 * Math.sin(2 * Math.PI * 1200 * t) * Math.sin(2 * Math.PI * 37 * t);
    const env = att(t, 0.004) * clamp01((s1 - 1 - i) / (0.02 * sr));
    out.L[i] += bpL.bp(rng() * 2 - 1) * am * env * 0.5;
    out.R[i] += bpR.bp(rng() * 2 - 1) * am * env * 0.5;
  }
  return out;
}

/**
 * Shepard–Risset tone: `octaves` sine partials an octave apart sliding up (dir = 1) or down
 * (dir = -1) one octave every `period` seconds, under a raised-cosine window over log
 * frequency that is exactly zero where a partial wraps from the top back to the bottom. The
 * phase of every partial is a function of its POSITION alone, so the whole tone is exactly
 * periodic in `period`: a clip whose length is a whole number of periods loops it with no
 * seam. Starts at time t0 (seconds, for continuing a tone across buffers). Stereo: each
 * partial swings across the field once an octave (its pan is a function of its position
 * too, or the image would only repeat every two periods). Unity is about the loudest partial.
 */
export function shepard({ dur, period = 8, dir = 1, base = 40, octaves = 8, t0 = 0, width = 0.35, sr = SR }) {
  const n = idx(dur, sr);
  const out = stereo(n);
  const K = period / Math.LN2;
  for (let i = 0; i < n; i++) {
    const t = t0 + i / sr;
    const shift = (dir * t) / period;
    let L = 0;
    let R = 0;
    for (let k = 0; k < octaves; k++) {
      let x = (k + shift) % octaves;
      if (x < 0) x += octaves;
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * x) / octaves);
      if (w <= 0) continue;
      const phase = dir * base * K * Math.pow(2, x);
      const v = Math.sin(2 * Math.PI * (phase - Math.floor(phase))) * w;
      const [gl, gr] = panGains(width * Math.cos(2 * Math.PI * x));
      L += v * gl;
      R += v * gr;
    }
    out.L[i] = L * 0.5;
    out.R[i] = R * 0.5;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════ effects ══

const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const APS = [556, 441, 341, 225];
/** Freeverb (Jezar's Schroeder–Moorer design), stereo by offsetting the right-hand tunings. */
export class Freeverb {
  constructor({ room = 0.82, damp = 0.35, width = 1, size = 1, spread = 23, predelay = 0.02, hp = 220, lp = 8000, sr = SR }) {
    this.o = { room, damp, width, size, spread, predelay, hp, lp };
    this.sr = sr;
  }
  /** Run over input[i0, i1) (mono) → { L, R } of i1 - i0 samples, starting silent. */
  run(input, i0, i1) {
    const { room, damp, width, size, spread, predelay, hp, lp } = this.o;
    const sr = this.sr;
    const s = (sr / 44100) * size;
    const fb = room * 0.28 + 0.7;
    const M = i1 - i0;
    const pd = idx(predelay, sr);
    const inp = new Float32Array(M);
    const fh = new SVF(hp, 0.7, sr);
    const fl = new SVF(lp, 0.7, sr);
    for (let n = 0; n < M; n++) {
      const j = n - pd;
      inp[n] = j >= 0 ? fl.lp(fh.hp(input[i0 + j])) * 0.015 : 0;
    }
    const outs = [];
    for (const off of [0, spread]) {
      const out = new Float32Array(M);
      for (const c of COMBS) {
        const buf = new Float32Array(Math.round((c + off) * s));
        const len = buf.length;
        let idx2 = 0;
        let fs = 0;
        for (let n = 0; n < M; n++) {
          const y = buf[idx2];
          fs = y * (1 - damp) + fs * damp;
          buf[idx2] = inp[n] + fs * fb;
          out[n] += y;
          if (++idx2 >= len) idx2 = 0;
        }
      }
      for (const c of APS) {
        const buf = new Float32Array(Math.round((c + off) * s));
        const len = buf.length;
        let idx2 = 0;
        for (let n = 0; n < M; n++) {
          const y = buf[idx2];
          const x = out[n];
          out[n] = y - x;
          buf[idx2] = x + y * 0.5;
          if (++idx2 >= len) idx2 = 0;
        }
      }
      outs.push(out);
    }
    const w1 = width / 2 + 0.5;
    const w2 = (1 - width) / 2;
    const L = new Float32Array(M);
    const R = new Float32Array(M);
    for (let n = 0; n < M; n++) {
      L[n] = outs[0][n] * w1 + outs[1][n] * w2;
      R[n] = outs[1][n] * w1 + outs[0][n] * w2;
    }
    return { L, R };
  }
}

/** Ping-pong delay: left at T, right at 2T, left at 3T …, the repeats darkening. */
export class PingPong {
  constructor({ time, fb = 0.42, lp = 3800, hp = 280, sr = SR }) {
    this.o = { time, fb, lp, hp };
    this.sr = sr;
  }
  /** Run over input[i0, i1) (mono) → { L, R }, starting silent. */
  run(input, i0, i1) {
    const { time, fb, lp, hp } = this.o;
    const sr = this.sr;
    const D = idx(time, sr);
    const bl = new Float32Array(D);
    const br = new Float32Array(D);
    const M = i1 - i0;
    const L = new Float32Array(M);
    const R = new Float32Array(M);
    const al = 1 - Math.exp((-2 * Math.PI * lp) / sr);
    const ah = 1 - Math.exp((-2 * Math.PI * hp) / sr);
    let yl = 0;
    let yh = 0;
    let k = 0;
    for (let n = 0; n < M; n++) {
      const dl = bl[k];
      const dr = br[k];
      yl += al * (dr - yl);
      yh += ah * (yl - yh);
      bl[k] = input[i0 + n] + (yl - yh) * fb;
      br[k] = dl;
      L[n] = dl;
      R[n] = dr;
      if (++k >= D) k = 0;
    }
    return { L, R };
  }
}

/**
 * The Juno chorus: the stem's mono sum through two short delay lines swept in antiphase,
 * one added to each side. Wide without moving the centre.
 */
export function chorus(st, { base = 0.0062, depth = 0.0024, rate = 0.48, mix = 0.6, sr = SR }) {
  const N = st.L.length;
  const D = Math.ceil((base + depth) * sr) + 4;
  const buf = new Float32Array(D);
  let w = 0;
  for (let i = 0; i < N; i++) {
    const x = (st.L[i] + st.R[i]) * 0.5;
    buf[w] = x;
    const ph = 2 * Math.PI * rate * (i / sr);
    for (let side = 0; side < 2; side++) {
      const d = (base + depth * Math.sin(ph + side * Math.PI)) * sr;
      let r = w - d;
      if (r < 0) r += D;
      const r0 = Math.floor(r);
      const fr = r - r0;
      const y = buf[r0 % D] * (1 - fr) + buf[(r0 + 1) % D] * fr;
      if (side === 0) st.L[i] += y * mix;
      else st.R[i] += y * mix;
    }
    if (++w >= D) w = 0;
  }
}

/**
 * Side-chain duck, trigger-based: the stem's gain dips by `depth` (0..1) at every trigger
 * time (sorted seconds), starting `pre` seconds early so the transient never fights it, and
 * recovers over `release` along a raised cosine.
 */
export function duck(st, triggers, depth, release, pre = 0.003, sr = SR) {
  const N = st.L.length;
  let k = 0;
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    while (k < triggers.length && triggers[k] + release < t) k++;
    let f = 0;
    for (let j = k; j < triggers.length && triggers[j] - pre <= t; j++) {
      const d = t - triggers[j];
      const v = d < 0 ? 1 + d / pre : d < release ? 0.5 + 0.5 * Math.cos((Math.PI * d) / release) : 0;
      if (v > f) f = v;
    }
    if (f > 0) {
      const g = 1 - depth * f;
      st.L[i] *= g;
      st.R[i] *= g;
    }
  }
}

/** The side-chain envelope on its own: per-sample gain (1 = untouched) for `n` samples, as `duck` would apply. */
export function sidechainEnvelope(n, triggers, depth, release, pre = 0.003, sr = SR) {
  const g = { L: new Float32Array(n).fill(1), R: new Float32Array(n).fill(1) };
  duck(g, triggers, depth, release, pre, sr);
  return g.L;
}

// ═══════════════════════════════════════════════════════════════════ dynamics ══

/**
 * Bus compressor: stereo-linked peak detector, soft knee, attack/release smoothing of the
 * gain reduction in dB, makeup gain. In place; returns the largest reduction (dB). `grOut`,
 * when given, receives the reduction per sample.
 */
export function compress(st, { thr = -13, ratio = 2, knee = 6, att: attack = 0.012, rel: release = 0.18, makeup = 0, grOut = null, sr = SR } = {}) {
  const N = st.L.length;
  const aA = Math.exp(-1 / (attack * sr));
  const aR = Math.exp(-1 / (release * sr));
  let gr = 0;
  let max = 0;
  for (let i = 0; i < N; i++) {
    const x = Math.max(Math.abs(st.L[i]), Math.abs(st.R[i]));
    const over = db(x + 1e-12) - thr;
    let red = 0;
    if (2 * over > knee) red = (1 - 1 / ratio) * over;
    else if (2 * Math.abs(over) <= knee) red = ((1 - 1 / ratio) * (over + knee / 2) ** 2) / (2 * knee);
    gr = red > gr ? aA * gr + (1 - aA) * red : aR * gr + (1 - aR) * red;
    if (gr > max) max = gr;
    if (grOut) grOut[i] = gr;
    const g = undb(makeup - gr);
    st.L[i] *= g;
    st.R[i] *= g;
  }
  return max;
}

/**
 * Brickwall limiter: running minimum of the needed gain over the look-ahead, box-smoothed,
 * released, and the look-ahead delay undone so the output stays sample-true to the input's
 * timing. In place; returns the largest reduction in dB (negative, or 0). Sample peaks end
 * at or under `ceiling` (linear); pair it with `truePeak` for inter-sample peaks.
 */
export function limit(st, ceiling, look = 0.001, release = 0.08, grOut = null, sr = SR) {
  const N = st.L.length;
  const D = Math.max(2, idx(look, sr));
  const need = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = Math.max(Math.abs(st.L[i]), Math.abs(st.R[i]));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  // running min over [i-D, i] (monotonic deque)
  const h = new Float32Array(N);
  const dq = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < N; i++) {
    while (qt > qh && need[dq[qt - 1]] >= need[i]) qt--;
    dq[qt++] = i;
    while (dq[qh] < i - D) qh++;
    h[i] = need[dq[qh]];
  }
  // box average over the last D samples, then release smoothing (down instantly, up slowly)
  const aR = 1 - Math.exp(-1 / (release * sr));
  let acc = D; // the D samples before the start count as "no reduction"
  let g = 1;
  let maxRed = 1;
  const outL = new Float32Array(N);
  const outR = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    acc += h[i] - (i >= D ? h[i - D] : 1);
    const s = acc / D;
    g = s < g ? s : g + (Math.min(1, s) - g) * aR;
    if (g > s) g = s;
    if (g < maxRed) maxRed = g;
    if (grOut && i >= D) grOut[i - D] = -db(g);
    const j = i - D;
    outL[i] = j >= 0 ? st.L[j] * g : 0;
    outR[i] = j >= 0 ? st.R[j] * g : 0;
  }
  // undo the look-ahead delay so the timing stays sample-true
  for (let i = 0; i < N; i++) {
    st.L[i] = i + D < N ? outL[i + D] : 0;
    st.R[i] = i + D < N ? outR[i + D] : 0;
  }
  return db(maxRed);
}

/**
 * True peak by 4x oversampling (BS.1770-style interpolation, a Blackman-windowed sinc, 32
 * taps a phase). Returns { samplePeak, truePeak } in dBFS / dBTP.
 */
export function truePeak(L, R) {
  const P = 4;
  const TAPS = 32;
  const M = P * TAPS;
  const H = new Float64Array(M);
  const c = (M - 1) / 2;
  for (let k = 0; k < M; k++) {
    const x = (k - c) / P;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * k) / (M - 1)) + 0.08 * Math.cos((4 * Math.PI * k) / (M - 1));
    H[k] = sinc * w;
  }
  for (let p = 0; p < P; p++) {
    let s = 0;
    for (let j = 0; j < TAPS; j++) s += H[p + P * j];
    for (let j = 0; j < TAPS; j++) H[p + P * j] /= s;
  }
  let sp = 0;
  for (const ch of [L, R]) for (let i = 0; i < ch.length; i++) sp = Math.max(sp, Math.abs(ch[i]));
  const thr = sp * 0.5;
  let tp = sp;
  for (const ch of [L, R]) {
    for (let n = TAPS; n < ch.length; n++) {
      const a = Math.abs(ch[n - TAPS / 2]);
      const b = Math.abs(ch[n - TAPS / 2 - 1]);
      if (a < thr && b < thr) continue;
      for (let p = 0; p < P; p++) {
        let s = 0;
        for (let j = 0; j < TAPS; j++) s += ch[n - j] * H[p + P * j];
        const v = Math.abs(s);
        if (v > tp) tp = v;
      }
    }
  }
  return { samplePeak: db(sp), truePeak: db(tp) };
}

// ═══════════════════════════════════════════════════════════════════ meters ══

/**
 * K-weighting (BS.1770-4: the high-shelf "head" pre-filter, then the RLB high-pass) → the
 * filtered signal, Float64. At 48 kHz the standard's published coefficients; at any other
 * rate they are derived from the analogue prototype by the bilinear transform (the
 * derivation reproduces the 48 kHz table to 1e-8).
 */
export function kWeighted(x, sr = SR) {
  const stages = sr === 48000
    ? [
        { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] },
        { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] },
      ]
    : kCoefficients(sr);
  const y = new Float64Array(x.length);
  let src = x;
  for (const { b, a } of stages) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let n = 0; n < x.length; n++) {
      const xn = src[n];
      const yn = b[0] * xn + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
      x2 = x1;
      x1 = xn;
      y2 = y1;
      y1 = yn;
      y[n] = yn;
    }
    src = y;
  }
  return y;
}
/** The two K-weighting biquads at any rate (the derivation libebur128 and pyloudnorm use). */
export function kCoefficients(sr) {
  // stage 1: the "head" high shelf, +4 dB above ~1.7 kHz
  const f0 = 1681.974450955533;
  const G = 3.999843853973347;
  const Q = 0.7071752369554196;
  const K = Math.tan((Math.PI * f0) / sr);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  const a0 = 1 + K / Q + K * K;
  const shelf = {
    b: [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0],
    a: [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
  };
  // stage 2: the RLB high-pass at ~38 Hz
  const f1 = 38.13547087602444;
  const Q1 = 0.5003270373238773;
  const K1 = Math.tan((Math.PI * f1) / sr);
  const d = 1 + K1 / Q1 + K1 * K1;
  const rlb = { b: [1, -2, 1], a: [(2 * (K1 * K1 - 1)) / d, (1 - K1 / Q1 + K1 * K1) / d] };
  return [shelf, rlb];
}

/** BS.1770 block loudness over [a, b) seconds of a K-weighted pair: one LUFS figure per block. */
export function blockLoudness(KL, KR, a, b, { win = 0.4, hop = 0.1, sr = SR } = {}) {
  const N = KL.length;
  const out = [];
  const w = idx(win, sr);
  const hpN = idx(hop, sr);
  for (let i = idx(a, sr); i + w <= Math.min(N, idx(b, sr)); i += hpN) {
    let s = 0;
    for (let n = i; n < i + w; n++) s += KL[n] * KL[n] + KR[n] * KR[n];
    out.push(-0.691 + 10 * Math.log10(s / w + 1e-20));
  }
  return out;
}
/** Integrated loudness (BS.1770-4: 400 ms blocks, 75% overlap, -70 LUFS absolute and -10 LU relative gates). */
export function integratedLoudness(KL, KR, a, b, sr = SR) {
  const bl = blockLoudness(KL, KR, a, b, { sr }).filter((l) => l > -70);
  if (!bl.length) return -Infinity;
  const mean = (arr) => 10 * Math.log10(arr.reduce((s, l) => s + Math.pow(10, l / 10), 0) / arr.length);
  const relGate = mean(bl) - 10;
  const g = bl.filter((l) => l > relGate);
  return mean(g);
}
/**
 * The loudness meter in one call: integrated LUFS, the short-term (3 s) and momentary
 * (400 ms) maxima, and the true peak. A buffer shorter than one block reads -Infinity.
 */
export function loudness(st, { sr = SR } = {}) {
  const KL = kWeighted(st.L, sr);
  const KR = kWeighted(st.R, sr);
  const dur = st.L.length / sr;
  const st3 = blockLoudness(KL, KR, 0, dur, { win: 3, hop: 0.1, sr });
  const mom = blockLoudness(KL, KR, 0, dur, { win: 0.4, hop: 0.05, sr });
  const tp = truePeak(st.L, st.R);
  return {
    integrated: integratedLoudness(KL, KR, 0, dur, sr),
    shortTermMax: st3.length ? Math.max(...st3) : -Infinity,
    momentaryMax: mom.length ? Math.max(...mom) : -Infinity,
    samplePeak: tp.samplePeak,
    truePeak: tp.truePeak,
  };
}

/** RMS and sample peak (dBFS) of a stereo buffer over [a, b) seconds. */
export function stats(st, a, b, sr = SR) {
  const N = st.L.length;
  const i0 = idx(a, sr);
  const i1 = Math.min(N, idx(b, sr));
  let sum = 0;
  let pk = 0;
  for (let i = i0; i < i1; i++) {
    const l = st.L[i];
    const r = st.R[i];
    sum += l * l + r * r;
    const m = Math.max(Math.abs(l), Math.abs(r));
    if (m > pk) pk = m;
  }
  return { rms: db(Math.sqrt(sum / (2 * Math.max(1, i1 - i0)))), peak: db(pk) };
}

/**
 * Mono band RMS (dBFS) over [a, b) seconds through a band-pass made of two 2-pole sections
 * each side (lo or hi may be null for an open edge). `windows`, when given, restricts the
 * measurement to those [start, end) spans.
 */
export function bandRms(st, lo, hi, a, b, windows = null, sr = SR) {
  const N = st.L.length;
  const fh = lo ? new SVF(lo, 0.7, sr) : null;
  const fh2 = lo ? new SVF(lo, 0.7, sr) : null;
  const fl = hi ? new SVF(hi, 0.7, sr) : null;
  const fl2 = hi ? new SVF(hi, 0.7, sr) : null;
  const i0 = Math.max(0, idx(a, sr) - idx(0.2, sr));
  const i1 = Math.min(N, idx(b, sr));
  let s = 0;
  let n = 0;
  let w = 0;
  for (let i = i0; i < i1; i++) {
    let x = (st.L[i] + st.R[i]) * 0.5;
    if (fh) x = fh2.hp(fh.hp(x));
    if (fl) x = fl2.lp(fl.lp(x));
    if (i < idx(a, sr)) continue;
    if (windows) {
      const t = i / sr;
      while (w < windows.length && windows[w][1] <= t) w++;
      if (w >= windows.length || t < windows[w][0]) continue;
    }
    s += x * x;
    n++;
  }
  return db(Math.sqrt(s / Math.max(1, n)));
}

/** The spectral bands a mix is read in: sub, low, low-mid, mid, presence, air. */
export const BANDS = [
  ["sub", 20, 60],
  ["low", 60, 250],
  ["lowmid", 250, 800],
  ["mid", 800, 2500],
  ["presence", 2500, 6000],
  ["air", 6000, 16000],
];
/**
 * Spectral balance: each band's RMS in dB relative to the full-band RMS, over [a, b)
 * seconds (default: all of it), both measured per channel the way `stats` is. A balanced mix
 * has no band above about -3 and nothing it needs below about -30. Each band is a 4th-order
 * band-pass (two 2-pole high-passes, two 2-pole low-passes), so neighbours overlap a little.
 */
export function bandBalance(st, a = 0, b = null, sr = SR) {
  const N = st.L.length;
  const end = b === null ? N / sr : b;
  const full = stats(st, a, end, sr).rms;
  const i0 = idx(a, sr);
  const i1 = Math.min(N, idx(end, sr));
  const out = {};
  for (const [name, lo, hi] of BANDS) {
    let s = 0;
    for (const ch of [st.L, st.R]) {
      const f = [new SVF(lo, 0.7, sr), new SVF(lo, 0.7, sr), new SVF(hi, 0.7, sr), new SVF(hi, 0.7, sr)];
      for (let i = Math.max(0, i0 - idx(0.2, sr)); i < i1; i++) {
        const x = f[3].lp(f[2].lp(f[1].hp(f[0].hp(ch[i]))));
        if (i >= i0) s += x * x;
      }
    }
    const v = db(Math.sqrt(s / (2 * Math.max(1, i1 - i0))));
    out[name] = Number.isFinite(v) && Number.isFinite(full) ? +(v - full).toFixed(1) : "silent";
  }
  return out;
}

/**
 * Click finder: a discontinuity is a lone spike in the second difference
 * (|x[n] - 2x[n-1] + x[n-2]|) far above what the signal's own bright content produces.
 * Returns the largest spike over the 99.9th percentile, in dB, and where it is. A click
 * reads as a big outlier (over ~20 dB); drums and bright noise sit well under it.
 */
export function clickReport(st, sr = SR) {
  const N = st.L.length;
  let maxD = 0;
  let at = 0;
  const sample = [];
  for (let i = 2; i < N; i++) {
    const d = Math.max(Math.abs(st.L[i] - 2 * st.L[i - 1] + st.L[i - 2]), Math.abs(st.R[i] - 2 * st.R[i - 1] + st.R[i - 2]));
    if (d > maxD) {
      maxD = d;
      at = i;
    }
    if (d > 1e-7 && i % 5 === 0) sample.push(d);
  }
  sample.sort((x, y) => x - y);
  const p999 = sample[Math.floor(sample.length * 0.999)] || 1e-12;
  return { spikeOverP999Db: +db(maxD / p999).toFixed(1), at: +(at / sr).toFixed(3) };
}

/**
 * A loop's seam: how big the step from the last sample back to the first is, against the
 * steps the signal takes everywhere else. `ratio` is the seam's jump over the 99th
 * percentile step — a seamless loop reads at or under 1 (the seam is just another step);
 * a cut through a sounding waveform reads many times over. The second-difference figure is
 * the same question in the click finder's terms.
 */
export function seamReport(st) {
  const N = st.L.length;
  let jump = 0;
  let curve = 0;
  for (const ch of [st.L, st.R]) {
    jump = Math.max(jump, Math.abs(ch[0] - ch[N - 1]));
    curve = Math.max(curve, Math.abs(ch[0] - 2 * ch[N - 1] + ch[N - 2]), Math.abs(ch[1] - 2 * ch[0] + ch[N - 1]));
  }
  const steps = [];
  const curves = [];
  for (const ch of [st.L, st.R]) {
    for (let i = 2; i < N; i += 3) {
      steps.push(Math.abs(ch[i] - ch[i - 1]));
      curves.push(Math.abs(ch[i] - 2 * ch[i - 1] + ch[i - 2]));
    }
  }
  steps.sort((a, b) => a - b);
  curves.sort((a, b) => a - b);
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] || 1e-12;
  return {
    jump: +jump.toExponential(3),
    medianStep: +q(steps, 0.5).toExponential(3),
    p99Step: +q(steps, 0.99).toExponential(3),
    ratio: +(jump / q(steps, 0.99)).toFixed(3),
    curveOverP999Db: +db(curve / q(curves, 0.999)).toFixed(1),
  };
}

// ═══════════════════════════════════════════════════════════════════ files ══

/** 16-bit stereo PCM WAV, seeded TPDF dither (±1 LSB). The dither's seed defaults to the file's name. */
export function writeWav(file, L, R, { sr = SR, i0 = 0, i1 = L.length, seed = `dither:${path.basename(file)}` } = {}) {
  const n = i1 - i0;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  const rng = rngFor(seed);
  let o = 44;
  for (let i = i0; i < i1; i++) {
    for (const ch of [L, R]) {
      const d = (rng() - rng()) / 32768; // TPDF, ±1 LSB
      const v = Math.max(-32768, Math.min(32767, Math.round((ch[i] + d) * 32767)));
      buf.writeInt16LE(v, o);
      o += 2;
    }
  }
  writeFileSync(file, buf);
}

/** Read a 16-bit stereo PCM WAV written by `writeWav` (or any 16-bit stereo PCM WAV) → { L, R, sr }. */
export function readWav(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("not a WAV");
  let o = 12;
  let sr = 0;
  let ch = 0;
  let bits = 0;
  while (o + 8 <= buf.length) {
    const id = buf.toString("ascii", o, o + 4);
    const len = buf.readUInt32LE(o + 4);
    if (id === "fmt ") {
      ch = buf.readUInt16LE(o + 10);
      sr = buf.readUInt32LE(o + 12);
      bits = buf.readUInt16LE(o + 22);
    } else if (id === "data") {
      if (bits !== 16 || ch !== 2) throw new Error(`readWav reads 16-bit stereo (this is ${bits}-bit, ${ch} ch)`);
      const n = Math.floor(len / 4);
      const L = new Float32Array(n);
      const R = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        L[i] = buf.readInt16LE(o + 8 + i * 4) / 32767;
        R[i] = buf.readInt16LE(o + 10 + i * 4) / 32767;
      }
      return { L, R, sr };
    }
    o += 8 + len + (len & 1);
  }
  throw new Error("WAV has no data chunk");
}

/**
 * The AAC encode every film's audio uses: 192 kb/s, metadata stripped, bit-exact flags (so
 * the same WAV encodes to the same bytes), and PNS off — perceptual noise substitution
 * re-synthesises noisy bands with fresh noise, which overshoots worst and is the one part of
 * the encoder that is not reproducible.
 */
export const AAC_ARGS = ["-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-aac_pns", "0", "-c:a", "aac", "-b:a", "192k"];
export function encodeAac(wav, m4a, { ffmpeg = process.env.FFMPEG || "ffmpeg" } = {}) {
  execFileSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", wav, ...AAC_ARGS, m4a], { stdio: "inherit" });
}
/** Decode any audio file through ffmpeg → { L, R } float at `sr`. */
export function decodeAudio(file, { sr = SR, ffmpeg = process.env.FFMPEG || "ffmpeg" } = {}) {
  const raw = execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", file, "-f", "f32le", "-ac", "2", "-ar", String(sr), "-"], { maxBuffer: 1 << 30 });
  const f = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  const L = new Float32Array(f.length / 2);
  const R = new Float32Array(f.length / 2);
  for (let i = 0; i < L.length; i++) {
    L[i] = f[2 * i];
    R[i] = f[2 * i + 1];
  }
  return { L, R };
}
/**
 * ffmpeg's own EBU R128 meter over a file — a loudness measurement that shares no code with
 * this one, so the two agreeing is evidence rather than the code agreeing with itself.
 * Returns { integrated, lra, truePeak } (LUFS, LU, dBTP).
 */
export function ffmpegLoudness(file, { ffmpeg = process.env.FFMPEG || "ffmpeg" } = {}) {
  // ebur128 prints its summary to stderr at the info level and exits 0
  const r = spawnSync(ffmpeg, ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg ebur128 failed on ${file}: ${String(r.stderr).slice(-400)}`);
  const text = String(r.stderr);
  const sum = text.slice(text.lastIndexOf("Summary:"));
  const num = (re) => {
    const m = re.exec(sum);
    return m ? +m[1] : null;
  };
  return { integrated: num(/I:\s+(-?[\d.]+) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeak: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}
