import { useEffect, useState } from 'react'
import { api, getActionToken, setActionToken } from '../api'

export default function CapturePage() {
  const [projectId, setProjectId] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get<any>('/api/field/sessions/active').then(r => {
      if (r.ok && r.data?.session?.projectId) setProjectId(r.data.session.projectId)
    })
  }, [])

  useEffect(() => {
    if (!projectId) return
    api.get<any[]>(`/api/field/projects/${projectId}/checklist`).then(r => {
      if (r.ok && r.data) setItems(r.data.filter((i: any) => i.status !== 'completed'))
    })
  }, [projectId])

  const validateAction = async () => {
    const token = getActionToken()
    if (!token || !projectId) throw new Error('No active session token')
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 }))
    const r = await api.post<{ nextToken: string }>('/api/field/sessions/action', {
      projectId,
      actionToken: token,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    })
    if (!r.ok) throw new Error(r.error || 'Geo validation failed')
    if (r.data?.nextToken) setActionToken(r.data.nextToken)
    return r.data
  }

  const completeStep = async (itemId: string) => {
    setError('')
    setMsg('')
    try {
      await validateAction()
      setMsg(`Step ${itemId} marked ready for capture (session validated)`)
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div>
      <h1>Field Capture</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Geo-gated — must be on worksite with active session</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="card" style={{ borderColor: 'var(--success)' }}>{msg}</div>}
      {!projectId ? (
        <p>No active project session.</p>
      ) : (
        items.map(item => (
          <div key={item.id} className="card">
            <strong>{item.label}</strong>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{item.titleEn}</p>
            <button className="btn" style={{ marginTop: 8 }} onClick={() => completeStep(item.id)}>Validate &amp; Continue</button>
          </div>
        ))
      )}
    </div>
  )
}
