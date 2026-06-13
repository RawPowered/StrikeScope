import { Select } from '../../components/ui/select'
import { useTerritoryFilters, useTerritoryCities } from './useTerritoryFilters'

export function CityFilter() {
  const { state, city, setCity } = useTerritoryFilters()
  const { data: cities = [] } = useTerritoryCities(state)

  if (!state) return null

  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm text-muted-foreground">City</span>
      <Select
        className="w-48"
        value={city}
        onChange={e => setCity(e.target.value)}
      >
        <option value="">All cities</option>
        {cities.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>
    </div>
  )
}
