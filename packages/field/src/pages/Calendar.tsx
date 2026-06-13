import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'

export default function CalendarPage() {
  const [params] = useSearchParams()
  const projectId = params.get('projectId') || ''
  const [jobs, setJobs] = useState<any[]>([])
  const [selected, setSelected] = useState(projectId)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    api.get<any[]>('/api/field/projects').then(r => { if (r.ok && r.data) setJobs(r.data) })
  }, [])

  useEffect(() => {
    if (!selected) return
    api.get(`/api/field/projects/${selected}/calendar`).then(r => {
      if (r.ok) setData(r.data)
    })
  }, [selected])

  return (
    <div>
      <h1>Calendar</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Read-only schedule — available off-site</p>
      <select value={selected} onChange={e => setSelected(e.target.value)} style={{ marginBottom: 16 }}>
        <option value="">Select project</option>
        {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
      </select>
      {data?.project && (
        <div className="card">
          <p><strong>Install:</strong> {data.project.scheduledInstallAt || 'Not scheduled'}</p>
          <p><strong>Sprint:</strong> {data.project.sprintStartedAt || '—'} → {data.project.sprintCompletedAt || 'in progress'}</p>
        </div>
      )}
      {(data?.items || []).map((item: any) => (
        <div key={item.id} className="card" style={{ fontSize: 14 }}>
          <strong>{item.label}</strong> — {item.status}
          {item.scheduledAt && <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>Scheduled: {item.scheduledAt}</p>}
        </div>
      ))}
    </div>
  )
}
