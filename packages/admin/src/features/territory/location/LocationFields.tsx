import { useEffect, useRef, useState } from 'react'
import { Label } from '../../../components/ui/label'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Button } from '../../../components/ui/button'
import { US_STATES } from '../../../lib/us-states'
import { useAuth } from '../../../auth'
import { useTerritoryConfig } from '../useTerritoryFilters'
import { useGeoCascade } from './useGeoCascade'
import { useMapsClientConfig } from './useMapsClientConfig'
import { JurisdictionRequestDialog } from './JurisdictionRequestDialog'
import { AddressAutocomplete } from './AddressAutocomplete'

export interface LocationForm {
  address?: string
  city?: string
  state?: string
  county?: string
  zip?: string
}

const SUBMIT_ROLES = new Set(['sales_manager', 'project_manager', 'project_admin', 'company_admin', 'server_admin'])

export function LocationFields({ value, onChange }: {
  value: LocationForm
  onChange: (v: LocationForm) => void
}) {
  const { user } = useAuth()
  const { data: territory } = useTerritoryConfig()
  const { data: mapsConfig } = useMapsClientConfig()
  const [showRequest, setShowRequest] = useState(false)
  const [zipBusy, setZipBusy] = useState(false)
  const zipGenRef = useRef(0)
  const valueRef = useRef(value)
  valueRef.current = value

  const set = (k: keyof LocationForm, v: string) => onChange({ ...value, [k]: v })

  const stateOptions = territory?.enabledStates?.length
    ? US_STATES.filter(s => territory.enabledStates.includes(s.code))
    : US_STATES

  const { data: cascade, isLoading: cascadeLoading } = useGeoCascade(
    value.state || '',
    value.county || '',
    value.zip || '',
  )
  const counties = cascade?.counties ?? []
  const cities = cascade?.cities ?? []

  const canRequest = user && SUBMIT_ROLES.has(user.role)

  useEffect(() => {
    const z = (value.zip || '').replace(/\D/g, '')
    if (z.length !== 5) {
      setZipBusy(false)
      return
    }
    const gen = ++zipGenRef.current
    setZipBusy(true)
    const timer = setTimeout(() => {
      const results = cascade?.zip ?? []
      if (gen !== zipGenRef.current) return
      setZipBusy(false)
      if (!results.length) return
      const primary = results[0]
      const cur = valueRef.current
      onChange({
        ...cur,
        state: cur.state || primary.state,
        city: cur.city || primary.city,
        county: cur.county || primary.countyName,
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [value.zip, cascade?.zip, onChange])

  const countyInList = !value.county || counties.some(c => c.name === value.county)
  const cityInList = !value.city || cities.some(c => c.name === value.city)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <Label>Street Address</Label>
        <div className="mt-1">
          <AddressAutocomplete
            value={value}
            onChange={onChange}
            enabled={!!mapsConfig?.enableAddressAutocomplete}
          />
        </div>
      </div>
      <div>
        <Label>ZIP{zipBusy ? ' (looking up…)' : ''}</Label>
        <Input
          className="mt-1"
          value={value.zip || ''}
          onChange={e => set('zip', e.target.value)}
          maxLength={10}
        />
      </div>
      <div>
        <Label>State</Label>
        <Select className="mt-1 w-full" value={value.state || ''} onChange={e => onChange({ ...value, state: e.target.value, county: '', city: '' })}>
          <option value="">—</option>
          {stateOptions.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
        </Select>
      </div>
      <div>
        <Label>County</Label>
        {!value.state ? (
          <Select className="mt-1 w-full" disabled value="">
            <option value="">Select state first</option>
          </Select>
        ) : counties.length > 0 || cascadeLoading ? (
          <Select
            className="mt-1 w-full"
            value={value.county || ''}
            disabled={cascadeLoading}
            onChange={e => onChange({ ...value, county: e.target.value, city: '' })}
          >
            <option value="">{cascadeLoading ? 'Loading…' : '—'}</option>
            {counties.map(c => <option key={c.name} value={c.name}>{c.name}{c.custom ? ' (custom)' : ''}</option>)}
            {value.county && !countyInList && <option value={value.county}>{value.county}</option>}
          </Select>
        ) : (
          <Input className="mt-1" value={value.county || ''} onChange={e => set('county', e.target.value)} />
        )}
      </div>
      <div>
        <Label>City</Label>
        {!value.state || !value.county ? (
          <Select className="mt-1 w-full" disabled value="">
            <option value="">Select county first</option>
          </Select>
        ) : cities.length > 0 || cascadeLoading ? (
          <Select
            className="mt-1 w-full"
            value={value.city || ''}
            disabled={cascadeLoading}
            onChange={e => set('city', e.target.value)}
          >
            <option value="">{cascadeLoading ? 'Loading…' : '—'}</option>
            {cities.map(c => <option key={c.name} value={c.name}>{c.name}{c.custom ? ' (custom)' : ''}</option>)}
            {value.city && !cityInList && <option value={value.city}>{value.city}</option>}
          </Select>
        ) : (
          <Input className="mt-1" value={value.city || ''} onChange={e => set('city', e.target.value)} />
        )}
      </div>
      {canRequest && (
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowRequest(true)}>
            Request new county / jurisdiction
          </Button>
        </div>
      )}
      <JurisdictionRequestDialog
        open={showRequest}
        onClose={() => setShowRequest(false)}
        initial={{ state: value.state, county: value.county, city: value.city, zip: value.zip }}
      />
    </div>
  )
}
