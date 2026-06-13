import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import multer from 'multer'
import { join } from 'path'
import db from '../db.js'
import { getConfig } from '../config.js'
import { requirePermission, canViewField } from '../auth.js'
import { recordActivity, withCfSelect, parsePaginationParams, buildPaginatedResponse, requireActiveCompany, requireCompanyRecord, requireRelatedCompanyRecord, appendTerritoryFilters } from './helpers.js'
import { encryptField, decryptField } from '../crypto.js'
import { filesystemProvider } from '../storage/filesystem.js'
import { requireNoDuplicateOrOverride } from './admin-duplicates.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const LIST_SELECT = `SELECT c.id, c.company_id as companyId, c.customer_id as customerId,
  c.first_name as firstName, c.last_name as lastName,
  c.email, c.phone, c.role, c.contact_type as contactType,
  c.photo_id_storage_key as photoIdStorageKey, c.photo_id_mime_type as photoIdMimeType,
  c.photo_id_uploaded_at as photoIdUploadedAt,
  CASE WHEN c.photo_id_storage_key IS NOT NULL THEN 1 ELSE 0 END as hasPhotoId,
  c.is_primary as isPrimary, c.notes, c.is_active as isActive, c.created_at as createdAt,
  cu.name as customerName, cu.state as customerState, cu.city as customerCity
  FROM contacts c
  JOIN customers cu ON cu.id = c.customer_id`

const DETAIL_SELECT = `SELECT c.id, c.company_id as companyId, c.customer_id as customerId,
  c.first_name as firstName, c.last_name as lastName,
  c.email, c.phone, c.role, c.contact_type as contactType,
  c.photo_id_storage_key as photoIdStorageKey, c.photo_id_mime_type as photoIdMimeType,
  c.photo_id_uploaded_at as photoIdUploadedAt,
  CASE WHEN c.photo_id_storage_key IS NOT NULL THEN 1 ELSE 0 END as hasPhotoId,
  c.is_primary as isPrimary,
  c.ssn_last_four as ssnLastFourEnc, c.date_of_birth as dateOfBirthEnc,
  c.notes, c.is_active as isActive, c.created_at as createdAt,
  cu.name as customerName
  FROM contacts c
  JOIN customers cu ON cu.id = c.customer_id`

router.get('/', requirePermission('contacts', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { customerId, include_custom_fields, contactType } = req.query
  const { page, perPage, offset } = parsePaginationParams(req.query as any)
  let selectSql = include_custom_fields === 'true' ? withCfSelect(LIST_SELECT, 'contacts', 'c') : LIST_SELECT
  const whereParts = ['c.company_id = ?']
  const params: any[] = [companyId]
  if (customerId) { whereParts.push('c.customer_id = ?'); params.push(customerId) }
  if (contactType) { whereParts.push('c.contact_type = ?'); params.push(contactType) }
  appendTerritoryFilters(req.query as any, 'cu', whereParts, params)

  const cfParams = Object.keys(req.query as any).filter(k => k.startsWith('cf_'))
  for (const key of cfParams) {
    const fieldName = key.slice(3)
    const val = (req.query as any)[key]
    whereParts.push(`EXISTS (SELECT 1 FROM custom_field_values v
      JOIN custom_field_definitions d ON d.id = v.field_definition_id
      WHERE v.entity = 'contacts' AND v.entity_id = c.id AND d.field_name = ? AND v.value = ?)`)
    params.push(fieldName, val)
  }

  const where = whereParts.join(' AND ')
  const total = (db.prepare(`SELECT COUNT(*) as total FROM contacts c JOIN customers cu ON cu.id = c.customer_id WHERE ${where}`).get(...params) as any).total
  const contacts = db.prepare(`${selectSql} WHERE ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset)
  res.json(buildPaginatedResponse(contacts, total, page, perPage))
})

router.get('/:id', requirePermission('contacts', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const c = db.prepare(`${DETAIL_SELECT} WHERE c.company_id = ? AND c.id = ?`).get(companyId, req.params.id) as any
  if (!c) return res.status(404).json({ ok: false, error: 'Not found' })
  if (canViewField(req.user, 'contacts', 'ssn_last_four') && c.ssnLastFourEnc) {
    c.ssnLastFour = decryptField(c.ssnLastFourEnc)
  }
  if (canViewField(req.user, 'contacts', 'date_of_birth') && c.dateOfBirthEnc) {
    c.dateOfBirth = decryptField(c.dateOfBirthEnc)
  }
  delete c.ssnLastFourEnc
  delete c.dateOfBirthEnc
  res.json({ ok: true, data: c })
})

router.post('/', requirePermission('contacts', 'create'), (req, res) => {
  const { customerId, firstName, lastName, email, phone, role, contactType, isPrimary, notes, ssnLastFour, dateOfBirth, overrideReason } = req.body
  if (!customerId || !firstName || !firstName.trim()) return res.status(400).json({ ok: false, error: 'customerId and firstName are required' })
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!requireRelatedCompanyRecord(res, 'customers', customerId, companyId, 'Customer')) return
  const dup = requireNoDuplicateOrOverride(companyId, 'contacts', { firstName, lastName, email, phone }, overrideReason, req.user?.userId)
  if (dup.blocked) return res.status(409).json({ ok: false, error: dup.error, data: dup.matches })

  const id = uuid()
  const ssnEnc = ssnLastFour ? encryptField(ssnLastFour) : null
  const dobEnc = dateOfBirth ? encryptField(dateOfBirth) : null
  const type = contactType || 'standard'
  db.prepare(`INSERT INTO contacts (id, company_id, customer_id, first_name, last_name, email, phone, role, contact_type, is_primary, notes, ssn_last_four, date_of_birth)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, companyId, customerId, firstName.trim(), lastName || null, email || null, phone || null,
    role || null, type, isPrimary ? 1 : 0, notes || null, ssnEnc, dobEnc,
  )
  if (type === 'co_signer') {
    db.prepare('UPDATE customers SET co_signer_contact_id=? WHERE id=? AND company_id=?').run(id, customerId, companyId)
  }
  const c = db.prepare(`${LIST_SELECT} WHERE c.company_id = ? AND c.id = ?`).get(companyId, id)
  recordActivity(companyId, 'contact', id, 'created', `Contact "${firstName} ${lastName || ''}" created`, req.user)
  res.status(201).json({ ok: true, data: c })
})

router.put('/:id', requirePermission('contacts', 'edit'), (req, res) => {
  const { firstName, lastName, email, phone, role, contactType, isPrimary, notes, ssnLastFour, dateOfBirth } = req.body
  const existing = requireCompanyRecord(req, res, 'contacts', req.params.id as string)
  if (!existing) return
  if (firstName && !firstName.trim()) return res.status(400).json({ ok: false, error: 'firstName cannot be empty' })

  const ssnEnc = ssnLastFour !== undefined ? (ssnLastFour ? encryptField(ssnLastFour) : null) : undefined
  const dobEnc = dateOfBirth !== undefined ? (dateOfBirth ? encryptField(dateOfBirth) : null) : undefined
  db.prepare(`UPDATE contacts SET first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name),
    email=COALESCE(?,email), phone=COALESCE(?,phone), role=COALESCE(?,role),
    contact_type=COALESCE(?,contact_type), is_primary=COALESCE(?,is_primary), notes=COALESCE(?,notes),
    ssn_last_four=COALESCE(?,ssn_last_four), date_of_birth=COALESCE(?,date_of_birth) WHERE id=?`).run(
    firstName || null, lastName ?? null, email ?? null, phone ?? null, role ?? null,
    contactType ?? null, isPrimary != null ? (isPrimary ? 1 : 0) : null, notes ?? null,
    ssnEnc ?? null, dobEnc ?? null, req.params.id,
  )
  if (contactType === 'co_signer') {
    db.prepare('UPDATE customers SET co_signer_contact_id=? WHERE id=?').run(req.params.id, existing.customer_id)
  }
  const c = db.prepare(`${LIST_SELECT} WHERE c.company_id = ? AND c.id = ?`).get(existing.company_id, req.params.id)
  recordActivity(existing.company_id, 'contact', req.params.id as string, 'updated', `Contact updated`, req.user)
  res.json({ ok: true, data: c })
})

router.post('/:id/photo-id', requirePermission('contacts', 'edit'), upload.single('file'), async (req, res) => {
  const existing = requireCompanyRecord(req, res, 'contacts', req.params.id as string)
  if (!existing) return
  const file = req.file
  if (!file) return res.status(400).json({ ok: false, error: 'file required' })
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  if (!allowed.includes(file.mimetype)) return res.status(400).json({ ok: false, error: 'Invalid file type' })

  const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : 'bin'
  const contactId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const storageKey = join('contacts', contactId, `photo-id.${ext}`).replace(/\\/g, '/')
  try {
    await filesystemProvider.upload({ storageDir: getConfig().storageDir }, storageKey, file.buffer)
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message || 'Upload failed' })
  }

  const now = new Date().toISOString()
  db.prepare(`UPDATE contacts SET photo_id_storage_key=?, photo_id_mime_type=?, photo_id_uploaded_at=? WHERE id=?`).run(
    storageKey, file.mimetype, now, req.params.id,
  )

  const docId = uuid()
  db.prepare(`INSERT INTO customer_documents (id, company_id, customer_id, kind, name, storage_key, mime_type, size_bytes, uploaded_by)
    VALUES (?, ?, ?, 'photo_id', ?, ?, ?, ?, ?)`).run(
    docId, existing.company_id, existing.customer_id, `Photo ID - ${existing.first_name}`,
    storageKey, file.mimetype, file.size, req.user?.userId || null,
  )

  const c = db.prepare(`${LIST_SELECT} WHERE c.company_id = ? AND c.id = ?`).get(existing.company_id, req.params.id)
  res.json({ ok: true, data: c })
})

router.delete('/:id/photo-id', requirePermission('contacts', 'edit'), async (req, res) => {
  const existing = requireCompanyRecord(req, res, 'contacts', req.params.id as string)
  if (!existing) return
  if (existing.photo_id_storage_key) {
    try {
      await filesystemProvider.delete({ storageDir: getConfig().storageDir }, join(getConfig().storageDir, existing.photo_id_storage_key))
    } catch { /* ignore */ }
  }
  db.prepare(`UPDATE contacts SET photo_id_storage_key=NULL, photo_id_mime_type=NULL, photo_id_uploaded_at=NULL WHERE id=?`).run(req.params.id)
  const c = db.prepare(`${LIST_SELECT} WHERE c.company_id = ? AND c.id = ?`).get(existing.company_id, req.params.id)
  res.json({ ok: true, data: c })
})

router.delete('/:id', requirePermission('contacts', 'delete'), (req, res) => {
  const existing = requireCompanyRecord(req, res, 'contacts', req.params.id as string)
  if (!existing) return
  db.prepare('DELETE FROM contacts WHERE id = ? AND company_id = ?').run(req.params.id, existing.company_id)
  recordActivity(existing.company_id, 'contact', req.params.id as string, 'deleted', `Contact deleted`, req.user)
  res.json({ ok: true })
})

export default router
