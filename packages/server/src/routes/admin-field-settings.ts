import { Router } from 'express'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { requireActiveCompany } from './helpers.js'
import {
  VALID_FIELD_ENTITIES, getFieldSettings, getEnabledCustomDefinitions, upsertFieldSettings, isLockedField,
} from '../field-settings.js'

const router = Router()

router.get('/:entity', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const entity = String(req.params.entity)
  if (!VALID_FIELD_ENTITIES.includes(entity as any)) return res.status(400).json({ ok: false, error: 'Invalid entity' })
  const isAdmin = req.user?.role === 'server_admin' || req.user?.role === 'company_admin'
  const builtins = getFieldSettings(db, companyId, entity)
  const custom = getEnabledCustomDefinitions(db, companyId, entity, isAdmin)
  res.json({ ok: true, data: { builtins, custom } })
})

router.put('/:entity', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const entity = String(req.params.entity)
  if (!VALID_FIELD_ENTITIES.includes(entity as any)) return res.status(400).json({ ok: false, error: 'Invalid entity' })
  const { settings } = req.body
  if (!Array.isArray(settings)) return res.status(400).json({ ok: false, error: 'settings array required' })
  for (const s of settings) {
    if (isLockedField(entity, s.fieldKey) && s.isEnabled === false) {
      return res.status(400).json({ ok: false, error: `Field ${s.fieldKey} cannot be disabled` })
    }
  }
  upsertFieldSettings(db, companyId, entity, settings)
  res.json({ ok: true, data: { builtins: getFieldSettings(db, companyId, entity) } })
})

export default router
