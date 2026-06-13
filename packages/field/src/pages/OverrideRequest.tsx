import { useEffect, useState } from 'react'
import { api } from '../api'

export default function OverrideRequestPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [projectId, setProjectId] = useState('')
  const [actionType, setActionType] = useState('capture')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    api.get<any[]>('/api/field/projects').then(r => { if (r.ok && r.data) setJobs(r.data) })
  }, [])

  const submit = async () => {
    if (!projectId || !reason.trim()) return
    setError('')
    const r = await api.post('/api/field/override-requests', { projectId, actionType, reason })
    if (r.ok) setDone(true)
    else setError(r.error || 'Request failed')
  }

  return (
    <div>
      <h1>Off-site override</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
        Request admin approval to capture photos or complete tasks when not on site.
      </p>
      {done ? (
        <div className="card">Request submitted. An admin will review it in Field Overrides.</div>
      ) : (
        <>
          {error && <div className="error">{error}</div>}
          <label style={{ fontSize: 14, color: 'var(--muted)' }}>Job</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="">—</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <label style={{ fontSize: 14, color: 'var(--muted)' }}>Action</label>
          <select value={actionType} onChange={e => setActionType(e.target.value)} style={{ marginBottom: 12 }}>
            <option value="capture">Photo capture</option>
            <option value="task_complete">Complete task</option>
          </select>
          <label style={{ fontSize: 14, color: 'var(--muted)' }}>Reason</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} />
          <button className="btn" style={{ marginTop: 12 }} onClick={submit} disabled={!projectId || !reason.trim()}>
            Submit request
          </button>
        </>
      )}
    </div>
  )
}
