import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireRole } from '../auth.js'

const router = Router()
router.use(requireRole('server_admin'))

const SELECT = `SELECT id, name, address, phone, email, branding_json as brandingJson,
  is_active as isActive, is_sandbox as isSandbox, mfa_enabled as mfaEnabled, deleted_at as deletedAt, created_at as createdAt`

/* ── List active companies ── */
router.get('/', (_req, res) => {
  const companies = db.prepare(`${SELECT} FROM companies WHERE deleted_at IS NULL ORDER BY created_at DESC`).all()
  res.json({ ok: true, data: companies })
})

/* ── Deleted items (must be before /:id routes) ── */
router.get('/deleted/list', (_req, res) => {
  const list = db.prepare(`SELECT dc.id, dc.original_id as originalId, dc.name,
    dc.deleted_at as deletedAt, dc.restore_by as restoreBy,
    dc.restored_at as restoredAt, dc.permanently_deleted_at as permanentlyDeletedAt
    FROM deleted_companies dc ORDER BY dc.deleted_at DESC`).all()
  res.json({ ok: true, data: list })
})

router.post('/deleted/purge-expired', (_req, res) => {
  const expired = db.prepare("SELECT id FROM deleted_companies WHERE restored_at IS NULL AND restore_by < datetime('now')").all() as any[]
  const stmt = db.prepare('DELETE FROM deleted_companies WHERE id = ?')
  const tx = db.transaction(() => { for (const e of expired) stmt.run(e.id) })
  tx()
  res.json({ ok: true, data: { purged: expired.length } })
})

router.delete('/deleted/:deletedId/purge', (req, res) => {
  const record = db.prepare('SELECT * FROM deleted_companies WHERE id = ?').get(req.params.deletedId) as any
  if (!record) return res.status(404).json({ ok: false, error: 'Not found' })
  const origCompany = db.prepare('SELECT id FROM companies WHERE id = ?').get(record.original_id) as any
  if (origCompany && record.restored_at) return res.status(400).json({ ok: false, error: 'Company was restored, cannot purge' })
  if (origCompany) {
    db.prepare('DELETE FROM companies WHERE id = ?').run(record.original_id)
  }
  db.prepare('DELETE FROM deleted_companies WHERE id = ?').run(req.params.deletedId)
  res.json({ ok: true })
})

/* ── Single company ── */
router.get('/:id', (req, res) => {
  const c = db.prepare(`${SELECT} FROM companies WHERE id = ? AND deleted_at IS NULL`).get(req.params.id) as any
  if (!c) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true, data: c })
})

router.post('/', (req, res) => {
  const { name, address, phone, email } = req.body
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'Name is required' })
  const id = uuid()
  db.prepare('INSERT INTO companies (id, name, address, phone, email) VALUES (?, ?, ?, ?, ?)').run(id, name.trim(), address || null, phone || null, email || null)
  const c = db.prepare(`${SELECT} FROM companies WHERE id = ?`).get(id)
  res.status(201).json({ ok: true, data: c })
})

/* ── MFA toggle ── */
router.put('/:id/mfa', (req, res) => {
  const company = db.prepare('SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL').get(req.params.id) as any
  if (!company) return res.status(404).json({ ok: false, error: 'Not found' })
  const { mfaEnabled } = req.body
  db.prepare('UPDATE companies SET mfa_enabled = ? WHERE id = ?').run(mfaEnabled ? 1 : 0, req.params.id)
  res.json({ ok: true })
})

/* ── Email config ── */
router.get('/:id/email-config', (req, res) => {
  const company = db.prepare('SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL').get(req.params.id) as any
  if (!company) return res.status(404).json({ ok: false, error: 'Not found' })
  const cfg = db.prepare('SELECT smtp_host as smtpHost, smtp_port as smtpPort, smtp_user as smtpUser, from_email as fromEmail, from_name as fromName FROM company_email_config WHERE company_id = ?').get(req.params.id)
  res.json({ ok: true, data: cfg || null })
})

router.put('/:id/email-config', (req, res) => {
  const company = db.prepare('SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL').get(req.params.id) as any
  if (!company) return res.status(404).json({ ok: false, error: 'Not found' })
  const { smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName } = req.body
  db.prepare(`INSERT INTO company_email_config (company_id, smtp_host, smtp_port, smtp_user, smtp_pass, from_email, from_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id) DO UPDATE SET smtp_host=excluded.smtp_host, smtp_port=excluded.smtp_port,
    smtp_user=excluded.smtp_user, smtp_pass=COALESCE(excluded.smtp_pass, company_email_config.smtp_pass),
    from_email=excluded.from_email, from_name=excluded.from_name`).run(
    req.params.id, smtpHost || null, smtpPort || 587, smtpUser || null,
    smtpPass || null, fromEmail || null, fromName || null,
  )
  res.json({ ok: true })
})

router.put('/:id', (req, res) => {
  const { name, address, phone, email, brandingJson } = req.body
  const existing = db.prepare('SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL').get(req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  db.prepare('UPDATE companies SET name=COALESCE(?,name), address=COALESCE(?,address), phone=COALESCE(?,phone), email=COALESCE(?,email), branding_json=COALESCE(?,branding_json) WHERE id=?').run(
    name || null, address ?? null, phone ?? null, email ?? null, brandingJson || null, req.params.id
  )
  const c = db.prepare(`${SELECT} FROM companies WHERE id = ?`).get(req.params.id)
  res.json({ ok: true, data: c })
})

router.post('/:id/deactivate', (req, res) => {
  const existing = db.prepare('SELECT * FROM companies WHERE id = ? AND deleted_at IS NULL').get(req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  if (existing.id === 'default') return res.status(400).json({ ok: false, error: 'Cannot delete the default company' })

  const snapshot = {
    company: existing,
    customers: db.prepare('SELECT * FROM customers WHERE company_id=?').all(req.params.id),
    projects: db.prepare('SELECT * FROM projects WHERE company_id=?').all(req.params.id),
  }

  const deletedId = uuid()
  const restoreWindow = Math.min(Math.max(parseInt(req.body.restoreDays) || 180, 1), 180)
  db.prepare('INSERT INTO deleted_companies (id, original_id, name, data_json, restore_by) VALUES (?, ?, ?, ?, ?)').run(
    deletedId, existing.id, existing.name, JSON.stringify(snapshot), new Date(Date.now() + restoreWindow * 86400000).toISOString()
  )
  db.prepare("UPDATE companies SET is_active=0, deleted_at=datetime('now') WHERE id=?").run(req.params.id)
  res.json({ ok: true, data: { deletedId, restoreBy: new Date(Date.now() + restoreWindow * 86400000).toISOString() } })
})

router.post('/:id/restore', (req, res) => {
  const deleted = db.prepare('SELECT * FROM deleted_companies WHERE original_id=? AND restored_at IS NULL').get(req.params.id) as any
  if (!deleted) return res.status(404).json({ ok: false, error: 'No deleted record found' })
  if (new Date(deleted.restore_by) < new Date()) return res.status(400).json({ ok: false, error: 'Restore window has expired' })

  db.prepare('UPDATE companies SET is_active=1, deleted_at=NULL WHERE id=?').run(req.params.id)
  db.prepare("UPDATE deleted_companies SET restored_at=datetime('now') WHERE id=?").run(deleted.id)
  const c = db.prepare(`${SELECT} FROM companies WHERE id = ?`).get(req.params.id)
  res.json({ ok: true, data: c })
})

export default router
