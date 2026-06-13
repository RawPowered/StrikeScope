import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { PageHeader } from '../../layout/PageHeader'
import { ViewToggle } from '../../components/ViewToggle'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent } from '../../components/ui/card'
import { LoadingState } from '../../components/EmptyState'

const MODULES = ['leads', 'customers', 'contacts', 'agreements', 'projects', 'submissions'] as const

interface BuiltinField {
  fieldKey: string; label: string; isBuiltin: boolean; isLocked: boolean; isEnabled: boolean
}

export default function FieldVisibility() {
  const [activeModule, setActiveModule] = useState<typeof MODULES[number]>('leads')
  const [draft, setDraft] = useState<BuiltinField[]>([])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['field-settings', activeModule],
    queryFn: async () => {
      const r = await api.get<{ builtins: BuiltinField[] }>(`/api/admin/field-settings/${activeModule}`)
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data
    },
  })

  const builtins = draft.length ? draft : (data?.builtins || [])

  const loadDraft = () => {
    if (data?.builtins) setDraft(data.builtins.map(b => ({ ...b })))
  }

  const toggle = (fieldKey: string) => {
    setDraft(prev => {
      const base = prev.length ? prev : (data?.builtins || []).map(b => ({ ...b }))
      return base.map(b => b.fieldKey === fieldKey && !b.isLocked ? { ...b, isEnabled: !b.isEnabled } : b)
    })
  }

  const save = async () => {
    const settings = (draft.length ? draft : data?.builtins || []).map(b => ({ fieldKey: b.fieldKey, isEnabled: b.isEnabled }))
    const r = await api.put(`/api/admin/field-settings/${activeModule}`, { settings }).catch(() => null)
    if (r?.ok) { toast.success('Field visibility saved'); setDraft([]); refetch() }
    else toast.error(r?.error || 'Failed to save')
  }

  return (
    <div>
      <PageHeader title="Field Visibility" description="Enable or disable built-in fields per module. Name and email cannot be disabled." />
      <div className="mb-4 flex gap-2 flex-wrap">
        <ViewToggle value={activeModule} onChange={v => { setActiveModule(v as typeof MODULES[number]); setDraft([]) }}
          options={MODULES.map(m => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }))} />
        <Button variant="outline" size="sm" onClick={loadDraft}>Edit</Button>
        <Button size="sm" onClick={save} disabled={!draft.length}>Save</Button>
      </div>
      {isLoading ? <LoadingState rows={4} /> : (
        <div className="space-y-2">
          {builtins.map(b => (
            <Card key={b.fieldKey}>
              <CardContent className="py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{b.label}</span>
                  <span className="text-xs text-muted-foreground font-mono">{b.fieldKey}</span>
                  {b.isLocked && <Badge variant="secondary">Locked</Badge>}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={b.isEnabled} disabled={b.isLocked} onChange={() => toggle(b.fieldKey)} />
                  Enabled
                </label>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
