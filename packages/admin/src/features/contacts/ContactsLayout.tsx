import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { SectionTabs } from '../../layout/SectionTabs'
import type { TerritoryConfig } from '@strikescope/shared/src/types'

export default function ContactsLayout() {
  const { data: territory } = useQuery({
    queryKey: ['territory'],
    queryFn: async () => {
      const r = await api.get<TerritoryConfig>('/api/admin/territory')
      return r.ok ? r.data : null
    },
  })

  const tabs = [
    { label: 'Customer Contacts', path: '/company/contacts', end: true },
    ...(territory?.directoryContactsEnabled !== false
      ? [{ label: 'Directory', path: '/company/contacts/directory' }]
      : []),
  ]

  return (
    <div>
      <SectionTabs tabs={tabs} />
      <Outlet />
    </div>
  )
}
