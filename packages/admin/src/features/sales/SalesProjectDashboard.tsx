import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { PageHeader } from '../../layout/PageHeader'
import { DataTable } from '../../components/data-table/DataTable'
import { Badge } from '../../components/ui/badge'
import type { ColumnDef } from '@tanstack/react-table'

export default function SalesProjectDashboard() {
  const navigate = useNavigate()
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['sales-projects'],
    queryFn: async () => {
      const r = await api.get<any[]>('/api/admin/projects')
      return r.ok && r.data ? r.data : []
    },
  })

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'name', header: 'Project' },
    { accessorKey: 'customerName', header: 'Customer' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge> },
    { accessorKey: 'projectTypeName', header: 'Type' },
  ]

  return (
    <div>
      <PageHeader title="My Projects" description="Assigned projects — contact summary and status only." />
      <DataTable data={projects} columns={columns} loading={isLoading} onRowClick={row => navigate(`/company/projects/${row.id}?view=sales`)} emptyMessage="No assigned projects." />
    </div>
  )
}
