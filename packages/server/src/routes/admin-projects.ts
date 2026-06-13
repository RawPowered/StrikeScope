import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requirePermission } from '../auth.js'
import { withCfSelect, parsePaginationParams, buildPaginatedResponse, requireActiveCompany, requireCompanyRecord, requireRelatedCompanyRecord, appendTerritoryFilters, appendAssignmentFilter, recordActivity } from './helpers.js'
import { computeProjectProgress } from '../plugins/project-progress.js'
import { computeProjectStale, listStaleProjects } from '../plugins/project-stale/index.js'
import { listActiveJobs } from '../plugins/active-jobs/index.js'

const router = Router()

const SELECT = `SELECT p.id, p.company_id as companyId, p.customer_id as customerId,
  p.project_type_id as projectTypeId, p.name, p.address, p.city, p.state, p.county, p.zip,
  p.county_department as countyDepartment, p.permit_number as permitNumber,
  p.property_legal_description as propertyLegalDescription,
  p.co_signer_contact_id as coSignerContactId,
  p.financing_type as financingType, p.bank_id as bankId, p.property_id as propertyId,
  p.status, p.assigned_to as assignedTo, p.access_key as accessKey, p.notes,
  p.scheduled_install_at as scheduledInstallAt, p.sprint_started_at as sprintStartedAt,
  p.sprint_completed_at as sprintCompletedAt, p.last_field_activity_at as lastFieldActivityAt,
  p.worksite_lat as worksiteLat, p.worksite_lng as worksiteLng, p.geofence_radius_m as geofenceRadiusM,
  p.is_active as isActive, p.created_at as createdAt,
  c.name as customerName, pt.name as projectTypeName,
  pt.category as projectTypeCategory, pt.is_construction as projectTypeIsConstruction,
  pt.include_county_defaults as projectTypeIncludeCountyDefaults,
  pt.requires_permit as projectTypeRequiresPermit,
  pt.include_financing_fields as projectTypeIncludeFinancingFields,
  b.name as bankName
  FROM projects p
  LEFT JOIN customers c ON c.id = p.customer_id
  LEFT JOIN project_types pt ON pt.id = p.project_type_id
  LEFT JOIN company_banks b ON b.id = p.bank_id`

function generateAccessKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let key: string
  const usedKeys = new Set(db.prepare('SELECT access_key FROM projects WHERE access_key IS NOT NULL').all().map((r: any) => r.access_key))
  do {
    key = ''
    for (let i = 0; i < 6; i++) key += chars[Math.floor(Math.random() * chars.length)]
  } while (usedKeys.has(key))
  return key
}

const FINANCING_NEEDS_BANK = new Set(['loan', 'lease'])

function validateBankForFinancing(companyId: string, financingType: string | null | undefined, bankId: string | null | undefined): string | null {
  if (!financingType || !FINANCING_NEEDS_BANK.has(financingType)) return null
  if (!bankId) return 'Bank is required for loan or lease financing'
  const bank = db.prepare('SELECT id FROM company_banks WHERE id=? AND company_id=? AND is_active=1').get(bankId, companyId)
  if (!bank) return 'Invalid or inactive bank'
  return null
}

function validatePermitForType(projectTypeId: string | null, permitNumber: string | null | undefined, propertyLegalDescription: string | null | undefined): string | null {
  if (!projectTypeId) return null
  const pt = db.prepare('SELECT requires_permit FROM project_types WHERE id=?').get(projectTypeId) as { requires_permit: number } | undefined
  if (!pt?.requires_permit) return null
  if (!permitNumber?.trim()) return 'Permit number is required for this project type'
  if (!propertyLegalDescription?.trim()) return 'Property legal description is required for this project type'
  return null
}

function syncAssignments(projectId: string, assignments: { userId: string; role: string }[] | undefined, assignedBy: string | undefined) {
  if (!assignments?.length) return
  const del = db.prepare('DELETE FROM project_assignments WHERE project_id=?')
  const ins = db.prepare(`INSERT OR REPLACE INTO project_assignments (id, project_id, user_id, role, assigned_by)
    VALUES (?, ?, ?, ?, ?)`)
  del.run(projectId)
  for (const a of assignments) {
    if (a.userId && a.role) ins.run(uuid(), projectId, a.userId, a.role, assignedBy || null)
  }
}

function loadPropertySnapshot(propertyId: string | null | undefined) {
  if (!propertyId) return null
  return db.prepare('SELECT address, city, state, county, zip FROM customer_properties WHERE id=?').get(propertyId) as any
}

function snapshotTemplateItems(projectId: string, projectTypeId: string | null) {
  let useTemplateId: string | null = null
  if (projectTypeId) {
    const def = db.prepare('SELECT id FROM task_templates WHERE project_type_id=? AND is_default=1 AND is_active=1').get(projectTypeId) as any
    if (def) useTemplateId = def.id
  }
  if (!useTemplateId) {
    const def = db.prepare('SELECT id FROM task_templates WHERE is_global=1 AND is_default=1 AND is_active=1').get() as any
    if (def) useTemplateId = def.id
  }
  if (!useTemplateId) return
  const items = db.prepare(`SELECT id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image
    FROM template_items WHERE template_id = ? ORDER BY sort_order ASC`).all(useTemplateId) as any[]
  const insert = db.prepare(`INSERT INTO project_task_items (id, project_id, template_item_id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  for (const item of items) {
    insert.run(uuid(), projectId, item.id, item.label, item.sort_order, item.title_en, item.title_es, item.desc_en, item.desc_es, item.required_count, item.example_image)
  }
}

router.get('/', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { customerId, status, include_custom_fields } = req.query
  const { page, perPage, offset } = parsePaginationParams(req.query as any)
  let selectSql = SELECT
  if (include_custom_fields === 'true') selectSql = withCfSelect(selectSql, 'projects', 'p')
  const whereParts = ['p.company_id = ?']
  const params: any[] = [companyId]
  if (customerId) { whereParts.push('p.customer_id = ?'); params.push(customerId as string) }
  if (status) { whereParts.push('p.status = ?'); params.push(status as string) }
  appendTerritoryFilters(req.query as any, 'p', whereParts, params)
  appendAssignmentFilter(req, 'p', whereParts, params)

  const cfParams = Object.keys(req.query as any).filter(k => k.startsWith('cf_'))
  for (const key of cfParams) {
    const fieldName = key.slice(3)
    const val = (req.query as any)[key]
    whereParts.push(`EXISTS (SELECT 1 FROM custom_field_values v
      JOIN custom_field_definitions d ON d.id = v.field_definition_id
      WHERE v.entity = 'projects' AND v.entity_id = p.id AND d.field_name = ? AND v.value = ?)`)
    params.push(fieldName, val)
  }

  const where = whereParts.join(' AND ')
  const total = (db.prepare(`SELECT COUNT(*) as total FROM projects p WHERE ${where}`).get(...params) as any).total
  const projects = db.prepare(`${selectSql} WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset)
  res.json(buildPaginatedResponse(projects, total, page, perPage))
})

router.get('/active', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  res.json({ ok: true, data: listActiveJobs(db, companyId) })
})

router.get('/stale', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  res.json({ ok: true, data: listStaleProjects(db, companyId) })
})

router.get('/:id', (req, res) => {
  if (req.user?.role === 'customer') {
    if (req.params.id !== req.user.projectId) {
      return res.status(403).json({ ok: false, error: 'Forbidden' })
    }
  }
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const p = db.prepare(`${SELECT} WHERE p.company_id = ? AND p.id = ?`).get(companyId, req.params.id) as any
  if (!p) return res.status(404).json({ ok: false, error: 'Not found' })
  const items = db.prepare(`SELECT id, project_id as projectId, template_item_id as templateItemId,
    label, sort_order as sortOrder, title_en as titleEn, title_es as titleEs,
    desc_en as descEn, desc_es as descEs, required_count as requiredCount,
    example_image as exampleImage
    FROM project_task_items WHERE project_id = ? ORDER BY sort_order ASC`).all(req.params.id)
  const assignments = db.prepare(`SELECT id, user_id as userId, role, assigned_at as assignedAt FROM project_assignments WHERE project_id=?`).all(req.params.id)
  const contactLinks = db.prepare(`SELECT pc.contact_id as contactId, pc.role, c.first_name as firstName, c.last_name as lastName
    FROM project_contacts pc JOIN contacts c ON c.id=pc.contact_id WHERE pc.project_id=?`).all(req.params.id)
  const progress = computeProjectProgress(db, req.params.id)
  const stale = computeProjectStale(db, req.params.id)
  const timeLogs = db.prepare(`SELECT id, user_id as userId, clock_in_time as clockInTime, clock_out_time as clockOutTime, status
    FROM time_logs WHERE project_id=? ORDER BY clock_in_time DESC LIMIT 20`).all(req.params.id)
  res.json({ ok: true, data: { ...p, items, assignments, contactLinks, progress, stale, timeLogs } })
})

router.get('/:id/progress', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const p = db.prepare('SELECT id FROM projects WHERE id=? AND company_id=?').get(req.params.id, companyId)
  if (!p) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true, data: computeProjectProgress(db, req.params.id) })
})

router.post('/', requirePermission('projects', 'create'), (req, res) => {
  let { companyId, customerId, projectTypeId, propertyId, name, address, city, state, county, zip,
    countyDepartment, permitNumber, propertyLegalDescription, coSignerContactId,
    financingType, bankId, assignedTo, assignments, contactIds, notes, templateId } = req.body
  companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'name is required' })

  const company = db.prepare('SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL').get(companyId) as any
  if (!company) return res.status(400).json({ ok: false, error: 'Company not found' })
  if (!requireRelatedCompanyRecord(res, 'customers', customerId, companyId, 'Customer')) return
  if (assignedTo && !requireRelatedCompanyRecord(res, 'users', assignedTo, companyId, 'Assigned user')) return
  if (templateId) {
    const template = db.prepare('SELECT id FROM task_templates WHERE id = ? AND (company_id = ? OR is_global = 1)').get(templateId, companyId)
    if (!template) return res.status(400).json({ ok: false, error: 'Template not found for active company' })
  }
  const permitErr = validatePermitForType(projectTypeId || null, permitNumber, propertyLegalDescription)
  if (permitErr) return res.status(400).json({ ok: false, error: permitErr })
  const bankErr = validateBankForFinancing(companyId, financingType, bankId)
  if (bankErr) return res.status(400).json({ ok: false, error: bankErr })
  if (bankId && !financingType) return res.status(400).json({ ok: false, error: 'Financing type is required when a bank is selected' })

  const propSnap = loadPropertySnapshot(propertyId)
  const id = uuid()
  const accessKey = generateAccessKey()
  db.prepare(`INSERT INTO projects (id, company_id, customer_id, project_type_id, property_id, name, address, city, state, county, zip,
    county_department, permit_number, property_legal_description, co_signer_contact_id,
    financing_type, bank_id, assigned_to, notes, access_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, companyId, customerId || null, projectTypeId || null, propertyId || null, name.trim(),
    address || propSnap?.address || null, city || propSnap?.city || null, state || propSnap?.state || null,
    county || propSnap?.county || null, zip || propSnap?.zip || null,
    countyDepartment || null, permitNumber || null, propertyLegalDescription || null,
    coSignerContactId || null, financingType || null, bankId || null,
    assignedTo || null, notes || null, accessKey,
  )
  syncAssignments(id, assignments, req.user?.userId)
  if (Array.isArray(contactIds)) {
    const link = db.prepare('INSERT OR IGNORE INTO project_contacts (project_id, contact_id, role) VALUES (?, ?, ?)')
    for (const cid of contactIds) link.run(id, cid, 'owner')
  }

  if (templateId) {
    const items = db.prepare(`SELECT id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image
      FROM template_items WHERE template_id = ? ORDER BY sort_order ASC`).all(templateId) as any[]
    const insert = db.prepare(`INSERT INTO project_task_items (id, project_id, template_item_id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const item of items) {
      insert.run(uuid(), id, item.id, item.label, item.sort_order, item.title_en, item.title_es, item.desc_en, item.desc_es, item.required_count, item.example_image)
    }
  } else {
    snapshotTemplateItems(id, projectTypeId || null)
  }

  const p = db.prepare(`${SELECT} WHERE p.company_id = ? AND p.id = ?`).get(companyId, id)
  res.status(201).json({ ok: true, data: p })
})

router.put('/:id', requirePermission('projects', 'edit'), (req, res) => {
  const { name, address, city, state, county, zip, countyDepartment, permitNumber, propertyLegalDescription,
    coSignerContactId, financingType, bankId, customerId, projectTypeId, propertyId, status, assignedTo,
    assignments, contactIds, notes } = req.body
  const existing = requireCompanyRecord(req, res, 'projects', req.params.id as string)
  if (!existing) return

  const validStatuses = ['planned', 'active', 'completed', 'cancelled']
  if (status && !validStatuses.includes(status)) return res.status(400).json({ ok: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })

  if (customerId && !requireRelatedCompanyRecord(res, 'customers', customerId, existing.company_id, 'Customer')) return
  if (assignedTo && !requireRelatedCompanyRecord(res, 'users', assignedTo, existing.company_id, 'Assigned user')) return

  const typeId = projectTypeId ?? existing.project_type_id
  const permitErr = validatePermitForType(typeId, permitNumber ?? existing.permit_number, propertyLegalDescription ?? existing.property_legal_description)
  if (permitErr) return res.status(400).json({ ok: false, error: permitErr })
  const resolvedFinancing = financingType !== undefined ? financingType : existing.financing_type
  const resolvedBank = bankId !== undefined ? bankId : existing.bank_id
  const bankErr = validateBankForFinancing(existing.company_id, resolvedFinancing, resolvedBank)
  if (bankErr) return res.status(400).json({ ok: false, error: bankErr })
  if (resolvedBank && !resolvedFinancing) return res.status(400).json({ ok: false, error: 'Financing type is required when a bank is selected' })

  const statusChanged = status && status !== existing.status

  db.prepare(`UPDATE projects SET name=COALESCE(?,name), address=COALESCE(?,address),
    city=COALESCE(?,city), state=COALESCE(?,state), county=COALESCE(?,county), zip=COALESCE(?,zip),
    county_department=COALESCE(?,county_department), permit_number=COALESCE(?,permit_number),
    property_legal_description=COALESCE(?,property_legal_description),
    co_signer_contact_id=COALESCE(?,co_signer_contact_id),
    financing_type=COALESCE(?,financing_type), bank_id=COALESCE(?,bank_id),
    property_id=COALESCE(?,property_id),
    customer_id=COALESCE(?,customer_id), project_type_id=COALESCE(?,project_type_id),
    status=COALESCE(?,status), assigned_to=COALESCE(?,assigned_to),
    scheduled_install_at=COALESCE(?,scheduled_install_at),
    worksite_lat=COALESCE(?,worksite_lat), worksite_lng=COALESCE(?,worksite_lng),
    geofence_radius_m=COALESCE(?,geofence_radius_m),
    notes=COALESCE(?,notes) WHERE id=?`).run(
    name || null, address ?? null, city ?? null, state ?? null, county ?? null, zip ?? null,
    countyDepartment ?? null, permitNumber ?? null, propertyLegalDescription ?? null,
    coSignerContactId ?? null, financingType ?? null, bankId ?? null, propertyId ?? null,
    customerId ?? null, projectTypeId ?? null,
    status || null, assignedTo ?? null,
    req.body.scheduledInstallAt ?? null, req.body.worksiteLat ?? null, req.body.worksiteLng ?? null,
    req.body.geofenceRadiusM ?? null,
    notes ?? null, req.params.id,
  )
  const projectId = String(req.params.id)
  if (assignments) syncAssignments(projectId, assignments, req.user?.userId)
  if (Array.isArray(contactIds)) {
    db.prepare('DELETE FROM project_contacts WHERE project_id=?').run(projectId)
    const link = db.prepare('INSERT OR IGNORE INTO project_contacts (project_id, contact_id, role) VALUES (?, ?, ?)')
    for (const cid of contactIds) link.run(projectId, cid, 'owner')
  }
  if (statusChanged) {
    recordActivity(existing.company_id, 'project', projectId, 'status-changed',
      `Project status changed from "${existing.status}" to "${status}"`, req.user,
      { oldStatus: existing.status, newStatus: status })
  }

  const p = db.prepare(`${SELECT} WHERE p.company_id = ? AND p.id = ?`).get(existing.company_id, req.params.id)
  res.json({ ok: true, data: p })
})

router.delete('/:id', requirePermission('projects', 'delete'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const result = db.prepare('DELETE FROM projects WHERE id = ? AND company_id = ?').run(req.params.id, companyId)
  if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true })
})

export default router
