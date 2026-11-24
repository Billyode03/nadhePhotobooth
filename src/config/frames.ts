// ============================================================================
//  MyPhotobooth — mood catalogue (the ONLY file to edit for moods/frames).
//
//  Every physical mood card has a QR code pointing at  /booth/<id>.
//  Frames come from src/assets/mood_frame.png, extracted by
//  scripts/extract-frames.py (see docs/frame-extraction.json for raw measurements).
//
//  This file must stay free of DOM APIs: scripts/test-frames.ts imports it in Node.
// ============================================================================

/**
 * One photo window in FRAME PIXELS (top-left origin of the frame PNG).
 * The box is the transparent hole plus a small bleed under the frame's stroke; the photo
 * is scaled to *cover* it (never stretched) and clipped to its rounded corners.
 */
export interface PhotoSlot {
  id: string
  x: number
  y: number
  width: number
  height: number
  /** Corner radius in frame pixels. */
  radius: number
}

export interface MoodColors {
  /** Title colour of the mood (buttons, QR card title/pill). */
  primary: string
  /** Pastel background of the frame. */
  soft: string
  /** Second tone for card decorations. */
  accent: string
}

export interface FrameConfig {
  /** URL slug used by the QR code: /booth/<id>. Lowercase letters, digits and dashes. */
  id: string
  /** Mood name shown to the visitor. */
  name: string
  /** Printed card label, e.g. "Card 01". */
  card?: string
  /** Positive line from the frame design. */
  tagline?: string
  /** Transparent PNG in public/ (path starts with "/"). */
  frame: string
  /** Pixel size of the frame PNG; slot coordinates are in this space. */
  frameWidth: number
  frameHeight: number
  /** Final image size. Same ratio as the PNG (defaults to the PNG size). */
  outputWidth?: number
  outputHeight?: number
  /** Photo windows, top to bottom. Photo 1 goes in photoSlots[0], photo 2 in photoSlots[1]. */
  photoSlots: PhotoSlot[]
  colors: MoodColors
  /** Old slugs that should still open this mood (e.g. after renaming). */
  aliases?: string[]
  /** false = QR shows "kartu tidak aktif" instead of the booth. */
  enabled: boolean
}

/** Public production URL encoded into the QR cards. Never localhost. */
export const SITE = {
  /** Set VITE_PUBLIC_BASE_URL at build time (Vercel env), e.g. https://photobooth.example.com */
  publicUrl: '',
}

/** Visual theme applied to the frame artwork. */
export const THEME = {
  /**
   * CSS-style filter baked into every frame (preview AND saved photo), so the original mood
   * illustrations follow the blue-and-white MyPhotobooth look. Set to '' for original colours.
   * Supported: grayscale, sepia, saturate, hue-rotate, contrast, brightness.
   */
  frameFilter: 'grayscale(1) contrast(1.06) sepia(1) hue-rotate(165deg) saturate(2.1) brightness(1.08)',
}

/** Global output settings. */
export const OUTPUT = {
  /** 'image/jpeg' (smaller, best for printing photos) or 'image/png' (lossless, much larger). */
  mime: 'image/jpeg' as 'image/jpeg' | 'image/png',
  /** JPEG quality 0–1. */
  quality: 0.95,
  /** Colour behind the photos where neither photo nor frame covers (outside the frame silhouette). */
  background: '#ffffff',
  /** Save front-camera photos mirrored, exactly as the visitor saw them on screen. */
  mirrorFrontCamera: true,
  /** File name prefix: MyPhotobooth-happy-20261124-153012.jpg */
  filePrefix: 'MyPhotobooth',
}

/** Print sheet for the browser's print dialog: 4R = 10 × 15 cm. The strip is fitted, never cropped. */
export const PRINT = {
  widthMm: 100,
  heightMm: 150,
  /** White border around the photo on paper. 0 = borderless (if the printer supports it). */
  marginMm: 0,
}

/** Printed QR card size (the reference card ratio is ~0.77). */
export const CARD = {
  widthMm: 85,
  heightMm: 110,
  dpi: 300,
}

/** Booth behaviour. */
export const BOOTH = {
  /** Countdown before each shot: 3 → 2 → 1. */
  countdownSeconds: 3,
}

/** Upload limits for "Pilih dari Galeri". */
export const UPLOAD = {
  maxBytes: 25 * 1024 * 1024,
  /** Decoded photos are capped to this long edge to protect phone memory (still > 2× the output). */
  maxDecodeEdge: 4096,
}

// ---------------------------------------------------------------------------
//  Moods. Slot boxes were measured per frame (they are NOT identical: stickers
//  such as Tired's cat cover different parts of each slot). Values = hole from
//  docs/frame-extraction.json grown by 12 px of bleed on every side.
// ---------------------------------------------------------------------------
const W = 1288
const H = 2320

export const FRAMES: FrameConfig[] = [
  {
    id: 'happy',
    name: 'Happy',
    card: 'Card 01',
    tagline: 'You deserve every little happiness.',
    frame: '/frames/happy.png',
    frameWidth: W,
    frameHeight: H,
    photoSlots: [
      { id: 'photo-1', x: 268, y: 476, width: 840, height: 608, radius: 162 },
      { id: 'photo-2', x: 268, y: 1148, width: 840, height: 624, radius: 176 },
    ],
    colors: { primary: '#155eef', soft: '#eaf3ff', accent: '#74b9ff' },
    enabled: true,
  },
  {
    id: 'sad',
    name: 'Sad',
    card: 'Card 02',
    tagline: "It's okay not to be okay.",
    frame: '/frames/sad.png',
    frameWidth: W,
    frameHeight: H,
    photoSlots: [
      { id: 'photo-1', x: 228, y: 444, width: 828, height: 604, radius: 176 },
      { id: 'photo-2', x: 240, y: 1112, width: 816, height: 624, radius: 160 },
    ],
    colors: { primary: '#246bce', soft: '#e8f2ff', accent: '#8dc2ff' },
    enabled: true,
  },
  {
    id: 'tired',
    name: 'Tired',
    card: 'Card 03',
    tagline: 'Resting is not giving up.',
    frame: '/frames/tired.png',
    frameWidth: W,
    frameHeight: H,
    photoSlots: [
      // Narrower on purpose: the cat and the "Rest Well" bubble cover the left part.
      { id: 'photo-1', x: 384, y: 460, width: 704, height: 608, radius: 176 },
      { id: 'photo-2', x: 240, y: 1132, width: 844, height: 624, radius: 174 },
    ],
    colors: { primary: '#0b56c3', soft: '#e4f0ff', accent: '#65aaf7' },
    enabled: true,
  },
  {
    id: 'anxious',
    name: 'Anxious',
    card: 'Card 04',
    tagline: 'Take a breath, one step at a time.',
    frame: '/frames/anxious.png',
    frameWidth: W,
    frameHeight: H,
    photoSlots: [
      { id: 'photo-1', x: 244, y: 464, width: 840, height: 604, radius: 178 },
      { id: 'photo-2', x: 244, y: 1132, width: 840, height: 628, radius: 178 },
    ],
    colors: { primary: '#1479dc', soft: '#e6f4ff', accent: '#77bfff' },
    enabled: true,
  },
  {
    id: 'confident',
    name: 'Confident',
    card: 'Card 05',
    tagline: 'You are enough, just as you are.',
    frame: '/frames/confident.png',
    frameWidth: W,
    frameHeight: H,
    photoSlots: [
      { id: 'photo-1', x: 240, y: 464, width: 844, height: 608, radius: 182 },
      { id: 'photo-2', x: 236, y: 1136, width: 844, height: 624, radius: 174 },
    ],
    colors: { primary: '#174db8', soft: '#e9f1ff', accent: '#9bc9ff' },
    enabled: true,
  },
]

const normalise = (slug: string) => slug.trim().toLowerCase().replace(/\/+$/, '')

export type FrameLookup =
  | { status: 'ok'; frame: FrameConfig }
  | { status: 'disabled'; frame: FrameConfig }
  | { status: 'unknown'; slug: string }

/** Resolves a QR slug (id or alias, case-insensitive) to a mood. */
export function findFrame(slug: string, frames: FrameConfig[] = FRAMES): FrameLookup {
  const s = normalise(slug)
  const frame = frames.find((f) => f.id === s || f.aliases?.some((a) => normalise(a) === s))
  if (!frame) return { status: 'unknown', slug }
  return frame.enabled ? { status: 'ok', frame } : { status: 'disabled', frame }
}

/** Output size in px: explicit size, else the frame PNG's own size. The ratio is never changed. */
export function outputSize(frame: FrameConfig) {
  if (frame.outputWidth && frame.outputHeight) return { w: frame.outputWidth, h: frame.outputHeight }
  return { w: frame.frameWidth, h: frame.frameHeight }
}

/** Public URL encoded into the card's QR code. */
export function boothUrl(origin: string, frame: Pick<FrameConfig, 'id'>) {
  return `${origin.replace(/\/+$/, '')}/booth/${frame.id}`
}

/** True when a URL is usable inside a printed QR: https and not a local/private address. */
export function isPublicUrl(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/.test(u.hostname) && !u.hostname.endsWith('.local')
  } catch {
    return false
  }
}
