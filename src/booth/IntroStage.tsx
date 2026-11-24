import type { FrameConfig } from '../config/frames'
import { Button } from '../components/ui/Button'
import { CameraIcon, ImageIcon } from '../components/ui/Icons'

interface Props {
  frame: FrameConfig
  /** Themed frame image (blob URL); null while it is being prepared. */
  frameSrc: string | null
  error: string
  onCamera: () => void
  onPickFile: () => void
}

/** First screen after scanning a card: confirms the mood and starts the camera on tap (needed for iOS). */
export function IntroStage({ frame, frameSrc, error, onCamera, onPickFile }: Props) {
  const ready = !!frameSrc
  const c = frame.colors
  return (
    <main className="flex min-h-svh flex-col" style={{ background: `linear-gradient(180deg, ${c.soft} 0%, #f6faff 70%)` }}>
      <header className="safe-top px-6 pb-1 text-center">
        <p className="eyebrow" style={{ color: c.primary }}>Pick Your Mood</p>
      </header>

      <section className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-3 text-center">
        <h1 className="text-5xl leading-tight font-semibold" style={{ color: c.primary }}>{frame.name}</h1>
        {frame.tagline && <p className="mt-1 text-sm text-ink/70">{frame.tagline}</p>}

        <div className="relative mt-5 h-[46svh] max-h-[460px] aspect-[1288/2320]">
          {frameSrc && <img src={frameSrc} data-frame={frame.frame} alt={`Frame ${frame.name}`} className="h-full w-full object-contain drop-shadow-[0_14px_22px_rgb(20_35_61/0.22)]" />}
          {!ready && !error && <span className="absolute inset-0 animate-pulse rounded-2xl bg-white/50" />}
        </div>
        <p className="mt-4 text-sm text-ink/80">
          Ada <strong>{frame.photoSlots.length} foto</strong> dalam frame ini. Kita ambil satu per satu.
        </p>
      </section>

      <footer className="safe-bottom mx-auto flex w-full max-w-md flex-col gap-3 px-6">
        {error ? (
          <p role="alert" className="text-center text-sm text-maroon">{error}</p>
        ) : (
          <p className="text-center text-xs text-warm-gray">Cari tempat yang terang, lalu izinkan akses kamera saat diminta.</p>
        )}
        <Button disabled={!ready} onClick={onCamera} icon={<CameraIcon size={20} />} style={{ backgroundColor: c.primary }}>
          Mulai Foto
        </Button>
        <Button variant="outline" disabled={!ready} onClick={onPickFile} icon={<ImageIcon size={20} />}>
          Pilih dari Galeri
        </Button>
      </footer>
    </main>
  )
}
