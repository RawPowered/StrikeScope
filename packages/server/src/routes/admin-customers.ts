import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requirePermission } from '../auth.js'
import { withCfSelect, parsePaginationParams, buildPaginatedResponse, requireActiveCompany, requireCompanyRecord, appendTerritoryFilters } from './helpers.js'
import customerNestedRouter from './admin-customer-nested.js'
import propertiesRouter from './admin-properties.js'
import { requireNoDuplicateOrOverride } from './admin-duplicates.js'

const router = Router()
router.use(customerNestedRouter)
router.use('/:customerId/properties', propertiesRouter)

const SELECT = `SELECT id, company_id as companyId, name, email, phone, address,
  city, state, county, zip, co_signer_contact_id as coSignerContactId,
  notes, source, source_lead_id as sourceLeadId, type,
  is_active as isActive, created_at as createdAt FROM customers`

router.get('/', requirePermission('customers', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { include_custom_fields } = req.query
  const { page, perPage, offset } = parsePaginationParams(req.query as any)

  let selectSql = SELECT
  if (include_custom_fields === 'true') selectSql = withCfSelect(selectSql, 'customers', 'customers')

  const whereParts = ['company_id = ?']
  const params: any[] = [companyId]
  appendTerritoryFilters(req.query as any, 'customers', whereParts, params)

  const cfParams = Object.keys(req.query as any).filter(k => k.startsWith('cf_'))
  for (const key of cfParams) {
    const fieldName = key.slice(3)
    const val = (req.query as any)[key]
    whereParts.push(`EXISTS (SELECT 1 FROM custom_field_values v
      JOIN custom_field_definitions d ON d.id = v.field_definition_id
      WHERE v.entity = 'customers' AND v.entity_id = customers.id AND d.field_name = ? AND v.value = ?)`)
    params.push(fieldName, val)
  }

  const where = whereParts.join(' AND ')
  const total = (db.prepare(`SELECT COUNT(*) as total FROM customers WHERE ${where}`).get(...params) as any).total

  const customers = db.prepare(`${selectSql} WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset)
  res.json(buildPaginatedResponse(customers, total, page, perPage))
})

router.get('/:id', requirePermission('customers', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const c = db.prepare(`${SELECT} WHERE company_id = ? AND id = ?`).get(companyId, req.params.id) as any
  if (!c) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true, data: c })
})

router.post('/', requirePermission('customers', 'create'), (req, res) => {
  let { companyId, name, email, phone, address, city, state, county, zip, coSignerContactId, notes, source, type, overrideReason } = req.body
  companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'name is required' })
  const dup = requireNoDuplicateOrOverride(companyId, 'customers', { name, email, phone, address }, overrideReason, req.user?.userId)
  if (dup.blocked) return res.status(409).json({ ok: false, error: dup.error, data: dup.matches })
  const company = db.prepare('SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL').get(companyId) as any
  if (!company) return res.status(400).json({ ok: false, error: 'Company not found' })
  const id = uuid()
  db.prepare(`INSERT INTO customers (id, company_id, name, email, phone, address, city, state, county, zip,
    co_signer_contact_id, notes, source, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, companyId, name.trim(), email || null, phone || null, address || null,
    city || null, state || null, county || null, zip || null, coSignerContactId || null,
    notes || null, source || 'manual', type || 'residential',
  )
  const c = db.prepare(`${SELECT} WHERE company_id = ? AND id = ?`).get(companyId, id)
  res.status(201).json({ ok: true, data: c })
})

router.put('/:id', requirePermission('customers', 'edit'), (req, res) => {
  const { name, email, phone, address, city, state, county, zip, coSignerContactId, notes, source, type } = req.body
  const existing = requireCompanyRecord(req, res, 'customers', req.params.id as string)
  if (!existing) return
  db.prepare(`UPDATE customers SET name=COALESCE(?,name), email=COALESCE(?,email), phone=COALESCE(?,phone),
    address=COALESCE(?,address), city=COALESCE(?,city), state=COALESCE(?,state), county=COALESCE(?,county),
    zip=COALESCE(?,zip), co_signer_contact_id=COALESCE(?,co_signer_contact_id),
    notes=COALESCE(?,notes), source=COALESCE(?,source), type=COALESCE(?,type) WHERE id=?`).run(
    name || null, email ?? null, phone ?? null, address ?? null,
    city ?? null, state ?? null, county ?? null, zip ?? null, coSignerContactId ?? null,
    notes ?? null, source ?? null, type ?? null, req.params.id,
  )
  const c = db.prepare(`${SELECT} WHERE company_id = ? AND id = ?`).get(existing.company_id, req.params.id)
  res.json({ ok: true, data: c })
})

router.delete('/:id', requirePermission('customers', 'delete'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const result = db.prepare('DELETE FROM customers WHERE id = ? AND company_id = ?').run(req.params.id, companyId)
  if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true })
})

export default router
