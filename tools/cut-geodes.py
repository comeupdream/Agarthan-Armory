"""cut-geodes.py — cut the two geode halves out of assets/img/realm-src/green-geode.jpg.

    python3 tools/cut-geodes.py CHECK.jpg     (needs opencv-python-headless; run once, not at build)

Writes green-geode-left.png and green-geode-right.png (transparent, the whole stone: rind, white rim
and druzy) beside the photo, for tools/realm-art.py --geodes to lay over Vril's quartz bed, and a
check sheet of both stones on magenta. GrabCut is seeded with an ellipse over each stone: certain
stone in the middle, possible stone out to the rind."""
import sys
import numpy as np
import cv2
from PIL import Image, ImageFilter

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/img/realm-src/green-geode.jpg')
OUT = os.path.join(ROOT, 'assets/img/realm-src') + '/'
img = cv2.imread(SRC)
H, W = img.shape[:2]
mask = np.full((H, W), cv2.GC_BGD, np.uint8)
# each stone: centre and radii of the ellipse it fills
STONES = {'left': ((330, 485), (300, 235)), 'right': ((898, 485), (290, 222))}
for (cx, cy), (rx, ry) in STONES.values():
    pr = np.zeros((H, W), np.uint8); cv2.ellipse(pr, (cx, cy), (int(rx * 1.12), int(ry * 1.15)), 0, 0, 360, 1, -1)
    fg = np.zeros((H, W), np.uint8); cv2.ellipse(fg, (cx, cy), (int(rx * 0.78), int(ry * 0.74)), 0, 0, 360, 1, -1)
    mask[(pr == 1) & (mask == cv2.GC_BGD)] = cv2.GC_PR_FGD
    mask[fg == 1] = cv2.GC_FGD
bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
cv2.grabCut(img, mask, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
stone = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
# tidy: close pinholes, keep the two big pieces, soften the edge a touch inside the outline
stone = cv2.morphologyEx(stone, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
stone = cv2.morphologyEx(stone, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
n, lab, stats, _ = cv2.connectedComponentsWithStats(stone)
print('components', n, sorted(stats[1:, cv2.CC_STAT_AREA])[-4:])
keep = np.zeros_like(stone)
for i in range(1, n):
    if stats[i, cv2.CC_STAT_AREA] > 20000:
        keep[lab == i] = 255
# fill holes (the dark druzy hollows must stay solid)
ff = keep.copy(); m2 = np.zeros((H + 2, W + 2), np.uint8); cv2.floodFill(ff, m2, (0, 0), 255)
keep = keep | cv2.bitwise_not(ff)
rgb = Image.open(SRC).convert('RGB')
# where the two halves meet, the wall behind shows through and clings to their edges. Away from that
# strip each stone's outline is clean, so fit an ellipse to it there and let the ellipse decide the strip.
STRIP = (530, 680)
for name, ((cx, cy), (rx, ry)) in STONES.items():
    side = np.zeros_like(keep)
    x0, x1 = (0, 619) if name == 'left' else (619, W)   # the two halves touch near x = 619
    side[:, x0:x1] = keep[:, x0:x1]
    cs, _ = cv2.findContours(side, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    pts = max(cs, key=cv2.contourArea).reshape(-1, 2)
    pts = pts[(pts[:, 0] < STRIP[0]) | (pts[:, 0] > STRIP[1])]
    (ex, ey), (ew, eh), ang = cv2.fitEllipse(pts.reshape(-1, 1, 2).astype(np.int32))
    ell = np.zeros_like(side)
    cv2.ellipse(ell, ((ex, ey), (ew * 0.985, eh * 0.985), ang), 255, -1)
    side[:, STRIP[0]:STRIP[1]] &= ell[:, STRIP[0]:STRIP[1]]
    # drop anything joined to the stone by a thin neck (a sliver of the wall between the halves):
    # open with a wide kernel, keep the biggest piece, then grow it back inside the original outline
    k = np.ones((25, 25), np.uint8)
    opened = cv2.morphologyEx(side, cv2.MORPH_OPEN, k)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(opened)
    body = np.where(lab2 == 1 + int(np.argmax(st2[1:, cv2.CC_STAT_AREA])), 255, 0).astype(np.uint8)
    side = cv2.dilate(body, k) & side
    a = Image.fromarray(side).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.4))
    im = rgb.copy(); im.putalpha(a)
    im = im.crop(im.getbbox())
    im.save(OUT + f'green-geode-{name}.png', optimize=True)
    print(name, im.size)
# a check sheet: both cut-outs on magenta
sheet = Image.new('RGB', (W, H), (255, 0, 255))
rgba = rgb.copy(); rgba.putalpha(Image.fromarray(keep))
sheet.paste(rgba, (0, 0), rgba)
sheet.save(sys.argv[1], quality=85)
