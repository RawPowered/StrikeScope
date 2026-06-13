type Lang = 'en' | 'es'

interface Props {
  lang: Lang
  onToggleLang: () => void
  mode: 'reference' | 'camera'
  onToggleMode: () => void
}

export default function Header({ lang, onToggleLang, mode, onToggleMode }: Props) {
  return (
    <header className="header">
      <span className="header-brand">StrikeScope</span>
      <div className="header-actions">
        <span className={`mode-badge ${mode}`}>
          {mode === 'reference' ? (lang === 'en' ? 'Guide' : 'Guía') : (lang === 'en' ? 'Camera' : 'Cámara')}
        </span>
        <button onClick={onToggleMode} className="btn-pill" aria-label={mode === 'reference' ? 'Switch to camera' : 'Switch to guide'}>
          {mode === 'reference' ? '📷' : '📋'}
        </button>
        <button onClick={onToggleLang} className="btn-pill" aria-label={lang === 'en' ? 'Switch to Spanish' : 'Switch to English'}>
          {lang === 'en' ? 'ES' : 'EN'}
        </button>
      </div>
    </header>
  )
}
