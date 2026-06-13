import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import multer from 'multer'
import { join } from 'path'
import db from '../db.js'
import { getConfig } from '../config.js'
import { requirePermission, requireAnyPermission } from '../auth.js'
import { recordActivity, requireActiveCompany, requireCompanyRecord, requireRelatedCompanyRecord } from './helpers.js'
import { filesystemProvider } from '../storage/filesystem.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

const AGREEMENT_SELECT = `SELECT a.id, a.company_id as companyId, a.customer_id as customerId,
  a.project_id as projectId, a.status, a.terms, a.document_url as documentUrl,
  a.signed_at as signedAt, a.created_at as createdAt,
  cu.name as customerName, p.name as projectName
  FROM agreements a
  LEFT JOIN customers cu ON cu.id = a.customer_id
  LEFT JOIN projects p ON p.id = a.project_id`

const FILE_SELECT = `SELECT id, company_id as companyId, customer_id as customerId,
  project_id as projectId, kind, agreement_id as agreementId, name,
  storage_key as storageKey, mime_type as mimeType, size_bytes as sizeBytes,
  uploaded_by as uploadedBy, created_at as createdAt
  FROM customer_documents`

function assertCustomer(req: any, res: any, customerId: string) {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return null
  if (!requireRelatedCompanyRecord(res, 'customers', customerId, companyId, 'Customer')) return null
  return companyId
}

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value
}

router.get('/:customerId/files', requirePermission('customers', 'view'), (req, res) => {
  const customerId = paramId(req.params.customerId)
  const companyId = assertCustomer(req, res, customerId)
  if (!companyId) return
  const rows = db.prepare(`${FILE_SELECT} WHERE company_id = ? AND customer_id = ? ORDER BY created_at DESC`).all(companyId, customerId)
  res.json({ ok: true, data: rows })
})

router.post('/:customerId/files', requirePermission('customers', 'create'), upload.single('file'), async (req, res) => {
  const customerId = paramId(req.params.customerId)
  const companyId = assertCustomer(req, res, customerId)
  if (!companyId) return
  const file = req.file
  if (!file) return res.status(400).json({ ok: false, error: 'file required' })

  const kind = (req.body.kind as string) || 'other'
  const allowed = ['agreement', 'contract', 'permit', 'photo', 'photo_id', 'other']
  if (!allowed.includes(kind)) return res.status(400).json({ ok: false, error: 'invalid kind' })

  const id = uuid()
  const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : 'bin'
  const storageKey = join('customers', customerId, `${id}.${ext}`).replace(/\\/g, '/')

  try {
    await filesystemProvider.upload({ storageDir: getConfig().storageDir }, storageKey, file.buffer)
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message || 'Upload failed' })
  }

  db.prepare(`
    INSERT INTO customer_documents (id, company_id, customer_id, project_id, kind, name, storage_key, mime_type, size_bytes, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, companyId, customerId, req.body.projectId || null, kind,
    file.originalname, storageKey, file.mimetype, file.size, req.user?.userId || null,
  )

  const row = db.prepare(`${FILE_SELECT} WHERE id = ?`).get(id)
  recordActivity(companyId, 'customer', customerId, 'file_uploaded', `Uploaded ${file.originalname}`, req.user)
  res.status(201).json({ ok: true, data: row })
})

router.delete('/:customerId/files/:fileId', requirePermission('customers', 'delete'), async (req, res) => {
  const customerId = paramId(req.params.customerId)
  const fileId = paramId(req.params.fileId)
  const companyId = assertCustomer(req, res, customerId)
  if (!companyId) return
  const row = db.prepare(`${FILE_SELECT} WHERE id = ? AND company_id = ? AND customer_id = ?`).get(fileId, companyId, customerId) as any
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' })

  try {
    const fullPath = join(getConfig().storageDir, row.storageKey)
    await filesystemProvider.delete({ storageDir: getConfig().storageDir }, fullPath)
  } catch { /* file may already be gone */ }

  db.prepare('DELETE FROM customer_documents WHERE id = ?').run(fileId)
  res.json({ ok: true })
})

router.get('/:customerId/agreements', requireAnyPermission(['agreements', 'customers'], 'view'), (req, res) => {
  const customerId = paramId(req.params.customerId)
  const companyId = assertCustomer(req, res, customerId)
  if (!companyId) return
  const rows = db.prepare(`${AGREEMENT_SELECT} WHERE a.company_id = ? AND a.customer_id = ? ORDER BY a.created_at DESC`).all(companyId, customerId)
  res.json({ ok: true, data: rows })
})

router.post('/:customerId/agreements', requireAnyPermission(['agreements', 'customers'], 'create'), (req, res) => {
  const customerId = paramId(req.params.customerId)
  const companyId = assertCustomer(req, res, customerId)
  if (!companyId) return
  const { projectId, terms } = req.body
  if (projectId && !requireRelatedCompanyRecord(res, 'projects', projectId, companyId, 'Project')) return

  const id = uuid()
  db.prepare('INSERT INTO agreements (id, company_id, customer_id, project_id, terms) VALUES (?, ?, ?, ?, ?)').run(
    id, companyId, customerId, projectId || null, terms || null,
  )

  const docId = uuid()
  db.prepare(`
    INSERT INTO customer_documents (id, company_id, customer_id, project_id, kind, agreement_id, name, storage_key, uploaded_by)
    VALUES (?, ?, ?, ?, 'agreement', ?, ?, ?, ?)
  `).run(docId, companyId, customerId, projectId || null, id, `Agreement ${new Date().toLocaleDateString()}`, `agreements/${id}`, req.user?.userId || null)

  const row = db.prepare(`${AGREEMENT_SELECT} WHERE a.id = ?`).get(id)
  recordActivity(companyId, 'agreement', id, 'created', 'Agreement created', req.user)
  res.status(201).json({ ok: true, data: row })
})

export default router
