# Films — the site, filmed and tripped out

Seven films and a trailer, made from the real site rather than mocked up: every frame is
the live pages running in headless Chromium, then pushed through a shader pass. The
method is EVRITHNG's brand kit (`comeupdream/evrithng`, `frontend/brandkit/`): each frame
is a pure function of its time, rendered one at a time into ffmpeg, so a slow machine
costs time and never drops a frame, and the same source renders the same film twice.

| film | length | what happens | score |
|---|---|---|---|
| `realm-shift.mp4` | 42 s | The home page arrives out of space. The pointer opens **Realm** and clicks every realm (each repaints on a scan line), the scripts (glitch slices) and every cursor. The trip begins: the Tic Tac, the Black Triangle and the Foo Fighter beam the hero up piece by piece, and the saucer pointer grows into the mothership and takes the name letter by letter. **Peak:** the name's echoes mirrored round the empty hero. **Come-down:** the mothership gives the letters back. **Calm:** it lets the seal down above the name and lifts away; the name changes script — Runic, a flash of Old World, Future, Runic — each change leaving an echo, and the page drifts back out into space. | E minor, 124 BPM, four on the floor; a lead over the peak, bells for each script |
| `event-horizon.mp4` | 32 s | Agarthan Crystal realm. The pointer types *tactical* into the archive and reads the cards; the page tips back into space as a deck, a black hole opens over it, and the catalogue is lensed, wound into the accretion disk and swallowed. A beat of dark, then a white hole pours out the seal and the name in Runic. **Peak:** a star-burst. **Come-down and calm:** the name falls through a tiny black hole and is born again in each script — Future, a flash of Old World, Future — and the address comes up. | C sharp minor, 84 BPM, a heartbeat; resolves to C sharp major for the name |
| `phase-shift.mp4` | 37 s | The ice wall phase-shifts through every realm, the lens dives through the gate onto the polar map, zooms to Agartha at the pole and falls down it into the inner sun. Agartha is the Crystal realm: the client's static piece plays once on its pedestal, then a last shift to the gate in the wall, where the client's looping piece runs on the checkpoint monitor. **Peak:** the loop folds into a kaleidoscope. **Come-down:** a tunnel of light carries the camera back up and out of the gate in the ice wall. **Calm:** the seal rises out of the gate, up its light, and becomes the hero's star; the name phase-shifts its script — Future, a flash of Old World, Runic — and the page turns away into the dark. | A Dorian, 132 BPM, a breakbeat; a warm harp section for Agartha, a harp up the scale for the seal |
| `arsenal.mp4` | 32 s | Vril realm. The pointer sweeps the six vaults (the real hover: lift and scan). The site's holo schematics assemble at full size, line by line, turning on a pedestal with each department's name and words; the last is mirrored into a mandala, then a crystal tunnel walled with the featured cards, and the site's tagline. **Peak:** the line burns at its brightest and goes back into the dark. **Calm:** the brand is projected onto the pedestal as a hologram, scanned up out of its light — seal, name, licence line — and re-scanned through the scripts: Future, Runic, a flash of Old World, Future. | G minor, 100 BPM, march toms; resolves to G major on the last scan |
| `the-eye.mp4` | 42 s | The geode eye. The home page arrives out of space; the saucer cursor swoops round the hero while the eye in the ice wall follows it, circles it and settles on it, and the eye wakes. A click: the camera falls into its pupil, down a tunnel of light, and out of the watching eye on the Forbidden Knowledge page, then drifts down the files as the saucer lifts their redactions and the page goes stranger and stranger. **Peak:** the saucer orbits the watching eye inside a mandala. **Come-down**, then **calm:** the seal rises out of the eye's pupil into the giant geode and the title walks Runic, a flash of Old World, Future, Runic. One of the two films that show the eye (`showEye: true`). | D Phrygian, 96 BPM, hand-drum toms that build to four on the floor; a glass arpeggio for the seal |
| `living-money.mp4` | 49 s | Every realm's own art, then the Antarctica money comes alive. The saucer pointer works the real Realm button (pinned under the header) down the home page: Polar Night shows the owner's banner as delivered, Inner Earth turns it amber and crimson and opens the way down (Naica and Symmes Hole appear), Black & White silvers them, Vril closes the way down and greens the Tiny Cans poster, Agarthan Crystal golds and violets it and settles on the gate in the ice wall, the $20 behind it. The pointer grows into the mothership and beams down the $2 beside the $20. Then the $20 turns over to its back, Worsley's Endurance route, and holds there while the trip happens to its art: it **breathes**, its own outlines echo outward in colour, pulsing (**tracers**), and the print melts into **bubble print**; the $2 morphs into a real butterfly printed with the note's face. **Peak:** mirrors, the back nested inside itself, a tunnel of money. **Come-down:** the butterfly lands and turns back into the note. **Calm:** the name walks the scripts over the back of the 20 and the 2. | F Lydian, 120 BPM, a breakbeat for the realm tour, four on the floor as the money wakes |
| `edge-of-the-world.mp4` | 49 s | Polar Night and Agarthan Crystal only. The saucer rests its beam on the eye in the ice wall and it opens wide (the site's own hover). The navigation map fills the screen and the camera spirals down to the wall at the Gate, then tips to a grazing angle: the flat world runs to the ice wall on the horizon, aurora rising beyond it (no stars). A slow flight along the wall, the map's readout ticking AT THE ICE WALL, a saucer skimming ahead, the realm turning between aurora and purple. The camera rises until the disc spins below. **Peak:** the hole at the pole tears open and swirls the continents in. The fall comes out of the eye in the ice wall, now in Crystal, and the saucer opens it once more. **Calm:** the title walks Runic, a flash of Old World, Future, Runic. Filmed at 2560×1440 so the vector map stays sharp. | B minor, 88 BPM, hand drums for the flight, four on the floor at the hole; resolves to B major |
| `trailer-wide.mp4` / `trailer-tall.mp4` | 52 s | The four films cut on the beats of the score: intro, build, the drop on 0:24.8, the end card on the final hit at 0:43.4. Tall is 1080×1920 for Reels, TikTok and Shorts. | *Beyond the Wall*, D minor, 116 BPM |

Every film ends the same way in outline and differently in detail: a peak, a come-down, a
calm with the brand's seal and name on screen, the name walking through the scripts, and a
fade to black under a musical fade-out. No film uses the Ancient Tech typeface: they are
set in Runic and Future, with Old World shown briefly.

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
  116 BPM, 24 bars — and its beat map; `soundtrack.mjs` writes each film its own score
  (`MUSIC`: key, tempo, groove, chords, the peak's melody, the calm's harmony, a fade) and
  scores its `cues` in that key. No samples: oscillators, noise and filters from `sound/dsp.mjs`, EVRITHNG's sound
  library, vendored unchanged. Mixed by measurement, not by ear (-14 LUFS trailer, -16 LUFS
  films, -1 dBTP) — listen before you publish.
- **The trailer** (`trailer.mjs`). Cuts are data, in beats; every cut lands on a beat and the
  script refuses an edit that drifts out of the section it names.

A film is a file in `films/` exporting `{ key, title, dur, url, prefs, act, lens, cues, plates }`.
`act` runs in the page (it cannot see the file's other variables); `lens` and `cues` run in Node.
