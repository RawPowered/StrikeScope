import type { QueueState } from '../lib/queue'

interface Props {
  queue: QueueState
  itemId: string
  lang: 'en' | 'es'
}

export default function PhotoQueue({ queue, itemId, lang }: Props) {
  const entry = queue[itemId]
  if (!entry) return null

  return (
    <div className="photo-queue">
      <div className="queue-row">
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {lang === 'en' ? 'Photos' : 'Fotos'}: {entry.taken} / {entry.required}
        </span>
        <div className="queue-dots">
          {Array.from({ length: entry.required }, (_, i) => (
            <div
              key={i}
              className={`queue-dot ${i < entry.taken ? 'filled' : ''} ${i === entry.taken ? 'current' : ''}`}
            >
              {i < entry.taken ? '✓' : i + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
