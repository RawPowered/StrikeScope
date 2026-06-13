import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requirePermission } from '../auth.js'
import { parsePaginationParams, buildPaginatedResponse, requireActiveCompany, requireCompanyRecord } from './helpers.js'
import { validateBody, validateQuery, directoryContactSchemas, contactCategorySchemas } from '../validation.js'
import { isDirectoryContactsEnabled, slugify } from '../territory.js'

const router = Router()

const DC_SELECT = `SELECT d.id, d.company_id as companyId, d.category_id as categoryId,
  d.name, d.organization, d.title, d.email, d.phone, d.state, d.county, d.address, d.notes,
  d.is_active as isActive, d.created_at as createdAt,
  c.name as categoryName, c.slug as categorySlug
  FROM directory_contacts d
  JOIN contact_categories c ON c.id = d.category_id`

const CAT_SELECT = `SELECT id, company_id as companyId, name, slug,
  is_enabled as isEnabled, is_system as isSystem, sort_order as sortOrder, created_at as createdAt
  FROM contact_categories`

function requireDirectoryEnabled(req: any, res: any, companyId: string): boolean {
  if (!isDirectoryContactsEnabled(db, companyId)) {
    res.status(403).json({ ok: false, error: 'Directory contacts are disabled for this company' })
    return false
  }
  return true
}

/* ── Categories ── */
router.get('/categories', requirePermission('contacts', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const cats = db.prepare(`${CAT_SELECT} WHERE company_id = ? ORDER BY sort_order ASC, name ASC`).all(companyId)
  res.json({ ok: true, data: cats })
})

router.post('/categories', requirePermission('settings', 'edit'), validateBody(contactCategorySchemas.create), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!requireDirectoryEnabled(req, res, companyId)) return
  const { name, sortOrder } = req.body
  const slug = slugify(name)
  const dup = db.prepare('SELECT id FROM contact_categories WHERE company_id=? AND slug=?').get(companyId, slug)
  if (dup) return res.status(409).json({ ok: false, error: 'Category slug already exists' })
  const id = uuid()
  db.prepare('INSERT INTO contact_categories (id, company_id, name, slug, is_enabled, is_system, sort_order) VALUES (?, ?, ?, ?, 1, 0, ?)').run(
    id, companyId, name.trim(), slug, sortOrder ?? 0,
  )
  const cat = db.prepare(`${CAT_SELECT} WHERE id = ?`).get(id)
  res.status(201).json({ ok: true, data: cat })
})

router.put('/categories/:id', requirePermission('settings', 'edit'), validateBody(contactCategorySchemas.update), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const existing = db.prepare('SELECT id, is_system FROM contact_categories WHERE company_id=? AND id=?').get(companyId, req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  const { name, isEnabled, sortOrder } = req.body
  db.prepare(`UPDATE contact_categories SET
    name=COALESCE(?,name), is_enabled=COALESCE(?,is_enabled), sort_order=COALESCE(?,sort_order)
    WHERE id=?`).run(
    name || null, isEnabled !== undefined ? (isEnabled ? 1 : 0) : null, sortOrder ?? null, req.params.id,
  )
  const cat = db.prepare(`${CAT_SELECT} WHERE id = ?`).get(req.params.id)
  res.json({ ok: true, data: cat })
})

router.delete('/categories/:id', requirePermission('settings', 'edit'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const existing = db.prepare('SELECT id, is_system FROM contact_categories WHERE company_id=? AND id=?').get(companyId, req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  if (existing.is_system) return res.status(400).json({ ok: false, error: 'System categories cannot be deleted' })
  const inUse = db.prepare('SELECT id FROM directory_contacts WHERE category_id=? LIMIT 1').get(req.params.id)
  if (inUse) return res.status(400).json({ ok: false, error: 'Category has contacts; disable it instead' })
  db.prepare('DELETE FROM contact_categories WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

/* ── Directory contacts ── */
router.get('/', requirePermission('contacts', 'view'), validateQuery(directoryContactSchemas.listQuery), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!requireDirectoryEnabled(req, res, companyId)) return
  const { categoryId, categorySlug, state, county } = req.query as any
  const { page, perPage, offset } = parsePaginationParams(req.query as any)

  let query = `${DC_SELECT} WHERE d.company_id = ? AND d.is_active = 1 AND c.is_enabled = 1`
  const params: any[] = [companyId]
  if (categoryId) { query += ' AND d.category_id = ?'; params.push(categoryId) }
  if (categorySlug) { query += ' AND c.slug = ?'; params.push(categorySlug) }
  if (state) { query += ' AND d.state = ?'; params.push(state) }
  if (county) { query += ' AND d.county = ?'; params.push(county) }

  let countQuery = `SELECT COUNT(*) as total FROM directory_contacts d
    JOIN contact_categories c ON c.id = d.category_id
    WHERE d.company_id = ? AND d.is_active = 1 AND c.is_enabled = 1`
  const countParams: any[] = [companyId]
  if (categoryId) { countQuery += ' AND d.category_id = ?'; countParams.push(categoryId) }
  if (categorySlug) { countQuery += ' AND c.slug = ?'; countParams.push(categorySlug) }
  if (state) { countQuery += ' AND d.state = ?'; countParams.push(state) }
  if (county) { countQuery += ' AND d.county = ?'; countParams.push(county) }
  const total = (db.prepare(countQuery).get(...countParams) as any).total

  query += ' ORDER BY d.name ASC LIMIT ? OFFSET ?'
  params.push(perPage, offset)
  const rows = db.prepare(query).all(...params)
  res.json(buildPaginatedResponse(rows, total, page, perPage))
})

router.get('/:id', requirePermission('contacts', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!requireDirectoryEnabled(req, res, companyId)) return
  const row = db.prepare(`${DC_SELECT} WHERE d.company_id = ? AND d.id = ? AND d.is_active = 1`).get(companyId, req.params.id)
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true, data: row })
})

router.post('/', requirePermission('contacts', 'create'), validateBody(directoryContactSchemas.create), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!requireDirectoryEnabled(req, res, companyId)) return
  const { categoryId, name, organization, title, email, phone, state, county, address, notes } = req.body
  const cat = db.prepare('SELECT id FROM contact_categories WHERE company_id=? AND id=? AND is_enabled=1').get(companyId, categoryId)
  if (!cat) return res.status(400).json({ ok: false, error: 'Category not found or disabled' })
  const id = uuid()
  db.prepare(`INSERT INTO directory_contacts (id, company_id, category_id, name, organization, title, email, phone, state, county, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, companyId, categoryId, name.trim(), organization || null, title || null,
    email || null, phone || null, state || null, county || null, address || null, notes || null,
  )
  const row = db.prepare(`${DC_SELECT} WHERE d.id = ?`).get(id)
  res.status(201).json({ ok: true, data: row })
})

router.put('/:id', requirePermission('contacts', 'edit'), validateBody(directoryContactSchemas.update), (req, res) => {
  const existing = requireCompanyRecord(req, res, 'directory_contacts', req.params.id as string)
  if (!existing) return
  const { categoryId, name, organization, title, email, phone, state, county, address, notes, isActive } = req.body
  if (categoryId) {
    const cat = db.prepare('SELECT id FROM contact_categories WHERE company_id=? AND id=?').get(existing.company_id, categoryId)
    if (!cat) return res.status(400).json({ ok: false, error: 'Category not found' })
  }
  db.prepare(`UPDATE directory_contacts SET
    category_id=COALESCE(?,category_id), name=COALESCE(?,name),
    organization=COALESCE(?,organization), title=COALESCE(?,title),
    email=COALESCE(?,email), phone=COALESCE(?,phone),
    state=COALESCE(?,state), county=COALESCE(?,county),
    address=COALESCE(?,address), notes=COALESCE(?,notes),
    is_active=COALESCE(?,is_active) WHERE id=?`).run(
    categoryId || null, name || null,
    organization ?? null, title ?? null, email ?? null, phone ?? null,
    state ?? null, county ?? null, address ?? null, notes ?? null,
    isActive !== undefined ? (isActive ? 1 : 0) : null, req.params.id,
  )
  const row = db.prepare(`${DC_SELECT} WHERE d.id = ?`).get(req.params.id)
  res.json({ ok: true, data: row })
})

router.delete('/:id', requirePermission('contacts', 'delete'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const result = db.prepare('UPDATE directory_contacts SET is_active=0 WHERE id=? AND company_id=?').run(req.params.id, companyId)
  if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true })
})

export default router
