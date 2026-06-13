import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { api } from '../api'
import { RecordDetailShell, useRecordDetail } from '../components/record-detail'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/EmptyState'

interface SubmissionImage {
  id: string; submissionId: string; projectTaskItemId: string | null
  filename: string; filepath: string; url: string
  gpsLat: number | null; gpsLng: number | null; capturedAt: string | null
}

interface SubmissionRecord {
  id: string; projectId: string; projectTaskItemId: string | null
  installerId: string | null; installerName: string
  gpsLat: number | null; gpsLng: number | null
  capturedAt: string | null; submittedAt: string
  status: string; projectName: string; customerName: string | null
  photoCount: number; images: SubmissionImage[]
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  pending: 'secondary',
  approved: 'success',
  rejected: 'destructive',
}

export default function SubmissionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lightbox, setLightbox] = useState<string | null>(null)

  const { record: sub, isLoading, isError, refetch } = useRecordDetail<SubmissionRecord>(
    id,
    id ? `/api/admin/submissions/${id}` : '',
  )

  const updateStatus = async (status: string) => {
    if (!id) return
    const r = await api.patch(`/api/admin/submissions/${id}/status`, { status }).catch(() => null)
    if (r?.ok) {
      toast.success(`Submission ${status}`)
      refetch()
    } else {
      toast.error('Failed to update status')
    }
  }

  return (
    <RecordDetailShell
      loading={isLoading}
      notFound={isError || (!isLoading && !sub)}
      backLabel="Back to tasks"
      onBack={() => navigate('/company/submissions')}
      title={sub?.installerName || 'Submission'}
      description={[sub?.projectName && `Project: ${sub.projectName}`, sub?.customerName && `Customer: ${sub.customerName}`].filter(Boolean).join(' \u00B7 ')}
      actions={
        sub ? (
          <div className="flex gap-2 items-center">
            <Badge variant={STATUS_VARIANT[sub.status] || 'secondary'} className="text-sm px-3 py-1">{sub.status}</Badge>
            {sub.status === 'pending' && (
              <>
                <Button size="sm" onClick={() => updateStatus('approved')}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => updateStatus('rejected')}>Reject</Button>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      {sub && (
        <>
          <Card className="mb-6">
            <CardContent className="pt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div><span className="text-muted-foreground">Submitted:</span> {new Date(sub.submittedAt).toLocaleString()}</div>
              {sub.capturedAt && <div><span className="text-muted-foreground">Captured:</span> {new Date(sub.capturedAt).toLocaleString()}</div>}
              {sub.gpsLat != null && sub.gpsLng != null && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">GPS:</span> {sub.gpsLat.toFixed(5)}, {sub.gpsLng.toFixed(5)}
                  <a
                    href={`https://www.google.com/maps?q=${sub.gpsLat},${sub.gpsLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center ml-1"
                  >
                    Map <ExternalLink className="h-3 w-3 ml-0.5" />
                  </a>
                </div>
              )}
              <div><span className="text-muted-foreground">Photos:</span> {sub.photoCount}</div>
            </CardContent>
          </Card>

          {sub.images.length === 0 ? (
            <EmptyState title="No images" description="This submission has no photos attached." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {sub.images.map(img => (
                <Card key={img.id} className="overflow-hidden cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setLightbox(img.url)}>
                  <img src={img.url} alt={img.filename} className="w-full h-44 object-cover" />
                  {img.gpsLat != null && (
                    <CardContent className="py-2 text-xs text-muted-foreground">
                      {img.gpsLat.toFixed(4)}, {img.gpsLng?.toFixed(4)}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {lightbox && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 cursor-pointer p-4"
              onClick={() => setLightbox(null)}
            >
              <img src={lightbox} alt="" className="max-w-[92%] max-h-[92%] rounded-lg" />
            </div>
          )}
        </>
      )}
    </RecordDetailShell>
  )
}
