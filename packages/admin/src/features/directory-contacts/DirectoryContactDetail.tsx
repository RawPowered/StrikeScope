import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { useConfirm } from '../../components/ConfirmDialog'
import { RecordDetailShell, DetailRow, useRecordDetail } from '../../components/record-detail'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Select } from '../../components/ui/select'
import { US_STATES } from '../../lib/us-states'
import type { ContactCategory, DirectoryContact } from '@strikescope/shared/src/types'

export default function DirectoryContactDetail() {
  const { id, categorySlug } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({
    categoryId: '', name: '', organization: '', title: '', email: '', phone: '',
    state: '', county: '', address: '', notes: '',
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['contactCategories'],
    queryFn: async () => {
      const r = await api.get<ContactCategory[]>('/api/admin/directory-contacts/categories')
      return r.ok && r.data ? r.data : []
    },
  })

  const { record: contact, isLoading, isError, refetch } = useRecordDetail<DirectoryContact>(
    id,
    id ? `/api/admin/directory-contacts/${id}` : '',
  )

  const backPath = categorySlug
    ? `/company/contacts/directory/${categorySlug}`
    : '/company/contacts/directory'

  const startEdit = () => {
    if (!contact) return
    setForm({
      categoryId: contact.categoryId,
      name: contact.name,
      organization: contact.organization || '',
      title: contact.title || '',
      email: contact.email || '',
      phone: contact.phone || '',
      state: contact.state || '',
      county: contact.county || '',
      address: contact.address || '',
      notes: contact.notes || '',
    })
    setEdit(true)
  }

  const handleSave = async () => {
    if (!id || !form.name.trim() || !form.categoryId) return
    const r = await api.put(`/api/admin/directory-contacts/${id}`, {
      categoryId: form.categoryId,
      name: form.name.trim(),
      organization: form.organization || undefined,
      title: form.title || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      state: form.state || undefined,
      county: form.county || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined,
    }).catch(() => null)
    if (r?.ok) {
      toast.success('Saved')
      setEdit(false)
      refetch()
    } else toast.error(r?.error || 'Failed to save')
  }

  const handleDelete = async () => {
    if (!contact || !id) return
    const ok = await confirm({
      title: 'Remove directory contact?',
      description: contact.name,
      variant: 'destructive',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    const r = await api.del(`/api/admin/directory-contacts/${id}`).catch(() => null)
    if (r?.ok) {
      toast.success('Contact removed')
      navigate(backPath)
    } else toast.error('Failed to remove')
  }

  return (
    <RecordDetailShell
      loading={isLoading}
      notFound={isError || (!isLoading && !contact)}
      backLabel="Back to Directory"
      onBack={() => navigate(backPath)}
      title={edit ? 'Edit directory contact' : contact?.name}
      description={contact?.categoryName}
      actions={
        contact && !edit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startEdit}>Edit</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Remove</Button>
          </div>
        )
      }
    >
      {contact && edit && (
        <Card className="mb-4">
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Category</Label>
              <Select className="mt-1 w-full" value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                <option value="">Select…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div><Label>Name *</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Organization</Label><Input className="mt-1" value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} /></div>
            <div><Label>Title</Label><Input className="mt-1" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>Email</Label><Input type="email" className="mt-1" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div>
              <Label>State</Label>
              <Select className="mt-1 w-full" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                <option value="">—</option>
                {US_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </Select>
            </div>
            <div><Label>County</Label><Input className="mt-1" value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value }))} /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Input className="mt-1" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea className="mt-1" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="sm:col-span-2 flex gap-2">
              <Button onClick={handleSave}>Save</Button>
              <Button variant="outline" onClick={() => setEdit(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {contact && !edit && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Contact info</CardTitle></CardHeader>
          <CardContent>
            <DetailRow label="Category" value={contact.categoryName} />
            <DetailRow label="Organization" value={contact.organization} />
            <DetailRow label="Title" value={contact.title} />
            <DetailRow label="Phone" value={contact.phone} />
            <DetailRow label="Email" value={contact.email} />
            <DetailRow label="State" value={contact.state ? US_STATES.find(s => s.code === contact.state)?.name || contact.state : null} />
            <DetailRow label="County" value={contact.county} />
            <DetailRow label="Address" value={contact.address} />
            <DetailRow label="Notes" value={contact.notes} />
            <DetailRow label="Created" value={new Date(contact.createdAt).toLocaleString()} />
          </CardContent>
        </Card>
      )}
    </RecordDetailShell>
  )
}
