import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requirePermission } from '../auth.js'
import { recordActivity, withCfSelect, parsePaginationParams, buildPaginatedResponse, requireActiveCompany, requireCompanyRecord, requireRelatedCompanyRecord, appendTerritoryFilters } from './helpers.js'
import { validateBody, validateQuery, validateParams, leadSchemas, commonSchemas } from '../validation.js'
import { copyCarryOverCustomFields } from '../field-settings.js'
import { requireNoDuplicateOrOverride } from './admin-duplicates.js'

const router = Router()

const SELECT = `SELECT l.id, l.company_id as companyId, l.name, l.email, l.phone, l.source,
  l.address, l.city, l.state, l.county, l.zip,
  l.stage_id as stageId, l.assigned_to as assignedTo, l.notes, l.value,
  l.co_signer_name as coSignerName, l.co_signer_email as coSignerEmail, l.co_signer_phone as coSignerPhone,
  l.converted_account_id as convertedAccountId, l.converted_project_id as convertedProjectId,
  l.converted_at as convertedAt, l.is_active as isActive, l.created_at as createdAt,
  l.project_type_id as projectTypeId, l.dnc_at as dncAt, l.dnc_reason as dncReason,
  ls.name as stageName, ls.color as stageColor,
  pt.name as projectTypeName
  FROM leads l
  LEFT JOIN lead_stages ls ON ls.id = l.stage_id
  LEFT JOIN project_types pt ON pt.id = l.project_type_id`

function attachStage(row: any) {
  if (!row) return null
  const stage = db.prepare('SELECT name, color FROM lead_stages WHERE id = ?').get(row.stageId) as any
  return { ...row, stageName: stage?.name || null, stageColor: stage?.color || null }
}

router.get('/', requirePermission('leads', 'view'), validateQuery(leadSchemas.listQuery), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { stageId, include_custom_fields, include_dnc } = req.query
  const { page, perPage, offset } = parsePaginationParams(req.query as any)

  let selectSql = include_custom_fields === 'true' ? withCfSelect(SELECT, 'leads', 'l') : SELECT

  const whereParts = ['l.company_id = ?']
  const params: any[] = [companyId]
  if (include_dnc !== 'true') whereParts.push('l.dnc_at IS NULL')
  if (stageId) { whereParts.push('l.stage_id = ?'); params.push(stageId) }
  appendTerritoryFilters(req.query as any, 'l', whereParts, params)
  let query = `${selectSql} WHERE ${whereParts.join(' AND ')}`

  // Custom field filters
  const cfParams = Object.keys(req.query as any).filter(k => k.startsWith('cf_'))
  for (const key of cfParams) {
    const fieldName = key.slice(3)
    const val = (req.query as any)[key]
    query += ` AND EXISTS (SELECT 1 FROM custom_field_values v
      JOIN custom_field_definitions d ON d.id = v.field_definition_id
      WHERE v.entity = 'leads' AND v.entity_id = l.id AND d.field_name = ? AND v.value = ?)`
    params.push(fieldName, val)
  }

  const countWhereParts = ['l.company_id = ?']
  const countParams: any[] = [companyId]
  if (include_dnc !== 'true') countWhereParts.push('l.dnc_at IS NULL')
  if (stageId) { countWhereParts.push('l.stage_id = ?'); countParams.push(stageId) }
  appendTerritoryFilters(req.query as any, 'l', countWhereParts, countParams)
  let countQuery = `SELECT COUNT(*) as total FROM leads l WHERE ${countWhereParts.join(' AND ')}`
  for (const key of cfParams) {
    const fieldName = key.slice(3)
    const val = (req.query as any)[key]
    countQuery += ` AND EXISTS (SELECT 1 FROM custom_field_values v
      JOIN custom_field_definitions d ON d.id = v.field_definition_id
      WHERE v.entity = 'leads' AND v.entity_id = l.id AND d.field_name = ? AND v.value = ?)`
    countParams.push(fieldName, val)
  }
  const total = (db.prepare(countQuery).get(...countParams) as any).total

  query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?'
  params.push(perPage, offset)

  const rows = db.prepare(query).all(...params)
  res.json(buildPaginatedResponse(rows, total, page, perPage))
})

router.get('/dnc', requirePermission('leads', 'view'), validateQuery(leadSchemas.listQuery), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { page, perPage, offset } = parsePaginationParams(req.query as any)

  const { include_custom_fields } = req.query
  const dncSelect = include_custom_fields === 'true' ? withCfSelect(SELECT, 'leads', 'l') : SELECT
  let query = `${dncSelect} WHERE l.company_id = ? AND l.dnc_at IS NOT NULL`
  const params: any[] = [companyId]

  let countQuery = `SELECT COUNT(*) as total FROM leads l WHERE l.company_id = ? AND l.dnc_at IS NOT NULL`
  const total = (db.prepare(countQuery).get(companyId) as any).total

  query += ' ORDER BY l.dnc_at DESC LIMIT ? OFFSET ?'
  params.push(perPage, offset)

  const rows = db.prepare(query).all(...params)
  res.json(buildPaginatedResponse(rows, total, page, perPage))
})

router.get('/:id', requirePermission('leads', 'view'), validateParams(commonSchemas.uuid), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const row = db.prepare(`${SELECT} WHERE l.company_id = ? AND l.id = ?`).get(companyId, req.params.id) as any
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true, data: row })
})

router.post('/', requirePermission('leads', 'create'), validateBody(leadSchemas.create), (req, res) => {
  let { companyId, name, email, phone, source, stageId, assignedTo, notes, value,
    coSignerName, coSignerEmail, coSignerPhone, projectTypeId,
    address, city, state, county, zip, overrideReason } = req.body
  companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'name is required' })
  const dup = requireNoDuplicateOrOverride(companyId, 'leads', { name, email, phone, address }, overrideReason, req.user?.userId)
  if (dup.blocked) return res.status(409).json({ ok: false, error: dup.error, data: dup.matches })

  if (!stageId) {
    const def = db.prepare('SELECT id FROM lead_stages WHERE company_id=? AND is_default=1').get(companyId) as any
    if (def) { stageId = def.id } else {
      const first = db.prepare('SELECT id FROM lead_stages WHERE company_id=? ORDER BY sort_order ASC LIMIT 1').get(companyId) as any
      if (first) stageId = first.id
    }
  }
  if (stageId && !requireRelatedCompanyRecord(res, 'lead_stages', stageId, companyId, 'Stage')) return
  if (assignedTo && !requireRelatedCompanyRecord(res, 'users', assignedTo, companyId, 'Assigned user')) return

  const id = uuid()
  db.prepare(`INSERT INTO leads (id, company_id, name, email, phone, source, address, city, state, county, zip,
    stage_id, assigned_to, notes, value, co_signer_name, co_signer_email, co_signer_phone, project_type_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, companyId, name.trim(), email || null, phone || null, source || null,
    address || null, city || null, state || null, county || null, zip || null,
    stageId || null, assignedTo || null, notes || null, value != null ? value : null,
    coSignerName || null, coSignerEmail || null, coSignerPhone || null, projectTypeId || null,
  )
  const row = db.prepare(`${SELECT} WHERE l.company_id = ? AND l.id = ?`).get(companyId, id) as any
  recordActivity(companyId, 'lead', id, 'created', `Lead "${name.trim()}" created`, req.user, { stageId })
  res.status(201).json({ ok: true, data: row })
})

router.put('/:id', requirePermission('leads', 'edit'), validateParams(commonSchemas.uuid), validateBody(leadSchemas.update), (req, res) => {
  const { name, email, phone, source, stageId, assignedTo, notes, value,
    coSignerName, coSignerEmail, coSignerPhone, projectTypeId, dncAt, dncReason,
    address, city, state, county, zip } = req.body
  const existing = requireCompanyRecord(req, res, 'leads', req.params.id as string)
  if (!existing) return
  if (name && !name.trim()) return res.status(400).json({ ok: false, error: 'Name cannot be empty' })

  if (stageId && !requireRelatedCompanyRecord(res, 'lead_stages', stageId, existing.company_id, 'Stage')) return
  if (assignedTo && !requireRelatedCompanyRecord(res, 'users', assignedTo, existing.company_id, 'Assigned user')) return

  const oldStageId = existing.stage_id
  db.prepare(`UPDATE leads SET name=COALESCE(?,name), email=COALESCE(?,email), phone=COALESCE(?,phone),
    source=COALESCE(?,source), address=COALESCE(?,address), city=COALESCE(?,city),
    state=COALESCE(?,state), county=COALESCE(?,county), zip=COALESCE(?,zip),
    stage_id=COALESCE(?,stage_id), assigned_to=COALESCE(?,assigned_to),
    notes=COALESCE(?,notes), value=COALESCE(?,value),
    co_signer_name=COALESCE(?,co_signer_name), co_signer_email=COALESCE(?,co_signer_email),
    co_signer_phone=COALESCE(?,co_signer_phone),
    project_type_id=COALESCE(?,project_type_id), dnc_at=COALESCE(?,dnc_at), dnc_reason=COALESCE(?,dnc_reason) WHERE id=?`).run(
    name || null, email ?? null, phone ?? null, source ?? null,
    address ?? null, city ?? null, state ?? null, county ?? null, zip ?? null,
    stageId ?? null, assignedTo ?? null, notes ?? null, value != null ? value : null,
    coSignerName ?? null, coSignerEmail ?? null, coSignerPhone ?? null,
    projectTypeId !== undefined ? projectTypeId : null, dncAt ?? null, dncReason ?? null,
    req.params.id,
  )

  // Record stage change if moved
  if (stageId && oldStageId !== stageId) {
    const oldStage = db.prepare('SELECT name FROM lead_stages WHERE id=?').get(oldStageId) as any
    const newStage = db.prepare('SELECT name FROM lead_stages WHERE id=?').get(stageId) as any
    recordActivity(existing.company_id, 'lead', req.params.id as string, 'stage-changed',
      `Moved from "${oldStage?.name || '?'}" to "${newStage?.name || '?'}"`, req.user,
      { fromStageId: oldStageId, toStageId: stageId })
  } else {
    recordActivity(existing.company_id, 'lead', req.params.id as string, 'updated', `Lead updated`, req.user)
  }

  const row = db.prepare(`${SELECT} WHERE l.company_id = ? AND l.id = ?`).get(existing.company_id, req.params.id)
  res.json({ ok: true, data: row })
})

router.delete('/:id', requirePermission('leads', 'delete'), (req, res) => {
  const existing = requireCompanyRecord(req, res, 'leads', req.params.id as string)
  if (!existing) return
  db.prepare('DELETE FROM leads WHERE id = ? AND company_id = ?').run(req.params.id, existing.company_id)
    recordActivity(existing.company_id, 'lead', req.params.id as string, 'deleted', `Lead "${existing.name}" deleted`, req.user)
  res.json({ ok: true })
})

/* ── Convert lead to Customer + Contact(s) + optional Project ── */
router.post('/:id/convert', requirePermission('leads', 'edit'), (req, res) => {
  const existing = requireCompanyRecord(req, res, 'leads', req.params.id as string)
  if (!existing) return
  if (existing.converted_account_id) return res.status(400).json({ ok: false, error: 'Lead already converted' })
  const companyId = existing.company_id

  const wonStage = db.prepare("SELECT id FROM lead_stages WHERE company_id=? AND LOWER(name)='won'").get(companyId) as any
  if (!wonStage) return res.status(400).json({ ok: false, error: 'No "Won" stage configured. Create one first.' })

  const { projectTypeId, projectName } = req.body
  if (projectTypeId) {
    const enabled = db.prepare(`SELECT 1 FROM company_project_types WHERE company_id = ? AND project_type_id = ? AND is_enabled = 1`).get(companyId, projectTypeId)
    if (!enabled) return res.status(400).json({ ok: false, error: 'Project type not enabled for active company' })
  }

  const customerId = uuid()
  let projectId: string | undefined

  const tx = db.transaction(() => {
    // Create Customer with source tracking + location
    db.prepare(`INSERT INTO customers (id, company_id, name, email, phone, address, city, state, county, zip, notes, source, source_lead_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      customerId, companyId, existing.name || 'Converted Lead', existing.email, existing.phone,
      existing.address, existing.city, existing.state, existing.county, existing.zip,
      existing.notes, 'lead', existing.id,
    )
    recordActivity(companyId, 'customer', customerId, 'created', `Account created from lead "${existing.name}"`, req.user)

    // Create Agreement (draft)
    const agreementId = uuid()
    db.prepare('INSERT INTO agreements (id, company_id, customer_id, status, terms) VALUES (?, ?, ?, ?, ?)').run(
      agreementId, companyId, customerId, 'draft', null,
    )
    recordActivity(companyId, 'agreement', agreementId, 'created', `Agreement created from lead conversion`, req.user)

    // Create primary Contact (owner)
    const primaryContactId = uuid()
    db.prepare(`INSERT INTO contacts (id, company_id, customer_id, first_name, email, phone, role, contact_type, is_primary)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'primary', 1)`).run(
      primaryContactId, companyId, customerId, existing.name || 'Converted Lead',
      existing.email, existing.phone, 'owner',
    )

    let coSignerContactId: string | undefined
    if (existing.co_signer_name) {
      coSignerContactId = uuid()
      db.prepare(`INSERT INTO contacts (id, company_id, customer_id, first_name, email, phone, role, contact_type, is_primary)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'co_signer', 0)`).run(
        coSignerContactId, companyId, customerId, existing.co_signer_name,
        existing.co_signer_email, existing.co_signer_phone, 'co-signer',
      )
      db.prepare('UPDATE customers SET co_signer_contact_id=? WHERE id=?').run(coSignerContactId, customerId)
    }

    if (projectTypeId) {
      projectId = uuid()
      const ptName = (db.prepare('SELECT name FROM project_types WHERE id=?').get(projectTypeId) as any)?.name
      db.prepare(`INSERT INTO projects (id, company_id, customer_id, project_type_id, name, address, city, state, county, zip,
        co_signer_contact_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        projectId, companyId, customerId, projectTypeId,
        projectName || `${ptName || 'Project'} - ${existing.name}`,
        existing.address, existing.city, existing.state, existing.county, existing.zip,
        coSignerContactId || null, 'active',
      )
      recordActivity(companyId, 'project', projectId, 'created', `Project created from lead conversion`, req.user)
      if (existing.assigned_to) {
        db.prepare(`INSERT OR IGNORE INTO project_assignments (id, project_id, user_id, role, assigned_by) VALUES (?, ?, ?, 'sales_agent', ?)`).run(
          uuid(), projectId, existing.assigned_to, req.user?.userId || null,
        )
      }

      let useTemplateId: string | null = null
      const typeDef = db.prepare('SELECT id FROM task_templates WHERE project_type_id=? AND is_default=1 AND is_active=1').get(projectTypeId) as any
      if (typeDef) useTemplateId = typeDef.id
      if (!useTemplateId) {
        const globalDef = db.prepare('SELECT id FROM task_templates WHERE is_global=1 AND is_default=1 AND is_active=1').get() as any
        if (globalDef) useTemplateId = globalDef.id
      }
      if (!useTemplateId) {
        const companyDef = db.prepare('SELECT id FROM task_templates WHERE company_id=? AND is_default=1 AND is_active=1').get(companyId) as any
        if (companyDef) useTemplateId = companyDef.id
      }
      if (useTemplateId) {
        const items = db.prepare('SELECT * FROM template_items WHERE template_id=? ORDER BY sort_order ASC').all(useTemplateId) as any[]
        const insert = db.prepare('INSERT INTO project_task_items (id, project_id, template_item_id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        for (const item of items) {
          insert.run(uuid(), projectId, item.id, item.label, item.sort_order, item.title_en, item.title_es, item.desc_en, item.desc_es, item.required_count, item.example_image)
        }
      }
    }

    // Update lead to Won
    db.prepare('UPDATE leads SET stage_id=?, converted_account_id=?, converted_project_id=?, converted_at=datetime("now") WHERE id=?').run(
      wonStage.id, customerId, projectId || null, req.params.id,
    )
    copyCarryOverCustomFields(db, 'leads', existing.id, 'customers', customerId, companyId)
    copyCarryOverCustomFields(db, 'leads', existing.id, 'contacts', primaryContactId, companyId)
    if (projectId) copyCarryOverCustomFields(db, 'leads', existing.id, 'projects', projectId, companyId)

    recordActivity(companyId, 'lead', req.params.id as string, 'converted',
      `Lead "${existing.name}" converted to account${projectId ? ' and project' : ''}`, req.user,
      { customerId, projectId })
  })
  tx()

  const row = db.prepare(`${SELECT} WHERE l.company_id = ? AND l.id = ?`).get(companyId, req.params.id) as any
  res.json({
    ok: true,
    data: {
      lead: row,
      account: { id: customerId, name: existing.name },
      project: projectId ? { id: projectId } : null,
    },
  })
})

/* ── Mark/unmark as Do Not Contact ── */
router.post('/:id/dnc', requirePermission('leads', 'edit'), validateParams(commonSchemas.uuid), validateBody(leadSchemas.dnc), (req: any, res) => {
  const existing = requireCompanyRecord(req, res, 'leads', req.params.id as string)
  if (!existing) return

  const { reason } = req.body
  const now = new Date().toISOString()
  db.prepare('UPDATE leads SET dnc_at = ?, dnc_reason = ? WHERE id = ?').run(now, reason || null, req.params.id)
  recordActivity(existing.company_id, 'lead', req.params.id, 'dnc',
    `Lead "${existing.name}" marked as Do Not Contact${reason ? `: ${reason}` : ''}`, req.user, { reason })

  const row = db.prepare(`${SELECT} WHERE l.company_id = ? AND l.id = ?`).get(existing.company_id, req.params.id)
  res.json({ ok: true, data: row })
})

/* ── Remove from DNC ── */
router.delete('/:id/dnc', requirePermission('leads', 'edit'), validateParams(commonSchemas.uuid), (req: any, res) => {
  const existing = requireCompanyRecord(req, res, 'leads', req.params.id as string)
  if (!existing) return

  db.prepare('UPDATE leads SET dnc_at = NULL, dnc_reason = NULL WHERE id = ?').run(req.params.id)
  recordActivity(existing.company_id, 'lead', req.params.id, 'dnc-removed',
    `Lead "${existing.name}" removed from Do Not Contact`, req.user)

  const row = db.prepare(`${SELECT} WHERE l.company_id = ? AND l.id = ?`).get(existing.company_id, req.params.id)
  res.json({ ok: true, data: row })
})

export default router
