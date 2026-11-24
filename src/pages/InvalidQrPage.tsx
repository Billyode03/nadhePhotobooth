import { Button } from '../components/ui/Button'
import { AlertIcon } from '../components/ui/Icons'
import { navigate } from '../lib/router'

interface Props {
  kind: 'unknown' | 'disabled' | 'notfound'
  /** Mood name (disabled card) or the unknown code. */
  detail?: string
}

const TEXT = {
  unknown: {
    title: 'QR tidak dikenali',
    body: (d?: string) => `Kode kartu${d ? ` “${d}”` : ''} tidak terdaftar. Pastikan kamu memindai QR dari kartu mood resmi MyPhotobooth, lalu coba scan ulang.`,
  },
  disabled: {
    title: 'Kartu sedang tidak aktif',
    body: (d?: string) => `Frame ${d ?? 'ini'} sedang tidak tersedia. Silakan pilih kartu mood lain di meja photobooth.`,
  },
  notfound: {
    title: 'Halaman tidak ditemukan',
    body: () => 'Alamat ini tidak tersedia. Scan QR pada kartu mood untuk membuka photobooth.',
  },
}

export function InvalidQrPage({ kind, detail }: Props) {
  const t = TEXT[kind]
  return (
    <main className="paper flex min-h-svh flex-col items-center justify-center px-8 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-maroon/10 text-maroon">
        <AlertIcon size={34} />
      </span>
      <h1 className="mt-5 font-display text-3xl text-maroon">{t.title}</h1>
      <p className="mt-3 max-w-xs text-sm text-warm-gray">{t.body(detail)}</p>
      <div className="mt-8 w-full max-w-xs">
        <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
          Cara Menggunakan
        </Button>
      </div>
      <p className="mt-10 eyebrow text-gold-deep">MyPhotobooth</p>
    </main>
  )
}
