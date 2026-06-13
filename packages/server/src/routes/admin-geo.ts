import { Router } from 'express'
import { requireRole } from '../auth.js'
import { requireActiveCompany } from './helpers.js'
import { validateBody, validateQuery, geoSchemas } from '../validation.js'
import db from '../db.js'
import { emitJurisdictionPending } from '../admin-ws.js'
import {
  lookupZip,
  listCounties,
  listCities,
  geoCascade,
  canSubmitJurisdiction,
  canReviewJurisdiction,
  createJurisdictionRequest,
  listJurisdictionRequests,
  countPendingJurisdictionRequests,
  reviewJurisdictionRequest,
} from '../plugins/geo-reference/index.js'

const router = Router()
const GEO_CACHE = 'private, max-age=3600'

router.get('/cascade', validateQuery(geoSchemas.cascadeQuery), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  res.set('Cache-Control', GEO_CACHE)
  const { state, county, zip } = req.query as { state?: string; county?: string; zip?: string }
  res.json({ ok: true, data: geoCascade(db, companyId, { state, county, zip }) })
})

router.get('/zip/:zip', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  res.set('Cache-Control', GEO_CACHE)
  const results = lookupZip(db, req.params.zip)
  res.json({ ok: true, data: results })
})

router.get('/counties', validateQuery(geoSchemas.stateQuery), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  res.set('Cache-Control', GEO_CACHE)
  const { state } = req.query as { state: string }
  res.json({ ok: true, data: listCounties(db, companyId, state) })
})

router.get('/cities', validateQuery(geoSchemas.citiesQuery), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  res.set('Cache-Control', GEO_CACHE)
  const { state, county } = req.query as { state: string; county: string }
  res.json({ ok: true, data: listCities(db, companyId, state, county) })
})

router.post('/jurisdiction-requests', validateBody(geoSchemas.jurisdictionCreate), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!canSubmitJurisdiction(req.user!.role)) {
    return res.status(403).json({ ok: false, error: 'Insufficient permissions to submit jurisdiction requests' })
  }
  const { state, county, city, zip, reason } = req.body
  const id = createJurisdictionRequest(db, {
    companyId,
    userId: req.user!.userId,
    state,
    county,
    city,
    zip,
    reason,
  })
  emitJurisdictionPending(companyId, countPendingJurisdictionRequests(db, companyId))
  res.status(201).json({ ok: true, data: { id } })
})

router.get('/jurisdiction-requests', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const role = req.user!.role
  const canList = canReviewJurisdiction(role) || role === 'project_admin'
    || (req.user as any).rolePermissions?.settings?.canView
  if (!canList && !canSubmitJurisdiction(role)) {
    return res.status(403).json({ ok: false, error: 'Insufficient permissions' })
  }
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const rows = listJurisdictionRequests(db, companyId, status)
  res.json({ ok: true, data: rows })
})

router.patch('/jurisdiction-requests/:id', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { status, reviewNote } = req.body
  if (!['approved', 'denied'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'status must be approved or denied' })
  }
  try {
    const result = reviewJurisdictionRequest(db, {
      id: String(req.params.id),
      companyId,
      reviewerId: req.user!.userId,
      status,
      reviewNote,
    })
    emitJurisdictionPending(companyId, countPendingJurisdictionRequests(db, companyId))
    res.json({ ok: true, data: result })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

export default router
