import { useState } from 'react'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { PageHeader } from '../../layout/PageHeader'
import { DataTable } from '../../components/data-table/DataTable'
import { FormDialog } from '../../components/ViewToggle'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'
import type { ContactCategory } from '@strikescope/shared/src/types'

export default function ContactCategories() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')

  const { data: categories = [], isLoading, refetch } = useQuery({
    queryKey: ['contactCategories'],
    queryFn: async () => {
      const r = await api.get<ContactCategory[]>('/api/admin/directory-contacts/categories')
      return r.ok && r.data ? r.data : []
    },
  })

  const create = async () => {
    if (!name.trim()) return
    const r = await api.post('/api/admin/directory-contacts/categories', { name: name.trim() }).catch(() => null)
    if (r?.ok) { toast.success('Category created'); setShowForm(false); setName(''); refetch() }
    else toast.error(r?.error || 'Failed')
  }

  const toggle = async (cat: ContactCategory) => {
    const r = await api.put(`/api/admin/directory-contacts/categories/${cat.id}`, { isEnabled: !cat.isEnabled }).catch(() => null)
    if (r?.ok) refetch()
    else toast.error('Failed to update')
  }

  const columns: ColumnDef<ContactCategory>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'slug', header: 'Slug' },
    {
      accessorKey: 'isSystem', header: 'Type',
      cell: ({ row }) => row.original.isSystem ? <Badge variant="outline">System</Badge> : <Badge>Custom</Badge>,
    },
    {
      accessorKey: 'isEnabled', header: 'Status',
      cell: ({ row }) => row.original.isEnabled
        ? <Badge variant="success">Enabled</Badge>
        : <Badge variant="outline">Disabled</Badge>,
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => toggle(row.original)}>
          {row.original.isEnabled ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Contact Categories" actions={<Button onClick={() => setShowForm(true)}>+ Add Category</Button>} />
      <DataTable data={categories} columns={columns} loading={isLoading} emptyMessage="No categories." />
      <FormDialog open={showForm} title="New Category" onClose={() => setShowForm(false)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={create}>Save</Button>
        </div>
      }>
        <div><Label>Name</Label><Input className="mt-1" value={name} onChange={e => setName(e.target.value)} /></div>
      </FormDialog>
    </div>
  )
}
