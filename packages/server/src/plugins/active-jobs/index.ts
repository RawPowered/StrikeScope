import type Database from 'better-sqlite3'
import { computeProjectProgress } from '../project-progress.js'
import { computeProjectStale } from '../project-stale/index.js'

export function listActiveJobs(db: Database.Database, companyId: string, userId?: string, role?: string) {
  let query = `SELECT p.id, p.name, p.status, p.scheduled_install_at as scheduledInstallAt,
    p.sprint_started_at as sprintStartedAt, p.last_field_activity_at as lastFieldActivityAt,
    p.worksite_lat as worksiteLat, p.worksite_lng as worksiteLng,
    c.name as customerName, c.id as customerId,
    pt.name as projectTypeName
    FROM projects p
    LEFT JOIN customers c ON c.id=p.customer_id
    LEFT JOIN project_types pt ON pt.id=p.project_type_id
    WHERE p.company_id=? AND p.status='active' AND p.deleted_at IS NULL`
  const params: any[] = [companyId]

  if (userId && ['foreman', 'crewman', 'technician'].includes(role || '')) {
    query += ` AND EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id=p.id AND pa.user_id=?)`
    params.push(userId)
  }

  query += ` ORDER BY COALESCE(p.last_field_activity_at, '1970-01-01') DESC, p.name ASC`
  const rows = db.prepare(query).all(...params) as any[]

  return rows.map(row => {
    const progress = computeProjectProgress(db, row.id)
    const stale = computeProjectStale(db, row.id)
    const openShift = db.prepare(`SELECT tl.id, u.name as userName, tl.clock_in_time as clockInTime
      FROM time_logs tl JOIN users u ON u.id=tl.user_id
      WHERE tl.project_id=? AND tl.clock_out_time IS NULL LIMIT 5`).all(row.id)
    const foreman = db.prepare(`SELECT u.name as foremanName FROM project_assignments pa
      JOIN users u ON u.id=pa.user_id WHERE pa.project_id=? AND pa.role='foreman' LIMIT 1`).get(row.id) as any
    return {
      ...row,
      percentComplete: progress.percentComplete,
      completedSteps: progress.completedSteps,
      totalSteps: progress.totalSteps,
      currentStep: progress.currentStep,
      openShifts: openShift,
      foremanName: foreman?.foremanName || null,
      stale,
    }
  }).filter(j => j.percentComplete < 100 || j.openShifts.length > 0)
}
