import { v4 as uuid } from 'uuid'
import type Database from 'better-sqlite3'
import { assertWithinGeofence } from '../geo.js'
import { randomBytes } from 'crypto'

const TOKEN_TTL_MS = 5 * 60 * 1000
const QR_TTL_MS = 15 * 60 * 1000

function makeToken(prefix: string): string {
  return `${prefix}-${randomBytes(12).toString('hex')}`
}

export function getProjectGeofence(db: Database.Database, projectId: string) {
  const p = db.prepare(`SELECT p.worksite_lat as worksiteLat, p.worksite_lng as worksiteLng,
    p.geofence_radius_m as geofenceRadiusM, p.company_id as companyId,
    tt.geofence_radius_m as templateRadiusM
    FROM projects p
    LEFT JOIN project_types pt ON pt.id=p.project_type_id
    LEFT JOIN task_templates tt ON tt.project_type_id=pt.id AND tt.is_default=1 AND tt.is_active=1
    WHERE p.id=?`).get(projectId) as any
  if (!p) return null
  const radiusM = p.geofenceRadiusM ?? p.templateRadiusM ?? 150
  return { ...p, radiusM }
}

export function getActiveSession(db: Database.Database, userId: string) {
  return db.prepare(`SELECT id, company_id as companyId, project_id as projectId, user_id as userId,
    started_at as startedAt, anchor_lat as anchorLat, anchor_lng as anchorLng,
    current_action_token as currentActionToken, token_issued_at as tokenIssuedAt, is_active as isActive
    FROM job_field_sessions WHERE user_id=? AND is_active=1 ORDER BY started_at DESC LIMIT 1`).get(userId) as any
}

export function startFieldSession(
  db: Database.Database,
  opts: { companyId: string; projectId: string; userId: string; lat: number; lng: number },
) {
  const geo = getProjectGeofence(db, opts.projectId)
  if (!geo?.worksiteLat || !geo?.worksiteLng) {
    throw new Error('Project worksite coordinates not configured')
  }
  const check = assertWithinGeofence(opts.lat, opts.lng, geo.worksiteLat, geo.worksiteLng, geo.radiusM)
  if (!check.ok) throw new Error(`Outside worksite geofence (${Math.round(check.distanceM)}m away)`)

  const existing = getActiveSession(db, opts.userId)
  if (existing) throw new Error('Active field session already exists')

  const id = uuid()
  const token = makeToken('FS')
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO job_field_sessions (id, company_id, project_id, user_id, started_at, anchor_lat, anchor_lng, current_action_token, token_issued_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
    .run(id, opts.companyId, opts.projectId, opts.userId, now, opts.lat, opts.lng, token, now)

  return { sessionId: id, actionToken: token, projectId: opts.projectId }
}

export function endFieldSession(db: Database.Database, userId: string) {
  const session = getActiveSession(db, userId)
  if (!session) return null
  const now = new Date().toISOString()
  db.prepare('UPDATE job_field_sessions SET is_active=0, ended_at=?, current_action_token=NULL WHERE id=?').run(now, session.id)
  return session
}

export function validateSessionAction(
  db: Database.Database,
  opts: { userId: string; projectId: string; actionToken: string; lat: number; lng: number; grantToken?: string },
): { sessionId: string; nextToken: string } {
  if (opts.grantToken) {
    const grant = db.prepare(`SELECT id, project_id as projectId, user_id as userId, action_type as actionType,
      expires_at as expiresAt, consumed_at as consumedAt
      FROM field_override_grants WHERE grant_token=? AND user_id=?`).get(opts.grantToken, opts.userId) as any
    if (!grant || grant.consumedAt) throw new Error('Invalid or used override grant')
    if (new Date(grant.expiresAt).getTime() < Date.now()) throw new Error('Override grant expired')
    db.prepare('UPDATE field_override_grants SET consumed_at=? WHERE id=?').run(new Date().toISOString(), grant.id)
    return { sessionId: 'override', nextToken: makeToken('OV') }
  }

  const session = getActiveSession(db, opts.userId)
  if (!session || session.projectId !== opts.projectId) throw new Error('No active field session for this project')
  if (session.currentActionToken !== opts.actionToken) throw new Error('Invalid or expired action token')
  if (session.tokenIssuedAt) {
    const age = Date.now() - new Date(session.tokenIssuedAt).getTime()
    if (age > TOKEN_TTL_MS) throw new Error('Action token expired — return to worksite')
  }

  const geo = getProjectGeofence(db, opts.projectId)
  if (!geo?.worksiteLat || !geo?.worksiteLng) throw new Error('Project geofence not configured')
  const check = assertWithinGeofence(opts.lat, opts.lng, geo.worksiteLat, geo.worksiteLng, geo.radiusM)
  if (!check.ok) throw new Error(`Outside worksite geofence (${Math.round(check.distanceM)}m away)`)

  const nextToken = makeToken('FS')
  const now = new Date().toISOString()
  db.prepare('UPDATE job_field_sessions SET current_action_token=?, token_issued_at=? WHERE id=?').run(nextToken, now, session.id)
  return { sessionId: session.id, nextToken }
}

export function issueQrToken(db: Database.Database, opts: { companyId: string; projectId: string; sessionId: string; foremanUserId: string }) {
  const token = makeToken('QR')
  const id = uuid()
  const expiresAt = new Date(Date.now() + QR_TTL_MS).toISOString()
  db.prepare(`INSERT INTO job_session_qr_tokens (id, company_id, project_id, session_id, foreman_user_id, token, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, opts.companyId, opts.projectId, opts.sessionId, opts.foremanUserId, token, expiresAt)
  return { token, expiresAt }
}

export function consumeQrToken(
  db: Database.Database,
  opts: { token: string; userId: string; lat: number; lng: number },
) {
  const row = db.prepare(`SELECT id, company_id as companyId, project_id as projectId, session_id as sessionId,
    expires_at as expiresAt, consumed_at as consumedAt FROM job_session_qr_tokens WHERE token=?`).get(opts.token) as any
  if (!row || row.consumedAt) throw new Error('QR token invalid or already used')
  if (new Date(row.expiresAt).getTime() < Date.now()) throw new Error('QR token expired')

  const geo = getProjectGeofence(db, row.projectId)
  if (!geo?.worksiteLat || !geo?.worksiteLng) throw new Error('Project geofence not configured')
  const check = assertWithinGeofence(opts.lat, opts.lng, geo.worksiteLat, geo.worksiteLng, geo.radiusM)
  if (!check.ok) throw new Error(`Outside worksite geofence (${Math.round(check.distanceM)}m away)`)

  const now = new Date().toISOString()
  db.prepare('UPDATE job_session_qr_tokens SET consumed_at=?, consumed_by_user_id=? WHERE id=?').run(now, opts.userId, row.id)

  const session = db.prepare('SELECT id FROM job_field_sessions WHERE id=? AND is_active=1').get(row.sessionId) as any
  if (!session) throw new Error('Foreman session no longer active')

  const actionToken = makeToken('FS')
  const crewSessionId = uuid()
  db.prepare(`INSERT INTO job_field_sessions (id, company_id, project_id, user_id, started_at, anchor_lat, anchor_lng, current_action_token, token_issued_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
    .run(crewSessionId, row.companyId, row.projectId, opts.userId, now, opts.lat, opts.lng, actionToken, now)

  return { sessionId: crewSessionId, actionToken, projectId: row.projectId, companyId: row.companyId }
}
