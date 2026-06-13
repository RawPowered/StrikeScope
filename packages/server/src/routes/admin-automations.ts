import { Router, type Request, type Response, type NextFunction } from 'express'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { requireActiveCompany } from './helpers.js'
import {
  checkActivepiecesHealth,
  cloneTemplateToCompany,
  createEmbedToken,
  ensureCompanyProject,
  ensurePlatformProject,
  ensureServiceKey,
  getAutomationsConfig,
  getServiceKeyMeta,
  isEmbedConfigured,
  listPlatformTemplates,
  listWebhooks,
  registerWebhook,
  resolveCompanyFromServiceKey,
  rotateServiceKey,
  unregisterWebhook,
  updateLeadStage,
  assignLeadOwner,
  createLeadNote,
} from '../plugins/automations/index.js'
import type { AutomationTriggerType } from '../plugins/automations/types.js'

const router = Router()

const TRIGGER_TYPES: AutomationTriggerType[] = [
  'lead_created',
  'lead_stage_changed',
  'customer_created',
  'project_status_changed',
]

function parseBearerToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim()
}

function automationServiceAuth(req: Request, res: Response, next: NextFunction) {
  const token = parseBearerToken(req)
  if (!token) return res.status(401).json({ ok: false, error: 'Service key required' })
  const companyId = resolveCompanyFromServiceKey(db, token)
  if (!companyId) return res.status(401).json({ ok: false, error: 'Invalid service key' })
  ;(req as Request & { automationCompanyId?: string }).automationCompanyId = companyId
  next()
}

function getAutomationCompanyId(req: Request): string | null {
  return (req as Request & { automationCompanyId?: string }).automationCompanyId || null
}

router.get('/status', requireRole('server_admin', 'company_admin'), async (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return

  ensureCompanyProject(db, companyId)
  const health = await checkActivepiecesHealth()
  const cfg = getAutomationsConfig()
  const keyMeta = getServiceKeyMeta(db, companyId)

  res.json({
    ok: true,
    data: {
      activepiecesUrl: cfg.activepiecesUrl,
      reachable: health.reachable,
      healthError: health.error,
      embedConfigured: isEmbedConfigured(),
      serviceKeyPrefix: keyMeta?.keyPrefix || null,
      externalProjectId: `company:${companyId}`,
      triggerTypes: TRIGGER_TYPES,
    },
  })
})

router.post('/embed-token', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId || !req.user) return

  const usePlatformTemplates = Boolean(req.body?.usePlatformTemplates) && req.user.role === 'server_admin'
  if (usePlatformTemplates) ensurePlatformProject(db)
  else ensureCompanyProject(db, companyId)

  const token = createEmbedToken(db, req.user, { usePlatformTemplates, companyId })
  if (!token) {
    return res.status(503).json({
      ok: false,
      error: 'Embed not configured. Set ACTIVEPIECES_SIGNING_KEY and ACTIVEPIECES_SIGNING_KEY_ID.',
    })
  }

  res.json({ ok: true, data: token })
})

router.get('/service-key', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const meta = getServiceKeyMeta(db, companyId)
  res.json({
    ok: true,
    data: {
      hasKey: Boolean(meta),
      prefix: meta?.keyPrefix || null,
      createdAt: meta?.createdAt || null,
      rotatedAt: meta?.rotatedAt || null,
    },
  })
})

router.post('/service-key/rotate', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  ensureCompanyProject(db, companyId)
  const result = rotateServiceKey(db, companyId)
  res.json({
    ok: true,
    data: {
      key: result.key,
      prefix: result.prefix,
      message: 'Store this key now — it will not be shown again.',
    },
  })
})

router.post('/service-key/ensure', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  ensureCompanyProject(db, companyId)
  const result = ensureServiceKey(db, companyId)
  if (result.created) {
    return res.json({ ok: true, data: { key: result.key, prefix: result.prefix, created: true } })
  }
  res.json({ ok: true, data: { prefix: result.prefix, created: false } })
})

router.get('/webhooks', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  res.json({ ok: true, data: listWebhooks(db, companyId) })
})

router.post('/webhooks/register', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return

  const { triggerType, webhookUrl, flowId, label } = req.body || {}
  if (!triggerType || !webhookUrl) {
    return res.status(400).json({ ok: false, error: 'triggerType and webhookUrl are required' })
  }
  if (!TRIGGER_TYPES.includes(triggerType)) {
    return res.status(400).json({ ok: false, error: `Invalid triggerType. Must be one of: ${TRIGGER_TYPES.join(', ')}` })
  }

  const id = registerWebhook(db, companyId, triggerType, String(webhookUrl).trim(), { flowId, label })
  res.json({ ok: true, data: { id } })
})

router.post('/webhooks/register-service', automationServiceAuth, (req, res) => {
  const companyId = getAutomationCompanyId(req)
  if (!companyId) return res.status(401).json({ ok: false, error: 'Unauthorized' })

  const { triggerType, webhookUrl, flowId, label } = req.body || {}
  if (!triggerType || !webhookUrl) {
    return res.status(400).json({ ok: false, error: 'triggerType and webhookUrl are required' })
  }
  if (!TRIGGER_TYPES.includes(triggerType)) {
    return res.status(400).json({ ok: false, error: `Invalid triggerType` })
  }

  const id = registerWebhook(db, companyId, triggerType, String(webhookUrl).trim(), { flowId, label })
  res.json({ ok: true, data: { id } })
})

router.delete('/webhooks/:id', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const ok = unregisterWebhook(db, companyId, req.params.id as string)
  if (!ok) return res.status(404).json({ ok: false, error: 'Not found' })
  res.json({ ok: true })
})

router.get('/templates', requireRole('server_admin'), async (_req, res) => {
  ensurePlatformProject(db)
  const result = await listPlatformTemplates()
  res.json({ ok: true, data: result })
})

router.post('/templates/:id/clone-to-company', requireRole('server_admin'), async (req, res) => {
  const { companyId, activepiecesProjectId } = req.body || {}
  if (!companyId) return res.status(400).json({ ok: false, error: 'companyId is required' })

  ensureCompanyProject(db, companyId as string)
  const result = await cloneTemplateToCompany(req.params.id as string, activepiecesProjectId)
  if (!result.ok) return res.status(400).json({ ok: false, error: result.error })
  res.json({ ok: true, data: { flowId: result.flowId } })
})

router.post('/service/leads/:id/stage', automationServiceAuth, (req, res) => {
  const companyId = getAutomationCompanyId(req)
  if (!companyId) return
  const { stageId } = req.body || {}
  if (!stageId) return res.status(400).json({ ok: false, error: 'stageId is required' })
  try {
    const data = updateLeadStage(db, companyId, req.params.id as string, stageId)
    res.json({ ok: true, data })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

router.post('/service/leads/:id/assign', automationServiceAuth, (req, res) => {
  const companyId = getAutomationCompanyId(req)
  if (!companyId) return
  const { ownerId } = req.body || {}
  if (!ownerId) return res.status(400).json({ ok: false, error: 'ownerId is required' })
  try {
    const data = assignLeadOwner(db, companyId, req.params.id as string, ownerId)
    res.json({ ok: true, data })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

router.post('/service/leads/:id/note', automationServiceAuth, (req, res) => {
  const companyId = getAutomationCompanyId(req)
  if (!companyId) return
  const { note } = req.body || {}
  try {
    const data = createLeadNote(db, companyId, req.params.id as string, note)
    res.json({ ok: true, data })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

router.post('/service/http-request', automationServiceAuth, async (req, res) => {
  const { method, url, headers, body } = req.body || {}
  if (!url) return res.status(400).json({ ok: false, error: 'url is required' })
  const m = (method || 'GET').toUpperCase()
  try {
    const response = await fetch(url, {
      method: m,
      headers: headers || {},
      body: m === 'GET' || m === 'HEAD' ? undefined : JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(30000),
    })
    const text = await response.text()
    res.json({
      ok: true,
      data: {
        status: response.status,
        body: text,
      },
    })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

export default router
