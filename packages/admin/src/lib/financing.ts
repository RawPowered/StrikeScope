import type { FinancingType } from '@strikescope/shared/src/types'

export const FINANCING_TYPE_OPTIONS: { value: FinancingType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'loan', label: 'Loan' },
  { value: 'lease', label: 'Lease' },
  { value: 'co_op', label: 'Co-Op' },
  { value: 'other', label: 'Other' },
]

export function financingTypeLabel(value: string | null | undefined): string {
  return FINANCING_TYPE_OPTIONS.find(o => o.value === value)?.label || value || '—'
}

export function financingNeedsBank(value: string | null | undefined): boolean {
  return value === 'loan' || value === 'lease'
}
