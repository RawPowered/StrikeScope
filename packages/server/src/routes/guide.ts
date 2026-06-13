import { Router } from 'express'
import db from '../db.js'
import { v4 as uuid } from 'uuid'
import { requireActiveCompany } from './helpers.js'

const router = Router()

const SELECT = `SELECT id, template_id as templateId, label, sort_order as sortOrder,
  title_en as titleEn, title_es as titleEs, desc_en as descEn, desc_es as descEs,
  required_count as requiredCount, example_image as exampleImage`

function companyTemplate(companyId: string) {
  return db.prepare("SELECT id FROM task_templates WHERE company_id=? AND is_default=1 AND is_active=1 LIMIT 1").get(companyId) as any
}

router.get('/', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const tmpl = companyTemplate(companyId)
    || db.prepare("SELECT id FROM task_templates WHERE is_default=1 AND is_global=1 LIMIT 1").get() as any
  if (!tmpl) return res.json({ ok: true, data: [] })
  const items = db.prepare(`${SELECT} FROM template_items WHERE template_id = ? ORDER BY sort_order ASC`).all(tmpl.id)
  res.json({ ok: true, data: items })
})

router.put('/:id', (req, res) => {
  const { titleEn, titleEs, descEn, descEs, requiredCount, label, sortOrder, exampleImage } = req.body
  if (!label || !titleEn) return res.status(400).json({ ok: false, error: 'label and titleEn are required' })
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const result = db.prepare(`
    UPDATE template_items SET label=?, sort_order=?, title_en=?, title_es=?, desc_en=?, desc_es=?, required_count=?, example_image=?
    WHERE id=? AND template_id IN (SELECT id FROM task_templates WHERE company_id = ?)
  `).run(label, sortOrder ?? 0, titleEn, titleEs || '', descEn || '', descEs || '', requiredCount ?? 1, exampleImage || null, req.params.id, companyId)
  if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Not found' })
  const item = db.prepare(`${SELECT} FROM template_items WHERE id = ?`).get(req.params.id)
  res.json({ ok: true, data: item })
})

router.post('/', (req, res) => {
  const { label, titleEn, titleEs, descEn, descEs, requiredCount, exampleImage } = req.body
  if (!label || !titleEn) return res.status(400).json({ ok: false, error: 'label and titleEn are required' })
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const tmpl = companyTemplate(companyId)
  if (!tmpl) return res.status(500).json({ ok: false, error: 'No company default template found' })
  const id = uuid()
  const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM template_items WHERE template_id=?').get(tmpl.id) as any
  db.prepare('INSERT INTO template_items (id, template_id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, tmpl.id, label, (maxSort?.m || 0) + 1, titleEn, titleEs || '', descEn || '', descEs || '', requiredCount ?? 1, exampleImage || null
  )
  const item = db.prepare(`${SELECT} FROM template_items WHERE id = ?`).get(id)
  res.status(201).json({ ok: true, data: item })
})

router.delete('/:id', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const result = db.prepare('DELETE FROM template_items WHERE id = ? AND template_id IN (SELECT id FROM task_templates WHERE company_id = ?)').run(req.params.id, companyId)
  if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true })
})

router.put('/', (req, res) => {
  const items: { id: string; sortOrder: number }[] = req.body
  if (!Array.isArray(items)) return res.status(400).json({ ok: false, error: 'Array expected' })
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const stmt = db.prepare('UPDATE template_items SET sort_order = ? WHERE id = ? AND template_id IN (SELECT id FROM task_templates WHERE company_id = ?)')
  const tx = db.transaction(() => { for (const item of items) stmt.run(item.sortOrder, item.id, companyId) })
  tx()
  res.json({ ok: true })
})

export default router
