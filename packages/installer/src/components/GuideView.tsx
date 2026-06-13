import type { GuideItem } from '@strikescope/shared/src/types'

interface Props {
  items: GuideItem[]
  idx: number
  onPrev: () => void
  onNext: () => void
  onTap: () => void
  hasPrev: boolean
  hasNext: boolean
  lang: 'en' | 'es'
  ready: boolean
  handleTouchStart: (e: React.TouchEvent) => void
  handleTouchEnd: (e: React.TouchEvent) => void
}

export default function GuideView({
  items, idx, onPrev, onNext, onTap, hasPrev, hasNext,
  lang, ready, handleTouchStart, handleTouchEnd,
}: Props) {
  const item = items[idx]
  if (!item) return null

  const t = (o: string, es: string) => lang === 'en' ? o : es

  return (
    <div
      className="image-stage"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="image-frame" onClick={onTap}>
        {!ready && <div className="image-shimmer" />}

        <img
          key={item.id}
          src={`/examples/${encodeURIComponent(item.label || '')}.png`}
          alt={t(item.titleEn, item.titleEs)}
          draggable={false}
          style={{
            opacity: ready ? 1 : 0,
            transform: ready ? 'scale(1)' : 'scale(0.97)',
          }}
          onError={(e) => {
            const el = e.target as HTMLImageElement
            el.style.display = 'none'
            const parent = el.parentElement
            if (parent && !parent.querySelector('.img-fallback')) {
              const fb = document.createElement('div')
              fb.className = 'img-fallback'
              fb.textContent = 'Image not available'
              fb.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:14px'
              parent.appendChild(fb)
            }
          }}
        />

        <button onClick={e => { e.stopPropagation(); onPrev() }} disabled={!hasPrev} className="nav-arrow prev" aria-label="Previous">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button onClick={e => { e.stopPropagation(); onNext() }} disabled={!hasNext} className="nav-arrow next" aria-label="Next">
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
    </div>
  )
}
