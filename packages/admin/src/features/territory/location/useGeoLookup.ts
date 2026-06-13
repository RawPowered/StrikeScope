import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api'

export function useGeoCounties(state: string) {
  return useQuery({
    queryKey: ['geo', 'counties', state],
    queryFn: async () => {
      if (!state) return []
      const r = await api.get<{ name: string; fips?: string | null; custom?: boolean }[]>(`/api/admin/geo/counties?state=${state}`)
      return r.ok && r.data ? r.data : []
    },
    enabled: !!state,
    staleTime: 300_000,
  })
}

export function useGeoCities(state: string, county: string) {
  return useQuery({
    queryKey: ['geo', 'cities', state, county],
    queryFn: async () => {
      if (!state || !county) return []
      const r = await api.get<{ name: string; custom?: boolean }[]>(
        `/api/admin/geo/cities?state=${encodeURIComponent(state)}&county=${encodeURIComponent(county)}`,
      )
      return r.ok && r.data ? r.data : []
    },
    enabled: !!state && !!county,
    staleTime: 300_000,
  })
}

export async function lookupZip(zip: string) {
  const normalized = zip.replace(/\D/g, '').slice(0, 5)
  if (normalized.length !== 5) return []
  const r = await api.get<{ zip: string; state: string; city: string; countyName: string }[]>(`/api/admin/geo/zip/${normalized}`)
  return r.ok && r.data ? r.data : []
}
