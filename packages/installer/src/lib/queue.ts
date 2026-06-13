import type { GuideItem } from '@strikescope/shared/src/types'

export interface QueueState {
  [guideItemId: string]: {
    taken: number
    required: number
    photos: { data: string; capturedAt: string; gpsLat?: number; gpsLng?: number }[]
  }
}

export function createQueue(items: GuideItem[]): QueueState {
  const q: QueueState = {}
  for (const item of items) {
    q[item.id] = { taken: 0, required: item.requiredCount, photos: [] }
  }
  return q
}

export function addToQueue(
  queue: QueueState,
  itemId: string,
  photo: { data: string; capturedAt: string; gpsLat?: number; gpsLng?: number }
): QueueState {
  const entry = queue[itemId]
  if (!entry) return queue
  return {
    ...queue,
    [itemId]: {
      ...entry,
      taken: entry.taken + 1,
      photos: [...entry.photos, photo],
    },
  }
}

export function totalTaken(queue: QueueState): number {
  return Object.values(queue).reduce((sum, e) => sum + e.taken, 0)
}

export function totalRequired(queue: QueueState): number {
  return Object.values(queue).reduce((sum, e) => sum + e.required, 0)
}

export function isItemComplete(queue: QueueState, itemId: string): boolean {
  const entry = queue[itemId]
  return entry ? entry.taken >= entry.required : false
}
