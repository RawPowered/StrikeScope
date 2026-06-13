import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../api'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import type { Contact } from '@strikescope/shared/src/types'

export function PhotoIdCapture({ contact, onUpdated }: { contact: Contact; onUpdated: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const needsId = contact.contactType === 'co_signer' && !contact.hasPhotoId

  const upload = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const r = await api.upload(`/api/admin/contacts/${contact.id}/photo-id`, fd).catch(() => null)
    setUploading(false)
    if (r?.ok) { toast.success('Photo ID uploaded'); onUpdated() }
    else toast.error(r?.error || 'Upload failed')
  }

  const remove = async () => {
    const r = await api.del(`/api/admin/contacts/${contact.id}/photo-id`).catch(() => null)
    if (r?.ok) { toast.success('Photo ID removed'); onUpdated() }
    else toast.error('Failed to remove')
  }

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Photo ID</span>
        {contact.hasPhotoId
          ? <Badge variant="success">On file</Badge>
          : needsId
            ? <Badge variant="destructive">Required for co-signer</Badge>
            : <Badge variant="outline">Not uploaded</Badge>}
      </div>
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
        const f = e.target.files?.[0]
        if (f) upload(f)
        e.target.value = ''
      }} />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? 'Uploading…' : contact.hasPhotoId ? 'Replace' : 'Upload'}
        </Button>
        {contact.hasPhotoId && (
          <Button size="sm" variant="ghost" onClick={remove}>Remove</Button>
        )}
      </div>
      {contact.photoIdUploadedAt && (
        <p className="text-xs text-muted-foreground">Uploaded {new Date(contact.photoIdUploadedAt).toLocaleString()}</p>
      )}
    </div>
  )
}
