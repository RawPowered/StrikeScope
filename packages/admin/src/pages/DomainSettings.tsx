import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import { useConfirm } from '../components/ConfirmDialog'
import { PageHeader } from '../layout/PageHeader'
import { FormDialog } from '../components/ViewToggle'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { LoadingState } from '../components/EmptyState'
import { useQuery } from '@tanstack/react-query'
import type { CompanyDomain, Company } from '@strikescope/shared/src/types'

export default function DomainSettings() {
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ companyId: '', domain: '', isPrimary: false, isSandbox: true })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      const [d, c] = await Promise.all([
        api.get<CompanyDomain[]>('/api/admin/domains'),
        api.get<Company[]>('/api/admin/companies'),
      ])
      return {
        domains: d.ok && d.data ? d.data : [],
        companies: c.ok && c.data ? c.data : [],
      }
    },
  })

  const domains = data?.domains ?? []
  const companies = data?.companies ?? []

  const handleCreate = async () => {
    if (!form.companyId || !form.domain.trim()) return
    const r = await api.post('/api/admin/domains', form).catch(() => null)
    if (r?.ok) {
      toast.success('Domain created')
      setShowForm(false)
      setForm({ companyId: '', domain: '', isPrimary: false, isSandbox: true })
      refetch()
    } else toast.error(r?.error || 'Failed to create')
  }

  const handleTogglePrimary = async (id: string) => {
    const r = await api.put(`/api/admin/domains/${id}`, { isPrimary: true }).catch(() => null)
    if (r?.ok) { toast.success('Primary updated'); refetch() }
    else toast.error('Failed to update')
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    const r = await api.put(`/api/admin/domains/${id}`, { isActive: active }).catch(() => null)
    if (r?.ok) refetch()
    else toast.error('Failed to update')
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Delete domain?', variant: 'destructive', confirmLabel: 'Delete' })
    if (!ok) return
    const r = await api.del(`/api/admin/domains/${id}`).catch(() => null)
    if (r?.ok) { toast.success('Deleted'); refetch() }
    else toast.error('Failed to delete')
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Domains" />
        <LoadingState rows={4} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Domains"
        description="Company subdomains for workspace access (https://{subdomain}.sandbox.localhost)"
        actions={<Button onClick={() => setShowForm(true)}>+ Add Domain</Button>}
      />

      <div className="space-y-6">
        {companies.map(company => {
          const companyDomains = domains.filter(d => d.companyId === company.id)
          return (
            <div key={company.id}>
              <h3 className="text-sm font-semibold mb-2">{company.name}</h3>
              {companyDomains.length === 0 ? (
                <p className="text-xs text-muted-foreground">No domains configured.</p>
              ) : (
                <div className="space-y-2">
                  {companyDomains.map(d => (
                    <Card key={d.id}>
                      <CardContent className="py-3 flex justify-between items-center gap-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{d.domain}.sandbox.localhost</span>
                          {d.isPrimary && <Badge variant="success">Primary</Badge>}
                          {d.isSandbox && <Badge variant="secondary">Sandbox</Badge>}
                          {!d.isActive && <Badge variant="outline">Inactive</Badge>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!d.isPrimary && <Button variant="outline" size="sm" onClick={() => handleTogglePrimary(d.id)}>Set Primary</Button>}
                          <Button variant="outline" size="sm" onClick={() => handleToggleActive(d.id, !d.isActive)}>
                            {d.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          {!d.isPrimary && <Button variant="destructive" size="sm" onClick={() => handleDelete(d.id)}>Del</Button>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <FormDialog open={showForm} title="New Domain" onClose={() => setShowForm(false)} footer={
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Save</Button>
        </div>
      }>
        <div className="space-y-3">
          <div>
            <Label>Company</Label>
            <Select value={form.companyId} onChange={e => setForm(p => ({ ...p, companyId: e.target.value }))} className="mt-1">
              <option value="">— Select —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Subdomain</Label>
            <div className="flex items-center gap-1 mt-1">
              <Input value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} placeholder="company-name" />
              <span className="text-xs text-muted-foreground shrink-0">.sandbox.localhost</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPrimary} onChange={e => setForm(p => ({ ...p, isPrimary: e.target.checked }))} />
            Primary domain
          </label>
        </div>
      </FormDialog>
    </div>
  )
}
