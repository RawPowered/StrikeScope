import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { PageHeader } from '../../layout/PageHeader'
import { DataTable } from '../../components/data-table/DataTable'
import { Badge } from '../../components/ui/badge'
import { TerritoryTabsBar } from '../territory/TerritoryTabs'
import { CityFilter } from '../territory/CityFilter'
import { useTerritoryFilters } from '../territory/useTerritoryFilters'
import type { Agreement } from '@strikescope/shared/src/types'

export default function AgreementsList() {
  const navigate = useNavigate()
  const { queryString } = useTerritoryFilters()

  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ['agreements', queryString],
    queryFn: async () => {
      const r = await api.get<Agreement[]>(`/api/admin/agreements?${queryString.replace(/^&/, '')}`)
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const columns: ColumnDef<Agreement>[] = [
    { accessorKey: 'customerName', header: 'Customer', cell: ({ row }) => <span className="font-medium">{row.original.customerName || '—'}</span> },
    { accessorKey: 'projectName', header: 'Project', cell: ({ row }) => row.original.projectName || '—' },
    { accessorKey: 'customerState', header: 'State', cell: ({ row }) => row.original.customerState || '—' },
    { accessorKey: 'customerCity', header: 'City', cell: ({ row }) => row.original.customerCity || '—' },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status
        const v = s === 'signed' ? 'success' : s === 'cancelled' ? 'destructive' : 'outline'
        return <Badge variant={v as any}>{s}</Badge>
      },
    },
    { accessorKey: 'signedAt', header: 'Signed', cell: ({ row }) => row.original.signedAt ? new Date(row.original.signedAt).toLocaleDateString() : '—' },
  ]

  return (
    <div>
      <PageHeader title="Agreements" />
      <TerritoryTabsBar />
      <CityFilter />
      <DataTable
        data={agreements}
        columns={columns}
        loading={isLoading}
        emptyMessage="No agreements."
        onRowClick={row => navigate(`/company/agreements/${row.id}`)}
      />
    </div>
  )
}
