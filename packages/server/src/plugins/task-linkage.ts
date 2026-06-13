import type Database from 'better-sqlite3'

/** Resolve project_task_items.id from direct id or legacy template_item id / guideItemId */
export function resolveProjectTaskItemId(db: Database.Database, projectId: string, itemRef: string): string | null {
  const direct = db.prepare('SELECT id FROM project_task_items WHERE id=? AND project_id=?').get(itemRef, projectId) as any
  if (direct) return itemRef
  const viaTemplate = db.prepare('SELECT id FROM project_task_items WHERE template_item_id=? AND project_id=?').get(itemRef, projectId) as any
  return viaTemplate?.id || null
}

export function touchProjectFieldActivity(db: Database.Database, projectId: string, at?: string) {
  const ts = at || new Date().toISOString()
  db.prepare('UPDATE projects SET last_field_activity_at=?, updated_at=? WHERE id=?').run(ts, ts, projectId)
}

export function markTaskItemProgress(
  db: Database.Database,
  projectTaskItemId: string,
  projectId: string,
  completedAt?: string,
) {
  const ts = completedAt || new Date().toISOString()
  const item = db.prepare('SELECT id, status, actual_started_at FROM project_task_items WHERE id=? AND project_id=?').get(projectTaskItemId, projectId) as any
  if (!item) return
  if (!item.actual_started_at) {
    db.prepare(`UPDATE project_task_items SET status='in_progress', actual_started_at=? WHERE id=?`).run(ts, projectTaskItemId)
  }
  db.prepare(`UPDATE project_task_items SET status='completed', actual_completed_at=? WHERE id=?`).run(ts, projectTaskItemId)
  touchProjectFieldActivity(db, projectId, ts)
}
