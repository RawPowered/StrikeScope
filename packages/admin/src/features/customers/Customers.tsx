import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { useCustomers } from '../../hooks/useCrmQueries'
import { useConfirm } from '../../components/ConfirmDialog'
import { api } from '../../api'
import ColumnPicker from '../../components/ColumnPicker'
import { PageHeader } from '../../layout/PageHeader'
import { DataTable } from '../../components/data-table/DataTable'
import { FormDialog } from '../../components/ViewToggle'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import type { Customer } from '@strikescope/shared/src/types'
import { TerritoryTabsBar } from '../territory/TerritoryTabs'
import { CityFilter } from '../territory/CityFilter'
import { useTerritoryFilters } from '../territory/useTerritoryFilters'
import { LocationFields } from '../territory/LocationFields'
import { DuplicateWarningDialog, type DuplicateMatch } from '../duplicates/DuplicateWarningDialog'

const BUILT_IN = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
]

export default function Customers() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { queryString } = useTerritoryFilters()
  const params = Object.fromEntries(new URLSearchParams(queryString.replace(/^&/, '')))
  const { data: customers = [], isLoading, error, refetch } = useCustomers(params)
  const [showForm, setShowForm] = useState(false)
  const [dupMatches, setDupMatches] = useState<DuplicateMatch[]>([])
  const [showDup, setShowDup] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', state: '', county: '', zip: '', notes: '' })
  const [columns, setColumns] = useState<string[]>(['name', 'email', 'phone', 'address'])

  const openNew = () => {
    setEditId(null)
    setForm({ name: '', email: '', phone: '', address: '', city: '', state: '', county: '', zip: '', notes: '' })
    setShowForm(true)
  }

  const openEdit = (c: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditId(c.id)
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', state: c.state || '', county: c.county || '', zip: c.zip || '', notes: c.notes || '' })
    setShowForm(true)
  }

  const handleSave = async (overrideReason?: string) => {
    if (!form.name.trim()) return
    const body = overrideReason ? { ...form, overrideReason } : form
    const r = editId
      ? await api.put(`/api/admin/customers/${editId}`, body).catch(() => null)
      : await api.post('/api/admin/customers', body).catch(() => null)
    if (r?.ok) {
      toast.success(editId ? 'Customer updated' : 'Customer created')
      setShowForm(false)
      setShowDup(false)
      refetch()
    } else if (r?.error === 'DUPLICATE_CANDIDATES' && r.data) {
      setDupMatches(r.data as DuplicateMatch[])
      setShowDup(true)
    } else {
      toast.error(r?.error || 'Failed to save')
    }
  }

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await confirm({ title: 'Delete customer?', description: name, variant: 'destructive', confirmLabel: 'Delete' })
    if (!ok) return
    const r = await api.del(`/api/admin/customers/${id}`).catch(() => null)
    if (r?.ok) { toast.success('Deleted'); refetch() }
    else toast.error('Failed to delete')
  }

  const handleColumnsSave = async (cols: string[]) => {
    setColumns(cols)
    await api.put('/api/admin/column-preferences/customers', { columns: cols })
  }

  useEffect(() => {
    if (error) toast.error(String(error))
  }, [error])

  const tableColumns: ColumnDef<any>[] = [
    ...columns.map(key => ({
      accessorKey: key,
      header: BUILT_IN.find(b => b.key === key)?.label || key,
      cell: ({ row }: { row: { original: any } }) => {
        const val = row.original[key]
        if (key.startsWith('cf_')) {
          const cf = row.original.customFieldsJson ? JSON.parse(row.original.customFieldsJson) : {}
          return cf[key.slice(3)] || '—'
        }
        return val || '—'
      },
    })),
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={e => openEdit(row.original, e)}>Edit</Button>
          <Button variant="destructive" size="sm" onClick={e => handleDelete(row.original.id, row.original.name, e)}>Del</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Customers"
        actions={
          <>
            <ColumnPicker entity="customers" builtInFields={BUILT_IN} selectedColumns={columns} onSave={handleColumnsSave} />
            <Button onClick={openNew}>+ New Customer</Button>
          </>
        }
      />
      <TerritoryTabsBar />
      <CityFilter />

      <DataTable
        data={customers}
        columns={tableColumns}
        loading={isLoading}
        onRowClick={row => navigate(`/company/customers/${row.id}`)}
      />

      <FormDialog
        open={showForm}
        title={editId ? 'Edit Customer' : 'New Customer'}
        onClose={() => setShowForm(false)}
        footer={
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => handleSave()}>Save</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <LocationFields value={form} onChange={v => setForm(f => ({ ...f, ...v }))} />
          <textarea className="w-full rounded-md border border-border p-2 text-sm" placeholder="Notes" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </FormDialog>
      <DuplicateWarningDialog
        open={showDup}
        matches={dupMatches}
        onClose={() => setShowDup(false)}
        onProceed={reason => handleSave(reason)}
        onUseExisting={id => { setShowDup(false); navigate(`/company/customers/${id}`) }}
      />
    </div>
  )
}
