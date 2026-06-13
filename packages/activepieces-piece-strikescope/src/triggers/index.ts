import { buildWebhookTrigger } from '../lib/webhook-trigger'

export const leadCreated = buildWebhookTrigger(
  'lead_created',
  'Lead Created',
  'Triggers when a new lead is created in StrikeScope',
  {
    trigger: 'lead_created',
    entityType: 'lead',
    entityId: 'lead-uuid',
    data: { stageId: 'stage-uuid', name: 'Jane Doe' },
  },
)

export const leadStageChanged = buildWebhookTrigger(
  'lead_stage_changed',
  'Lead Stage Changed',
  'Triggers when a lead moves to a new pipeline stage',
  {
    trigger: 'lead_stage_changed',
    entityType: 'lead',
    entityId: 'lead-uuid',
    data: { oldStageId: 'old', newStageId: 'new' },
  },
)

export const customerCreated = buildWebhookTrigger(
  'customer_created',
  'Customer Created',
  'Triggers when a new customer account is created',
  {
    trigger: 'customer_created',
    entityType: 'customer',
    entityId: 'customer-uuid',
    data: {},
  },
)

export const projectStatusChanged = buildWebhookTrigger(
  'project_status_changed',
  'Project Status Changed',
  'Triggers when a project status changes',
  {
    trigger: 'project_status_changed',
    entityType: 'project',
    entityId: 'project-uuid',
    data: { oldStatus: 'planned', newStatus: 'active' },
  },
)
