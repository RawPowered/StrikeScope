import type { ApiResponse } from '@strikescope/shared/src/types'

/** Normalize list API responses (paginated or plain array) */
export function asList<T>(res: ApiResponse<unknown>): T[] {
  if (!res.ok) return []
  const raw = res.data
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data
  }
  return []
}
