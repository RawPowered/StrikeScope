import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'
import { useAuth } from '../../auth'
import { useCloneTemplate, useTemplates } from './useAutomations'

export default function AutomationTemplatesPanel() {
  const { user } = useAuth()
  const templates = useTemplates()
  const cloneTemplate = useCloneTemplate()
  const [companyId, setCompanyId] = useState(user?.companyId || '')

  useEffect(() => {
    templates.refetch()
  }, [])

  if (user?.role !== 'server_admin') {
    return <p className="text-sm text-muted-foreground">Server admin only.</p>
  }

  const flows = templates.data?.flows || []
  const apiError = templates.data?.error

  const handleClone = async (templateId: string) => {
    if (!companyId.trim()) {
      toast.error('Target company ID is required')
      return
    }
    try {
      const result = await cloneTemplate.mutateAsync({ templateId, companyId: companyId.trim() })
      toast.success(result.flowId ? `Cloned flow ${result.flowId}` : 'Template cloned')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Platform templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Templates live in the <code>platform:templates</code> Activepieces project.
            Set <code>ACTIVEPIECES_PLATFORM_ADMIN_TOKEN</code> on the server to enable listing and clone.
          </p>
          {apiError && <p className="text-sm text-amber-500">{apiError}</p>}
          <div className="max-w-md">
            <Label>Clone to company ID</Label>
            <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="company uuid" />
          </div>
          {templates.isLoading && <p className="text-sm">Loading…</p>}
          <ul className="space-y-2">
            {flows.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 border rounded p-3">
                <div>
                  <div className="font-medium">{f.name}</div>
                  <Badge variant="secondary" className="mt-1">{f.status}</Badge>
                </div>
                <Button size="sm" onClick={() => handleClone(f.id)} disabled={cloneTemplate.isPending}>
                  Clone to company
                </Button>
              </li>
            ))}
          </ul>
          {!templates.isLoading && flows.length === 0 && !apiError && (
            <p className="text-sm text-muted-foreground">No templates found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
