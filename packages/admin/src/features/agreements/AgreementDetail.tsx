import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PenLine, ExternalLink } from 'lucide-react'
import { api } from '../../api'
import { useConfirm } from '../../components/ConfirmDialog'
import { RecordDetailShell, DetailRow, ActivityTimeline, useRecordDetail } from '../../components/record-detail'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/textarea'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'
import type { Agreement } from '@strikescope/shared/src/types'

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'destructive' | 'secondary'> = {
  draft: 'secondary',
  signed: 'success',
  cancelled: 'destructive',
}

export default function AgreementDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [edit, setEdit] = useState(false)
  const [terms, setTerms] = useState('')

  const { record: agreement, activities, isLoading, isError, refetch } = useRecordDetail<Agreement>(
    id,
    id ? `/api/admin/agreements/${id}` : '',
    'agreement',
  )

  const startEdit = () => {
    if (!agreement) return
    setTerms(agreement.terms || '')
    setEdit(true)
  }

  const handleSave = async () => {
    if (!id) return
    const r = await api.put(`/api/admin/agreements/${id}`, { terms }).catch(() => null)
    if (r?.ok) {
      toast.success('Agreement updated')
      setEdit(false)
      refetch()
    } else toast.error(r?.error || 'Failed to save')
  }

  const handleSign = async () => {
    if (!agreement || !id) return
    const ok = await confirm({ title: 'Sign agreement?', description: 'Mark this agreement as signed.' })
    if (!ok) return
    const r = await api.post(`/api/admin/agreements/${id}/sign`, {}).catch(() => null)
    if (r?.ok) {
      toast.success('Agreement signed')
      refetch()
    } else toast.error(r?.error || 'Failed to sign')
  }

  const handleCancel = async () => {
    if (!agreement || !id) return
    const ok = await confirm({
      title: 'Cancel agreement?',
      description: 'This cannot be undone.',
      variant: 'destructive',
      confirmLabel: 'Cancel agreement',
    })
    if (!ok) return
    const r = await api.del(`/api/admin/agreements/${id}`).catch(() => null)
    if (r?.ok) {
      toast.success('Agreement cancelled')
      refetch()
    } else toast.error(r?.error || 'Failed to cancel')
  }

  return (
    <RecordDetailShell
      loading={isLoading}
      notFound={isError || (!isLoading && !agreement)}
      backLabel="Back to Agreements"
      onBack={() => navigate('/company/agreements')}
      title={agreement?.projectName || agreement?.customerName || 'Agreement'}
      description={agreement?.customerName}
      actions={
        agreement && !edit && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[agreement.status] || 'secondary'}>{agreement.status}</Badge>
            {agreement.status === 'draft' && (
              <>
                <Button variant="outline" size="sm" onClick={startEdit}>Edit terms</Button>
                <Button variant="outline" size="sm" onClick={handleSign}>
                  <PenLine className="h-3.5 w-3.5" /> Sign
                </Button>
                <Button variant="destructive" size="sm" onClick={handleCancel}>Cancel</Button>
              </>
            )}
          </div>
        )
      }
    >
      {agreement && edit && (
        <Card className="mb-4">
          <CardContent className="pt-4 space-y-3">
            <div><Label>Terms</Label><Textarea className="mt-1" rows={6} value={terms} onChange={e => setTerms(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={() => setEdit(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {agreement && !edit && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Related records</CardTitle></CardHeader>
            <CardContent>
              <DetailRow label="Customer" value={
                agreement.customerId ? (
                  <button type="button" className="text-primary font-medium hover:underline" onClick={() => navigate(`/company/customers/${agreement.customerId}`)}>
                    {agreement.customerName || agreement.customerId}
                  </button>
                ) : '—'
              } />
              <DetailRow label="Project" value={
                agreement.projectId ? (
                  <button type="button" className="text-primary font-medium hover:underline" onClick={() => navigate(`/company/projects/${agreement.projectId}`)}>
                    {agreement.projectName || agreement.projectId}
                  </button>
                ) : '—'
              } />
              <DetailRow label="Signed" value={agreement.signedAt ? new Date(agreement.signedAt).toLocaleString() : '—'} />
              <DetailRow label="Created" value={new Date(agreement.createdAt).toLocaleString()} />
              {agreement.documentUrl && (
                <DetailRow label="Document" value={
                  <a href={agreement.documentUrl} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                    View document <ExternalLink className="h-3 w-3" />
                  </a>
                } />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Terms</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{agreement.terms || '—'}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {agreement && <ActivityTimeline activities={activities} />}
    </RecordDetailShell>
  )
}
