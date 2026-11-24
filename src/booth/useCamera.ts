// Front-camera stream. Adapted from NadheWedd's album CameraCapture
// (src/album/AlbumApp.tsx): same constraints and error mapping, plus a fallback
// for strict constraints, pause/resume when the tab is hidden, and a hard stop
// on unmount so the camera light turns off as soon as the visitor leaves.
import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'starting' | 'ready' | 'error'
export type CameraError = 'insecure' | 'unsupported' | 'denied' | 'notfound' | 'busy' | 'interrupted' | 'other'

export const CAMERA_ERROR_TEXT: Record<CameraError, { title: string; body: string }> = {
  insecure: {
    title: 'Kamera butuh koneksi aman',
    body: 'Halaman harus dibuka lewat https:// agar kamera bisa dipakai. Hubungi panitia, atau pilih foto dari galeri.',
  },
  unsupported: {
    title: 'Browser belum mendukung kamera',
    body: 'Buka tautan ini di Chrome (Android) atau Safari (iPhone), atau pilih foto dari galeri.',
  },
  denied: {
    title: 'Izin kamera ditolak',
    body: 'Ketuk ikon gembok/“aA” di bilah alamat, izinkan Kamera, lalu tekan Coba Lagi.',
  },
  notfound: {
    title: 'Kamera tidak ditemukan',
    body: 'Perangkat ini tidak punya kamera yang bisa dipakai. Silakan pilih foto dari galeri.',
  },
  busy: {
    title: 'Kamera sedang dipakai',
    body: 'Tutup aplikasi lain yang memakai kamera (video call, kamera), lalu tekan Coba Lagi.',
  },
  interrupted: {
    title: 'Kamera terhenti',
    body: 'Kamera berhenti saat halaman ditinggalkan. Tekan Coba Lagi untuk menyalakannya.',
  },
  other: {
    title: 'Kamera tidak bisa dibuka',
    body: 'Coba lagi sebentar, atau pilih foto dari galeri.',
  },
}

function classify(err: unknown): CameraError {
  const name = err instanceof Error || err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'notfound'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy'
  return 'other'
}

async function open(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
  } catch (err) {
    // Some laptops/webcams reject the size hints; retry with any camera.
    if (err instanceof Error && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    }
    throw err
  }
}

/** Runs the front camera while `active` is true. Attach `videoRef` to a muted, playsInline <video>. */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [error, setError] = useState<CameraError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden')

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', stop)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', stop)
    }
  }, [stop])

  useEffect(() => {
    if (!active || !visible) return
    let cancelled = false
    const fail = (e: CameraError) => {
      if (cancelled) return
      setError(e)
      setStatus('error')
    }

    const start = async () => {
      setStatus('starting')
      setError(null)
      if (!window.isSecureContext) return fail('insecure')
      if (!navigator.mediaDevices?.getUserMedia) return fail('unsupported')
      try {
        const stream = await open()
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          if (streamRef.current === stream) fail('interrupted')
        })
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        if (!cancelled) setStatus('ready')
      } catch (err) {
        // play() is interrupted when we stop on purpose; only report real failures.
        if (!cancelled) fail(classify(err))
      }
    }
    void start()
    return () => {
      cancelled = true
      stop()
    }
  }, [active, visible, attempt, stop])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { videoRef, status, error, retry, stop }
}
