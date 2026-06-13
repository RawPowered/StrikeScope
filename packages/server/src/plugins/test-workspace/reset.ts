import type Database from 'better-sqlite3'
import { DEFAULT_TEST_COMPANY_ID } from '../../active-company.js'
import { invalidateTerritoryCache } from '../../territory.js'

export function isSandboxCompany(db: Database.Database, companyId: string): boolean {
  if (companyId === DEFAULT_TEST_COMPANY_ID) return true
  const row = db.prepare('SELECT is_sandbox as isSandbox FROM companies WHERE id=?').get(companyId) as { isSandbox?: number } | undefined
  return !!row?.isSandbox
}

export function resetTestWorkspace(db: Database.Database, companyId: string) {
  if (!isSandboxCompany(db, companyId)) {
    throw new Error('Only sandbox / test workspaces can be reset')
  }

  const projectIds = db.prepare('SELECT id FROM projects WHERE company_id=?').all(companyId).map((r: any) => r.id as string)
  const customerIds = db.prepare('SELECT id FROM customers WHERE company_id=?').all(companyId).map((r: any) => r.id as string)
  const leadIds = db.prepare('SELECT id FROM leads WHERE company_id=?').all(companyId).map((r: any) => r.id as string)
  const contactIds = db.prepare('SELECT id FROM contacts WHERE company_id=?').all(companyId).map((r: any) => r.id as string)

  const del = (sql: string, ...params: unknown[]) => db.prepare(sql).run(...params)

  const tx = db.transaction(() => {
    for (const id of projectIds) {
      const subIds = db.prepare('SELECT id FROM submissions WHERE project_id=?').all(id).map((r: any) => r.id as string)
      for (const sid of subIds) del('DELETE FROM submission_images WHERE submission_id=?', sid)
      del('DELETE FROM submissions WHERE project_id=?', id)
      del('DELETE FROM project_task_items WHERE project_id=?', id)
      del('DELETE FROM project_assignments WHERE project_id=?', id)
      del('DELETE FROM project_contacts WHERE project_id=?', id)
      del('DELETE FROM project_cost_lines WHERE project_id=?', id)
      del('DELETE FROM project_finance_values WHERE project_id=?', id)
      del('DELETE FROM job_field_sessions WHERE project_id=?', id)
    }

    for (const id of customerIds) {
      del('DELETE FROM customer_properties WHERE customer_id=?', id)
      del('DELETE FROM property_contacts WHERE property_id IN (SELECT id FROM customer_properties WHERE customer_id=?)', id)
    }

    const entityIds = [...leadIds, ...customerIds, ...contactIds, ...projectIds]
    if (entityIds.length) {
      const placeholders = entityIds.map(() => '?').join(',')
      del(`DELETE FROM custom_field_values WHERE entity_id IN (${placeholders})`, ...entityIds)
    }

    del('DELETE FROM commission_report_lines WHERE report_id IN (SELECT id FROM commission_reports WHERE company_id=?)', companyId)
    del('DELETE FROM commission_reports WHERE company_id=?', companyId)
    del('DELETE FROM activities WHERE company_id=?', companyId)
    del('DELETE FROM agreements WHERE company_id=?', companyId)
    del('DELETE FROM contacts WHERE company_id=?', companyId)
    del('DELETE FROM projects WHERE company_id=?', companyId)
    del('DELETE FROM customers WHERE company_id=?', companyId)
    del('DELETE FROM leads WHERE company_id=?', companyId)
    del('DELETE FROM territory_jurisdiction_requests WHERE company_id=?', companyId)
    del('DELETE FROM territory_jurisdiction_custom WHERE company_id=?', companyId)
    del('DELETE FROM directory_contacts WHERE company_id=?', companyId)
    del('DELETE FROM duplicate_override_log WHERE company_id=?', companyId)
  })

  tx()
  invalidateTerritoryCache(companyId)

  return {
    companyId,
    cleared: { leads: leadIds.length, customers: customerIds.length, projects: projectIds.length },
  }
}
