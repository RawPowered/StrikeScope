export interface AutomationsStatus {
  activepiecesUrl: string
  reachable: boolean
  healthError?: string
  embedConfigured: boolean
  serviceKeyPrefix: string | null
  externalProjectId: string
  triggerTypes: string[]
}

export interface EmbedTokenData {
  token: string
  externalProjectId: string
  instanceUrl: string
  expiresInSec: number
}

export interface WebhookSubscription {
  id: string
  triggerType: string
  webhookUrl: string
  flowId?: string
  label?: string
  isActive: number
  createdAt: string
}

export interface TemplateFlow {
  id: string
  name: string
  status: string
  updated?: string
}

declare global {
  interface Window {
    activepieces?: {
      configure: (opts: Record<string, unknown>) => Promise<void>
      navigate: (opts: { route: string }) => void
    }
  }
}
