import type { PatchItem } from './useDevStudio'
import { Button } from '../../components/ui/button'

interface Props {
  patches: PatchItem[]
  migration?: { filename: string; sql: string } | null
  warnings?: string[]
  onApply: () => void
  onReject: () => void
  applying?: boolean
}

export function DiffPreview({ patches, migration, warnings, onApply, onReject, applying }: Props) {
  if (!patches.length && !migration) return null

  return (
    <div className="border-t bg-muted/20 p-3 space-y-2 max-h-48 overflow-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Proposed changes: {patches.length} file(s){migration ? ` + migration ${migration.filename}` : ''}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onReject} disabled={applying}>Reject</Button>
          <Button size="sm" onClick={onApply} disabled={applying}>{applying ? 'Applying…' : 'Apply'}</Button>
        </div>
      </div>
      {warnings?.map((w, i) => (
        <p key={i} className="text-xs text-amber-600">{w}</p>
      ))}
      {patches.map(p => (
        <div key={p.path} className="rounded border bg-background p-2 text-xs">
          <p className="font-mono font-medium">{p.path}</p>
          <p className="text-muted-foreground">{p.content.length} chars</p>
        </div>
      ))}
      {migration && (
        <pre className="rounded border bg-background p-2 text-xs overflow-auto max-h-24">{migration.sql}</pre>
      )}
    </div>
  )
}
