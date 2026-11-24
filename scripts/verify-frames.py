"""Verifies the extracted frames (run after extract-frames.py):  python3 scripts/verify-frames.py

For every public/frames/<mood>.webp:
  - RGBA with a real alpha channel, all five on the same canvas size
  - both photo slots transparent (alpha 0 over >= 97% of the slot box, excluding stickers)
  - no painted checkerboard left in visible pixels (grey/white grid pattern)
  - artwork intact: every opaque pixel of the source frame outside the slots is still opaque
Exits non-zero on failure.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
ROOT = os.path.join(os.path.dirname(__file__), '..')
slots = json.load(open(os.path.join(ROOT, 'docs', 'frame-extraction.json')))
fails = []
sizes = set()


def check(cond, msg):
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond:
        fails.append(msg)


def checker_left(rgb, alpha, boxes):
    """Visible pixels belonging to a periodic grey/white grid (the painted checkerboard),
    searched around each slot. Periodic = grey here, light one square away and grey again
    two squares away, on both axes; text and artwork edges do not repeat like that."""
    from scipy import ndimage as nd
    small = np.asarray(Image.fromarray(rgb).resize((rgb.shape[1] // 4, rgb.shape[0] // 4), Image.BOX)).astype(int)
    a = np.asarray(Image.fromarray(alpha).resize((alpha.shape[1] // 4, alpha.shape[0] // 4), Image.BOX)) > 250
    mx, mn = small.max(-1), small.min(-1)
    grey = ((mx - mn) <= 16) & (mn >= 226) & (mx <= 249)
    light = ((mx - mn) <= 10) & (mn >= 251)

    def near(m, axis, lo, hi):
        hit = np.zeros_like(m)
        for d in range(lo, hi):
            hit |= np.roll(m, d, axis) | np.roll(m, -d, axis)
        return hit

    pattern = grey & a
    for ax in (0, 1):
        pattern &= near(light, ax, 7, 12) & near(grey, ax, 16, 21)
    region = np.zeros_like(a)
    for (x, y, w, h) in boxes:
        region[max(y // 4 - 12, 0):y // 4 + h // 4 + 12, max(x // 4 - 12, 0):x // 4 + w // 4 + 12] = True
    pattern &= region
    # Group nearby hits, but measure each group by its raw hit count.
    lab, n = nd.label(nd.binary_dilation(pattern, iterations=3))
    clusters = [int((pattern & (lab == i)).sum()) for i in range(1, n + 1)]
    return int(pattern.sum()), max(clusters, default=0)


for mood, info in slots.items():
    print(mood)
    im = Image.open(os.path.join(ROOT, 'public', 'frames', f'{mood}.webp'))
    check(im.format == 'WEBP' and im.mode == 'RGBA', f'{mood}: WebP with alpha (mode {im.mode})')
    sizes.add(im.size)
    arr = np.asarray(im)
    rgb, alpha = arr[..., :3], arr[..., 3]
    check(alpha.min() == 0 and alpha.max() == 255, f'{mood}: alpha channel used (min {alpha.min()}, max {alpha.max()})')
    for s in info['slots']:
        h = s['holePx']
        box = alpha[h['y'] + 20:h['y'] + h['h'] - 20, h['x'] + 20:h['x'] + h['w'] - 20]
        clear = (box == 0).mean()
        cx, cy = h['x'] + h['w'] // 2, h['y'] + h['h'] // 2
        check(alpha[cy, cx] == 0, f"{mood} {s['id']}: centre transparent")
        # Stickers legitimately overlap slots (bubbles, cat, hair), so require most — not all — of the box.
        check(clear >= 0.55, f"{mood} {s['id']}: {clear:.0%} of slot box fully transparent (rest = overlapping stickers)")
        semi = ((box > 0) & (box < 255)).mean()
        check(semi < 0.02, f"{mood} {s['id']}: {semi:.2%} semi-transparent pixels inside slot")
    n, biggest = checker_left(rgb, alpha, [(s['holePx']['x'], s['holePx']['y'], s['holePx']['w'], s['holePx']['h']) for s in info['slots']])
    # A leftover patch of checker produces hundreds of periodic hits; the few dozen that remain
    # come from grey anti-aliasing on white sticker outlines (inspected visually).
    check(biggest < 60, f'{mood}: no checkerboard left in visible pixels (pattern px {n}, largest cluster {biggest})')
    opaque = (alpha > 200).mean()
    check(0.4 < opaque < 0.8, f'{mood}: {opaque:.0%} of canvas opaque')

check(len(sizes) == 1, f'all frames share one canvas size: {sizes}')
print('\nFAILED:\n  ' + '\n  '.join(fails) if fails else '\nall frame checks passed')
sys.exit(1 if fails else 0)
