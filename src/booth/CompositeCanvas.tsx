import { useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { outputSize, type FrameConfig } from '../config/frames'
import { useFitBox } from '../lib/useFitBox'
import { coverRect, render, slotRect, type Placement, type PhotoSource } from './render'

interface Props {
  frame: FrameConfig
  frameImg: HTMLImageElement
  photos: (PhotoSource | null)[]
  placements: Placement[]
  /** Slots the visitor may drag/pinch. */
  editable: number[]
  /** Slot drawn as "current" (placeholder tint). */
  highlight?: number
  onPlacement: (slot: number, update: (p: Placement) => Placement) => void
  /** Called when a gesture starts on a slot (to select it for the zoom slider). */
  onSelect?: (slot: number) => void
  className?: string
}

/**
 * Screen-resolution preview of the composite, drawn by the same render() as the export.
 * Drag moves and pinch zooms the photo under the finger (gestures from NadheWedd FrameStudio).
 */
export function CompositeCanvas({ frame, frameImg, photos, placements, editable, highlight, onPlacement, onSelect, className = '' }: Props) {
  const out = outputSize(frame)
  const { ref: fitRef, w: fitW, h: fitH } = useFitBox(out.w / out.h)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<number | null>(null)
  const active = useRef<number | null>(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !fitW) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = Math.round(fitW * dpr)
    const H = Math.round(fitH * dpr)
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W
      canvas.height = H
    }
    const ctx = canvas.getContext('2d')
    if (ctx) render(ctx, W, H, frame, frameImg, photos, placements, { placeholders: true, highlight })
  }, [fitW, fitH, frame, frameImg, photos, placements, highlight])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    return () => {
      if (canvas) canvas.width = canvas.height = 0
    }
  }, [])

  /** Slot under a point (CSS px relative to the canvas), among the editable ones. */
  const hit = (cx: number, cy: number) => {
    for (const i of editable) {
      const r = slotRect(frame, frame.photoSlots[i], fitW, fitH)
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h && photos[i]) return i
    }
    return null
  }

  const move = (slot: number, dxCss: number, dyCss: number) => {
    const photo = photos[slot]
    if (!photo || !fitW) return
    const r = slotRect(frame, frame.photoSlots[slot], fitW, fitH)
    onPlacement(slot, (p) => {
      const c = coverRect(photo, r.w, r.h, p)
      return {
        ...p,
        x: c.ox > 0 ? Math.max(-1, Math.min(1, p.x - (2 * dxCss) / c.ox)) : 0,
        y: c.oy > 0 ? Math.max(-1, Math.min(1, p.y - (2 * dyCss) / c.oy)) : 0,
      }
    })
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    if (pointers.current.size === 0) {
      active.current = hit(e.clientX - box.left, e.clientY - box.top)
      if (active.current !== null) onSelect?.(active.current)
    }
    if (active.current === null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    const slot = active.current
    if (!prev || slot === null) return
    const next = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, next)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current) {
        const ratio = d / pinch.current
        onPlacement(slot, (p) => ({ ...p, zoom: Math.max(1, Math.min(4, p.zoom * ratio)) }))
      }
      pinch.current = d
    } else {
      move(slot, next.x - prev.x, next.y - prev.y)
    }
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) active.current = null
  }

  return (
    <div ref={fitRef} className={`grid place-items-center ${className}`}>
      <canvas
        ref={canvasRef}
        aria-label={`Pratinjau foto dengan frame ${frame.name}`}
        style={{ width: fitW, height: fitH }}
        className="touch-none drop-shadow-[0_14px_24px_rgb(74_41_37/0.28)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  )
}
