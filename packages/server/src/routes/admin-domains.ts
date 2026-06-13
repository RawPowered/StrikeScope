import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { recordActivity } from './helpers.js'

const router = Router()
router.use(requireRole('server_admin'))

const SELECT = 'SELECT id, company_id as companyId, domain, is_primary as isPrimary, is_sandbox as isSandbox, is_active as isActive FROM company_domains'

router.get('/', (_req, res) => {
  const domains = db.prepare(`${SELECT} ORDER BY company_id, is_primary DESC`).all()
  res.json({ ok: true, data: domains })
})

router.get('/company/:companyId', (req, res) => {
  const domains = db.prepare(`${SELECT} WHERE company_id = ? ORDER BY is_primary DESC`).all(req.params.companyId)
  res.json({ ok: true, data: domains })
})

router.post('/', (req, res) => {
  const { companyId, domain, isPrimary, isSandbox } = req.body
  if (!companyId || !domain || !domain.trim()) return res.status(400).json({ ok: false, error: 'companyId and domain are required' })
  if (db.prepare('SELECT id FROM company_domains WHERE domain = ?').get(domain.trim())) {
    return res.status(400).json({ ok: false, error: 'Domain already exists' })
  }
  const id = uuid()
  if (isPrimary) {
    db.prepare('UPDATE company_domains SET is_primary=0 WHERE company_id=?').run(companyId)
  }
  db.prepare('INSERT INTO company_domains (id, company_id, domain, is_primary, is_sandbox) VALUES (?, ?, ?, ?, ?)').run(
    id, companyId, domain.trim(), isPrimary ? 1 : 0, isSandbox !== false ? 1 : 0,
  )
  const d = db.prepare(`${SELECT} WHERE id = ?`).get(id)
  recordActivity(companyId, 'domain', id, 'created', `Domain "${domain.trim()}" added`, req.user)
  res.status(201).json({ ok: true, data: d })
})

router.put('/:id', (req, res) => {
  const { isPrimary, isActive, isSandbox } = req.body
  const existing = db.prepare('SELECT * FROM company_domains WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  if (isPrimary) {
    db.prepare('UPDATE company_domains SET is_primary=0 WHERE company_id=?').run(existing.company_id)
  }
  db.prepare('UPDATE company_domains SET is_primary=COALESCE(?,is_primary), is_active=COALESCE(?,is_active), is_sandbox=COALESCE(?,is_sandbox) WHERE id=?').run(
    isPrimary != null ? (isPrimary ? 1 : 0) : null,
    isActive != null ? (isActive ? 1 : 0) : null,
    isSandbox != null ? (isSandbox ? 1 : 0) : null,
    req.params.id,
  )
  const d = db.prepare(`${SELECT} WHERE id = ?`).get(req.params.id)
  res.json({ ok: true, data: d })
})

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM company_domains WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  if (existing.is_primary) return res.status(400).json({ ok: false, error: 'Cannot delete primary domain. Set a different primary first.' })
  db.prepare('DELETE FROM company_domains WHERE id = ?').run(req.params.id)
  recordActivity(existing.company_id, 'domain', req.params.id, 'deleted', `Domain "${existing.domain}" deleted`, req.user)
  res.json({ ok: true })
})

export default router
