import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { LoadingState, EmptyState } from '../components/EmptyState'
import type { ActiveJobSummary } from '@strikescope/shared/src/types'

export default function ActiveJobs() {
  const navigate = useNavigate()
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['active-jobs'],
    queryFn: async () => {
      const r = await api.get<ActiveJobSummary[]>('/api/admin/projects/active')
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  if (isLoading) return <><PageHeader title="Active Jobs" /><LoadingState rows={6} /></>

  return (
    <div>
      <PageHeader title="Active Jobs" description="In-progress projects with open field work or active shifts." />
      {jobs.length === 0 ? (
        <EmptyState title="No active jobs" description="Active projects with incomplete checklists will appear here." />
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <Card key={job.id} className={job.stale?.isStale ? 'border-amber-500/50' : undefined}>
              <CardContent className="py-4 flex flex-wrap justify-between gap-4 items-start">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{job.name}</span>
                    {job.stale?.isStale && <Badge variant="secondary" className="bg-amber-100 text-amber-900">Stale</Badge>}
                    <Badge>{job.percentComplete}%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{job.customerName} · {job.completedSteps}/{job.totalSteps} steps</p>
                  {job.foremanName && <p className="text-xs text-muted-foreground">Foreman: {job.foremanName}</p>}
                  {job.openShifts?.length > 0 && (
                    <p className="text-xs text-green-700 mt-1">
                      On site: {job.openShifts.map(s => s.userName).join(', ')}
                    </p>
                  )}
                  {job.stale?.isStale && <p className="text-xs text-amber-700 mt-1">{job.stale.detail}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/company/projects/${job.id}`)}>View</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
