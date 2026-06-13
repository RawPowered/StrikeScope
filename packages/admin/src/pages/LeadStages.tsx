import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { api } from '../api'
import { useConfirm } from '../components/ConfirmDialog'
import { PageHeader } from '../layout/PageHeader'
import { DataTable } from '../components/data-table/DataTable'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useQuery } from '@tanstack/react-query'
import type { LeadStage } from '@strikescope/shared/src/types'

function StageNameEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (editing) {
    return (
      <Input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft.trim()) onSave(draft.trim()); setEditing(false) }}
        onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onSave(draft.trim()); setEditing(false) } }}
        autoFocus
        className="h-8 w-40 font-semibold"
      />
    )
  }
  return (
    <button type="button" className="font-semibold text-sm hover:text-primary text-left min-w-[120px]" onClick={() => { setDraft(value); setEditing(true) }}>
      {value}
    </button>
  )
}

export default function LeadStages() {
  const confirm = useConfirm()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#888888')

  const { data: stages = [], isLoading, refetch } = useQuery({
    queryKey: ['lead-stages'],
    queryFn: async () => {
      const r = await api.get<LeadStage[]>('/api/admin/lead-stages')
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const handleUpdate = async (id: string, data: { name?: string; color?: string; sortOrder?: number }) => {
    const r = await api.put(`/api/admin/lead-stages/${id}`, data).catch(() => null)
    if (r?.ok) refetch()
    else toast.error(r?.error || 'Failed to update')
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    const r = await api.post('/api/admin/lead-stages', { name: newName.trim(), color: newColor }).catch(() => null)
    if (r?.ok) {
      toast.success('Stage created')
      setNewName('')
      setNewColor('#888888')
      refetch()
    } else toast.error(r?.error || 'Failed to create')
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({ title: 'Delete stage?', description: name, variant: 'destructive', confirmLabel: 'Delete' })
    if (!ok) return
    const r = await api.del(`/api/admin/lead-stages/${id}`).catch(() => null)
    if (r?.ok) { toast.success('Deleted'); refetch() }
    else toast.error(r?.error || 'Failed to delete')
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= stages.length) return
    const a = stages[i]
    const b = stages[j]
    handleUpdate(a.id, { sortOrder: b.sortOrder })
    handleUpdate(b.id, { sortOrder: a.sortOrder })
  }

  const columns: ColumnDef<LeadStage>[] = [
    {
      id: 'order',
      header: '',
      cell: ({ row }) => {
        const i = stages.findIndex(s => s.id === row.original.id)
        return (
          <div className="flex flex-col gap-0.5">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => move(i, -1)} disabled={i === 0}>▲</Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => move(i, 1)} disabled={i === stages.length - 1}>▼</Button>
          </div>
        )
      },
    },
    {
      id: 'color',
      header: 'Color',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded shrink-0 border border-border" style={{ background: row.original.color }} />
          <input type="color" value={row.original.color} onChange={e => handleUpdate(row.original.id, { color: e.target.value })} className="h-7 w-9 cursor-pointer border-0 p-0" />
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Stage',
      cell: ({ row }) => <StageNameEditor value={row.original.name} onSave={v => handleUpdate(row.original.id, { name: v })} />,
    },
    {
      id: 'leads',
      header: 'Leads',
      cell: ({ row }) => {
        const count = (row.original as LeadStage & { _leadCount?: number })._leadCount
        return count != null ? <span className="text-xs text-muted-foreground">{count} leads</span> : null
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="destructive" size="sm" disabled={row.original.isDefault} onClick={() => handleDelete(row.original.id, row.original.name)}>
          Delete
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Lead Pipeline Stages" description="Configure and reorder sales pipeline stages." />

      <Card className="mb-4">
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label>Stage name</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Stage name" className="mt-1" />
          </div>
          <div>
            <Label>Color</Label>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="mt-1 h-9 w-12 cursor-pointer block" />
          </div>
          <Button onClick={handleCreate}>+ Add</Button>
        </CardContent>
      </Card>

      <DataTable data={stages} columns={columns} loading={isLoading} emptyMessage="No stages configured." />
    </div>
  )
}
