import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { Label } from '../../components/ui/label'
import { Select } from '../../components/ui/select'
import type { CompanyBank } from '@strikescope/shared/src/types'
import { FINANCING_TYPE_OPTIONS, financingNeedsBank } from '../../lib/financing'

export interface FinancingFieldsValue {
  financingType: string
  bankId: string
}

interface Props {
  value: FinancingFieldsValue
  onChange: (v: Partial<FinancingFieldsValue>) => void
}

export function FinancingFields({ value, onChange }: Props) {
  const { data: banks = [] } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const r = await api.get<CompanyBank[]>('/api/admin/banks')
      return r.ok && r.data ? r.data.filter(b => b.isActive) : []
    },
  })

  const showBank = financingNeedsBank(value.financingType)

  return (
    <>
      <div>
        <Label>Financing Type</Label>
        <Select
          className="mt-1 w-full"
          value={value.financingType}
          onChange={e => {
            const financingType = e.target.value
            onChange({ financingType, bankId: financingNeedsBank(financingType) ? value.bankId : '' })
          }}
        >
          <option value="">—</option>
          {FINANCING_TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>
      {showBank && (
        <div>
          <Label>Bank *</Label>
          <Select className="mt-1 w-full" value={value.bankId} onChange={e => onChange({ bankId: e.target.value })}>
            <option value="">— Select bank —</option>
            {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          {banks.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">Add bank names in Admin → Bank Names.</p>
          )}
        </div>
      )}
    </>
  )
}
