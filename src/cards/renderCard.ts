// QR mood card, rebuilt (not cropped) after the reference design: pastel card with a
// white sticker border, "Pick Your Mood", the mood title, the mood icon, a REAL QR code
// generated with uqr (the same library NadheWedd uses) and a "Scan di sini!" pill.
// Drawn on a canvas at print resolution, so the preview IS the downloaded file.
import { encode } from 'uqr'
import { boothUrl, CARD, type FrameConfig } from '../config/frames'
import { heart, MOOD_ICONS, sparkle, svgDoc, svgImage } from './icons'

export const CARD_PX = {
  w: Math.round((CARD.widthMm / 25.4) * CARD.dpi),
  h: Math.round((CARD.heightMm / 25.4) * CARD.dpi),
}

/** QR settings: ECC "Q" (~25% damage tolerance) and the standard 4-module quiet zone. */
export const QR_ECC = 'Q' as const
export const QR_QUIET = 4

const FONT = 'Fredoka'

export async function loadCardFonts() {
  if (!document.fonts?.load) return
  await Promise.allSettled([document.fonts.load(`700 100px "${FONT}"`), document.fonts.load(`600 60px "${FONT}"`)])
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Deterministic pseudo-random numbers so a card always renders identically. */
function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

export interface CardResult {
  canvas: HTMLCanvasElement
  url: string
  /** QR geometry, for tests: modules per side (incl. quiet zone) and module size in px. */
  qr: { modules: number; modulePx: number; x: number; y: number; size: number }
}

export async function renderCard(frame: FrameConfig, baseUrl: string): Promise<CardResult> {
  await loadCardFonts()
  const { w: W, h: H } = CARD_PX
  const c = frame.colors
  const url = boothUrl(baseUrl, frame)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  const rand = rng(frame.id)

  // 1. Card body: white sticker border, pastel gradient, watercolour blobs, clouds.
  const R = W * 0.09
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, 0, 0, W, H, R)
  ctx.fill()
  const inset = W * 0.022
  ctx.save()
  roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, R - inset)
  ctx.clip()
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, c.soft)
  g.addColorStop(0.55, mix(c.soft, '#ffffff', 0.35))
  g.addColorStop(1, c.soft)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.18 + rand() * 0.15
    ctx.fillStyle = rand() > 0.5 ? '#ffffff' : c.accent
    ctx.beginPath()
    ctx.ellipse(rand() * W, rand() * H, W * (0.08 + rand() * 0.14), W * (0.05 + rand() * 0.08), rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 9; i++) {
    const x = (i / 8) * W
    ctx.beginPath()
    ctx.arc(x + (rand() - 0.5) * 40, H - W * 0.02, W * (0.07 + rand() * 0.05), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  ctx.lineWidth = W * 0.006
  ctx.strokeStyle = withAlpha(c.primary, 0.35)
  roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, R - inset)
  ctx.stroke()

  // 2. Header: mood icon (left), "Pick Your Mood" + title.
  const icon = await svgImage(svgDoc(MOOD_ICONS[frame.id] ?? MOOD_ICONS.happy))
  const iconSize = W * 0.27
  ctx.drawImage(icon, W * 0.045, H * 0.03, iconSize, iconSize)
  const textX = W * 0.32
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = `600 ${Math.round(W * 0.042)}px "${FONT}", system-ui, sans-serif`
  ctx.fillStyle = '#23305e'
  ctx.fillText('Pick Your Mood', textX + W * 0.07, H * 0.085)
  drawCamera(ctx, textX + W * 0.01, H * 0.058, W * 0.048)
  let size = W * 0.15
  ctx.font = `700 ${Math.round(size)}px "${FONT}", system-ui, sans-serif`
  const maxW = W * 0.95 - textX
  const tw = ctx.measureText(frame.name).width
  if (tw > maxW) size *= maxW / tw
  ctx.font = `700 ${Math.round(size)}px "${FONT}", system-ui, sans-serif`
  const ty = H * 0.205
  ctx.lineJoin = 'round'
  ctx.shadowColor = 'rgba(60, 30, 40, 0.18)'
  ctx.shadowOffsetY = W * 0.006
  ctx.shadowBlur = W * 0.01
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = size * 0.16
  ctx.strokeText(frame.name, textX, ty)
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = c.primary
  ctx.fillText(frame.name, textX, ty)

  // 3. QR on a white panel. Never covered by ornaments.
  const qr = encode(url, { ecc: QR_ECC, border: QR_QUIET })
  const n = qr.data.length
  const panel = Math.round(W * 0.6)
  const px = Math.floor(panel / n)
  const qrSize = px * n
  const panelX = Math.round((W - panel) / 2)
  const panelY = Math.round(H * 0.26)
  ctx.shadowColor = 'rgba(60, 30, 40, 0.16)'
  ctx.shadowBlur = W * 0.02
  ctx.shadowOffsetY = W * 0.006
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, panelX, panelY, panel, panel, W * 0.04)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  const qx = panelX + Math.floor((panel - qrSize) / 2)
  const qy = panelY + Math.floor((panel - qrSize) / 2)
  ctx.fillStyle = '#000000'
  qr.data.forEach((row, y) => row.forEach((on, x) => on && ctx.fillRect(qx + x * px, qy + y * px, px, px)))

  // 4. "Scan di sini!" pill.
  const pillW = W * 0.6
  const pillH = W * 0.11
  const pillX = (W - pillW) / 2
  const pillY = panelY + panel + H * 0.035
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, pillX - 8, pillY - 8, pillW + 16, pillH + 16, (pillH + 16) / 2)
  ctx.fill()
  ctx.fillStyle = c.primary
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2)
  ctx.fill()
  ctx.font = `600 ${Math.round(pillH * 0.5)}px "${FONT}", system-ui, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const label = 'Scan di sini!'
  const lw = ctx.measureText(label).width
  const heartSize = pillH * 0.42
  ctx.fillText(label, W / 2 - heartSize * 0.6, pillY + pillH / 2 + pillH * 0.03)
  const heartImg = await svgImage(svgDoc(heart('#ffffff'), false))
  ctx.drawImage(heartImg, W / 2 + lw / 2 - heartSize * 0.2, pillY + (pillH - heartSize) / 2 - heartSize * 0.05, heartSize, heartSize)

  // 5. Small fallback address under the pill.
  ctx.font = `500 ${Math.round(W * 0.026)}px "${FONT}", system-ui, sans-serif`
  ctx.fillStyle = withAlpha(c.primary, 0.85)
  ctx.fillText(url.replace(/^https?:\/\//, ''), W / 2, pillY + pillH + H * 0.04)

  // 6. Ornaments in the side margins only (outside the QR panel + quiet zone).
  const spark = await svgImage(svgDoc(sparkle(c.accent), false))
  const spark2 = await svgImage(svgDoc(sparkle('#ffc531'), false))
  const heartC = await svgImage(svgDoc(heart(c.primary), false))
  const side = (panelX - W * 0.03) / 2
  const orn: [HTMLImageElement, number, number, number][] = [
    [spark, side, panelY + panel * 0.12, W * 0.07],
    [spark2, W - side, panelY + panel * 0.3, W * 0.06],
    [heartC, side + W * 0.01, panelY + panel * 0.72, W * 0.065],
    [spark, W - side, panelY + panel * 0.8, W * 0.075],
    [spark2, side - W * 0.01, panelY + panel * 0.45, W * 0.04],
  ]
  for (const [img, cx, cy, s] of orn) ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s)

  return { canvas, url, qr: { modules: n, modulePx: px, x: qx, y: qy, size: qrSize } }
}

function drawCamera(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save()
  ctx.fillStyle = '#23305e'
  roundRect(ctx, x, y - s * 0.55, s, s * 0.75, s * 0.16)
  ctx.fill()
  ctx.fillRect(x + s * 0.3, y - s * 0.7, s * 0.4, s * 0.2)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x + s / 2, y - s * 0.18, s * 0.24, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#23305e'
  ctx.beginPath()
  ctx.arc(x + s / 2, y - s * 0.18, s * 0.14, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function hex(c: string) {
  const v = c.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16))
}
function withAlpha(c: string, a: number) {
  const [r, g, b] = hex(c)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
function mix(a: string, b: string, t: number) {
  const x = hex(a)
  const y = hex(b)
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(', ')})`
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('EXPORT'))), type))
}
