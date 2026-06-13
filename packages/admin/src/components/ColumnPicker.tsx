import { useEffect, useState, useRef } from 'react'
import { api } from '../api'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import type { CustomFieldDefinition } from '@strikescope/shared/src/types'

interface Props {
  entity: string
  builtInFields: { key: string; label: string }[]
  selectedColumns: string[]
  onSave: (columns: string[]) => void
}

export default function ColumnPicker({ entity, builtInFields, selectedColumns, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [draft, setDraft] = useState<string[]>(selectedColumns)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setDraft(selectedColumns)
    api.get<CustomFieldDefinition[]>(`/api/admin/custom-fields/${entity}`).then(r => {
      if (r.ok && r.data) setCustomFields(r.data)
    }).finally(() => setLoading(false))
  }, [open, entity, selectedColumns])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const allColumns = [
    ...builtInFields,
    ...customFields.map(cf => ({ key: `cf_${cf.fieldName}`, label: cf.label })),
  ]

  const LOCKED = new Set(['name', 'email'])

  const toggle = (key: string) => {
    if (LOCKED.has(key)) return
    setDraft(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  return (
    <div ref={ref} className="relative inline-block">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        Columns {selectedColumns.length > 0 ? `(${selectedColumns.length})` : ''}
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[220px] max-h-80 overflow-y-auto rounded-lg border border-border bg-surface p-3 shadow-lg">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Display columns</p>
          {loading ? (
            <div className="space-y-2 mb-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-5 w-full" />)}
            </div>
          ) : (
            allColumns.map(col => {
              const locked = LOCKED.has(col.key)
              return (
                <label key={col.key} className={`flex items-center gap-2 py-1 text-sm ${locked ? 'opacity-70' : 'cursor-pointer hover:text-foreground'}`}>
                  <input type="checkbox" checked={locked || draft.includes(col.key)} disabled={locked} onChange={() => toggle(col.key)} className="rounded" />
                  {col.label}{locked ? ' (required)' : ''}
                </label>
              )
            })
          )}
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            <Button size="sm" onClick={() => { onSave(draft); setOpen(false) }}>Apply</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
