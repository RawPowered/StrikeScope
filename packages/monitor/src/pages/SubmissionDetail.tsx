import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { SubmissionDetail as SubmissionDetailType } from '@strikescope/shared/src/types'

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sub, setSub] = useState<SubmissionDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    if (!id) return
    api.get<SubmissionDetailType>(`/api/submissions/${id}`)
      .then(r => {
        if (r.ok && r.data) setSub(r.data)
        else setError('Submission not found')
        setLoading(false)
      })
      .catch(() => { setError('Network error'); setLoading(false) })
  }, [id])

  const updateStatus = async (status: string) => {
    if (!id) return
    const r = await api.patch(`/api/submissions/${id}/status`, { status }).catch(() => null)
    if (r && r.ok && r.data) setSub(r.data as SubmissionDetailType)
    else setError('Failed to update status')
  }

  if (loading) return <div><h1>Loading...</h1></div>
  if (error) return <div><h1>{error}</h1></div>
  if (!sub) return <div><h1>Not found</h1></div>

  const statusClass = (s: string) => {
    switch (s) {
      case 'approved': return 'badge approved'
      case 'rejected': return 'badge rejected'
      default: return 'badge pending'
    }
  }

  return (
    <div className="submission-detail">
      <button className="btn" onClick={() => navigate('/')} style={{ marginBottom: 12 }}>&larr; Back</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Submission {sub.id.slice(0, 8)}...</h1>
        <span className={statusClass(sub.status)}>{sub.status}</span>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <p><strong>Installer:</strong> {sub.installerName}</p>
        <p><strong>Captured:</strong> {sub.capturedAt ? new Date(sub.capturedAt).toLocaleString() : 'N/A'}</p>
        <p><strong>Submitted:</strong> {new Date(sub.submittedAt).toLocaleString()}</p>
        {sub.gpsLat != null && sub.gpsLng != null && (
          <p><strong>Location:</strong> {sub.gpsLat.toFixed(6)}, {sub.gpsLng.toFixed(6)}</p>
        )}
        <p><strong>Photos:</strong> {sub.images?.length || 0}</p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="status-actions">
        <button className="btn success" onClick={() => updateStatus('approved')} disabled={sub.status === 'approved'}>
          Approve
        </button>
        <button className="btn danger" onClick={() => updateStatus('rejected')} disabled={sub.status === 'rejected'}>
          Reject
        </button>
      </div>

      {sub.images && sub.images.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '16px 0 8px' }}>Photos ({sub.images.length})</h2>
          <div className="image-grid">
            {sub.images.map(img => (
              <div key={img.id} style={{ position: 'relative' }}>
                <img
                  src={`${baseUrl}/uploads/${img.filepath}`}
                  alt=""
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {img.capturedAt ? new Date(img.capturedAt).toLocaleTimeString() : ''}
                  {img.gpsLat != null ? ` 📍${img.gpsLat.toFixed(4)}` : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
