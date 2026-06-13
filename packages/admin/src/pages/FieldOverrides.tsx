import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { LoadingState, EmptyState } from '../components/EmptyState'

export default function FieldOverrides() {
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({})
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['field-overrides'],
    queryFn: async () => {
      const r = await api.get<any[]>('/api/admin/field/overrides')
      return r.ok && r.data ? r.data : []
    },
  })

  const review = async (id: string, status: 'approved' | 'denied') => {
    const r = await api.patch(`/api/admin/field/overrides/${id}`, { status, reviewNote: reviewNote[id] || '' }).catch(() => null)
    if (r?.ok) {
      toast.success(status === 'approved' ? 'Approved — grant issued' : 'Denied')
      refetch()
    } else toast.error(r?.error || 'Failed')
  }

  if (isLoading) return <><PageHeader title="Field Overrides" /><LoadingState rows={4} /></>

  const pending = rows.filter((r: any) => r.status === 'pending')

  return (
    <div>
      <PageHeader title="Field Override Requests" description="Approve off-site edits for geo-sensitive field actions." />
      {pending.length === 0 ? (
        <EmptyState title="No pending requests" description="Field users can request off-site edit permission from the mobile app." />
      ) : (
        <div className="space-y-3">
          {pending.map((row: any) => (
            <Card key={row.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-medium">{row.userName}</span>
                  <Badge variant="secondary">{row.actionType}</Badge>
                  <span className="text-sm text-muted-foreground">{row.projectName}</span>
                </div>
                <p className="text-sm">{row.reason}</p>
                <Textarea placeholder="Review note (optional)" value={reviewNote[row.id] || ''} onChange={e => setReviewNote(p => ({ ...p, [row.id]: e.target.value }))} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => review(row.id, 'approved')}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => review(row.id, 'denied')}>Deny</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
