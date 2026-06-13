import type Database from 'better-sqlite3'

export interface ProjectProgress {
  totalSteps: number
  completedSteps: number
  percentComplete: number
  lastCompleted: { label: string; completedAt: string | null } | null
  currentStep: { label: string; sortOrder: number } | null
  nextStep: { label: string; sortOrder: number } | null
}

export function computeProjectProgress(db: Database.Database, projectId: string): ProjectProgress {
  const items = db.prepare(`SELECT id, label, sort_order as sortOrder, required_count as requiredCount,
    status, actual_started_at as actualStartedAt, actual_completed_at as actualCompletedAt
    FROM project_task_items WHERE project_id=? ORDER BY sort_order ASC`).all(projectId) as any[]

  let completedSteps = 0
  let lastCompleted: ProjectProgress['lastCompleted'] = null
  let currentStep: ProjectProgress['currentStep'] = null
  let nextStep: ProjectProgress['nextStep'] = null

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const imgCount = (db.prepare(`SELECT COUNT(*) as c FROM submission_images si
      JOIN submissions s ON s.id=si.submission_id
      WHERE s.project_id=? AND si.project_task_item_id=? AND s.status='approved'`).get(projectId, item.id) as any).c
    const done = item.status === 'completed' || item.actualCompletedAt != null || imgCount >= (item.requiredCount || 1)
    if (done) {
      completedSteps++
      const lastSub = db.prepare(`SELECT s.submitted_at as submittedAt FROM submissions s
        JOIN submission_images si ON si.submission_id=s.id
        WHERE s.project_id=? AND si.project_task_item_id=? AND s.status='approved'
        ORDER BY s.submitted_at DESC LIMIT 1`).get(projectId, item.id) as any
      lastCompleted = { label: item.label, completedAt: lastSub?.submittedAt || null }
    } else if (!currentStep) {
      currentStep = { label: item.label, sortOrder: item.sortOrder }
      const nxt = items[i + 1]
      if (nxt) nextStep = { label: nxt.label, sortOrder: nxt.sortOrder }
    }
  }

  const totalSteps = items.length
  return {
    totalSteps,
    completedSteps,
    percentComplete: totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0,
    lastCompleted,
    currentStep,
    nextStep,
  }
}
