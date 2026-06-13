import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import speakeasy from 'speakeasy'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { sendEmail, buildSetupLink, buildSetupEmailHtml } from '../email.js'
import { JWT_SECRET, loadMembership, loadMemberships, loadPermissions, type UserMembership } from '../auth.js'

const router = Router()
const SETUP_TOKEN_EXPIRY_DAYS = 7

function buildTokenPayload(user: any, permissions: any) {
  return {
    userId: user.id,
    companyId: user.companyId || null,
    role: user.role,
    name: user.name,
    email: user.email,
    roleId: user.roleId || null,
    roleName: user.roleName || null,
    membershipId: user.membershipId || null,
    memberships: user.memberships || [],
    rolePermissions: permissions,
  }
}

function companyChoicesForServerAdmin(): UserMembership[] {
  return db.prepare(`SELECT id as companyId, name as companyName
    FROM companies WHERE deleted_at IS NULL AND is_active = 1 ORDER BY name ASC`).all().map((c: any) => ({
    id: c.companyId,
    userId: '',
    companyId: c.companyId,
    companyName: c.companyName,
    role: 'server_admin',
    roleId: null,
    roleName: 'Server Admin',
    isActive: true,
  })) as UserMembership[]
}

function userForMembership(user: any, membership: UserMembership | null, memberships: UserMembership[]) {
  return {
    id: user.id,
    companyId: membership?.companyId || null,
    email: user.email,
    name: user.name,
    role: membership?.role || user.role,
    roleId: membership?.roleId || null,
    roleName: membership?.roleName || null,
    membershipId: membership?.id || null,
    memberships,
    isActive: !!user.isActive,
    createdAt: user.createdAt || '',
  }
}

function issueToken(user: any, membership: UserMembership | null, memberships: UserMembership[], extra: Record<string, unknown> = {}) {
  const scopedUser = userForMembership(user, membership, memberships)
  const permissions = scopedUser.role === 'server_admin' ? {} : loadPermissions(scopedUser.roleId)
  const token = jwt.sign({ ...buildTokenPayload(scopedUser, permissions), ...extra }, JWT_SECRET, { expiresIn: '24h' })
  return { token, permissions, user: scopedUser }
}

function maybeRequireMfa(user: any, companyId: string | null, projectId?: string) {
  if (!companyId) return null
  const company = db.prepare('SELECT mfa_enabled FROM companies WHERE id = ?').get(companyId) as any
  if (!company?.mfa_enabled) return null
  return jwt.sign({ type: 'mfa', userId: user.id, companyId, projectId: projectId || null }, JWT_SECRET, { expiresIn: '5m' })
}

/* ── Employee + Company Admin login ── */
router.post('/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password required' })
  }

  const user = db.prepare('SELECT id, company_id as companyId, email, name, role, role_id as roleId, password_hash as passwordHash, is_active as isActive, created_at as createdAt FROM users WHERE email = ?').get(email) as any
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid email or password' })
  if (!user.isActive) return res.status(401).json({ ok: false, error: 'Account is deactivated' })
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ ok: false, error: 'Invalid email or password' })
  if (user.role === 'customer') return res.status(401).json({ ok: false, error: 'Use the customer login portal' })

  if (user.role === 'server_admin') {
    const memberships = companyChoicesForServerAdmin()
    const storedCompanyId = req.body?.companyId as string | undefined
    const membership = storedCompanyId
      ? memberships.find(m => m.companyId === storedCompanyId) || null
      : null
    const data = issueToken(user, membership, memberships)
    return res.json({ ok: true, data })
  }

  const memberships = loadMemberships(user.id)
  if (memberships.length === 0) return res.status(403).json({ ok: false, error: 'No active company memberships' })
  if (memberships.length > 1) {
    const selectionToken = jwt.sign({ type: 'workspace_select', userId: user.id }, JWT_SECRET, { expiresIn: '10m' })
    return res.json({
      ok: true,
      workspaceSelectionRequired: true,
      selectionToken,
      user: { id: user.id, email: user.email, name: user.name },
      memberships,
    })
  }

  const membership = memberships[0]
  const mfaToken = maybeRequireMfa(user, membership.companyId)
  if (mfaToken) return res.json({ ok: true, mfaRequired: true, mfaToken, partialUser: { id: user.id, email: user.email, name: user.name } })
  res.json({ ok: true, data: issueToken(user, membership, memberships) })
})

router.post('/select-company', (req, res) => {
  const { selectionToken, companyId } = req.body
  if (!selectionToken || !companyId) return res.status(400).json({ ok: false, error: 'selectionToken and companyId required' })
  let payload: any
  try { payload = jwt.verify(selectionToken, JWT_SECRET) } catch { return res.status(401).json({ ok: false, error: 'Invalid or expired selection token' }) }
  if (payload.type !== 'workspace_select') return res.status(401).json({ ok: false, error: 'Invalid selection token' })
  const user = db.prepare('SELECT id, email, name, role, is_active as isActive, created_at as createdAt FROM users WHERE id = ?').get(payload.userId) as any
  if (!user || !user.isActive) return res.status(401).json({ ok: false, error: 'User not found' })
  const memberships = loadMemberships(user.id)
  const membership = loadMembership(user.id, companyId)
  if (!membership) return res.status(403).json({ ok: false, error: 'Company membership not found' })
  const mfaToken = maybeRequireMfa(user, membership.companyId)
  if (mfaToken) return res.json({ ok: true, mfaRequired: true, mfaToken, partialUser: { id: user.id, email: user.email, name: user.name } })
  res.json({ ok: true, data: issueToken(user, membership, memberships) })
})

router.post('/switch-company', (req, res) => {
  const { companyId } = req.body
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'No token' })
  let payload: any
  try { payload = jwt.verify(auth.slice(7), JWT_SECRET) } catch { return res.status(401).json({ ok: false, error: 'Invalid token' }) }
  const user = db.prepare('SELECT id, email, name, role, is_active as isActive, created_at as createdAt FROM users WHERE id = ?').get(payload.userId) as any
  if (!user || !user.isActive) return res.status(401).json({ ok: false, error: 'User not found' })
  if (user.role === 'server_admin') {
    const memberships = companyChoicesForServerAdmin()
    if (!companyId) return res.json({ ok: true, data: issueToken(user, null, memberships) })
    const company = db.prepare('SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL AND is_active = 1').get(companyId)
    if (!company) return res.status(404).json({ ok: false, error: 'Company not found' })
    const membership = memberships.find(m => m.companyId === companyId) || null
    return res.json({ ok: true, data: issueToken(user, membership, memberships) })
  }
  if (!companyId) return res.status(400).json({ ok: false, error: 'companyId required' })
  const memberships = loadMemberships(user.id)
  const membership = loadMembership(user.id, companyId)
  if (!membership) return res.status(403).json({ ok: false, error: 'Company membership not found' })
  res.json({ ok: true, data: issueToken(user, membership, memberships) })
})

/* ── MFA verification (TOTP) ── */
router.post('/verify-mfa', (req, res) => {
  const { mfaToken, code } = req.body
  if (!mfaToken || !code) return res.status(400).json({ ok: false, error: 'mfaToken and code required' })

  let payload: any
  try { payload = jwt.verify(mfaToken, JWT_SECRET) } catch { return res.status(401).json({ ok: false, error: 'Invalid or expired MFA token' }) }

  const user = db.prepare('SELECT id, email, name, role, is_active as isActive, created_at as createdAt FROM users WHERE id = ?').get(payload.userId) as any
  if (!user) return res.status(401).json({ ok: false, error: 'User not found' })

  const secret = db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(payload.userId) as any
  if (!secret?.totp_secret) return res.status(400).json({ ok: false, error: 'MFA not configured for this user' })

  const verified = speakeasy.totp.verify({ secret: secret.totp_secret, encoding: 'base32', token: code, window: 1 })
  if (!verified) return res.status(401).json({ ok: false, error: 'Invalid code' })

  if (payload.projectId) {
    const customerUser = db.prepare('SELECT id, company_id as companyId, email, name, role, role_id as roleId, is_active as isActive, created_at as createdAt FROM users WHERE id = ?').get(payload.userId) as any
    const permissions = loadPermissions(customerUser.roleId)
    const token = jwt.sign({ ...buildTokenPayload(customerUser, permissions), projectId: payload.projectId }, JWT_SECRET, { expiresIn: '24h' })
    return res.json({ ok: true, data: { token, permissions, user: { id: customerUser.id, companyId: customerUser.companyId, email: customerUser.email, name: customerUser.name, role: customerUser.role, roleId: customerUser.roleId, isActive: true, createdAt: '' } } })
  }

  const memberships = user.role === 'server_admin' ? companyChoicesForServerAdmin() : loadMemberships(user.id)
  const membership = payload.companyId
    ? (user.role === 'server_admin'
        ? memberships.find(m => m.companyId === payload.companyId) || null
        : loadMembership(user.id, payload.companyId))
    : null
  if (payload.companyId && !membership) return res.status(403).json({ ok: false, error: 'Company membership not found' })
  res.json({ ok: true, data: issueToken(user, membership, memberships) })
})

/* ── Customer login (email + password + access_key) ── */
router.post('/customer/login', (req, res) => {
  const { email, password, accessKey } = req.body
  if (!email || !password || !accessKey) return res.status(400).json({ ok: false, error: 'email, password, and accessKey required' })

  const user = db.prepare('SELECT u.id, u.company_id as companyId, u.email, u.name, u.role, u.role_id as roleId, u.password_hash as passwordHash, u.is_active as isActive FROM users u WHERE u.email = ? AND u.role = ?').get(email, 'customer') as any
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid email or password' })
  if (!user.isActive) return res.status(401).json({ ok: false, error: 'Account is deactivated' })
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ ok: false, error: 'Invalid email or password' })

  // Verify access_key matches a project linked to this customer's contact
  const contact = db.prepare('SELECT customer_id FROM contacts WHERE email = ? AND role = ?').get(email, 'owner') as any
  if (!contact) return res.status(401).json({ ok: false, error: 'No customer contact found' })

  const project = db.prepare('SELECT id, access_key FROM projects WHERE customer_id = ? AND access_key = ?').get(contact.customer_id, accessKey) as any
  if (!project) return res.status(401).json({ ok: false, error: 'Invalid access key' })

  const permissions = loadPermissions(user.roleId)

  // Check MFA
  const company = db.prepare('SELECT mfa_enabled FROM companies WHERE id = ?').get(user.companyId) as any
  if (company?.mfa_enabled) {
    const mfaToken = jwt.sign({ type: 'mfa', userId: user.id, companyId: user.companyId, projectId: project.id }, JWT_SECRET, { expiresIn: '5m' })
    return res.json({ ok: true, mfaRequired: true, mfaToken, partialUser: { id: user.id, email: user.email, name: user.name } })
  }

  const token = jwt.sign({ ...buildTokenPayload(user, permissions), projectId: project.id }, JWT_SECRET, { expiresIn: '24h' })
  res.json({
    ok: true, data: {
      token, permissions,
      user: { id: user.id, companyId: user.companyId, email: user.email, name: user.name, role: user.role, roleId: user.roleId, isActive: true, createdAt: '' },
    },
  })
})

/* ── Customer setup (one-time token → set password) ── */
router.post('/customer/setup', (req, res) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ ok: false, error: 'token and password required' })
  if (password.length < 6) return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' })

  const st = db.prepare('SELECT * FROM customer_setup_tokens WHERE token = ? AND consumed_at IS NULL AND expires_at > datetime("now")').get(token) as any
  if (!st) return res.status(400).json({ ok: false, error: 'Invalid or expired setup token' })

  const hash = bcrypt.hashSync(password, 12)
  const userId = uuid()
  const companyId = (db.prepare('SELECT company_id FROM projects WHERE id = ?').get(st.project_id) as any)?.company_id
  if (!companyId) return res.status(400).json({ ok: false, error: 'Project not found' })

  // Find the customer role for this company
  const customerRole = db.prepare('SELECT id FROM roles WHERE company_id = ? AND name = ?').get(companyId, 'Customer') as any

  db.transaction(() => {
    db.prepare('INSERT INTO users (id, company_id, email, name, role, password_hash, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      userId, companyId, st.email, st.email.split('@')[0], 'customer', hash, customerRole?.id || null,
    )
    db.prepare(`INSERT OR IGNORE INTO user_company_memberships (id, user_id, company_id, role, role_id, is_active)
      VALUES (?, ?, ?, ?, ?, 1)`).run(uuid(), userId, companyId, 'customer', customerRole?.id || null)
    db.prepare('UPDATE customer_setup_tokens SET consumed_at = datetime("now") WHERE id = ?').run(st.id)
  })()

  res.json({ ok: true, data: { message: 'Account created. You can now log in.' } })
})

/* ── TOTP secret management ── */
router.post('/totp/generate', (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ ok: false, error: 'userId required' })

  const secret = speakeasy.generateSecret({ length: 20, name: 'StrikeScope' })
  db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret.base32, userId)
  res.json({ ok: true, data: { secret: secret.base32, otpauth_url: secret.otpauth_url } })
})

router.post('/totp/verify-setup', (req, res) => {
  const { userId, code } = req.body
  if (!userId || !code) return res.status(400).json({ ok: false, error: 'userId and code required' })

  const secret = db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(userId) as any
  if (!secret?.totp_secret) return res.status(400).json({ ok: false, error: 'No TOTP secret configured' })

  const verified = speakeasy.totp.verify({ secret: secret.totp_secret, encoding: 'base32', token: code, window: 1 })
  if (!verified) return res.status(401).json({ ok: false, error: 'Invalid code' })

  db.prepare('UPDATE users SET totp_verified = 1 WHERE id = ?').run(userId)
  res.json({ ok: true })
})

/* ── Get /me ── */
router.get('/me', (req, res) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'No token' })
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any
    const user = db.prepare('SELECT id, company_id as companyId, email, name, role, role_id as roleId, is_active as isActive, created_at as createdAt FROM users WHERE id = ?').get(payload.userId) as any
    if (!user) return res.status(401).json({ ok: false, error: 'User not found' })
    if (user.role === 'customer') {
      const permissions = loadPermissions(user.roleId)
      return res.json({ ok: true, data: { ...user, permissions, memberships: [], projectId: payload.projectId || null } })
    }
    const memberships = user.role === 'server_admin' ? companyChoicesForServerAdmin() : loadMemberships(user.id)
    let membership = payload.companyId
      ? (user.role === 'server_admin'
          ? memberships.find(m => m.companyId === payload.companyId) || null
          : loadMembership(user.id, payload.companyId))
      : null
    if (payload.companyId && !membership) return res.status(403).json({ ok: false, error: 'Company membership not found' })

    let refreshedSession: ReturnType<typeof issueToken> | null = null
    if (!membership && memberships.length > 0) {
      const preferred = (req.headers['x-active-company'] as string | undefined)?.trim() || null
      const targetId = user.role === 'server_admin'
        ? (payload.companyId
          ? (preferred && memberships.some(m => m.companyId === preferred) ? preferred : payload.companyId)
          : null)
        : (preferred && memberships.some(m => m.companyId === preferred) ? preferred : memberships[0].companyId)
      if (targetId) {
        membership = user.role === 'server_admin'
          ? memberships.find(m => m.companyId === targetId) || null
          : loadMembership(user.id, targetId)
        if (membership) refreshedSession = issueToken(user, membership, memberships)
      }
    }

    if (refreshedSession) {
      return res.json({
        ok: true,
        data: { ...refreshedSession.user, permissions: refreshedSession.permissions },
        refreshedSession,
      })
    }

    const scopedUser = userForMembership(user, membership, memberships)
    const permissions = scopedUser.role === 'server_admin' ? {} : loadPermissions(scopedUser.roleId)
    res.json({ ok: true, data: { ...scopedUser, permissions } })
  } catch {
    res.status(401).json({ ok: false, error: 'Invalid token' })
  }
})

export { JWT_SECRET }
export default router
