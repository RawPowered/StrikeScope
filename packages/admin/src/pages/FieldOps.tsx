import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { LoadingState, EmptyState } from '../components/EmptyState'

export default function FieldOps() {
  const { data: shifts = [], isLoading: loadingShifts } = useQuery({
    queryKey: ['field-open-shifts'],
    queryFn: async () => {
      const r = await api.get<any[]>('/api/admin/field/time-logs')
      return r.ok && r.data ? r.data : []
    },
  })
  const { data: stale = [], isLoading: loadingStale } = useQuery({
    queryKey: ['field-stale'],
    queryFn: async () => {
      const r = await api.get<any[]>('/api/admin/field/stale')
      return r.ok && r.data ? r.data : []
    },
  })

  if (loadingShifts || loadingStale) return <><PageHeader title="Field Ops" /><LoadingState rows={6} /></>

  return (
    <div className="space-y-8">
      <PageHeader title="Field Ops" description="Open shifts and stale project warnings." />
      <section>
        <h2 className="text-lg font-semibold mb-3">Active shifts</h2>
        {shifts.length === 0 ? (
          <EmptyState title="No open shifts" description="Crew clocked in on a job will appear here." />
        ) : (
          <div className="space-y-2">
            {shifts.map((s: any) => (
              <Card key={s.id}>
                <CardContent className="py-3 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{s.userName}</span>
                    <span className="text-sm text-muted-foreground ml-2">{s.projectName}</span>
                  </div>
                  <Badge>{s.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-3">Stale warnings</h2>
        {stale.length === 0 ? (
          <EmptyState title="No stale projects" description="Mid-progress idle jobs will surface here when template stale warnings are enabled." />
        ) : (
          <div className="space-y-2">
            {stale.map((p: any) => (
              <Card key={p.id} className="border-amber-500/40">
                <CardContent className="py-3">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">{p.customerName}</span>
                  <p className="text-xs text-amber-800 mt-1">{p.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
