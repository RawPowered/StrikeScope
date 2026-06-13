import jwt from 'jsonwebtoken'
import type { AuthUser } from '../../auth.js'
import { getAutomationsConfig, isEmbedConfigured } from './config.js'
import { resolveExternalProjectId } from './project-map.js'
import type Database from 'better-sqlite3'

export interface EmbedTokenResult {
  token: string
  externalProjectId: string
  instanceUrl: string
  expiresInSec: number
}

export function createEmbedToken(
  db: Database.Database,
  user: AuthUser,
  opts: { usePlatformTemplates?: boolean; companyId?: string | null } = {},
): EmbedTokenResult | null {
  if (!isEmbedConfigured()) return null

  const cfg = getAutomationsConfig()
  const companyId = opts.usePlatformTemplates ? null : (opts.companyId ?? user.companyId)
  const externalProjectId = resolveExternalProjectId(db, companyId, Boolean(opts.usePlatformTemplates))

  const isServerAdmin = user.role === 'server_admin'
  const role = isServerAdmin && opts.usePlatformTemplates ? 'ADMIN' : (isServerAdmin ? 'ADMIN' : 'EDITOR')

  const nameParts = (user.name || 'User').trim().split(/\s+/)
  const firstName = nameParts[0] || 'User'
  const lastName = nameParts.slice(1).join(' ') || 'User'

  const expiresInSec = 3600
  const exp = Math.floor(Date.now() / 1000) + expiresInSec

  const payload = {
    version: 'v3',
    externalUserId: user.userId,
    externalProjectId,
    firstName,
    lastName,
    role,
    piecesFilterType: 'NONE',
    exp,
    tasks: 50000,
    aiCredits: 250,
  }

  const token = jwt.sign(payload, cfg.signingKey!, {
    algorithm: 'RS256',
    keyid: cfg.signingKeyId!,
  })

  return {
    token,
    externalProjectId,
    instanceUrl: cfg.activepiecesUrl,
    expiresInSec,
  }
}
