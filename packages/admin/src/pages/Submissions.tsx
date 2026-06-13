import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import ColumnPicker from '../components/ColumnPicker'
import { PageHeader } from '../layout/PageHeader'
import { DataTable } from '../components/data-table/DataTable'
import { ViewToggle } from '../components/ViewToggle'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import type { SubmissionStatus } from '@strikescope/shared/src/types'

const STATUS_FILTERS: (SubmissionStatus | 'all')[] = ['all', 'pending', 'approved', 'rejected']

const BUILT_IN = [
  { key: 'installerName', label: 'Installer' },
  { key: 'status', label: 'Status' },
  { key: 'photoCount', label: 'Photos' },
  { key: 'submittedAt', label: 'Submitted' },
  { key: 'gps', label: 'GPS' },
]

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive'> = {
  pending: 'secondary',
  approved: 'success',
  rejected: 'destructive',
}

function parseCustomFields(json: string | null | undefined): Record<string, string> {
  if (!json) return {}
  try { return JSON.parse(json) } catch { return {} }
}

export default function Submissions() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<SubmissionStatus | 'all'>('all')
  const [columns, setColumns] = useState<string[]>(['installerName', 'status', 'photoCount', 'submittedAt'])

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['submissions', filter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      params.set('include_custom_fields', 'true')
      const r = await api.get<any[]>(`/api/admin/submissions?${params.toString()}`)
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const handleColumnsSave = async (cols: string[]) => {
    setColumns(cols)
    await api.put('/api/admin/column-preferences/submissions', { columns: cols })
  }

  const tableColumns: ColumnDef<any>[] = useMemo(() => [
    ...columns.map(key => ({
      accessorKey: key,
      header: BUILT_IN.find(b => b.key === key)?.label || key.replace(/^cf_/, ''),
      cell: ({ row }: { row: { original: any } }) => {
        const s = row.original
        if (key === 'installerName') {
          return (
            <Link to={`/company/submissions/${s.id}`} className="font-medium text-primary hover:underline">
              {s.installerName || 'Unknown'}
            </Link>
          )
        }
        if (key === 'status') return <Badge variant={STATUS_VARIANT[s.status] || 'secondary'}>{s.status}</Badge>
        if (key === 'photoCount') return `${s.photoCount} photo${s.photoCount !== 1 ? 's' : ''}`
        if (key === 'submittedAt') return new Date(s.submittedAt).toLocaleString()
        if (key === 'gps') return s.gpsLat != null && s.gpsLng != null ? `${s.gpsLat.toFixed(4)}, ${s.gpsLng.toFixed(4)}` : 'No GPS'
        if (key.startsWith('cf_')) {
          const cf = parseCustomFields(s.customFieldsJson)
          return cf[key.slice(3)] || '—'
        }
        return s[key] || '—'
      },
    })),
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); navigate(`/company/submissions/${row.original.id}`) }}>
          View
        </Button>
      ),
    },
  ], [columns, navigate])

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Field photo submissions from installers"
        actions={
          <ColumnPicker entity="submissions" builtInFields={BUILT_IN} selectedColumns={columns} onSave={handleColumnsSave} />
        }
      />

      <div className="mb-4">
        <ViewToggle
          value={filter}
          onChange={setFilter}
          options={STATUS_FILTERS.map(f => ({
            value: f,
            label: f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1),
          }))}
        />
      </div>

      <DataTable
        data={submissions}
        columns={tableColumns}
        loading={isLoading}
        onRowClick={row => navigate(`/company/submissions/${row.id}`)}
        emptyMessage="No submissions found."
      />
    </div>
  )
}
