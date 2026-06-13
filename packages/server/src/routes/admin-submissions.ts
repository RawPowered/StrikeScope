import { Router } from 'express'
import db from '../db.js'
import { getConfig } from '../config.js'
import { getProvider } from '../storage/index.js'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { withCfSelect, parsePaginationParams, buildPaginatedResponse, requireActiveCompany } from './helpers.js'
import { markTaskItemProgress, touchProjectFieldActivity } from '../plugins/task-linkage.js'
import logger from '../logger.js'

const router = Router()

function asUrl(filepath: string): string {
  const base = `/uploads/${filepath.replace(/\\/g, '/')}`
  return base
}

function attachImages(submission: any) {
  const images = db.prepare(`
    SELECT si.id, si.submission_id as submissionId, si.project_task_item_id as projectTaskItemId,
           si.filename, si.filepath, si.gps_lat as gpsLat, si.gps_lng as gpsLng, si.captured_at as capturedAt
    FROM submission_images si WHERE si.submission_id = ?
  `).all(submission.id) as any[]
  return {
    ...submission,
    images: images.map((img: any) => ({ ...img, url: asUrl(img.filepath) })),
    photoCount: images.length,
  }
}

let SELECT = `SELECT s.id, s.project_id as projectId, s.project_task_item_id as projectTaskItemId,
  s.installer_id as installerId, s.installer_name as installerName,
  s.gps_lat as gpsLat, s.gps_lng as gpsLng,
  s.captured_at as capturedAt, s.submitted_at as submittedAt, s.status,
  p.company_id as companyId, p.name as projectName, c.name as customerName,
  (SELECT COUNT(*) FROM submission_images WHERE submission_id = s.id) as photoCount
  FROM submissions s
  JOIN projects p ON p.id = s.project_id
  LEFT JOIN customers c ON c.id = p.customer_id`

router.get('/', (req, res) => {
  const { projectId, status, include_custom_fields } = req.query
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { page, perPage, offset } = parsePaginationParams(req.query as any)

  let selectSql = SELECT
  if (include_custom_fields === 'true') selectSql = withCfSelect(selectSql, 'submissions', 's')
  const params: any[] = []
  const conditions: string[] = []

  conditions.push('p.company_id = ?'); params.push(companyId)
  if (projectId) { conditions.push('s.project_id = ?'); params.push(projectId) }
  if (status) { conditions.push('s.status = ?'); params.push(status) }

  // Custom field filters
  const cfPrefix = 'cf_'
  for (const key of Object.keys(req.query)) {
    if (key.startsWith(cfPrefix) && key.length > cfPrefix.length) {
      const fieldName = key.slice(cfPrefix.length)
      const value = req.query[key] as string
      conditions.push(`EXISTS (SELECT 1 FROM custom_field_values cfv2
        JOIN custom_field_definitions cfd2 ON cfd2.id = cfv2.field_definition_id
        WHERE cfv2.entity = 'submissions' AND cfv2.entity_id = s.id
        AND cfd2.field_name = ? AND cfv2.value = ?)`)
      params.push(fieldName, value)
    }
  }

  let query = selectSql
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')

  // Count query
  let countQuery = `SELECT COUNT(*) as total FROM submissions s JOIN projects p ON p.id = s.project_id`
  const countParams: any[] = []
  const countConditions: string[] = []
  countConditions.push('p.company_id = ?'); countParams.push(companyId)
  if (projectId) { countConditions.push('s.project_id = ?'); countParams.push(projectId) }
  if (status) { countConditions.push('s.status = ?'); countParams.push(status) }
  for (const key of Object.keys(req.query)) {
    if (key.startsWith(cfPrefix) && key.length > cfPrefix.length) {
      const fieldName = key.slice(cfPrefix.length)
      const value = req.query[key] as string
      countConditions.push(`EXISTS (SELECT 1 FROM custom_field_values cfv2
        JOIN custom_field_definitions cfd2 ON cfd2.id = cfv2.field_definition_id
        WHERE cfv2.entity = 'submissions' AND cfv2.entity_id = s.id
        AND cfd2.field_name = ? AND cfv2.value = ?)`)
      countParams.push(fieldName, value)
    }
  }
  if (countConditions.length) countQuery += ' WHERE ' + countConditions.join(' AND ')
  const total = (db.prepare(countQuery).get(...countParams) as any).total

  query += ' ORDER BY s.submitted_at DESC LIMIT ? OFFSET ?'
  params.push(perPage, offset)

  const rows = db.prepare(query).all(...params)
  res.json(buildPaginatedResponse(rows, total, page, perPage))
})

router.get('/:id', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const submission = db.prepare(`${SELECT} WHERE p.company_id = ? AND s.id = ?`).get(companyId, req.params.id) as any
  if (!submission) return res.status(404).json({ ok: false, error: 'Not found' })

  res.json({ ok: true, data: attachImages(submission) })
})

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body
  if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ ok: false, error: 'Invalid status' })

  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const sub = db.prepare(`SELECT s.id, s.project_id as projectId, p.company_id as companyId FROM submissions s JOIN projects p ON p.id = s.project_id WHERE s.id = ? AND p.company_id = ?`).get(req.params.id, companyId) as any
  if (!sub) return res.status(404).json({ ok: false, error: 'Not found' })

  db.prepare('UPDATE submissions SET status = ? WHERE id = ?').run(status, req.params.id)

  if (status === 'approved') {
    const now = new Date().toISOString()
    const images = db.prepare('SELECT DISTINCT project_task_item_id as ptiId FROM submission_images WHERE submission_id=? AND project_task_item_id IS NOT NULL').all(req.params.id) as any[]
    for (const img of images) {
      if (img.ptiId) markTaskItemProgress(db, img.ptiId, sub.projectId, now)
    }
    touchProjectFieldActivity(db, sub.projectId, now)
  }

  // On approve: push images to company's active storage connection
  if (status === 'approved') {
    const conn = db.prepare(`SELECT * FROM connections WHERE company_id = ? AND is_active = 1 LIMIT 1`).get(sub.companyId) as any
    if (conn) {
      const provider = getProvider(conn.type)
      if (provider) {
        let config: Record<string, string>
        try { config = JSON.parse(conn.config_json) } catch { config = {} }
        const images = db.prepare(`SELECT filepath FROM submission_images WHERE submission_id = ?`).all(req.params.id) as any[]
        const config_ = getConfig()
        for (const img of images) {
          try {
            const fullPath = join(config_.storageDir, img.filepath)
            const buffer = await readFile(fullPath)
            await provider.upload(config, `submissions/${req.params.id}/${img.filepath.replace(/\\/g, '/')}`, buffer)
          } catch (e: any) {
            logger.error({ err: e, filepath: img.filepath }, 'Storage upload failed')
          }
        }
      }
    }
  }

  const updated = db.prepare(`${SELECT} WHERE p.company_id = ? AND s.id = ?`).get(companyId, req.params.id)
  res.json({ ok: true, data: attachImages(updated) })
})

export default router
