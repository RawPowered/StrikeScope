import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './api'
import type { GuideItem } from '@strikescope/shared/src/types'
import { useGallery } from './hooks/useGallery'
import { useImageReady } from './hooks/useImageReady'
import Header from './components/Header'
import GuideView from './components/GuideView'
import CameraView from './components/CameraView'
import PhotoQueue from './components/PhotoQueue'
import ProgressBar from './components/ProgressBar'
import { createQueue, addToQueue, totalTaken, totalRequired, isItemComplete } from './lib/queue'
import { extractMeta } from './lib/exif'

type Lang = 'en' | 'es'
type Mode = 'reference' | 'camera'

export default function App() {
  const [lang, setLang] = useState<Lang>('en')
  const [mode, setMode] = useState<Mode>('reference')
  const [items, setItems] = useState<GuideItem[]>([])
  const [queue, setQueue] = useState(() => createQueue([]))
  const [submitted, setSubmitted] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [installerName, setInstallerName] = useState(() => localStorage.getItem('installerName') || '')
  const [showNamePrompt, setShowNamePrompt] = useState(!localStorage.getItem('installerName'))
  const queueRef = useRef(queue)
  queueRef.current = queue

  useEffect(() => {
    api.get<GuideItem[]>('/api/guide')
      .then(r => {
        if (r.ok && r.data) {
          setItems(r.data)
          setQueue(createQueue(r.data))
        } else {
          setError('Failed to load photo guide')
        }
      })
      .catch(() => setError('Network error — could not load guide'))
  }, [])

  const { idx, setIdx, goNext, goPrev, total, current, hasPrev, hasNext, handleTouchStart, handleTouchEnd } = useGallery<GuideItem>(items)
  const { ready } = useImageReady(idx)

  const handleCapture = useCallback(async (data: string) => {
    if (!current) return
    const meta = await extractMeta(data)

    let shouldAdvance = false
    setQueue(q => {
      const newQ = addToQueue(q, current.id, {
        data,
        capturedAt: meta.capturedAt,
        gpsLat: meta.gpsLat ?? undefined,
        gpsLng: meta.gpsLng ?? undefined,
      })
      if (isItemComplete(newQ, current.id)) shouldAdvance = true
      return newQ
    })

    if (shouldAdvance && hasNext) {
      goNext()
    }
  }, [current, hasNext, goNext])

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      let gpsLat = 0
      let gpsLng = 0
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })
        )
        gpsLat = pos.coords.latitude
        gpsLng = pos.coords.longitude
      } catch {
        // geolocation unavailable — submit without GPS
      }

      const q = queueRef.current
      const body = {
        installerName: installerName || 'Installer',
        gpsLat,
        gpsLng,
        capturedAt: new Date().toISOString(),
        images: Object.entries(q).flatMap(([guideItemId, entry]) =>
          entry.photos.map(p => ({
            guideItemId,
            capturedAt: p.capturedAt,
            gpsLat: p.gpsLat,
            gpsLng: p.gpsLng,
            data: p.data,
          }))
        ),
      }
      const r = await api.post('/api/submissions', body)
      if (r.ok) setSubmitted(true)
      else setError('Submission failed: ' + (r.error || 'unknown error'))
    } catch {
      setError('Network error — submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const taken = totalTaken(queue)
  const required = totalRequired(queue)

  if (showNamePrompt) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 32, gap: 16, background: 'var(--gunmetal)' }}>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 600, textAlign: 'center' }}>
          {lang === 'en' ? 'Enter Your Name' : 'Ingrese su Nombre'}
        </h1>
        <input
          autoFocus
          value={installerName}
          onChange={e => setInstallerName(e.target.value)}
          placeholder={lang === 'en' ? 'Your name' : 'Su nombre'}
          style={{ padding: '10px 14px', borderRadius: 6, border: 'none', fontSize: 16, width: '100%', maxWidth: 280, textAlign: 'center' }}
          onKeyDown={e => { if (e.key === 'Enter' && installerName.trim()) { localStorage.setItem('installerName', installerName.trim()); setShowNamePrompt(false) } }}
        />
        <button
          className="btn-submit"
          style={{ width: 'auto', padding: '10px 32px' }}
          onClick={() => { if (installerName.trim()) { localStorage.setItem('installerName', installerName.trim()); setShowNamePrompt(false) } }}
        >
          {lang === 'en' ? 'Start' : 'Comenzar'}
        </button>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col">
      <Header
        lang={lang}
        onToggleLang={() => setLang(l => l === 'en' ? 'es' : 'en')}
        mode={mode}
        onToggleMode={() => setMode(m => m === 'reference' ? 'camera' : 'reference')}
      />

      {error && (
        <div style={{ background: '#d32f2f', color: '#fff', padding: '8px 16px', fontSize: 13, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {mode === 'reference' ? (
        <>
          <GuideView
            items={items}
            idx={idx}
            onPrev={goPrev}
            onNext={goNext}
            onTap={() => setLightbox(true)}
            hasPrev={hasPrev}
            hasNext={hasNext}
            lang={lang}
            ready={ready}
            handleTouchStart={handleTouchStart}
            handleTouchEnd={handleTouchEnd}
          />

          {current && (
            <>
              <div className="caption">
                <span className="caption-label">{current.label}</span>
                <h2 className="caption-title">{lang === 'en' ? current.titleEn : current.titleEs}</h2>
                <p className="caption-desc">{lang === 'en' ? current.descEn : current.descEs}</p>
              </div>
              <PhotoQueue queue={queue} itemId={current.id} lang={lang} />
            </>
          )}

          <ProgressBar taken={taken} required={required} lang={lang} />
        </>
      ) : (
        <CameraView
          onCapture={handleCapture}
          active={true}
          onActivate={() => {}}
        />
      )}

      <div className="submit-bar">
        <button
          className={`btn-submit ${submitted ? 'success' : ''}`}
          onClick={handleSubmit}
          disabled={taken === 0 || submitted || submitting}
        >
          {submitting
            ? (lang === 'en' ? 'Submitting...' : 'Enviando...')
            : submitted
              ? (lang === 'en' ? 'Submitted ✓' : 'Enviado ✓')
              : (lang === 'en' ? `Submit (${taken}/${required})` : `Enviar (${taken}/${required})`)}
        </button>
      </div>

      {lightbox && current && total > 0 && (
        <div className="lightbox" onClick={() => setLightbox(false)}>
          <button className="lightbox-close" onClick={() => setLightbox(false)} aria-label="Close">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <img
            src={`/examples/${encodeURIComponent(current.label || '')}.png`}
            alt=""
            className="lightbox-img"
            onClick={e => e.stopPropagation()}
          />
          <span className="lightbox-counter">{idx + 1} / {total}</span>
        </div>
      )}
    </div>
  )
}
