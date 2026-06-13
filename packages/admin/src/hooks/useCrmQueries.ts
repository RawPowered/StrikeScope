import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Lead, Customer, Agreement } from '@strikescope/shared/src/types'

export function useLeads(params?: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  return useQuery({
    queryKey: ['leads', params],
    queryFn: async () => {
      const r = await api.get<Lead[]>(`/api/admin/leads?${qs}`)
      if (!r.ok) throw new Error(r.error || 'Failed to load leads')
      return r.data || []
    },
  })
}

export function useLeadsDnc() {
  return useQuery({
    queryKey: ['leads', 'dnc'],
    queryFn: async () => {
      const r = await api.get<Lead[]>('/api/admin/leads/dnc')
      if (!r.ok) throw new Error(r.error || 'Failed to load DNC leads')
      return r.data || []
    },
  })
}

export function useRemoveDnc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/leads/${id}/dnc`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useCustomers(params?: Record<string, string>) {
  const qs = new URLSearchParams({ include_custom_fields: 'true', ...params }).toString()
  return useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      const r = await api.get<Customer[]>(`/api/admin/customers?${qs}`)
      if (!r.ok) throw new Error(r.error || 'Failed to load customers')
      return r.data || []
    },
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: async () => {
      const r = await api.get<Customer>(`/api/admin/customers/${id}`)
      if (!r.ok) throw new Error(r.error || 'Not found')
      return r.data!
    },
    enabled: !!id,
  })
}

export function useCustomerAgreements(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customers', customerId, 'agreements'],
    queryFn: async () => {
      const r = await api.get<Agreement[]>(`/api/admin/customers/${customerId}/agreements`)
      if (!r.ok) throw new Error(r.error || 'Failed to load agreements')
      return r.data || []
    },
    enabled: !!customerId,
  })
}

export function useCustomerFiles(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customers', customerId, 'files'],
    queryFn: async () => {
      const r = await api.get<any[]>(`/api/admin/customers/${customerId}/files`)
      if (!r.ok) throw new Error(r.error || 'Failed to load files')
      return r.data || []
    },
    enabled: !!customerId,
  })
}
