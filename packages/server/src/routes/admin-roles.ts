import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { recordActivity, requireActiveCompany } from './helpers.js'
import { getAllSensitiveFieldPairs } from '../field-permissions.js'

const router = Router()
router.use(requireRole('server_admin', 'company_admin'))

const ENTITIES = ['leads', 'customers', 'projects', 'contacts', 'agreements', 'submissions', 'settings', 'users', 'audit']
const ROLES_SELECT = `SELECT r.id, r.company_id as companyId, r.name, r.description, r.is_system as isSystem, r.created_at as createdAt,
  (SELECT COUNT(*) FROM user_company_memberships WHERE role_id = r.id) as userCount`

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
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  let query = `${ROLES_SELECT} FROM roles r`
  const params: any[] = [companyId]
  query += ' WHERE r.company_id = ?'
  query += ' ORDER BY r.is_system DESC, r.created_at ASC'
  const roles = db.prepare(query).all(...params)
  res.json({ ok: true, data: roles })
})

router.get('/enabled', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const rows = db.prepare(`SELECT er.company_id as companyId, er.role_id as roleId, er.is_enabled as isEnabled,
    r.name as roleName, r.description as roleDescription
    FROM enabled_roles er
    JOIN roles r ON r.id = er.role_id
    WHERE er.company_id = ?`).all(companyId)
  res.json({ ok: true, data: rows })
})

router.put('/enabled', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { roles } = req.body as { roles: { roleId: string; isEnabled: boolean }[] }
  if (!Array.isArray(roles)) return res.status(400).json({ ok: false, error: 'roles array required' })

  const upsert = db.prepare('INSERT INTO enabled_roles (company_id, role_id, is_enabled) VALUES (?, ?, ?) ON CONFLICT(company_id, role_id) DO UPDATE SET is_enabled=excluded.is_enabled')
  for (const r of roles) {
    const role = db.prepare('SELECT id FROM roles WHERE id = ? AND company_id = ?').get(r.roleId, companyId)
    if (role) upsert.run(companyId, r.roleId, r.isEnabled ? 1 : 0)
  }
  res.json({ ok: true })
})

router.get('/:id', (req, res) => {
  const role = db.prepare(`${ROLES_SELECT} FROM roles r WHERE r.id = ?`).get(req.params.id) as any
  if (!role) return res.status(404).json({ ok: false, error: 'Role not found' })
  if (!requireCompanyAccess(req, res, role.companyId)) return
  const perms = db.prepare('SELECT id, role_id as roleId, entity, can_view as canView, can_create as canCreate, can_edit as canEdit, can_delete as canDelete FROM role_permissions WHERE role_id = ?').all(req.params.id)
  role.permissions = perms
  res.json({ ok: true, data: role })
})

router.get('/:id/users', (req, res) => {
  const role = db.prepare('SELECT id, company_id FROM roles WHERE id = ?').get(req.params.id) as any
  if (!role) return res.status(404).json({ ok: false, error: 'Role not found' })
  if (!requireCompanyAccess(req, res, role.company_id)) return
  const users = db.prepare(`SELECT u.id, m.company_id as companyId, u.email, u.name, m.role, m.is_active as isActive, u.created_at as createdAt
    FROM user_company_memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.role_id = ? ORDER BY u.created_at DESC`).all(req.params.id)
  res.json({ ok: true, data: users })
})

router.post('/', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!requireCompanyAccess(req, res, companyId)) return

  const { name, description } = req.body
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'name is required' })

  const id = uuid()
  db.prepare('INSERT INTO roles (id, company_id, name, description) VALUES (?, ?, ?, ?)').run(id, companyId, name.trim(), description || null)

  // Seed all permissions as 0 by default
  const insert = db.prepare('INSERT INTO role_permissions (id, role_id, entity, can_view, can_create, can_edit, can_delete) VALUES (?, ?, ?, 0, 0, 0, 0)')
  for (const entity of ENTITIES) {
    insert.run(uuid(), id, entity)
  }

  const role = db.prepare(`${ROLES_SELECT} FROM roles r WHERE r.id = ?`).get(id)
  recordActivity(companyId, 'role', id, 'created', `Role "${name}" created`, req.user)
  res.status(201).json({ ok: true, data: role })
})

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Role not found' })
  if (!requireCompanyAccess(req, res, existing.company_id)) return

  const { name, description } = req.body
  db.prepare('UPDATE roles SET name=COALESCE(?,name), description=COALESCE(?,description) WHERE id=?').run(
    name?.trim() || null, description !== undefined ? description : null, req.params.id,
  )
  const role = db.prepare(`${ROLES_SELECT} FROM roles r WHERE r.id = ?`).get(req.params.id)
  res.json({ ok: true, data: role })
})

router.put('/:id/permissions', (req, res) => {
  const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Role not found' })
  if (!requireCompanyAccess(req, res, existing.company_id)) return

  const { permissions } = req.body as { permissions: { entity: string; canView?: number; canCreate?: number; canEdit?: number; canDelete?: number }[] }
  if (!Array.isArray(permissions)) return res.status(400).json({ ok: false, error: 'permissions array required' })

  const update = db.prepare('UPDATE role_permissions SET can_view=?, can_create=?, can_edit=?, can_delete=? WHERE role_id=? AND entity=?')
  for (const p of permissions) {
    if (!ENTITIES.includes(p.entity)) continue
    update.run(
      p.canView ?? 0, p.canCreate ?? 0, p.canEdit ?? 0, p.canDelete ?? 0,
      req.params.id, p.entity,
    )
  }

  const perms = db.prepare('SELECT id, role_id as roleId, entity, can_view as canView, can_create as canCreate, can_edit as canEdit, can_delete as canDelete FROM role_permissions WHERE role_id = ?').all(req.params.id)
  res.json({ ok: true, data: perms })
})

/* ── Enabled roles (per-company toggle) ── */
router.get('/enabled', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const rows = db.prepare(`SELECT er.company_id as companyId, er.role_id as roleId, er.is_enabled as isEnabled,
    r.name as roleName, r.description as roleDescription
    FROM enabled_roles er
    JOIN roles r ON r.id = er.role_id
    WHERE er.company_id = ?`).all(companyId)
  res.json({ ok: true, data: rows })
})

router.put('/enabled', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { roles } = req.body as { roles: { roleId: string; isEnabled: boolean }[] }
  if (!Array.isArray(roles)) return res.status(400).json({ ok: false, error: 'roles array required' })

  const upsert = db.prepare('INSERT INTO enabled_roles (company_id, role_id, is_enabled) VALUES (?, ?, ?) ON CONFLICT(company_id, role_id) DO UPDATE SET is_enabled=excluded.is_enabled')
  for (const r of roles) {
    const role = db.prepare('SELECT id FROM roles WHERE id = ? AND company_id = ?').get(r.roleId, companyId)
    if (role) upsert.run(companyId, r.roleId, r.isEnabled ? 1 : 0)
  }
  res.json({ ok: true })
})

router.get('/fields/config', (_req, res) => {
  // Returns all configurable fields grouped by entity
  const sensitive = getAllSensitiveFieldPairs()
  res.json({ ok: true, data: sensitive })
})

router.get('/:id/field-permissions', (req, res) => {
  const role = db.prepare('SELECT id, company_id FROM roles WHERE id = ?').get(req.params.id) as any
  if (!role) return res.status(404).json({ ok: false, error: 'Role not found' })
  if (!requireCompanyAccess(req, res, role.company_id)) return
  const perms = db.prepare('SELECT id, role_id as roleId, entity, field, can_view as canView, can_edit as canEdit FROM role_field_permissions WHERE role_id = ?').all(req.params.id)
  res.json({ ok: true, data: perms })
})

router.put('/:id/field-permissions', (req, res) => {
  const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Role not found' })
  if (!requireCompanyAccess(req, res, existing.company_id)) return

  const { permissions } = req.body as { permissions: { id?: string; entity: string; field: string; canView?: number; canEdit?: number }[] }
  if (!Array.isArray(permissions)) return res.status(400).json({ ok: false, error: 'permissions array required' })

  const upsert = db.prepare('INSERT INTO role_field_permissions (id, role_id, entity, field, can_view, can_edit) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(role_id, entity, field) DO UPDATE SET can_view=excluded.can_view, can_edit=excluded.can_edit')
  for (const p of permissions) {
    upsert.run(uuid(), req.params.id, p.entity, p.field, p.canView ?? 0, p.canEdit ?? 0)
  }

  const perms = db.prepare('SELECT id, role_id as roleId, entity, field, can_view as canView, can_edit as canEdit FROM role_field_permissions WHERE role_id = ?').all(req.params.id)
  res.json({ ok: true, data: perms })
})

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ ok: false, error: 'Role not found' })
  if (!requireCompanyAccess(req, res, existing.company_id)) return
  if (existing.is_system) return res.status(400).json({ ok: false, error: 'Cannot delete system role' })

  const userCount = (db.prepare('SELECT COUNT(*) as c FROM user_company_memberships WHERE role_id = ?').get(req.params.id) as any).c
  if (userCount > 0) return res.status(400).json({ ok: false, error: `Cannot delete role with ${userCount} user(s) assigned. Reassign users first.` })

  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id)
  recordActivity(existing.company_id, 'role', req.params.id, 'deleted', `Role "${existing.name}" deleted`, req.user)
  res.json({ ok: true })
})

export default router
