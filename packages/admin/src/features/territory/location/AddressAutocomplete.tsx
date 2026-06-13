import { useEffect, useRef, useState } from 'react'
import { api } from '../../../api'
import { Input } from '../../../components/ui/input'
import type { LocationForm } from './LocationFields'

type Prediction = { description: string; place_id: string }

export function AddressAutocomplete({ value, onChange, enabled }: {
  value: LocationForm
  onChange: (v: LocationForm) => void
  enabled: boolean
}) {
  const [input, setInput] = useState(value.address || '')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const [sessionToken] = useState(() => crypto.randomUUID())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchGenRef = useRef(0)

  useEffect(() => { setInput(value.address || '') }, [value.address])

  const fetchPredictions = (text: string) => {
    if (!enabled || text.length < 3) { setPredictions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const gen = ++fetchGenRef.current
    debounceRef.current = setTimeout(async () => {
      const r = await api.post<{ predictions: Prediction[] }>('/api/admin/maps/autocomplete', {
        input: text, sessionToken,
      }).catch(() => null)
      if (gen !== fetchGenRef.current) return
      if (r?.ok && r.data?.predictions) {
        setPredictions(r.data.predictions)
        setOpen(true)
      } else {
        setPredictions([])
      }
    }, 300)
  }

  const selectPlace = async (placeId: string) => {
    setOpen(false)
    const r = await api.post<{
      address?: string; city?: string; state?: string; county?: string; zip?: string; formattedAddress?: string
    }>('/api/admin/maps/place-details', { placeId }).catch(() => null)
    if (r?.ok && r.data) {
      const d = r.data
      onChange({
        ...value,
        address: d.address || d.formattedAddress || value.address,
        city: d.city || value.city,
        state: d.state || value.state,
        county: d.county || value.county,
        zip: d.zip || value.zip,
      })
      setInput(d.address || d.formattedAddress || '')
    }
  }

  if (!enabled) {
    return (
      <Input
        value={value.address || ''}
        onChange={e => onChange({ ...value, address: e.target.value })}
      />
    )
  }

  return (
    <div className="relative">
      <Input
        value={input}
        onChange={e => {
          setInput(e.target.value)
          onChange({ ...value, address: e.target.value })
          fetchPredictions(e.target.value)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        autoComplete="off"
      />
      {open && predictions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-surface text-foreground shadow-lg">
          {predictions.map(p => (
            <li key={p.place_id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={e => e.preventDefault()}
                onClick={() => selectPlace(p.place_id)}
              >
                {p.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
