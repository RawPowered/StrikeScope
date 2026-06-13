import { Router } from 'express'
import db from '../db.js'
import { v4 as uuid } from 'uuid'
import { writeFile, mkdir } from 'fs/promises'
import { join, resolve } from 'path'
import { getConfig } from '../config.js'
import { asyncHandler } from '../util.js'
import { requireActiveCompany } from './helpers.js'
import { resolveProjectTaskItemId, touchProjectFieldActivity } from '../plugins/task-linkage.js'

const router = Router()

function safePath(baseDir: string, filePath: string): string {
  const resolved = resolve(baseDir, filePath)
  const base = resolve(baseDir)
  if (!resolved.startsWith(base)) throw new Error('Invalid path')
  return resolved
}

router.get('/', (req, res) => {
  const { status, projectId: pid } = req.query
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return

  let query = `
    SELECT s.id, s.project_id as projectId, s.project_task_item_id as projectTaskItemId,
           s.installer_id as installerId, s.installer_name as installerName,
           s.gps_lat as gpsLat, s.gps_lng as gpsLng,
           s.captured_at as capturedAt, s.submitted_at as submittedAt, s.status,
           (SELECT COUNT(*) FROM submission_images WHERE submission_id = s.id) as photoCount
    FROM submissions s
    JOIN projects p ON p.id = s.project_id
    WHERE p.company_id = ?
  `
  const params: any[] = [companyId]
  if (status && typeof status === 'string') { query += ' AND s.status = ?'; params.push(status) }
  if (pid && typeof pid === 'string') { query += ' AND s.project_id = ?'; params.push(pid) }
  query += ' ORDER BY s.submitted_at DESC'
  const rows = db.prepare(query).all(...params)
  res.json({ ok: true, data: rows })
})

router.get('/:id', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const submission = db.prepare(`
    SELECT s.id, s.project_id as projectId, s.project_task_item_id as projectTaskItemId,
           s.installer_id as installerId, s.installer_name as installerName,
           s.gps_lat as gpsLat, s.gps_lng as gpsLng,
           s.captured_at as capturedAt, s.submitted_at as submittedAt, s.status
    FROM submissions s
    JOIN projects p ON p.id = s.project_id
    WHERE s.id = ? AND p.company_id = ?
  `).get(req.params.id, companyId) as any
  if (!submission) return res.status(404).json({ ok: false, error: 'Not found' })
  const images = db.prepare(`
    SELECT si.id, si.submission_id as submissionId, si.project_task_item_id as projectTaskItemId,
           si.filename, si.filepath, si.gps_lat as gpsLat, si.gps_lng as gpsLng, si.captured_at as capturedAt
    FROM submission_images si WHERE si.submission_id = ?
  `).all(req.params.id)
  res.json({ ok: true, data: { ...submission, images } })
})

router.post('/', asyncHandler(async (req, res) => {
  const { installerName, gpsLat, gpsLng, capturedAt, images, projectId: bodyProjectId } = req.body
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ ok: false, error: 'No images provided' })
  }

  const config = getConfig()
  const submissionId = uuid()
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return

  let projectId = bodyProjectId as string | undefined
  if (projectId) {
    const valid = db.prepare('SELECT id FROM projects WHERE id=? AND company_id=?').get(projectId, companyId)
    if (!valid) return res.status(400).json({ ok: false, error: 'Invalid projectId' })
  } else {
    projectId = (db.prepare('SELECT id FROM projects WHERE company_id = ? LIMIT 1').get(companyId) as any)?.id
    if (!projectId) {
      const cid = uuid()
      projectId = uuid()
      db.prepare('INSERT INTO customers (id, company_id, name) VALUES (?, ?, ?)').run(cid, companyId, 'General')
      db.prepare('INSERT INTO projects (id, company_id, customer_id, name, status) VALUES (?, ?, ?, ?, ?)').run(projectId, companyId, cid, 'General Project', 'active')
    }
  }

  const imageRows: any[] = []
  let primaryTaskItemId: string | null = null
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const itemRef = img.projectTaskItemId || img.guideItemId
    if (typeof img.data !== 'string' || typeof itemRef !== 'string') {
      return res.status(400).json({ ok: false, error: `Invalid image at index ${i}` })
    }
    const ptiId = resolveProjectTaskItemId(db, projectId!, itemRef)
    if (!ptiId) return res.status(400).json({ ok: false, error: `Unknown task item at index ${i}` })
    if (!primaryTaskItemId) primaryTaskItemId = ptiId

    const imgId = uuid()
    const ext = (img.data.match(/^data:image\/(\w+);/) || [])[1] || 'jpg'
    const filename = `${submissionId}_${imgId}.${ext}`
    const filepath = join('submissions', submissionId, filename)
    const base64Data = img.data.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const fullPath = safePath(config.storageDir, filepath)
    await mkdir(join(config.storageDir, 'submissions', submissionId), { recursive: true })
    await writeFile(fullPath, buffer)
    imageRows.push({
      id: imgId, projectTaskItemId: ptiId, filename, filepath,
      gpsLat: img.gpsLat != null ? img.gpsLat : null,
      gpsLng: img.gpsLng != null ? img.gpsLng : null,
      capturedAt: img.capturedAt || new Date().toISOString(),
    })
  }

  const now = capturedAt || new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO submissions (id, project_id, project_task_item_id, installer_name, gps_lat, gps_lng, captured_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`)
      .run(submissionId, projectId, primaryTaskItemId, installerName || 'Installer', gpsLat ?? null, gpsLng ?? null, now)
    for (const row of imageRows) {
      db.prepare(`INSERT INTO submission_images (id, submission_id, project_task_item_id, filename, filepath, gps_lat, gps_lng, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(row.id, submissionId, row.projectTaskItemId, row.filename, row.filepath, row.gpsLat, row.gpsLng, row.capturedAt)
      db.prepare(`UPDATE project_task_items SET status='in_progress', actual_started_at=COALESCE(actual_started_at, ?) WHERE id=?`)
        .run(now, row.projectTaskItemId)
    }
    touchProjectFieldActivity(db, projectId!, now)
  })
  tx()

  const submission = db.prepare(`SELECT id, project_id as projectId, installer_name as installerName, gps_lat as gpsLat, gps_lng as gpsLng, captured_at as capturedAt, submitted_at as submittedAt, status FROM submissions WHERE id = ?`).get(submissionId)
  res.status(201).json({ ok: true, data: submission })
}))

router.patch('/:id/status', (req, res) => {
  const { status } = req.body
  if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ ok: false, error: 'Invalid status' })
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const sub = db.prepare('SELECT s.id FROM submissions s JOIN projects p ON p.id = s.project_id WHERE s.id = ? AND p.company_id = ?').get(req.params.id, companyId)
  if (!sub) return res.status(404).json({ ok: false, error: 'Not found' })
  db.prepare('UPDATE submissions SET status = ? WHERE id = ?').run(status, req.params.id)
  const submission = db.prepare(`SELECT s.id, s.project_id as projectId, s.installer_name as installerName, s.gps_lat as gpsLat, s.gps_lng as gpsLng, s.captured_at as capturedAt, s.submitted_at as submittedAt, s.status FROM submissions s JOIN projects p ON p.id = s.project_id WHERE s.id = ? AND p.company_id = ?`).get(req.params.id, companyId)
  res.json({ ok: true, data: submission })
})

export default router
