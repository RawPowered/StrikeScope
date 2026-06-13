import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent } from '../../components/ui/card'
import { FormDialog } from '../../components/ViewToggle'
import { LocationFields } from '../territory/LocationFields'
import type { Contact } from '@strikescope/shared/src/types'

interface Property {
  id: string; label: string; address: string; city: string; state: string; county: string; zip: string; isPrimary: boolean
}

export default function CustomerProperties({ customerId, contacts }: { customerId: string; contacts: Contact[] }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ label: '', address: '', city: '', state: '', county: '', zip: '', isPrimary: false, contactIds: [] as string[] })

  const { data: properties = [], refetch } = useQuery({
    queryKey: ['properties', customerId],
    queryFn: async () => {
      const r = await api.get<Property[]>(`/api/admin/customers/${customerId}/properties`)
      return r.ok && r.data ? r.data : []
    },
  })

  const save = async () => {
    const r = await api.post(`/api/admin/customers/${customerId}/properties`, form).catch(() => null)
    if (r?.ok) { toast.success('Property added'); setShowForm(false); refetch() }
    else toast.error(r?.error || 'Failed')
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setShowForm(true)}>+ Add Property</Button>
      </div>
      {properties.length === 0 ? <p className="text-sm text-muted-foreground">No properties yet.</p> : (
        <div className="space-y-2">
          {properties.map(p => (
            <Card key={p.id}>
              <CardContent className="py-3 text-sm">
                <div className="font-medium">{p.label || 'Property'}{p.isPrimary ? ' (Primary)' : ''}</div>
                <div className="text-muted-foreground">{[p.address, p.city, p.state, p.zip].filter(Boolean).join(', ') || '—'}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <FormDialog open={showForm} title="Add Property" onClose={() => setShowForm(false)} footer={
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
      }>
        <div className="space-y-3">
          <div><Label>Label</Label><Input className="mt-1" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Main, Rental, etc." /></div>
          <LocationFields value={form} onChange={v => setForm(f => ({ ...f, ...v }))} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPrimary} onChange={e => setForm(f => ({ ...f, isPrimary: e.target.checked }))} />Primary property</label>
          {contacts.length > 0 && (
            <div>
              <Label>Link contacts</Label>
              <div className="mt-1 space-y-1">
                {contacts.map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.contactIds.includes(c.id)} onChange={e => setForm(f => ({
                      ...f, contactIds: e.target.checked ? [...f.contactIds, c.id] : f.contactIds.filter(id => id !== c.id),
                    }))} />
                    {c.firstName} {c.lastName || ''}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </FormDialog>
    </div>
  )
}
