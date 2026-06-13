import { Router } from 'express'
import db from '../db.js'

const router = Router()

const VALID_ENTITIES = ['leads', 'customers', 'contacts', 'agreements', 'projects', 'submissions', 'activities']

/* ── Get column preferences for current user + entity ── */
router.get('/:entity', (req, res) => {
  const { entity } = req.params
  if (!VALID_ENTITIES.includes(entity)) return res.status(400).json({ ok: false, error: 'Invalid entity' })
  if (!req.user?.userId) return res.status(401).json({ ok: false, error: 'Not authenticated' })

  const pref = db.prepare('SELECT columns_json as columnsJson FROM user_column_preferences WHERE user_id = ? AND entity = ?').get(req.user.userId, entity) as any
  res.json({ ok: true, data: pref ? pref.columnsJson : '[]' })
})

/* ── Set column preferences for current user + entity ── */
router.put('/:entity', (req, res) => {
  const { entity } = req.params
  if (!VALID_ENTITIES.includes(entity)) return res.status(400).json({ ok: false, error: 'Invalid entity' })
  if (!req.user?.userId) return res.status(401).json({ ok: false, error: 'Not authenticated' })

  const { columns } = req.body
  if (!Array.isArray(columns)) return res.status(400).json({ ok: false, error: 'columns must be an array of column identifiers' })

  db.prepare(`INSERT INTO user_column_preferences (user_id, entity, columns_json) VALUES (?, ?, ?)
    ON CONFLICT(user_id, entity) DO UPDATE SET columns_json = excluded.columns_json`).run(
    req.user.userId, entity, JSON.stringify(columns),
  )
  res.json({ ok: true })
})

export default router
