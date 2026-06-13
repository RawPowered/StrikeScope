import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import type { Activity } from '@strikescope/shared/src/types'

export function useRecordDetail<T>(id: string | undefined, fetchPath: string, activityEntityType?: string) {
  const recordQuery = useQuery({
    queryKey: ['record-detail', fetchPath],
    queryFn: async () => {
      const r = await api.get<T>(fetchPath)
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data ?? null
    },
    enabled: !!id && !!fetchPath,
  })

  const activitiesQuery = useQuery({
    queryKey: ['activities', activityEntityType, id],
    queryFn: async () => {
      if (!activityEntityType || !id) return [] as Activity[]
      const r = await api.get<Activity[]>(`/api/admin/activities?entityType=${activityEntityType}&entityId=${id}`)
      return r.ok && r.data ? r.data : []
    },
    enabled: !!activityEntityType && !!id,
  })

  return {
    record: recordQuery.data ?? null,
    activities: activitiesQuery.data ?? [],
    isLoading: recordQuery.isLoading,
    isError: recordQuery.isError,
    refetch: () => {
      recordQuery.refetch()
      activitiesQuery.refetch()
    },
  }
}
