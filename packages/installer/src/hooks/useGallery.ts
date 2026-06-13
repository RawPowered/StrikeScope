import { useState, useCallback, useEffect, useRef } from 'react'

export function useGallery<T extends { label: string }>(items: T[]) {
  const [idx, setIdx] = useState(0)
  const total = items.length
  const current = items[idx]
  const touchX = useRef<number | null>(null)

  const goNext = useCallback(() => setIdx(i => Math.min(i + 1, total - 1)), [total])
  const goPrev = useCallback(() => setIdx(i => Math.max(i - 1, 0)), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchX.current = e.targetTouches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchX.current === null) return
    const d = touchX.current - e.changedTouches[0].clientX
    if (Math.abs(d) > 50) {
      if (d > 0) goNext()
      else goPrev()
    }
    touchX.current = null
  }, [goNext, goPrev])

  return { idx, setIdx, goNext, goPrev, total, current, hasPrev: idx > 0, hasNext: idx < total - 1, handleTouchStart, handleTouchEnd }
}
