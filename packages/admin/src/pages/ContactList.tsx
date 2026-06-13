import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '../api'
import { useAuth } from '../auth'
import { useConfirm } from '../components/ConfirmDialog'
import ColumnPicker from '../components/ColumnPicker'
import { PageHeader } from '../layout/PageHeader'
import { DataTable } from '../components/data-table/DataTable'
import { FormDialog } from '../components/ViewToggle'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import type { Contact, Customer } from '@strikescope/shared/src/types'
import { TerritoryTabsBar } from '../features/territory/TerritoryTabs'
import { CityFilter } from '../features/territory/CityFilter'
import { useTerritoryFilters } from '../features/territory/useTerritoryFilters'
import { PhotoIdCapture } from '../features/contacts/PhotoIdCapture'

const BUILT_IN = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'role', label: 'Role' },
  { key: 'isPrimary', label: 'Primary' },
  { key: 'accountName', label: 'Account' },
]

export default function ContactList() {
  const navigate = useNavigate()
  const { canViewField, canEditField } = useAuth()
  const confirm = useConfirm()
  const [filterCustomer, setFilterCustomer] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const { queryString } = useTerritoryFilters()
  const [savedContact, setSavedContact] = useState<Contact | null>(null)
  const [form, setForm] = useState({ customerId: '', firstName: '', lastName: '', email: '', phone: '', role: '', contactType: 'standard' as string, isPrimary: false, notes: '', ssnLastFour: '', dateOfBirth: '' })
  const [columns, setColumns] = useState<string[]>(['name', 'email', 'phone', 'role', 'accountName'])

  const { data: contacts = [], isLoading, refetch } = useQuery({
    queryKey: ['contacts', queryString, filterCustomer],
    queryFn: async () => {
      const customerQ = filterCustomer ? `&customerId=${filterCustomer}` : ''
      const r = await api.get<any[]>(`/api/admin/contacts?include_custom_fields=true${customerQ}${queryString}`)
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const r = await api.get<Customer[]>('/api/admin/customers')
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const openNew = () => {
    setEditId(null)
    setSavedContact(null)
    setForm({ customerId: '', firstName: '', lastName: '', email: '', phone: '', role: '', contactType: 'standard', isPrimary: false, notes: '', ssnLastFour: '', dateOfBirth: '' })
    setShowForm(true)
  }

  const openEdit = (c: Contact, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditId(c.id)
    setSavedContact(c)
    setForm({ customerId: c.customerId, firstName: c.firstName, lastName: c.lastName || '', email: c.email || '', phone: c.phone || '', role: c.role || '', contactType: c.contactType || 'standard', isPrimary: c.isPrimary, notes: c.notes || '', ssnLastFour: '', dateOfBirth: '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.customerId || !form.firstName.trim()) return
    const body = { ...form, lastName: form.lastName || undefined, email: form.email || undefined, phone: form.phone || undefined, role: form.role || undefined, notes: form.notes || undefined, ssnLastFour: form.ssnLastFour || undefined, dateOfBirth: form.dateOfBirth || undefined }
    const r = editId
      ? await api.put(`/api/admin/contacts/${editId}`, body).catch(() => null)
      : await api.post('/api/admin/contacts', body).catch(() => null)
    if (r?.ok) {
      toast.success(editId ? 'Contact updated' : 'Contact created')
      setShowForm(false)
      refetch()
    } else {
      toast.error(r?.error || 'Failed to save')
    }
  }

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await confirm({ title: 'Delete contact?', description: name, variant: 'destructive', confirmLabel: 'Delete' })
    if (!ok) return
    const r = await api.del(`/api/admin/contacts/${id}`).catch(() => null)
    if (r?.ok) { toast.success('Deleted'); refetch() }
    else toast.error('Failed to delete')
  }

  const handleColumnsSave = async (cols: string[]) => {
    setColumns(cols)
    await api.put('/api/admin/column-preferences/contacts', { columns: cols })
  }

  const tableColumns: ColumnDef<any>[] = [
    ...columns.map(key => ({
      accessorKey: key,
      header: BUILT_IN.find(b => b.key === key)?.label || key,
      cell: ({ row }: { row: { original: any } }) => {
        const c = row.original
        if (key === 'name') return <span className="font-medium">{c.firstName}{c.lastName ? ` ${c.lastName}` : ''}</span>
        if (key === 'isPrimary') return c.isPrimary ? <Badge variant="success">Primary</Badge> : '—'
        if (key === 'accountName') {
          const account = customers.find(a => a.id === c.customerId)
          return account ? <Badge variant="secondary">{account.name}</Badge> : '—'
        }
        if (key.startsWith('cf_')) {
          const cf = c.customFieldsJson ? JSON.parse(c.customFieldsJson) : {}
          return cf[key.slice(3)] || '—'
        }
        return c[key] || '—'
      },
    })),
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={e => openEdit(row.original, e)}>Edit</Button>
          <Button variant="destructive" size="sm" onClick={e => handleDelete(row.original.id, row.original.firstName, e)}>Del</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Contacts"
        description={`${contacts.length} contact${contacts.length === 1 ? '' : 's'}`}
        actions={
          <>
            <ColumnPicker entity="contacts" builtInFields={BUILT_IN} selectedColumns={columns} onSave={handleColumnsSave} />
            <Button onClick={openNew}>+ Add Contact</Button>
          </>
        }
      />
      <TerritoryTabsBar />
      <CityFilter />

      <div className="mb-4 max-w-xs">
        <Label>Filter by account</Label>
        <Select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="mt-1">
          <option value="">All accounts</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      <DataTable
        data={contacts}
        columns={tableColumns}
        loading={isLoading}
        emptyMessage="No contacts found."
        onRowClick={row => navigate(`/company/contacts/${row.id}`)}
      />

      <FormDialog
        open={showForm}
        title={editId ? 'Edit Contact' : 'New Contact'}
        onClose={() => setShowForm(false)}
        footer={
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div><Label>Account *</Label>
            <Select value={form.customerId} onChange={e => setForm(p => ({ ...p, customerId: e.target.value }))} className="mt-1">
              <option value="">— Select —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name *</Label><Input className="mt-1" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} /></div>
            <div><Label>Last name</Label><Input className="mt-1" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" className="mt-1" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          <div><Label>Role</Label><Input className="mt-1" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} /></div>
          <div><Label>Contact Type</Label>
            <Select className="mt-1 w-full" value={form.contactType} onChange={e => setForm(p => ({ ...p, contactType: e.target.value }))}>
              <option value="standard">Standard</option>
              <option value="co_signer">Co-Signer</option>
              <option value="primary">Primary</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPrimary} onChange={e => setForm(p => ({ ...p, isPrimary: e.target.checked }))} />
            Primary contact
          </label>
          <div><Label>Notes</Label><Textarea className="mt-1" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
          {canViewField('contacts', 'ssn_last_four') && (
            <div><Label>SSN (last 4)</Label><Input className="mt-1" maxLength={4} value={form.ssnLastFour} disabled={!canEditField('contacts', 'ssn_last_four')} onChange={e => setForm(p => ({ ...p, ssnLastFour: e.target.value }))} /></div>
          )}
          {canViewField('contacts', 'date_of_birth') && (
            <div><Label>Date of birth</Label><Input type="date" className="mt-1" value={form.dateOfBirth} disabled={!canEditField('contacts', 'date_of_birth')} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} /></div>
          )}
          {editId && savedContact && (
            <PhotoIdCapture contact={savedContact} onUpdated={() => {
              refetch()
              api.get<Contact>(`/api/admin/contacts/${editId}`).then(r => { if (r.ok && r.data) setSavedContact(r.data) })
            }} />
          )}
        </div>
      </FormDialog>
    </div>
  )
}
