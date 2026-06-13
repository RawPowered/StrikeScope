import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { useDevStudio } from './useDevStudio'

export function KnowledgePanel() {
  const { getKnowledgeStats, syncKnowledge } = useDevStudio()
  const [stats, setStats] = useState<{ chunkCount: number; goldenCount: number; lastSync: string | null } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState('')

  const load = () => {
    getKnowledgeStats().then(r => {
      if (r.ok && r.data) setStats(r.data)
    })
  }

  useEffect(() => { load() }, [getKnowledgeStats])

  const sync = async (full = false) => {
    setSyncing(true)
    setProgress('Starting…')
    try {
      for await (const ev of syncKnowledge(full)) {
        if (ev.type === 'progress') {
          setProgress(`${ev.phase}: ${ev.path || ''} (${ev.current}/${ev.total})`)
        }
        if (ev.type === 'done') {
          toast.success(`Indexed ${ev.indexed} chunks (${ev.errors} errors)`)
          load()
        }
        if (ev.type === 'error') toast.error(ev.error)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
      setProgress('')
    }
  }

  return (
    <div className="p-3 space-y-3 text-sm">
      <p className="font-medium">Platform Knowledge</p>
      {stats && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Chunks: {stats.chunkCount}</p>
          <p>Golden examples: {stats.goldenCount}</p>
          <p>Last sync: {stats.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Never'}</p>
        </div>
      )}
      {progress && <p className="text-xs font-mono">{progress}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => sync(false)} disabled={syncing}>
          <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          Sync
        </Button>
        <Button size="sm" variant="outline" onClick={() => sync(true)} disabled={syncing}>Full rebuild</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Indexes EnVars, plugins, routes, migrations, and source for RAG. Learns from approved patches.
      </p>
    </div>
  )
}
