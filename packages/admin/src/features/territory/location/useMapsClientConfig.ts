import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api'

export type MapsClientConfig = {
  enableAddressAutocomplete?: boolean
  enableDirections?: boolean
  enableMapEmbed?: boolean
}

export function useMapsClientConfig() {
  return useQuery({
    queryKey: ['maps-client-config'],
    queryFn: async () => {
      const r = await api.get<MapsClientConfig>('/api/admin/maps/client-config')
      return r.ok && r.data ? r.data : { enableAddressAutocomplete: false, enableDirections: false, enableMapEmbed: false }
    },
    staleTime: 60_000,
  })
}
