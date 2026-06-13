import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SectionTabs } from '../../layout/SectionTabs'
import { api } from '../../api'

export default function LeadsLayout() {
  const { data: dncCount = 0 } = useQuery({
    queryKey: ['leads', 'dnc', 'count'],
    queryFn: async () => {
      const r = await api.get<any[]>('/api/admin/leads/dnc')
      if (r.ok && r.data) return r.data.length
      return 0
    },
  })

  return (
    <div>
      <SectionTabs
        tabs={[
          { label: 'Pipeline', path: '/company/leads', end: true },
          { label: 'Do Not Contact', path: '/company/leads/dnc', badge: dncCount },
        ]}
      />
      <Outlet />
    </div>
  )
}
