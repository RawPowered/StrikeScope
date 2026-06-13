import type Database from 'better-sqlite3'
import { computeProjectProgress } from '../project-progress.js'

export interface StaleResult {
  isStale: boolean
  kind?: 'not_started' | 'mid_progress_idle' | 'incomplete_sla'
  detail?: string
  since?: string | null
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000)
}

export function getTemplateForProject(db: Database.Database, projectId: string) {
  const p = db.prepare('SELECT project_type_id as projectTypeId FROM projects WHERE id=?').get(projectId) as any
  if (!p?.projectTypeId) {
    return db.prepare(`SELECT enable_stale_warnings as enableStaleWarnings, sla_days_not_started as slaDaysNotStarted,
      sla_days_incomplete as slaDaysIncomplete, stale_days_idle as staleDaysIdle
      FROM task_templates WHERE is_global=1 AND is_default=1 AND is_active=1 LIMIT 1`).get() as any
  }
  return db.prepare(`SELECT enable_stale_warnings as enableStaleWarnings, sla_days_not_started as slaDaysNotStarted,
    sla_days_incomplete as slaDaysIncomplete, stale_days_idle as staleDaysIdle
    FROM task_templates WHERE project_type_id=? AND is_default=1 AND is_active=1 LIMIT 1`).get(p.projectTypeId) as any
}

export function hasFutureSchedule(db: Database.Database, projectId: string, projectRow: any): boolean {
  const now = Date.now()
  if (projectRow.scheduledInstallAt && new Date(projectRow.scheduledInstallAt).getTime() > now) return true
  const futureItem = db.prepare(`SELECT 1 FROM project_task_items WHERE project_id=? AND scheduled_at IS NOT NULL AND scheduled_at > datetime('now') LIMIT 1`).get(projectId)
  return !!futureItem
}

export function hasOpenShift(db: Database.Database, projectId: string): boolean {
  const row = db.prepare('SELECT 1 FROM time_logs WHERE project_id=? AND clock_out_time IS NULL LIMIT 1').get(projectId)
  return !!row
}

export function computeProjectStale(db: Database.Database, projectId: string, now = new Date()): StaleResult {
  const project = db.prepare(`SELECT id, status, scheduled_install_at as scheduledInstallAt,
    sprint_started_at as sprintStartedAt, last_field_activity_at as lastFieldActivityAt
    FROM projects WHERE id=?`).get(projectId) as any
  if (!project || project.status !== 'active') return { isStale: false }

  const template = getTemplateForProject(db, projectId)
  if (!template?.enableStaleWarnings) return { isStale: false }

  const progress = computeProjectProgress(db, projectId)
  if (progress.percentComplete >= 100) return { isStale: false }
  if (hasFutureSchedule(db, projectId, project)) return { isStale: false }
  if (hasOpenShift(db, projectId)) return { isStale: false }

  const idleDays = template.staleDaysIdle ?? 3
  const slaNotStarted = template.slaDaysNotStarted
  const slaIncomplete = template.slaDaysIncomplete

  if (progress.percentComplete === 0 && project.scheduledInstallAt && slaNotStarted != null) {
    const sched = new Date(project.scheduledInstallAt)
    if (daysBetween(sched, now) > slaNotStarted) {
      return {
        isStale: true,
        kind: 'not_started',
        detail: `Not started ${slaNotStarted}+ days after scheduled install`,
        since: project.scheduledInstallAt,
      }
    }
  }

  if (progress.percentComplete > 0 && project.sprintStartedAt && slaIncomplete != null) {
    const started = new Date(project.sprintStartedAt)
    if (daysBetween(started, now) > slaIncomplete) {
      return {
        isStale: true,
        kind: 'incomplete_sla',
        detail: `Incomplete ${slaIncomplete}+ days since sprint started`,
        since: project.sprintStartedAt,
      }
    }
  }

  if (progress.percentComplete > 0 && progress.percentComplete < 100) {
    const lastAct = project.lastFieldActivityAt || progress.lastCompleted?.completedAt
    if (lastAct) {
      const idle = daysBetween(new Date(lastAct), now)
      if (idle >= idleDays) {
        return {
          isStale: true,
          kind: 'mid_progress_idle',
          detail: `No field activity for ${idle} days with work in progress`,
          since: lastAct,
        }
      }
    }
  }

  return { isStale: false }
}

export function listStaleProjects(db: Database.Database, companyId: string) {
  const projects = db.prepare(`SELECT id FROM projects WHERE company_id=? AND status='active' AND deleted_at IS NULL`).all(companyId) as any[]
  const stale: any[] = []
  for (const p of projects) {
    const result = computeProjectStale(db, p.id)
    if (result.isStale) {
      const row = db.prepare(`SELECT p.id, p.name, c.name as customerName FROM projects p LEFT JOIN customers c ON c.id=p.customer_id WHERE p.id=?`).get(p.id) as any
      stale.push({ ...row, ...result })
    }
  }
  return stale
}
