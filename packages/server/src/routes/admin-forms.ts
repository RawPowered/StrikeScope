import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requirePermission } from '../auth.js'
import { recordActivity, parsePaginationParams, buildPaginatedResponse, requireActiveCompany } from './helpers.js'

const router = Router()

const FORM_SELECT = `SELECT id, company_id as companyId, name, description, schema_json as schemaJson, is_active as isActive, created_by as createdBy, created_at as createdAt FROM form_definitions`
const LINK_SELECT = `SELECT id, form_id as formId, company_id as companyId, slug, custom_domain as customDomain, custom_path as customPath, is_active as isActive, created_at as createdAt FROM form_links`
const SUB_SELECT = `SELECT id, form_id as formId, company_id as companyId, response_json as responseJson, respondent_ip as respondentIp, respondent_ua as respondentUa, created_at as createdAt FROM form_submissions`

router.get('/', requirePermission('forms', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { page, perPage, offset } = parsePaginationParams(req.query as any)
  const whereParts = ['company_id = ?']
  const params: any[] = [companyId]
  if (req.query.search) { whereParts.push('name LIKE ?'); params.push(`%${req.query.search}%`) }
  const total = (db.prepare(`SELECT COUNT(*) as c FROM form_definitions WHERE ${whereParts.join(' AND ')}`).get(...params) as any).c
  const rows = db.prepare(`${FORM_SELECT} WHERE ${whereParts.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset)
  res.json(buildPaginatedResponse(rows, total, page, perPage))
})

router.post('/', requirePermission('forms', 'create'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { name, description, schemaJson } = req.body
  if (!name || !schemaJson) return res.status(400).json({ ok: false, error: 'name and schemaJson are required' })
  const id = uuid()
  db.prepare('INSERT INTO form_definitions (id, company_id, name, description, schema_json, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, companyId, name, description || null, schemaJson, req.user?.userId || null,
  )
  const row = db.prepare(`${FORM_SELECT} WHERE id = ?`).get(id)
  recordActivity(companyId, 'form', id, 'created', `Form "${name}" created`, req.user)
  res.status(201).json({ ok: true, data: row })
})

router.get('/:id', requirePermission('forms', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const formId = req.params.id as string
  const row = db.prepare(`${FORM_SELECT} WHERE id = ? AND company_id = ?`).get(formId, companyId)
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true, data: row })
})

router.put('/:id', requirePermission('forms', 'edit'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const formId = req.params.id as string
  const existing = db.prepare('SELECT id FROM form_definitions WHERE id = ? AND company_id = ?').get(formId, companyId)
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  const { name, description, schemaJson, isActive } = req.body
  db.prepare(`UPDATE form_definitions SET
    name = COALESCE(?, name), description = COALESCE(?, description),
    schema_json = COALESCE(?, schema_json), is_active = COALESCE(?, is_active),
    updated_at = datetime('now')
    WHERE id = ?`).run(
    name || null, description !== undefined ? description : null,
    schemaJson || null, isActive !== undefined ? (isActive ? 1 : 0) : null,
    formId,
  )
  const row = db.prepare(`${FORM_SELECT} WHERE id = ?`).get(formId) as any
  recordActivity(companyId, 'form', formId, 'updated', `Form "${row.name}" updated`, req.user)
  res.json({ ok: true, data: row })
})

router.delete('/:id', requirePermission('forms', 'delete'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const formId = req.params.id as string
  const existing = db.prepare('SELECT name FROM form_definitions WHERE id = ? AND company_id = ?').get(formId, companyId) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  db.prepare('DELETE FROM form_definitions WHERE id = ?').run(formId)
  recordActivity(companyId, 'form', formId, 'deleted', `Form "${existing.name}" deleted`, req.user)
  res.json({ ok: true })
})

router.get('/:id/links', requirePermission('forms', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const formId = req.params.id as string
  const rows = db.prepare(`${LINK_SELECT} WHERE form_id = ? AND company_id = ? ORDER BY created_at DESC`).all(formId, companyId)
  res.json({ ok: true, data: rows })
})

router.post('/:id/links', requirePermission('forms', 'edit'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const formId = req.params.id as string
  const existing = db.prepare('SELECT id FROM form_definitions WHERE id = ? AND company_id = ?').get(formId, companyId)
  if (!existing) return res.status(404).json({ ok: false, error: 'Form not found' })
  const { slug, customDomain, customPath } = req.body
  if (!slug) return res.status(400).json({ ok: false, error: 'slug is required' })
  const slugExists = db.prepare('SELECT id FROM form_links WHERE company_id = ? AND slug = ?').get(companyId, slug)
  if (slugExists) return res.status(400).json({ ok: false, error: 'Slug already in use for this company' })
  const id = uuid()
  db.prepare('INSERT INTO form_links (id, form_id, company_id, slug, custom_domain, custom_path) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, formId, companyId, slug, customDomain || null, customPath || null,
  )
  const row = db.prepare(`${LINK_SELECT} WHERE id = ?`).get(id)
  res.status(201).json({ ok: true, data: row })
})

router.delete('/:id/links/:linkId', requirePermission('forms', 'edit'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const link = db.prepare('SELECT id FROM form_links WHERE id = ? AND company_id = ?').get(req.params.linkId, companyId)
  if (!link) return res.status(404).json({ ok: false, error: 'Link not found' })
  db.prepare('DELETE FROM form_links WHERE id = ?').run(req.params.linkId)
  res.json({ ok: true })
})

router.get('/:id/submissions', requirePermission('forms', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const formId = req.params.id as string
  const { page, perPage, offset } = parsePaginationParams(req.query as any)
  const whereParts = ['form_id = ?', 'company_id = ?']
  const params: any[] = [formId, companyId]
  const total = (db.prepare(`SELECT COUNT(*) as c FROM form_submissions WHERE ${whereParts.join(' AND ')}`).get(...params) as any).c
  const rows = db.prepare(`${SUB_SELECT} WHERE ${whereParts.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset)
  res.json(buildPaginatedResponse(rows, total, page, perPage))
})

router.get('/:id/stats', requirePermission('forms', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const formId = req.params.id as string
  const total = (db.prepare('SELECT COUNT(*) as c FROM form_submissions WHERE form_id = ? AND company_id = ?').get(formId, companyId) as any).c
  res.json({ ok: true, data: { totalSubmissions: total } })
})

export default router
