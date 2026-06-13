import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select } from './ui/select'
import { LoadingState } from './EmptyState'
import type { CustomFieldDefinition } from '@strikescope/shared/src/types'

interface CustomFieldValue {
  fieldDefinitionId: string
  value: string | null
  fieldName: string
  label: string
  fieldType: string
  optionsJson?: string
  isRequired: boolean
  sortOrder: number
}

interface Props {
  entity: string
  entityId?: string
  mode: 'view' | 'edit'
  values?: CustomFieldValue[]
  onChange?: (fieldDefinitionId: string, value: string | null) => void
}

function formatCurrency(val: string): string {
  const n = parseFloat(val)
  if (isNaN(n)) return val
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 10)
  if (digits.length < 4) return digits
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function validateEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
}

function validateUrl(val: string): boolean {
  return /^https?:\/\/.+/.test(val)
}

function renderViewValue(field: CustomFieldValue): string {
  if (field.value == null) return '—'
  switch (field.fieldType) {
    case 'currency': return formatCurrency(field.value)
    case 'phone': return formatPhone(field.value)
    case 'boolean': return field.value === 'true' ? 'Yes' : 'No'
    case 'date': return field.value ? new Date(field.value).toLocaleDateString() : '—'
    case 'multiselect': {
      try { return JSON.parse(field.value).join(', ') } catch { return field.value }
    }
    default: return field.value
  }
}

function parseOptions(json: string | undefined): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return json.split(',').map(s => s.trim()).filter(Boolean)
  }
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-2 border-b border-border last:border-0 text-sm items-start">
      <Label className="text-muted-foreground pt-2">{label}</Label>
      <div>{children}</div>
    </div>
  )
}

function renderEditField(def: CustomFieldDefinition, value: string | null, onChange: (id: string, val: string | null) => void) {
  const val = value || ''

  switch (def.fieldType) {
    case 'textarea':
      return <Textarea value={val} onChange={e => onChange(def.id, e.target.value || null)} rows={3} />

    case 'number':
      return <Input type="number" value={val} onChange={e => onChange(def.id, e.target.value || null)} />

    case 'currency':
      return <Input type="number" step="0.01" value={val} onChange={e => onChange(def.id, e.target.value || null)} placeholder="0.00" className="max-w-[160px]" />

    case 'phone':
      return <Input value={formatPhone(val)} onChange={e => onChange(def.id, e.target.value.replace(/\D/g, '').slice(0, 10) || null)} placeholder="(555) 555-5555" className="max-w-[180px]" />

    case 'email':
      return (
        <div>
          <Input type="email" value={val} onChange={e => onChange(def.id, e.target.value || null)} placeholder="email@example.com" className="max-w-xs" />
          {val && !validateEmail(val) && <span className="text-xs text-destructive ml-2">Invalid email</span>}
        </div>
      )

    case 'url':
      return (
        <div>
          <Input value={val} onChange={e => onChange(def.id, e.target.value || null)} placeholder="https://example.com" className="max-w-md" />
          {val && !validateUrl(val) && <span className="text-xs text-destructive ml-2">Must start with http(s)://</span>}
        </div>
      )

    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={val === 'true'} onChange={e => onChange(def.id, e.target.checked ? 'true' : 'false')} />
          {val === 'true' ? 'Yes' : 'No'}
        </label>
      )

    case 'date':
      return <Input type="date" value={val} onChange={e => onChange(def.id, e.target.value || null)} className="max-w-[180px]" />

    case 'select': {
      const options = parseOptions(def.optionsJson)
      return (
        <Select value={val} onChange={e => onChange(def.id, e.target.value || null)}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </Select>
      )
    }

    case 'multiselect': {
      const options = parseOptions(def.optionsJson)
      const selected: string[] = val ? (() => { try { return JSON.parse(val) } catch { return [] } })() : []
      return (
        <div className="flex flex-wrap gap-3">
          {options.map(o => (
            <label key={o} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={e => {
                  const next = e.target.checked ? [...selected, o] : selected.filter(s => s !== o)
                  onChange(def.id, next.length > 0 ? JSON.stringify(next) : null)
                }}
              />
              {o}
            </label>
          ))}
        </div>
      )
    }

    default:
      return <Input value={val} onChange={e => onChange(def.id, e.target.value || null)} />
  }
}

export default function CustomFieldRenderer({ entity, entityId, mode, values: propValues, onChange }: Props) {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([])
  const [values, setValues] = useState<CustomFieldValue[]>(propValues || [])
  const [loading, setLoading] = useState(!propValues)

  useEffect(() => {
    api.get<{ custom: CustomFieldDefinition[] }>(`/api/admin/field-settings/${entity}`).then(r => {
      if (r.ok && r.data?.custom) setDefinitions(r.data.custom.filter(d => d.isEnabled !== false))
    }).finally(() => {
      if (propValues) setLoading(false)
    })
  }, [entity, propValues])

  useEffect(() => {
    if (propValues) { setValues(propValues); setLoading(false); return }
    if (!entityId) { setLoading(false); return }
    api.get<CustomFieldValue[]>(`/api/admin/custom-values/${entity}/${entityId}`).then(r => {
      if (r.ok && r.data) setValues(r.data)
    }).finally(() => setLoading(false))
  }, [entity, entityId, propValues])

  const handleChange = (fieldDefinitionId: string, value: string | null) => {
    setValues(prev => {
      const existing = prev.find(v => v.fieldDefinitionId === fieldDefinitionId)
      if (existing) {
        return prev.map(v => v.fieldDefinitionId === fieldDefinitionId ? { ...v, value } : v)
      }
      const def = definitions.find(d => d.id === fieldDefinitionId)
      return [...prev, { fieldDefinitionId, value, fieldName: def?.fieldName || '', label: def?.label || '', fieldType: def?.fieldType || 'text', isRequired: def?.isRequired || false, sortOrder: def?.sortOrder || 0 }]
    })
    onChange?.(fieldDefinitionId, value)
  }

  const getValue = (fieldDefId: string): string | null => {
    return values.find(v => v.fieldDefinitionId === fieldDefId)?.value ?? null
  }

  const getFieldValue = (fieldName: string): CustomFieldValue | undefined => {
    return values.find(v => v.fieldName === fieldName)
  }

  if (loading && !propValues) return <LoadingState rows={2} />
  if (definitions.length === 0) return null

  return (
    <div className="mt-2">
      {definitions.map(def => {
        const fieldVal = getValue(def.id)
        const valObj = getFieldValue(def.fieldName)

        if (mode === 'view') {
          return (
            <FieldRow key={def.id} label={def.label}>
              {renderViewValue(valObj || { ...def, fieldDefinitionId: def.id, value: fieldVal })}
            </FieldRow>
          )
        }

        return (
          <FieldRow key={def.id} label={`${def.label}${def.isRequired ? ' *' : ''}`}>
            {renderEditField(def, fieldVal, handleChange)}
          </FieldRow>
        )
      })}
    </div>
  )
}
