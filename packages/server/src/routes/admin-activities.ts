import { Router } from 'express'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { requireActiveCompany } from './helpers.js'

const router = Router()
router.use(requireRole('server_admin', 'company_admin'))

const SELECT = `SELECT id, company_id as companyId, entity_type as entityType,
  entity_id as entityId, action, description, user_id as userId,
  user_name as userName, metadata_json as metadataJson, created_at as createdAt
  FROM activities`

router.get('/', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { entityType, entityId, limit: limitStr, offset: offsetStr } = req.query

  let query = `${SELECT} WHERE company_id = ?`
  const params: any[] = [companyId]
  if (entityType) { query += ' AND entity_type = ?'; params.push(entityType) }
  if (entityId) { query += ' AND entity_id = ?'; params.push(entityId) }
  query += ' ORDER BY created_at DESC'
  query += ` LIMIT ? OFFSET ?`
  const limit = parseInt(limitStr as string) || 50
  const offset = parseInt(offsetStr as string) || 0
  params.push(limit, offset)

  const rows = db.prepare(query).all(...params) as any[]
  const data = rows.map((r: any) => ({
    ...r,
    metadata: r.metadataJson ? JSON.parse(r.metadataJson) : null,
  }))
  res.json({ ok: true, data })
})

router.get('/count', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { entityType, entityId } = req.query
  let query = 'SELECT COUNT(*) as c FROM activities WHERE company_id = ?'
  const params: any[] = [companyId]
  if (entityType) { query += ' AND entity_type = ?'; params.push(entityType) }
  if (entityId) { query += ' AND entity_id = ?'; params.push(entityId) }
  const result = db.prepare(query).get(...params) as any
  res.json({ ok: true, data: { count: result.c } })
})

export default router
