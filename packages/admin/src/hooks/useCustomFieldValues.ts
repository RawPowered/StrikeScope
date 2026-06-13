import { useState, useCallback } from 'react'
import { api } from '../api'

export function useCustomFieldValues(entity: string, entityId?: string) {
  const [values, setValues] = useState<Record<string, string | null>>({})

  const setValue = useCallback((fieldDefinitionId: string, value: string | null) => {
    setValues(prev => ({ ...prev, [fieldDefinitionId]: value }))
  }, [])

  const save = async (recordId: string) => {
    const payload = Object.entries(values).map(([fieldDefinitionId, value]) => ({ fieldDefinitionId, value }))
    if (!payload.length) return true
    const r = await api.put(`/api/admin/custom-values/${entity}/${recordId}`, { values: payload })
    return r.ok
  }

  const reset = () => setValues({})

  return { values, setValue, save, reset, setValues }
}
