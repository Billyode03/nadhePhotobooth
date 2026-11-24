# Nadhe Photobooth — Pick Your Mood

Photobooth web berbasis kartu mood: pengunjung **scan QR di kartu → frame mood langsung terpasang → ambil 2 foto dengan kamera HP (atau galeri) → simpan / cetak**. Tanpa login, tanpa server, tanpa database. Semua foto diproses di HP pengunjung.

Vite + React 19 + TypeScript + Tailwind CSS 4 (stack yang sama dengan NadheWedd; modul compositing, kamera, dan QR diadaptasi dari album NadheWedd, lihat [docs/AUDIT.md](docs/AUDIT.md)).

| Mood | URL di QR | Frame |
|---|---|---|
| Happy | `/booth/happy` | `public/frames/happy.webp` |
| Sad | `/booth/sad` | `public/frames/sad.webp` |
| Tired | `/booth/tired` | `public/frames/tired.webp` |
| Anxious | `/booth/anxious` | `public/frames/anxious.webp` |
| Confident | `/booth/confident` | `public/frames/confident.webp` |

```
/                 Halaman sambutan (cara pakai)
/booth/<mood>     Photobooth satu mood
/panitia          Internal panitia: preview frame + 2 slot, status transparansi, warna,
                  kartu QR, unduh frame/kartu (.png / .zip), cetak kartu  (alias: /qr)
```

**Flow pengunjung:** mood → kamera **Foto 1** (countdown 3-2-1) → preview foto 1 (Ulangi / lanjut) → kamera **Foto 2** (foto 1 terlihat di slot atas) → preview foto 2 → **hasil gabungan** (geser/zoom tiap foto, ulangi Foto 1 / Foto 2 / semua, atau ganti dari galeri) → Simpan Hasil → Simpan Foto / Bagikan / Cetak → Selesai.

---

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:5173
```

Kamera HP hanya jalan lewat **HTTPS** (lihat bawah). Untuk mencoba di HP: deploy preview ke Vercel atau pakai tunnel HTTPS (`npx cloudflared tunnel --url http://localhost:5173`).

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `preview` / `lint` | standar Vite |
| `npm test` | Cek konfigurasi mood, slot, mapping QR, validasi URL (28 tes) |
| `npm run test:e2e` | Tes end-to-end di Chrome dengan kamera palsu (lihat Testing) |
| `npm run frames:extract` | Ekstrak ulang 5 frame dari `src/assets/mood_frame.png` (Python 3 + Pillow + numpy + scipy) |
| `npm run frames:verify` | Verifikasi alpha/slot/sisa checkerboard pada PNG frame |

## Deploy ke Vercel

1. Push ke Git → Vercel **Add New → Project** (framework Vite; `vercel.json` sudah mengatur rewrite SPA, cache frame, header kamera).
2. **Wajib:** set environment variable `VITE_PUBLIC_BASE_URL=https://domain-produksi-anda` (tanpa garis miring di akhir). Inilah alamat yang dicetak di QR.
3. Deploy, lalu buka `https://domain-anda/panitia` untuk mengunduh kartu QR.

## Frame & dua slot foto

Sumber desain: `src/assets/mood_frame.png` (1536×1024, **RGB tanpa alpha**: checkerboard di slot hanya gambar). `scripts/extract-frames.py` membuat frame transparan (WebP):

1. Latar sheet (krem hangat + bayangan) dihapus dengan flood-fill dari tepi; outline putih frame bersifat netral sehingga **tidak ikut terhapus**.
2. Frame yang saling menempel dipisah dengan *seam* dinamis (lewat latar atau outline putih, tidak memotong ilustrasi).
3. Slot dideteksi dari **pola papan catur** (kotak abu-abu yang berselang dengan kotak putih), bukan dari warna putih. Stiker yang menumpuk di slot (balon kata, kucing, coretan, clipboard, rambut, kacamata) tetap utuh beserta outline putihnya; kantong putih di dalam balon kata tidak dilubangi.
4. Upscale 4× (Lanczos + unsharp mask) ke **1288×2320 px**, tepi slot digambar ulang secara analitik agar tajam.
5. Disimpan sebagai **WebP** (warna kualitas 92, alpha lossless): ±260 KB per frame (PNG ±2,3 MB), tampilan identik dan lubang slot tetap persis transparan.

Koordinat slot (piksel frame, termasuk *bleed* 12 px di bawah stroke) ada di [`src/config/frames.ts`](src/config/frames.ts) → `photoSlots`; hasil ukur mentah di [`docs/frame-extraction.json`](docs/frame-extraction.json). Koordinat **berbeda per frame** (mis. slot 1 Tired lebih sempit karena tertutup kucing & balon "Rest Well").

**Mengganti dengan desain resolusi tinggi:** simpan PNG transparan final (disarankan ≥1288×2320, slot benar-benar transparan) di `public/frames/<mood>.webp` (konversi: `Image.save(..., 'WEBP', quality=92, alpha_quality=100)`), ukur lubang slot, perbarui `frameWidth/frameHeight/photoSlots`, lalu `npm test`.

## Kartu QR

Kartu **digambar ulang** (bukan dipotong dari referensi) di `src/cards/renderCard.ts`: latar pastel + outline putih, ikon mood (matahari, awan hujan, kucing tidur, coretan, mahkota), "Pick Your Mood", nama mood, **QR asli** (library `uqr`, ECC Q, quiet zone 4 modul, hitam di atas putih, tanpa ornamen di atasnya), tombol "Scan di sini! ♥", dan alamat kecil sebagai cadangan. Ukuran cetak 85 × 110 mm @300 dpi (1004×1299 px), atur di `CARD`.

Di `/panitia`: isi/cek alamat produksi → **Unduh Kartu QR (PNG)** per mood, **Unduh Semua Kartu (.zip)**, atau **Cetak Semua Kartu** (satu kartu per halaman 85×110 mm). Alamat `localhost`, IP lokal, `.local`, atau `http://` **ditolak** dan unduhan kartu dinonaktifkan.

> Uji setiap kartu yang sudah dicetak dengan kamera HP sebelum acara.

## Konfigurasi (`src/config/frames.ts`)

- **Nama mood / tagline / warna:** `name`, `tagline`, `colors` (`primary`, `soft`, `accent`). Jangan ubah `id` setelah kartu dicetak; kalau terpaksa, simpan id lama di `aliases`.
- **Nonaktifkan kartu:** `enabled: false`.
- **Output:** default = ukuran PNG (1288×2320). `OUTPUT.mime` / `quality` (JPEG 0.95), `mirrorFrontCamera` (hasil = seperti cermin di layar).
- **Cetak foto:** `PRINT` (default 4R 100×150 mm). Frame berasio ±0,555 (lebih ramping dari 4R), jadi dicetak utuh dengan sisa putih di kiri-kanan, tidak terpotong.
- **Countdown:** `BOOTH.countdownSeconds`. **Upload:** `UPLOAD.maxBytes` (25 MB).

## Persyaratan HTTPS untuk kamera

`getUserMedia()` hanya berjalan di `https://` (atau `http://localhost` di komputer itu sendiri). Di halaman tidak aman aplikasi menampilkan "Kamera butuh koneksi aman" dan tetap menyediakan **Pilih dari Galeri**. iPhone: izin kamera diminta tiap halaman dibuka; tombol Simpan membuka share sheet → **Simpan Gambar**. Android: Simpan mengunduh ke Download/Galeri.

## Testing

```bash
npm test                    # unit: mood, slot, mapping, URL
npm run frames:verify       # PNG: RGBA, slot transparan, tidak ada sisa checkerboard
npm run build && npm run preview
UPLOAD_IMAGE=/path/foto.jpg npm run test:e2e
```

E2E (Chrome headless, kamera palsu, viewport iPhone) menguji: kelima QR membuka mood yang benar; slug tidak valid; Foto 1 + countdown → preview → Foto 2 (foto 1 tidak berubah) → hasil gabungan; **ulangi Foto 2 saja** (Foto 1 tetap) dan **ulangi Foto 1 saja** (Foto 2 tetap); kamera mati di luar layar kamera; output 1288×2320, piksel frame utuh di atas foto, kedua slot terisi, **preview = hasil**; download; cetak 1 halaman; upload galeri ke kedua slot; file non-gambar ditolak; izin kamera ditolak; `/panitia` menolak localhost dan menampilkan status transparansi OK; **kelima kartu QR terbaca jsQR** (ukuran penuh dan diperkecil ±200 px) ke URL mood yang benar; unduh PNG & ZIP; cetak 5 halaman 85×110 mm.

**Checklist manual (HP asli, wajib sebelum acara):**
- [ ] Kamera depan di Android (Chrome) dan iPhone (Safari)
- [ ] Scan kelima kartu cetak → mood benar
- [ ] Foto 1, Foto 2, ulangi masing-masing, simpan ke galeri
- [ ] Cetak satu hasil di printer acara

## Struktur

```
src/assets/mood_frame.png   sumber desain (referensi)
public/frames/*.png         5 frame transparan hasil ekstraksi
src/config/frames.ts        mood, warna, slot, output, cetak, kartu
src/booth/                  BoothPage (alur), CameraStage, ReviewStage (preview & hasil gabungan),
                            CompositeCanvas, ResultStage, render.ts, useCamera.ts, media.ts, output.ts
src/cards/                  renderCard.ts (kartu QR), icons.ts (ikon mood SVG)
src/pages/                  Welcome, QR tidak valid, PanitiaPage
src/lib/                    router, useFitBox, zip (tanpa dependency)
scripts/                    extract-frames.py, verify-frames.py, test-frames.ts, e2e.ts
docs/                       AUDIT.md, frame-extraction.json
```
