import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { recordActivity, parsePaginationParams, buildPaginatedResponse, requireActiveCompany, requireCompanyRecord } from './helpers.js'

const router = Router()
router.use(requireRole('server_admin', 'company_admin'))

const SELECT = 'SELECT id, company_id as companyId, name, sort_order as sortOrder, color, is_default as isDefault FROM lead_stages'

router.get('/', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { page, perPage, offset } = parsePaginationParams(req.query as any)
  let countQuery = `SELECT COUNT(*) as total FROM lead_stages WHERE company_id = ?`
  const total = (db.prepare(countQuery).get(companyId) as any).total
  const query = `${SELECT} WHERE company_id = ? ORDER BY sort_order ASC LIMIT ? OFFSET ?`
  const stages = db.prepare(query).all(companyId, perPage, offset)
  res.json(buildPaginatedResponse(stages, total, page, perPage))
})

router.post('/', (req, res) => {
  const { name, color } = req.body
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'Name is required' })
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM lead_stages WHERE company_id=?').get(companyId) as any
  const id = uuid()
  db.prepare('INSERT INTO lead_stages (id, company_id, name, sort_order, color) VALUES (?, ?, ?, ?, ?)').run(id, companyId, name.trim(), (maxSort?.m ?? -1) + 1, color || '#888')
  const s = db.prepare(`${SELECT} WHERE company_id = ? AND id = ?`).get(companyId, id)
  recordActivity(companyId, 'lead_stage', id, 'created', `Stage "${name.trim()}" created`, req.user)
  res.status(201).json({ ok: true, data: s })
})

router.put('/:id', (req, res) => {
  const { name, color, sortOrder } = req.body
  const existing = requireCompanyRecord(req, res, 'lead_stages', req.params.id)
  if (!existing) return
  if (name && !name.trim()) return res.status(400).json({ ok: false, error: 'Name cannot be empty' })
  db.prepare('UPDATE lead_stages SET name=COALESCE(?,name), color=COALESCE(?,color), sort_order=COALESCE(?,sort_order) WHERE id=?').run(
    name || null, color || null, sortOrder != null ? sortOrder : null, req.params.id
  )
  const s = db.prepare(`${SELECT} WHERE company_id = ? AND id = ?`).get(existing.company_id, req.params.id)
  recordActivity(existing.company_id, 'lead_stage', req.params.id, 'updated', `Stage "${(s as any).name}" updated`, req.user)
  res.json({ ok: true, data: s })
})

router.delete('/:id', (req, res) => {
  const existing = requireCompanyRecord(req, res, 'lead_stages', req.params.id)
  if (!existing) return
  const leadCount = (db.prepare('SELECT COUNT(*) as c FROM leads WHERE stage_id = ? AND company_id = ?').get(req.params.id, existing.company_id) as any).c
  if (leadCount > 0) return res.status(400).json({ ok: false, error: `Cannot delete: ${leadCount} lead(s) in this stage. Move them first.` })
  db.prepare('DELETE FROM lead_stages WHERE id = ? AND company_id = ?').run(req.params.id, existing.company_id)
  recordActivity(existing.company_id, 'lead_stage', req.params.id, 'deleted', `Stage "${existing.name}" deleted`, req.user)
  res.json({ ok: true })
})

export default router
