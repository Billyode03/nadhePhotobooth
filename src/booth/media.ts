// Image loading/decoding helpers. loadFrameImage comes from NadheWedd
// src/album/studio/frames.ts; decodeFile from src/album/compress.ts (EXIF
// orientation applied by the decoder, size/format validation), minus the
// re-compression: uploaded photos keep their quality until the final export.
import { OUTPUT, UPLOAD } from '../config/frames'
import type { PhotoSource } from './render'

const images = new Map<string, Promise<HTMLImageElement>>()

/** Loads (and caches) a frame PNG. */
export function loadFrameImage(path: string): Promise<HTMLImageElement> {
  let p = images.get(path)
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = () => {
        images.delete(path)
        reject(new Error('FRAME_IMAGE'))
      }
      img.src = path
    })
    images.set(path, p)
  }
  return p
}

export type PhotoErrorCode = 'UNSUPPORTED' | 'TOO_LARGE' | 'FAILED'

export class PhotoError extends Error {
  code: PhotoErrorCode
  constructor(code: PhotoErrorCode) {
    super(code)
    this.code = code
  }
}

export const PHOTO_ERROR_TEXT: Record<PhotoErrorCode, string> = {
  UNSUPPORTED: 'Format foto tidak didukung. Pilih foto JPG, PNG, atau WEBP.',
  TOO_LARGE: `Ukuran foto terlalu besar (maks. ${Math.round(UPLOAD.maxBytes / 1024 / 1024)} MB).`,
  FAILED: 'Foto tidak bisa dibuka. Coba pilih foto lain.',
}

/** A decoded photo plus a way to free its memory. */
export type OwnedPhoto = PhotoSource & { release: () => void }

/** Validates and decodes a gallery photo, applying EXIF rotation. */
export async function decodeFile(file: File): Promise<OwnedPhoto> {
  if (file.size > UPLOAD.maxBytes) throw new PhotoError('TOO_LARGE')
  if (file.type && !file.type.startsWith('image/')) throw new PhotoError('UNSUPPORTED')

  let src: ImageBitmap | HTMLImageElement
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // <img> decodes more formats in some browsers (e.g. HEIC on Safari).
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      await img.decode()
      src = img
    } catch {
      throw new PhotoError('UNSUPPORTED')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width
  const h = src instanceof HTMLImageElement ? src.naturalHeight : src.height
  if (!w || !h) throw new PhotoError('UNSUPPORTED')

  // Only shrink very large photos (memory safety on phones); never upscale.
  const k = Math.min(1, UPLOAD.maxDecodeEdge / Math.max(w, h))
  if (k === 1) return { image: src, width: w, height: h, release: () => 'close' in src && src.close() }
  const canvas = toCanvas(src, w, h, k, false)
  if ('close' in src) src.close()
  return { image: canvas, width: canvas.width, height: canvas.height, release: () => (canvas.width = canvas.height = 0) }
}

/** Grabs the current camera frame at full stream resolution (mirrored for the front camera). */
export function captureVideo(video: HTMLVideoElement, mirror = OUTPUT.mirrorFrontCamera): OwnedPhoto {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) throw new PhotoError('FAILED')
  const canvas = toCanvas(video, w, h, 1, mirror)
  return { image: canvas, width: w, height: h, release: () => (canvas.width = canvas.height = 0) }
}

function toCanvas(src: CanvasImageSource, w: number, h: number, scale: number, mirror: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoError('FAILED')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (mirror) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
  return canvas
}
