import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent } from '../../components/ui/card'
import { FormulaBuilder } from './FormulaBuilder'

interface CostLine { id: string; label: string; category: string; amount: number }

export default function ProjectFinanceTab({ projectId }: { projectId: string }) {
  const [costForm, setCostForm] = useState({ label: '', category: '', amount: '' })
  const [formulaExpr, setFormulaExpr] = useState('')

  const { data: costs = [], refetch: refetchCosts } = useQuery({
    queryKey: ['project-costs', projectId],
    queryFn: async () => {
      const r = await api.get<CostLine[]>(`/api/admin/finance/projects/${projectId}/costs`)
      return r.ok && r.data ? r.data : []
    },
  })

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['project-finance', projectId],
    queryFn: async () => {
      const r = await api.get<any>(`/api/admin/finance/projects/${projectId}/summary`)
      return r.ok ? r.data : null
    },
  })

  const addCost = async () => {
    const r = await api.post(`/api/admin/finance/projects/${projectId}/costs`, {
      label: costForm.label, category: costForm.category, amount: parseFloat(costForm.amount) || 0,
    }).catch(() => null)
    if (r?.ok) { toast.success('Cost added'); setCostForm({ label: '', category: '', amount: '' }); refetchCosts(); refetchSummary() }
    else toast.error(r?.error || 'Failed')
  }

  const saveFormula = async () => {
    const r = await api.post('/api/admin/finance/formulas', {
      name: 'Default Commission', formulaJson: { expression: formulaExpr }, isDefault: true,
    }).catch(() => null)
    if (r?.ok) toast.success('Formula saved')
    else toast.error(r?.error || 'Failed')
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="pt-4">
        <h3 className="font-medium mb-2">Cost lines</h3>
        <div className="space-y-2 mb-3">
          {costs.map(c => (
            <div key={c.id} className="flex justify-between text-sm border-b border-border py-1">
              <span>{c.label} {c.category ? `(${c.category})` : ''}</span>
              <span>${c.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Label" value={costForm.label} onChange={e => setCostForm(f => ({ ...f, label: e.target.value }))} />
          <Input placeholder="Category" value={costForm.category} onChange={e => setCostForm(f => ({ ...f, category: e.target.value }))} />
          <Input placeholder="Amount" type="number" value={costForm.amount} onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))} />
        </div>
        <Button size="sm" className="mt-2" onClick={addCost}>Add cost</Button>
      </CardContent></Card>

      <Card><CardContent className="pt-4">
        <h3 className="font-medium mb-2">Commission formula</h3>
        <FormulaBuilder value={formulaExpr} onChange={setFormulaExpr} />
        <Button size="sm" className="mt-2" onClick={saveFormula}>Save formula</Button>
      </CardContent></Card>

      {summary?.computed && (
        <Card><CardContent className="pt-4">
          <h3 className="font-medium mb-2">Calculated values</h3>
          {Object.entries(summary.computed).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm py-1"><span>{k}</span><span>{v != null ? `$${Number(v).toFixed(2)}` : '—'}</span></div>
          ))}
        </CardContent></Card>
      )}
    </div>
  )
}
