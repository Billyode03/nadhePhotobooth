// Organiser page (/panitia, also /qr): previews of the five frames and their QR cards,
// transparency status, colours, and downloads. Not linked from the visitor pages.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CARD, FRAMES, isPublicUrl, SITE, type FrameConfig } from '../config/frames'
import { loadFrameImage } from '../booth/media'
import { render, type PhotoSource } from '../booth/render'
import { CARD_PX, canvasToBlob, renderCard } from '../cards/renderCard'
import { Button } from '../components/ui/Button'
import { AlertIcon, CheckIcon, DownloadIcon, PrinterIcon } from '../components/ui/Icons'
import { downloadBlob, makeZip } from '../lib/zip'

const STORE_KEY = 'myphotobooth.baseUrl'

function initialBase() {
  const env = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined) || SITE.publicUrl
  if (env) return env
  try {
    const saved = localStorage.getItem(STORE_KEY)
    if (saved) return saved
  } catch {
    /* storage blocked */
  }
  return isPublicUrl(window.location.origin) ? window.location.origin : ''
}

interface Transparency {
  outside: boolean
  slots: { clear: number; centre: boolean }[]
}

/** Reads the PNG's real alpha channel: outside corners and each slot box. */
async function analyse(frame: FrameConfig, img: HTMLImageElement): Promise<Transparency> {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const a = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3]
  const outside = [a(2, 2), a(c.width - 3, 2), a(2, c.height - 3), a(c.width - 3, c.height - 3)].every((v) => v === 0)
  const slots = frame.photoSlots.map((s) => {
    const inset = 40
    const data = ctx.getImageData(s.x + inset, s.y + inset, s.width - inset * 2, s.height - inset * 2).data
    let clear = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) clear++
    return { clear: clear / (data.length / 4), centre: a(s.x + s.width / 2, s.y + s.height / 2) === 0 }
  })
  c.width = c.height = 0
  return { outside, slots }
}

/** Two sample "photos" for previews (no real faces needed). */
function samplePhotos(frame: FrameConfig): PhotoSource[] {
  return [0, 1].map((i) => {
    const c = document.createElement('canvas')
    c.width = 900
    c.height = 680
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 900, 680)
    g.addColorStop(0, i ? '#8bc5ff' : '#dff0ff')
    g.addColorStop(1, i ? '#d9edff' : '#9ecbff')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 900, 680)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.arc(450, 300, 130, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(450, 640, 260, 190, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = frame.colors.primary
    ctx.font = '600 64px Poppins, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Foto ${i + 1}`, 450, 120)
    return { image: c, width: 900, height: 680 }
  })
}

export function PanitiaPage() {
  const [base, setBase] = useState(initialBase)
  const valid = isPublicUrl(base)
  const [cards, setCards] = useState<Record<string, Blob>>({})
  const [busy, setBusy] = useState('')
  const onCard = useCallback((id: string, blob: Blob) => setCards((m) => (m[id] === blob ? m : { ...m, [id]: blob })), [])

  useEffect(() => {
    if (!valid) return
    try {
      localStorage.setItem(STORE_KEY, base)
    } catch {
      /* storage blocked */
    }
  }, [base, valid])

  const allCards = async () => {
    const out: { name: string; blob: Blob }[] = []
    for (const f of FRAMES) {
      const blob = cards[f.id] ?? (await canvasToBlob((await renderCard(f, base)).canvas))
      out.push({ name: cardFileName(f), blob })
    }
    return out
  }

  const zipCards = async () => {
    setBusy('cards')
    try {
      downloadBlob(await makeZip(await allCards()), 'myphotobooth-kartu-qr.zip')
    } finally {
      setBusy('')
    }
  }

  const zipFrames = async () => {
    setBusy('frames')
    try {
      // The themed frames (exactly what visitors see and what is saved).
      const files = await Promise.all(FRAMES.map(async (f) => ({ name: `frame-${f.id}.png`, blob: await (await fetch((await loadFrameImage(f.frame)).src)).blob() })))
      downloadBlob(await makeZip(files), 'myphotobooth-frame.zip')
    } finally {
      setBusy('')
    }
  }

  const printCards = () => {
    let style = document.getElementById('print-page-size') as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = 'print-page-size'
      document.head.appendChild(style)
    }
    style.textContent = `@page { size: ${CARD.widthMm}mm ${CARD.heightMm}mm; margin: 0; }
@media print { .card-page { width: ${CARD.widthMm}mm; height: ${CARD.heightMm}mm; } }`
    window.print()
  }

  return (
    <main className="paper min-h-svh px-4 pb-16">
      <div className="no-print safe-top mx-auto max-w-5xl pt-6">
        <p className="eyebrow text-gold-deep">Panitia · internal</p>
        <h1 className="font-display text-3xl text-maroon">Frame & Kartu QR</h1>
        <p className="mt-2 max-w-2xl text-sm text-warm-gray">
          Lima mood, masing-masing frame dua foto dan kartu QR senada. Kartu dicetak ukuran {CARD.widthMm} × {CARD.heightMm} mm ({CARD_PX.w} × {CARD_PX.h} px, {CARD.dpi} dpi).
        </p>

        <label className="mt-5 block text-sm font-medium text-ink">
          Alamat website produksi (dipakai di semua QR)
          <input
            value={base}
            onChange={(e) => setBase(e.target.value.trim().replace(/\/+$/, ''))}
            placeholder="https://photobooth.domain-anda.com"
            inputMode="url"
            className="mt-1.5 block w-full rounded-xl border border-champagne bg-ivory px-4 py-3 text-base text-ink outline-none focus:border-maroon"
          />
        </label>
        {!valid && (
          <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-maroon">
            <AlertIcon size={18} className="mt-0.5 shrink-0" />
            Isi alamat https:// publik (domain Vercel atau domain sendiri). Alamat localhost, IP lokal, atau http:// tidak bisa dipakai di kartu karena kamera HP butuh HTTPS dan pengunjung tidak bisa membukanya. Unduhan kartu dinonaktifkan sampai alamat valid.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button disabled={!valid || !!busy} onClick={() => void zipCards()} icon={<DownloadIcon size={18} />}>
            {busy === 'cards' ? 'Menyiapkan…' : 'Unduh Semua Kartu (.zip)'}
          </Button>
          <Button variant="outline" disabled={!valid} onClick={printCards} icon={<PrinterIcon size={18} />}>Cetak Semua Kartu</Button>
          <Button variant="outline" disabled={!!busy} onClick={() => void zipFrames()} icon={<DownloadIcon size={18} />}>
            {busy === 'frames' ? 'Menyiapkan…' : 'Unduh Semua Frame (.zip)'}
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-5xl gap-6">
        {FRAMES.map((f) => (
          <MoodPanel key={f.id} frame={f} base={base} valid={valid} onCard={onCard} />
        ))}
      </div>

      {/* Print layout: one card per page at exact card size. */}
      <div className="print-area print-only">
        {FRAMES.map((f) => (
          <PrintCard key={f.id} blob={cards[f.id]} />
        ))}
      </div>
    </main>
  )
}

const cardFileName = (f: FrameConfig) => `kartu-qr-${(f.card ?? '').toLowerCase().replace(/\s+/g, '')}-${f.id}.png`.replace('--', '-')

function PrintCard({ blob }: { blob?: Blob }) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ''), [blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return url ? (
    <div className="card-page">
      <img src={url} alt="" />
    </div>
  ) : null
}

function MoodPanel({ frame, base, valid, onCard }: { frame: FrameConfig; base: string; valid: boolean; onCard: (id: string, b: Blob) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [status, setStatus] = useState<Transparency | null>(null)
  const [samples, setSamples] = useState(true)
  const [card, setCard] = useState<{ url: string; blob: Blob; qr: string } | null>(null)
  const preview = useRef<HTMLCanvasElement>(null)
  const photos = useMemo(() => samplePhotos(frame), [frame])

  useEffect(() => {
    let alive = true
    loadFrameImage(frame.frame).then(async (i) => {
      if (!alive) return
      setImg(i)
      setStatus(await analyse(frame, i))
    })
    return () => {
      alive = false
    }
  }, [frame])

  useEffect(() => {
    const c = preview.current
    if (!c || !img) return
    c.width = 322 * 2
    c.height = 580 * 2
    render(c.getContext('2d')!, c.width, c.height, frame, img, samples ? photos : [null, null], [], { placeholders: !samples })
  }, [img, samples, photos, frame])

  useEffect(() => {
    if (!valid) return
    let alive = true
    let made = ''
    const t = window.setTimeout(async () => {
      const r = await renderCard(frame, base)
      const blob = await canvasToBlob(r.canvas)
      r.canvas.width = r.canvas.height = 0
      if (!alive) return
      made = URL.createObjectURL(blob)
      setCard({ url: made, blob, qr: r.url })
      onCard(frame.id, blob)
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(t)
      if (made) URL.revokeObjectURL(made)
    }
  }, [frame, base, valid, onCard])

  const ok = status && status.outside && status.slots.every((s) => s.centre && s.clear > 0.5)
  const c = frame.colors

  return (
    <section className="no-print rounded-3xl border border-champagne/70 bg-ivory p-5" data-mood={frame.id}>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: c.primary }}>{frame.card}</span>
        <h2 className="text-2xl font-semibold" style={{ color: c.primary }}>{frame.name}</h2>
        <span className="text-sm text-warm-gray">“{frame.tagline}”</span>
        <span className="ml-auto flex gap-1.5" aria-label="Warna mood">
          {Object.entries(c).map(([k, v]) => (
            <span key={k} title={`${k} ${v}`} className="flex items-center gap-1 rounded-full border border-champagne bg-white py-0.5 pr-2 pl-0.5 text-[0.65rem] text-warm-gray">
              <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: v }} />
              {v}
            </span>
          ))}
        </span>
      </header>

      <div className="grid gap-5 md:grid-cols-[1fr_1fr_1.1fr]">
        <figure>
          <figcaption className="mb-2 text-xs font-medium text-ink">Frame + contoh 2 foto</figcaption>
          <canvas ref={preview} className="w-full max-w-[260px] rounded-lg" style={{ aspectRatio: `${frame.frameWidth} / ${frame.frameHeight}` }} />
          <label className="mt-2 flex items-center gap-2 text-xs text-warm-gray">
            <input type="checkbox" checked={samples} onChange={(e) => setSamples(e.target.checked)} className="accent-maroon" /> Tampilkan contoh foto
          </label>
        </figure>

        <figure>
          <figcaption className="mb-2 text-xs font-medium text-ink">PNG transparan (latar kotak-kotak = transparan asli)</figcaption>
          <div className="w-full max-w-[260px] rounded-lg bg-[length:20px_20px] bg-[conic-gradient(#e5e5e5_25%,#fff_0_50%,#e5e5e5_0_75%,#fff_0)]">
            {img && <img src={img.src} alt={`Frame ${frame.name}`} className="block w-full" />}
          </div>
          <ul className="mt-2 space-y-0.5 text-xs" data-testid={`transparency-${frame.id}`}>
            {!status && <li className="text-warm-gray">Memeriksa alpha channel…</li>}
            {status && (
              <>
                <li className={status.outside ? 'text-[#2f6b3a]' : 'text-maroon'}>{status.outside ? '✓' : '✗'} Latar luar transparan</li>
                {status.slots.map((s, i) => (
                  <li key={i} className={s.centre && s.clear > 0.5 ? 'text-[#2f6b3a]' : 'text-maroon'}>
                    {s.centre && s.clear > 0.5 ? '✓' : '✗'} Slot {i + 1}: {Math.round(s.clear * 100)}% transparan (sisanya stiker yang menumpuk)
                  </li>
                ))}
                <li className={`font-semibold ${ok ? 'text-[#2f6b3a]' : 'text-maroon'}`}>{ok ? 'Status: OK' : 'Status: periksa frame'}</li>
              </>
            )}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={img?.src ?? frame.frame} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-full border border-maroon/40 px-4 text-xs text-maroon">Lihat PNG</a>
            <a href={img?.src ?? frame.frame} download={`frame-${frame.id}.png`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-maroon/40 px-4 text-xs text-maroon">
              <DownloadIcon size={14} /> Unduh Frame
            </a>
            <a href={`/booth/${frame.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-full border border-maroon/40 px-4 text-xs text-maroon">Buka Booth</a>
          </div>
        </figure>

        <figure>
          <figcaption className="mb-2 text-xs font-medium text-ink">Kartu QR <span className="font-normal text-warm-gray">· tekan kartu untuk membuka booth</span></figcaption>
          {valid ? (
            card ? (
              <a
                href={`/booth/${frame.id}`}
                aria-label={`Buka booth frame ${frame.name}`}
                className="block w-full max-w-[300px] rounded-3xl outline-none transition-transform hover:scale-[1.01] focus-visible:ring-4 focus-visible:ring-maroon/40"
                title={`Buka booth ${frame.name}`}
              >
                <img src={card.url} alt={`Kartu QR ${frame.name}`} data-testid={`card-${frame.id}`} className="block w-full rounded-3xl drop-shadow-md" />
              </a>
            ) : (
              <div className="grid aspect-[85/110] w-full max-w-[300px] place-items-center rounded-3xl bg-sand text-xs text-warm-gray">Membuat kartu…</div>
            )
          ) : (
            <div className="grid aspect-[85/110] w-full max-w-[300px] place-items-center rounded-3xl border-2 border-dashed border-maroon/30 p-6 text-center text-xs text-maroon">
              Isi alamat website produksi di atas untuk membuat QR.
            </div>
          )}
          {card && valid && (
            <>
              <p className="mt-2 flex items-center gap-1 text-xs break-all text-[#2f6b3a]">
                <CheckIcon size={14} /> {card.qr}
              </p>
              <button
                type="button"
                onClick={() => downloadBlob(card.blob, cardFileName(frame))}
                className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-xs text-white"
                style={{ backgroundColor: c.primary }}
              >
                <DownloadIcon size={14} /> Unduh Kartu QR (PNG)
              </button>
            </>
          )}
        </figure>
      </div>
    </section>
  )
}
