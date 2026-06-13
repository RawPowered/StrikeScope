import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api'
import { PageHeader } from '../../layout/PageHeader'
import { Button } from '../../components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { Download, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

export default function FormSubmissions() {
  const { id } = useParams()
  const [page, setPage] = useState(1)
  const perPage = 25

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: async () => {
      const r = await api.get<any>(`/api/admin/forms/${id}`)
      return r.ok ? r.data : null
    },
  })

  const { data: stats } = useQuery({
    queryKey: ['form-stats', id],
    queryFn: async () => {
      const r = await api.get<{ totalSubmissions: number }>(`/api/admin/forms/${id}/stats`)
      return r.ok ? r.data : null
    },
    enabled: !!id,
  })

  const { data: submissionsData, isLoading } = useQuery({
    queryKey: ['form-submissions', id, page],
    queryFn: async () => {
      const r = await api.get<any>(`/api/admin/forms/${id}/submissions?page=${page}&perPage=${perPage}`)
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r as typeof r & { total: number; page: number; perPage: number }
    },
    enabled: !!id,
  })

  const exportCsv = () => {
    if (!submissionsData?.data?.length) {
      toast.error('No submissions to export')
      return
    }
    const allKeys = new Set<string>()
    const rows: any[] = []
    for (const sub of submissionsData.data) {
      let parsed: any
      try { parsed = JSON.parse(sub.responseJson) } catch { parsed = {} }
      Object.keys(parsed).forEach(k => allKeys.add(k))
      rows.push(parsed)
    }
    const keys = Array.from(allKeys)
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${form?.name || 'form'}-submissions.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported CSV')
  }

  const total = submissionsData?.total || 0
  const totalPages = Math.ceil(total / perPage)

  return (
    <div>
      <PageHeader
        title={`Submissions: ${form?.name || ''}`}
        description={stats ? `${stats.totalSubmissions} total submissions` : ''}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!submissionsData?.data?.length}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : !submissionsData?.data?.length ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <ClipboardList className="h-8 w-8" />
          <p className="text-sm">No submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissionsData.data.map((sub: any) => {
            let parsed: any
            try { parsed = JSON.parse(sub.responseJson) } catch { parsed = {} }
            return (
              <div key={sub.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="mb-1 text-xs text-muted-foreground">
                  {new Date(sub.createdAt).toLocaleString()}
                </div>
                <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(parsed, null, 2)}</pre>
              </div>
            )
          })}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
