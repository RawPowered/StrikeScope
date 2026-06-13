import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

export default function Jobs() {
  const [jobs, setJobs] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<any[]>('/api/field/projects').then(r => {
      if (r.ok && r.data) setJobs(r.data)
      else setError(r.error || 'Failed to load jobs')
    }).catch(() => setError('Network error'))
  }, [])

  return (
    <div>
      <h1>Active Jobs</h1>
      {error && <div className="error">{error}</div>}
      {jobs.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No active jobs assigned.</p>
      ) : (
        jobs.map(job => (
          <div key={job.id} className="card">
            <strong>{job.name}</strong>
            <p style={{ margin: '4px 0', color: 'var(--muted)', fontSize: 14 }}>{job.customerName} · {job.percentComplete}%</p>
            {job.stale?.isStale && <p style={{ color: '#fbbf24', fontSize: 13 }}>Stale: {job.stale.detail}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Link to={`/clock-in?projectId=${job.id}`} className="btn" style={{ textAlign: 'center', textDecoration: 'none', flex: 1 }}>Clock In</Link>
              <Link to={`/calendar?projectId=${job.id}`} className="btn btn-outline" style={{ textAlign: 'center', textDecoration: 'none', flex: 1 }}>Calendar</Link>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
