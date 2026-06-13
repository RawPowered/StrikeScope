import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { useConfirm } from '../../components/ConfirmDialog'
import { useDevStudio } from './useDevStudio'

export function SnapshotPanel() {
  const { listSnapshots, rollback } = useDevStudio()
  const confirm = useConfirm()
  const [snapshots, setSnapshots] = useState<{ id: string; createdAt: string; prompt?: string; files: { path: string }[] }[]>([])

  const load = () => {
    listSnapshots().then(r => {
      if (r.ok && r.data) setSnapshots(r.data)
    })
  }

  useEffect(() => { load() }, [listSnapshots])

  const doRollback = async (id: string) => {
    const ok = await confirm({
      title: 'Rollback snapshot?',
      description: 'This restores files and database from the snapshot. Restart server if DB was restored.',
      confirmLabel: 'Rollback',
      variant: 'destructive',
    })
    if (!ok) return
    const r = await rollback(id)
    if (r.ok) {
      toast.success(`Restored ${r.data?.restoredFiles.length || 0} file(s)${r.data?.dbRestored ? ' + DB' : ''}`)
      load()
    } else {
      toast.error(r.error || 'Rollback failed')
    }
  }

  return (
    <div className="p-2 space-y-2 text-xs max-h-48 overflow-auto">
      <p className="font-medium text-sm">Snapshots</p>
      {snapshots.length === 0 && <p className="text-muted-foreground">No snapshots yet</p>}
      {snapshots.map(s => (
        <div key={s.id} className="flex items-center justify-between rounded border p-2">
          <div>
            <p className="font-mono">{s.id.slice(0, 8)}…</p>
            <p className="text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</p>
            <p className="truncate">{s.prompt || `${s.files.length} files`}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => doRollback(s.id)}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}
