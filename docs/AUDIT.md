# Audit NadheWedd → Nadhe Photobooth

Tanggal audit: 24 November 2026. Project NadheWedd **tidak diubah**. File hanya dibaca, dan bagian yang relevan disalin/diadaptasi ke project ini.

## Profil NadheWedd

| Aspek | Temuan |
|---|---|
| Framework | React 19 + Vite 8 (multi-page: `/`, `/checkin/`, `/dashboard/`, `/album/`, `/album-admin/`) |
| Bahasa | TypeScript 6 (strict-ish: `noUnusedLocals`, `erasableSyntaxOnly`) |
| Styling | Tailwind CSS 4 dengan token tema di `src/index.css` (maroon/cream/gold) |
| Package manager | npm |
| Lint | oxlint |
| Backend | Supabase (DB + storage), Vercel Functions (`api/album/*`), Vercel middleware per subdomain |
| Routing | Tanpa router library. Satu `index.html` per halaman + rewrite di middleware |

## Modul album & keputusan reuse

| Sumber NadheWedd | Fungsi | Di Photobooth |
|---|---|---|
| `src/album/studio/render.ts` | Compositing Canvas: foto di-clip ke jendela frame, `coverRect` (cover tanpa distorsi + offset), frame PNG di atas; preview & export memakai renderer yang sama | **Diadaptasi** → `src/booth/render.ts`. `coverRect` verbatim. Layer teks nama/tanggal & bentuk arch/quad dibuang. Ditambah `frameRect` (contain bila rasio tidak cocok) |
| `src/album/studio/frames.ts` | Manifest frame + `loadFrameImage` (cache Promise) | `loadFrameImage` **dipakai ulang** → `src/booth/media.ts`. Manifest JSON diganti config TS terpusat `src/config/frames.ts` (type-safe, bisa dites di Node) |
| `src/album/studio/FrameStudio.tsx` | Geser/pinch-zoom foto, slider zoom, simpan via Web Share / `<a download>`, export di kanvas terpisah | Gesture & slider **dipakai ulang** → `ReviewStage.tsx`. Logika simpan → `output.ts` (ditambah deteksi iOS, nama file bertimestamp) |
| `src/album/AlbumApp.tsx` → `CameraCapture` | `getUserMedia` + mapping error (izin/tidak ada kamera), stop track saat unmount, fallback kamera bawaan | **Diadaptasi** → `useCamera.ts`. Ditambah: cek HTTPS, kamera sedang dipakai, retry tanpa constraint, pause saat tab tersembunyi, deteksi stream terputus |
| `src/album/compress.ts` | Decode dengan orientasi EXIF (`createImageBitmap` → fallback `<img>`), validasi ukuran/format | Decode & validasi **dipakai ulang** → `decodeFile()`. Kompresi 1920 px/JPEG 0.82 **tidak** dipakai agar kualitas foto tidak turun sebelum export |
| `src/album/admin/AlbumQr.tsx` + `uqr` | QR SVG + PNG 2000 px | **Dipakai ulang** → `src/pages/QrPage.tsx` |
| `src/components/ui/Button.tsx`, `Icons.tsx` | UI kit | Disalin, tombol diperbesar (56 px) + varian compact. Hanya ikon yang dipakai |
| `src/hooks/useBodyScrollLock.ts` | Kunci scroll | Tidak perlu (stage memakai `position: fixed`) |
| Token tema `src/index.css` | Warna & font Nadhe | Disalin sebagian |
| `tsconfig*.json`, `.oxlintrc.json`, `.gitignore` | Konfigurasi | Disalin (referensi API dihapus) |

## Tidak dipakai (di luar scope MVP)

Supabase & `@supabase/supabase-js`, `@vercel/functions`, `api/album/*`, upload queue (`useUploadQueue.ts`), `albumService.ts`, galeri/Viewer, admin album, middleware subdomain, layer teks pengantin & tipografi manifest, seluruh undangan, buku tamu/check-in/dashboard, `jsqr` (QR dipindai dengan kamera bawaan HP, bukan di dalam aplikasi), musik & ornamen dekoratif.

## Dependency

Runtime hanya `react`, `react-dom`, `uqr`. Tidak ada dependency baru dibanding NadheWedd. Router ditulis sendiri (~40 baris) daripada menambah react-router.

## Keputusan desain

- **Preview kamera via CSS, bukan Canvas per frame**: `<video object-fit: cover>` diletakkan tepat di `photoArea` dan PNG di atasnya. Perhitungannya identik dengan `coverRect` posisi default, jadi hasil jepretan sama dengan preview, dan lebih ringan + stabil di iOS dibanding menggambar video ke canvas setiap frame. Tes e2e membandingkan piksel preview vs hasil.
- **Kamera dinyalakan setelah tombol ditekan** (bukan otomatis saat QR dibuka): prompt izin lebih dapat diprediksi di iOS, dan pengunjung melihat dulu mood yang dipilih.
- **Mirror selfie** dibakar ke foto saat jepret agar hasil = yang dilihat di layar (bisa dimatikan di config).
- **Frame placeholder** dibuat dengan skrip karena desain final belum tersedia. Satu frame (Classic) sengaja 4:5 untuk membuktikan rasio berbeda didukung.
