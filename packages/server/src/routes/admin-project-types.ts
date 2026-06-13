import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireRole } from '../auth.js'

const router = Router()
router.use(requireRole('server_admin'))

const SELECT = `SELECT id, name, description, category,
  is_construction as isConstruction, include_county_defaults as includeCountyDefaults,
  requires_permit as requiresPermit, include_financing_fields as includeFinancingFields,
  is_active as isActive, created_at as createdAt`

function ensureDefaultTemplate(projectTypeId: string, typeName: string) {
  const existing = db.prepare('SELECT id FROM task_templates WHERE project_type_id=? AND is_default=1').get(projectTypeId)
  if (existing) return
  const tid = uuid()
  db.prepare('INSERT INTO task_templates (id, company_id, project_type_id, name, description, is_global, is_default) VALUES (?, ?, ?, ?, ?, 1, 1)').run(
    tid, null, projectTypeId, `${typeName} Checklist`, `Default checklist for ${typeName}`, 1, 1,
  )
}

router.get('/', (_req, res) => {
  const types = db.prepare(`${SELECT} FROM project_types ORDER BY name ASC`).all()
  res.json({ ok: true, data: types })
})

router.get('/:id', (req, res) => {
  const pt = db.prepare(`${SELECT} FROM project_types WHERE id = ?`).get(req.params.id) as any
  if (!pt) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true, data: pt })
})

router.post('/', (req, res) => {
  const { name, description, category, isConstruction, includeCountyDefaults, requiresPermit, includeFinancingFields } = req.body
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'Name is required' })
  const existing = db.prepare('SELECT id FROM project_types WHERE name = ?').get(name.trim())
  if (existing) return res.status(409).json({ ok: false, error: 'Project type already exists' })
  const id = uuid()
  const cat = category || 'other'
  const construction = isConstruction ? 1 : 0
  const countyDefaults = includeCountyDefaults ? 1 : 0
  const permit = requiresPermit ? 1 : 0
  const financing = includeFinancingFields ? 1 : 0
  db.prepare(`INSERT INTO project_types (id, name, description, category, is_construction, include_county_defaults, requires_permit, include_financing_fields)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, name.trim(), description || null, cat, construction, countyDefaults, permit, financing)
  if (countyDefaults) ensureDefaultTemplate(id, name.trim())
  const companies = db.prepare('SELECT id FROM companies WHERE deleted_at IS NULL').all() as any[]
  for (const co of companies) {
    db.prepare('INSERT OR IGNORE INTO company_project_types (company_id, project_type_id) VALUES (?, ?)').run(co.id, id)
  }
  const pt = db.prepare(`${SELECT} FROM project_types WHERE id = ?`).get(id)
  res.status(201).json({ ok: true, data: pt })
})

router.put('/:id', (req, res) => {
  const { name, description, category, isConstruction, includeCountyDefaults, requiresPermit, includeFinancingFields, isActive } = req.body
  const existing = db.prepare('SELECT id, name FROM project_types WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  if (name) {
    const dup = db.prepare('SELECT id FROM project_types WHERE name=? AND id!=?').get(name, req.params.id)
    if (dup) return res.status(409).json({ ok: false, error: 'Name already in use' })
  }
  db.prepare(`UPDATE project_types SET name=COALESCE(?,name), description=COALESCE(?,description),
    category=COALESCE(?,category), is_construction=COALESCE(?,is_construction),
    include_county_defaults=COALESCE(?,include_county_defaults),
    requires_permit=COALESCE(?,requires_permit),
    include_financing_fields=COALESCE(?,include_financing_fields),
    is_active=COALESCE(?,is_active) WHERE id=?`).run(
    name || null, description ?? null, category ?? null,
    isConstruction !== undefined ? (isConstruction ? 1 : 0) : null,
    includeCountyDefaults !== undefined ? (includeCountyDefaults ? 1 : 0) : null,
    requiresPermit !== undefined ? (requiresPermit ? 1 : 0) : null,
    includeFinancingFields !== undefined ? (includeFinancingFields ? 1 : 0) : null,
    isActive !== undefined ? (isActive ? 1 : 0) : null, req.params.id,
  )
  if (includeCountyDefaults) ensureDefaultTemplate(req.params.id, name || existing.name)
  const pt = db.prepare(`${SELECT} FROM project_types WHERE id = ?`).get(req.params.id)
  res.json({ ok: true, data: pt })
})

export default router
