import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireRole } from '../auth.js'

const router = Router()
router.use(requireRole('server_admin'))

const TPL_SELECT = `SELECT id, company_id as companyId, project_type_id as projectTypeId,
  name, description, is_global as isGlobal, is_default as isDefault,
  is_published as isPublished, source_template_id as sourceTemplateId,
  is_active as isActive, enable_time_tracking as enableTimeTracking,
  enable_stale_warnings as enableStaleWarnings, sla_days_not_started as slaDaysNotStarted,
  sla_days_incomplete as slaDaysIncomplete, stale_days_idle as staleDaysIdle,
  geofence_radius_m as geofenceRadiusM, created_at as createdAt`

const ITEM_SELECT = `SELECT id, template_id as templateId, label, sort_order as sortOrder,
  title_en as titleEn, title_es as titleEs, desc_en as descEn, desc_es as descEs,
  required_count as requiredCount, example_image as exampleImage`

/* ── List all templates (global + per-company) ── */
router.get('/', (req, res) => {
  const { globalOnly } = req.query
  let query = `${TPL_SELECT} FROM task_templates`
  const params: any[] = []
  if (globalOnly === 'true') {
    query += ' WHERE is_global = 1'
  }
  query += ' ORDER BY is_global DESC, created_at DESC'
  const templates = db.prepare(query).all(...params)
  // Attach item count
  const countStmt = db.prepare('SELECT COUNT(*) as c FROM template_items WHERE template_id = ?')
  const result = templates.map((t: any) => ({ ...t, itemCount: (countStmt.get(t.id) as any).c }))
  res.json({ ok: true, data: result })
})

/* ── Get single template with items ── */
router.get('/:id', (req, res) => {
  const t = db.prepare(`${TPL_SELECT} FROM task_templates WHERE id = ?`).get(req.params.id) as any
  if (!t) return res.status(404).json({ ok: false, error: 'Not found' })
  const items = db.prepare(`${ITEM_SELECT} FROM template_items WHERE template_id = ? ORDER BY sort_order ASC`).all(req.params.id)
  res.json({ ok: true, data: { ...t, items } })
})

/* ── Create global template ── */
router.post('/', (req, res) => {
  const { name, description, projectTypeId, isGlobal, isDefault } = req.body
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'Name is required' })
  const id = uuid()
  db.prepare('INSERT INTO task_templates (id, company_id, project_type_id, name, description, is_global, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, null, projectTypeId || null, name.trim(), description || null, isGlobal !== false ? 1 : 0, isDefault ? 1 : 0
  )
  const t = db.prepare(`${TPL_SELECT} FROM task_templates WHERE id = ?`).get(id) as any
  res.status(201).json({ ok: true, data: { ...t, items: [] } })
})

/* ── Update template metadata ── */
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM task_templates WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  const { name, description, projectTypeId, isGlobal, isDefault, isPublished,
    enableTimeTracking, enableStaleWarnings, slaDaysNotStarted, slaDaysIncomplete, staleDaysIdle, geofenceRadiusM } = req.body
  // If setting as default, unset other defaults for the same project type
  if (isDefault && projectTypeId) {
    db.prepare('UPDATE task_templates SET is_default=0 WHERE project_type_id=? AND id!=?').run(projectTypeId, req.params.id)
  }
  db.prepare(`UPDATE task_templates SET
    name=COALESCE(?,name), description=COALESCE(?,description),
    project_type_id=COALESCE(?,project_type_id), is_global=COALESCE(?,is_global),
    is_default=COALESCE(?,is_default), is_published=COALESCE(?,is_published),
    enable_time_tracking=COALESCE(?,enable_time_tracking),
    enable_stale_warnings=COALESCE(?,enable_stale_warnings),
    sla_days_not_started=?, sla_days_incomplete=?, stale_days_idle=COALESCE(?,stale_days_idle),
    geofence_radius_m=COALESCE(?,geofence_radius_m)
    WHERE id=?`).run(
    name || null, description ?? null, projectTypeId ?? null,
    isGlobal !== undefined ? (isGlobal ? 1 : 0) : null,
    isDefault !== undefined ? (isDefault ? 1 : 0) : null,
    isPublished !== undefined ? (isPublished ? 1 : 0) : null,
    enableTimeTracking !== undefined ? (enableTimeTracking ? 1 : 0) : null,
    enableStaleWarnings !== undefined ? (enableStaleWarnings ? 1 : 0) : null,
    slaDaysNotStarted ?? null, slaDaysIncomplete ?? null,
    staleDaysIdle ?? null, geofenceRadiusM ?? null,
    req.params.id
  )
  const t = db.prepare(`${TPL_SELECT} FROM task_templates WHERE id = ?`).get(req.params.id) as any
  const items = db.prepare(`${ITEM_SELECT} FROM template_items WHERE template_id = ? ORDER BY sort_order ASC`).all(req.params.id)
  res.json({ ok: true, data: { ...t, items } })
})

/* ── Add item to template ── */
router.post('/:id/items', (req, res) => {
  const { label, titleEn, titleEs, descEn, descEs, requiredCount, exampleImage } = req.body
  if (!label || !titleEn) return res.status(400).json({ ok: false, error: 'label and titleEn are required' })
  const tmpl = db.prepare('SELECT id FROM task_templates WHERE id = ?').get(req.params.id) as any
  if (!tmpl) return res.status(404).json({ ok: false, error: 'Template not found' })
  const itemId = uuid()
  const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM template_items WHERE template_id=?').get(req.params.id) as any
  db.prepare('INSERT INTO template_items (id, template_id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    itemId, req.params.id, label, (maxSort?.m || 0) + 1, titleEn, titleEs || '', descEn || '', descEs || '', requiredCount ?? 1, exampleImage || null
  )
  const item = db.prepare(`${ITEM_SELECT} FROM template_items WHERE id = ?`).get(itemId)
  res.status(201).json({ ok: true, data: item })
})

/* ── Update item ── */
router.put('/:id/items/:itemId', (req, res) => {
  const { label, sortOrder, titleEn, titleEs, descEn, descEs, requiredCount, exampleImage } = req.body
  if (!label || !titleEn) return res.status(400).json({ ok: false, error: 'label and titleEn are required' })
  const result = db.prepare(`UPDATE template_items SET label=?, sort_order=?, title_en=?, title_es=?, desc_en=?, desc_es=?, required_count=?, example_image=? WHERE id=? AND template_id=?`).run(
    label, sortOrder ?? 0, titleEn, titleEs || '', descEn || '', descEs || '', requiredCount ?? 1, exampleImage || null, req.params.itemId, req.params.id
  )
  if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Item not found' })
  const item = db.prepare(`${ITEM_SELECT} FROM template_items WHERE id = ?`).get(req.params.itemId)
  res.json({ ok: true, data: item })
})

/* ── Delete item ── */
router.delete('/:id/items/:itemId', (req, res) => {
  const result = db.prepare('DELETE FROM template_items WHERE id=? AND template_id=?').run(req.params.itemId, req.params.id)
  if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Item not found' })
  res.json({ ok: true })
})

/* ── Reorder items ── */
router.put('/:id/reorder', (req, res) => {
  const items: { id: string; sortOrder: number }[] = req.body
  if (!Array.isArray(items)) return res.status(400).json({ ok: false, error: 'Array expected' })
  const stmt = db.prepare('UPDATE template_items SET sort_order=? WHERE id=? AND template_id=?')
  const tx = db.transaction(() => { for (const item of items) stmt.run(item.sortOrder, item.id, req.params.id) })
  tx()
  res.json({ ok: true })
})

export default router
