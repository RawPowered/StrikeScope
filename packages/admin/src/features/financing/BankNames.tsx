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
import type { CompanyBank } from '@strikescope/shared/src/types'

export default function BankNames() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')

  const { data: banks = [], isLoading, refetch } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const r = await api.get<CompanyBank[]>('/api/admin/banks')
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const handleCreate = async () => {
    if (!name.trim()) return
    const r = await api.post('/api/admin/banks', { name: name.trim() }).catch(() => null)
    if (r?.ok) {
      toast.success('Bank added')
      setShowForm(false)
      setName('')
      refetch()
    } else toast.error(r?.error || 'Failed to add bank')
  }

  const toggleActive = async (bank: CompanyBank) => {
    const r = await api.put(`/api/admin/banks/${bank.id}`, { isActive: !bank.isActive }).catch(() => null)
    if (r?.ok) { toast.success(bank.isActive ? 'Bank disabled' : 'Bank enabled'); refetch() }
    else toast.error(r?.error || 'Failed to update')
  }

  const columns: ColumnDef<CompanyBank>[] = [
    { accessorKey: 'name', header: 'Bank Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
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
        <Button size="sm" variant="outline" onClick={() => toggleActive(row.original)}>
          {row.original.isActive ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Bank Names"
        description="Maintain lender names for project financing. Used in Bank dropdowns on construction projects."
        actions={<Button onClick={() => setShowForm(true)}>+ Add Bank</Button>}
      />
      <DataTable data={banks} columns={columns} loading={isLoading} emptyMessage="No banks defined yet." />
      <FormDialog open={showForm} title="Add Bank" onClose={() => setShowForm(false)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Save</Button>
        </div>
      }>
        <div>
          <Label>Bank Name</Label>
          <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mosaic, GoodLeap" />
        </div>
      </FormDialog>
    </div>
  )
}
