import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { LoadingState, EmptyState } from '../components/EmptyState'
import type { JurisdictionRequest } from '@strikescope/shared/src/types'

export default function JurisdictionRequests() {
  const queryClient = useQueryClient()
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({})
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['jurisdiction-requests'],
    queryFn: async () => {
      const r = await api.get<JurisdictionRequest[]>('/api/admin/geo/jurisdiction-requests')
      return r.ok && r.data ? r.data : []
    },
  })

  const review = async (id: string, status: 'approved' | 'denied') => {
    const r = await api.patch(`/api/admin/geo/jurisdiction-requests/${id}`, {
      status, reviewNote: reviewNote[id] || '',
    }).catch(() => null)
    if (r?.ok) {
      toast.success(status === 'approved' ? 'Approved — added to territory options' : 'Denied')
      await queryClient.invalidateQueries({ queryKey: ['geo'] })
      await queryClient.invalidateQueries({ queryKey: ['jurisdiction-requests'] })
      refetch()
    } else toast.error(r?.error || 'Failed')
  }

  if (isLoading) return <><PageHeader title="Jurisdiction Requests" /><LoadingState rows={4} /></>

  const pending = rows.filter(r => r.status === 'pending')

  return (
    <div>
      <PageHeader
        title="Jurisdiction Requests"
        description="Approve new counties or cities submitted by project and sales managers."
      />
      {pending.length === 0 ? (
        <EmptyState title="No pending requests" description="Managers can request missing counties from address forms." />
      ) : (
        <div className="space-y-3">
          {pending.map(row => (
            <Card key={row.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-medium">{row.userName || row.userId}</span>
                  <Badge variant="secondary">{row.state}</Badge>
                  <span className="text-sm">{row.county}{row.city ? ` — ${row.city}` : ''}</span>
                  {row.zip && <span className="text-xs text-muted-foreground">ZIP {row.zip}</span>}
                </div>
                <p className="text-sm">{row.reason}</p>
                <Textarea
                  placeholder="Review note (optional)"
                  value={reviewNote[row.id] || ''}
                  onChange={e => setReviewNote(p => ({ ...p, [row.id]: e.target.value }))}
                />
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
