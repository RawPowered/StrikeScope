import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { randomBytes } from 'crypto'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { requireActiveCompany } from './helpers.js'
import { listOpenShifts } from '../plugins/time-tracking/index.js'
import { listStaleProjects } from '../plugins/project-stale/index.js'

const router = Router()

router.get('/overrides', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const rows = db.prepare(`SELECT r.id, r.project_id as projectId, r.user_id as userId, u.name as userName,
    r.action_type as actionType, r.resource_id as resourceId, r.reason, r.status,
    r.reviewed_by as reviewedBy, r.reviewed_at as reviewedAt, r.review_note as reviewNote,
    r.created_at as createdAt, p.name as projectName
    FROM field_override_requests r
    JOIN users u ON u.id=r.user_id
    JOIN projects p ON p.id=r.project_id
    WHERE r.company_id=?
    ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC`).all(companyId)
  res.json({ ok: true, data: rows })
})

router.patch('/overrides/:id', requireRole('server_admin', 'company_admin', 'project_admin', 'project_manager'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { status, reviewNote } = req.body
  if (!['approved', 'denied'].includes(status)) return res.status(400).json({ ok: false, error: 'status must be approved or denied' })
  const row = db.prepare(`SELECT * FROM field_override_requests WHERE id=? AND company_id=?`).get(req.params.id, companyId) as any
  if (!row) return res.status(404).json({ ok: false, error: 'Not found' })
  if (row.status !== 'pending') return res.status(400).json({ ok: false, error: 'Already reviewed' })
  const now = new Date().toISOString()
  db.prepare(`UPDATE field_override_requests SET status=?, reviewed_by=?, reviewed_at=?, review_note=? WHERE id=?`)
    .run(status, req.user!.userId, now, reviewNote || null, req.params.id)

  let grant: any = null
  if (status === 'approved') {
    const grantToken = `GRANT-${randomBytes(12).toString('hex')}`
    const grantId = uuid()
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    db.prepare(`INSERT INTO field_override_grants (id, company_id, request_id, project_id, user_id, action_type, resource_id, grant_token, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(grantId, companyId, row.id, row.project_id, row.user_id, row.action_type, row.resource_id, grantToken, expiresAt)
    grant = { grantToken, expiresAt }
  }
  res.json({ ok: true, data: { status, grant } })
})

router.get('/time-logs', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  res.json({ ok: true, data: listOpenShifts(db, companyId) })
})

router.get('/stale', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  res.json({ ok: true, data: listStaleProjects(db, companyId) })
})

export default router
