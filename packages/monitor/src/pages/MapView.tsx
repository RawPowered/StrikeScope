import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Submission } from '@strikescope/shared/src/types'

export default function MapView() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get<Submission[]>('/api/submissions')
      .then(r => {
        if (r.ok && r.data) setSubmissions(r.data.filter(s => s.gpsLat != null && s.gpsLng != null))
      })
      .catch(() => setError('Failed to load submissions'))
  }, [])

  const statusClass = (status: string) => {
    switch (status) {
      case 'approved': return 'badge approved'
      case 'rejected': return 'badge rejected'
      default: return 'badge pending'
    }
  }

  return (
    <div>
      <h1>Map View</h1>
      {error && <p className="error">{error}</p>}
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {submissions.length} location{submissions.length !== 1 ? 's' : ''}
      </p>

      <div className="map-placeholder">
        Map integration ready — add your preferred map library here
      </div>

      {submissions.map(s => (
        <div key={s.id} className="card" onClick={() => navigate(`/submissions/${s.id}`)} style={{ cursor: 'pointer' }}>
          <div className="card-header">
            <span className="card-title">{s.id.slice(0, 8)}...</span>
            <span className={statusClass(s.status)}>{s.status}</span>
          </div>
          <div className="card-meta">
            📍 {s.gpsLat != null ? s.gpsLat.toFixed(6) : '—'}, {s.gpsLng != null ? s.gpsLng.toFixed(6) : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}
