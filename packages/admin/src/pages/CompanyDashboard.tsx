import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/EmptyState'
import { cn } from '../lib/utils'

interface LeadStageCount { stageId: string; stageName: string; stageColor: string; count: number }
interface RecentActivity { id: string; description: string; createdAt: string; entityType: string; action: string }
interface MonthStats { newLeads: number; wonLeads: number; activeProjects: number; completedProjects: number }

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="pt-4 text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn('text-3xl font-bold mt-2 tabular-nums', className)}>{value}</p>
      </CardContent>
    </Card>
  )
}

export default function CompanyDashboard() {
  const navigate = useNavigate()
  const [pipeline, setPipeline] = useState<LeadStageCount[]>([])
  const [recent, setRecent] = useState<RecentActivity[]>([])
  const [month, setMonth] = useState<MonthStats>({ newLeads: 0, wonLeads: 0, activeProjects: 0, completedProjects: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<LeadStageCount[]>('/api/admin/lead-stages').then(r => {
        if (r.ok && r.data) {
          Promise.all(r.data.map(stage =>
            api.get<any[]>(`/api/admin/leads?stageId=${(stage as any).id || stage.stageId}`).then(lr => ({
              stageId: (stage as any).id || stage.stageId,
              stageName: (stage as any).name || stage.stageName,
              stageColor: (stage as any).color || stage.stageColor,
              count: lr.data?.length || 0,
            }))
          )).then(setPipeline)
        }
      }),
      api.get<RecentActivity[]>('/api/admin/activities?limit=5').then(r => {
        if (r.ok && r.data) setRecent(r.data)
      }),
      api.get<any>('/api/admin/leads').then(r => {
        if (r.ok && r.data) {
          const leads = r.data
          const now = new Date()
          const thisMonth = leads.filter((l: any) => {
            const d = new Date(l.createdAt)
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
          })
          setMonth(prev => ({
            ...prev,
            newLeads: thisMonth.length,
            wonLeads: leads.filter((l: any) => l.stageName === 'Won' && new Date(l.createdAt).getMonth() === now.getMonth()).length,
          }))
        }
      }),
      api.get<any>('/api/admin/projects').then(r => {
        if (r.ok && r.data) {
          setMonth(prev => ({
            ...prev,
            activeProjects: r.data.filter((p: any) => p.status === 'active').length,
            completedProjects: r.data.filter((p: any) => p.status === 'completed').length,
          }))
        }
      }),
    ]).finally(() => setLoading(false))
  }, [])

  const maxCount = Math.max(...pipeline.map(x => x.count), 1)

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Workspace overview" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="New Leads (month)" value={month.newLeads} className="text-orange-600" />
        <StatCard label="Won (month)" value={month.wonLeads} className="text-green-700" />
        <StatCard label="Active Projects" value={month.activeProjects} className="text-sky-600" />
        <StatCard label="Completed" value={month.completedProjects} className="text-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline</CardTitle></CardHeader>
          <CardContent>
            {pipeline.length === 0 ? (
              <EmptyState title="No stages configured" description="Add lead stages in Admin → Lead Stages." />
            ) : (
              <div className="flex gap-3 items-end h-28 pt-2">
                {pipeline.map(s => (
                  <div key={s.stageId} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-lg font-bold tabular-nums">{s.count}</span>
                    <div
                      className="w-full rounded-sm transition-all duration-300"
                      style={{ height: Math.max(4, (s.count / maxCount) * 64), background: s.stageColor || '#9E9E9E' }}
                    />
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">{s.stageName}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recent.length === 0 && <EmptyState title="No recent activity" />}
            {recent.map(a => (
              <div key={a.id} className="text-xs leading-relaxed">
                <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
                <span className="ml-1">{a.description || `${a.action} ${a.entityType}`}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate('/company/leads')}>View Leads</Button>
        <Button variant="outline" onClick={() => navigate('/company/customers')}>Customers</Button>
        <Button variant="outline" onClick={() => navigate('/company/projects')}>Projects</Button>
        <Button variant="outline" onClick={() => navigate('/company/submissions')}>Tasks</Button>
      </div>
    </div>
  )
}
