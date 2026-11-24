// Final export, saving and printing. Save logic adapted from NadheWedd
// FrameStudio.save() (Web Share with a file, else <a download>).
import { OUTPUT, PRINT, outputSize, type FrameConfig } from '../config/frames'
import { render, type Placement, type PhotoSource } from './render'

export interface FinalPhoto {
  blob: Blob
  url: string
  fileName: string
  width: number
  height: number
}

const pad = (n: number) => String(n).padStart(2, '0')

export function fileName(frame: FrameConfig, date = new Date()) {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  const ext = OUTPUT.mime === 'image/png' ? 'png' : 'jpg'
  return `${OUTPUT.filePrefix}-${frame.id}-${stamp}.${ext}`
}

/** Renders the full-resolution image (independent of the preview size) with every slot filled, and encodes it. */
export async function exportPhoto(frame: FrameConfig, frameImg: HTMLImageElement, photos: PhotoSource[], placements: Placement[]): Promise<FinalPhoto> {
  if (photos.length < frame.photoSlots.length) throw new Error('MISSING_PHOTO')
  const { w, h } = outputSize(frame)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('CANVAS')
  render(ctx, w, h, frame, frameImg, photos, placements)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, OUTPUT.mime, OUTPUT.quality))
  canvas.width = canvas.height = 0 // free memory early on low-end phones
  if (!blob) throw new Error('EXPORT')
  return { blob, url: URL.createObjectURL(blob), fileName: fileName(frame), width: w, height: h }
}

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

function shareFile(photo: FinalPhoto) {
  return new File([photo.blob], photo.fileName, { type: photo.blob.type })
}

export const canShareFile = (photo: FinalPhoto) => !!navigator.canShare?.({ files: [shareFile(photo)] })

/** Opens the system share sheet (iPhone: "Simpan Gambar" puts it in Photos). Returns false if unavailable. */
export async function sharePhoto(photo: FinalPhoto): Promise<boolean> {
  const file = shareFile(photo)
  if (!navigator.canShare?.({ files: [file] })) return false
  try {
    await navigator.share({ files: [file], title: 'MyPhotobooth' })
  } catch {
    /* visitor closed the sheet */
  }
  return true
}

/** Plain file download (Android: lands in Downloads, which Google Photos/Gallery shows). */
export function downloadPhoto(photo: FinalPhoto) {
  const a = document.createElement('a')
  a.href = photo.url
  a.download = photo.fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * "Simpan": iPhone gets the share sheet (the only way into the Photos app);
 * everyone else gets a direct download.
 */
export async function savePhoto(photo: FinalPhoto) {
  if (isIOS() && (await sharePhoto(photo))) return
  downloadPhoto(photo)
}

/** Opens the print dialog with the photo fitted on a 4R (PRINT) page, orientation following the photo. */
export function printPhoto(photo: FinalPhoto) {
  const landscape = photo.width > photo.height
  const pw = landscape ? PRINT.heightMm : PRINT.widthMm
  const ph = landscape ? PRINT.widthMm : PRINT.heightMm
  let style = document.getElementById('print-page-size') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'print-page-size'
    document.head.appendChild(style)
  }
  style.textContent = `@page { size: ${pw}mm ${ph}mm; margin: 0; }
@media print { .print-sheet { width: ${pw}mm; height: ${ph}mm; padding: ${PRINT.marginMm}mm; box-sizing: border-box; } }`
  window.print()
}
