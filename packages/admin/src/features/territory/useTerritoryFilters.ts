import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import type { TerritoryConfig } from '@strikescope/shared/src/types'

export function useTerritoryConfig() {
  return useQuery({
    queryKey: ['territory'],
    queryFn: async () => {
      const r = await api.get<TerritoryConfig>('/api/admin/territory')
      if (!r.ok) throw new Error(r.error || 'Failed to load territory')
      return r.data || { enabledStates: [], splitByState: true, directoryContactsEnabled: true }
    },
    staleTime: 60_000,
  })
}

export function territoryFiltersActive(config?: TerritoryConfig | null) {
  return !!(config?.enabledStates?.length && config.splitByState)
}

export function useTerritoryFilters() {
  const { data: territory } = useTerritoryConfig()
  const [searchParams, setSearchParams] = useSearchParams()
  const active = territoryFiltersActive(territory)

  const rawState = searchParams.get('state') || ''
  const rawCity = searchParams.get('city') || ''
  const state = active ? rawState : ''
  const city = active ? rawCity : ''

  useEffect(() => {
    if (active || (!rawState && !rawCity)) return
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('state')
      next.delete('city')
      return next
    }, { replace: true })
  }, [active, rawState, rawCity, setSearchParams])

  const setState = useCallback((s: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (s) next.set('state', s)
      else next.delete('state')
      next.delete('city')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const setCity = useCallback((c: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (c) next.set('city', c)
      else next.delete('city')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const queryString = useMemo(() => {
    if (!active) return ''
    const p = new URLSearchParams()
    if (state) p.set('state', state)
    if (city) p.set('city', city)
    const s = p.toString()
    return s ? `&${s}` : ''
  }, [active, state, city])

  return { state, city, setState, setCity, queryString, searchParams, territoryActive: active }
}

export function useTerritoryCities(state: string) {
  return useQuery({
    queryKey: ['territory', 'cities', state],
    queryFn: async () => {
      if (!state) return []
      const r = await api.get<string[]>(`/api/admin/territory/cities?state=${state}`)
      return r.ok && r.data ? r.data : []
    },
    enabled: !!state,
  })
}
