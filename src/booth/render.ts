// Photo + frame compositing. Adapted from NadheWedd src/album/studio/render.ts:
// the same function draws the on-screen preview and the full-size export, so what
// the visitor approves is exactly what gets saved/printed.
//
// Layers (bottom → top): photo 1 in slot 1, photo 2 in slot 2, frame PNG.
import { OUTPUT, type FrameConfig, type PhotoSlot } from '../config/frames'

/** Keeps every existing mood illustration in the blue-and-white MyPhotobooth visual system. */
export const FRAME_FILTER = 'grayscale(1) contrast(1.06) sepia(1) hue-rotate(165deg) saturate(2.1) brightness(1.08)'

export interface PhotoSource {
  image: CanvasImageSource
  width: number
  height: number
}

/** Photo placement inside its slot: zoom ≥ 1 (1 = just covers), x/y in −1…1 across the overflow. */
export interface Placement {
  zoom: number
  x: number
  y: number
}

export const CENTERED: Placement = { zoom: 1, x: 0, y: 0 }

/** A slot box in canvas pixels for a W×H canvas (frame coordinates scaled). */
export function slotRect(frame: FrameConfig, slot: PhotoSlot, W: number, H: number) {
  const sx = W / frame.frameWidth
  const sy = H / frame.frameHeight
  return { x: slot.x * sx, y: slot.y * sy, w: slot.width * sx, h: slot.height * sy, r: slot.radius * Math.min(sx, sy) }
}

/** Size and top-left (relative to the slot centre) of the photo covering a w×h box. Verbatim from NadheWedd. */
export function coverRect(photo: { width: number; height: number }, w: number, h: number, p: Placement) {
  const scale = Math.max(w / photo.width, h / photo.height) * Math.max(1, p.zoom)
  const dw = photo.width * scale
  const dh = photo.height * scale
  const ox = dw - w
  const oy = dh - h
  return { dw, dh, ox, oy, left: -w / 2 - (ox * (1 + clamp1(p.x))) / 2, top: -h / 2 - (oy * (1 + clamp1(p.y))) / 2 }
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export interface RenderOptions {
  /** Draw the frame PNG on top (false for the live-camera underlay). */
  frame?: boolean
  /** Preview only: draw a numbered placeholder in empty slots. */
  placeholders?: boolean
  /** Preview only: highlight this slot (the one being taken/edited). */
  highlight?: number
  /** Fill the canvas with OUTPUT.background first (false = keep it transparent outside the slots). */
  background?: boolean
}

/**
 * Draws the composite onto a W×H canvas whose ratio matches the frame.
 * `photos[i]` goes into `frame.photoSlots[i]`; null photos leave the slot empty.
 */
export function render(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  frame: FrameConfig,
  frameImg: HTMLImageElement | null,
  photos: (PhotoSource | null)[],
  placements: Placement[],
  opts: RenderOptions = {},
) {
  const { frame: drawFrame = true, placeholders = false, highlight, background = true } = opts
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, W, H)
  if (background) {
    ctx.fillStyle = OUTPUT.background
    ctx.fillRect(0, 0, W, H)
  }

  frame.photoSlots.forEach((slot, i) => {
    const r = slotRect(frame, slot, W, H)
    const photo = photos[i]
    ctx.save()
    roundRect(ctx, r.x, r.y, r.w, r.h, r.r)
    ctx.clip() // a photo can never leave its slot
    if (photo) {
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2)
      const c = coverRect(photo, r.w, r.h, placements[i] ?? CENTERED)
      ctx.drawImage(photo.image, c.left, c.top, c.dw, c.dh)
    } else if (placeholders) {
      ctx.fillStyle = highlight === i ? frame.colors.soft : '#f3f0ec'
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.fillStyle = highlight === i ? frame.colors.primary : '#b9b0a6'
      ctx.font = `600 ${Math.round(r.h * 0.12)}px Poppins, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`Foto ${i + 1}`, r.x + r.w / 2, r.y + r.h * 0.62)
    }
    ctx.restore()
  })

  if (drawFrame && frameImg) {
    ctx.filter = FRAME_FILTER
    ctx.drawImage(frameImg, 0, 0, W, H)
    ctx.filter = 'none'
  }
  ctx.restore()
}
