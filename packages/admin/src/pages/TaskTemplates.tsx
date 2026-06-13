import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api'
import { useConfirm } from '../components/ConfirmDialog'
import { PageHeader } from '../layout/PageHeader'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { LoadingState, EmptyState } from '../components/EmptyState'
import { cn } from '../lib/utils'
import { useQuery } from '@tanstack/react-query'
import type { ProjectType } from '@strikescope/shared/src/types'

interface TemplateItem {
  id: string; templateId: string; label: string; sortOrder: number
  titleEn: string; titleEs: string; descEn: string; descEs: string
  requiredCount: number; exampleImage: string | null
}

interface TaskTemplate {
  id: string; companyId: string | null; projectTypeId: string | null
  name: string; description: string | null
  isGlobal: boolean; isDefault: boolean; isPublished: boolean
  sourceTemplateId: string | null; isActive: boolean; createdAt: string
  enableTimeTracking?: boolean; enableStaleWarnings?: boolean
  slaDaysNotStarted?: number | null; slaDaysIncomplete?: number | null
  staleDaysIdle?: number | null; geofenceRadiusM?: number | null
  itemCount?: number; items?: TemplateItem[]
}

export default function TaskTemplates() {
  const confirm = useConfirm()
  const [selected, setSelected] = useState<TaskTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', projectTypeId: '', isDefault: false })
  const [editItem, setEditItem] = useState<{ id?: string; label: string; titleEn: string; titleEs: string; descEn: string; descEs: string; requiredCount: number } | null>(null)

  const { data: templates = [], isLoading, refetch } = useQuery({
    queryKey: ['task-templates'],
    queryFn: async () => {
      const r = await api.get<TaskTemplate[]>('/api/admin/task-templates')
      if (!r.ok) throw new Error(r.error || 'Failed to load')
      return r.data || []
    },
  })

  const { data: projectTypes = [] } = useQuery({
    queryKey: ['project-types'],
    queryFn: async () => {
      const r = await api.get<ProjectType[]>('/api/admin/project-types')
      return r.ok && r.data ? r.data : []
    },
  })

  const selectTemplate = async (id: string) => {
    const r = await api.get<TaskTemplate>(`/api/admin/task-templates/${id}`).catch(() => null)
    if (r?.ok && r.data) setSelected(r.data)
    else toast.error('Failed to load template')
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    const r = await api.post('/api/admin/task-templates', {
      name: form.name, description: form.description,
      projectTypeId: form.projectTypeId || null,
      isGlobal: true, isDefault: form.isDefault,
    }).catch(() => null)
    if (r?.ok) {
      toast.success('Template created')
      setShowForm(false)
      setForm({ name: '', description: '', projectTypeId: '', isDefault: false })
      refetch()
    } else toast.error(r?.error || 'Failed to create')
  }

  const handleSaveItem = async () => {
    if (!editItem || !editItem.label || !editItem.titleEn || !selected) return
    const r = editItem.id
      ? await api.put(`/api/admin/task-templates/${selected.id}/items/${editItem.id}`, editItem).catch(() => null)
      : await api.post(`/api/admin/task-templates/${selected.id}/items`, editItem).catch(() => null)
    if (r?.ok) { toast.success('Item saved'); setEditItem(null); selectTemplate(selected.id) }
    else toast.error('Failed to save item')
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!selected) return
    const ok = await confirm({ title: 'Delete item?', variant: 'destructive', confirmLabel: 'Delete' })
    if (!ok) return
    const r = await api.del(`/api/admin/task-templates/${selected.id}/items/${itemId}`).catch(() => null)
    if (r?.ok) selectTemplate(selected.id)
    else toast.error('Failed to delete')
  }

  const toggleDefault = async (tmpl: TaskTemplate) => {
    const r = await api.put(`/api/admin/task-templates/${tmpl.id}`, { isDefault: !tmpl.isDefault, projectTypeId: tmpl.projectTypeId }).catch(() => null)
    if (r?.ok) { refetch(); if (selected?.id === tmpl.id) selectTemplate(tmpl.id) }
    else toast.error('Failed to update')
  }

  const saveTemplateSettings = async (patch: Partial<TaskTemplate>) => {
    if (!selected) return
    const r = await api.put(`/api/admin/task-templates/${selected.id}`, {
      enableTimeTracking: patch.enableTimeTracking ?? selected.enableTimeTracking,
      enableStaleWarnings: patch.enableStaleWarnings ?? selected.enableStaleWarnings,
      slaDaysNotStarted: patch.slaDaysNotStarted ?? selected.slaDaysNotStarted,
      slaDaysIncomplete: patch.slaDaysIncomplete ?? selected.slaDaysIncomplete,
      staleDaysIdle: patch.staleDaysIdle ?? selected.staleDaysIdle,
      geofenceRadiusM: patch.geofenceRadiusM ?? selected.geofenceRadiusM,
    }).catch(() => null)
    if (r?.ok) { toast.success('Settings saved'); selectTemplate(selected.id) }
    else toast.error('Failed to save settings')
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Task Templates" />
        <LoadingState rows={5} />
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[60vh]">
      <div className="w-full lg:w-80 shrink-0">
        <PageHeader title="Templates" actions={<Button size="sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New'}</Button>} />

        {showForm && (
          <Card className="mb-4">
            <CardContent className="pt-4 space-y-3">
              <div><Label>Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Description</Label><Input className="mt-1" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div>
                <Label>Project Type</Label>
                <Select value={form.projectTypeId} onChange={e => setForm(p => ({ ...p, projectTypeId: e.target.value }))} className="mt-1">
                  <option value="">— Any —</option>
                  {projectTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))} />
                Default for project type
              </label>
              <Button size="sm" onClick={handleCreate}>Create</Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {templates.map(t => (
            <Card
              key={t.id}
              className={cn('cursor-pointer transition-colors hover:border-primary/40', selected?.id === t.id && 'border-primary bg-muted/30')}
              onClick={() => selectTemplate(t.id)}
            >
              <CardContent className="py-3 flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium">{t.name}</span>
                  {t.isDefault && <Badge variant="success" className="ml-2">Default</Badge>}
                  {t.isGlobal && <Badge variant="secondary" className="ml-1">Global</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">{t.itemCount || 0} items</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {!selected ? (
          <EmptyState title="Select a template" description="Choose a template from the list to view and edit its items." />
        ) : (
          <div>
            <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold">{selected.name}</h2>
                {selected.description && <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={selected.isDefault} onChange={() => toggleDefault(selected)} />
                  Default template
                </label>
                <Button size="sm" onClick={() => setEditItem({ label: '', titleEn: '', titleEs: '', descEn: '', descEs: '', requiredCount: 1 })}>+ Add Item</Button>
              </div>
            </div>

            <Card className="mb-4">
              <CardContent className="pt-4 space-y-3">
                <h3 className="font-medium text-sm">Field tracking &amp; stale warnings</h3>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!selected.enableTimeTracking} onChange={e => saveTemplateSettings({ enableTimeTracking: e.target.checked })} />
                  Enable time tracking (clock-in / sprint)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!selected.enableStaleWarnings} onChange={e => saveTemplateSettings({ enableStaleWarnings: e.target.checked })} />
                  Enable stale project warnings
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">SLA not started (days)</Label>
                    <Input type="number" min={0} className="mt-1" defaultValue={selected.slaDaysNotStarted ?? ''} onBlur={e => saveTemplateSettings({ slaDaysNotStarted: e.target.value ? parseInt(e.target.value) : null })} />
                  </div>
                  <div>
                    <Label className="text-xs">SLA incomplete (days)</Label>
                    <Input type="number" min={0} className="mt-1" defaultValue={selected.slaDaysIncomplete ?? ''} onBlur={e => saveTemplateSettings({ slaDaysIncomplete: e.target.value ? parseInt(e.target.value) : null })} />
                  </div>
                  <div>
                    <Label className="text-xs">Idle stale (days)</Label>
                    <Input type="number" min={1} className="mt-1" defaultValue={selected.staleDaysIdle ?? 3} onBlur={e => saveTemplateSettings({ staleDaysIdle: parseInt(e.target.value) || 3 })} />
                  </div>
                  <div>
                    <Label className="text-xs">Geofence (m)</Label>
                    <Input type="number" min={50} className="mt-1" defaultValue={selected.geofenceRadiusM ?? 150} onBlur={e => saveTemplateSettings({ geofenceRadiusM: parseInt(e.target.value) || 150 })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {editItem && (
              <Card className="mb-4 border-primary">
                <CardContent className="pt-4 space-y-3">
                  <h3 className="font-medium">{editItem.id ? 'Edit Item' : 'New Item'}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>Label</Label><Input className="mt-1" value={editItem.label} onChange={e => setEditItem(p => p ? { ...p, label: e.target.value } : null)} /></div>
                    <div><Label>Photos Required</Label><Input type="number" min={1} className="mt-1" value={editItem.requiredCount} onChange={e => setEditItem(p => p ? { ...p, requiredCount: parseInt(e.target.value) || 1 } : null)} /></div>
                    <div><Label>Title EN</Label><Input className="mt-1" value={editItem.titleEn} onChange={e => setEditItem(p => p ? { ...p, titleEn: e.target.value } : null)} /></div>
                    <div><Label>Title ES</Label><Input className="mt-1" value={editItem.titleEs} onChange={e => setEditItem(p => p ? { ...p, titleEs: e.target.value } : null)} /></div>
                  </div>
                  <div><Label>Desc EN</Label><Textarea className="mt-1" value={editItem.descEn} onChange={e => setEditItem(p => p ? { ...p, descEn: e.target.value } : null)} /></div>
                  <div><Label>Desc ES</Label><Textarea className="mt-1" value={editItem.descEs} onChange={e => setEditItem(p => p ? { ...p, descEs: e.target.value } : null)} /></div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveItem}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {(selected.items || []).length === 0 ? (
              <EmptyState title="No items" description='Click "+ Add Item" to add photo checklist items.' />
            ) : (
              <div className="space-y-2">
                {(selected.items || []).map(item => (
                  <Card key={item.id}>
                    <CardContent className="py-3 flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-primary">{item.label}</span>
                          <span className="text-sm">{item.titleEn}</span>
                          <Badge variant="secondary">{item.requiredCount} photo{item.requiredCount > 1 ? 's' : ''}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.descEn}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setEditItem({ id: item.id, label: item.label, titleEn: item.titleEn, titleEs: item.titleEs, descEn: item.descEn, descEs: item.descEs, requiredCount: item.requiredCount })}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteItem(item.id)}>Del</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
