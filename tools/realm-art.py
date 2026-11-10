"""
realm-art.py — recolour the owner's art for each realm (colour theme).

    python3 tools/realm-art.py            writes assets/img/feature/realm/<theme>/<file>.webp
    python3 tools/realm-art.py --sheet S  also writes a contact sheet to S

Polar Night (the default) shows the art as delivered. For the other realms each
picture keeps its own light and dark (OKLab lightness is untouched, so lettering
stays as readable as it was) and its colours are moved onto the realm's palette:
the warm half of the picture (reds, oranges, pinks, skin) takes the realm's warm
colour, the cool half (blues, violets, greens) its cool one, with a smooth blend
between them. Gentle colours (skin, paper) move only part of the way. Black & White drops the colour altogether.
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/img/feature')
OUT = os.path.join(SRC, 'realm')

# the owner's art, as the site serves it
FILES = ['manifesto-1280.webp', 'manifesto-2400.webp', 'tiny-cans-640.webp', 'tiny-cans-1100.webp',
         'antarctica-dollars-750.webp', 'antarctica-20-front.webp', 'antarctica-20-both.webp']

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


def main():
    sheet = sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None
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
