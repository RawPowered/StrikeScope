import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import db from './db.js'
import { getConfig } from './config.js'
import { isSensitiveField } from './field-permissions.js'
import { applyActiveCompanyHeader } from './active-company.js'
import { DEV_ADMIN_EMAIL } from '@strikescope/shared/src/brand.js'

const isDevOrTest = process.env.DEV_MODE === 'true' || process.env.DEV_MODE === '1' || process.env.VITEST === 'true'
export const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (!isDevOrTest) {
    throw new Error('JWT_SECRET environment variable is required when DEV_MODE is not set to true/1')
  }
  return 'strikescope-dev-secret-2026'
})()

export type UserRoleUnion = 'server_admin' | 'company_admin' | 'user'
  | 'sales_manager' | 'sales_agent' | 'project_admin' | 'project_manager'
  | 'foreman' | 'crewman' | 'technician' | 'customer'

export interface AuthUser {
  userId: string
  companyId: string | null
  role: UserRoleUnion
  name: string
  email?: string
  roleId?: string | null
  roleName?: string | null
  membershipId?: string | null
  projectId?: string | null
  memberships?: UserMembership[]
  rolePermissions?: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; fields?: Record<string, { canView: boolean; canEdit: boolean }> }>
}

export interface UserMembership {
  id: string
  userId: string
  companyId: string
  companyName: string
  role: UserRoleUnion
  roleId: string | null
  roleName?: string | null
  isActive: boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function loadPermissions(roleId: string | null | undefined): Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; fields?: Record<string, { canView: boolean; canEdit: boolean }> }> {
  if (!roleId) return {}
  const rows = db.prepare('SELECT entity, can_view, can_create, can_edit, can_delete FROM role_permissions WHERE role_id = ?').all(roleId) as any[]
  const perms: Record<string, any> = {}

  // Load field-level permissions
  const fieldRows = db.prepare('SELECT entity, field, can_view, can_edit FROM role_field_permissions WHERE role_id = ?').all(roleId) as any[]
  const fieldMap: Record<string, Record<string, { canView: boolean; canEdit: boolean }>> = {}
  for (const f of fieldRows) {
    if (!fieldMap[f.entity]) fieldMap[f.entity] = {}
    fieldMap[f.entity][f.field] = {
      canView: !!f.can_view,
      canEdit: !!f.can_edit,
    }
  }

  for (const r of rows) {
    perms[r.entity] = {
      canView: !!r.can_view,
      canCreate: !!r.can_create,
      canEdit: !!r.can_edit,
      canDelete: !!r.can_delete,
      fields: fieldMap[r.entity],
    }
  }
  return perms
}

export function loadMemberships(userId: string): UserMembership[] {
  return db.prepare(`SELECT m.id, m.user_id as userId, m.company_id as companyId,
    c.name as companyName, m.role, m.role_id as roleId, r.name as roleName,
    m.is_active as isActive
    FROM user_company_memberships m
    JOIN companies c ON c.id = m.company_id AND c.deleted_at IS NULL AND c.is_active = 1
    LEFT JOIN roles r ON r.id = m.role_id
    WHERE m.user_id = ? AND m.is_active = 1
    ORDER BY c.name ASC`).all(userId) as UserMembership[]
}

export function loadMembership(userId: string, companyId: string): UserMembership | null {
  return db.prepare(`SELECT m.id, m.user_id as userId, m.company_id as companyId,
    c.name as companyName, m.role, m.role_id as roleId, r.name as roleName,
    m.is_active as isActive
    FROM user_company_memberships m
    JOIN companies c ON c.id = m.company_id AND c.deleted_at IS NULL AND c.is_active = 1
    LEFT JOIN roles r ON r.id = m.role_id
    WHERE m.user_id = ? AND m.company_id = ? AND m.is_active = 1`).get(userId, companyId) as UserMembership | null
}

export function canViewField(user: AuthUser | undefined, entity: string, field: string): boolean {
  if (!user) return false
  if (user.role === 'server_admin') return true
  const ep = user.rolePermissions?.[entity]
  if (!ep?.canView) return false
  if (!isSensitiveField(entity, field)) return true
  return ep.fields?.[field]?.canView ?? false
}

export function canEditField(user: AuthUser | undefined, entity: string, field: string): boolean {
  if (!user) return false
  if (user.role === 'server_admin') return true
  const ep = user.rolePermissions?.[entity]
  if (!ep?.canEdit) return false
  if (!isSensitiveField(entity, field)) return true
  return ep.fields?.[field]?.canEdit ?? false
}

function attachUserFromPayload(payload: any) {
  return {
    userId: payload.userId,
    companyId: payload.companyId || null,
    role: payload.role,
    name: payload.name,
    email: payload.email,
    roleId: payload.roleId || null,
    roleName: payload.roleName || null,
    membershipId: payload.membershipId || null,
    memberships: payload.memberships || [],
    projectId: payload.projectId || null,
    rolePermissions: payload.rolePermissions || payload.permissions || {},
  }
}

function attachDevFallbackUser() {
  const devUser = db.prepare('SELECT id, company_id as companyId, email, name, role, role_id as roleId FROM users WHERE email = ?').get(DEV_ADMIN_EMAIL) as any
  if (devUser) {
    const adminCompanies = db.prepare('SELECT id as companyId, name as companyName FROM companies WHERE deleted_at IS NULL AND is_active = 1 ORDER BY name ASC').all() as any[]
    const memberships: UserMembership[] = devUser.role === 'server_admin'
      ? adminCompanies.map((c: any) => ({ id: c.companyId, userId: devUser.id, companyId: c.companyId, companyName: c.companyName, role: 'server_admin' as const, roleId: null, roleName: 'Server Admin', isActive: true }))
      : loadMemberships(devUser.id)
    const membership = devUser.role === 'server_admin'
      ? null
      : memberships.find(m => m.companyId === devUser.companyId) || memberships[0] || null
    return {
      userId: devUser.id,
      companyId: membership?.companyId || null,
      role: (membership?.role || devUser.role) as UserRoleUnion,
      name: devUser.name,
      email: devUser.email,
      roleId: membership?.roleId || null,
      roleName: membership?.roleName || null,
      membershipId: membership?.id || null,
      memberships,
      rolePermissions: loadPermissions(membership?.roleId),
    } satisfies AuthUser
  }
  return {
    userId: 'dev-user',
    companyId: 'default',
    role: 'server_admin' as const,
    name: 'Dev User',
    roleId: null,
    membershipId: null,
    memberships: [],
    rolePermissions: {},
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7)
    // Automation service keys (ssap_*) authenticate at route level
    if (token.startsWith('ssap_')) {
      return next()
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any
      req.user = attachUserFromPayload(payload)
      applyActiveCompanyHeader(req)
      return next()
    } catch {
      if (!getConfig().devMode) {
        return res.status(401).json({ ok: false, error: 'Invalid or expired token' })
      }
    }
  }

  if (getConfig().devMode) {
    req.user = attachDevFallbackUser()
    applyActiveCompanyHeader(req)
    return next()
  }

  return res.status(401).json({ ok: false, error: 'Authentication required' })
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'Authentication required' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Insufficient permissions' })
    }
    next()
  }
}

export function requirePermission(entity: string, action: 'view' | 'create' | 'edit' | 'delete') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'Authentication required' })

    // server_admin always passes
    if (req.user.role === 'server_admin') return next()

    const perms = req.user.rolePermissions?.[entity]
    if (!perms) return res.status(403).json({ ok: false, error: `No permissions for ${entity}` })

    const actionKey = `can${action.charAt(0).toUpperCase() + action.slice(1)}` as keyof typeof perms
    if (!perms[actionKey]) {
      return res.status(403).json({ ok: false, error: `Cannot ${action} ${entity}` })
    }
    next()
  }
}

export function requireAnyPermission(entities: string[], action: 'view' | 'create' | 'edit' | 'delete') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'Authentication required' })
    if (req.user.role === 'server_admin') return next()

    const actionKey = `can${action.charAt(0).toUpperCase() + action.slice(1)}`
    for (const entity of entities) {
      const perms = req.user.rolePermissions?.[entity]
      if (perms && (perms as any)[actionKey]) return next()
    }
    return res.status(403).json({ ok: false, error: `Cannot ${action} resource` })
  }
}
