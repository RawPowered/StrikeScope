import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { api } from '../api'
import { useConfirm } from '../components/ConfirmDialog'
import { PageHeader } from '../layout/PageHeader'
import { DataTable } from '../components/data-table/DataTable'
import { FormDialog } from '../components/ViewToggle'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import type { Company } from '@strikescope/shared/src/types'

export default function Companies() {
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '' })

  const { data: companies = [], isLoading, refetch } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const r = await api.get<Company[]>('/api/admin/companies')
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const handleCreate = async () => {
    if (!form.name.trim()) return
    const r = await api.post('/api/admin/companies', form).catch(() => null)
    if (r?.ok) {
      toast.success('Company created')
      setShowForm(false)
      setForm({ name: '', address: '', phone: '', email: '' })
      refetch()
    } else toast.error('Failed to create company')
  }

  const handleDeactivate = async (id: string, name: string) => {
    const ok = await confirm({ title: 'Deactivate company?', description: `${name} — all data will be soft-deleted.`, variant: 'destructive', confirmLabel: 'Deactivate' })
    if (!ok) return
    const r = await api.post(`/api/admin/companies/${id}/deactivate`, { restoreDays: 180 }).catch(() => null)
    if (r?.ok) { toast.success('Company deactivated'); refetch() }
    else toast.error('Failed to deactivate')
  }

  const columns: ColumnDef<Company>[] = [
    {
      accessorKey: 'name',
      header: 'Company',
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.name}</span>
          {row.original.email && <span className="text-muted-foreground ml-2 text-xs">{row.original.email}</span>}
        </div>
      ),
    },
    {
      accessorKey: 'address',
      header: 'Address',
      cell: ({ row }) => row.original.address || '—',
    },
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
      cell: ({ row }) => (
        <Button variant="destructive" size="sm" disabled={row.original.id === 'default'} onClick={() => handleDeactivate(row.original.id, row.original.name)}>
          Deactivate
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Companies" description={`${companies.length} companies`} actions={<Button onClick={() => setShowForm(true)}>+ Add Company</Button>} />
      <DataTable data={companies} columns={columns} loading={isLoading} emptyMessage="No companies found." />
      <FormDialog open={showForm} title="New Company" onClose={() => setShowForm(false)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Save</Button>
        </div>
      }>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>Address</Label><Input className="mt-1" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
          <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          <div><Label>Email</Label><Input className="mt-1" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
        </div>
      </FormDialog>
    </div>
  )
}
