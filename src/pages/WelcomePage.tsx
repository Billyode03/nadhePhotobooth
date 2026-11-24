import { FRAMES } from '../config/frames'
import { CameraIcon, DownloadIcon, QrIcon } from '../components/ui/Icons'
import { navigate } from '../lib/router'

const STEPS = [
  { icon: QrIcon, title: 'Pilih kartu mood', body: 'Ambil salah satu kartu di meja photobooth, lalu scan QR-nya dengan kamera HP.' },
  { icon: CameraIcon, title: 'Bergaya & jepret', body: 'Frame sesuai kartu langsung terpasang. Hitung mundur 3 detik, lalu cekrek!' },
  { icon: DownloadIcon, title: 'Simpan hasilnya', body: 'Foto siap disimpan ke galeri HP atau dicetak ukuran 4R.' },
]

export function WelcomePage() {
  return (
    <main className="paper flex min-h-svh flex-col px-6">
      <header className="safe-top pt-10 text-center">
        <p className="eyebrow text-gold-deep">Selamat datang di</p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-maroon">
          My<span className="text-maroon">Photobooth</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-warm-gray">Abadikan momen dengan HP-mu sendiri. Tanpa antre, tanpa operator.</p>
      </header>

      <ol className="mx-auto mt-10 flex w-full max-w-sm flex-col gap-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-4 rounded-2xl border border-champagne/70 bg-ivory/80 p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-maroon text-ivory">
              <s.icon size={22} />
            </span>
            <div>
              <p className="font-medium text-ink">
                <span className="mr-1.5 text-gold-deep">{i + 1}.</span>
                {s.title}
              </p>
              <p className="mt-0.5 text-sm text-warm-gray">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* A hint, not a button: dashed outline so nobody tries to tap it. */}
      <div className="mx-auto mt-8 flex w-full max-w-sm items-center gap-3 rounded-2xl border-2 border-dashed border-maroon/40 px-4 py-3 text-ink">
        <QrIcon size={28} className="shrink-0 text-maroon" />
        <p className="text-sm">
          Buka <strong>kamera HP</strong>, arahkan ke QR di kartu mood, lalu ketuk link yang muncul.
        </p>
      </div>

      <section className="mx-auto mt-8 w-full max-w-sm" aria-labelledby="pick-mood">
        <h2 id="pick-mood" className="text-center text-sm font-medium text-ink">
          Belum scan kartu? Langsung pilih mood
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {FRAMES.filter((f) => f.enabled).map((f, i, all) => (
            <button
              key={f.id}
              type="button"
              onClick={() => navigate(`/booth/${f.id}`)}
              className={`min-h-12 rounded-full text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.97] ${i === all.length - 1 && all.length % 2 ? 'col-span-2' : ''}`}
              style={{ backgroundColor: f.colors.primary, fontFamily: 'var(--font-mood)' }}
            >
              {f.name}
            </button>
          ))}
        </div>
      </section>

      <footer className="safe-bottom mt-auto pt-10 text-center text-[0.7rem] text-warm-gray/80">MyPhotobooth</footer>
    </main>
  )
}
