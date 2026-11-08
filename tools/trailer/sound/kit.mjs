// kit.mjs — the mix bus every Agarthan score shares: stems, sends to a hall and a
// ping-pong delay, the ice wind and the sub under everything, and the master (loudness
// to a target, then a peak limit). Building blocks are EVRITHNG's dsp.mjs, vendored
// beside this file; nothing here reads a clock or calls Math.random.
import * as D from './dsp.mjs';

export const SR = D.SR;
export { D };

export function newMix(dur, bpm = 116) {
  const N = D.idx(dur);
  return { N, dur, bpm, stems: new Map(), sends: { hall: new Float32Array(N), delay: new Float32Array(N), wide: new Float32Array(N) } };
}
export const stem = (mix, name) => { if (!mix.stems.has(name)) mix.stems.set(name, D.stereo(mix.N)); return mix.stems.get(name); };
export function send(mix, bus, st, amt) {
  const s = mix.sends[bus];
  for (let i = 0; i < mix.N; i++) s[i] += (st.L[i] + st.R[i]) * 0.5 * amt;
}
/** Add a one-shot (mono or stereo) into a stem. */
export const put = (mix, name, buf, t, opts = {}) => { if (t < mix.dur) D.place(stem(mix, name), buf, Math.max(0, t), opts); };

/** Ice wind: pink noise through two slowly wandering band-passes, one per side. */
export function wind(mix, name, { t0 = 0, t1 = mix.dur, gain = 0.25, lo = 260, hi = 1900, seed = 'wind', lane = null } = {}) {
  const st = stem(mix, name);
  const pk = [new D.Pink(D.rngFor(seed + 'L')), new D.Pink(D.rngFor(seed + 'R'))];
  const f = [new D.SVF(800, 1.4), new D.SVF(800, 1.4)];
  const i0 = D.idx(t0), i1 = Math.min(mix.N, D.idx(t1));
  for (let i = i0; i < i1; i++) {
    const t = i / SR;
    const env = Math.min(1, (t - t0) / 2.5, (t1 - t) / 2.5) * (lane ? lane(t) : 1);
    if (i % 32 === 0) {
      f[0].set(lo + (hi - lo) * (0.5 + 0.5 * Math.sin(t * 0.37 + 1.1 * Math.sin(t * 0.13))), 1.6);
      f[1].set(lo + (hi - lo) * (0.5 + 0.5 * Math.sin(t * 0.31 + 2.0 + 1.3 * Math.sin(t * 0.11))), 1.6);
    }
    st.L[i] += f[0].bp(pk[0].next()) * gain * env;
    st.R[i] += f[1].bp(pk[1].next()) * gain * env;
  }
}

/** A sub drone (sine + a little second harmonic) on a MIDI note, swelling in and out. */
export function drone(mix, name, { t0 = 0, t1 = mix.dur, midi = 26, gain = 0.18, lane = null } = {}) {
  const st = stem(mix, name);
  const f = D.mtof(midi);
  const i0 = D.idx(t0), i1 = Math.min(mix.N, D.idx(t1));
  for (let i = i0; i < i1; i++) {
    const t = i / SR, ph = 2 * Math.PI * f * (t - t0);
    const env = Math.min(1, (t - t0) / 3, (t1 - t) / 2) * (lane ? lane(t) : 1);
    const v = (Math.sin(ph) + 0.18 * Math.sin(2 * ph + 0.3 * Math.sin(t * 0.7))) * gain * env;
    st.L[i] += v; st.R[i] += v;
  }
}

/** A beam's hum: a low carrier with a slow vibrato and a fifth above, between t0 and t1. */
export function hum(mix, name, { t0, t1, f = 110, gain = 0.08, pan = 0 }) {
  const st = stem(mix, name);
  const [gl, gr] = D.panGains(pan);
  const i0 = D.idx(t0), i1 = Math.min(mix.N, D.idx(t1));
  for (let i = i0; i < i1; i++) {
    const t = i / SR;
    const env = Math.min(1, (t - t0) / 0.25, (t1 - t) / 0.35);
    const vib = 1 + 0.012 * Math.sin(2 * Math.PI * 5.5 * t);
    const v = (Math.sin(2 * Math.PI * f * vib * (t - t0)) + 0.4 * Math.sin(2 * Math.PI * f * 1.5 * vib * (t - t0)) + 0.15 * Math.sin(2 * Math.PI * f * 4 * (t - t0))) * gain * env;
    st.L[i] += v * gl; st.R[i] += v * gr;
  }
}

/** Mute every stem over [t0, t1) — the vacuum before a hit. */
export function vacuum(mix, t0, t1, fade = 0.02) {
  const i0 = D.idx(t0), i1 = Math.min(mix.N, D.idx(t1)), nf = D.idx(fade);
  for (const st of mix.stems.values()) for (const ch of [st.L, st.R]) for (let i = Math.max(0, i0 - nf); i < i1; i++) ch[i] *= i < i0 ? (i0 - i) / nf : 0;
  for (const s of Object.values(mix.sends)) for (let i = i0; i < i1; i++) s[i] = 0;
}

/** Sum the stems and the returns, set the loudness, limit the peaks. */
export function master(mix, { lufs = -14, ceiling = -1.0, hallGain = 1, delayGain = 0.6, fade = null } = {}) {
  const N = mix.N;
  const out = D.stereo(N);
  for (const st of mix.stems.values()) for (let i = 0; i < N; i++) { out.L[i] += st.L[i]; out.R[i] += st.R[i]; }
  const hall = new D.Freeverb({ room: 0.88, damp: 0.3, size: 1.25, predelay: 0.03, hp: 180, lp: 7500 }).run(mix.sends.hall, 0, N);
  const dl = new D.PingPong({ time: (60 / mix.bpm) * 0.75, fb: 0.46, lp: 3600, hp: 300 }).run(mix.sends.delay, 0, N);
  for (let i = 0; i < N; i++) {
    out.L[i] += hall.L[i] * hallGain + dl.L[i] * delayGain;
    out.R[i] += hall.R[i] * hallGain + dl.R[i] * delayGain;
  }
  const before = D.loudness(out);
  const g = isFinite(before.integrated) ? D.undb(lufs - before.integrated) : 1;
  for (let i = 0; i < N; i++) { out.L[i] *= g; out.R[i] *= g; }
  D.limit(out, D.undb(ceiling - 0.3), 0.0015, 0.08);
  // a film's own fade-out [t0, t1]: the music lets go over the last seconds instead of stopping
  if (fade) {
    const a = D.idx(fade[0]), z = Math.min(N, D.idx(fade[1]));
    for (let i = a; i < N; i++) { const k = i >= z ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (i - a) / (z - a)); out.L[i] *= k; out.R[i] *= k; }
  }
  // a 40 ms fade at both ends, so a film never starts or stops on a click
  const nf = D.idx(0.04);
  for (let i = 0; i < nf; i++) { const k = i / nf; out.L[i] *= k; out.R[i] *= k; out.L[N - 1 - i] *= k; out.R[N - 1 - i] *= k; }
  return { out, meter: D.loudness(out) };
}

export function save(out, base) {
  D.writeWav(base + '.wav', out.L, out.R);
  D.encodeAac(base + '.wav', base + '.m4a');
}
