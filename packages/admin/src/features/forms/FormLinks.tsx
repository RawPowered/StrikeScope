import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../../api'
import { useConfirm } from '../../components/ConfirmDialog'
import { PageHeader } from '../../layout/PageHeader'
import { Button } from '../../components/ui/button'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link as LinkIcon, Trash2, Plus, Globe } from 'lucide-react'

export default function FormLinks() {
  const { id } = useParams()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState('')
  const [customDomain, setCustomDomain] = useState('')
  const [customPath, setCustomPath] = useState('')

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: async () => {
      const r = await api.get<any>(`/api/admin/forms/${id}`)
      return r.ok ? r.data : null
    },
  })

  const { data: links, isLoading } = useQuery({
    queryKey: ['form-links', id],
    queryFn: async () => {
      const r = await api.get<any[]>(`/api/admin/forms/${id}/links`)
      return r.ok ? r.data : []
    },
    enabled: !!id,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!slug.trim()) throw new Error('Slug is required')
      return api.post(`/api/admin/forms/${id}/links`, { slug: slug.trim(), customDomain: customDomain.trim() || null, customPath: customPath.trim() || null })
    },
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: ['form-links'] })
        toast.success('Link created')
        setSlug('')
        setCustomDomain('')
        setCustomPath('')
      } else {
        toast.error(r.error || 'Failed to create link')
      }
    },
    onError: (e: any) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) => api.del(`/api/admin/forms/${id}/links/${linkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-links'] })
      toast.success('Link deleted')
    },
  })

  const handleDelete = async (linkId: string) => {
    const ok = await confirm({ title: 'Delete Link', description: 'Remove this form link?', confirmLabel: 'Delete' })
    if (ok) deleteMutation.mutate(linkId)
  }

  const previewUrl = (link: any) => {
    if (link.customDomain) {
      return `https://${link.customDomain}${link.customPath || ''}`
    }
    return `/f/${link.slug}`
  }

  return (
    <div>
      <PageHeader title={`Links: ${form?.name || ''}`} description="Manage public URLs for this form" />
      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-medium">Add Link</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Slug *</label>
            <input
              type="text" value={slug} onChange={e => setSlug(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="contact-us"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Custom Domain (optional)</label>
            <input
              type="text" value={customDomain} onChange={e => setCustomDomain(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="forms.mycompany.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Path (optional)</label>
            <input
              type="text" value={customPath} onChange={e => setCustomPath(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="/contact"
            />
          </div>
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : !links?.length ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <LinkIcon className="h-8 w-8" />
          <p className="text-sm">No links yet. Add a slug above to create a public URL.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link: any) => (
            <div key={link.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-blue-500" />
                <div>
                  <a href={previewUrl(link)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
                    {previewUrl(link)}
                  </a>
                  {link.customDomain && <span className="ml-2 rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800">custom domain</span>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(link.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
