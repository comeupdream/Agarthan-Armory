"""
realm-art.py — recolour the owner's art for each realm (colour theme).

    python3 tools/realm-art.py            writes assets/img/feature/realm/<theme>/<file>.webp
    python3 tools/realm-art.py --sheet S  also writes a contact sheet to S
    python3 tools/realm-art.py --only     just the realm-only pieces (ONLY below)
    python3 tools/realm-art.py --files a.webp,b.webp   just those pictures of the owner's art
    python3 tools/realm-art.py --geodes   the geode fields: rhodochrosite (Inner Earth), amethyst (Crystal), fluorite (Polar),
                                          green quartz and druzy (Vril)

Polar Night (the default) shows the art as delivered. For the other realms each
picture keeps its own light and dark (OKLab lightness is untouched, so lettering
stays as readable as it was) and its colours are moved onto the realm's palette:
the warm half of the picture (reds, oranges, pinks, skin) takes the realm's warm
colour, the cool half (blues, violets, greens) its cool one, with a smooth blend
between them. Gentle colours (skin, paper) move only part of the way. Black & White drops the colour altogether.

Realm-only pieces (ONLY) are pictures that belong to some realms and not others;
site.css's .realm-only shows each realm its own copy. Their masters live in
assets/img/realm-src/, and each named realm gets a copy at every listed width.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/img/feature')
OUT = os.path.join(SRC, 'realm')

# the owner's art, as the site serves it
FILES = ['manifesto-1280.webp', 'manifesto-2400.webp', 'tiny-cans-640.webp', 'tiny-cans-1100.webp',
         'antarctica-dollars-750.webp', 'antarctica-20-front.webp', 'antarctica-20-both.webp',
         'holo-laser-900.webp', 'holo-laser-1600.webp']

# art that belongs to some realms only: master in assets/img/realm-src/, realms, widths to serve
ONLY = {
    'naica': {'src': 'naica.jpg', 'realms': ['inner-earth', 'mono'], 'widths': [1600, 2600]},
    # cropped inside the engraving's printed frame (which also drops its caption line), and inverted:
    # light lines on the dark site read as an etched schematic rather than a sheet of paper
    'symmes-hole': {'src': 'symmes-hole.jpg', 'realms': ['inner-earth', 'mono'], 'widths': [980],
                    'crop': (14, 14, 997, 712), 'invert': True},
    # the picks matched to a realm by their own colours (keep: shown as photographed, not recoloured)
    'ice-cave': {'src': 'ice-cave.jpg', 'realms': ['polar'], 'widths': [1600, 2600], 'keep': True},
    'ice-cave-exit': {'src': 'ice-cave-exit.jpg', 'realms': ['polar'], 'widths': [980], 'keep': True},
    'fluorite': {'src': 'fluorite.jpg', 'realms': ['polar'], 'widths': [980], 'keep': True},
    'amethyst-geode': {'src': 'amethyst-geode.jpg', 'realms': ['crystal'], 'widths': [1600, 2600], 'keep': True},
    'endurance-dawn': {'src': 'endurance-dawn.jpg', 'realms': ['crystal'], 'widths': [980], 'keep': True},
    'atomium': {'src': 'atomium.jpg', 'realms': ['crystal'], 'widths': [980], 'keep': True},
    'petra-treasury': {'src': 'petra-treasury.jpg', 'realms': ['inner-earth'], 'widths': [700], 'keep': True},
    'rhodochrosite': {'src': 'rhodochrosite.png', 'realms': ['inner-earth'], 'widths': [760], 'keep': True},
    # Vril's backdrop behind the Lasers chapter: two geodes glowing green under ultraviolet, on black
    'glowing-geodes': {'src': 'glowing-geodes.jpg', 'realms': ['vril'], 'widths': [900, 1500], 'keep': True},
}
# A realm-only photo is mostly near-white or grey (crystal, an engraving), so moving its hues does
# little; instead its lightness is mapped through the realm's own ramp, dark to light (a tone map).
TONES = {
    'inner-earth': ['#0e0402', '#5a160a', '#c4521c', '#f39a3c', '#ffe7c4'],   # ember -> molten amber -> pale gold
}
MASTERS = os.path.join(ROOT, 'assets/img/realm-src')

# warm / cool targets per realm, taken from that realm's own colours in site.css
REALMS = {
    'inner-earth': {'warm': '#ffb347', 'cool': '#ff4f6d', 'chroma': 1.0},
    'crystal':     {'warm': '#ffd27a', 'cool': '#9a63e6', 'chroma': 1.05},
    'vril':        {'warm': '#d6ff5d', 'cool': '#22c46b', 'chroma': 1.0},
    'mono':        {'mono': True},
}
WARM_CENTRE = 40.0   # OKLCh hue that counts as fully warm (orange-red); its opposite is fully cool


# ---- sRGB <-> OKLab (Björn Ottosson's matrices) ----
def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
               [0.2119034982, 0.6806995451, 0.1073969566],
               [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
               [1.9779984951, -2.4285922050, 0.4505937099],
               [0.0259040371, 0.7827717662, -0.8086757660]])
M2i = np.linalg.inv(M2)
M1i = np.linalg.inv(M1)


def to_oklab(rgb):
    lms = srgb_to_linear(rgb) @ M1.T
    return np.cbrt(lms) @ M2.T


def to_linear(lab):
    lms = (lab @ M2i.T) ** 3
    return lms @ M1i.T


def hex_lch(h):
    rgb = np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    L, a, b = to_oklab(rgb[None])[0]
    return L, np.hypot(a, b), np.degrees(np.arctan2(b, a)) % 360


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def recolour(rgb, realm):
    lab = to_oklab(rgb)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    if realm.get('mono'):
        L2 = np.clip((L - 0.5) * 1.08 + 0.5, 0, 1)   # a touch more contrast, as the realm's own filter has
        z = np.zeros_like(L2)
        return linear_to_srgb(to_linear(np.stack([L2, z, z], -1)))
    C = np.hypot(a, b)
    h = np.degrees(np.arctan2(b, a)) % 360
    _, _, hw = hex_lch(realm['warm'])
    _, _, hc = hex_lch(realm['cool'])
    w = smoothstep(-0.35, 0.35, np.cos(np.radians(h - WARM_CENTRE)))     # 1 = warm, 0 = cool
    d = ((hw - hc + 180) % 360) - 180                                     # shortest arc cool -> warm
    # gentle colours (skin, paper, greys) move only part of the way, so a face stays a face;
    # the poster's bold colours move all the way
    k = 0.35 + 0.65 * smoothstep(0.04, 0.14, C)
    dh = ((hc + d * w - h + 180) % 360) - 180
    hue = np.radians(h + dh * k)
    C2 = C * realm['chroma']
    # keep every pixel inside sRGB by lowering its chroma, never by clipping (clipping shifts the hue)
    lo, hi = np.zeros_like(C2), np.ones_like(C2)
    for _ in range(10):
        mid = (lo + hi) / 2
        lin = to_linear(np.stack([L, C2 * mid * np.cos(hue), C2 * mid * np.sin(hue)], -1))
        ok = np.all((lin >= -1e-4) & (lin <= 1 + 1e-4), -1)
        lo = np.where(ok, mid, lo)
        hi = np.where(ok, hi, mid)
    s = lo
    lin = to_linear(np.stack([L, C2 * s * np.cos(hue), C2 * s * np.sin(hue)], -1))
    return linear_to_srgb(lin)


def render(name, theme):
    im = Image.open(os.path.join(SRC, name))
    has_alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
    im = im.convert('RGBA')
    arr = np.asarray(im).astype(np.float64) / 255
    out = recolour(arr[..., :3], REALMS[theme])
    px = np.concatenate([out, arr[..., 3:]], -1) if has_alpha else out
    res = Image.fromarray(np.round(px * 255).astype(np.uint8), 'RGBA' if has_alpha else 'RGB')
    return res


def tone(rgb, stops, mix=0.88):
    L = to_oklab(rgb)[..., 0]
    ramp = np.array([to_oklab(np.array([[int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]]))[0] for h in stops])
    # stops spread by their own lightness, so the ramp lands where the picture's light already is
    Ls = ramp[:, 0]
    t = np.clip((L - Ls[0]) / (Ls[-1] - Ls[0]), 0, 1) * (len(stops) - 1)
    i = np.minimum(t.astype(int), len(stops) - 2)
    f = (t - i)[..., None]
    lab = ramp[i] * (1 - f) + ramp[i + 1] * f
    lab[..., 0] = L                     # keep the picture's own light exactly
    toned = linear_to_srgb(to_linear(lab))
    return toned * mix + rgb * (1 - mix)


def render_only():
    for name, spec in ONLY.items():
        master = Image.open(os.path.join(MASTERS, spec['src']))
        if spec.get('keep'):
            # as photographed (a cut-out keeps its transparency): only sized
            master = master.convert('RGBA' if master.mode in ('RGBA', 'LA', 'P') else 'RGB')
            for theme in spec['realms']:
                os.makedirs(os.path.join(OUT, theme), exist_ok=True)
                for w in spec['widths']:
                    im = master if master.width == w else master.resize((w, round(master.height * w / master.width)), Image.LANCZOS)
                    im.save(os.path.join(OUT, theme, f'{name}-{w}.webp'), 'WEBP', quality=82, method=6)
                    print(f'{theme}/{name}-{w}.webp', im.size, flush=True)
            continue
        master = master.convert('RGB')
        if spec.get('crop'):
            master = master.crop(spec['crop'])
        if spec.get('invert'):
            master = Image.eval(master, lambda v: 255 - v)
        big = master.copy()
        big.thumbnail((max(spec['widths']), max(spec['widths'])), Image.LANCZOS)
        arr = np.asarray(big).astype(np.float64) / 255
        for theme in spec['realms']:
            os.makedirs(os.path.join(OUT, theme), exist_ok=True)
            px = tone(arr, TONES[theme]) if theme in TONES else recolour(arr, REALMS[theme])
            res = Image.fromarray(np.round(np.clip(px, 0, 1) * 255).astype(np.uint8), 'RGB')
            for w in spec['widths']:
                im = res if res.width == w else res.resize((w, round(res.height * w / res.width)), Image.LANCZOS)
                im.save(os.path.join(OUT, theme, f'{name}-{w}.webp'), 'WEBP', quality=82, method=6)
                print(f'{theme}/{name}-{w}.webp', im.size, flush=True)


GEODE_TILE = 1400   # px square; the page shows it at half that, so it stays sharp on a 2x screen


def geode_tile(seed=11):
    """A seamless tile packed solid with the rhodochrosite cut-out: one massive geode.

    Crystals are laid one over another until no background is left: each new one is centred on a
    spot nothing covers yet, at a random size, turn and mirror, a little lighter or darker than the
    last, with a soft shadow under it so the pile reads as layers of crystal rather than stickers.
    Anything that crosses an edge is laid again one tile over, so the tile repeats with no seam."""
    from PIL import ImageEnhance
    rng = np.random.default_rng(seed)
    src = Image.open(os.path.join(MASTERS, 'rhodochrosite.png')).convert('RGBA')
    # trim the pale rim the studio background left round the cut-out, so neighbours run together
    src.putalpha(src.getchannel('A').filter(ImageFilter.MinFilter(13)).filter(ImageFilter.GaussianBlur(3)))
    # and calm the grey-white rock between the crystals, so the red carries the field
    px = np.asarray(src).astype(np.float64)
    lo, hi = px[..., :3].min(2), px[..., :3].max(2)
    pale = np.clip((lo - 120) / 80, 0, 1) * np.clip(1 - (hi - lo) / 60, 0, 1)
    px[..., :3] *= (1 - 0.38 * pale)[..., None]
    src = Image.fromarray(px.clip(0, 255).astype(np.uint8), 'RGBA')
    T = GEODE_TILE
    tile = Image.new('RGBA', (T, T), (0, 0, 0, 0))

    def lay(im, x, y):
        w, h = im.size
        for dx in (-T, 0, T):
            for dy in (-T, 0, T):
                tile.alpha_composite(im, (int(x - w / 2 + dx), int(y - h / 2 + dy)))

    n = 0
    while True:
        a = np.asarray(tile.getchannel('A').resize((140, 140)))
        open_spots = np.argwhere(a < 250)
        if len(open_spots) == 0 or n > 400:
            break
        # the biggest crystals first, then smaller ones to close the gaps between them
        big = n < 14
        cy, cx = open_spots[rng.integers(len(open_spots))] * (T / 140)
        side = rng.uniform(0.42, 0.62) * T if big else rng.uniform(0.24, 0.40) * T
        im = src.copy()
        if rng.uniform() < 0.5:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        im.thumbnail((int(side), int(side)), Image.LANCZOS)
        im = im.rotate(rng.uniform(0, 360), resample=Image.BICUBIC, expand=True)
        rgb, alpha = im.convert('RGB'), im.getchannel('A')
        rgb = ImageEnhance.Brightness(rgb).enhance(rng.uniform(0.78, 1.08))
        im = Image.merge('RGBA', (*rgb.split(), alpha))
        # its shadow: the crystal's outline, blurred, dark, a little below and right
        sh = Image.new('RGBA', im.size, (8, 2, 1, 0))
        sh.putalpha(alpha.filter(ImageFilter.GaussianBlur(side * 0.035)).point(lambda v: int(v * 0.75)))
        lay(sh, cx + side * 0.03, cy + side * 0.05)
        lay(im, cx, cy)
        n += 1
    out_im = Image.new('RGB', (T, T), (40, 10, 8))   # under the last pinholes, the crystal's own dark red
    out_im.paste(tile, (0, 0), tile)
    out = os.path.join(OUT, 'inner-earth', 'geode-tile.webp')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    out_im.save(out, 'WEBP', quality=76, method=6)
    print('geode tile', out_im.size, n, 'crystals', os.path.getsize(out), 'bytes')


# the crystal beds for the other realms. Each source: the master, which part of it is the crystal (an
# OKLCh hue band with minimum chroma and lightness, or everything but an 'avoid' rectangle), the source
# patch size range, the scale range, how much of a patch must be that crystal, and (with two or more
# sources) how often it is used. 'div' is how far the photo is shrunk to judge patches.
BEDS = {
    'crystal': {'seed': 5, 'base': (24, 10, 40), 'sources': [
        {'src': 'amethyst-geode.jpg', 'hue': None, 'chroma': None, 'light': 0.12,
         'avoid': (1640, 0, 2440, 920),   # the cream calcite lump, with a margin
         'patch': (480, 760), 'scale': (1.05, 1.45), 'keep': 0.84}]},
    'polar': {'seed': 3, 'base': (6, 30, 48), 'sources': [
        {'src': 'fluorite.jpg', 'hue': (200, 255), 'chroma': 0.055, 'light': 0.30,
         'patch': (820, 1120), 'scale': (0.66, 0.86), 'keep': 0.80}]},
    # Black & White: the Naica cave's quartz beams (only the pale crystal: not the brown rock ceiling, the
    # dark floor or the caver standing among them), laid in grey
    'mono': {'seed': 4, 'base': (22, 22, 22), 'grey': True, 'inside': True, 'sources': [
        {'src': 'naica.jpg', 'hue': None, 'chroma': None, 'light': 0.50, 'chroma_max': 0.06,
         'avoid': (1880, 1160, 2240, 1640),   # the caver, with a margin
         'patch': (520, 820), 'scale': (0.85, 1.15), 'keep': 0.80}]},
    # Vril: a bed of green quartz points, with the whole cut geode halves laid over it (their cut-outs come
    # from tools/cut-geodes.py): rind, white rim and druzy, at different sizes and turns, each with a shadow
    'vril': {'seed': 9, 'base': (6, 34, 22), 'inside': True, 'sources': [
        {'src': 'green-quartz.jpg', 'hue': (140, 172), 'chroma': 0.08, 'light': 0.30, 'div': 4, 'pstep': 20,
         'patch': (200, 400), 'scale': (1.15, 1.6), 'keep': 0.92}],
     'stones': {'srcs': ['green-geode-left.png', 'green-geode-right.png'], 'count': 7, 'size': (0.30, 0.46), 'spacing': 0.27}},
}


def crystal_bed(realm):
    """A seamless tile packed solid with patches of crystal photos (one massive geode).

    The photos are not cut-outs, so the bed is built from pieces of them: each patch is centred where
    the photo is that realm's crystal (the violet points, the blue cubes, the green quartz and druzy),
    cut with a soft, irregular edge, turned and mirrored at random, and laid over the last until
    nothing is left uncovered. A patch that crosses an edge is laid again one tile over, so the tile
    has no seam. Every qualifying patch is listed up front, so one that fails is never used."""
    bed = BEDS[realm]
    rng = np.random.default_rng(bed['seed'])
    pools = []
    for cfg in bed['sources']:
        div, pstep = cfg.get('div', 8), cfg.get('pstep', 40)
        src = Image.open(os.path.join(MASTERS, cfg['src'])).convert('RGB')
        small = np.asarray(src.resize((src.width // div, src.height // div), Image.BILINEAR)).astype(np.float64) / 255
        lab = to_oklab(small.reshape(-1, 3)).reshape(small.shape)
        L, C = lab[..., 0], np.hypot(lab[..., 1], lab[..., 2])
        h = np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360
        if cfg['hue']:   # the crystal is a colour
            good = (h >= cfg['hue'][0]) & (h <= cfg['hue'][1]) & (C >= cfg['chroma']) & (L >= cfg['light'])
            bad = np.zeros_like(good)
        else:            # the amethyst's points are small and dim (and lit gold in places), so keep
            # everything that is not the calcite lump and not the dark crevice
            bad = np.zeros_like(L, dtype=bool)
            x0, y0, x1, y1 = (v // div for v in cfg['avoid'])
            bad[y0:y1, x0:x1] = True
            good = ~bad & (L >= cfg['light'])
            if cfg.get('chroma_max') is not None:   # pale crystal only, not coloured rock
                good &= C <= cfg['chroma_max']

        def table(m):
            return np.pad(m.astype(np.float64).cumsum(0).cumsum(1), ((1, 0), (1, 0)))
        gt, bt = table(good), table(bad)
        cands = []
        for ps in range(cfg['patch'][0], cfg['patch'][1] + 1, pstep):
            k = ps // div
            for y in range(0, good.shape[0] - k, 2):
                for x in range(0, good.shape[1] - k, 2):
                    area = k * k
                    g = (gt[y + k, x + k] - gt[y, x + k] - gt[y + k, x] + gt[y, x]) / area
                    b = (bt[y + k, x + k] - bt[y, x + k] - bt[y + k, x] + bt[y, x]) / area
                    if g >= cfg['keep'] and b == 0:
                        cands.append((x * div, y * div, ps))
        if not cands:
            raise SystemExit(f'{realm}: no patch of {cfg["src"]} qualifies')
        pools.append((cfg, src, cands))
    T = GEODE_TILE
    tile = Image.new('RGBA', (T, T), (0, 0, 0, 0))

    def lay(im, x, y):
        w, hh = im.size
        for dx in (-T, 0, T):
            for dy in (-T, 0, T):
                tile.alpha_composite(im, (int(x - w / 2 + dx), int(y - hh / 2 + dy)))

    def blob(size):
        # a rounded, wobbly outline with a soft edge
        n = 48
        th = np.linspace(0, 2 * np.pi, n, endpoint=False)
        r = 1 + sum(rng.uniform(-0.09, 0.09) * np.cos(k * th + rng.uniform(0, 6.3)) for k in (2, 3, 5))
        # 'inside': keep the outline within the patch, or a soft photo shows the patch's square edge as a
        # straight line (the quartz does; the amethyst and fluorite tiles were made without it and keep their look)
        r = (np.minimum(r * 0.40, 0.42) if bed.get('inside') else r * 0.40) * size
        from PIL import ImageDraw
        m = Image.new('L', (size, size), 0)
        ImageDraw.Draw(m).polygon([(size / 2 + r[i] * np.cos(th[i]), size / 2 + r[i] * np.sin(th[i])) for i in range(n)], fill=255)
        return m.filter(ImageFilter.GaussianBlur(size * 0.05))

    weights = np.array([c.get('weight', 1) for c in bed['sources']], dtype=np.float64)
    weights /= weights.sum()
    n = 0
    while n < 900:
        cov = np.asarray(tile.getchannel('A').resize((140, 140)))
        open_spots = np.argwhere(cov < 250)
        if len(open_spots) == 0:
            break
        cy, cx = open_spots[rng.integers(len(open_spots))] * (T / 140)
        cfg, src, cands = pools[rng.choice(len(pools), p=weights)] if len(pools) > 1 else pools[0]
        px, py, ps = cands[rng.integers(len(cands))]   # a patch of the photo that is the crystal
        patch = src.crop((px, py, px + ps, py + ps))
        if rng.uniform() < 0.5:
            patch = patch.transpose(Image.FLIP_LEFT_RIGHT)
        side = int(ps * rng.uniform(*cfg['scale']))
        patch = patch.resize((side, side), Image.LANCZOS).convert('RGBA')
        patch.putalpha(blob(side))
        patch = patch.rotate(rng.uniform(0, 360), resample=Image.BICUBIC, expand=True)
        lay(patch, cx, cy)
        n += 1
    if bed.get('stones'):   # whole stones laid over the bed, spread out, each with a soft shadow
        st = bed['stones']
        stones = [Image.open(os.path.join(MASTERS, f)).convert('RGBA') for f in st['srcs']]
        spots = []
        while len(spots) < st['count']:
            x, y = rng.uniform(0, T, 2)
            if all(min(abs(x - a), T - abs(x - a)) ** 2 + min(abs(y - b), T - abs(y - b)) ** 2 > (T * st['spacing']) ** 2 for a, b in spots) \
                    or rng.uniform() < 0.002:
                spots.append((x, y))
        for i, (x, y) in enumerate(spots):
            im = stones[i % len(stones)].copy()
            if rng.uniform() < 0.5:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            side = rng.uniform(*st['size']) * T
            im.thumbnail((int(side), int(side)), Image.LANCZOS)
            im = im.rotate(rng.uniform(0, 360), resample=Image.BICUBIC, expand=True)
            alpha = im.getchannel('A')
            sh = Image.new('RGBA', im.size, (2, 10, 6, 0))
            sh.putalpha(alpha.filter(ImageFilter.GaussianBlur(side * 0.04)).point(lambda v: int(v * 0.8)))
            lay(sh, x + side * 0.03, y + side * 0.05)
            lay(im, x, y)
    out_im = Image.new('RGB', (T, T), bed['base'])
    out_im.paste(tile, (0, 0), tile)
    if bed.get('grey'):   # Black & White: the same colour-dropping as the realm's recoloured art
        px = recolour(np.asarray(out_im).astype(np.float64) / 255, REALMS[realm])
        out_im = Image.fromarray(np.round(np.clip(px, 0, 1) * 255).astype(np.uint8), 'RGB')
    out = os.path.join(OUT, realm, 'geode-tile.webp')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    out_im.save(out, 'WEBP', quality=76, method=6)
    print(realm, 'crystal bed', out_im.size, n, 'patches from', sum(len(c) for _, _, c in pools), 'candidates', os.path.getsize(out), 'bytes')


def main():
    if '--geodes' in sys.argv:
        geode_tile()
        for realm in BEDS:
            crystal_bed(realm)
        return
    if '--only' in sys.argv:
        render_only()
        return
    sheet = sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None
    if '--files' in sys.argv:
        names = sys.argv[sys.argv.index('--files') + 1].split(',')
        for theme in REALMS:
            os.makedirs(os.path.join(OUT, theme), exist_ok=True)
            for name in names:
                render(name, theme).save(os.path.join(OUT, theme, name), 'WEBP', quality=84, method=6)
            print(theme, 'done', flush=True)
        return
    rows = []
    for theme in REALMS:
        os.makedirs(os.path.join(OUT, theme), exist_ok=True)
        row = []
        for name in FILES:
            res = render(name, theme)
            res.save(os.path.join(OUT, theme, name), 'WEBP', quality=84, method=6)
            row.append(res)
        rows.append(row)
        print(theme, 'done', flush=True)
    render_only()
    if sheet:
        pick = [0, 2, 4, 5]
        H = 260
        orig = [Image.open(os.path.join(SRC, FILES[i])).convert('RGB') for i in pick]
        grid = [orig] + [[r[i].convert('RGB') for i in pick] for r in rows]
        grid = [[im.resize((round(im.width * H / im.height), H)) for im in r] for r in grid]
        W = max(sum(im.width for im in r) + 10 * len(r) for r in grid)
        out = Image.new('RGB', (W, (H + 10) * len(grid)), (24, 24, 24))
        for y, r in enumerate(grid):
            x = 0
            for im in r:
                out.paste(im, (x, y * (H + 10)))
                x += im.width + 10
        out.save(sheet, quality=85)


if __name__ == '__main__':
    main()
