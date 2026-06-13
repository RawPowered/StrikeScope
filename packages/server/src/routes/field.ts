import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireActiveCompany } from './helpers.js'
import { listActiveJobs } from '../plugins/active-jobs/index.js'
import { getActiveSession, startFieldSession, endFieldSession, validateSessionAction, issueQrToken, consumeQrToken } from '../plugins/field-session/index.js'
import { clockIn, clockOut, updateLogStatus, getActiveLog, reconcileDayBoundariesForUser } from '../plugins/time-tracking/index.js'
import { touchProjectFieldActivity } from '../plugins/task-linkage.js'

const router = Router()
const FIELD_ROLES = new Set(['foreman', 'crewman', 'technician', 'project_manager', 'project_admin', 'company_admin'])

function requireFieldRole(req: any, res: any): boolean {
  if (!req.user) { res.status(401).json({ ok: false, error: 'Authentication required' }); return false }
  if (!FIELD_ROLES.has(req.user.role)) { res.status(403).json({ ok: false, error: 'Field access only' }); return false }
  return true
}

/* ── Assigned active jobs ── */
router.get('/projects', (req, res) => {
  if (!requireFieldRole(req, res)) return
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const jobs = listActiveJobs(db, companyId, req.user!.userId, req.user!.role)
  res.json({ ok: true, data: jobs })
})

/* ── Project checklist ── */
router.get('/projects/:id/checklist', (req, res) => {
  if (!requireFieldRole(req, res)) return
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const project = db.prepare('SELECT id FROM projects WHERE id=? AND company_id=?').get(req.params.id, companyId)
  if (!project) return res.status(404).json({ ok: false, error: 'Not found' })
  const items = db.prepare(`SELECT id, project_id as projectId, template_item_id as templateItemId,
    label, sort_order as sortOrder, title_en as titleEn, title_es as titleEs,
    desc_en as descEn, desc_es as descEs, required_count as requiredCount,
    example_image as exampleImage, status, actual_started_at as actualStartedAt,
    actual_completed_at as actualCompletedAt, scheduled_at as scheduledAt
    FROM project_task_items WHERE project_id=? ORDER BY sort_order ASC`).all(req.params.id)
  res.json({ ok: true, data: items })
})

/* ── Read-only calendar (no geo required) ── */
router.get('/projects/:id/calendar', (req, res) => {
  if (!requireFieldRole(req, res)) return
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const project = db.prepare(`SELECT id, name, scheduled_install_at as scheduledInstallAt,
    sprint_started_at as sprintStartedAt, sprint_completed_at as sprintCompletedAt
    FROM projects WHERE id=? AND company_id=?`).get(req.params.id, companyId) as any
  if (!project) return res.status(404).json({ ok: false, error: 'Not found' })
  const items = db.prepare(`SELECT id, label, scheduled_at as scheduledAt, status,
    actual_started_at as actualStartedAt, actual_completed_at as actualCompletedAt
    FROM project_task_items WHERE project_id=? ORDER BY sort_order ASC`).all(req.params.id)
  res.json({ ok: true, data: { project, items } })
})

/* ── Session state ── */
router.get('/sessions/active', (req, res) => {
  if (!requireFieldRole(req, res)) return
  reconcileDayBoundariesForUser(db, req.user!.userId)
  const session = getActiveSession(db, req.user!.userId)
  const timeLog = getActiveLog(db, req.user!.userId)
  let projectName: string | null = null
  const projectId = session?.projectId || timeLog?.projectId
  if (projectId) {
    const p = db.prepare('SELECT name FROM projects WHERE id=?').get(projectId) as { name?: string } | undefined
    projectName = p?.name ?? null
  }
  res.json({
    ok: true,
    data: {
      session: session ? { ...session, projectName } : null,
      timeLog: timeLog ? { ...timeLog, projectName } : null,
    },
  })
})

/* ── Start session + clock in ── */
router.post('/sessions/start', (req, res) => {
  if (!requireFieldRole(req, res)) return
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { projectId, lat, lng } = req.body
  if (!projectId || lat == null || lng == null) return res.status(400).json({ ok: false, error: 'projectId, lat, lng required' })
  const project = db.prepare('SELECT id FROM projects WHERE id=? AND company_id=?').get(projectId, companyId)
  if (!project) return res.status(404).json({ ok: false, error: 'Project not found' })
  try {
    const started = startFieldSession(db, { companyId, projectId, userId: req.user!.userId, lat, lng })
    const log = clockIn(db, { companyId, projectId, userId: req.user!.userId, lat, lng })
    const session = getActiveSession(db, req.user!.userId)
    res.json({ ok: true, data: { session, timeLog: log, actionToken: started.actionToken } })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

router.post('/sessions/end', (req, res) => {
  if (!requireFieldRole(req, res)) return
  const { lat, lng } = req.body
  if (lat == null || lng == null) return res.status(400).json({ ok: false, error: 'lat, lng required' })
  try {
    const session = endFieldSession(db, req.user!.userId)
    const log = clockOut(db, req.user!.userId, lat, lng)
    if (session?.projectId) {
      const progress = db.prepare(`SELECT COUNT(*) as total,
        (SELECT COUNT(*) FROM project_task_items pti WHERE pti.project_id=? AND pti.status='completed') as done
        FROM project_task_items WHERE project_id=?`).get(session.projectId, session.projectId) as any
      if (progress?.total && progress.done >= progress.total) {
        const now = new Date().toISOString()
        db.prepare(`UPDATE projects SET sprint_completed_at=?, status='completed', updated_at=? WHERE id=?`).run(now, now, session.projectId)
      }
    }
    res.json({ ok: true, data: { session, timeLog: log } })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

router.post('/sessions/action', (req, res) => {
  if (!requireFieldRole(req, res)) return
  const { projectId, actionToken, lat, lng, grantToken } = req.body
  if (!projectId || !actionToken || lat == null || lng == null) {
    return res.status(400).json({ ok: false, error: 'projectId, actionToken, lat, lng required' })
  }
  try {
    const result = validateSessionAction(db, { userId: req.user!.userId, projectId, actionToken, lat, lng, grantToken })
    touchProjectFieldActivity(db, projectId)
    res.json({ ok: true, data: result })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

router.post('/sessions/status', (req, res) => {
  if (!requireFieldRole(req, res)) return
  const { status, note } = req.body
  if (!['active', 'lunch_break', 'material_run'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'Invalid status' })
  }
  try {
    updateLogStatus(db, req.user!.userId, status, note)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

/* ── QR crew check-in ── */
router.post('/qr/issue', (req, res) => {
  if (!requireFieldRole(req, res)) return
  if (req.user!.role !== 'foreman') return res.status(403).json({ ok: false, error: 'Foreman only' })
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { projectId } = req.body
  const session = getActiveSession(db, req.user!.userId)
  if (!session || session.projectId !== projectId) {
    return res.status(400).json({ ok: false, error: 'Start a field session on this project first' })
  }
  const qr = issueQrToken(db, { companyId, projectId, sessionId: session.id, foremanUserId: req.user!.userId })
  res.json({ ok: true, data: qr })
})

router.post('/qr/consume', (req, res) => {
  if (!requireFieldRole(req, res)) return
  const { token, lat, lng } = req.body
  if (!token || lat == null || lng == null) return res.status(400).json({ ok: false, error: 'token, lat, lng required' })
  try {
    const result = consumeQrToken(db, { token, userId: req.user!.userId, lat, lng })
    const log = clockIn(db, { companyId: result.companyId, projectId: result.projectId, userId: req.user!.userId, lat, lng })
    res.json({ ok: true, data: { ...result, timeLog: log } })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

/* ── Off-site override request ── */
router.post('/override-requests', (req, res) => {
  if (!requireFieldRole(req, res)) return
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { projectId, actionType, resourceId, reason } = req.body
  if (!projectId || !actionType || !reason?.trim()) {
    return res.status(400).json({ ok: false, error: 'projectId, actionType, reason required' })
  }
  const id = uuid()
  db.prepare(`INSERT INTO field_override_requests (id, company_id, project_id, user_id, action_type, resource_id, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, companyId, projectId, req.user!.userId, actionType, resourceId || null, reason.trim())
  res.status(201).json({ ok: true, data: { id } })
})

export default router
