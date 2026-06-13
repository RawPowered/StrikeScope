import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api'
import { PageHeader } from '../../layout/PageHeader'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { LoadingState } from '../../components/EmptyState'
import { US_STATES } from '../../lib/us-states'
import type { TerritoryConfig } from '@strikescope/shared/src/types'

export default function TerritorySettings() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<TerritoryConfig>({
    enabledStates: [], splitByState: true, directoryContactsEnabled: true,
    maps: { enableAddressAutocomplete: false, enableDirections: false, enableMapEmbed: false },
  })
  const [apiKeyInput, setApiKeyInput] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['territory'],
    queryFn: async () => {
      const r = await api.get<TerritoryConfig>('/api/admin/territory')
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data!
    },
  })

  useEffect(() => {
    if (data) {
      setForm({
        ...data,
        maps: data.maps || { enableAddressAutocomplete: false, enableDirections: false, enableMapEmbed: false },
      })
      setApiKeyInput('')
    }
  }, [data])

  const toggleState = (code: string) => {
    setForm(f => ({
      ...f,
      enabledStates: f.enabledStates.includes(code)
        ? f.enabledStates.filter(s => s !== code)
        : [...f.enabledStates, code].sort(),
    }))
  }

  const save = async () => {
    const payload = {
      ...form,
      maps: {
        ...form.maps,
        ...(apiKeyInput.trim() ? { apiKey: apiKeyInput.trim() } : {}),
      },
    }
    const r = await api.put('/api/admin/territory', payload).catch(() => null)
    if (r?.ok) {
      toast.success('Territory settings saved')
      await queryClient.invalidateQueries({ queryKey: ['territory'] })
      await queryClient.invalidateQueries({ queryKey: ['maps-client-config'] })
      refetch()
    } else toast.error(r?.error || 'Failed to save')
  }

  if (isLoading) return <><PageHeader title="Territory Settings" /><LoadingState rows={4} /></>

  return (
    <div>
      <PageHeader title="Territory Settings" actions={<Button onClick={save}>Save</Button>} />
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div>
            <Label className="text-base font-medium">Service States</Label>
            <p className="text-sm text-muted-foreground mb-3">Select states to enable territory tabs on CRM lists.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto border rounded-md p-3">
              {US_STATES.map(s => (
                <label key={s.code} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enabledStates.includes(s.code)}
                    onChange={() => toggleState(s.code)}
                  />
                  {s.code}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.splitByState} onChange={e => setForm(f => ({ ...f, splitByState: e.target.checked }))} />
            Split CRM lists into state tabs
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.directoryContactsEnabled} onChange={e => setForm(f => ({ ...f, directoryContactsEnabled: e.target.checked }))} />
            Enable directory contacts (County/State, Bank, custom categories)
          </label>

          <div className="border-t border-border pt-4 space-y-3">
            <Label className="text-base font-medium">Google Maps</Label>
            <p className="text-sm text-muted-foreground">
              Per-company API key. Enable Places API and Maps Embed API in Google Cloud; restrict key by HTTP referrer.
            </p>
            <div>
              <Label>API key</Label>
              <Input
                type="password"
                className="mt-1 max-w-md"
                placeholder={form.maps?.apiKey ? `Configured (${form.maps.apiKey})` : 'AIza…'}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
              />
              {form.maps?.apiKey && !apiKeyInput && (
                <p className="text-xs text-muted-foreground mt-1">Leave blank to keep existing key.</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.maps?.enableAddressAutocomplete}
                onChange={e => setForm(f => ({ ...f, maps: { ...f.maps, enableAddressAutocomplete: e.target.checked } }))}
              />
              Address autocomplete (Places API via server proxy)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.maps?.enableDirections}
                onChange={e => setForm(f => ({ ...f, maps: { ...f.maps, enableDirections: e.target.checked } }))}
              />
              Directions links on lead/project detail
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.maps?.enableMapEmbed}
                onChange={e => setForm(f => ({ ...f, maps: { ...f.maps, enableMapEmbed: e.target.checked } }))}
              />
              Map embed on lead/project detail
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
