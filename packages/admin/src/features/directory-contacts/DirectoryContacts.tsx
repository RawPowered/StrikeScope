import { useState } from 'react'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { PageHeader } from '../../layout/PageHeader'
import { SectionTabs } from '../../layout/SectionTabs'
import { DataTable } from '../../components/data-table/DataTable'
import { FormDialog } from '../../components/ViewToggle'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Select } from '../../components/ui/select'
import { US_STATES } from '../../lib/us-states'
import type { ContactCategory, DirectoryContact } from '@strikescope/shared/src/types'

export default function DirectoryContacts() {
  const navigate = useNavigate()
  const { categorySlug } = useParams()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    categoryId: '', name: '', organization: '', title: '', email: '', phone: '',
    state: '', county: '', address: '', notes: '',
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['contactCategories'],
    queryFn: async () => {
      const r = await api.get<ContactCategory[]>('/api/admin/directory-contacts/categories')
      return r.ok && r.data ? r.data.filter(c => c.isEnabled) : []
    },
  })

  const activeCategory = categorySlug
    ? categories.find(c => c.slug === categorySlug)
    : categories[0]

  const { data: contacts = [], isLoading, refetch } = useQuery({
    queryKey: ['directoryContacts', activeCategory?.slug],
    queryFn: async () => {
      if (!activeCategory) return []
      const r = await api.get<DirectoryContact[]>(`/api/admin/directory-contacts?categorySlug=${activeCategory.slug}`)
      return r.ok && r.data ? r.data : []
    },
    enabled: !!activeCategory,
  })

  const openNew = () => {
    setEditId(null)
    setForm({
      categoryId: activeCategory?.id || '', name: '', organization: '', title: '',
      email: '', phone: '', state: '', county: '', address: '', notes: '',
    })
    setShowForm(true)
  }

  const openEdit = (c: DirectoryContact) => {
    setEditId(c.id)
    setForm({
      categoryId: c.categoryId, name: c.name, organization: c.organization || '',
      title: c.title || '', email: c.email || '', phone: c.phone || '',
      state: c.state || '', county: c.county || '', address: c.address || '', notes: c.notes || '',
    })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim() || !form.categoryId) return
    const body = { ...form, organization: form.organization || undefined, title: form.title || undefined,
      email: form.email || undefined, phone: form.phone || undefined, state: form.state || undefined,
      county: form.county || undefined, address: form.address || undefined, notes: form.notes || undefined }
    const r = editId
      ? await api.put(`/api/admin/directory-contacts/${editId}`, body).catch(() => null)
      : await api.post('/api/admin/directory-contacts', body).catch(() => null)
    if (r?.ok) { toast.success('Saved'); setShowForm(false); refetch() }
    else toast.error(r?.error || 'Failed')
  }

  const columns: ColumnDef<DirectoryContact>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'organization', header: 'Organization', cell: ({ row }) => row.original.organization || '—' },
    { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => row.original.phone || '—' },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => row.original.email || '—' },
    { accessorKey: 'state', header: 'State', cell: ({ row }) => row.original.state || '—' },
    { accessorKey: 'county', header: 'County', cell: ({ row }) => row.original.county || '—' },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); openEdit(row.original) }}>Edit</Button>
      ),
    },
  ]

  const tabs = categories.map(c => ({
    label: c.name,
    path: `/company/contacts/directory/${c.slug}`,
  }))

  return (
    <div>
      <PageHeader title="Directory Contacts" actions={<Button onClick={openNew}>+ Add Contact</Button>} />
      {tabs.length > 0 && <SectionTabs tabs={tabs} />}
      <DataTable
        data={contacts}
        columns={columns}
        loading={isLoading}
        emptyMessage="No directory contacts."
        onRowClick={row => navigate(`/company/contacts/directory/${row.categorySlug || categorySlug || 'all'}/${row.id}`)}
      />

      <FormDialog open={showForm} title={editId ? 'Edit Contact' : 'New Contact'} onClose={() => setShowForm(false)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      }>
        <div className="space-y-3">
          <div>
            <Label>Category</Label>
            <Select className="mt-1 w-full" value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
              <option value="">Select…</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div><Label>Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>Organization</Label><Input className="mt-1" value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} /></div>
          <div><Label>Title</Label><Input className="mt-1" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div>
            <Label>State</Label>
            <Select className="mt-1 w-full" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
              <option value="">—</option>
              {US_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </Select>
          </div>
          <div><Label>County</Label><Input className="mt-1" value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value }))} /></div>
          <div><Label>Address</Label><Input className="mt-1" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div><Label>Notes</Label><Textarea className="mt-1" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
      </FormDialog>
    </div>
  )
}
