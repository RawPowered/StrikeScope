import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { api } from '../api'
import { PageHeader } from '../layout/PageHeader'
import { DataTable } from '../components/data-table/DataTable'
import { FormDialog } from '../components/ViewToggle'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import type { ProjectType } from '@strikescope/shared/src/types'

const emptyForm = {
  name: '', description: '', category: 'other' as string,
  isConstruction: false, includeCountyDefaults: false, requiresPermit: false, includeFinancingFields: false,
}

export default function ProjectTypes() {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data: types = [], isLoading, refetch } = useQuery({
    queryKey: ['project-types'],
    queryFn: async () => {
      const r = await api.get<ProjectType[]>('/api/admin/project-types')
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const openCreate = () => {
    setEditId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (pt: ProjectType) => {
    setEditId(pt.id)
    setForm({
      name: pt.name,
      description: pt.description || '',
      category: pt.category || 'other',
      isConstruction: !!pt.isConstruction,
      includeCountyDefaults: !!pt.includeCountyDefaults,
      requiresPermit: !!pt.requiresPermit,
      includeFinancingFields: !!pt.includeFinancingFields,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    const r = editId
      ? await api.put(`/api/admin/project-types/${editId}`, form).catch(() => null)
      : await api.post('/api/admin/project-types', form).catch(() => null)
    if (r?.ok) {
      toast.success(editId ? 'Project type updated' : 'Project type created')
      setShowForm(false)
      setEditId(null)
      setForm(emptyForm)
      refetch()
    } else toast.error(r?.error || 'Failed to save')
  }

  const columns: ColumnDef<ProjectType>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'category', header: 'Category', cell: ({ row }) => row.original.category || 'other' },
    {
      accessorKey: 'isConstruction', header: 'Construction',
      cell: ({ row }) => row.original.isConstruction ? <Badge>Yes</Badge> : '—',
    },
    {
      accessorKey: 'includeCountyDefaults', header: 'County Defaults',
      cell: ({ row }) => row.original.includeCountyDefaults ? <Badge variant="secondary">Yes</Badge> : '—',
    },
    {
      accessorKey: 'requiresPermit', header: 'Permit Required',
      cell: ({ row }) => row.original.requiresPermit ? <Badge>Yes</Badge> : '—',
    },
    {
      accessorKey: 'includeFinancingFields', header: 'Financing Fields',
      cell: ({ row }) => (row.original.isConstruction || row.original.includeFinancingFields)
        ? <Badge variant="secondary">Yes</Badge> : '—',
    },
    { accessorKey: 'description', header: 'Description', cell: ({ row }) => row.original.description || '—' },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => row.original.isActive
        ? <Badge variant="success">Active</Badge>
        : <Badge variant="outline">Inactive</Badge>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => <Button size="sm" variant="outline" onClick={() => openEdit(row.original)}>Edit</Button>,
    },
  ]

  return (
    <div>
      <PageHeader title="Project Types" actions={<Button onClick={openCreate}>+ Add Type</Button>} />
      <DataTable data={types} columns={columns} loading={isLoading} emptyMessage="No project types." />
      <FormDialog open={showForm} title={editId ? 'Edit Project Type' : 'New Project Type'} onClose={() => setShowForm(false)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      }>
        <div className="space-y-3">
          <div><Label>Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>Description</Label><Input className="mt-1" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          <div><Label>Category</Label>
            <Select className="mt-1 w-full" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <option value="solar">Solar</option>
              <option value="construction">Construction</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isConstruction} onChange={e => setForm(p => ({ ...p, isConstruction: e.target.checked }))} />
            Construction project (includes financing fields by default)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.includeCountyDefaults} onChange={e => setForm(p => ({ ...p, includeCountyDefaults: e.target.checked }))} />
            Include County defaults (County Department field)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requiresPermit} onChange={e => setForm(p => ({ ...p, requiresPermit: e.target.checked }))} />
            Requires permit number and legal description
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.includeFinancingFields} disabled={form.isConstruction} onChange={e => setForm(p => ({ ...p, includeFinancingFields: e.target.checked }))} />
            Include financing fields (non-construction custom types)
          </label>
        </div>
      </FormDialog>
    </div>
  )
}
