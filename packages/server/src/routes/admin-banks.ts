import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requirePermission } from '../auth.js'
import { requireActiveCompany } from './helpers.js'
import { validateBody, bankSchemas } from '../validation.js'

const router = Router()

const SELECT = `SELECT id, company_id as companyId, name, is_active as isActive, created_at as createdAt
  FROM company_banks`

router.get('/', requirePermission('settings', 'view'), (_req, res) => {
  const companyId = requireActiveCompany(_req, res)
  if (!companyId) return
  const banks = db.prepare(`${SELECT} WHERE company_id = ? ORDER BY name ASC`).all(companyId)
  res.json({ ok: true, data: banks })
})

router.post('/', requirePermission('settings', 'edit'), validateBody(bankSchemas.create), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const name = req.body.name.trim()
  const dup = db.prepare('SELECT id FROM company_banks WHERE company_id=? AND LOWER(name)=LOWER(?)').get(companyId, name)
  if (dup) return res.status(409).json({ ok: false, error: 'Bank name already exists' })
  const id = uuid()
  db.prepare('INSERT INTO company_banks (id, company_id, name) VALUES (?, ?, ?)').run(id, companyId, name)
  const bank = db.prepare(`${SELECT} WHERE id = ?`).get(id)
  res.status(201).json({ ok: true, data: bank })
})

router.put('/:id', requirePermission('settings', 'edit'), validateBody(bankSchemas.update), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const existing = db.prepare('SELECT id, name FROM company_banks WHERE id=? AND company_id=?').get(req.params.id, companyId) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  const { name, isActive } = req.body
  if (name) {
    const dup = db.prepare('SELECT id FROM company_banks WHERE company_id=? AND LOWER(name)=LOWER(?) AND id!=?').get(companyId, name.trim(), req.params.id)
    if (dup) return res.status(409).json({ ok: false, error: 'Bank name already exists' })
  }
  db.prepare(`UPDATE company_banks SET name=COALESCE(?,name), is_active=COALESCE(?,is_active),
    updated_at=datetime('now') WHERE id=?`).run(
    name?.trim() || null, isActive !== undefined ? (isActive ? 1 : 0) : null, req.params.id,
  )
  const bank = db.prepare(`${SELECT} WHERE id = ?`).get(req.params.id)
  res.json({ ok: true, data: bank })
})

router.delete('/:id', requirePermission('settings', 'edit'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const existing = db.prepare('SELECT id FROM company_banks WHERE id=? AND company_id=?').get(req.params.id, companyId)
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  const inUse = db.prepare('SELECT id FROM projects WHERE bank_id=? LIMIT 1').get(req.params.id)
  if (inUse) return res.status(409).json({ ok: false, error: 'Bank is in use on a project and cannot be deleted' })
  db.prepare('DELETE FROM company_banks WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

export default router
