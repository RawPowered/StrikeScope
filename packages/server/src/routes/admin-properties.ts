import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requirePermission } from '../auth.js'
import { requireActiveCompany, requireRelatedCompanyRecord } from './helpers.js'

const router = Router({ mergeParams: true })

const PROP_SELECT = `SELECT p.id, p.company_id as companyId, p.customer_id as customerId, p.label,
  p.address, p.city, p.state, p.county, p.zip, p.is_primary as isPrimary, p.is_active as isActive, p.created_at as createdAt
  FROM customer_properties p`

router.get('/', requirePermission('customers', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const customerId = req.params.customerId as string
  if (!requireRelatedCompanyRecord(res, 'customers', customerId, companyId, 'Customer')) return
  const props = db.prepare(`${PROP_SELECT} WHERE p.customer_id=? AND p.company_id=? ORDER BY p.is_primary DESC, p.label ASC`).all(customerId, companyId)
  res.json({ ok: true, data: props })
})

router.post('/', requirePermission('customers', 'edit'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const customerId = req.params.customerId as string
  if (!requireRelatedCompanyRecord(res, 'customers', customerId, companyId, 'Customer')) return
  const { label, address, city, state, county, zip, isPrimary, contactIds } = req.body
  const id = uuid()
  if (isPrimary) db.prepare('UPDATE customer_properties SET is_primary=0 WHERE customer_id=?').run(customerId)
  db.prepare(`INSERT INTO customer_properties (id, company_id, customer_id, label, address, city, state, county, zip, is_primary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, companyId, customerId, label || null, address || null, city || null, state || null, county || null, zip || null, isPrimary ? 1 : 0,
  )
  if (Array.isArray(contactIds)) {
    const link = db.prepare('INSERT OR IGNORE INTO property_contacts (property_id, contact_id, role) VALUES (?, ?, ?)')
    for (const cid of contactIds) link.run(id, cid, 'owner')
  }
  const prop = db.prepare(`${PROP_SELECT} WHERE p.id=?`).get(id)
  res.status(201).json({ ok: true, data: prop })
})

router.put('/:propertyId', requirePermission('customers', 'edit'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const existing = db.prepare('SELECT * FROM customer_properties WHERE id=? AND company_id=?').get(req.params.propertyId, companyId) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  const { label, address, city, state, county, zip, isPrimary, isActive, contactIds } = req.body
  if (isPrimary) db.prepare('UPDATE customer_properties SET is_primary=0 WHERE customer_id=?').run(existing.customer_id)
  db.prepare(`UPDATE customer_properties SET label=COALESCE(?,label), address=COALESCE(?,address),
    city=COALESCE(?,city), state=COALESCE(?,state), county=COALESCE(?,county), zip=COALESCE(?,zip),
    is_primary=COALESCE(?,is_primary), is_active=COALESCE(?,is_active), updated_at=datetime('now') WHERE id=?`).run(
    label ?? null, address ?? null, city ?? null, state ?? null, county ?? null, zip ?? null,
    isPrimary != null ? (isPrimary ? 1 : 0) : null, isActive != null ? (isActive ? 1 : 0) : null, req.params.propertyId,
  )
  if (Array.isArray(contactIds)) {
    db.prepare('DELETE FROM property_contacts WHERE property_id=?').run(req.params.propertyId)
    const link = db.prepare('INSERT OR IGNORE INTO property_contacts (property_id, contact_id, role) VALUES (?, ?, ?)')
    for (const cid of contactIds) link.run(req.params.propertyId, cid, 'owner')
  }
  const prop = db.prepare(`${PROP_SELECT} WHERE p.id=?`).get(req.params.propertyId)
  res.json({ ok: true, data: prop })
})

router.get('/:propertyId/contacts', requirePermission('customers', 'view'), (req, res) => {
  const rows = db.prepare(`SELECT c.id, c.first_name as firstName, c.last_name as lastName, c.email, pc.role
    FROM property_contacts pc JOIN contacts c ON c.id=pc.contact_id WHERE pc.property_id=?`).all(req.params.propertyId)
  res.json({ ok: true, data: rows })
})

export default router
