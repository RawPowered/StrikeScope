import type Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'
import logger from '../../logger.js'
import type { AutomationEvent, AutomationTriggerType, WebhookPayload } from './types.js'

const TRIGGER_MAP: Record<string, AutomationTriggerType | null> = {
  'lead:created': 'lead_created',
  'lead:stage-changed': 'lead_stage_changed',
  'customer:created': 'customer_created',
  'project:status-changed': 'project_status_changed',
}

export function mapEventToTrigger(entityType: string, action: string): AutomationTriggerType | null {
  return TRIGGER_MAP[`${entityType}:${action}`] || null
}

function buildPayload(event: AutomationEvent, trigger: AutomationTriggerType): WebhookPayload {
  return {
    trigger,
    companyId: event.companyId,
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action,
    timestamp: new Date().toISOString(),
    data: {
      description: event.description || null,
      ...(event.metadata || {}),
    },
  }
}

function logDelivery(
  db: Database.Database,
  event: AutomationEvent,
  trigger: AutomationTriggerType,
  webhookUrl: string,
  status: 'success' | 'failed' | 'skipped',
  responseCode?: number,
  errorMessage?: string,
  payload?: WebhookPayload,
) {
  db.prepare(`INSERT INTO automation_event_log
    (id, company_id, trigger_type, entity_type, entity_id, action, webhook_url, status, response_code, error_message, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    uuid(),
    event.companyId,
    trigger,
    event.entityType,
    event.entityId,
    event.action,
    webhookUrl,
    status,
    responseCode ?? null,
    errorMessage ?? null,
    payload ? JSON.stringify(payload) : null,
  )
}

async function postWebhook(url: string, payload: WebhookPayload): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })
    return { ok: res.ok, status: res.status, error: res.ok ? undefined : await res.text().catch(() => res.statusText) }
  } catch (e: any) {
    return { ok: false, status: 0, error: e.message || 'Request failed' }
  }
}

export async function emitAutomationEvent(db: Database.Database, event: AutomationEvent): Promise<void> {
  const trigger = mapEventToTrigger(event.entityType, event.action)
  if (!trigger) return

  const subs = db.prepare(
    `SELECT webhook_url as webhookUrl FROM automation_webhook_subscriptions
     WHERE company_id = ? AND trigger_type = ? AND is_active = 1`,
  ).all(event.companyId, trigger) as { webhookUrl: string }[]

  if (subs.length === 0) {
    logDelivery(db, event, trigger, '', 'skipped', undefined, 'No active subscriptions')
    return
  }

  const payload = buildPayload(event, trigger)

  await Promise.all(subs.map(async (sub) => {
    const result = await postWebhook(sub.webhookUrl, payload)
    if (result.ok) {
      logDelivery(db, event, trigger, sub.webhookUrl, 'success', result.status, undefined, payload)
    } else {
      logDelivery(db, event, trigger, sub.webhookUrl, 'failed', result.status, result.error, payload)
      logger.warn({ trigger, webhookUrl: sub.webhookUrl, error: result.error }, 'automation webhook delivery failed')
    }
  }))
}

export function registerWebhook(
  db: Database.Database,
  companyId: string,
  triggerType: AutomationTriggerType,
  webhookUrl: string,
  opts: { flowId?: string; label?: string } = {},
) {
  const existing = db.prepare(
    `SELECT id FROM automation_webhook_subscriptions
     WHERE company_id = ? AND trigger_type = ? AND webhook_url = ?`,
  ).get(companyId, triggerType, webhookUrl) as { id: string } | undefined

  if (existing) {
    db.prepare(`UPDATE automation_webhook_subscriptions SET is_active = 1, flow_id = COALESCE(?, flow_id),
      label = COALESCE(?, label), updated_at = datetime('now') WHERE id = ?`).run(
      opts.flowId || null, opts.label || null, existing.id,
    )
    return existing.id
  }

  const id = uuid()
  db.prepare(`INSERT INTO automation_webhook_subscriptions
    (id, company_id, trigger_type, webhook_url, flow_id, label, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)`).run(
    id, companyId, triggerType, webhookUrl, opts.flowId || null, opts.label || null,
  )
  return id
}

export function listWebhooks(db: Database.Database, companyId: string) {
  return db.prepare(
    `SELECT id, trigger_type as triggerType, webhook_url as webhookUrl, flow_id as flowId,
      label, is_active as isActive, created_at as createdAt
     FROM automation_webhook_subscriptions WHERE company_id = ? ORDER BY created_at DESC`,
  ).all(companyId)
}

export function unregisterWebhook(db: Database.Database, companyId: string, id: string): boolean {
  const result = db.prepare(
    'UPDATE automation_webhook_subscriptions SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ? AND company_id = ?',
  ).run(id, companyId)
  return result.changes > 0
}
