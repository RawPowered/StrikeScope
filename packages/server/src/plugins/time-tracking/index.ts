import { v4 as uuid } from 'uuid'
import type Database from 'better-sqlite3'
import { expandLogAcrossMidnights, sprintIdForProject } from './shift-timer.js'

export type TimeLogStatus = 'active' | 'completed' | 'lunch_break' | 'material_run'

/** Split open logs that span midnight into completed segments + a new active row */
export function reconcileDayBoundariesForUser(db: Database.Database, userId: string) {
  const open = getActiveLog(db, userId) as any
  if (!open) return

  const segments = expandLogAcrossMidnights({
    id: open.id,
    userId: open.userId,
    guestName: open.guestName,
    projectId: open.projectId,
    sprintId: open.sprintId,
    clockInTime: open.clockInTime,
    clockOutTime: open.clockOutTime,
    status: open.status,
  })
  if (segments.length <= 1) return

  const completed = segments.slice(0, -1)
  const active = segments[segments.length - 1]

  const run = db.transaction(() => {
    const first = completed[0]
    db.prepare(`UPDATE time_logs SET clock_in_time=?, clock_out_time=?, status='completed' WHERE id=?`)
      .run(first.clockInTime, first.clockOutTime, open.id)

    for (let i = 1; i < completed.length; i++) {
      const seg = completed[i]
      db.prepare(`INSERT INTO time_logs (id, company_id, project_id, user_id, guest_name, foreman_user_id, sprint_id,
        clock_in_time, clock_out_time, clock_in_lat, clock_in_lng, status, notes_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', '[]')`)
        .run(uuid(), open.companyId, open.projectId, open.userId, open.guestName, open.foremanUserId, open.sprintId,
          seg.clockInTime, seg.clockOutTime, open.clockInLat, open.clockInLng)
    }

    db.prepare(`INSERT INTO time_logs (id, company_id, project_id, user_id, guest_name, foreman_user_id, sprint_id,
      clock_in_time, clock_in_lat, clock_in_lng, status, notes_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '[]')`)
      .run(uuid(), open.companyId, open.projectId, open.userId, open.guestName, open.foremanUserId, open.sprintId,
        active.clockInTime, open.clockInLat, open.clockInLng)
  })
  run()
}

export function getActiveLog(db: Database.Database, userId: string) {
  return db.prepare(`SELECT id, company_id as companyId, project_id as projectId, user_id as userId,
    guest_name as guestName, foreman_user_id as foremanUserId, sprint_id as sprintId,
    clock_in_time as clockInTime, clock_out_time as clockOutTime,
    clock_in_lat as clockInLat, clock_in_lng as clockInLng,
    clock_out_lat as clockOutLat, clock_out_lng as clockOutLng,
    status, notes_json as notesJson
    FROM time_logs WHERE user_id=? AND clock_out_time IS NULL AND guest_name IS NULL
    ORDER BY clock_in_time DESC LIMIT 1`).get(userId) as any
}

export function clockIn(
  db: Database.Database,
  opts: {
    companyId: string
    projectId: string
    userId: string
    lat: number
    lng: number
    foremanUserId?: string
    guestName?: string
  },
) {
  reconcileDayBoundariesForUser(db, opts.userId)
  const open = getActiveLog(db, opts.userId)
  if (open) throw new Error('User already has an open time log')

  const id = uuid()
  const sprintId = sprintIdForProject(opts.projectId)
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO time_logs (id, company_id, project_id, user_id, guest_name, foreman_user_id, sprint_id,
    clock_in_time, clock_in_lat, clock_in_lng, status, notes_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '[]')`)
    .run(id, opts.companyId, opts.projectId, opts.userId, opts.guestName || null, opts.foremanUserId || null, sprintId, now, opts.lat, opts.lng)

  db.prepare('UPDATE projects SET sprint_started_at=COALESCE(sprint_started_at, ?), last_field_activity_at=?, updated_at=? WHERE id=?')
    .run(now, now, now, opts.projectId)

  return db.prepare(`SELECT id, project_id as projectId, sprint_id as sprintId, clock_in_time as clockInTime, status
    FROM time_logs WHERE id=?`).get(id)
}

export function clockOut(db: Database.Database, userId: string, lat: number, lng: number) {
  const open = getActiveLog(db, userId)
  if (!open) throw new Error('No open time log')
  const now = new Date().toISOString()
  db.prepare(`UPDATE time_logs SET clock_out_time=?, clock_out_lat=?, clock_out_lng=?, status='completed' WHERE id=?`)
    .run(now, lat, lng, open.id)
  db.prepare('UPDATE projects SET last_field_activity_at=?, updated_at=? WHERE id=?').run(now, now, open.projectId)
  return { id: open.id, clockOutTime: now }
}

export function updateLogStatus(db: Database.Database, userId: string, status: TimeLogStatus, note?: string) {
  const open = getActiveLog(db, userId)
  if (!open) throw new Error('No open time log')
  let notes: string[] = []
  try { notes = JSON.parse(open.notesJson || '[]') } catch { notes = [] }
  if (note) notes.push(`[${new Date().toLocaleTimeString()}] ${note}`)
  db.prepare('UPDATE time_logs SET status=?, notes_json=? WHERE id=?').run(status, JSON.stringify(notes), open.id)
}

export function listOpenShifts(db: Database.Database, companyId: string) {
  return db.prepare(`SELECT tl.id, tl.project_id as projectId, tl.user_id as userId, u.name as userName,
    tl.clock_in_time as clockInTime, tl.status, p.name as projectName, c.name as customerName
    FROM time_logs tl
    JOIN projects p ON p.id=tl.project_id
    LEFT JOIN customers c ON c.id=p.customer_id
    JOIN users u ON u.id=tl.user_id
    WHERE tl.company_id=? AND tl.clock_out_time IS NULL AND tl.guest_name IS NULL
    ORDER BY tl.clock_in_time DESC`).all(companyId)
}
