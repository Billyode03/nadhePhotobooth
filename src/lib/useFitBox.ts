import { useLayoutEffect, useRef, useState } from 'react'

/** Largest w×h with the given ratio that fits inside the observed element (contain). */
export function useFitBox(ratio: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !ratio) return
    const update = () => {
      const W = el.clientWidth
      const H = el.clientHeight
      const w = Math.min(W, H * ratio)
      setSize({ w: Math.floor(w), h: Math.floor(w / ratio) })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ratio])

  return { ref, ...size }
}
