// Applies a CSS-style filter chain (grayscale, sepia, saturate, hue-rotate, contrast,
// brightness) to an image's pixels in JavaScript.
//
// Why not ctx.filter / CSS filter? `CanvasRenderingContext2D.filter` is not reliably
// available in Safari (iPhone), so the exported photo would keep the original colours
// there while other screens look blue. Baking the filter into one image here gives the
// SAME pixels on every screen (intro, camera, preview, export) and every browser.
// The maths follows the Filter Effects spec colour matrices, in sRGB like browsers do.

type Matrix = number[] // 3×4 row-major: [r…, g…, b…] with an offset column (0–255 scale)

const identity = (): Matrix => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]

function step(name: string, raw: number): Matrix {
  switch (name) {
    case 'grayscale': {
      const a = 1 - Math.min(1, raw)
      return [
        0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a, 0,
        0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a, 0,
        0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a, 0,
      ]
    }
    case 'sepia': {
      const a = 1 - Math.min(1, raw)
      return [
        0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0,
        0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0,
        0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0,
      ]
    }
    case 'saturate': {
      const s = raw
      return [
        0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0,
      ]
    }
    case 'hue-rotate': {
      const r = (raw * Math.PI) / 180
      const c = Math.cos(r)
      const s = Math.sin(r)
      return [
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0,
      ]
    }
    case 'contrast': {
      const off = (0.5 - 0.5 * raw) * 255
      return [raw, 0, 0, off, 0, raw, 0, off, 0, 0, raw, off]
    }
    case 'brightness':
      return [raw, 0, 0, 0, 0, raw, 0, 0, 0, 0, raw, 0]
    default:
      return identity()
  }
}

/** Parses e.g. "grayscale(1) hue-rotate(165deg) saturate(2.1)" into colour-matrix steps. */
export function parseFilter(filter: string): Matrix[] {
  const out: Matrix[] = []
  for (const m of filter.matchAll(/([a-z-]+)\(\s*(-?[\d.]+)\s*(deg|%)?\s*\)/g)) {
    const value = m[3] === '%' ? Number(m[2]) / 100 : Number(m[2])
    out.push(step(m[1], value))
  }
  return out
}

/**
 * Applies the steps to RGBA pixels in place. Each CSS filter function is a separate
 * primitive, so values are clamped to 0–255 after every step (as browsers do).
 */
export function applyFilter(data: Uint8ClampedArray, steps: Matrix[]) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue // fully transparent: colour is invisible
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]
    for (const m of steps) {
      const nr = m[0] * r + m[1] * g + m[2] * b + m[3]
      const ng = m[4] * r + m[5] * g + m[6] * b + m[7]
      const nb = m[8] * r + m[9] * g + m[10] * b + m[11]
      r = nr < 0 ? 0 : nr > 255 ? 255 : nr
      g = ng < 0 ? 0 : ng > 255 ? 255 : ng
      b = nb < 0 ? 0 : nb > 255 ? 255 : nb
    }
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
}

/** Returns a new image (blob URL) with the filter baked in. Empty filter → the original. */
export async function filteredImage(img: HTMLImageElement, filter: string): Promise<HTMLImageElement> {
  const steps = parseFilter(filter)
  if (!steps.length) return img
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return img
  ctx.drawImage(img, 0, 0)
  const px = ctx.getImageData(0, 0, c.width, c.height)
  applyFilter(px.data, steps)
  ctx.putImageData(px, 0, 0)
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
  c.width = c.height = 0
  if (!blob) return img
  const out = new Image()
  out.decoding = 'async'
  out.src = URL.createObjectURL(blob)
  await out.decode()
  return out
}
