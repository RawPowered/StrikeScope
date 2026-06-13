import { Router } from 'express'
import db from '../db.js'
import { requirePermission } from '../auth.js'
import { requireActiveCompany } from './helpers.js'
import { validateBody, validateQuery, territorySchemas } from '../validation.js'
import { mergeTerritoryUpdate, parseTerritoryJson, territoryForClient, invalidateTerritoryCache } from '../territory.js'

const router = Router()

router.get('/', (_req, res) => {
  const companyId = requireActiveCompany(_req, res)
  if (!companyId) return
  const row = db.prepare('SELECT territory_json FROM companies WHERE id = ?').get(companyId) as { territory_json?: string } | undefined
  res.json({ ok: true, data: territoryForClient(parseTerritoryJson(row?.territory_json)) })
})

router.put('/', requirePermission('settings', 'edit'), validateBody(territorySchemas.update), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const row = db.prepare('SELECT territory_json FROM companies WHERE id = ?').get(companyId) as { territory_json?: string } | undefined
  const existing = parseTerritoryJson(row?.territory_json)
  const config = mergeTerritoryUpdate(existing, req.body)
  db.prepare('UPDATE companies SET territory_json = ? WHERE id = ?').run(JSON.stringify(config), companyId)
  invalidateTerritoryCache(companyId)
  res.json({ ok: true, data: territoryForClient(config) })
})

router.get('/cities', validateQuery(territorySchemas.citiesQuery), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { state } = req.query as { state: string }
  const rows = db.prepare(`
    SELECT DISTINCT city FROM (
      SELECT city FROM leads WHERE company_id = ? AND state = ? AND city IS NOT NULL AND city != ''
      UNION
      SELECT city FROM customers WHERE company_id = ? AND state = ? AND city IS NOT NULL AND city != ''
      UNION
      SELECT city FROM projects WHERE company_id = ? AND state = ? AND city IS NOT NULL AND city != ''
    ) ORDER BY city ASC
  `).all(companyId, state, companyId, state, companyId, state) as { city: string }[]
  res.json({ ok: true, data: rows.map(r => r.city) })
})

export default router
