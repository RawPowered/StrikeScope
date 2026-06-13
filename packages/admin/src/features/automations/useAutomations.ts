import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api'
import type { AutomationsStatus, EmbedTokenData, TemplateFlow, WebhookSubscription } from './types'

export function useAutomationsStatus() {
  return useQuery({
    queryKey: ['automations-status'],
    queryFn: async () => {
      const r = await api.get<AutomationsStatus>('/api/admin/automations/status')
      if (!r.ok) throw new Error(r.error || 'Failed to load status')
      return r.data!
    },
    refetchInterval: 30000,
  })
}

export function useEmbedToken(usePlatformTemplates = false) {
  return useMutation({
    mutationFn: async () => {
      const r = await api.post<EmbedTokenData>('/api/admin/automations/embed-token', { usePlatformTemplates })
      if (!r.ok) throw new Error(r.error || 'Embed token failed')
      return r.data!
    },
  })
}

export function useRotateServiceKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const r = await api.post<{ key: string; prefix: string }>('/api/admin/automations/service-key/rotate')
      if (!r.ok) throw new Error(r.error || 'Rotate failed')
      return r.data!
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations-status'] }),
  })
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['automations-webhooks'],
    queryFn: async () => {
      const r = await api.get<WebhookSubscription[]>('/api/admin/automations/webhooks')
      if (!r.ok) throw new Error(r.error || 'Failed to load webhooks')
      return r.data || []
    },
  })
}

export function useRegisterWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { triggerType: string; webhookUrl: string; label?: string }) => {
      const r = await api.post('/api/admin/automations/webhooks/register', body)
      if (!r.ok) throw new Error(r.error || 'Register failed')
      return r.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations-webhooks'] }),
  })
}

export function useTemplates() {
  return useQuery({
    queryKey: ['automations-templates'],
    queryFn: async () => {
      const r = await api.get<{ flows: TemplateFlow[]; error?: string }>('/api/admin/automations/templates')
      if (!r.ok) throw new Error(r.error || 'Failed to load templates')
      return r.data!
    },
    enabled: false,
  })
}

export function useCloneTemplate() {
  return useMutation({
    mutationFn: async (body: { templateId: string; companyId: string }) => {
      const r = await api.post<{ flowId?: string }>(
        `/api/admin/automations/templates/${body.templateId}/clone-to-company`,
        { companyId: body.companyId },
      )
      if (!r.ok) throw new Error(r.error || 'Clone failed')
      return r.data!
    },
  })
}
