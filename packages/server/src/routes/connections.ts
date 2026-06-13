import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { getProvider } from '../storage/index.js'
import { requireActiveCompany, requireCompanyRecord } from './helpers.js'

const router = Router()

const SELECT = `SELECT id, company_id as companyId, type, label, config_json as configJson, is_active as isActive`

router.get('/', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const connections = db.prepare(`${SELECT} FROM connections WHERE company_id = ? ORDER BY created_at DESC`).all(companyId)
  // Mask secrets in config
  const masked = connections.map((c: any) => ({
    ...c,
    config: (() => { try { return JSON.parse(c.configJson) } catch { return {} } })(),
  }))
  res.json({ ok: true, data: masked })
})

router.post('/', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { type, label, config, isActive } = req.body
  if (!type || !config) return res.status(400).json({ ok: false, error: 'type and config required' })
  const id = uuid()
  db.prepare('INSERT INTO connections (id, company_id, type, label, config_json, is_active) VALUES (?, ?, ?, ?, ?, ?)').run(id, companyId, type, label || null, JSON.stringify(config), isActive !== false ? 1 : 0)
  const c = db.prepare(`${SELECT} FROM connections WHERE id = ? AND company_id = ?`).get(id, companyId) as any
  res.status(201).json({ ok: true, data: { ...c, config } })
})

router.post('/:id/test', async (req, res) => {
  const c = requireCompanyRecord(req, res, 'connections', req.params.id)
  if (!c) return
  const provider = getProvider(c.type)
  if (!provider) return res.status(400).json({ ok: false, error: `No provider for type: ${c.type}` })
  let config: Record<string, string>
  try { config = JSON.parse(c.config_json) } catch { config = {} }
  const result = await provider.test(config)
  res.json({ ok: true, data: result })
})

router.delete('/:id', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const result = db.prepare('DELETE FROM connections WHERE id = ? AND company_id = ?').run(req.params.id, companyId)
  if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true })
})

export default router
