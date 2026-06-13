import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api'
import { PageHeader } from '../../layout/PageHeader'
import { Button } from '../../components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

export default function FormEmbed() {
  const { id } = useParams()
  const [copied, setCopied] = useState(false)

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: async () => {
      const r = await api.get<any>(`/api/admin/forms/${id}`)
      return r.ok ? r.data : null
    },
  })

  const { data: links } = useQuery({
    queryKey: ['form-links', id],
    queryFn: async () => {
      const r = await api.get<any[]>(`/api/admin/forms/${id}/links`)
      return r.ok ? r.data : []
    },
    enabled: !!id,
  })

  const firstLink = links?.[0]
  const formUrl = firstLink
    ? firstLink.customDomain
      ? `https://${firstLink.customDomain}${firstLink.customPath || ''}`
      : `${window.location.origin}/f/${firstLink.slug}`
    : null

  const iframeCode = formUrl
    ? `<iframe src="${formUrl}" width="100%" height="600" frameborder="0"></iframe>`
    : ''

  const copyToClipboard = async () => {
    if (!iframeCode) return
    try {
      await navigator.clipboard.writeText(iframeCode)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <div>
      <PageHeader title={`Embed: ${form?.name || ''}`} description="Embed this form on any website" />
      {!firstLink ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <p className="text-sm">Create a link first in the Links tab before embedding.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium">Iframe Embed</h3>
            <div className="relative">
              <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{iframeCode}</pre>
              <Button
                variant="outline" size="sm"
                className="absolute right-2 top-2"
                onClick={copyToClipboard}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium">Preview</h3>
            <div className="overflow-hidden rounded border">
              <iframe src={formUrl ?? undefined} width="100%" height="500" title="Form preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
