import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requirePermission } from '../auth.js'
import { requireActiveCompany } from './helpers.js'
import { findDuplicates, logDuplicateOverride } from '../plugins/duplicate-detector/index.js'

const router = Router()

router.post('/check', requirePermission('customers', 'view'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { entityType, payload, threshold } = req.body
  if (!entityType || !payload) return res.status(400).json({ ok: false, error: 'entityType and payload required' })
  const matches = findDuplicates(db, companyId, entityType, payload, threshold)
  res.json({ ok: true, data: matches })
})

router.post('/override-log', requirePermission('customers', 'create'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { entityType, payload, matches, overrideReason } = req.body
  if (!overrideReason?.trim()) return res.status(400).json({ ok: false, error: 'overrideReason required' })
  logDuplicateOverride(db, companyId, entityType, payload, matches || [], overrideReason.trim(), req.user?.userId)
  res.json({ ok: true, data: { id: uuid() } })
})

export default router

export function requireNoDuplicateOrOverride(
  companyId: string, entityType: string, payload: Record<string, any>, overrideReason: string | undefined, userId: string | undefined,
): { blocked: boolean; matches?: ReturnType<typeof findDuplicates>; error?: string } {
  const matches = findDuplicates(db, companyId, entityType, payload)
  if (!matches.length) return { blocked: false }
  if (!overrideReason?.trim()) return { blocked: true, matches, error: 'DUPLICATE_CANDIDATES' }
  logDuplicateOverride(db, companyId, entityType, payload, matches, overrideReason.trim(), userId)
  return { blocked: false }
}
