import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../api'
import { useConfirm } from '../../components/ConfirmDialog'
import { PageHeader } from '../../layout/PageHeader'
import { Button } from '../../components/ui/button'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormDefinition } from '@strikescope/shared/src/types'
import { FileText, Plus, Pencil, Trash2, Link, Code, Eye, ClipboardList } from 'lucide-react'

export default function FormsList() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['forms', search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const r = await api.get<any[]>('/api/admin/forms' + params)
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/forms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] })
      toast.success('Form deleted')
    },
  })

  const handleDelete = async (form: FormDefinition) => {
    const ok = await confirm({ title: 'Delete Form', description: `Delete "${form.name}"? This cannot be undone.`, confirmLabel: 'Delete' })
    if (ok) deleteMutation.mutate(form.id)
  }

  return (
    <div>
      <PageHeader
        title="Forms"
        description="Create and manage embeddable forms"
        actions={
          <Button onClick={() => navigate('/company/forms/new')}>
            <Plus className="h-4 w-4" /> New Form
          </Button>
        }
      />
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search forms..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : !data?.length ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <FileText className="h-12 w-12" />
          <p className="text-lg font-medium">No forms yet</p>
          <p className="text-sm">Create your first form to get started.</p>
          <Button onClick={() => navigate('/company/forms/new')} className="mt-2">
            <Plus className="h-4 w-4" /> New Form
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((form: any) => (
            <div key={form.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
              <div className="flex-1">
                <h3 className="font-medium">{form.name}</h3>
                {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/company/forms/${form.id}/preview`)} title="Preview"><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/company/forms/${form.id}/edit`)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/company/forms/${form.id}/links`)} title="Links"><Link className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/company/forms/${form.id}/embed`)} title="Embed"><Code className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/company/forms/${form.id}/submissions`)} title="Submissions"><ClipboardList className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(form)} title="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
