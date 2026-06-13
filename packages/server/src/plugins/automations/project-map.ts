import type Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'
import { getAutomationsConfig } from './config.js'

export function companyExternalProjectId(companyId: string): string {
  return `company:${companyId}`
}

export function ensureCompanyProject(db: Database.Database, companyId: string) {
  const externalId = companyExternalProjectId(companyId)
  const existing = db.prepare(
    'SELECT id, external_project_id as externalProjectId FROM automation_projects WHERE company_id = ?',
  ).get(companyId) as { id: string; externalProjectId: string } | undefined

  if (existing) return existing

  const id = uuid()
  db.prepare(`INSERT INTO automation_projects (id, company_id, external_project_id, is_platform)
    VALUES (?, ?, ?, 0)`).run(id, companyId, externalId)
  return { id, externalProjectId: externalId }
}

export function ensurePlatformProject(db: Database.Database) {
  const cfg = getAutomationsConfig()
  const existing = db.prepare(
    'SELECT id, external_project_id as externalProjectId FROM automation_projects WHERE is_platform = 1',
  ).get() as { id: string; externalProjectId: string } | undefined

  if (existing) return existing

  const id = uuid()
  db.prepare(`INSERT INTO automation_projects (id, company_id, external_project_id, is_platform)
    VALUES (?, NULL, ?, 1)`).run(id, cfg.platformExternalProjectId)
  return { id, externalProjectId: cfg.platformExternalProjectId }
}

export function resolveExternalProjectId(
  db: Database.Database,
  companyId: string | null,
  usePlatformTemplates: boolean,
): string {
  if (usePlatformTemplates) {
    return ensurePlatformProject(db).externalProjectId
  }
  if (!companyId) throw new Error('Company context required')
  return ensureCompanyProject(db, companyId).externalProjectId
}
