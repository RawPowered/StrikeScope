import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireEntityCompany } from './helpers.js'
import { validateRequiredCustomValues } from '../field-settings.js'

const router = Router()

const VALID_ENTITIES = ['leads', 'customers', 'contacts', 'agreements', 'projects', 'submissions', 'activities']

/* ── Get all custom field values for a record ── */
router.get('/:entity/:entityId', (req, res) => {
  const { entity, entityId } = req.params
  if (!VALID_ENTITIES.includes(entity)) return res.status(400).json({ ok: false, error: 'Invalid entity' })
  const companyId = requireEntityCompany(req, res, entity, entityId)
  if (!companyId) return

  const rows = db.prepare(`SELECT v.id, v.entity, v.entity_id as entityId,
    v.field_definition_id as fieldDefinitionId, v.value,
    d.field_name as fieldName, d.label, d.field_type as fieldType,
    d.options_json as optionsJson, d.is_required as isRequired,
    d.sort_order as sortOrder
    FROM custom_field_values v
    JOIN custom_field_definitions d ON d.id = v.field_definition_id
    WHERE v.entity = ? AND v.entity_id = ? AND d.company_id = ? AND d.is_enabled = 1
    ORDER BY d.sort_order ASC, d.created_at ASC`).all(entity, entityId, companyId)

  res.json({ ok: true, data: rows })
})

/* ── Upsert custom field values for a record (batch) ── */
router.put('/:entity/:entityId', (req, res) => {
  const { entity, entityId } = req.params
  if (!VALID_ENTITIES.includes(entity)) return res.status(400).json({ ok: false, error: 'Invalid entity' })
  const companyId = requireEntityCompany(req, res, entity, entityId)
  if (!companyId) return

  const { values } = req.body
  if (!Array.isArray(values)) return res.status(400).json({ ok: false, error: 'values must be an array of {fieldDefinitionId, value}' })

  const reqErr = validateRequiredCustomValues(db, companyId, entity, values)
  if (reqErr) return res.status(400).json({ ok: false, error: reqErr })

  const tx = db.transaction(() => {
    const del = db.prepare('DELETE FROM custom_field_values WHERE entity = ? AND entity_id = ?')
    del.run(entity, entityId)

    const insert = db.prepare('INSERT OR REPLACE INTO custom_field_values (id, entity, entity_id, field_definition_id, value) VALUES (?, ?, ?, ?, ?)')
    for (const v of values) {
      if (v.fieldDefinitionId) {
        const def = db.prepare('SELECT id FROM custom_field_definitions WHERE id = ? AND company_id = ? AND entity = ?').get(v.fieldDefinitionId, companyId, entity)
        if (!def) continue
        insert.run(uuid(), entity, entityId, v.fieldDefinitionId, v.value ?? null)
      }
    }
  })
  tx()

  const rows = db.prepare(`SELECT v.id, v.entity, v.entity_id as entityId,
    v.field_definition_id as fieldDefinitionId, v.value
    FROM custom_field_values v WHERE v.entity = ? AND v.entity_id = ?`).all(entity, entityId)
  res.json({ ok: true, data: rows })
})

export default router
