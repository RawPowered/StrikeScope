import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { useLeadsDnc, useRemoveDnc } from '../../hooks/useCrmQueries'
import { useConfirm } from '../../components/ConfirmDialog'
import { PageHeader } from '../../layout/PageHeader'
import { DataTable } from '../../components/data-table/DataTable'
import { Button } from '../../components/ui/button'
import type { Lead } from '@strikescope/shared/src/types'

export default function DoNotContact() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { data: leads = [], isLoading, error, refetch } = useLeadsDnc()
  const removeDnc = useRemoveDnc()

  useEffect(() => {
    if (error) toast.error(String(error))
  }, [error])

  const handleRemoveDnc = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Remove Do Not Contact?',
      description: `Allow contact again for ${name}?`,
      confirmLabel: 'Remove DNC',
    })
    if (!ok) return
    const r = await removeDnc.mutateAsync(id)
    if (r?.ok) {
      toast.success('DNC removed')
      refetch()
    } else {
      toast.error('Failed to remove DNC')
    }
  }

  const columns: ColumnDef<Lead>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => row.original.email || '—' },
    { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => row.original.phone || '—' },
    {
      accessorKey: 'dncAt',
      header: 'Marked DNC',
      cell: ({ row }) => row.original.dncAt ? new Date(row.original.dncAt).toLocaleDateString() : '—',
    },
    {
      accessorKey: 'dncReason',
      header: 'Reason',
      cell: ({ row }) => row.original.dncReason || '—',
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={e => { e.stopPropagation(); handleRemoveDnc(row.original.id, row.original.name) }}
        >
          Remove DNC
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Do Not Contact"
        description="Leads that have requested not to be contacted."
      />
      <DataTable
        data={leads}
        columns={columns}
        loading={isLoading}
        emptyMessage="No DNC leads."
        onRowClick={row => navigate(`/company/leads/${row.id}`)}
      />
    </div>
  )
}
