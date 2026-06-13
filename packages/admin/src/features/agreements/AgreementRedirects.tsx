import { Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'

/** Redirect legacy /company/agreements routes to customer-scoped files */
export function AgreementRedirect() {
  return <Navigate to="/company/customers" replace />
}

export function AgreementDetailRedirect() {
  const { id } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['agreements', id],
    queryFn: async () => {
      if (!id) return null
      const r = await api.get<any>(`/api/admin/agreements/${id}`)
      return r.ok ? r.data : null
    },
    enabled: !!id,
  })

  if (isLoading) return <p className="text-muted-foreground text-sm">Redirecting...</p>
  if (data?.customerId) {
    return <Navigate to={`/company/customers/${data.customerId}?tab=files&agreement=${id}`} replace />
  }
  return <Navigate to="/company/customers" replace />
}
