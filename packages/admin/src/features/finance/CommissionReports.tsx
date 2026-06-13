import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Card, CardContent } from '../../components/ui/card'
import { useAuth } from '../../auth'

export default function CommissionReports() {
  const { user } = useAuth()
  const isAgent = user?.roleName === 'Sales Agent'
  const [name, setName] = useState('')

  const { data: reports = [], refetch } = useQuery({
    queryKey: ['commission-reports'],
    queryFn: async () => {
      const r = await api.get<any[]>('/api/admin/finance/reports')
      return r.ok && r.data ? r.data : []
    },
  })

  const { data: formulas = [] } = useQuery({
    queryKey: ['commission-formulas'],
    queryFn: async () => {
      const r = await api.get<any[]>('/api/admin/finance/formulas')
      return r.ok && r.data ? r.data : []
    },
    enabled: !isAgent,
  })

  const generate = async () => {
    const formulaId = formulas.find((f: any) => f.isDefault)?.id || formulas[0]?.id
    if (!formulaId) return toast.error('Save a commission formula first')
    const r = await api.post('/api/admin/finance/reports/generate', { name: name || 'Commission Report', formulaId }).catch(() => null)
    if (r?.ok) { toast.success('Report generated'); refetch() }
    else toast.error(r?.error || 'Failed')
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{isAgent ? 'My Payouts' : 'Commission Reports'}</h2>
      {!isAgent && (
        <div className="flex gap-2 mb-4">
          <Input placeholder="Report name" value={name} onChange={e => setName(e.target.value)} className="max-w-xs" />
          <Button onClick={generate}>Generate report</Button>
        </div>
      )}
      <div className="space-y-2">
        {reports.map((r: any) => (
          <Card key={r.id || r.reportId}>
            <CardContent className="py-3 flex justify-between text-sm">
              <span>{r.name}</span>
              {isAgent ? <span className="font-medium">${Number(r.payoutAmount || 0).toFixed(2)}</span> : <span className="text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>}
            </CardContent>
          </Card>
        ))}
        {reports.length === 0 && <p className="text-sm text-muted-foreground">No reports yet.</p>}
      </div>
    </div>
  )
}
