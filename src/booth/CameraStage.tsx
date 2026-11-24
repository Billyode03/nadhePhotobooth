import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BOOTH, OUTPUT, outputSize, type FrameConfig } from '../config/frames'
import { Button } from '../components/ui/Button'
import { AlertIcon, CloseIcon, ImageIcon, RefreshIcon } from '../components/ui/Icons'
import { useFitBox } from '../lib/useFitBox'
import { captureVideo, type OwnedPhoto } from './media'
import { render, type Placement, type PhotoSource } from './render'
import { CAMERA_ERROR_TEXT, useCamera } from './useCamera'

interface Props {
  frame: FrameConfig
  /** Themed frame image URL (same pixels as the export). */
  frameSrc: string
  /** Slot being photographed (0 = top). */
  slot: number
  photos: (PhotoSource | null)[]
  placements: Placement[]
  onCapture: (photo: OwnedPhoto) => void
  onPickFile: () => void
  onClose: () => void
}

const pct = (v: number) => `${(v * 100).toFixed(4)}%`

/**
 * Live preview: the <video> sits exactly in the current slot (object-fit: cover, centred,
 * same rounded corners — the same maths as coverRect with the default placement), photos
 * already taken show in the other slots, and the frame PNG is on top. The captured photo
 * therefore lands where the visitor saw it.
 */
export function CameraStage({ frame, frameSrc, slot, photos, placements, onCapture, onPickFile, onClose }: Props) {
  const { videoRef, status, error, retry } = useCamera(true)
  const out = outputSize(frame)
  const { ref: fitRef, w: fitW, h: fitH } = useFitBox(out.w / out.h)
  const underlay = useRef<HTMLCanvasElement>(null)
  const [count, setCount] = useState<number | null>(null)
  const [flash, setFlash] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const statusRef = useRef(status)

  const s = frame.photoSlots[slot]
  const box = { x: s.x / frame.frameWidth, y: s.y / frame.frameHeight, w: s.width / frame.frameWidth, h: s.height / frame.frameHeight }
  const radius = `${pct(s.radius / s.width)} / ${pct(s.radius / s.height)}`
  const total = frame.photoSlots.length

  useEffect(() => {
    statusRef.current = status
  }, [status])
  useEffect(() => () => window.clearInterval(timer.current), [])

  // Other slots' photos (no frame: the frame <img> is the top layer).
  useLayoutEffect(() => {
    const c = underlay.current
    if (!c || !fitW) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.round(fitW * dpr)
    c.height = Math.round(fitH * dpr)
    const others = photos.map((p, i) => (i === slot ? null : p))
    render(c.getContext('2d')!, c.width, c.height, frame, null, others, placements, { frame: false, placeholders: true, background: false })
  }, [fitW, fitH, frame, photos, placements, slot])

  const shoot = () => {
    const video = videoRef.current
    if (!video) return
    try {
      const photo = captureVideo(video)
      setFlash(true)
      navigator.vibrate?.(40)
      window.setTimeout(() => onCapture(photo), 180)
    } catch {
      retry()
    }
  }

  const start = () => {
    if (status !== 'ready' || count !== null) return
    let n = BOOTH.countdownSeconds
    if (n <= 0) return shoot()
    setCount(n)
    timer.current = window.setInterval(() => {
      n -= 1
      if (statusRef.current !== 'ready') {
        window.clearInterval(timer.current)
        setCount(null)
      } else if (n > 0) setCount(n)
      else {
        window.clearInterval(timer.current)
        setCount(null)
        shoot()
      }
    }, 1000)
  }

  const err = error ? CAMERA_ERROR_TEXT[error] : null

  return (
    <div className="fixed inset-0 flex flex-col bg-night text-ivory">
      <header className="safe-top flex items-center justify-between px-3 pb-2">
        <button type="button" onClick={onClose} aria-label="Kembali" className="grid size-12 place-items-center rounded-full hover:bg-ivory/10">
          <CloseIcon size={24} />
        </button>
        <div className="text-center">
          <p className="eyebrow" style={{ color: frame.colors.soft }}>{frame.name}</p>
          <p className="text-lg leading-tight font-semibold">
            Foto {slot + 1} <span className="font-normal text-ivory/60">dari {total}</span>
          </p>
        </div>
        <div className="size-12" aria-hidden="true" />
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={fitRef} className="absolute inset-x-3 inset-y-0 grid place-items-center">
          <div className="relative" style={{ width: fitW, height: fitH }}>
            <canvas ref={underlay} className="absolute inset-0 h-full w-full" />
            <div className="absolute overflow-hidden bg-black" style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h), borderRadius: radius }}>
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="h-full w-full object-cover"
                style={{ transform: OUTPUT.mirrorFrontCamera ? 'scaleX(-1)' : undefined }}
              />
              {status === 'starting' && (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="size-8 animate-spin rounded-full border-2 border-ivory/30 border-t-ivory" />
                </div>
              )}
              {count !== null && (
                <div className="absolute inset-0 grid place-items-center bg-black/10" aria-live="assertive">
                  <span key={count} className="count-pop text-[5.5rem] leading-none font-semibold text-white drop-shadow-[0_4px_18px_rgb(0_0_0/0.55)]">
                    {count}
                  </span>
                </div>
              )}
              {flash && <div className="flash pointer-events-none absolute inset-0 bg-white" />}
            </div>
            <img src={frameSrc} alt="" data-testid="camera-frame" className="pointer-events-none absolute inset-0 h-full w-full" />
          </div>
        </div>

        {status === 'starting' && (
          <p className="absolute inset-x-0 bottom-2 text-center text-xs text-ivory/70">Membuka kamera… ketuk “Izinkan” jika diminta.</p>
        )}

        {err && (
          <div role="alert" className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-3xl bg-ivory p-6 text-center text-ink shadow-2xl">
            <AlertIcon size={34} className="mx-auto text-maroon" />
            <h2 className="mt-2 font-display text-xl text-maroon">{err.title}</h2>
            <p className="mt-2 text-sm text-warm-gray">{err.body}</p>
            <div className="mt-5 flex flex-col gap-2.5">
              {error !== 'notfound' && error !== 'insecure' && error !== 'unsupported' && (
                <Button icon={<RefreshIcon size={18} />} onClick={retry}>Coba Lagi</Button>
              )}
              <Button variant="outline" icon={<ImageIcon size={18} />} onClick={onPickFile}>Pilih dari Galeri</Button>
            </div>
          </div>
        )}
      </div>

      <footer className="safe-bottom grid grid-cols-[1fr_auto_1fr] items-center px-6 pt-4">
        <button
          type="button"
          onClick={onPickFile}
          disabled={count !== null}
          className="flex flex-col items-center gap-1 justify-self-start text-[0.7rem] text-ivory/80 disabled:opacity-40"
        >
          <span className="grid size-12 place-items-center rounded-full border border-ivory/30"><ImageIcon size={22} /></span>
          Galeri
        </button>
        <button
          type="button"
          onClick={start}
          disabled={status !== 'ready' || count !== null}
          aria-label="Ambil foto"
          className="grid size-20 place-items-center rounded-full border-4 transition-transform active:scale-95 disabled:opacity-40"
          style={{ borderColor: frame.colors.soft }}
        >
          <span className="size-[3.75rem] rounded-full" style={{ backgroundColor: frame.colors.primary }} />
        </button>
        <p className="justify-self-end text-right text-[0.7rem] leading-tight text-ivory/60">
          {count !== null ? 'Siap-siap…' : `Hitung mundur ${BOOTH.countdownSeconds} detik`}
        </p>
      </footer>
    </div>
  )
}
