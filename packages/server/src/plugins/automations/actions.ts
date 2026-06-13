import type Database from 'better-sqlite3'
import { recordActivity } from '../../routes/helpers.js'
import type { AuthUser } from '../../auth.js'

export function updateLeadStage(
  db: Database.Database,
  companyId: string,
  leadId: string,
  stageId: string,
  user?: AuthUser,
) {
  const lead = db.prepare('SELECT id, name, stage_id as stageId, company_id as companyId FROM leads WHERE id = ? AND company_id = ?').get(leadId, companyId) as
    | { id: string; name: string; stageId: string; companyId: string }
    | undefined
  if (!lead) throw new Error('Lead not found')

  const stage = db.prepare('SELECT id, name FROM lead_stages WHERE id = ? AND company_id = ?').get(stageId, companyId) as { id: string; name: string } | undefined
  if (!stage) throw new Error('Stage not found')

  const oldStage = db.prepare('SELECT name FROM lead_stages WHERE id = ?').get(lead.stageId) as { name: string } | undefined
  db.prepare('UPDATE leads SET stage_id = ? WHERE id = ? AND company_id = ?').run(stageId, leadId, companyId)
  recordActivity(companyId, 'lead', leadId, 'stage-changed',
    `Stage changed from "${oldStage?.name || 'Unknown'}" to "${stage.name}" (automation)`,
    user, { oldStageId: lead.stageId, newStageId: stageId })
  return { leadId, stageId, stageName: stage.name }
}

export function assignLeadOwner(
  db: Database.Database,
  companyId: string,
  leadId: string,
  ownerId: string,
  user?: AuthUser,
) {
  const lead = db.prepare('SELECT id FROM leads WHERE id = ? AND company_id = ?').get(leadId, companyId)
  if (!lead) throw new Error('Lead not found')

  const owner = db.prepare(
    `SELECT u.id FROM users u
     JOIN user_company_memberships m ON m.user_id = u.id
     WHERE u.id = ? AND m.company_id = ? AND m.is_active = 1`,
  ).get(ownerId, companyId)
  if (!owner) throw new Error('Owner not found in company')

  db.prepare('UPDATE leads SET assigned_to = ? WHERE id = ? AND company_id = ?').run(ownerId, leadId, companyId)
  recordActivity(companyId, 'lead', leadId, 'updated', 'Lead owner assigned (automation)', user, { assignedTo: ownerId })
  return { leadId, ownerId }
}

export function createLeadNote(
  db: Database.Database,
  companyId: string,
  leadId: string,
  note: string,
  user?: AuthUser,
) {
  const lead = db.prepare('SELECT id, name FROM leads WHERE id = ? AND company_id = ?').get(leadId, companyId) as { id: string; name: string } | undefined
  if (!lead) throw new Error('Lead not found')
  if (!note?.trim()) throw new Error('Note is required')

  recordActivity(companyId, 'lead', leadId, 'note', note.trim(), user)
  return { leadId, note: note.trim() }
}
