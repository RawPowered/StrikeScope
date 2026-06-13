import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireRole, requirePermission } from '../auth.js'
import { recordActivity, withCfSelect, parsePaginationParams, buildPaginatedResponse, requireActiveCompany, requireCompanyRecord, requireRelatedCompanyRecord } from './helpers.js'

const router = Router()
router.use(requireRole('server_admin', 'company_admin', 'project_admin', 'project_manager'))

const SELECT = `SELECT a.id, a.company_id as companyId, a.customer_id as customerId,
  a.project_id as projectId, a.status, a.terms, a.document_url as documentUrl,
  a.signed_at as signedAt, a.created_at as createdAt,
  cu.name as customerName, p.name as projectName,
  COALESCE(cu.state, p.state) as customerState,
  COALESCE(cu.city, p.city) as customerCity
  FROM agreements a
  LEFT JOIN customers cu ON cu.id = a.customer_id
  LEFT JOIN projects p ON p.id = a.project_id`

function scopedCompany(req: any): string | null {
  return req.user?.companyId || null
}

router.get('/', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { status, customerId, include_custom_fields } = req.query
  const { page, perPage, offset } = parsePaginationParams(req.query as any)
  let selectSql = SELECT
  if (include_custom_fields === 'true') selectSql = withCfSelect(selectSql, 'agreements', 'a')
  const whereParts = ['a.company_id = ?']
  const params: any[] = [companyId]
  if (status) { whereParts.push('a.status = ?'); params.push(status as string) }
  if (customerId) { whereParts.push('a.customer_id = ?'); params.push(customerId as string) }
  if ((req.query as any).state) { whereParts.push('(cu.state = ? OR p.state = ?)'); params.push((req.query as any).state, (req.query as any).state) }
  if ((req.query as any).city) { whereParts.push('(cu.city = ? OR p.city = ?)'); params.push((req.query as any).city, (req.query as any).city) }
  if ((req.query as any).county) { whereParts.push('(cu.county = ? OR p.county = ?)'); params.push((req.query as any).county, (req.query as any).county) }
  let query = `${selectSql} WHERE ${whereParts.join(' AND ')}`
  const cfParams = Object.keys(req.query as any).filter(k => k.startsWith('cf_'))
  for (const key of cfParams) {
    const fieldName = key.slice(3)
    const val = (req.query as any)[key]
    query += ` AND EXISTS (SELECT 1 FROM custom_field_values v
      JOIN custom_field_definitions d ON d.id = v.field_definition_id
      WHERE v.entity = 'agreements' AND v.entity_id = a.id AND d.field_name = ? AND v.value = ?)`
    params.push(fieldName, val)
  }

  const countWhereParts = ['a.company_id = ?']
  const countParams: any[] = [companyId]
  if (status) { countWhereParts.push('a.status = ?'); countParams.push(status as string) }
  if (customerId) { countWhereParts.push('a.customer_id = ?'); countParams.push(customerId as string) }
  if ((req.query as any).state) {
    countWhereParts.push('(EXISTS (SELECT 1 FROM customers cu2 WHERE cu2.id=a.customer_id AND cu2.state=?) OR EXISTS (SELECT 1 FROM projects p2 WHERE p2.id=a.project_id AND p2.state=?))')
    countParams.push((req.query as any).state, (req.query as any).state)
  }
  if ((req.query as any).city) {
    countWhereParts.push('(EXISTS (SELECT 1 FROM customers cu2 WHERE cu2.id=a.customer_id AND cu2.city=?) OR EXISTS (SELECT 1 FROM projects p2 WHERE p2.id=a.project_id AND p2.city=?))')
    countParams.push((req.query as any).city, (req.query as any).city)
  }
  let countQuery = `SELECT COUNT(*) as total FROM agreements a WHERE ${countWhereParts.join(' AND ')}`
  for (const key of cfParams) {
    const fieldName = key.slice(3)
    const val = (req.query as any)[key]
    countQuery += ` AND EXISTS (SELECT 1 FROM custom_field_values v
      JOIN custom_field_definitions d ON d.id = v.field_definition_id
      WHERE v.entity = 'agreements' AND v.entity_id = a.id AND d.field_name = ? AND v.value = ?)`
    countParams.push(fieldName, val)
  }
  const total = (db.prepare(countQuery).get(...countParams) as any).total

  query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?'
  params.push(perPage, offset)

  const rows = db.prepare(query).all(...params)
  res.json(buildPaginatedResponse(rows, total, page, perPage))
})

router.get('/:id', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const row = db.prepare(`${SELECT} WHERE a.company_id = ? AND a.id = ?`).get(companyId, req.params.id) as any
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true, data: row })
})

router.post('/', requirePermission('agreements', 'create'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { customerId, projectId, terms } = req.body
  if (!customerId) return res.status(400).json({ ok: false, error: 'customerId required' })
  if (!requireRelatedCompanyRecord(res, 'customers', customerId, companyId, 'Customer')) return
  if (projectId && !requireRelatedCompanyRecord(res, 'projects', projectId, companyId, 'Project')) return

  const id = uuid()
  db.prepare('INSERT INTO agreements (id, company_id, customer_id, project_id, terms) VALUES (?, ?, ?, ?, ?)').run(
    id, companyId, customerId, projectId || null, terms || null,
  )
  const row = db.prepare(`${SELECT} WHERE a.company_id = ? AND a.id = ?`).get(companyId, id)
  recordActivity(companyId, 'agreement', id, 'created', `Agreement created`, req.user)
  res.status(201).json({ ok: true, data: row })
})

router.put('/:id', requirePermission('agreements', 'edit'), (req, res) => {
  const existing = requireCompanyRecord(req, res, 'agreements', req.params.id as string)
  if (!existing) return
  const { terms, documentUrl, projectId } = req.body
  if (projectId && !requireRelatedCompanyRecord(res, 'projects', projectId, existing.company_id, 'Project')) return
  db.prepare('UPDATE agreements SET terms=COALESCE(?,terms), document_url=COALESCE(?,document_url), project_id=COALESCE(?,project_id) WHERE id=?').run(
    terms ?? null, documentUrl ?? null, projectId ?? null, req.params.id,
  )
  const row = db.prepare(`${SELECT} WHERE a.company_id = ? AND a.id = ?`).get(existing.company_id, req.params.id)
  res.json({ ok: true, data: row })
})

router.post('/:id/sign', requirePermission('agreements', 'edit'), (req: any, res) => {
  const existing = requireCompanyRecord(req, res, 'agreements', req.params.id as string)
  if (!existing) return
  if (existing.status === 'signed') return res.status(400).json({ ok: false, error: 'Already signed' })

  db.prepare('UPDATE agreements SET status = ?, signed_at = datetime("now") WHERE id = ?').run('signed', req.params.id)
  const row = db.prepare(`${SELECT} WHERE a.company_id = ? AND a.id = ?`).get(existing.company_id, req.params.id)
  recordActivity(existing.company_id, 'agreement', req.params.id, 'signed', `Agreement signed`, req.user)
  res.json({ ok: true, data: row })
})

router.delete('/:id', requirePermission('agreements', 'delete'), (req: any, res) => {
  const existing = requireCompanyRecord(req, res, 'agreements', req.params.id as string)
  if (!existing) return
  db.prepare('UPDATE agreements SET status = ? WHERE id = ?').run('cancelled', req.params.id)
  recordActivity(existing.company_id, 'agreement', req.params.id, 'cancelled', `Agreement cancelled`, req.user)
  res.json({ ok: true })
})

export default router
