import { useCallback, useEffect, useRef, useState } from 'react'
import type { FrameConfig } from '../config/frames'
import { CameraStage } from './CameraStage'
import { IntroStage } from './IntroStage'
import { decodeFile, loadFrameImage, PHOTO_ERROR_TEXT, PhotoError, type OwnedPhoto } from './media'
import { exportPhoto, type FinalPhoto } from './output'
import { CENTERED, type Placement } from './render'
import { DoneStage, ResultStage } from './ResultStage'
import { OverviewStage, ShotReviewStage } from './ReviewStage'

type Source = 'camera' | 'upload'
type Stage =
  | { k: 'intro' }
  | { k: 'camera'; slot: number }
  | { k: 'review'; slot: number; source: Source }
  | { k: 'overview' }
  | { k: 'result'; final: FinalPhoto }
  | { k: 'done' }

/**
 * Flow for one mood: intro → (camera or gallery → preview) for photo 1 → same for photo 2
 * → combined result where either photo can be retaken → saved image → done.
 */
export function BoothPage({ frame }: { frame: FrameConfig }) {
  const slots = frame.photoSlots.length
  const [frameImg, setFrameImg] = useState<HTMLImageElement | null>(null)
  const [frameError, setFrameError] = useState('')
  const [stage, setStage] = useState<Stage>({ k: 'intro' })
  const [photos, setPhotos] = useState<(OwnedPhoto | null)[]>(() => Array(slots).fill(null))
  const [placements, setPlacements] = useState<Placement[]>(() => Array(slots).fill(CENTERED))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const pickTarget = useRef(0)
  const photosRef = useRef(photos)

  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  // Free every decoded photo when leaving the booth.
  useEffect(() => () => photosRef.current.forEach((p) => p?.release()), [])

  useEffect(() => {
    // BoothPage is keyed by mood id, so state starts fresh for every mood.
    let alive = true
    loadFrameImage(frame.frame)
      .then((img) => {
        if (!alive) return
        if (import.meta.env.DEV && (img.naturalWidth !== frame.frameWidth || img.naturalHeight !== frame.frameHeight))
          console.warn(`[frames] "${frame.id}": PNG is ${img.naturalWidth}×${img.naturalHeight} but config says ${frame.frameWidth}×${frame.frameHeight}; slot positions will be off.`)
        setFrameImg(img)
      })
      .catch(() => alive && setFrameError('Frame gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.'))
    return () => {
      alive = false
    }
  }, [frame])

  useEffect(() => {
    if (stage.k === 'result') return () => URL.revokeObjectURL(stage.final.url)
  }, [stage])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(t)
  }, [notice])

  /** Puts a photo into one slot (freeing the one it replaces) and recentres it. */
  const setSlot = useCallback((slot: number, photo: OwnedPhoto | null) => {
    const old = photosRef.current[slot]
    if (old && old !== photo) old.release()
    const next = [...photosRef.current]
    next[slot] = photo
    photosRef.current = next
    setPhotos(next)
    setPlacements((prev) => prev.map((p, i) => (i === slot ? CENTERED : p)))
  }, [])

  const onPlacement = useCallback((slot: number, update: (p: Placement) => Placement) => {
    setPlacements((prev) => prev.map((p, i) => (i === slot ? update(p) : p)))
  }, [])

  /** After keeping a photo: next empty slot, or the combined result when all are filled. */
  const advance = (kept: number) => {
    const next = photos.findIndex((p, i) => !p && i !== kept)
    setStage(next >= 0 ? { k: 'camera', slot: next } : { k: 'overview' })
  }

  const pickFile = (slot: number) => {
    pickTarget.current = slot
    fileInput.current?.click()
  }

  const onFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '' // allow picking the same file again
    if (!file) return
    const slot = pickTarget.current
    setBusy(true)
    try {
      const photo = await decodeFile(file)
      setSlot(slot, photo)
      setStage({ k: 'review', slot, source: 'upload' })
    } catch (err) {
      setNotice(PHOTO_ERROR_TEXT[err instanceof PhotoError ? err.code : 'FAILED'])
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!frameImg || photos.some((p) => !p)) return
    setBusy(true)
    setNotice('')
    try {
      const final = await exportPhoto(frame, frameImg, photos as OwnedPhoto[], placements)
      setStage({ k: 'result', final })
    } catch {
      setNotice('Foto gagal diproses. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  const clearAll = () => {
    for (let i = 0; i < slots; i++) setSlot(i, null)
  }

  const firstEmpty = Math.max(0, photos.findIndex((p) => !p))

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        data-testid="photo-input"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      {stage.k === 'intro' && (
        <IntroStage
          frame={frame}
          frameSrc={frameImg?.src ?? null}
          error={frameError}
          onCamera={() => setStage({ k: 'camera', slot: firstEmpty })}
          onPickFile={() => pickFile(firstEmpty)}
        />
      )}
      {stage.k === 'camera' && frameImg && (
        <CameraStage
          key={stage.slot}
          frame={frame}
          frameSrc={frameImg.src}
          slot={stage.slot}
          photos={photos}
          placements={placements}
          onCapture={(photo) => {
            setSlot(stage.slot, photo)
            setStage({ k: 'review', slot: stage.slot, source: 'camera' })
          }}
          onPickFile={() => pickFile(stage.slot)}
          onClose={() => setStage(photos.every(Boolean) ? { k: 'overview' } : { k: 'intro' })}
        />
      )}
      {stage.k === 'review' && frameImg && (
        <ShotReviewStage
          frame={frame}
          frameImg={frameImg}
          photos={photos}
          placements={placements}
          onPlacement={onPlacement}
          slot={stage.slot}
          source={stage.source}
          busy={busy}
          onRetake={() => (stage.source === 'camera' ? setStage({ k: 'camera', slot: stage.slot }) : pickFile(stage.slot))}
          onNext={() => advance(stage.slot)}
        />
      )}
      {stage.k === 'overview' && frameImg && (
        <OverviewStage
          frame={frame}
          frameImg={frameImg}
          photos={photos}
          placements={placements}
          onPlacement={onPlacement}
          busy={busy}
          onRetake={(slot) => setStage({ k: 'camera', slot })}
          onPick={pickFile}
          onRetakeAll={() => {
            clearAll()
            setStage({ k: 'camera', slot: 0 })
          }}
          onDone={() => void save()}
        />
      )}
      {stage.k === 'result' && (
        <ResultStage frame={frame} photo={stage.final} onRetake={() => setStage({ k: 'overview' })} onFinish={() => setStage({ k: 'done' })} />
      )}
      {stage.k === 'done' && (
        <DoneStage
          frame={frame}
          onAgain={() => {
            clearAll()
            setStage({ k: 'intro' })
          }}
        />
      )}

      {busy && stage.k !== 'overview' && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-night/50 text-ivory" role="status">
          <span className="size-10 animate-spin rounded-full border-2 border-ivory/30 border-t-ivory" />
        </div>
      )}
      {notice && (
        <div role="alert" className="safe-top fixed inset-x-0 top-0 z-50 px-4">
          <p className="mx-auto max-w-md rounded-2xl bg-ink px-4 py-3 text-center text-sm text-ivory shadow-xl">{notice}</p>
        </div>
      )}
    </>
  )
}
