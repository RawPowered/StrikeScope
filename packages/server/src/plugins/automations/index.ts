export { getAutomationsConfig, isEmbedConfigured } from './config.js'
export { createEmbedToken } from './jwt.js'
export type { EmbedTokenResult } from './jwt.js'
export {
  ensureCompanyProject,
  ensurePlatformProject,
  companyExternalProjectId,
  resolveExternalProjectId,
} from './project-map.js'
export {
  rotateServiceKey,
  getServiceKeyMeta,
  ensureServiceKey,
  resolveCompanyFromServiceKey,
} from './service-keys.js'
export {
  emitAutomationEvent,
  registerWebhook,
  listWebhooks,
  unregisterWebhook,
  mapEventToTrigger,
} from './emitter.js'
export { listPlatformTemplates, cloneTemplateToCompany, checkActivepiecesHealth } from './templates.js'
export { updateLeadStage, assignLeadOwner, createLeadNote } from './actions.js'
export type { AutomationEvent, AutomationTriggerType, WebhookPayload } from './types.js'
