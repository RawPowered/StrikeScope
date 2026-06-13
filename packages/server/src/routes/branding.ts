import { Router } from 'express'
import db from '../db.js'
import { requireActiveCompany } from './helpers.js'

const router = Router()

router.get('/', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const site = db.prepare('SELECT branding_json FROM companies WHERE id = ?').get(companyId) as any
  if (!site) return res.json({ ok: true, data: null })
  res.json({ ok: true, data: JSON.parse(site.branding_json) })
})

router.put('/', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const site = db.prepare('SELECT id FROM companies WHERE id = ?').get(companyId)
  if (!site) return res.status(404).json({ ok: false, error: 'Company not found' })
  db.prepare('UPDATE companies SET branding_json = ? WHERE id = ?').run(JSON.stringify(req.body), companyId)
  res.json({ ok: true, data: req.body })
})

export default router
