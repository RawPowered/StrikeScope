interface Props {
  taken: number
  required: number
  lang: 'en' | 'es'
}

export default function ProgressBar({ taken, required, lang }: Props) {
  const pct = required > 0 ? Math.round((taken / required) * 100) : 0

  return (
    <div className="progress-section">
      <div className="progress-label">
        <span>{lang === 'en' ? 'Progress' : 'Progreso'}</span>
        <span>{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
