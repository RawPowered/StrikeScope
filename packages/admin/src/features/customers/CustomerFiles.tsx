import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileText, Upload, Trash2, PenLine } from 'lucide-react'
import { useCustomerAgreements, useCustomerFiles } from '../../hooks/useCrmQueries'
import { useConfirm } from '../../components/ConfirmDialog'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { FormDialog } from '../../components/ViewToggle'
import { LoadingState, EmptyState } from '../../components/EmptyState'
import { api } from '../../api'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/textarea'
import { Badge } from '../../components/ui/badge'
import type { Agreement } from '@strikescope/shared/src/types'

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'destructive' | 'secondary'> = {
  draft: 'secondary',
  signed: 'success',
  cancelled: 'destructive',
}

export default function CustomerFiles({ customerId }: { customerId: string }) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showNewAgreement, setShowNewAgreement] = useState(false)
  const [terms, setTerms] = useState('')
  const [uploading, setUploading] = useState(false)

  const { data: agreements = [], isLoading: loadingAgreements, refetch: refetchAgreements } = useCustomerAgreements(customerId)
  const { data: files = [], isLoading: loadingFiles, refetch: refetchFiles } = useCustomerFiles(customerId)

  const generalFiles = files.filter(f => f.kind !== 'agreement')

  const handleCreateAgreement = async () => {
    const r = await api.post(`/api/admin/customers/${customerId}/agreements`, { terms })
    if (r.ok) {
      toast.success('Agreement created')
      setShowNewAgreement(false)
      setTerms('')
      refetchAgreements()
      qc.invalidateQueries({ queryKey: ['customers', customerId, 'files'] })
    } else {
      toast.error(r.error || 'Failed to create agreement')
    }
  }

  const handleSign = async (agreement: Agreement) => {
    const ok = await confirm({ title: 'Sign agreement?', description: 'Mark this agreement as signed.' })
    if (!ok) return
    const r = await api.post(`/api/admin/agreements/${agreement.id}/sign`, {})
    if (r.ok) {
      toast.success('Agreement signed')
      refetchAgreements()
    } else {
      toast.error(r.error || 'Failed to sign')
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('kind', 'other')
    try {
      const r = await api.upload(`/api/admin/customers/${customerId}/files`, form)
      if (r.ok) {
        toast.success('File uploaded')
        refetchFiles()
      } else {
        toast.error(r.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteFile = async (fileId: string, name: string) => {
    const ok = await confirm({ title: 'Delete file?', description: name, variant: 'destructive', confirmLabel: 'Delete' })
    if (!ok) return
    const r = await api.del(`/api/admin/customers/${customerId}/files/${fileId}`)
    if (r.ok) {
      toast.success('File deleted')
      refetchFiles()
    } else {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Agreements
          </CardTitle>
          <Button size="sm" onClick={() => setShowNewAgreement(true)}>+ New Agreement</Button>
        </CardHeader>
        <CardContent>
          {loadingAgreements ? (
            <LoadingState rows={3} />
          ) : agreements.length === 0 ? (
            <EmptyState title="No agreements yet" description="Create an agreement to track customer terms." />
          ) : (
            <div className="space-y-2">
              {agreements.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <button type="button" className="font-medium text-sm text-left hover:text-primary hover:underline" onClick={() => navigate(`/company/agreements/${a.id}`)}>
                      {a.projectName || 'General agreement'}
                    </button>
                    <div className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[a.status] || 'secondary'}>{a.status}</Badge>
                    {a.status === 'draft' && (
                      <Button variant="outline" size="sm" onClick={() => handleSign(a)}>
                        <PenLine className="h-3.5 w-3.5" /> Sign
                      </Button>
                    )}
                    {a.documentUrl && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={a.documentUrl} target="_blank" rel="noopener noreferrer">Doc</a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={showNewAgreement}
        title="New Agreement"
        onClose={() => setShowNewAgreement(false)}
        footer={
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowNewAgreement(false)}>Cancel</Button>
            <Button onClick={handleCreateAgreement}>Create</Button>
          </div>
        }
      >
        <Textarea placeholder="Terms..." rows={5} value={terms} onChange={e => setTerms(e.target.value)} />
      </FormDialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Documents</CardTitle>
          <div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingFiles ? (
            <LoadingState rows={3} />
          ) : generalFiles.length === 0 ? (
            <EmptyState title="No documents" description="Upload files for this customer account." />
          ) : (
            <div className="space-y-2">
              {generalFiles.map(f => (
                <div key={f.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <div className="font-medium text-sm">{f.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{f.kind} · {new Date(f.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/uploads/${f.storageKey}`} target="_blank" rel="noopener noreferrer">View</a>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteFile(f.id, f.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
