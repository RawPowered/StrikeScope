import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '../../../api'

export type GeoCounty = { name: string; fips?: string | null; custom?: boolean }
export type GeoCity = { name: string; custom?: boolean }
export type ZipRow = { zip: string; state: string; city: string; countyName: string; countyFips?: string | null }

export type GeoCascadeResult = {
  zip: ZipRow[]
  counties: GeoCounty[]
  cities: GeoCity[]
}

const empty: GeoCascadeResult = { zip: [], counties: [], cities: [] }

export function useGeoCascade(state: string, county: string, zip: string) {
  const zipNorm = zip.replace(/\D/g, '').slice(0, 5)
  const zipParam = zipNorm.length === 5 ? zipNorm : ''

  return useQuery({
    queryKey: ['geo', 'cascade', state, county, zipParam],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (state) params.set('state', state)
      if (county) params.set('county', county)
      if (zipParam) params.set('zip', zipParam)
      const r = await api.get<GeoCascadeResult>(`/api/admin/geo/cascade?${params}`)
      return r.ok && r.data ? r.data : empty
    },
    enabled: !!(state || zipParam),
    staleTime: 300_000,
    placeholderData: keepPreviousData,
  })
}
