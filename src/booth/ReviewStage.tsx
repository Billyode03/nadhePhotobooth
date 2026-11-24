import { useState } from 'react'
import type { FrameConfig } from '../config/frames'
import { Button } from '../components/ui/Button'
import { CameraIcon, CheckIcon, ImageIcon, RefreshIcon } from '../components/ui/Icons'
import { CompositeCanvas } from './CompositeCanvas'
import type { Placement, PhotoSource } from './render'

interface Common {
  frame: FrameConfig
  frameImg: HTMLImageElement
  photos: (PhotoSource | null)[]
  placements: Placement[]
  onPlacement: (slot: number, update: (p: Placement) => Placement) => void
}

function ZoomSlider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md items-center gap-3 text-xs text-warm-gray">
      <span className="w-14 shrink-0">{label}</span>
      <input
        type="range" min={1} max={3} step={0.01} value={Math.min(3, value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 flex-1 accent-maroon" aria-label={`Zoom ${label}`}
      />
    </div>
  )
}

/** Preview right after one shot: keep it (and go on) or retake just this photo. */
export function ShotReviewStage({
  frame, frameImg, photos, placements, onPlacement, slot, source, busy, onRetake, onNext,
}: Common & { slot: number; source: 'camera' | 'upload'; busy: boolean; onRetake: () => void; onNext: () => void }) {
  const total = frame.photoSlots.length
  const nextEmpty = photos.findIndex((p, i) => !p && i !== slot)
  return (
    <div className="paper fixed inset-0 flex flex-col">
      <header className="safe-top px-5 pb-1 text-center">
        <p className="eyebrow" style={{ color: frame.colors.primary }}>{frame.name} · Foto {slot + 1} dari {total}</p>
        <h1 className="font-display text-2xl text-maroon">Sudah pas?</h1>
      </header>

      <CompositeCanvas
        className="min-h-0 flex-1 px-5"
        frame={frame} frameImg={frameImg} photos={photos} placements={placements}
        editable={[slot]} highlight={slot} onPlacement={onPlacement}
      />

      <div className="safe-bottom px-5 pt-2">
        <ZoomSlider label={`Foto ${slot + 1}`} value={placements[slot]?.zoom ?? 1} onChange={(z) => onPlacement(slot, (p) => ({ ...p, zoom: z }))} />
        <p className="mb-3 text-center text-xs text-warm-gray">Geser foto untuk mengatur posisi.</p>
        <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
          <Button variant="outline" disabled={busy} onClick={onRetake} icon={source === 'camera' ? <CameraIcon size={18} /> : <ImageIcon size={18} />}>
            {source === 'camera' ? 'Ulangi' : 'Ganti'}
          </Button>
          <Button disabled={busy} onClick={onNext} icon={<CheckIcon size={18} />} style={{ backgroundColor: frame.colors.primary }}>
            {nextEmpty >= 0 ? `Foto ${nextEmpty + 1}` : 'Lihat Hasil'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Both photos in the frame. Each one can be moved/zoomed and retaken on its own. */
export function OverviewStage({
  frame, frameImg, photos, placements, onPlacement, busy, onRetake, onPick, onRetakeAll, onDone,
}: Common & { busy: boolean; onRetake: (slot: number) => void; onPick: (slot: number) => void; onRetakeAll: () => void; onDone: () => void }) {
  const [selected, setSelected] = useState(0)
  const all = frame.photoSlots.map((_, i) => i)
  return (
    <div className="paper fixed inset-0 flex flex-col">
      <header className="safe-top px-5 pb-1 text-center">
        <p className="eyebrow" style={{ color: frame.colors.primary }}>{frame.name}</p>
        <h1 className="font-display text-2xl text-maroon">Hasil gabungan</h1>
      </header>

      <CompositeCanvas
        className="min-h-0 flex-1 px-5"
        frame={frame} frameImg={frameImg} photos={photos} placements={placements}
        editable={all} onPlacement={onPlacement} onSelect={setSelected}
      />

      <div className="safe-bottom px-5 pt-2">
        <ZoomSlider label={`Foto ${selected + 1}`} value={placements[selected]?.zoom ?? 1} onChange={(z) => onPlacement(selected, (p) => ({ ...p, zoom: z }))} />
        <p className="mb-2 text-center text-xs text-warm-gray">Ketuk & geser foto untuk mengatur posisinya.</p>
        <div className="mx-auto mb-3 grid max-w-md grid-cols-2 gap-2">
          {all.map((i) => (
            <div key={i} className={`rounded-2xl border p-2 ${selected === i ? 'border-maroon/50 bg-ivory' : 'border-champagne/70 bg-ivory/60'}`}>
              <p className="mb-1.5 text-center text-xs font-medium text-ink">Foto {i + 1}</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button" disabled={busy} onClick={() => onRetake(i)} aria-label={`Ulangi foto ${i + 1} dengan kamera`}
                  className="flex min-h-11 flex-col items-center justify-center rounded-xl text-[0.65rem] text-maroon hover:bg-maroon/5 disabled:opacity-40"
                >
                  <CameraIcon size={18} /> Ulangi
                </button>
                <button
                  type="button" disabled={busy} onClick={() => onPick(i)} aria-label={`Ganti foto ${i + 1} dari galeri`}
                  className="flex min-h-11 flex-col items-center justify-center rounded-xl text-[0.65rem] text-maroon hover:bg-maroon/5 disabled:opacity-40"
                >
                  <ImageIcon size={18} /> Galeri
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mx-auto grid max-w-md grid-cols-[auto_1fr] gap-3">
          <Button variant="outline" className="px-4" disabled={busy} onClick={onRetakeAll} aria-label="Ulangi semua foto" icon={<RefreshIcon size={18} />}>
            Semua
          </Button>
          <Button disabled={busy} onClick={onDone} icon={<CheckIcon size={18} />} style={{ backgroundColor: frame.colors.primary }}>
            {busy ? 'Memproses…' : 'Simpan Hasil'}
          </Button>
        </div>
      </div>
    </div>
  )
}
