export type AutomationTriggerType =
  | 'lead_created'
  | 'lead_stage_changed'
  | 'customer_created'
  | 'project_status_changed'

export interface AutomationEvent {
  companyId: string
  entityType: string
  entityId: string
  action: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface WebhookPayload {
  trigger: AutomationTriggerType
  companyId: string
  entityType: string
  entityId: string
  action: string
  timestamp: string
  data: Record<string, unknown>
}
