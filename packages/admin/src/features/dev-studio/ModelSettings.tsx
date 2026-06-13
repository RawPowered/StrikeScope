import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { useDevStudio } from './useDevStudio'

export function ModelSettings() {
  const { getModels, selectModel, createPlatformModel } = useDevStudio()
  const [models, setModels] = useState<{ name: string }[]>([])
  const [activeModel, setActiveModel] = useState<string | null>(null)
  const [selected, setSelected] = useState('')
  const [modelError, setModelError] = useState('')
  const [creating, setCreating] = useState(false)

  const load = () => {
    getModels().then(r => {
      if (r.ok && r.data) {
        setModels(r.data.models || [])
        setActiveModel(r.data.activeModel)
        setModelError(r.data.modelError || '')
        if (r.data.activeModel) setSelected(r.data.activeModel)
      }
    })
  }

  useEffect(() => { load() }, [getModels])

  const onSelect = async () => {
    const r = await selectModel(selected)
    if (r.ok) {
      toast.success(`Model set to ${selected}`)
      load()
    } else toast.error(r.error || 'Failed to select model')
  }

  const onCreate = async () => {
    setCreating(true)
    const r = await createPlatformModel()
    setCreating(false)
    if (r.ok) {
      const name = r.data?.model || 'strikescope-dev'
      toast.success(`Created ${name} — now active for Dev Studio`)
      setSelected(name)
      load()
    } else {
      toast.error(r.error || 'Create failed', {
        description: 'Ensure qwen2.5-coder:7b is pulled. CLI: ollama create strikescope-dev -f packages/server/data/dev-agent/Modelfile',
      })
    }
  }

  return (
    <div className="space-y-3 text-sm">
      {modelError && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900 text-xs">
          {modelError}
          <br />
          <code className="mt-1 block">ollama pull qwen2.5-coder:7b</code>
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Active: <span className="font-mono text-foreground">{activeModel || 'none'}</span>
      </p>
      <div className="flex gap-2 items-center">
        <select
          className="flex-1 rounded border px-2 py-1 text-xs bg-background"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          <option value="">Auto-resolve</option>
          {models.map(m => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={onSelect} disabled={!selected}>Use</Button>
      </div>
      <Button size="sm" onClick={onCreate} disabled={creating}>
        {creating ? 'Creating…' : 'Create StrikeScope model'}
      </Button>
      <p className="text-muted-foreground text-[10px] leading-snug">
        Builds <span className="font-mono">strikescope-dev</span> from qwen2.5-coder with platform system prompt and 16k context.
        Recommended for local code edits.
      </p>
    </div>
  )
}
