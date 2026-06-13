import { US_STATES } from './us-states'
import { COUNTRIES } from './countries'

export type { Option } from './us-states'
export { US_STATES, COUNTRIES }

export const ADDRESS_SUFFIXES = [
  { value: 'St', label: 'Street' },
  { value: 'Ave', label: 'Avenue' },
  { value: 'Blvd', label: 'Boulevard' },
  { value: 'Dr', label: 'Drive' },
  { value: 'Ln', label: 'Lane' },
  { value: 'Rd', label: 'Road' },
  { value: 'Ct', label: 'Court' },
  { value: 'Pl', label: 'Place' },
  { value: 'Way', label: 'Way' },
  { value: 'Cir', label: 'Circle' },
  { value: 'Ter', label: 'Terrace' },
  { value: 'Hwy', label: 'Highway' },
]

const OPTIONS_MAP: Record<string, { value: string; label: string }[]> = {
  'us-states': US_STATES,
  'countries': COUNTRIES,
  'address-suffixes': ADDRESS_SUFFIXES,
}

export function getDropdownOptions(ref: string): { value: string; label: string }[] {
  return OPTIONS_MAP[ref] || []
}

export function getDropdownRefs(): string[] {
  return Object.keys(OPTIONS_MAP)
}
