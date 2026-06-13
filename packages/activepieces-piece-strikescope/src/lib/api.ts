import { HttpMethod, httpClient } from '@activepieces/pieces-common'
import type { AutomationTriggerType } from './types'

export async function registerStrikeScopeWebhook(
  apiUrl: string,
  serviceKey: string,
  triggerType: AutomationTriggerType,
  webhookUrl: string,
  label?: string,
) {
  const base = apiUrl.replace(/\/$/, '')
  await httpClient.sendRequest({
    method: HttpMethod.POST,
    url: `${base}/api/admin/automations/webhooks/register-service`,
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: {
      triggerType,
      webhookUrl,
      label,
    },
  })
}

export async function strikeScopeRequest(
  apiUrl: string,
  serviceKey: string,
  path: string,
  method: HttpMethod,
  body?: Record<string, unknown>,
) {
  const base = apiUrl.replace(/\/$/, '')
  const response = await httpClient.sendRequest({
    method,
    url: `${base}${path}`,
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body,
  })
  return response.body
}
