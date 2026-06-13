import type { Request } from 'express'
import db from './db.js'

export const DEFAULT_TEST_COMPANY_ID = 'default'

export function isActiveCompanyId(companyId: string): boolean {
  return !!db.prepare('SELECT id FROM companies WHERE id=? AND deleted_at IS NULL AND is_active=1').get(companyId)
}

/** Apply X-Active-Company when JWT has no (or stale) workspace context */
export function applyActiveCompanyHeader(req: Request) {
  const user = req.user
  if (!user) return

  const header = (req.headers['x-active-company'] as string | undefined)?.trim()
  if (!header || !isActiveCompanyId(header)) return

  if (user.role === 'server_admin') {
    user.companyId = header
    return
  }

  const member = db.prepare(
    'SELECT 1 FROM user_company_memberships WHERE user_id=? AND company_id=? AND is_active=1',
  ).get(user.userId, header)
  if (member) user.companyId = header
}
