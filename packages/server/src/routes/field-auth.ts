import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db.js'
import { JWT_SECRET, loadMembership, loadMemberships, loadPermissions } from '../auth.js'

const router = Router()
const FIELD_ROLES = new Set(['foreman', 'crewman', 'technician', 'project_manager', 'project_admin', 'company_admin'])

router.post('/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password required' })
  const user = db.prepare(`SELECT id, company_id as companyId, email, name, role, role_id as roleId,
    password_hash as passwordHash, is_active as isActive FROM users WHERE email=?`).get(email) as any
  if (!user || !user.isActive) return res.status(401).json({ ok: false, error: 'Invalid credentials' })
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ ok: false, error: 'Invalid credentials' })
  if (!FIELD_ROLES.has(user.role)) return res.status(403).json({ ok: false, error: 'Not a field role account' })

  const memberships = loadMemberships(user.id)
  const membership = memberships[0] || (user.companyId ? loadMembership(user.id, user.companyId) : null)
  if (!membership) return res.status(403).json({ ok: false, error: 'No company membership' })

  const scoped = {
    id: user.id,
    companyId: membership.companyId,
    email: user.email,
    name: user.name,
    role: membership.role,
    roleId: membership.roleId,
    membershipId: membership.id,
    memberships,
  }
  const permissions = loadPermissions(scoped.roleId)
  const token = jwt.sign({
    userId: user.id,
    companyId: scoped.companyId,
    role: scoped.role,
    name: user.name,
    email: user.email,
    roleId: scoped.roleId,
    membershipId: scoped.membershipId,
    memberships,
    rolePermissions: permissions,
  }, JWT_SECRET, { expiresIn: '12h' })
  res.json({ ok: true, data: { token, user: scoped, permissions } })
})

export default router
