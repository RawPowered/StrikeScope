import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, setActionToken } from '../api'

function getGps(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 15000 },
    )
  })
}

export default function ClockInPage() {
  const [params] = useSearchParams()
  const projectId = params.get('projectId') || ''
  const qrToken = params.get('token') || ''
  const [jobs, setJobs] = useState<any[]>([])
  const [selected, setSelected] = useState(projectId)
  const [session, setSession] = useState<any>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get<any[]>('/api/field/projects').then(r => { if (r.ok && r.data) setJobs(r.data) })
    api.get<any>('/api/field/sessions/active').then(r => {
      if (r.ok && r.data) {
        setSession(r.data.session)
        if (r.data.session?.currentActionToken) setActionToken(r.data.session.currentActionToken)
      }
    })
  }, [])

  const start = async () => {
    if (!selected) return
    setError('')
    setBusy(true)
    try {
      const { lat, lng } = await getGps()
      const r = await api.post<{ session?: any; actionToken?: string }>('/api/field/sessions/start', { projectId: selected, lat, lng })
      if (r.ok && r.data) {
        setSession(r.data.session || { isActive: 1, projectId: selected })
        const tok = r.data.actionToken || r.data.session?.currentActionToken
        if (tok) setActionToken(tok)
      } else setError(r.error || 'Clock-in failed')
    } catch (e: any) {
      setError(e.message || 'GPS or network error')
    } finally {
      setBusy(false)
    }
  }

  const end = async () => {
    setBusy(true)
    try {
      const { lat, lng } = await getGps()
      const r = await api.post('/api/field/sessions/end', { lat, lng })
      if (r.ok) { setSession(null); setQr(null) }
      else setError(r.error || 'Clock-out failed')
    } catch (e: any) {
      setError(e.message || 'GPS error')
    } finally {
      setBusy(false)
    }
  }

  const issueQr = async () => {
    if (!session?.projectId) return
    const r = await api.post<{ token: string }>('/api/field/qr/issue', { projectId: session.projectId })
    if (r.ok && r.data?.token) {
      const url = `${window.location.origin}/clock-in?token=${r.data.token}&projectId=${session.projectId}`
      setQr(url)
    } else setError(r.error || 'Failed to issue QR')
  }

  const consumeQr = async () => {
    if (!qrToken) return
    setBusy(true)
    try {
      const { lat, lng } = await getGps()
      const r = await api.post<{ actionToken: string; projectId: string }>('/api/field/qr/consume', { token: qrToken, lat, lng })
      if (r.ok && r.data?.actionToken) {
        setActionToken(r.data.actionToken)
        setSession({ projectId: r.data.projectId, isActive: true })
      } else setError(r.error || 'QR check-in failed')
    } catch (e: any) {
      setError(e.message || 'GPS error')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (qrToken) consumeQr()
  }, [qrToken])

  return (
    <div>
      <h1>Clock In</h1>
      {error && <div className="error">{error}</div>}
      {session?.isActive ? (
        <div className="card">
          <p>On site — <strong>{session.projectName || session.projectId}</strong></p>
          <button className="btn" style={{ marginTop: 12 }} onClick={end} disabled={busy}>Clock Out</button>
          <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={issueQr}>Issue Crew QR</button>
          {qr && <p style={{ fontSize: 12, wordBreak: 'break-all', marginTop: 8 }}>{qr}</p>}
        </div>
      ) : (
        <>
          <label style={{ fontSize: 14, color: 'var(--muted)' }}>Select job</label>
          <select value={selected} onChange={e => setSelected(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="">—</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <button className="btn" onClick={start} disabled={busy || !selected}>Start Shift (GPS required)</button>
        </>
      )}
    </div>
  )
}
