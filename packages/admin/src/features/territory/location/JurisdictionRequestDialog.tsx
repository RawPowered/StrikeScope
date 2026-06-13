import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../api'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { Select } from '../../../components/ui/select'
import { US_STATES } from '../../../lib/us-states'

export function JurisdictionRequestDialog({ open, onClose, initial }: {
  open: boolean
  onClose: () => void
  initial?: { state?: string; county?: string; city?: string; zip?: string }
}) {
  const [state, setState] = useState(initial?.state || '')
  const [county, setCounty] = useState(initial?.county || '')
  const [city, setCity] = useState(initial?.city || '')
  const [zip, setZip] = useState(initial?.zip || '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const submit = async () => {
    if (!state || !county.trim() || !reason.trim()) {
      toast.error('State, county, and reason are required')
      return
    }
    setBusy(true)
    const r = await api.post('/api/admin/geo/jurisdiction-requests', {
      state, county: county.trim(), city: city.trim() || null, zip: zip.trim() || null, reason: reason.trim(),
    }).catch(() => null)
    setBusy(false)
    if (r?.ok) {
      toast.success('Jurisdiction request submitted for admin approval')
      onClose()
      setReason('')
    } else toast.error(r?.error || 'Failed to submit')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-surface text-foreground rounded-lg border border-border shadow-lg w-full max-w-md p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold">Request new county / jurisdiction</h3>
        <p className="text-sm text-muted-foreground">An admin will review and approve before it appears in dropdowns.</p>
        <div>
          <Label>State</Label>
          <Select className="mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            <option value="">—</option>
            {US_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </Select>
        </div>
        <div>
          <Label>County / jurisdiction *</Label>
          <Input className="mt-1" value={county} onChange={e => setCounty(e.target.value)} placeholder="e.g. Maricopa County" />
        </div>
        <div>
          <Label>City (optional)</Label>
          <Input className="mt-1" value={city} onChange={e => setCity(e.target.value)} />
        </div>
        <div>
          <Label>ZIP (optional)</Label>
          <Input className="mt-1" value={zip} onChange={e => setZip(e.target.value)} maxLength={10} />
        </div>
        <div>
          <Label>Reason *</Label>
          <Textarea className="mt-1" value={reason} onChange={e => setReason(e.target.value)} rows={3} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit'}</Button>
        </div>
      </div>
    </div>
  )
}
