import { TriggerStrategy, createTrigger } from '@activepieces/pieces-framework'
import type { AutomationTriggerType } from './types'
import { registerStrikeScopeWebhook } from './api'
import { strikescopeAuth, apiUrlProp } from './auth'
import { authSecret } from './auth-value'

export function buildWebhookTrigger(
  name: AutomationTriggerType,
  displayName: string,
  description: string,
  sampleData: Record<string, unknown>,
) {
  return createTrigger({
    auth: strikescopeAuth,
    name,
    displayName,
    description,
    props: { apiUrl: apiUrlProp },
    sampleData,
    type: TriggerStrategy.WEBHOOK,
    async onEnable(context) {
      const apiUrl = context.propsValue.apiUrl as string
      const serviceKey = authSecret(context.auth)
      await registerStrikeScopeWebhook(apiUrl, serviceKey, name, context.webhookUrl, displayName)
      await context.store.put(`webhook:${name}`, context.webhookUrl)
    },
    async onDisable(context) {
      await context.store.delete(`webhook:${name}`)
    },
    async run(context) {
      return [context.payload.body]
    },
  })
}
