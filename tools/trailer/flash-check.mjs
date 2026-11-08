// flash-check.mjs — does a film flash more than three times a second?
//
//   node tools/trailer/flash-check.mjs media/films/*.mp4
//
// Vendored from EVRITHNG (frontend/brandkit/flash-check.mjs), unchanged but for this line.
//
// WCAG 2.3.1's general flash threshold: a flash is a pair of opposing changes
// in relative luminance of at least 10% of the maximum, where the darker state
// is below 0.80, over an area large enough to matter; more than three of them
// in any one second is the band known to trigger photosensitive seizures, and every
// film here is held to that line.
//
// This is a HEURISTIC, not a certified analyser (the Harding test is the
// authority): every frame is reduced to a 64×36 luminance grid by ffmpeg, the
// mean relative luminance is tracked in six regions that each cover at least a
// quarter of the frame (four quadrants, the centre, the whole frame), and a
// transition is counted each time a region's luminance reverses by 0.10 or
// more from its last extreme. More than six transitions — three flashes — in
// any 30-frame window fails. It ignores the separate saturated-red rule.
//
// Exit 1 if any film fails, so it can gate a render.

import { spawn } from "node:child_process";

const W = 64;
const H = 36;
const FPS = 30;
const DELTA = 0.1;
const DARK = 0.8;
const MAX_TRANSITIONS = 6;
const FFMPEG = process.env.FFMPEG || "ffmpeg";

/** sRGB-coded luma (0–255) to relative luminance (0–1). */
const lin = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const LUT = Float64Array.from({ length: 256 }, (_, i) => lin(i));

const REGIONS = [
  { name: "top-left", x0: 0, y0: 0, x1: W / 2, y1: H / 2 },
  { name: "top-right", x0: W / 2, y0: 0, x1: W, y1: H / 2 },
  { name: "bottom-left", x0: 0, y0: H / 2, x1: W / 2, y1: H },
  { name: "bottom-right", x0: W / 2, y0: H / 2, x1: W, y1: H },
  { name: "centre", x0: W / 4, y0: H / 4, x1: (3 * W) / 4, y1: (3 * H) / 4 },
  { name: "whole frame", x0: 0, y0: 0, x1: W, y1: H },
];

function frames(file) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, ["-v", "error", "-i", file, "-vf", `fps=${FPS},scale=${W}:${H}:flags=area,format=gray`, "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
    const chunks = [];
    ff.stdout.on("data", (d) => chunks.push(d));
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code} on ${file}`));
      const buf = Buffer.concat(chunks);
      const n = Math.floor(buf.length / (W * H));
      resolve(Array.from({ length: n }, (_, i) => buf.subarray(i * W * H, (i + 1) * W * H)));
    });
  });
}

function regionMeans(frame) {
  return REGIONS.map((r) => {
    let s = 0;
    let n = 0;
    for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) { s += LUT[frame[y * W + x]]; n++; }
    return s / n;
  });
}

/** Frame indices at which a luminance series reverses by DELTA from its last extreme. */
function transitions(series) {
  const out = [];
  let dir = 0;
  let ext = series[0];
  let lo = series[0];
  let hi = series[0];
  for (let i = 1; i < series.length; i++) {
    const L = series[i];
    if (dir === 0) {
      lo = Math.min(lo, L);
      hi = Math.max(hi, L);
      if (L - lo >= DELTA && lo < DARK) { dir = 1; ext = L; out.push(i); }
      else if (hi - L >= DELTA && L < DARK) { dir = -1; ext = L; out.push(i); }
    } else if (dir > 0) {
      if (L > ext) ext = L;
      else if (ext - L >= DELTA && L < DARK) { dir = -1; ext = L; out.push(i); }
    } else {
      if (L < ext) ext = L;
      else if (L - ext >= DELTA && ext < DARK) { dir = 1; ext = L; out.push(i); }
    }
  }
  return out;
}

async function check(file) {
  const fr = await frames(file);
  const means = fr.map(regionMeans);
  let worst = { count: 0, at: 0, region: "" };
  REGIONS.forEach((r, k) => {
    const tr = transitions(means.map((m) => m[k]));
    for (let a = 0, b = 0; a < tr.length; a++) {
      while (b < tr.length && tr[b] - tr[a] < FPS) b++;
      if (b - a > worst.count) worst = { count: b - a, at: tr[a] / FPS, region: r.name };
    }
  });
  const pass = worst.count <= MAX_TRANSITIONS;
  const flashes = Math.floor(worst.count / 2);
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${file.split("/").pop().padEnd(26)} ` +
      (worst.count ? `worst second: ${flashes} flash${flashes === 1 ? "" : "es"} (${worst.count} transitions) from ${worst.at.toFixed(2)}s, ${worst.region}` : "no flashes"),
  );
  return pass;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node frontend/brandkit/flash-check.mjs <film.mp4> …");
  process.exit(2);
}
let ok = true;
for (const f of files) ok = (await check(f)) && ok;
process.exit(ok ? 0 : 1);
