"""Extracts the five mood frames from the design sheet into transparent PNGs.

    python3 scripts/extract-frames.py            # writes public/frames/<mood>.png + slots JSON
    python3 scripts/extract-frames.py --debug    # also writes debug images to /tmp-like DEBUG_DIR

Source: src/assets/mood_frame.png (1536x1024, RGB — NO alpha channel). The checkerboard
in the photo slots is painted pixels, so transparency is rebuilt here:

1. Sheet background: flood fill from the image border over warm-cream/shadow pixels
   (hue 5-40 deg, low saturation). Frame outlines are neutral white, so the fill stops
   there and white outlines survive.
2. Frames that touch are split with a minimum-cost vertical seam (cheap through
   background, a bit more through white outline, expensive through artwork).
3. Slots: the painted checkerboard is neutral grey/white (R~G~B). Starting inside each
   slot we flood over neutral-bright pixels; the slot's coloured stroke stops it. The slot
   interior is fitted as a rounded rectangle. Stickers that overlap the slot (speech
   bubbles, cat, scribble...) are found as non-checker blobs reaching deep into the slot,
   and they keep their artwork plus their white sticker outline (a measured band).
   Nothing is removed by "white = transparent".
4. Upscaled x SCALE with Lanczos (+ light unsharp mask). Slot edges are re-drawn
   analytically at the high resolution so they stay crisp.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'src', 'assets', 'mood_frame.png')
OUT = os.path.join(ROOT, 'public', 'frames')
SLOTS_JSON = os.path.join(ROOT, 'docs', 'frame-extraction.json')
DEBUG = '--debug' in sys.argv
DEBUG_DIR = os.environ.get('DEBUG_DIR', os.path.join(ROOT, '.frame-debug'))

MOODS = ['happy', 'sad', 'tired', 'anxious', 'confident']
TOP_ROW_END = 605          # frames live above this y; the QR cards below are not extracted
SEAM_BANDS = [(300, 345), (595, 650), (900, 950), (1200, 1250)]
SCALE = 4                  # 1536 px sheet → ~1280 px wide frames
CANVAS = (322, 580)        # common native canvas (w, h) for all frames, before scaling
CHECKER_REACH = 6         # px: half a checker square (~9 px) plus anti-aliasing
STICKER_OUTLINE = 6        # px (native) of white outline kept around stickers overlapping a slot
BLEED = 3                  # px (native) the photo extends under the frame stroke


def load():
    return np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)


def background_mask(im):
    R, G, B = im[..., 0], im[..., 1], im[..., 2]
    warm = R - B
    hue = np.where(warm > 0.5, 60 * (G - B) / np.maximum(warm, 1e-3), 999)
    bglike = (R > 215) & (warm > 6) & (warm < 75) & (hue > 5) & (hue < 40) & (G >= B - 2)
    lab, _ = nd.label(bglike)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, list(edge))


def seam(cost, x0, x1):
    """Minimum vertical seam (one x per row) inside columns [x0, x1)."""
    c = cost[:, x0:x1].astype(np.float64)
    h, w = c.shape
    acc = c.copy()
    back = np.zeros((h, w), np.int64)
    for y in range(1, h):
        prev = acc[y - 1]
        left = np.r_[np.inf, prev[:-1]]
        right = np.r_[prev[1:], np.inf]
        stack = np.vstack([left, prev, right])
        k = np.argmin(stack, 0)
        back[y] = k - 1
        acc[y] += stack[k, np.arange(w)]
    xs = np.zeros(h, np.int64)
    xs[-1] = int(np.argmin(acc[-1]))
    for y in range(h - 1, 0, -1):
        xs[y - 1] = xs[y] + back[y, xs[y]]
    return xs + x0


def neutral_bright(im):
    mx = im.max(-1)
    mn = im.min(-1)
    return ((mx - mn) <= 9) & (mn >= 218)


def rounded_rect_mask(h, w, x0, y0, x1, y1, r, ss=1):
    """Anti-aliased rounded rectangle coverage (0..1) on an h×w grid, ss = supersampling."""
    ys = (np.arange(h * ss) + 0.5) / ss
    xs = (np.arange(w * ss) + 0.5) / ss
    X, Y = np.meshgrid(xs, ys)
    cx = np.clip(X, x0 + r, x1 - r)
    cy = np.clip(Y, y0 + r, y1 - r)
    inside = ((X - cx) ** 2 + (Y - cy) ** 2 <= r * r) & (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1)
    if ss == 1:
        return inside.astype(np.float32)
    return inside.reshape(h, ss, w, ss).mean((1, 3)).astype(np.float32)


def checkerish(im):
    """Painted checkerboard pixel: (almost) neutral and bright. Slightly tinted in some moods."""
    mx = im.max(-1)
    mn = im.min(-1)
    return ((mx - mn) <= 16) & (mn >= 222)


def checker_pattern(im):
    """Grey pixels that sit in an alternating grey/white grid: a light square is found one
    square (7-11 px) away both horizontally and vertically. Flat watercolour shading inside
    speech bubbles has no such pattern."""
    mx, mn = im.max(-1), im.min(-1)
    light = ((mx - mn) <= 10) & (mn >= 251)
    def near(axis):
        hit = np.zeros_like(light)
        for d in range(7, 12):
            hit |= np.roll(light, d, axis) | np.roll(light, -d, axis)
        return hit
    return near(0) & near(1)


def reach(ok, cx, cy, dx, dy, limit):
    """Steps from (cx, cy) in direction (dx, dy) while `ok` holds; returns the count."""
    h, w = ok.shape
    n = 0
    x, y = cx, cy
    while n < limit:
        x += dx
        y += dy
        if not (0 <= x < w and 0 <= y < h) or not ok[int(round(y)), int(round(x))]:
            break
        n += 1
    return n


def find_slots(im, frame_alpha):
    """Two slots: located by the density of grey checker squares, edges refined by ray scans."""
    mx, mn = im.max(-1), im.min(-1)
    grey = ((mx - mn) <= 16) & (mn >= 226) & (mx <= 249) & frame_alpha
    grey &= checker_pattern(im)
    density = nd.uniform_filter(grey.astype(np.float32), 25)
    blobs, n = nd.label(density > 0.22)
    sizes = nd.sum(np.ones_like(grey), blobs, range(1, n + 1))
    # Checker *texture*: reachable from a grey square through bright pixels within ~half a
    # square. White bubble/cat interiors sit behind their coloured stroke, so they are
    # never reached even though they are as white as the checker's light squares.
    seeds = grey & (density > 0.12)
    ok = nd.binary_dilation(seeds, iterations=CHECKER_REACH, mask=checkerish(im) & frame_alpha)
    ok = nd.binary_closing(ok, iterations=1) & checkerish(im)
    slots = []
    for k in np.argsort(sizes)[::-1][:2]:
        ys, xs = np.nonzero(blobs == k + 1)
        cx, cy = float(np.median(xs)), float(np.median(ys))
        sy = (np.percentile(ys, 5), np.percentile(ys, 95))
        sx = (np.percentile(xs, 5), np.percentile(xs, 95))
        # Ray scans from inside the slot to each side; stickers only shorten rays,
        # so a high percentile finds the true edge (the coloured stroke).
        rows = np.linspace(sy[0] + 0.12 * (sy[1] - sy[0]), sy[1] - 0.12 * (sy[1] - sy[0]), 80)
        cols = np.linspace(sx[0] + 0.12 * (sx[1] - sx[0]), sx[1] - 0.12 * (sx[1] - sx[0]), 80)
        # Start each ray from the checker nearest the centre line (stickers can cover the centre).
        L = np.percentile([cx - reach(ok, cx, y, -1, 0, 300) for y in rows], 4)
        Rr = np.percentile([cx + reach(ok, cx, y, 1, 0, 300) for y in rows], 96) + 1
        T = np.percentile([cy - reach(ok, x, cy, 0, -1, 300) for x in cols], 4)
        B = np.percentile([cy + reach(ok, x, cy, 0, 1, 300) for x in cols], 96) + 1
        x0, x1, y0, y1 = int(round(L)), int(round(Rr)), int(round(T)), int(round(B))
        # Corner radius: best rounded-corner fit against the checker mask in each corner;
        # corners hidden by stickers fit badly and are ignored (two best corners averaged).
        n = 48
        fits = []
        for (px, py, sx, sy) in [(x0, y0, 1, 1), (x1 - 1, y0, -1, 1), (x0, y1 - 1, 1, -1), (x1 - 1, y1 - 1, -1, -1)]:
            yy = py + sy * np.arange(n)
            xx = px + sx * np.arange(n)
            sub = ok[np.ix_(yy, xx)]
            Y, X = np.meshgrid(np.arange(n) + 0.5, np.arange(n) + 0.5, indexing='ij')
            best = None
            for rad in range(0, 46):
                cxr = np.maximum(X, rad)
                cyr = np.maximum(Y, rad)
                pred = (X - cxr) ** 2 + (Y - cyr) ** 2 <= rad * rad
                err = int((pred & ~sub).sum() + (~pred & sub).sum())
                if best is None or err < best[0]:
                    best = (err, rad)
            fits.append(best)
        fits.sort()
        ests = fits
        r = float(np.mean([f[1] for f in fits[:2]]))
        slots.append({'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'r': r, 'region': ok, 'area': int((blobs == k + 1).sum()), 'r_est': ests})
    slots.sort(key=lambda s: s['y0'])
    return slots


def classify_slot(slot, rgb):
    """Returns (hole, keep) masks for one slot.

    keep = sticker artwork overlapping the slot (stroke, white interior, text) plus its white
           outline. A sticker must reach deep into the slot AND contain coloured pixels; a blob
           of plain white is a faint patch of the painted checkerboard, not a sticker.
    hole = everything else inside the slot outline that is near checker texture.
    """
    h, w = rgb.shape[:2]
    ok = slot['region']
    chk = checkerish(rgb)
    inside = rounded_rect_mask(h, w, slot['x0'], slot['y0'], slot['x1'], slot['y1'], slot['r']) > 0.5
    deep = nd.binary_erosion(inside, iterations=8)
    inner = nd.binary_erosion(inside, iterations=3)
    other = inside & ~ok
    lab, n = nd.label(other & inner)
    sticker = np.zeros_like(other)
    faint = np.zeros_like(other)
    for i in range(1, n + 1):
        blob = lab == i
        coloured = int((blob & ~chk).sum())
        if (blob & deep).sum() >= 25 and coloured >= 30:
            sticker |= blob
        elif coloured < 30 and (nd.binary_dilation(blob, iterations=1) & ok).sum() >= 20:
            # Plain white AND directly touching real checker texture → a faint checker patch.
            # White pockets inside a sticker (between letters, on a clipboard) are walled off
            # by the sticker's stroke, so they never touch the checker and stay opaque.
            faint |= blob
    sticker = nd.binary_dilation(sticker, iterations=3, mask=other)          # restore parts near the edge
    whiteish = rgb.min(-1) >= 250
    keep = nd.binary_dilation(sticker, iterations=STICKER_OUTLINE, mask=whiteish | sticker) & inside
    keep = nd.binary_dilation(keep, iterations=1) & inside                    # anti-aliased edge
    texture = nd.binary_dilation(ok | faint, iterations=2)
    hole = inside & ~keep & texture
    # Tidy up: tiny opaque islands floating in the slot (stray light checker squares next to a
    # sticker outline) become transparent; tiny transparent pinholes inside stickers are filled.
    solid = inside & ~hole
    lab, n = nd.label(solid)
    if n:
        area = nd.sum(solid, lab, range(1, n + 1))
        islands = np.isin(lab, [i + 1 for i, a in enumerate(area) if a < 40])
        hole |= islands
        keep &= ~islands
    lab, n = nd.label(hole)
    if n:
        area = nd.sum(hole, lab, range(1, n + 1))
        pin = np.isin(lab, [i + 1 for i, a in enumerate(area) if a < 25])
        hole &= ~pin
    return hole, keep


def nearest_fill(rgb, valid):
    """Replace invalid pixels with the colour of the nearest valid pixel (prevents colour fringes)."""
    _, (iy, ix) = nd.distance_transform_edt(~valid, return_indices=True)
    return rgb[iy, ix]


def main():
    im = load()
    H, W = im.shape[:2]
    bg = background_mask(im)
    fg = ~bg
    fg[TOP_ROW_END:] = False

    # Seam cost: 0 background, 3 neutral white (outline), 40 artwork.
    white = neutral_bright(im) & fg
    cost = np.where(~fg, 0.0, np.where(white, 3.0, 40.0))
    seams = [seam(cost[:TOP_ROW_END], a, b) for a, b in SEAM_BANDS]

    xs = np.arange(W)[None, :]
    rows = np.arange(TOP_ROW_END)
    bounds = [np.zeros(TOP_ROW_END, int)] + seams + [np.full(TOP_ROW_END, W)]

    if DEBUG:
        os.makedirs(DEBUG_DIR, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    report = {}

    for i, mood in enumerate(MOODS):
        left = bounds[i][:, None]
        right = bounds[i + 1][:, None]
        own = np.zeros((H, W), bool)
        own[:TOP_ROW_END] = (xs >= left) & (xs < right)
        mask = fg & own
        # Drop specks (< 12 px) that are noise, keep everything else (small sparkles are artwork).
        lab, n = nd.label(mask)
        sizes = nd.sum(mask, lab, range(1, n + 1))
        mask = np.isin(lab, [j + 1 for j, s in enumerate(sizes) if s >= 12])

        ys_, xs_ = np.nonzero(mask)
        bx0, bx1, by0, by1 = xs_.min(), xs_.max() + 1, ys_.min(), ys_.max() + 1
        cw, ch = CANVAS
        assert bx1 - bx0 <= cw and by1 - by0 <= ch, f'{mood}: {bx1 - bx0}x{by1 - by0} > canvas'
        ox = bx0 - (cw - (bx1 - bx0)) // 2
        oy = by0 - (ch - (by1 - by0)) // 2

        def crop(a, fill=0):
            out = np.full((ch, cw) + a.shape[2:], fill, a.dtype)
            sy0, sx0 = max(oy, 0), max(ox, 0)
            sy1, sx1 = min(oy + ch, H), min(ox + cw, W)
            out[sy0 - oy:sy1 - oy, sx0 - ox:sx1 - ox] = a[sy0:sy1, sx0:sx1]
            return out

        rgb = crop(im)
        alpha = crop(mask, False)

        slots = find_slots(rgb, alpha)
        assert len(slots) == 2, f'{mood}: found {len(slots)} slots'
        holes_native = np.zeros(alpha.shape, bool)
        keep_native = np.zeros(alpha.shape, bool)
        for s in slots:
            hole, keep = classify_slot(s, rgb)
            s['keep'] = keep
            s['hole'] = hole
            holes_native |= hole
            keep_native |= keep

        # Colours: fill hidden/background pixels from neighbours so edges have no grey/cream fringe.
        visible = alpha & ~holes_native
        rgb_f = nearest_fill(rgb, visible)

        # ---- upscale -------------------------------------------------------------------
        S = SCALE
        big = Image.fromarray(np.clip(rgb_f, 0, 255).astype(np.uint8)).resize((cw * S, ch * S), Image.LANCZOS)
        big = big.filter(ImageFilter.UnsharpMask(radius=2.2, percent=70, threshold=2))
        a_outer = Image.fromarray((alpha * 255).astype(np.uint8)).resize((cw * S, ch * S), Image.LANCZOS)
        a_outer = np.asarray(a_outer).astype(np.float32) / 255
        a_outer = np.clip((a_outer - 0.5) * 1.6 + 0.5, 0, 1)   # firm up the silhouette edge

        hole_hr = np.zeros((ch * S, cw * S), np.float32)
        for s in slots:
            rr = rounded_rect_mask(ch * S, cw * S, s['x0'] * S, s['y0'] * S, s['x1'] * S, s['y1'] * S, s['r'] * S, ss=2)
            # Native hole grown by 1 px (but never into stickers) so the crisp analytic outline
            # decides the slot edge; sticker edges come from the upscaled mask.
            grown = nd.binary_dilation(s['hole'], iterations=1) & ~s['keep']
            k = Image.fromarray((grown * 255).astype(np.uint8)).resize((cw * S, ch * S), Image.LANCZOS)
            k = np.clip((np.asarray(k).astype(np.float32) / 255 - 0.5) * 2 + 0.5, 0, 1)
            hole_hr = np.maximum(hole_hr, rr * k)
        a = np.minimum(a_outer, 1 - hole_hr)

        out = np.dstack([np.asarray(big), (a * 255).round().astype(np.uint8)])
        Image.fromarray(out).save(os.path.join(OUT, f'{mood}.png'), optimize=True)

        fw, fh = cw * S, ch * S
        report[mood] = {
            'width': fw,
            'height': fh,
            'slots': [
                {
                    'id': f'photo-{j + 1}',
                    # Photo box (native px → normalised), slightly larger than the hole so the
                    # photo tucks under the frame stroke; the frame PNG covers the bleed.
                    'x': round((s['x0'] - BLEED) / cw, 5),
                    'y': round((s['y0'] - BLEED) / ch, 5),
                    'w': round((s['x1'] - s['x0'] + 2 * BLEED) / cw, 5),
                    'h': round((s['y1'] - s['y0'] + 2 * BLEED) / ch, 5),
                    'radius': round((s['r'] + BLEED) / cw, 5),
                    'holePx': {'x': s['x0'] * S, 'y': s['y0'] * S, 'w': (s['x1'] - s['x0']) * S, 'h': (s['y1'] - s['y0']) * S, 'r': round(s['r'] * S, 1)},
                }
                for j, s in enumerate(slots)
            ],
        }
        print(f"{mood:10s} {fw}x{fh}  " + '  '.join(
            f"slot{j + 1}: x={s['x0'] * S} y={s['y0'] * S} w={(s['x1'] - s['x0']) * S} h={(s['y1'] - s['y0']) * S} r={s['r'] * S:.0f} (checker px={s['area']}, fits(err,r)={s['r_est']})"
            for j, s in enumerate(slots)))

        if DEBUG:
            dbg = rgb.copy()
            dbg[holes_native] = [255, 0, 255]
            dbg[keep_native] = dbg[keep_native] * 0.5 + np.array([0, 255, 0]) * 0.5
            dbg[~alpha] = [40, 40, 40]
            Image.fromarray(dbg.astype(np.uint8)).resize((cw * 2, ch * 2), Image.NEAREST).save(os.path.join(DEBUG_DIR, f'{mood}-mask.png'))

    with open(SLOTS_JSON, 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(f'wrote {SLOTS_JSON}')


if __name__ == '__main__':
    main()
