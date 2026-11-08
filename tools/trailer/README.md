# Films — the site, filmed and tripped out

Four films and a trailer, made from the real site rather than mocked up: every frame is
the live pages running in headless Chromium, then pushed through a shader pass. The
method is EVRITHNG's brand kit (`comeupdream/evrithng`, `frontend/brandkit/`): each frame
is a pure function of its time, rendered one at a time into ffmpeg, so a slow machine
costs time and never drops a frame, and the same source renders the same film twice.

| film | length | what happens |
|---|---|---|
| `realm-shift.mp4` | 32 s | The home page arrives out of space. The pointer opens **Realm** and clicks every realm (each repaints on a scan line), every script (glitch slices) and every cursor. The trip begins: the Tic Tac, the Black Triangle and the Foo Fighter arrive at full size and beam the hero up piece by piece, the saucer pointer grows into the mothership and takes the name letter by letter, and the empty hero goes white. |
| `event-horizon.mp4` | 24 s | Agarthan Crystal realm. The pointer types *tactical* into the archive and reads the cards; the page tips back into space as a deck, a black hole opens over it, the catalogue is lensed, wound into the accretion disk and swallowed. A beat of dark, then a white hole pours out the wordmark. |
| `phase-shift.mp4` | 28 s | The ice wall phase-shifts through every realm, the lens dives through the gate onto the polar map, zooms to Agartha at the pole and falls down it into the inner sun. Agartha is the Crystal realm: the client's static piece plays once on its pedestal, then a last shift to the gate in the wall, where the client's looping piece runs on the checkpoint monitor, and the lens goes into it. |
| `arsenal.mp4` | 24 s | Vril realm. The pointer sweeps the six vaults (the real hover: lift and scan). The site's holo schematics assemble at full size, line by line, turning on a pedestal with each department's name and words; the last is mirrored into a mandala, then a crystal tunnel walled with the featured cards, and the site's tagline. |
| `trailer-wide.mp4` / `trailer-tall.mp4` | 52 s | The four films cut on the beats of the score: intro, build, the drop on 0:24.8, the end card on the final hit at 0:43.4. Tall is 1080×1920 for Reels, TikTok and Shorts. |

**No product photos.** The store's few real photos never appear: `stage.js` strips them
from the catalogue before a page draws, so every card shows its holo schematic.

**Flashing.** Every film is held to WCAG 2.3.1's general flash threshold (no more than
three flashes a second): `npm run films:check`. It is a heuristic, not a certified
analyser — run a Harding test before anything goes on broadcast.

## Make them

```bash
npm run films            # every film → media/films/ (Stage A then Stage B; about an hour on four cores)
npm run films:sound      # the score and each film's soundtrack, muxed into the films
npm run films:trailer    # trailer-wide.mp4 and trailer-tall.mp4, cut on the score
npm run films:check      # the flash check
```

One film, or a look before a long render:

```bash
node tools/trailer/render.mjs realm                 # one film (any part of its key)
STAGE=a node tools/trailer/render.mjs arsenal       # film the site only
STAGE=b node tools/trailer/render.mjs arsenal       # re-run the trip on frames already filmed
PREVIEW_T=4,12.5,20 node tools/trailer/render.mjs phase   # stills in .trailer-cache/<key>/preview/
FROM=12 TO=18 node tools/trailer/render.mjs event   # a slice
```

It needs the Playwright Chromium (`require('playwright')`), ffmpeg on the PATH and Node 18+.
Frames are cached in `.trailer-cache/` (git-ignored). The MP4s are git-ignored too: at
broadcast quality they are tens of megabytes each, and every deploy clones this repository.

## How a film is made

- **Stage A — the site** (`render.mjs`, `stage.js`). The real pages, on a frozen clock
  (Playwright's clock), with the gate passed and the film's realm/script/cursor set. Each
  frame runs the film's `act(t, S)` in the page: the drawn pointer (the site's own
  `--cursor` SVG), real clicks on the display settings, scroll, the real mouse for
  `:hover`, the UFO overlays and their abductions, navigation. Then every CSS animation and
  transition is pinned to `t`, videos are seeked to it, and the frame is saved.
- **Stage B — the trip** (`lens.html`, `lens.js`). A WebGL2 shader over those frames: the
  page as a plane in space under aurora and stars, scan-line and glitch wipes from the frame
  before a click, liquid warp, hue drift, RGB split, lighten-feedback trails, kaleidoscope,
  a lensed black hole with its disk, the tunnel to the inner sun, plates (the wordmark,
  tagline and address set in the site's own type, `plates.html`), bloom and grain. The
  film's `lens(t)` turns the knobs. Out to H.264 High@4.1, yuv420p, BT.709, faststart.
- **Sound** (`sound/`). `score.mjs` writes the trailer's score, *Beyond the Wall* — D minor,
  116 BPM, 24 bars — and its beat map; `soundtrack.mjs` scores each film to its `cues` in the
  same key. No samples: oscillators, noise and filters from `sound/dsp.mjs`, EVRITHNG's sound
  library, vendored unchanged. Mixed by measurement, not by ear (-14 LUFS trailer, -16 LUFS
  films, -1 dBTP) — listen before you publish.
- **The trailer** (`trailer.mjs`). Cuts are data, in beats; every cut lands on a beat and the
  script refuses an edit that drifts out of the section it names.

A film is a file in `films/` exporting `{ key, title, dur, url, prefs, act, lens, cues, plates }`.
`act` runs in the page (it cannot see the file's other variables); `lens` and `cues` run in Node.
