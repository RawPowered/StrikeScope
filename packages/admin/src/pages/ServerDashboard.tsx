import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../auth'
import { api } from '../api'
import { useConfirm } from '../components/ConfirmDialog'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'

interface HealthData { status: string; mode: string }
interface StatsData {
  guideCount: number; submissionCount: number; connectionCount: number
  projectCount: number; companyCount: number; userCount: number; templateCount: number
}

const INSTALLER_URL = import.meta.env.VITE_INSTALLER_URL || 'http://localhost:5174'
const MONITOR_URL = import.meta.env.VITE_MONITOR_URL || 'http://localhost:5175'
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV

function StatCard({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <Card className="flex-1 min-w-[120px]">
      <CardContent className="pt-4 text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-3xl font-bold mt-2 tabular-nums ${className || ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

export default function ServerDashboard() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reseeding, setReseeding] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<HealthData>('/api/health'),
      api.get<StatsData>('/api/admin/stats'),
    ]).then(([h, s]) => {
      if (h.ok && h.data) setHealth(h.data)
      else setError('Failed to connect')
      if (s.ok && s.data) setStats(s.data)
    }).finally(() => setLoading(false))
  }, [])

  const handleReseed = async () => {
    const ok = await confirm({
      title: 'Reset seed data?',
      description: 'This will reset guide items, submissions, and connections to defaults.',
      variant: 'destructive',
      confirmLabel: 'Reset & Reseed',
    })
    if (!ok) return
    setReseeding(true)
    const r = await api.post<{ reseeded: number }>('/api/admin/reseed').catch(() => null)
    if (r?.ok && r.data) {
      toast.success(`Reseeded ${r.data.reseeded} guide items`)
      const s = await api.get<StatsData>('/api/admin/stats').catch(() => null)
      if (s?.ok && s.data) setStats(s.data)
    } else {
      toast.error('Reseed failed')
    }
    setReseeding(false)
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Server Dashboard" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Server Dashboard" description="Platform health and statistics" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Server</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {health ? (
              <>
                <p><span className="text-muted-foreground">Status:</span> {health.status}</p>
                <p><span className="text-muted-foreground">Mode:</span> {health.mode}</p>
              </>
            ) : (
              <p className="text-destructive">{error || 'Unavailable'}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Quick Launch</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="default" asChild>
              <a href={INSTALLER_URL} target="_blank" rel="noopener noreferrer">
                Open Installer <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button variant="secondary" asChild>
              <a href={MONITOR_URL} target="_blank" rel="noopener noreferrer">
                Open Monitor <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Companies" value={stats?.companyCount ?? '—'} className="text-primary" />
        <StatCard label="Users" value={stats?.userCount ?? '—'} className="text-violet-600" />
        <StatCard label="Projects" value={stats?.projectCount ?? '—'} className="text-sky-600" />
        <StatCard label="Templates" value={stats?.templateCount ?? '—'} />
        <StatCard label="Submissions" value={stats?.submissionCount ?? '—'} />
        <StatCard label="Connections" value={stats?.connectionCount ?? '—'} />
      </div>

      {isDev && user?.role === 'server_admin' && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Sandbox Controls</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Reset the database to the default seed state. This deletes all guide items, submissions, and connections.
            </p>
            <Button variant="destructive" onClick={handleReseed} disabled={reseeding}>
              {reseeding ? 'Reseeding…' : 'Reset & Reseed Database'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
