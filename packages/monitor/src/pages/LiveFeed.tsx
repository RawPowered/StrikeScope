import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Submission, WsEvent } from '@strikescope/shared/src/types'

export default function LiveFeed() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [error, setError] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number>(0)
  const navigate = useNavigate()

  useEffect(() => {
    api.get<Submission[]>('/api/submissions')
      .then(r => { if (r.ok && r.data) setSubmissions(r.data) })
      .catch(() => setError('Failed to load submissions'))
  }, [])

  const connectWs = useCallback(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws/submissions'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg: WsEvent = JSON.parse(event.data)
        if (msg.type === 'new-submission') {
          setSubmissions(prev => [msg.data, ...prev])
        }
      } catch (e) {
        console.error('WS parse error', e)
      }
    }

    ws.onopen = () => { reconnectRef.current = 0 }
    ws.onerror = () => { /* onclose will fire next */ }
    ws.onclose = () => {
      // exponential backoff reconnection
      const delay = Math.min(1000 * Math.pow(2, reconnectRef.current), 30000)
      reconnectRef.current++
      setTimeout(connectWs, delay)
    }

    return ws
  }, [])

  useEffect(() => {
    const ws = connectWs()
    return () => ws.close()
  }, [connectWs])

  const statusClass = (status: string) => {
    switch (status) {
      case 'approved': return 'badge approved'
      case 'rejected': return 'badge rejected'
      default: return 'badge pending'
    }
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  return (
    <div>
      <h1>Live Feed</h1>
      {error && <p className="error">{error}</p>}
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
      </p>

      {submissions.map(s => (
        <div key={s.id} className="card" onClick={() => navigate(`/submissions/${s.id}`)} style={{ cursor: 'pointer' }}>
          <div className="card-header">
            <span className="card-title">{s.id.slice(0, 8)}...</span>
            <span className={statusClass(s.status)}>{s.status}</span>
          </div>
          <div className="card-meta">
            {s.photoCount} photo{s.photoCount !== 1 ? 's' : ''} &middot;{' '}
            {s.installerName} &middot;{' '}
            {timeAgo(s.submittedAt)}
          </div>
          {s.gpsLat != null && s.gpsLng != null && (
            <div className="card-meta" style={{ marginTop: 2 }}>
              📍 {s.gpsLat.toFixed(4)}, {s.gpsLng.toFixed(4)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
