import { useState } from 'react'
import { FormDialog } from '../../components/ViewToggle'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/textarea'
import { Badge } from '../../components/ui/badge'

export interface DuplicateMatch {
  entityType: string; entityId: string; score: number; matchedFields: string[]
  record: Record<string, unknown>
}

interface Props {
  open: boolean
  matches: DuplicateMatch[]
  onClose: () => void
  onProceed: (overrideReason: string) => void
  onUseExisting?: (entityId: string) => void
}

export function DuplicateWarningDialog({ open, matches, onClose, onProceed, onUseExisting }: Props) {
  const [reason, setReason] = useState('')

  return (
    <FormDialog open={open} title="Possible duplicate detected" onClose={onClose} footer={
      <div className="flex flex-col gap-2 w-full">
        <Textarea placeholder="Override reason (required to create new record)..." value={reason} onChange={e => setReason(e.target.value)} rows={2} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => reason.trim() && onProceed(reason.trim())} disabled={!reason.trim()}>Proceed anyway</Button>
        </div>
      </div>
    }>
      <p className="text-sm text-muted-foreground mb-3">Similar records found. Link to an existing record or provide a reason to continue.</p>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {matches.map(m => (
          <div key={m.entityId} className="border border-border rounded-lg p-3 text-sm">
            <div className="flex justify-between items-start gap-2">
              <span className="font-medium">{String(m.record.name || m.record.firstName || 'Record')}</span>
              <Badge>{Math.round(m.score * 100)}% match</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {m.matchedFields.join(', ')} · {String(m.record.email || m.record.phone || '')}
            </p>
            {onUseExisting && (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => onUseExisting(m.entityId)}>Use this record</Button>
            )}
          </div>
        ))}
      </div>
    </FormDialog>
  )
}
