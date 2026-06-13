export interface TimeLogRow {
  id: string
  userId: string
  guestName?: string | null
  projectId: string
  sprintId?: string | null
  clockInTime: string
  clockOutTime?: string | null
  status: string
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/** Split open log across midnight boundaries into completed segments + new active segment */
export function expandLogAcrossMidnights<T extends TimeLogRow>(log: T, now = new Date()): T[] {
  if (log.clockOutTime || log.guestName) return [log]
  const clockIn = new Date(log.clockInTime)
  if (startOfLocalDay(clockIn).getTime() >= startOfLocalDay(now).getTime()) return [log]

  const segments: T[] = []
  let cur: T = { ...log }
  let cursor = new Date(log.clockInTime)

  while (startOfLocalDay(cursor).getTime() < startOfLocalDay(now).getTime()) {
    const eod = endOfLocalDay(cursor)
    segments.push({ ...cur, clockOutTime: eod.toISOString(), status: 'completed' } as T)
    const nextStart = startOfLocalDay(new Date(cursor.getTime() + 86400000))
    cur = {
      ...cur,
      id: `TL-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      clockInTime: nextStart.toISOString(),
      clockOutTime: null,
      status: 'active',
    } as T
    cursor = nextStart
  }
  segments.push(cur)
  return segments
}

export function sprintIdForProject(projectId: string): string {
  return `SPRINT-${projectId}`
}
