import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { PageHeader } from '../../layout/PageHeader'
import { Card, CardContent } from '../../components/ui/card'
import CommissionReports from './CommissionReports'

export default function CompanyFinance() {
  const { data: summary } = useQuery({
    queryKey: ['company-finance'],
    queryFn: async () => {
      const r = await api.get<{ totalCosts: number; projectCount: number }>('/api/admin/finance/company-summary')
      return r.ok ? r.data : null
    },
  })

  return (
    <div>
      <PageHeader title="Company Finance" description="Rollup across all projects." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Total costs</div>
          <div className="text-2xl font-semibold">${(summary?.totalCosts || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Projects with costs</div>
          <div className="text-2xl font-semibold">{summary?.projectCount || 0}</div>
        </CardContent></Card>
      </div>
      <CommissionReports />
    </div>
  )
}
