import { useEffect, useState } from 'react'
import { api } from '../api'

const LOCKED_BY_ENTITY: Record<string, string[]> = {
  leads: ['name', 'email'],
  customers: ['name', 'email'],
  contacts: ['name', 'email'],
  projects: ['name'],
  agreements: ['name'],
  submissions: [],
  activities: [],
}

export function useColumnPreferences(entity: string, defaultColumns: string[]) {
  const [columns, setColumns] = useState<string[]>(defaultColumns)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.get<string>(`/api/admin/column-preferences/${entity}`).then(r => {
      if (r.ok && r.data) {
        try {
          const parsed = JSON.parse(typeof r.data === 'string' ? r.data : '[]')
          if (Array.isArray(parsed) && parsed.length) {
            const locked = LOCKED_BY_ENTITY[entity] || []
            const merged = [...new Set([...locked, ...parsed])]
            setColumns(merged)
          }
        } catch { /* keep defaults */ }
      }
    }).finally(() => setLoaded(true))
  }, [entity])

  const save = async (cols: string[]) => {
    const locked = LOCKED_BY_ENTITY[entity] || []
    const merged = [...new Set([...locked, ...cols])]
    setColumns(merged)
    await api.put(`/api/admin/column-preferences/${entity}`, { columns: merged })
  }

  return { columns, setColumns, save, loaded }
}
