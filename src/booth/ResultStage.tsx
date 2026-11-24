import { useState } from 'react'
import type { FrameConfig } from '../config/frames'
import { Button } from '../components/ui/Button'
import { CameraIcon, CheckIcon, DownloadIcon, PrinterIcon, ShareIcon } from '../components/ui/Icons'
import { useFitBox } from '../lib/useFitBox'
import { canShareFile, isIOS, printPhoto, savePhoto, sharePhoto, type FinalPhoto } from './output'

interface Props {
  frame: FrameConfig
  photo: FinalPhoto
  onRetake: () => void
  onFinish: () => void
}

export function ResultStage({ frame, photo, onRetake, onFinish }: Props) {
  const { ref: fitRef, w: fitW, h: fitH } = useFitBox(photo.width / photo.height)
  const [saved, setSaved] = useState(false)
  const ios = isIOS()
  const showShare = !ios && canShareFile(photo)

  const save = async () => {
    await savePhoto(photo)
    setSaved(true)
  }

  return (
    <div className="paper fixed inset-0 flex flex-col">
      <header className="safe-top px-5 pb-2 text-center">
        <p className="eyebrow" style={{ color: frame.colors.primary }}>{frame.name}</p>
        <h1 className="font-display text-2xl text-maroon">Fotomu sudah jadi!</h1>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={fitRef} className="absolute inset-x-5 inset-y-0 grid place-items-center">
          {/* A real <img>: long-press → "Simpan ke Foto" also works on iPhone. */}
          <img
            src={photo.url}
            alt={`Hasil foto dengan frame ${frame.name}`}
            style={{ width: fitW, height: fitH }}
            className="rounded-lg shadow-[0_14px_36px_-18px_rgb(74_41_37/0.7)]"
          />
        </div>
      </div>

      <div className="safe-bottom px-5 pt-3">
        <p className="mb-3 text-center text-xs text-warm-gray" aria-live="polite">
          {saved
            ? ios
              ? 'Pilih “Simpan Gambar” agar masuk ke app Foto.'
              : 'Tersimpan di folder Download / Galeri.'
            : ios
              ? 'Ketuk Simpan, atau tekan lama foto lalu “Simpan ke Foto”.'
              : `${photo.width} × ${photo.height} px · siap dicetak`}
        </p>
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <Button onClick={() => void save()} icon={<DownloadIcon size={20} />} style={{ backgroundColor: frame.colors.primary }}>
            {saved ? 'Simpan Lagi' : 'Simpan Foto'}
          </Button>
          <div className={`grid gap-3 ${showShare ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {showShare && (
              <Button variant="outline" compact onClick={() => void sharePhoto(photo)} icon={<ShareIcon size={18} />}>Bagikan</Button>
            )}
            <Button variant="outline" compact onClick={() => printPhoto(photo)} icon={<PrinterIcon size={18} />}>Cetak</Button>
            <Button variant="outline" compact onClick={onRetake} icon={<CameraIcon size={18} />}>Ubah</Button>
          </div>
          <button type="button" onClick={onFinish} className="inline-flex min-h-12 items-center justify-center gap-2 text-sm font-medium text-maroon">
            <CheckIcon size={18} /> Selesai
          </button>
        </div>
      </div>

      {/* Only this is printed (see index.css @media print). */}
      <div className="print-sheet print-only" aria-hidden="true">
        <img src={photo.url} alt="" />
      </div>
    </div>
  )
}

export function DoneStage({ frame, onAgain }: { frame: FrameConfig; onAgain: () => void }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-8 text-center" style={{ background: `linear-gradient(180deg, ${frame.colors.soft} 0%, #fffaf3 75%)` }}>
      <span className="grid size-20 place-items-center rounded-full text-ivory shadow-lg" style={{ backgroundColor: frame.colors.primary }}>
        <CheckIcon size={40} />
      </span>
      <h1 className="mt-6 font-display text-3xl text-maroon">Terima kasih!</h1>
      <p className="mt-3 max-w-xs text-sm text-warm-gray">
        {frame.tagline} Jangan lupa kembalikan kartu <strong className="text-ink">{frame.name}</strong> ke meja photobooth.
      </p>
      <div className="mt-8 w-full max-w-xs">
        <Button variant="outline" className="w-full" onClick={onAgain} icon={<CameraIcon size={18} />}>
          Foto Lagi
        </Button>
      </div>
      <p className="mt-10 eyebrow text-gold-deep">Nadhe Photobooth</p>
    </div>
  )
}
