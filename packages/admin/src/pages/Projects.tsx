import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '../api'
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
import type { Customer, ProjectType, ProjectStatus } from '@strikescope/shared/src/types'
import { TerritoryTabsBar } from '../features/territory/TerritoryTabs'
import { CityFilter } from '../features/territory/CityFilter'
import { useTerritoryFilters } from '../features/territory/useTerritoryFilters'
import { LocationFields } from '../features/territory/LocationFields'
import { projectTypeFlags } from '../lib/project-type-flags'
import { FinancingFields } from '../features/financing/FinancingFields'
import { UserRolePicker, type ProjectAssignment } from '../features/assignments/UserRolePicker'

const BUILT_IN = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'customerName', label: 'Customer' },
  { key: 'projectTypeName', label: 'Type' },
  { key: 'assignedTo', label: 'Assigned To' },
]

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  planned: 'secondary',
  active: 'default',
  completed: 'success',
  cancelled: 'destructive',
}

export default function Projects() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterStale = searchParams.get('stale') === 'true'
  const [filterStatus, setFilterStatus] = useState('')
  const [columns, setColumns] = useState<string[]>(['name', 'status', 'customerName', 'assignedTo'])
  const [showForm, setShowForm] = useState(false)
  const { queryString } = useTerritoryFilters()
  const [form, setForm] = useState({
    companyId: '', customerId: '', projectTypeId: '', name: '', address: '', city: '', state: '', county: '', zip: '',
    countyDepartment: '', permitNumber: '', propertyLegalDescription: '', coSignerContactId: '',
    financingType: '', bankId: '', propertyId: '', assignedTo: '', notes: '',
  })
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([])

  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ['projects', queryString],
    queryFn: async () => {
      const r = await api.get<any[]>(`/api/admin/projects?include_custom_fields=true${queryString}`)
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const r = await api.get<Customer[]>('/api/admin/customers')
      return r.ok && r.data ? r.data : []
    },
  })

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', form.customerId],
    queryFn: async () => {
      if (!form.customerId) return []
      const r = await api.get<any[]>(`/api/admin/customers/${form.customerId}/properties`)
      return r.ok && r.data ? r.data : []
    },
    enabled: !!form.customerId,
  })

  const { data: projectTypes = [] } = useQuery({
    queryKey: ['project-types'],
    queryFn: async () => {
      const r = await api.get<ProjectType[]>('/api/admin/project-types')
      return r.ok && r.data ? r.data : []
    },
  })

  const { data: staleProjects = [] } = useQuery({
    queryKey: ['projects-stale'],
    queryFn: async () => {
      const r = await api.get<any[]>('/api/admin/projects/stale')
      return r.ok && r.data ? r.data : []
    },
  })
  const staleIds = new Set(staleProjects.map((s: any) => s.id))

  const filtered = projects.filter(p => {
    if (filterStatus && p.status !== filterStatus) return false
    if (filterStale && !staleIds.has(p.id)) return false
    return true
  })
  const selectedType = projectTypes.find(pt => pt.id === form.projectTypeId)
  const flags = projectTypeFlags(selectedType)

  const handleCreate = async () => {
    if (!form.name.trim()) return
    const r = await api.post('/api/admin/projects', { ...form, assignments }).catch(() => null)
    if (r?.ok) {
      toast.success('Project created')
      setShowForm(false)
      setForm({ companyId: '', customerId: '', projectTypeId: '', name: '', address: '', city: '', state: '', county: '', zip: '', countyDepartment: '', permitNumber: '', propertyLegalDescription: '', coSignerContactId: '', financingType: '', bankId: '', propertyId: '', assignedTo: '', notes: '' })
      setAssignments([])
      refetch()
    } else {
      toast.error(r?.error || 'Failed to create')
    }
  }

  const handleStatusChange = async (id: string, status: ProjectStatus) => {
    const r = await api.put(`/api/admin/projects/${id}`, { status }).catch(() => null)
    if (r?.ok) { toast.success('Status updated'); refetch() }
    else toast.error('Failed to update')
  }

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await confirm({ title: 'Delete project?', description: name, variant: 'destructive', confirmLabel: 'Delete' })
    if (!ok) return
    const r = await api.del(`/api/admin/projects/${id}`).catch(() => null)
    if (r?.ok) { toast.success('Deleted'); refetch() }
    else toast.error('Failed to delete')
  }

  const handleColumnsSave = async (cols: string[]) => {
    setColumns(cols)
    await api.put('/api/admin/column-preferences/projects', { columns: cols })
  }

  const tableColumns: ColumnDef<any>[] = [
    ...columns.map(key => ({
      accessorKey: key,
      header: BUILT_IN.find(b => b.key === key)?.label || key,
      cell: ({ row }: { row: { original: any } }) => {
        const p = row.original
        if (key === 'name') return <span className="font-medium">{p.name}</span>
        if (key === 'status') return (
          <span className="flex gap-1 flex-wrap items-center">
            <Badge variant={STATUS_VARIANT[p.status] || 'secondary'}>{p.status}</Badge>
            {staleIds.has(p.id) && <Badge className="bg-amber-100 text-amber-900">Stale</Badge>}
          </span>
        )
        return p[key] || '—'
      },
    })),
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
          {row.original.status === 'planned' && <Button variant="outline" size="sm" onClick={() => handleStatusChange(row.original.id, 'active')}>Activate</Button>}
          {row.original.status === 'active' && <Button variant="outline" size="sm" onClick={() => handleStatusChange(row.original.id, 'completed')}>Complete</Button>}
          {(row.original.status === 'planned' || row.original.status === 'active') && (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange(row.original.id, 'cancelled')}>Cancel</Button>
          )}
          <Button variant="destructive" size="sm" onClick={e => handleDelete(row.original.id, row.original.name, e)}>Del</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Projects"
        description={`${filtered.length} project${filtered.length === 1 ? '' : 's'}`}
        actions={
          <>
            <ColumnPicker entity="projects" builtInFields={BUILT_IN} selectedColumns={columns} onSave={handleColumnsSave} />
            <Button onClick={() => setShowForm(true)}>+ New Project</Button>
          </>
        }
      />
      <TerritoryTabsBar />
      <CityFilter />

      <div className="mb-4 flex flex-wrap gap-4 items-end">
        <div className="max-w-xs">
          <Label>Status filter</Label>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="mt-1">
            <option value="">All statuses</option>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filterStale}
            onChange={e => {
              const next = new URLSearchParams(searchParams)
              if (e.target.checked) next.set('stale', 'true')
              else next.delete('stale')
              setSearchParams(next)
            }}
          />
          Stale only ({staleProjects.length})
        </label>
      </div>

      <DataTable
        data={filtered}
        columns={tableColumns}
        loading={isLoading}
        onRowClick={row => navigate(`/company/projects/${row.id}`)}
        emptyMessage="No projects found."
      />

      <FormDialog open={showForm} title="New Project" onClose={() => setShowForm(false)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create</Button>
        </div>
      }>
        <div className="space-y-3">
          <div><Label>Customer *</Label>
            <Select value={form.customerId} onChange={e => setForm(p => ({ ...p, customerId: e.target.value, propertyId: '' }))} className="mt-1">
              <option value="">— Select existing customer —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <p className="text-xs text-muted-foreground mt-1">New projects attach to an existing customer — no duplicate account created.</p>
          </div>
          {form.customerId && (
            <div><Label>Property / Site</Label>
              <Select value={form.propertyId} onChange={e => setForm(p => ({ ...p, propertyId: e.target.value }))} className="mt-1">
                <option value="">— New address below —</option>
                {properties.map((pr: any) => <option key={pr.id} value={pr.id}>{pr.label || 'Property'} — {pr.address || pr.city}</option>)}
              </Select>
            </div>
          )}
          <div><Label>Project type</Label>
            <Select value={form.projectTypeId} onChange={e => setForm(p => ({ ...p, projectTypeId: e.target.value }))} className="mt-1">
              <option value="">—</option>
              {projectTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
            </Select>
          </div>
          <div><Label>Name *</Label><Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <LocationFields value={form} onChange={v => setForm(p => ({ ...p, ...v }))} />
          {flags.includeCountyDefaults && (
            <div><Label>County Department</Label><Input className="mt-1" value={form.countyDepartment} onChange={e => setForm(p => ({ ...p, countyDepartment: e.target.value }))} /></div>
          )}
          {flags.requiresPermit && (
            <>
              <div><Label>Permit Number *</Label><Input className="mt-1" value={form.permitNumber} onChange={e => setForm(p => ({ ...p, permitNumber: e.target.value }))} /></div>
              <div><Label>Property Legal Description *</Label><Textarea className="mt-1" value={form.propertyLegalDescription} onChange={e => setForm(p => ({ ...p, propertyLegalDescription: e.target.value }))} /></div>
            </>
          )}
          {flags.isConstruction && !flags.requiresPermit && (
            <p className="text-xs text-muted-foreground">Construction project — new permit typically not required for this type.</p>
          )}
          {flags.showFinancingFields && (
            <FinancingFields
              value={{ financingType: form.financingType, bankId: form.bankId }}
              onChange={v => setForm(p => ({ ...p, ...v }))}
            />
          )}
          <UserRolePicker value={assignments} onChange={setAssignments} />
          <div><Label>Notes</Label><Textarea className="mt-1" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
        </div>
      </FormDialog>
    </div>
  )
}
