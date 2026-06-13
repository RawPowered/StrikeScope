import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { PageHeader } from '../layout/PageHeader'
import { DataTable } from '../components/data-table/DataTable'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import type { Activity, Company } from '@strikescope/shared/src/types'

export default function AuditTrail() {
  const [filter, setFilter] = useState({ companyId: '', entityType: '', entityId: '' })
  const [applied, setApplied] = useState(filter)

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const r = await api.get<Company[]>('/api/admin/companies')
      return r.ok && r.data ? r.data : []
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['audit', applied],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (applied.companyId) params.set('companyId', applied.companyId)
      if (applied.entityType) params.set('entityType', applied.entityType)
      if (applied.entityId) params.set('entityId', applied.entityId)
      const r = await api.get<{ data: Activity[]; total: number }>(`/api/admin/activities?${params.toString()}`)
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      const payload = r.data!
      const list = Array.isArray(payload) ? payload : payload.data || []
      const total = Array.isArray(payload) ? list.length : payload.total || list.length
      return { activities: list, total }
    },
  })

  const columns: ColumnDef<Activity>[] = [
    {
      accessorKey: 'entityType',
      header: 'Entity',
      cell: ({ row }) => (
        <div>
          <Badge variant="secondary" className="capitalize">{row.original.entityType}</Badge>
          <span className="text-xs text-muted-foreground ml-2 font-mono">{row.original.entityId.slice(0, 8)}…</span>
        </div>
      ),
    },
    { accessorKey: 'action', header: 'Action' },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => row.original.description || '—',
    },
    {
      id: 'performed',
      header: 'Performed',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.original.performedBy} · {row.original.performedAt ? new Date(row.original.performedAt).toLocaleString() : '—'}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        description={`${data?.total ?? 0} total activities recorded`}
      />

      <div className="rounded-lg border border-border bg-surface p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="min-w-[160px]">
            <Label>Company</Label>
            <Select value={filter.companyId} onChange={e => setFilter(f => ({ ...f, companyId: e.target.value }))} className="mt-1">
              <option value="">All</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="min-w-[140px]">
            <Label>Entity type</Label>
            <Select value={filter.entityType} onChange={e => setFilter(f => ({ ...f, entityType: e.target.value }))} className="mt-1">
              <option value="">All</option>
              {['lead', 'contact', 'customer', 'project', 'domain', 'company', 'user'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label>Entity ID</Label>
            <Input value={filter.entityId} onChange={e => setFilter(f => ({ ...f, entityId: e.target.value }))} className="mt-1" placeholder="Optional" />
          </div>
          <Button onClick={() => setApplied({ ...filter })}>Filter</Button>
        </div>
      </div>

      <DataTable
        data={data?.activities ?? []}
        columns={columns}
        loading={isLoading}
        emptyMessage="No activities found."
      />
    </div>
  )
}
