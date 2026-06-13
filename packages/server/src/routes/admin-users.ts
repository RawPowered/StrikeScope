import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { parsePaginationParams, buildPaginatedResponse, requireActiveCompany } from './helpers.js'

const router = Router()
router.use(requireRole('server_admin', 'company_admin'))

const SELECT = `SELECT u.id, m.company_id as companyId, u.email, u.name,
  COALESCE(m.role, u.role) as role, m.role_id as roleId,
  r.name as roleName, u.is_active as isActive, m.is_active as membershipActive,
  u.created_at as createdAt
  FROM users u
  LEFT JOIN user_company_memberships m ON m.user_id = u.id
  LEFT JOIN roles r ON r.id = m.role_id`

// Enforce company scoping for company_admin
function scopedCompany(req: any): string | null {
  return req.user?.companyId || null
}

function requireCompanyAccess(req: any, res: any, companyId: string | null): boolean {
  const role = req.user?.role
  if (role === 'server_admin') return true
  if (role === 'company_admin' && req.user?.companyId === companyId) return true
  res.status(403).json({ ok: false, error: 'Access denied' })
  return false
}

router.get('/', (req, res) => {
  const companyId = scopedCompany(req)
  const { page, perPage, offset } = parsePaginationParams(req.query as any)
  let query = `${SELECT}`
  const params: any[] = []
  if (companyId) {
    query += ' WHERE m.company_id = ?'
    params.push(companyId)
  } else if (req.user?.role !== 'server_admin') {
    return res.status(400).json({ ok: false, error: 'Active company context required' })
  } else {
    query += ' WHERE u.role = ?'
    params.push('server_admin')
  }
  query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?'
  params.push(perPage, offset)

  let countQuery = companyId
    ? `SELECT COUNT(*) as total FROM users u JOIN user_company_memberships m ON m.user_id = u.id WHERE m.company_id = ?`
    : `SELECT COUNT(*) as total FROM users u WHERE u.role = ?`
  const countParams = companyId ? [companyId] : ['server_admin']
  const total = (db.prepare(countQuery).get(...countParams) as any).total

  const users = db.prepare(query).all(...params)
  res.json(buildPaginatedResponse(users, total, page, perPage))
})

router.get('/:id', (req, res) => {
  const companyId = scopedCompany(req)
  const u = companyId
    ? db.prepare(`${SELECT} WHERE u.id = ? AND m.company_id = ?`).get(req.params.id, companyId) as any
    : db.prepare(`SELECT id, company_id as companyId, email, name, role, role_id as roleId, is_active as isActive, created_at as createdAt FROM users WHERE id = ?`).get(req.params.id) as any
  if (!u) return res.status(404).json({ ok: false, error: 'Not found' })
  if (!requireCompanyAccess(req, res, u.companyId)) return
  res.json({ ok: true, data: u })
})

router.post('/', (req, res) => {
  const isSuper = req.user?.role === 'server_admin'
  let { companyId, email, name, role, password, roleId } = req.body

  if (!email || !name || !password) return res.status(400).json({ ok: false, error: 'email, name, password required' })

  // company_admin cannot set role to server_admin
  if (!isSuper) companyId = req.user?.companyId
  if (!companyId && role !== 'server_admin') return res.status(400).json({ ok: false, error: 'companyId is required' })
  if (!requireCompanyAccess(req, res, companyId)) return

  // If roleId not provided, assign default role for the company
  if (companyId && !roleId) {
    const defaultRole = db.prepare("SELECT id FROM roles WHERE company_id = ? AND name = 'User'").get(companyId) as any
    roleId = defaultRole?.id || null
  }
  if (roleId) {
    const roleRow = db.prepare('SELECT id, name FROM roles WHERE id = ? AND company_id = ?').get(roleId, companyId) as any
    if (!roleRow) return res.status(400).json({ ok: false, error: 'Role not found for this company' })
    role = roleRow.name === 'Company Admin' ? 'company_admin' : (role || 'user')
  }

  let id = (db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any)?.id
  if (!id) {
    id = uuid()
    const hash = bcrypt.hashSync(password, 12)
    db.prepare('INSERT INTO users (id, company_id, email, name, role, password_hash, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id, companyId || null, email, name, role || 'user', hash, companyId ? roleId || null : null,
    )
  } else if (!isSuper && db.prepare('SELECT id FROM user_company_memberships WHERE user_id = ? AND company_id = ?').get(id, companyId)) {
    return res.status(409).json({ ok: false, error: 'User already belongs to this company' })
  }

  if (companyId) {
    db.prepare(`INSERT OR IGNORE INTO user_company_memberships (id, user_id, company_id, role, role_id, is_active)
      VALUES (?, ?, ?, ?, ?, 1)`).run(uuid(), id, companyId, role || 'user', roleId || null)
  }
  const u = companyId
    ? db.prepare(`${SELECT} WHERE u.id = ? AND m.company_id = ?`).get(id, companyId)
    : db.prepare('SELECT id, company_id as companyId, email, name, role, role_id as roleId, is_active as isActive, created_at as createdAt FROM users WHERE id = ?').get(id)
  res.status(201).json({ ok: true, data: u })
})

router.put('/:id', (req, res) => {
  const companyId = scopedCompany(req)
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Not found' })
  const membership = companyId ? db.prepare('SELECT * FROM user_company_memberships WHERE user_id = ? AND company_id = ?').get(req.params.id, companyId) as any : null
  if (companyId && !membership) return res.status(404).json({ ok: false, error: 'Not found' })
  if (!requireCompanyAccess(req, res, companyId || existing.company_id)) return

  const { email, name, role, password, isActive, roleId } = req.body
  const isSuper = req.user?.role === 'server_admin'

  if (password) {
    const hash = bcrypt.hashSync(password, 12)
    db.prepare('UPDATE users SET email=COALESCE(?,email), name=COALESCE(?,name), password_hash=? WHERE id=?').run(
      email || null, name || null, hash, req.params.id,
    )
  } else {
    db.prepare('UPDATE users SET email=COALESCE(?,email), name=COALESCE(?,name) WHERE id=?').run(
      email || null, name || null, req.params.id,
    )
  }

  // Only server_admin can change role label
  if (role && isSuper) {
    db.prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id)
  }

  if (roleId !== undefined) {
    // Verify role belongs to same company
    const roleRow = db.prepare('SELECT id, name FROM roles WHERE id = ? AND company_id = ?').get(roleId, companyId)
    if (roleRow) {
      db.prepare('UPDATE user_company_memberships SET role_id=?, role=? WHERE user_id=? AND company_id=?').run(
        roleId, (roleRow as any).name === 'Company Admin' ? 'company_admin' : 'user', req.params.id, companyId,
      )
    } else {
      return res.status(400).json({ ok: false, error: 'Role not found for this company' })
    }
  }

  if (isActive !== undefined) {
    if (companyId) db.prepare('UPDATE user_company_memberships SET is_active=? WHERE user_id=? AND company_id=?').run(isActive ? 1 : 0, req.params.id, companyId)
    else db.prepare('UPDATE users SET is_active=? WHERE id=?').run(isActive ? 1 : 0, req.params.id)
  }

  const u = companyId
    ? db.prepare(`${SELECT} WHERE u.id = ? AND m.company_id = ?`).get(req.params.id, companyId)
    : db.prepare('SELECT id, company_id as companyId, email, name, role, role_id as roleId, is_active as isActive, created_at as createdAt FROM users WHERE id = ?').get(req.params.id)
  res.json({ ok: true, data: u })
})

export default router
