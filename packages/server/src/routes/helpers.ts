import { v4 as uuid } from 'uuid'
import type { Request, Response } from 'express'
import db from '../db.js'
import type { AuthUser } from '../auth.js'
import { emitAutomationEvent } from '../plugins/automations/emitter.js'

const ALLOWED_TABLES = new Set([
  'projects', 'agreements', 'customers', 'contacts', 'leads',
  'directory_contacts', 'finance_field_definitions', 'custom_field_definitions',
  'lead_stages', 'connections', 'users', 'activities', 'submissions',
  'project_assignments', 'form_definitions', 'form_submissions', 'form_links',
])

const ALLOWED_ENTITIES = new Set([
  'leads', 'customers', 'projects', 'contacts', 'agreements',
  'submissions', 'settings', 'users', 'audit', 'forms',
])

export interface PaginationParams {
  page: number
  perPage: number
  offset: number
}

export function parsePaginationParams(query: Record<string, any>): PaginationParams {
  const page = Math.max(1, parseInt(query.page as string, 10) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(query.perPage as string, 10) || 25))
  const offset = (page - 1) * perPage
  return { page, perPage, offset }
}

export interface PaginatedResponse<T> {
  ok: true
  data: T[]
  total: number
  page: number
  perPage: number
  hasMore: boolean
}

export function buildPaginatedResponse<T>(data: T[], total: number, page: number, perPage: number): PaginatedResponse<T> {
  return {
    ok: true,
    data,
    total,
    page,
    perPage,
    hasMore: page * perPage < total,
  }
}

export function appendAssignmentFilter(req: Request, tableAlias: string, whereParts: string[], params: any[]) {
  if (req.user?.roleName === 'Sales Agent' && req.user?.userId) {
    whereParts.push(`EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.project_id=${tableAlias}.id AND pa.user_id=? AND pa.role='sales_agent')`)
    params.push(req.user.userId)
  }
}

export function appendTerritoryFilters(
  query: Record<string, any>,
  tableAlias: string,
  whereParts: string[],
  params: any[],
) {
  if (query.state) { whereParts.push(`${tableAlias}.state = ?`); params.push(query.state) }
  if (query.city) { whereParts.push(`${tableAlias}.city = ?`); params.push(query.city) }
  if (query.county) { whereParts.push(`${tableAlias}.county = ?`); params.push(query.county) }
}

export function buildCfSelect(entity: string, alias: string): string {
  if (!ALLOWED_ENTITIES.has(entity)) {
    throw new Error(`Invalid entity: ${entity}`)
  }
  return `(SELECT JSON_GROUP_OBJECT(d.field_name, v.value) FROM custom_field_values v
    JOIN custom_field_definitions d ON d.id = v.field_definition_id
    WHERE v.entity = '${entity}' AND v.entity_id = ${alias}.id) as custom_fields_json`
}

/** Insert custom-field subquery into SELECT list (before FROM), not after JOINs */
export function withCfSelect(baseSql: string, entity: string, alias: string): string {
  const cf = buildCfSelect(entity, alias)
  const fromIdx = baseSql.search(/\s+FROM\s+/i)
  if (fromIdx === -1) return `${baseSql}, ${cf}`
  return `${baseSql.slice(0, fromIdx)}, ${cf}${baseSql.slice(fromIdx)}`
}

export function recordActivity(
  companyId: string,
  entityType: string,
  entityId: string,
  action: string,
  description?: string,
  user?: AuthUser,
  metadata?: Record<string, unknown>,
) {
  const id = uuid()
  db.prepare(`INSERT INTO activities (id, company_id, entity_type, entity_id, action, description, user_id, user_name, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, companyId, entityType, entityId, action, description || null,
    user?.userId || null, user?.name || null,
    metadata ? JSON.stringify(metadata) : null,
  )
  void emitAutomationEvent(db, {
    companyId,
    entityType,
    entityId,
    action,
    description,
    metadata,
  })
  return id
}

export function requireActiveCompany(req: Request, res: Response): string | null {
  const companyId = req.user?.companyId
  if (!companyId) {
    res.status(400).json({ ok: false, error: 'Active company context required' })
    return null
  }
  return companyId
}

const VALID_COLUMNS = new Set([
  'company_id', 'id', 'user_id', 'project_id', 'entity_id', 'field_definition_id',
])

export function requireCompanyRecord(
  req: Request,
  res: Response,
  table: string,
  id: string,
  companyColumn = 'company_id',
): any | null {
  if (!ALLOWED_TABLES.has(table)) {
    res.status(400).json({ ok: false, error: 'Invalid table' })
    return null
  }
  if (!VALID_COLUMNS.has(companyColumn)) {
    res.status(400).json({ ok: false, error: 'Invalid column' })
    return null
  }
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return null
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND ${companyColumn} = ?`).get(id, companyId) as any
  if (!row) {
    res.status(404).json({ ok: false, error: 'Not found' })
    return null
  }
  return row
}

export function requireRelatedCompanyRecord(
  res: Response,
  table: string,
  id: string | null | undefined,
  companyId: string,
  label = 'Record',
  companyColumn = 'company_id',
): any | null {
  if (!id) return null
  if (!ALLOWED_TABLES.has(table)) {
    res.status(400).json({ ok: false, error: 'Invalid table' })
    return null
  }
  if (!VALID_COLUMNS.has(companyColumn)) {
    res.status(400).json({ ok: false, error: 'Invalid column' })
    return null
  }
  if (table === 'users') {
    const row = db.prepare(`SELECT u.* FROM users u
      JOIN user_company_memberships m ON m.user_id = u.id
      WHERE u.id = ? AND m.company_id = ? AND u.is_active = 1 AND m.is_active = 1`).get(id, companyId) as any
    if (!row) {
      res.status(400).json({ ok: false, error: `${label} not found for active company` })
      return null
    }
    return row
  }
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND ${companyColumn} = ?`).get(id, companyId) as any
  if (!row) {
    res.status(400).json({ ok: false, error: `${label} not found for active company` })
    return null
  }
  return row
}

const ENTITY_TABLES: Record<string, string> = {
  leads: 'leads',
  customers: 'customers',
  contacts: 'contacts',
  agreements: 'agreements',
  projects: 'projects',
  submissions: 'submissions',
  activities: 'activities',
}

export function requireEntityCompany(req: Request, res: Response, entity: string, entityId: string): string | null {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return null
  const table = ENTITY_TABLES[entity]
  if (!table) {
    res.status(400).json({ ok: false, error: 'Invalid entity' })
    return null
  }
  if (entity === 'submissions') {
    const row = db.prepare(`SELECT s.id FROM submissions s JOIN projects p ON p.id = s.project_id WHERE s.id = ? AND p.company_id = ?`).get(entityId, companyId)
    if (!row) {
      res.status(404).json({ ok: false, error: 'Not found' })
      return null
    }
    return companyId
  }
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ? AND company_id = ?`).get(entityId, companyId)
  if (!row) {
    res.status(404).json({ ok: false, error: 'Not found' })
    return null
  }
  return companyId
}
