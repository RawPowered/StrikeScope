import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { api } from '../api'
import { useConfirm } from '../components/ConfirmDialog'
import { PageHeader } from '../layout/PageHeader'
import { DataTable } from '../components/data-table/DataTable'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import { cn } from '../lib/utils'

interface DeletedEntry {
  id: string; originalId: string; name: string
  deletedAt: string; restoreBy: string
  restoredAt: string | null; permanentlyDeletedAt: string | null
}

export default function DeletedItems() {
  const confirm = useConfirm()

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['deleted-companies'],
    queryFn: async () => {
      const r = await api.get<DeletedEntry[]>('/api/admin/companies/deleted/list')
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const isExpired = (restoreBy: string) => new Date(restoreBy) < new Date()

  const handleRestore = async (originalId: string, name: string) => {
    const ok = await confirm({ title: 'Restore company?', description: name, confirmLabel: 'Restore' })
    if (!ok) return
    const r = await api.post(`/api/admin/companies/${originalId}/restore`).catch(() => null)
    if (r?.ok) { toast.success('Company restored'); refetch() }
    else toast.error('Restore failed')
  }

  const handlePurge = async (deletedId: string) => {
    const ok = await confirm({ title: 'Permanently delete?', description: 'This cannot be undone.', variant: 'destructive', confirmLabel: 'Purge' })
    if (!ok) return
    const r = await api.del(`/api/admin/companies/deleted/${deletedId}/purge`).catch(() => null)
    if (r?.ok) { toast.success('Record purged'); refetch() }
    else toast.error('Purge failed')
  }

  const handlePurgeExpired = async () => {
    const ok = await confirm({ title: 'Purge all expired?', description: 'Permanently delete ALL expired shadow records.', variant: 'destructive', confirmLabel: 'Purge All' })
    if (!ok) return
    const r = await api.post<{ purged: number }>('/api/admin/companies/deleted/purge-expired').catch(() => null)
    if (r?.ok && r.data) { toast.success(`Purged ${r.data.purged} expired records`); refetch() }
    else toast.error('Purge failed')
  }

  const columns: ColumnDef<DeletedEntry>[] = [
    {
      accessorKey: 'name',
      header: 'Company',
      cell: ({ row }) => {
        const expired = isExpired(row.original.restoreBy)
        return (
          <div className={cn(expired && !row.original.restoredAt && 'opacity-60')}>
            <span className="font-medium">{row.original.name}</span>
            {row.original.restoredAt && <Badge variant="success" className="ml-2">Restored</Badge>}
            {expired && !row.original.restoredAt && <Badge variant="destructive" className="ml-2">Expired</Badge>}
          </div>
        )
      },
    },
    {
      id: 'dates',
      header: 'Dates',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          Deleted {new Date(row.original.deletedAt).toLocaleDateString()} · Expires {new Date(row.original.restoreBy).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        if (row.original.restoredAt) return null
        const expired = isExpired(row.original.restoreBy)
        return (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={expired} onClick={() => handleRestore(row.original.originalId, row.original.name)}>Restore</Button>
            <Button variant="destructive" size="sm" onClick={() => handlePurge(row.original.id)}>Purge</Button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Deleted Items"
        description="Deactivated companies preserved for 180 days"
        actions={<Button variant="destructive" onClick={handlePurgeExpired}>Purge All Expired</Button>}
      />
      <DataTable data={items} columns={columns} loading={isLoading} emptyMessage="No deleted companies." />
    </div>
  )
}
