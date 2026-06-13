import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { requireActiveCompany, requireCompanyRecord } from './helpers.js'
import { VALID_FIELD_ENTITIES } from '../field-settings.js'

const router = Router()
router.use(requireRole('server_admin', 'company_admin'))

const VALID_TYPES = ['text', 'textarea', 'number', 'currency', 'phone', 'email', 'url', 'boolean', 'date', 'select', 'multiselect']

const SELECT = `SELECT id, company_id as companyId, entity, field_name as fieldName,
  label, field_type as fieldType, options_json as optionsJson,
  is_required as isRequired, carry_over as carryOver, is_enabled as isEnabled,
  sort_order as sortOrder, created_at as createdAt`

/* ── Reorder (must be before /:fieldId) ── */
router.put('/:entity/reorder', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { entity } = req.params
  if (!VALID_FIELD_ENTITIES.includes(entity as any)) return res.status(400).json({ ok: false, error: 'Invalid entity' })
  const { order } = req.body
  if (!Array.isArray(order)) return res.status(400).json({ ok: false, error: 'order must be an array of ids' })
  const tx = db.transaction(() => {
    const stmt = db.prepare('UPDATE custom_field_definitions SET sort_order = ? WHERE id = ? AND company_id = ? AND entity = ?')
    for (let i = 0; i < order.length; i++) stmt.run(i, order[i], companyId, entity)
  })
  tx()
  res.json({ ok: true })
})

router.get('/:entity', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { entity } = req.params
  if (!VALID_FIELD_ENTITIES.includes(entity as any)) return res.status(400).json({ ok: false, error: 'Invalid entity' })
  const rows = db.prepare(`${SELECT} FROM custom_field_definitions WHERE company_id = ? AND entity = ? ORDER BY sort_order ASC, created_at ASC`).all(companyId, entity)
  res.json({ ok: true, data: rows })
})

router.post('/:entity', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { entity } = req.params
  if (!VALID_FIELD_ENTITIES.includes(entity as any)) return res.status(400).json({ ok: false, error: 'Invalid entity' })
  const { fieldName, label, fieldType, optionsJson, isRequired, carryOver, sortOrder, isEnabled } = req.body
  if (!fieldName?.trim() || !label?.trim()) return res.status(400).json({ ok: false, error: 'fieldName and label required' })
  if (!VALID_TYPES.includes(fieldType)) return res.status(400).json({ ok: false, error: 'Invalid fieldType' })
  if ((fieldType === 'select' || fieldType === 'multiselect') && !optionsJson) {
    return res.status(400).json({ ok: false, error: 'optionsJson required for select/multiselect types' })
  }
  if (!/^[a-z_][a-z0-9_]*$/.test(fieldName)) {
    return res.status(400).json({ ok: false, error: 'fieldName must be lowercase alphanumeric + underscore' })
  }
  const id = uuid()
  try {
    db.prepare(`INSERT INTO custom_field_definitions (id, company_id, entity, field_name, label, field_type, options_json, is_required, carry_over, is_enabled, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, companyId, entity, fieldName.trim(), label.trim(), fieldType,
      optionsJson || null, isRequired ? 1 : 0, carryOver ? 1 : 0, isEnabled === false ? 0 : 1, sortOrder ?? 0,
    )
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ ok: false, error: 'A field with this name already exists for this entity' })
    throw e
  }
  const row = db.prepare(`${SELECT} FROM custom_field_definitions WHERE id = ?`).get(id)
  res.status(201).json({ ok: true, data: row })
})

router.put('/:entity/:fieldId', (req, res) => {
  const { entity, fieldId } = req.params
  if (!VALID_FIELD_ENTITIES.includes(entity as any)) return res.status(400).json({ ok: false, error: 'Invalid entity' })
  if (!db.prepare('SELECT id FROM custom_field_definitions WHERE id = ?').get(fieldId)) return res.status(404).json({ ok: false, error: 'Not found' })
  if (!requireCompanyRecord(req, res, 'custom_field_definitions', fieldId)) return
  const { label, fieldType, optionsJson, isRequired, carryOver, sortOrder, isEnabled } = req.body
  if (fieldType && !VALID_TYPES.includes(fieldType)) return res.status(400).json({ ok: false, error: 'Invalid fieldType' })
  db.prepare(`UPDATE custom_field_definitions SET
    label = COALESCE(?, label), field_type = COALESCE(?, field_type),
    options_json = COALESCE(?, options_json), is_required = COALESCE(?, is_required),
    carry_over = COALESCE(?, carry_over), is_enabled = COALESCE(?, is_enabled),
    sort_order = COALESCE(?, sort_order), updated_at = datetime('now')
    WHERE id = ?`).run(
    label || null, fieldType || null, optionsJson ?? null,
    isRequired != null ? (isRequired ? 1 : 0) : null,
    carryOver != null ? (carryOver ? 1 : 0) : null,
    isEnabled != null ? (isEnabled ? 1 : 0) : null,
    sortOrder != null ? sortOrder : null, fieldId,
  )
  const row = db.prepare(`${SELECT} FROM custom_field_definitions WHERE id = ?`).get(fieldId)
  res.json({ ok: true, data: row })
})

router.delete('/:entity/:fieldId', (req, res) => {
  const { fieldId } = req.params
  if (!db.prepare('SELECT id FROM custom_field_definitions WHERE id = ?').get(fieldId)) return res.status(404).json({ ok: false, error: 'Not found' })
  if (!requireCompanyRecord(req, res, 'custom_field_definitions', fieldId)) return
  db.transaction(() => {
    db.prepare('DELETE FROM custom_field_values WHERE field_definition_id = ?').run(fieldId)
    db.prepare('DELETE FROM custom_field_definitions WHERE id = ?').run(fieldId)
  })()
  res.json({ ok: true })
})

export default router
